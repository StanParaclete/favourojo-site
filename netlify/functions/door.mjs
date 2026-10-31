/* Door check-in for the night.

   GET  /api/door?key=ADMIN_KEY            -> everyone with a seat + who has arrived
   POST /api/door { key, id, in: true|false } -> mark someone arrived (or undo)

   Used by /unburden/door/ on a phone at the entrance. */

import { getStore } from '@netlify/blobs';
import { STORE_NAME, json } from '../lib/event.mjs';
import { adminOk } from '../lib/extras.mjs';

const tail = (p) => { const d = String(p || '').replace(/\D/g, ''); return d ? '…' + d.slice(-4) : ''; };

export default async (req) => {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  if (req.method === 'GET') {
    if (!adminOk(new URL(req.url).searchParams.get('key'))) return json(401, { error: 'Wrong door key' });
    const { blobs } = await store.list({ prefix: 'reg/' });
    const rows = (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }).then((r) => r && r.seat > 0 && {
      id: b.key.slice(4), seat: r.seat, name: r.name, phone: tail(r.phone), email: r.email, in: r.checkedInAt || null,
    })))).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
    const w = await store.list({ prefix: 'walkin/' });
    const walkins = (await Promise.all(w.blobs.map((b) => store.get(b.key, { type: 'json' }))))
      .filter(Boolean)
      .map((x) => ({ id: x.id, name: x.name, phone: tail(x.phone), email: x.email || '', in: x.at, walkin: true, by: x.by }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return json(200, { rows, walkins, total: rows.length, arrived: rows.filter((r) => r.in).length + walkins.length });
  }

  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Bad request' }); }
  if (!adminOk(body.key)) return json(401, { error: 'Wrong door key' });
  /* remove a walk-in entered by mistake */
  if (/^w[a-f0-9]{16}$/.test(String(body.id)) && body.remove) {
    await store.delete('walkin/' + body.id);
    return json(200, { ok: true, removed: body.id });
  }
  if (!/^[a-f0-9]{32}$/.test(String(body.id))) return json(400, { error: 'Bad id' });

  const key = 'reg/' + body.id;
  const rec = await store.get(key, { type: 'json' });
  if (!rec) return json(404, { error: 'Not found. They may have released their seat.' });
  const checkedInAt = body.in ? (rec.checkedInAt || new Date().toISOString()) : null;
  await store.setJSON(key, { ...rec, checkedInAt });
  return json(200, { ok: true, id: body.id, in: checkedInAt });
};

export const config = { path: '/api/door' };

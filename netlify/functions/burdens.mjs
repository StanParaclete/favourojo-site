/* "Lay it down" — the burden wall.

   GET  /api/burdens                    -> { count, open }
   POST /api/burdens { text, website, t } -> { ok, count }
   GET  /api/burdens?key=ADMIN_KEY      -> every note as CSV, for the prayer team

   Notes are anonymous and never shown publicly: the page shows only
   how many have been laid down. */

import { getStore } from '@netlify/blobs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { STORE_NAME, isClosedByTime, json } from '../lib/event.mjs';
import { underLimit } from '../lib/extras.mjs';

const countNotes = async (store) => (await store.list({ prefix: 'burden/' })).blobs.length;

const sameKey = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};
const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = '\t' + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export default async (req) => {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const key = url.searchParams.get('key');
    if (key !== null) {
      if (!process.env.ADMIN_KEY || !sameKey(key, process.env.ADMIN_KEY)) return json(401, { error: 'Not allowed' });
      const { blobs } = await store.list({ prefix: 'burden/' });
      const notes = (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }))))
        .filter(Boolean).sort((a, b) => a.at.localeCompare(b.at));
      const lines = ['#,Received (UTC),Note'].concat(notes.map((n, i) => [i + 1, n.at, n.text].map(csvCell).join(',')));
      return new Response(lines.join('\r\n') + '\r\n', {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': 'attachment; filename="unburden-prayer-notes.csv"',
          'cache-control': 'no-store',
        },
      });
    }
    return json(200, { count: await countNotes(store), open: !isClosedByTime() });
  }

  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Something went wrong. Please try again.' }); }
  if (body.website || (Number(body.t) > 0 && Number(body.t) < 1500)) return json(200, { ok: true, count: 0 });
  if (isClosedByTime()) return json(410, { error: 'The wall has closed. Thank you for every note.' });

  const text = String(body.text ?? '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 600);
  if (text.length < 3) return json(422, { error: 'Write a few words first.' });

  if (!(await underLimit(store, req, 'burden', 30))) {
    return json(429, { error: 'Thank you. Give it a moment before laying down another.' });
  }

  const at = new Date().toISOString();
  await store.setJSON(`burden/${at}-${randomBytes(4).toString('hex')}`, { text, at });
  return json(200, { ok: true, count: await countNotes(store) });
};

export const config = { path: '/api/burdens' };

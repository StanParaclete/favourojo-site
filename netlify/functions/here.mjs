/* POST /api/here { email? | phone? | id?, key?, website, t }
   Self check-in from the QR stand at the entrance (/unburden/here).

   Finds the person's registration by email, phone number or registration id
   and marks them arrived, so they show up on the admin dashboard and the
   door page straight away. Not found -> { found: false } and the page offers
   the walk-in form instead (which posts to /api/walkin).

   Open on the event day only (same window as the walk-in form). With the
   door/admin key it works any time, so the team can try it out beforehand. */

import { getStore } from '@netlify/blobs';
import { STORE_NAME, json, walkinOpenNow } from '../lib/event.mjs';
import { adminOk, regKey, underLimit } from '../lib/extras.mjs';

const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const digits = (s) => String(s ?? '').replace(/\D/g, '');
/* compare the last 10 digits so 0803…, 234803… and +234 803… all match */
const samePhone = (a, b) => { const x = digits(a).slice(-10), y = digits(b).slice(-10); return x.length === 10 && x === y; };

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Something went wrong. Please try again.' }); }

  const team = adminOk(body.key);
  if (!team) {
    if (body.website || (Number(body.t) > 0 && Number(body.t) < 800)) return json(200, { ok: true, found: false });
    if (!walkinOpenNow()) return json(403, { error: 'Check-in opens on Sunday 15 November from 1 PM.', state: 'notyet' });
  }

  const email = clean(body.email, 160).toLowerCase();
  const phone = clean(body.phone, 30);
  const id = /^[a-f0-9]{32}$/.test(String(body.id)) ? String(body.id) : '';
  if (!email && digits(phone).length < 10 && !id) {
    return json(422, { error: 'Enter the email or phone number you registered with.' });
  }

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  if (!team && !(await underLimit(store, req, 'here', 30))) return json(429, { error: 'Just a moment, then try again.' });

  /* find the registration */
  let key = null, rec = null;
  const tryKey = async (k) => { const r = await store.get(k, { type: 'json' }); if (r && r.seat > 0) { key = k; rec = r; } };
  if (id) await tryKey('reg/' + id);
  if (!rec && email) await tryKey(regKey(email));
  if (!rec && digits(phone).length >= 10) {
    const { blobs } = await store.list({ prefix: 'reg/' });
    for (const b of blobs) {
      const r = await store.get(b.key, { type: 'json' });
      if (r && r.seat > 0 && samePhone(r.phone, phone)) { key = b.key; rec = r; break; }
    }
  }
  if (!rec) return json(200, { ok: true, found: false });

  const already = !!rec.checkedInAt;
  const at = rec.checkedInAt || new Date().toISOString();
  if (!already) await store.setJSON(key, { ...rec, checkedInAt: at, checkedInBy: 'self' });
  return json(200, { ok: true, found: true, already, firstName: rec.name.split(' ')[0], at });
};

export const config = { path: '/api/here' };

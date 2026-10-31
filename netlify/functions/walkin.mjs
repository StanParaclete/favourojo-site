/* POST /api/walkin { name, phone, email?, key?, website, t }
   Records someone who came without registering.

   - From the door page (with the door key): works any time, and the person
     is counted as arrived straight away.
   - Self-serve, from the poster at the entrance (no key): only works on the
     event day (see walkinOpens / walkinCloses in event.mjs).

   If the email matches someone who DID register, that registration is
   checked in instead, so nobody is counted twice. */

import { getStore } from '@netlify/blobs';
import { randomBytes } from 'node:crypto';
import { STORE_NAME, json, walkinOpenNow } from '../lib/event.mjs';
import { adminOk, regKey, underLimit } from '../lib/extras.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Something went wrong. Please try again.' }); }

  const byDoor = adminOk(body.key);
  if (!byDoor) {
    if (body.website || (Number(body.t) > 0 && Number(body.t) < 2000)) return json(200, { ok: true });
    if (!walkinOpenNow()) return json(403, { error: 'This form opens on the day of the event.', state: 'notyet' });
  }

  const name = clean(body.name, 120);
  const phone = clean(body.phone, 30);
  const email = clean(body.email, 160).toLowerCase();
  const errors = {};
  if (name.length < 2) errors.name = 'Please enter a full name.';
  const d = phone.replace(/\D/g, '');
  if (d.length < 10 || d.length > 15) errors.phone = 'Please enter a valid phone number.';
  if (email && !EMAIL_RE.test(email)) errors.email = 'That email doesn’t look right (or leave it empty).';
  if (Object.keys(errors).length) return json(422, { error: 'Please check the highlighted fields.', errors });

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  if (!byDoor) {
    if (!(await underLimit(store, req, 'walkin', 40))) return json(429, { error: 'Just a moment, then try again.' });
  }

  const now = new Date().toISOString();

  /* actually registered? check them in instead of adding a walk-in */
  if (email) {
    const rkey = regKey(email);
    const reg = await store.get(rkey, { type: 'json' });
    if (reg && reg.seat > 0) {
      if (!reg.checkedInAt) await store.setJSON(rkey, { ...reg, checkedInAt: now });
      return json(200, { ok: true, registered: true, firstName: reg.name.split(' ')[0] });
    }
  }

  const id = 'w' + randomBytes(8).toString('hex');
  await store.setJSON('walkin/' + id, { id, name, phone, email, at: now, by: byDoor ? 'door' : 'self' });
  return json(200, { ok: true, walkin: true, id, firstName: name.split(' ')[0], at: now });
};

export const config = { path: '/api/walkin' };

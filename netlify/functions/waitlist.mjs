/* POST /api/waitlist { name, email, phone, website, t }
   Only used once all seats are taken. If a seat has opened in the
   meantime, it says so and the page shows the form again instead. */

import { getStore } from '@netlify/blobs';
import { EVENT, STORE_NAME, isClosedByTime, json } from '../lib/event.mjs';
import { regKey, takenSlots } from '../lib/extras.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Something went wrong. Please try again.' }); }
  if (body.website || (Number(body.t) > 0 && Number(body.t) < 2500)) return json(200, { ok: true });
  if (isClosedByTime()) return json(410, { error: 'The evening has started.', state: 'closed' });

  const name = clean(body.name, 120);
  const email = clean(body.email, 160).toLowerCase();
  const phone = clean(body.phone, 30);
  const errors = {};
  if (name.length < 2) errors.name = 'Please enter your full name.';
  if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.';
  const d = phone.replace(/\D/g, '');
  if (d.length < 10 || d.length > 15) errors.phone = 'Please enter a valid phone number.';
  if (Object.keys(errors).length) return json(422, { error: 'Please check the highlighted fields.', errors });

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  if ((await takenSlots(store)).size < EVENT.capacity) return json(200, { ok: false, state: 'open', error: 'Good news, a seat is free right now. Register above.' });

  const key = regKey(email);
  if (await store.get(key, { type: 'json' })) return json(200, { ok: true, hasSeat: true });

  await store.setJSON(key.replace(/^reg\//, 'wait/'), { name, email, phone, at: new Date().toISOString() }, { onlyIfNew: true });
  return json(200, { ok: true, firstName: name.split(' ')[0] });
};

export const config = { path: '/api/waitlist' };

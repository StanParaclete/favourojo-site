/* POST /api/release { k, t }
   Gives a seat back. k is the registration id and t its secret token,
   both from the link in that person's emails. The seat is freed,
   their song vote is removed, and the waitlist is told. */

import { getStore } from '@netlify/blobs';
import { timingSafeEqual } from 'node:crypto';
import { STORE_NAME, isClosedByTime, json } from '../lib/event.mjs';
import { releaseSlot, notifyWaitlist } from '../lib/extras.mjs';

const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Something went wrong.' }); }

  const id = String(body.k || '');
  if (!/^[a-f0-9]{32}$/.test(id) || !body.t) return json(400, { error: 'This link isn’t complete. Please use the link from your email.' });
  if (isClosedByTime()) return json(410, { error: 'The evening has already started.' });

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const key = 'reg/' + id;
  const rec = await store.get(key, { type: 'json' });
  if (!rec) return json(200, { ok: true, already: true });           /* already released */
  if (!rec.token || !same(rec.token, body.t)) return json(403, { error: 'This link isn’t valid. Please use the link from your email.' });

  await store.delete(key);
  await releaseSlot(store, rec.seat, id);
  await store.delete('lock/' + id);                       /* so they can register again later */
  if (rec.song) { try { await store.delete('tally'); } catch (e) { console.error(e); } }
  try { await notifyWaitlist(store, 3); } catch (e) { console.error('waitlist notify:', e); }

  return json(200, { ok: true, firstName: rec.name.split(' ')[0] });
};

export const config = { path: '/api/release' };

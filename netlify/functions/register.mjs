/* POST /api/register  { name, email, phone, song, website(honeypot), t }
   One seat per email, never more than EVENT.capacity seats in total,
   then the confirmation email. */

import { getStore } from '@netlify/blobs';
import { EVENT, STORE_NAME, isClosedByTime, json } from '../lib/event.mjs';
import { sendConfirmation } from '../lib/email.mjs';
import { SONG_SLUGS, regKey, idFromKey, newToken, ensureToken, releaseUrl, claimSlot, takenSlots, releaseSlot } from '../lib/extras.mjs';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Something went wrong. Please try again.' }); }

  /* bots fill the hidden field, or submit faster than a person can type */
  if (body.website || (Number(body.t) > 0 && Number(body.t) < 2500)) return json(200, { ok: true });

  if (isClosedByTime()) return json(410, { error: 'Registration for this event has closed.', state: 'closed' });

  const name = clean(body.name, 120);
  const email = clean(body.email, 160).toLowerCase();
  const phone = clean(body.phone, 30);
  const digits = phone.replace(/\D/g, '');

  const errors = {};
  if (name.length < 2) errors.name = 'Please enter your full name.';
  if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.';
  if (digits.length < 10 || digits.length > 15) errors.phone = 'Please enter a valid phone number.';
  if (Object.keys(errors).length) return json(422, { error: 'Please check the highlighted fields.', errors });

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const key = regKey(email);
  const firstName = name.split(' ')[0];
  const song = SONG_SLUGS.has(String(body.song || '')) ? String(body.song) : '';

  /* ---- already registered? ---- */
  const existing = await store.get(key, { type: 'json' });
  if (existing && existing.seat > 0) {
    const first = existing.name.split(' ')[0];
    /* someone who lost their email can register again to get it resent -
       at most once every 10 minutes, so nobody can flood an inbox */
    let resent = false;
    const last = Date.parse(existing.lastSentAt || existing.registeredAt) || 0;
    if (!existing.emailed || Date.now() - last > 10 * 60 * 1000) {
      const token = await ensureToken(store, key, existing);
      resent = await sendConfirmation({ to: email, firstName: first, seat: existing.seat, releaseUrl: releaseUrl(key, token), qrId: idFromKey(key) });
      if (resent) {
        const now = await store.get(key, { type: 'json' });
        if (now) await store.setJSON(key, { ...now, emailed: true, lastSentAt: new Date().toISOString() });
      }
    }
    return json(200, { ok: true, already: true, resent, firstName: first, song: existing.song || '', id: idFromKey(key) });
  }

  /* ---- claim a seat ----
     The seat slot is named after this email's id, so the same email
     sent twice at once lands on one slot each at most - and the second
     request then finds the first one's record and stops. */
  const lockKey = 'lock/' + idFromKey(key);
  const lock = await store.setJSON(lockKey, { at: Date.now() }, { onlyIfNew: true });
  if (!lock.modified) {
    const l = await store.get(lockKey, { type: 'json' });
    /* a lock older than a minute is from a request that crashed - take it over */
    if (l && Date.now() - l.at < 60000) {
      return json(409, { error: 'We’re already saving a seat for this email. Give it a few seconds, then check your inbox.' });
    }
    await store.setJSON(lockKey, { at: Date.now() });
  }

  let seat = 0;
  try { seat = await claimSlot(store, idFromKey(key)); }
  catch (err) {
    console.error(err);
    await store.delete(lockKey);
    return json(503, { error: 'A lot of people are registering right now. Please try again in a moment.' });
  }

  if (!seat) {
    await store.delete(lockKey);
    return json(409, { error: 'All seats have been taken.', state: 'full' });
  }

  /* belt and braces: if a record appeared meanwhile, keep that seat and give this one back */
  const raced = await store.get(key, { type: 'json' });
  if (raced && raced.seat > 0 && raced.seat !== seat) {
    await releaseSlot(store, seat, idFromKey(key));
    return json(200, { ok: true, already: true, firstName: raced.name.split(' ')[0], song: raced.song || '' });
  }

  const record = {
    seat, name, email, phone, song,
    registeredAt: new Date().toISOString(),
    emailed: false,
    token: newToken(),        /* for the "release your seat" link */
  };
  await store.setJSON(key, record);

  /* the song tally is recounted on the next page view */
  if (song) { try { await store.delete('tally'); } catch {} }

  /* if they were on the waitlist, mark them as sorted */
  try {
    const wkey = key.replace(/^reg\//, 'wait/');
    const w = await store.get(wkey, { type: 'json' });
    if (w) await store.setJSON(wkey, { ...w, registered: true });
  } catch (err) { console.error('waitlist mark:', err); }

  record.emailed = await sendConfirmation({ to: email, firstName, seat, releaseUrl: releaseUrl(key, record.token), qrId: idFromKey(key) });
  if (record.emailed) {
    record.lastSentAt = new Date().toISOString();
    const now = await store.get(key, { type: 'json' });
    await store.setJSON(key, { ...(now || record), emailed: true, lastSentAt: record.lastSentAt });
  }

  return json(200, { ok: true, firstName, song, emailed: record.emailed, id: idFromKey(key) });
};

export const config = { path: '/api/register' };

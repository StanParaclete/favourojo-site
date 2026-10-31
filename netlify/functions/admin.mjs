/* GET /api/admin?key=ADMIN_KEY  -> everything the team needs, in one go:
   totals, every registration, walk-ins, waitlist, song votes, prayer notes.
   Powers /unburden/admin. Refuses anyone without the key. */

import { getStore } from '@netlify/blobs';
import { EVENT, STORE_NAME, json } from '../lib/event.mjs';
import { SONGS, adminOk } from '../lib/extras.mjs';

const songTitle = (slug) => (SONGS.find((s) => s.slug === slug) || {}).title || '';

async function all(store, prefix) {
  const { blobs } = await store.list({ prefix });
  return (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }).then((d) => d && { _key: b.key, ...d })))).filter(Boolean);
}

export default async (req) => {
  if (!adminOk(new URL(req.url).searchParams.get('key'))) return json(401, { error: 'Wrong password' });
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  const [regsRaw, walkinsRaw, waitRaw, notesRaw] = await Promise.all([
    all(store, 'reg/'), all(store, 'walkin/'), all(store, 'wait/'), all(store, 'burden/'),
  ]);

  const regs = regsRaw.filter((r) => r.seat > 0).map((r) => ({
    id: r._key.slice(4), no: r.seat, name: r.name, email: r.email, phone: r.phone,
    song: songTitle(r.song), registeredAt: r.registeredAt, emailed: !!r.emailed,
    checkedInAt: r.checkedInAt || null,
  })).sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));

  const walkins = walkinsRaw.map((w) => ({ name: w.name, phone: w.phone, email: w.email || '', at: w.at, by: w.by }))
    .sort((a, b) => b.at.localeCompare(a.at));
  const waitlist = waitRaw.map((w) => ({ name: w.name, email: w.email, phone: w.phone, at: w.at, notifiedAt: w.notifiedAt || null, gotSeat: !!w.registered }))
    .sort((a, b) => a.at.localeCompare(b.at));
  const notes = notesRaw.map((n) => ({ text: n.text, at: n.at })).sort((a, b) => b.at.localeCompare(a.at));

  const songs = SONGS.map((s) => ({ title: s.title, votes: regs.filter((r) => r.song === s.title).length }))
    .sort((a, b) => b.votes - a.votes);

  /* sign-ups per day, for the little chart */
  const perDay = {};
  regs.forEach((r) => { const d = r.registeredAt.slice(0, 10); perDay[d] = (perDay[d] || 0) + 1; });

  return json(200, {
    capacity: EVENT.capacity,
    closesAt: EVENT.closesAt,
    totals: {
      registered: regs.length,
      left: Math.max(0, EVENT.capacity - regs.length),
      arrived: regs.filter((r) => r.checkedInAt).length,
      walkins: walkins.length,
      waitlist: waitlist.filter((w) => !w.gotSeat).length,
      notes: notes.length,
      emailFailed: regs.filter((r) => !r.emailed).length,
    },
    perDay,
    regs, walkins, waitlist, notes, songs,
  });
};

export const config = { path: '/api/admin' };

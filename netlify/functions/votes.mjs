/* The people's setlist.

   GET  /api/votes                 -> { tally: [{slug,title,votes}], total }
   POST /api/votes { email, song } -> sets (or changes) that registered
                                      person's pick, returns the new tally

   Only people with a seat can vote, one pick each, so the tally
   can't be stuffed. */

import { getStore } from '@netlify/blobs';
import { STORE_NAME, isClosedByTime, json } from '../lib/event.mjs';
import { SONG_SLUGS, regKey, recomputeTally } from '../lib/extras.mjs';

export default async (req) => {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  if (req.method === 'GET') {
    let doc = await store.get('tally', { type: 'json' });
    /* self-heal: if two votes landed at the same instant, a recount within
       a couple of minutes picks up whichever one the first count missed */
    if (!doc || Date.now() - doc.at > 120000) doc = await recomputeTally(store);
    return json(200, publicTally(doc));
  }

  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
  if (isClosedByTime()) return json(410, { error: 'Voting has closed.' });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: 'Something went wrong. Please try again.' }); }

  const song = String(body.song || '');
  if (!SONG_SLUGS.has(song)) return json(422, { error: 'Please pick a song from the list.' });

  const email = String(body.email || '').trim().toLowerCase();
  const key = regKey(email);
  const reg = email && await store.get(key, { type: 'json' });
  if (!reg || !(reg.seat > 0)) return json(404, { error: 'Register for a seat first, then pick your song.' });

  await store.setJSON(key, { ...reg, song });
  const doc = await recomputeTally(store);
  return json(200, { ok: true, song, ...publicTally(doc) });
};

/* songs in order with a 0-100 share of the leader's votes - enough to draw
   the bars, but no raw counts, which would hint at how many people registered */
function publicTally(doc) {
  const max = Math.max(1, ...doc.tally.map((t) => t.votes));
  return {
    tally: doc.tally.map((t) => ({ slug: t.slug, title: t.title, votes: t.votes ? Math.max(1, Math.round(t.votes / max * 100)) : 0 })),
    total: doc.total > 0 ? 1 : 0,
  };
}

export const config = { path: '/api/votes' };

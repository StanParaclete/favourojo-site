/* =========================================================
   Shared helpers for the burden wall and the song vote.
   ========================================================= */

import { createHash } from 'node:crypto';

/* the songs people can vote for - same catalogue as the homepage chart */
export const SONGS = [
  { slug: 'free',                title: 'FREE' },
  { slug: 'yahweh-tsidkenu',     title: 'Yahweh Tsidkenu' },
  { slug: 'atofarati',           title: 'Atofarati' },
  { slug: 'iba',                 title: 'IBA' },
  { slug: 'yesu-mai-girma',      title: 'Yesu Mai Girma' },
  { slug: 'water-to-wine-ii',    title: 'Water To Wine II' },
  { slug: 'marys-praise-ii',     title: "Mary's Praise II" },
  { slug: 'ese',                 title: 'Ese' },
  { slug: 'worship-medley-7',    title: 'Worship Medley 7' },
  { slug: 'spontaneous-worship', title: 'Spontaneous Worship' },
  { slug: 'elshaddai',           title: 'Elshaddai' },
];
export const SONG_SLUGS = new Set(SONGS.map((s) => s.slug));

export const regKey = (email) =>
  'reg/' + createHash('sha256').update(String(email).toLowerCase()).digest('hex').slice(0, 32);

export const hashIp = (req) => {
  const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'local';
  return createHash('sha256').update('unburden:' + ip).digest('hex').slice(0, 24);
};

/* adds 1 to a counter without ever losing a concurrent write */
export async function increment(store, key) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const cur = await store.getWithMetadata(key, { type: 'json' });
    const n = (cur?.data?.n ?? 0) + 1;
    const res = cur
      ? await store.setJSON(key, { n }, { onlyIfMatch: cur.etag })
      : await store.setJSON(key, { n }, { onlyIfNew: true });
    if (res.modified) return n;
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 90));
  }
  throw new Error('counter busy: ' + key);
}

/* counts every registered person's song pick and stores the result.
   At 100 seats this is 100 small reads, and it only runs when someone
   votes, so the public page just reads one ready-made document. */
export async function recomputeTally(store) {
  const { blobs } = await store.list({ prefix: 'reg/' });
  const regs = await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' })));
  const counts = Object.fromEntries(SONGS.map((s) => [s.slug, 0]));
  let total = 0;
  for (const r of regs) {
    if (r && r.seat > 0 && r.song && r.song in counts) { counts[r.song]++; total++; }
  }
  const tally = SONGS
    .map((s) => ({ slug: s.slug, title: s.title, votes: counts[s.slug] }))
    .sort((a, b) => b.votes - a.votes || SONGS.findIndex((s) => s.slug === a.slug) - SONGS.findIndex((s) => s.slug === b.slug));
  const doc = { tally, total, at: Date.now() };
  await store.setJSON('tally', doc);
  return doc;
}

/* ---------- v14: release, waitlist, door, reminders ---------- */

import { randomBytes, timingSafeEqual } from 'node:crypto';
import { EVENT } from './event.mjs';
import { sendEmail, sendBatch, seatOpenEmail, reminderEmail } from './email.mjs';

export const newToken = () => randomBytes(9).toString('hex');
export const idFromKey = (key) => key.replace(/^reg\//, '');
export const releaseUrl = (key, token) =>
  `${EVENT.pageUrl}/release/?k=${encodeURIComponent(idFromKey(key))}&t=${encodeURIComponent(token)}`;

export function adminOk(given) {
  const admin = process.env.ADMIN_KEY;
  if (!admin || !given) return false;
  const x = Buffer.from(String(given)), y = Buffer.from(String(admin));
  return x.length === y.length && timingSafeEqual(x, y);
}

/* takes 1 off a counter, never below zero */
export async function decrement(store, key) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const cur = await store.getWithMetadata(key, { type: 'json' });
    const n = cur?.data?.n ?? 0;
    if (n <= 0) return 0;
    const res = await store.setJSON(key, { n: n - 1 }, { onlyIfMatch: cur.etag });
    if (res.modified) return n - 1;
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 90));
  }
  throw new Error('counter busy: ' + key);
}

/* makes sure a registration has a release token, saving it if new */
export async function ensureToken(store, key, rec) {
  if (rec.token) return rec.token;
  const now = await store.get(key, { type: 'json' });
  if (now && now.token) return (rec.token = now.token);
  rec.token = newToken();
  if (now) await store.setJSON(key, { ...now, token: rec.token });
  return rec.token;
}

/* a seat opened: email the next few people on the waitlist who
   haven't been told yet. Seats go to whoever registers first. */
export async function notifyWaitlist(store, howMany = 3) {
  const { blobs } = await store.list({ prefix: 'wait/' });
  const people = (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }).then((d) => d && { key: b.key, ...d }))))
    .filter((p) => p && !p.notifiedAt && !p.registered)
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, howMany);
  for (const p of people) {
    const ok = await sendEmail(p.email, seatOpenEmail(p.name.split(' ')[0]));
    const { key, ...rest } = p;
    await store.setJSON(key, { ...rest, notifiedAt: new Date().toISOString(), notifyOk: ok });
  }
  return people.length;
}

/* kind: 'tomorrow' | 'today'. Safe to run twice: each person is
   only ever sent each reminder once. */
export async function runReminders(store, kind) {
  const flag = kind === 'tomorrow' ? 'remindedTomorrow' : 'remindedToday';
  const { blobs } = await store.list({ prefix: 'reg/' });
  const regs = (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }).then((d) => d && { key: b.key, rec: d }))))
    .filter((r) => r && r.rec.seat > 0 && !r.rec[flag]);

  const messages = [];
  for (const r of regs) {
    const token = await ensureToken(store, r.key, r.rec);
    messages.push({
      to: r.rec.email,
      ...reminderEmail(kind, r.rec.name.split(' ')[0], { seat: r.rec.seat, releaseUrl: releaseUrl(r.key, token), qrId: idFromKey(r.key) }),
    });
  }
  if (!messages.length) return { sent: 0 };

  const ok = await sendBatch(messages);
  if (ok) {
    const at = new Date().toISOString();
    /* re-read each one, so a seat released in the meantime is not brought back */
    await Promise.all(regs.map(async (r) => {
      const now = await store.get(r.key, { type: 'json' });
      if (now) await store.setJSON(r.key, { ...now, [flag]: at });
    }));
  }
  return { sent: ok ? messages.length : 0, attempted: messages.length };
}

/* ---------- v15: seat slots ----------
   There are exactly EVENT.capacity seat records: seat/001 ... seat/100.
   Claiming one = creating it if it doesn't exist, then reading it back
   to confirm we really own it. Because only 100 slot names exist, the
   room can never be oversold, even if two people press the button in
   the same millisecond. Releasing a seat deletes its slot. */

const pad = (n) => String(n).padStart(3, '0');
export const slotKey = (n) => 'seat/' + pad(n);

export async function takenSlots(store) {
  const { blobs } = await store.list({ prefix: 'seat/' });
  return new Set(blobs.map((b) => Number(b.key.slice(5))).filter((n) => n >= 1 && n <= EVENT.capacity));
}

export async function claimSlot(store, regId) {
  for (let attempt = 0; attempt < 25; attempt++) {
    let taken = await takenSlots(store);
    if (taken.size >= EVENT.capacity) {
      /* before saying "full", free any slot whose registration never
         finished (a crashed request) - but only once it's 2 minutes old */
      if (attempt === 0 && (await sweepSlots(store)) > 0) taken = await takenSlots(store);
      if (taken.size >= EVENT.capacity) return 0;
    }
    const free = [];
    for (let n = 1; n <= EVENT.capacity; n++) if (!taken.has(n)) free.push(n);
    /* random free slot, so a rush of sign-ups doesn't all fight over the same one */
    const n = free[Math.floor(Math.random() * free.length)];
    const res = await store.setJSON(slotKey(n), { id: regId, at: Date.now() }, { onlyIfNew: true });
    if (res.modified) {
      await new Promise((r) => setTimeout(r, 120));
      const check = await store.get(slotKey(n), { type: 'json' });
      if (check && check.id === regId) return n;
    }
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 80));
  }
  throw new Error('could not claim a seat after retries');
}

export async function releaseSlot(store, n, regId) {
  if (!n) return;
  const cur = await store.get(slotKey(n), { type: 'json' });
  if (cur && cur.id === regId) await store.delete(slotKey(n));
}

/* frees slots that don't belong to a finished registration */
export async function sweepSlots(store) {
  const { blobs } = await store.list({ prefix: 'seat/' });
  let freed = 0;
  await Promise.all(blobs.map(async (b) => {
    const slot = await store.get(b.key, { type: 'json' });
    if (!slot || Date.now() - slot.at < 120000) return;
    const reg = await store.get('reg/' + slot.id, { type: 'json' });
    if (!reg || reg.seat !== Number(b.key.slice(5))) { await store.delete(b.key); freed++; }
  }));
  return freed;
}

/* Per-connection allowance per minute. Generous on purpose: venue Wi-Fi and
   Nigerian mobile networks put many real people behind one address, so this
   only stops a script hammering the form, never a queue of guests. */
export async function underLimit(store, req, bucket, perMinute) {
  const minute = Math.floor(Date.now() / 60000);
  const key = `rate/${bucket}/${hashIp(req)}/${minute}`;
  const cur = await store.get(key, { type: 'json' });
  const n = (cur?.n ?? 0) + 1;
  if (n > perMinute) return false;
  await store.setJSON(key, { n });
  return true;
}

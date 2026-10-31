/* Spreadsheet downloads for the team (open in Excel or Google Sheets).

   GET /api/registrations?key=ADMIN_KEY                 -> everyone with a seat
   GET /api/registrations?key=ADMIN_KEY&list=waitlist   -> the waitlist
   GET /api/registrations?key=ADMIN_KEY&list=walkins    -> people who came without registering
   GET /api/registrations?key=ADMIN_KEY&format=json     -> seats as JSON

   ADMIN_KEY is an environment variable set in Netlify. Without it
   this endpoint refuses everyone. */

import { getStore } from '@netlify/blobs';
import { STORE_NAME, json } from '../lib/event.mjs';
import { SONGS, adminOk } from '../lib/extras.mjs';

const songTitle = (slug) => (SONGS.find((s) => s.slug === slug) || {}).title || '';

const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@]/.test(s)) s = '\t' + s;   /* stops Excel reading +234… as a formula; the tab is invisible */
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

const csv = (filename, head, rows) => new Response(
  [head.join(',')].concat(rows.map((r) => r.map(csvCell).join(','))).join('\r\n') + '\r\n',
  {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  },
);

export default async (req) => {
  const url = new URL(req.url);
  if (!adminOk(url.searchParams.get('key'))) return json(401, { error: 'Not allowed' });

  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  if (url.searchParams.get('list') === 'waitlist') {
    const { blobs } = await store.list({ prefix: 'wait/' });
    const rows = (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }))))
      .filter(Boolean).sort((a, b) => a.at.localeCompare(b.at));
    return csv('unburden-waitlist.csv',
      ['#', 'Name', 'Email', 'Phone', 'Joined (UTC)', 'Told a seat opened', 'Got a seat'],
      rows.map((r, i) => [i + 1, r.name, r.email, r.phone, r.at, r.notifiedAt || '', r.registered ? 'yes' : '']));
  }

  if (url.searchParams.get('list') === 'walkins') {
    const { blobs } = await store.list({ prefix: 'walkin/' });
    const rows = (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }))))
      .filter(Boolean).sort((a, b) => a.at.localeCompare(b.at));
    return csv('unburden-walkins.csv',
      ['#', 'Name', 'Phone', 'Email', 'Arrived (UTC)', 'Added by'],
      rows.map((r, i) => [i + 1, r.name, r.phone, r.email || '', r.at, r.by === 'door' ? 'door volunteer' : 'themselves (poster)']));
  }

  const { blobs } = await store.list({ prefix: 'reg/' });
  const rows = (await Promise.all(blobs.map((b) => store.get(b.key, { type: 'json' }))))
    .filter((r) => r && r.seat > 0)
    .sort((a, b) => a.seat - b.seat);

  if (url.searchParams.get('format') === 'json') {
    return json(200, { count: rows.length, rows: rows.map(({ token, ...r }) => r) });
  }

  return csv('unburden-registrations.csv',
    ['No.', 'Name', 'Email', 'Phone', 'Song pick', 'Registered (UTC)', 'Email sent', 'Checked in'],
    rows.map((r) => [r.seat, r.name, r.email, r.phone, songTitle(r.song), r.registeredAt,
      r.emailed ? 'yes' : 'no', r.checkedInAt ? 'yes' : '']));
};

export const config = { path: '/api/registrations' };

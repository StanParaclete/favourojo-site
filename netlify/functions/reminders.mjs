/* Scheduled reminder emails. Netlify runs this by itself:
     14 November, 09:00 UTC (10 AM in Lagos) -> "See you tomorrow"
     15 November, 09:00 UTC (10 AM in Lagos) -> "Tonight at 5 PM"
   Each person gets each reminder once, even if this runs twice. */

import { getStore } from '@netlify/blobs';
import { STORE_NAME } from '../lib/event.mjs';
import { runReminders } from '../lib/extras.mjs';

export default async () => {
  const now = new Date();
  const day = now.getUTCDate(), month = now.getUTCMonth() + 1;
  if (month !== 11 || (day !== 14 && day !== 15)) {
    console.log('reminders: not a reminder day, nothing sent');
    return;
  }
  const kind = day === 14 ? 'tomorrow' : 'today';
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const result = await runReminders(store, kind);
  console.log('reminders', kind, JSON.stringify(result));
};

export const config = { schedule: '0 9 14,15 11 *' };

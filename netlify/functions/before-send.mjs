/* One-time send of the "Before you come" email, approved by the organisers
   on 14 Nov 2026. Netlify runs it by itself at 11:10 UTC (12:10 PM Lagos)
   that day. Each guest gets it once (same flag as the dashboard button),
   so it is harmless if it ever runs again. Safe to delete after the event. */

import { getStore } from '@netlify/blobs';
import { STORE_NAME } from '../lib/event.mjs';
import { runReminders } from '../lib/extras.mjs';

export default async () => {
  const now = new Date();
  if (now.getUTCFullYear() !== 2026 || now.getUTCMonth() !== 10 || now.getUTCDate() !== 14) {
    console.log('before-send: not 14 Nov 2026, nothing sent');
    return;
  }
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const result = await runReminders(store, 'before');
  console.log('before-send', JSON.stringify(result));
};

export const config = { schedule: '10 11 14 11 *' };

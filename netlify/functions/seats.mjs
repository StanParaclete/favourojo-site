/* GET /api/seats -> { state: 'open'|'full'|'closed', low: true|false }
   Deliberately no counts: the organisers asked not to show seat numbers. */

import { getStore } from '@netlify/blobs';
import { EVENT, STORE_NAME, isClosedByTime, json } from '../lib/event.mjs';
import { takenSlots } from '../lib/extras.mjs';

export default async () => {
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });
  const taken = Math.min((await takenSlots(store)).size, EVENT.capacity);
  const left = EVENT.capacity - taken;

  const state = isClosedByTime() ? 'closed' : left <= 0 ? 'full' : 'open';
  /* the public never sees numbers - only whether it's nearly full */
  return json(200, { state, low: state === 'open' && left <= EVENT.lowWhen });
};

export const config = { path: '/api/seats' };

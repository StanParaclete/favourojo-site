/* =========================================================
   Favour & Faves: UNBURDEN — the one place the event lives.

   Every function reads from here. To change the seat limit,
   the closing time or the wording of the email, change it here
   and redeploy. Nothing else needs touching.
   ========================================================= */

export const EVENT = {
  name: 'Favour & Faves: UNBURDEN',
  shortName: 'Favour & Faves',
  dateLong: 'Sunday, 15 November 2026',
  time: '5:00 PM WAT',
  venue: 'Café One, Adeola Odeku, Victoria Island, Lagos',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Caf%C3%A9+One+Adeola+Odeku+Victoria+Island+Lagos',
  admission: 'Free',
  pageUrl: 'https://favourojo.com/unburden',
  calendarUrl: 'https://favourojo.com/unburden/unburden.ics',
  replyTo: 'favourojoministry@gmail.com',

  /* seats */
  capacity: 100,
  lowWhen: 15,        /* show "Almost full" when this many seats or fewer are left */

  /* registration closes when the doors open: 5 PM Lagos = 16:00 UTC */
  closesAt: '2026-11-15T16:00:00Z',

  /* the walk-in form (for people who come without registering) only works on
     the day: from 1 PM Lagos (12:00 UTC) until midnight */
  walkinOpens: '2026-11-15T12:00:00Z',
  walkinCloses: '2026-11-16T00:00:00Z',
};

/* one store for everything; strong consistency so the seat count
   is never read stale while two people register at once */
export const STORE_NAME = 'unburden-2026';

export function isClosedByTime(now = new Date()) {
  return now >= new Date(EVENT.closesAt);
}

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export function walkinOpenNow(now = new Date()) {
  return now >= new Date(EVENT.walkinOpens) && now < new Date(EVENT.walkinCloses);
}

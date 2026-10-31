/* GET /api/qr?id=<registration id>  -> PNG QR code for that guest.

   The code opens https://favourojo.com/unburden/door/?c=<id>. Scanned at
   the door by a volunteer's phone (which already has the door key), it
   brings that guest straight up with a one-tap "Check in" button.
   On anyone else's phone the door page just asks for the key, so the
   code reveals nothing by itself. */

import QRCode from 'qrcode';
import { EVENT } from '../lib/event.mjs';

export default async (req) => {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^[a-f0-9]{32}$/.test(id)) return new Response('Bad id', { status: 400 });

  const target = `${EVENT.pageUrl}/door/?c=${id}`;
  const png = await QRCode.toBuffer(target, {
    type: 'png', width: 420, margin: 2, errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
  return new Response(png, {
    headers: {
      'content-type': 'image/png',
      /* same id always gives the same picture */
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
};

export const config = { path: '/api/qr' };

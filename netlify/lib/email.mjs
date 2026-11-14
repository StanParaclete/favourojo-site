/* =========================================================
   Every email the event sends, through Resend (resend.com).

   Needs two environment variables in Netlify:
     RESEND_API_KEY  the API key from resend.com
     EMAIL_FROM      e.g.  Favour Ojo <hello@favourojo.com>
                     (the domain must be verified in Resend)

   If either is missing, nothing breaks: seats are still saved
   and the email is simply skipped and logged.

   Emails:
     confirmation  - straight after registering
     reminder      - the day before, and the morning of (scheduled)
     seatOpen      - to the waitlist when someone releases a seat
   ========================================================= */

import { EVENT } from './event.mjs';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const row = (k, v) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #2a2a2a;font:600 12px/1.4 Arial,sans-serif;color:#8b8b8b;text-transform:uppercase;letter-spacing:.08em;width:110px;vertical-align:top">${k}</td>
      <td style="padding:12px 0;border-bottom:1px solid #2a2a2a;font:700 16px/1.4 Arial,sans-serif;color:#f2f0eb">${v}</td>
    </tr>`;

const pill = (href, label, solid) => solid
  ? `<a href="${href}" style="display:inline-block;background:#fff;color:#000;font:700 14px/1 Arial,sans-serif;padding:14px 22px;border-radius:999px;text-decoration:none;margin:0 8px 10px 0">${label}</a>`
  : `<a href="${href}" style="display:inline-block;border:1px solid #555;color:#f2f0eb;font:700 14px/1 Arial,sans-serif;padding:13px 22px;border-radius:999px;text-decoration:none;margin:0 8px 10px 0">${label}</a>`;

/* one layout for every email */
function layout({ kicker, line, intro, details = true, seat, buttons, outro, releaseUrl, qrId, before }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f4f2ee">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2ee;padding:28px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#000;border-radius:18px;overflow:hidden">
      <tr><td style="padding:34px 32px 8px">
        <div style="font:700 12px/1 Arial,sans-serif;color:#c9a84c;letter-spacing:.12em;text-transform:uppercase">${kicker}</div>
        <div style="font:900 44px/1 Arial Black,Arial,sans-serif;color:#fff;letter-spacing:-.03em;margin-top:14px">UNBURDEN</div>
        <div style="font:italic 300 20px/1.4 Georgia,serif;color:#c9a84c;margin-top:14px">${line}</div>
      </td></tr>
      <tr><td style="padding:18px 32px 6px;font:400 15px/1.65 Arial,sans-serif;color:#cfcdc8">${intro}</td></tr>
      ${details ? `<tr><td style="padding:10px 32px 4px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${row('Date', esc(EVENT.dateLong))}
          ${row('Time', esc(EVENT.time))}
          ${row('Venue', esc(EVENT.venue))}
          ${row('Admission', esc(EVENT.admission))}
        </table>
      </td></tr>` : ''}
      ${before ? beforeHtml() : ''}
      ${qrId ? `<tr><td style="padding:26px 32px 4px">
        <table role="presentation" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px"><tr>
          <td style="padding:14px"><img src="${EVENT.pageUrl.replace('/unburden', '')}/api/qr?id=${qrId}" width="140" height="140" alt="Your check-in code" style="display:block;width:140px;height:140px"></td>
          <td style="padding:14px 18px 14px 4px;font:400 14px/1.55 Arial,sans-serif;color:#222;vertical-align:middle">
            <b style="font-size:16px;color:#000">Your check-in code</b><br>
            Show this at the door for a quick check-in. Forgot your phone? Just give your name.
          </td>
        </tr></table>
      </td></tr>` : ''}
      <tr><td style="padding:24px 32px 8px">${buttons}</td></tr>
      <tr><td style="padding:14px 32px ${releaseUrl ? '18px' : '34px'};font:400 15px/1.65 Arial,sans-serif;color:#cfcdc8">
        ${outro}<br>
        <span style="color:#8b8b8b;font-size:13px">Questions? Just reply to this email.</span>
      </td></tr>
      ${releaseUrl ? `<tr><td style="padding:16px 32px 30px;border-top:1px solid #2a2a2a;font:400 13px/1.6 Arial,sans-serif;color:#8b8b8b">
        Can’t make it any more? <a href="${releaseUrl}" style="color:#c9a84c">Release your seat</a> so we know not to expect you.
      </td></tr>` : ''}
    </table>
    <div style="font:400 12px/1.5 Arial,sans-serif;color:#6b6b6b;margin-top:16px">
      <a href="${EVENT.pageUrl}" style="color:#6b6b6b">favourojo.com/unburden</a>
    </div>
  </td></tr>
</table>
</body></html>`;
}

/* ---------- "Before you come": the four things the team asked guests to do ---------- */
const PSALM = 'Blessed be the LORD, because he hath heard the voice of my supplications. The LORD is my strength and my shield; my heart trusted in him, and I am helped: therefore my heart greatly rejoiceth; and with my song will I praise him. The LORD is their strength, and he is the saving strength of his anointed.';
export const BEFORE = [
  ['Read Psalm 28:6–8 before you come.', 'Sit with these few lines before the evening. They are the heart of UNBURDEN, and we will carry them into worship together.', PSALM],
  ['Dress comfortably.', 'We may take off our shoes and sit on rugs and cushions on the floor, so wear something you can relax and move in.'],
  ['Come with an open heart.', 'Bring whatever you are carrying: the worry, the pressure, the question. This is a safe place to set it down.'],
  ['Come ready to worship together.', 'This isn’t a concert to watch. It is an evening we share, so come ready to sing, to pray and to be still.'],
];
const beforeHtml = () => `<tr><td style="padding:26px 32px 4px">
        <div style="font:700 12px/1 Arial,sans-serif;color:#c9a84c;letter-spacing:.12em;text-transform:uppercase">Before you come</div>
        ${BEFORE.map((b, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px"><tr>
          <td style="width:34px;vertical-align:top"><div style="width:26px;height:26px;border:1px solid #c9a84c;border-radius:50%;font:700 13px/26px Arial,sans-serif;color:#c9a84c;text-align:center">${i + 1}</div></td>
          <td style="font:400 15px/1.6 Arial,sans-serif;color:#cfcdc8"><b style="color:#fff">${esc(b[0])}</b><br>${esc(b[1])}${b[2] ? `<div style="margin-top:10px;padding:12px 14px;border-left:2px solid #c9a84c;font:italic 400 15px/1.6 Georgia,serif;color:#e8e2d2">“${esc(b[2])}”<br><span style="font:600 12px/1 Arial,sans-serif;color:#8b8b8b;font-style:normal">Psalm 28:6–8 (KJV)</span></div>` : ''}</td>
        </tr></table>`).join('')}
        <div style="margin-top:16px;font:400 14px/1.6 Arial,sans-serif;color:#8b8b8b">And please arrive a little early, and keep your phone on silent.</div>
      </td></tr>`;
const beforeText = () => ['BEFORE YOU COME', ...BEFORE.flatMap((b, i) => [`${i + 1}. ${b[0]} ${b[1]}`, ...(b[2] ? [`   "${b[2]}" (Psalm 28:6-8, KJV)`] : [])]), 'And please arrive a little early, and keep your phone on silent.'];

const detailsText = (seat) => [
  `Date: ${EVENT.dateLong}`,
  `Time: ${EVENT.time}`,
  `Venue: ${EVENT.venue}`,
  `Admission: ${EVENT.admission}`,
].filter(Boolean);

export function confirmationEmail(firstName, { seat, releaseUrl, qrId } = {}) {
  const subject = 'Your seat is confirmed — Favour & Faves, 15 November';
  const text = [
    `Hi ${firstName},`, '',
    'Thank you for registering for Favour & Faves! Your seat is confirmed.', '',
    ...detailsText(seat), '',
    `Directions: ${EVENT.mapsUrl}`,
    `Add to your calendar: ${EVENT.calendarUrl}`, '',
    'We look forward to welcoming you.', '',
    'Favour Ojo', EVENT.pageUrl,
    releaseUrl ? `\nCan't make it any more? Release your seat: ${releaseUrl}` : '',
  ].join('\n');
  const html = layout({
    kicker: 'Favour &amp; Faves',
    line: 'Your seat is confirmed.',
    intro: `Hi ${esc(firstName)},<br><br>Thank you for registering for Favour &amp; Faves! Your seat is confirmed.`,
    seat,
    buttons: pill(EVENT.mapsUrl, 'Get directions', true) + pill(EVENT.calendarUrl, 'Add to calendar'),
    outro: 'We look forward to welcoming you.',
    releaseUrl,
    qrId,
  });
  return { subject, text, html };
}

/* kind: 'tomorrow' | 'today' | 'before' (a one-off "Before you come" note sent from the dashboard) */
export function reminderEmail(kind, firstName, { seat, releaseUrl, qrId } = {}) {
  if (kind === 'before') return beforeEmail(firstName, { seat, releaseUrl, qrId });
  const tomorrow = kind === 'tomorrow';
  const subject = tomorrow
    ? 'See you tomorrow — Favour & Faves: UNBURDEN'
    : 'Tonight at 5 PM — Favour & Faves: UNBURDEN';
  const lead = tomorrow
    ? 'Just a reminder that Favour &amp; Faves: UNBURDEN is tomorrow, and your seat is waiting for you.'
    : 'It’s today! Favour &amp; Faves: UNBURDEN starts at 5:00 PM, and your seat is waiting for you.';
  const tip = 'Give yourself time for Lagos traffic and please come a little early. If your plans have changed, use the link below to let us know.';
  const text = [
    `Hi ${firstName},`, '',
    lead.replace('&amp;', '&'), '',
    ...detailsText(seat), '',
    ...beforeText(), '',
    tip, '',
    `Directions: ${EVENT.mapsUrl}`, '',
    'See you there.', 'Favour Ojo',
    releaseUrl ? `\nCan't make it any more? Release your seat: ${releaseUrl}` : '',
  ].join('\n');
  const html = layout({
    kicker: tomorrow ? 'Tomorrow &middot; Favour &amp; Faves' : 'Today &middot; Favour &amp; Faves',
    line: tomorrow ? 'See you tomorrow.' : 'See you tonight.',
    intro: `Hi ${esc(firstName)},<br><br>${lead}`,
    seat,
    before: true,
    buttons: pill(EVENT.mapsUrl, 'Get directions', true) + (tomorrow ? pill(EVENT.calendarUrl, 'Add to calendar') : ''),
    outro: `${tip}<br><br>See you there.`,
    releaseUrl,
    qrId,
  });
  return { subject, text, html };
}

export function beforeEmail(firstName, { seat, releaseUrl, qrId } = {}) {
  const subject = 'Before you come — Favour & Faves: UNBURDEN';
  /* Lagos is UTC+1: on the 15th itself say "this evening" */
  const lagos = new Date(Date.now() + 3600000);
  const when = lagos.getUTCDate() === 15 && lagos.getUTCMonth() === 10 ? 'This evening' : 'Tomorrow evening';
  const lead = `${when} we gather for Favour &amp; Faves: UNBURDEN. To help you get the most out of it, here are four small things we’d love you to do before you come.`;
  const text = [
    `Hi ${firstName},`, '',
    lead.replace('&amp;', '&'), '',
    ...beforeText(), '',
    ...detailsText(seat), '',
    `Directions: ${EVENT.mapsUrl}`, '',
    'Your check-in code is in your confirmation email. At the entrance you can also scan the "Check in here" code.', '',
    'See you there.', 'Favour Ojo',
    releaseUrl ? `\nCan't make it any more? Release your seat: ${releaseUrl}` : '',
  ].join('\n');
  const html = layout({
    kicker: 'Before you come &middot; Favour &amp; Faves',
    line: 'A few things before Sunday.',
    intro: `Hi ${esc(firstName)},<br><br>${lead}`,
    details: false,
    before: true,
    seat,
    buttons: pill(EVENT.mapsUrl, 'Get directions', true) + pill(EVENT.calendarUrl, 'Add to calendar'),
    outro: 'Sunday 15 November, 5:00 PM at Café One, Adeola Odeku, Victoria Island. Come as you are.<br><br>See you there.',
    releaseUrl,
    qrId,
  });
  return { subject, text, html };
}

export function seatOpenEmail(firstName) {
  const url = EVENT.pageUrl + '#register';
  const subject = 'A seat just opened — Favour & Faves: UNBURDEN';
  const text = [
    `Hi ${firstName},`, '',
    'You joined the waitlist for Favour & Faves: UNBURDEN, and a seat has just opened up.',
    'Seats go to whoever registers first, so if you’d still like to come, register now:', url, '',
    ...detailsText(), '', 'Favour Ojo',
  ].join('\n');
  const html = layout({
    kicker: 'Waitlist &middot; Favour &amp; Faves',
    line: 'A seat just opened.',
    intro: `Hi ${esc(firstName)},<br><br>You joined the waitlist for Favour &amp; Faves: UNBURDEN, and a seat has just opened up. Seats go to whoever registers first, so if you’d still like to come, register now.`,
    buttons: pill(url, 'Register now', true),
    outro: 'We’d love to see you there.',
  });
  return { subject, text, html };
}

/* ---------- sending ---------- */

function creds() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Favour Ojo <hello@favourojo.com>';
  return key && from ? { key, from } : null;
}

export async function sendEmail(to, { subject, text, html }) {
  const c = creds();
  if (!c) { console.warn('email skipped (RESEND_API_KEY / EMAIL_FROM not set):', subject); return false; }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${c.key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: c.from, to: [to], reply_to: EVENT.replyTo, subject, text, html }),
    });
    if (!res.ok) { console.error('email failed:', res.status, await res.text()); return false; }
    return true;
  } catch (err) {
    console.error('email failed:', err);
    return false;
  }
}

/* up to 100 emails in one request - used for reminders, so all 100
   seats are reached well inside a scheduled function's time limit */
export async function sendBatch(messages) {
  const c = creds();
  if (!c) { console.warn('batch skipped (RESEND_API_KEY / EMAIL_FROM not set):', messages.length); return false; }
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100).map((m) => ({
      from: c.from, to: [m.to], reply_to: EVENT.replyTo, subject: m.subject, text: m.text, html: m.html,
    }));
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { authorization: `Bearer ${c.key}`, 'content-type': 'application/json' },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) { console.error('batch failed:', res.status, await res.text()); return false; }
  }
  return true;
}

/* kept for register.mjs */
export function sendConfirmation({ to, firstName, seat, releaseUrl, qrId }) {
  return sendEmail(to, confirmationEmail(firstName, { seat, releaseUrl, qrId }));
}

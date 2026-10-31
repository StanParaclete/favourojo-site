# Favour Ojo — favourojo.com (v4)

Static site. No build step. Drop the whole folder on Netlify.

## Files

    index.html           the page
    style.css            all styling
    main.js              menu + pauses offscreen video
    get-covers.py        fetches the cover art (see below)
    video/               hero + neon clips, already compressed for web
    images/              photos, lyric artwork, QR code
    images/covers/       album art goes here
    robots.txt
    sitemap.xml

## Design

Ground is white/bone. The dark and gold panels sit INSIDE it,
inset and rounded, rather than running edge to edge - so the page
reads light even though her brand is black and gold.

Structure comes from music-chart layouts: numbered chart, side-
scrolling rails, inset panels, a QR block. Pacing comes from
luxury-automotive editorial: filter tabs under the section title,
captions UNDER images rather than over them, and a lot more air.

Two type registers, kept apart on purpose:

  - Archivo, heavy — structure. Nav, headings, the songs chart.
  - Cormorant italic in gold — only ever her own words. Never UI.

Colours: pure black and white as the ground, her gold (#c9a84c) for
brand, and magenta/blue/mint sampled straight out of the neon clips,
used only where something is clickable. Pure #000 rather than a
tinted near-black, so the neon clips composite invisibly.

Sections alternate black and white down the page.

## Cover art

The songs chart looks for images/covers/<slug>.jpg. Missing files are
removed at load, and the card falls back to a black tile with a play
mark, so you can add covers one at a time without breaking anything.

To fetch them automatically:

    python3 get-covers.py

## Motion

One IntersectionObserver reveals everything marked .rise, once,
then stops watching it. Items stagger within their own group via
--i, so a row of cards arrives in sequence instead of together.

The figures in the About panel count up the first time they come
into view, then snap back to the exact written value.

The nav is see-through over the hero and white past it, carries a
scroll-progress line, and underlines whichever section you are in.

Every bit of this is off under prefers-reduced-motion: nothing is
hidden by CSS that only JS knows how to show, so a browser without
IntersectionObserver still shows the whole page.

## The menu

Below 720px the links become a full-screen panel that opens as a
circle from the burger. It locks body scroll, traps Tab inside
itself, closes on Escape, returns focus to the button, and closes
itself if the window is resized past the breakpoint.

Note for anyone editing it: the panel and the booking line at its
foot must keep visibility:hidden and pointer-events:none while
closed. They cover the whole viewport, so without that they sit
invisibly on top of the burger and swallow every tap.

## Traps worth knowing about

Four bugs were found and fixed here; all four are easy to
reintroduce.

1. Cards inside a side-scrolling rail sit off to the right and
   never enter the viewport by themselves, so a reveal observer
   watching each card leaves the ones you have to swipe to
   permanently invisible. main.js watches the RAIL and reveals all
   its children at once. Keep that if you add another rail.
2. .about-copy p is more specific than .about-said, so the gold
   quote silently rendered at body size. The rule is written as
   ".about-copy p.about-said, .about-said" to win. Do not simplify it.
3. The Seasons artwork has the lyric printed on it, so any visible
   caption underneath makes you read the same sentence twice. The
   words are in each image's alt only, and figcaption is
   screen-reader-only. Do not "restore" the captions.
4. overflow-x:hidden on BODY alone does nothing - the overflow
   propagates up and the page still scrolls sideways. html needs it
   too. Both carry "hidden" then "clip"; clip is the one that works
   without turning html into a scroll container. Without this the
   page slid 27px sideways on a 430px phone.
5. The hero deck appears at 900px, so the hero name must be
   constrained from 900px as well. They were 900 and 1100, and in
   that gap the covers sat on top of FAVOUR at laptop width.
6. The mobile menu panel and its booking line cover the whole
   viewport. Both must keep visibility:hidden and pointer-events:none
   while closed or they sit invisibly on top of the burger and
   swallow every tap.

## Things worth knowing

- The nav is see-through over the hero and turns white past it.
- The Singles / EPs / Live tabs filter the chart and renumber it.
- seasons-4.jpg is a duplicate of seasons-3.jpg, so it is not used
  on the page. One lyric, "Cos I deserve every good thing and good
  meal God is bringing my way", has no artwork file at all - ask the
  manager for it and drop it in as seasons-7.jpg.
- The smart link everywhere on the site (and in the QR) is her
  DistroKid hyperfollow, the same one in her Instagram bio. If that
  ever changes, it appears in index.html and in the QR, so
  regenerate the QR too.
- Covers so far: free, tsidkenu, atofarati, yesu-mai-girma,
  worship-medley-7. Still missing: iba, water-to-wine-ii,
  marys-praise-ii, ese, spontaneous-worship, elshaddai.
- Cover files came from screenshots (250-378px). Fine at the size
  the chart shows them, and fine in the hero deck, but ask the
  manager for the full-size artwork when he has it.
## The hero deck (WebGL)

The covers stand in a shallow arc, breathing slowly and leaning
toward the pointer. deck.js draws it with three.js.

three.js is VENDORED at vendor/three.module.min.js rather than
pulled from a CDN. 654 KB raw, about 162 KB gzipped, served from
the same host - no third-party round trip on a slow connection.
Netlify gzips it automatically.

It is deliberately fussy about when it loads. All four must hold:
  - screen at least 900px wide
  - prefers-reduced-motion is not set
  - WebGL is available
  - the browser is idle (requestIdleCallback, 2.5s timeout)
So a phone on mobile data never downloads three.js at all.

There are two decks in the markup. The CSS one (.deck) uses plain
3D transforms and works everywhere. The WebGL one (.deck-gl) loads
on top and hides the CSS one only once it has actually painted. If
three.js fails for any reason, the CSS deck stays and the page is
still right - the failure is logged, not shown.

To change which covers appear, edit the COVERS array at the top of
deck.js and the .deck block in index.html so the two agree.

The deck stops rendering entirely once you scroll past the hero.

## Videos

Already compressed: the 4K hero went from 27 MB to about 600 KB.
Everything in video/ totals under 2 MB. If you swap a clip in, run it
through ffmpeg first or the page will crawl on Nigerian mobile data.

Clips only play while on screen; main.js pauses the rest.

## After deploying

Google still has the old version cached. In Search Console, inspect
https://favourojo.com and hit Request Indexing.

## Favour & Faves: UNBURDEN (event page, added v11)

Page: https://favourojo.com/unburden
Short links that redirect there: /event, /faves, /register

    unburden/index.html      the event page
    unburden/unburden.css    its styles (sits on top of style.css)
    unburden/unburden.js     the form, seat counter and states
    unburden/unburden.ics    "Add to calendar" file
    images/unburden/         the one photo, split in two, plus og.jpg (share card)
    netlify/lib/event.mjs    ALL event details live here: seats, closing time, wording
    netlify/lib/email.mjs    the confirmation email
    netlify/functions/       register / seats / registrations
    netlify.toml             functions folder, redirects, .ics header
    package.json             one dependency: @netlify/blobs

How it works
- Up to 100 seats. Each email can hold one seat. The seat count only ever
  goes up through a conditional write, so two people registering at the same
  moment can't push it past 100 (tested with 130 simultaneous sign-ups:
  exactly 100 seats, numbered 1-100).
- At 100 the form is swapped for "All 100 seats are taken".
- At 5 PM Lagos time on 15 November the form closes by itself.
- Registrations are stored in Netlify Blobs (built into the site, no database
  to run).

Environment variables (Netlify > Site configuration > Environment variables)
    RESEND_API_KEY   from resend.com (free tier: 3,000 emails/month)
    EMAIL_FROM       Favour Ojo <hello@favourojo.com>
    ADMIN_KEY        any long random password, used to download the list

Confirmation emails: create a free Resend account, add the domain
favourojo.com, and add the DNS records Resend gives you wherever the domain's
DNS is managed. Until the domain is verified, registration still works: seats
are saved and people see the on-screen confirmation, but no email goes out.

Attendee list (opens in Excel or Google Sheets):
    https://favourojo.com/api/registrations?key=YOUR_ADMIN_KEY

To change the seat limit or closing time: edit netlify/lib/event.mjs, and the
CAPACITY / CLOSES_AT lines at the top of unburden/unburden.js, then redeploy.

Deploy: this now needs Netlify to run the functions, so deploy through Git or
the Netlify CLI (`netlify deploy --prod`). Drag-and-drop deploys publish only
static files and leave the form with no server to submit to.

### v12 additions to /unburden
- Live countdown to 5 PM on 15 November in the hero.
- "What the evening holds": Worship / Stories / Community.
- "Good to know" FAQ (native <details>, works without JS).
- WhatsApp share and copy-link buttons: after registering, and in a strip
  near the bottom. On phones "Copy link" opens the phone's own share sheet.
- Below 25 seats the counters switch to "Only N seats left".
- Phones get a "Save my seat" bar at the bottom once the hero button scrolls
  away; it hides while the form is on screen and after registering.
- Someone who registered on this phone sees their confirmed seat when they
  come back (stored in the browser), with a link to register someone else.
- Registering again with the same email resends the confirmation (at most
  once every 10 minutes per email).

### v13 additions to /unburden
- The people's setlist: an optional "Pick a song for the night" in the form,
  plus a picker in the confirmed panel (change it any time). Only people with
  a seat can vote, one pick each. Live top 8 on the page. Song picks are also
  a column in the attendee CSV.
  API: /api/votes   (songs list lives in netlify/lib/extras.mjs AND at the top
  of unburden/unburden-extras.js - keep both the same)
- "I'm going" story card: after registering, a 1080x1920 image with their
  first name, drawn in the browser. Phones that support it share straight to
  Instagram/WhatsApp; everyone else gets "Save image".
- Lay it down: anonymous burden wall. Notes are never shown publicly; the page
  only shows the running count. One note per connection every 20 seconds.
  Closes when the doors open.
  Prayer team download (CSV):
      https://favourojo.com/api/burdens?key=YOUR_ADMIN_KEY

### v14 additions: reminders, release, waitlist, door
- Reminder emails go out by themselves (netlify/functions/reminders.mjs,
  a Netlify scheduled function): 14 Nov and 15 Nov at 10 AM Lagos time.
  Each person gets each reminder once. Sent in one batch, so all 100 go out
  inside Netlify's time limit.
- Every email has "Can't make it any more? Release your seat". The link opens
  /unburden/release/, which asks before doing anything (email scanners open
  links by themselves). Releasing frees the seat, removes their song vote, and
  emails the next 3 people on the waitlist that a seat opened.
- When all 100 seats are taken, the form becomes "Join the waitlist".
  Waitlist download:
      https://favourojo.com/api/registrations?key=YOUR_ADMIN_KEY&list=waitlist
- Door check-in on the night: https://favourojo.com/unburden/door/
  Enter ADMIN_KEY once per phone. Search by name, last 4 digits of phone, or
  number; tap "Check in". Several phones can work the door at once (the list
  refreshes every 20 seconds). "Checked in" is a column in the attendee CSV.
- Registration numbers only ever go up, so after releases they can pass 100.
  Emails call it "Your no." rather than a seat number for that reason.
- /unburden/door/, /unburden/release/ and /api/ are kept out of search engines.

### v15: launch hardening
- Seats are now 100 named slots (seat/001 ... seat/100). Claiming one creates it
  only if it doesn't exist, then reads it back to confirm ownership, so the room
  can never be oversold - tested with 130 simultaneous sign-ups on Netlify's own
  local runtime: exactly 100 seats. A released seat's number is reused.
  Any slot left behind by a crashed request is freed after 2 minutes.
- The burden counter counts the stored notes instead of a shared counter.
- Server code, README and package files are blocked from public download
  (netlify.toml). Security headers on every page; photos/video cached a week.
- Friendly 404 page.
- Forms can't be submitted before the script loads (slow networks), and never
  put personal details in the address bar.
- Accessibility: zero axe-core issues on every page (contrast, landmarks, headings).
- Speed: event page is ~200 KB; usable in ~3.6 s on slow 3G.
See GO-LIVE.md for the launch steps.

### v16: final checks before launch
- Ran the whole site in Netlify's own local server (pages + rules + functions
  together): every page 200, /event /faves /register redirect, all project files
  return 404, security headers present, .ics downloads correctly.
- Full visitor flow on that stack: register, song pick, story card, vote change,
  Lay it down - all pass.
- 34 internal links/files: none broken. (Six song covers are still missing by
  design - iba, water-to-wine-ii, marys-praise-ii, ese, spontaneous-worship,
  elshaddai - the chart shows a black tile until the artwork is added.)
- HTML validator: clean apart from autoplay on the muted background videos (intentional).
- Scripts parse as ES2017 (iOS 11+); CSS checked against iOS Safari 14+, with
  viewport-height fallbacks added for older iPhones.

### v17: no seat numbers in public, QR check-in
- Visitors never see how many seats there are or how many are left. The page,
  emails, share image, homepage strip and the public /api/seats all say
  "Limited seats"; when 15 or fewer remain the page shows "Almost full"
  (change lowWhen in netlify/lib/event.mjs). The setlist shows the ranking and
  bars only, no vote counts. The real capacity is still 100 (event.mjs).
- Every guest gets a personal QR code: on screen after registering, and in the
  confirmation and reminder emails (served by /api/qr). Scanning it with a door
  volunteer's phone camera opens /unburden/door/?c=<id> with that guest and a
  big "Check in" button. A second scan shows "Already checked in at 5:12 PM".
  On a phone without the door key, the code just asks for the key.
- New dependency: qrcode.

### v18: walk-ins
- /unburden/walkin/ - self-serve form for people who didn't register (poster QR
  at the entrance). Only accepts entries on the event day (walkinOpens /
  walkinCloses in netlify/lib/event.mjs, mirrored at the top of the page's script).
- Door page: "+ Add a walk-in", walk-ins listed with a WALK-IN tag, "Remove" for
  mistakes; arrived count includes them.
- /api/walkin; if the email matches a registration, that registration is checked
  in instead. CSV: /api/registrations?key=...&list=walkins
- Spam limits on the walk-in form and Lay it down are now a per-minute allowance
  per connection (40 and 30), not one-every-N-seconds: venue Wi-Fi and mobile
  carriers put many real people behind one address. 25 guests on one Wi-Fi in a
  minute all went through in testing; a script sending 70 was cut off.

### v19: Shazam-inspired homepage
- Hero: 3D card carousel (UNBURDEN + five releases). The background colour
  follows the card in front (data-color on each card). Arrows, dots, swipe,
  keyboard, auto-advance every ~5 s (off for reduced motion). Replaces the
  turntable video and the WebGL cover deck (deck.js / vendor/three are no longer
  loaded; hero-turntable.mp4 is unused).
- Songs chart pages sideways in columns of three with arrows (Shazam chart).
- UNBURDEN promo panel with two phone mock-ups and a "Scan to save your seat" QR.
- Big video banner "Watch on YouTube"; Seasons artwork is now a row with arrows.
- Floating gold play button (appears after the hero) opening Spotify, Apple
  Music, YouTube and UNBURDEN.
- All videos now load only when scrolled near (home.js), so the first visit no
  longer downloads ~1.7 MB of clips. First paint on slow 3G (compressed, as
  Netlify serves it): ~1.6 s.
- home.js holds all of this; main.js is unchanged.

### v20: admin dashboard
- https://favourojo.com/unburden/admin/  (password = ADMIN_KEY, shared with the
  door page: sign in to one and the other opens too).
- Totals: registered (and seats left), arrived (registered + walk-ins), walk-ins,
  waitlist, prayer notes, and "Emails not sent" - if that is above 0, the email
  service (Resend) isn't working.
- Sign-ups per day chart; tabs for registrations (searchable, with email and
  check-in status), walk-ins, waitlist, song votes (real counts), prayer notes.
- Download buttons for each spreadsheet. Refreshes every 30 seconds.
- Backed by /api/admin (netlify/functions/admin.mjs).

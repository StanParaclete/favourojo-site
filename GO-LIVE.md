# Favour & Faves: UNBURDEN — go-live checklist

The site is NOT live until these steps are done. Do them in order.
Allow about an hour, most of it waiting for Resend to verify the domain.

## The quick way (Mac): double-click GO-LIVE.command
It installs, connects to the favourojoartist Netlify site, creates the admin/door
password (saved to your Desktop), sets the email sender, asks for your Resend key,
sets favourojo.com up in Resend and adds its DNS records in Netlify DNS for you,
publishes, offers to point favourojo.com at the new site, and checks it all works.
If macOS says it can't be opened: right-click the file > Open > Open.
Everything below is the same thing done by hand.

## 1. Put the files on Netlify (needs functions, so NOT drag-and-drop)
Either:
- Git: push this folder to a GitHub repo, then in Netlify open the
  favourojo.com site > Site configuration > Build & deploy > Link repository.
  Build command: leave empty. Publish directory: `.`  (netlify.toml sets this)
- or the Netlify CLI, from inside this folder:
      npm install
      npx netlify-cli login
      npx netlify-cli link        (choose the favourojo.com site)
      npx netlify-cli deploy --prod

## 2. Add three environment variables
Netlify > Site configuration > Environment variables. Scope: all (must include Functions).
- RESEND_API_KEY   from resend.com > API Keys
- EMAIL_FROM       Favour Ojo <hello@favourojo.com>
- ADMIN_KEY        a long random password (also the door password). Keep it private.
Redeploy after adding them (Deploys > Trigger deploy).

## 3. Verify favourojo.com in Resend
resend.com > Domains > Add domain > favourojo.com. Add the DNS records it shows
wherever favourojo.com's DNS is managed. Wait until it says Verified.
Until then, registration still works but no emails go out.

## 4. Test it live (10 minutes)
1. Open https://favourojo.com/unburden on your phone.
2. Register with your own email. Confirmation should arrive within a minute
   (check spam). Keep that email: it has your "Release your seat" link.
3. Open https://favourojo.com/api/registrations?key=YOUR_ADMIN_KEY
   and check you're in the spreadsheet.
4. Open https://favourojo.com/unburden/door/ on a second phone, enter ADMIN_KEY.
   Then scan the check-in code from your confirmation email with that phone's
   camera: your name should come up with a "Check in" button.
5. Lay down a test note, then download
   https://favourojo.com/api/burdens?key=YOUR_ADMIN_KEY
6. Use your email's "Release your seat" link, so the test doesn't hold a seat.
7. Share the link in a WhatsApp chat and check the preview card appears.
8. Netlify > Logs & metrics > Functions: "reminders" should show as scheduled.

## 5. Then share the link
favourojo.com/unburden   (favourojo.com/event also works)

## Your dashboard
https://favourojo.com/unburden/admin/ - sign in with ADMIN_KEY. Everything is there:
registrations, who has arrived, walk-ins, waitlist, song votes, prayer notes and downloads.

## Useful links once live (replace YOUR_ADMIN_KEY)
- Attendees:     https://favourojo.com/api/registrations?key=YOUR_ADMIN_KEY
- Waitlist:      https://favourojo.com/api/registrations?key=YOUR_ADMIN_KEY&list=waitlist
- Prayer notes:  https://favourojo.com/api/burdens?key=YOUR_ADMIN_KEY
- Door:          https://favourojo.com/unburden/door/

## On the night: checking people in
Give each door volunteer the door link and ADMIN_KEY in advance; they open
https://favourojo.com/unburden/door/ once, enter the key, and leave it signed in.
- Guest shows their code (email, screenshot or the website): volunteer points
  the phone camera at it, taps the link, taps "Check in". Green = welcome.
- Pink "Already checked in" = that code was used already. Check their name.
- No code / flat phone: search their name (or last 4 digits of their phone)
  and tap "Check in".
Several phones can do this at once. The count at the top is live.

## Walk-ins (people who didn't register)
Two ways, both land in the same list:
- Print UNBURDEN-walk-in-poster-A4.pdf and put it at the entrance. Guests scan
  it, type their name and phone (email optional) and show the green screen to a
  volunteer. This form only opens on 15 November from 1 PM.
- Or a volunteer taps "+ Add a walk-in" on the door page and types it for them.
If a walk-in's email matches someone who registered, it checks that person in
instead, so nobody is counted twice. Remove a mistake with "Remove".
Download the list afterwards:
  https://favourojo.com/api/registrations?key=YOUR_ADMIN_KEY&list=walkins
The big number on the door page = registered guests who arrived + walk-ins.

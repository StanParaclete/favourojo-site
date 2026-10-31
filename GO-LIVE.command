#!/bin/bash
# =========================================================
#  Favour & Faves: UNBURDEN  -  one-click go-live
#
#  Double-click this file on your Mac (or run: bash GO-LIVE.command).
#  It will:
#    1. install what the site needs
#    2. connect this folder to your Netlify site (favourojoartist)
#    3. create the admin/door password if you don't have one yet
#    4. set the "from" address for emails, and ask for your Resend key
#    5. publish the site, with all its backend functions
#    6. check the live site is answering
#  Nothing here is sent anywhere except your own Netlify account.
# =========================================================

SITE_NAME="favourojoartist"
EMAIL_FROM_VALUE="Favour Ojo <hello@favourojo.com>"

cd "$(dirname "$0")" || exit 1
bold() { printf "\n\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$1"; printf "\nPress Enter to close."; read -r _; exit 1; }

bold "UNBURDEN go-live"

# ---- 0. tools -------------------------------------------------------------
command -v node >/dev/null 2>&1 || fail "Node.js isn't installed. Get the LTS version from https://nodejs.org, then run this again."
ok "Node $(node -v)"
NETLIFY="npx --yes netlify-cli@23"

# ---- 1. install ------------------------------------------------------------
bold "1/6  Installing"
npm install --no-audit --no-fund >/dev/null 2>&1 || fail "npm install failed. Check your internet connection and try again."
ok "Installed"

# ---- 2. Netlify login + link --------------------------------------------------
bold "2/6  Connecting to Netlify"
if $NETLIFY status 2>&1 | grep -qi "not logged in\|log in"; then
  warn "You need to log in to Netlify. A browser window will open - approve it, then come back here."
  $NETLIFY login || fail "Netlify login didn't complete."
fi
if [ ! -f .netlify/state.json ]; then
  $NETLIFY link --name "$SITE_NAME" >/dev/null 2>&1 || fail "Couldn't find the Netlify site '$SITE_NAME' in your account."
fi
ok "Connected to $SITE_NAME"

# ---- 3. admin / door password -------------------------------------------------
bold "3/6  Admin and door password"
ADMIN_NOW="$($NETLIFY env:get ADMIN_KEY 2>/dev/null | tail -n 1)"
if [ -z "$ADMIN_NOW" ] || echo "$ADMIN_NOW" | grep -qi "no value\|not set\|error"; then
  NEW_KEY="unburden-$(openssl rand -hex 6)"
  $NETLIFY env:set ADMIN_KEY "$NEW_KEY" >/dev/null 2>&1 || fail "Couldn't save the password to Netlify."
  printf "%s\n" "UNBURDEN admin + door password: $NEW_KEY" "Admin:  https://favourojo.com/unburden/admin/" "Door:   https://favourojo.com/unburden/door/" > "$HOME/Desktop/UNBURDEN-password.txt"
  ok "Created a new password: $NEW_KEY"
  ok "Saved a copy on your Desktop: UNBURDEN-password.txt (share it only with your door team)"
  ADMIN_NOW="$NEW_KEY"
else
  ok "You already have a password set (keeping it)"
fi

# ---- 4. email settings -------------------------------------------------------------
bold "4/6  Email settings"
FROM_NOW="$($NETLIFY env:get EMAIL_FROM 2>/dev/null | tail -n 1)"
if [ -z "$FROM_NOW" ] || echo "$FROM_NOW" | grep -qi "no value\|not set\|error"; then
  $NETLIFY env:set EMAIL_FROM "$EMAIL_FROM_VALUE" >/dev/null 2>&1 && ok "Emails will come from: $EMAIL_FROM_VALUE"
else
  ok "Sender already set"
fi
RES_NOW="$($NETLIFY env:get RESEND_API_KEY 2>/dev/null | tail -n 1)"
RES_VALUE=""
if [ -z "$RES_NOW" ] || echo "$RES_NOW" | grep -qi "no value\|not set\|error"; then
  echo "  Confirmation and reminder emails need a Resend API key (free at resend.com > API Keys)."
  printf "  Paste it here and press Enter (or just press Enter to skip for now): "
  read -rs RESEND_INPUT; echo
  if [ -n "$RESEND_INPUT" ]; then
    $NETLIFY env:set RESEND_API_KEY "$RESEND_INPUT" >/dev/null 2>&1 && ok "Resend key saved"
    RES_VALUE="$RESEND_INPUT"
  else
    warn "Skipped. Registration still works; emails start once you run this again with the key."
  fi
else
  ok "Resend key already set"
  RES_VALUE="$RES_NOW"
fi
if [ -n "$RES_VALUE" ]; then
  echo "  Setting up favourojo.com for sending (Resend + Netlify DNS)..."
  RESEND_API_KEY="$RES_VALUE" node scripts/setup.mjs email
fi

# ---- 5. publish -------------------------------------------------------------------
bold "5/6  Publishing (about a minute)"
$NETLIFY deploy --prod --dir . --functions netlify/functions > /tmp/unburden-deploy.log 2>&1 || { tail -n 25 /tmp/unburden-deploy.log; fail "Publishing failed (details above)."; }
LIVE_URL="$(grep -Eo 'https://[a-zA-Z0-9.-]+\.netlify\.app' /tmp/unburden-deploy.log | tail -n 1)"
[ -z "$LIVE_URL" ] && LIVE_URL="https://$SITE_NAME.netlify.app"
ok "Published"

# ---- 6. check it --------------------------------------------------------------------
bold "6/6  Checking the live site"
node scripts/setup.mjs domain
sleep 4
code() { curl -s -o /dev/null -w "%{http_code}" "$1"; }
[ "$(code "$LIVE_URL/unburden/")" = "200" ] && ok "Event page is up" || warn "Event page didn't answer yet - give it a minute"
[ "$(code "$LIVE_URL/api/seats")" = "200" ] && ok "Registration backend is answering" || warn "Backend didn't answer yet"
[ "$(code "$LIVE_URL/api/admin?key=$ADMIN_NOW")" = "200" ] && ok "Admin dashboard accepts your password" || warn "Admin check didn't pass yet - try the page in a minute"
[ "$(code "$LIVE_URL/README.md")" = "404" ] && ok "Private files are hidden" || warn "Private files check didn't pass"
if curl -s "https://favourojo.com/api/seats" | grep -q '"low"'; then
  ok "favourojo.com is showing this new site"
else
  warn "favourojo.com isn't showing the new site yet (DNS can take a few minutes after a change)"
fi

bold "Done"
echo "  Admin dashboard:  $LIVE_URL/unburden/admin/"
echo "  Door check-in:    $LIVE_URL/unburden/door/"
echo "  Event page:       $LIVE_URL/unburden/"
echo "  (On favourojo.com too, once the domain points at this Netlify site.)"
printf "\nPress Enter to close."; read -r _

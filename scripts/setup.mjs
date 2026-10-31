/* =========================================================
   Helper for GO-LIVE.command. Runs on your Mac, talks only to
   your own Resend and Netlify accounts.

     node scripts/setup.mjs email   -> set up favourojo.com in Resend and
                                       add its DNS records to Netlify DNS
     node scripts/setup.mjs domain  -> make sure favourojo.com points at
                                       this Netlify project (asks first)

   Needs: RESEND_API_KEY in the environment (for "email"),
          the folder linked to the Netlify site (GO-LIVE.command does that).
   ========================================================= */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const DOMAIN = 'favourojo.com';
const say = (m) => console.log('  ' + m);
const ok = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m);
const warn = (m) => console.log('  \x1b[33m!\x1b[0m ' + m);

function netlify(method, data) {
  const args = ['--yes', 'netlify-cli@23', 'api', method];
  if (data) args.push('--data', JSON.stringify(data));
  const out = execFileSync('npx', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const start = out.search(/[[{]/);
  return start >= 0 ? JSON.parse(out.slice(start)) : null;
}

function siteId() {
  try { return JSON.parse(readFileSync('.netlify/state.json', 'utf8')).siteId; } catch { return null; }
}

async function resend(path, opts = {}) {
  const res = await fetch('https://api.resend.com' + path, {
    ...opts,
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body.message || JSON.stringify(body)}`);
  return body;
}

/* ---------------- email: Resend domain + DNS records ---------------- */
async function email() {
  if (!process.env.RESEND_API_KEY) { warn('No Resend key, skipping email setup.'); return; }

  /* 1. the domain in Resend */
  const list = await resend('/domains');
  let dom = (list.data || []).find((d) => d.name === DOMAIN);
  if (!dom) {
    dom = await resend('/domains', { method: 'POST', body: JSON.stringify({ name: DOMAIN }) });
    ok(`Added ${DOMAIN} to Resend`);
  } else {
    ok(`${DOMAIN} is already in Resend (status: ${dom.status})`);
  }
  const full = await resend('/domains/' + dom.id);
  if (full.status === 'verified') { ok('Email domain already verified - emails will send.'); return; }
  const records = full.records || dom.records || [];

  /* 2. the DNS zone in Netlify */
  const zones = netlify('getDnsZones') || [];
  const zone = zones.find((z) => z.name === DOMAIN);
  if (!zone) {
    warn(`${DOMAIN}'s DNS isn't in this Netlify account. Add these records where its DNS is managed:`);
    records.forEach((r) => say(`${r.type}  ${r.name}  ${r.value}${r.priority ? '  priority ' + r.priority : ''}`));
    return;
  }
  const existing = netlify('getDnsRecords', { zone_id: zone.id }) || [];

  /* 3. add each record that isn't there yet */
  for (const r of records) {
    const hostname = r.name === '@' || r.name === DOMAIN ? DOMAIN : `${r.name.replace(new RegExp(`\\.?${DOMAIN.replace('.', '\\.')}$`), '')}.${DOMAIN}`;
    const already = existing.find((e) => e.type === r.type && e.hostname === hostname && String(e.value).replace(/"/g, '') === String(r.value).replace(/"/g, ''));
    if (already) { ok(`DNS ${r.type} ${hostname} already there`); continue; }
    const value = r.type === 'TXT' ? String(r.value).replace(/^"|"$/g, '') : r.value;
    const body = { type: r.type, hostname, value, ttl: 3600 };
    if (r.type === 'MX') body.priority = Number(r.priority || 10);
    try {
      netlify('createDnsRecord', { zone_id: zone.id, body });
      ok(`Added DNS ${r.type} ${hostname}`);
    } catch (e) {
      warn(`Couldn't add ${r.type} ${hostname} automatically - add it in Netlify > Domains > ${DOMAIN}: ${r.value}`);
    }
  }

  /* 4. ask Resend to check */
  try { await resend(`/domains/${dom.id}/verify`, { method: 'POST' }); } catch {}
  ok('Asked Resend to verify. It usually takes a few minutes (up to a few hours).');
  say('Check at resend.com > Domains. Once it says Verified, emails go out automatically.');
}

/* ---------------- domain: does favourojo.com show this project? ---------------- */
async function domain() {
  const mine = siteId();
  if (!mine) { warn('Folder isn\'t linked to a Netlify site yet.'); return; }
  const sites = netlify('listSites', { filter: 'all' }) || [];
  const me = sites.find((s) => s.id === mine);
  const holder = sites.find((s) => s.custom_domain === DOMAIN || (s.domain_aliases || []).includes(DOMAIN));

  if (me && (me.custom_domain === DOMAIN || (me.domain_aliases || []).includes(DOMAIN))) {
    ok(`${DOMAIN} already points at this site (${me.name}).`);
    return;
  }
  if (!holder) {
    warn(`${DOMAIN} isn't attached to any site in this account.`);
  } else {
    warn(`${DOMAIN} currently shows a different Netlify project: "${holder.name}".`);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question(`  Point ${DOMAIN} at "${me ? me.name : mine}" now? The old project stays, it just stops using the domain. (y/N) `)).trim().toLowerCase();
  rl.close();
  if (ans !== 'y' && ans !== 'yes') { say('Left as it is.'); return; }

  if (holder && holder.id !== mine) {
    const aliases = (holder.domain_aliases || []).filter((d) => d !== DOMAIN && d !== 'www.' + DOMAIN);
    netlify('updateSite', { site_id: holder.id, body: { custom_domain: holder.custom_domain === DOMAIN ? null : holder.custom_domain, domain_aliases: aliases } });
    ok(`Removed ${DOMAIN} from "${holder.name}"`);
  }
  netlify('updateSite', { site_id: mine, body: { custom_domain: DOMAIN } });
  ok(`${DOMAIN} now points at this site. Netlify sets up the padlock (HTTPS) by itself within a few minutes.`);
}

const cmd = process.argv[2];
try {
  if (cmd === 'email') await email();
  else if (cmd === 'domain') await domain();
  else console.log('usage: node scripts/setup.mjs email|domain');
} catch (e) {
  warn(e.message.split('\n')[0]);
  process.exitCode = 0;   /* never stop the go-live script over this */
}

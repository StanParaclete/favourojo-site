/* =========================================================
   UNBURDEN — registration, countdown, sharing, phone dock
   Panel states: open -> done | full | closed
   ========================================================= */

(function () {
  'use strict';

  var STARTS_AT = new Date('2026-11-15T16:00:00Z');   /* 5 PM Lagos */
  var CLOSES_AT = STARTS_AT;
  var PAGE = 'https://favourojo.com/unburden';
  var SHARE_TEXT = 'Join me at Favour & Faves: UNBURDEN, an intimate evening of worship, music and community with Favour Ojo. ' +
                   'Sunday 15 November, 5 PM, Café One, Victoria Island, Lagos. Free, but seats are limited. Register here: ' + PAGE;
  var SAVED_KEY = 'unburden-registered';

  var STILL = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var box = document.getElementById('regBox');
  var form = document.getElementById('regForm');

  /* tiny storage wrapper: private windows can throw, and the page must work regardless */
  var saved = {
    get: function () { try { return JSON.parse(localStorage.getItem(SAVED_KEY) || 'null'); } catch (e) { return null; } },
    set: function (v) { try { localStorage.setItem(SAVED_KEY, JSON.stringify(v)); } catch (e) {} }
  };

  /* ================= COUNTDOWN ================= */
  var count = document.getElementById('count');
  if (count && new Date() < STARTS_AT) {
    var units = {};
    Array.prototype.forEach.call(count.querySelectorAll('[data-u]'), function (b) { units[b.dataset.u] = b; });
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var tick = function () {
      var ms = STARTS_AT - new Date();
      if (ms <= 0) { count.hidden = true; return; }
      var s = Math.floor(ms / 1000);
      units.d.textContent = pad(Math.floor(s / 86400));
      units.h.textContent = pad(Math.floor(s % 86400 / 3600));
      units.m.textContent = pad(Math.floor(s % 3600 / 60));
      units.s.textContent = pad(s % 60);
      setTimeout(tick, 1000 - Date.now() % 1000);
    };
    count.hidden = false;
    tick();
  }

  /* ================= SHARING ================= */
  var waHref = 'https://wa.me/?text=' + encodeURIComponent(SHARE_TEXT);
  Array.prototype.forEach.call(document.querySelectorAll('[data-share="wa"]'), function (a) { a.href = waHref; });
  Array.prototype.forEach.call(document.querySelectorAll('[data-share="copy"]'), function (btn) {
    btn.addEventListener('click', function () {
      var done = function () {
        btn.classList.add('copied'); btn.textContent = 'Link copied';
        setTimeout(function () { btn.classList.remove('copied'); btn.textContent = 'Copy link'; }, 2200);
      };
      if (navigator.share && window.matchMedia('(max-width: 720px)').matches) {
        navigator.share({ title: 'Favour & Faves: UNBURDEN', text: SHARE_TEXT, url: PAGE }).catch(function () {});
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(PAGE).then(done, function () { window.prompt('Copy this link:', PAGE); });
      } else {
        window.prompt('Copy this link:', PAGE);
      }
    });
  });

  /* ================= PHONE DOCK =================
     Appears once the hero button has scrolled away, and gets out of
     the way while the form itself is on screen. */
  var dock = document.getElementById('dock');
  var heroBtn = document.querySelector('.ev-actions .btn');
  var regSection = document.getElementById('register');
  var dockSeats = document.getElementById('dockSeats');
  var dockOff = false;
  if (dock && heroBtn && regSection && 'IntersectionObserver' in window) {
    var heroGone = false, formSeen = false;
    var paint = function () { dock.classList.toggle('show', heroGone && !formSeen && !dockOff); };
    new IntersectionObserver(function (en) { heroGone = !en[0].isIntersecting && en[0].boundingClientRect.top < 0; paint(); }).observe(heroBtn);
    new IntersectionObserver(function (en) { formSeen = en[0].isIntersecting; paint(); }, { threshold: 0.15 }).observe(regSection);
    dock.querySelector('a').addEventListener('click', function () { dock.classList.remove('show'); });
    var hideDock = function () { dockOff = true; paint(); };
    dock._hide = hideDock;
  }

  if (!box || !form) return;

  var submit = document.getElementById('regSubmit');
  var formErr = document.getElementById('regErr');
  var heroSeats = document.querySelector('[data-seats-hero]');
  var seatNote = document.getElementById('seatNote');
  var shownAt = Date.now();
  submit.disabled = false;   /* buttons start disabled until this script has loaded */

  function setState(state) {
    box.setAttribute('data-state', state);
    if (state === 'full' && heroSeats) heroSeats.innerHTML = '<b>Fully booked</b> &middot; thank you';
    if (state === 'closed' && heroSeats) heroSeats.textContent = 'Registration closed';
    if (state !== 'open' && dock && dock._hide) dock._hide();
    if (state === 'done' && heroBtn) heroBtn.textContent = 'You’re registered';
  }

  /* numbers are never shown: only whether the room is nearly full */
  function showSeats(low) {
    if (!low) return;
    if (seatNote) seatNote.hidden = false;
    if (heroSeats) { heroSeats.classList.add('low'); heroSeats.innerHTML = 'Free &middot; <b>Almost full</b>'; }
    if (dockSeats) dockSeats.textContent = 'Almost full';
  }

  /* ---- copy for the confirmation panel ---- */
  function fillDone(d) {
    var first = (d.firstName || '').trim();
    var title = document.getElementById('doneTitle');
    var line = document.getElementById('doneLine');
    var mail = document.getElementById('doneEmail');

    if (d.already || d.returning) {
      title.textContent = first ? 'You’re already in, ' + first + '!' : 'You’re already in!';
      line.textContent = 'Your seat at Favour & Faves is confirmed.';
      mail.textContent = d.resent
        ? 'We’ve sent your confirmation again. Please check your inbox and spam folder. We look forward to welcoming you!'
        : 'Your confirmation was sent to your email when you registered. Please check your inbox and spam folder. We look forward to welcoming you!';
    } else {
      title.textContent = first ? 'You’re in, ' + first + '!' : 'You’re in!';
      line.textContent = 'Your seat at Favour & Faves is confirmed.';
      if (d.emailed === false) {
        mail.textContent = 'Your seat is saved. Your confirmation email is on its way shortly; please check your inbox and spam folder. You can also screenshot this page. We look forward to welcoming you!';
      }
    }
  }

  /* ---- someone who already registered on this phone sees their seat, not the form ---- */
  var me = saved.get();
  var closedNow = new Date() >= CLOSES_AT;
  if (me && !closedNow) {
    fillDone({ returning: true, firstName: me.firstName });
    setState('done');
    announce(me);
  }

  /* lets the setlist / story-card script know who has a seat on this phone */
  function announce(who) {
    window.UNBURDEN_ME = who;
    try { document.dispatchEvent(new CustomEvent('unburden:registered', { detail: who })); } catch (e) {}
  }

  /* ---- what state is the room in right now? ---- */
  if (closedNow) {
    setState('closed');
  } else {
    fetch('/api/seats', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        if (d.state === 'closed') return setState('closed');
        if (d.state === 'full' && !me) return setState('full');
        showSeats(d.low);
      })
      .catch(function () { /* status unavailable: leave the form open */ });
  }

  /* ---- validation ---- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var rules = {
    name: function (v) { return v.trim().length >= 2 ? '' : 'Please enter your full name.'; },
    email: function (v) { return EMAIL_RE.test(v.trim()) ? '' : 'Please enter a valid email address.'; },
    phone: function (v) {
      var d = v.replace(/\D/g, '');
      return d.length >= 10 && d.length <= 15 ? '' : 'Please enter a valid phone number.';
    }
  };

  function fieldError(name, msg) {
    var input = form.elements[name];
    var wrap = input.closest('.field');
    var out = document.getElementById('e-' + name);
    wrap.classList.toggle('bad', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg) input.setAttribute('aria-describedby', 'e-' + name); else input.removeAttribute('aria-describedby');
    out.textContent = msg || '';
  }

  Object.keys(rules).forEach(function (name) {
    var input = form.elements[name];
    input.addEventListener('blur', function () { if (input.value) fieldError(name, rules[name](input.value)); });
    input.addEventListener('input', function () {
      if (input.closest('.field').classList.contains('bad')) fieldError(name, rules[name](input.value));
    });
  });

  function busy(on) {
    submit.disabled = on;
    submit.classList.toggle('busy', on);
    submit.querySelector('.reg-submit-label').textContent = on ? 'Saving your seat…' : 'Confirm my seat';
  }

  function done(d) {
    d.firstName = d.firstName || form.elements.name.value.trim().split(' ')[0];
    var who = {
      firstName: d.firstName,
      email: form.elements.email.value.trim().toLowerCase(),
      song: d.song || form.elements.song.value || '',
      id: d.id || '',
      at: Date.now()
    };
    saved.set(who);
    announce(who);
    fillDone(d);
    setState('done');

    var pane = document.getElementById('donePane');
    var top = box.getBoundingClientRect().top + window.scrollY - 90;
    window.scrollTo({ top: top, behavior: STILL ? 'auto' : 'smooth' });
    pane.focus({ preventScroll: true });
  }

  var another = document.getElementById('another');
  if (another) another.addEventListener('click', function () {
    form.reset();
    Object.keys(rules).forEach(function (k) { fieldError(k, ''); });
    shownAt = Date.now();
    setState('open');
    form.elements.name.focus();
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    formErr.textContent = '';

    var firstBad = null;
    Object.keys(rules).forEach(function (name) {
      var msg = rules[name](form.elements[name].value);
      fieldError(name, msg);
      if (msg && !firstBad) firstBad = form.elements[name];
    });
    if (firstBad) { firstBad.focus(); return; }

    busy(true);
    fetch('/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.elements.name.value,
        email: form.elements.email.value,
        phone: form.elements.phone.value,
        song: form.elements.song.value,
        website: form.elements.website.value,
        t: Date.now() - shownAt
      })
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        busy(false);
        var d = res.d || {};
        if (res.status === 200 && d.ok) return done(d);
        if (d.state === 'full') return setState('full');
        if (d.state === 'closed') return setState('closed');
        if (d.errors) {
          Object.keys(d.errors).forEach(function (k) { if (form.elements[k]) fieldError(k, d.errors[k]); });
        }
        formErr.textContent = d.error || 'Something went wrong. Please try again.';
      })
      .catch(function () {
        busy(false);
        formErr.textContent = 'We couldn’t reach the server. Check your connection and try again.';
      });
  });

  /* ================= WAITLIST (once all seats are taken) ================= */
  var wForm = document.getElementById('waitForm');
  if (wForm) {
    var wErr = document.getElementById('waitErr');
    var wBtn = document.getElementById('waitSubmit');
    var wShown = Date.now();
    wBtn.disabled = false;

    /* someone who just missed out shouldn't have to type it all again */
    var carry = function () {
      ['name', 'email', 'phone'].forEach(function (k) {
        if (!wForm.elements[k].value && form.elements[k].value) wForm.elements[k].value = form.elements[k].value;
      });
    };
    new MutationObserver(function () { if (box.getAttribute('data-state') === 'full') carry(); })
      .observe(box, { attributes: true, attributeFilter: ['data-state'] });

    var wFieldErr = function (k, msg) {
      wForm.elements[k].closest('.field').classList.toggle('bad', !!msg);
      wForm.elements[k].setAttribute('aria-invalid', msg ? 'true' : 'false');
      document.getElementById('we-' + k).textContent = msg || '';
    };

    wForm.addEventListener('submit', function (e) {
      e.preventDefault();
      wErr.textContent = '';
      var firstBad = null;
      ['name', 'email', 'phone'].forEach(function (k) {
        var msg = rules[k](wForm.elements[k].value);
        wFieldErr(k, msg);
        if (msg && !firstBad) firstBad = wForm.elements[k];
      });
      if (firstBad) { firstBad.focus(); return; }

      wBtn.disabled = true; wBtn.classList.add('busy');
      fetch('/api/waitlist', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: wForm.elements.name.value, email: wForm.elements.email.value, phone: wForm.elements.phone.value,
          website: wForm.elements.website.value, t: Date.now() - wShown
        })
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; }); })
        .then(function (res) {
          wBtn.disabled = false; wBtn.classList.remove('busy');
          var d = res.d || {};
          if (d.state === 'open') {          /* a seat freed up meanwhile */
            ['name', 'email', 'phone'].forEach(function (k) { form.elements[k].value = wForm.elements[k].value; });
            setState('open');
            formErr.textContent = 'Good news: a seat just opened. Confirm it now.';
            return;
          }
          if (d.state === 'closed') return setState('closed');
          if (res.status === 200 && d.ok) {
            var line = document.getElementById('waitDoneLine');
            line.textContent = d.hasSeat ? 'You already have a seat. See you there!'
              : 'You’re on the waitlist' + (d.firstName ? ', ' + d.firstName : '') + '.';
            wForm.hidden = true;
            var w = document.getElementById('waitDone'); w.hidden = false; w.focus({ preventScroll: true });
            return;
          }
          if (d.errors) Object.keys(d.errors).forEach(function (k) { if (wForm.elements[k]) wFieldErr(k, d.errors[k]); });
          wErr.textContent = d.error || 'Something went wrong. Please try again.';
        })
        .catch(function () {
          wBtn.disabled = false; wBtn.classList.remove('busy');
          wErr.textContent = 'We couldn’t reach the server. Check your connection and try again.';
        });
    });
  }
})();

/* =========================================================
   Favour Ojo — homepage interactions (v19)
     1. hero card carousel (3D, colour-matched background)
     2. arrows for every side-scrolling row
     3. floating play button
   Everything works without it: no script = cards in a row,
   rows still scroll by swipe, links still work.
   ========================================================= */

(function () {
  'use strict';
  var STILL = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= 1. CAROUSEL ================= */
  var cf = document.getElementById('cf');
  if (cf) {
    var hero = document.getElementById('top');
    var stage = document.getElementById('cfStage');
    var cards = Array.prototype.slice.call(stage.querySelectorAll('.cf-card'));
    var dotsBox = document.getElementById('cfDots');
    var n = cards.length, at = 0, timer = null, paused = false;
    cf.classList.add('cf-live');

    var dots = cards.map(function (c, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', (c.querySelector('.cf-label b') || {}).textContent || 'Card ' + (i + 1));
      b.addEventListener('click', function () { go(i, true); });
      dotsBox.appendChild(b);
      return b;
    });

    function layout() {
      var wide = window.innerWidth > 900;
      var gap = wide ? 0.66 : 0.6;
      cards.forEach(function (c, i) {
        var d = i - at;
        if (d > n / 2) d -= n;
        if (d < -n / 2) d += n;
        var a = Math.abs(d);
        var w = c.offsetWidth;
        c.style.transform =
          'translate3d(' + (d * w * gap) + 'px, -50%, ' + (-a * 150) + 'px) ' +
          'rotateY(' + (-d * 26) + 'deg) scale(' + (1 - a * 0.1) + ')';
        c.style.opacity = a > 2 ? 0 : a === 2 ? 0.45 : 1;
        c.style.zIndex = 10 - a;
        c.style.pointerEvents = a > 2 ? 'none' : '';
        c.style.filter = a ? 'brightness(.72)' : '';
        c.classList.toggle('on', a === 0);
        c.setAttribute('data-d', a);
        c.setAttribute('aria-hidden', a > 2 ? 'true' : 'false');
        c.tabIndex = a === 0 ? 0 : -1;
      });
      dots.forEach(function (b, i) { b.setAttribute('aria-selected', i === at ? 'true' : 'false'); });
      var col = cards[at].getAttribute('data-color');
      if (hero && col) hero.style.setProperty('--amb', col);
    }

    function go(i, user) {
      at = (i + n) % n;
      layout();
      if (user) restart();
    }
    function restart() {
      clearInterval(timer);
      if (STILL) return;
      timer = setInterval(function () { if (!paused && !document.hidden) go(at + 1); }, 4800);
    }

    document.getElementById('cfPrev').addEventListener('click', function () { go(at - 1, true); });
    document.getElementById('cfNext').addEventListener('click', function () { go(at + 1, true); });

    /* a side card is a "bring me forward" button, not a link */
    cards.forEach(function (c, i) {
      c.addEventListener('click', function (e) {
        if (i !== at) { e.preventDefault(); go(i, true); }
      });
    });

    cf.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1, true); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(at + 1, true); }
    });
    cf.addEventListener('mouseenter', function () { paused = true; });
    cf.addEventListener('mouseleave', function () { paused = false; });
    cf.addEventListener('focusin', function () { paused = true; });
    cf.addEventListener('focusout', function () { paused = false; });

    /* swipe */
    var x0 = null, moved = false;
    stage.addEventListener('pointerdown', function (e) { x0 = e.clientX; moved = false; });
    stage.addEventListener('pointermove', function (e) { if (x0 !== null && Math.abs(e.clientX - x0) > 8) moved = true; });
    stage.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) > 40) go(at + (dx < 0 ? 1 : -1), true);
    });
    stage.addEventListener('pointercancel', function () { x0 = null; });
    /* a swipe must not also count as a tap on the card */
    stage.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);

    window.addEventListener('resize', layout);
    layout();
    restart();
  }

  /* ================= 2. ROW ARROWS ================= */
  Array.prototype.forEach.call(document.querySelectorAll('[data-rail-for]'), function (box) {
    var rail = document.getElementById(box.getAttribute('data-rail-for'));
    if (!rail) return;
    var prev = box.querySelector('[data-dir="-1"]'), next = box.querySelector('[data-dir="1"]');
    /* items off to the right never scroll into view by themselves, so
       reveal the whole row once the row itself is on screen */
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) {
        if (!en[0].isIntersecting) return;
        Array.prototype.forEach.call(rail.querySelectorAll('.rise'), function (el) { el.classList.add('seen'); });
        io.disconnect();
      }, { threshold: 0.05 });
      io.observe(rail);
    }
    function state() {
      var max = rail.scrollWidth - rail.clientWidth - 2;
      prev.disabled = rail.scrollLeft <= 2;
      next.disabled = rail.scrollLeft >= max;
      box.hidden = max <= 0;
    }
    [prev, next].forEach(function (b) {
      b.addEventListener('click', function () {
        rail.scrollBy({ left: Number(b.getAttribute('data-dir')) * rail.clientWidth * 0.92, behavior: STILL ? 'auto' : 'smooth' });
      });
    });
    rail.addEventListener('scroll', function () { window.requestAnimationFrame(state); }, { passive: true });
    window.addEventListener('resize', state);
    /* the song filter changes how many columns there are */
    document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('.tab')) setTimeout(state, 260); });
    state();
  });

  /* ================= 2b. VIDEOS LOAD WHEN NEAR =================
     Nothing downloads until a clip is about to scroll into view, so a
     phone on mobile data only pays for what it actually sees. */
  var lazyVids = document.querySelectorAll('video[data-src]');
  function startVid(v) {
    if (!v.getAttribute('src')) { v.src = v.getAttribute('data-src'); }
    if (!STILL) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
  }
  if ('IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (en) {
      en.forEach(function (e) {
        if (e.isIntersecting) startVid(e.target);
        else if (e.target.getAttribute('src')) e.target.pause();
      });
    }, { rootMargin: '250px 0px' });
    Array.prototype.forEach.call(lazyVids, function (v) { vio.observe(v); });
  } else {
    Array.prototype.forEach.call(lazyVids, startVid);
  }

  /* ================= 3. FLOATING PLAY BUTTON ================= */
  var fab = document.getElementById('fab');
  if (fab) {
    var btn = fab.querySelector('.fab-btn');
    var menu = fab.querySelector('.fab-menu');
    function setOpen(open) {
      fab.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.hidden = !open;
      if (open) { var f = menu.querySelector('a'); if (f) f.focus(); }
    }
    btn.addEventListener('click', function () { setOpen(!fab.classList.contains('open')); });
    document.addEventListener('click', function (e) { if (!fab.contains(e.target)) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && fab.classList.contains('open')) { setOpen(false); btn.focus(); } });
    /* show it once the hero is behind you, like Shazam's */
    var heroEl = document.getElementById('top');
    if (heroEl && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        var show = en[0].intersectionRatio < 0.35;
        fab.classList.toggle('show', show);
        if (!show) setOpen(false);
      }, { threshold: [0, 0.35, 1] }).observe(heroEl);
    } else {
      fab.classList.add('show');
    }
  }
})();

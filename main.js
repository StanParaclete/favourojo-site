/* =========================================================
   Favour Ojo — main.js

   Everything here degrades quietly. Without IntersectionObserver
   the content is simply visible from the start; nothing is hidden
   by CSS that only JS knows how to reveal.
   ========================================================= */

(function () {
  'use strict';

  var STILL = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var nav = document.getElementById('nav');
  var burger = document.getElementById('burger');
  var links = document.getElementById('navLinks');

  /* ================= MENU ================= */
  var lastFocus = null;
  function menuOpen() { return nav && nav.classList.contains('open'); }

  function openMenu() {
    nav.classList.add('open');
    document.body.classList.add('locked');
    burger.setAttribute('aria-expanded', 'true');
    burger.setAttribute('aria-label', 'Close menu');
    lastFocus = document.activeElement;
    var first = links.querySelector('a');
    if (first) setTimeout(function () { first.focus(); }, 280);
  }

  function closeMenu(returnFocus) {
    nav.classList.remove('open');
    document.body.classList.remove('locked');
    burger.setAttribute('aria-expanded', 'false');
    burger.setAttribute('aria-label', 'Open menu');
    if (returnFocus) (lastFocus || burger).focus();
  }

  if (burger && nav && links) {
    burger.addEventListener('click', function () {
      if (menuOpen()) closeMenu(true); else openMenu();
    });

    links.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') closeMenu(false);
    });

    document.addEventListener('keydown', function (e) {
      if (!menuOpen()) return;
      if (e.key === 'Escape') { closeMenu(true); return; }
      if (e.key !== 'Tab') return;

      /* keep Tab inside the open menu */
      var items = [burger].concat(Array.prototype.slice.call(links.querySelectorAll('a')));
      var i = items.indexOf(document.activeElement);
      if (i === -1) return;
      var next = e.shiftKey ? i - 1 : i + 1;
      if (next < 0) next = items.length - 1;
      if (next >= items.length) next = 0;
      e.preventDefault();
      items[next].focus();
    });

    /* resizing past the breakpoint must not leave the body locked */
    window.addEventListener('resize', function () {
      if (menuOpen() && window.innerWidth > 720) closeMenu(false);
    });
  }

  /* ================= NAV state ================= */
  var hero = document.getElementById('top');
  var progress = document.getElementById('progress');
  var sections = [];

  if (links) {
    Array.prototype.forEach.call(links.querySelectorAll('a'), function (a) {
      var id = a.getAttribute('href');
      if (id && id.charAt(0) === '#' && id.length > 1) {
        var el = document.getElementById(id.slice(1));
        if (el) sections.push({ link: a, el: el });
      }
    });
  }

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;

      if (progress) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(window.scrollY / max, 1) : 0) + ')';
      }
      if (hero && nav) {
        nav.classList.toggle('solid', window.scrollY > hero.offsetHeight - 80);
      }

      var mark = window.scrollY + window.innerHeight * 0.32;
      var current = null;
      sections.forEach(function (s) { if (s.el.offsetTop <= mark) current = s; });
      sections.forEach(function (s) { s.link.classList.toggle('here', s === current); });
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ================= REVEAL ================= */
  var risers = document.querySelectorAll('.rise');

  if (STILL || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(risers, function (el) { el.classList.add('seen'); });
  } else {
    /* stagger within each group, not across the whole page */
    Array.prototype.forEach.call(risers, function (el) {
      var sibs = Array.prototype.filter.call(el.parentNode.children, function (c) {
        return c.classList && c.classList.contains('rise');
      });
      el.style.setProperty('--i', Math.min(sibs.indexOf(el), 9));
    });

    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        revealer.unobserve(el);

        /* A side-scrolling rail holds cards that are off to the right
           and never enter the viewport on their own. Scrolling down
           past the rail must reveal all of them, or the ones you have
           to swipe to stay blank forever. */
        if (el.classList.contains('rail')) {
          Array.prototype.forEach.call(el.querySelectorAll('.rise'), function (kid) {
            kid.classList.add('seen');
          });
        } else {
          el.classList.add('seen');
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    Array.prototype.forEach.call(risers, function (el) {
      var rail = el.parentNode && el.parentNode.classList &&
                 el.parentNode.classList.contains('rail') ? el.parentNode : null;
      revealer.observe(rail || el);
    });
  }

  /* ================= FIGURES count up ================= */
  function countUp(el) {
    var raw = el.textContent.trim();
    var m = raw.match(/^([\d.]+)(.*)$/);
    if (!m) return;
    var target = parseFloat(m[1]);
    var suffix = m[2];
    var dp = (m[1].split('.')[1] || '').length;
    var t0 = null, RUN = 1100;

    function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min((now - t0) / RUN, 1);
      el.textContent = (target * (1 - Math.pow(1 - p, 3))).toFixed(dp) + suffix;
      if (p < 1) requestAnimationFrame(step); else el.textContent = raw;
    }
    requestAnimationFrame(step);
  }

  var figures = document.querySelectorAll('.figure b');
  if (!STILL && 'IntersectionObserver' in window && figures.length) {
    var counter = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        countUp(en.target);
        counter.unobserve(en.target);
      });
    }, { threshold: 0.6 });
    Array.prototype.forEach.call(figures, function (el) { counter.observe(el); });
  }

  /* ================= SONG FILTER ================= */
  var tabs = document.querySelectorAll('.tab');
  var tracks = document.querySelectorAll('.track');
  var chart = document.getElementById('chart');

  Array.prototype.forEach.call(tabs, function (tab) {
    tab.addEventListener('click', function () {
      var want = tab.dataset.filter;
      Array.prototype.forEach.call(tabs, function (t) {
        t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      });
      if (chart) chart.classList.add('swapping');

      setTimeout(function () {
        var n = 0;
        Array.prototype.forEach.call(tracks, function (tr) {
          var show = want === 'all' || tr.dataset.group === want;
          tr.hidden = !show;
          if (show) {
            tr.classList.add('seen');
            tr.querySelector('.track-no').textContent = ++n;
          }
        });
        if (chart) chart.classList.remove('swapping');
      }, STILL ? 0 : 190);
    });
  });

  /* ================= ANCHORS clear the fixed nav ================= */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var id = a.getAttribute('href');
    if (id.length < 2) return;
    var el = document.getElementById(id.slice(1));
    if (!el) return;
    e.preventDefault();
    var top = el.getBoundingClientRect().top + window.scrollY - (nav ? nav.offsetHeight + 8 : 0);
    window.scrollTo({ top: top, behavior: STILL ? 'auto' : 'smooth' });
  });

  /* ================= HERO DECK (WebGL) =================
     162 KB of three.js is only worth it on a wide screen that
     wants motion. A phone on mobile data never downloads it. */
  var deckHost = document.getElementById('deck');
  var wide = window.matchMedia('(min-width: 900px)').matches;

  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) { return false; }
  }

  if (deckHost && wide && !STILL && hasWebGL()) {
    var start = function () {
      import('./deck.js')
        .then(function (m) { return m.default(deckHost); })
        .then(function () { deckHost.classList.add('deck-live'); })
        .catch(function (err) { console.warn('cover deck fell back to CSS:', err); });
    };
    if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 2500 });
    else setTimeout(start, 1200);
  }

  /* ================= VIDEO thrift ================= */
  var vids = document.querySelectorAll('video');

  if (STILL) {
    Array.prototype.forEach.call(vids, function (v) {
      v.removeAttribute('autoplay');
      v.pause();
    });
    return;
  }
  if (!('IntersectionObserver' in window)) return;

  var player = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      var v = en.target;
      if (en.isIntersecting) {
        var p = v.play();
        if (p && p.catch) p.catch(function () {});
      } else { v.pause(); }
    });
  }, { rootMargin: '150px' });

  Array.prototype.forEach.call(vids, function (v) { player.observe(v); });
})();

/* 3D roll: places the event details around a cylinder (see .roll in unburden.css).
   Each word is measured, so the spacing is even whatever the font and screen size. */
(function () {
  var drum = document.getElementById('rollDrum');
  if (!drum) return;

  var words = [
    ['Unburden', 'g'], ['•', 'd'], ['Sunday 15 November', ''], ['•', 'd'], ['5 PM', ''], ['•', 'd'],
    ['Café One, Victoria Island', ''], ['•', 'd'], ['Free admission', ''], ['•', 'd'],
    ['with Favour Ojo', 'g'], ['•', 'd'], ['Registration required', ''], ['•', 'd'],
  ];

  function build() {
    drum.textContent = '';
    var gap = Math.max(18, Math.min(34, window.innerWidth * 0.022));
    var els = [], total = 0, laps = 0;
    /* repeat the set until the ring is big enough to look like a gentle curve */
    while (laps < 3 || total < Math.max(3000, window.innerWidth * 3.4)) {
      words.forEach(function (w) {
        var s = document.createElement('span');
        s.textContent = w[0];
        if (w[1]) s.className = w[1];
        drum.appendChild(s);
        var width = s.getBoundingClientRect().width;
        els.push([s, width]);
        total += width + gap;
      });
      laps++;
    }
    var r = total / (2 * Math.PI);
    var at = 0;
    els.forEach(function (e) {
      var mid = at + e[1] / 2;
      var deg = mid / total * 360;
      e[0].style.transform = 'translate(-50%, -50%) rotateY(' + deg.toFixed(3) + 'deg) translateZ(' + r.toFixed(1) + 'px)';
      at += e[1] + gap;
    });
    /* push the drum back so its front face sits at the screen plane */
    drum.style.setProperty('--r', r.toFixed(1) + 'px');
  }

  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(build, build);
  var t;
  window.addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(function () { if (Math.abs(window.innerWidth - (build.w || 0)) > 40) { build.w = window.innerWidth; build(); } }, 200);
  });
  build.w = window.innerWidth;
})();

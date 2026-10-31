/* =========================================================
   UNBURDEN extras
     - the people's setlist (live tally + your vote)
     - "I'm going" story card, drawn in the browser
     - Lay it down, the anonymous burden wall
   Everything degrades quietly: if the API can't be reached, the
   sections stay in their empty state and the page still works.
   ========================================================= */

(function () {
  'use strict';

  var SONGS = [
    ['free', 'FREE'], ['yahweh-tsidkenu', 'Yahweh Tsidkenu'], ['atofarati', 'Atofarati'],
    ['iba', 'IBA'], ['yesu-mai-girma', 'Yesu Mai Girma'], ['water-to-wine-ii', 'Water To Wine II'],
    ['marys-praise-ii', 'Mary’s Praise II'], ['ese', 'Ese'], ['worship-medley-7', 'Worship Medley 7'],
    ['spontaneous-worship', 'Spontaneous Worship'], ['elshaddai', 'Elshaddai']
  ];
  var title = function (slug) { for (var i = 0; i < SONGS.length; i++) if (SONGS[i][0] === slug) return SONGS[i][1]; return ''; };
  var STILL = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SAVED_KEY = 'unburden-registered';
  var me = null;

  function getJSON(url) { return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function postJSON(url, body) {
    return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; }); });
  }
  function remember(patch) {
    try {
      var cur = JSON.parse(localStorage.getItem(SAVED_KEY) || 'null') || {};
      for (var k in patch) cur[k] = patch[k];
      localStorage.setItem(SAVED_KEY, JSON.stringify(cur));
    } catch (e) {}
  }

  /* ---- fill every song picker on the page ---- */
  Array.prototype.forEach.call(document.querySelectorAll('select[data-songs]'), function (sel) {
    SONGS.forEach(function (s) {
      var o = document.createElement('option'); o.value = s[0]; o.textContent = s[1]; sel.appendChild(o);
    });
  });

  /* ================= THE PEOPLE'S SETLIST ================= */
  var list = document.getElementById('setlist-list');
  var totalEl = document.getElementById('setlistTotal');
  var lastTally = null;

  function renderTally(data) {
    if (!list || !data) return;
    lastTally = data;
    var rows = data.tally.filter(function (t) { return t.votes > 0; }).slice(0, 8);
    if (!rows.length) return;
    var max = rows[0].votes;
    list.innerHTML = '';
    rows.forEach(function (t, i) {
      var li = document.createElement('li');
      li.className = 'set-row' + (me && me.song === t.slug ? ' mine' : '');
      /* no vote counts on show - they would hint at how many people have registered */
      li.innerHTML = '<span class="set-no">' + (i + 1) + '</span><span class="set-name"></span>' +
                     '<span class="set-votes">' + (i === 0 ? 'Leading' : '') + '</span>' +
                     '<span class="set-bar"><i></i></span>';
      li.querySelector('.set-name').textContent = t.title;
      list.appendChild(li);
      var bar = li.querySelector('.set-bar i');
      var w = Math.max(6, t.votes / max * 100) + '%';
      if (STILL) bar.style.width = w; else requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.width = w; }); });
    });
    if (totalEl) { totalEl.hidden = false; totalEl.textContent = 'Updated live as people register.'; }
  }
  if (list) getJSON('/api/votes').then(renderTally).catch(function () {});

  /* ---- your vote, in the confirmed panel ---- */
  var myVote = document.getElementById('myVote');
  var voteSel = document.getElementById('voteSong');
  var voteGo = document.getElementById('voteGo');
  var voteErr = document.getElementById('voteErr');

  function paintMyVote() {
    if (!myVote) return;
    var t = document.getElementById('myVoteTitle');
    var s = document.getElementById('myVoteSub');
    if (me && me.song) {
      myVote.classList.add('voted');
      t.textContent = 'Your song: ' + title(me.song);
      s.innerHTML = 'Thank you. You’ll see it in the setlist. <button type="button" class="another" id="voteChange" style="display:inline;margin:0">Change it</button>';
      var ch = document.getElementById('voteChange');
      if (ch) ch.addEventListener('click', function () { myVote.classList.remove('voted'); voteSel.value = me.song; voteSel.focus(); });
    } else {
      myVote.classList.remove('voted');
      t.textContent = 'Pick a song for the night';
      s.textContent = 'Which one would you love to hear Favour sing? The top picks are in the setlist.';
    }
    myVote.hidden = !(me && me.email);   /* need the email to vote */
  }

  if (voteGo) voteGo.addEventListener('click', function () {
    voteErr.textContent = '';
    if (!voteSel.value) { voteErr.textContent = 'Choose a song first.'; voteSel.focus(); return; }
    if (!me || !me.email) return;
    voteGo.disabled = true; voteGo.textContent = 'Saving…';
    postJSON('/api/votes', { email: me.email, song: voteSel.value }).then(function (res) {
      voteGo.disabled = false; voteGo.textContent = 'Vote';
      if (res.status === 200 && res.d.ok) {
        me.song = res.d.song; remember({ song: me.song });
        paintMyVote(); renderTally(res.d);
      } else {
        voteErr.textContent = res.d.error || 'Something went wrong. Please try again.';
      }
    }).catch(function () {
      voteGo.disabled = false; voteGo.textContent = 'Vote';
      voteErr.textContent = 'We couldn’t reach the server. Please try again.';
    });
  });

  /* ================= "I'M GOING" STORY CARD ================= */
  var storyMake = document.getElementById('storyMake');
  var storySave = document.getElementById('storySave');
  var storyPreview = document.getElementById('storyPreview');
  var storyImg = document.getElementById('storyImg');
  var storyFile = null;

  function loadImage(src) {
    return new Promise(function (ok, fail) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = fail; i.src = src; });
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function wrap(ctx, text, maxW) {
    var words = text.split(' '), lines = [], line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }

  function drawStory(firstName) {
    var fonts = document.fonts && document.fonts.load
      ? Promise.all([
          document.fonts.load('900 120px Archivo'), document.fonts.load('700 40px Archivo'),
          document.fonts.load('italic 300 50px "Cormorant Garamond"')
        ]).catch(function () {})
      : Promise.resolve();

    return Promise.all([fonts, loadImage('/images/unburden/worship-1.jpg')]).then(function (r) {
      var img = r[1];
      var W = 1080, H = 1920, M = 60;
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

      /* the photograph, cut into three, same as the page */
      var top = 120, ph = 900, gap = 18, pw = (W - 2 * M - 2 * gap) / 3;
      var boxW = W - 2 * M, ratio = boxW / ph;
      var sh = img.height, sw = sh * ratio, sx = Math.min(img.width - sw, Math.max(0, img.width * 0.105));   /* keeps her face in the middle panel */
      for (var k = 0; k < 3; k++) {
        var dx = M + k * (pw + gap);
        ctx.save(); roundRect(ctx, dx, top, pw, ph, 26); ctx.clip();
        var srcX = sx + (k * (pw + gap)) / boxW * sw, srcW = pw / boxW * sw;
        ctx.drawImage(img, srcX, 0, srcW, sh, dx, top, pw, ph);
        var g = ctx.createLinearGradient(0, top + ph * 0.55, 0, top + ph);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)');
        ctx.fillStyle = g; ctx.fillRect(dx, top, pw, ph);
        ctx.restore();
      }

      ctx.textBaseline = 'alphabetic';
      var name = (firstName || 'I').trim().slice(0, 22);
      name = name.charAt(0).toUpperCase() + name.slice(1);

      ctx.fillStyle = '#c9a84c';
      var nfs = 50; ctx.font = '700 ' + nfs + 'px Archivo, Arial, sans-serif';
      var lead = (name === 'I' ? 'I’m' : name + ' is') + ' going to';
      while (ctx.measureText(lead).width > W - 2 * M && nfs > 30) { nfs -= 2; ctx.font = '700 ' + nfs + 'px Archivo, Arial, sans-serif'; }
      ctx.fillText(lead, M, 1135);

      ctx.fillStyle = '#b9b6b0'; ctx.font = '700 44px Archivo, Arial, sans-serif';
      ctx.fillText('Favour & Faves:', M + 6, 1215);

      ctx.fillStyle = '#fff';
      var fs = 220; ctx.font = '900 ' + fs + 'px Archivo, Arial Black, sans-serif';
      while (ctx.measureText('UNBURDEN').width > W - 2 * M && fs > 80) { fs -= 4; ctx.font = '900 ' + fs + 'px Archivo, Arial Black, sans-serif'; }
      ctx.fillText('UNBURDEN', M - 4, 1215 + fs * 0.86);

      ctx.fillStyle = '#c9a84c'; ctx.font = 'italic 300 52px "Cormorant Garamond", Georgia, serif';
      var y = 1215 + fs * 0.86 + 96;
      wrap(ctx, 'An intimate evening of worship, music and community.', W - 2 * M).forEach(function (l) { ctx.fillText(l, M, y); y += 62; });

      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(M, 1660, W - 2 * M, 2);
      ctx.fillStyle = '#fff'; ctx.font = '700 44px Archivo, Arial, sans-serif';
      ctx.fillText('Sun 15 November 2026 · 5 PM', M, 1730);
      ctx.fillStyle = '#cfcdc8'; ctx.font = '500 38px Archivo, Arial, sans-serif';
      ctx.fillText('Café One, Victoria Island, Lagos', M, 1786);
      ctx.fillStyle = '#c9a84c'; ctx.font = '700 38px Archivo, Arial, sans-serif';
      ctx.fillText('favourojo.com/unburden', M, 1856);

      return new Promise(function (ok) { c.toBlob(ok, 'image/png'); });
    });
  }

  if (storyMake) storyMake.addEventListener('click', function () {
    /* second tap on a phone that can share files: straight to the share sheet */
    if (storyFile && navigator.canShare && navigator.canShare({ files: [storyFile] })) {
      navigator.share({ files: [storyFile], title: 'UNBURDEN', text: 'I’m going to Favour & Faves: UNBURDEN. favourojo.com/unburden' }).catch(function () {});
      return;
    }
    storyMake.disabled = true; storyMake.textContent = 'Making your card…';
    drawStory(me && me.firstName).then(function (blob) {
      storyMake.disabled = false;
      var url = URL.createObjectURL(blob);
      storyImg.src = url; storyPreview.hidden = false;
      storySave.href = url; storySave.hidden = false;
      try { storyFile = new File([blob], 'unburden-story.png', { type: 'image/png' }); } catch (e) { storyFile = null; }
      storyMake.textContent = storyFile && navigator.canShare && navigator.canShare({ files: [storyFile] }) ? 'Share to my status' : 'Make it again';
    }).catch(function () {
      storyMake.disabled = false; storyMake.textContent = 'Try again';
    });
  });

  /* ================= CHECK-IN CODE ================= */
  var checkin = document.getElementById('checkin');
  var myQr = document.getElementById('myQr');
  function showQr(id) {
    if (!checkin || !/^[a-f0-9]{32}$/.test(id || '')) return;
    myQr.src = '/api/qr?id=' + id;
    checkin.hidden = false;
  }
  /* the id is the first 32 hex characters of the SHA-256 of the email,
     same as the server - so older sign-ups saved on this phone still get a code */
  function idFor(email) {
    if (!email || !window.crypto || !crypto.subtle || !window.TextEncoder) return Promise.resolve('');
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.toLowerCase())).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('').slice(0, 32);
    }).catch(function () { return ''; });
  }

  /* ---- who is registered on this phone? ---- */
  function onMe(who) {
    me = who || null;
    if (me && me.id) showQr(me.id);
    else if (me && me.email) idFor(me.email).then(function (id) { if (id) { me.id = id; remember({ id: id }); showQr(id); } });
    paintMyVote();
    if (lastTally) renderTally(lastTally);
  }
  document.addEventListener('unburden:registered', function (e) { onMe(e.detail); });
  if (window.UNBURDEN_ME) onMe(window.UNBURDEN_ME);
  else paintMyVote();

  /* ================= LAY IT DOWN ================= */
  var card = document.getElementById('layCard');
  var layForm = document.getElementById('layForm');
  if (!card || !layForm) return;

  var text = document.getElementById('layText');
  var chars = document.getElementById('layChars');
  var btn = document.getElementById('layBtn');
  var err = document.getElementById('layErr');
  var countWrap = document.getElementById('layCount');
  var num = document.getElementById('layNum');
  var label = document.getElementById('layLabel');
  var shownAt = Date.now();
  var shown = 0;
  btn.disabled = false;

  function showCount(n, animate) {
    if (!n) return;
    countWrap.hidden = false;
    label.textContent = n === 1 ? 'burden laid down so far' : 'burdens laid down so far';
    if (!animate || STILL) { num.textContent = n; shown = n; return; }
    var from = shown, t0 = null;
    (function step(now) {
      if (t0 === null) t0 = now;
      var p = Math.min((now - t0) / 900, 1);
      num.textContent = Math.round(from + (n - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step); else shown = n;
    })(performance.now());
  }

  getJSON('/api/burdens').then(function (d) {
    if (!d.open) card.setAttribute('data-state', 'closed');
    showCount(d.count, true);
  }).catch(function () {});

  text.addEventListener('input', function () { chars.textContent = text.value.length + ' / 600'; err.textContent = ''; });

  layForm.addEventListener('submit', function (e) {
    e.preventDefault();
    err.textContent = '';
    if (text.value.trim().length < 3) { err.textContent = 'Write a few words first.'; text.focus(); return; }
    btn.disabled = true; btn.textContent = 'Laying it down…';
    postJSON('/api/burdens', { text: text.value, website: layForm.elements.website.value, t: Date.now() - shownAt })
      .then(function (res) {
        btn.disabled = false; btn.textContent = 'Lay it down';
        if (res.status !== 200 || !res.d.ok) {
          if (res.status === 410) { card.setAttribute('data-state', 'closed'); return; }
          err.textContent = res.d.error || 'Something went wrong. Please try again.'; return;
        }
        card.classList.add('leaving');
        setTimeout(function () {
          card.classList.remove('leaving');
          text.value = ''; chars.textContent = '0 / 600';
          card.setAttribute('data-state', 'done');
          document.getElementById('layDone').focus({ preventScroll: true });
          if (res.d.count) showCount(res.d.count, true);
        }, STILL ? 0 : 850);
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Lay it down';
        err.textContent = 'We couldn’t reach the server. Please try again.';
      });
  });

  document.getElementById('layAgain').addEventListener('click', function () {
    card.setAttribute('data-state', 'open'); shownAt = Date.now(); text.focus();
  });
})();

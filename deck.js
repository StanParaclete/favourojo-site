/* =========================================================
   Hero cover deck — WebGL

   The five covers stand in a shallow arc, breathing slightly and
   leaning toward the pointer. Three.js is vendored locally rather
   than pulled from a CDN, so it is served from the same host and
   there is no third-party round trip on a slow connection.

   This module only ever runs when main.js decides it is worth it:
   wide screen, motion allowed, WebGL present. If anything here
   throws, main.js leaves the CSS deck visible and nothing is lost.
   ========================================================= */

import * as THREE from './vendor/three.module.min.js';

const COVERS = [
  { file: 'images/covers/atofarati.jpg',        title: 'Atofarati' },
  { file: 'images/covers/worship-medley-7.jpg', title: 'Worship Medley 7' },
  { file: 'images/covers/free.jpg',             title: 'FREE', featured: true },
  { file: 'images/covers/tsidkenu.jpg',         title: 'Yahweh Tsidkenu' },
  { file: 'images/covers/yesu-mai-girma.jpg',   title: 'Yesu Mai Girma' }
];

const CARD = 1.72;        // world units, square
const GAP = 1.30;         // horizontal spacing between card centres
const RADIUS = 26;        // corner radius in texture pixels
const TEX = 512;

/* Redraw a cover into a canvas with rounded corners, so the plane
   can be transparent at the corners without needing a shader. */
function roundedTexture(img) {
  const c = document.createElement('canvas');
  c.width = c.height = TEX;
  const x = c.getContext('2d');
  const r = RADIUS;

  x.beginPath();
  x.moveTo(r, 0);
  x.arcTo(TEX, 0, TEX, TEX, r);
  x.arcTo(TEX, TEX, 0, TEX, r);
  x.arcTo(0, TEX, 0, 0, r);
  x.arcTo(0, 0, TEX, 0, r);
  x.closePath();
  x.clip();
  x.drawImage(img, 0, 0, TEX, TEX);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* A blurred dark blob that sits behind and below each card. Cheap
   substitute for a real shadow pass, and it survives on any GPU. */
let SHADOW_TEX = null;
function shadowTexture() {
  if (SHADOW_TEX) return SHADOW_TEX;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.62)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  SHADOW_TEX = new THREE.CanvasTexture(c);
  return SHADOW_TEX;
}

function loadImage(src) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('cover missing: ' + src));
    i.src = src;
  });
}

export default async function mountDeck(host) {
  const imgs = await Promise.all(COVERS.map(c => loadImage(c.file)));

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 6.6);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const deck = new THREE.Group();
  scene.add(deck);

  const mid = (COVERS.length - 1) / 2;
  const cards = [];

  COVERS.forEach((cover, i) => {
    const off = i - mid;                    // -2 .. 2
    const away = Math.abs(off);

    const mat = new THREE.MeshBasicMaterial({
      map: roundedTexture(imgs[i]),
      transparent: true,
      depthWrite: false
    });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(CARD, CARD), mat);

    // fan out from the middle: further cards sit back, lower, turned away
    card.position.set(off * GAP, -away * 0.12, -away * 0.62);
    card.rotation.y = -off * 0.34;
    card.scale.setScalar(1 - away * 0.07);

    // the middle card is the newest release and stays fully lit
    mat.color.setScalar(1 - away * 0.18);

    card.renderOrder = 10 - Math.round(away * 4);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD * 2.1, CARD * 2.1),
      new THREE.MeshBasicMaterial({
        map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0
      })
    );
    shadow.position.set(0, -CARD * 0.34, -0.14);
    shadow.renderOrder = card.renderOrder - 1;
    card.add(shadow);

    card.userData = {
      home: card.position.clone(),
      spin: card.rotation.y,
      phase: i * 0.9,
      drift: 0.055 - away * 0.008,
      featured: !!cover.featured,
      shadow: shadow,
      shadowMax: 0.85 - away * 0.16
    };

    deck.add(card);
    cards.push(card);
  });

  /* --- sizing ------------------------------------------------ */
  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  /* --- pointer parallax -------------------------------------- */
  let aimX = 0, aimY = 0, curX = 0, curY = 0;
  function onMove(e) {
    aimX = (e.clientX / innerWidth - 0.5) * 2;
    aimY = (e.clientY / innerHeight - 0.5) * 2;
  }
  addEventListener('pointermove', onMove, { passive: true });

  /* --- entrance ---------------------------------------------- */
  const START = performance.now();
  const RISE = 1150;                       // ms
  const ease = t => 1 - Math.pow(1 - t, 3);

  /* --- loop --------------------------------------------------- */
  let alive = true;
  let visible = true;

  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; });
  io.observe(host);

  function frame(now) {
    if (!alive) return;
    requestAnimationFrame(frame);
    if (!visible) return;                  // stop drawing once scrolled past

    const t = now / 1000;

    // settle the pointer lean rather than snapping to it
    curX += (aimX - curX) * 0.045;
    curY += (aimY - curY) * 0.045;
    deck.rotation.y = curX * 0.20;
    deck.rotation.x = curY * 0.10;

    const intro = Math.min((now - START) / RISE, 1);

    cards.forEach((card, i) => {
      const d = card.userData;

      // each card arrives a beat after the one before it
      const own = Math.min(Math.max((intro - i * 0.075) / 0.68, 0), 1);
      const e = ease(own);

      const bob = Math.sin(t * 0.62 + d.phase) * d.drift;
      const sway = Math.cos(t * 0.44 + d.phase) * 0.022;

      card.position.x = d.home.x;
      card.position.y = d.home.y + bob + (1 - e) * -1.5;
      card.position.z = d.home.z;
      card.rotation.y = d.spin + sway + (1 - e) * 0.5;
      card.material.opacity = e;
      d.shadow.material.opacity = e * d.shadowMax;
    });

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  /* --- teardown ------------------------------------------------ */
  return function destroy() {
    alive = false;
    io.disconnect();
    ro.disconnect();
    removeEventListener('pointermove', onMove);
    cards.forEach(c => {
      c.userData.shadow.geometry.dispose();
      c.userData.shadow.material.dispose();
      c.geometry.dispose();
      c.material.map.dispose();
      c.material.dispose();
    });
    if (SHADOW_TEX) { SHADOW_TEX.dispose(); SHADOW_TEX = null; }
    renderer.dispose();
    if (renderer.domElement.parentNode) renderer.domElement.remove();
  };
}

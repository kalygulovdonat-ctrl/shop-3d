// ОБЖИГ — витрина керамики. Изделие «перелепливается» из одной формы в другую, как на гончарном круге.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const $ = (id) => document.getElementById(id);
const rub = (n) => n.toLocaleString('ru-RU').replace(/ | /g, ' ') + ' ₽';

/* ------------------------------------------------------------------ */
/* Данные (заглушки)                                                   */
/* ------------------------------------------------------------------ */
const GLAZES = [
  { id: 'milk', name: 'Молоко', hex: '#ece4d4' },
  { id: 'sage', name: 'Шалфей', hex: '#98a688' },
  { id: 'cobalt', name: 'Кобальт', hex: '#2b4a80' },
  { id: 'ochre', name: 'Охра', hex: '#c8922f' },
  { id: 'garnet', name: 'Гранат', hex: '#7c2b2b' },
  { id: 'coal', name: 'Уголь', hex: '#2a2927' },
];
// profile: [радиус, высота] — половина силуэта, снизу вверх
const PRODUCTS = [
  { id: 'luna', name: 'Луна', type: 'Ваза', price: 7400, h: '21 см', d: '19 см', v: '2,4 л', glaze: 'milk', wall: 0.05, ridges: 0.004,
    desc: 'Круглая, как полная луна. Узкое горло держит и одну ветку, и целый букет.',
    profile: [[0.36, 0], [0.74, 0.28], [0.96, 0.85], [0.82, 1.42], [0.42, 1.78], [0.30, 1.96], [0.37, 2.1]] },
  { id: 'stolb', name: 'Столб', type: 'Бутыль', price: 6200, h: '25 см', d: '10 см', v: '0,9 л', glaze: 'cobalt', wall: 0.045, ridges: 0.005,
    desc: 'Высокая бутыль для масла, вина или сухоцветов. Стоит устойчиво, льёт без капель.',
    profile: [[0.42, 0], [0.5, 0.18], [0.52, 1.15], [0.42, 1.7], [0.17, 2.02], [0.14, 2.38], [0.21, 2.5]] },
  { id: 'chasha', name: 'Чаша', type: 'Салатник', price: 5600, h: '10 см', d: '24 см', v: '1,8 л', glaze: 'sage', wall: 0.05, ridges: 0.003,
    desc: 'Широкая чаша на невысокой ножке. Для салата на всю семью или фруктов на столе.',
    profile: [[0.34, 0], [0.31, 0.1], [0.62, 0.26], [1.02, 0.56], [1.2, 0.88], [1.24, 1.0]] },
  { id: 'amfora', name: 'Амфора', type: 'Кувшин', price: 8900, h: '23 см', d: '16 см', v: '1,6 л', glaze: 'ochre', wall: 0.05, ridges: 0.006,
    desc: 'Плечи как у античного кувшина и раскрытое горло. Самая выразительная вещь на полке.',
    profile: [[0.3, 0], [0.44, 0.24], [0.8, 0.92], [0.72, 1.5], [0.36, 1.86], [0.33, 2.08], [0.52, 2.3]] },
  { id: 'stakan', name: 'Стакан', type: 'Чашка без ручки', price: 1900, h: '11 см', d: '9 см', v: '0,35 л', glaze: 'coal', wall: 0.04, ridges: 0.004,
    desc: 'Тёплый в ладони, с тонким краем. Для чая, кофе и воды у кровати.',
    profile: [[0.42, 0], [0.47, 0.06], [0.52, 0.6], [0.55, 1.0], [0.56, 1.12]] },
];
const glazeById = (id) => GLAZES.find((g) => g.id === id);
const productById = (id) => PRODUCTS.find((p) => p.id === id);

/* ------------------------------------------------------------------ */
/* Состояние и DOM                                                     */
/* ------------------------------------------------------------------ */
const state = { index: 0, glaze: PRODUCTS[0].glaze, cart: [] };
try { state.cart = (JSON.parse(localStorage.getItem('obzhig-cart')) || []).filter((i) => productById(i.id) && glazeById(i.glaze)); } catch (e) { /* хранилище недоступно */ }
const saveCart = () => { try { localStorage.setItem('obzhig-cart', JSON.stringify(state.cart)); } catch (e) { /* не страшно */ } };
const thumbs = {}; // снимки изделий для каталога и корзины
const scene3d = { setProduct() {}, setGlaze() {}, snap() {} }; // заполняется, если WebGL доступен

function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function applyGlazeUI() {
  const g = glazeById(state.glaze);
  document.documentElement.style.setProperty('--glaze', g.hex);
  document.documentElement.style.setProperty('--on-glaze', luminance(g.hex) > 0.35 ? '#1d1b18' : '#f3ede1');
  $('gName').textContent = g.name;
  document.querySelectorAll('#glazes input').forEach((i) => { i.checked = i.value === g.id; });
}

function fillProduct() {
  const p = PRODUCTS[state.index];
  $('pName').textContent = p.name;
  document.documentElement.style.setProperty('--name-len', p.name.length);
  $('pType').textContent = p.type;
  $('pDesc').textContent = p.desc;
  $('pH').textContent = p.h; $('pD').textContent = p.d; $('pV').textContent = p.v;
  $('pPrice').textContent = rub(p.price);
  $('pIdx').textContent = String(state.index + 1).padStart(2, '0');
  document.querySelectorAll('.card').forEach((c) => {
    const cur = c.dataset.id === p.id;
    c.classList.toggle('is-current', cur);
    if (cur) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
  });
}

let switchTimer = 0;
function setProduct(i, { instant = false } = {}) {
  const n = PRODUCTS.length;
  i = ((i % n) + n) % n;
  if (i === state.index && !instant) return;
  state.index = i;
  state.glaze = PRODUCTS[i].glaze;
  scene3d.setProduct(i, instant);
  scene3d.setGlaze(state.glaze, instant);
  applyGlazeUI();
  clearTimeout(switchTimer);
  if (instant || reduceMotion) { fillProduct(); return; }
  document.body.classList.add('is-switching');
  switchTimer = setTimeout(() => { fillProduct(); document.body.classList.remove('is-switching'); }, 430);
}

// глазури
$('glazes').innerHTML = GLAZES.map((g) => `
  <label class="glaze" style="--c:${g.hex}" title="${g.name}">
    <input type="radio" name="glaze" value="${g.id}" aria-label="${g.name}"><span></span>
  </label>`).join('');
$('glazes').addEventListener('change', (e) => {
  state.glaze = e.target.value;
  scene3d.setGlaze(state.glaze);
  applyGlazeUI();
});

// каталог
$('grid').innerHTML = PRODUCTS.map((p, i) => `
  <li><button class="card" type="button" data-id="${p.id}" data-i="${i}">
    <span class="card__img"><span class="card__n">${String(i + 1).padStart(2, '0')}</span><img alt="" data-thumb="${p.id}" hidden></span>
    <span class="card__row"><span class="card__name">${p.name}</span><span class="card__price">${rub(p.price)}</span></span>
    <span class="card__type">${p.type}</span>
  </button></li>`).join('');
$('grid').addEventListener('click', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  setProduct(+card.dataset.i);
  $('stage').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
});

$('prev').addEventListener('click', () => setProduct(state.index - 1));
$('next').addEventListener('click', () => setProduct(state.index + 1));
addEventListener('keydown', (e) => {
  if (document.body.classList.contains('cart-open')) { if (e.key === 'Escape') closeCart(); return; }
  if (e.target.closest('input, textarea')) return;
  if (scrollY > innerHeight * 0.6) return;
  if (e.key === 'ArrowLeft') setProduct(state.index - 1);
  if (e.key === 'ArrowRight') setProduct(state.index + 1);
});

/* ---------- корзина ---------- */
const cartEl = $('cart'), scrim = $('scrim');
let lastFocus = null;
function renderCart() {
  const count = state.cart.reduce((s, i) => s + i.qty, 0);
  const total = state.cart.reduce((s, i) => s + i.qty * productById(i.id).price, 0);
  $('cartCount').textContent = count;
  $('cartTotal').textContent = rub(total);
  $('checkout').disabled = !count;
  $('checkout').style.opacity = count ? '' : '.4';
  $('cartList').innerHTML = state.cart.map((it, k) => {
    const p = productById(it.id), g = glazeById(it.glaze);
    return `<li class="item">
      <span class="item__img">${thumbs[p.id + ':' + it.glaze] ? `<img src="${thumbs[p.id + ':' + it.glaze]}" alt="">` : ''}</span>
      <div>
        <p class="item__name">${p.name}</p>
        <p class="item__glaze"><i style="--c:${g.hex}"></i>${p.type} · ${g.name}</p>
        <span class="qty">
          <button type="button" data-act="dec" data-k="${k}" aria-label="Уменьшить количество">−</button>
          <span aria-label="Количество">${it.qty}</span>
          <button type="button" data-act="inc" data-k="${k}" aria-label="Увеличить количество">+</button>
        </span>
      </div>
      <div class="item__side"><span>${rub(p.price * it.qty)}</span>
        <button class="item__rm" type="button" data-act="rm" data-k="${k}">Убрать</button></div>
    </li>`;
  }).join('');
}
$('cartList').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const it = state.cart[+b.dataset.k];
  if (b.dataset.act === 'inc') it.qty = Math.min(20, it.qty + 1);
  if (b.dataset.act === 'dec') it.qty -= 1;
  if (b.dataset.act === 'rm' || it.qty < 1) state.cart.splice(+b.dataset.k, 1);
  saveCart(); renderCart();
  $('checkoutNote').textContent = '';
});
function openCart() {
  lastFocus = document.activeElement;
  cartEl.hidden = false; scrim.hidden = false;
  requestAnimationFrame(() => { document.body.classList.add('cart-open'); $('cartClose').focus(); });
}
function closeCart() {
  document.body.classList.remove('cart-open');
  setTimeout(() => { if (!document.body.classList.contains('cart-open')) { cartEl.hidden = true; scrim.hidden = true; } }, reduceMotion ? 0 : 650);
  if (lastFocus) lastFocus.focus();
}
$('cartOpen').addEventListener('click', openCart);
$('cartClose').addEventListener('click', closeCart);
scrim.addEventListener('click', closeCart);
cartEl.addEventListener('keydown', (e) => { // фокус не выходит из корзины
  if (e.key !== 'Tab') return;
  const f = [...cartEl.querySelectorAll('button:not([disabled])')];
  if (!f.length) return;
  if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
});
$('checkout').addEventListener('click', () => { $('checkoutNote').textContent = 'Это демо: оплата и оформление ещё не подключены.'; });

let addTimer = 0;
$('add').addEventListener('click', () => {
  const p = PRODUCTS[state.index];
  const found = state.cart.find((i) => i.id === p.id && i.glaze === state.glaze);
  if (found) found.qty = Math.min(20, found.qty + 1); else state.cart.push({ id: p.id, glaze: state.glaze, qty: 1 });
  scene3d.snap(state.index, state.glaze);
  saveCart(); renderCart();
  const btn = $('add'), n = $('cartCount');
  btn.textContent = 'Добавлено ✓'; btn.classList.add('is-done'); n.classList.add('bump');
  clearTimeout(addTimer);
  addTimer = setTimeout(() => { btn.textContent = 'В корзину'; btn.classList.remove('is-done'); n.classList.remove('bump'); }, 1400);
});

applyGlazeUI(); fillProduct(); renderCart();

/* ------------------------------------------------------------------ */
/* 3D                                                                  */
/* ------------------------------------------------------------------ */
const canvas = $('scene'), view = $('view');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (e) {
  canvas.hidden = true; // без WebGL магазин остаётся рабочим: тексты, цены, корзина
}
document.body.classList.remove('is-loading');
if (renderer) init3d();

function init3d() {
  const small = matchMedia('(max-width: 900px)').matches;
  const maxDpr = small ? 1.75 : 2;
  renderer.setPixelRatio(Math.min(devicePixelRatio, maxDpr));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

  const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
  key.position.set(-3.2, 6, 4.2);
  key.castShadow = true;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -3.2, right: 3.2, top: 3.6, bottom: -2, near: 1, far: 16 });
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03; key.shadow.radius = 7;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 0.9);
  rim.position.set(4, 3, -4);
  scene.add(rim);

  /* ---------- профиль → тело вращения ---------- */
  const NB = 4, NO = 110, NL = 5, NI = 70, NF = 5;
  const NP = NB + NO + NL + NI + NF, SEG = small ? 72 : 112, W = SEG + 1;
  const FLOOR = 0.07;

  function buildProfile(prod) {
    const curve = new THREE.CatmullRomCurve3(prod.profile.map(([r, y]) => new THREE.Vector3(r, y, 0)), false, 'centripetal');
    const outer = curve.getSpacedPoints(NO - 1).map((p) => [p.x, p.y]);
    const H = outer[NO - 1][1];
    // следы пальцев: лёгкие горизонтальные борозды
    outer.forEach((p, i) => {
      const u = i / (NO - 1);
      p[0] += prod.ridges * Math.sin(p[1] * 46) * 0.55 * sstep(0.05, 0.2, u) * (1 - sstep(0.85, 0.97, u));
    });
    const tangent = (arr, i) => {
      const a = arr[Math.max(0, i - 1)], b = arr[Math.min(arr.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [dx / l, dy / l];
    };
    // внутренняя стенка: смещение по нормали, от края вниз до дна
    const inner = [];
    for (let i = NO - 1; i >= 0; i--) {
      const [tx, ty] = tangent(outer, i);
      const q = [Math.max(outer[i][0] - ty * prod.wall, 0.02), outer[i][1] + tx * prod.wall];
      if (q[1] < FLOOR) {
        const last = inner[inner.length - 1];
        if (last) { const k = (last[1] - FLOOR) / (last[1] - q[1] || 1); inner.push([lerp(last[0], q[0], k), FLOOR]); }
        break;
      }
      inner.push(q);
    }
    // равномерная передискретизация до NI точек
    const acc = [0];
    for (let i = 1; i < inner.length; i++) acc.push(acc[i - 1] + Math.hypot(inner[i][0] - inner[i - 1][0], inner[i][1] - inner[i - 1][1]));
    const total = acc[acc.length - 1], innerR = [];
    for (let k = 0, j = 0; k < NI; k++) {
      const s = (k / (NI - 1)) * total;
      while (j < acc.length - 2 && acc[j + 1] < s) j++;
      const f = (s - acc[j]) / (acc[j + 1] - acc[j] || 1);
      innerR.push([lerp(inner[j][0], inner[j + 1][0], f), lerp(inner[j][1], inner[j + 1][1], f)]);
    }
    const pts = [];
    for (let k = 0; k < NB; k++) pts.push([outer[0][0] * (k / NB), 0]);
    pts.push(...outer);
    // скруглённый край
    const top = outer[NO - 1], [tx, ty] = tangent(outer, NO - 1), q0 = innerR[0];
    const cx = (top[0] + q0[0]) / 2, cy = (top[1] + q0[1]) / 2, rad = Math.hypot(top[0] - q0[0], top[1] - q0[1]) / 2;
    for (let k = 1; k <= NL; k++) {
      const a = (Math.PI * k) / (NL + 1);
      pts.push([cx + ty * rad * Math.cos(a) + tx * rad * Math.sin(a), cy - tx * rad * Math.cos(a) + ty * rad * Math.sin(a)]);
    }
    pts.push(...innerR);
    const end = innerR[NI - 1];
    for (let k = 1; k <= NF; k++) pts.push([end[0] * (1 - k / NF), end[1]]);
    const flat = new Float32Array(NP * 2);
    pts.forEach((p, i) => { flat[i * 2] = p[0]; flat[i * 2 + 1] = p[1]; });
    return { pts: flat, H, R: Math.max(...outer.map((p) => p[0])) };
  }
  const profiles = PRODUCTS.map(buildProfile);

  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(NP * W * 3), nor = new Float32Array(NP * W * 3), col = new Float32Array(NP * W * 3), uv = new Float32Array(NP * W * 2);
  const cosA = new Float32Array(W), sinA = new Float32Array(W), wave = new Float32Array(W);
  for (let j = 0; j < W; j++) {
    const a = (j / SEG) * Math.PI * 2;
    cosA[j] = Math.cos(a); sinA[j] = Math.sin(a);
    wave[j] = 0.022 * Math.sin(a * 3 + 1) + 0.013 * Math.sin(a * 7) + 0.006 * Math.sin(a * 13 + 2);
  }
  const index = [];
  for (let i = 0; i < NP - 1; i++) for (let j = 0; j < SEG; j++) {
    const a = i * W + j, b = a + W, c = a + 1, d = b + 1;
    index.push(a, b, c, b, d, c);
  }
  for (let i = 0; i < NP; i++) for (let j = 0; j < W; j++) { uv[(i * W + j) * 2] = (j / SEG) * 5; uv[(i * W + j) * 2 + 1] = (i / NP) * 7; }
  geo.setIndex(index);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

  const cur = { pts: new Float32Array(profiles[0].pts), H: profiles[0].H, R: profiles[0].R };
  const clay = new THREE.Color('#c79b76');
  const glazeCol = new THREE.Color(glazeById(state.glaze).hex), glazeTo = glazeCol.clone();

  function writeShape() {
    const p = cur.pts;
    for (let i = 0; i < NP; i++) {
      const r = p[i * 2], y = p[i * 2 + 1];
      const a = Math.max(0, i - 1), b = Math.min(NP - 1, i + 1);
      let tx = p[b * 2] - p[a * 2], ty = p[b * 2 + 1] - p[a * 2 + 1];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const nr = ty, ny = -tx;
      for (let j = 0; j < W; j++) {
        const o = (i * W + j) * 3;
        pos[o] = r * cosA[j]; pos[o + 1] = y; pos[o + 2] = r * sinA[j];
        nor[o] = nr * cosA[j]; nor[o + 1] = ny; nor[o + 2] = nr * sinA[j];
      }
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.computeBoundingSphere();
  }
  function writeColor() {
    const p = cur.pts, dip = 0.17;
    for (let i = 0; i < NP; i++) {
      const outerWall = i >= NB && i < NB + NO, base = i < NB;
      const yN = p[i * 2 + 1] / cur.H;
      for (let j = 0; j < W; j++) {
        const m = base ? 0 : outerWall ? sstep(0, 0.03, yN - dip - wave[j]) : 1; // глазурь не доходит до дна
        const o = (i * W + j) * 3;
        col[o] = lerp(clay.r, glazeCol.r, m); col[o + 1] = lerp(clay.g, glazeCol.g, m); col[o + 2] = lerp(clay.b, glazeCol.b, m);
      }
    }
    geo.attributes.color.needsUpdate = true;
  }

  // крапинки в глазури
  const speck = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(120,95,70,${0.03 + Math.random() * 0.05})`; x.beginPath(); x.arc(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 50, 0, 7); x.fill(); }
    for (let i = 0; i < 1100; i++) { x.fillStyle = `rgba(70,45,25,${0.12 + Math.random() * 0.4})`; x.beginPath(); x.arc(Math.random() * 512, Math.random() * 512, 0.4 + Math.random() * 1.3, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  })();

  const vessel = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
    vertexColors: true, map: speck, roughness: 0.34, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.22, envMapIntensity: 0.9,
  }));
  vessel.castShadow = true; vessel.receiveShadow = true;

  // гончарный круг
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(1.55, 1.6, 0.12, 96),
    new THREE.MeshStandardMaterial({ color: 0xd6ccbb, roughness: 0.85, envMapIntensity: 0.6 }),
  );
  wheel.position.y = -0.06; wheel.receiveShadow = true; wheel.castShadow = true;
  const turn = new THREE.Group();
  turn.add(vessel, wheel);
  scene.add(turn);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.12; floor.receiveShadow = true;
  scene.add(floor);

  writeShape(); writeColor();

  /* ---------- камера ---------- */
  const frameCam = { cy: cur.H / 2, dist: 8 };
  const TAN = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  function fit(H, R, aspect) {
    const byH = (H + 0.5) / 0.55 / (2 * TAN);
    const byW = (2 * Math.max(R, 1.2)) / 0.44 / (2 * TAN * aspect);
    return Math.max(byH, byW, 6.5);
  }
  let tilt = 0, tiltTo = 0;
  function placeCamera(cy, dist) {
    const lift = 0.2 + tilt;
    camera.position.set(0, cy + dist * lift, dist * Math.sqrt(1 - Math.min(0.5, lift * lift)));
    camera.lookAt(0, cy, 0);
  }

  /* ---------- снимки для каталога и корзины ---------- */
  function snap(list) { // list: [[номер изделия, id глазури]]
    const keep = { pts: new Float32Array(cur.pts), H: cur.H, R: cur.R, col: glazeCol.clone(), rot: turn.rotation.y };
    renderer.setPixelRatio(1);
    renderer.setSize(440, 550, false);
    camera.aspect = 0.8; camera.updateProjectionMatrix();
    turn.rotation.y = 0.7;
    for (const [i, gid] of list) {
      const key = PRODUCTS[i].id + ':' + gid;
      if (thumbs[key]) continue;
      cur.pts.set(profiles[i].pts); cur.H = profiles[i].H; cur.R = profiles[i].R;
      glazeCol.set(glazeById(gid).hex);
      writeShape(); writeColor();
      placeCamera(cur.H / 2 - 0.05, Math.max(5.4, (cur.H + 0.6) / 0.62 / (2 * TAN), (2 * cur.R + 0.5) / 0.8 / (2 * TAN * 0.8)));
      renderer.render(scene, camera);
      thumbs[key] = canvas.toDataURL('image/png');
    }
    cur.pts.set(keep.pts); cur.H = keep.H; cur.R = keep.R; glazeCol.copy(keep.col); turn.rotation.y = keep.rot;
    writeShape(); writeColor();
    renderer.setPixelRatio(Math.min(devicePixelRatio, maxDpr));
    resize();
    placeCamera(frameCam.cy, frameCam.dist);
    renderer.render(scene, camera);
  }
  scene3d.snap = (i, gid) => snap([[i, gid]]);
  snap([
    ...PRODUCTS.map((p, i) => [i, p.glaze]),
    ...state.cart.map((it) => [PRODUCTS.indexOf(productById(it.id)), it.glaze]),
  ]);
  PRODUCTS.forEach((p) => {
    const img = document.querySelector('img[data-thumb="' + p.id + '"]');
    if (img) { img.src = thumbs[p.id + ':' + p.glaze]; img.alt = p.type + ' «' + p.name + '», глазурь ' + glazeById(p.glaze).name; img.hidden = false; }
  });
  renderCart();

  /* ---------- размер ---------- */
  function resize() {
    const w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(view);
  resize();
  frameCam.dist = fit(cur.H, cur.R, camera.aspect);
  frameCam.cy = cur.H / 2;

  /* ---------- смена формы и глазури ---------- */
  const morph = { from: new Float32Array(NP * 2), to: profiles[0], t: 1, H0: cur.H, R0: cur.R };
  scene3d.setProduct = (i, instant) => {
    morph.from.set(cur.pts); morph.H0 = cur.H; morph.R0 = cur.R;
    morph.to = profiles[i];
    morph.t = instant || reduceMotion ? 0.9999 : 0;
  };
  let colorDirty = false;
  scene3d.setGlaze = (id, instant) => {
    glazeTo.set(glazeById(id).hex);
    if (instant || reduceMotion) glazeCol.copy(glazeTo);
    colorDirty = true;
  };

  /* ---------- вращение рукой ---------- */
  let vel = 0.35, dragging = false, lastX = 0, lastY = 0, lastT = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY; lastT = performance.now();
    canvas.classList.add('is-drag');
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const now = performance.now(), dx = e.clientX - lastX, dy = e.clientY - lastY, dt = Math.max(8, now - lastT) / 1000;
    turn.rotation.y += dx * 0.0085;
    vel = clamp((dx * 0.0085) / dt, -9, 9);
    if (e.pointerType === 'mouse') tiltTo = clamp(tiltTo + dy * 0.0012, -0.12, 0.22);
    lastX = e.clientX; lastY = e.clientY; lastT = now;
    if (Math.abs(dx) > 2) document.body.classList.add('has-dragged');
  });
  const endDrag = () => { dragging = false; canvas.classList.remove('is-drag'); };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  /* ---------- кадр ---------- */
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(view);
  const clock = new THREE.Clock();
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!visible || document.hidden) return;

    // перелепка: профиль перетекает, круг разгоняется
    let spin = 0;
    if (morph.t < 1) {
      morph.t = Math.min(1, morph.t + dt / 1.05);
      const k = ease(morph.t), a = morph.from, b = morph.to.pts, c = cur.pts;
      for (let i = 0; i < c.length; i++) c[i] = a[i] + (b[i] - a[i]) * k;
      cur.H = lerp(morph.H0, morph.to.H, k); cur.R = lerp(morph.R0, morph.to.R, k);
      spin = Math.sin(Math.PI * morph.t) * 9;
      writeShape(); colorDirty = true;
    }
    if (colorDirty) {
      glazeCol.lerp(glazeTo, 1 - Math.exp(-dt * 6));
      const done = Math.abs(glazeCol.r - glazeTo.r) + Math.abs(glazeCol.g - glazeTo.g) + Math.abs(glazeCol.b - glazeTo.b) < 0.002;
      if (done) glazeCol.copy(glazeTo);
      writeColor();
      colorDirty = !done || morph.t < 1;
    }

    if (!dragging) {
      vel = lerp(vel, reduceMotion ? 0 : 0.35, 1 - Math.exp(-dt * 1.6));
      turn.rotation.y += (vel + spin) * dt;
      tiltTo = lerp(tiltTo, 0, 1 - Math.exp(-dt * 0.8));
    }
    tilt = lerp(tilt, tiltTo, 1 - Math.exp(-dt * 6));

    const k = 1 - Math.exp(-dt * 4);
    frameCam.dist = lerp(frameCam.dist, fit(cur.H, cur.R, camera.aspect), k);
    frameCam.cy = lerp(frameCam.cy, cur.H / 2 - 0.12, k);
    placeCamera(frameCam.cy, frameCam.dist);
    renderer.render(scene, camera);
  }
  frame();
}

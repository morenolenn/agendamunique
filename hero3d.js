// Munique no inverno, em 3D low-poly, no fundo do hero: Frauenkirche, Alter Peter, Neues Rathaus com a feirinha
// de Natal, Theatinerkirche e Olympiaturm, casario com janelas acesas, pinheiros com neve, neve caindo e uma
// estrada sinuosa com vans, bicicletas e gente a pé. Anda devagar e dobra de velocidade enquanto a página rola.
import * as THREE from "/vendor/three.module.min.js";

// Celular: menos resolução, sombra mais simples e menos flocos, para não pesar nem gastar bateria
const small = innerWidth < 720;

const hero = document.querySelector(".hero");
const canvas = document.createElement("canvas");
canvas.className = "city3d";
canvas.setAttribute("aria-hidden", "true");
hero.insertBefore(canvas, hero.firstChild);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(small ? 1.5 : 2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const HAZE = 0xd9d3f3; // lilás claro do horizonte, igual ao fim do degradê do céu no CSS
scene.fog = new THREE.Fog(HAZE, 100, 300);
const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 4000);

// Luz de fim de tarde de inverno: céu azul-lilás de cima, sol baixo e quente vindo da esquerda
scene.add(new THREE.HemisphereLight(0xd5dcff, 0x6b62c4, 1.45));
const sun = new THREE.DirectionalLight(0xffe0c2, 1.7);
sun.castShadow = true;
sun.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 60, bottom: -60, near: 1, far: 260 });
sun.shadow.radius = 3;
sun.shadow.bias = -0.0006;
scene.add(sun, sun.target);

const mats = {};
function mat(color) {
  return mats[color] || (mats[color] = new THREE.MeshLambertMaterial({ color, flatShading: true }));
}
const glows = {};
function glow(color) { return glows[color] || (glows[color] = new THREE.MeshBasicMaterial({ color })); }
// Pessoas e bicicletas com superfície lisa; o cenário fica facetado, no estilo low-poly
const smooths = {};
function smooth(root) {
  root.traverse((o) => {
    if (!o.isMesh || o.material.isMeshBasicMaterial) return;
    const c = o.material.color.getHex();
    o.material = smooths[c] || (smooths[c] = new THREE.MeshLambertMaterial({ color: c }));
  });
  return root;
}
function mesh(geo, color, x = 0, y = 0, z = 0, parent = scene) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(w, h, d, color, x, y, z, parent) { return mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, parent); }
function group(x = 0, y = 0, z = 0, parent = scene) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
// Prisma triangular deitado ao longo de z, com o pico para cima: telhados
function roof(width, len, pitch = 1) {
  const r = width / Math.sqrt(3);
  const geo = new THREE.CylinderGeometry(r, r, len, 3);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, r / 2, 0);
  geo.scale(1, pitch, 1);
  return geo;
}
// Cúpula em forma de cebola (as "Welsche Hauben" da Frauenkirche e do Alter Peter)
function onion(s) {
  const p = [[1.0, 0], [1.12, 0.35], [1.1, 0.9], [0.85, 1.45], [0.5, 1.85], [0.28, 2.1], [0.32, 2.35], [0.2, 2.7], [0.1, 3.1], [0.02, 3.4]];
  return new THREE.LatheGeometry(p.map(([r, y]) => new THREE.Vector2(r * s, y * s)), 12);
}
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const C = {
  snow: 0xe6e8fb, mound: 0xd9dcf8, road: 0xb3b6ea, roofSnow: 0xf4f5ff,
  pine: 0x3b3aa6, pine2: 0x2e2d8e, wall: 0x6670c9, wall2: 0x515bb3, wall3: 0x7b84d6, warm: 0xe8a065, ochre: 0xe7a95e,
  church: 0x5960b6, dome: 0x5b78c9, slate: 0x3c3f8e, tower: 0xd4d8f6, lampPost: 0x2b2c66, winLit: 0xffd28a, winDark: 0x2c2f72,
  dark: 0x1d2a1a, white: 0xffffff, stone: 0xe2d9bf, cream: 0xf3ead2, coral: 0xf58a74, yellow: 0xf7d84a, blue: 0x8fbaf7,
  skin: 0xf2c9a0, wood: 0x9a6a43,
};

// --- Janelas: guardadas aqui e desenhadas no fim como duas instâncias (acesas e apagadas) ---
const wins = [];
function win(parent, x, y, z, w = 0.34, h = 0.48) { wins.push({ parent, x, y, z, w, h, lit: rnd() < 0.62 }); }
function winGrid(parent, x0, x1, y0, y1, z, cols, rows) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    win(parent, x0 + ((x1 - x0) * (c + 0.5)) / cols, y0 + ((y1 - y0) * (r + 0.5)) / rows, z);
}

// --- Chão de neve, montinhos e a estrada ---
const ground = mesh(new THREE.CircleGeometry(3000, 64), C.snow);
ground.rotation.x = -Math.PI / 2;
ground.castShadow = false;
function mound(x, z, r, h, color = C.mound) {
  const m = mesh(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), color, x, -0.05, z);
  m.scale.y = h / r;
}
const road = new THREE.CatmullRomCurve3([
  [-170, 22], [-70, 17], [-30, 11], [-8, 5], [10, 8], [26, 3], [42, -4], [80, -12], [170, -16],
].map(([x, z]) => new THREE.Vector3(x, 0, z)));
const ROAD_LEN = road.getLength();
(function ribbon() {
  const pts = road.getSpacedPoints(500), pos = [], idx = [];
  pts.forEach((p, i) => {
    const t = road.getTangentAt(i / 500), nx = -t.z, nz = t.x, w = 1.5;
    pos.push(p.x + nx * w, 0.04, p.z + nz * w, p.x - nx * w, 0.04, p.z - nz * w);
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat(C.road));
  m.receiveShadow = true;
  scene.add(m);
})();
// distância de um ponto à estrada, para não plantar árvores em cima dela
const roadPts = road.getSpacedPoints(400);
function nearRoad(x, z, gap) { return roadPts.some((p) => Math.abs(p.x - x) < gap && Math.abs(p.z - z) < gap && Math.hypot(p.x - x, p.z - z) < gap); }

// --- Pinheiros com neve: quatro instâncias para todos (três andares e a ponta branca) ---
const trees = [];
function pine(x, z, s) { trees.push([x, z, s]); }
function plantTrees() {
  const parts = [
    [new THREE.ConeGeometry(1.6, 2.6, 7), C.pine2, 1.5], [new THREE.ConeGeometry(1.25, 2.2, 7), C.pine, 2.8],
    [new THREE.ConeGeometry(0.85, 1.8, 7), C.pine2, 3.9], [new THREE.ConeGeometry(0.42, 0.75, 7), C.roofSnow, 4.55],
  ];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  parts.forEach(([geo, color, y]) => {
    const inst = new THREE.InstancedMesh(geo, mat(color), trees.length);
    trees.forEach(([x, z, s], i) => {
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, x * 1.3 + z);
      inst.setMatrixAt(i, m.compose(v.set(x, y * s, z), q, sc.set(s, s, s)));
    });
    inst.castShadow = true;
    inst.receiveShadow = true;
    scene.add(inst);
  });
}

// --- Casario: paredes coloridas, telhado com neve, janelas acesas ---
function house(x, z, w, d, h, ry, wall, ridgeX) {
  const g = group(x, 0, z);
  g.rotation.y = ry;
  box(w, h, d, wall, 0, h / 2, 0, g);
  const r = ridgeX ? mesh(roof(d * 1.08, w * 1.06, 0.9), C.roofSnow, 0, h, 0, g) : mesh(roof(w * 1.08, d * 1.06, 1.1), C.roofSnow, 0, h, 0, g);
  if (ridgeX) r.rotation.y = Math.PI / 2;
  box(w * 1.02, 0.18, d * 1.02, C.slate, 0, h - 0.05, 0, g); // beiral escuro sob a neve
  if (rnd() < 0.5) box(0.45, 1.3, 0.45, C.wall2, w * 0.25, h + 0.9, -d * 0.15, g); // chaminé
  winGrid(g, -w / 2 + 0.4, w / 2 - 0.4, 0.9, h - 0.6, d / 2 + 0.03, Math.max(1, Math.floor((w - 0.6) / 1.05)), Math.max(1, Math.floor((h - 1.2) / 1.25)));
  return g;
}

// --- Monumentos ---
function frauenkirche(x, z) {
  const g = group(x, 0, z);
  for (const sx of [-2.0, 2.0]) {
    box(2.7, 12.5, 2.7, C.church, sx, 6.25, 0, g);
    mesh(new THREE.CylinderGeometry(1.32, 1.42, 3, 8), C.church, sx, 14, 0, g);
    mesh(new THREE.CylinderGeometry(1.58, 1.58, 0.28, 8), C.slate, sx, 15.55, 0, g);
    mesh(onion(1.3), C.dome, sx, 15.65, 0, g);
    mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 4), C.slate, sx, 20.4, 0, g);
    const clock = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 14), C.tower, sx, 14.1, 1.3, g);
    clock.rotation.x = Math.PI / 2;
    for (let k = 0; k < 3; k++) win(g, sx, 3 + k * 3, 1.38, 0.32, 1.3);
  }
  box(1.3, 9, 2.4, C.church, 0, 4.5, -0.1, g); // fachada entre as torres
  win(g, 0, 6.5, 1.12, 0.6, 2.2);
  box(8.6, 10, 17, C.church, 0, 5, -9.6, g); // nave
  mesh(roof(9.2, 17.4, 1.15), C.slate, 0, 10, -9.6, g);
  mesh(roof(9.3, 17.5, 1.15), C.roofSnow, 0, 10.02, -9.6, g).scale.set(1, 0.35, 1);
  for (let k = 0; k < 6; k++) { win(g, 4.32, 5, -3 - k * 2.6, 0.5, 4.5); }
}
function alterPeter(x, z) {
  const g = group(x, 0, z);
  box(2.3, 14, 2.3, C.wall3, 0, 7, 0, g);
  mesh(new THREE.CylinderGeometry(1.15, 1.25, 1.5, 8), C.wall3, 0, 14.75, 0, g);
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.SphereGeometry(0.3, 8, 6), C.dome, cx * 1.05, 14.3, cz * 1.05, g);
  mesh(onion(1.0), C.dome, 0, 15.5, 0, g);
  mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.9, 8), C.wall3, 0, 18.3, 0, g);
  mesh(onion(0.45), C.dome, 0, 18.75, 0, g);
  const clock = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 14), C.tower, 0, 12.5, 1.17, g);
  clock.rotation.x = Math.PI / 2;
  box(4.4, 6.5, 9, C.wall, 0, 3.25, -5.6, g);
  mesh(roof(4.8, 9.2), C.roofSnow, 0, 6.5, -5.6, g);
  win(g, 0, 8, 1.17, 0.35, 1.2);
}
function rathaus(x, z) {
  const g = group(x, 0, z);
  box(14, 7.5, 4.5, C.wall2, 0, 3.75, 0, g);
  mesh(roof(4.8, 14.3, 0.9), C.roofSnow, 0, 7.5, 0, g).rotation.y = Math.PI / 2;
  for (let i = 0; i <= 10; i++) mesh(new THREE.ConeGeometry(0.22, 1.4, 4), C.wall2, -6.9 + i * 1.38, 8.2, 2.25, g);
  for (const sx of [-4.5, 4.5]) { box(2.6, 9.5, 1, C.wall2, sx, 4.75, 2.2, g); mesh(new THREE.ConeGeometry(1.5, 2.6, 4), C.slate, sx, 10.8, 2.2, g).rotation.y = Math.PI / 4; }
  winGrid(g, -6.5, 6.5, 1, 7, 2.28, 10, 4);
  box(2.4, 17, 2.4, C.wall2, 0, 8.5, 1.4, g);
  mesh(new THREE.CylinderGeometry(1.15, 1.25, 2.2, 8), C.wall2, 0, 18.1, 1.4, g);
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(new THREE.ConeGeometry(0.2, 1.6, 4), C.wall2, cx * 1.15, 17.8, 1.4 + cz * 1.15, g);
  mesh(new THREE.ConeGeometry(1.25, 5.5, 8), C.slate, 0, 21.95, 1.4, g);
  const clock = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 14), C.tower, 0, 14.5, 2.62, g);
  clock.rotation.x = Math.PI / 2;
  winGrid(g, -0.7, 0.7, 9, 13, 2.62, 1, 3);
}
function theatiner(x, z) {
  const g = group(x, 0, z);
  box(7, 8, 1.4, C.ochre, 0, 4, 0, g);
  mesh(roof(7.2, 1.6, 0.6), C.ochre, 0, 8, 0, g).rotation.y = Math.PI / 2;
  box(6, 7, 11, C.ochre, 0, 3.5, -6, g);
  mesh(roof(6.4, 11.2), C.roofSnow, 0, 7, -6, g);
  for (const sx of [-4.2, 4.2]) {
    box(1.9, 11, 1.9, C.ochre, sx, 5.5, -0.2, g);
    mesh(new THREE.CylinderGeometry(0.9, 0.95, 1.5, 8), C.ochre, sx, 11.75, -0.2, g);
    const cap = mesh(new THREE.SphereGeometry(1.0, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), C.slate, sx, 12.5, -0.2, g);
    cap.scale.y = 1.3;
    mesh(new THREE.ConeGeometry(0.18, 1.0, 6), C.slate, sx, 14.2, -0.2, g);
  }
  mesh(new THREE.CylinderGeometry(2.2, 2.3, 3, 12), C.ochre, 0, 8.5, -7, g);
  mesh(new THREE.SphereGeometry(2.35, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), C.slate, 0, 10, -7, g);
  mesh(new THREE.CylinderGeometry(0.45, 0.5, 1.2, 8), C.ochre, 0, 12.8, -7, g);
  mesh(new THREE.ConeGeometry(0.5, 0.9, 8), C.slate, 0, 13.85, -7, g);
  winGrid(g, -2.8, 2.8, 1.5, 6.5, 0.73, 3, 2);
}
function olympiaturm(x, z) {
  const g = group(x, 0, z);
  mesh(new THREE.CylinderGeometry(0.45, 0.75, 26, 10), C.tower, 0, 13, 0, g);
  [[2.5, 2.1, 0.9, 22.4], [1.7, 1.7, 0.8, 23.25], [2.2, 1.8, 0.9, 24.1], [1.3, 1.3, 0.8, 24.95]].forEach(([a, b, h, y]) =>
    mesh(new THREE.CylinderGeometry(a, b, h, 14), C.tower, 0, y, 0, g));
  mesh(new THREE.CylinderGeometry(0.14, 0.25, 9, 6), C.tower, 0, 29.8, 0, g);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; wins.push({ parent: g, x: Math.sin(a) * 2.2, y: 22.4, z: Math.cos(a) * 2.2, w: 0.6, h: 0.3, lit: true, fixed: true }); }
}
function spire(x, z, h, color = C.wall3) {
  const g = group(x, 0, z);
  box(1.6, h, 1.6, color, 0, h / 2, 0, g);
  mesh(new THREE.ConeGeometry(1.15, 4.5, 4), C.slate, 0, h + 2.25, 0, g).rotation.y = Math.PI / 4;
  box(3.5, h * 0.45, 7, color, 0, h * 0.225, -4.5, g);
  mesh(roof(3.8, 7.2), C.roofSnow, 0, h * 0.45, -4.5, g);
}
function lamp(x, z) {
  const g = group(x, 0, z);
  mesh(new THREE.CylinderGeometry(0.07, 0.1, 3.2, 6), C.lampPost, 0, 1.6, 0, g);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), glow(0xfff0c4));
  b.position.y = 3.3;
  g.add(b);
}
// Feirinha de Natal na frente do Rathaus: barraquinhas com luzes e uma árvore enfeitada
function stall(x, z, ry) {
  const g = group(x, 0, z);
  g.rotation.y = ry;
  box(2.6, 1.7, 1.7, 0xb9784c, 0, 0.85, 0, g);
  mesh(roof(2.1, 3.1), C.roofSnow, 0, 1.7, 0, g).rotation.y = Math.PI / 2;
  box(2.8, 0.15, 0.5, C.wood, 0, 1.05, 0.95, g);
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), glow([0xffd28a, 0xffffff, 0xff9d7a][i % 3]));
    b.position.set(-1.25 + i * 0.42, 1.62 - Math.sin((i / 6) * Math.PI) * 0.13, 1.08);
    g.add(b);
  }
}
function xmasTree(x, z) {
  const g = group(x, 0, z);
  [[2.2, 3, 1.6], [1.7, 2.6, 3.4], [1.1, 2.2, 5.0]].forEach(([r, h, y]) => mesh(new THREE.ConeGeometry(r, h, 8), C.pine2, 0, y, 0, g));
  for (let i = 0; i < 26; i++) {
    const y = 0.8 + rnd() * 5.2, r = 2.1 * (1 - (y - 0.4) / 6.6) + 0.1, a = rnd() * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), glow(i % 4 ? 0xffd28a : 0xff9d7a));
    b.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
    g.add(b);
  }
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), glow(C.yellow));
  star.position.y = 6.5;
  g.add(star);
}

// --- Montagem da cidade ---
theatiner(-25, -12);
frauenkirche(-10, -15);
alterPeter(3, -22);
rathaus(14, -12);
olympiaturm(31, -36);
spire(-31, -26, 9);
spire(23, -26, 8, C.wall);
xmasTree(14, -5);
stall(9, -5.5, 0.2); stall(19, -5.5, -0.2); stall(11.5, -2.5, 0.05); stall(16.8, -2.6, -0.05);

const keepOut = [[-30, -20, -21, -10], [-15.5, -4.5, -34, -12], [0, 6, -33, -20], [6, 22, -15, -9], [6, 22, -9, 0], [28, 34, -39, -33]];
for (const z of [-6, -11, -18, -25, -31, -38]) {
  for (let x = -33; x < 44; x += 4.4 + rnd() * 1.6) {
    const w = 3 + rnd() * 2, d = 3.5 + rnd() * 2.5, h = 3.2 + rnd() * 3.2;
    if (keepOut.some(([x0, x1, z0, z1]) => x + w / 2 > x0 && x - w / 2 < x1 && z + d / 2 > z0 && z - d / 2 < z1)) continue;
    if (nearRoad(x, z, 4)) continue;
    const wall = [C.wall, C.wall2, C.wall3, C.warm, C.wall, C.wall2][Math.floor(rnd() * 6)];
    house(x, z + (rnd() - 0.5) * 1.5, w, d, h, (rnd() - 0.5) * 0.3, wall, rnd() < 0.45);
  }
}

// pinheiros: no meio da cidade, na frente, dos lados e uma linha de floresta ao fundo
for (let i = 0; i < 22; i++) { const x = -32 + rnd() * 76, z = -4 + rnd() * 3; if (!nearRoad(x, z, 3) && !(x > 6 && x < 22)) pine(x, z, 0.7 + rnd() * 0.4); }
// na frente, poucos e nas laterais, para a estrada e a cidade aparecerem
for (let i = 0; i < 34; i++) {
  const x = -24 + rnd() * 90, z = 8 + rnd() * 26;
  if (nearRoad(x, z, 3.4) || (x > -12 && x < 34 && z < 20)) continue;
  pine(x, z, 0.8 + rnd() * 0.8);
}
// linha de floresta ao fundo, só do meio da tela para a direita (à esquerda fica só a neve, embaixo do texto)
for (let x = -60; x < 220; x += 2.6 + rnd() * 2.5) pine(x, -48 - rnd() * 18, 0.9 + rnd() * 0.9);
for (let i = 0; i < 40; i++) { const x = 45 + rnd() * 50, z = -30 + rnd() * 25; pine(x, z, 0.8 + rnd() * 0.9); }
plantTrees();
// Alpes no horizonte, ao sul da cidade: picos low-poly com neve no alto, bem longe,
// tão longe que a névoa já apagou a neve: a base deles cai na linha do horizonte. Ficam fora da névoa, com cores já clareadas, para parecerem
// distantes sem sumir; mais baixos à esquerda, onde fica o texto
(function alps() {
  // Cor quase toda "emissiva" (constante) e pouca luz: as faces quase não mudam de tom, como montanha vista de muito longe
  const faint = (color, glow) => new THREE.MeshLambertMaterial({ color, emissive: glow, flatShading: true, fog: false });
  const rock = faint(0x2a2a4a, 0xaeaee0), rock2 = faint(0x2a2a4a, 0xb4b4e4), snow = faint(0x30303c, 0xcfd0f2);
  // quando a cidade fica embaixo do texto (até 1000px), os picos ficam mais baixos para não subir atrás do botão
  for (let x = -330; x < 1500; x += 60 + rnd() * 80) {
    const far = rnd() < 0.5, z = (far ? -1080 : -980) - rnd() * 60;
    const side = Math.min(1, Math.max(0.35, (x + 330) / 450)); // mais baixos na ponta esquerda
    const h = (26 + rnd() * 28) * side * (far ? 1.15 : 1) * (innerWidth < 1000 ? 0.6 : 1), r = h * (0.85 + rnd() * 0.35);
    const g = group(x, 0, z), seg = 5 + Math.floor(rnd() * 2), turn = rnd() * Math.PI;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), far ? rock2 : rock);
    peak.position.y = h / 2; peak.rotation.y = turn; g.add(peak);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.36, h * 0.36, seg), snow);
    cap.position.y = h - h * 0.18 + 0.05; cap.rotation.y = turn; cap.scale.set(1.04, 1, 1.04); g.add(cap);
    if (rnd() < 0.6) { // um pico menor encostado, para a serra não parecer uma fileira de cones
      const h2 = h * (0.5 + rnd() * 0.25), r2 = h2 * 0.95, dx = (rnd() < 0.5 ? -1 : 1) * r * 0.75;
      const p2 = new THREE.Mesh(new THREE.ConeGeometry(r2, h2, seg), far ? rock2 : rock);
      p2.position.set(dx, h2 / 2, 30); p2.rotation.y = turn + 1; g.add(p2);
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(r2 * 0.32, h2 * 0.32, seg), snow);
      c2.position.set(dx, h2 - h2 * 0.16 + 0.05, 30); c2.rotation.y = turn + 1; c2.scale.set(1.04, 1, 1.04); g.add(c2);
    }
  }
})();
[[22, 16, 9, 2.2], [40, 12, 11, 2.8], [-18, 18, 8, 1.6], [52, -2, 10, 3], [6, 24, 7, 1.4], [-40, -40, 22, 6], [10, -46, 26, 7], [60, -40, 24, 6]]
  .forEach(([x, z, r, h]) => mound(x, z, r, h));
// postes ao longo da estrada, do lado de dentro da curva
for (let u = 0.32; u < 0.66; u += 0.022) {
  const p = road.getPointAt(u), t = road.getTangentAt(u);
  lamp(p.x - t.z * 2.4, p.z + t.x * 2.4);
}
// luzinhas brancas espalhadas na neve
(function dots() {
  const geo = new THREE.SphereGeometry(0.12, 6, 4);
  const inst = new THREE.InstancedMesh(geo, glow(0xfff6dc), 220);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 220; i++) {
    let x, z;
    do { x = -30 + rnd() * 85; z = -2 + rnd() * 30; } while (nearRoad(x, z, 2));
    inst.setMatrixAt(i, m.makeTranslation(x, 0.14, z));
  }
  scene.add(inst);
})();
// todas as janelas de uma vez
// Uma instância só, com a cor de cada janela; assim dá para acender e apagar uma de cada vez
const LIT = new THREE.Color(C.winLit), OFF = new THREE.Color(C.winDark);
const winInst = (function windows() {
  scene.updateMatrixWorld(true);
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 0.06), new THREE.MeshBasicMaterial({ color: 0xffffff }), wins.length);
  const m = new THREE.Matrix4(), l = new THREE.Matrix4();
  wins.forEach((w, i) => {
    inst.setMatrixAt(i, m.multiplyMatrices(w.parent.matrixWorld, l.makeScale(w.w, w.h, 1).setPosition(w.x, w.y, w.z)));
    inst.setColorAt(i, w.lit ? LIT : OFF);
  });
  scene.add(inst);
  return inst;
})();
// Moradores chegando e saindo: de tempos em tempos uma janela acende ou apaga, mantendo uns 60% acesas
let nextFlip = 2;
function flipWindow() {
  const i = Math.floor(Math.random() * wins.length), w = wins[i];
  if (w.fixed) return;
  const litShare = wins.filter((x) => x.lit).length / wins.length;
  if ((w.lit && litShare < 0.55) || (!w.lit && litShare > 0.68)) return;
  w.lit = !w.lit;
  winInst.setColorAt(i, w.lit ? LIT : OFF);
  winInst.instanceColor.needsUpdate = true;
}

// --- Neve caindo ---
const FLAKES = small ? 700 : 1600;
const flakes = (function () {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const x = c.getContext("2d"), gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(255,255,255,.8)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
  const pos = new Float32Array(FLAKES * 3);
  for (let i = 0; i < FLAKES; i++) { pos[i * 3] = -90 + rnd() * 180; pos[i * 3 + 1] = rnd() * 50; pos[i * 3 + 2] = -50 + rnd() * 90; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.45, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false }));
  scene.add(p);
  return p;
})();

// --- Gente passeando ---
function person(shirt, pants, kid, hair = C.wood) {
  const root = new THREE.Group();
  const body = group(0, 0, 0, root);
  if (kid) body.scale.setScalar(0.68);
  const legs = [];
  for (const sx of [-0.12, 0.12]) {
    const hip = group(sx, 0.9, 0, body);
    mesh(new THREE.CapsuleGeometry(0.09, 0.62, 4, 8), pants, 0, -0.4, 0, hip);
    mesh(new THREE.CapsuleGeometry(0.07, 0.12, 4, 8), C.dark, 0, -0.82, 0.07, hip).rotation.x = Math.PI / 2;
    legs.push(hip);
  }
  mesh(new THREE.CapsuleGeometry(0.24, 0.5, 4, 10), shirt, 0, 1.3, 0, body);
  mesh(new THREE.SphereGeometry(0.21, 14, 12), C.skin, 0, 1.95, 0.02, body);
  mesh(new THREE.SphereGeometry(0.225, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.2), hair, 0, 1.98, -0.01, body);
  const arms = [];
  for (const sx of [-0.3, 0.3]) {
    const sh = group(sx, 1.6, 0, body);
    mesh(new THREE.CapsuleGeometry(0.075, 0.5, 4, 8), shirt, 0, -0.3, 0, sh);
    mesh(new THREE.SphereGeometry(0.075, 8, 6), C.skin, 0, -0.62, 0, sh);
    arms.push(sh);
  }
  root.userData.step = (ph) => {
    const a = Math.sin(ph) * 0.55;
    legs[0].rotation.x = a; legs[1].rotation.x = -a;
    arms[0].rotation.x = -a * 0.7; arms[1].rotation.x = a * 0.7;
    body.position.y = Math.abs(Math.cos(ph)) * 0.04;
  };
  return root;
}
// Peça cilíndrica (ou cápsula) presa entre dois pontos; usada no quadro da bicicleta e nos braços e pernas
const UP = new THREE.Vector3(0, 1, 0);
function place(m, a, b, stretch) {
  const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  if (stretch) m.scale.set(1, len, 1);
}
function tube(parent, color, r, a, b) {
  const m = mesh(new THREE.CylinderGeometry(r, r, 1, 8), color, 0, 0, 0, parent);
  place(m, a, b, true);
  return m;
}
function limb(parent, color, r, len) { return mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 4, 8), color, 0, 0, 0, parent); }
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Bicicleta e ciclista, de frente para +z. Rodas de raio 0,45; o pedal gira e as pernas dobram no joelho para acompanhar
function cyclist(shirt, frame) {
  const root = new THREE.Group();
  const WR = 0.45, R = V(0, WR, -0.72), F = V(0, WR, 0.72), BB = V(0, 0.42, -0.04);
  const S = V(0, 1.1, -0.3), H = V(0, 1.12, 0.5), HB = V(0, 0.9, 0.56), BAR = V(0, 1.24, 0.46);
  const wheels = [];
  for (const c of [R, F]) {
    const w = group(c.x, c.y, c.z, root);
    const tire = mesh(new THREE.TorusGeometry(WR, 0.045, 8, 28), C.dark, 0, 0, 0, w);
    tire.rotation.y = Math.PI / 2;
    const rim = mesh(new THREE.TorusGeometry(WR - 0.05, 0.015, 4, 28), C.stone, 0, 0, 0, w);
    rim.rotation.y = Math.PI / 2;
    for (let i = 0; i < 4; i++) { const sp = mesh(new THREE.BoxGeometry(0.012, (WR - 0.05) * 2, 0.012), C.stone, 0, 0, 0, w); sp.rotation.x = (i * Math.PI) / 4; sp.castShadow = false; }
    const hub = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), C.dark, 0, 0, 0, w);
    hub.rotation.z = Math.PI / 2;
    wheels.push(w);
  }
  const t = 0.04;
  tube(root, frame, t, R, BB); tube(root, frame, t, R, S); tube(root, frame, t, BB, S);
  tube(root, frame, t, S, H); tube(root, frame, t * 1.1, BB, HB); tube(root, frame, t * 1.2, HB, H);
  tube(root, frame, t, HB, F); tube(root, C.dark, 0.03, S, V(0, 1.2, -0.33)); tube(root, C.dark, 0.035, H, BAR);
  tube(root, C.dark, 0.03, V(-0.26, 1.24, 0.46), V(0.26, 1.24, 0.46));
  const saddle = mesh(new THREE.BoxGeometry(0.16, 0.06, 0.32), C.dark, 0, 1.23, -0.33, root);
  saddle.rotation.x = 0.05;
  const crank = group(BB.x, BB.y, BB.z, root);
  mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 12), C.stone, 0.06, 0, 0, crank).rotation.z = Math.PI / 2;

  // ciclista
  const hipY = 1.27, hipZ = -0.3;
  const torso = limb(root, shirt, 0.19, 0.78);
  const shoulder = V(0, 1.78, 0.12);
  place(torso, V(0, hipY, hipZ), shoulder);
  const neck = shoulder.clone().add(V(0, 0.14, 0.1));
  mesh(new THREE.SphereGeometry(0.19, 12, 10), C.skin, 0, neck.y + 0.12, neck.z + 0.05, root);
  const helmet = mesh(new THREE.SphereGeometry(0.215, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), frame, 0, neck.y + 0.15, neck.z + 0.03, root);
  helmet.rotation.x = 0.35;
  for (const sx of [-1, 1]) {
    const sh = V(sx * 0.2, 1.72, 0.1), hand = V(sx * 0.24, 1.25, 0.46), el = V(sx * 0.27, 1.45, 0.36);
    place(limb(root, shirt, 0.07, sh.distanceTo(el)), sh, el);
    place(limb(root, C.skin, 0.06, el.distanceTo(hand)), el, hand);
    mesh(new THREE.SphereGeometry(0.075, 8, 6), C.skin, hand.x, hand.y, hand.z, root);
  }
  const shorts = mesh(new THREE.CapsuleGeometry(0.15, 0.14, 4, 10), C.dark, 0, hipY, hipZ - 0.02, root); // bermuda
  shorts.rotation.z = Math.PI / 2;
  const L1 = 0.52, L2 = 0.52, CR = 0.17;
  const legs = [-1, 1].map((sx) => {
    const thigh = limb(root, C.dark, 0.085, L1), shin = limb(root, C.skin, 0.07, L2);
    const shoe = mesh(new THREE.BoxGeometry(0.11, 0.08, 0.24), C.dark, 0, 0, 0, root);
    const arm = mesh(new THREE.BoxGeometry(0.03, 0.03, CR), C.stone, 0, 0, 0, root);
    return { sx, thigh, shin, shoe, arm };
  });
  smooth(root);
  root.userData.step = (ph) => {
    wheels.forEach((w) => { w.rotation.x = ph; });
    crank.rotation.x = ph * 0.45;
    legs.forEach((l, i) => {
      const a = ph * 0.45 + i * Math.PI, x = l.sx * 0.14;
      const pedal = V(x, BB.y - Math.sin(a) * CR, BB.z + Math.cos(a) * CR);
      place(l.arm, V(x, BB.y, BB.z), pedal);
      l.shoe.position.copy(pedal).add(V(0, 0.05, 0.03));
      // joelho por triângulo: coxa e canela de mesmo tamanho, joelho sempre para a frente
      const hip = V(l.sx * 0.11, hipY, hipZ), d = Math.min(hip.distanceTo(pedal), L1 + L2 - 0.001);
      const mid = hip.clone().lerp(pedal, 0.5), h = Math.sqrt(Math.max(0, L1 * L1 - (d / 2) * (d / 2)));
      const dir = new THREE.Vector3().subVectors(pedal, hip).normalize();
      const perp = V(0, dir.z, -dir.y); if (perp.z < 0) perp.negate();
      const knee = mid.addScaledVector(perp, h);
      place(l.thigh, hip, knee); place(l.shin, knee, pedal);
    });
  };
  return root;
}
function dog() {
  const root = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.3, 0.3, 0.7), C.wood, 0, 0.45, 0, root);
  mesh(new THREE.BoxGeometry(0.28, 0.28, 0.32), C.wood, 0, 0.7, 0.42, root);
  const legs = [];
  for (const [x, z] of [[-0.1, 0.25], [0.1, 0.25], [-0.1, -0.25], [0.1, -0.25]]) {
    const l = group(x, 0.35, z, root);
    mesh(new THREE.BoxGeometry(0.08, 0.35, 0.08), C.wood, 0, -0.17, 0, l);
    legs.push(l);
  }
  root.userData.step = (ph) => legs.forEach((l, i) => { l.rotation.x = Math.sin(ph * 1.5 + (i % 2) * Math.PI) * 0.5; });
  return root;
}
function balloonKid() {
  const kid = person(C.yellow, C.blue, true);
  const b = mesh(new THREE.SphereGeometry(0.3, 10, 8), C.coral, 0.35, 2.4, 0, kid);
  b.scale.y = 1.2;
  mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.3, 3), C.dark, 0.32, 1.6, 0, kid);
  return kid;
}

// Van de entrega, de frente para +z, com faróis acesos
function van(color) {
  const root = new THREE.Group();
  box(2.1, 1.9, 3.2, color, 0, 1.35, -0.5, root);
  box(2.1, 1.25, 1.2, color, 0, 1.0, 1.65, root);
  box(1.9, 0.6, 0.06, C.winDark, 0, 1.9, 1.1, root).rotation.x = -0.35;
  for (const sx of [-0.7, 0.7]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.06), glow(0xfff2c8)); l.position.set(sx, 1.0, 2.27); root.add(l); }
  const wheels = [];
  for (const [x, z] of [[-1.05, -1.3], [1.05, -1.3], [-1.05, 1.4], [1.05, 1.4]]) {
    const w = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), C.winDark, x, 0.42, z, root);
    w.rotation.z = Math.PI / 2;
    wheels.push(w);
  }
  root.userData.step = (ph) => wheels.forEach((w) => { w.rotation.x = ph; });
  return root;
}

// Todo mundo anda pela estrada sinuosa: posição na estrada (0 a 1), sentido, faixa e velocidade
const movers = [];
function add(parts, u, dir, lane, speed, stride, scale = 1.1) {
  const g = group();
  g.scale.setScalar(scale);
  parts.forEach(([obj, side, back]) => { obj.position.set(side, 0, back); g.add(smooth(obj)); });
  movers.push({ g, parts: parts.map((p) => p[0]), u, dir, lane, v: speed, stride, dist: 0 });
}
add([[cyclist(C.coral, C.blue), 0, 0]], 0.42, 1, -0.6, 2.4, 0.45);
add([[cyclist(C.yellow, C.dark), 0, 0]], 0.6, -1, 0.6, 2.1, 0.45);
add([[cyclist(C.blue, C.coral), 0, 0]], 0.25, 1, -0.6, 2.2, 0.45);
add([[person(C.coral, C.dark, false, C.dark), 0, 0], [balloonKid(), 0.75, 0.1]], 0.5, -1, 1.15, 0.6, 0.32);
add([[person(C.blue, C.cream), 0, 0], [dog(), 0.6, 0.9]], 0.36, 1, -1.15, 0.65, 0.32);
add([[person(C.yellow, C.dark), 0, 0], [person(C.cream, C.blue, false, C.yellow), 0.7, 0]], 0.55, 1, 1.15, 0.55, 0.32);
add([[person(C.white, C.dark), 0, 0]], 0.3, -1, 1.15, 0.6, 0.32);
add([[van(0xf3f1ff), 0, 0]], 0.47, 1, -0.75, 5.5, 0.42, 1);
add([[van(C.warm), 0, 0]], 0.7, -1, 0.75, 5, 0.42, 1);

// --- Câmera, tamanho e animação ---
const T = new THREE.Vector3(4, 6, -14); // centro da cidade, para onde a câmera olha
sun.position.copy(T).add(new THREE.Vector3(-70, 50, 45));
sun.target.position.copy(T);
let W = 0, H = 0, mobile = false, frameW = 600;
function resize() {
  const r = hero.getBoundingClientRect();
  W = Math.round(r.width); H = Math.round(r.height);
  mobile = W < 1000; // até 1000px a cidade fica embaixo do texto
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  // No computador a cidade fica à direita do texto, até a borda, e cresce ou diminui inteira com a tela;
  // no celular, fica embaixo do texto
  const text = document.querySelector(".hero-text"), textRight = text ? text.getBoundingClientRect().right - r.left : W * 0.45;
  const right = W - 8, left = Math.max(textRight + 32, W * 0.46);
  frameW = mobile ? Math.min(W * 1.05, 640) : Math.min(right - left, H * 1.6);
  const cx = mobile ? W / 2 : right - frameW / 2, cy = H - (mobile ? 0.26 : 0.22) * frameW;
  camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(hero);
resize();

let speed = 1, lastScroll = -1e9, t = 0, visible = true, last = 0;
window.addEventListener("scroll", () => { lastScroll = performance.now(); }, { passive: true });
new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(hero);

function update(dt) {
  const target = performance.now() - lastScroll < 450 ? 2 : 1;
  speed += (target - speed) * Math.min(1, dt * 4);
  const s = dt * speed;
  t += s;
  // distância para a cidade (uns 66 de largura) ocupar o espaço reservado para ela
  const dist = ((mobile ? 74 : 84) * H) / (2 * Math.tan((camera.fov * Math.PI) / 360) * frameW);
  scene.fog.near = dist * 1.05; scene.fog.far = dist * 1.9;
  const ang = Math.sin(t * 0.04) * 0.1, el = 0.12;
  camera.position.set(T.x + Math.sin(ang) * Math.cos(el) * dist, T.y + Math.sin(el) * dist, T.z + Math.cos(ang) * Math.cos(el) * dist);
  camera.lookAt(T);
  nextFlip -= s;
  if (nextFlip <= 0) { nextFlip = 0.4 + Math.random() * 0.9; flipWindow(); }
  // neve caindo, com um leve balanço
  const p = flakes.geometry.attributes.position.array;
  for (let i = 0; i < FLAKES; i++) {
    p[i * 3 + 1] -= (1.4 + (i % 5) * 0.25) * s;
    p[i * 3] += Math.sin(t * 0.8 + i) * 0.4 * s;
    if (p[i * 3 + 1] < 0) p[i * 3 + 1] += 50;
  }
  flakes.geometry.attributes.position.needsUpdate = true;
  flakes.position.copy(T).setY(0);
  movers.forEach((m) => {
    m.u = (m.u + (m.dir * m.v * s) / ROAD_LEN + 1) % 1;
    m.dist += m.v * s;
    const pt = road.getPointAt(m.u), tg = road.getTangentAt(m.u);
    m.g.position.set(pt.x - tg.z * m.lane, 0, pt.z + tg.x * m.lane);
    m.g.rotation.y = Math.atan2(tg.x * m.dir, tg.z * m.dir);
    m.parts.forEach((q) => q.userData.step && q.userData.step(m.dist / m.stride));
  });
}
function loop(now) {
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
  last = now;
  if (visible) { update(dt); renderer.render(scene, camera); }
  requestAnimationFrame(loop);
}
update(0);
renderer.render(scene, camera);
if (!matchMedia("(prefers-reduced-motion: reduce)").matches) requestAnimationFrame(loop);

import * as THREE from 'three';

// ---------- procedural textures (no image downloads) ----------
const rand = (a, b) => a + Math.random() * (b - a);
function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function speckle(g, s, n, rgb, alpha) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${rgb},${rand(0, alpha)})`;
    g.fillRect(rand(0, s), rand(0, s), rand(1, 3), rand(1, 3));
  }
}
function stains(g, s, n, rgb, alpha) {
  for (let i = 0; i < n; i++) {
    const x = rand(0, s), y = rand(0, s), r = rand(s * 0.05, s * 0.25);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${rgb},${alpha})`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}
function drips(g, s, n, rgb, alpha) { // rain streaks running down from the top
  for (let i = 0; i < n; i++) {
    const x = rand(0, s), len = rand(s * 0.1, s * 0.6);
    const grd = g.createLinearGradient(0, 0, 0, len);
    grd.addColorStop(0, `rgba(${rgb},${alpha})`);
    grd.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grd;
    g.fillRect(x, 0, rand(2, 8), len);
  }
}

const TEX = {
  concrete: () => canvasTex(512, (g, s) => {
    g.fillStyle = '#8c8d88'; g.fillRect(0, 0, s, s);
    stains(g, s, 14, '60,58,52', 0.18);
    drips(g, s, 20, '50,48,44', 0.25);
    speckle(g, s, 9000, '30,30,30', 0.22);
    speckle(g, s, 4000, '230,230,225', 0.18);
    g.strokeStyle = 'rgba(40,40,40,.55)'; g.lineWidth = 3; g.strokeRect(1, 1, s - 2, s - 2);
    g.fillStyle = 'rgba(40,40,40,.5)';
    for (const [x, y] of [[40, 40], [s - 40, 40], [40, s - 40], [s - 40, s - 40]]) { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); }
  }),
  floor: () => canvasTex(512, (g, s) => {
    g.fillStyle = '#4a4b47'; g.fillRect(0, 0, s, s);
    stains(g, s, 20, '25,25,22', 0.25);
    stains(g, s, 6, '90,80,60', 0.15); // dust
    speckle(g, s, 16000, '15,15,15', 0.35);
    speckle(g, s, 6000, '160,160,150', 0.2);
    g.strokeStyle = 'rgba(20,20,20,.5)'; g.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { // cracks
      g.beginPath(); let x = rand(0, s), y = rand(0, s); g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += rand(-30, 30); y += rand(-30, 30); g.lineTo(x, y); }
      g.stroke();
    }
  }),
  building: () => canvasTex(512, (g, s) => { // one 3m x 3m bay with a window
    g.fillStyle = '#a99d86'; g.fillRect(0, 0, s, s);
    speckle(g, s, 8000, '60,55,45', 0.25);
    stains(g, s, 8, '70,62,50', 0.2);
    const [x, y, w, h] = [s * 0.28, s * 0.22, s * 0.44, s * 0.48];
    g.fillStyle = '#5d5547'; g.fillRect(x - 8, y - 8, w + 16, h + 16); // frame
    const glass = g.createLinearGradient(x, y, x + w, y + h);
    glass.addColorStop(0, '#2b3238'); glass.addColorStop(0.5, '#46525a'); glass.addColorStop(1, '#1e2428');
    g.fillStyle = glass; g.fillRect(x, y, w, h);
    g.fillStyle = '#5d5547'; g.fillRect(x + w / 2 - 3, y, 6, h); g.fillRect(x, y + h / 2 - 3, w, 6); // mullions
    g.fillStyle = '#8a8070'; g.fillRect(x - 14, y + h + 8, w + 28, 10); // sill
    drips(g, s, 12, '55,50,40', 0.35);
    g.fillStyle = 'rgba(40,36,30,.6)'; g.fillRect(0, s - 6, s, 6); // floor line
  }),
  crate: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#9a7246'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 300; i++) { // grain
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? '60,38,18' : '200,160,110'},${rand(0.05, 0.2)})`;
      const y = rand(0, s); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(s / 3, y + rand(-3, 3), s * 2 / 3, y + rand(-3, 3), s, y); g.stroke();
    }
    g.fillStyle = 'rgba(40,24,10,.7)';
    for (let y = 0; y < s; y += s / 5) g.fillRect(0, y, s, 2); // plank gaps
    g.strokeStyle = '#6b4a28'; g.lineWidth = 22; g.strokeRect(11, 11, s - 22, s - 22); // frame
    g.beginPath(); g.moveTo(22, s - 22); g.lineTo(s - 22, 22); g.stroke(); // brace
    g.fillStyle = '#2a2a2a';
    for (const [x, y] of [[11, 11], [s - 11, 11], [11, s - 11], [s - 11, s - 11]]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(20,20,20,.55)'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center';
    g.fillText('AMMO 5.56', s / 2, s / 2 + 34);
  }),
  container: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#56653f'; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) { // corrugation
      const grd = g.createLinearGradient(x, 0, x + 16, 0);
      grd.addColorStop(0, 'rgba(255,255,255,.12)'); grd.addColorStop(0.5, 'rgba(0,0,0,.25)'); grd.addColorStop(1, 'rgba(255,255,255,.12)');
      g.fillStyle = grd; g.fillRect(x, 0, 16, s);
    }
    stains(g, s, 10, '120,60,25', 0.45); // rust
    speckle(g, s, 3000, '90,45,20', 0.4);
    drips(g, s, 10, '100,50,20', 0.4);
    g.fillStyle = 'rgba(30,30,25,.6)'; g.fillRect(0, 0, s, 8); g.fillRect(0, s - 8, s, 8);
  }),
  barrier: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#b5b2a8'; g.fillRect(0, 0, s, s);
    speckle(g, s, 5000, '50,50,45', 0.25);
    stains(g, s, 8, '80,75,65', 0.2);
    for (let x = -s; x < s * 2; x += 40) { // hazard band
      g.fillStyle = '#d9a821'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 20, 0); g.lineTo(x + 50, 40); g.lineTo(x + 30, 40); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 40, s, 3);
    stains(g, s, 5, '60,55,45', 0.25);
  }),
  sandbag: () => canvasTex(256, (g, s) => { // 4 rows of bags per tile, staggered
    g.fillStyle = '#4b4434'; g.fillRect(0, 0, s, s);
    const rows = 4, bw = s / 2, bh = s / rows;
    for (let r = 0; r < rows; r++) for (let i = -1; i < 3; i++) {
      const x = i * bw + (r % 2) * bw / 2, y = r * bh;
      const grd = g.createRadialGradient(x + bw / 2, y + bh * 0.4, 4, x + bw / 2, y + bh / 2, bw * 0.55);
      grd.addColorStop(0, '#b3a47c'); grd.addColorStop(0.7, '#8c7d58'); grd.addColorStop(1, '#5a5038');
      g.fillStyle = grd;
      g.beginPath(); g.roundRect(x + 3, y + 3, bw - 6, bh - 6, 18); g.fill();
    }
    speckle(g, s, 4000, '40,35,25', 0.3);
  }),
  drum: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#2f4a6a'; g.fillRect(0, 0, s, s);
    stains(g, s, 12, '110,55,25', 0.5);
    speckle(g, s, 3000, '20,20,20', 0.3);
    g.fillStyle = 'rgba(0,0,0,.4)';
    for (const y of [s * 0.3, s * 0.68]) g.fillRect(0, y, s, 8); // rolling hoops
    g.fillStyle = '#d0b020'; g.fillRect(0, s * 0.45, s, 14);
  }),
  target: () => canvasTex(256, (g, s) => {
    g.fillStyle = '#e8e2cf'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#26282a'; // silhouette
    g.beginPath(); g.arc(s / 2, 40, 28, 0, 7); g.fill();
    g.beginPath(); g.moveTo(s / 2 - 30, 66); g.lineTo(s / 2 + 30, 66); g.lineTo(s / 2 + 90, 110); g.lineTo(s / 2 + 90, s); g.lineTo(s / 2 - 90, s); g.lineTo(s / 2 - 90, 110); g.fill();
    g.strokeStyle = '#e8e2cf'; g.lineWidth = 3;
    for (const r of [22, 44, 66]) { g.beginPath(); g.arc(s / 2, 160, r, 0, 7); g.stroke(); }
    g.fillStyle = '#c23b22'; g.beginPath(); g.arc(s / 2, 160, 10, 0, 7); g.fill();
    speckle(g, s, 800, '120,110,90', 0.2);
  }),
};

// Bullet hole: dark puncture, chipped lighter rim, a few hairline cracks.
export const holeMaterial = new THREE.MeshBasicMaterial({
  map: canvasTex(64, (g, s) => {
    const c = s / 2;
    const rim = g.createRadialGradient(c, c, 4, c, c, c);
    rim.addColorStop(0, 'rgba(20,18,15,1)'); rim.addColorStop(0.25, 'rgba(45,40,34,.95)');
    rim.addColorStop(0.45, 'rgba(150,140,125,.5)'); rim.addColorStop(1, 'rgba(120,110,95,0)');
    g.fillStyle = rim; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(25,22,18,.7)'; g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const a = rand(0, Math.PI * 2);
      g.beginPath(); g.moveTo(c + Math.cos(a) * 6, c + Math.sin(a) * 6);
      g.lineTo(c + Math.cos(a + rand(-0.3, 0.3)) * rand(14, 26), c + Math.sin(a + rand(-0.3, 0.3)) * rand(14, 26)); g.stroke();
    }
  }),
  transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
});

// meters per texture tile; null = stretch once per face
const KINDS = {
  floor: { tile: 4, roughness: 0.95 },
  wall: { tex: 'concrete', tile: 3, roughness: 0.9, color: 0xc8c8c0 },
  concrete: { tile: 2, roughness: 0.9 },
  building: { tile: 3, roughness: 0.9 },
  barrier: { tile: null, roughness: 0.85 },
  sandbag: { tile: 1, roughness: 1 },
  container: { tile: 2.6, roughness: 0.6, metalness: 0.35 },
  crate: { tile: null, roughness: 0.85 },
  drum: { tile: null, roughness: 0.5, metalness: 0.4 },
  target: { tile: null, roughness: 0.9 },
};
const matCache = {};
function levelMaterial(kind) {
  const k = KINDS[kind] || KINDS.concrete;
  return matCache[kind] ??= new THREE.MeshStandardMaterial({
    map: TEX[k.tex || kind]?.() ?? TEX.concrete(), roughness: k.roughness, metalness: k.metalness ?? 0, color: k.color ?? 0xffffff,
  });
}
const roofMat = new THREE.MeshStandardMaterial({ color: 0x55534d, roughness: 0.95 });

// Scale each box face's UVs by its size so textures keep a real-world scale.
function worldUV(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]; // px nx py ny pz nz
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * faces[f][0] / tile, uv.getY(i) * faces[f][1] / tile);
  }
}

export function levelBox(b) {
  const kind = b[6] || 'concrete';
  const [w, h, d] = [b[3] - b[0], b[4] - b[1], b[5] - b[2]];
  let mesh;
  if (kind === 'drum') { // collision stays a box; looks like an oil drum
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) / 2, Math.min(w, d) / 2, h, 20), levelMaterial(kind));
  } else {
    const geo = new THREE.BoxGeometry(w, h, d);
    const tile = KINDS[kind]?.tile;
    if (tile) worldUV(geo, w, h, d, tile);
    let mat = levelMaterial(kind);
    if (kind === 'target') mat = mat.clone(); // targets flash individually
    if (kind === 'building') mat = [mat, mat, roofMat, roofMat, mat, mat];
    mesh = new THREE.Mesh(geo, mat);
  }
  mesh.position.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2);
  mesh.castShadow = kind !== 'floor';
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- guns ----------
const M = {
  metal: new THREE.MeshStandardMaterial({ color: 0x45484d, metalness: 0.3, roughness: 0.45 }),
  blued: new THREE.MeshStandardMaterial({ color: 0x2f3338, metalness: 0.45, roughness: 0.35 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x26282b, metalness: 0.2, roughness: 0.6 }),
  tan: new THREE.MeshStandardMaterial({ color: 0x86744f, roughness: 0.8 }),
  od: new THREE.MeshStandardMaterial({ color: 0x4e5338, roughness: 0.85 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.55 }),
  lens: new THREE.MeshStandardMaterial({ color: 0x223344, metalness: 0.9, roughness: 0.05, emissive: 0x110000 }),
};
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, len, seg = 12, r2 = r) => new THREE.CylinderGeometry(r, r2, len, seg).rotateX(Math.PI / 2); // along z; r = front radius

const flashTex = canvasTex(64, (g, s) => {
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,250,220,1)'); grd.addColorStop(0.3, 'rgba(255,190,80,.9)'); grd.addColorStop(1, 'rgba(255,120,20,0)');
  g.fillStyle = grd;
  g.beginPath();
  for (let i = 0; i < 16; i++) { const r = i % 2 ? s * 0.18 : s / 2, a = i / 16 * Math.PI * 2; g.lineTo(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r); }
  g.fill();
});

function gunKit() {
  const g = new THREE.Group();
  const part = (geo, mat, x, y, z, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, 0, rz);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  return { g, part };
}
// Muzzle, flash and the points the hands and eye need.
function finishGun(g, { muzzle: [my, mz], stock, grip, fore, sight, adsDist, flashSize = 0.22, ...extra }) {
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, my, mz);
  g.add(muzzle);
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(flashSize, flashSize),
    new THREE.MeshBasicMaterial({ map: flashTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  flash.visible = false;
  muzzle.add(flash);
  const side = flash.clone(); // side-on flame so third-person flashes read
  side.rotation.y = Math.PI / 2;
  side.scale.set(1.8, 0.6, 1);
  side.position.z = -0.08;
  flash.add(side);
  return {
    group: g, muzzle, stock, grip, fore, sight, adsDist, ...extra,
    flash() {
      flash.visible = true;
      flash.rotation.z = Math.random() * Math.PI;
      clearTimeout(this.t);
      this.t = setTimeout(() => { flash.visible = false; }, 45);
    },
  };
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// All guns: barrel along -z, origin = rear of the receiver, butt pad near z = +0.28.
const GUNS = {
  rifle() { // M4A1 with iron sights
    const { g, part } = gunKit();
    part(box(0.05, 0.055, 0.30), M.metal, 0, 0.028, -0.15);
    part(box(0.046, 0.045, 0.21), M.metal, 0, -0.022, -0.12);
    part(box(0.004, 0.022, 0.07), M.dark, 0.026, 0.03, -0.12); // ejection port cover
    part(box(0.012, 0.012, 0.03), M.dark, 0.03, 0.018, -0.085); // forward assist
    part(box(0.06, 0.01, 0.015), M.dark, 0, 0.05, 0.005); // charging handle
    part(box(0.008, 0.02, 0.012), M.dark, -0.026, -0.005, -0.05); // mag release
    part(box(0.022, 0.01, 0.56), M.metal, 0, 0.061, -0.33); // top rail
    for (let z = -0.04; z > -0.6; z -= 0.022) part(box(0.026, 0.006, 0.008), M.metal, 0, 0.068, z);
    part(cyl(0.03, 0.32, 8), M.tan, 0, 0.026, -0.44); // handguard
    part(box(0.008, 0.012, 0.3), M.dark, 0.032, 0.026, -0.44);
    part(box(0.008, 0.012, 0.3), M.dark, -0.032, 0.026, -0.44);
    for (let z = -0.33; z > -0.58; z -= 0.05) part(box(0.062, 0.012, 0.02), M.dark, 0, 0.026, z);
    part(box(0.03, 0.07, 0.035), M.tan, 0, -0.03, -0.5, 0.1); // vertical grip
    part(cyl(0.011, 0.26), M.metal, 0, 0.026, -0.72); // barrel
    part(box(0.03, 0.03, 0.03), M.dark, 0, 0.03, -0.63); // gas block
    // iron sights: front post (top at y 0.1) lines up with the rear aperture centre
    part(box(0.026, 0.04, 0.014), M.dark, 0, 0.062, -0.63); // front sight tower
    for (const x of [-0.011, 0.011]) part(box(0.004, 0.03, 0.012), M.dark, x, 0.095, -0.63); // protective ears
    part(box(0.004, 0.02, 0.004), M.dark, 0, 0.09, -0.63); // post
    part(cyl(0.016, 0.065), M.dark, 0, 0.026, -0.87); // muzzle brake
    for (const z of [-0.855, -0.875]) part(box(0.034, 0.006, 0.006), M.metal, 0, 0.026, z);
    part(box(0.03, 0.018, 0.03), M.dark, 0, 0.077, -0.04); // rear sight base
    for (const x of [-0.012, 0.012]) part(box(0.004, 0.03, 0.016), M.dark, x, 0.1, -0.04); // rear ears
    part(new THREE.TorusGeometry(0.0055, 0.0007, 6, 24), M.dark, 0, 0.1, -0.04); // peep aperture
    part(box(0.052, 0.045, 0.085), M.metal, 0, -0.06, -0.2); // mag well
    part(box(0.028, 0.11, 0.07), M.tan, 0, -0.13, -0.205, 0.12); // magazine
    part(box(0.028, 0.1, 0.066), M.tan, 0, -0.225, -0.225, 0.3);
    part(box(0.032, 0.012, 0.075), M.dark, 0, -0.275, -0.24, 0.3); // base plate
    part(box(0.006, 0.006, 0.075), M.dark, 0, -0.068, -0.085); // trigger guard
    part(box(0.004, 0.022, 0.006), M.dark, 0, -0.054, -0.09); // trigger
    part(box(0.032, 0.11, 0.045), M.tan, 0, -0.095, -0.02, -0.35); // pistol grip
    const stock = [
      part(cyl(0.016, 0.2), M.dark, 0, 0.02, 0.1),
      part(box(0.042, 0.07, 0.16), M.tan, 0, 0.005, 0.19),
      part(box(0.044, 0.025, 0.12), M.tan, 0, 0.05, 0.17),
      part(box(0.048, 0.11, 0.022), M.dark, 0, -0.008, 0.28),
    ];
    return finishGun(g, { muzzle: [0.026, -0.91], stock, grip: V(0, -0.075, -0.03), fore: V(0, -0.02, -0.32), sight: V(0, 0.1, -0.04), adsDist: 0.13, butt: 0.29 });
  },
  smg() { // MP5 with iron sights
    const { g, part } = gunKit();
    part(box(0.046, 0.062, 0.3), M.blued, 0, 0.02, -0.15); // stamped receiver
    part(cyl(0.013, 0.22), M.blued, 0, 0.058, -0.26); // cocking tube
    part(box(0.03, 0.01, 0.012), M.dark, -0.03, 0.058, -0.33, 0, 0.4); // cocking handle
    part(box(0.056, 0.056, 0.17), M.dark, 0, 0.005, -0.38); // handguard
    for (let z = -0.31; z > -0.46; z -= 0.03) part(box(0.058, 0.004, 0.012), M.blued, 0, -0.02, z); // grip ribs
    part(cyl(0.01, 0.12), M.blued, 0, 0.02, -0.51); // barrel
    part(cyl(0.015, 0.035), M.blued, 0, 0.02, -0.56); // tri-lug
    part(box(0.03, 0.04, 0.02), M.blued, 0, 0.06, -0.45); // front sight base
    part(new THREE.TorusGeometry(0.013, 0.003, 6, 16), M.blued, 0, 0.088, -0.45); // front hood
    part(box(0.003, 0.02, 0.003), M.dark, 0, 0.078, -0.45); // front post, top at the aperture height
    part(new THREE.TorusGeometry(0.0065, 0.0009, 6, 24), M.blued, 0, 0.088, -0.04); // rear aperture (open ring, not a solid drum)
    part(box(0.006, 0.03, 0.016), M.blued, 0, 0.068, -0.04);
    part(box(0.035, 0.012, 0.03), M.blued, 0, 0.058, -0.04);
    part(box(0.05, 0.03, 0.11), M.dark, 0, -0.025, -0.05); // trigger housing
    part(box(0.034, 0.1, 0.045), M.dark, 0, -0.08, -0.03, -0.25); // grip
    part(box(0.006, 0.006, 0.06), M.dark, 0, -0.05, -0.09); // trigger guard
    part(box(0.012, 0.012, 0.02), M.dark, 0.026, -0.02, -0.04); // selector
    part(box(0.048, 0.04, 0.06), M.blued, 0, -0.03, -0.2); // mag well
    part(box(0.024, 0.1, 0.05), M.blued, 0, -0.1, -0.205, 0.15); // curved mag
    part(box(0.024, 0.09, 0.05), M.blued, 0, -0.19, -0.225, 0.38);
    const stock = [
      part(cyl(0.006, 0.24), M.blued, 0.018, 0.035, 0.12),
      part(cyl(0.006, 0.24), M.blued, -0.018, 0.035, 0.12),
      part(box(0.05, 0.11, 0.018), M.dark, 0, 0.0, 0.25),
    ];
    return finishGun(g, { muzzle: [0.02, -0.58], stock, grip: V(0, -0.065, -0.03), fore: V(0, -0.025, -0.34), sight: V(0, 0.088, -0.04), adsDist: 0.13, flashSize: 0.16, butt: 0.26 });
  },
  shotgun() { // pump-action 870
    const { g, part } = gunKit();
    part(box(0.05, 0.068, 0.22), M.blued, 0, 0.01, -0.1); // receiver
    part(box(0.004, 0.03, 0.08), M.dark, 0.026, 0.02, -0.1); // ejection port
    part(box(0.008, 0.008, 0.2), M.blued, 0, 0.048, -0.1); // top rib
    part(cyl(0.013, 0.5), M.blued, 0, 0.035, -0.46); // barrel
    part(cyl(0.012, 0.36), M.blued, 0, -0.008, -0.38); // magazine tube
    part(box(0.03, 0.05, 0.02), M.blued, 0, 0.015, -0.56); // barrel clamp
    part(new THREE.SphereGeometry(0.004, 8, 6), M.metal, 0, 0.051, -0.7); // bead sight
    const pump = part(cyl(0.025, 0.18, 14), M.wood, 0, -0.008, -0.32);
    for (let z = -0.25; z > -0.4; z -= 0.025) mesh(pump, cyl(0.0255, 0.005, 14), M.dark, 0, 0, z + 0.32);
    part(box(0.034, 0.024, 0.1), M.dark, 0, -0.035, -0.05); // trigger plate
    part(box(0.006, 0.006, 0.06), M.dark, 0, -0.058, -0.06);
    part(box(0.038, 0.075, 0.12), M.wood, 0, -0.04, 0.06, 0.25); // wrist
    const stock = [
      part(box(0.044, 0.11, 0.2), M.wood, 0, -0.05, 0.2, 0.08),
      part(box(0.047, 0.12, 0.022), M.dark, 0, -0.06, 0.31, 0.08), // recoil pad
    ];
    return finishGun(g, { muzzle: [0.035, -0.72], stock, grip: V(0, -0.06, 0.03), fore: V(0, -0.03, -0.32), sight: V(0, 0.052, -0.04), adsDist: 0.34, flashSize: 0.32, pump, butt: 0.32 });
  },
  sniper() { // bolt-action M24 with scope and folded bipod
    const { g, part } = gunKit();
    part(cyl(0.022, 0.22), M.blued, 0, 0.02, -0.1); // receiver
    const bolt = new THREE.Group();
    bolt.position.set(0.02, 0.025, 0.0);
    g.add(bolt);
    mesh(bolt, new THREE.CylinderGeometry(0.005, 0.005, 0.06, 8), M.metal, 0.025, 0, 0, 0, 0, Math.PI / 2);
    mesh(bolt, sphere(0.011), M.blued, 0.055, -0.005, 0);
    part(cyl(0.012, 0.6, 14, 0.017), M.blued, 0, 0.022, -0.52); // heavy tapered barrel
    part(cyl(0.018, 0.055), M.dark, 0, 0.022, -0.845); // muzzle brake
    for (const z of [-0.83, -0.85]) part(box(0.04, 0.006, 0.008), M.blued, 0, 0.022, z);
    // scope
    part(cyl(0.017, 0.34), M.dark, 0, 0.088, -0.1);
    part(cyl(0.026, 0.09, 16, 0.017), M.dark, 0, 0.088, -0.31);
    part(cyl(0.017, 0.06, 16, 0.021), M.dark, 0, 0.088, 0.09);
    part(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10), M.dark, 0, 0.115, -0.1); // elevation turret
    part(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 10), M.dark, 0.026, 0.088, -0.1, 0, Math.PI / 2); // windage
    for (const z of [-0.02, -0.18]) part(box(0.045, 0.04, 0.016), M.blued, 0, 0.06, z); // rings
    part(new THREE.CircleGeometry(0.024, 16), M.lens, 0, 0.088, -0.356);
    part(new THREE.CircleGeometry(0.019, 16), M.lens, 0, 0.088, 0.121).rotation.y = Math.PI;
    // synthetic stock
    part(box(0.06, 0.06, 0.42), M.od, 0, -0.01, -0.39); // forend
    part(box(0.056, 0.05, 0.22), M.od, 0, -0.012, -0.1);
    part(box(0.04, 0.1, 0.05), M.od, 0, -0.07, 0.03, -0.35); // grip
    part(box(0.006, 0.006, 0.07), M.dark, 0, -0.05, -0.04); // trigger guard
    part(box(0.03, 0.01, 0.06), M.metal, 0, -0.04, -0.13); // floor plate
    const stock = [
      part(box(0.05, 0.11, 0.24), M.od, 0, -0.03, 0.2),
      part(box(0.045, 0.03, 0.14), M.od, 0, 0.04, 0.18), // cheek riser
      part(box(0.052, 0.12, 0.022), M.dark, 0, -0.03, 0.33),
    ];
    // folded bipod
    part(box(0.03, 0.015, 0.03), M.dark, 0, -0.045, -0.56);
    for (const x of [-0.014, 0.014]) part(cyl(0.005, 0.2), M.dark, x, -0.05, -0.46);
    return finishGun(g, { muzzle: [0.022, -0.88], stock, grip: V(0, -0.075, 0.02), fore: V(0, -0.045, -0.3), sight: V(0, 0.088, 0.09), adsDist: 0.12, flashSize: 0.3, bolt, butt: 0.34 });
  },
};
export const makeGun = kind => GUNS[kind]();

// ---------- jointed soldier ----------
const SKIN = new THREE.MeshStandardMaterial({ color: 0xc89878, roughness: 0.7 });
const CLOTH = new THREE.MeshStandardMaterial({ color: 0x5b5d48, roughness: 0.95 }); // ranger green
const CLOTH2 = new THREE.MeshStandardMaterial({ color: 0x4b4f3e, roughness: 0.95 });
const GEAR = new THREE.MeshStandardMaterial({ color: 0x3a3b30, roughness: 0.85 });
const BLACK = new THREE.MeshStandardMaterial({ color: 0x1d1b18, roughness: 0.7 });
const TEAM = { A: 0xa8352c, B: 0x2c58a8 };

const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);
const sphere = r => new THREE.SphereGeometry(r, 14, 10);
function joint(parent, x, y, z) {
  const j = new THREE.Group();
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}
function mesh(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = true;
  parent.add(m);
  return m;
}

const DOWN = new THREE.Vector3(0, -1, 0);
// Two-bone IK in the parent's space: points upper arm and forearm (both hanging along -y) so the wrist lands on T.
export function solveArm(shoulder, elbow, T, a, b, pole) {
  const S = shoulder.position;
  const d = T.clone().sub(S);
  const dist = Math.min(d.length(), a + b - 1e-4);
  d.normalize();
  const cosA = (a * a + dist * dist - b * b) / (2 * a * dist);
  const perp = pole.clone().addScaledVector(d, -pole.dot(d)).normalize();
  const E = S.clone().addScaledVector(d, a * cosA).addScaledVector(perp, a * Math.sqrt(Math.max(0, 1 - cosA * cosA)));
  const W = S.clone().addScaledVector(d, dist);
  shoulder.quaternion.setFromUnitVectors(DOWN, E.clone().sub(S).normalize());
  const fore = new THREE.Quaternion().setFromUnitVectors(DOWN, W.clone().sub(E).normalize());
  elbow.quaternion.copy(shoulder.quaternion).invert().multiply(fore);
  return W;
}

// Bladed stance: the torso turns this far (left shoulder forward) while the gun and head stay on the aim line.
const TWIST = -0.6;
const ARM_A = 0.34, ARM_B = 0.34;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

// Feet at origin, facing -z, 1.8m tall.
export function makeSoldier(team, weapon = 'rifle') {
  const root = new THREE.Group();
  const body = joint(root, 0, 0, 0); // tilts as a whole when dying
  const hips = joint(body, 0, 0.95, 0);
  mesh(hips, box(0.34, 0.18, 0.21), CLOTH2, 0, 0.02, 0);
  mesh(hips, box(0.37, 0.06, 0.24), GEAR, 0, 0.09, 0); // battle belt
  mesh(hips, box(0.05, 0.04, 0.02), BLACK, 0, 0.09, -0.125); // buckle
  for (const x of [-0.15, 0.15]) mesh(hips, box(0.06, 0.09, 0.07), GEAR, x, 0.05, -0.06); // belt pouches
  mesh(hips, box(0.1, 0.08, 0.06), GEAR, 0, 0.05, 0.13); // dump pouch

  const spine = joint(hips, 0, 0.1, 0);
  mesh(spine, capsule(0.14, 0.1), CLOTH, 0, 0.08, 0);
  const chest = joint(spine, 0, 0.2, 0);
  chest.rotation.y = TWIST;
  const aim = joint(spine, 0, 0.2, 0); // untwisted frame that carries the gun
  mesh(chest, box(0.38, 0.36, 0.22), CLOTH, 0, 0.1, 0); // shirt
  const plate = new THREE.MeshStandardMaterial({ color: TEAM[team], roughness: 0.85 });
  mesh(chest, box(0.32, 0.3, 0.05), plate, 0, 0.08, -0.12); // front plate
  mesh(chest, box(0.32, 0.32, 0.05), plate, 0, 0.09, 0.12); // back plate
  mesh(chest, box(0.4, 0.12, 0.25), GEAR, 0, 0.0, 0); // cummerbund
  for (const x of [-0.12, 0.12]) mesh(chest, box(0.06, 0.04, 0.26), plate, x, 0.26, 0); // shoulder straps
  for (const x of [-0.1, 0, 0.1]) { // mag pouches with mags poking out
    mesh(chest, box(0.08, 0.1, 0.05), GEAR, x, 0.02, -0.165);
    mesh(chest, box(0.06, 0.03, 0.025), BLACK, x, 0.085, -0.165);
  }
  mesh(chest, box(0.14, 0.08, 0.03), GEAR, 0, 0.16, -0.155); // admin pouch
  mesh(chest, box(0.07, 0.14, 0.05), BLACK, -0.1, 0.12, 0.17); // radio
  mesh(chest, new THREE.CylinderGeometry(0.004, 0.004, 0.35, 6), BLACK, -0.12, 0.35, 0.17); // antenna
  mesh(chest, box(0.18, 0.2, 0.06), GEAR, 0.05, 0.1, 0.18); // hydration pack

  const neck = joint(chest, 0, 0.3, 0);
  neck.rotation.y = -TWIST;
  mesh(neck, capsule(0.055, 0.05), CLOTH2, 0, 0.02, 0); // neck gaiter
  mesh(neck, sphere(0.1), SKIN, 0, 0.13, 0);
  mesh(neck, box(0.1, 0.06, 0.06), SKIN, 0, 0.06, -0.045); // jaw
  mesh(neck, box(0.022, 0.035, 0.03), SKIN, 0, 0.12, -0.1); // nose
  for (const x of [-0.035, 0.035]) mesh(neck, sphere(0.012), BLACK, x, 0.145, -0.09); // eyes
  const helmet = mesh(neck, new THREE.SphereGeometry(0.125, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), GEAR, 0, 0.15, 0.005);
  helmet.scale.set(1, 0.85, 1.08);
  mesh(neck, new THREE.CylinderGeometry(0.128, 0.132, 0.025, 18), GEAR, 0, 0.155, 0.005); // helmet rim
  mesh(neck, box(0.04, 0.035, 0.02), BLACK, 0, 0.23, -0.12); // NVG mount
  for (const x of [-0.12, 0.12]) {
    mesh(neck, box(0.012, 0.02, 0.13), BLACK, x, 0.18, 0); // side rails
    mesh(neck, new THREE.CylinderGeometry(0.045, 0.045, 0.035, 14), BLACK, x * 0.95, 0.12, 0.005, 0, 0, Math.PI / 2); // ear pro
  }
  mesh(neck, box(0.17, 0.035, 0.03), BLACK, 0, 0.15, -0.105); // goggles strap

  const legs = [-1, 1].map(s => {
    const thigh = joint(hips, s * 0.1, -0.03, 0);
    mesh(thigh, capsule(0.077, 0.3), CLOTH2, 0, -0.21, 0);
    mesh(thigh, box(0.03, 0.12, 0.1), CLOTH2, s * 0.08, -0.22, 0); // cargo pocket
    if (s > 0) { // drop-leg holster with pistol
      mesh(thigh, box(0.05, 0.16, 0.09), GEAR, 0.08, -0.12, 0);
      mesh(thigh, box(0.03, 0.06, 0.04), BLACK, 0.08, -0.02, 0.02, 0.3);
    }
    const knee = joint(thigh, 0, -0.43, 0);
    mesh(knee, capsule(0.066, 0.3), CLOTH2, 0, -0.2, 0);
    mesh(knee, box(0.11, 0.11, 0.06), GEAR, 0, -0.03, -0.065); // knee pad
    const ankle = joint(knee, 0, -0.45, 0);
    mesh(ankle, new THREE.CylinderGeometry(0.06, 0.065, 0.12, 10), BLACK, 0, 0.02, 0); // boot upper
    mesh(ankle, box(0.11, 0.07, 0.27), BLACK, 0, -0.03, -0.05);
    mesh(ankle, box(0.115, 0.025, 0.28), new THREE.MeshStandardMaterial({ color: 0x3a2f24, roughness: 0.9 }), 0, -0.07, -0.05); // sole
    return { thigh, knee, ankle };
  });

  const arms = [1, -1].map(s => {
    const shoulder = joint(chest, s * 0.19, 0.2, 0);
    mesh(shoulder, capsule(0.062, ARM_A - 0.12), CLOTH, 0, -ARM_A / 2, 0);
    const elbow = joint(shoulder, 0, -ARM_A, 0);
    mesh(elbow, box(0.09, 0.08, 0.1), GEAR, 0, 0.01, 0.02); // elbow pad
    mesh(elbow, capsule(0.052, ARM_B - 0.12), CLOTH, 0, -ARM_B / 2, 0);
    mesh(elbow, box(0.07, 0.1, 0.05), BLACK, 0, -ARM_B - 0.03, 0); // glove
    mesh(elbow, box(0.02, 0.05, 0.02), BLACK, s * -0.03, -ARM_B - 0.02, -0.03); // thumb
    return { s, shoulder, elbow };
  });

  let gun;
  function setWeapon(kind) {
    if (gun) aim.remove(gun.group);
    gun = makeGun(kind);
    const at = new THREE.Vector3(0.1, 0.19, -0.08 - gun.butt); // butt pad on the front of the right shoulder
    gun.group.position.copy(at);
    aim.add(gun.group);
    for (const { s, shoulder, elbow } of arms) {
      const hand = at.clone().add(s > 0 ? gun.grip : gun.fore).applyAxisAngle(Y_AXIS, -TWIST); // aim space -> chest space
      solveArm(shoulder, elbow, hand, ARM_A, ARM_B, new THREE.Vector3(s, -1, 0.3).normalize());
    }
    self.gun = gun;
    self.weapon = kind;
  }

  let phase = 0, fall = 0, crouchT = 0;
  const self = {
    root, setWeapon,
    // speed in m/s, pitch in radians (up positive)
    update(dt, speed, pitch, alive, crouch) {
      crouchT += ((crouch ? 1 : 0) - crouchT) * Math.min(1, dt * 12);
      const c = crouchT;
      const amt = Math.min(speed / 5, 1) * (1 - c * 0.4);
      phase += dt * speed * (4.4 + c * 2);
      legs.forEach(({ thigh, knee, ankle }, i) => {
        const p = phase + i * Math.PI;
        thigh.rotation.x = c * 1.25 + Math.sin(p) * 0.65 * amt;
        knee.rotation.x = -c * 1.9 - Math.max(0, Math.cos(p)) * 0.85 * amt;
        ankle.rotation.x = c * 0.6 + Math.max(0, -Math.sin(p)) * 0.3 * amt;
      });
      hips.position.y = 0.95 - 0.37 * c - 0.03 * amt + Math.abs(Math.cos(phase)) * 0.03 * amt;
      hips.rotation.y = Math.sin(phase) * 0.12 * amt;
      const lean = 0.05 * amt + 0.3 * c;
      spine.rotation.y = -hips.rotation.y; // shoulders stay square to the aim
      spine.rotation.x = pitch * 0.5 - lean;
      chest.rotation.x = aim.rotation.x = pitch * 0.5 + lean; // gun keeps following the aim while leaning
      neck.rotation.x = -lean * 0.3;
      fall += ((alive ? 0 : 1) - fall) * Math.min(1, dt * (alive ? 20 : 6));
      body.rotation.x = fall * Math.PI / 2;
      body.position.y = fall * 0.15;
    },
  };
  setWeapon(weapon);
  return self;
}

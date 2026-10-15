import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { MAP, EYE, CROUCH_EYE, PLAYER_H, CROUCH_H, PLAYER_R, rayAABB, rayPlayer } from '../../shared/map.js';
import { WEAPONS, SLOTS, SWITCH_MS } from '../../shared/weapons.js';
import { levelBox, makeGun, makeSoldier, holeMaterial } from './models.js';
import { listener, SOUNDS, SHOT_VOLUME, playLocal, playAt, unlockAudio } from './sound.js';

const T = (x, z, d = 0.06) => [x - 0.5, 0.2, z, x + 0.5, 2.0, z + d]; // paper target on a stand
export const RANGE = {
  walls: [
    [-17, -1, -97, 17, 0, 15, 'floor'],
    [-17, 0, -97, 17, 6, -96, 'wall'], [-17, 0, -97, -16, 6, 15, 'wall'], [16, 0, -97, 17, 6, 15, 'wall'], [-17, 0, 14, 17, 6, 15, 'wall'],
    [-10, 0, -2, 10, 1, -1.5, 'barrier'],
    [-14, 0, -6, -12.6, 1.4, -4.6, 'crate'], [-14, 0, -4.6, -12.6, 1.4, -3.2, 'crate'], [-13.8, 1.4, -5.2, -12.4, 2.8, -3.8, 'crate'],
    [12, 0, -30, 14.5, 2.6, -24, 'container'], [-15, 0, -45, -9, 0.9, -44.4, 'sandbag'], [5, 0, -62, 6, 1, -61, 'drum'],
  ],
  targets: [T(-6, -10), T(-2, -16), T(3, -22), T(7, -13), T(-8, -35), T(0, -45), T(8, -60), T(-4, -85), T(4, -92)],
  spawn: [0, 0, 6],
  look: [0, EYE, -10],
};
const BASE_SPEED = 6, JUMP = 6, GRAVITY = 18, FOV = 75;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fullMags = () => Object.fromEntries(SLOTS.map(k => [k, WEAPONS[k].mag]));
const div = (cls, text = '') => Object.assign(document.createElement('div'), { className: cls, textContent: text });

// The three.js game: rendering, input, movement, shooting, other players.
// React owns the UI around it; this talks back through `hooks` and is driven through the returned API.
// els: { mount, crosshair, hitmarker, scope, hurtRing, popups } DOM nodes; hooks: { send, onAmmo, onRangeHit }
export function createEngine(els, hooks) {
  const cleanups = [];
  const listen = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanups.push(() => target.removeEventListener(type, fn, opts)); };

  // --- three.js setup ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.autoClear = false;
  els.mount.append(renderer.domElement);
  const SKY = 0xa9bccb;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(SKY, 60, 190);
  const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.02, 400);
  camera.add(listener); // ears follow the camera
  listen(window, 'pointerdown', unlockAudio); // browsers start audio only after a user gesture
  listen(window, 'keydown', unlockAudio);
  scene.add(new THREE.HemisphereLight(0xdfe8f0, 0x4a4436, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.set(30, 45, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -65, right: 65, top: 65, bottom: -65, near: 1, far: 160 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const muzzleLight = new THREE.PointLight(0xffb060, 0, 8);
  scene.add(muzzleLight);

  // First-person guns live in their own scene, drawn after clearing depth so they never clip into walls.
  const viewScene = new THREE.Scene();
  viewScene.add(new THREE.HemisphereLight(0xdfe8f0, 0x4a4436, 1.3));
  const viewSun = new THREE.DirectionalLight(0xfff1dc, 1.8);
  viewSun.position.set(18, 30, 10);
  viewScene.add(viewSun);
  const viewRoot = new THREE.Group(); // follows the camera
  viewScene.add(viewRoot);
  const HIP = new THREE.Vector3(0.15, -0.17, -0.4);
  const viewGuns = {};
  {
    const glove = new THREE.MeshStandardMaterial({ color: 0x1d1b18, roughness: 0.7 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x5b5d48, roughness: 0.95 });
    for (const kind of SLOTS) {
      const gun = makeGun(kind);
      // gloved hands + sleeves, in gun space so they follow hip/ADS/reload motion
      for (const [hand, elbow] of [[gun.grip, [0.07, -0.3, 0.28]], [gun.fore, [-0.16, -0.32, gun.fore.z + 0.2]]]) {
        const e = new THREE.Vector3(...elbow);
        const g = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.075, 0.1), glove);
        g.position.copy(hand).add(new THREE.Vector3(0, -0.02, 0));
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, hand.distanceTo(e), 10), sleeve);
        arm.position.copy(hand).lerp(e, 0.5);
        arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hand.clone().sub(e).normalize());
        gun.group.add(g, arm);
      }
      gun.ads = new THREE.Vector3(-gun.sight.x, -gun.sight.y, -gun.adsDist - gun.sight.z);
      gun.group.visible = false;
      viewRoot.add(gun.group);
      viewGuns[kind] = gun;
    }
  }

  const controls = new PointerLockControls(camera, document.body);
  listen(window, 'resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  let level = new THREE.Group();
  let walls = [], targets = [];
  function loadLevel(def, spawn) {
    scene.remove(level);
    level = new THREE.Group();
    scene.add(level);
    walls = def.walls;
    for (const w of walls) level.add(levelBox(w));
    targets = (def.targets || []).map(box => {
      const mesh = levelBox([...box, 'target']);
      level.add(mesh);
      level.add(levelBox([box[0] + 0.45, 0, box[2] - 0.1, box[3] - 0.45, box[1], box[5] + 0.1, 'crate'])); // stand
      return { box, mesh };
    });
    setPos(spawn);
    camera.lookAt(...(def.look ?? [0, EYE, 0])); // game maps face the center
  }

  // --- local player ---
  const me = { pos: [0, 0, 0], vel: [0, 0, 0], grounded: false, alive: true, crouch: false, eye: EYE };
  const gs = { weapon: 'rifle', mag: fullMags(), reloadUntil: 0, switchUntil: 0, lastShot: -1e9, triggerFresh: true };
  let ads = 0, bloom = 0, recoilPitch = 0, viewKick = 0, viewKickTarget = 0, bobT = 0;
  let mode = 'range'; // range | lobby | room | game
  function setPos(p) {
    me.pos = [...p];
    me.vel = [0, 0, 0];
    camera.position.set(p[0], p[1] + me.eye, p[2]);
  }
  const canPlay = () => controls.isLocked && me.alive && mode !== 'room';

  const keys = {};
  listen(window, 'keydown', e => {
    keys[e.code] = true;
    if (!canPlay()) return;
    if (e.code === 'KeyR') startReload(performance.now());
    const slot = SLOTS[+e.key - 1];
    if (slot) switchWeapon(slot, performance.now());
  });
  listen(window, 'keyup', e => { keys[e.code] = false; });

  const overlaps = (pos, h, w) => !(pos[0] + PLAYER_R <= w[0] || pos[0] - PLAYER_R >= w[3] || pos[1] + h <= w[1] || pos[1] >= w[4] ||
    pos[2] + PLAYER_R <= w[2] || pos[2] - PLAYER_R >= w[5]);
  // Axis-separated AABB collision against walls; returns grounded.
  function moveAndCollide(pos, vel, dt, h) {
    let grounded = false;
    for (let a = 0; a < 3; a++) {
      pos[a] += vel[a] * dt;
      for (const w of walls) {
        if (!overlaps(pos, h, w)) continue;
        if (a === 1) {
          if (vel[1] <= 0) { pos[1] = w[4]; grounded = true; } else pos[1] = w[1] - h;
          vel[1] = 0;
        } else {
          pos[a] = vel[a] > 0 ? w[a] - PLAYER_R : w[a + 3] + PLAYER_R;
        }
      }
    }
    return grounded;
  }

  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  function updateMe(dt) {
    const w = WEAPONS[gs.weapon];
    const playing = canPlay();
    // Hold C to crouch; only stand up if there is headroom.
    if (playing && keys.KeyC) me.crouch = true;
    else if (me.crouch && !walls.some(b => overlaps(me.pos, PLAYER_H, b))) me.crouch = false;
    me.eye += ((me.crouch ? CROUCH_EYE : EYE) - me.eye) * Math.min(1, dt * 12);

    let wx = 0, wz = 0;
    if (playing) {
      camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      right.set(-fwd.z, 0, fwd.x);
      const wish = new THREE.Vector3()
        .addScaledVector(fwd, (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0))
        .addScaledVector(right, (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0));
      const walk = keys.ShiftLeft || keys.ShiftRight;
      const speed = BASE_SPEED * w.speed * (me.crouch ? 0.42 : walk ? 0.5 : 1) * (1 - ads * 0.4);
      if (wish.lengthSq()) wish.normalize().multiplyScalar(speed);
      wx = wish.x;
      wz = wish.z;
      if (keys.Space && me.grounded && !me.crouch) me.vel[1] = JUMP;
    }
    // Ease toward the wished velocity: quick but not instant on the ground, sluggish in the air.
    const k = 1 - Math.exp(-(me.grounded ? 10 : 1.5) * dt);
    me.vel[0] += (wx - me.vel[0]) * k;
    me.vel[2] += (wz - me.vel[2]) * k;
    me.vel[1] -= GRAVITY * dt;
    me.grounded = moveAndCollide(me.pos, me.vel, dt, me.crouch ? CROUCH_H : PLAYER_H);
    camera.position.set(me.pos[0], me.pos[1] + me.eye, me.pos[2]);
  }

  // --- weapons ---
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  function currentSpread(w) {
    const moving = Math.hypot(me.vel[0], me.vel[2]) / BASE_SPEED;
    let s = w.spread + (w.adsSpread - w.spread) * ads;
    s = s * (1 + moving * 1.5) + moving * 0.02;
    if (!me.grounded) s = s * 2 + 0.03;
    if (me.crouch) s *= 0.7;
    return s + bloom;
  }
  // A shot queues its kick; the camera eases into it over a few frames instead of snapping.
  const pendingKick = { x: 0, y: 0 };
  function kickCamera(w) {
    const mul = (1 - ads * 0.35) * (me.crouch ? 0.8 : 1);
    pendingKick.x += w.kick * mul * rand(0.85, 1.15);
    pendingKick.y += rand(-1, 1) * w.kickH * mul;
  }
  function updateRecoil(dt, now) {
    const w = WEAPONS[gs.weapon];
    const a = 1 - Math.exp(-dt * 22); // ~90% of a kick lands within 0.1s
    let dx = pendingKick.x * a;
    const dy = pendingKick.y * a;
    pendingKick.x -= dx;
    pendingKick.y -= dy;
    recoilPitch += dx;
    if (now - gs.lastShot > Math.min(w.fireMs * 1.3, 180) && pendingKick.x < 1e-4 && recoilPitch > 0) { // sustained fire climbs; recover after
      const r = recoilPitch * Math.min(1, dt * w.recover);
      recoilPitch -= r;
      dx -= r;
    }
    if (!dx && !dy) return;
    euler.setFromQuaternion(camera.quaternion);
    euler.x = clamp(euler.x + dx, -1.55, 1.55);
    euler.y += dy;
    camera.quaternion.setFromEuler(euler);
  }

  const reportAmmo = () => hooks.onAmmo({ weapon: gs.weapon, mag: gs.mag[gs.weapon], reloading: !!gs.reloadUntil });
  function startReload(now) {
    const w = WEAPONS[gs.weapon];
    if (gs.reloadUntil || gs.mag[gs.weapon] >= w.mag || now < gs.switchUntil) return;
    const until = gs.reloadUntil = now + w.reloadMs;
    if (mode === 'game') hooks.send({ t: 'reload' });
    reportAmmo();
    // one quiet clack near the end — skipped if a weapon switch cancels the reload
    setTimeout(() => { if (gs.reloadUntil === until) playLocal(SOUNDS.clack, 0.35); }, w.reloadMs * 0.8);
  }
  function switchWeapon(kind, now) {
    if (kind === gs.weapon) return;
    gs.weapon = kind;
    gs.reloadUntil = 0;
    gs.switchUntil = now + SWITCH_MS;
    ads = 0;
    if (mode === 'game') hooks.send({ t: 'weapon', w: kind });
    reportAmmo();
  }
  function resetGuns(weapon) {
    Object.assign(gs, { weapon, mag: fullMags(), reloadUntil: 0, switchUntil: 0 });
    reportAmmo();
  }

  function tracer(o, e) {
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...o), new THREE.Vector3(...e)]),
      new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.7 }),
    );
    scene.add(line);
    setTimeout(() => { scene.remove(line); line.geometry.dispose(); }, 50);
  }
  function muzzleFlash(gun) {
    gun.flash();
    gun.muzzle.getWorldPosition(muzzleLight.position);
    muzzleLight.intensity = 6;
    setTimeout(() => { muzzleLight.intensity = 0; }, 45);
  }
  // Bullet holes: stick to the wall/prop/target face the shot ended on, fade out after a while.
  const HOLE_MS = 8000, MAX_HOLES = 150;
  const holeGeo = new THREE.PlaneGeometry(0.08, 0.08);
  const holes = [];
  function bulletHole(p) {
    const E = 0.002;
    const b = [...walls, ...targets.map(t => t.box)].find(b => b[6] !== 'drum' &&
      p[0] > b[0] - E && p[0] < b[3] + E && p[1] > b[1] - E && p[1] < b[4] + E && p[2] > b[2] - E && p[2] < b[5] + E);
    if (!b) return; // hit a player or nothing
    let best = Infinity;
    const n = new THREE.Vector3();
    for (let a = 0; a < 3; a++) for (const [s, face] of [[-1, b[a]], [1, b[a + 3]]]) {
      const d = Math.abs(p[a] - face);
      if (d < best) { best = d; n.set(0, 0, 0).setComponent(a, s); }
    }
    const m = new THREE.Mesh(holeGeo, holeMaterial.clone());
    m.position.set(...p).addScaledVector(n, 0.003);
    m.lookAt(m.position.clone().add(n));
    m.rotateZ(Math.random() * Math.PI * 2);
    m.scale.setScalar(rand(0.8, 1.2));
    level.add(m);
    holes.push({ m, t0: performance.now() });
    if (holes.length > MAX_HOLES) holes.shift().m.removeFromParent();
  }
  function updateHoles(now) {
    while (holes.length && now - holes[0].t0 > HOLE_MS) holes.shift().m.removeFromParent();
    for (const h of holes) h.m.material.opacity = Math.min(1, (HOLE_MS - (now - h.t0)) / 2000);
  }

  // Damage direction: a red arc on the screen edge pointing at the shooter, re-aimed every frame as you turn.
  const HURT_MS = 1200;
  const hurts = [];
  function hurtFrom(id) {
    const p = others.get(id);
    if (!p) return;
    const e = div('hurt');
    els.hurtRing.append(e);
    hurts.push({ e, from: p.target.clone(), t0: performance.now() }); // latest server position, not the interpolated mesh
  }
  function updateHurts(now) {
    camera.getWorldDirection(fwd);
    for (let i = hurts.length - 1; i >= 0; i--) {
      const h = hurts[i], k = (now - h.t0) / HURT_MS;
      if (k >= 1) { h.e.remove(); hurts.splice(i, 1); continue; }
      const dx = h.from.x - camera.position.x, dz = h.from.z - camera.position.z;
      const ang = Math.atan2(dx * -fwd.z + dz * fwd.x, dx * fwd.x + dz * fwd.z); // 0 = straight ahead, + = to the right
      h.e.style.transform = `rotate(${ang}rad)`;
      h.e.style.opacity = 1 - k * k;
    }
  }

  // Floating damage numbers (range only): rise and fade over 0.9s at the hit point.
  const popups = [];
  function popup(dmg, at, head) {
    const e = div(head ? 'dmg head' : 'dmg', dmg);
    els.popups.append(e);
    popups.push({ e, at: new THREE.Vector3(...at), t0: performance.now(), dx: rand(-14, 14) });
  }
  const projected = new THREE.Vector3();
  function updatePopups(now) {
    for (let i = popups.length - 1; i >= 0; i--) {
      const p = popups[i], k = (now - p.t0) / 900;
      projected.copy(p.at).project(camera);
      if (k >= 1 || projected.z > 1) { p.e.remove(); popups.splice(i, 1); continue; }
      const x = (projected.x + 1) / 2 * innerWidth + p.dx * k, y = (1 - projected.y) / 2 * innerHeight - 40 * k;
      p.e.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${1.2 - 0.3 * k})`;
      p.e.style.opacity = 1 - k * k;
    }
  }
  let hitmarkT;
  function hitmark(head, kill) {
    const h = els.hitmarker;
    h.className = head ? 'head' : '';
    if (kill) h.classList.add('kill');
    clearTimeout(hitmarkT);
    hitmarkT = setTimeout(() => h.classList.add('hidden'), kill ? 300 : 150);
  }

  function tryFire(now) {
    const w = WEAPONS[gs.weapon];
    if (gs.reloadUntil || now < gs.switchUntil || now - gs.lastShot < w.fireMs) return;
    if (!w.auto && !gs.triggerFresh) return;
    gs.triggerFresh = false;
    if (gs.mag[gs.weapon] <= 0) { playLocal(SOUNDS.dry, 0.4); return startReload(now); }
    gs.lastShot = now;
    gs.mag[gs.weapon]--;

    const spread = currentSpread(w);
    camera.getWorldDirection(fwd);
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const o = camera.position.toArray();
    const gun = viewGuns[gs.weapon];
    const from = gun.muzzle.getWorldPosition(new THREE.Vector3()).toArray();
    const dirs = [];
    const hits = new Map(); // range target -> { dmg, head, at }
    for (let i = 0; i < w.pellets; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
      const d = fwd.clone().addScaledVector(right, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r).normalize().toArray();
      dirs.push(d);
      let t = w.range, tg = null;
      for (const b of walls) t = Math.min(t, rayAABB(o, d, b));
      for (const x of targets) { const tt = rayAABB(o, d, x.box); if (tt < t) { t = tt; tg = x; } }
      for (const p of others.values()) {
        const h = p.alive && rayPlayer(o, d, p.mesh.position.toArray(), p.crouch);
        if (h && h.t < t) { t = h.t; tg = null; }
      }
      const end = o.map((v, j) => v + d[j] * t);
      tracer(from, end);
      bulletHole(end);
      if (!tg) continue;
      const head = end[1] >= tg.box[4] - 0.4 && Math.abs(end[0] - (tg.box[0] + tg.box[3]) / 2) < 0.2;
      const h = hits.get(tg) ?? { dmg: 0, head: false, at: end };
      h.dmg += w.damage * (head ? w.headMul : 1); // same numbers the server uses in a match
      h.head ||= head;
      hits.set(tg, h);
    }
    for (const [tg, h] of hits) {
      hooks.onRangeHit();
      tg.mesh.material.emissive.set(h.head ? 0xaa1100 : 0x553300);
      setTimeout(() => tg.mesh.material.emissive.set(0x000000), 90);
      hitmark(h.head, false);
      popup(Math.round(h.dmg), h.at, h.head);
    }
    playLocal(SOUNDS.shot[gs.weapon], SHOT_VOLUME[gs.weapon]);
    if (mode === 'game') hooks.send({ t: 'shoot', dirs }); // server decides the actual hits
    kickCamera(w);
    bloom = Math.min(bloom + w.spread * 0.2, w.spread);
    viewKickTarget = Math.min(viewKickTarget + 1, 1.6);
    muzzleFlash(gun);
    reportAmmo();
  }

  // Weapon pose: hip <-> ADS, walk bob, recoil kick, reload/switch/pump/bolt motion.
  function updateViewGun(dt, now) {
    const w = WEAPONS[gs.weapon];
    const wantAds = rmb && canPlay() && !gs.reloadUntil && now >= gs.switchUntil;
    ads = clamp(ads + (wantAds ? 1 : -1) * dt * 1000 / w.adsMs, 0, 1);
    const e = ads * ads * (3 - 2 * ads); // smoothstep
    const scoped = w.scope && ads >= 1;
    camera.fov = scoped ? w.adsFov : FOV + ((w.scope ? 55 : w.adsFov) - FOV) * e;
    camera.updateProjectionMatrix();
    controls.pointerSpeed = camera.fov / FOV;
    els.scope.classList.toggle('hidden', !scoped);

    viewRoot.position.copy(camera.position);
    viewRoot.quaternion.copy(camera.quaternion);
    viewRoot.visible = me.alive && !scoped;
    for (const k of SLOTS) viewGuns[k].group.visible = k === gs.weapon;
    const gun = viewGuns[gs.weapon];

    const speedFrac = Math.hypot(me.vel[0], me.vel[2]) / BASE_SPEED;
    if (me.grounded) bobT += dt * (6 + speedFrac * 6);
    const bob = (me.grounded ? speedFrac : 0) * (1 - e * 0.85);
    viewKick += (viewKickTarget - viewKick) * (1 - Math.exp(-dt * 30)); // ease back, then settle
    viewKickTarget *= Math.exp(-dt * 10);
    bloom *= Math.exp(-dt * 5);
    const reload = gs.reloadUntil ? Math.sin(clamp(1 - (gs.reloadUntil - now) / w.reloadMs, 0, 1) * Math.PI) : 0;
    const sw = clamp((gs.switchUntil - now) / SWITCH_MS, 0, 1);
    const cycle = !w.auto && now - gs.lastShot < w.fireMs ? Math.sin(clamp((now - gs.lastShot) / w.fireMs * 1.4 - 0.2, 0, 1) * Math.PI) : 0;

    gun.group.position.copy(HIP).lerp(gun.ads, e);
    gun.group.position.x += Math.sin(bobT) * 0.012 * bob;
    gun.group.position.y += -Math.abs(Math.cos(bobT)) * 0.012 * bob - reload * 0.08 - sw * 0.3 - (me.crouch ? 0.01 : 0) * (1 - e);
    gun.group.position.z += viewKick * 0.05 * (1 - e * 0.5);
    gun.group.rotation.set(viewKick * 0.08 * (1 - e * 0.6) - reload * 0.3 + cycle * 0.06, 0, reload * 0.6 + cycle * 0.15 * (1 - e));
    if (gun.pump) gun.pump.position.z = -0.32 + cycle * 0.09;
    if (gun.bolt) { gun.bolt.position.z = cycle * 0.08; gun.bolt.rotation.z = Math.min(1, cycle * 3) * 1.2; }
    muzzleLight.intensity *= 0.6;

    // Crosshair gap = current spread projected to screen pixels.
    const px = Math.tan(currentSpread(w)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * innerHeight / 2;
    els.crosshair.style.setProperty('--gap', `${Math.max(3, px).toFixed(1)}px`);
    els.crosshair.style.opacity = mode === 'room' || !me.alive ? 0 : 1 - e;
  }

  // --- shooting input ---
  let mouseDown = false, rmb = false;
  listen(document, 'mousedown', e => {
    if (e.target !== renderer.domElement && !controls.isLocked) return;
    if (!controls.isLocked) { if (e.button === 0 && mode !== 'room') document.body.requestPointerLock()?.catch?.(() => {}); return; } // browsers may refuse (e.g. unfocused); ignore
    if (e.button === 0) { mouseDown = true; gs.triggerFresh = true; }
    if (e.button === 2) rmb = true;
  });
  listen(window, 'mouseup', e => {
    if (e.button === 0) mouseDown = false;
    if (e.button === 2) rmb = false;
  });
  listen(window, 'contextmenu', e => { if (controls.isLocked || e.target === renderer.domElement) e.preventDefault(); });
  controls.addEventListener('unlock', () => { mouseDown = rmb = false; });

  // --- other players ---
  const others = new Map(); // id -> { soldier, mesh, target, speed, pitch, alive, crouch }
  function addOther(id, team, pos) {
    const soldier = makeSoldier(team);
    soldier.root.position.set(...pos);
    scene.add(soldier.root);
    others.set(id, { soldier, mesh: soldier.root, target: new THREE.Vector3(...pos), speed: 0, pitch: 0, alive: true, crouch: false });
  }
  function clearOthers() {
    for (const p of others.values()) scene.remove(p.mesh);
    others.clear();
  }

  // Position updates to the server, 20Hz while in a match.
  const yawEuler = new THREE.Euler();
  const posTimer = setInterval(() => {
    if (mode !== 'game' || !me.alive) return;
    yawEuler.setFromQuaternion(camera.quaternion, 'YXZ');
    hooks.send({ t: 'pos', p: me.pos, yaw: yawEuler.y, pitch: yawEuler.x, crouch: me.crouch });
  }, 50);

  // --- loop ---
  loadLevel(RANGE, RANGE.spawn);
  reportAmmo();
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const now = performance.now();
    updateMe(dt);
    if (gs.reloadUntil && now >= gs.reloadUntil) {
      gs.mag[gs.weapon] = WEAPONS[gs.weapon].mag;
      gs.reloadUntil = 0;
      reportAmmo();
    }
    if (canPlay()) {
      if (mouseDown) tryFire(now);
      if (!gs.mag[gs.weapon] && now - gs.lastShot > WEAPONS[gs.weapon].fireMs) startReload(now); // auto reload on empty
    }
    updateRecoil(dt, now);
    for (const p of others.values()) {
      p.mesh.position.lerp(p.target, Math.min(1, dt * 15));
      p.soldier.update(dt, p.speed, p.pitch, p.alive, p.crouch);
    }
    updateViewGun(dt, now);
    updatePopups(now);
    updateHoles(now);
    updateHurts(now);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(viewScene, camera);
  });

  // --- API used by the network session ---
  return {
    setMode(next) {
      mode = next;
      if (mode === 'room') controls.unlock();
    },
    // players: [{ id, team, pos }], including me
    startMatch(myId, players) {
      clearOthers();
      loadLevel(MAP, players.find(p => p.id === myId).pos);
      for (const p of players) if (p.id !== myId) addOther(p.id, p.team, p.pos);
      Object.assign(me, { alive: true, crouch: false });
      resetGuns('rifle'); // server starts everyone on the rifle
    },
    backToRange() {
      clearOthers();
      me.alive = true;
      resetGuns(gs.weapon);
      loadLevel(RANGE, RANGE.spawn);
    },
    setAlive(alive) { me.alive = alive; },
    removePlayersExcept(ids) {
      for (const id of others.keys()) if (!ids.includes(id)) { scene.remove(others.get(id).mesh); others.delete(id); }
    },
    snap(list) {
      for (const [id, pos, yaw, alive, pitch, crouch, weapon] of list) {
        const p = others.get(id);
        if (!p) continue;
        const moved = Math.hypot(pos[0] - p.target.x, pos[2] - p.target.z) / 0.05;
        p.speed += (Math.min(moved, 8) - p.speed) * 0.5;
        p.target.set(...pos);
        p.mesh.rotation.y = yaw;
        Object.assign(p, { pitch, alive, crouch });
        if (weapon !== p.soldier.weapon && WEAPONS[weapon]) p.soldier.setWeapon(weapon);
      }
    },
    shot(id, ends) {
      const p = others.get(id);
      if (!p) return;
      muzzleFlash(p.soldier.gun);
      const muzzle = p.soldier.gun.muzzle.getWorldPosition(new THREE.Vector3());
      for (const e of ends) { tracer(muzzle.toArray(), e); bulletHole(e); }
      const kind = p.soldier.weapon;
      playAt(SOUNDS.shot[kind], muzzle, SHOT_VOLUME[kind] * 2);
    },
    hitmark,
    hurtFrom,
    killOther(id) { if (others.has(id)) others.get(id).alive = false; },
    respawn(isMe, id, pos) {
      if (isMe) {
        Object.assign(me, { alive: true, crouch: false });
        setPos(pos);
        resetGuns(gs.weapon);
      } else if (others.has(id)) {
        const p = others.get(id);
        p.target.set(...pos);
        p.mesh.position.set(...pos);
        p.alive = true;
      }
    },
    dispose() {
      renderer.setAnimationLoop(null);
      clearInterval(posTimer);
      controls.unlock();
      controls.dispose();
      cleanups.forEach(f => f());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

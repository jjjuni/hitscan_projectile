import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { MAP, EYE, CROUCH_EYE, MAX_HP, RESPAWN_MS, rayAABB, rayPlayer } from './shared/map.js';
import { WEAPONS, SWITCH_MS } from './shared/weapons.js';

const LAG_MS = 150; // slack for client/server timer drift on fire rate, reload and switch
const fullMags = () => Object.fromEntries(Object.entries(WEAPONS).map(([k, w]) => [k, w.mag]));
function settleReload(c, now) {
  if (c.reloadUntil && now >= c.reloadUntil) { c.mag[c.weapon] = WEAPONS[c.weapon].mag; c.reloadUntil = 0; }
}

const PORT = process.env.PORT || 3000;
const DEV = process.argv.includes('--dev');
const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist'); // output of `npm run build`
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
};
const SERVE_CLIENT = DEV || fs.existsSync(PUB); // without dist/ this is a game-server-only deploy (client hosted elsewhere)
if (!SERVE_CLIENT) console.log('dist/ not found: running as game server only.');

let vite; // dev only: Vite serves and hot-reloads the React client from this same server
const server = http.createServer((req, res) => {
  if (vite) return vite.middlewares(req, res);
  if (!SERVE_CLIENT) { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('game server ok'); } // host health checks
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  const file = path.join(PUB, p === '/' ? 'index.html' : p);
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const clients = new Map(); // id -> client
const rooms = new Map();   // id -> room
let nextId = 1;

const send = (c, msg) => c.ws.readyState === 1 && c.ws.send(JSON.stringify(msg));
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const isVec = (v, n) => Array.isArray(v) && v.length === n && v.every(Number.isFinite);
const err = (c, msg) => send(c, { t: 'error', msg });

const roomInfo = r => ({ id: r.id, title: r.title, locked: !!r.password, killLimit: r.killLimit, mode: r.mode, playing: r.playing, count: r.players.size });
const roomDetail = r => ({
  ...roomInfo(r), hostId: r.hostId,
  players: [...r.players].map(id => { const c = clients.get(id); return { id, nick: c.nick, team: c.team, ready: c.ready }; }),
});
const members = r => [...r.players].map(id => clients.get(id));
const teamCount = (r, team) => members(r).filter(c => c.team === team).length;
const toRoom = (r, msg) => members(r).forEach(c => send(c, msg));
const randomSpawn = team => [...MAP.spawns[team][Math.floor(Math.random() * MAP.spawns[team].length)]];

function broadcastLobby() {
  const list = [...rooms.values()].map(roomInfo);
  for (const c of clients.values()) if (c.nick && !c.room) send(c, { t: 'rooms', rooms: list });
}
function syncRoom(r) {
  toRoom(r, { t: 'room', room: roomDetail(r) });
  broadcastLobby();
}

function join(c, r) {
  c.team = teamCount(r, 'A') <= teamCount(r, 'B') ? 'A' : 'B';
  c.ready = false;
  c.room = r;
  r.players.add(c.id);
  syncRoom(r);
}

function leave(c) {
  const r = c.room;
  if (!r) return;
  r.players.delete(c.id);
  c.room = null;
  c.ready = false;
  if (!r.players.size) { rooms.delete(r.id); return broadcastLobby(); }
  if (r.hostId === c.id) r.hostId = r.players.values().next().value;
  if (r.playing && (!teamCount(r, 'A') || !teamCount(r, 'B'))) return endGame(r, teamCount(r, 'A') ? 'A' : 'B');
  syncRoom(r);
}

function endGame(r, winner) {
  r.playing = false;
  members(r).forEach(c => { c.ready = false; });
  toRoom(r, { t: 'end', winner, score: r.score });
  syncRoom(r);
}

const handlers = {
  nick(c, m) {
    const n = str(m.name, 16);
    if (!n) return err(c, '닉네임을 입력하세요.');
    c.nick = n;
    send(c, { t: 'welcome', id: c.id, nick: n });
    send(c, { t: 'rooms', rooms: [...rooms.values()].map(roomInfo) });
  },
  create(c, m) {
    if (!c.nick || c.room) return;
    const password = m.secret ? str(m.password, 20) : '';
    if (m.secret && !password) return err(c, '비밀번호를 입력하세요.');
    const killLimit = Math.round(Number(m.killLimit));
    if (!(killLimit >= 1 && killLimit <= 100)) return err(c, '킬 수는 1~100 사이여야 합니다.');
    const r = {
      id: nextId++, title: str(m.title, 30) || `${c.nick}의 방`, password, killLimit,
      mode: 'hitscan', hostId: c.id, players: new Set(), playing: false, score: { A: 0, B: 0 }, game: 0,
    };
    rooms.set(r.id, r);
    join(c, r);
  },
  join(c, m) {
    if (!c.nick || c.room) return;
    const r = rooms.get(m.id);
    if (!r) return err(c, '존재하지 않는 방입니다.');
    if (r.playing) return err(c, '게임이 진행 중인 방입니다.');
    if (r.players.size >= 8) return err(c, '방이 가득 찼습니다.');
    if (r.password && r.password !== String(m.password ?? '')) return err(c, '비밀번호가 틀렸습니다.');
    join(c, r);
  },
  leave(c) { leave(c); },
  team(c, m) {
    const r = c.room;
    if (!r || r.playing || !['A', 'B'].includes(m.team) || c.team === m.team) return;
    if (teamCount(r, m.team) >= 4) return err(c, '해당 팀이 가득 찼습니다.');
    c.team = m.team;
    c.ready = false;
    syncRoom(r);
  },
  ready(c) {
    const r = c.room;
    if (!r || r.playing || r.hostId === c.id) return;
    c.ready = !c.ready;
    syncRoom(r);
  },
  start(c) {
    const r = c.room;
    if (!r || r.playing || r.hostId !== c.id) return;
    if (!teamCount(r, 'A') || !teamCount(r, 'B')) return err(c, '양 팀에 최소 1명씩 있어야 합니다.');
    if (members(r).some(p => p.id !== r.hostId && !p.ready)) return err(c, '모든 인원이 READY 해야 합니다.');
    r.playing = true;
    r.score = { A: 0, B: 0 };
    r.game++;
    const idx = { A: 0, B: 0 };
    for (const p of members(r)) {
      Object.assign(p, {
        hp: MAX_HP, alive: true, yaw: 0, pitch: 0, crouch: false, pos: [...MAP.spawns[p.team][idx[p.team]++]],
        weapon: 'rifle', mag: fullMags(), lastShot: 0, reloadUntil: 0, switchAt: 0,
      });
    }
    toRoom(r, { t: 'start', room: roomDetail(r), players: members(r).map(p => ({ id: p.id, pos: p.pos })) });
    broadcastLobby();
  },
  // shortcut: client-authoritative movement (no speed/wall checks), move simulation to server if cheating matters.
  pos(c, m) {
    if (!c.room?.playing || !c.alive || !isVec(m.p, 3) || !Number.isFinite(m.yaw) || !Number.isFinite(m.pitch)) return;
    c.pos = m.p;
    c.yaw = m.yaw;
    c.pitch = Math.max(-1.6, Math.min(1.6, m.pitch));
    c.crouch = !!m.crouch;
  },
  weapon(c, m) {
    if (!c.room?.playing || !c.alive || !Object.hasOwn(WEAPONS, m.w) || c.weapon === m.w) return;
    c.weapon = m.w;
    c.reloadUntil = 0;
    c.switchAt = Date.now();
  },
  reload(c) {
    if (!c.room?.playing || !c.alive || c.reloadUntil) return;
    const w = WEAPONS[c.weapon];
    if (c.mag[c.weapon] < w.mag) c.reloadUntil = Date.now() + w.reloadMs - LAG_MS;
  },
  // Hitscan: server traces each pellet from the shooter's last known eye position.
  // shortcut: spread is applied by the client and only the pellet count is checked; validate cone server-side if cheating matters.
  shoot(c, m) {
    const r = c.room;
    if (!r?.playing || !c.alive || !Array.isArray(m.dirs)) return;
    const w = WEAPONS[c.weapon];
    const now = Date.now();
    settleReload(c, now);
    if (c.reloadUntil || c.mag[c.weapon] <= 0) return;
    if (now - c.lastShot < w.fireMs - LAG_MS || now - c.switchAt < SWITCH_MS - LAG_MS) return;
    const dirs = m.dirs.slice(0, w.pellets).filter(d => isVec(d, 3) && Math.hypot(...d) > 0);
    if (!dirs.length) return;
    c.lastShot = now;
    c.mag[c.weapon]--;
    const o = [c.pos[0], c.pos[1] + (c.crouch ? CROUCH_EYE : EYE), c.pos[2]];
    const ends = [], dmg = new Map(); // target -> { amount, head }
    for (const raw of dirs) {
      const len = Math.hypot(...raw);
      const d = raw.map(v => v / len);
      let best = w.range, hit = null;
      for (const b of MAP.walls) best = Math.min(best, rayAABB(o, d, b));
      for (const p of members(r)) {
        if (p === c || !p.alive || p.team === c.team) continue;
        const h = rayPlayer(o, d, p.pos, p.crouch);
        if (h && h.t < best) { best = h.t; hit = { p, head: h.head }; }
      }
      ends.push(o.map((v, i) => v + d[i] * best));
      if (!hit) continue;
      const cur = dmg.get(hit.p) ?? { amount: 0, head: false };
      cur.amount += w.damage * (hit.head ? w.headMul : 1);
      cur.head ||= hit.head;
      dmg.set(hit.p, cur);
    }
    toRoom(r, { t: 'shot', id: c.id, e: ends });
    for (const [hit, { amount, head }] of dmg) {
      if (!hit.alive) continue;
      hit.hp -= Math.round(amount);
      send(c, { t: 'hitmark', head, kill: hit.hp <= 0 });
      if (hit.hp > 0) { send(hit, { t: 'hp', hp: hit.hp, by: c.id }); continue; }
      hit.alive = false;
      r.score[c.team]++;
      toRoom(r, { t: 'kill', killer: c.id, victim: hit.id, weapon: c.weapon, head, score: r.score });
      if (r.score[c.team] >= r.killLimit) return endGame(r, c.team);
      const game = r.game;
      setTimeout(() => {
        if (r.game !== game || !r.playing || hit.room !== r) return;
        Object.assign(hit, { hp: MAX_HP, alive: true, crouch: false, pos: randomSpawn(hit.team), mag: fullMags(), reloadUntil: 0 });
        toRoom(r, { t: 'respawn', id: hit.id, pos: hit.pos });
      }, RESPAWN_MS);
    }
  },
};

if (DEV) {
  const { createServer } = await import('vite');
  vite = await createServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
}
// Game traffic lives on /ws; other upgrades (Vite's hot reload in dev) are left to their own handlers.
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (new URL(req.url, 'http://x').pathname === '/ws') wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  else if (!DEV) socket.destroy();
});
wss.on('connection', ws => {
  const c = { id: nextId++, ws, nick: '', room: null, team: 'A', ready: false };
  clients.set(c.id, c);
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (m && Object.hasOwn(handlers, m.t)) handlers[m.t](c, m);
  });
  ws.on('close', () => { leave(c); clients.delete(c.id); });
});

// Position snapshots, 20Hz.
setInterval(() => {
  for (const r of rooms.values()) {
    if (r.playing) toRoom(r, { t: 'snap', p: members(r).map(c => [c.id, c.pos, c.yaw, c.alive, c.pitch, c.crouch, c.weapon]) });
  }
}, 50);

server.listen(PORT, () => console.log(`http://localhost:${PORT}${DEV ? ' (dev)' : ''}`));

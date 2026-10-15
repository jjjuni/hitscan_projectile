import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ViteDevServer } from 'vite';
import { MAP, EYE, CROUCH_EYE, MAX_HP, RESPAWN_MS, rayAABB, rayPlayer, type Team, type Vec3 } from './shared/map.ts';
import { WEAPONS, SWITCH_MS, isWeapon, fullMags, type WeaponKind } from './shared/weapons.ts';
import type { ClientMsg, RoomDetail, RoomInfo, Score, ServerMsg } from './shared/protocol.ts';

interface Room {
  id: number;
  title: string;
  password: string;
  killLimit: number;
  mode: 'hitscan';
  hostId: number;
  players: Set<number>;
  playing: boolean;
  score: Score;
  game: number; // bumps every match so stale respawn timers can tell
}
interface Client {
  id: number;
  ws: WebSocket;
  nick: string;
  room: Room | null;
  team: Team;
  ready: boolean;
  // match state
  hp: number;
  alive: boolean;
  pos: Vec3;
  yaw: number;
  pitch: number;
  crouch: boolean;
  weapon: WeaponKind;
  mag: Record<WeaponKind, number>;
  lastShot: number;
  reloadUntil: number;
  switchAt: number;
}
// Incoming JSON is untrusted: every field is checked before use.
type Incoming = { [K in keyof UnionToFields<ClientMsg>]?: unknown };
type UnionToFields<U> = { [K in U extends unknown ? keyof U : never]: unknown };

const LAG_MS = 150; // slack for client/server timer drift on fire rate, reload and switch
function settleReload(c: Client, now: number) {
  if (c.reloadUntil && now >= c.reloadUntil) { c.mag[c.weapon] = WEAPONS[c.weapon].mag; c.reloadUntil = 0; }
}

const PORT = Number(process.env.PORT) || 3000;
const DEV = process.argv.includes('--dev');
const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist'); // output of `npm run build`
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
};
const SERVE_CLIENT = DEV || fs.existsSync(PUB); // without dist/ this is a game-server-only deploy (client hosted elsewhere)
if (!SERVE_CLIENT) console.log('dist/ not found: running as game server only.');

let vite: ViteDevServer | undefined; // dev only: Vite serves and hot-reloads the React client from this same server
const server = http.createServer((req, res) => {
  if (vite) return vite.middlewares(req, res);
  if (!SERVE_CLIENT) { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('game server ok'); } // host health checks
  let p: string;
  try { p = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  const file = path.join(PUB, p === '/' ? 'index.html' : p);
  if (!file.startsWith(PUB + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const clients = new Map<number, Client>();
const rooms = new Map<number, Room>();
let nextId = 1;

const send = (c: Client, msg: ServerMsg) => c.ws.readyState === 1 && c.ws.send(JSON.stringify(msg));
const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isVec = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(isNum);
const isTeam = (v: unknown): v is Team => v === 'A' || v === 'B';
const err = (c: Client, msg: string) => send(c, { t: 'error', msg });

const roomInfo = (r: Room): RoomInfo => ({ id: r.id, title: r.title, locked: !!r.password, killLimit: r.killLimit, mode: r.mode, playing: r.playing, count: r.players.size });
const members = (r: Room) => [...r.players].map(id => clients.get(id)!);
const roomDetail = (r: Room): RoomDetail => ({
  ...roomInfo(r), hostId: r.hostId,
  players: members(r).map(c => ({ id: c.id, nick: c.nick, team: c.team, ready: c.ready })),
});
const teamCount = (r: Room, team: Team) => members(r).filter(c => c.team === team).length;
const toRoom = (r: Room, msg: ServerMsg) => members(r).forEach(c => send(c, msg));
const randomSpawn = (team: Team): Vec3 => [...MAP.spawns[team][Math.floor(Math.random() * MAP.spawns[team].length)]];

function broadcastLobby() {
  const list = [...rooms.values()].map(roomInfo);
  for (const c of clients.values()) if (c.nick && !c.room) send(c, { t: 'rooms', rooms: list });
}
function syncRoom(r: Room) {
  toRoom(r, { t: 'room', room: roomDetail(r) });
  broadcastLobby();
}

function join(c: Client, r: Room) {
  c.team = teamCount(r, 'A') <= teamCount(r, 'B') ? 'A' : 'B';
  c.ready = false;
  c.room = r;
  r.players.add(c.id);
  syncRoom(r);
}

function leave(c: Client) {
  const r = c.room;
  if (!r) return;
  r.players.delete(c.id);
  c.room = null;
  c.ready = false;
  if (!r.players.size) { rooms.delete(r.id); return broadcastLobby(); }
  if (r.hostId === c.id) r.hostId = r.players.values().next().value!;
  if (r.playing && (!teamCount(r, 'A') || !teamCount(r, 'B'))) return endGame(r, teamCount(r, 'A') ? 'A' : 'B');
  syncRoom(r);
}

function endGame(r: Room, winner: Team) {
  r.playing = false;
  members(r).forEach(c => { c.ready = false; });
  toRoom(r, { t: 'end', winner, score: r.score });
  syncRoom(r);
}

const handlers: Record<ClientMsg['t'], (c: Client, m: Incoming) => void> = {
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
    const r: Room = {
      id: nextId++, title: str(m.title, 30) || `${c.nick}의 방`, password, killLimit,
      mode: 'hitscan', hostId: c.id, players: new Set(), playing: false, score: { A: 0, B: 0 }, game: 0,
    };
    rooms.set(r.id, r);
    join(c, r);
  },
  join(c, m) {
    if (!c.nick || c.room) return;
    const r = rooms.get(Number(m.id));
    if (!r) return err(c, '존재하지 않는 방입니다.');
    if (r.playing) return err(c, '게임이 진행 중인 방입니다.');
    if (r.players.size >= 8) return err(c, '방이 가득 찼습니다.');
    if (r.password && r.password !== String(m.password ?? '')) return err(c, '비밀번호가 틀렸습니다.');
    join(c, r);
  },
  leave(c) { leave(c); },
  team(c, m) {
    const r = c.room;
    if (!r || r.playing || !isTeam(m.team) || c.team === m.team) return;
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
      } satisfies Partial<Client>);
    }
    toRoom(r, { t: 'start', room: roomDetail(r), players: members(r).map(p => ({ id: p.id, pos: p.pos })) });
    broadcastLobby();
  },
  // shortcut: client-authoritative movement (no speed/wall checks), move simulation to server if cheating matters.
  pos(c, m) {
    if (!c.room?.playing || !c.alive || !isVec(m.p) || !isNum(m.yaw) || !isNum(m.pitch)) return;
    c.pos = m.p;
    c.yaw = m.yaw;
    c.pitch = Math.max(-1.6, Math.min(1.6, m.pitch));
    c.crouch = !!m.crouch;
  },
  weapon(c, m) {
    if (!c.room?.playing || !c.alive || !isWeapon(m.w) || c.weapon === m.w) return;
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
    const dirs = (m.dirs as unknown[]).slice(0, w.pellets).filter(isVec).filter(d => Math.hypot(...d) > 0);
    if (!dirs.length) return;
    c.lastShot = now;
    c.mag[c.weapon]--;
    const o: Vec3 = [c.pos[0], c.pos[1] + (c.crouch ? CROUCH_EYE : EYE), c.pos[2]];
    const ends: Vec3[] = [];
    const dmg = new Map<Client, { amount: number; head: boolean }>();
    for (const raw of dirs) {
      const len = Math.hypot(...raw);
      const d = raw.map(v => v / len) as Vec3;
      let best = w.range;
      let hit: { p: Client; head: boolean } | null = null;
      for (const b of MAP.walls) best = Math.min(best, rayAABB(o, d, b));
      for (const p of members(r)) {
        if (p === c || !p.alive || p.team === c.team) continue;
        const h = rayPlayer(o, d, p.pos, p.crouch);
        if (h && h.t < best) { best = h.t; hit = { p, head: h.head }; }
      }
      ends.push(o.map((v, i) => v + d[i] * best) as Vec3);
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
  if (new URL(req.url ?? '/', 'http://x').pathname === '/ws') wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  else if (!DEV) socket.destroy();
});
wss.on('connection', (ws: WebSocket) => {
  const c: Client = {
    id: nextId++, ws, nick: '', room: null, team: 'A', ready: false,
    hp: MAX_HP, alive: false, pos: [0, 0, 0], yaw: 0, pitch: 0, crouch: false,
    weapon: 'rifle', mag: fullMags(), lastShot: 0, reloadUntil: 0, switchAt: 0,
  };
  clients.set(c.id, c);
  ws.on('message', raw => {
    let m: unknown;
    try { m = JSON.parse(String(raw)); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const t = (m as Incoming).t;
    if (typeof t === 'string' && Object.hasOwn(handlers, t)) handlers[t as ClientMsg['t']](c, m as Incoming);
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

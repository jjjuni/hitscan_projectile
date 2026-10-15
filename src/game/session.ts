import { MAX_HP, type Team } from '../../shared/map.ts';
import type { ClientMsg, ServerMsg } from '../../shared/protocol.ts';
import { getState, setState, type FeedItem } from '../store.ts';
import type { Engine, EngineHooks, Mode } from './engine.ts';

export const TEAM_NAME: Record<Team, string> = { A: 'RED', B: 'BLUE' };

// Game server address. Set VITE_WS_URL at build time when the client is hosted apart from the server (e.g. Vercel).
const WS_URL = import.meta.env.VITE_WS_URL || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

// Glue between the server, the engine and the UI store.
let ws: WebSocket | undefined;
let engine: Engine;
export const send = (m: ClientMsg) => { if (ws?.readyState === 1) ws.send(JSON.stringify(m)); };
export const engineHooks: EngineHooks = {
  send,
  onAmmo: ammo => setState({ ammo }),
  onRangeHit: () => setState(s => ({ rangeHits: s.rangeHits + 1 })),
};
export function attachEngine(e: Engine) { engine = e; }

function setMode(mode: Mode) {
  setState({ mode });
  engine.setMode(mode);
}
const nickOf = (id: number | null) => getState().room?.players.find(p => p.id === id);
let centerT: ReturnType<typeof setTimeout> | undefined;
function center(text: string, ms?: number) {
  clearTimeout(centerT);
  setState({ center: text });
  if (ms) centerT = setTimeout(() => setState({ center: '' }), ms);
}
let feedId = 0;
function pushFeed(m: Extract<ServerMsg, { t: 'kill' }>) {
  const item: FeedItem = { id: ++feedId, killer: nickOf(m.killer), victim: nickOf(m.victim), weapon: m.weapon, head: m.head };
  setState(s => ({ feed: [item, ...s.feed].slice(0, 6) }));
  setTimeout(() => setState(s => ({ feed: s.feed.filter(f => f !== item) })), 5000);
}

export function connect(nick: string) {
  ws = new WebSocket(WS_URL);
  ws.onopen = () => send({ t: 'nick', name: nick });
  ws.onmessage = e => {
    const m = JSON.parse(e.data) as ServerMsg;
    (on[m.t] as ((m: ServerMsg) => void) | undefined)?.(m);
  };
  ws.onclose = () => { alert('서버와 연결이 끊겼습니다.'); location.reload(); };
}

export const actions = {
  create: (f: { title: string; secret: boolean; password: string; killLimit: number | string }) => send({ t: 'create', ...f }),
  join: (id: number, password: string) => send({ t: 'join', id, password }),
  team: (team: Team) => send({ t: 'team', team }),
  ready: () => send({ t: 'ready' }),
  start: () => send({ t: 'start' }),
  leave() {
    send({ t: 'leave' });
    setState({ roomResult: '' });
    setMode('lobby');
  },
};

// One handler per server message type; the compiler checks each gets the right fields.
const on: { [K in ServerMsg['t']]: (m: Extract<ServerMsg, { t: K }>) => void } = {
  welcome(m) {
    setState({ myId: m.id, nick: m.nick });
    setMode('lobby');
  },
  error(m) { alert(m.msg); },
  rooms(m) { setState({ rooms: m.rooms }); },
  room(m) {
    const { mode } = getState();
    setState({ room: m.room });
    if (mode === 'game') return engine.removePlayersExcept(m.room.players.map(p => p.id));
    if (mode !== 'room') setState({ roomResult: '' });
    setMode('room');
  },
  start(m) {
    setState({ room: m.room, score: { A: 0, B: 0 }, hp: MAX_HP, roomResult: '' });
    const { myId } = getState();
    engine.startMatch(myId!, m.players.map(p => ({ ...p, team: nickOf(p.id)!.team })));
    setMode('game');
    center(`${TEAM_NAME[nickOf(myId)!.team]} 팀입니다. 화면을 클릭해 시작하세요`, 2500);
  },
  snap(m) { engine.snap(m.p); },
  shot(m) { engine.shot(m.id, m.e); },
  hitmark(m) { engine.hitmark(m.head, m.kill); },
  hp(m) {
    setState({ hp: m.hp });
    engine.hurtFrom(m.by);
  },
  kill(m) {
    setState({ score: m.score });
    pushFeed(m);
    if (m.victim === getState().myId) {
      engine.hurtFrom(m.killer);
      engine.setAlive(false);
      setState({ hp: 0 });
      center('사망했습니다. 3초 후 다시 출발합니다');
    } else engine.killOther(m.victim);
  },
  respawn(m) {
    const isMe = m.id === getState().myId;
    engine.respawn(isMe, m.id, m.pos);
    if (isMe) {
      setState({ hp: MAX_HP });
      center('');
    }
  },
  end(m) {
    setState({ score: m.score });
    const won = nickOf(getState().myId)?.team === m.winner;
    center(`${TEAM_NAME[m.winner]} 팀 승리! ${won ? '🎉' : ''}`);
    engine.setAlive(false);
    setTimeout(() => {
      center('');
      engine.backToRange();
      setState({ roomResult: `지난 경기: ${TEAM_NAME[m.winner]} 승리 (${m.score.A} : ${m.score.B})` });
      setMode('room');
    }, 3000);
  },
};

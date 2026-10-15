import { useSyncExternalStore } from 'react';
import type { WeaponKind } from '../shared/weapons.ts';
import type { RoomDetail, RoomInfo, RoomPlayer, Score } from '../shared/protocol.ts';
import type { Mode } from './game/engine.ts';

export interface FeedItem { id: number; killer?: RoomPlayer; victim?: RoomPlayer; weapon: WeaponKind; head: boolean }
export interface State {
  mode: Mode;
  myId: number | null;
  nick: string;
  rooms: RoomInfo[];
  room: RoomDetail | null;
  roomResult: string;
  score: Score;
  hp: number;
  ammo: { weapon: WeaponKind; mag: number; reloading: boolean };
  feed: FeedItem[];
  center: string;
  rangeHits: number;
}

// One app-wide state object. The network session and the engine write it; components read it with useStore.
let state: State = {
  mode: 'range',
  myId: null,
  nick: '',
  rooms: [],
  room: null,
  roomResult: '',
  score: { A: 0, B: 0 },
  hp: 100,
  ammo: { weapon: 'rifle', mag: 30, reloading: false },
  feed: [],
  center: '',
  rangeHits: 0,
};
const subs = new Set<() => void>();

export const getState = () => state;
export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subs.forEach(f => f());
}
const subscribe = (cb: () => void) => { subs.add(cb); return () => { subs.delete(cb); }; };
// Selectors must return existing values (not new objects) so React can compare them.
export const useStore = <T,>(select: (s: State) => T) => useSyncExternalStore(subscribe, () => select(state));

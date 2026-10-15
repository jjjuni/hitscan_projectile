import { useSyncExternalStore } from 'react';

// One app-wide state object. The network session and the engine write it; components read it with useStore.
let state = {
  mode: 'range', // range | lobby | room | game
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
const subs = new Set();

export const getState = () => state;
export function setState(patch) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  subs.forEach(f => f());
}
const subscribe = cb => { subs.add(cb); return () => subs.delete(cb); };
// Selectors must return existing values (not new objects) so React can compare them.
export const useStore = select => useSyncExternalStore(subscribe, () => select(state));

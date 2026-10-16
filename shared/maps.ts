import { YARD, type GameMap } from './map.ts';
import { TOWN } from './town.ts';

export const MAPS = { yard: YARD, town: TOWN } satisfies Record<string, GameMap>;
export type MapId = keyof typeof MAPS;
export const MAP_IDS = Object.keys(MAPS) as MapId[];
export const isMapId = (v: unknown): v is MapId => typeof v === 'string' && Object.hasOwn(MAPS, v);

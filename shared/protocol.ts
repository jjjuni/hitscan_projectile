// Every WebSocket message between client and server, in one place.
import type { Team, Vec3 } from './map.ts';
import type { WeaponKind } from './weapons.ts';

export type Score = Record<Team, number>;

export interface RoomInfo {
  id: number;
  title: string;
  locked: boolean;
  killLimit: number;
  mode: 'hitscan';
  playing: boolean;
  count: number;
}
export interface RoomPlayer { id: number; nick: string; team: Team; ready: boolean }
export interface RoomDetail extends RoomInfo { hostId: number; players: RoomPlayer[] }

// Per-player state in a 20Hz snapshot.
export type Snap = [id: number, pos: Vec3, yaw: number, alive: boolean, pitch: number, crouch: boolean, weapon: WeaponKind];

export type ServerMsg =
  | { t: 'welcome'; id: number; nick: string }
  | { t: 'error'; msg: string }
  | { t: 'rooms'; rooms: RoomInfo[] }
  | { t: 'room'; room: RoomDetail }
  | { t: 'start'; room: RoomDetail; players: { id: number; pos: Vec3 }[] }
  | { t: 'snap'; p: Snap[] }
  | { t: 'shot'; id: number; e: Vec3[] }
  | { t: 'hitmark'; head: boolean; kill: boolean }
  | { t: 'hp'; hp: number; by: number }
  | { t: 'kill'; killer: number; victim: number; weapon: WeaponKind; head: boolean; score: Score }
  | { t: 'respawn'; id: number; pos: Vec3 }
  | { t: 'end'; winner: Team; score: Score };

export type ClientMsg =
  | { t: 'nick'; name: string }
  | { t: 'create'; title: string; secret: boolean; password: string; killLimit: number | string }
  | { t: 'join'; id: number; password: string }
  | { t: 'leave' }
  | { t: 'team'; team: Team }
  | { t: 'ready' }
  | { t: 'start' }
  | { t: 'pos'; p: Vec3; yaw: number; pitch: number; crouch: boolean }
  | { t: 'weapon'; w: WeaponKind }
  | { t: 'reload' }
  | { t: 'shoot'; dirs: Vec3[] };

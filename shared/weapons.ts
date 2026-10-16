// Shared by client and server. Times in ms, spread/kick in radians.
export type WeaponKind = 'rifle' | 'smg' | 'shotgun' | 'sniper';

export interface Weapon {
  name: string;
  mag: number;
  fireMs: number;
  reloadMs: number;
  auto: boolean;
  pellets: number;
  damage: number;
  headMul: number;
  range: number;
  spread: number;     // hip-fire cone
  adsSpread: number;  // aimed cone
  kick: number;       // vertical camera recoil per shot
  kickH: number;      // random horizontal recoil
  recover: number;    // how fast the aim settles back after firing
  adsFov: number;
  adsMs: number;
  speed: number;      // movement multiplier
  scope?: boolean;
}

export const WEAPONS: Record<WeaponKind, Weapon> = {
  rifle: {
    name: 'M4A1', mag: 30, fireMs: 85, reloadMs: 2200, auto: true, pellets: 1,
    damage: 22, headMul: 2, range: 200,
    spread: 0.03, adsSpread: 0.003, kick: 0.011, kickH: 0.005, recover: 7,
    adsFov: 50, adsMs: 180, speed: 0.95,
  },
  smg: {
    name: 'MP5', mag: 30, fireMs: 70, reloadMs: 1900, auto: true, pellets: 1,
    damage: 15, headMul: 1.75, range: 70,
    spread: 0.035, adsSpread: 0.012, kick: 0.007, kickH: 0.006, recover: 9,
    adsFov: 60, adsMs: 140, speed: 1.05,
  },
  shotgun: {
    name: 'M870', mag: 6, fireMs: 850, reloadMs: 3000, auto: false, pellets: 9,
    damage: 14, headMul: 1.5, range: 30,
    spread: 0.075, adsSpread: 0.055, kick: 0.06, kickH: 0.012, recover: 5,
    adsFov: 62, adsMs: 200, speed: 0.95,
  },
  sniper: {
    name: 'M24', mag: 5, fireMs: 1400, reloadMs: 3200, auto: false, pellets: 1,
    damage: 90, headMul: 2, range: 300,
    spread: 0.2, adsSpread: 0, kick: 0.09, kickH: 0.012, recover: 9,
    adsFov: 15, adsMs: 300, speed: 0.85, scope: true,
  },
};
export const SLOTS: WeaponKind[] = ['rifle', 'smg', 'shotgun', 'sniper'];
export const SWITCH_MS = 350;
export const isWeapon = (v: unknown): v is WeaponKind => typeof v === 'string' && Object.hasOwn(WEAPONS, v);
export const fullMags = () => Object.fromEntries(SLOTS.map(k => [k, WEAPONS[k].mag])) as Record<WeaponKind, number>;

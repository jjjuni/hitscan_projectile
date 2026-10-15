// Shared by client and server. Times in ms, spread/kick in radians.
// spread: hip-fire cone, adsSpread: aimed cone, kick: vertical camera recoil per shot, kickH: random horizontal.
export const WEAPONS = {
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
    damage: 11, headMul: 1.5, range: 30,
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
export const SLOTS = ['rifle', 'smg', 'shotgun', 'sniper'];
export const SWITCH_MS = 350;

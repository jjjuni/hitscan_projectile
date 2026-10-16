// "Town": enterable two-storey buildings, a rooftop, doors, and weapons to pick up. Team B gets the point mirror of team A's half.
import { mirror, mirrorPos, type Box, type Door, type GameMap, type Material, type PickupSpot } from './map.ts';

const H = 3.2;        // storey height
const T = 0.25;       // wall thickness
const SLAB = 0.2;     // floor slab thickness
const STEPS = 11, RUN = 0.32, STAIR_W = 1.2; // 11 steps of 0.29m: each one is under STEP, so stairs are walked up

type Side = 'n' | 's' | 'w' | 'e'; // n/s = the z0/z1 walls, w/e = the x0/x1 walls
interface Opening { side: Side; floor: number; at: number; w: number; y0: number; y1: number; door?: boolean }
interface Stairs { floor: number; x: number; z: number; dir: '+x' | '-x' | '+z' | '-z' } // (x, z) = corner where the first step starts
interface Building { x0: number; z0: number; x1: number; z1: number; floors: number; roof?: boolean; openings: Opening[]; stairs: Stairs[] }
type Rect = [x0: number, z0: number, x1: number, z1: number];

const door = (side: Side, at: number): Opening => ({ side, floor: 0, at, w: 1.2, y0: 0, y1: 2.2, door: true });
const win = (side: Side, floor: number, at: number): Opening => ({ side, floor, at, w: 1.4, y0: 1.0, y1: 2.1 });

// A rectangle minus a hole, as up to four rectangles.
function cut(r: Rect, h?: Rect): Rect[] {
  if (!h) return [r];
  const [x0, z0, x1, z1] = r, [hx0, hz0, hx1, hz1] = h;
  return ([[x0, z0, hx0, z1], [hx1, z0, x1, z1], [hx0, z0, hx1, hz0], [hx0, hz1, hx1, z1]] as Rect[])
    .filter(([a, b, c, d]) => c - a > 0.01 && d - b > 0.01);
}

function stairs(s: Stairs): { steps: Box[]; hole: Rect } {
  const y0 = s.floor * H, rise = H / STEPS, len = STEPS * RUN;
  const steps: Box[] = [];
  for (let i = 0; i < STEPS; i++) {
    const a = i * RUN, b = (i + 1) * RUN, top = y0 + (i + 1) * rise;
    steps.push(
      s.dir === '+x' ? [s.x + a, y0, s.z, s.x + b, top, s.z + STAIR_W, 'stairs']
      : s.dir === '-x' ? [s.x - b, y0, s.z, s.x - a, top, s.z + STAIR_W, 'stairs']
      : s.dir === '+z' ? [s.x, y0, s.z + a, s.x + STAIR_W, top, s.z + b, 'stairs']
      : [s.x, y0, s.z - b, s.x + STAIR_W, top, s.z - a, 'stairs'],
    );
  }
  const hole: Rect = s.dir === '+x' ? [s.x, s.z, s.x + len, s.z + STAIR_W]
    : s.dir === '-x' ? [s.x - len, s.z, s.x, s.z + STAIR_W]
    : s.dir === '+z' ? [s.x, s.z, s.x + STAIR_W, s.z + len]
    : [s.x, s.z - len, s.x + STAIR_W, s.z];
  return { steps, hole };
}

export function building(b: Building): { walls: Box[]; doors: Door[] } {
  const walls: Box[] = [[b.x0, -0.5, b.z0, b.x1, 0.02, b.z1, 'slab']]; // ground-floor tiles
  const doors: Door[] = [];
  for (let f = 0; f < b.floors; f++) {
    const yb = f * H, yt = yb + H;
    for (const side of ['n', 's', 'w', 'e'] as Side[]) {
      const alongX = side === 'n' || side === 's';
      const [a0, a1] = alongX ? [b.x0, b.x1] : [b.z0 + T, b.z1 - T];
      const [c0, c1] = side === 'n' ? [b.z0, b.z0 + T] : side === 's' ? [b.z1 - T, b.z1] : side === 'w' ? [b.x0, b.x0 + T] : [b.x1 - T, b.x1];
      const box = (p0: number, p1: number, y0: number, y1: number, cc0 = c0, cc1 = c1, m: Material = 'plaster'): Box =>
        alongX ? [p0, y0, cc0, p1, y1, cc1, m] : [cc0, y0, p0, cc1, y1, p1, m];
      let cur = a0;
      for (const o of b.openings.filter(o => o.side === side && o.floor === f).sort((p, q) => p.at - q.at)) {
        const o0 = o.at - o.w / 2, o1 = o.at + o.w / 2;
        walls.push(box(cur, o0, yb, yt));
        if (o.y0 > 0) walls.push(box(o0, o1, yb, yb + o.y0));
        walls.push(box(o0, o1, yb + o.y1, yt));
        if (o.door) {
          const mid = (c0 + c1) / 2;
          doors.push({ box: box(o0, o1, yb, yb + o.y1, mid - 0.04, mid + 0.04), hinge: 'min' });
        }
        cur = o1;
      }
      walls.push(box(cur, a1, yb, yt));
    }
  }
  for (let f = 1; f <= b.floors; f++) { // upper floors and the roof, with a hole where the stairs come up
    const s = b.stairs.find(s => s.floor === f - 1);
    for (const [x0, z0, x1, z1] of cut([b.x0, b.z0, b.x1, b.z1], s && stairs(s).hole)) walls.push([x0, f * H - SLAB, z0, x1, f * H, z1, 'slab']);
  }
  for (const s of b.stairs) walls.push(...stairs(s).steps);
  if (b.roof) { // waist-high parapet around the roof
    const y0 = b.floors * H, y1 = y0 + 1;
    walls.push([b.x0, y0, b.z0, b.x1, y1, b.z0 + T, 'plaster'], [b.x0, y0, b.z1 - T, b.x1, y1, b.z1, 'plaster'],
      [b.x0, y0, b.z0 + T, b.x0 + T, y1, b.z1 - T, 'plaster'], [b.x1 - T, y0, b.z0 + T, b.x1, y1, b.z1 - T, 'plaster']);
  }
  return { walls, doors };
}

// --- team A half (z < 0) ---
const house = building({ // two-storey house by the left lane
  x0: -32, z0: -44, x1: -18, z1: -32, floors: 2,
  openings: [door('n', -25), door('s', -22), win('w', 0, -38), win('e', 0, -38),
    win('n', 1, -28), win('n', 1, -22), win('s', 1, -28), win('s', 1, -22), win('w', 1, -38), win('e', 1, -41), win('e', 1, -35)],
  stairs: [{ floor: 0, x: -30.4, z: -43.6, dir: '+x' }], // starts 1.35m off the west wall so there is room to step on
});
const tower = building({ // two storeys plus a rooftop overlooking mid
  x0: 8, z0: -34, x1: 24, z1: -18, floors: 2, roof: true,
  openings: [door('w', -26), door('s', 16), win('n', 0, 12), win('n', 0, 20), win('e', 0, -26),
    win('s', 1, 12), win('s', 1, 20), win('w', 1, -30), win('w', 1, -22), win('e', 1, -30), win('e', 1, -22), win('n', 1, 16)],
  stairs: [{ floor: 0, x: 22.4, z: -20, dir: '-z' }, { floor: 1, x: 9.5, z: -33.6, dir: '+x' }],
});
const halfWalls: Box[] = [
  ...house.walls, ...tower.walls,
  [-24.6, 0, -38.4, -23, 0.8, -37.6, 'table'], [13, 0, -24.4, 14.6, 0.8, -23.6, 'table'],
  // street cover
  [-12, 0, -40, -10.1, 1.5, -35.6, 'car'], [2, 0, -30, 6.4, 1.5, -28.1, 'car'],
  [26, 0, -46, 28.5, 2.6, -40, 'container'], [-6, 0, -22, -3.5, 2.6, -16, 'container'],
  [-4, 0, -50, 4, 0.9, -49.4, 'barrier'], [12, 0, -12, 17, 0.9, -11.4, 'barrier'],
  [-14, 0, -20, -12.6, 1.4, -18.6, 'crate'], [-12.6, 0, -20, -11.8, 0.8, -19.2, 'crate'], [30, 0, -14, 31.4, 1.4, -12.6, 'crate'],
  [-36, 0, -22, -31, 0.9, -21.4, 'sandbag'], [22, 0, -8, 27, 0.9, -7.4, 'sandbag'], [-16, 0, -46, -15, 1, -45, 'drum'],
];
const halfDoors = [...house.doors, ...tower.doors];
const halfPickups: PickupSpot[] = [
  { kind: 'shotgun', pos: [-23.8, 0.82, -38] },  // house, ground floor table
  { kind: 'smg', pos: [-21, H + 0.02, -36] },     // house, upstairs floor
  { kind: 'rifle', pos: [13.8, 0.82, -24] },      // tower, ground floor table
  { kind: 'shotgun', pos: [18, H + 0.02, -28] },  // tower, upstairs floor
];

// --- shared middle: a one-storey shop, symmetric under the point mirror ---
const shop = building({
  x0: -9, z0: -6, x1: 9, z1: 6, floors: 1,
  openings: [door('n', -4), door('s', 4), door('w', -2), door('e', 2), win('n', 0, 4), win('s', 0, -4), win('w', 0, 3), win('e', 0, -3)],
  stairs: [],
});

const flipDoor = (d: Door): Door => ({ box: mirror(d.box), hinge: d.hinge === 'min' ? 'max' : 'min' });
export const TOWN: GameMap = {
  name: '시가지',
  loadout: 'pickup',
  walls: [
    [-46, -1, -72, 46, 0, 72, 'floor'],
    [-41, 0, -67, 41, 6, -66, 'wall'], [-41, 0, 66, 41, 6, 67, 'wall'], [-41, 0, -66, -40, 6, 66, 'wall'], [40, 0, -66, 41, 6, 66, 'wall'],
    ...shop.walls, [-1, 0, -0.5, 1, 0.8, 0.5, 'table'],
    ...halfWalls, ...halfWalls.map(mirror),
  ],
  doors: [...shop.doors, ...halfDoors, ...halfDoors.map(flipDoor)],
  pickups: [{ kind: 'sniper', pos: [0, 0.82, 0] }, ...halfPickups, ...halfPickups.map(p => ({ kind: p.kind, pos: mirrorPos(p.pos) }))],
  lamps: [[-38.3, -52], [38.3, 52], [38.3, -30], [-38.3, 30], [-38.3, -8], [38.3, 8], [14, -44], [-14, 44], [-14, -24], [14, 24]],
  spawns: {
    A: [[-6, 0, -60], [-2, 0, -60], [2, 0, -60], [6, 0, -60]],
    B: [[6, 0, 60], [2, 0, 60], [-2, 0, 60], [-6, 0, 60]],
  },
};

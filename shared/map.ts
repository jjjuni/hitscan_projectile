// Shared by client and server. Boxes are [minX, minY, minZ, maxX, maxY, maxZ, material].
export type Vec3 = [number, number, number];
export type Material = 'floor' | 'wall' | 'concrete' | 'building' | 'barrier' | 'sandbag' | 'container' | 'crate' | 'drum' | 'target';
export type Box = [number, number, number, number, number, number, Material?];
export type Team = 'A' | 'B';

export const EYE = 1.6, PLAYER_H = 1.8, PLAYER_R = 0.35;
export const CROUCH_EYE = 1.05, CROUCH_H = 1.25, HEAD = 0.3;
export const MAX_HP = 100, RESPAWN_MS = 3000;

// Point mirror (x, z) -> (-x, -z): team B gets exactly team A's cover.
const mirror = (b: Box): Box => [-b[3], b[1], -b[5], -b[0], b[4], -b[2], b[6]];
// Team A half (z < 0). Lanes: left x<-12, mid, right x>8.
const half: Box[] = [
  // spawn cover
  [-14, 0, -40, -5, 3.5, -39.4, 'concrete'], [5, 0, -40, 14, 3.5, -39.4, 'concrete'],
  [-4, 0, -34, 4, 0.9, -33.4, 'barrier'],
  // buildings splitting the lanes
  [-14, 0, -30, -7, 6, -12, 'building'], [8, 0, -26, 14, 4.5, -18, 'building'],
  // mid lane
  [-3, 0, -28, -0.5, 2.6, -22, 'container'], [1, 0, -20, 7, 2.6, -17.5, 'container'],
  [3, 0, -10, 4.4, 1.4, -8.6, 'crate'], [4.4, 0, -10, 5.2, 0.8, -9.2, 'crate'],
  [-6, 0, -6, -3, 3, -5.4, 'concrete'], [-2, 0, -13, -1, 1, -12, 'drum'], [-1, 0, -13.2, 0, 1, -12.2, 'drum'],
  // left lane
  [-22, 0, -30, -20.6, 1.4, -28.6, 'crate'], [-20.6, 0, -30, -19.8, 0.8, -29.2, 'crate'],
  [-24, 0, -22, -19, 0.9, -21.4, 'sandbag'], [-19, 0, -18, -17.6, 1.4, -16.6, 'crate'],
  [-20, 0, -6, -14, 3, -5.4, 'concrete'], [-23.5, 0, -12, -22.5, 1, -11, 'drum'],
  // right lane
  [18, 0, -36, 20.5, 2.6, -30, 'container'], [18, 2.6, -35, 20.5, 5.2, -31, 'container'],
  [10, 0, -8, 12, 3, -2, 'concrete'], [16, 0, -16, 21, 0.9, -15.4, 'sandbag'],
  [21, 0, -24, 22, 1, -23, 'drum'], [22, 0, -24.3, 23, 1, -23.3, 'drum'],
];

export interface Level {
  walls: Box[];
  targets?: Box[];
  spawn?: Vec3;
  look?: Vec3;
}

export const MAP: Level & { spawns: Record<Team, Vec3[]> } = {
  walls: [
    [-40, -1, -70, 40, 0, 70, 'floor'],
    [-26, 0, -51, 26, 6, -50, 'wall'], [-26, 0, 50, 26, 6, 51, 'wall'], [-26, 0, -50, -25, 6, 50, 'wall'], [25, 0, -50, 26, 6, 50, 'wall'],
    [-3, 0, -1.25, 3, 2.6, 1.25, 'container'], [-1.5, 2.6, -1.25, 4.5, 5.2, 1.25, 'container'],
    ...half, ...half.map(mirror),
  ],
  spawns: {
    A: [[-4.5, 0, -46], [-1.5, 0, -46], [1.5, 0, -46], [4.5, 0, -46]],
    B: [[4.5, 0, 46], [1.5, 0, 46], [-1.5, 0, 46], [-4.5, 0, 46]],
  },
};

// Distance along ray o + d*t to box b, or Infinity if missed.
export function rayAABB(o: Vec3, d: Vec3, b: Box): number {
  let tmin = 0, tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    const inv = 1 / d[i];
    let t1 = ((b[i] as number) - o[i]) * inv, t2 = ((b[i + 3] as number) - o[i]) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (!(tmin <= tmax)) return Infinity;
  }
  return tmin;
}

// Body and head boxes for a player standing (or crouching) with feet at p.
export function hitBoxes(p: Vec3, crouch: boolean): { body: Box; head: Box } {
  const top = p[1] + (crouch ? CROUCH_H : PLAYER_H);
  return {
    body: [p[0] - PLAYER_R, p[1], p[2] - PLAYER_R, p[0] + PLAYER_R, top - HEAD, p[2] + PLAYER_R],
    head: [p[0] - 0.15, top - HEAD, p[2] - 0.15, p[0] + 0.15, top, p[2] + 0.15],
  };
}

// Nearest player hit along a ray: { t, head } or null. Head is checked as its own box.
export function rayPlayer(o: Vec3, d: Vec3, p: Vec3, crouch: boolean): { t: number; head: boolean } | null {
  const { body, head } = hitBoxes(p, crouch);
  const th = rayAABB(o, d, head), tb = rayAABB(o, d, body);
  if (th === Infinity && tb === Infinity) return null;
  return th <= tb ? { t: th, head: true } : { t: tb, head: false };
}

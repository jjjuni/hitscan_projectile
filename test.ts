import assert from 'node:assert';
import { rayAABB, rayPlayer, solids, STEP, PLAYER_R, type Box } from './shared/map.ts';
import { MAPS, MAP_IDS } from './shared/maps.ts';

const box: Box = [-1, 0, -1, 1, 2, 1];
assert.strictEqual(rayAABB([0, 1, 10], [0, 0, -1], box), 9);
assert.strictEqual(rayAABB([5, 1, 10], [0, 0, -1], box), Infinity);
assert.strictEqual(rayAABB([0, 1, 10], [0, 0, 1], box), Infinity); // behind

// head vs body vs over the head, standing and crouched
assert.strictEqual(rayPlayer([0, 1.7, 10], [0, 0, -1], [0, 0, 0], false)?.head, true);
assert.strictEqual(rayPlayer([0, 1.0, 10], [0, 0, -1], [0, 0, 0], false)?.head, false);
assert.strictEqual(rayPlayer([0, 1.7, 10], [0, 0, -1], [0, 0, 0], true), null);
assert.strictEqual(rayPlayer([0, 1.1, 10], [0, 0, -1], [0, 0, 0], true)?.head, true);

const inside = (p: number[], b: Box, r = 0) => p[0] > b[0] - r && p[0] < b[3] + r && p[2] > b[2] - r && p[2] < b[5] + r;
for (const id of MAP_IDS) {
  const map = MAPS[id];
  const closed = solids(map, []);
  // spawns must not start inside anything a player could collide with (the ground floor is fine)
  for (const s of [...map.spawns.A, ...map.spawns.B]) {
    for (const w of closed.slice(1)) assert.ok(!(inside(s, w, PLAYER_R) && w[1] < 1.8 && w[4] > STEP), `${id}: spawn ${s} in ${w}`);
  }
  // every weapon rests on a surface (floor, slab or table) right below it
  for (const p of map.pickups ?? []) {
    assert.ok(closed.some(w => inside(p.pos, w) && Math.abs(w[4] - p.pos[1]) < 0.1), `${id}: pickup ${p.kind} at ${p.pos} floats`);
  }
}

// town: stairs are walkable, doors come in mirrored pairs plus the shop's four
const town = MAPS.town;
const steps = town.walls.filter(w => w[6] === 'stairs');
assert.ok(steps.length > 0);
for (const s of steps) {
  const under = Math.max(0, ...steps.filter(o => o !== s && o[1] === s[1] && o[4] < s[4] && (Math.abs(o[3] - s[0]) < 1e-6 || Math.abs(o[0] - s[3]) < 1e-6 || Math.abs(o[5] - s[2]) < 1e-6 || Math.abs(o[2] - s[5]) < 1e-6)).map(o => o[4]));
  assert.ok(s[4] - Math.max(under, s[1]) <= STEP + 1e-6, `step rise too high at ${s}`);
}
// every flight needs standing room in front of its first step (a body 0.7m wide must fit there)
for (const first of steps.filter(s => s[4] - s[1] < 0.3)) {
  const cx = (first[0] + first[3]) / 2, cz = (first[2] + first[5]) / 2, y = first[1] + 0.05;
  const free = (x: number, z: number) => !town.walls.some(w => w[6] !== 'slab' && x + PLAYER_R > w[0] && x - PLAYER_R < w[3] && z + PLAYER_R > w[2] && z - PLAYER_R < w[5] && y < w[4] && y + 1.8 > w[1]);
  // the second step tells which way the flight climbs; probe just in front of the first step, opposite to that
  const touch = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  const next = steps.find(s => s !== first && s[1] === first[1] && s[4] > first[4] && (touch(s[0], first[3]) || touch(s[3], first[0]) || touch(s[2], first[5]) || touch(s[5], first[2])))!;
  const probe = touch(next[0], first[3]) ? [first[0] - 0.4, cz] : touch(next[3], first[0]) ? [first[3] + 0.4, cz]
    : touch(next[2], first[5]) ? [cx, first[2] - 0.4] : [cx, first[5] + 0.4];
  assert.ok(free(probe[0], probe[1]), `no room to step onto stairs at ${first}`);
}
assert.strictEqual(town.doors?.length, 4 + 2 * 4);
assert.strictEqual(town.loadout, 'pickup');
console.log('ok');

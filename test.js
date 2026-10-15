import assert from 'node:assert';
import { rayAABB, rayPlayer, MAP } from './shared/map.js';

const box = [-1, 0, -1, 1, 2, 1];
assert.strictEqual(rayAABB([0, 1, 10], [0, 0, -1], box), 9);
assert.strictEqual(rayAABB([5, 1, 10], [0, 0, -1], box), Infinity);
assert.strictEqual(rayAABB([0, 1, 10], [0, 0, 1], box), Infinity); // behind

// head vs body vs over the head, standing and crouched
assert.strictEqual(rayPlayer([0, 1.7, 10], [0, 0, -1], [0, 0, 0], false).head, true);
assert.strictEqual(rayPlayer([0, 1.0, 10], [0, 0, -1], [0, 0, 0], false).head, false);
assert.strictEqual(rayPlayer([0, 1.7, 10], [0, 0, -1], [0, 0, 0], true), null);
assert.strictEqual(rayPlayer([0, 1.1, 10], [0, 0, -1], [0, 0, 0], true).head, true);

// spawns must not start inside a wall
for (const s of [...MAP.spawns.A, ...MAP.spawns.B]) {
  for (const w of MAP.walls.slice(1)) {
    assert.ok(!(s[0] > w[0] - 0.35 && s[0] < w[3] + 0.35 && s[2] > w[2] - 0.35 && s[2] < w[5] + 0.35 && w[1] < 1.8), `spawn ${s} in ${w}`);
  }
}
console.log('ok');

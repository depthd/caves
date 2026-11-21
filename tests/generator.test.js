import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generate, routeAt, surfaceAt, validate } from '../src/generator.js';

test('a seed reproduces the cave and another seed changes it', () => {
  const first = generate('CHASM-014');
  assert.deepEqual(generate(first.seed), first);
  assert.notDeepEqual(generate('CHASM-015').nodes, first.nodes);
});

test('the two bridges, all samples, and exit are reachable along supported paths', () => {
  for (let i = 0; i < 150; i++) {
    const world = generate('CHASM-' + i);
    assert.deepEqual(validate(world), [], world.seed);
    assert.equal(world.edges.filter(edge => edge.kind === 'bridge').length, 2);
    const visited = new Set([world.nodes[0]]);
    for (const node of visited) {
      for (const edge of world.edges) {
        if (edge.a === node) visited.add(edge.b);
        if (edge.b === node) visited.add(edge.a);
      }
    }
    assert(visited.has(world.nodes.at(-1)), world.seed);
    assert(visited.has(world.room), world.seed);
    for (const sample of world.relics) assert(visited.has(world.nodes[sample.id]), world.seed);
    assert.equal(routeAt(world, world.length).y, world.nodes.at(-1).y);
    assert.equal(surfaceAt(world, 0, 100, 0), null);
  }
});

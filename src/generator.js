export function randomFor(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

export function generate(seed = 'CHASM-014') {
  const random = randomFor(`${seed}:layout:v1`);
  let angle = 1.15;
  const nodes = [];
  for (let i = 0; i < 23; i++) {
    if (i) angle -= [6, 14].includes(i) ? 2.25 : 0.40 + random() * 0.14;
    const radius = 18.6 + random() * 1.4;
    nodes.push({ id: i, x: Math.cos(angle) * radius, y: 24 - i * 2.25, z: Math.sin(angle) * radius, angle, radius });
  }
  const edges = nodes.slice(1).map((b, i) => ({
    id: i, a: nodes[i], b, width: [5, 13].includes(i) ? 2.8 : 3.6,
    kind: [5, 13].includes(i) ? 'bridge' : 'ledge',
  }));
  // An alternate path connects two non-adjacent nodes on the main route.
  const a = nodes[16], b = nodes[18];
  const middle = mix(a, b, 0.5);
  const room = { ...middle, x: middle.x * 0.66, z: middle.z * 0.66, id: 'side' };
  edges.push({ id: 22, a, b: room, width: 3.1, kind: 'ledge', optional: true });
  edges.push({ id: 23, a: room, b, width: 3.1, kind: 'ledge', optional: true });
  const lengths = edges.slice(0, 22).map(e => distance(e.a, e.b));
  return { seed, version: 1, nodes, edges, room, lengths, length: lengths.reduce((a, b) => a + b, 0), relics: [4, 11, 21].map(i => ({ ...nodes[i], id: i })) };
}

// Walkable surface query. Vertical filtering separates overlapping floors.
export function surfaceAt(world, x, z, previousY, maxStep = 0.7) {
  let best = null;
  for (const e of world.edges) {
    const dx = e.b.x - e.a.x, dz = e.b.z - e.a.z;
    const t = Math.max(0, Math.min(1, ((x - e.a.x) * dx + (z - e.a.z) * dz) / (dx * dx + dz * dz)));
    const p = mix(e.a, e.b, t);
    const lateral = Math.hypot(x - p.x, z - p.z);
    const delta = Math.abs(p.y - previousY);
    if (lateral <= e.width / 2 - 0.24 && delta <= maxStep && (!best || delta < best.delta)) best = { y: p.y, delta, edge: e.id };
  }
  for (const n of [...world.nodes, world.room]) {
    const delta = Math.abs(n.y - previousY);
    if (Math.hypot(x - n.x, z - n.z) <= 2.0 && delta <= maxStep && (!best || delta < best.delta)) best = { y: n.y, delta, edge: n.id };
  }
  return best;
}

export function routeAt(world, progress) {
  if (progress <= 0) return { ...world.nodes[0], edge: 0 };
  if (progress >= world.length) return { ...world.nodes.at(-1), edge: world.lengths.length - 1 };
  let remaining = progress;
  for (let i = 0; i < world.lengths.length; i++) {
    const length = world.lengths[i];
    if (remaining <= length || i === world.lengths.length - 1) return { ...mix(world.nodes[i], world.nodes[i + 1], Math.min(1, remaining / length)), edge: i };
    remaining -= length;
  }
}

export function validate(world) {
  const errors = [];
  for (const e of world.edges) {
    const slope = Math.abs(e.b.y - e.a.y) / Math.hypot(e.b.x - e.a.x, e.b.z - e.a.z);
    if (slope > 0.45) errors.push(`Steep edge ${e.id}: ${slope}`);
    if (e.width < 2.4) errors.push(`Narrow edge ${e.id}`);
    // Check the complete corridor centre, not just endpoint connectivity.
    let previous = e.a.y;
    for (let i = 0; i <= 100; i++) {
      const p = mix(e.a, e.b, i / 100);
      const support = surfaceAt(world, p.x, p.z, previous);
      if (!support || Math.abs(support.y - p.y) > 0.15) errors.push(`Unsupported edge ${e.id} at ${i}`);
      previous = p.y;
    }
  }
  return errors;
}

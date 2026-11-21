import * as T from 'three';
import { mix, randomFor } from './generator.js';

const up = new T.Vector3(0, 1, 0);
const vector = p => new T.Vector3(p.x, p.y, p.z);
const stoneColors = ['#36433f', '#45534b', '#343c39', '#4e5548', '#2b3937', '#514b42'];
const woodColors = ['#635141', '#544536', '#70604a', '#4b3f33'];
const amber = '#f4b365';

function makeCliff(random) {
  const positions = [], colors = [], rings = [];
  const segments = 72, layers = 32;
  for (let row = 0; row <= layers; row++) {
    const points = [];
    for (let col = 0; col < segments; col++) {
      const a = col * Math.PI * 2 / segments + (row % 2) * 0.03;
      const ridge = Math.sin(a * 7 + row * 0.22) * 1.33 + Math.sin(a * 13 - row * 0.13) * 0.57;
      const r = 25.5 + ridge + (random() - 0.5) * 1.8;
      points.push([r * Math.cos(a), -41 + row * 2.58 + (random() - 0.5) * 1.6, r * Math.sin(a)]);
    }
    rings.push(points);
  }
  function face(a, b, c, shade) {
    const color = new T.Color(shade).multiplyScalar(0.73 + random() * 0.51);
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
  }
  for (let row = 0; row < layers; row++) {
    for (let col = 0; col < segments; col++) {
      const next = (col + 1) % segments;
      const shade = stoneColors[(row + Math.floor(random() * 3)) % stoneColors.length];
      const a = rings[row][col], b = rings[row][next], c = rings[row + 1][col], d = rings[row + 1][next];
      face(a, c, b, shade);
      face(b, c, d, shade);
    }
  }
  for (let col = 0; col < segments; col++) {
    const next = (col + 1) % segments;
    face([0, -41, 0], rings[0][col], rings[0][next], '#223531');
    face([0, 47, 0], rings[layers][next], rings[layers][col], '#263532');
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new T.Mesh(geo, new T.MeshLambertMaterial({vertexColors: true, side: T.DoubleSide}));
}

function batch(geometry, material) {
  const entries = [];
  const dummy = new T.Object3D();
  return {
    add(position, scale, color, quaternion = null) {
      dummy.position.copy(position);
      dummy.scale.set(...scale);
      dummy.quaternion.identity();
      if (quaternion) dummy.quaternion.copy(quaternion);
      dummy.updateMatrix();
      entries.push([dummy.matrix.clone(), color]);
    },
    mesh() {
      const mesh = new T.InstancedMesh(geometry, material, entries.length);
      entries.forEach(([matrix, color], i) => {
        mesh.setMatrixAt(i, matrix);
        mesh.setColorAt(i, new T.Color(color));
      });
      return mesh;
    },
  };
}

function groundBeam(group, a, b, width, thickness, color, extra = 0) {
  const direction = vector(b).sub(vector(a));
  // Align the deck's cross section horizontally even on diagonal slopes.
  const right = new T.Vector3(a.z - b.z, 0, b.x - a.x).negate().normalize();
  const forward = direction.clone().normalize();
  const normal = forward.clone().cross(right).normalize();
  const q = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(right, normal, forward));
  const center = vector(mix(a, b, 0.5)).addScaledVector(normal, -thickness / 2);
  group.add(center, [width, thickness, direction.length() + extra], color, q);
}

function strut(group, a, b, size, color) {
  const delta = b.clone().sub(a);
  const q = new T.Quaternion().setFromUnitVectors(up, delta.clone().normalize());
  group.add(a.clone().lerp(b, 0.5), [size, delta.length(), size], color, q);
}

export function createCave(world) {
  const root = new T.Group();
  const random = randomFor(world.seed + ':scenery:v1');
  const pick = items => items[Math.floor(random() * items.length)];
  const boxes = batch(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial());
  const discs = batch(new T.CylinderGeometry(1, 1, 1, 32), new T.MeshLambertMaterial());
  const rocks = batch(new T.IcosahedronGeometry(1, 0), new T.MeshLambertMaterial({flatShading: true}));
  const prisms = new T.CylinderGeometry(0.5, 0.65, 0.72, 5, 1);
  const tip = new T.ConeGeometry(0.5, 0.3, 5).translate(0, .51, 0);
  const crystals = batch(prisms, new T.MeshStandardMaterial({emissive: '#35d2bb', emissiveIntensity: 0.43, roughness: 0.34, flatShading: true}));
  const tips = batch(tip, new T.MeshStandardMaterial({emissive: '#62cfbd', emissiveIntensity: 0.45, roughness: 0.34, flatShading: true}));
  const bulbs = batch(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial());
  const dust = [];
  const glows = [];

  root.add(makeCliff(random));
  const rockyRotation = () => new T.Quaternion().setFromEuler(new T.Euler(random() * 1.5, random() * 6, random() * 1.5));
  for (let i = 0; i < 280; i++) {
    const a = random() * Math.PI * 2, r = 24 + random() * 4;
    const y = -39 + random() * 81;
    rocks.add(new T.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), [1 + random() * 2.4, 1.2 + random() * 4.6, 1.3 + random() * 2.8], pick(stoneColors), rockyRotation());
  }
  for (let i = 0; i < 38; i++) {
    const a = random() * Math.PI * 2, r = random() * 23;
    rocks.add(new T.Vector3(Math.cos(a) * r, -41, Math.sin(a) * r), [1 + random() * 3, 2 + random() * 4, 1 + random() * 3], pick(stoneColors), rockyRotation());
  }

  const lampPositions = [];
  function lamp(p) {
    const base = vector(p);
    boxes.add(base.clone().addScaledVector(up, .49), [.15, .96, .15], '#35332b');
    boxes.add(base.clone().addScaledVector(up, 1.16), [.43, .13, .43], '#3b3229');
    bulbs.add(base.clone().addScaledVector(up, .99), [.24, .27, .24], amber);
    const glow = base.clone().addScaledVector(up, .99);
    lampPositions.push(glow);
    glows.push({position: glow, size: 2.0, color: amber, opacity: 0.48});
  }

  for (const n of [...world.nodes, world.room]) {
    const center = vector(n);
    discs.add(center.clone().addScaledVector(up, -.25), [2.22, .5, 2.22], n.id === 'side' ? '#565548' : '#4c554c');
    if (n.id !== 'side') {
      const outward = new T.Vector3(n.x, 0, n.z).normalize();
      rocks.add(center.clone().addScaledVector(outward, 2.9).addScaledVector(up, -1.75), [3.3, 1.45, 2.7], pick(stoneColors), rockyRotation());
      if ([0, 2, 5, 6, 8, 10, 13, 14, 16, 18, 20, 22].includes(n.id)) lamp(center.clone().addScaledVector(outward, 1.96));
    }
  }

  for (const edge of world.edges) {
    const {a, b, width} = edge;
    const length = vector(a).distanceTo(vector(b));
    const right = new T.Vector3(a.z - b.z, 0, b.x - a.x).normalize();
    if (edge.kind === 'bridge') {
      const planks = Math.ceil(length / .55);
      for (let i = 0; i < planks; i++) {
        const start = mix(a, b, i / planks), end = mix(a, b, (i + 1) / planks);
        groundBeam(boxes, start, end, width + random() * .1, .18, pick(woodColors), -.02);
      }
      for (const side of [-1, 1]) {
        const offset = right.clone().multiplyScalar(side * (width / 2 + .03));
        const start = vector(a).add(offset), end = vector(b).add(offset);
        strut(boxes, start.clone().addScaledVector(up, -.33), end.clone().addScaledVector(up, -.33), .15, '#3e372e');
        strut(boxes, start.clone().addScaledVector(up, .84), end.clone().addScaledVector(up, .84), .065, '#796347');
        const posts = Math.ceil(length / 4);
        for (let i = 0; i <= posts; i++) {
          const p = start.clone().lerp(end, i / posts);
          strut(boxes, p.clone().addScaledVector(up, -.35), p.clone().addScaledVector(up, .94), .15, '#594736');
        }
      }
    } else {
      const pieces = Math.ceil(length / 2.2);
      for (let i = 0; i < pieces; i++) {
        groundBeam(boxes, mix(a, b, i / pieces), mix(a, b, (i + 1) / pieces), width, .52, pick(stoneColors), .016);
        const p = vector(mix(a, b, (i + .5) / pieces));
        rocks.add(p.addScaledVector(up, -1.35), [width * .51, .83, .95 + random() * .72], pick(stoneColors), rockyRotation());
      }
      if (!edge.optional && edge.id % 2 === 0) {
        const p = vector(mix(a, b, .5));
        const outward = new T.Vector3(p.x, 0, p.z).normalize();
        const pillar = p.clone().addScaledVector(outward, width / 2 + .15);
        strut(boxes, pillar.clone(), pillar.clone().addScaledVector(up, 2.7), .24, '#675741');
        strut(boxes, pillar.clone().addScaledVector(up, 2.7), pillar.clone().addScaledVector(up, 2.7).addScaledVector(outward, 4.4), .23, '#675741');
      }
    }
  }

  function cluster(origin, size, count, special = false) {
    for (let i = 0; i < count; i++) {
      const height = size * (i === 0 ? 1 : 0.3 + random() * .62);
      const width = height * (.22 + random() * .17);
      const q = new T.Quaternion().setFromEuler(new T.Euler((random() - .5) * .75, random() * 6, (random() - .5) * .75));
      const base = origin.clone().add(new T.Vector3((random() - .5) * size * .45, 0, (random() - .5) * size * .45));
      const position = base.addScaledVector(up.clone().applyQuaternion(q), height * .36);
      const color = pick(['#80d6c6', '#4ea6a2', '#a1e5c7', '#376e68']);
      crystals.add(position, [width, height, width], color, q);
      tips.add(position, [width, height, width], color, q);
    }
    glows.push({position: origin.clone().addScaledVector(up, size * .46), size: size * 2.3, color: '#40dcc7', opacity: special ? .63 : .39});
  }
  for (let i = 0; i < 35; i++) {
    const a = random() * Math.PI * 2;
    const r = 24.5 + random() * .7;
    const base = new T.Vector3(Math.cos(a) * r, -35 + random() * 68, Math.sin(a) * r);
    rocks.add(base.clone().addScaledVector(up, -.46), [1.65, .75, 2], '#34443c', rockyRotation());
    cluster(base, .85 + random() * 2.7, 3 + Math.floor(random() * 5));
  }

  const sampleLights = [];
  for (const n of world.relics) {
    const direction = new T.Vector3(n.x, 0, n.z).normalize();
    const p = vector(n).addScaledVector(direction, 1.75);
    cluster(p, 1.65, 6, true);
    const light = new T.PointLight('#57e8d0', 16, 10, 2);
    light.position.copy(p).addScaledVector(up, .9);
    root.add(light);
    sampleLights.push([n.id, light]);
  }

  for (const i of [0, 2, 4, 6, 8, 10]) {
    const light = new T.PointLight('#ffb76e', 30, 13, 2);
    light.position.copy(lampPositions[i]);
    root.add(light);
  }
  root.add(boxes.mesh(), discs.mesh(), rocks.mesh(), crystals.mesh(), tips.mesh(), bulbs.mesh());

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,0.72)');
  gradient.addColorStop(.24, 'rgba(255,255,255,0.20)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const halo = new T.CanvasTexture(canvas);
  for (const {position, size, color, opacity} of glows) {
    const sprite = new T.Sprite(new T.SpriteMaterial({map: halo, color, opacity, blending: T.AdditiveBlending, depthWrite: false}));
    sprite.position.copy(position);
    sprite.scale.set(size, size, 1);
    root.add(sprite);
  }
  for (let i = 0; i < 600; i++) {
    const a = random() * Math.PI * 2, r = Math.sqrt(random()) * 23;
    dust.push(Math.cos(a) * r, -35 + random() * 72, Math.sin(a) * r);
  }
  const dustGeo = new T.BufferGeometry();
  dustGeo.setAttribute('position', new T.Float32BufferAttribute(dust, 3));
  const motes = new T.Points(dustGeo, new T.PointsMaterial({size: .23, color: '#adc8b0', map: halo, transparent: true, opacity: .49, depthWrite: false}));
  root.add(motes);

  return {
    root,
    animate(time) { motes.rotation.y = time * .008; },
    collect(id) {
      const light = sampleLights.find(([sampleId]) => sampleId === id)?.[1];
      if (light) light.intensity = 4;
    },
    dispose() {
      root.traverse(object => {
        object.geometry?.dispose();
        object.material?.dispose();
        if (object.isInstancedMesh) object.dispose();
      });
      halo.dispose();
    },
  };
}

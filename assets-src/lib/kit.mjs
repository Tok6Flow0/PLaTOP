// Shared modelling kit for PLaTOP characters and decor.
// Everything is built from soft primitives so the art stays small, crisp at
// avatar size, and cheap to draw (no textures, no baked lights).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const materialCache = new Map();

/** Matte ceramic / clay / paper surface. `flat` gives origami-style facets. */
export function mat(color, { rough = 0.82, metal = 0, flat = false, name } = {}) {
  const key = `std:${color}:${rough}:${metal}:${flat}`;
  if (!materialCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    m.name = name || `m_${color.replace('#', '')}`;
    m.userData.flat = flat;
    materialCache.set(key, m);
  }
  return materialCache.get(key);
}

/** Unlit colour for glows, eye shines and lantern light. Exports as KHR_materials_unlit. */
export function glow(color, name) {
  const key = `unlit:${color}`;
  if (!materialCache.has(key)) {
    const m = new THREE.MeshBasicMaterial({ color });
    m.name = name || `glow_${color.replace('#', '')}`;
    materialCache.set(key, m);
  }
  return materialCache.get(key);
}

/** Gloss for visors and eyes. */
export function gloss(color, name) {
  return mat(color, { rough: 0.32, name: name || `gloss_${color.replace('#', '')}` });
}

// ---------------------------------------------------------------- geometry

const geoCache = new Map();
function cached(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

export const G = {
  sphere: (w = 16, h = 11) => cached(`sphere${w}x${h}`, () => new THREE.SphereGeometry(0.5, w, h)),
  hemi: (w = 16, h = 6) => cached(`hemi${w}x${h}`, () => new THREE.SphereGeometry(0.5, w, h, 0, Math.PI * 2, 0, Math.PI / 2)),
  cyl: (s = 16, top = 0.5, bottom = 0.5, open = false) => cached(`cyl${s}:${top}:${bottom}:${open}`, () => new THREE.CylinderGeometry(top, bottom, 1, s, 1, open)),
  cone: (s = 16) => cached(`cone${s}`, () => new THREE.ConeGeometry(0.5, 1, s)),
  box: () => cached('box', () => new THREE.BoxGeometry(1, 1, 1)),
  rbox: (w, h, d, r, seg = 3) => cached(`rbox${w}:${h}:${d}:${r}:${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, r)),
  torus: (r, t, rs = 6, ts = 16, arc = Math.PI * 2) => cached(`torus${r}:${t}:${rs}:${ts}:${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc)),
  capsule: (r, len, cs = 4, rs = 10) => cached(`cap${r}:${len}:${cs}:${rs}`, () => new THREE.CapsuleGeometry(r, len, cs, rs)),
  octa: () => cached('octa', () => new THREE.OctahedronGeometry(0.5)),
  lathe: (key, pts, segs = 18) => cached(`lathe:${key}:${segs}`, () => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs)),
  shape: (key, shape, depth = 0.02, bevel = 0.01) => cached(`shape:${key}`, () => {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 7 });
    g.translate(0, 0, -depth / 2);
    return g;
  }),
  custom: (key, make) => cached(`custom:${key}`, make),
};

/** Smooth lathe profile through control points (Catmull-Rom), closed at the poles. */
export function smoothProfile(points, samples = 24) {
  const curve = new THREE.SplineCurve(points.map(([r, y]) => new THREE.Vector2(r, y)));
  return curve.getPoints(samples).map((p) => [Math.max(0, p.x), p.y]);
}

// ---------------------------------------------------------------- building

/** Add a mesh to `parent`. pos/scale/rot are arrays; rot is Euler XYZ in radians. */
export function part(parent, geo, material, pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0], name) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(...pos);
  if (typeof scale === 'number') m.scale.setScalar(scale); else m.scale.set(...scale);
  m.rotation.set(...rot);
  if (name) m.name = name;
  parent.add(m);
  return m;
}

/** An animatable pivot. Only named nodes are animated; plain meshes get merged. */
export function node(parent, name, pos = [0, 0, 0], rot = [0, 0, 0], scale = 1) {
  const g = new THREE.Group();
  g.name = name;
  g.userData.animatable = true;
  g.position.set(...pos);
  g.rotation.set(...rot);
  if (typeof scale === 'number') g.scale.setScalar(scale); else g.scale.set(...scale);
  parent.add(g);
  return g;
}

/** Point on an ellipsoid surface (centre c, radii r) at yaw/pitch, with a quaternion facing outward. */
export function onEllipsoid(c, r, yaw, pitch, lift = 0) {
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  const p = new THREE.Vector3(dir.x * r[0], dir.y * r[1], dir.z * r[2]);
  // Surface normal of an ellipsoid.
  const n = new THREE.Vector3(p.x / (r[0] * r[0]), p.y / (r[1] * r[1]), p.z / (r[2] * r[2])).normalize();
  p.addScaledVector(n, lift).add(new THREE.Vector3(...c));
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  return { pos: p.toArray(), quat: q };
}

export function placeOn(obj, c, r, yaw, pitch, lift = 0) {
  const { pos, quat } = onEllipsoid(c, r, yaw, pitch, lift);
  obj.position.set(...pos);
  obj.quaternion.multiply(quat);
  return obj;
}

// ---------------------------------------------------------------- faces

const INK = '#2a2420';

/** Round shiny eye: dark oval + two specular dots. Faces +Z. */
export function dotEye(parent, name, pos, size = 0.07, { color = INK, shine = '#ffffff', depth = 0.45 } = {}) {
  const g = node(parent, name, pos);
  part(g, G.sphere(14, 10), gloss(color), [0, 0, 0], [size, size * 1.18, size * depth]);
  part(g, G.sphere(10, 8), glow(shine), [size * 0.2, size * 0.25, size * 0.2], [size * 0.32, size * 0.32, size * 0.12]);
  part(g, G.sphere(8, 6), glow(shine), [-size * 0.18, -size * 0.2, size * 0.2], [size * 0.14, size * 0.14, size * 0.06]);
  return g;
}

/** Happy closed eye "^" (arc opening downward). */
export function arcEye(parent, name, pos, size = 0.06, material = mat(INK, { rough: 0.5 }), thick = 0.22) {
  const g = node(parent, name, pos);
  part(g, G.torus(0.5, thick * 0.5, 5, 10, Math.PI), material, [0, -size * 0.25, 0], [size, size, size]);
  return g;
}

/** Plain arc part: up=true draws "^", up=false draws "‿". */
export function arcPart(parent, pos, size = 0.06, material = mat(INK, { rough: 0.5 }), thick = 0.22, up = true, squashY = 1) {
  return up
    ? part(parent, G.torus(0.5, thick * 0.5, 5, 10, Math.PI), material, [pos[0], pos[1] - size * 0.25, pos[2]], [size, size * squashY, size])
    : part(parent, G.torus(0.5, thick * 0.5, 5, 10, Math.PI), material, [pos[0], pos[1] + size * 0.2, pos[2]], [size, size * 0.7 * squashY, size], [0, 0, Math.PI]);
}

/** Hidden-at-rest node holding two sleepy "‿ ‿" eyes; clips reveal it with pose.vis('eyes_sleep', 1). */
export function sleepEyes(parent, posL, posR, size = 0.06, material = mat(INK, { rough: 0.5 }), thick = 0.2) {
  const g = hide(node(parent, 'eyes_sleep'));
  arcPart(g, posL, size, material, thick, false);
  arcPart(g, posR, size, material, thick, false);
  return g;
}

/** Mark a node as hidden at rest. Its design scale is kept for clips; the exported rest scale is ~0. */
export function hide(n) {
  n.userData.hidden = true;
  return n;
}

/** Small smile "‿". */
export function smile(parent, name, pos, size = 0.05, material = mat(INK, { rough: 0.5 }), thick = 0.22) {
  const g = node(parent, name, pos);
  part(g, G.torus(0.5, thick * 0.5, 5, 10, Math.PI), material, [0, size * 0.2, 0], [size, size * 0.8, size], [0, 0, Math.PI]);
  return g;
}

export function blush(parent, pos, size = 0.05, color = '#f0a596') {
  return part(parent, G.sphere(12, 8), mat(color, { rough: 1 }), pos, [size, size * 0.62, size * 0.2]);
}

// ---------------------------------------------------------------- fx

/** A flat "Z" made of three bars, in the XY plane. */
function zGlyph(parent, material, size) {
  const t = size * 0.18;
  part(parent, G.rbox(1, 1, 1, 0.3, 2), material, [0, size * 0.5, 0], [size, t, t]);
  part(parent, G.rbox(1, 1, 1, 0.3, 2), material, [0, -size * 0.5, 0], [size, t, t]);
  part(parent, G.rbox(1, 1, 1, 0.3, 2), material, [0, 0, 0], [size * 1.25, t, t], [0, 0, Math.atan2(size, size) ]);
}

/**
 * Three Zs that the Sleep clip floats upward. Hidden (scale ~0) at rest and parked
 * inside the body (restY) so they never inflate a loader's bounding box; Sleep lifts
 * them to the socket height y.
 */
export function zzz(parent, y, color = '#7d8fb3', restY = y * 0.5) {
  const fx = node(parent, 'fx_zzz', [0.12, restY, 0.05]);
  fx.userData.socketY = y;
  const m = glow(color, 'glow_zzz');
  for (let i = 0; i < 3; i++) {
    const z = hide(node(fx, `fx_z${i}`));
    zGlyph(z, m, 0.07 + i * 0.012);
  }
  return fx;
}

// ---------------------------------------------------------------- optimise

/**
 * Merge plain meshes that share a material under the same animatable parent,
 * baking their transforms. Keeps draw calls to roughly (animated nodes × colours).
 */
export function mergeStatic(root) {
  const holders = [];
  root.traverse((o) => { if (o === root || o.userData.animatable) holders.push(o); });
  for (const holder of holders) {
    const buckets = new Map();
    const collect = (obj, matrix) => {
      for (const child of [...obj.children]) {
        if (child.userData.animatable) {
          if (obj !== holder) throw new Error(`Animatable node ${child.name} is nested in a plain group; parent it to a node instead.`);
          continue;
        }
        child.updateMatrix();
        const m = new THREE.Matrix4().multiplyMatrices(matrix, child.matrix);
        if (child.isMesh) {
          const key = child.material.uuid;
          if (!buckets.has(key)) buckets.set(key, { material: child.material, geos: [] });
          const g = child.geometry.clone();
          g.applyMatrix4(m);
          if (m.determinant() < 0) flipWinding(g);
          buckets.get(key).geos.push(g);
        }
        collect(child, m);
        obj.remove(child);
      }
    };
    collect(holder, new THREE.Matrix4());
    for (const { material, geos } of buckets.values()) {
      const flat = material.userData?.flat;
      const prepared = geos.map((g) => {
        let x = g;
        for (const k of Object.keys(x.attributes)) if (k !== 'position' && k !== 'normal') x.deleteAttribute(k);
        if (flat) {
          x = x.index ? x.toNonIndexed() : x;
          x.computeVertexNormals();
        } else if (!x.index) {
          x = mergeVertices(x, 1e-5);
        }
        return x;
      });
      let merged = mergeGeometries(prepared, false);
      if (!flat) merged = mergeVertices(merged, 1e-5);
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = `${holder.name || 'root'}_${material.name}`;
      holder.add(mesh);
    }
  }
  return root;
}

function flipWinding(g) {
  if (g.index) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) { const a = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = a; }
    return g;
  }
  const attrs = [g.attributes.position, g.attributes.normal].filter(Boolean);
  for (const attr of attrs) {
    const arr = attr.array;
    for (let i = 0; i < arr.length; i += 9) {
      for (let k = 0; k < 3; k++) { const a = arr[i + 3 + k]; arr[i + 3 + k] = arr[i + 6 + k]; arr[i + 6 + k] = a; }
    }
  }
  return g;
}

export function triangleCount(root) {
  let n = 0;
  root.traverse((o) => { if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  return Math.round(n);
}

export function drawCalls(root) {
  let n = 0;
  root.traverse((o) => { if (o.isMesh) n++; });
  return n;
}

/** Capsule spanning two points (a limb). Returns the mesh. */
export function limb(parent, from, to, r, material, cs = 4, rs = 10) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const d = b.clone().sub(a);
  const len = Math.max(0.001, d.length());
  const m = new THREE.Mesh(G.capsule(r, len, cs, rs), material);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  parent.add(m);
  return m;
}

/** Fake radial glow: nested copies of a shape, brighter toward the centre. */
export function layeredGlow(parent, key, makeShape, colors, z = 0, step = 0.002) {
  colors.forEach((c, i) => {
    const s = 1 - i * (0.32 / Math.max(1, colors.length - 1));
    const g = G.shape(`${key}-${i}`, makeShape(s), 0.006, i === 0 ? 0.006 : 0);
    part(parent, g, glow(c), [0, i === 0 ? 0 : 0.012 * i, z + i * step]);
  });
}

import * as THREE from 'three';
import type { SceneKit } from './primitives';

export type CharacterForm = 'torso' | 'helmet' | 'owlBody' | 'owlHead' | 'wing' | 'tuft'
  | 'lanternGlass' | 'lanternCap' | 'lanternBase' | 'sphere' | 'bean' | 'detail' | 'limb' | 'ankle' | 'beak' | 'ring'
  | 'book' | 'cloak' | 'cape' | 'capePanel' | 'feather' | 'toe' | 'paperBody' | 'paperWing' | 'paperTail' | 'paperDisc' | 'pageFold' | 'hoodTip' | 'scroll'
  | 'spiritBody' | 'spiritHood' | 'spiritRelayHood' | 'merchantTorso' | 'swiftBody' | 'swiftHead' | 'swiftWingL' | 'swiftWingR'
  | 'owlBrowL' | 'owlBrowR' | 'featherFanL' | 'featherFanR' | 'breastFeathers' | 'hexGlass' | 'hexCap' | 'fineRing' | 'compassStar';
export type CharacterFinish = 'clay' | 'glaze' | 'ink' | 'brass' | 'amber' | 'paper' | 'feather';
type Tuple = [number, number, number];
interface CharacterResources {
  geometry: Map<string, THREE.BufferGeometry>;
  material: Map<string, THREE.MeshStandardMaterial>;
}

// Model resources belong to one office scene. Every cached surface is attached
// to its proxy and is released by the scene's existing recursive disposer.
const resources = new WeakMap<SceneKit, CharacterResources>();
function owned(kit: SceneKit): CharacterResources {
  let value = resources.get(kit);
  if (!value) { value = { geometry: new Map(), material: new Map() }; resources.set(kit, value); }
  return value;
}

function lathe(profile: Array<[number, number]>, segments = 24): THREE.BufferGeometry {
  // LatheGeometry supplies analytic profile normals shared across the two UV
  // edges. Recomputing them from triangles would split the front meridian and
  // turn a continuous glazed surface into two visibly different halves.
  return new THREE.LatheGeometry(profile.map(([radius, y]) => new THREE.Vector2(radius, y)), segments);
}

/** Restore continuous shading where a deformed sphere duplicates its UV seam. */
function smoothDeformedSurface(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.computeVertexNormals();
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  const coincident = new Map<string, { indices: number[]; sum: THREE.Vector3 }>();
  for (let i = 0; i < position.count; i++) {
    const key = `${Math.round(position.getX(i) * 1e6)}:${Math.round(position.getY(i) * 1e6)}:${Math.round(position.getZ(i) * 1e6)}`;
    let group = coincident.get(key);
    if (!group) { group = { indices: [], sum: new THREE.Vector3() }; coincident.set(key, group); }
    group.indices.push(i); group.sum.x += normal.getX(i); group.sum.y += normal.getY(i); group.sum.z += normal.getZ(i);
  }
  for (const group of coincident.values()) {
    if (group.indices.length < 2) continue;
    group.sum.normalize();
    group.indices.forEach(i => { normal.setXYZ(i, group.sum.x, group.sum.y, group.sum.z); });
  }
  return geometry;
}

/** Densely sample only broad clay contours; paper folds and metal lips stay authored. */
function softLathe(profile: Array<[number, number]>): THREE.BufferGeometry {
  const curve = new THREE.SplineCurve(profile.map(([radius, y]) => new THREE.Vector2(radius, y)));
  const points = curve.getPoints(16).map(point => [Math.max(0, point.x), point.y] as [number, number]);
  return lathe(points);
}

/** A soft, slightly squared helmet, with a continuous crown and cheeks. */
function helmet(owl = false): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(.5, 32, 20);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    // Move only the middle latitudes outward. The poles remain smooth and the
    // face has generous cheeks rather than a faceted cube or detached spheres.
    const cheek = 1 + (owl ? .07 : .06) * Math.max(0, 1 - (y * 2) ** 2);
    const back = !owl && z < 0 ? z * (1 - .15 * (z * 2) ** 2) : z;
    const jaw = !owl && y < -.1 ? 1 - .03 * (-.1 - y) / .4 : 1;
    position.setXYZ(i, x * cheek * jaw, y, back);
  }
  return smoothDeformedSurface(geometry);
}

/** Joined wing/ear surfaces taper to a rounded point, with no paper-thin edges. */
function petal(tuft = false): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(.5, tuft ? 12 : 16, tuft ? 8 : 12);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i), x = position.getX(i), z = position.getZ(i);
    const width = tuft ? .52 + .48 * (.5 - y) : .72 + .28 * (.5 - y);
    position.setXYZ(i, x * width, y, z * (tuft ? .72 : 1));
  }
  return smoothDeformedSurface(geometry);
}

/** Thick folded forms retain their creases through geometry, without a decal. */
function folded(points: Array<[number, number]>, depth = .16, ridge = .10): THREE.BufferGeometry {
  const vertices: number[] = [], indices: number[] = [];
  for (const [x, y] of points) vertices.push(x, y, depth * .5);
  const front = points.length; vertices.push(0, 0, depth * .5 + ridge);
  for (const [x, y] of points) vertices.push(x, y, -depth * .5);
  const back = vertices.length / 3; vertices.push(0, 0, -depth * .5);
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length, rear = front + 1;
    indices.push(i, next, front, rear + next, rear + i, back,
      i, rear + i, rear + next, i, rear + next, next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices);
  // Separate normals give paper its intentional fold planes. Ceramic forms
  // continue to use smooth analytical/averaged normals above.
  const faceted = geometry.toNonIndexed(); geometry.dispose(); faceted.computeVertexNormals(); return faceted;
}

function roundedBook(): THREE.BufferGeometry {
  const shape = new THREE.Shape(), radius = .13;
  shape.moveTo(-.5 + radius, -.5); shape.lineTo(.5 - radius, -.5);
  shape.quadraticCurveTo(.5, -.5, .5, -.5 + radius); shape.lineTo(.5, .5 - radius);
  shape.quadraticCurveTo(.5, .5, .5 - radius, .5); shape.lineTo(-.5 + radius, .5);
  shape.quadraticCurveTo(-.5, .5, -.5, .5 - radius); shape.lineTo(-.5, -.5 + radius);
  shape.quadraticCurveTo(-.5, -.5, -.5 + radius, -.5);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .80, steps: 1, bevelEnabled: true,
    bevelSegments: 3, bevelSize: .035, bevelThickness: .07, curveSegments: 5 });
  geometry.translate(0, 0, -.4); return geometry;
}

/** Open-backed cape follows the shoulders and flares into a rounded hem. */
function cape(): THREE.BufferGeometry {
  const vertices: number[] = [], indices: number[] = [], columns = 18, rows = 6;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, radius = .23 + .16 * t;
    for (let column = 0; column <= columns; column++) {
      const angle = Math.PI * (.37 + column / columns * 1.26);
      vertices.push(Math.sin(angle) * radius, .34 - t * .70,
        Math.cos(angle) * radius * .81 - .025 + Math.sin(t * Math.PI) * .018);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
        indices.push(a, d, b, a, c, d);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function feather(): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(.5, 8, 6), position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i), taper = .40 + .60 * (y + .5);
    position.setXYZ(i, position.getX(i) * taper, y < -.20 ? -.20 + (y + .20) * 1.27 : y, position.getZ(i));
  }
  return smoothDeformedSurface(geometry);
}

function polyhedron(vertices: Tuple[], faces: number[][]): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const face of faces) for (let i = 1; i < face.length - 1; i++) {
    for (const index of [face[0], face[i], face[i + 1]]) positions.push(...vertices[index]);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals(); return geometry;
}

function reflect(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const reflected = geometry.clone(), position = reflected.attributes.position;
  for (let i = 0; i < position.count; i += 3) {
    const a: Tuple = [-position.getX(i), position.getY(i), position.getZ(i)];
    const b: Tuple = [-position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1)];
    const c: Tuple = [-position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2)];
    position.setXYZ(i, ...a); position.setXYZ(i + 1, ...c); position.setXYZ(i + 2, ...b);
  }
  reflected.computeVertexNormals(); geometry.dispose(); return reflected;
}

function spiritHood(relay = false): THREE.BufferGeometry {
  const geometry = lathe([[0, -.54], [.30, -.50], [.43, -.39], [.50, -.18], [.49, .04], [.42, .28], [.29, .45], [.12, .53], [0, .55]], 24);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i), upper = Math.max(0, y + .10);
    position.setXYZ(i, position.getX(i) + (relay ? -.24 : -.14) * upper ** 1.3,
      y + (relay ? .10 : .04) * position.getX(i), position.getZ(i) + upper * .035);
  }
  return smoothDeformedSurface(geometry);
}

function sweptBrow(left = false): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [], length = 10, around = 7;
  for (let row = 0; row <= length; row++) {
    const t = row / length, radius = .080 * (1 - t) ** .70 + .003;
    for (let i = 0; i < around; i++) {
      const a = i / around * Math.PI * 2;
      positions.push((left ? -1 : 1) * (.29 * t + Math.cos(a) * radius * .30),
        -.035 + .14 * t * t + Math.cos(a) * radius, Math.sin(a) * radius * .75);
      if (row < length) { const next = (i + 1) % around, a0 = row * around + i, b = row * around + next, c = a0 + around, d = b + around; indices.push(a0, b, d, a0, d, c); }
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
  if (left) { const index = geometry.index!; for (let i = 0; i < index.count; i += 3) { const b = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, b); } }
  geometry.computeVertexNormals(); return geometry;
}

/** One cached surface owns each layered fan; detail does not add pose matrices. */
function featherFan(sign: number, breast = false): THREE.BufferGeometry {
  const sculpt = feather(), source = sculpt.toNonIndexed(), vertices: number[] = [], normals: number[] = [];
  sculpt.dispose();
  const count = breast ? 8 : 6, matrix = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3(), quaternion = new THREE.Quaternion();
  const point = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let featherIndex = 0; featherIndex < count; featherIndex++) {
    const row = Math.floor(featherIndex / (breast ? 3 : 2)), column = featherIndex % (breast ? 3 : 2);
    const x = breast ? (column - 1) * .125 : sign * (column * .065 - .025);
    quaternion.setFromEuler(new THREE.Euler(0, breast ? -x * 1.3 : 0, breast ? -x * .55 : -sign * (.20 + column * .18)));
    matrix.compose(new THREE.Vector3(x, breast ? .08 - row * .14 : .075 - row * .13,
      breast ? .025 - Math.abs(x) * .20 : .10 + column * .022), quaternion,
    new THREE.Vector3(breast ? .21 : .18, breast ? .27 : .33, .065)); normalMatrix.getNormalMatrix(matrix);
    for (let i = 0; i < source.attributes.position.count; i++) {
      point.fromBufferAttribute(source.attributes.position, i).applyMatrix4(matrix); normal.fromBufferAttribute(source.attributes.normal, i).applyMatrix3(normalMatrix).normalize();
      vertices.push(point.x, point.y, point.z); normals.push(normal.x, normal.y, normal.z);
    }
  }
  source.dispose(); const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); return geometry;
}

function makeGeometry(form: CharacterForm): THREE.BufferGeometry {
  switch (form) {
    case 'torso': return softLathe([[0, -.5], [.24, -.49], [.40, -.41], [.48, -.24], [.5, .03], [.46, .29], [.34, .46], [0, .5]]);
    case 'helmet': return helmet();
    case 'owlHead': return helmet(true);
    case 'owlBody': return softLathe([[0, -.5], [.25, -.47], [.42, -.30], [.5, -.02], [.48, .20], [.35, .42], [0, .5]]);
    case 'wing': return petal();
    case 'tuft': return petal(true);
    case 'lanternGlass': return lathe([[0, -.5], [.29, -.49], [.43, -.38], [.5, -.14], [.5, .18], [.42, .40], [.27, .49], [0, .5]]);
    case 'lanternCap': return lathe([[0, -.5], [.44, -.5], [.5, -.35], [.49, -.23], [.38, -.17], [.34, .01], [.25, .30], [.13, .47], [0, .5]]);
    case 'lanternBase': return lathe([[0, -.5], [.38, -.5], [.48, -.40], [.5, -.18], [.47, .02], [.38, .10], [.36, .36], [.28, .5], [0, .5]]);
    case 'limb': return lathe([[0, -.5], [.30, -.45], [.43, -.28], [.48, .04], [.5, .22], [.42, .40], [.22, .49], [0, .5]], 16);
    case 'ankle': return new THREE.CylinderGeometry(.42, .5, 1, 9);
    case 'sphere': return new THREE.SphereGeometry(.5, 24, 16);
    case 'bean': return new THREE.SphereGeometry(.5, 16, 10);
    case 'detail': return new THREE.SphereGeometry(.5, 12, 6);
    case 'beak': return lathe([[0, -.5], [.32, -.46], [.5, -.30], [.47, -.05], [.32, .20], [.12, .43], [0, .5]], 16);
    case 'ring': return new THREE.TorusGeometry(.5, .085, 8, 24);
    case 'book': return roundedBook();
    case 'cloak': return softLathe([[0, -.5], [.36, -.49], [.5, -.39], [.48, -.20], [.34, .12], [.21, .36], [.09, .49], [0, .54]]);
    case 'cape': return cape();
    case 'capePanel': return folded([[-.5, .5], [.5, .20], [.45, -.5], [-.15, -.09]], .08, .018);
    case 'feather': return feather();
    case 'toe': return new THREE.SphereGeometry(.5, 8, 6);
    case 'paperBody': return folded([[-.34, -.5], [.31, -.5], [.5, -.13], [.38, .31], [0, .5], [-.4, .29], [-.5, -.1]], .78, .13);
    case 'paperWing': return folded([[-.50, .43], [-.18, -.50], [.35, -.34], [.50, .36], [.12, .18]], .16, .14);
    case 'paperTail': return folded([[-.5, -.5], [0, -.26], [.5, -.5], [.27, .5], [-.27, .5]], .12, .07);
    case 'paperDisc': return folded([[-.5, -.15], [-.30, -.5], [.28, -.46], [.5, -.07], [.29, .42], [-.22, .5]], .06, .028);
    case 'pageFold': return folded([[-.5, .5], [.5, .5], [.5, -.5]], .04, .04);
    case 'hoodTip': return lathe([[0, -.5], [.49, -.5], [.43, -.32], [.30, -.12], [.21, .15], [.13, .36], [0, .6]], 16);
    case 'scroll': return new THREE.CylinderGeometry(.5, .5, 1, 12, 1, false, .12, Math.PI * 1.78);
    case 'spiritBody': return softLathe([[0, -.50], [.34, -.50], [.47, -.45], [.5, -.30], [.46, -.12], [.37, .12], [.30, .32], [.26, .46], [.16, .55], [0, .58]]);
    case 'spiritHood': return spiritHood();
    case 'spiritRelayHood': return spiritHood(true);
    case 'merchantTorso': return softLathe([[0, -.50], [.25, -.49], [.32, -.38], [.40, -.16], [.49, .16], [.50, .32], [.42, .46], [0, .5]]);
    case 'swiftBody': return polyhedron([[0, -.30, .16], [-.20, .11, .03], [.20, .11, .03], [0, .29, .04], [0, -.23, -.24], [0, .08, -.31], [0, -.02, .27]], [[0, 1, 6], [1, 3, 6], [3, 2, 6], [2, 0, 6], [0, 4, 1], [1, 4, 5], [1, 5, 3], [3, 5, 2], [2, 5, 4], [2, 4, 0]]);
    case 'swiftHead': return polyhedron([[0, .23, -.02], [-.17, .08, .10], [.17, .08, .10], [0, -.04, .23], [-.14, -.13, .07], [.14, -.13, .07], [0, -.02, -.17]], [[0, 1, 3], [0, 3, 2], [1, 4, 3], [3, 5, 2], [4, 5, 3], [0, 6, 1], [0, 2, 6], [1, 6, 4], [4, 6, 5], [5, 6, 2]]);
    case 'swiftWingL': return reflect(makeGeometry('swiftWingR'));
    case 'swiftWingR': return polyhedron([[0, .09, .10], [.72, .25, -.14], [.22, -.16, -.30], [.18, .055, -.035], [0, .075, .10], [.72, .235, -.14], [.22, -.175, -.30]], [[0, 3, 1], [1, 3, 2], [2, 3, 0], [4, 5, 6], [0, 1, 5, 4], [1, 2, 6, 5], [2, 0, 4, 6]]);
    case 'owlBrowL': return sweptBrow(true);
    case 'owlBrowR': return sweptBrow();
    case 'featherFanL': return featherFan(-1);
    case 'featherFanR': return featherFan(1);
    case 'breastFeathers': return featherFan(1, true);
    case 'hexGlass': return new THREE.CylinderGeometry(.36, .49, 1, 6);
    case 'hexCap': return new THREE.CylinderGeometry(.05, .5, 1, 6);
    case 'fineRing': return new THREE.TorusGeometry(.5, .027, 6, 28);
    case 'compassStar': return folded([[0, .5], [.07, .13], [.32, .32], [.13, .07], [.5, 0], [.13, -.07], [.32, -.32], [.07, -.13], [0, -.5], [-.07, -.13], [-.32, -.32], [-.13, -.07], [-.5, 0], [-.13, .07], [-.32, .32], [-.07, .13]], .03, .025);
  }
}

export function characterGeometry(kit: SceneKit, form: CharacterForm): THREE.BufferGeometry {
  const cache = owned(kit).geometry;
  let geometry = cache.get(form);
  if (!geometry) { geometry = makeGeometry(form); cache.set(form, geometry); }
  return geometry;
}

export function characterMaterial(kit: SceneKit, color: string, finish: CharacterFinish = 'clay'): THREE.MeshStandardMaterial {
  const cache = owned(kit).material, key = `${finish}:${color}`;
  let material = cache.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color,
      roughness: finish === 'ink' ? .32 : finish === 'glaze' ? .40 : finish === 'brass' ? .36 : finish === 'amber' ? .24 : finish === 'paper' ? .94 : finish === 'feather' ? .86 : .70,
      metalness: finish === 'brass' ? .36 : 0,
      ...(finish === 'amber' ? { emissive: '#ff9d2b', emissiveIntensity: .50 } : {}),
    });
    if (finish === 'ink') material.envMapIntensity = .65;
    if (finish === 'paper') material.envMapIntensity = .35;
    if (finish === 'feather') material.envMapIntensity = .42;
    cache.set(key, material);
  }
  return material;
}

export function characterMesh(kit: SceneKit, parent: THREE.Object3D, form: CharacterForm, color: string,
  position: Tuple, scale: Tuple, rotation?: Tuple, finish: CharacterFinish = 'clay'): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const mesh = new THREE.Mesh(characterGeometry(kit, form), characterMaterial(kit, color, finish));
  mesh.name = form;
  mesh.position.set(...position); mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

/** Fit an inset face to the helmet; the patch shares its curvature and normals. */
export function curvedFace(kit: SceneKit, parent: THREE.Object3D, color: string, width: number, height: number,
  offset: number, centre: Tuple = [0, 0, 0], finish: CharacterFinish = 'ink', surfaceRadii: Tuple = [.461, .38, .345], bubble = false): THREE.Mesh {
  const cache = owned(kit).geometry;
  const key = `face:${width}:${height}:${offset}:${centre.join(':')}:${surfaceRadii.join(':')}:${bubble}`;
  let geometry = cache.get(key);
  if (!geometry) {
    // Four continuous arcs give a rounded boundary at close range while using
    // fewer triangles than the old grid's visibly stair-stepped outline.
    const radius = Math.min(width, height) * .43, boundary: Array<[number, number]> = [];
    const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    corners.forEach(([sx, sy], corner) => {
      for (let step = 0; step < 8; step++) {
        const angle = (corner + step / 7) * Math.PI / 2;
        let x = sx * (width / 2 - radius) + Math.cos(angle) * radius;
        let y = sy * (height / 2 - radius) + Math.sin(angle) * radius;
        if (bubble && corner === 3 && step < 3) { x += width * .075 * (1 - step / 3); y -= height * .16 * (1 - step / 3); }
        boundary.push([x, y]);
      }
    });
    const vertices: number[] = [], normals: number[] = [], indices: number[] = [], rings = 6;
    const add = (x: number, y: number) => {
      const px = x + centre[0], py = y + centre[1];
      const surface = surfaceRadii[2] * Math.sqrt(Math.max(.05, 1 - (px / surfaceRadii[0]) ** 2 - (py / surfaceRadii[1]) ** 2));
      vertices.push(px, py, surface + offset + centre[2] + .010);
      const normal = new THREE.Vector3(px / surfaceRadii[0] ** 2, py / surfaceRadii[1] ** 2, surface / surfaceRadii[2] ** 2).normalize(); normals.push(normal.x, normal.y, normal.z);
    };
    add(0, 0);
    for (let row = 1; row <= rings; row++) boundary.forEach(([x, y]) => add(x * row / rings, y * row / rings));
    for (let i = 0; i < boundary.length; i++) {
      const next = (i + 1) % boundary.length;
      indices.push(0, 1 + i, 1 + next);
      for (let row = 1; row < rings; row++) {
        const a = 1 + (row - 1) * boundary.length + i, b = 1 + (row - 1) * boundary.length + next;
        const c = a + boundary.length, d = b + boundary.length;
        indices.push(a, c, d, a, d, b);
      }
    }
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); geometry.setIndex(indices); cache.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, characterMaterial(kit, color, finish));
  mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

/** One short shared tube forms a real curved smile instead of a painted blob. */
export function characterSmile(kit: SceneKit, parent: THREE.Object3D, color: string, width: number, depth: number, at: Tuple): void {
  const cache = owned(kit).geometry, key = `smile:${width}:${depth}`;
  let geometry = cache.get(key);
  if (!geometry) {
    const path = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => {
      const angle = Math.PI + i / 8 * Math.PI;
      return new THREE.Vector3(Math.cos(angle) * width, Math.sin(angle) * depth, 0);
    }));
    geometry = new THREE.TubeGeometry(path, 12, .008, 5, false); cache.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, characterMaterial(kit, color, 'ink')); mesh.position.set(...at); parent.add(mesh);
}

/** Small inlaid strokes share their tube surface across all scene characters. */
export function characterStroke(kit: SceneKit, parent: THREE.Object3D, color: string, points: Tuple[],
  radius = .008, finish: CharacterFinish = 'brass'): THREE.Mesh {
  const cache = owned(kit).geometry, key = `stroke:${radius}:${points.map(point => point.join(':')).join(';')}`;
  let geometry = cache.get(key);
  if (!geometry) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    geometry = new THREE.TubeGeometry(curve, Math.max(4, points.length * 2), radius, 4, false); cache.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, characterMaterial(kit, color, finish));
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

export function characterEyeArc(kit: SceneKit, parent: THREE.Object3D, color: string, at: Tuple,
  width = .045, height = .026, finish: CharacterFinish = 'ink'): THREE.Mesh {
  const mesh = characterStroke(kit, parent, color,
    [[-width, 0, 0], [-width * .6, height * .82, 0], [0, height, 0], [width * .6, height * .82, 0], [width, 0, 0]], .010, finish);
  mesh.position.set(...at); return mesh;
}

import * as THREE from 'three';
import type { SceneKit } from './primitives';

export type CharacterForm = 'torso' | 'helmet' | 'owlBody' | 'owlHead' | 'wing' | 'tuft'
  | 'lanternGlass' | 'lanternCap' | 'lanternBase' | 'sphere' | 'bean' | 'detail' | 'limb' | 'ankle' | 'beak' | 'ring';
export type CharacterFinish = 'clay' | 'glaze' | 'ink' | 'brass' | 'amber';
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

/** A soft, slightly squared helmet, with a continuous crown and cheeks. */
function helmet(owl = false): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(.5, 24, 16);
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

function makeGeometry(form: CharacterForm): THREE.BufferGeometry {
  switch (form) {
    case 'torso': return lathe([[0, -.5], [.24, -.49], [.40, -.41], [.48, -.24], [.5, .03], [.46, .29], [.34, .46], [0, .5]]);
    case 'helmet': return helmet();
    case 'owlHead': return helmet(true);
    case 'owlBody': return lathe([[0, -.5], [.25, -.47], [.42, -.30], [.5, -.02], [.48, .20], [.35, .42], [0, .5]]);
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
      roughness: finish === 'ink' ? .31 : finish === 'glaze' ? .40 : finish === 'brass' ? .46 : finish === 'amber' ? .25 : .66,
      metalness: finish === 'brass' ? .18 : 0,
      ...(finish === 'amber' ? { emissive: '#ff9d2b', emissiveIntensity: .50 } : {}),
    });
    cache.set(key, material);
  }
  return material;
}

export function characterMesh(kit: SceneKit, parent: THREE.Object3D, form: CharacterForm, color: string,
  position: Tuple, scale: Tuple, rotation?: Tuple, finish: CharacterFinish = 'clay'): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const mesh = new THREE.Mesh(characterGeometry(kit, form), characterMaterial(kit, color, finish));
  mesh.position.set(...position); mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

/** Fit an inset face to the helmet; the patch shares its curvature and normals. */
export function curvedFace(kit: SceneKit, parent: THREE.Object3D, color: string, width: number, height: number,
  offset: number, centre: Tuple = [0, 0, 0], finish: CharacterFinish = 'ink', surfaceRadii: Tuple = [.461, .38, .345]): THREE.Mesh {
  const cache = owned(kit).geometry;
  const key = `face:${width}:${height}:${offset}:${centre.join(':')}:${surfaceRadii.join(':')}`;
  let geometry = cache.get(key);
  if (!geometry) {
    const columns = 18, rows = 10, radius = Math.min(width, height) * .43;
    const vertices: number[] = [], indices: number[] = [];
    for (let row = 0; row <= rows; row++) {
      const y = -height / 2 + row / rows * height;
      const cornerY = Math.max(0, Math.abs(y) - (height / 2 - radius));
      const limit = width / 2 - radius + Math.sqrt(Math.max(0, radius * radius - cornerY * cornerY));
      for (let column = 0; column <= columns; column++) {
        const x = -limit + column / columns * limit * 2;
        const px = x + centre[0], py = y + centre[1];
        const surface = surfaceRadii[2] * Math.sqrt(Math.max(.05, 1 - (px / surfaceRadii[0]) ** 2 - (py / surfaceRadii[1]) ** 2));
        vertices.push(px, py, surface + offset + centre[2]);
        if (row < rows && column < columns) {
          const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
          indices.push(a, b, d, a, d, c);
        }
      }
    }
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); cache.set(key, geometry);
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

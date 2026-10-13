import * as THREE from 'three';
import { refineCharacterSurface, type SurfaceData } from './characterSurface';

export function surfaceData(geometry: THREE.BufferGeometry): SurfaceData {
  const attributes: SurfaceData['attributes'] = {};
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const array = new Float32Array(attribute.count * attribute.itemSize);
    for (let i = 0; i < attribute.count; i++) for (let j = 0; j < attribute.itemSize; j++) array[i * attribute.itemSize + j] = attribute.getComponent(i, j);
    attributes[name] = { size: attribute.itemSize, array };
  }
  // Fitted insets, paper creases and closed thin sheets keep their exact
  // authored edges. Inflating those planes independently breaks their fit.
  const curvature = geometry.userData.characterFitted || geometry.type === 'BufferGeometry' ? 0 : .5;
  return { attributes, curvature, ellipsoid: geometry.userData.characterEllipsoid, index: geometry.index ? Uint32Array.from(geometry.index.array) : Uint32Array.from({ length: geometry.attributes.position.count }, (_, i) => i) };
}

export function surfaceGeometry(data: SurfaceData): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(data.attributes)) geometry.setAttribute(name, new THREE.BufferAttribute(attribute.array, attribute.size));
  geometry.setIndex(new THREE.BufferAttribute(data.index, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Offline portrait generation uses the identical high-detail mesh, not a
 * separately enhanced illustration. The caller owns the returned geometries. */
export function refineCharacterModel(model: THREE.Object3D): () => void {
  const cache = new Map<string, THREE.BufferGeometry>();
  const originals: Array<{ mesh: THREE.Mesh; geometry: THREE.BufferGeometry }> = [];
  model.traverse(object => {
    const mesh = object as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const finish = mesh.material.userData.characterFinish ?? 'clay', key = `${mesh.geometry.uuid}:${finish}`;
    let geometry = cache.get(key);
    if (!geometry) { geometry = surfaceGeometry(refineCharacterSurface(surfaceData(mesh.geometry), finish)); cache.set(key, geometry); }
    originals.push({ mesh, geometry: mesh.geometry }); mesh.geometry = geometry;
  });
  return () => { originals.forEach(entry => { entry.mesh.geometry = entry.geometry; }); cache.forEach(geometry => geometry.dispose()); };
}

interface DetailActor { root: THREE.Object3D; model: THREE.Object3D; }
interface Part { source: THREE.Mesh; mesh: THREE.Mesh; layers: number; }
interface Resident { model: THREE.Object3D; root: THREE.Group; parts: Part[]; geometries: Set<THREE.BufferGeometry>; ready: boolean; failed: boolean; }
export const MAX_DETAILED_CHARACTERS = 3;

/** At most three near characters receive dense geometry. Worker construction
 * never blocks camera input. The same animation joints drive both tiers; this
 * class cannot schedule activity, choose a gesture or change an agent's path. */
export class CharacterDetail {
  private residents = new Map<DetailActor, Resident>();
  private worker?: Worker;
  private requests = new Map<number, (data?: SurfaceData) => void>();
  private requestId = 0;
  private disposed = false;
  private unavailable = false;
  private selected = new Set<DetailActor>();
  private point = new THREE.Vector3();
  private view = new THREE.Vector3();

  constructor(private scene: THREE.Scene, private actors: DetailActor[], private wake: () => void,
    private makeWorker = () => new Worker(new URL('./characterSurface.worker.ts', import.meta.url), { type: 'module' })) {}

  private refine(source: SurfaceData, finish: string): Promise<SurfaceData | undefined> {
    if (this.unavailable || this.disposed) return Promise.resolve(undefined);
    if (!this.worker) {
      try {
        this.worker = this.makeWorker();
        this.worker.onmessage = (event: MessageEvent<{ id: number; result?: SurfaceData }>) => {
          this.requests.get(event.data.id)?.(event.data.result); this.requests.delete(event.data.id);
        };
        this.worker.onerror = () => {
          this.unavailable = true; this.worker?.terminate(); this.worker = undefined;
          this.requests.forEach(resolve => resolve(undefined)); this.requests.clear();
        };
      } catch { this.unavailable = true; return Promise.resolve(undefined); }
    }
    return new Promise(resolve => {
      const id = ++this.requestId; this.requests.set(id, resolve);
      const transfer = [source.index.buffer, ...Object.values(source.attributes).map(attribute => attribute.array.buffer)];
      this.worker!.postMessage({ id, source, finish }, transfer);
    });
  }

  private async prepare(actor: DetailActor, resident: Resident): Promise<void> {
    const meshes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
    actor.model.traverse(object => { if ((object as THREE.Mesh).isMesh) meshes.push(object as typeof meshes[number]); });
    const cache = new Map<string, THREE.BufferGeometry>();
    for (const source of meshes) {
      if (Array.isArray(source.material) || (source as THREE.Mesh & { isSkinnedMesh?: boolean }).isSkinnedMesh) { resident.failed = true; return; }
      const finish = source.material.userData.characterFinish ?? 'clay', key = `${source.geometry.uuid}:${finish}`;
      let geometry = cache.get(key);
      if (!geometry) {
        const data = await this.refine(surfaceData(source.geometry), finish);
        if (this.disposed || this.residents.get(actor) !== resident) return;
        if (!data) { resident.failed = true; return; }
        geometry = surfaceGeometry(data); cache.set(key, geometry); resident.geometries.add(geometry);
      }
      const mesh = new THREE.Mesh(geometry, source.material);
      mesh.name = `${source.name}:close-surface`; mesh.matrixAutoUpdate = false; mesh.matrixWorldAutoUpdate = false;
      mesh.castShadow = source.castShadow; mesh.receiveShadow = source.receiveShadow;
      mesh.userData.characterDetailMesh = true;
      resident.root.add(mesh); resident.parts.push({ source, mesh, layers: source.layers.mask });
    }
    resident.ready = true; this.wake();
  }

  /** Before batch sync: select by projected size, with 20% LOD hysteresis. */
  select(camera: THREE.PerspectiveCamera, viewportHeight: number): void {
    const scale = viewportHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    const candidates: Array<{ actor: DetailActor; score: number }> = [];
    for (const actor of this.actors) {
      if (!actor.root.visible || actor.model.userData.assetStatus !== 'reference-model') continue;
      this.point.copy(actor.root.position); this.point.y += .7;
      this.view.copy(this.point).applyMatrix4(camera.matrixWorldInverse);
      const depth = -this.view.z, pixels = scale * 1.3 / depth;
      this.view.copy(this.point).project(camera);
      if (depth > 0 && pixels >= (this.selected.has(actor) ? 150 : 185) && Math.abs(this.view.x) < 1.2 && Math.abs(this.view.y) < 1.2) {
        candidates.push({ actor, score: pixels * (this.selected.has(actor) ? 1.12 : 1) });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    this.selected = new Set(candidates.slice(0, MAX_DETAILED_CHARACTERS).map(entry => entry.actor));
    for (const [actor, resident] of this.residents) if (!this.selected.has(actor) || actor.model !== resident.model) this.release(actor, resident);
    for (const actor of this.selected) {
      let resident = this.residents.get(actor);
      if (!resident && !this.unavailable) {
        const root = new THREE.Group(); root.name = 'close-character-surfaces'; root.visible = false; root.matrixAutoUpdate = false;
        resident = { model: actor.model, root, parts: [], geometries: new Set(), ready: false, failed: false };
        this.residents.set(actor, resident); this.scene.add(root); void this.prepare(actor, resident);
      }
      if (resident?.ready) {
        resident.root.visible = true;
        for (const part of resident.parts) {
          part.source.userData.characterDetailHidden = true;
          // Batched sources are already on layer 1. Hide any unbatched glass
          // on layer 0 as well, without changing logical source visibility.
          if (part.source.layers.mask !== 0) part.layers = part.source.layers.mask;
          part.source.layers.mask = 0;
        }
      }
    }
  }

  /** After batch sync has updated the original animation matrices. */
  sync(): void {
    for (const [actor, resident] of this.residents) if (resident.ready) {
      for (const part of resident.parts) {
        let visible = true, ancestor: THREE.Object3D | null = part.source;
        while (ancestor && ancestor !== actor.root) {
          // SceneBatches may prune model traversal, not logical actor state.
          if (ancestor !== actor.model && !ancestor.visible) visible = false;
          ancestor = ancestor.parent;
        }
        part.mesh.visible = visible && actor.root.visible;
        part.mesh.matrixWorld.copy(part.source.matrixWorld);
      }
    }
  }

  get count(): number { return [...this.residents.values()].filter(resident => resident.ready).length; }
  get pending(): number { return [...this.residents.values()].filter(resident => !resident.ready && !resident.failed).length; }

  private release(actor: DetailActor, resident: Resident): void {
    for (const part of resident.parts) { delete part.source.userData.characterDetailHidden; part.source.layers.mask = part.layers; }
    resident.root.removeFromParent(); resident.geometries.forEach(geometry => geometry.dispose()); this.residents.delete(actor);
  }
  dispose(): void {
    this.disposed = true; this.worker?.terminate(); this.requests.forEach(resolve => resolve(undefined)); this.requests.clear();
    for (const [actor, resident] of this.residents) this.release(actor, resident);
  }
}

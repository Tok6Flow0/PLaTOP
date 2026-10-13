import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { DecorFinish, DecorShape, DecorSlot, OfficeAsset, OfficeAssets } from '../types';
import type { Room } from './rooms';
import { parseOfficeSnapshot } from '../../server/office-protocol.mjs';

const SLOT_SCALE: Record<DecorSlot, number> = { desk: 0.25, shelf: 0.25, wall: 0.35, floor: 0.45, festive: 0.5 };
const FINISH: Record<DecorFinish, { roughness: number; metalness: number }> = {
  matte: { roughness: 0.82, metalness: 0 }, ceramic: { roughness: 0.34, metalness: 0 },
  wood: { roughness: 0.78, metalness: 0 }, metal: { roughness: 0.3, metalness: 0.65 },
};
interface RenderedAsset { root: THREE.Group; signature: string; materials: THREE.MeshStandardMaterial[]; }

/** Bounded local primitive recipes update only when an office snapshot changes. */
export class OfficeAssetsRenderer {
  private readonly geometries = new Map<DecorShape, THREE.BufferGeometry>();
  private readonly current = new Map<string, RenderedAsset>();
  private disposed = false;

  constructor(private readonly rooms: ReadonlyMap<string, Room>) {}

  private geometry(shape: DecorShape): THREE.BufferGeometry {
    let geometry = this.geometries.get(shape);
    if (!geometry) {
      geometry = shape === 'box' ? new RoundedBoxGeometry(1, 1, 1, 2, 0.12)
        : shape === 'sphere' || shape === 'leaf' ? new THREE.SphereGeometry(0.5, 16, 10)
        : shape === 'cylinder' ? new THREE.LatheGeometry([[0, -0.5], [0.42, -0.5], [0.48, -0.48], [0.5, -0.42],
          [0.5, 0.42], [0.48, 0.48], [0.42, 0.5], [0, 0.5]].map(([x, y]) => new THREE.Vector2(x, y)), 20)
        : shape === 'cone' ? new THREE.LatheGeometry([[0, -0.5], [0.41, -0.5], [0.48, -0.48], [0.5, -0.43],
          [0.15, 0.34], [0.07, 0.46], [0, 0.5]].map(([x, y]) => new THREE.Vector2(x, y)), 20)
        : shape === 'capsule' ? new THREE.CapsuleGeometry(0.3, 0.4, 4, 16)
        : new THREE.TorusGeometry(0.35, 0.15, 8, 24);
      if (shape === 'leaf') {
        const positions = geometry.getAttribute('position');
        for (let index = 0; index < positions.count; index++) {
          const y = positions.getY(index);
          const taper = 1 - 0.65 * Math.abs(y * 2);
          positions.setXYZ(index, positions.getX(index) * taper, y,
            positions.getZ(index) * (0.35 + 0.65 * taper));
        }
        geometry.computeVertexNormals();
      }
      // Every recipe size means full width/height/depth, including a torus's
      // shallow original tube. This preserves the validator's extent bound.
      geometry.computeBoundingBox();
      const bounds = geometry.boundingBox!;
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      geometry.translate(-center.x, -center.y, -center.z);
      geometry.scale(1 / size.x, 1 / size.y, 1 / size.z);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      this.geometries.set(shape, geometry);
    }
    return geometry;
  }

  private create(room: Room, slot: DecorSlot, asset: OfficeAsset, signature: string): RenderedAsset {
    const anchor = room.assetSlots[slot];
    const root = new THREE.Group();
    root.name = `Agent decoration ${slot}`;
    root.userData.decorSlot = slot;
    root.scale.setScalar(SLOT_SCALE[slot]);
    if (anchor.rotation) root.rotation.set(...anchor.rotation);
    const materials = asset.parts.map(part => {
      const material = new THREE.MeshStandardMaterial({ color: part.color, ...FINISH[part.finish],
        emissive: part.glow ? part.color : '#000000', emissiveIntensity: part.glow ? 0.65 : 0 });
      const mesh = new THREE.Mesh(this.geometry(part.shape), material);
      mesh.position.set(...part.position);
      mesh.scale.set(...part.size);
      mesh.rotation.set(...part.rotation);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
      root.add(mesh);
      return material;
    });
    const bounds = new THREE.Box3().setFromObject(root);
    root.position.set(...anchor.position);
    if (slot === 'desk' || slot === 'shelf' || slot === 'floor') root.position.y -= bounds.min.y;
    root.updateMatrix();
    root.matrixAutoUpdate = false;
    room.root.add(root);
    root.updateWorldMatrix(true, true);
    root.traverse(object => { object.matrixWorldAutoUpdate = false; });
    return { root, signature, materials };
  }

  private remove(key: string): void {
    const previous = this.current.get(key);
    if (!previous) return;
    previous.root.removeFromParent();
    previous.materials.forEach(material => material.dispose());
    previous.root.clear();
    this.current.delete(key);
  }

  /** True means source geometry/materials changed and scene batches need rebuilding. */
  sync(assets: OfficeAssets | undefined): boolean {
    if (this.disposed) return false;
    let normalized: OfficeAssets;
    try { normalized = assets === undefined ? {} : parseOfficeSnapshot({ assets }).assets ?? {}; }
    catch { return false; }
    const wanted = new Set<string>();
    let changed = false;
    for (const [teamId, slots] of Object.entries(normalized)) {
      const room = this.rooms.get(teamId);
      if (!room || !slots) continue;
      for (const [slotName, asset] of Object.entries(slots)) {
        if (!asset?.parts.length) continue;
        const slot = slotName as DecorSlot;
        const key = `${teamId}:${slot}`;
        wanted.add(key);
        const signature = JSON.stringify(asset.parts);
        if (this.current.get(key)?.signature === signature) continue;
        // Build before replacing, so a construction failure cannot erase a
        // visible current decoration. The shared geometry pool remains owned.
        const replacement = this.create(room, slot, asset, signature);
        this.remove(key);
        this.current.set(key, replacement);
        changed = true;
      }
    }
    for (const key of this.current.keys()) if (!wanted.has(key)) { this.remove(key); changed = true; }
    return changed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const key of this.current.keys()) this.remove(key);
    this.geometries.forEach(geometry => geometry.dispose());
    this.geometries.clear();
  }
}

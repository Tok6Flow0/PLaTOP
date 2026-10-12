import * as THREE from 'three';

interface Source { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>; layerMask: number; }
interface Batch { mesh: THREE.InstancedMesh; sources: Source[]; }

/** Repeated opaque toy parts share draws; original nodes remain animation and picking targets. */
export class SceneBatches {
  private readonly root = new THREE.Group();
  private batches: Batch[] = [];
  private readonly geometryKeys = new WeakMap<THREE.BufferGeometry, string>();

  constructor(private readonly scene: THREE.Scene) {
    this.root.name = 'Shared character draws';
    this.root.matrixAutoUpdate = false;
    scene.add(this.root);
  }

  private geometryKey(geometry: THREE.BufferGeometry): string {
    const cached = this.geometryKeys.get(geometry);
    if (cached) return cached;
    let hash = 2166136261;
    const attributes = Object.entries(geometry.attributes).sort(([a], [b]) => a.localeCompare(b));
    let signature = '';
    for (const [name, attribute] of attributes) {
      signature += `${name}:${attribute.array.constructor.name}:${attribute.itemSize}:${attribute.normalized}:${attribute.count}|`;
      const array = attribute.array;
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
    }
    const index = geometry.index;
    if (index) {
      const array = index.array;
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
    }
    const key = `${signature}:${index?.count ?? 0}:${hash >>> 0}`;
    this.geometryKeys.set(geometry, key);
    return key;
  }

  private materialKey(material: THREE.MeshStandardMaterial): string | null {
    if (material.transparent || material.opacity !== 1 || material.emissive.getHex() !== 0
      || Object.entries(material).some(([name, value]) => name.endsWith('Map') && value)
      || material.map || material.alphaTest || material.clippingPlanes?.length) return null;
    return [material.type, material.roughness, material.metalness, material.side, material.shadowSide,
      material.flatShading, material.vertexColors, material.fog, material.toneMapped, material.depthTest,
      material.depthWrite, material.colorWrite, material.polygonOffset, material.polygonOffsetFactor,
      material.polygonOffsetUnits, material.normalScale.toArray().join(','), material.blending].join(':');
  }

  rebuild(): void {
    this.clear();
    this.scene.updateMatrixWorld(true);
    const groups = new Map<string, Source[]>();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh || (mesh as THREE.InstancedMesh).isInstancedMesh
        || (mesh as THREE.BatchedMesh).isBatchedMesh || Array.isArray(mesh.material)
        || !(mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial
        || mesh.morphTargetInfluences?.length || mesh.matrixWorld.determinant() <= 0
        || mesh.geometry.drawRange.start !== 0 || !mesh.geometry.attributes.normal
        || Object.values(mesh.geometry.attributes).some((attribute) => attribute instanceof THREE.InterleavedBufferAttribute)) return;
      const material = mesh.material as THREE.MeshStandardMaterial;
      const materialKey = this.materialKey(material);
      if (!materialKey) return;
      const key = `${this.geometryKey(mesh.geometry)}:${materialKey}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.renderOrder}`;
      const sources = groups.get(key) ?? [];
      sources.push({ mesh: mesh as Source['mesh'], layerMask: mesh.layers.mask });
      groups.set(key, sources);
    });
    for (const sources of groups.values()) {
      if (sources.length < 2) continue;
      const first = sources[0].mesh;
      const material = first.material.clone();
      material.color.setRGB(1, 1, 1);
      const mesh = new THREE.InstancedMesh(first.geometry, material, sources.length);
      mesh.name = `Shared ${sources.length} toy parts`;
      mesh.castShadow = first.castShadow;
      mesh.receiveShadow = first.receiveShadow;
      mesh.renderOrder = first.renderOrder;
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      sources.forEach(({ mesh: original }) => { original.layers.set(1); });
      this.root.add(mesh);
      this.batches.push({ mesh, sources });
    }
    this.sync();
  }

  sync(): void {
    this.scene.updateMatrixWorld();
    for (const { mesh, sources } of this.batches) {
      let count = 0;
      for (const source of sources) {
        let ancestor: THREE.Object3D | null = source.mesh;
        let visible = true;
        while (ancestor && ancestor !== this.scene) {
          if (!ancestor.visible) { visible = false; break; }
          ancestor = ancestor.parent;
        }
        if (!visible || ancestor !== this.scene) continue;
        mesh.setMatrixAt(count, source.mesh.matrixWorld);
        mesh.setColorAt(count, source.mesh.material.color);
        count++;
      }
      mesh.count = count;
      mesh.visible = count > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  private clear(): void {
    for (const { mesh, sources } of this.batches) {
      sources.forEach(({ mesh: original, layerMask }) => { original.layers.mask = layerMask; });
      this.root.remove(mesh);
      mesh.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.batches = [];
  }

  dispose(): void { this.clear(); this.root.removeFromParent(); }
}

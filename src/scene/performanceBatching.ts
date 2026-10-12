import * as THREE from 'three';

type OpaqueMaterial = THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
interface Source {
  mesh: THREE.Mesh<THREE.BufferGeometry, OpaqueMaterial>;
  layerMask: number;
  color: THREE.Color;
}
interface Batch { mesh: THREE.InstancedMesh; sources: Source[]; slots: Source[]; dynamic: boolean; }
interface MultiBatch { mesh: THREE.BatchedMesh; sources: Source[]; instanceIds: number[]; dynamic: boolean; }
type NormalMode = 'instance' | 'mesh';

/** Authored joints animate their children; unbound mesh leaves keep fixed local matrices. */
export function freezeStaticAuthoredMeshes(root: THREE.Object3D, clips: readonly THREE.AnimationClip[]): void {
  const boundNodes = new Set<THREE.Object3D>();
  for (const clip of clips) for (const track of clip.tracks) {
    let binding: ReturnType<typeof THREE.PropertyBinding.parseTrackName>;
    try { binding = THREE.PropertyBinding.parseTrackName(track.name); }
    catch { return; }
    // Complex bindings and unresolved names keep the loader's normal behavior.
    if (binding.objectName || binding.objectIndex !== undefined) return;
    const node = THREE.PropertyBinding.findNode(root, binding.nodeName) as THREE.Object3D | null;
    if (!node) return;
    boundNodes.add(node);
  }
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh || mesh.children.length
      || mesh.morphTargetInfluences?.length || boundNodes.has(mesh)) return;
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
  });
}

/** Only the actor floor contacts share this draw, between room surfaces and sleep labels. */
export class ActorContactBatch {
  private mesh?: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly layerMasks: number[];
  private readonly slots: Array<{ source: THREE.Mesh; depth: number }>;
  private readonly visibleSlots: Array<{ source: THREE.Mesh; depth: number }> = [];
  private readonly projectionView = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();

  constructor(private readonly scene: THREE.Scene, private readonly sources: readonly THREE.Mesh[]) {
    this.layerMasks = sources.map((source) => source.layers.mask);
    this.slots = sources.map((source) => ({ source, depth: 0 }));
    const first = sources[0];
    const material = first?.material;
    if (sources.length < 2 || !(material instanceof THREE.MeshBasicMaterial)
      || !material.map || !material.transparent || material.depthWrite || material.vertexColors
      || material.blending !== THREE.NormalBlending || first.renderOrder !== 1
      || material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile
      || material.clippingPlanes?.length) return;
    // No other transparency joins these supplied contacts. The instance order
    // below preserves Three's original back-to-front blend order, including ties.
    const fields = ['opacity', 'side', 'depthTest', 'depthWrite', 'depthFunc', 'colorWrite',
      'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits', 'alphaTest', 'alphaHash',
      'alphaToCoverage', 'premultipliedAlpha', 'toneMapped', 'fog', 'dithering', 'visible',
      'wireframe', 'map', 'alphaMap', 'aoMap', 'lightMap', 'envMap', 'specularMap',
      'aoMapIntensity', 'lightMapIntensity', 'reflectivity', 'refractionRatio', 'combine',
      'stencilWrite', 'stencilWriteMask', 'stencilFunc', 'stencilRef', 'stencilFuncMask',
      'stencilFail', 'stencilZFail', 'stencilZPass'] as const;
    if (sources.some((source) => {
      const other = source.material;
      return source.geometry !== first.geometry || source.renderOrder !== 1 || source.layers.mask !== 1
        || source.castShadow || source.receiveShadow || !(other instanceof THREE.MeshBasicMaterial)
        || !other.transparent || other.vertexColors || other.blending !== THREE.NormalBlending
        || !other.color.equals(material.color) || !other.envMapRotation.equals(material.envMapRotation)
        || other.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile || other.clippingPlanes?.length
        || fields.some((field) => other[field] !== material[field]);
    })) return;
    this.mesh = new THREE.InstancedMesh(first.geometry, material.clone(), sources.length);
    this.mesh.name = 'Shared actor floor contacts';
    this.mesh.renderOrder = 1;
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    sources.forEach((source) => source.layers.set(1));
    scene.add(this.mesh);
  }

  /** Called after SceneBatches has updated the actor contact world matrices. */
  sync(camera: THREE.Camera): void {
    if (!this.mesh) return;
    this.projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const visible = this.visibleSlots;
    visible.length = 0;
    for (const slot of this.slots) {
      const source = slot.source;
      let ancestor: THREE.Object3D | null = source;
      while (ancestor?.visible) ancestor = ancestor.parent;
      if (ancestor) continue;
      slot.depth = this.position.setFromMatrixPosition(source.matrixWorld).applyMatrix4(this.projectionView).z;
      visible.push(slot);
    }
    // Transparent painter order compares depth then object id when group/order match.
    visible.sort((a, b) => b.depth - a.depth || a.source.id - b.source.id);
    const count = visible.length;
    for (let index = 0; index < count; index++) this.mesh.setMatrixAt(index, visible[index].source.matrixWorld);
    this.mesh.count = count;
    this.mesh.visible = count > 0;
    if (count) {
      this.mesh.instanceMatrix.addUpdateRange(0, count * 16);
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    if (!this.mesh) return;
    const mesh = this.mesh;
    this.mesh = undefined;
    this.sources.forEach((source, index) => { source.layers.mask = this.layerMasks[index]; });
    mesh.removeFromParent();
    mesh.dispose();
    mesh.material.dispose();
  }
}

/** Repeated opaque toy parts share draws; original nodes remain animation and picking targets. */
export class SceneBatches {
  private readonly root = new THREE.Group();
  private batches: Batch[] = [];
  private multiBatches: MultiBatch[] = [];
  private readonly geometryKeys = new WeakMap<THREE.BufferGeometry, string>();
  private readonly visibility = new WeakMap<THREE.Object3D, { frame: number; visible: boolean }>();
  private readonly renderPrunedRoots = new Map<THREE.Object3D, boolean>();
  private visibilityFrame = 0;
  private staticVisibilityDirty = true;

  constructor(private readonly scene: THREE.Scene, private readonly dynamicRoots?: ReadonlySet<THREE.Object3D>,
    private readonly prunableRoots?: ReadonlySet<THREE.Object3D>, private readonly multiDraw = false) {
    this.root.name = 'Shared character draws';
    this.root.matrixAutoUpdate = false;
    scene.add(this.root);
  }

  private isDynamic(object: THREE.Object3D): boolean {
    if (!this.dynamicRoots) return true;
    let ancestor: THREE.Object3D | null = object;
    while (ancestor && ancestor !== this.scene) {
      if (this.dynamicRoots.has(ancestor)) return true;
      ancestor = ancestor.parent;
    }
    return false;
  }

  private isVisible(object: THREE.Object3D): boolean {
    const cached = this.visibility.get(object);
    if (cached?.frame === this.visibilityFrame) return cached.visible;
    const ownVisible = this.renderPrunedRoots.get(object) ?? object.visible;
    const visible = ownVisible && (object === this.scene || (!!object.parent && this.isVisible(object.parent)));
    if (cached) { cached.frame = this.visibilityFrame; cached.visible = visible; }
    else this.visibility.set(object, { frame: this.visibilityFrame, visible });
    return visible;
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

  private materialKey(material: OpaqueMaterial): string | null {
    const standard = (material as THREE.MeshStandardMaterial).isMeshStandardMaterial;
    if (material.transparent || material.opacity !== 1 || (standard && (material as THREE.MeshStandardMaterial).emissive.getHex() !== 0)
      || Object.entries(material).some(([name, value]) => name.endsWith('Map') && value)
      || material.map || material.alphaTest || material.clippingPlanes?.length
      || material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile
      || (material.type !== 'MeshStandardMaterial' && material.type !== 'MeshBasicMaterial')) return null;
    const pbr = standard ? material as THREE.MeshStandardMaterial : undefined;
    return [material.type, pbr?.roughness, pbr?.metalness, material.side, material.shadowSide,
      pbr?.flatShading, material.vertexColors, material.fog, material.toneMapped, material.depthTest,
      material.depthWrite, material.depthFunc, material.colorWrite, material.polygonOffset, material.polygonOffsetFactor,
      material.polygonOffsetUnits, pbr?.normalScale.toArray().join(','), material.blending,
      material.wireframe, material.wireframeLinewidth, material.alphaHash, material.premultipliedAlpha,
      material.visible, material.dithering, material.alphaToCoverage, material.forceSinglePass, material.precision,
      material.blendSrc, material.blendDst, material.blendEquation, material.blendSrcAlpha, material.blendDstAlpha,
      material.blendEquationAlpha, material.blendColor.toArray().join(','), material.blendAlpha, pbr?.envMapIntensity,
      material.stencilWrite, material.stencilWriteMask, material.stencilFunc, material.stencilRef,
      material.stencilFuncMask, material.stencilFail, material.stencilZFail, material.stencilZPass].join(':');
  }

  private schemaKey(geometry: THREE.BufferGeometry): string {
    return `${!!geometry.index}:` + Object.entries(geometry.attributes).sort(([a], [b]) => a.localeCompare(b))
      .map(([name, attribute]) => `${name}:${attribute.array.constructor.name}:${attribute.itemSize}:${attribute.normalized}:${(attribute as THREE.BufferAttribute).gpuType}`).join('|');
  }

  private addMultiBatch(sources: Source[], dynamic: boolean, normalMode: NormalMode): void {
    if (sources.length < 2) return;
    const geometries = new Map<THREE.BufferGeometry, number>();
    for (const { mesh } of sources) geometries.set(mesh.geometry, -1);
    let vertices = 0;
    let indices = 0;
    for (const geometry of geometries.keys()) {
      vertices += geometry.attributes.position.count;
      indices += geometry.index?.count ?? 0;
    }
    const first = sources[0].mesh;
    const material = first.material.clone();
    material.color.setRGB(1, 1, 1);
    if (normalMode === 'mesh' && (material as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      // Animated nonuniform parent scales can shear a child. Ordinary Mesh uses
      // inverse-transpose normals; preserve that shading in the multi-draw path.
      material.onBeforeCompile = (shader) => {
        const normal = THREE.ShaderChunk.defaultnormal_vertex
          .replace('mat3 bm = mat3( batchingMatrix );', 'mat3 bm = transpose( inverse( mat3( batchingMatrix ) ) );')
          .replace('transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );', '');
        shader.vertexShader = shader.vertexShader.replace('#include <defaultnormal_vertex>', normal);
      };
      material.customProgramCacheKey = () => 'platop-batch-normal-v1';
    }
    const mesh = new THREE.BatchedMesh(sources.length, vertices, indices, material);
    mesh.name = `Shared ${sources.length} distinct toy surfaces`;
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    mesh.frustumCulled = false;
    mesh.perObjectFrustumCulled = false;
    mesh.sortObjects = false;
    mesh.matrixAutoUpdate = false;
    for (const geometry of geometries.keys()) geometries.set(geometry, mesh.addGeometry(geometry));
    const instanceIds = sources.map(({ mesh: source }) => mesh.addInstance(geometries.get(source.geometry)!));
    sources.forEach(({ mesh: original }, index) => {
      original.layers.set(1);
      mesh.setColorAt(instanceIds[index], original.material.color);
    });
    this.root.add(mesh);
    this.multiBatches.push({ mesh, sources, instanceIds, dynamic });
  }

  rebuild(): void {
    this.clear();
    this.scene.updateMatrixWorld(true);
    const groups = new Map<string, { sources: Source[]; dynamic: boolean }>();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh || (mesh as THREE.InstancedMesh).isInstancedMesh
        || (mesh as THREE.BatchedMesh).isBatchedMesh || Array.isArray(mesh.material)
        || (!(mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial
          && !(this.multiDraw && (mesh.material as THREE.MeshBasicMaterial).isMeshBasicMaterial))
        || mesh.morphTargetInfluences?.length || mesh.matrixWorld.determinant() <= 0
        || mesh.geometry.drawRange.start !== 0 || !mesh.geometry.attributes.normal
        || Object.values(mesh.geometry.attributes).some((attribute) => attribute instanceof THREE.InterleavedBufferAttribute)) return;
      const material = mesh.material as OpaqueMaterial;
      const materialKey = this.materialKey(material);
      if (!materialKey) return;
      const dynamic = this.isDynamic(mesh);
      const key = `${this.geometryKey(mesh.geometry)}:${materialKey}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.renderOrder}:${dynamic}`;
      const group = groups.get(key) ?? { sources: [], dynamic };
      group.sources.push({ mesh: mesh as Source['mesh'], layerMask: mesh.layers.mask, color: material.color.clone() });
      groups.set(key, group);
    });
    const instancedSources = new Set<THREE.Object3D>();
    const leftovers: Array<{ source: Source; dynamic: boolean; normalMode: NormalMode }> = [];
    for (const { sources, dynamic } of groups.values()) {
      const repeated = sources.length >= 2 && (sources[0].mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial;
      if ((this.multiDraw && dynamic) || !repeated) {
        // BatchedMesh's default normal math matches the original InstancedMesh
        // path. Keep that separate from formerly ordinary mesh normals.
        sources.forEach((source) => leftovers.push({ source, dynamic, normalMode: repeated ? 'instance' : 'mesh' }));
        continue;
      }
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
      mesh.instanceMatrix.setUsage(dynamic ? THREE.DynamicDrawUsage : THREE.StaticDrawUsage);
      sources.forEach(({ mesh: original }) => { original.layers.set(1); instancedSources.add(original); });
      this.root.add(mesh);
      this.batches.push({ mesh, sources, slots: [], dynamic });
    }
    if (this.multiDraw) {
      const compatible = new Map<string, { sources: Source[]; dynamic: boolean; normalMode: NormalMode }>();
      for (const { source, dynamic, normalMode } of leftovers) {
        // Static furnishings keep their existing CPU-composed model-view path:
        // moving those to GPU composition can expose coplanar/shadow precision
        // artifacts on laptop keyboards and broad flat rugs.
        if (!dynamic) continue;
        const mesh = source.mesh;
        const count = mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count;
        if (mesh.geometry.drawRange.count < count || mesh.layers.mask !== 1
          || Object.values(mesh.geometry.attributes).some((attribute) => attribute instanceof THREE.Float16BufferAttribute)) continue;
        const key = `${this.schemaKey(mesh.geometry)}:${this.materialKey(mesh.material)}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.renderOrder}:${dynamic}:${normalMode}`;
        const group = compatible.get(key) ?? { sources: [], dynamic, normalMode };
        group.sources.push(source);
        compatible.set(key, group);
      }
      for (const { sources, dynamic, normalMode } of compatible.values()) {
        this.addMultiBatch(sources, dynamic, normalMode);
        if (sources.length > 1) sources.forEach(({ mesh }) => instancedSources.add(mesh));
      }
    }
    for (const root of this.prunableRoots ?? []) {
      let ancestor: THREE.Object3D | null = root;
      while (ancestor && ancestor !== this.scene) ancestor = ancestor.parent;
      if (ancestor !== this.scene || !root.visible) continue;
      let meshCount = 0;
      let fullyInstanced = true;
      root.traverse((object) => {
        const renderable = object as THREE.Mesh & THREE.Sprite & THREE.Line & THREE.Points & THREE.Light;
        if (renderable.isMesh) {
          meshCount += 1;
          if (!instancedSources.has(object)) fullyInstanced = false;
        } else if (renderable.isSprite || renderable.isLine || renderable.isPoints || renderable.isLight) fullyInstanced = false;
      });
      if (fullyInstanced && (meshCount > 0 || !this.isDynamic(root))) {
        // Only explicitly supplied roots qualify. Static merging also leaves
        // empty furniture containers: skip those and fully represented sources
        // without detaching their logical animation/visibility hierarchy.
        this.renderPrunedRoots.set(root, root.visible);
        root.visible = false;
      }
    }
    this.staticVisibilityDirty = true;
    this.sync();
  }

  /** Static transforms remain fixed; call after room/decor visibility changes. */
  invalidateVisibility(): void { this.staticVisibilityDirty = true; }

  sync(): void {
    this.visibilityFrame += 1;
    if (this.dynamicRoots) {
      for (const root of this.dynamicRoots) if (this.isVisible(root)) root.updateMatrixWorld(true);
    } else this.scene.updateMatrixWorld();
    for (const batch of this.batches) {
      const { mesh, sources, slots, dynamic } = batch;
      if (!dynamic && !this.staticVisibilityDirty) continue;
      let count = 0;
      let colorsChanged = false;
      for (const source of sources) {
        if (!this.isVisible(source.mesh)) continue;
        mesh.setMatrixAt(count, source.mesh.matrixWorld);
        const color = source.mesh.material.color;
        if (slots[count] !== source || !source.color.equals(color)) {
          mesh.setColorAt(count, color);
          source.color.copy(color);
          colorsChanged = true;
        }
        slots[count] = source;
        count++;
      }
      slots.length = count;
      mesh.count = count;
      mesh.visible = count > 0;
      if (count > 0) {
        mesh.instanceMatrix.addUpdateRange(0, count * 16);
        mesh.instanceMatrix.needsUpdate = true;
        if (colorsChanged && mesh.instanceColor) {
          mesh.instanceColor.addUpdateRange(0, count * 3);
          mesh.instanceColor.needsUpdate = true;
        }
      }
    }
    for (const { mesh, sources, instanceIds, dynamic } of this.multiBatches) {
      if (!dynamic && !this.staticVisibilityDirty) continue;
      let visibleCount = 0;
      sources.forEach((source, index) => {
        const visible = this.isVisible(source.mesh);
        mesh.setVisibleAt(instanceIds[index], visible);
        if (!visible) return;
        visibleCount++;
        mesh.setMatrixAt(instanceIds[index], source.mesh.matrixWorld);
        if (!source.color.equals(source.mesh.material.color)) {
          mesh.setColorAt(instanceIds[index], source.mesh.material.color);
          source.color.copy(source.mesh.material.color);
        }
      });
      mesh.visible = visibleCount > 0;
    }
    this.staticVisibilityDirty = false;
  }

  private clear(): void {
    this.renderPrunedRoots.forEach((visible, root) => { root.visible = visible; });
    this.renderPrunedRoots.clear();
    for (const { mesh, sources } of this.batches) {
      sources.forEach(({ mesh: original, layerMask }) => { original.layers.mask = layerMask; });
      this.root.remove(mesh);
      mesh.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.batches = [];
    for (const { mesh, sources } of this.multiBatches) {
      sources.forEach(({ mesh: original, layerMask }) => { original.layers.mask = layerMask; });
      this.root.remove(mesh);
      mesh.dispose();
      mesh.material.dispose();
    }
    this.multiBatches = [];
  }

  dispose(): void { this.clear(); this.root.removeFromParent(); }
}

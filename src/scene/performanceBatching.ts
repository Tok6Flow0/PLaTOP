import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { configureStaticArrayMap, staticPlaneMap, StaticMapArrays, type StaticMapArrayLimits } from './staticMapArrays';

type OpaqueMaterial = THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
interface Source {
  mesh: THREE.Mesh<THREE.BufferGeometry, OpaqueMaterial>;
  layerMask: number;
  color: THREE.Color;
}
interface Batch { mesh: THREE.InstancedMesh; sources: Source[]; slots: Source[]; dynamic: boolean; }
interface PaletteBatch { mesh: TransformPaletteMesh; sources: Source[]; dynamic: boolean; drawStart: number; drawEnd: number; }
interface DynamicPalettePart { batch: PaletteBatch; source: Source; index: number; }
interface DynamicPaletteRoot { parts: DynamicPalettePart[]; visible: boolean; }
type NormalMode = 'instance' | 'mesh';
interface PaletteRange { vertexStart: number; vertexCount: number; drawStart: number; drawCount: number; }
const unusedCoordinates = new Set(['uv', 'uv1', 'uv2', 'uv3', 'tangent']);

/** Original CPU-composed view/normal uniforms, packed once per camera change. */
class CameraTransformPalette {
  readonly texture: THREE.DataTexture;
  private readonly data: Float32Array;
  private readonly cameraInverse = new THREE.Matrix4();
  private readonly modelView = new THREE.Matrix4();
  private readonly normal = new THREE.Matrix3();
  private worldVersion = -1;

  constructor(private readonly worlds: readonly THREE.Matrix4[]) {
    const size = Math.max(8, Math.ceil(Math.sqrt(worlds.length * 8) / 8) * 8);
    this.data = new Float32Array(size * size * 4);
    this.texture = new THREE.DataTexture(this.data, size, size, THREE.RGBAFormat, THREE.FloatType);
  }

  update(camera: THREE.Camera, worldVersion: number): void {
    if (this.worldVersion === worldVersion && this.cameraInverse.equals(camera.matrixWorldInverse)) return;
    this.cameraInverse.copy(camera.matrixWorldInverse);
    this.worldVersion = worldVersion;
    this.worlds.forEach((world, index) => {
      // These are the same double-precision operations Three performs before
      // uploading an ordinary Mesh's Float32 modelViewMatrix/normalMatrix.
      this.modelView.multiplyMatrices(camera.matrixWorldInverse, world);
      this.modelView.toArray(this.data, index * 32);
      this.normal.getNormalMatrix(this.modelView);
      for (let column = 0; column < 3; column++) for (let row = 0; row < 3; row++) {
        this.data[index * 32 + 16 + column * 4 + row] = this.normal.elements[column * 3 + row];
      }
    });
    this.texture.needsUpdate = true;
  }

  dispose(): void { this.texture.dispose(); }
}

/** Shared moving matrices need one texture upload, even across distinct shaders. */
class MatrixAtlas {
  readonly texture: THREE.DataTexture;
  readonly data: Float32Array;

  constructor(parts: number) {
    const size = Math.max(4, Math.ceil(Math.sqrt(parts * 4) / 4) * 4);
    this.data = new Float32Array(size * size * 4);
    this.texture = new THREE.DataTexture(this.data, size, size, THREE.RGBAFormat, THREE.FloatType);
  }

  dispose(): void { this.texture.dispose(); }
}

/** One real draw, with each rigid surface retaining its own GPU transform. */
class TransformPaletteMesh extends THREE.Mesh<THREE.BufferGeometry, OpaqueMaterial> {
  readonly isTransformPaletteMesh = true;
  count = 0;
  readonly colorsTexture: THREE.DataTexture;
  private matrixAtlas: MatrixAtlas;
  private matrixStart = 0;
  private ownsMatrices = true;
  private readonly colors: Float32Array;
  private readonly worldMatrices?: THREE.Matrix4[];
  private readonly viewPalette?: CameraTransformPalette;
  private readonly shadowPalette?: CameraTransformPalette;
  private worldVersion = 0;
  constructor(geometry: THREE.BufferGeometry, material: OpaqueMaterial, readonly instanceCount: number,
    private readonly ranges: PaletteRange[], readonly normalMode: NormalMode,
    readonly viewSpace = false) {
    super(geometry, material);
    this.matrixAtlas = new MatrixAtlas(instanceCount);
    const colorSize = Math.max(1, Math.ceil(Math.sqrt(instanceCount)));
    this.colors = new Float32Array(colorSize * colorSize * 4).fill(1);
    this.colorsTexture = new THREE.DataTexture(this.colors, colorSize, colorSize, THREE.RGBAFormat, THREE.FloatType);
    if (viewSpace) {
      this.worldMatrices = Array.from({ length: instanceCount }, () => new THREE.Matrix4());
      this.viewPalette = new CameraTransformPalette(this.worldMatrices);
      this.shadowPalette = new CameraTransformPalette(this.worldMatrices);
      // The renderer has updated this camera before invoking either hook.
      this.onBeforeRender = (_renderer, _scene, camera) => this.viewPalette!.update(camera, this.worldVersion);
      this.onBeforeShadow = (_renderer, _object, _camera, shadowCamera) => this.shadowPalette!.update(shadowCamera, this.worldVersion);
    }
  }
  get matricesTexture(): THREE.DataTexture { return this.matrixAtlas.texture; }
  get matrixOffset(): number { return this.matrixStart; }
  shareMatrices(atlas: MatrixAtlas, offset: number): void {
    atlas.data.set(this.matrixAtlas.data.subarray(this.matrixStart * 16, (this.matrixStart + this.instanceCount) * 16), offset * 16);
    if (this.ownsMatrices) this.matrixAtlas.dispose();
    this.matrixAtlas = atlas;
    this.matrixStart = offset;
    this.ownsMatrices = false;
  }
  setMatrixAt(index: number, matrix: THREE.Matrix4): void {
    matrix.toArray(this.matrixAtlas.data, (this.matrixStart + index) * 16);
    if (this.worldMatrices) { this.worldMatrices[index].copy(matrix); this.worldVersion += 1; }
    this.matricesTexture.needsUpdate = true;
  }
  getMatrixAt(index: number, target: THREE.Matrix4): THREE.Matrix4 {
    target.fromArray(this.matrixAtlas.data, (this.matrixStart + index) * 16);
    target.elements[15] = 1;
    return target;
  }
  setColorAt(index: number, color: THREE.Color): void {
    color.toArray(this.colors, index * 4);
    this.colorsTexture.needsUpdate = true;
  }
  getColorAt(index: number, target: THREE.Color): THREE.Color { return target.fromArray(this.colors, index * 4); }
  setVisibleAt(index: number, visible: boolean): void {
    const value = visible ? 1 : 0;
    const position = (this.matrixStart + index) * 16 + 15;
    if (this.matrixAtlas.data[position] === value) return;
    this.count += visible ? 1 : -1;
    this.matrixAtlas.data[position] = value;
    this.matricesTexture.needsUpdate = true;
  }
  getVisibleAt(index: number): boolean { return this.matrixAtlas.data[(this.matrixStart + index) * 16 + 15] === 1; }
  getGeometryIdAt(index: number): number { return index; }
  getGeometryRangeAt(index: number): PaletteRange { return this.ranges[index]; }
  configureShader(shader: THREE.WebGLProgramParametersWithUniforms, colors: boolean, shadow = false): void {
    const declarations = `
uniform highp sampler2D batchingTexture;
uniform int platopMatrixOffset;
mat4 getBatchingMatrix( const in float i ) {
  int size = textureSize( batchingTexture, 0 ).x;
  int j = ( int( i ) + platopMatrixOffset ) * 4;
  int x = j % size;
  int y = j / size;
  return mat4( texelFetch( batchingTexture, ivec2( x, y ), 0 ),
    texelFetch( batchingTexture, ivec2( x + 1, y ), 0 ),
    texelFetch( batchingTexture, ivec2( x + 2, y ), 0 ),
    texelFetch( batchingTexture, ivec2( x + 3, y ), 0 ) );
}
${colors ? `uniform highp sampler2D batchingColorTexture;
vec3 getBatchingColor( const in float i ) {
  int size = textureSize( batchingColorTexture, 0 ).x;
  int j = int( i );
  return texelFetch( batchingColorTexture, ivec2( j % size, j / size ), 0 ).rgb;
}` : ''}`;
    const defines = `#define USE_BATCHING\n${colors ? '#define USE_BATCHING_COLOR\n' : ''}`;
    shader.vertexShader = defines + 'attribute float platopPart;\n' + shader.vertexShader
      .replace('#include <batching_pars_vertex>', declarations)
      .replace('#include <batching_vertex>', `mat4 batchingMatrix = getBatchingMatrix( platopPart );
bool platopVisible = batchingMatrix[3][3] > 0.5;
batchingMatrix[3][3] = 1.0;`)
      .replace('#include <color_vertex>', THREE.ShaderChunk.color_vertex
        .replace('getIndirectIndex( gl_DrawID )', 'platopPart'))
      .replace('#include <project_vertex>', '#include <project_vertex>\nif ( !platopVisible ) gl_Position = vec4( 2.0, 2.0, 2.0, 1.0 );');
    // Three enables fragment vertex-color multiplication automatically for its
    // own BatchedMesh. This ordinary Mesh supplies the same varying explicitly.
    shader.fragmentShader = defines + (colors ? '#ifndef USE_COLOR\n#define USE_COLOR\n#endif\n' : '') + shader.fragmentShader;
    shader.uniforms.batchingTexture = { value: this.matricesTexture };
    shader.uniforms.platopMatrixOffset = { value: this.matrixStart };
    if (colors) shader.uniforms.batchingColorTexture = { value: this.colorsTexture };
    if (this.viewSpace) {
      shader.vertexShader = `uniform highp sampler2D platopViewTexture;
mat4 getPartModelView( const in float i ) {
  int size = textureSize( platopViewTexture, 0 ).x;
  int j = int( i ) * 8;
  int x = j % size;
  int y = j / size;
  return mat4( texelFetch( platopViewTexture, ivec2( x, y ), 0 ),
    texelFetch( platopViewTexture, ivec2( x + 1, y ), 0 ),
    texelFetch( platopViewTexture, ivec2( x + 2, y ), 0 ),
    texelFetch( platopViewTexture, ivec2( x + 3, y ), 0 ) );
}
mat3 getPartNormal( const in float i ) {
  int size = textureSize( platopViewTexture, 0 ).x;
  int j = int( i ) * 8 + 4;
  int x = j % size;
  int y = j / size;
  return mat3( texelFetch( platopViewTexture, ivec2( x, y ), 0 ).xyz,
    texelFetch( platopViewTexture, ivec2( x + 1, y ), 0 ).xyz,
    texelFetch( platopViewTexture, ivec2( x + 2, y ), 0 ).xyz );
}
` + shader.vertexShader
        .replace('#include <defaultnormal_vertex>', `vec3 transformedNormal = getPartNormal( platopPart ) * objectNormal;
#ifdef FLIP_SIDED
  transformedNormal = -transformedNormal;
#endif
#ifdef USE_TANGENT
  vec3 transformedTangent = ( getPartModelView( platopPart ) * vec4( objectTangent, 0.0 ) ).xyz;
  #ifdef FLIP_SIDED
    transformedTangent = -transformedTangent;
  #endif
#endif`)
        .replace('#include <project_vertex>', `vec4 mvPosition = getPartModelView( platopPart ) * vec4( transformed, 1.0 );
gl_Position = projectionMatrix * mvPosition;`);
      shader.uniforms.platopViewTexture = { value: (shadow ? this.shadowPalette : this.viewPalette)!.texture };
    }
    if (this.material.map instanceof THREE.DataArrayTexture) configureStaticArrayMap(shader);
  }
  dispose(): void {
    this.geometry.dispose();
    if (this.ownsMatrices) this.matrixAtlas.dispose();
    this.colorsTexture.dispose();
    this.viewPalette?.dispose();
    this.shadowPalette?.dispose();
    this.customDepthMaterial?.dispose();
    this.customDistanceMaterial?.dispose();
  }
}

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
  private paletteBatches: PaletteBatch[] = [];
  private dynamicMatrices?: MatrixAtlas;
  private readonly dynamicPaletteRoots = new Map<THREE.Object3D, DynamicPaletteRoot>();
  private readonly dynamicRootOrder = new Map<THREE.Object3D, number>();
  private geometryKeys = new WeakMap<THREE.BufferGeometry, string>();
  private readonly visibility = new WeakMap<THREE.Object3D, { frame: number; visible: boolean }>();
  private readonly renderPrunedRoots = new Map<THREE.Object3D, boolean>();
  private visibilityFrame = 0;
  private staticVisibilityDirty = true;
  private readonly mapArrays: StaticMapArrays;

  constructor(private readonly scene: THREE.Scene, private readonly dynamicRoots?: ReadonlySet<THREE.Object3D>,
    private readonly prunableRoots?: ReadonlySet<THREE.Object3D>, _multiDraw = false, mapArrayLimits?: StaticMapArrayLimits) {
    this.mapArrays = new StaticMapArrays(mapArrayLimits);
    dynamicRoots?.forEach(root => this.dynamicRootOrder.set(root, this.dynamicRootOrder.size));
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

  private dynamicRoot(object: THREE.Object3D): THREE.Object3D | undefined {
    if (!this.dynamicRoots) return;
    let ancestor: THREE.Object3D | null = object;
    while (ancestor && ancestor !== this.scene) {
      if (this.dynamicRoots.has(ancestor)) return ancestor;
      ancestor = ancestor.parent;
    }
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

  private materialKey(material: OpaqueMaterial, surfaceFactors = false, staticMap = false): string | null {
    const standard = (material as THREE.MeshStandardMaterial).isMeshStandardMaterial;
    const bump = standard ? (material as THREE.MeshStandardMaterial).bumpMap : null;
    // A shared immutable local character grain has ordinary UV semantics and
    // survives palette cloning. Arbitrary authored maps remain on their safe path.
    const sharedGrain = bump instanceof THREE.DataTexture && bump.userData.platopCharacterGrain === true;
    const grainColour = sharedGrain && material.map === bump;
    if (material.transparent || material.opacity !== 1 || (standard && (material as THREE.MeshStandardMaterial).emissive.getHex() !== 0)
      || Object.entries(material).some(([name, value]) => name.endsWith('Map') && value && !(sharedGrain && name === 'bumpMap'))
      || (!staticMap && ((material.map && !grainColour) || material.alphaTest)) || material.clippingPlanes?.length
      || material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile
      || (material.type !== 'MeshStandardMaterial' && material.type !== 'MeshBasicMaterial')) return null;
    const pbr = standard ? material as THREE.MeshStandardMaterial : undefined;
    return [material.type, surfaceFactors ? undefined : pbr?.roughness, surfaceFactors ? undefined : pbr?.metalness, material.side, material.shadowSide,
      pbr?.flatShading, material.vertexColors, material.fog, material.toneMapped, material.depthTest,
      material.depthWrite, material.depthFunc, material.colorWrite, material.polygonOffset, material.polygonOffsetFactor,
      material.polygonOffsetUnits, (!surfaceFactors || pbr?.normalMap) ? pbr?.normalScale.toArray().join(',') : undefined, material.blending,
      material.wireframe, material.wireframeLinewidth, material.alphaTest, material.alphaHash, material.premultipliedAlpha,
      material.visible, material.dithering, material.alphaToCoverage, material.forceSinglePass, material.precision,
      material.blendSrc, material.blendDst, material.blendEquation, material.blendSrcAlpha, material.blendDstAlpha,
      material.blendEquationAlpha, material.blendColor.toArray().join(','), material.blendAlpha, pbr?.envMapIntensity,
      material.stencilWrite, material.stencilWriteMask, material.stencilFunc, material.stencilRef,
      material.stencilFuncMask, material.stencilFail, material.stencilZFail, material.stencilZPass,
      sharedGrain ? bump.uuid : undefined, sharedGrain ? pbr?.bumpScale : undefined, grainColour].join(':');
  }

  private unusedAttribute(name: string, material: OpaqueMaterial): boolean {
    // The stock unmapped shaders never consume UVs/tangents or disabled vertex
    // colours. Keep every attribute whenever a map can use it, and edit only
    // cloned geometry, leaving authored resources and picking data intact.
    if (material.map || Object.entries(material).some(([field, value]) => field.endsWith('Map') && value)) return false;
    return unusedCoordinates.has(name) || (name === 'color' && !material.vertexColors);
  }

  private schemaKey(geometry: THREE.BufferGeometry, material: OpaqueMaterial): string {
    return `${!!geometry.index}:` + Object.entries(geometry.attributes)
      .filter(([name]) => !this.unusedAttribute(name, material)).sort(([a], [b]) => a.localeCompare(b))
      .map(([name, attribute]) => `${name}:${attribute.array.constructor.name}:${attribute.itemSize}:${attribute.normalized}:${(attribute as THREE.BufferAttribute).gpuType}`).join('|');
  }

  private paletteKey(source: Source, dynamic: boolean, normalMode: NormalMode): string | null {
    const mesh = source.mesh;
    if (!dynamic && (mesh.customDepthMaterial || mesh.customDistanceMaterial
      || mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender
      || mesh.onAfterRender !== THREE.Object3D.prototype.onAfterRender
      || mesh.onBeforeShadow !== THREE.Object3D.prototype.onBeforeShadow
      || mesh.onAfterShadow !== THREE.Object3D.prototype.onAfterShadow)) return null;
    const count = mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count;
    if (mesh.geometry.drawRange.count < count || mesh.layers.mask !== 1 || mesh.geometry.hasAttribute('platopSurface')
      || mesh.geometry.hasAttribute('platopPart')
      || Object.values(mesh.geometry.attributes).some((attribute) => attribute instanceof THREE.Float16BufferAttribute)) return null;
    // Compatible actors can share a draw across offices. Their world matrices
    // and independent visibility bits remain in the existing per-part palette.
    return `${this.schemaKey(mesh.geometry, mesh.material)}:${this.materialKey(mesh.material, true)}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.renderOrder}:${dynamic}:${normalMode}`;
  }

  private addPaletteBatch(sources: Source[], dynamic: boolean, normalMode: NormalMode, mapArray?: THREE.DataArrayTexture): boolean {
    if (sources.length < 2) return false;
    // Preserve material/id order within the combined static draw. Supported
    // views are pixel-compared because interleaving with unbatched surfaces can change.
    if (!dynamic) {
      const materialId = (source: Source) => (source.mesh.material as OpaqueMaterial & { readonly id: number }).id;
      sources = [...sources].sort((a, b) => materialId(a) - materialId(b) || a.mesh.id - b.mesh.id);
    } else if (this.dynamicRoots) {
      // Actor roots are supplied in office order. Keep each actor's existing
      // primitive order, while making a selected office one contiguous span.
      sources = [...sources].sort((a, b) =>
        this.dynamicRootOrder.get(this.dynamicRoot(a.mesh)!)! - this.dynamicRootOrder.get(this.dynamicRoot(b.mesh)!)!);
    }
    const first = sources[0].mesh;
    const standard = (first.material as THREE.MeshStandardMaterial).isMeshStandardMaterial;
    const surfaceFactors = standard && sources.some(({ mesh }) => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      return material.roughness !== (first.material as THREE.MeshStandardMaterial).roughness
        || material.metalness !== (first.material as THREE.MeshStandardMaterial).metalness;
    });
    // Distinct PBR scalars share the shader, but each geometry keeps its exact
    // Float32 inputs. Flat varyings avoid interpolating a constant surface value.
    let vertexStart = 0;
    let drawStart = 0;
    const ranges: PaletteRange[] = [];
    const geometries = sources.map(({ mesh }, part) => {
      const pbr = mesh.material as THREE.MeshStandardMaterial;
      const geometry = mesh.geometry.clone();
      for (const name of Object.keys(geometry.attributes)) if (this.unusedAttribute(name, mesh.material)) geometry.deleteAttribute(name);
      const count = geometry.attributes.position.count;
      const drawCount = geometry.index?.count ?? count;
      ranges.push({ vertexStart, vertexCount: count, drawStart, drawCount });
      vertexStart += count;
      drawStart += drawCount;
      geometry.setAttribute('platopPart', new THREE.BufferAttribute(new Float32Array(count).fill(part), 1));
      if (surfaceFactors) {
        const factors = new Float32Array(count * 2);
        for (let index = 0; index < factors.length; index += 2) {
          factors[index] = pbr.roughness;
          factors[index + 1] = pbr.metalness;
        }
        geometry.setAttribute('platopSurface', new THREE.BufferAttribute(factors, 2));
      }
      geometry.clearGroups();
      return geometry;
    });
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach(piece => piece.dispose());
    if (!geometry) return false;
    const material = first.material.clone();
    if (mapArray) material.map = mapArray;
    material.color.setRGB(1, 1, 1);
    if (standard && ((dynamic && normalMode === 'mesh') || surfaceFactors)) {
      // Animated nonuniform parent scales can shear a child. Ordinary Mesh uses
      // inverse-transpose normals; preserve that shading in the palette path.
      material.onBeforeCompile = (shader) => {
        if (dynamic && normalMode === 'mesh') {
          const normal = THREE.ShaderChunk.defaultnormal_vertex
            .replace('mat3 bm = mat3( batchingMatrix );', 'mat3 bm = transpose( inverse( mat3( batchingMatrix ) ) );')
            .replace('transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );', '');
          shader.vertexShader = shader.vertexShader.replace('#include <defaultnormal_vertex>', normal);
        }
        if (surfaceFactors) {
          shader.vertexShader = 'attribute vec2 platopSurface;\nflat varying vec2 vPlatopSurface;\n' + shader.vertexShader
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlatopSurface = platopSurface;');
          shader.fragmentShader = 'flat varying vec2 vPlatopSurface;\n' + shader.fragmentShader
            .replace('#include <roughnessmap_fragment>', THREE.ShaderChunk.roughnessmap_fragment
              .replace('float roughnessFactor = roughness;', 'float roughnessFactor = vPlatopSurface.x;'))
            .replace('#include <metalnessmap_fragment>', THREE.ShaderChunk.metalnessmap_fragment
              .replace('float metalnessFactor = metalness;', 'float metalnessFactor = vPlatopSurface.y;'));
        }
      };
      material.customProgramCacheKey = () => `platop-batch-v2:${normalMode}:${surfaceFactors}`;
    }
    // Former static instances keep their original Float32 world multiplication
    // and column-normalized normals, rather than the ordinary Mesh view palette.
    const viewSpace = !dynamic && normalMode === 'mesh';
    const mesh = new TransformPaletteMesh(geometry, material, sources.length, ranges, normalMode, viewSpace);
    const surfaceShader = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, renderer) => {
      surfaceShader(shader, renderer);
      mesh.configureShader(shader, true);
    };
    material.customProgramCacheKey = () => `platop-palette-v2:${normalMode}:${surfaceFactors}:${viewSpace}:${!!mapArray}`;
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    const distance = new THREE.MeshDistanceMaterial();
    depth.onBeforeCompile = (shader) => mesh.configureShader(shader, false, true);
    distance.onBeforeCompile = (shader) => mesh.configureShader(shader, false, true);
    depth.customProgramCacheKey = () => `platop-palette-depth-v2:${viewSpace}:${!!mapArray}`;
    distance.customProgramCacheKey = () => `platop-palette-distance-v2:${viewSpace}:${!!mapArray}`;
    mesh.customDepthMaterial = depth;
    mesh.customDistanceMaterial = distance;
    mesh.name = `Combined ${sources.length} toy surfaces`;
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    sources.forEach(({ mesh: original }, index) => {
      original.layers.set(1);
      mesh.setColorAt(index, original.material.color);
    });
    this.root.add(mesh);
    const batch = { mesh, sources, dynamic, drawStart: Infinity, drawEnd: 0 };
    this.paletteBatches.push(batch);
    if (dynamic && this.dynamicRoots) sources.forEach((source, index) => {
      const root = this.dynamicRoot(source.mesh);
      if (!root) return;
      const group = this.dynamicPaletteRoots.get(root) ?? { parts: [], visible: true };
      group.parts.push({ batch, source, index });
      this.dynamicPaletteRoots.set(root, group);
    });
    return true;
  }

  rebuild(): void {
    this.clear();
    // Agent room finishes can edit source vertex colours between rebuilds.
    // Reuse hashes only within this event, never across mutable source data.
    this.geometryKeys = new WeakMap();
    this.mapArrays.beginRebuild();
    this.scene.updateMatrixWorld(true);
    const groups = new Map<string, { sources: Source[]; dynamic: boolean }>();
    const mappedGroups = new Map<string, Source[]>();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh || (mesh as THREE.InstancedMesh).isInstancedMesh
        || (mesh as THREE.BatchedMesh).isBatchedMesh || Array.isArray(mesh.material)
        || (!(mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial
          && !(mesh.material as THREE.MeshBasicMaterial).isMeshBasicMaterial)
        || mesh.morphTargetInfluences?.length || mesh.matrixWorld.determinant() <= 0
        || mesh.geometry.drawRange.start !== 0 || !mesh.geometry.attributes.normal
        || Object.values(mesh.geometry.attributes).some((attribute) => attribute instanceof THREE.InterleavedBufferAttribute)) return;
      const material = mesh.material as OpaqueMaterial;
      // Moving a source outside an ordered ancestor would lose its groupOrder.
      // Keep custom group ordering on Three's original rendering path.
      let ancestor = mesh.parent;
      while (ancestor && ancestor !== this.scene) {
        if ((ancestor as THREE.Group).isGroup && ancestor.renderOrder !== 0) return;
        ancestor = ancestor.parent;
      }
      const dynamic = this.isDynamic(mesh);
      const mapped = !dynamic ? staticPlaneMap(mesh) : undefined;
      if (mapped) {
        const materialKey = this.materialKey(material, false, true);
        if (materialKey && mesh.layers.mask === 1) {
          const key = `${mapped.image.width}:${mapped.image.height}:${materialKey}:${mesh.receiveShadow}:${mesh.renderOrder}`;
          const sources = mappedGroups.get(key) ?? [];
          sources.push({ mesh: mesh as Source['mesh'], layerMask: mesh.layers.mask, color: material.color.clone() });
          mappedGroups.set(key, sources);
        }
        return;
      }
      const materialKey = this.materialKey(material);
      if (!materialKey) return;
      const key = `${this.geometryKey(mesh.geometry)}:${materialKey}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.renderOrder}:${dynamic}`;
      const group = groups.get(key) ?? { sources: [], dynamic };
      group.sources.push({ mesh: mesh as Source['mesh'], layerMask: mesh.layers.mask, color: material.color.clone() });
      groups.set(key, group);
    });
    const instancedSources = new Set<THREE.Object3D>();
    for (const sources of mappedGroups.values()) {
      const materialId = (source: Source) => (source.mesh.material as OpaqueMaterial & { readonly id: number }).id;
      sources.sort((a, b) => materialId(a) - materialId(b) || a.mesh.id - b.mesh.id);
      const mapArray = this.mapArrays.acquire(sources.map(source => source.mesh.material.map as THREE.CanvasTexture));
      if (mapArray && this.addPaletteBatch(sources, false, 'mesh', mapArray)) sources.forEach(({ mesh }) => instancedSources.add(mesh));
    }
    this.mapArrays.endRebuild();
    const combinedStatic = new Set<Source[]>();
    const staticGroups = new Map<string, Source[][]>();
    for (const { sources, dynamic } of groups.values()) {
      if (dynamic || sources.length < 2 || !(sources[0].mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial) continue;
      const key = this.paletteKey(sources[0], false, 'instance');
      if (!key || sources.some(source => this.paletteKey(source, false, 'instance') !== key)) continue;
      const compatible = staticGroups.get(key) ?? [];
      compatible.push(sources);
      staticGroups.set(key, compatible);
    }
    for (const compatible of staticGroups.values()) {
      // A single repeated geometry already has one draw. Merge only when this
      // replaces multiple existing static draws, leaving its fallback unchanged.
      if (compatible.length < 2) continue;
      const sources = compatible.flat();
      if (!this.addPaletteBatch(sources, false, 'instance')) continue;
      compatible.forEach(group => combinedStatic.add(group));
      sources.forEach(({ mesh }) => instancedSources.add(mesh));
    }
    const leftovers: Array<{ source: Source; dynamic: boolean; normalMode: NormalMode }> = [];
    for (const { sources, dynamic } of groups.values()) {
      if (combinedStatic.has(sources)) continue;
      const repeated = sources.length >= 2 && (sources[0].mesh.material as THREE.MeshStandardMaterial).isMeshStandardMaterial;
      if (dynamic || !repeated) {
        // Palette normal math matches the original InstancedMesh
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
    {
      const compatible = new Map<string, { sources: Source[]; dynamic: boolean; normalMode: NormalMode }>();
      for (const { source, dynamic, normalMode } of leftovers) {
        // Ordinary static surfaces retain CPU-composed view/normal palettes;
        // the separate existing static InstancedMesh path remains unchanged.
        const key = this.paletteKey(source, dynamic, normalMode);
        if (!key) continue;
        const group = compatible.get(key) ?? { sources: [], dynamic, normalMode };
        group.sources.push(source);
        compatible.set(key, group);
      }
      for (const { sources, dynamic, normalMode } of compatible.values()) {
        if (this.addPaletteBatch(sources, dynamic, normalMode)) sources.forEach(({ mesh }) => instancedSources.add(mesh));
      }
    }
    const moving = this.paletteBatches.filter(batch => batch.dynamic);
    if (moving.length > 1) {
      this.dynamicMatrices = new MatrixAtlas(moving.reduce((parts, batch) => parts + batch.mesh.instanceCount, 0));
      let offset = 0;
      for (const { mesh } of moving) {
        mesh.shareMatrices(this.dynamicMatrices, offset);
        offset += mesh.instanceCount;
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
    // The authored hierarchy is stable between rebuilds. Reject a hidden
    // actor once, instead of walking all of its surfaces in every global batch.
    // Individual eye/clip visibility remains live within each visible actor.
    for (const batch of this.paletteBatches) if (batch.dynamic) { batch.drawStart = Infinity; batch.drawEnd = 0; }
    for (const [root, group] of this.dynamicPaletteRoots) {
      const visible = this.isVisible(root);
      if (visible) {
        for (const { batch, source, index } of group.parts) this.syncPalettePart(batch, source, index);
      } else if (group.visible) {
        for (const { batch, index } of group.parts) batch.mesh.setVisibleAt(index, false);
      }
      group.visible = visible;
    }
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
    for (const batch of this.paletteBatches) {
      const { mesh, sources, dynamic } = batch;
      if (dynamic && this.dynamicRoots) {
        mesh.visible = mesh.count > 0;
        mesh.geometry.setDrawRange(mesh.visible ? batch.drawStart : 0, mesh.visible ? batch.drawEnd - batch.drawStart : 0);
        continue;
      }
      if (!dynamic && !this.staticVisibilityDirty) continue;
      batch.drawStart = Infinity;
      batch.drawEnd = 0;
      sources.forEach((source, index) => {
        this.syncPalettePart(batch, source, index);
      });
      mesh.visible = mesh.count > 0;
      mesh.geometry.setDrawRange(mesh.visible ? batch.drawStart : 0, mesh.visible ? batch.drawEnd - batch.drawStart : 0);
    }
    this.staticVisibilityDirty = false;
  }

  private syncPalettePart(batch: PaletteBatch, source: Source, index: number): void {
    const { mesh } = batch;
    const visible = this.isVisible(source.mesh);
    mesh.setVisibleAt(index, visible);
    if (!visible) return;
    const range = mesh.getGeometryRangeAt(index);
    batch.drawStart = Math.min(batch.drawStart, range.drawStart);
    batch.drawEnd = Math.max(batch.drawEnd, range.drawStart + range.drawCount);
    mesh.setMatrixAt(index, source.mesh.matrixWorld);
    if (!source.color.equals(source.mesh.material.color)) {
      mesh.setColorAt(index, source.mesh.material.color);
      source.color.copy(source.mesh.material.color);
    }
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
    for (const { mesh, sources } of this.paletteBatches) {
      sources.forEach(({ mesh: original, layerMask }) => { original.layers.mask = layerMask; });
      this.root.remove(mesh);
      mesh.dispose();
      mesh.material.dispose();
    }
    this.paletteBatches = [];
    this.dynamicMatrices?.dispose();
    this.dynamicMatrices = undefined;
    this.dynamicPaletteRoots.clear();
  }

  dispose(): void { this.clear(); this.mapArrays.dispose(); this.root.removeFromParent(); }
}

import * as THREE from 'three';

export interface StaticMapArrayLimits { maxTextureSize: number; maxLayers: number; }
interface Entry { texture: THREE.DataArrayTexture; bytes: number; used: boolean; }
const MAX_ARRAY_BYTES = 24 * 1024 * 1024;
const identity = new THREE.Matrix3();

/** Restrict array sampling to the fixed, ordinary canvas planes authored here. */
export function staticPlaneMap(mesh: THREE.Mesh): THREE.CanvasTexture | undefined {
  const geometry = mesh.geometry;
  const material = mesh.material;
  if (!(geometry instanceof THREE.PlaneGeometry) || geometry.parameters.widthSegments !== 1
    || geometry.parameters.heightSegments !== 1 || geometry.groups.length
    || geometry.drawRange.start !== 0 || geometry.drawRange.count < 6
    || Object.keys(geometry.morphAttributes).length || mesh.castShadow
    || mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender
    || mesh.onAfterRender !== THREE.Object3D.prototype.onAfterRender
    || mesh.onBeforeShadow !== THREE.Object3D.prototype.onBeforeShadow
    || mesh.onAfterShadow !== THREE.Object3D.prototype.onAfterShadow
    || mesh.customDepthMaterial || mesh.customDistanceMaterial
    || !(material instanceof THREE.MeshStandardMaterial) || material.transparent
    || material.opacity !== 1 || (material.alphaTest !== 0 && material.alphaTest !== 0.3)
    || material.flatShading || material.normalMap || material.bumpMap || material.displacementMap
    || !(material.map instanceof THREE.CanvasTexture)) return;
  const { width, height } = geometry.parameters;
  const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), uv = geometry.getAttribute('uv');
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
    || Object.keys(geometry.attributes).sort().join(',') !== 'normal,position,uv'
    || !(position instanceof THREE.BufferAttribute) || !(normal instanceof THREE.BufferAttribute)
    || !(uv instanceof THREE.BufferAttribute) || position.count !== 4 || normal.count !== 4 || uv.count !== 4
    || position.itemSize !== 3 || normal.itemSize !== 3 || uv.itemSize !== 2
    || !(position.array instanceof Float32Array) || !(normal.array instanceof Float32Array)
    || !(uv.array instanceof Float32Array) || geometry.index?.count !== 6) return;
  const expected = new Float32Array([-width / 2, height / 2, 0, width / 2, height / 2, 0,
    -width / 2, -height / 2, 0, width / 2, -height / 2, 0]);
  if (expected.some((value, index) => position.array[index] !== value)
    || [0, 1, 1, 1, 0, 0, 1, 0].some((value, index) => uv.array[index] !== value)
    || [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1].some((value, index) => normal.array[index] !== value)
    || [0, 2, 1, 2, 3, 1].some((value, index) => geometry.index!.array[index] !== value)) return;
  const texture = material.map;
  if (texture.matrixAutoUpdate) texture.updateMatrix();
  if (!texture.matrix.equals(identity) || texture.format !== THREE.RGBAFormat || texture.type !== THREE.UnsignedByteType
    || texture.internalFormat !== null || texture.colorSpace !== THREE.SRGBColorSpace
    || texture.wrapS !== THREE.ClampToEdgeWrapping || texture.wrapT !== THREE.ClampToEdgeWrapping
    || texture.minFilter !== THREE.LinearMipmapLinearFilter || texture.magFilter !== THREE.LinearFilter
    || texture.anisotropy !== 4 || !texture.generateMipmaps || !texture.flipY || texture.premultiplyAlpha
    || texture.unpackAlignment !== 4 || texture.mipmaps.length || texture.channel !== 0
    || typeof texture.image?.getContext !== 'function') return;
  return texture;
}

/** Own only the immutable array copies; original canvas textures remain with their sources. */
export class StaticMapArrays {
  private readonly entries = new Map<string, Entry>();
  constructor(private readonly limits?: StaticMapArrayLimits) {}
  beginRebuild(): void { this.entries.forEach(entry => { entry.used = false; }); }
  acquire(textures: readonly THREE.CanvasTexture[]): THREE.DataArrayTexture | undefined {
    const limits = this.limits;
    const width = textures[0]?.image?.width, height = textures[0]?.image?.height;
    if (!limits || !Number.isInteger(limits.maxTextureSize) || !Number.isInteger(limits.maxLayers)
      || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0
      || width > limits.maxTextureSize || height > limits.maxTextureSize || textures.length < 2
      || textures.length > limits.maxLayers
      || textures.some(texture => texture.image.width !== width || texture.image.height !== height)) return;
    const bytes = width * height * 4 * textures.length;
    if (bytes > MAX_ARRAY_BYTES) return;
    const key = textures.map(texture => `${texture.uuid}:${texture.version}`).join('|');
    const cached = this.entries.get(key);
    if (cached) { cached.used = true; return cached.texture; }
    const usedBytes = [...this.entries.values()].filter(entry => entry.used).reduce((sum, entry) => sum + entry.bytes, 0);
    if (usedBytes + bytes > MAX_ARRAY_BYTES) return;
    // Old batches were cleared before rebuilding, so unused copies can be freed.
    this.releaseUnused();
    try {
      const data = new Uint8Array(bytes), stride = width * 4, layerBytes = stride * height;
      textures.forEach((texture, layer) => {
        const pixels = texture.image.getContext('2d')?.getImageData(0, 0, width, height).data;
        if (!pixels || pixels.length !== layerBytes) throw new Error('Canvas pixels unavailable.');
        // Typed array uploads have no canvas flip: reproduce each source's flipY.
        for (let y = 0; y < height; y++) data.set(pixels.subarray((height - y - 1) * stride, (height - y) * stride), layer * layerBytes + y * stride);
      });
      const texture = new THREE.DataArrayTexture(data, width, height, textures.length);
      texture.format = THREE.RGBAFormat;
      texture.type = THREE.UnsignedByteType;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = 4;
      texture.generateMipmaps = true;
      texture.flipY = false;
      texture.premultiplyAlpha = false;
      texture.unpackAlignment = 4;
      texture.matrixAutoUpdate = false;
      texture.needsUpdate = true;
      this.entries.set(key, { texture, bytes, used: true });
      return texture;
    } catch { return; }
  }
  private releaseUnused(): void {
    for (const [key, entry] of this.entries) if (!entry.used) {
      entry.texture.dispose();
      this.entries.delete(key);
    }
  }
  endRebuild(): void { this.releaseUnused(); }
  dispose(): void { this.entries.forEach(entry => entry.texture.dispose()); this.entries.clear(); }
}

/** Keep the stock map, alpha-test and PBR chunks, changing only their sampler dimension. */
export function configureStaticArrayMap(shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.vertexShader = 'flat varying float vPlatopMapLayer;\n' + shader.vertexShader
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlatopMapLayer = platopPart;');
  shader.fragmentShader = 'flat varying float vPlatopMapLayer;\n' + shader.fragmentShader
    .replace('#include <map_pars_fragment>', THREE.ShaderChunk.map_pars_fragment.replace('uniform sampler2D map;', 'uniform highp sampler2DArray map;'))
    .replace('#include <map_fragment>', THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )', 'texture( map, vec3( vMapUv, vPlatopMapLayer ) )'));
}

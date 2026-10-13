import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { OfficeRooms, RoomLighting } from '../types';

/** A small, prefiltered softbox studio, baked once rather than drawn every frame. */
function bakeStudio(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const source = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  try {
    // At the deliberately soft finishes in the office, 128px contains all the
    // useful reflection detail. The source scene and convolution buffers are temporary.
    return generator.fromScene(source, 0.06, 0.1, 100, { size: 128 });
  } finally {
    source.dispose();
    generator.dispose();
  }
}

export class StudioEnvironment {
  private target?: THREE.WebGLRenderTarget;
  private readonly previous: THREE.Scene['environment'];
  private readonly previousIntensity: number;
  private disposed = false;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly scene: THREE.Scene,
    private readonly bake: (renderer: THREE.WebGLRenderer) => THREE.WebGLRenderTarget = bakeStudio) {
    this.previous = scene.environment;
    this.previousIntensity = scene.environmentIntensity;
    this.restore();
  }

  restore(): void {
    if (this.disposed) return;
    if (this.target && this.scene.environment === this.target.texture) {
      this.scene.environment = this.previous;
      this.scene.environmentIntensity = this.previousIntensity;
    }
    this.target?.dispose();
    this.target = undefined;
    try {
      this.target = this.bake(this.renderer);
      this.scene.environment = this.target.texture;
      this.scene.environmentIntensity = 0.32;
    } catch {
      // Reflection support is cosmetic. Keep the existing daylight scene usable
      // on a device that cannot allocate the small half-float environment target.
      this.target?.dispose();
      this.target = undefined;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.target && this.scene.environment === this.target.texture) {
      this.scene.environment = this.previous;
      this.scene.environmentIntensity = this.previousIntensity;
    }
    this.target?.dispose();
    this.target = undefined;
  }
}

type Surface = 'wall' | 'rug' | 'furniture';
interface StyledRoom { root: THREE.Group; }
interface VertexFinish { attribute: THREE.BufferAttribute; original: Float32Array; roles: Uint8Array; }
interface MaterialFinish { material: THREE.MeshStandardMaterial; original: THREE.Color; role: Surface; }
interface Finishes { defaults: Record<Surface, THREE.Color>; vertices: VertexFinish[]; materials: MaterialFinish[]; signature: string; }
const roles: Array<Surface | undefined> = [undefined, 'wall', 'rug', 'furniture'];

/** Recolour authored finishes on a style event; plants and unrelated props retain their own palette. */
export class StudioRoomFinishes {
  private readonly finishes = new Map<string, Finishes>();

  constructor(rooms: ReadonlyMap<string, StyledRoom>) {
    rooms.forEach(({ root }, id) => {
      const palette = root.userData.roomPalette as Record<Surface, string> | undefined;
      if (!palette) return;
      const entry: Finishes = {
        defaults: { wall: new THREE.Color(palette.wall), rug: new THREE.Color(palette.rug), furniture: new THREE.Color(palette.furniture) },
        vertices: [], materials: [], signature: '[null,null,null]',
      };
      root.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh || Array.isArray(mesh.material)) return;
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (!material.isMeshStandardMaterial) return;
        const mask = mesh.geometry.userData.roomSurfaceRoles as Uint8Array | undefined;
        const attribute = mesh.geometry.getAttribute('color');
        if (mask && attribute instanceof THREE.BufferAttribute && mask.some(role => role > 0)) {
          entry.vertices.push({ attribute, roles: mask, original: new Float32Array(attribute.array) });
        }
        const role = mesh.userData.roomSurface as Surface | undefined;
        if (role && roles.includes(role)) {
          // Textured planes already own their materials. A lone untextured prop
          // may still use SceneKit's cache, so give that room its own finish.
          const owned = material.map || material.transparent ? material : material.clone();
          mesh.material = owned;
          entry.materials.push({ material: owned, original: owned.color.clone(), role });
        }
      });
      this.finishes.set(id, entry);
    });
  }

  sync(styles: OfficeRooms | undefined): boolean {
    let changed = false;
    this.finishes.forEach((entry, id) => {
      const palette = styles?.[id]?.palette ?? {};
      const signature = JSON.stringify([palette.wall ?? null, palette.rug ?? null, palette.furniture ?? null]);
      if (signature === entry.signature) return;
      entry.signature = signature;
      const ratios = new Map<Surface, THREE.Color>();
      for (const role of ['wall', 'rug', 'furniture'] as const) {
        const value = palette[role];
        if (!value) continue;
        const color = new THREE.Color(value), original = entry.defaults[role];
        color.setRGB(color.r / original.r, color.g / original.g, color.b / original.b);
        ratios.set(role, color);
      }
      for (const { attribute, original, roles: mask } of entry.vertices) {
        attribute.copyArray(original);
        for (let vertex = 0; vertex < mask.length; vertex++) {
          const role = roles[mask[vertex]], ratio = role ? ratios.get(role) : undefined;
          if (!ratio) continue;
          const offset = vertex * 3;
          attribute.setXYZ(vertex, original[offset] * ratio.r, original[offset + 1] * ratio.g, original[offset + 2] * ratio.b);
        }
        attribute.needsUpdate = true;
      }
      for (const { material, original, role } of entry.materials) {
        material.color.copy(original);
        const ratio = ratios.get(role);
        if (ratio) material.color.multiply(ratio);
      }
      changed = true;
    });
    return changed;
  }
}

/** Night is still readable in daylight; these factors only control local room lamps. */
export function roomLightingFactor(lighting: Partial<RoomLighting> | undefined): number {
  const mood = lighting?.mode === 'off' ? 0 : lighting?.mode === 'night' ? 0.35 : lighting?.mode === 'cozy' ? 0.75 : 1;
  return mood * (lighting?.brightness ?? 1);
}

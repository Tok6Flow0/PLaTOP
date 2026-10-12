import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export type Primitive = 'box' | 'roundedBox' | 'sphere' | 'cylinder' | 'cone' | 'octahedron' | 'capsule';

/** Shared low-resolution surfaces keep the tiny office inexpensive to draw. */
export class SceneKit {
  private materials = new Map<string, THREE.MeshStandardMaterial>();
  private shapes = new Map<string, THREE.BufferGeometry>();

  material(color: string): THREE.MeshStandardMaterial {
    let material = this.materials.get(color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, roughness: 0.77, metalness: 0 });
      this.materials.set(color, material);
    }
    return material;
  }

  geometry(kind: Primitive): THREE.BufferGeometry {
    let geometry = this.shapes.get(kind);
    if (!geometry) {
      geometry = kind === 'box' ? new THREE.BoxGeometry(1, 1, 1)
        : kind === 'roundedBox' ? new RoundedBoxGeometry(1, 1, 1, 2, 0.16)
        : kind === 'capsule' ? new THREE.CapsuleGeometry(0.32, 0.36, 4, 12)
        : kind === 'sphere' ? new THREE.SphereGeometry(0.5, 20, 14)
        : kind === 'cylinder' ? new THREE.CylinderGeometry(0.5, 0.5, 1, 20)
        : kind === 'cone' ? new THREE.ConeGeometry(0.5, 1, 4)
        : new THREE.OctahedronGeometry(0.5);
      this.shapes.set(kind, geometry);
    }
    return geometry;
  }

  mesh(parent: THREE.Object3D, kind: Primitive, color: string,
    position: [number, number, number], scale: [number, number, number], rotation?: [number, number, number]): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(kind), this.material(color));
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  dispose(): void {
    this.shapes.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.shapes.clear();
    this.materials.clear();
  }
}

export function textSprite(text: string, color: string, width = 3, height = 0.5): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 112;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color;
    context.font = '600 48px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 24);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false, transparent: true }));
  sprite.scale.set(width, height, 1);
  return sprite;
}

/** Dispose externally loaded models and locally created sprite resources once. */
export function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse((object) => {
    const renderable = object as THREE.Mesh;
    if (renderable.geometry) geometries.add(renderable.geometry);
    if (renderable.material) {
      const list = Array.isArray(renderable.material) ? renderable.material : [renderable.material];
      list.forEach((material) => {
        materials.add(material);
        Object.values(material).forEach((value: unknown) => {
          if (value instanceof THREE.Texture) textures.add(value);
        });
      });
    }
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) skeletons.add((object as THREE.SkinnedMesh).skeleton);
  });
  textures.forEach((texture) => {
    const bitmap = texture.source?.data as { close?: () => void } | undefined;
    bitmap?.close?.();
    texture.dispose();
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  skeletons.forEach((skeleton) => skeleton.dispose());
}

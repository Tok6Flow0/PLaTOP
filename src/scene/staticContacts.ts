import * as THREE from 'three';

export interface RugSurface { bounds: [number, number, number, number]; height: number; }
export function actorContactHeight(floorY: number, localX: number, localZ: number, rug?: RugSurface): number {
  if (rug && localX >= rug.bounds[0] && localX <= rug.bounds[2] && localZ >= rug.bounds[1] && localZ <= rug.bounds[3]) {
    return Math.max(floorY + 0.008, rug.height + 0.006);
  }
  return floorY + 0.008;
}

interface Contact { matrix: THREE.Matrix4; root: THREE.Object3D; }

/** One static draw softly grounds furniture; only an office visibility event repacks instances. */
export class StaticContacts {
  private readonly contacts: Contact[] = [];
  private readonly texture: THREE.CanvasTexture;
  private readonly geometry = new THREE.PlaneGeometry(1, 1);
  private readonly material: THREE.MeshBasicMaterial;
  readonly mesh: THREE.InstancedMesh;
  private signature = '';
  private disposed = false;

  constructor(scene: THREE.Scene, roots: readonly THREE.Object3D[]) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context) {
      const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 31);
      gradient.addColorStop(0, 'rgba(255,255,255,.9)');
      gradient.addColorStop(0.2, 'rgba(255,255,255,.78)');
      gradient.addColorStop(0.55, 'rgba(255,255,255,.28)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
    }
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, color: '#76664f', opacity: 0.34,
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    scene.updateMatrixWorld(true);
    for (const root of roots) root.traverse(object => {
      let ancestor: THREE.Object3D | null = object;
      while (ancestor && ancestor !== root) {
        // Legacy decoration containers are hidden until explicitly requested.
        // Their invisible placeholders must not leave contact patches behind.
        if (!ancestor.visible) return;
        ancestor = ancestor.parent;
      }
      const footprints = object.userData.floorContacts as number[][] | undefined;
      for (const [x, y, z, width, depth] of footprints ?? []) {
        const local = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), new THREE.Vector3(width, depth, 1));
        this.contacts.push({ root, matrix: new THREE.Matrix4().multiplyMatrices(object.matrixWorld, local) });
      }
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.contacts.length);
    this.mesh.name = 'Soft furnishing contacts';
    this.mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.matrixAutoUpdate = false;
    scene.add(this.mesh);
    this.syncVisibility();
  }

  syncVisibility(): void {
    if (this.disposed) return;
    const signature = this.contacts.map(contact => contact.root.visible ? '1' : '0').join('');
    if (signature === this.signature) return;
    this.signature = signature;
    let count = 0;
    for (const contact of this.contacts) if (contact.root.visible) this.mesh.setMatrixAt(count++, contact.matrix);
    this.mesh.count = count;
    this.mesh.visible = count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  restore(): void {
    if (this.disposed) return;
    this.texture.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
  }
}

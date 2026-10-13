import * as THREE from 'three';
import type { ObserverMode, ObserverMove } from '../types';

/** Deliberately has no office, actor, motor, bridge or action dependency. */
export interface ObserverOrbit {
  target: THREE.Vector3;
  cursor: THREE.Vector3;
  enabled: boolean;
}

export interface ObserverViewport { width: number; height: number; }

/** A visit may outlive a responsive layout change; identical sizes need no refit. */
export function observerViewportChanged(before: ObserverViewport | undefined, width: number, height: number): boolean {
  return !!before && (before.width !== width || before.height !== height);
}

interface OrbitSnapshot {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  up: THREE.Vector3;
  target: THREE.Vector3;
  cursor: THREE.Vector3;
  enabled: boolean;
  fov: number;
  near: number;
  far: number;
  zoom: number;
  view: THREE.PerspectiveCamera['view'];
}

/** A small, static, gauzy volume: it needs no texture download or idle timer. */
export function makeObserverMist(): { root: THREE.Group; dispose: () => void } {
  const root = new THREE.Group();
  root.name = 'Local observer mist — invisible to agents';
  root.userData.observerOnly = true;
  root.visible = false;
  const geometry = new THREE.SphereGeometry(1, 24, 16);
  const material = new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color('#c9fff0') } },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    toneMapped: true,
    vertexShader: `
      varying vec3 localPoint;
      varying vec3 viewNormal;
      varying vec3 viewPoint;
      void main() {
        localPoint = position;
        viewNormal = normalize(normalMatrix * normal);
        vec4 point = modelViewMatrix * vec4(position, 1.0);
        viewPoint = point.xyz;
        gl_Position = projectionMatrix * point;
      }`,
    fragmentShader: `
      uniform vec3 tint;
      varying vec3 localPoint;
      varying vec3 viewNormal;
      varying vec3 viewPoint;
      void main() {
        float edge = max(0.0, dot(normalize(viewNormal), normalize(-viewPoint)));
        float strands = sin(localPoint.y * 17.0 + sin(localPoint.x * 11.0) * 2.3 + localPoint.z * 8.0);
        float cloud = 0.65 + 0.35 * sin(localPoint.x * 7.0 + localPoint.z * 9.0 + strands);
        float alpha = smoothstep(0.0, 0.75, edge) * (0.045 + cloud * 0.055);
        gl_FragColor = vec4(tint * 2.2, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  for (let index = 0; index < 11; index++) {
    const angle = index * 2.399963;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(Math.cos(angle) * .18, (index - 5) * .065, Math.sin(angle) * .18);
    mesh.scale.set(.35 + index % 3 * .045, .28 + index % 4 * .065, .33 + index % 2 * .06);
    mesh.rotation.set(index * .17, angle, index * .13);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    root.add(mesh);
  }
  let disposed = false;
  return { root, dispose() {
    if (disposed) return;
    disposed = true;
    root.removeFromParent();
    root.clear();
    geometry.dispose();
    material.dispose();
  } };
}

/** Camera-only, collision-free exploration. Every change is explicitly input-driven. */
export class ObserverMist {
  readonly mist = makeObserverMist();
  readonly position = new THREE.Vector3();
  mode: ObserverMode = 'third-person';
  yaw = 0;
  pitch = -.12;
  private saved?: OrbitSnapshot;
  private disposed = false;
  private readonly bounds: THREE.Box3;

  constructor(private readonly camera: THREE.PerspectiveCamera, private readonly orbit: ObserverOrbit, bounds: THREE.Box3) {
    this.bounds = bounds.clone();
  }

  get active(): boolean { return !!this.saved; }

  enter(mode: ObserverMode = 'third-person'): boolean {
    if (this.disposed || this.saved || !this.validMode(mode)) return false;
    this.saved = {
      position: this.camera.position.clone(), quaternion: this.camera.quaternion.clone(), up: this.camera.up.clone(),
      target: this.orbit.target.clone(), cursor: this.orbit.cursor.clone(), enabled: this.orbit.enabled,
      fov: this.camera.fov, near: this.camera.near, far: this.camera.far, zoom: this.camera.zoom,
      view: this.camera.view ? { ...this.camera.view } : null,
    };
    this.position.copy(this.orbit.target);
    this.position.y = THREE.MathUtils.clamp(1.7, this.bounds.min.y, this.bounds.max.y);
    const direction = this.orbit.target.clone().sub(this.camera.position);
    this.yaw = Math.atan2(direction.x, -direction.z);
    this.pitch = -.12;
    this.mode = mode;
    this.orbit.enabled = false;
    this.camera.near = .035;
    this.camera.far = Math.max(this.saved.far, 180);
    this.camera.zoom = 1;
    this.camera.clearViewOffset();
    this.apply();
    return true;
  }

  exit(): boolean {
    const saved = this.saved;
    if (!saved) return false;
    this.saved = undefined;
    this.mist.root.visible = false;
    this.camera.position.copy(saved.position);
    this.camera.quaternion.copy(saved.quaternion);
    this.camera.up.copy(saved.up);
    this.camera.fov = saved.fov;
    this.camera.near = saved.near;
    this.camera.far = saved.far;
    this.camera.zoom = saved.zoom;
    this.camera.view = saved.view ? { ...saved.view } : null;
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    this.orbit.target.copy(saved.target);
    this.orbit.cursor.copy(saved.cursor);
    this.orbit.enabled = saved.enabled;
    return true;
  }

  setMode(mode: ObserverMode): boolean {
    if (!this.active || !this.validMode(mode) || mode === this.mode) return false;
    this.mode = mode;
    this.apply();
    return true;
  }

  move(direction: ObserverMove, distance = .32): boolean {
    if (!this.active || !Number.isFinite(distance) || distance <= 0) return false;
    const step = Math.min(distance, 1);
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const previous = this.position.clone();
    if (direction === 'forward') this.position.addScaledVector(forward, step);
    else if (direction === 'back') this.position.addScaledVector(forward, -step);
    else if (direction === 'left') this.position.addScaledVector(right, -step);
    else if (direction === 'right') this.position.addScaledVector(right, step);
    else if (direction === 'up') this.position.y += step;
    else if (direction === 'down') this.position.y -= step;
    else return false;
    // Only the outer exploration envelope is bounded. Furniture and walls are
    // intentionally not consulted: a spectator has no physical office presence.
    this.position.clamp(this.bounds.min, this.bounds.max);
    if (this.position.equals(previous)) return false;
    this.apply();
    return true;
  }

  look(horizontal: number, vertical: number): boolean {
    if (!this.active || !Number.isFinite(horizontal) || !Number.isFinite(vertical) || (!horizontal && !vertical)) return false;
    this.yaw = THREE.MathUtils.euclideanModulo(this.yaw + THREE.MathUtils.clamp(horizontal, -.6, .6) + Math.PI, Math.PI * 2) - Math.PI;
    this.pitch = THREE.MathUtils.clamp(this.pitch + THREE.MathUtils.clamp(vertical, -.6, .6), -Math.PI * .43, Math.PI * .43);
    this.apply();
    return true;
  }

  resize(aspect: number): void {
    if (!this.active || !Number.isFinite(aspect) || aspect <= 0) return;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    if (this.disposed) return;
    this.exit();
    this.disposed = true;
    this.mist.dispose();
  }

  private validMode(mode: ObserverMode): boolean { return mode === 'first-person' || mode === 'third-person'; }

  private apply(): void {
    this.position.clamp(this.bounds.min, this.bounds.max);
    const direction = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    this.mist.root.position.copy(this.position);
    this.mist.root.rotation.y = -this.yaw;
    this.mist.root.visible = this.mode === 'third-person';
    this.mist.root.updateMatrixWorld(true);
    this.camera.fov = this.mode === 'first-person' ? 55 : 45;
    this.camera.position.copy(this.position);
    if (this.mode === 'third-person') this.camera.position.addScaledVector(direction, -2.6).add(new THREE.Vector3(0, .45, 0));
    this.camera.position.clamp(this.bounds.min, this.bounds.max);
    const target = this.position.clone().addScaledVector(direction, this.mode === 'first-person' ? 1 : .45);
    this.orbit.target.copy(target);
    this.camera.lookAt(target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
  }
}

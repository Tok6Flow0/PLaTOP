import * as THREE from 'three';
import type { Activity, Character } from '../types';
import { SceneKit } from './primitives';

interface Personality {
  head: THREE.Group;
  body: THREE.Group;
  arms: THREE.Group[];
  feet: THREE.Group[];
  eyes: THREE.Object3D[];
  highlights: THREE.Object3D[];
  wings: THREE.Group[];
  glow?: THREE.MeshStandardMaterial;
  headY: number;
  bodyY: number;
}

function joint(parent: THREE.Object3D, name: string, at: [number, number, number]): THREE.Group {
  const group = new THREE.Group(); group.name = name; group.position.set(...at); parent.add(group); return group;
}
function ring(parent: THREE.Object3D, kit: SceneKit, color: string, radius: number, thickness: number,
  at: [number, number, number], rotation?: [number, number, number]): void {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 6, 20), kit.material(color));
  mesh.position.set(...at); if (rotation) mesh.rotation.set(...rotation); mesh.castShadow = true; parent.add(mesh);
}

function faceplate(parent: THREE.Object3D, kit: SceneKit, color: string, width: number, height: number, offset: number): void {
  // A sampled curved surface is essential: sparse box faces cut chords through the helmet.
  const columns = 24, rows = 16, radius = Math.min(width, height) * 0.25;
  const vertices: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const y = -height / 2 + row / rows * height;
    const cornerY = Math.max(0, Math.abs(y) - (height / 2 - radius));
    const limit = width / 2 - radius + Math.sqrt(Math.max(0, radius * radius - cornerY * cornerY));
    for (let column = 0; column <= columns; column++) {
      const x = -limit + column / columns * limit * 2, py = y + 0.005;
      const surface = 0.345 * Math.sqrt(Math.max(0.05, 1 - (x / 0.435) ** 2 - (py / 0.38) ** 2));
      vertices.push(x, py, surface + offset);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, kit.material(color)); mesh.receiveShadow = true; parent.add(mesh);
}

/** Editable ceramic character models, built to the approved starting-office reference. */
export function makeProxy(character: Character, kit: SceneKit): THREE.Group {
  const group = new THREE.Group(); group.name = `${character.id}:reference-character`;
  group.userData.assetStatus = 'reference-model';
  const { id, kind } = character;
  const cream = '#ede3cf', ink = '#233b43', gold = '#bd8b45';
  const isWayfinder = id.startsWith('intake-');
  const bodyColor = isWayfinder ? '#e3dac7' : id === 'bridge-keeper' ? '#56856a' : id === 'hr-compass' ? '#8f9b7c' : character.color;
  const headColor = kind === 'robot' ? id === 'hr-lens' ? '#dfc797' : id === 'hr-relay' ? '#ddcaa3' : cream : character.color;
  const body = joint(group, 'body', [0, 0.57, 0]);
  const head = joint(group, 'head', [0, 1.08, 0]);
  const data: Personality = { body, head, bodyY: 0.57, headY: 1.08, arms: [], feet: [], eyes: [], highlights: [], wings: [] };
  const faceMaterial = kit.material(ink); faceMaterial.roughness = 0.31;

  if (kind === 'robot') {
    const leader = id === 'bridge-jarvis';
    kit.mesh(body, 'roundedBox', bodyColor, [0, 0, 0], [0.57, 0.65, 0.46]);
    kit.mesh(body, 'sphere', bodyColor, [0, -0.21, 0], [0.53, 0.34, 0.44]);
    kit.mesh(body, 'roundedBox', leader ? '#55806b' : character.accent, [0, -0.015, 0.24], [0.18, 0.23, 0.035]);
    kit.mesh(body, 'cylinder', '#687f6e', [0, 0.38, 0], [0.17, 0.11, 0.17]);
    kit.mesh(head, 'sphere', headColor, [0, 0, 0], [0.87, 0.76, 0.69]);
    faceplate(head, kit, '#9cac9e', 0.60, 0.42, 0.007);
    faceplate(head, kit, ink, 0.55, 0.37, 0.018);
    // Soft reflections and inset eyes make the small faces readable from above.
    kit.mesh(head, 'sphere', '#819d99', [-0.15, 0.11, 0.337], [0.12, 0.037, 0.008]);
    const smileCurve = new THREE.EllipseCurve(0, 0, 0.047, 0.025, Math.PI, Math.PI * 2, false, 0);
    const smilePath = new THREE.CatmullRomCurve3(smileCurve.getPoints(12).map(point => new THREE.Vector3(point.x, point.y - 0.09, 0.36)));
    const smile = new THREE.Mesh(new THREE.TubeGeometry(smilePath, 12, 0.008, 4, false), kit.material('#152b32'));
    head.add(smile);
    [-1, 1].forEach(sign => {
      kit.mesh(head, 'cylinder', character.accent, [sign * 0.425, 0, 0], [0.20, 0.11, 0.20], [0, 0, Math.PI / 2]);
      kit.mesh(head, 'cylinder', bodyColor, [sign * 0.48, 0, 0], [0.13, 0.035, 0.13], [0, 0, Math.PI / 2]);
      const eye = kit.mesh(head, 'sphere', '#111f23', [sign * 0.12, 0.015, 0.357], [0.078, 0.112, 0.021]);
      data.eyes.push(eye);
      data.highlights.push(kit.mesh(head, 'sphere', '#d8e6dc', [sign * 0.12 - 0.012, 0.043, 0.37], [0.022, 0.027, 0.008]));
      const arm = joint(body, sign < 0 ? 'arm_l' : 'arm_r', [sign * 0.36, 0.19, 0]);
      kit.mesh(arm, 'capsule', bodyColor, [0, -0.14, 0], [0.28, 0.43, 0.28], [0, 0, sign * -0.12]);
      const extremity = isWayfinder ? '#2d4250' : id.startsWith('hr-') ? '#52694d' : id === 'bridge-jarvis' ? '#3b6355' : '#3f6c5a';
      kit.mesh(arm, 'sphere', extremity, [0, -0.33, 0.035], [0.23, 0.22, 0.22]);
      data.arms.push(arm);
      const foot = joint(group, sign < 0 ? 'foot_l' : 'foot_r', [sign * 0.17, 0.10, 0.025]);
      kit.mesh(foot, 'sphere', extremity, [0, 0, 0], [0.25, 0.20, 0.38]);
      data.feet.push(foot);
    });
    kit.mesh(head, 'cylinder', '#6f8d7c', [0, 0.39, 0], [0.045, 0.17, 0.045]);
    kit.mesh(head, 'sphere', leader ? '#cb873d' : character.accent, [0, 0.5, 0], [0.15, 0.16, 0.15]);
    if (id === 'bridge-scout' || id === 'hr-lens') ring(head, kit, '#98afa2', 0.115, 0.024, [0.12, 0.01, 0.373]);
    if (id === 'bridge-keeper') {
      kit.mesh(body, 'roundedBox', '#e9d9b9', [0.19, -0.08, 0.30], [0.24, 0.31, 0.06], [0, 0, -0.12]);
      kit.mesh(body, 'box', '#648879', [0.19, -0.08, 0.335], [0.20, 0.27, 0.015], [0, 0, -0.12]);
    }
    if (isWayfinder) {
      kit.mesh(body, 'roundedBox', '#314958', [0, 0.03, 0.245], [0.21, 0.20, 0.022]);
      if (id === 'intake-beacon') {
        kit.mesh(head, 'cylinder', '#c19a61', [0, 0.47, 0], [0.15, 0.24, 0.15]);
        kit.mesh(head, 'sphere', '#efd39a', [0, 0.59, 0], [0.12, 0.11, 0.12]);
      }
    }
    group.scale.setScalar(leader ? 1.18 : id === 'bridge-scout' ? 1.03 : 1.10);
  } else if (kind === 'lantern') {
    const green = id === 'support-beacon' ? '#37664b' : '#ae7d38';
    head.position.y = 0.64; data.headY = 0.64;
    body.position.y = 0.12; data.bodyY = 0.12;
    kit.mesh(body, 'cylinder', green, [0, 0.03, 0], [0.60, 0.15, 0.55]);
    kit.mesh(body, 'cylinder', gold, [0, 0.12, 0], [0.49, 0.06, 0.45]);
    const glow = new THREE.MeshStandardMaterial({ color: '#ffd27c', emissive: '#ffae3e', emissiveIntensity: 0.6, roughness: 0.35 });
    const light = new THREE.Mesh(kit.geometry('roundedBox'), glow); light.scale.set(0.41, 0.56, 0.38); head.add(light); data.glow = glow;
    [-1, 1].forEach(sign => {
      kit.mesh(head, 'capsule', green, [sign * 0.24, 0, 0], [0.09, 0.64, 0.09]);
      const eye = kit.mesh(head, 'sphere', ink, [sign * 0.09, 0.03, 0.21], [0.046, 0.066, 0.018]); data.eyes.push(eye);
    });
    kit.mesh(head, 'cylinder', green, [0, 0.33, 0], [0.62, 0.09, 0.57]);
    kit.mesh(head, 'sphere', green, [0, 0.38, 0], [0.50, 0.26, 0.46]);
    kit.mesh(head, 'sphere', gold, [0, 0.54, 0], [0.12, 0.08, 0.12]);
    ring(head, kit, green, 0.14, 0.032, [0, 0.68, 0]);
    kit.mesh(head, 'cylinder', green, [0, -0.31, 0], [0.57, 0.07, 0.52]);
    if (id === 'reflection-lumen') group.scale.setScalar(1.25);
  } else if (kind === 'owl') {
    const navy = id === 'email-owl';
    body.position.y = 0.49; data.bodyY = 0.49;
    head.position.y = 0.91; data.headY = 0.91;
    const feathers = navy ? '#273b50' : '#e8dfce';
    kit.mesh(body, 'sphere', feathers, [0, 0, 0], [0.70, 0.83, 0.55]);
    kit.mesh(body, 'sphere', navy ? '#405364' : '#f1e6cc', [0, -0.02, 0.20], [0.46, 0.58, 0.17]);
    kit.mesh(head, 'sphere', feathers, [0, 0, 0], [0.78, 0.65, 0.54]);
    [-1, 1].forEach(sign => {
      kit.mesh(head, 'sphere', '#f5edd7', [sign * 0.17, -0.015, 0.23], [0.35, 0.40, 0.16]);
      kit.mesh(head, 'sphere', '#ab8a56', [sign * 0.17, 0, 0.307], [0.17, 0.22, 0.035]);
      const eye = kit.mesh(head, 'sphere', '#172b32', [sign * 0.17, 0.007, 0.325], [0.108, 0.15, 0.028]); data.eyes.push(eye);
      data.highlights.push(kit.mesh(head, 'sphere', '#ffffff', [sign * 0.17 - 0.02, 0.043, 0.342], [0.035, 0.045, 0.01]));
      kit.mesh(head, 'cone', feathers, [sign * 0.25, 0.31, -0.045], [0.20, 0.25, 0.19], [0, 0, sign * -0.25]);
      const wing = joint(body, sign < 0 ? 'wing_l' : 'wing_r', [sign * 0.34, 0.13, 0]);
      kit.mesh(wing, 'sphere', feathers, [0, -0.14, 0], [0.18, 0.53, 0.32], [0, 0, sign * 0.25]); data.wings.push(wing);
      kit.mesh(group, 'sphere', gold, [sign * 0.15, 0.08, 0.08], [0.20, 0.10, 0.24]);
    });
    kit.mesh(head, 'cone', gold, [0, -0.10, 0.345], [0.12, 0.16, 0.13], [Math.PI / 2, 0, Math.PI]);
    if (id === 'reflection-quill') kit.mesh(body, 'cylinder', '#bb9456', [0.37, 0.02, 0.18], [0.045, 0.50, 0.045], [0, 0, -0.35]);
    if (id === 'reflection-echo') { ring(body, kit, gold, 0.12, 0.025, [0.37, 0.04, 0.23]); kit.mesh(body, 'cylinder', gold, [0.37, -0.13, 0.23], [0.035, 0.20, 0.035]); }
    if (navy) kit.mesh(body, 'roundedBox', cream, [0, -0.12, 0.285], [0.22, 0.14, 0.025]);
  } else {
    body.position.y = 0.69; data.bodyY = 0.69; head.position.y = 0.89; data.headY = 0.89;
    kit.mesh(body, 'sphere', '#c69b54', [0, 0, 0], [0.42, 0.40, 0.71]);
    kit.mesh(head, 'sphere', '#c9a462', [0, 0, 0.17], [0.39, 0.35, 0.36]);
    [-1, 1].forEach(sign => {
      const wing = joint(body, sign < 0 ? 'wing_l' : 'wing_r', [sign * 0.20, 0.06, 0]);
      kit.mesh(wing, 'sphere', '#d2af70', [sign * 0.24, 0, -0.02], [0.64, 0.08, 0.36], [0, sign * 0.35, sign * 0.05]); data.wings.push(wing);
      const eye = kit.mesh(head, 'sphere', ink, [sign * 0.12, 0.02, 0.32], [0.04, 0.055, 0.02]); data.eyes.push(eye);
    });
    kit.mesh(head, 'cone', '#bd8042', [0, -0.045, 0.36], [0.10, 0.18, 0.10], [Math.PI / 2, 0, 0]);
    kit.mesh(body, 'octahedron', '#557e76', [0, -0.015, -0.38], [0.29, 0.06, 0.35]);
  }
  data.eyes.forEach(eye => { eye.userData.restEyeY = eye.scale.y; });
  group.userData.personality = data;
  return group;
}

/** Small character-specific gestures; no physics, root motion or extra render loop. */
export function animateCharacter(model: THREE.Object3D, status: Activity, time: number, index: number, moving: boolean, frozen: boolean): void {
  const p = model.userData.personality as Personality | undefined; if (!p) return;
  const t = frozen ? 0 : time + index * 0.7;
  const asleep = status === 'sleeping';
  const working = status === 'active' && !moving;
  p.body.position.y = p.bodyY + (asleep ? Math.sin(t * 1.4) * 0.012 : moving ? Math.abs(Math.sin(t * 6)) * 0.028 : 0);
  p.head.rotation.set(asleep ? 0.16 : working ? 0.09 : 0, working ? Math.sin(t * 1.3) * 0.09 : 0, asleep ? 0.10 : moving ? Math.sin(t * 6) * 0.035 : 0);
  p.arms.forEach((arm, i) => { arm.rotation.x = moving ? Math.sin(t * 6 + i * Math.PI) * 0.28 : working ? -0.5 + Math.sin(t * 6 + i) * 0.09 : asleep ? -0.16 : 0; });
  p.feet.forEach((foot, i) => { foot.rotation.x = moving ? Math.sin(t * 6 + i * Math.PI) * 0.25 : 0; });
  p.wings.forEach((wing, i) => { wing.rotation.z = (i ? 1 : -1) * (moving ? Math.sin(t * 7) * 0.35 : asleep ? 0.10 : 0); });
  const blink = !frozen && status === 'active' && t % 4.7 < 0.12;
  p.eyes.forEach(eye => { eye.scale.y = eye.userData.restEyeY * (asleep ? 0.13 : blink ? 0.09 : 1); });
  p.highlights.forEach(highlight => { highlight.visible = !asleep && !blink; });
  if (p.glow) p.glow.emissiveIntensity = asleep ? 0.24 + Math.sin(t * 1.4) * 0.04 : 0.65 + Math.sin(t * 2) * 0.08;
}

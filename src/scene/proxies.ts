import * as THREE from 'three';
import type { Activity, Character } from '../types';
import { SceneKit } from './primitives';
import { characterMesh, characterMaterial, characterSmile, curvedFace, type CharacterForm, type CharacterFinish } from './characterGeometry';

interface Personality {
  kind: Character['kind'];
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
/** Editable clay characters. All surfaces, finishes and joints belong to this scene. */
export function makeProxy(character: Character, kit: SceneKit): THREE.Group {
  const group = new THREE.Group(); group.name = `${character.id}:reference-character`;
  group.userData.assetStatus = 'reference-model';
  const { id, kind } = character;
  const cream = '#eee4d0', ink = '#243c43', gold = '#bd9155';
  const wayfinder = id.startsWith('intake-'), leader = id === 'bridge-jarvis';
  const bodyColor = wayfinder ? '#e5ddca' : id === 'bridge-keeper' ? '#71917c' : id === 'hr-compass' ? '#a6ae91' : character.color;
  const headColor = kind === 'robot' ? id === 'hr-lens' ? '#a5b69b' : id === 'hr-relay' ? '#d6d6b7' : cream : character.color;
  const body = joint(group, 'body', [0, .57, 0]), head = joint(group, 'head', [0, 1.08, 0]);
  const data: Personality = { kind, body, head, bodyY: .57, headY: 1.08, arms: [], feet: [], eyes: [], highlights: [], wings: [] };
  const sculpt = (parent: THREE.Object3D, form: CharacterForm, color: string, at: [number, number, number],
    scale: [number, number, number], rotation?: [number, number, number], finish?: CharacterFinish) =>
    characterMesh(kit, parent, form, color, at, scale, rotation, finish);
  const ring = (parent: THREE.Object3D, color: string, diameter: number, at: [number, number, number], rotation?: [number, number, number]) =>
    sculpt(parent, 'ring', color, at, [diameter, diameter, diameter], rotation, 'brass');

  if (kind === 'robot') {
    // A single continuous pear-shaped torso joins the shoulders and belly.
    // Small inset panels sit on that shell, instead of separate stacked blocks.
    sculpt(body, 'torso', bodyColor, [0, -.005, 0], [.57, .66, .46]);
    sculpt(body, 'detail', leader ? '#5e836c' : character.accent, [0, -.025, .225], [.17, .21, .035], undefined, 'glaze');
    sculpt(body, 'limb', '#647e70', [0, .35, 0], [.17, .15, .17]);
    sculpt(head, 'helmet', headColor, [0, 0, 0], [.87, .76, .69], undefined, 'glaze');
    curvedFace(kit, head, '#8da59a', .614, .427, .011, [0, .005, 0], 'glaze');
    curvedFace(kit, head, ink, .566, .379, .020, [0, .005, 0]);
    sculpt(head, 'detail', '#78948f', [-.135, .116, .341], [.15, .024, .008], [0, 0, -.12], 'glaze');
    characterSmile(kit, head, '#14292e', .048, .026, [0, -.073, .365]);
    [-1, 1].forEach(sign => {
      sculpt(head, 'limb', character.accent, [sign * .425, -.01, 0], [.20, .11, .20], [0, 0, Math.PI / 2], 'glaze');
      sculpt(head, 'detail', bodyColor, [sign * .473, -.01, 0], [.055, .14, .14], undefined, 'glaze');
      const eye = sculpt(head, 'detail', '#10242a', [sign * .119, .020, .359], [.075, .106, .018], undefined, 'ink');
      data.eyes.push(eye);
      data.highlights.push(sculpt(head, 'detail', '#e1ece0', [sign * .119 - .012, .047, .371], [.020, .023, .006], undefined, 'glaze'));
      const arm = joint(body, sign < 0 ? 'arm_l' : 'arm_r', [sign * .34, .18, 0]);
      sculpt(arm, 'limb', bodyColor, [sign * .005, -.145, 0], [.235, .42, .25], [0, 0, sign * -.11]);
      const extremity = wayfinder ? '#344d5a' : id.startsWith('hr-') ? '#60775b' : '#426a58';
      sculpt(arm, 'bean', extremity, [0, -.32, .025], [.205, .20, .21]); data.arms.push(arm);
      const foot = joint(group, sign < 0 ? 'foot_l' : 'foot_r', [sign * .155, .10, .025]);
      sculpt(foot, 'bean', extremity, [0, 0, 0], [.25, .20, .35]);
      const cuff = sculpt(foot, 'ankle', bodyColor, [0, .13, -.025], [.16, .22, .15]);
      cuff.name = sign < 0 ? 'ankle_l' : 'ankle_r'; data.feet.push(foot);
    });
    sculpt(head, 'limb', '#76927e', [0, .394, 0], [.044, .15, .044], undefined, 'brass');
    sculpt(head, 'detail', leader ? '#c98a45' : character.accent, [0, .498, 0], [.133, .148, .133], undefined, 'glaze');
    if (id === 'bridge-scout' || id === 'hr-lens') ring(head, '#a3b5a4', .195, [.119, .018, .374]);
    if (id === 'bridge-keeper') {
      kit.mesh(body, 'roundedDetail', '#ecdfbf', [.18, -.08, .25], [.22, .28, .055], [0, 0, -.10]);
      kit.mesh(body, 'roundedDetail', '#668977', [.18, -.08, .28], [.187, .24, .012], [0, 0, -.10]);
    }
    if (wayfinder) {
      kit.mesh(body, 'roundedDetail', '#385362', [0, .025, .226], [.185, .19, .026]);
      // Each navigator keeps its own tiny, readable symbol without widening the
      // walking silhouette or hiding its hands under unrelated props.
      if (id === 'intake-jarvis') {
        sculpt(body, 'detail', '#d4b576', [0, .036, .246], [.055, .075, .012], [0, 0, -.55], 'brass');
      } else if (id === 'intake-beacon') {
        sculpt(head, 'limb', '#c19a61', [0, .475, 0], [.125, .22, .125], undefined, 'brass');
        sculpt(head, 'detail', '#efd39a', [0, .595, 0], [.105, .105, .105], undefined, 'glaze');
      } else if (id === 'intake-relay') {
        [-.045, 0, .045].forEach(y => kit.mesh(body, 'roundedDetail', '#d4d9c5', [0, y + .035, .244], [.105, .013, .011]));
      } else {
        sculpt(head, 'tuft', '#75977c', [-.035, .455, 0], [.08, .15, .045], [0, 0, .42]);
        sculpt(head, 'tuft', '#8ba789', [.038, .472, 0], [.08, .13, .045], [0, 0, -.48]);
      }
    }
    group.scale.setScalar(leader ? 1.18 : id === 'bridge-scout' ? 1.03 : 1.10);
  } else if (kind === 'lantern') {
    const green = id === 'support-beacon' ? '#3f6e50' : '#ad8246';
    head.position.y = .64; data.headY = .64; body.position.y = .14; data.bodyY = .14;
    sculpt(body, 'lanternBase', green, [0, 0, 0], [.60, .28, .55], undefined, 'glaze');
    sculpt(body, 'limb', gold, [0, .13, 0], [.48, .065, .44], undefined, 'brass');
    const light = sculpt(head, 'lanternGlass', id === 'support-beacon' ? '#e9b15d' : '#efc075', [0, 0, 0], [.435, .59, .405], undefined, 'amber');
    // Distinct amber finishes let the two lanterns breathe independently.
    data.glow = light.material;
    sculpt(head, 'detail', '#ffe4a0', [-.055, .17, .17], [.045, .12, .012], [0, 0, -.13], 'amber');
    [-1, 1].forEach(sign => {
      // Bowed rails follow the glass rather than framing a luminous cube.
      const points = [[sign * .19, -.31, 0], [sign * .265, -.16, 0], [sign * .271, .12, 0], [sign * .19, .31, 0]];
      const railPath = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point as [number, number, number])));
      const rail = new THREE.Mesh(new THREE.TubeGeometry(railPath, 12, .038, 8, false), characterMaterial(kit, green, 'glaze'));
      rail.castShadow = true; rail.receiveShadow = true; head.add(rail);
      const eye = sculpt(head, 'detail', ink, [sign * .088, .025, .211], [.046, .064, .015], undefined, 'ink'); data.eyes.push(eye);
      data.highlights.push(sculpt(head, 'detail', '#ffedc2', [sign * .088 - .008, .041, .221], [.012, .014, .006], undefined, 'glaze'));
    });
    characterSmile(kit, head, '#826331', .034, .019, [0, -.052, .218]);
    sculpt(head, 'lanternCap', green, [0, .377, 0], [.64, .28, .585], undefined, 'glaze');
    sculpt(head, 'limb', gold, [0, .535, 0], [.105, .055, .105], undefined, 'brass');
    ring(head, green, .26, [0, .681, 0]);
    sculpt(head, 'limb', green, [0, -.299, 0], [.56, .095, .52], undefined, 'glaze');
    if (id === 'reflection-lumen') group.scale.setScalar(1.25);
  } else if (kind === 'owl') {
    const navy = id === 'email-owl', feathers = navy ? '#2d4256' : id === 'reflection-quill' ? '#d7cbb5' : '#e8dfcc';
    body.position.y = .49; data.bodyY = .49; head.position.y = .91; data.headY = .91;
    sculpt(body, 'owlBody', feathers, [0, 0, 0], [.70, .83, .55]);
    sculpt(body, 'sphere', navy ? '#465c6c' : '#f1e7d1', [0, -.015, .234], [.46, .58, .15]);
    sculpt(head, 'owlHead', feathers, [0, 0, 0], [.78, .65, .54], undefined, 'glaze');
    [-1, 1].forEach(sign => {
      // Facial discs are fitted patches on the same curved head surface. Their
      // near-touching cream rims form one owl mask rather than two eyeballs.
      curvedFace(kit, head, navy ? '#dbcdae' : '#f5ecd8', .355, .405, .013, [sign * .169, -.006, 0], 'clay', [.417, .325, .27]);
      sculpt(head, 'detail', '#a58b5d', [sign * .162, -.006, .271], [.165, .224, .032], undefined, 'glaze');
      const eye = sculpt(head, 'detail', '#1d3038', [sign * .162, .002, .293], [.104, .148, .025], undefined, 'ink'); data.eyes.push(eye);
      data.highlights.push(sculpt(head, 'detail', '#faf7e9', [sign * .162 - .020, .039, .309], [.028, .038, .008], undefined, 'glaze'));
      sculpt(head, 'tuft', feathers, [sign * .242, .283, -.038], [.19, .27, .16], [0, 0, sign * -.36]);
      const wing = joint(body, sign < 0 ? 'wing_l' : 'wing_r', [sign * .315, .12, -.025]);
      sculpt(wing, 'wing', navy ? '#334c61' : '#d9ceb9', [sign * .015, -.145, 0], [.205, .53, .30], [0, 0, sign * .23]); data.wings.push(wing);
      const foot = joint(group, sign < 0 ? 'foot_l' : 'foot_r', [sign * .145, .08, .08]);
      sculpt(foot, 'bean', gold, [0, 0, 0], [.19, .16, .235], undefined, 'clay'); data.feet.push(foot);
    });
    sculpt(head, 'beak', gold, [0, -.103, .301], [.108, .16, .12], [Math.PI / 2, 0, Math.PI], 'brass');
    if (id === 'reflection-quill') {
      kit.mesh(body, 'detailCylinder', '#c09b5f', [.37, .01, .165], [.036, .48, .036], [0, 0, -.35]);
      sculpt(body, 'beak', '#5e5c54', [.29, -.216, .165], [.037, .072, .037], [0, 0, Math.PI - .35]);
    }
    if (id === 'reflection-echo') {
      ring(body, gold, .21, [.365, .035, .215]);
      kit.mesh(body, 'detailCylinder', gold, [.365, -.115, .215], [.027, .19, .027]);
    }
    if (navy) {
      kit.mesh(body, 'roundedDetail', cream, [0, -.12, .322], [.215, .14, .025]);
      const flap = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.085, .043, 0), new THREE.Vector3(0, -.018, 0), new THREE.Vector3(.085, .043, 0)]), new THREE.LineBasicMaterial({ color: '#ac9e7d' }));
      flap.position.set(0, -.12, .337); body.add(flap);
    }
  } else {
    body.position.y = .69; data.bodyY = .69; head.position.y = .89; data.headY = .89;
    sculpt(body, 'owlBody', '#cba56a', [0, 0, 0], [.42, .40, .69]);
    sculpt(head, 'helmet', '#cfad76', [0, 0, .17], [.37, .33, .35]);
    [-1, 1].forEach(sign => {
      const wing = joint(body, sign < 0 ? 'wing_l' : 'wing_r', [sign * .20, .06, 0]);
      sculpt(wing, 'wing', '#d8b67d', [sign * .24, 0, -.02], [.63, .085, .33], [0, sign * .35, sign * .05]); data.wings.push(wing);
      const eye = sculpt(head, 'detail', ink, [sign * .114, .018, .321], [.038, .053, .018], undefined, 'ink'); data.eyes.push(eye);
      data.highlights.push(sculpt(head, 'detail', '#fff2d4', [sign * .114 - .007, .031, .332], [.011, .014, .005], undefined, 'glaze'));
    });
    sculpt(head, 'beak', '#b78647', [0, -.037, .362], [.09, .15, .085], [Math.PI / 2, 0, 0]);
    sculpt(body, 'wing', '#648b80', [0, -.014, -.36], [.28, .065, .33]);
  }
  data.eyes.forEach(eye => { eye.userData.restEyeY = eye.scale.y; });
  data.feet.forEach(foot => { foot.userData.restFootY = foot.position.y; foot.userData.restFootZ = foot.position.z; });
  group.userData.personality = data;
  return group;
}

/** Small character-specific gestures; no physics, root motion or extra render loop. */
export interface LocomotionPose { phase: number; speed: number; seatLift: number; celebration: number; foldWings?: boolean }

/** Keep authored feet grounded when the room raises a seated avatar's body. */
export class AuthoredFootPose {
  private groups: Array<{ feet: THREE.Object3D[]; chain: THREE.Object3D[]; applied: THREE.Vector3 }> = [];
  private matrix = new THREE.Matrix4();
  private inverse = new THREE.Matrix3();
  private shift = new THREE.Vector3();
  constructor(model: THREE.Object3D) {
    for (const name of ['foot_l', 'foot_r']) {
      const foot = model.getObjectByName(name);
      if (!foot?.parent) continue;
      const existing = this.groups.find(group => group.chain[group.chain.length - 1] === foot.parent);
      if (existing) { existing.feet.push(foot); continue; }
      const chain: THREE.Object3D[] = [];
      for (let object: THREE.Object3D | null = foot.parent; object; object = object.parent) {
        chain.unshift(object); if (object === model) break;
      }
      this.groups.push({ feet: [foot], chain, applied: new THREE.Vector3() });
    }
  }
  restore(): void {
    for (const group of this.groups) {
      for (const foot of group.feet) foot.position.sub(group.applied);
      group.applied.set(0, 0, 0);
    }
  }
  apply(seatLift: number): void {
    if (seatLift <= 0) return;
    for (const group of this.groups) {
      this.matrix.identity();
      for (const object of group.chain) {
        if (object.matrixAutoUpdate) object.updateMatrix();
        this.matrix.multiply(object.matrix);
      }
      this.inverse.setFromMatrix4(this.matrix).invert();
      this.shift.set(0, -seatLift, 0).applyMatrix3(this.inverse);
      group.applied.copy(this.shift);
      for (const foot of group.feet) foot.position.add(group.applied);
    }
  }
}
export function animateCharacter(model: THREE.Object3D, status: Activity, time: number, index: number, moving: boolean, frozen: boolean,
  locomotion?: LocomotionPose): void {
  const p = model.userData.personality as Personality | undefined; if (!p) return;
  const t = frozen ? 0 : time + index * 0.7;
  const asleep = status === 'sleeping';
  const working = status === 'active' && !moving;
  const phase = locomotion?.phase ?? t * 6;
  const stride = locomotion ? Math.min(1, locomotion.speed / 0.85) : 1;
  const celebration = locomotion?.celebration ?? 0;
  p.body.position.y = p.bodyY + (asleep ? Math.sin(t * 1.4) * 0.012 : moving ? Math.abs(Math.sin(phase)) * 0.028 * stride : 0);
  p.head.rotation.set(asleep ? 0.16 : working ? 0.09 : moving ? 0.025 : 0, working ? Math.sin(t * 1.3) * 0.09 : 0, asleep ? 0.10 : moving ? Math.sin(phase) * 0.035 * stride : 0);
  p.arms.forEach((arm, i) => { arm.rotation.x = celebration ? -1.4 * celebration : moving ? -Math.sin(phase + i * Math.PI) * 0.38 * stride : working ? -0.5 + Math.sin(t * 6 + i) * 0.09 : asleep ? -0.16 : 0; });
  p.feet.forEach((foot, i) => {
    const step = Math.sin(phase + i * Math.PI);
    foot.rotation.x = moving ? Math.max(0, step) * 0.34 * stride : 0;
    foot.position.y = foot.userData.restFootY - Math.max(0, locomotion?.seatLift ?? 0) / model.scale.y + (moving ? Math.max(0, step) * 0.055 * stride : 0);
    foot.position.z = foot.userData.restFootZ + (moving ? step * 0.10 * stride : Math.max(0, locomotion?.seatLift ?? 0) * 0.55);
  });
  p.wings.forEach((wing, i) => {
    // Swift folds its wide wings before entering the room's narrow aisle. The
    // bounded transit silhouette fits the same .60-unit clearance as robots.
    wing.rotation.z = p.kind === 'swift' && locomotion?.foldWings
      ? (i ? -1 : 1) * (1.05 + (moving ? Math.sin(phase * 1.4) * 0.08 : 0))
      : (i ? 1 : -1) * (celebration ? 0.65 * celebration : moving ? Math.sin(phase * 1.2) * 0.35 * stride : asleep ? 0.10 : 0);
  });
  const blink = !frozen && status === 'active' && t % 4.7 < 0.12;
  p.eyes.forEach(eye => { eye.scale.y = eye.userData.restEyeY * (asleep ? 0.13 : blink ? 0.09 : 1); });
  p.highlights.forEach(highlight => { highlight.visible = !asleep && !blink; });
  if (p.glow) p.glow.emissiveIntensity = asleep ? 0.24 + Math.sin(t * 1.4) * 0.04 : 0.65 + Math.sin(t * 2) * 0.08;
}

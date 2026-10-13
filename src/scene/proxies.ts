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

/** Soft ceramic silhouettes fitted directly to the approved office concept. */
export function makeProxy(character: Character, kit: SceneKit): THREE.Group {
  const group = new THREE.Group(); group.name = `${character.id}:reference-character`;
  group.userData.assetStatus = 'reference-model';
  const { id, kind } = character;
  const cream = '#ede5d3', ink = '#162e33', brass = '#b58b4d';
  const wayfinder = id.startsWith('intake-'), hr = id.startsWith('hr-');
  const leader = id === 'bridge-jarvis', keeper = id === 'bridge-keeper', scout = id === 'bridge-scout';
  const body = joint(group, 'body', [0, .55, 0]), head = joint(group, 'head', [0, 1.02, 0]);
  const data: Personality = { kind, body, head, bodyY: .55, headY: 1.02, arms: [], feet: [], eyes: [], highlights: [], wings: [] };
  const sculpt = (parent: THREE.Object3D, form: CharacterForm, color: string, at: [number, number, number],
    scale: [number, number, number], rotation?: [number, number, number], finish?: CharacterFinish) =>
    characterMesh(kit, parent, form, color, at, scale, rotation, finish);
  const ring = (parent: THREE.Object3D, color: string, diameter: number, at: [number, number, number],
    rotation?: [number, number, number]) =>
    sculpt(parent, 'ring', color, at, [diameter, diameter, diameter], rotation, 'brass');
  const eyes = (parent: THREE.Object3D, separation: number, y: number, z: number,
    color = ink, width = .057, height = .080) => {
    [-1, 1].forEach(sign => {
      const eye = sculpt(parent, 'detail', color, [sign * separation, y, z], [width, height, .022], undefined, 'ink');
      data.eyes.push(eye);
      data.highlights.push(sculpt(parent, 'detail', '#f8f1dc', [sign * separation - width * .16, y + height * .23, z + .013],
        [width * .20, height * .18, .006], undefined, 'glaze'));
    });
  };

  if (kind === 'robot') {
    // The reference helpers share a compact, continuous belly and ivory helmet;
    // colour, small ear caps and antenna distinguish them without costume props.
    const merchant = leader || keeper || scout;
    if (keeper) { body.position.y = .65; data.bodyY = .65; head.position.y = 1.36; data.headY = 1.36; }
    else if (leader) { body.position.y = .61; data.bodyY = .61; head.position.y = 1.30; data.headY = 1.30; }
    else { head.position.y = 1.18; data.headY = 1.18; }
    const torsoWidth = leader ? .876 : scout ? .918 : .69;
    const torsoHeight = keeper ? 1.02 : leader ? .854 : .73;
    const bodyColor = keeper ? '#e2dac6' : scout ? '#426e50' : wayfinder ? '#e5e0cf' : character.color;
    const darkTrim = leader || keeper ? '#233b43' : scout ? '#294c3e' : wayfinder ? '#304959' : '#70836b';
    const headColor = scout ? '#497554' : hr ? id === 'hr-compass' ? '#d3bc8d' : id === 'hr-relay' ? '#d6c397' : '#e0e6d2' : cream;
    const torso = sculpt(body, 'torso', bodyColor, [0, -.10, 0], [torsoWidth, torsoHeight, .57], undefined, 'glaze');
    torso.name = 'ceramic-belly';
    sculpt(body, 'limb', leader ? '#9f673b' : keeper || scout ? '#416947' : darkTrim,
      [0, keeper ? .37 : .27, 0], [.30, .10, .30], undefined, 'glaze');
    sculpt(head, 'helmet', headColor, [0, 0, 0], keeper ? [.782, .70, .71] : [.91, leader ? .82 : .76, .74], undefined, 'glaze');
    const radii: [number, number, number] = keeper ? [.401, .35, .355] : [.466, leader ? .41 : .38, .37];
    const rim = curvedFace(kit, head, scout ? '#e5ddc7' : wayfinder ? '#c4ccbe' : '#d5d5bd',
      scout ? .744 : keeper ? .552 : .620, scout ? .630 : keeper ? .438 : leader ? .492 : .426, .008, [0, -.005, 0], 'clay', radii);
    rim.name = 'visor-rim';
    const visor = curvedFace(kit, head, scout ? '#ede3cd' : wayfinder ? '#213644' : hr ? '#3d5145' : '#354e50',
      scout ? .710 : keeper ? .506 : .575, scout ? .598 : keeper ? .386 : leader ? .445 : .372, .016, [0, -.005, 0], scout ? 'clay' : 'ink', radii);
    visor.name = 'rounded-visor';
    eyes(head, scout ? .167 : .146, .018, keeper ? .369 : .383, '#172c2b', scout ? .09 : .074, scout ? .116 : .104);
    characterSmile(kit, head, '#243a32', scout ? .078 : .060, .029, [0, -.075, keeper ? .376 : .394]);
    [-1, 1].forEach(sign => {
      const earColor = leader || keeper ? '#bc7c43' : scout ? '#416e52' : hr ? '#87926c' : '#2d4555';
      const earX = keeper ? .389 : .452;
      sculpt(head, 'limb', earColor, [sign * earX, -.010, -.006], [.13, .24, .21], undefined, 'glaze');
      sculpt(head, 'detail', earColor, [sign * (earX + .041), -.010, -.006], [.040, .23, .16], undefined, 'glaze');
      const arm = joint(body, sign < 0 ? 'arm_l' : 'arm_r', [sign * (leader ? .42 : scout ? .44 : .34), leader ? .14 : merchant ? .12 : .17, -.005]);
      if (merchant) {
        const broad = leader || scout, handX = sign * (leader ? -.035 : scout ? -.025 : 0);
        sculpt(arm, 'limb', scout ? '#e6decb' : bodyColor, [sign * (broad ? .005 : .015), leader ? -.14 : -.12, 0],
          [broad ? .23 : .20, leader ? .33 : .30, broad ? .25 : .23], [0, 0, sign * -.15], 'glaze');
        sculpt(arm, 'limb', scout ? '#416f53' : cream, [sign * (leader ? -.025 : scout ? -.018 : .010), leader ? -.35 : -.305, .012],
          [broad ? .175 : .15, leader ? .22 : .20, broad ? .20 : .18], [0, 0, sign * -.08], 'glaze');
        sculpt(arm, 'bean', darkTrim, [handX, leader ? -.49 : -.425, .032], [broad ? .20 : .175, broad ? .18 : .17, broad ? .22 : .20], undefined, 'glaze');
        [-1, 1].forEach(finger => sculpt(arm, 'detail', darkTrim, [handX + finger * (broad ? .040 : .034), leader ? -.55 : -.482, .061],
          [broad ? .055 : .050, leader ? .080 : .075, broad ? .065 : .060], undefined, 'glaze'));
      } else {
        sculpt(arm, 'limb', bodyColor, [sign * .006, -.155, 0], [.22, .405, .25], [0, 0, sign * -.10], 'glaze');
        sculpt(arm, 'bean', darkTrim, [0, -.325, .025], [.18, .18, .20], undefined, 'glaze');
      }
      data.arms.push(arm);
      const foot = joint(group, sign < 0 ? 'foot_l' : 'foot_r', [sign * (leader ? .218 : scout ? .225 : .17), .065, .075]);
      sculpt(foot, 'bean', darkTrim, [0, 0, 0], [leader || scout ? .255 : .20, .13, .235], undefined, 'glaze');
      const cuff = sculpt(foot, 'ankle', bodyColor, [0, .125, -.015], [leader || scout ? .20 : .17, .23, .16]);
      cuff.name = sign < 0 ? 'ankle_l' : 'ankle_r'; data.feet.push(foot);
    });
    if (keeper) {
      kit.mesh(body, 'roundedDetail', '#78977a', [0, -.10, .286], [.17, .20, .023], undefined, 'ceramic');
    } else if (scout) {
      const panel = curvedFace(kit, body, '#e2dbc7', .570, .62, .012, [0, -.12, 0], 'clay', [.479, .43, .285], false, [torsoWidth, torsoHeight, .57, -.10], .23);
      panel.name = 'cream-belly-panel';
    } else if (leader) {
      sculpt(body, 'detail', '#f1e5cf', [-.095, .045, .287], [.077, .090, .024], [0, 0, -.22], 'glaze');
      sculpt(body, 'heart', '#f4e8d3', [.071, .041, .289], [.090, .090, .024], [0, 0, .14], 'glaze');
    } else {
      sculpt(body, 'detail', wayfinder ? '#506c79' : darkTrim, [0, -.018, .290], [.16, .19, .025], undefined, 'glaze');
    }
    const stemColor = leader ? '#ba7d41' : keeper || scout ? '#416947' : darkTrim;
    sculpt(head, 'limb', stemColor, [0, keeper ? .395 : .425, -.012], [.035, .12, .035], undefined, 'brass');
    sculpt(head, 'detail', leader || keeper ? '#cf8b4a' : scout ? '#477657' : hr ? '#bac59e' : '#d4d8c5',
      [0, keeper ? .483 : .513, -.012], [.107, .12, .107], undefined, 'glaze');
    if (id === 'intake-compass') {
      sculpt(head, 'tuft', darkTrim, [.028, .493, -.014], [.055, .13, .025], [0, 0, -.38], 'clay');
    }
    group.scale.setScalar(leader ? 1.05 : scout ? 1 : keeper ? 1.04 : wayfinder ? 1 : 1.02);
  } else if (kind === 'lantern') {
    const support = id === 'support-beacon', shell = support ? '#3b6948' : '#75602f';
    if (support) {
      body.position.y = .38; data.bodyY = .38; head.position.y = .89; data.headY = .89;
      sculpt(body, 'torso', shell, [0, 0, 0], [.66, .61, .51], undefined, 'glaze');
      sculpt(head, 'helmet', shell, [0, 0, 0], [.78, .69, .63], undefined, 'glaze');
      const radii: [number, number, number] = [.414, .345, .315];
      curvedFace(kit, head, '#ad934c', .54, .421, .010, [0, -.015, 0], 'brass', radii);
      const light = curvedFace(kit, head, '#e3b860', .494, .377, .020, [0, -.015, 0], 'amber', radii);
      data.glow = light.material as THREE.MeshStandardMaterial;
      eyes(head, .104, .013, .341, '#304c2a', .044, .062);
      characterSmile(kit, head, '#6c6a2f', .044, .023, [0, -.073, .349]);
      sculpt(head, 'lanternCap', shell, [0, .336, -.006], [.53, .18, .48], undefined, 'glaze');
      ring(head, shell, .225, [0, .507, -.006]);
      [-1, 1].forEach(sign => {
        const arm = joint(body, sign < 0 ? 'arm_l' : 'arm_r', [sign * .29, .12, 0]);
        sculpt(arm, 'limb', shell, [sign * -.022, -.15, .055], [.22, .38, .25], [0, 0, sign * -.26], 'glaze');
        sculpt(arm, 'bean', '#4e7750', [sign * -.035, -.30, .09], [.20, .18, .20], undefined, 'glaze'); data.arms.push(arm);
        const foot = joint(group, sign < 0 ? 'foot_l' : 'foot_r', [sign * .145, .08, .03]);
        sculpt(foot, 'bean', shell, [0, 0, 0], [.255, .16, .32], undefined, 'glaze'); data.feet.push(foot);
      });
    } else {
      body.position.y = .14; data.bodyY = .14; head.position.y = .61; data.headY = .61;
      sculpt(body, 'lanternBase', shell, [0, 0, 0], [.60, .28, .54], undefined, 'brass');
      sculpt(body, 'limb', brass, [0, .13, 0], [.48, .070, .44], undefined, 'brass');
      const light = sculpt(head, 'lanternGlass', '#ffc95f', [0, 0, 0], [.43, .58, .40], undefined, 'amber'); data.glow = light.material;
      [-1, 1].forEach(sign => {
        const points = [[sign * .18, -.30, .02], [sign * .248, -.16, .02], [sign * .248, .11, .02], [sign * .18, .30, .02]];
        const path = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point as [number, number, number])));
        const rail = new THREE.Mesh(new THREE.TubeGeometry(path, 16, .028, 8, false), characterMaterial(kit, shell, 'brass'));
        rail.name = 'curved-lantern-rail'; rail.castShadow = true; rail.receiveShadow = true; head.add(rail);
      });
      eyes(head, .076, .017, .211, '#7b5d2c', .038, .050);
      characterSmile(kit, head, '#8b6730', .032, .018, [0, -.055, .216]);
      sculpt(head, 'lanternCap', shell, [0, .355, 0], [.63, .27, .57], undefined, 'brass');
      sculpt(head, 'limb', brass, [0, .508, 0], [.10, .050, .10], undefined, 'brass');
      ring(head, shell, .245, [0, .65, 0]);
      sculpt(head, 'limb', shell, [0, -.295, 0], [.55, .090, .50], undefined, 'brass');
      group.scale.setScalar(1.18);
    }
  } else if (kind === 'owl') {
    const navy = id === 'email-owl', featherColor = navy ? '#2e4052' : id === 'reflection-quill' ? '#e1d5bd' : '#ebe1c9';
    body.position.y = .46; data.bodyY = .46; head.position.y = .88; data.headY = .88;
    sculpt(body, 'owlBody', featherColor, [0, 0, 0], [.70, .76, .58], undefined, 'clay');
    sculpt(body, 'sphere', navy ? '#354b5e' : '#f0e6cf', [0, -.015, .235], [.45, .54, .13], undefined, 'clay');
    sculpt(head, 'owlHead', featherColor, [0, 0, 0], [.79, .66, .57], undefined, 'clay');
    [-1, 1].forEach(sign => {
      // Raised facial discs share a soft, convex surface with the head rather
      // than reading as two flat outlined plates.
      sculpt(head, 'sphere', navy ? '#d1c19f' : '#d8c9ab', [sign * .17, -.006, .243], [.385, .45, .105], [0, sign * -.10, 0], 'clay');
      sculpt(head, 'sphere', navy ? '#eee2c3' : '#f4ebd8', [sign * .17, -.006, .256], [.35, .41, .112], [0, sign * -.10, 0], 'clay');
      sculpt(head, 'detail', navy ? '#bd9152' : '#ab8d57', [sign * .162, .006, .320], [.172, .213, .026], undefined, 'glaze');
      const eye = sculpt(head, 'detail', '#192c31', [sign * .162, .012, .339], [navy ? .116 : .099, navy ? .155 : .136, .026], undefined, 'ink');
      data.eyes.push(eye);
      data.highlights.push(sculpt(head, 'detail', '#fff8e8', [sign * .162 - .020, .049, .355], [.025, .034, .007], undefined, 'glaze'));
      sculpt(head, 'tuft', featherColor, [sign * .245, .279, -.035], [.20, .25, .17], [0, 0, sign * -.38], 'clay');
      const wing = joint(body, sign < 0 ? 'wing_l' : 'wing_r', [sign * .310, .11, -.025]);
      sculpt(wing, 'wing', navy ? '#2b3d50' : '#d5c8ae', [sign * .005, -.12, .018], [.25, .46, .33], [0, 0, sign * .32], 'clay');
      data.wings.push(wing);
      const foot = joint(group, sign < 0 ? 'foot_l' : 'foot_r', [sign * .14, .075, .075]);
      sculpt(foot, 'bean', brass, [0, 0, 0], [.195, .15, .23], undefined, 'clay'); data.feet.push(foot);
    });
    sculpt(head, 'beak', brass, [0, -.10, .334], [.096, .16, .12], [.10, 0, Math.PI], 'brass');
    if (navy) {
      kit.mesh(body, 'roundedDetail', '#ddc89e', [0, -.10, .305], [.19, .13, .020]);
      const flap = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-.075, .040, 0), new THREE.Vector3(0, -.015, 0), new THREE.Vector3(.075, .040, 0),
      ]), new THREE.LineBasicMaterial({ color: '#a88e5e' }));
      flap.position.set(0, -.10, .318); body.add(flap);
    }
  } else {
    body.position.y = .38; data.bodyY = .38; head.position.y = .64; data.headY = .64;
    sculpt(body, 'owlBody', '#cba05d', [0, 0, 0], [.34, .39, .55], undefined, 'clay');
    sculpt(body, 'sphere', '#e1b677', [0, .025, .20], [.23, .26, .13], undefined, 'clay');
    sculpt(head, 'helmet', '#d2ab6f', [0, 0, .11], [.34, .31, .34], undefined, 'clay');
    [-1, 1].forEach(sign => {
      const wing = joint(body, sign < 0 ? 'wing_l' : 'wing_r', [sign * .125, .08, -.025]);
      sculpt(wing, 'wing', '#d5ae72', [sign * .085, .022, -.01], [.28, .10, .22], [0, sign * .38, sign * .18], 'clay');
      data.wings.push(wing);
      const eye = sculpt(head, 'detail', ink, [sign * .108, .020, .259], [.036, .051, .022], [0, sign * .20, 0], 'ink');
      data.eyes.push(eye);
      data.highlights.push(sculpt(head, 'detail', '#fff2d5', [sign * .108 - .006, .032, .272], [.010, .013, .005], undefined, 'glaze'));
      const foot = joint(group, sign < 0 ? 'foot_l' : 'foot_r', [sign * .085, .045, .025]);
      sculpt(foot, 'bean', '#a7824e', [0, 0, 0], [.09, .09, .16], undefined, 'clay');
      sculpt(foot, 'limb', '#a7824e', [0, .12, -.022], [.024, .22, .024], undefined, 'clay'); data.feet.push(foot);
    });
    sculpt(head, 'beak', '#b28443', [0, -.030, .299], [.075, .13, .080], [Math.PI / 2, 0, 0], 'brass');
    sculpt(body, 'wing', '#b58b50', [0, -.010, -.30], [.20, .07, .29], [0, 0, .10], 'clay');
  }
  data.eyes.forEach(eye => { eye.userData.restEyeY = eye.scale.y; });
  data.feet.forEach(foot => { foot.userData.restFootY = foot.position.y; foot.userData.restFootZ = foot.position.z; });
  group.userData.personality = data;
  return group;
}

/** Small character-specific gestures; no physics, root motion or extra render loop. */
export interface LocomotionPose {
  phase: number; speed: number; seatLift: number; celebration: number; foldWings?: boolean;
  /** Chosen by the agent; activity reporting never selects a work gesture. */
  gesture?: 'work' | 'think' | 'file' | 'talk' | 'wait';
}

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
  const gesture = !moving && !asleep ? locomotion?.gesture : undefined;
  const working = gesture === 'work';
  const phase = locomotion?.phase ?? t * 6;
  const stride = locomotion ? Math.min(1, locomotion.speed / 0.85) : 1;
  const celebration = locomotion?.celebration ?? 0;
  p.body.position.y = p.bodyY + (asleep ? Math.sin(t * 1.4) * 0.012 : moving ? Math.abs(Math.sin(phase)) * 0.028 * stride : 0);
  // Head poses keep the same intent readable for lanterns without limbs, while
  // hands or wings make the small gesture suit each character's silhouette.
  p.head.rotation.set(asleep ? 0.16 : moving ? 0.025 : working ? (p.kind === 'owl' ? .10 : .065)
      : gesture === 'think' ? -.025 : gesture === 'file' ? (p.kind === 'owl' ? .11 : .07)
      : gesture === 'talk' ? .015 + Math.sin(t * 1.2) * .012 : gesture === 'wait' ? .018 : 0,
    gesture === 'think' ? Math.sin(t * .35) * .04 : working ? Math.sin(t * .6) * .015
      : gesture === 'file' ? -.025 : gesture === 'talk' ? Math.sin(t * .7) * .025 : 0,
    asleep ? .10 : moving ? Math.sin(phase) * .035 * stride
      : gesture === 'think' ? (p.kind === 'owl' ? .07 : -.045)
      : gesture === 'file' ? -.015 : gesture === 'wait' ? .025 : 0);
  p.arms.forEach((arm, i) => {
    arm.rotation.x = celebration ? -1.4 * celebration : moving ? -Math.sin(phase + i * Math.PI) * .38 * stride
      : working ? -.43 + Math.sin(t * 3.3 + i * 1.4) * .025
      : gesture === 'think' ? (i ? -.62 : -.10) + Math.sin(t * .55) * .012
      : gesture === 'file' ? -.36 - (i ? .16 : .06) * (.5 + Math.sin(t * .85) * .5)
      : gesture === 'talk' ? (i ? -.17 : -.08) + Math.sin(t * 1.1 + i) * .04
      : gesture === 'wait' ? -.06 : asleep ? -.16 : 0;
  });
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
    wing.rotation.x = working ? -.09 + Math.sin(t * 2.2 + i) * .018
      : gesture === 'think' ? (i ? -.16 : 0) : gesture === 'file' ? -.12 + Math.sin(t * .85 + i) * .025
      : gesture === 'talk' ? Math.sin(t * 1.1 + i) * .035 : gesture === 'wait' ? -.035 : 0;
  });
  const blink = !frozen && status === 'active' && t % 4.7 < 0.12;
  p.eyes.forEach(eye => { eye.scale.y = eye.userData.restEyeY * (asleep ? 0.13 : blink ? 0.09 : 1); });
  p.highlights.forEach(highlight => { highlight.visible = !asleep && !blink; });
  if (p.glow) p.glow.emissiveIntensity = asleep ? 0.24 + Math.sin(t * 1.4) * 0.04 : 0.65 + Math.sin(t * 2) * 0.08;
}

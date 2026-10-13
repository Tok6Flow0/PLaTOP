import * as THREE from 'three';
import type { Activity, Character } from '../types';
import { SceneKit } from './primitives';
import { characterMesh, characterMaterial, characterSmile, characterStroke, characterEyeArc, curvedFace, fitCharacterRelief, type CharacterForm, type CharacterFinish } from './characterGeometry';

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
/** Source portraits expressed as fitted ceramic, brass and folded-paper forms. */
export function makeProxy(character: Character, kit: SceneKit): THREE.Group {
  const group = new THREE.Group(); group.name = `${character.id}:reference-character`;
  group.userData.assetStatus = 'reference-model';
  const { id, kind } = character;
  const cream = '#eee4d0', ink = '#19333b', gold = '#bf9654';
  const wayfinder = id.startsWith('intake-'), hr = id.startsWith('hr-'), leader = id === 'bridge-jarvis';
  const bodyColor = wayfinder ? '#dfd1b6' : id === 'hr-compass' ? '#e7d8b9' : leader ? '#b85829' : id==='bridge-scout' ? '#315d58' : character.color;
  const body = joint(group, 'body', [0, .57, 0]), head = joint(group, 'head', [0, 1.08, 0]);
  const data: Personality = { kind, body, head, bodyY: .57, headY: 1.08, arms: [], feet: [], eyes: [], highlights: [], wings: [] };
  const sculpt = (parent: THREE.Object3D, form: CharacterForm, color: string, at: [number, number, number],
    scale: [number, number, number], rotation?: [number, number, number], finish?: CharacterFinish) =>
    characterMesh(kit, parent, form, color, at, scale, rotation, finish);
  const ring = (parent: THREE.Object3D, color: string, diameter: number, at: [number, number, number], rotation?: [number, number, number]) =>
    sculpt(parent, 'ring', color, at, [diameter, diameter, diameter], rotation, 'brass');
  const stroke = (parent: THREE.Object3D, color: string, points: Array<[number, number, number]>, radius = .007, finish: CharacterFinish = 'brass') =>
    characterStroke(kit, parent, color, points, radius, finish);
  const eyes = (parent: THREE.Object3D, separation: number, y: number, z: number, closed = false, color = ink, size = 1) => {
    [-1, 1].forEach(sign => {
      const eye = closed ? characterEyeArc(kit, parent, color, [sign * separation, y, z], .043 * size, .026 * size)
        : sculpt(parent, 'detail', color, [sign * separation, y, z], [.061 * size, .082 * size, .025 * size], undefined, 'ink');
      data.eyes.push(eye);
      if (!closed) data.highlights.push(sculpt(parent, 'detail', '#fff8df', [sign * separation - .010 * size, y + .020 * size, z + .014 * size], [.015 * size, .019 * size, .007], undefined, 'glaze'));
    });
  };
  const compass = (parent: THREE.Object3D, at: [number, number, number], diameter = .22, color = gold) => {
    const emblem = joint(parent, 'compass-emblem', at);
    ring(emblem, color, diameter, [0, 0, 0]);
    if (wayfinder) sculpt(emblem, 'detail', '#2b4252', [0, 0, -.006], [diameter * .88, diameter * .88, .025], undefined, 'clay');
    sculpt(emblem, hr||id==='bridge-scout'?'compassNeedle':'compassStar', hr?'#2d5244':color, [0, 0, .010], [diameter * .78, diameter * .90, .11], [0, 0, id==='bridge-scout'?-.50:-.08], hr?'clay':'brass');
    sculpt(emblem, 'detail', '#ead3a0', [0, 0, .027], [.033, .033, .015], undefined, 'brass');
  };
  const limbs = (color: string, extremity: string, compact = false, robed = false) => {
    [-1, 1].forEach(sign => {
      if(!robed){
        const arm = joint(body, sign < 0 ? 'arm_l' : 'arm_r', [sign * (compact ? .30 : .32), .16, 0]);
        sculpt(arm, 'limb', color, [sign * .003, -.13, 0], [compact ? .18 : .205, .37, .22], [0, 0, sign * -.13]);
        sculpt(arm, 'bean', id==='bridge-scout'?color:extremity, [0, -.29, .025], [.18, .18, .20]); data.arms.push(arm);
      }
      const foot = joint(group, sign < 0 ? 'foot_l' : 'foot_r', [sign * (leader ? .125 : .15), leader ? .08 : hr || wayfinder ? .055 : .10, .025]);
      sculpt(foot, 'bean', extremity, [0, 0, 0], [leader ? .36 : .24, leader ? .16 : hr || wayfinder ? .11 : .20, leader ? .43 : .32]);
      const cuff = sculpt(foot, 'ankle', color, [0, .13, -.025], [.16, .22, .15]);
      cuff.name = sign < 0 ? 'ankle_l' : 'ankle_r'; data.feet.push(foot);
    });
  };
  if (kind === 'robot') {
    if (id === 'bridge-keeper') {
      // The source is a little standing book, including actual recessed pages,
      // rounded covers, folded corner and the seedling volume held in its arms.
      sculpt(body, 'book', '#cdb68e', [0, .18, -.025], [.70, 1.12, .49], [0, 0, -.035], 'glaze');
      sculpt(body, 'book', '#f2e8d1', [.015, .18, .016], [.615, 1.07, .43], [0, 0, -.035]);
      [-.125, -.105, -.085].forEach(z => stroke(body, '#bba480', [[.296, -.26, z], [.296, .63, z]], .003, 'clay'));
      // The warm binding stays readable at roster size while the broad pages
      // and face keep Keeper's pale-paper identity.
      stroke(body, '#bda783', [[-.274, -.32, .195], [-.278, .08, .195], [-.263, .62, .195]], .005, 'clay');
      eyes(head, .112, .018, .276, true);
      sculpt(head, 'pageCorner', '#fff4da', [.22, .10, .261], [.18, .19, .075], [0, 0, -.12], 'paper');
      limbs(cream, cream, true);
      const book = joint(body, 'seedling-book', [0, -.08, .29]); book.rotation.z = -.06;
      sculpt(book, 'book', '#d8c69b', [0, 0, 0], [.31, .34, .07]);
      sculpt(book, 'book', '#36574f', [0, 0, .025], [.28, .32, .04], undefined, 'glaze');
      stroke(book, gold, [[0, -.11, .052], [0, -.025, .052], [.035, .052, .052]], .007);
      sculpt(book, 'tuft', gold, [-.035, .025, .055], [.065, .10, .017], [0, 0, .6], 'brass');
      sculpt(book, 'tuft', gold, [.035, .055, .055], [.065, .10, .017], [0, 0, -.6], 'brass');
      data.arms.forEach((arm, index) => {
        const sign=index?1:-1;arm.rotation.z=sign*-.64;
        arm.position.z=.19;arm.position.y=.04;
        sculpt(arm,'limb',gold,[0,-.22,.026],[.185,.028,.20],undefined,'brass');
      });
    } else if (hr) {
      // Clear Path are ceramic robed guardians rather than repainted robots.
      const robe=sculpt(body, id==='hr-lens'?'spiritLens':id==='hr-relay'?'spiritRelay':'spiritFigure', bodyColor, [0, -.015, 0], [.82, .90, .80], undefined, 'clay');
      head.position.y = 1.04; data.headY = 1.04;
      if (id === 'hr-relay') {
        // A continuous robe silhouette needs no separate helmet or exposed seam.
        eyes(head, .113, .025, .290, false, '#112c30');
        stroke(body, '#d0a257', [[-.10, -.005, .276], [.04, .08, .276], [.04, -.09, .276]], .009);
        [[-.10, -.005], [.04, .08], [.04, -.09]].forEach(([x,y]) => sculpt(body, 'detail', '#e0b76d', [x, y, .288], [.062, .062, .021], undefined, 'brass'));
      } else {
        if(id !== 'hr-lens') eyes(head, .108, .020, .294, false, '#173b38', .90);
        if (id === 'hr-lens') {
          const lens = ring(head, '#e5d8b8', .43, [-.03, .005, .292]); lens.scale.y *= 1.08;
          const eye=sculpt(head,'detail','#173b38',[-.095,.054,.317],[.14,.16,.07],undefined,'ink');data.eyes.push(eye);
          data.highlights.push(sculpt(head,'detail','#fff8e0',[-.115,.096,.350],[.036,.035,.012],undefined,'glaze'));
          data.eyes.push(sculpt(head,'detail','#173b38',[.109,-.018,.285],[.034,.057,.026],undefined,'ink'));
          stroke(head, '#dfd0ae', [[-.145, -.15, .295], [-.23, -.26, .20]], .021, 'clay');
          ring(body, '#466557', .18, [0, -.035, .276]);
          stroke(body, '#466557', [[-.062, -.10, .280], [-.13, -.18, .277]], .013, 'clay');
        } else {
          sculpt(head, 'detail', '#d6b271', [0, .475, 0], [.10, .10, .10], undefined, 'brass');
          compass(body, [0, -.025, .277], .24);
        }
      }
      // Keep the tiny identity marks on the actual robe curvature. The skirt
      // is broader than the face, so a constant face-depth plane clips them.
      for(const ornament of [...body.children]) if(ornament!==robe) {
        if(ornament.name==='compass-emblem'){ornament.position.z=.365;continue;}
        fitCharacterRelief(ornament,robe);
      }
      characterSmile(kit, head, '#244c43', .043, .021, [0, -.068, .298]);
      limbs(bodyColor, bodyColor, true, true);
      // A continuous robed figure has no separate rigid neck. Its expression
      // pivots the complete sculpture; face and shell cannot drift apart when
      // a genuine agent intent selects a thinking or filing pose.
      head.position.y-=body.position.y;body.add(head);
      const expression=joint(group,'robe-expression',[0,.70,0]);
      body.position.y-=.70;expression.add(body);
      data.head=expression;data.headY=.70;data.bodyY=body.position.y;
    } else {
      if (leader) { body.position.y = .70; data.bodyY = .70; head.position.y = 1.30; data.headY = 1.30; }
      if (id === 'bridge-scout') {body.position.y=.40;data.bodyY=.40;head.position.y=.84;data.headY=.84;}
      if (wayfinder) {body.position.y=id==='intake-jarvis'?.535:.49;data.bodyY=body.position.y;head.position.y=id==='intake-jarvis'?1.02:.95;data.headY=head.position.y;}
      sculpt(body, wayfinder ? 'torso' : leader ? 'merchantTorso' : id==='bridge-scout'?'owlBody':'torso', bodyColor, [0, -.005, 0], [wayfinder ? .85 : leader ? .79 : id==='bridge-scout'?.70:.64, leader ? 1.04 : id === 'intake-jarvis' ? 1.06 : wayfinder ? .96 : id==='bridge-scout' ? .58 : .87, wayfinder ? .64 : leader ? .54 : id==='bridge-scout'?.56:.50], undefined, 'glaze');
      if(leader) sculpt(body,'merchantBase','#bb673a',[0,-.58,0],[.73,.24,.56],undefined,'glaze');
      sculpt(body, 'limb', wayfinder ? '#b6aa8c' : bodyColor, [0, .35, 0], [.18, .15, .18]);
      const headColor = wayfinder ? cream : bodyColor;
      sculpt(head, 'helmet', headColor, [0, 0, 0], [.87, .76, .69], undefined, 'glaze');
      curvedFace(kit, head, wayfinder ? '#b9aa8e' : '#ab7943', .628, .449, .010, [0, .005, 0], 'clay').name='visor-rim';
      curvedFace(kit, head, wayfinder ? '#273b4a' : '#f2e2bf', .583, .401, .019, [0, .005, 0], wayfinder ? 'ink' : 'clay').name='rounded-visor';
      if (id === 'bridge-scout') {
        // One generously sized magnifier is Scout's face, not a tiny monocle
        // pasted onto the same visor worn by every other character.
        ring(head, '#bd9756', .31, [-.123, .016, .359]);
        sculpt(head, 'detail', '#456f6c', [-.123, .016, .362], [.204, .228, .043], undefined, 'glaze');
        const eye = sculpt(head, 'detail', '#163638', [-.125, .024, .386], [.131, .156, .032], undefined, 'ink'); data.eyes.push(eye);
        data.highlights.push(sculpt(head, 'detail', '#fff3d3', [-.151, .061, .405], [.036, .046, .010], undefined, 'glaze'));
        data.eyes.push(characterEyeArc(kit, head, '#294843', [.119, .017, .362], .044, .029));
        stroke(head, '#bd9756', [[-.212, -.076, .350], [-.27, -.16, .281]], .020);
        compass(body, [0, -.025, .265], .26);
        sculpt(head, 'paperWing', '#d4a05f', [0, .485, -.01], [.13, .24, .13], [0, 0, -.24], 'brass');
        sculpt(head, 'limb', '#527669', [0, .395, 0], [.04, .13, .04], undefined, 'brass');
      } else {
        if (id === 'intake-compass') [-1, 1].forEach(sign => data.eyes.push(characterEyeArc(kit, head, '#ffe0a0', [sign * .121, .048, .365], .044, -.026)));
        else eyes(head, .121, .030, .365, true, wayfinder ? '#ffe0a0' : '#493a2d');
        if(!wayfinder && !leader) characterSmile(kit, head, '#735131', .046, .023, [0, -.068, .365]);
        if (wayfinder) {
          if(id==='intake-jarvis') {
            sculpt(body, 'cape', '#263b4d', [0, 0, 0], [1,1,1], undefined, 'clay');
            [-1,1].forEach(sign=>{
              const trim=Array.from({length:9},(_,i)=>{const t=i/8,r=.31+.15*t,a=.20+1.05*Math.sin(t*Math.PI/2);return[sign*Math.sin(a)*r,.29-t*.72,Math.cos(a)*r*.80+.089+.014*Math.sin(sign*a*5)*Math.sin(Math.PI*t)] as [number,number,number]});
              stroke(body,'#bd985c',trim,.008).name='cape-trim';
            });
          }
          if(id==='intake-jarvis')sculpt(body, 'detail', gold, [0, .25, .330], [.044, .044, .022], undefined, 'brass');
          if (id === 'intake-jarvis') {
            sculpt(head, 'hoodTip', '#273b4a', [0, .399, -.025], [.29, .31, .23]);
            compass(head, [0, .44, .095], .115);
            compass(body, [0, .10, .307], .225);
            stroke(body, '#bea06b', [[.06,-.43,.185],[.03,-.33,.24],[-.09,-.23,.285],[-.07,-.14,.31],[.08,-.075,.315],[.12,-.045,.312]], .014, 'clay');
          } else if (id === 'intake-beacon') {
            sculpt(head, 'limb', '#b8a07b', [0, .427, 0], [.205, .15, .205], undefined, 'brass');
            sculpt(head, 'limb', '#f0c57e', [0, .542, 0], [.14, .14, .14], undefined, 'amber');
            [-1, 1].forEach(sign => sculpt(head, 'limb', '#695840', [sign * .065, .542, 0], [.013, .13, .013], undefined, 'brass'));
            sculpt(head, 'lanternCap', '#7d684c', [0, .645, 0], [.24, .13, .23], undefined, 'brass');
            const tower=joint(body,'lighthouse-emblem',[0,0,.32]);
            sculpt(tower,'hoodTip','#31444e',[0,-.030,0],[.13,.20,.023],undefined,'clay');
            sculpt(tower,'book',gold,[0,-.126,.008],[.16,.026,.013],undefined,'brass');
            sculpt(tower,'book',gold,[0,.064,.008],[.075,.09,.013],undefined,'brass');
            sculpt(tower,'detail','#f7ddb0',[0,.075,.024],[.030,.036,.012],undefined,'amber');
            sculpt(tower,'lanternCap',gold,[0,.129,.008],[.11,.060,.02],undefined,'brass');
            for(let ray=0;ray<6;ray++){const a=ray*Math.PI/3;stroke(tower,gold,[[Math.cos(a)*.075,.071+Math.sin(a)*.065,.008],[Math.cos(a)*.142,.071+Math.sin(a)*.12,.008]],.006);}
            fitCharacterRelief(tower,body.children[0] as THREE.Mesh);
          } else if (id === 'intake-relay') {
            sculpt(head, 'book', '#f1e4c8', [0, .479, -.02], [.19, .26, .018], [-.20, 0, .10], 'paper');
            sculpt(head, 'scroll', '#eadabb', [0, .605, -.003], [.10, .21, .10], [0, 0, Math.PI / 2], 'paper');
            [-.01, .04, .09].forEach(y => stroke(head, '#b59063', [[-.065, .43 + y, .017], [.065, .43 + y, .017]], .003, 'clay'));
            sculpt(body, 'book', '#efe5cf', [0, .015, .305], [.24, .27, .018], undefined, 'paper');
            stroke(body, '#6a7067', [[-.055, .055, .326], [.015, .055, .326]], .007, 'clay');
            stroke(body, '#6a7067', [[-.055, .015, .326], [-.015, .015, .326]], .007, 'clay');
            stroke(body, '#bd8053', [[-.035, -.025, .327], [0, -.06, .327], [.082, .035, .327]], .012, 'clay');
          } else {
            stroke(head, '#435b60', [[0, .38, 0], [0, .47, 0], [.06, .56, 0]], .018, 'clay');
            sculpt(head, 'tuft', '#3c565c', [-.045, .51, 0], [.10, .19, .037], [0, 0, -.57]);
            sculpt(head, 'tuft', '#3c565c', [.067, .474, .005], [.095, .14, .037], [0, 0, .70]);
            sculpt(head, 'detail', '#d7a460', [.073, .57, 0], [.065, .065, .065], undefined, 'brass');
            const bib=curvedFace(kit,body,'#314956',.29,.62,.014,[0,-.025,0],'clay',[.43,.48,.32],false,[.85,.96,.64,-.005],.32);bib.name='circuit-bib';
            stroke(body, gold, [[0, -.13, .328], [0, .12, .328]], .007);
            [-1, 1].forEach(sign => {
              stroke(body, gold, [[0, -.04, .330], [sign * .08, .005, .330], [sign * .08, .08, .330]], .006);
              ring(body, gold, .036, [sign * .08, .105, .336]);
            });
          }
        } else {
          ring(body, '#e0bb7a', .25, [0, .125, .280]);
          stroke(body, '#e0bb7a', [[-.085, .11, .29], [-.045, .16, .29], [0, .17, .29], [.045, .16, .29], [.085, .11, .29]], .010);
          const outline=stroke(body, '#854124', [[-.23, .32, .25], [-.26, -.14, .22], [0, -.44, .15], [.26, -.14, .22], [.23, .32, .25]], .006, 'clay');
          fitCharacterRelief(outline,body.children[0] as THREE.Mesh);
          sculpt(head, 'limb', '#aa7442', [0, .394, 0], [.04, .14, .04], undefined, 'brass');
          sculpt(head, 'detail', '#d89a48', [0, .495, 0], [.112, .134, .112], undefined, 'brass');
        }
      }
      [-1, 1].forEach(sign => {
        sculpt(head, 'limb', wayfinder ? '#314a58' : '#a85e39', [sign * .425, -.01, 0], [.16, .095, .16], [0, 0, Math.PI / 2], 'glaze');
        sculpt(head, 'detail', wayfinder ? '#b5a78c' : bodyColor, [sign * .463, -.01, 0], [.045, .117, .117], undefined, 'glaze');
      });
      limbs(bodyColor, wayfinder ? '#e7ddc8' : leader ? bodyColor : '#e2d6b7');
      if(wayfinder) data.arms.forEach((arm,index)=>{arm.position.x=(index?1:-1)*.33;arm.position.y=.11});
      if(wayfinder) for(const ornament of body.children) {
        if(ornament===body.children[0] || ['cape','cape-trim','wing','arm_l','arm_r','limb','circuit-bib','lighthouse-emblem'].includes(ornament.name))continue;
        fitCharacterRelief(ornament,body.children[0] as THREE.Mesh,id==='intake-compass'?.036:.012);
      }
    }
    group.scale.setScalar(leader ? 1.06 : id === 'bridge-scout' ? 1.03 : id === 'intake-jarvis' ? 1.16 : wayfinder ? .90 : hr ? .99 : 1.10);
  } else if (kind === 'lantern') {
    const support = id === 'support-beacon', green = support ? '#2c5b42' : '#ad8246';
    if (support) {
      // Beacon's source is an embracing conversation lantern with a solid green
      // shell, not an exposed bulb held between metal rails.
      body.position.y = .38; data.bodyY = .38; head.position.y = .94; data.headY = .94;
      sculpt(body, 'owlBody', green, [0, -.005, 0], [.68, .62, .50], undefined, 'glaze');
      sculpt(head, 'helmet', green, [0, 0, 0], [.80, .75, .61], undefined, 'glaze');
      const radii: [number, number, number] = [.424, .375, .305];
      curvedFace(kit, head, '#c19445', .60, .465, .009, [0, -.002, 0], 'brass', radii, true);
      const light = curvedFace(kit, head, '#efbc66', .554, .419, .017, [0, -.002, 0], 'amber', radii, true);
      data.glow = light.material as THREE.MeshStandardMaterial;
      eyes(head, .119, .015, .332, true, '#274e38', 1.02);
      sculpt(head, 'lanternCap', green, [0, .376, -.008], [.55, .19, .48], undefined, 'glaze');
      ring(head, green, .25, [0, .564, -.008]);
      [-1, 1].forEach(sign => {
        const arm = joint(body, sign < 0 ? 'arm_l' : 'arm_r', [sign * .215, .10, .06]);
        sculpt(arm, 'bean', green, [sign * -.11, -.10, .15], [.27, .32, .245], [0, 0, sign * -.92], 'glaze'); data.arms.push(arm);
        const foot = joint(group, sign < 0 ? 'foot_l' : 'foot_r', [sign * .14, .085, .02]);
        sculpt(foot, 'bean', green, [0, 0, 0], [.265, .17, .32], undefined, 'glaze'); data.feet.push(foot);
      });
    } else {
      head.position.y = .64; data.headY = .64; body.position.y = .225; data.bodyY = .225;
      sculpt(body, 'hexGlass', green, [0, -.02, 0], [.60, .18, .55], undefined, 'brass');
      const light = sculpt(head, 'hexGlass', '#efc075', [0, 0, 0], [.55, .61, .50], undefined, 'amber'); data.glow = light.material;
      [-1, 1].forEach(sign => {
        stroke(head, '#ad8246', [[sign * .25, -.31, .025], [sign * .23, -.08, .025], [sign * .21, .13, .025], [sign * .19, .31, .025]], .022);
        sculpt(head, 'detail', '#d4ab63', [sign * .224, -.265, .054], [.031, .031, .031], undefined, 'brass');
      });
      // The side panes have their own rails; these are solid low-cost brass
      // geometry around an emissive insert, not runtime point lights.
      [-1,1].forEach(sign=>stroke(head,green,[[sign*.125,-.30,.211],[sign*.116,-.08,.193],[sign*.101,.14,.173],[sign*.093,.30,.157]],.012));
      eyes(head, .088, .025, .216, true, '#75562e', .67);
      characterSmile(kit, head, '#826331', .034, .022, [0, -.052, .218]);
      sculpt(head, 'hexCap', green, [0, .377, 0], [.67, .28, .59], undefined, 'brass');
      sculpt(head, 'limb', gold, [0, .535, 0], [.105, .055, .105], undefined, 'brass');
      sculpt(head, 'fineRing', green, [0, .681, 0], [.26, .30, .26], undefined, 'brass');
      sculpt(head, 'limb', green, [0, -.299, 0], [.56, .095, .52], undefined, 'brass');
      [-1,1].forEach(sign=>{const foot=joint(group,sign<0?'foot_l':'foot_r',[sign*.22,.075,.11]);sculpt(foot,'bean',gold,[0,0,0],[.16,.15,.20],undefined,'brass');data.feet.push(foot)});
      group.scale.setScalar(1.12);
    }
  } else if (kind === 'owl') {
    const navy = id === 'email-owl', feathers = navy ? '#293b51' : id === 'reflection-quill' ? '#c5a67d' : '#d7bb8d';
    body.position.y = .49; data.bodyY = .49; head.position.y = .91; data.headY = .91;
    if(navy)head.position.z=.065;
    sculpt(body, navy ? 'owlBody' : 'paperBody', feathers, [0, 0, 0], [.70, .83, .55], undefined, navy ? 'feather' : 'paper');
    sculpt(head, navy ? 'owlHead' : id==='reflection-echo'?'paperEchoHead':'paperQuillHead', navy ? feathers : id === 'reflection-echo' ? '#c7aa83' : '#cfb18a', [0, 0, 0], [.78, .65, .54], undefined, navy ? 'feather' : 'paper');
    [-1, 1].forEach(sign => {
      if (navy) curvedFace(kit, head, '#f0e3c6', .365, .43, .013, [sign * .169, -.006, 0], 'clay', [.417, .325, .27],false,undefined,.43,sign);
      else {
        const disc=sculpt(head, sign<0?'paperDiscL':'paperDisc', '#edd6b0', [sign * .157, -.012, .280], [.365, .42, .022], [0, sign * -.17, sign * -.06], 'paper');
        fitCharacterRelief(disc,head.children[0] as THREE.Mesh,.012,true);
      }
      if (navy) sculpt(head, 'bean', '#c49b54', [sign * .162, .002, .289], [.193, .220, .051], undefined, 'brass');
      if (id === 'reflection-quill') data.eyes.push(characterEyeArc(kit, head, '#524334', [sign * .162, .015, .355], .050, .033));
      else {
        const eye = sculpt(head, 'bean', navy ? '#13252d' : '#302c22', [sign * .162, .011, navy?.313:.353], [navy ? .143 : .116, navy ? .166 : .136, .060], undefined, 'ink'); data.eyes.push(eye);
        data.highlights.push(sculpt(head, 'detail', '#fff9e7', [sign * .162 - .025, .053, navy?.330:.373], [.035, .043, .010], undefined, 'glaze'));
      }
      if (navy) sculpt(head, sign < 0 ? 'owlBrowL' : 'owlBrowR', '#26394f', [sign * .18, .255, .045], [.85,1.35,1.25], [0,0,sign*.10], 'feather');
      const wing = joint(body, sign < 0 ? 'wing_l' : 'wing_r', [sign * .315, .12, -.025]);
      sculpt(wing, navy ? 'wing' : 'paperWing', navy ? '#31485e' : '#d0bea0', [sign * .015, -.145, 0], [.205, .53, .30], [0, 0, sign * .23], navy ? 'feather' : 'paper');
      if (navy) {
        sculpt(wing, sign < 0 ? 'featherFanL' : 'featherFanR', '#30465e', [0, -.035, 0], [1, 1, 1], undefined, 'feather');
      } else sculpt(wing, 'pageFold', '#dec39a', [sign * .025, -.15, .10], [.15, .30, .08], [0, 0, sign * .24], 'paper');
      data.wings.push(wing);
      const foot = joint(group, sign < 0 ? 'foot_l' : 'foot_r', [sign * .145, .08, .08]);
      if (navy) [-1, 0, 1].forEach(toe => sculpt(foot, 'toe', gold, [toe * .053, 0, .012 - Math.abs(toe) * .012], [.075, .16, .20], [0, toe * -.12, 0], 'brass'));
      else sculpt(foot, 'paperWing', gold, [0, 0, 0], [.19, .16, .235], undefined, 'paper');
      data.feet.push(foot);
    });
    if(navy) sculpt(head,'paperBeak',gold,[0,-.080,.311],[.77,.85,.67],[.75,0,0],'brass');
    else sculpt(head,'paperBeak',gold,[0,-.077,.330],[.7,.9,.47],[.65,0,0],'paper');
    if (id === 'reflection-quill') {
      kit.mesh(body, 'detailCylinder', '#c99c4a', [.35, .01, .19], [.042, .48, .042], [0, 0, -.35]).name='quill-pencil';
      sculpt(body, 'beak', '#514d42', [.27, -.216, .19], [.040, .075, .040], [0, 0, Math.PI - .35]);
      sculpt(body, 'pageFold', '#e4d2b1', [-.07, -.04, .25], [.30, .40, .08], [0, .10, .14], 'paper');
      sculpt(body, 'pageFold', '#d0b58b', [.10, -.15, .24], [.23, .31, .07], [0, -.10, -.24], 'paper');
    } else if (id === 'reflection-echo') {
      ring(body, gold, .245, [.28, .07, .32]);
      ring(body, '#ead5a5', .212, [.28, .07, .327]);
      stroke(body, gold, [[.28, -.055, .32], [.25, -.25, .32]], .020);
      sculpt(body, 'pageFold', '#e4cdab', [-.075, -.03, .25], [.30, .39, .07], [0, .1, -.12], 'paper');
      sculpt(body, 'pageFold', '#c5a575', [.09, -.14, .24], [.24, .32, .07], [0, -.1, -.24], 'paper');
    }
    if (navy) {
      sculpt(body, 'breastFeathers', '#293e54', [0, 0, 0], [1, 1, 1], undefined, 'feather');
      sculpt(body, 'book', '#dcb26a', [0, .08, .329], [.19, .135, .016], undefined, 'brass');
      stroke(body, '#835d31', [[-.083, .130, .344], [0, .065, .344], [.083, .130, .344]], .005, 'clay');
    }
  } else {
    // Swift's split tail, creased ochre wings and teal folded edge are solid
    // low-poly paper surfaces rather than flattened ceramic spheres.
    body.position.y = .32; data.bodyY = .32; head.position.y = .61; data.headY = .61;head.scale.set(.80,.72,.80);
    sculpt(body, 'swiftBody', '#cda44e', [0, .035, 0], [.98, .86, .86], [0, 0, 0], 'paper');
    sculpt(head, 'swiftHead', '#d9a854', [0, 0, .045], [1, 1, 1], undefined, 'paper');
    [-1, 1].forEach(sign => {
      const wing = joint(body, sign < 0 ? 'wing_l' : 'wing_r', [sign * .14, .14, -.03]);
      sculpt(wing, sign < 0 ? 'swiftWingL' : 'swiftWingR', '#ffffff', [0, 0, 0], [1, 1, 1], undefined, 'paper');data.wings.push(wing);
      const eye = sculpt(head, 'bean', ink, [sign * .113, .070, .125], [.067,.074,.032], [0,sign*Math.PI/2,0], 'ink'); data.eyes.push(eye);
      data.highlights.push(sculpt(head, 'detail', '#fff2d4', [sign*.134,.091,.14], [.008,.019,.019], undefined, 'glaze'));
      const foot = joint(group, sign < 0 ? 'foot_l' : 'foot_r', [sign * .085, .018, .03]);
      [-1,0,1].forEach(toe=>sculpt(foot,'toe','#967140',[toe*.02,0,.02],[.025,.036,.15],[0,toe*.24,0],'brass'));
      sculpt(foot, 'limb', '#957446', [0, .085, -.025], [.018, .16, .018], undefined, 'clay'); data.feet.push(foot);
    });
    sculpt(head,'paperBeak','#a57d40',[0,.045,.190],[.55,.56,.91],undefined,'paper');
    sculpt(body,'swiftTail','#ffffff',[0,-.125,-.17],[1,1,1],undefined,'paper');
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
    // Swift's authored paper wings already sweep backward. A small closing
    // angle keeps their silhouette inside the same .60-unit transit clearance.
    wing.rotation.z = p.kind === 'swift' && locomotion?.foldWings
      ? (i ? -1 : 1) * (.10 + (moving ? Math.sin(phase * 1.4) * 0.04 : 0))
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

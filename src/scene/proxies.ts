import * as THREE from 'three';
import type { Activity, Character } from '../types';
import { SceneKit } from './primitives';
import { characterMesh, characterMaterial, characterSmile, characterStroke, characterEyeArc, curvedFace, fitCharacterRelief, navigatorCapePoint, type CharacterForm, type CharacterFinish } from './characterGeometry';

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
  warmth?: THREE.PointLight;
  headY: number;
  bodyY: number;
  restHead?: THREE.Euler;
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
  const shellFinish:CharacterFinish=leader||id==='bridge-scout'?'satinShell':wayfinder?'clay':'glaze';
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
      const eye = closed ? characterEyeArc(kit, parent, color, [sign * separation, y, z], .043 * size, .026 * size, wayfinder?'warmInk':'ink')
        : sculpt(parent, 'detail', color, [sign * separation, y, z], [.061 * size, .082 * size, .025 * size], undefined, 'ink');
      data.eyes.push(eye);
      if (!closed) data.highlights.push(sculpt(parent, 'detail', '#fff8df', [sign * separation - .010 * size, y + .020 * size, z + .014 * size], [.015 * size, .019 * size, .007], undefined, 'glaze'));
    });
  };
  const compass = (parent: THREE.Object3D, at: [number, number, number], diameter = .22, color = gold) => {
    const emblem = joint(parent, 'compass-emblem', at);
    ring(emblem, color, diameter, [0, 0, 0]);
    if (wayfinder) sculpt(emblem, 'detail', '#2b4252', [0, 0, -.006], [diameter * .88, diameter * .88, .025], undefined, 'clay');
    sculpt(emblem, id==='bridge-scout'?'compassPointer':hr?'compassNeedle':'compassStar', id==='bridge-scout'?'#ffffff':hr?'#2d5244':color, [0, 0, .010], [diameter * .78, diameter * .90, .11], [0, 0, id==='bridge-scout'?-.50:-.08], hr?'clay':'brass');
    sculpt(emblem, 'detail', '#ead3a0', [0, 0, .027], [.033, .033, .015], undefined, 'brass');
  };
  const limbs = (color: string, extremity: string, compact = false, robed = false) => {
    [-1, 1].forEach(sign => {
      if(!robed){
        const arm = joint(body, sign < 0 ? 'arm_l' : 'arm_r', [sign * (leader ? .375 : compact ? .30 : .32), leader ? .26 : .16, 0]);
        sculpt(arm, 'limb', color, [sign * .003, -.13, 0], [compact ? .18 : .205, .37, .22], [0, 0, sign * -.13], shellFinish==='satinShell'?shellFinish:'clay');
        sculpt(arm, 'bean', id==='bridge-scout'?color:extremity, [0, -.29, .025], [.18, .18, .20],undefined,shellFinish==='satinShell'?shellFinish:'clay'); data.arms.push(arm);
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
      sculpt(body, 'keeperPages', '#e7d8b8', [.015, .18, .012], [.615, 1.06, .30], undefined, 'paper').name='page-block';
      const cover=sculpt(body, 'keeperFrontCover', '#efe3c7', [0, .18, .177], [.70, 1.12, .038], undefined, 'paper');cover.name='front-cover';
      sculpt(body, 'keeperCover', '#d5bd96', [0, .18, -.145], [.70, 1.12, .038], [0,Math.PI,0], 'paper').name='back-cover';
      sculpt(body, 'book', '#d2b994', [-.314, .20, .012], [.33, 1.02, .061], [0, Math.PI/2, 0], 'paper').name='book-spine';
      // Separate leaf edges remain visible between the thin covers, including
      // along the top, instead of painting lines onto a padded solid block.
      for(let leaf=0;leaf<8;leaf++){
        const z=-.112+leaf*.035;
        stroke(body, '#bda985', [[.260,-.33,z],[.307,-.25,z],[.333,.18,z],[.340,.64,z]], .0022, 'paper');
        stroke(body, '#c7b492', [[-.25,.749,z],[.26,.749,z],[.324,.685,z]], .0018, 'paper');
      }
      // The warm binding stays readable at roster size while the broad pages
      // and face keep Keeper's pale-paper identity.
      const binding=stroke(body, '#bda783', [[-.323, -.32, .19], [-.328, .08, .19], [-.312, .62, .19]], .005, 'clay');
      fitCharacterRelief(binding,cover,.002,.004);
      const facePanel=sculpt(head,'bowedCover','#e6d7b9',[0,-.021,.263],[.48,.31,.011],undefined,'paper');
      fitCharacterRelief(facePanel,cover,.002,.006);
      const faceOutline:Array<[number,number,number]>=[];
      for(let cornerIndex=0;cornerIndex<4;cornerIndex++)for(let step=0;step<3;step++){
        const angle=cornerIndex*Math.PI/2+step*Math.PI/4;
        const cx=cornerIndex===0||cornerIndex===3?.177:-.177,cy=cornerIndex<2?.075:-.117;
        faceOutline.push([cx+Math.cos(angle)*.045,cy+Math.sin(angle)*.045,.272]);
      }
      faceOutline.push([...faceOutline[0]]);
      const border=stroke(head,'#beaa89',faceOutline,.0022,'paper');border.name='keeper-face-border';
      fitCharacterRelief(border,facePanel,.001,.002);
      eyes(head, .112, .018, .276, true, ink, 1.12);
      data.eyes.forEach(eye=>fitCharacterRelief(eye,facePanel,.002,.006));
      sculpt(body,'keeperTurnedCorner','#efe3c7',[0,0,0],[1,1,1],undefined,'paper');
      limbs(cream, cream, true);
      data.feet.forEach(foot=>{
        foot.position.y=.065;foot.position.z=.045;
        foot.children[0].scale.set(.23,.13,.29);
        // The short ankle remains inside the lower cover rather than showing
        // a ball-foot and a second connector stacked below the book.
        foot.children[1].position.y=.075;foot.children[1].scale.y=.13;
      });
      const book = joint(body, 'seedling-book', [0, .015, .29]); book.rotation.z = -.06;book.scale.set(1.24,1.08,1);
      sculpt(book, 'book', '#d8c69b', [0, 0, 0], [.31, .34, .07]);
      sculpt(book, 'book', '#36574f', [0, 0, .025], [.28, .32, .04], undefined, 'glaze');
      stroke(book, gold, [[0, -.11, .052], [0, -.025, .052], [.035, .052, .052]], .007);
      sculpt(book, 'tuft', gold, [-.035, .025, .055], [.065, .10, .017], [0, 0, .6], 'brass');
      sculpt(book, 'tuft', gold, [.035, .055, .055], [.065, .10, .017], [0, 0, -.6], 'brass');
      data.arms.forEach((arm, index) => {
        const sign=index?1:-1;
        arm.position.z=.29;arm.position.y=.13;arm.position.x=sign*.285;
        const forearm=arm.children[0],palm=arm.children[1];
        forearm.position.set(-sign*.0225,-.1375,.0225);forearm.scale.set(.22,.27,.22);forearm.rotation.z=-sign*1.03;
        palm.position.set(-sign*.11,-.19,.045);palm.scale.set(.20,.20,.14);
        sculpt(arm,'limb',gold,[-sign*.085,-.175,.04],[.226,.027,.22],[0,0,-sign*1.03],'brass');
      });
      head.position.y-=body.position.y;body.add(head);
      const expression=joint(group,'book-expression',[0,.635,0]);
      body.position.y-=.70;expression.add(body);expression.rotation.z=-.055;
      data.head=expression;data.headY=.635;data.bodyY=body.position.y;
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
        if(id !== 'hr-lens') eyes(head, .108, .020, .294, false, '#173b38', 1.10);
        if (id === 'hr-lens') {
          const lens = ring(head, '#e5d8b8', .43, [-.03, .005, .292]); lens.scale.y *= 1.08;
          const eye=sculpt(head,'detail','#173b38',[-.095,.054,.317],[.20,.22,.075],undefined,'ink');data.eyes.push(eye);
          data.highlights.push(sculpt(head,'detail','#fff8e0',[-.127,.110,.355],[.041,.040,.012],undefined,'glaze'));
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
        if(ornament.name==='compass-emblem'){ornament.position.z=.415;continue;}
        fitCharacterRelief(ornament,robe);
      }
      sculpt(body,id==='hr-lens'?'lensCowl':id==='hr-relay'?'relayCowl':'compassCowl',bodyColor,[0,-.015,0],[.82,.90,.80],undefined,'clay');
      characterSmile(kit, head, '#244c43', .043, .021, [0, -.068, .298]);
      limbs(bodyColor, bodyColor, true, true);
      // A continuous robed figure has no separate rigid neck. Its expression
      // pivots the complete sculpture; face and shell cannot drift apart when
      // a genuine agent intent selects a thinking or filing pose.
      head.position.y-=body.position.y;body.add(head);
      const expression=joint(group,'robe-expression',[0,.70,0]);
      body.position.y-=.70;expression.add(body);
      expression.rotation.z=id==='hr-lens'?-.08:id==='hr-relay'?.09:-.01;
      data.head=expression;data.headY=.70;data.bodyY=body.position.y;
    } else {
      // Jarvis's reference is a tall tapered ceramic body under a compact
      // rounded helmet. Keep the base on its original floor contact while
      // correcting the silhouette, rather than stretching the whole avatar.
      if (leader) { body.position.y = .84; data.bodyY = .84; head.position.y = 1.48; data.headY = 1.48; head.scale.set(.84,.80,.86); }
      if (id === 'bridge-scout') {body.position.y=.45;data.bodyY=.45;head.position.y=.89;data.headY=.89;head.scale.set(.86,.92,.92);}
      if (wayfinder) {body.position.y=id==='intake-jarvis'?.535:.49;data.bodyY=body.position.y;head.position.y=id==='intake-jarvis'?1.02:.95;data.headY=head.position.y;}
      sculpt(body, wayfinder ? 'wayfinderBody' : leader ? 'merchantTorso' : id==='bridge-scout'?'scoutBody':'torso', bodyColor, [0, -.005, 0], [wayfinder ? .85 : leader ? .79 : id==='bridge-scout'?.70:.64, leader ? 1.32 : id === 'intake-jarvis' ? 1.06 : wayfinder ? .96 : id==='bridge-scout' ? .68 : .87, wayfinder ? .64 : leader ? .54 : id==='bridge-scout'?.56:.50], undefined, shellFinish);
      if(leader) sculpt(body,'merchantBase','#bb673a',[0,-.72,0],[.73,.24,.56],undefined,shellFinish);
      if(leader)sculpt(body,'neckBand','#9d542f',[0,.38,0],[.52,.036,.43],undefined,shellFinish);
      if(id==='bridge-scout')sculpt(body,'neckBand','#274b45',[0,.14,0],[.44,.036,.34],undefined,shellFinish);
      if(wayfinder)sculpt(body,'neckBand','#b1a58e',[0,.22,0],[.55,.026,.40],undefined,'clay');
      sculpt(body, 'limb', wayfinder ? '#b6aa8c' : bodyColor, [0, .35, 0], [.18, .15, .18]);
      const headColor = wayfinder ? cream : bodyColor;
      sculpt(head, leader?'bridgeHelmet':'helmet', headColor, [0, 0, 0], [.87, .76, .69], undefined, shellFinish).name='helmet';
      curvedFace(kit, head, wayfinder ? '#b9aa8e' : '#ab7943', .628, .449, .010, [0, .005, 0], 'clay').name='visor-rim';
      curvedFace(kit, head, wayfinder ? '#273b4a' : '#f2e2bf', .583, .401, .019, [0, .005, 0], wayfinder ? 'cloth' : 'clay').name='rounded-visor';
      if (id === 'bridge-scout') {
        // One generously sized magnifier is Scout's face, not a tiny monocle
        // pasted onto the same visor worn by every other character.
        ring(head, '#bd9756', .31, [-.123, .016, .359]);
        sculpt(head, 'detail', '#536f67', [-.123, .016, .362], [.248, .266, .052], undefined, 'glaze');
        const eye = sculpt(head, 'detail', '#193331', [-.125, .024, .390], [.158, .180, .043], undefined, 'ink'); data.eyes.push(eye);
        data.highlights.push(sculpt(head, 'detail', '#fff3d3', [-.151, .061, .413], [.038, .046, .010], undefined, 'glaze'));
        // Convex optical cover sits over the iris; a single inexpensive alpha
        // surface preserves the dark pupil, with no refraction render pass.
        const lens=sculpt(head,'opticDome','#e7f1ed',[-.123,.016,.383],[.268,.286,.118],undefined,'opticalGlass');
        lens.name='magnifier-glass';lens.castShadow=lens.receiveShadow=false;
        data.eyes.push(characterEyeArc(kit, head, '#294843', [.119, .017, .362], .044, .029));
        stroke(head, '#bd9756', [[-.212, -.076, .350], [-.27, -.16, .281]], .020);
        compass(body, [0, -.025, .265], .26);
        sculpt(head, 'paperWing', '#d4a05f', [0, .485, -.01], [.13, .24, .13], [0, 0, -.24], 'brass');
        sculpt(head, 'limb', '#527669', [0, .395, 0], [.04, .13, .04], undefined, 'brass');
      } else {
        if (id === 'intake-compass') [-1, 1].forEach(sign => data.eyes.push(characterEyeArc(kit, head, '#ffe0a0', [sign * .121, .048, .365], .044, -.026,'warmInk')));
        else eyes(head, .121, .030, .365, true, wayfinder ? '#ffe0a0' : '#493a2d', leader?1.25:1);
        if(!wayfinder && !leader) characterSmile(kit, head, '#735131', .046, .023, [0, -.068, .365]);
        if (wayfinder) {
          if(id==='intake-jarvis') {
            sculpt(body, 'cape', '#263b4d', [0, 0, 0], [1,1,1], undefined, 'cloth');
            [-1,1].forEach(sign=>{
              const trim=Array.from({length:9},(_,i)=>{const t=i/8,a=sign*(.035+1.23*Math.sin(t*Math.PI/2));return navigatorCapePoint(t,a,-.005)});
              stroke(body,'#bd985c',trim,.008).name='cape-trim';
            });
          }
          if(id==='intake-jarvis')sculpt(body, 'detail', gold, [0, .20, .290], [.044, .044, .022], undefined, 'brass');
          if (id === 'intake-jarvis') {
            sculpt(head, 'hoodTip', '#273b4a', [0, .399, -.025], [.29, .31, .23]);
            compass(head, [0, .44, .095], .115);
            compass(body, [0, -.02, .307], .225);
            stroke(body, '#bea06b', [[.06,-.43,.185],[.03,-.35,.24],[-.09,-.29,.285],[-.07,-.22,.31],[.08,-.19,.315],[.12,-.16,.312]], .014, 'clay');
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
          // The medallion is rigid brass sitting above the breast, not an
          // inlay stretched across its curved skin. Preserve its rounded rim.
          const breastBadge=joint(body,'merchant-breast-badge',[0,0,.052]);
          sculpt(breastBadge,'bean','#b4844a',[0,.125,.273],[.275,.275,.027],undefined,'brass');
          ring(breastBadge, '#e0bb7a', .25, [0, .125, .280]);
          stroke(breastBadge, '#e0bb7a', [[-.085, .11, .29], [-.045, .16, .29], [0, .17, .29], [.045, .16, .29], [.085, .11, .29]], .010);
          stroke(breastBadge,'#e0bb7a',[[-.113,.103,.293],[.113,.103,.293]],.007);
          const seam=new THREE.CatmullRomCurve3([[-.23,.23,.25],[-.27,-.11,.23],[-.20,-.35,.20],[-.07,-.43,.18],[.07,-.43,.18],[.20,-.35,.20],[.27,-.11,.23],[.23,.23,.25]].map(p=>new THREE.Vector3(...p)));
          const outline=stroke(body, '#924c2c', seam.getPoints(30).map(p=>[p.x,p.y,p.z]), .0038, 'clay');outline.name='merchant-chest-seam';
          outline.scale.y=1.32/1.04;
          fitCharacterRelief(outline,body.children[0] as THREE.Mesh,.007,.007);
          sculpt(head, 'limb', '#aa7442', [0, .394, 0], [.04, .14, .04], undefined, 'brass');
          sculpt(head, 'detail', '#d89a48', [0, .495, 0], [.112, .134, .112], undefined, 'brass');
        }
      }
      [-1, 1].forEach(sign => {
        sculpt(head, 'limb', wayfinder ? '#314a58' : '#a85e39', [sign * .425, -.01, 0], [.16, .095, .16], [0, 0, Math.PI / 2], shellFinish);
        sculpt(head, 'detail', wayfinder ? '#b5a78c' : bodyColor, [sign * .463, -.01, 0], [leader?.070:.045, leader?.20:.117, leader?.20:.117], undefined, shellFinish);
      });
      limbs(bodyColor, wayfinder ? '#e7ddc8' : leader ? bodyColor : '#e2d6b7',false,wayfinder);
      if(wayfinder) [-1,1].forEach(sign=>{
        const navigator=id==='intake-jarvis';
        const arm=joint(body,sign<0?'arm_l':'arm_r',[sign*.375,navigator?.08:.10,navigator?-.03:.025]);
        // Jarvis's arms sit beneath the mantle, not as two exposed padded
        // tubes beside it. The existing joints still carry agent-chosen poses.
        const shell=sculpt(arm,'bean',navigator?'#2d4250':bodyColor,[0,-.15,0],navigator?[.125,.40,.22]:[.19,.53,.31],undefined,'clay');
        if(!navigator){
          const inset=sculpt(arm,'detail','#2d4250',[0,-.065,.15],[.095,.22,.016],undefined,'clay');
          fitCharacterRelief(inset,shell,.006);
        }
        data.arms.push(arm);
      });
      if(wayfinder&&id!=='intake-jarvis'){
        stroke(body,'#c3ad83',[[-.275,.19,.30],[-.255,-.04,.32],[-.15,-.16,.32],[0,-.20,.32],[.15,-.16,.32],[.255,-.04,.32],[.275,.19,.30]],.005,'clay');
      }
      if(wayfinder) for(const ornament of body.children) {
        if(ornament===body.children[0] || ['cape','cape-trim','wing','arm_l','arm_r','limb','neckBand','circuit-bib','lighthouse-emblem'].includes(ornament.name))continue;
        fitCharacterRelief(ornament,body.children[0] as THREE.Mesh,id==='intake-compass'?.036:.012);
      }
    }
    group.scale.setScalar(leader ? 1.02 : id === 'bridge-scout' ? .93 : id === 'bridge-keeper' ? .97 : id === 'intake-jarvis' ? 1.16 : wayfinder ? .90 : id==='hr-lens'?.93:id==='hr-relay'?.92:hr ? .99 : 1.10);
    if(id==='bridge-keeper')group.scale.x*=.92;
    if(id==='hr-lens'||id==='hr-relay')group.scale.x*=1.07;
  } else if (kind === 'lantern') {
    const support = id === 'support-beacon', green = support ? '#2c5b42' : '#ad8246';
    if (support) {
      // Beacon's source is an embracing conversation lantern with a solid green
      // shell, not an exposed bulb held between metal rails.
      body.position.y = .24; data.bodyY = .24; head.position.y = .74; data.headY = .74;
      sculpt(body, 'embracingBody', green, [0, 0, 0], [.68, .48, .50], undefined, 'clay');
      sculpt(head, 'lanternHousing', green, [0, 0, 0], [1,1,1], undefined, 'clay');
      const radii: [number, number, number] = [.410, .375, .305];
      sculpt(head,'lanternBezel','#c19445',[0,0,0],[1,1,1],undefined,'brass');
      const light = curvedFace(kit, head, '#fff1cc', .554, .419, -.009, [0, -.002, 0], 'amber', radii, true);
      data.glow = light.material as THREE.MeshStandardMaterial;
      [-1,1].forEach(sign=>data.eyes.push(characterEyeArc(kit,head,'#274e38',[sign*.119,.015,.310],.040,.024,'clay',.017)));
      sculpt(head, 'lanternCap', green, [0, .376, -.008], [.55, .19, .48], undefined, 'clay');
      sculpt(head,'lanternHandle',green,[0,.514,-.008],[.215,.215,.215],undefined,'clay');
      [-1, 1].forEach(sign => {
        const arm = joint(body, sign < 0 ? 'arm_l' : 'arm_r', [sign*.245,.23,.05]);
        sculpt(arm,sign<0?'embracingArmL':'embracingArmR',green,[0,0,0],[1,1,1],undefined,'clay');data.arms.push(arm);
        const foot = joint(group, sign < 0 ? 'foot_l' : 'foot_r', [sign * .12, .02, .02]);
        sculpt(foot, 'bean', green, [0, 0, 0], [.14, .04, .16], undefined, 'clay'); data.feet.push(foot);
      });
    } else {
      head.position.y = .49; data.headY = .49; body.position.y = .115; data.bodyY = .115;
      sculpt(body, 'hexBase', '#a88449', [0, 0, 0], [.56, .13, .53], undefined, 'brass');
      const light = sculpt(head, 'hexGlass', '#ffe7b1', [0, 0, 0], [.55, .61, .50], undefined, 'lanternGlass'); data.glow = light.material;
      // Every corner is framed, including the rear: the same tapered rails
      // sit on the actual six glass edges around the single bounded light.
      for(let corner=0;corner<6;corner++){
        const angle=Math.PI/6+corner*Math.PI/3;
        stroke(head,green,[-.30,0,.30].map(y=>{
          const r=.49+(.36-.49)*(y/.61+.5);
          return [Math.sin(angle)*(r*.55+.005),y,Math.cos(angle)*(r*.50+.005)] as [number,number,number];
        }),.013);
      }
      eyes(head, .078, .025, .191, true, '#75562e', .67);
      characterSmile(kit, head, '#826331', .034, .022, [0, -.052, .201]);
      sculpt(head, 'hexCap', green, [0, .367, 0], [.57, .23, .54], undefined, 'brass');
      sculpt(head, 'limb', gold, [0, .496, 0], [.13, .075, .13], undefined, 'brass');
      sculpt(head, 'fineRing', green, [0, .635, 0], [.26, .26, .26], undefined, 'brass');
      sculpt(head, 'limb', green, [0, -.299, 0], [.56, .095, .52], undefined, 'brass');
      [-1,1].forEach(sign=>{
        const foot=joint(group,sign<0?'foot_l':'foot_r',[sign*.205,.058,.12]);
        sculpt(foot,'bean',gold,[0,0,0],[.17,.105,.13],[0,0,sign*-.35],'brass');
        foot.updateWorldMatrix(true,true);foot.position.y-=new THREE.Box3().setFromObject(foot).min.y;
        data.feet.push(foot);
      });
      group.scale.setScalar(.95);
    }
    // A lantern illuminates nearby real surfaces. Only these two luminous
    // embodiments add a short-range, shadow-free light; no per-avatar lights.
    const warmth=new THREE.PointLight('#ffc46d',support?.32:2.2,support?1.4:2.4,2);
    // Keep the emitter inside Lumen's glass. A light just outside the front
    // pane lit that same pane at near-zero distance, washing its amber face
    // almost white. The shadow-free interior source still reaches neighbours.
    warmth.name='Lantern surface warmth';warmth.position.set(0,support?0:.10,support?.20:.03);
    head.add(warmth);data.warmth=warmth;
  } else if (kind === 'owl') {
    const navy = id === 'email-owl', feathers = navy ? '#233149' : id === 'reflection-quill' ? '#c5a67d' : '#d7bb8d';
    body.position.y = navy?.49:.41; data.bodyY = body.position.y; head.position.y = navy?.91:.81; data.headY = head.position.y;
    // The facial shield overlaps the breast, like the original owl. Keeping
    // both volumes on one vertical axis lets the chest cut its heart-shaped
    // chin into a straight horizontal edge.
    head.position.z=navy?.13:.025;
    sculpt(body, navy ? 'owlBody' : 'paperBody', navy?feathers:'#ffffff', [0, 0, 0], [.70, navy?.83:.70, navy?.55:.70], undefined, navy ? 'feather' : 'paper');
    const headShell=sculpt(head, navy ? 'owlHead' : id==='reflection-echo'?'paperEchoHead':'paperQuillHead', navy ? feathers : '#ffffff', [0, 0, 0], [.78, .65, navy?.54:.42], undefined, navy ? 'feather' : 'paper');
    if(!navy){
      sculpt(head,id==='reflection-echo'?'paperEchoHood':'paperQuillHood','#ffffff',[0,0,0],[.78,.65,.42],undefined,'paper');
      sculpt(body,'paperChestL','#ffffff',[0,0,0],[.70,.70,.62],undefined,'paper');
      // The mirrored chest sheets overlap at their centre seam. Give the
      // under-fold its own depth instead of letting both faces coincide;
      // the upper sheet now exposes a thin edge and a local overlap shadow.
      sculpt(body,'paperChestR','#ffffff',[0,0,-.010],[.70,.70,.62],undefined,'paper');
      sculpt(body,'paperBackL','#ffffff',[0,0,0],[.70,.70,.36],undefined,'paper');
      sculpt(body,'paperBackR','#ffffff',[0,-.018,-.004],[.70,.66,.36],[0,0,-.065],'paper');
      for(const [index,form] of ['paperCrownBackL','paperCrownBackR'].entries()){
        const returnSheet=sculpt(head,form as CharacterForm,'#ffffff',[0,index?-.008:0,index?-.002:0],[.78,.65,.42],undefined,'paper');
        fitCharacterRelief(returnSheet,headShell,.003,Infinity,-1);
      }
      if(id==='reflection-echo')sculpt(head,'paperBrow','#ffffff',[0,0,.003],[.78,.65,.42],undefined,'paper');
      else for(const ear of ['paperEarL','paperEarR'] as const)sculpt(head,ear,'#ffffff',[0,0,.003],[.78,.65,.42],undefined,'paper');
    }
    [-1, 1].forEach(sign => {
      const facialDisc=navy?curvedFace(kit, head, '#f0e3c6', .365, .43, .013, [sign * .169, -.006, 0], 'facialFeather', [.417, .325, .27],false,undefined,.43,sign):undefined;
      const iris=navy?sculpt(head, 'bean', '#c49b54', [sign * .130, .002, .178], [.141, .155, .018], undefined, 'clay'):undefined;
      if(iris&&facialDisc){iris.name='owl-iris';facialDisc.name=`owl-facial-disc:${sign}`;}
      if (id === 'reflection-quill') data.eyes.push(characterEyeArc(kit, head, '#524334', [sign * .162, .015, .184], .047, .028));
      else {
        const eye = sculpt(head, 'bean', navy ? '#13252d' : '#302c22', [navy?sign*.130:sign*.162+.006, navy?.012:.011, navy?.190:.188], [navy ? .100 : .083, navy ? .114 : .098, navy?.030:.024], undefined, 'ink'); data.eyes.push(eye);
        const highlight=sculpt(head, 'detail', '#fff9e7', [sign * (navy?.130:.162) - (navy?.016:.012), navy?.039:.043, navy?.204:.201], [navy?.023:.020, navy?.026:.022, .006], undefined, 'glaze');
        data.highlights.push(highlight);
      }
      if(id==='reflection-echo')stroke(head,'#56402a',[[sign*.180+.006,.039,.184],[sign*.205+.006,.038,.182],[sign*.230+.006,.050,.181]],.006,'ink');
      if (navy) sculpt(head, sign < 0 ? 'owlBrowL' : 'owlBrowR', '#26394f', [sign * (sign<0?.115:.135), .255, .030], sign<0?[1.02,1.10,1.30]:[1.06,.95,1.40], [0,0,sign<0?-.15:-.08], 'feather');
      const wing = joint(body, sign < 0 ? 'wing_l' : 'wing_r', [sign * (navy?.300:.315), .12, navy?.110:-.025]);
      if(navy)wing.scale.x=1.10;
      if(navy) sculpt(wing,'featherCore','#283b54',[sign*.015,-.10,0],[.19,.54,.245],[0,0,sign*.23],'feather');
      else if(sign>0)sculpt(wing,'paperHoldingWing','#ffffff',[0,0,0],[1,1,id==='reflection-quill'?.52:1],undefined,'paper');
      else sculpt(wing,'paperOwlWingL','#ffffff',[0,0,0],[1,1,1],undefined,'paper');
      if (navy) {
        sculpt(wing, sign < 0 ? 'featherFanL' : 'featherFanR', '#283b54', [0, -.035, 0], [1, 1, 1], undefined, 'plumage');
        sculpt(wing, sign < 0 ? 'featherFanR' : 'featherFanL', '#283b54', [0, -.035, -.024], [1, 1, 1], [0,Math.PI,0], 'plumage');
      }
      data.wings.push(wing);
      const foot = joint(group, sign < 0 ? 'foot_l' : 'foot_r', [sign * .145, navy?.045:.04, navy?.12:.08]);
      if (navy) [-1, 0, 1].forEach(toe => sculpt(foot, 'toe', '#ad8342', [toe * .061, 0, .012 - Math.abs(toe) * .012], [.090, .09, .23], [0, toe * -.12, 0], 'clay'));
      else sculpt(foot, 'paperWing', '#b89868', [0, 0, 0], [.16, .08, .23], undefined, 'paper');
      data.feet.push(foot);
    });
    if(navy) {
      sculpt(head,'owlBeak','#dcb578',[0,-.080,.290],[.100,.156,.090],undefined,'clay');
    }
    else sculpt(head,'paperBeak',gold,[0,-.077,.196],[.7,.9,.28],[.75,0,0],'paper');
    if (id === 'reflection-quill') {
      kit.mesh(body, 'detailCylinder', '#c99c4a', [.35, .01, .19], [.042, .48, .042], [0, 0, -.35]).name='quill-pencil';
      sculpt(body, 'beak', '#514d42', [.27, -.216, .19], [.040, .075, .040], [0, 0, Math.PI - .35]);
    } else if (id === 'reflection-echo') {
      ring(body, gold, .245, [.40, .13, .40]);
      ring(body, '#ead5a5', .212, [.40, .13, .407]);
      const lens=sculpt(body,'bean','#e7f1ed',[.40,.13,.413],[.198,.198,.025],undefined,'glass');
      lens.name='magnifier-glass';lens.castShadow=lens.receiveShadow=false;
      stroke(body, gold, [[.40, .005, .40], [.33, -.20, .40]], .017);
    }
    if (navy) {
      sculpt(body, 'breastFeathers', '#25364d', [0, 0, 0], [1, 1, 1], undefined, 'plumage');
      // A small flat insignia resting on the breast, not a projecting pouch.
      // Separate straight fold segments retain the envelope's crisp corners.
      const badge=joint(body,'dispatch-envelope',[0,.08,.315]);
      sculpt(badge, 'envelope', '#dcb26a', [0,0,0], [.140, .100, .006], undefined, 'brass');
      for(const sign of [-1,1]){
        stroke(badge,'#835d31',[[sign*.063,.043,.005],[0,-.011,.005]],.0022,'clay');
        stroke(badge,'#a07a3e',[[sign*.063,-.043,.004],[sign*.014,-.001,.004]],.0014,'clay');
      }
    }
    else {
      body.scale.set(1.06,.90,1.06);
      // A fuller paper breast must not enlarge the held lens/pencil or their
      // certified swept radius. Keep those props in their original frame.
      const propFrame=new THREE.Vector3(1,.86/.90,.85/1.06);
      for(const part of body.children)if(!part.name.startsWith('paper')&&!part.name.startsWith('wing_')){
        part.position.multiply(propFrame);part.scale.multiply(propFrame);
      }
      body.position.y-=.025;data.bodyY=body.position.y;
      body.rotation.z=id==='reflection-echo'?-.055:.06;
      // A complete folded volume must still read from a side-on office window.
      // Front-only silhouettes are not a substitute for an embodied model.
      head.scale.set(.89,.93,.92);
      head.position.set(0,.650,.005);data.headY=.650;
      data.wings.forEach(wing=>{wing.scale.z=.72;});
    }
  } else {
    // Swift's split tail, creased ochre wings and teal folded edge are solid
    // low-poly paper surfaces rather than flattened ceramic spheres.
    body.position.y = .30; data.bodyY = .30;head.position.set(0,.47,.065); data.headY = .47;
    sculpt(body, 'swiftBody', '#d2a34c', [0,0,0], [1,1,1], undefined, 'paper');
    [-1, 1].forEach(sign => {
      const wing = joint(body, sign < 0 ? 'wing_l' : 'wing_r', [sign * .078, .12, .075]);
      sculpt(wing, sign < 0 ? 'swiftWingL' : 'swiftWingR', '#ffffff', [0, 0, 0], sign<0?[.62,.59,.70]:[.74,.66,.80], [-.13,0,0], 'paper');data.wings.push(wing);
      const eye = sculpt(head, 'bean', ink, [sign * .098, .041, .092], [.052,.059,.028], [0,sign*Math.PI/2,0], 'ink'); data.eyes.push(eye);
      data.highlights.push(sculpt(head, 'detail', '#fff2d4', [sign*.112,.056,.101], [.006,.013,.013], undefined, 'glaze'));
      const foot = joint(group, sign < 0 ? 'foot_l' : 'foot_r', [sign * .085, .018, .03]);
      [-1,0,1].forEach(toe=>sculpt(foot,'toe','#967140',[toe*.02,0,.02],[.025,.036,.15],[0,toe*.24,0],'brass'));
      const leg=stroke(foot,'#957446',[[-sign*.04,.13,-.02],[-sign*.02,.045,-.03],[0,.008,0]],.009,'brass');leg.name='swift-leg'; data.feet.push(foot);
    });
    sculpt(head,'paperBeak','#a57d40',[0,.048,.153],[.60,.45,.38],[-.20,0,0],'paper');
    sculpt(body,'swiftTail','#ffffff',[0,-.105,-.03],[.74,.78,.86],undefined,'paper');
    head.position.y-=body.position.y;body.add(head);
    const expression=joint(group,'paper-bird-expression',[0,.40,0]);body.position.y-=.40;expression.add(body);expression.rotation.x=.12;
    data.head=expression;data.headY=.40;data.bodyY=body.position.y;
    group.scale.setScalar(.95);
  }
  if(id==='bridge-scout'){
    head.rotation.z=.075;
    const arm=data.arms[0];arm.position.y=.005;arm.position.z=.06;
    const upper=arm.children[0],hand=arm.children[1];
    upper.position.set(0,-.10,0);upper.scale.y=.26;hand.position.set(0,-.255,.20);
    const axis=new THREE.Vector3(0,0,1);for(const part of arm.children){part.position.applyAxisAngle(axis,2.70);part.rotation.z+=2.70;}
    for(const [i,foot]of data.feet.entries()){
      foot.position.x=(i?1:-1)*.20;
      const toe=foot.children[0];toe.scale.set(.27,.30,.36);
      const toeCap=sculpt(foot,'fittedSole','#315d58',[0,0,.173],[.182,.214,.025],undefined,'clay');
      // Leave room for the toe's dense curved interpolation beneath the sole.
      toeCap.name='scout-fitted-toe-cap';fitCharacterRelief(toeCap,toe as THREE.Mesh,.007,.003);
      foot.rotation.set(0,(i?1:-1)*.25,(i?1:-1)*-.13);
      foot.updateWorldMatrix(true,true);foot.position.y-=new THREE.Box3().setFromObject(foot).min.y/group.scale.y;
    }
  }
  if(wayfinder)head.rotation.z=id==='intake-beacon'?-.095:id==='intake-relay'?.045:id==='intake-compass'?.11:-.025;
  if(id==='reflection-echo'){head.rotation.z=-.12;head.rotation.y=.28;}
  if(id==='reflection-quill'){head.rotation.z=.09;head.rotation.y=-.24;}
  if(id==='email-owl'){head.rotation.z=-.16;head.rotation.y=.12;}
  if(id==='support-beacon'){head.rotation.z=.11;head.rotation.y=-.035;}
  data.restHead=data.head.rotation.clone();
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
  if(p.restHead){p.head.rotation.x+=p.restHead.x;p.head.rotation.y+=p.restHead.y;p.head.rotation.z+=p.restHead.z;}
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
  if(p.warmth)p.warmth.intensity=(model.name.startsWith('support-')?.32:2.2)*(asleep?.38:1);
}

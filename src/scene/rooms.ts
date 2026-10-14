import * as THREE from 'three';
import type { Decoration, Team } from '../types';
import { SceneKit } from './primitives';
import { architecturalBlock, beveledBlock, board, chair, floorSurface, lamp, laptop, monitor, mug, notebook, paneledWallFinish, paper, parcelStack, plant, plantStand, rug, shelf, sign, stool, storageCabinet, table, tidyStaticMeshes } from './environmentProps';

export type NavigationPoint = [number, number];
export type NavigationBounds = [number, number, number, number];
export interface NavigationBlocker { bounds: NavigationBounds; decoration?: Decoration; deskIndex?: number; }
export interface DeskNavigation {
  position: NavigationPoint;
  screen: NavigationPoint;
  facing: number;
  egress: NavigationPoint;
  /** Avatar root height while working; lanterns keep their standing floor height. */
  seatHeight?: number;
}
export interface RoomNavigation {
  floorY: number;
  bounds: NavigationBounds;
  blockers: NavigationBlocker[];
  door: NavigationPoint;
  lounge: NavigationPoint;
  task: NavigationPoint;
  interactions: Partial<Record<'whiteboard' | 'cabinet', { position: NavigationPoint; facing: number }>>;
  waypoints: NavigationPoint[];
  desks: DeskNavigation[];
}
export const OFFICE_ROW_SPACING = 9.575;
export const OFFICE_FLOOR_Y = 0.1;
/** Public geometric coordinates only. Room navigation is local; these campus zones are world coordinates. */
export const campusNavigation = {
  floorY: OFFICE_FLOOR_Y,
  zones: [[-9.1, -1.4, 9.1, 2.35], [-3.5, 2.15, -2.65, 4.15], [2.65, 2.15, 3.5, 4.15], [-2.9, 7.0, 2.9, 10.15]] as NavigationBounds[],
  blockers: [
    [-2.72, 8.15, -1.98, 9.15], [1.98, 8.15, 2.72, 9.15],
  ] as NavigationBounds[],
  waypoints: [[-6.15, 0], [-4.275, 0], [0, 0], [1.875, 0], [6.15, 0], [8.025, 0],
    [-6.15, -0.3], [-4.275, -0.3], [0, -0.3], [1.875, -0.3], [6.15, -0.3], [8.025, -0.3], [1.6, 0], [1.6, 1.8],
    [-3.075, 3.1375], [3.075, 3.1375], [0, 7.8], [0, 9.1], [0, 9.3]] as NavigationPoint[],
  exit: [0, 9.3] as NavigationPoint,
};

/** Wall roots include trim and mounted artwork so camera cutaways stay coherent. */
export interface Room {
  root: THREE.Group;
  center: THREE.Vector3;
  outline: THREE.LineLoop;
  decorations: Record<Decoration, THREE.Group>;
  actorHomes: THREE.Vector3[];
  actorFacing: number[];
  navigation: RoomNavigation;
  assetSlots: Record<'desk' | 'shelf' | 'wall' | 'floor' | 'festive', { position: [number, number, number]; rotation?: [number, number, number] }>;
  /** Starter furnishings yield to an agent-authored recipe in the same slot. */
  defaultSlotProps?: Partial<Record<'desk' | 'shelf' | 'wall' | 'floor' | 'festive', THREE.Group>>;
  walls: Array<{ root: THREE.Object3D; normal: THREE.Vector3; twoSided?: boolean }>;
}

/** These roots have independently controlled visibility and must not be pruned. */
export function roomVisibilityRoots(room: Room): THREE.Object3D[] {
  return [room.root,room.outline,...Object.values(room.decorations),...Object.values(room.defaultSlotProps??{})];
}

const finishes = [
  { wall: '#b77d59', rug: '#966f58', board: ['People', 'Merchants', 'Brighter days.'], symbol: 'heart' },
  { wall: '#7e8c70', rug: '#768268', board: ['Clearer', 'People', 'Happier work'], symbol: 'sprout' },
  { wall: '#34495b', rug: '#656762', board: ['Maps', 'People', 'Progress'], symbol: 'mountain' },
  { wall: '#45503f', rug: '#6a795b', board: ['A kinder', 'conversation', 'goes a long way.'], symbol: 'chat' },
  { wall: '#c2b397', rug: '#9b7e5b', board: ['Same curiosity.', 'Further together.'], symbol: 'sprout' },
  { wall: '#30495a', rug: '#59666d', board: ['Messages', 'People', 'Care'], symbol: 'envelope' }
];

export function makeRoom(team: Team, index: number, kit: SceneKit): Room {
  const root = new THREE.Group();
  root.name = team.id;
  root.userData.teamId = team.id;
  const depthGain = 1.475;
  const halfGain = depthGain / 2;
  // Wayfinders' workstation cluster needs a real rear cross aisle, not a
  // route through chair backs. The other upper rooms keep their shorter plan.
  const rearExtension = index === 2 ? 1.75 : index < 3 ? 1 : -1;
  const center = new THREE.Vector3((index % 3 - 1) * 6.15, 0, (Math.floor(index / 3) - 0.5) * OFFICE_ROW_SPACING);
  root.position.copy(center);
  const palette = finishes[index];
  const framedStorage = index===0 || index===2 || index===3 || index===5;
  // Public finish references let local agent styles tint the authored room
  // without guessing which green belongs to a plant or changing navigation.
  root.userData.roomPalette = { wall: palette.wall, rug: palette.rug, furniture: '#c59e73' };
  const rugWidth=index===0?4.4:index===2?4.0:index===5||index===4?3.9:index===3?4.1:4.55, rugDepth=index===0?4.0:index===2?4.4:index===3||index===4?3.35:index===5?3.45:index===1?4.1:4.2, rugZ=index===0?-1:index===2?-.8:index===5?0:index===3?.05:index===4?.1:index===1?-.65:.35;
  const rugX=index===4?-.1:0;
  root.userData.rugSurface = { bounds: [rugX-rugWidth/2,rugZ-rugDepth/2,rugX+rugWidth/2,rugZ+rugDepth/2], height: 0.13 };
  const isFoyer = index === 4;
  const walls: Room['walls'] = [];
  const blockers: NavigationBlocker[] = [];
  const lowerRoom = index >= 3 && !isFoyer;
  const backZ = -2.88 - halfGain - rearExtension;
  const doorX = 1.875;
  const doorWidth = 1.85;
  const sideDoorZ = -1.65;
  const doorSide = index === 3 ? 'right' : index === 5 ? 'left' : undefined;
  const frontPlantZ = index < 3 ? 3.0 : isFoyer ? 3.4 : 3.21;
  const interior = new THREE.Group();
  root.add(interior);
  const defaultSlotProps: NonNullable<Room['defaultSlotProps']> = {};
  function filingCabinet(x: number, z: number, rotation = 0, inset = true): THREE.Group {
    const cabinet = new THREE.Group(); cabinet.name = `${team.id}:cabinet`;
    cabinet.position.set(x, 0, z); cabinet.rotation.y = rotation; root.add(cabinet);
    if (!inset) {
      beveledBlock(cabinet, kit, '#98744f', [0, 0.55, 0], [0.94, 0.88, 0.2], 0.025);
      beveledBlock(cabinet, kit, '#b18a5e', [0, 1.02, 0], [1.02, 0.08, 0.24], 0.02);
      for (const x of [-0.31, 0.31]) kit.mesh(cabinet, 'roundedDetail', '#98744f', [x, 1.13, -0.05], [0.04, 0.22, 0.04], undefined, 'wood');
    }
    const front = inset ? 0.44 : 0.105;
    for (const y of inset ? [0.4, 0.82] : [0.37, 0.77]) {
      const drawer = kit.mesh(cabinet, 'roundedDetail', '#ad946c', [0, y, front], [0.79, 0.3, 0.045], undefined, 'wood');
      drawer.userData.roomSurface = 'furniture';
      kit.mesh(cabinet, 'roundedDetail', '#d8c8a3', [0, y + 0.035, front + 0.031], [0.17, 0.047, 0.018], undefined, 'metal');
      kit.mesh(cabinet, 'roundedDetail', '#796c50', [0, y - 0.055, front + 0.026], [0.17, 0.025, 0.025], undefined, 'metal');
    }
    // Keep a real prop root for the interaction stop; scene batching still
    // combines its compatible surfaces with the rest of the office at draw time.
    tidyStaticMeshes(cabinet);
    return cabinet;
  }
  // The foyer's rear furnishings stand on the shared corridor in campus view.
  // Include their real floor in its isolated window too, instead of leaving
  // the drafting cabinet and plants floating when the campus is hidden.
  const floorExtension=isFoyer?.6:rearExtension;
  architecturalBlock(interior, kit, '#d2bfa4', [0, -0.03, -floorExtension / 2], [6.12, 0.22, 5.9 + depthGain + floorExtension],.075);
  floorSurface(interior, '#b8aa95', [0, 0.087, -floorExtension / 2], [5.94, 5.7 + depthGain + floorExtension],false,kit);
  rug(interior, kit, palette.rug, rugX, rugZ, rugWidth, rugDepth);

  function wall(kind: 'back' | 'left' | 'right', x: number, z: number, width: number, depth: number): THREE.Group {
    const section = new THREE.Group();
    root.add(section);
    const back = kind === 'back', doorway = kind === doorSide;
    // Add substance outwards. Keep the inhabited face, doors and prop/asset
    // supports at their existing coordinates instead of stealing aisle space.
    const thickness=.32,outer=kind==='left'?-1:1;
    const shellX=back?x:x+outer*(thickness-width)/2,shellZ=back?z-(thickness-depth)/2:z;
    const slices = back ? [[x - width / 2, x + width / 2]] : doorway
      ? [[z - depth / 2, sideDoorZ - doorWidth / 2], [sideDoorZ + doorWidth / 2, z + depth / 2]]
      : [[z - depth / 2, z + depth / 2]];
    for (const [left, right] of slices) {
      const span = right - left;
      if (span < 0.01) continue;
      const center = (left + right) / 2;
      const masonry=architecturalBlock(section, kit, '#e6ddce', [back ? center : shellX, 1.98, back ? shellZ : center], [back ? span : thickness, 3.84, back ? thickness : span],.07);
      masonry.name='Rounded wall body';
      masonry.userData.inhabitedFace={axis:back?'z':'x',value:back?z+depth/2:x-outer*width/2,side:back?1:-outer};
      blockers.push({ bounds: back ? [left, shellZ - thickness / 2, right, shellZ + thickness / 2] : [shellX - thickness / 2, left, shellX + thickness / 2, right] });
    }
    if (back) {
      for (const [left, right] of slices) {
        const span = right - left;
        paneledWallFinish(section,kit,palette.wall,(left+right)/2,z,span);
      }
      architecturalBlock(section, kit, '#eee5d6', [x, 3.94, shellZ], [width + 0.06, 0.16, thickness + 0.045]);
    } else {
      const inside = kind === 'left' ? 1 : -1;
      for (const [left, right] of slices) {
        const span = right - left;
        if (span < 0.01) continue;
        const center = (left + right) / 2;
        if (lowerRoom) {
          const inset = beveledBlock(section, kit, palette.wall, [x + inside * 0.11, 1.91, center], [0.035, 3.55, Math.max(0.01, span - 0.08)], 0.012);
          inset.userData.roomSurface = 'wall';
        }
        kit.mesh(section, 'roundedBox', '#eee5d6', [x + inside * 0.105, 0.22, center], [0.045, 0.2, Math.max(0.01, span - 0.02)]);
      }
      architecturalBlock(section, kit, '#f0e8db', [shellX, 3.94, z], [thickness + 0.045, 0.16, depth + 0.08]);
      if (doorway) {
        architecturalBlock(section, kit, palette.wall, [shellX, 3.25, sideDoorZ], [thickness, 1.3, doorWidth]);
        architecturalBlock(section, kit, '#eee5d6', [shellX + inside * 0.025, 2.59, sideDoorZ], [thickness + 0.035, 0.1, doorWidth + 0.06],.04);
        beveledBlock(interior, kit, '#cabb9f', [x, 0.079, sideDoorZ], [0.3, 0.008, doorWidth], 0.003);
      }
      if ((index % 3 === 0 && kind === 'left') || (index % 3 === 2 && kind === 'right')) {
        for (const windowZ of [z - depth * 0.25, z + depth * 0.25]) {
          kit.mesh(section, 'roundedBox', '#73837d', [x + inside * 0.125, 1.72, windowZ], [0.025, 1.12, depth * 0.35]);
          kit.mesh(section, 'box', '#c1d0c6', [x + inside * 0.142, 1.72, windowZ], [0.012, 0.98, depth * 0.31]);
          kit.mesh(section, 'box', '#e6ddce', [x + inside * 0.158, 1.72, windowZ], [0.03, 0.045, depth * 0.34]);
          kit.mesh(section, 'box', '#e6ddce', [x + inside * 0.158, 1.72, windowZ], [0.03, 1.06, 0.045]);
        }
      }
    }
    const exterior = kind === 'back' || (kind === 'left' && index % 3 === 0) || (kind === 'right' && index % 3 === 2);
    walls.push({ root: section, normal: new THREE.Vector3(kind === 'left' ? -1 : kind === 'right' ? 1 : 0, 0, kind === 'back' ? -1 : 0), twoSided: !exterior });
    return section;
  }

  let shelfAsset: [number,number,number]=[-2.32,1.27,1.9];
  if (!isFoyer) {
    const back = wall('back', 0, backZ, 6.1, 0.2);
    const panelOffset = index === 2 ? -0.12 : 0;
    sign(back, kit, team.name, 0, 3.55 + panelOffset, -2.69 - halfGain - rearExtension, lowerRoom ? 2.85 : team.name.length > 14 ? 3.8 : 3.45);
    const whiteboard = new THREE.Group(); whiteboard.name = `${team.id}:whiteboard`;
    whiteboard.position.set(0, 0, -2.67 - halfGain - rearExtension); back.add(whiteboard);
    board(whiteboard, kit, palette.board, palette.symbol, 0, 1.84 + panelOffset, 0, index === 3 ? '#315946' : '#6a6657');
    const shelfX = index < 3 ? 2.42 : 2.26;
    const shelfZ = -2.32 - halfGain - rearExtension;
    // Narrow built-in carcasses stay inside the actual inner wall while their
    // moved inner edges open a genuine lane beside the three-seat chair backs.
    const shelfWidth = index < 3 ? 0.88 : 1;
    const storageX = index === 5 ? shelfX : -shelfX;
    const storageZ = index === 5 ? backZ + 0.31 : shelfZ;
    // Dispatch keeps its shallow wall rack and certified rear aisle. Its
    // smaller upright plants below are built at natural proportions, outside
    // the rack's depth transform, and fit that same physical envelope.
    const storageDepth = index === 5 ? 0.4 : 1;
    const leftShelf = new THREE.Group(); leftShelf.position.set(storageX, 0, storageZ); leftShelf.scale.set(shelfWidth, 1, index===5?1:storageDepth); (framedStorage?root:interior).add(leftShelf);
    const rack=index===5?new THREE.Group():leftShelf;
    if(index===5){rack.scale.z=storageDepth;leftShelf.add(rack);}
    const leftTop=framedStorage?storageCabinet(rack,kit,true,index===2?'wayfinder':'merchant'):shelf(leftShelf, kit, 0, 0, index, index % 2 === 1,1,4);
    if(framedStorage)leftShelf.name=`${team.id}:${index===5?'bookcase':'cabinet'}`;
    shelfAsset=[storageX,leftTop+.01,storageZ+.02];
    if (index === 3) {
      // A separate small stand occupies the gap between storage and lamp.
      // The former perpendicular bookcase physically intersected the cabinet.
      const stand=plantStand(root,kit,-2.45,-1.18);
      plant(stand,kit,0,0,.49,stand.userData.supportHeight,'#c7b794','leaf','full');
      tidyStaticMeshes(stand);
      blockers.push({bounds:[-2.70,-1.43,-2.20,-.93]});
    } else if (!lowerRoom) {
      const rightShelf = new THREE.Group(); rightShelf.position.set(shelfX, 0, shelfZ + 0.01); rightShelf.scale.x = shelfWidth; interior.add(rightShelf);
      const rightTop=framedStorage?storageCabinet(rightShelf,kit,false,index===0?'merchant':'wayfinder'):shelf(rightShelf, kit, 0, 0, index + 1, false,1,index===1?4:5);
      plant(rightShelf, kit, -0.23, 0.07, 0.61, rightTop, '#b6a17c', 'leaf',index===2);
      plant(rightShelf, kit, 0.01, -0.17, 0.42, rightTop, '#cbb488', 'herb');
      plant(rightShelf, kit, 0.21, 0.1, 0.63, rightTop, '#c7b794', index % 2 ? 'herb' : 'spear');
    }
    if (index === 5) {
      // Dispatch's real filing cabinet belongs on the right, as in its source
      // room. It stays distinct from the back-right bookcase and is reached at
      // its true front, not through the newly continuous back wall.
      filingCabinet(2.8, 1.8, -Math.PI / 2, false).scale.z = 0.8;
      blockers.push({ bounds: [2.67, 1.25, 2.9, 2.35] });
    } else if(!framedStorage)filingCabinet(-shelfX, shelfZ).scale.x = shelfWidth;
    blockers.push({ bounds: index < 3 ? [-2.9, shelfZ - 0.38, -1.94, shelfZ + 0.48]
      : index === 5 ? [1.7, storageZ - 0.38 * storageDepth, 2.83, storageZ + 0.48 * storageDepth] : [-2.83, shelfZ - 0.38, -1.7, shelfZ + 0.48] });
    if (!lowerRoom) blockers.push({ bounds: [1.94, shelfZ - 0.38, 2.9, shelfZ + 0.48] });
    if(index===5){
      const planting=new THREE.Group();planting.name='Dispatch upright cabinet planting';
      leftShelf.add(planting);
      plant(planting,kit,-.20,.02,.57,leftTop,'#b5aa8a','spear');
      plant(planting,kit,.24,.02,.38,leftTop,'#a88e61','herb');
    }else{
      plant(leftShelf, kit, -0.19, 0.1, 0.74, leftTop, '#b5aa8a','leaf',index===3?'full':index===2);
      plant(leftShelf, kit, 0.24, 0.12, 0.54, leftTop, '#a88e61', 'ivy');
    }
    if(framedStorage)tidyStaticMeshes(leftShelf);
  }
  if (index % 3 === 0) wall('left', -3.0, -0.06 - rearExtension / 2, 0.2, 5.7 + depthGain + rearExtension);
  if (index % 3 === 2) wall('right', 3.0, -0.06 - rearExtension / 2, 0.2, 5.7 + depthGain + rearExtension);
  if (!isFoyer) {
    if (index % 3 !== 0) wall('left', -3.0, -0.57 - rearExtension / 2, 0.18, 4.7 + depthGain + rearExtension);
    if (index % 3 !== 2) wall('right', 3.0, -0.57 - rearExtension / 2, 0.18, 4.7 + depthGain + rearExtension);
  } else {
    [-3.0, 3.0].forEach((x) => {
      const parapet = new THREE.Group(); root.add(parapet);
      const length = 4.75 + depthGain;
      for (const [start, end] of [[0.48 - length / 2, sideDoorZ - doorWidth / 2], [sideDoorZ + doorWidth / 2, 0.48 + length / 2]]) {
        const span = end - start;
        if (span < .1) continue;
        const z = (start + end) / 2;
        const outerX=x+Math.sign(x)*.035;
        architecturalBlock(parapet, kit, '#e7dfd1', [outerX, 0.48, z], [0.24, 0.8, span]);
        architecturalBlock(parapet, kit, '#f3ece1', [outerX, 0.91, z], [0.28, 0.12, span],.05);
        blockers.push({ bounds: [outerX - .14, start, outerX + .14, end] });
      }
      walls.push({ root: parapet, normal: new THREE.Vector3(Math.sign(x), 0, 0), twoSided: true });
    });
    // Low joined bookcases balance the workstation without closing the side
    // doors. The plants keep natural proportions outside each shallow rack.
    for(const [name,x,z,widthScale,kind] of [
      ['Foyer left reading cabinet',-2.32,1.9,.82,'ivy'],
      ['Foyer right reading cabinet',2.54,.25,.64,'herb'],
    ] as const){
      const cabinet=new THREE.Group();cabinet.name=name;cabinet.position.set(x,0,z);root.add(cabinet);
      const rack=new THREE.Group();rack.scale.set(widthScale,1,.82);cabinet.add(rack);
      const top=storageCabinet(rack,kit,false,'reading','paneled');
      plant(cabinet,kit,0,0,kind==='ivy'?.40:.48,top,'#c0ae8e',kind);
      tidyStaticMeshes(cabinet);
    }
    shelfAsset=[-2.32,1.06,1.9];
    blockers.push({bounds:[-2.8,1.55,-1.85,2.3]},{bounds:[2.19,-.03,2.89,.60]});
    const rearStand=plantStand(root,kit,-2.4,-3.25);
    plant(rearStand,kit,0,0,.50,rearStand.userData.supportHeight,'#c7b896','leaf');tidyStaticMeshes(rearStand);
    plant(interior,kit,-1.65,-3.25,.65,.1,'#b4a483','herb');
    blockers.push({bounds:[-2.66,-3.51,-2.14,-2.99]},{bounds:[-1.98,-3.58,-1.32,-2.92]});
    // A compact board and filing base fit the open foyer's rear aisle without
    // closing its doorway or moving its existing plants, seats or shelves.
    const whiteboard = new THREE.Group(); whiteboard.name = `${team.id}:whiteboard`;
    // A low drafting surface on the filing base preserves the open foyer
    // silhouette. Its interaction stop stays at the same accessible location.
    whiteboard.position.set(2.78, 1.43, -3.4); whiteboard.rotation.set(-.48, -Math.PI / 2, 0, 'YXZ');
    whiteboard.scale.set(0.4, 0.46, 0.75); root.add(whiteboard);
    board(whiteboard, kit, palette.board, palette.symbol, 0, 0, 0, '#6a6657');
    tidyStaticMeshes(whiteboard);
    filingCabinet(2.78, -3.4, -Math.PI / 2, false);
    blockers.push({ bounds: [2.63, -3.95, 2.9, -2.85] });
  }

  const aisleX = index === 5 ? 1.9225 : isFoyer?1.4:2.15;
  const tableX = isFoyer ? -.65 : index===3 ? -.25 : index===5 ? -.22 : 0;
  const tableZ = isFoyer ? .2 : index < 3 ? -.95 : .1;
  const tableWidth = isFoyer ? 2.35 : index===3 ? 3.05 : index<2?2.5:index === 5 ? 2.65 : 2.75;
  const tableDepth = isFoyer?1.0:index===0?1.5:index===3||index===1 ? 1.6 : 1.4;
  const sideSeating = index < 2;
  // Paired Wayfinder desks are real independently oriented furniture groups.
  // Their screens, papers and asset anchor use the same transform as the wood;
  // the walking map includes the entire rotated tabletop, not a smaller proxy.
  // The joined center forms one staggered cluster; circulation runs around
  // its outside at the unchanged full avatar radii.
  const pairedDesks = index===2 ? [
    { x:-.70,z:-.95,width:1.34,depth:1.65,angle:-.02,screenZ:-.32 },
    { x:.70,z:-.75,width:1.34,depth:1.50,angle:.02,screenZ:-.20 },
  ].map((layout,i)=>{
    const group=new THREE.Group();group.name=`Wayfinders paired desk ${i+1}`;
    group.position.set(layout.x,0,layout.z);group.rotation.y=layout.angle;interior.add(group);
    table(group,kit,0,0,layout.width,layout.depth,'soft',.12,'joined');
    group.userData.workstationSurface={width:layout.width,depth:layout.depth};
    const halfX=(layout.width*Math.abs(Math.cos(layout.angle))+layout.depth*Math.abs(Math.sin(layout.angle)))/2;
    const halfZ=(layout.width*Math.abs(Math.sin(layout.angle))+layout.depth*Math.abs(Math.cos(layout.angle)))/2;
    const bounds:NavigationBounds=[layout.x-halfX,layout.z-halfZ,layout.x+halfX,layout.z+halfZ];
    blockers.push({bounds});group.userData.workstationBounds=bounds;
    const point=(x:number,z:number):NavigationPoint=>[
      layout.x+x*Math.cos(layout.angle)+z*Math.sin(layout.angle),
      layout.z-x*Math.sin(layout.angle)+z*Math.cos(layout.angle),
    ];
    const props=i===0?new THREE.Group():group;
    if(i===0){
      props.name='Wayfinders starter desktop';props.position.copy(group.position);props.rotation.copy(group.rotation);
      root.add(props);defaultSlotProps.desk=props;
    }
    paper(props,kit,-.12,i===0?.30:.25,i===0?.10:-.08);
    mug(props,kit,.31,i===0?.34:.28,i===0?'#b7c0a4':'#a0aa8d');
    if(i===0)tidyStaticMeshes(props);
    return {...layout,group,point};
  }) : [];
  if(index!==2)table(interior, kit, tableX, tableZ, tableWidth, tableDepth,index===3||index===1?'capsule':isFoyer||index===0?'soft':'rect',.2,'joined');
  if(index===3||index===5){
    // Angled empty guest seats expose their cushion and legs instead of a
    // cabinet-like straight back. Their full rotated footprints are obstacles;
    // the front crossing moves with the furniture, not through its legs.
    const guestX=index===3?.95:-.95,guestZ=tableZ+.72;
    const guest=chair(interior,kit,guestX,guestZ,palette.rug,Math.PI+(index===3?.55:-.55));
    guest.name='Empty guest chair';guest.scale.set(.90,.92,.80);
    blockers.push({bounds:[guestX-.43,guestZ-.43,guestX+.43,guestZ+.43]});
  }
  if(index<2||isFoyer||index===5){
    // A visible empty seat is furniture, not simulated work. Its actual
    // footprint participates in navigation just like every occupied chair.
    const spare=new THREE.Group();spare.name='Empty spare stool';
    // Lower-room side doors need the full front cross aisle. Their stools
    // stay under the table; the upper rooms have space for an exposed seat.
    const tucked=index===5;
    const spareX=tableX+(index===0?-.18:index===1?.12:0),spareZ=tableZ+(isFoyer?.80:tucked?.41:index===1?1.35:1.16),spareRadius=tucked?.28:.34;
    spare.position.set(spareX,0,spareZ);spare.scale.set(tucked?.8:.9,.92,tucked?.8:.9);interior.add(spare);
    stool(spare,kit,0,0,palette.rug);
    blockers.push({bounds:[spareX-spareRadius,spareZ-spareRadius,spareX+spareRadius,spareZ+spareRadius]});
  }
  if(index!==2)blockers.push({ bounds: [tableX - tableWidth / 2, tableZ - tableDepth/2, tableX + tableWidth / 2, tableZ + tableDepth/2] });
  // The starter foyer groups its small residents around a shallow reading
  // table. These are real, walkable arrival/work anchors, not camera-only
  // offsets; agent-authored actions still choose their own destinations.
  const seats: NavigationPoint[] = isFoyer ? [[-.95,-1.13],[.30,-1.20],[1.40,-.30]]
    : index===0 ? [[-1.95,.25],[0,-1.5],[1.95,.10]]
    : index===1 ? [[-1.95,.35],[0,-1.5],[1.95,.35]]
    : sideSeating ? [[-2.08, -0.1], [0, -1.5], [2.08, -0.1]] : team.members.length === 1 ? [[0, -1.5]]
    // Swift stands beside the rear short-end corner, not detached at the rug
    // edge. This is its real home; its full .6-radius body clears the table.
    : index===5 ? [[-.8,-1.7],[1.43,-1.4]]
    : team.members.length === 2 ? [[-0.8, -1.5], [0.8, -1.5]]
      : team.members.length === 4 ? [[-.70, -1.5], [.70, -1.23], [-.70, 1.5], [.70, 1.63]]
        : [[-0.8, 1.5], [0, -1.5], [0.8, 1.5]];
  const desks: DeskNavigation[] = seats.map(([x, side], memberIndex) => {
    const z = isFoyer ? side : tableZ + side;
    const north = z < tableZ;
    const standingSide = sideSeating && memberIndex !== 1;
    // Side residents face the shared papers near the table's front edge. Their
    // real floor-height homes flank the table; no render-only position offsets.
    const facing = isFoyer ? Math.atan2(tableX - x, tableZ - z) : standingSide ? Math.atan2(-x, tableZ + 0.6 - z)
      : north ? (x === 0 ? 0 : -Math.sign(x) * 0.28) : -Math.sign(x) * 0.65;
    const screenZ = tableZ + (north ? -0.32 : 0.23);
    const character = team.members[memberIndex];
    const paired=pairedDesks[memberIndex%2];
    // Shared paper-covered tables, not one screen for every resident. The
    // work stop still belongs to every member, regardless of the prop there.
    const hasComputer = index === 3 || index === 5 && memberIndex === 0
      || index === 2 && memberIndex < 2 || index < 2 && memberIndex === 1;
    const computer = !hasComputer ? undefined : paired ? laptop(paired.group,kit,0,paired.screenZ,'#5b6257',Math.PI)
      : index === 3 ? monitor(interior, kit, -0.92, screenZ, Math.PI - 0.56)
      : laptop(interior, kit, x, screenZ, index === 5 ? '#334143' : '#5b6257', north ? Math.PI : 0);
    // Keep Beacon's expression visible beside the screen from the campus and
    // window viewpoints. The smaller workstation remains grounded at the
    // same tabletop height; no character transform or pretend work is used.
    if (computer && index === 3) computer.scale.setScalar(.86);
    if (computer) computer.userData.workstation = memberIndex;
    // Fixed side chairs would close the full-clearance path between the desk
    // and wall. These two standing places therefore have no pretend seat.
    if (!isFoyer && !standingSide && index !== 5 && character.kind !== 'lantern' && character.kind !== 'swift') {
      if(paired&&!north){
        const seat=new THREE.Group();seat.name='Paired desk stool';seat.position.set(x,0,z);interior.add(seat);
        stool(seat,kit,0,0,palette.rug);seat.userData.workstation=memberIndex;
      }else{
        const fittedScout=character.id==='bridge-scout';
        const seat = chair(interior, kit, x, z-(fittedScout?.08:0), isFoyer ? '#a9855f' : palette.rug, paired?paired.angle:facing,fittedScout?'low':'standard');
        seat.userData.workstation = memberIndex;
      }
      blockers.push({ bounds: [x - 0.36, z - (character.id==='bridge-scout'?.48:.36), x + 0.36, z + 0.36], deskIndex: memberIndex });
    }
    const screen:NavigationPoint=isFoyer?[tableX+(memberIndex===0?-1:1)*Math.min(1,tableWidth/2-.32),tableZ+(memberIndex===0?.06:.08)]
      :index===5&&memberIndex===1?[tableX+Math.min(1,tableWidth/2-.32),tableZ+.34]
      :paired?paired.point(0,north?paired.screenZ:.25):[computer?.position.x ?? x,screenZ];
    const workFacing=isFoyer||paired||index===3&&computer||index===5&&memberIndex===1?Math.atan2(screen[0]-x,screen[1]-z):facing;
    return { position: [x, z], screen, facing:workFacing,
      egress: paired ? [Math.sign(x)*(north?.6:.45),north?-3.6:1.8]
        : isFoyer ? memberIndex === 2 ? [aisleX, z] : [x, memberIndex === 0 ? -1.8 : -1.9]
        : index===5&&memberIndex===1 ? [aisleX,z] : standingSide ? [x, tableZ - 1.5] : lowerRoom && north ? [index === 5 ? -aisleX : aisleX, z] : [x, z + (north ? character.id==='bridge-scout'?-1.29:-1.15 : paired&&memberIndex===3?1.15:1.2)],
      ...(isFoyer || standingSide || index === 5 ? { seatHeight: OFFICE_FLOOR_Y } : character.kind === 'lantern' ? {} : { seatHeight: character.kind === 'robot' ? 0.2 : character.kind === 'owl' ? 0.45 : OFFICE_FLOOR_Y }) };
  });
  const actorHomes = desks.map(({ position: [x, z] }) => new THREE.Vector3(x, OFFICE_FLOOR_Y, z));
  // These are neutral arrival silhouettes, not work poses. Keep the real desk
  // facing on the navigation anchor so an agent's chosen work turns to its task.
  const actorFacing = desks.map((desk,i) => index===3?0:index===5&&i===1?-.42:index===2?-Math.sign(desk.position[0])*(i<2?.28:.65):isFoyer ? [Math.atan2(.6,1.4),Math.atan2(-.8,1.5),-.42][i]
    : sideSeating && i!==1 ? (i===0?.32:-.38) : desk.facing);
  const paperX = Math.min(1, tableWidth / 2 - 0.32), mugX = Math.min(1.12, tableWidth / 2 - 0.27);
  // Distinct default tabletop layouts leave the same physical work stops free.
  // North laptops need their full keyboard footprint, with papers forward of it.
  if(index!==5&&index!==2)paper(interior, kit, tableX - paperX, tableZ + .06,index===1?-.14:.08);
  if(index===0||index===1||isFoyer)notebook(interior,kit,tableX+paperX,tableZ+.08,index===0?'#536e65':isFoyer?'#6a674e':'#9a7855',index===1?.10:-.13);
  else if(index!==2)paper(interior, kit, tableX + paperX, tableZ + (index===5?.34:.04), -0.2);
  if(index!==2)mug(interior, kit, isFoyer?tableX-.16:tableX+mugX, tableZ+(isFoyer?.12:-.48), index === 4 ? '#647c50' : '#a0aa8d');
  if(index<2)mug(interior, kit, tableX - mugX, tableZ - 0.48,index===0?'#c4b28c':'#b7c0a4');
  if (isFoyer) ['#7a8a65', '#e0cfaa', '#bda57c'].forEach((color, i) => kit.mesh(interior, 'roundedBox', color, [tableX - paperX, 0.825 + i * 0.057, tableZ - 0.25], [0.44, 0.055, 0.32], [0, -0.12, 0]));
  const frontPlantParent=index===2?new THREE.Group():interior;
  if(index===2){frontPlantParent.name='Wayfinders starter floor plant';root.add(frontPlantParent);defaultSlotProps.floor=frontPlantParent;}
  plant(frontPlantParent, kit, -2.6, frontPlantZ, 1.0, 0.1, index % 2 ? '#c3b38d' : '#b7a280', 'broad',index===2||index===5);
  if(index===2)tidyStaticMeshes(frontPlantParent);
  if(index===5)parcelStack(interior,kit,2.63,frontPlantZ);
  else plant(interior, kit, 2.63, frontPlantZ, 1.18, 0.1, '#c5b998', 'spear');
  blockers.push({ bounds: [-3.2, frontPlantZ - 0.6, -2.0, frontPlantZ + 0.6] },
    { bounds: index===5 ? [2.10,frontPlantZ-.44,3.16,frontPlantZ+.44] : [2.24, frontPlantZ - 0.39, 3.02, frontPlantZ + 0.39] });
  const shelfPlant=sideSeating||index===2;
  const midPlant: NavigationPoint = isFoyer ? [-1.85, -2.8] : [-2.53, shelfPlant ? -2.2 - halfGain - rearExtension : lowerRoom ? 1.1 : -0.85];
  if(index!==3&&!isFoyer)plant(interior, kit, ...midPlant, 0.54, shelfPlant ? shelfAsset[1]-.01 : 0.1, '#bc976e', index % 2 ? 'leaf' : 'herb');
  // In the two side-standing rooms this pot is physically supported by the
  // existing shelf and fits its already-blocked envelope, not the walking lane.
  if (!shelfPlant&&index!==3&&!isFoyer) blockers.push({ bounds: [midPlant[0] - 0.27, midPlant[1] - 0.27, midPlant[0] + 0.27, midPlant[1] + 0.27] });
  if (index >= 3 && index !== 4) {
    lamp(interior, kit, -2.12, -0.38, index);
    blockers.push({ bounds: [-2.52, -0.78, -1.72, 0.02] });
  }
  if (index === 3) {
    // A low reference shelf connects the desk to its reading corner. It fits
    // the already reserved floor-recipe envelope and disappears when Beacon
    // authors that slot; the default never crowds an agent's own furnishing.
    const nook=new THREE.Group();nook.name='Beacon starter reading nook';
    nook.position.set(-2.15,0,1.0);nook.rotation.y=Math.PI/2;root.add(nook);
    const top=storageCabinet(nook,kit,false,'reading');
    plant(nook,kit,-.15,0,.48,top,'#c3b9a2','herb');
    tidyStaticMeshes(nook);defaultSlotProps.floor=nook;
  }
  if (index >= 3 && !isFoyer) {
    architecturalBlock(interior, kit, '#e8dfd0', [0, 0.3, 2.90 + halfGain], [5.95, 0.44, 0.28]);
    architecturalBlock(interior, kit, '#f1e9dd', [0, 0.55, 2.90 + halfGain], [6.0, 0.11, 0.31],.045);
    blockers.push({ bounds: [-3, 2.86 + halfGain - 0.12, 3, 2.90 + halfGain + .155] });
  }
  const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-2.96, 0.11, -2.8 - halfGain - rearExtension), new THREE.Vector3(2.96, 0.11, -2.8 - halfGain - rearExtension),
    new THREE.Vector3(2.96, 0.11, 2.79 + halfGain), new THREE.Vector3(-2.96, 0.11, 2.79 + halfGain)
  ]), new THREE.LineBasicMaterial({ color: '#7f9987', transparent: true, opacity: 0.32 }));
  outline.visible = false; root.add(outline);
  const decorations: Room['decorations'] = { plant: new THREE.Group(), lamp: new THREE.Group(), art: new THREE.Group() };
  plant(decorations.plant, kit, -2.2, frontPlantZ - 0.25, 0.78, 0.1, '#c59c75');
  lamp(decorations.lamp, kit, 1.5, frontPlantZ - 0.05, index + 7);
  blockers.push({ bounds: [-2.6, frontPlantZ - 0.65, -1.8, frontPlantZ + 0.15], decoration: 'plant' },
    { bounds: [1.1, frontPlantZ - 0.45, 1.9, frontPlantZ + 0.35], decoration: 'lamp' },
    { bounds: isFoyer ? [-0.675, -4.225, 0.675, -2.875] : index===2?[-2.825,2.125,-1.475,3.475]:[-2.825, 0.325, -1.475, 1.675] });
  kit.mesh(decorations.art, 'roundedBox', '#b4946e', [-2.5, 1.43, -1.05], [0.075, 0.83, 0.76]);
  kit.mesh(decorations.art, 'box', '#f0e5ce', [-2.451, 1.43, -1.05], [0.01, 0.67, 0.59]);
  kit.mesh(decorations.art, 'sphere', '#8fa17e', [-2.43, 1.46, -1.12], [0.015, 0.29, 0.28]);
  Object.values(decorations).forEach((decoration) => { tidyStaticMeshes(decoration); decoration.visible = false; root.add(decoration); });
  tidyStaticMeshes(interior);
  walls.forEach(({ root: wallRoot }) => tidyStaticMeshes(wallRoot));
  const door: NavigationPoint = index < 3 ? [0, 3.65] : isFoyer ? [doorX, backZ] : [index === 3 ? 3 : -3, sideDoorZ];
  const frontCross = index===3||index===5 ? 2.0 : isFoyer ? 2.19 : lowerRoom ? tableZ + 1.47 : Math.max(...desks.map(desk => desk.egress[1]), tableZ + (index<2?2.5:2.1));
  const rearCross = index === 2 ? backZ + 1.8 : Math.min(...desks.map(desk => desk.egress[1]), tableZ - 2.1);
  // Both deeper shared tables need a correspondingly deeper rear approach,
  // including enough clearance for a visiting paper owl.
  const rearApproach=tableZ-(index<2?1.65:1.5);
  // Interaction stops face real props and share the certified walking aisles.
  const cabinetStop: NavigationPoint = isFoyer ? [1.5, -3.4] : index === 5 ? [1.7, 1.8]
    : lowerRoom ? [-0.9, backZ + 1.1] : index === 2 ? [-0.9, backZ + 1.5] : [-1.25, backZ + 1.85];
  const cabinetProp: NavigationPoint = isFoyer ? [2.78, -3.4] : index === 5 ? [2.8, 1.8] : [index < 3 ? -2.42 : -2.26, backZ + 0.56];
  const whiteboardStop: NavigationPoint = isFoyer ? [1.5, -3.4] : [lowerRoom ? index === 5 ? 0.8 : 1.95 : 0, backZ + 0.89];
  const whiteboardProp: NavigationPoint = isFoyer ? [2.78, -3.4] : [0, backZ + 0.21];
  const interactions: RoomNavigation['interactions'] = {
    cabinet: { position: cabinetStop, facing: Math.atan2(cabinetProp[0] - cabinetStop[0], cabinetProp[1] - cabinetStop[1]) },
    whiteboard: { position: whiteboardStop, facing: Math.atan2(whiteboardProp[0] - whiteboardStop[0], whiteboardProp[1] - whiteboardStop[1]) },
  };
  const navigation: RoomNavigation = { floorY: OFFICE_FLOOR_Y,
    bounds: [-2.9, index < 3 ? backZ + 0.12 : backZ - 1.4, 2.9, index < 3 ? 4.9 : 4.25],
    blockers, door, lounge: [index===3?-.25:0, isFoyer ? 2.5 : index < 3 ? 2.1 : index===3||index===5?2.0:1.7], task: [aisleX, tableZ], interactions,
    waypoints: [door, [doorX, backZ + 0.7], [2, backZ + 0.9], [aisleX, backZ + 1.05], [aisleX, rearCross], [aisleX, rearApproach], [aisleX, tableZ],
      [0, rearCross], ...(index===2?[[-aisleX,rearCross],[-aisleX,rearApproach],[-aisleX,tableZ]] as NavigationPoint[]:[]), ...(!lowerRoom && !isFoyer ? [[-1.15, rearApproach], [-1.15, rearCross], [1.15, rearApproach], [1.15, rearCross]] as NavigationPoint[] : []),
      ...(lowerRoom ? [[index === 3 ? 2.15 : -2.15, sideDoorZ], [index === 3 ? 2.15 : -2.15, tableZ - 1.5]] as NavigationPoint[] : []),
      ...(index === 5 ? [[0.8, -1.36], [aisleX, -1.36]] as NavigationPoint[] : []),
      [aisleX, frontCross], [0, frontCross], [0, index < 3 ? 4.7875 : 4.0], ...(isFoyer ? [[1.4, -2.03], [aisleX, -2.03]] as NavigationPoint[] : []), ...desks.map(desk => desk.egress)], desks };
  const assetSlots: Room['assetSlots'] = {
    desk: pairedDesks.length ? {position:[pairedDesks[0].point(0,.25)[0],.84,pairedDesks[0].point(0,.25)[1]],rotation:[0,pairedDesks[0].angle,0]}
      : { position: [tableX, 0.84, tableZ + 0.3] },
    shelf: { position: shelfAsset },
    // The foyer has a low parapet, not an imaginary full-height wall.
    wall: { position: [-2.85, isFoyer ? 0.5 : 2.1, 1.7], rotation: [0, Math.PI / 2, 0] },
    floor: { position: isFoyer ? [0, OFFICE_FLOOR_Y, -3.55] : [-2.15, OFFICE_FLOOR_Y, index===2?2.8:1.0] },
    festive: { position: [0, 3.5, backZ + 0.4] },
  };
  return { root, center, outline, decorations, actorHomes, actorFacing, navigation, assetSlots, defaultSlotProps, walls };
}

export function makeCampus(kit: SceneKit): THREE.Group {
  const campus = new THREE.Group();
  const depthGain = 1.475;
  const entryShift = (OFFICE_ROW_SPACING - (6.3 + depthGain)) / 2;
  campus.name = 'One shared home';
  architecturalBlock(campus, kit, '#d7c7b0', [0, -0.25, -0.15], [18.7, 0.4, 14.4 + depthGain * 2 + entryShift * 2],.11);
  architecturalBlock(campus, kit, '#e8ddca', [0, -0.075, -0.15], [18.65, 0.18, 14.35 + depthGain * 2 + entryShift * 2],.07);
  // Keep the textured shared floor clear of its own support and the overlapping
  // room floor layers. Millimetre gaps shimmer at the overview camera distance.
  beveledBlock(campus, kit, '#d2bfa4', [0, 0.024, 0.45], [18.3, 0.086, 3.8]);
  floorSurface(campus, '#9f8570', [0, 0.075, 0.45], [18.3, 3.8], true,kit);
  for (const x of [-3.075, 3.075]) {
    beveledBlock(campus, kit, '#d2bfa4', [x, 0.024, 3.15], [0.85, 0.086, 2]);
    // Meet the corridor texture at z=2.35 without coplanar overlap.
    floorSurface(campus, '#9f8570', [x, 0.075, 3.25], [0.85, 1.8], true,kit);
  }
  architecturalBlock(campus, kit, '#d4c2a8', [0, -0.08, 6.9 + depthGain + entryShift], [6.15, 0.33, 1.8],.075);
  floorSurface(campus, '#cec7b9', [0, 0.087, 6.85 + depthGain + entryShift], [5.85, 1.85], true,kit);
  [-2.98, 2.98].forEach((x) => {
    const outerX=x+Math.sign(x)*.035;
    architecturalBlock(campus, kit, '#e7dfd0', [outerX, 0.32, 6.75 + depthGain + entryShift], [0.27, 0.65, 1.9]);
    architecturalBlock(campus, kit, '#f0e8dc', [outerX, 0.68, 6.75 + depthGain + entryShift], [0.31, 0.12, 1.95],.05);
  });
  architecturalBlock(campus, kit, '#d5c8b2', [0, -0.29, 7.91 + depthGain + entryShift], [6.2, 0.14, 0.44],.05);
  architecturalBlock(campus, kit, '#e1d4bf', [0, -0.34, 8.15 + depthGain + entryShift], [6.3, 0.12, 0.35],.045);
  rug(campus, kit, '#b99c77', 0, 6.83 + depthGain + entryShift, 2.43, 1.43, ['Same', 'Curiosity', 'Further', 'Together']);
  for (const side of [-1, 1]) {
    const x = side * 6.2;
    const bench = new THREE.Group(); bench.position.set(x, 0, 6.62 + depthGain + entryShift); campus.add(bench);
    bench.userData.floorContacts = [[0, 0.021, 0, 3.7, 0.95]];
    kit.mesh(bench, 'roundedBox', '#b59065', [0, 0.49, 0], [3.7, 0.2, 0.85]);
    for (const legX of [-1.45, 1.45]) kit.mesh(bench, 'roundedBox', '#9b7a52', [legX, 0.2, 0], [0.13, 0.48, 0.65]);
    sign(bench, kit, side < 0 ? 'A quieter, kinder internet.' : 'Built by good people (and AI).', 0, 0.602, 0, 3.24, true, '#b59065', '#493e2d');
    plant(campus, kit, x - 2.05, 6.54 + depthGain + entryShift, 0.72, 0.02, '#c4af89', 'herb');
    plant(campus, kit, x + 2.05, 6.54 + depthGain + entryShift, 1.16, 0.02, '#b79d72');
  }
  [-2.35, 2.35].forEach((x) => plant(campus, kit, x, 6.3 + depthGain + entryShift, 1.05, 0.1, '#d5c8aa'));
  tidyStaticMeshes(campus);
  return campus;
}

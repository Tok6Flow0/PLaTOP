import * as THREE from 'three';
import type { Decoration, Team } from '../types';
import { SceneKit } from './primitives';
import { beveledBlock, board, chair, floorSurface, lamp, laptop, monitor, mug, notebook, paper, plant, rug, shelf, sign, stool, table, tidyStaticMeshes } from './environmentProps';

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
  walls: Array<{ root: THREE.Object3D; normal: THREE.Vector3; twoSided?: boolean }>;
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
  // Four full-clearance north seats need a real rear cross aisle, not a route
  // through their chair backs. The other upper rooms keep their shorter plan.
  const rearExtension = index === 2 ? 1.75 : index < 3 ? 1 : -1;
  const center = new THREE.Vector3((index % 3 - 1) * 6.15, 0, (Math.floor(index / 3) - 0.5) * OFFICE_ROW_SPACING);
  root.position.copy(center);
  const palette = finishes[index];
  // Public finish references let local agent styles tint the authored room
  // without guessing which green belongs to a plant or changing navigation.
  root.userData.roomPalette = { wall: palette.wall, rug: palette.rug, furniture: '#c59e73' };
  root.userData.rugSurface = { bounds: [index === 4 ? -2.05 : -2.275, -1.75, index === 4 ? 2.05 : 2.275, 2.45], height: 0.13 };
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
  beveledBlock(interior, kit, '#d2bfa4', [0, -0.03, -floorExtension / 2], [6.12, 0.22, 5.9 + depthGain + floorExtension]);
  floorSurface(interior, '#b8aa95', [0, 0.087, -floorExtension / 2], [5.94, 5.7 + depthGain + floorExtension]);
  rug(interior, kit, palette.rug, 0, 0.35, isFoyer ? 4.1 : 4.55, 4.2);

  function wall(kind: 'back' | 'left' | 'right', x: number, z: number, width: number, depth: number): THREE.Group {
    const section = new THREE.Group();
    root.add(section);
    const back = kind === 'back', doorway = kind === doorSide;
    const slices = back ? [[x - width / 2, x + width / 2]] : doorway
      ? [[z - depth / 2, sideDoorZ - doorWidth / 2], [sideDoorZ + doorWidth / 2, z + depth / 2]]
      : [[z - depth / 2, z + depth / 2]];
    for (const [left, right] of slices) {
      const span = right - left;
      if (span < 0.01) continue;
      const center = (left + right) / 2;
      beveledBlock(section, kit, '#e6ddce', [back ? center : x, 1.98, back ? z : center], [back ? span : width, 3.84, back ? depth : span]);
      blockers.push({ bounds: back ? [left, z - depth / 2, right, z + depth / 2] : [x - width / 2, left, x + width / 2, right] });
    }
    if (back) {
      for (const [left, right] of slices) {
        const span = right - left;
        const finish = beveledBlock(section, kit, palette.wall, [(left + right) / 2, 1.91, z + 0.105], [Math.max(0.05, span - 0.18), 3.55, 0.055], 0.02);
        finish.userData.roomSurface = 'wall';
        beveledBlock(section, kit, '#d4c4ab', [(left + right) / 2, 0.22, z + 0.14], [Math.max(0.05, span - 0.12), 0.2, 0.065], 0.02);
      }
      beveledBlock(section, kit, '#eee5d6', [x, 3.92, z], [width + 0.06, 0.12, depth + 0.045]);
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
      beveledBlock(section, kit, '#f0e8db', [x, 3.92, z], [width + 0.045, 0.12, depth + 0.08]);
      if (doorway) {
        beveledBlock(section, kit, palette.wall, [x, 3.25, sideDoorZ], [width, 1.3, doorWidth]);
        beveledBlock(section, kit, '#eee5d6', [x + inside * 0.025, 2.59, sideDoorZ], [width + 0.035, 0.1, doorWidth + 0.06]);
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
    // Dispatch uses a genuinely shallow wall rack. Its full-height books and
    // foliage are compressed with the carcass, so the open rear aisle has no
    // unaccounted-for overhangs or a smaller navigation-only shelf footprint.
    const storageDepth = index === 5 ? 0.4 : 1;
    const leftShelf = new THREE.Group(); leftShelf.position.set(storageX, 0, storageZ); leftShelf.scale.set(shelfWidth, 1, storageDepth); interior.add(leftShelf);
    shelf(leftShelf, kit, 0, 0, index, index % 2 === 1);
    if (index === 3) {
      const sideShelf = new THREE.Group(); sideShelf.position.set(-2.48, 0, -1.65); sideShelf.rotation.y = Math.PI / 2; interior.add(sideShelf);
      shelf(sideShelf, kit, 0, 0, index + 1, false);
      plant(sideShelf, kit, -0.23, -0.07, 0.61, 1.48, '#b6a17c', 'leaf');
      plant(sideShelf, kit, 0.01, -0.24, 0.42, 1.48, '#cbb488', 'herb');
      plant(sideShelf, kit, 0.21, -0.06, 0.63, 1.48, '#c7b794', index % 2 ? 'herb' : 'spear');
      blockers.push({ bounds: [-2.9, -2.22, -2.02, -1.08] });
    } else if (!lowerRoom) {
      const rightShelf = new THREE.Group(); rightShelf.position.set(shelfX, 0, shelfZ + 0.01); rightShelf.scale.x = shelfWidth; interior.add(rightShelf);
      shelf(rightShelf, kit, 0, 0, index + 1, false);
      plant(rightShelf, kit, -0.23, 0.07, 0.61, 1.48, '#b6a17c', 'leaf');
      plant(rightShelf, kit, 0.01, -0.17, 0.42, 1.48, '#cbb488', 'herb');
      plant(rightShelf, kit, 0.21, 0.1, 0.63, 1.48, '#c7b794', index % 2 ? 'herb' : 'spear');
    }
    if (index === 5) {
      // Dispatch's real filing cabinet belongs on the right, as in its source
      // room. It stays distinct from the back-right bookcase and is reached at
      // its true front, not through the newly continuous back wall.
      filingCabinet(2.8, 1.8, -Math.PI / 2, false).scale.z = 0.8;
      blockers.push({ bounds: [2.67, 1.25, 2.9, 2.35] });
    } else filingCabinet(-shelfX, shelfZ).scale.x = shelfWidth;
    blockers.push({ bounds: index < 3 ? [-2.9, shelfZ - 0.38, -1.94, shelfZ + 0.48]
      : index === 5 ? [1.7, storageZ - 0.38 * storageDepth, 2.83, storageZ + 0.48 * storageDepth] : [-2.83, shelfZ - 0.38, -1.7, shelfZ + 0.48] });
    if (!lowerRoom) blockers.push({ bounds: [1.94, shelfZ - 0.38, 2.9, shelfZ + 0.48] });
    plant(leftShelf, kit, -0.19, 0.1, 0.74, 1.48, '#b5aa8a');
    plant(leftShelf, kit, 0.24, 0.12, 0.54, 1.48, '#a88e61', 'ivy');
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
        kit.mesh(parapet, 'roundedBox', '#e7dfd1', [x, 0.48, z], [0.17, 0.8, span]);
        kit.mesh(parapet, 'roundedBox', '#f3ece1', [x, 0.9, z], [0.22, 0.1, span]);
        blockers.push({ bounds: [x - 0.11, start, x + 0.11, end] });
      }
      walls.push({ root: parapet, normal: new THREE.Vector3(Math.sign(x), 0, 0), twoSided: true });
    });
    shelf(interior, kit, -2.32, 1.9, 2, false, 0.82);
    const sideShelf = new THREE.Group(); sideShelf.position.set(-2.48, 0, 0.25); sideShelf.rotation.y = Math.PI / 2; interior.add(sideShelf);
    shelf(sideShelf, kit, 0, 0, 4, false, 0.82);
    plant(interior, kit, -2.32, 1.89, 0.58, 1.25, '#d0c4a6', 'ivy');
    plant(sideShelf, kit, 0, -0.01, 0.5, 1.25, '#b89c74', 'spear');
    blockers.push({ bounds: [-2.8, 1.55, -1.85, 2.3] }, { bounds: [-2.85, -0.25, -2.08, 0.75] });
    for (const [i, x] of [-2.4, -1.8, -1.3].entries()) {
      plant(interior, kit, x, -3.25, i === 1 ? 0.61 : 0.7, 0.1, '#c7b896', i === 1 ? 'herb' : 'leaf');
      blockers.push({ bounds: [x - 0.3, -3.55, x + 0.3, -2.95] });
    }
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

  const aisleX = index === 5 ? 1.9225 : 2.15;
  const tableX = isFoyer ? -0.55 : 0;
  const tableZ = isFoyer ? 0.7 : index < 3 ? -0.95 : 0.1;
  const tableWidth = isFoyer ? 3.15 : index === 5 ? 2.35 : 2.75;
  const sideSeating = index < 2;
  table(interior, kit, tableX, tableZ, tableWidth, 1.4,index===3?'capsule':index===1||isFoyer?'soft':'rect');
  if(index<2||isFoyer||index===5){
    // A visible empty seat is furniture, not simulated work. Its actual
    // footprint participates in navigation just like every occupied chair.
    const spare=new THREE.Group();spare.name='Empty spare stool';
    // Lower-room side doors need the full front cross aisle. Their stools
    // stay under the table; the upper rooms have space for an exposed seat.
    const tucked=isFoyer||index===5;
    const spareX=tableX+(index===0?-.18:index===1?.12:0),spareZ=tableZ+(tucked?.41:1.16),spareRadius=tucked?.28:.34;
    spare.position.set(spareX,0,spareZ);spare.scale.set(tucked?.8:.9,.92,tucked?.8:.9);interior.add(spare);
    stool(spare,kit,0,0,palette.rug);
    blockers.push({bounds:[spareX-spareRadius,spareZ-spareRadius,spareX+spareRadius,spareZ+spareRadius]});
  }
  blockers.push({ bounds: [tableX - tableWidth / 2, tableZ - 0.7, tableX + tableWidth / 2, tableZ + 0.7] });
  const seats: NavigationPoint[] = isFoyer ? [[-1.15, -0.7], [0.25, -0.8], [1.85, 0.1]]
    : sideSeating ? [[-2.08, -0.1], [0, -1.5], [2.08, -0.1]] : team.members.length === 1 ? [[0, -1.5]]
    : team.members.length === 2 ? [[-0.8, index === 5 ? -1.7 : -1.5], [0.8, index === 5 ? -1.7 : -1.5]]
      : team.members.length === 4 ? [[-0.8, -1.5], [0.8, -1.5], [-0.8, 1.5], [0.8, 1.5]]
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
    // Shared paper-covered tables, not one screen for every resident. The
    // work stop still belongs to every member, regardless of the prop there.
    const hasComputer = index === 3 || index === 5 && memberIndex === 0
      || index === 2 && memberIndex < 2 || index < 2 && memberIndex === 1;
    const computer = !hasComputer ? undefined : index === 3 ? monitor(interior, kit, -0.65, screenZ, Math.PI - 0.2)
      : laptop(interior, kit, x, screenZ, index === 5 ? '#334143' : '#5b6257', north ? Math.PI : 0);
    if (computer) computer.userData.workstation = memberIndex;
    // Fixed side chairs would close the full-clearance path between the desk
    // and wall. These two standing places therefore have no pretend seat.
    if (!isFoyer && !standingSide && index !== 5 && character.kind !== 'lantern' && character.kind !== 'swift') {
      const seat = chair(interior, kit, x, z, isFoyer ? '#a9855f' : palette.rug, facing);
      seat.userData.workstation = memberIndex;
      blockers.push({ bounds: [x - 0.36, z - 0.36, x + 0.36, z + 0.36], deskIndex: memberIndex });
    }
    return { position: [x, z], screen: [x, screenZ], facing,
      egress: isFoyer ? memberIndex === 2 ? [aisleX, z] : [x, memberIndex === 0 ? -1.8 : -1.9]
        : standingSide ? [x, tableZ - 1.5] : lowerRoom && north ? [index === 5 ? -aisleX : aisleX, z] : [x, z + (north ? -1.15 : 1.2)],
      ...(isFoyer || standingSide || index === 5 ? { seatHeight: OFFICE_FLOOR_Y } : character.kind === 'lantern' ? {} : { seatHeight: character.kind === 'robot' ? 0.2 : character.kind === 'owl' ? 0.45 : OFFICE_FLOOR_Y }) };
  });
  const actorHomes = desks.map(({ position: [x, z] }) => new THREE.Vector3(x, OFFICE_FLOOR_Y, z));
  // These are neutral arrival silhouettes, not work poses. Keep the real desk
  // facing on the navigation anchor so an agent's chosen work turns to its task.
  const actorFacing = desks.map((desk,i) => isFoyer && i===2 ? -.42
    : sideSeating && i!==1 ? (i===0?.32:-.38) : desk.facing);
  const paperX = Math.min(1, tableWidth / 2 - 0.32), mugX = Math.min(1.12, tableWidth / 2 - 0.27);
  // Distinct default tabletop layouts leave the same physical work stops free.
  // North laptops need their full keyboard footprint, with papers forward of it.
  if(index!==5)paper(interior, kit, tableX - paperX, tableZ + (index===2?.34:.06),index===1?-.14:.08);
  if(index===0||index===1||isFoyer)notebook(interior,kit,tableX+paperX,tableZ+.08,index===0?'#536e65':isFoyer?'#6a674e':'#9a7855',index===1?.10:-.13);
  else paper(interior, kit, tableX + paperX, tableZ + (index===2||index===5?.34:.04), -0.2);
  mug(interior, kit, tableX + mugX, tableZ - 0.48, index === 4 ? '#647c50' : '#a0aa8d');
  if(index<3)mug(interior, kit, tableX - mugX, tableZ - 0.48,index===0?'#c4b28c':'#b7c0a4');
  if (isFoyer) ['#7a8a65', '#e0cfaa', '#bda57c'].forEach((color, i) => kit.mesh(interior, 'roundedBox', color, [tableX - 1.0, 0.825 + i * 0.057, tableZ - 0.4], [0.44, 0.055, 0.32], [0, -0.12, 0]));
  plant(interior, kit, -2.6, frontPlantZ, 1.0, 0.1, index % 2 ? '#c3b38d' : '#b7a280', 'broad');
  plant(interior, kit, 2.63, frontPlantZ, 1.18, 0.1, '#c5b998', 'spear');
  blockers.push({ bounds: [-3.2, frontPlantZ - 0.6, -2.0, frontPlantZ + 0.6] },
    { bounds: [2.24, frontPlantZ - 0.39, 3.02, frontPlantZ + 0.39] });
  const midPlant: NavigationPoint = isFoyer ? [-1.85, -2.8] : [-2.53, sideSeating ? -2.2 - halfGain - rearExtension : lowerRoom ? 1.1 : -0.85];
  plant(interior, kit, ...midPlant, 0.54, sideSeating ? 1.48 : 0.1, '#bc976e', index % 2 ? 'leaf' : 'herb');
  // In the two side-standing rooms this pot is physically supported by the
  // existing shelf and fits its already-blocked envelope, not the walking lane.
  if (!sideSeating) blockers.push({ bounds: [midPlant[0] - 0.27, midPlant[1] - 0.27, midPlant[0] + 0.27, midPlant[1] + 0.27] });
  if (index >= 3 && index !== 4) {
    lamp(interior, kit, -2.12, -0.38, index);
    blockers.push({ bounds: [-2.52, -0.78, -1.72, 0.02] });
  }
  if (index === 3) plant(interior, kit, -1.8, -0.4, 0.55, 0.75, '#c3b9a2', 'herb');
  if (index >= 3 && !isFoyer) {
    kit.mesh(interior, 'roundedBox', '#e8dfd0', [0, 0.3, 2.86 + halfGain], [5.95, 0.44, 0.2]);
    kit.mesh(interior, 'roundedBox', '#f1e9dd', [0, 0.54, 2.86 + halfGain], [6.0, 0.085, 0.23]);
    blockers.push({ bounds: [-3, 2.86 + halfGain - 0.12, 3, 2.86 + halfGain + 0.12] });
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
    { bounds: isFoyer ? [-0.675, -4.225, 0.675, -2.875] : [-2.825, 0.325, -1.475, 1.675] });
  kit.mesh(decorations.art, 'roundedBox', '#b4946e', [-2.5, 1.43, -1.05], [0.075, 0.83, 0.76]);
  kit.mesh(decorations.art, 'box', '#f0e5ce', [-2.451, 1.43, -1.05], [0.01, 0.67, 0.59]);
  kit.mesh(decorations.art, 'sphere', '#8fa17e', [-2.43, 1.46, -1.12], [0.015, 0.29, 0.28]);
  Object.values(decorations).forEach((decoration) => { tidyStaticMeshes(decoration); decoration.visible = false; root.add(decoration); });
  tidyStaticMeshes(interior);
  walls.forEach(({ root: wallRoot }) => tidyStaticMeshes(wallRoot));
  const door: NavigationPoint = index < 3 ? [0, 3.65] : isFoyer ? [doorX, backZ] : [index === 3 ? 3 : -3, sideDoorZ];
  const frontCross = isFoyer || lowerRoom ? tableZ + 1.47 : Math.max(...desks.map(desk => desk.egress[1]), tableZ + (index<2?2.5:2.1));
  const rearCross = index === 2 ? backZ + 1.8 : Math.min(...desks.map(desk => desk.egress[1]), tableZ - 2.1);
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
    blockers, door, lounge: [0, isFoyer ? 2.5 : index < 3 ? 2.1 : 1.7], task: [aisleX, tableZ], interactions,
    waypoints: [door, [doorX, backZ + 0.7], [2, backZ + 0.9], [aisleX, backZ + 1.05], [aisleX, rearCross], [aisleX, tableZ - 1.5], [aisleX, tableZ],
      [0, rearCross], ...(!lowerRoom && !isFoyer ? [[-1.15, tableZ - 1.5], [-1.15, rearCross], [1.15, tableZ - 1.5], [1.15, rearCross]] as NavigationPoint[] : []),
      ...(lowerRoom ? [[index === 3 ? 2.15 : -2.15, sideDoorZ], [index === 3 ? 2.15 : -2.15, tableZ - 1.5]] as NavigationPoint[] : []),
      ...(index === 5 ? [[0.8, -1.36], [aisleX, -1.36]] as NavigationPoint[] : []),
      [aisleX, frontCross], [0, frontCross], [0, index < 3 ? 4.7875 : 4.0], ...(isFoyer ? [[1.4, -2.03], [aisleX, -2.03]] as NavigationPoint[] : []), ...desks.map(desk => desk.egress)], desks };
  const assetSlots: Room['assetSlots'] = {
    desk: { position: [tableX, 0.84, tableZ + 0.3] },
    shelf: { position: isFoyer ? [-2.32, 1.27, 1.9] : [index === 5 ? 2.26 : -2.26, 1.55, backZ + (index === 5 ? 0.32 : 0.57)] },
    // The foyer has a low parapet, not an imaginary full-height wall.
    wall: { position: [-2.85, isFoyer ? 0.5 : 2.1, 1.7], rotation: [0, Math.PI / 2, 0] },
    floor: { position: isFoyer ? [0, OFFICE_FLOOR_Y, -3.55] : [-2.15, OFFICE_FLOOR_Y, 1.0] },
    festive: { position: [0, 3.5, backZ + 0.4] },
  };
  return { root, center, outline, decorations, actorHomes, actorFacing, navigation, assetSlots, walls };
}

export function makeCampus(kit: SceneKit): THREE.Group {
  const campus = new THREE.Group();
  const depthGain = 1.475;
  const entryShift = (OFFICE_ROW_SPACING - (6.3 + depthGain)) / 2;
  campus.name = 'One shared home';
  beveledBlock(campus, kit, '#d7c7b0', [0, -0.25, -0.15], [18.7, 0.4, 14.4 + depthGain * 2 + entryShift * 2]);
  beveledBlock(campus, kit, '#e8ddca', [0, -0.075, -0.15], [18.65, 0.18, 14.35 + depthGain * 2 + entryShift * 2]);
  // Keep the textured shared floor clear of its own support and the overlapping
  // room floor layers. Millimetre gaps shimmer at the overview camera distance.
  beveledBlock(campus, kit, '#d2bfa4', [0, 0.024, 0.45], [18.3, 0.086, 3.8]);
  floorSurface(campus, '#9f8570', [0, 0.075, 0.45], [18.3, 3.8], true);
  for (const x of [-3.075, 3.075]) {
    beveledBlock(campus, kit, '#d2bfa4', [x, 0.024, 3.15], [0.85, 0.086, 2]);
    // Meet the corridor texture at z=2.35 without coplanar overlap.
    floorSurface(campus, '#9f8570', [x, 0.075, 3.25], [0.85, 1.8], true);
  }
  kit.mesh(campus, 'roundedBox', '#d4c2a8', [0, -0.08, 6.9 + depthGain + entryShift], [6.15, 0.33, 1.8]);
  floorSurface(campus, '#cec7b9', [0, 0.087, 6.85 + depthGain + entryShift], [5.85, 1.85], true);
  [-2.98, 2.98].forEach((x) => {
    kit.mesh(campus, 'roundedBox', '#e7dfd0', [x, 0.32, 6.75 + depthGain + entryShift], [0.2, 0.65, 1.9]);
    kit.mesh(campus, 'roundedBox', '#f0e8dc', [x, 0.67, 6.75 + depthGain + entryShift], [0.24, 0.1, 1.95]);
  });
  kit.mesh(campus, 'roundedBox', '#d5c8b2', [0, -0.29, 7.91 + depthGain + entryShift], [6.2, 0.14, 0.44]);
  kit.mesh(campus, 'roundedBox', '#e1d4bf', [0, -0.34, 8.15 + depthGain + entryShift], [6.3, 0.12, 0.35]);
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

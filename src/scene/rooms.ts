import * as THREE from 'three';
import type { Decoration, Team } from '../types';
import { SceneKit } from './primitives';
import { beveledBlock, board, chair, floorSurface, lamp, laptop, monitor, mug, paper, plant, rug, shelf, sign, table, tidyStaticMeshes } from './environmentProps';

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
  waypoints: NavigationPoint[];
  desks: DeskNavigation[];
}
export const OFFICE_ROW_SPACING = 9.575;
export const OFFICE_FLOOR_Y = 0.1;
/** Public geometric coordinates only. Room navigation is local; these campus zones are world coordinates. */
export const campusNavigation = {
  floorY: OFFICE_FLOOR_Y,
  zones: [[-9.1, -1.4, 9.1, 1.5], [-2.9, 7.0, 2.9, 10.15]] as NavigationBounds[],
  blockers: [
    [-2.72, 8.15, -1.98, 9.15], [1.98, 8.15, 2.72, 9.15],
  ] as NavigationBounds[],
  waypoints: [[-6.15, 0], [-4.275, 0], [0, 0], [1.875, 0], [6.15, 0], [8.025, 0],
    [0, 7.8], [0, 9.1], [0, 9.3]] as NavigationPoint[],
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
  { wall: '#b77d59', rug: '#b67655', board: ['People', 'Merchants', 'Brighter days.'], symbol: 'heart' },
  { wall: '#7e8c70', rug: '#8b9779', board: ['Clearer', 'People', 'Happier work'], symbol: 'sprout' },
  { wall: '#34495b', rug: '#797970', board: ['Maps', 'People', 'Progress'], symbol: 'mountain' },
  { wall: '#355a46', rug: '#829272', board: ['A kinder', 'conversation', 'goes a long way.'], symbol: 'chat' },
  { wall: '#c2b397', rug: '#b99c71', board: ['Same curiosity.', 'Further together.'], symbol: 'sprout' },
  { wall: '#30495a', rug: '#657583', board: ['Messages', 'People', 'Care'], symbol: 'envelope' }
];

export function makeRoom(team: Team, index: number, kit: SceneKit): Room {
  const root = new THREE.Group();
  root.name = team.id;
  root.userData.teamId = team.id;
  const depthGain = 1.475;
  const halfGain = depthGain / 2;
  const rearExtension = index < 3 ? 2 : 0;
  const center = new THREE.Vector3((index % 3 - 1) * 6.15, 0, (Math.floor(index / 3) - 0.5) * OFFICE_ROW_SPACING);
  root.position.copy(center);
  const palette = finishes[index];
  const isFoyer = index === 4;
  const walls: Room['walls'] = [];
  const blockers: NavigationBlocker[] = [];
  const rearDoor = index >= 3 && !isFoyer;
  const backZ = -2.88 - halfGain - rearExtension;
  const doorX = 1.875;
  const doorWidth = 1.85;
  const frontPlantZ = index < 3 ? 3.0 : isFoyer ? 3.4 : 3.21;
  const interior = new THREE.Group();
  root.add(interior);
  beveledBlock(interior, kit, '#d2bfa4', [0, -0.03, -rearExtension / 2], [6.12, 0.22, 5.9 + depthGain + rearExtension]);
  floorSurface(interior, '#dec9ac', [0, 0.087, -rearExtension / 2], [5.94, 5.7 + depthGain + rearExtension]);
  rug(interior, kit, palette.rug, 0, 0.35, isFoyer ? 4.1 : 4.55, 4.2);

  function wall(kind: 'back' | 'left' | 'right', x: number, z: number, width: number, depth: number): THREE.Group {
    const section = new THREE.Group();
    root.add(section);
    const slices = kind === 'back' && rearDoor
      ? [[x - width / 2, doorX - doorWidth / 2], [doorX + doorWidth / 2, x + width / 2]]
      : [[x - width / 2, x + width / 2]];
    for (const [left, right] of slices) {
      const span = right - left;
      beveledBlock(section, kit, '#e6ddce', [(left + right) / 2, 1.72, z], [span, 3.32, depth]);
      blockers.push({ bounds: [left, z - depth / 2, right, z + depth / 2] });
    }
    if (kind === 'back') {
      for (const [left, right] of slices) {
        const span = right - left;
        beveledBlock(section, kit, palette.wall, [(left + right) / 2, 1.66, z + 0.105], [Math.max(0.05, span - 0.18), 3.05, 0.055], 0.02);
        beveledBlock(section, kit, '#d4c4ab', [(left + right) / 2, 0.22, z + 0.14], [Math.max(0.05, span - 0.12), 0.2, 0.065], 0.02);
      }
      if (rearDoor) {
        beveledBlock(section, kit, '#e6ddce', [doorX, 2.99, z], [doorWidth, 0.78, depth]);
        beveledBlock(section, kit, '#eee5d6', [doorX, 2.59, z + 0.025], [doorWidth + 0.06, 0.1, depth + 0.035]);
        beveledBlock(interior, kit, '#cabb9f', [doorX, 0.088, z], [doorWidth, 0.018, 0.3], 0.008);
      }
      beveledBlock(section, kit, '#eee5d6', [x, 3.4, z], [width + 0.06, 0.12, depth + 0.045]);
    } else {
      const inside = kind === 'left' ? 1 : -1;
      kit.mesh(section, 'roundedBox', '#eee5d6', [x + inside * 0.105, 0.22, z], [0.045, 0.2, depth - 0.08]);
      beveledBlock(section, kit, '#f0e8db', [x, 3.4, z], [width + 0.045, 0.12, depth + 0.08]);
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
    sign(back, kit, team.name, 0, 3.1, -2.69 - halfGain - rearExtension, team.name.length > 14 ? 3.8 : 3.45);
    board(back, kit, palette.board, palette.symbol, rearDoor ? -0.5 : 0, 1.84, -2.67 - halfGain - rearExtension, index === 3 ? '#315946' : '#6a6657');
    shelf(interior, kit, -2.26, -2.32 - halfGain - rearExtension, index, index % 2 === 1);
    if (rearDoor) {
      const sideShelf = new THREE.Group(); sideShelf.position.set(-2.48, 0, -1.65); sideShelf.rotation.y = Math.PI / 2; interior.add(sideShelf);
      shelf(sideShelf, kit, 0, 0, index + 1, false);
      plant(sideShelf, kit, -0.23, -0.07, 0.61, 1.48, '#b6a17c', 'leaf');
      plant(sideShelf, kit, 0.01, -0.24, 0.42, 1.48, '#cbb488', 'herb');
      plant(sideShelf, kit, 0.21, -0.06, 0.63, 1.48, '#c7b794', index % 2 ? 'herb' : 'spear');
      blockers.push({ bounds: [-2.9, -2.22, -2.02, -1.08] });
    } else shelf(interior, kit, 2.27, -2.31 - halfGain - rearExtension, index + 1, false);
    const shelfZ = -2.32 - halfGain - rearExtension;
    blockers.push({ bounds: [-2.83, shelfZ - 0.38, -1.7, shelfZ + 0.48] });
    if (!rearDoor) blockers.push({ bounds: [1.72, shelfZ - 0.38, 2.82, shelfZ + 0.48] });
    plant(interior, kit, -2.45, -2.22 - halfGain - rearExtension, 0.74, 1.48, '#b5aa8a');
    plant(interior, kit, -2.02, -2.2 - halfGain - rearExtension, 0.54, 1.48, '#a88e61', 'ivy');
    if (!rearDoor) {
      plant(interior, kit, 2.04, -2.24 - halfGain - rearExtension, 0.61, 1.48, '#b6a17c', 'leaf');
      plant(interior, kit, 2.28, -2.48 - halfGain - rearExtension, 0.42, 1.48, '#cbb488', 'herb');
      plant(interior, kit, 2.48, -2.21 - halfGain - rearExtension, 0.63, 1.48, '#c7b794', index % 2 ? 'herb' : 'spear');
    }
  }
  if (index % 3 === 0) wall('left', -3.0, -0.06 - rearExtension / 2, 0.2, 5.7 + depthGain + rearExtension);
  if (index % 3 === 2) wall('right', 3.0, -0.06 - rearExtension / 2, 0.2, 5.7 + depthGain + rearExtension);
  if (!isFoyer) {
    if (index % 3 !== 0) wall('left', -3.0, -0.57 - rearExtension / 2, 0.18, 4.7 + depthGain + rearExtension);
    if (index % 3 !== 2) wall('right', 3.0, -0.57 - rearExtension / 2, 0.18, 4.7 + depthGain + rearExtension);
  } else {
    [-3.0, 3.0].forEach((x) => {
      kit.mesh(interior, 'roundedBox', '#e7dfd1', [x, 0.48, 0.48], [0.17, 0.8, 4.75 + depthGain]);
      kit.mesh(interior, 'roundedBox', '#f3ece1', [x, 0.9, 0.48], [0.22, 0.1, 4.77 + depthGain]);
    });
    shelf(interior, kit, -2.32, -1.55, 2, false, 0.82);
    const sideShelf = new THREE.Group(); sideShelf.position.set(-2.48, 0, 0.25); sideShelf.rotation.y = Math.PI / 2; interior.add(sideShelf);
    shelf(sideShelf, kit, 0, 0, 4, false, 0.82);
    plant(interior, kit, -2.32, -1.56, 0.58, 1.25, '#d0c4a6', 'ivy');
    plant(sideShelf, kit, 0, -0.01, 0.5, 1.25, '#b89c74', 'spear');
    blockers.push({ bounds: [-2.8, -1.9, -1.85, -1.15] }, { bounds: [-2.85, -0.25, -2.08, 0.75] });
    for (const [i, x] of [-2.4, -1.8, -1.3].entries()) {
      plant(interior, kit, x, -3.25, i === 1 ? 0.61 : 0.7, 0.1, '#c7b896', i === 1 ? 'herb' : 'leaf');
      blockers.push({ bounds: [x - 0.3, -3.55, x + 0.3, -2.95] });
    }
  }

  const tableZ = isFoyer ? -0.5 : index < 3 ? -0.95 : -0.1;
  const tableWidth = 2.75;
  table(interior, kit, 0, tableZ, tableWidth, 1.4);
  blockers.push({ bounds: [-tableWidth / 2, tableZ - 0.7, tableWidth / 2, tableZ + 0.7] });
  const seats: NavigationPoint[] = team.members.length === 1 ? [[0, -1.5]]
    : team.members.length === 2 ? [[-0.8, -1.5], [0.8, -1.5]]
      : team.members.length === 4 ? [[-0.8, -1.5], [0.8, -1.5], [-0.8, 1.5], [0.8, 1.5]]
        : [[-0.8, 1.5], [0, -1.5], [0.8, 1.5]];
  const desks: DeskNavigation[] = seats.map(([x, side], memberIndex) => {
    const north = side < 0;
    const facing = north ? 0 : Math.PI;
    const z = tableZ + side;
    const screenZ = tableZ + (north ? -0.32 : 0.23);
    const character = team.members[memberIndex];
    const computer = index === 3 ? monitor(interior, kit, x, screenZ, Math.PI)
      : laptop(interior, kit, x, screenZ, index === 5 ? '#334143' : '#5b6257', north ? Math.PI : 0);
    computer.userData.workstation = memberIndex;
    if (character.kind !== 'lantern') {
      const seat = chair(interior, kit, x, z, isFoyer ? '#a9855f' : palette.rug, facing);
      seat.userData.workstation = memberIndex;
      blockers.push({ bounds: [x - 0.36, z - 0.36, x + 0.36, z + 0.36], deskIndex: memberIndex });
    }
    return { position: [x, z], screen: [x, screenZ], facing,
      egress: [x, z + (north ? -1.15 : 1.2)],
      ...(character.kind === 'lantern' ? {} : { seatHeight: character.kind === 'robot' ? 0.2 : character.kind === 'owl' ? 0.45 : 0.5 }) };
  });
  const actorHomes = desks.map(({ position: [x, z] }) => new THREE.Vector3(x, OFFICE_FLOOR_Y, z));
  const actorFacing = desks.map(desk => desk.facing);
  paper(interior, kit, -1.0, tableZ + 0.06, 0.08);
  paper(interior, kit, 1.0, tableZ + 0.04, -0.2);
  mug(interior, kit, 1.12, tableZ - 0.48, index === 4 ? '#647c50' : '#a0aa8d');
  mug(interior, kit, -1.12, tableZ - 0.48, '#b7c0a4');
  if (isFoyer) ['#7a8a65', '#e0cfaa', '#bda57c'].forEach((color, i) => kit.mesh(interior, 'roundedBox', color, [-1.0, 0.825 + i * 0.057, tableZ - 0.4], [0.44, 0.055, 0.32], [0, -0.12, 0]));
  plant(interior, kit, -2.6, frontPlantZ, 1.0, 0.1, index % 2 ? '#c3b38d' : '#b7a280', 'broad');
  plant(interior, kit, 2.63, frontPlantZ, 1.18, 0.1, '#c5b998', 'spear');
  blockers.push({ bounds: [-3.2, frontPlantZ - 0.6, -2.0, frontPlantZ + 0.6] },
    { bounds: [2.24, frontPlantZ - 0.39, 3.02, frontPlantZ + 0.39] });
  const midPlant: NavigationPoint = isFoyer ? [-1.85, -2.8] : [-2.53, -0.85];
  plant(interior, kit, ...midPlant, 0.54, 0.1, '#bc976e', index % 2 ? 'leaf' : 'herb');
  blockers.push({ bounds: [midPlant[0] - 0.27, midPlant[1] - 0.27, midPlant[0] + 0.27, midPlant[1] + 0.27] });
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
    { bounds: [-2.825, 0.325, -1.475, 1.675] });
  kit.mesh(decorations.art, 'roundedBox', '#b4946e', [-2.5, 1.43, -1.05], [0.075, 0.83, 0.76]);
  kit.mesh(decorations.art, 'box', '#f0e5ce', [-2.451, 1.43, -1.05], [0.01, 0.67, 0.59]);
  kit.mesh(decorations.art, 'sphere', '#8fa17e', [-2.43, 1.46, -1.12], [0.015, 0.29, 0.28]);
  Object.values(decorations).forEach((decoration) => { tidyStaticMeshes(decoration); decoration.visible = false; root.add(decoration); });
  tidyStaticMeshes(interior);
  walls.forEach(({ root: wallRoot }) => tidyStaticMeshes(wallRoot));
  const aisleX = 2.15;
  const door: NavigationPoint = index < 3 ? [0, 3.65] : [doorX, backZ];
  const frontCross = Math.max(...desks.map(desk => desk.egress[1]), tableZ + 2.1);
  const rearCross = Math.min(...desks.map(desk => desk.egress[1]), tableZ - 2.1);
  const navigation: RoomNavigation = { floorY: OFFICE_FLOOR_Y,
    bounds: [-2.9, index < 3 ? backZ + 0.12 : backZ - 1.4, 2.9, index < 3 ? 4.9 : 4.25],
    blockers, door, lounge: [0, isFoyer ? 2.5 : index < 3 ? 2.1 : 1.7], task: [aisleX, tableZ],
    waypoints: [door, [doorX, backZ + 0.8], [aisleX, backZ + 1.05], [aisleX, rearCross], [aisleX, tableZ],
      [aisleX, frontCross], [0, frontCross], [0, index < 3 ? 4.7875 : 4.0], ...desks.map(desk => desk.egress)], desks };
  const assetSlots: Room['assetSlots'] = {
    desk: { position: [0, 0.84, tableZ + 0.3] },
    shelf: { position: isFoyer ? [-2.32, 1.27, -1.55] : [-2.26, 1.55, backZ + 0.57] },
    wall: { position: [-2.35, 2.1, 1.7], rotation: [0, Math.PI / 2, 0] },
    floor: { position: [-2.15, OFFICE_FLOOR_Y, 1.0] },
    festive: { position: [0, 3.5, backZ + 0.4] },
  };
  return { root, center, outline, decorations, actorHomes, actorFacing, navigation, assetSlots, walls };
}

export function makeCampus(kit: SceneKit): THREE.Group {
  const campus = new THREE.Group();
  const depthGain = 1.475;
  const entryShift = (OFFICE_ROW_SPACING - (6.3 + depthGain)) / 2;
  campus.name = 'One shared home';
  beveledBlock(campus, kit, '#d7c7b0', [0, -0.25, -0.65], [18.7, 0.4, 15.4 + depthGain * 2 + entryShift * 2]);
  beveledBlock(campus, kit, '#e8ddca', [0, -0.075, -0.65], [18.65, 0.18, 15.35 + depthGain * 2 + entryShift * 2]);
  beveledBlock(campus, kit, '#d2bfa4', [0, 0.044, 0], [18.3, 0.086, 2.9]);
  floorSurface(campus, '#dbceb8', [0, 0.088, 0], [18.3, 2.9], true);
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

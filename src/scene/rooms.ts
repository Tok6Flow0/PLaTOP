import * as THREE from 'three';
import type { Decoration, Team } from '../types';
import { SceneKit } from './primitives';
import { beveledBlock, board, chair, floorSurface, lamp, laptop, monitor, mug, paper, plant, rug, shelf, sign, stool, table, tidyStaticMeshes } from './environmentProps';

/** Wall roots include trim and mounted artwork so camera cutaways stay coherent. */
export interface Room {
  root: THREE.Group;
  center: THREE.Vector3;
  outline: THREE.LineLoop;
  decorations: Record<Decoration, THREE.Group>;
  actorHomes: THREE.Vector3[];
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
  const center = new THREE.Vector3((index % 3 - 1) * 6.15, 0, (Math.floor(index / 3) - 0.5) * (6.3 + depthGain));
  root.position.copy(center);
  const palette = finishes[index];
  const isFoyer = index === 4;
  const walls: Room['walls'] = [];
  const interior = new THREE.Group();
  root.add(interior);
  beveledBlock(interior, kit, '#d2bfa4', [0, -0.03, -rearExtension / 2], [6.12, 0.22, 5.9 + depthGain + rearExtension]);
  floorSurface(interior, '#dec9ac', [0, 0.087, -rearExtension / 2], [5.94, 5.7 + depthGain + rearExtension]);
  rug(interior, kit, palette.rug, 0, 0.35, isFoyer ? 4.1 : 4.55, 4.2);

  function wall(kind: 'back' | 'left' | 'right', x: number, z: number, width: number, depth: number): THREE.Group {
    const section = new THREE.Group();
    root.add(section);
    beveledBlock(section, kit, '#e6ddce', [x, 1.72, z], [width, 3.32, depth]);
    if (kind === 'back') {
      beveledBlock(section, kit, palette.wall, [x, 1.66, z + 0.105], [width - 0.18, 3.05, 0.055], 0.02);
      beveledBlock(section, kit, '#d4c4ab', [x, 0.22, z + 0.14], [width - 0.12, 0.2, 0.065], 0.02);
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
    const back = wall('back', 0, -2.88 - halfGain - rearExtension, 6.1, 0.2);
    sign(back, kit, team.name, 0, 3.1, -2.69 - halfGain - rearExtension, team.name.length > 14 ? 3.8 : 3.45);
    board(back, kit, palette.board, palette.symbol, 0, 1.84, -2.67 - halfGain - rearExtension, index === 3 ? '#315946' : '#6a6657');
    shelf(interior, kit, -2.26, -2.32 - halfGain - rearExtension, index, index % 2 === 1);
    shelf(interior, kit, 2.27, -2.31 - halfGain - rearExtension, index + 1, false);
    plant(interior, kit, -2.45, -2.22 - halfGain - rearExtension, 0.74, 1.48, '#b5aa8a');
    plant(interior, kit, -2.02, -2.2 - halfGain - rearExtension, 0.54, 1.48, '#a88e61', 'ivy');
    plant(interior, kit, 2.04, -2.24 - halfGain - rearExtension, 0.61, 1.48, '#b6a17c', 'leaf');
    plant(interior, kit, 2.28, -2.48 - halfGain - rearExtension, 0.42, 1.48, '#cbb488', 'herb');
    plant(interior, kit, 2.48, -2.21 - halfGain - rearExtension, 0.63, 1.48, '#c7b794', index % 2 ? 'herb' : 'spear');
  }
  if (index % 3 === 0) wall('left', -3.0, -0.06 - rearExtension / 2, 0.2, 5.7 + depthGain + rearExtension);
  if (index % 3 === 2) wall('right', 3.0, -0.06 - rearExtension / 2, 0.2, 5.7 + depthGain + rearExtension);
  if (!isFoyer) {
    if (index % 3 !== 0) wall('left', -3.0, -0.57 - rearExtension / 2, 0.18, 4.7 + depthGain + rearExtension);
    if (index % 3 !== 2) wall('right', 3.0, -0.57 - rearExtension / 2, 0.18, 4.7 + depthGain + rearExtension);
  } else {
    [-2.89, 2.89].forEach((x) => {
      kit.mesh(interior, 'roundedBox', '#e7dfd1', [x, 0.48, 0.48], [0.17, 0.8, 4.75 + depthGain]);
      kit.mesh(interior, 'roundedBox', '#f3ece1', [x, 0.9, 0.48], [0.22, 0.1, 4.77 + depthGain]);
    });
    shelf(interior, kit, -2.32, -1.55, 2, false, 0.82);
    shelf(interior, kit, 2.32, -1.55, 4, false, 0.82);
    plant(interior, kit, -2.32, -1.56, 0.58, 1.25, '#d0c4a6', 'ivy');
    plant(interior, kit, 2.32, -1.56, 0.5, 1.25, '#b89c74', 'spear');
    for (const x of [-1.8, 0, 1.8]) plant(interior, kit, x, -2.35, x === 0 ? 0.61 : 0.7, 0.1, '#c7b896', x === 0 ? 'herb' : 'leaf');
  }

  const tableZ = isFoyer ? 0.95 : index < 3 ? -0.95 : -0.1;
  const tableWidth = index === 3 ? 2.95 : index === 5 ? 3.0 : 3.15;
  table(interior, kit, 0, tableZ, tableWidth, 1.34);
  stool(interior, kit, 0, tableZ + 1.25, isFoyer ? '#a9855f' : palette.rug);
  if (index === 3) monitor(interior, kit, -0.86, tableZ - 0.19, 0.46);
  else laptop(interior, kit, 0.13, tableZ - 0.16, index === 5 ? '#334143' : '#5b6257', 0.04);
  paper(interior, kit, -1.12, tableZ + 0.13, 0.08);
  paper(interior, kit, 1.16, tableZ + 0.2, -0.2);
  mug(interior, kit, 0.93, tableZ - 0.34, index === 4 ? '#647c50' : '#a0aa8d');
  mug(interior, kit, -0.78, tableZ - 0.31, '#b7c0a4');
  if (index === 2) laptop(interior, kit, -0.9, tableZ + 0.17, '#36454d', -0.15);
  if (isFoyer) ['#7a8a65', '#e0cfaa', '#bda57c'].forEach((color, i) => kit.mesh(interior, 'roundedBox', color, [-1.1, 0.825 + i * 0.057, tableZ - 0.2], [0.6, 0.055, 0.43], [0, -0.12, 0]));
  const actorHomes = team.members.length === 1
    ? [new THREE.Vector3(0, 0.1, tableZ - 1.18)]
    : team.members.length === 2
      ? [new THREE.Vector3(-0.83, 0.1, tableZ - 1.22), new THREE.Vector3(1.33, 0.1, tableZ - 1.05)]
      : team.members.length === 4
        ? [new THREE.Vector3(-1.64, 0.1, tableZ - 1.13), new THREE.Vector3(1.57, 0.1, tableZ - 1.13), new THREE.Vector3(-1.65, 0.1, tableZ + 1.04), new THREE.Vector3(1.65, 0.1, tableZ + 1.04)]
        : [new THREE.Vector3(-1.78, 0.1, tableZ + 0.52), new THREE.Vector3(0, 0.1, tableZ - 1.14), new THREE.Vector3(1.78, 0.1, tableZ + 0.52)];
  actorHomes.forEach((home, i) => { if (team.members.length > 1 && i !== 1) stool(interior, kit, home.x, home.z, palette.rug); });
  if (index === 3 || index === 5) chair(interior, kit, 1.9, tableZ + 0.7, index === 3 ? '#a38461' : '#657583', -0.22);
  plant(interior, kit, -2.6, (isFoyer ? 2.18 : 1.92) + halfGain, 1.0, 0.1, index % 2 ? '#c3b38d' : '#b7a280', 'broad');
  plant(interior, kit, 2.63, (isFoyer ? 2.18 : 1.93) + halfGain, 1.18, 0.1, '#c5b998', 'spear');
  plant(interior, kit, -2.53, -0.85, 0.54, 0.1, '#bc976e', index % 2 ? 'leaf' : 'herb');
  if (index >= 3 && index !== 4) lamp(interior, kit, -2.12, -0.38, index);
  if (index === 3) plant(interior, kit, 2.05, -0.55, 0.55, 0.75, '#c3b9a2', 'herb');
  if (index >= 3 && !isFoyer) {
    kit.mesh(interior, 'roundedBox', '#e8dfd0', [0, 0.3, 2.86 + halfGain], [5.95, 0.44, 0.2]);
    kit.mesh(interior, 'roundedBox', '#f1e9dd', [0, 0.54, 2.86 + halfGain], [6.0, 0.085, 0.23]);
  }
  const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-2.96, 0.11, -2.8 - halfGain - rearExtension), new THREE.Vector3(2.96, 0.11, -2.8 - halfGain - rearExtension),
    new THREE.Vector3(2.96, 0.11, 2.79 + halfGain), new THREE.Vector3(-2.96, 0.11, 2.79 + halfGain)
  ]), new THREE.LineBasicMaterial({ color: '#7f9987', transparent: true, opacity: 0.32 }));
  outline.visible = false; root.add(outline);
  const decorations: Room['decorations'] = { plant: new THREE.Group(), lamp: new THREE.Group(), art: new THREE.Group() };
  plant(decorations.plant, kit, 2.15, 0.1, 0.78, 0.1, '#c59c75');
  lamp(decorations.lamp, kit, 2.1, -0.65, index + 7);
  kit.mesh(decorations.art, 'roundedBox', '#b4946e', [-2.5, 1.43, -1.05], [0.075, 0.83, 0.76]);
  kit.mesh(decorations.art, 'box', '#f0e5ce', [-2.451, 1.43, -1.05], [0.01, 0.67, 0.59]);
  kit.mesh(decorations.art, 'sphere', '#8fa17e', [-2.43, 1.46, -1.12], [0.015, 0.29, 0.28]);
  Object.values(decorations).forEach((decoration) => { tidyStaticMeshes(decoration); decoration.visible = false; root.add(decoration); });
  tidyStaticMeshes(interior);
  walls.forEach(({ root: wallRoot }) => tidyStaticMeshes(wallRoot));
  return { root, center, outline, decorations, actorHomes, walls };
}

export function makeCampus(kit: SceneKit): THREE.Group {
  const campus = new THREE.Group();
  const depthGain = 1.475;
  campus.name = 'One shared home';
  beveledBlock(campus, kit, '#d7c7b0', [0, -0.25, -0.9], [18.7, 0.4, 14.9 + depthGain * 2]);
  beveledBlock(campus, kit, '#e8ddca', [0, -0.075, -0.9], [18.65, 0.18, 14.85 + depthGain * 2]);
  floorSurface(campus, '#dbceb8', [0, 0.03, 0], [18.3, 0.62], true);
  kit.mesh(campus, 'roundedBox', '#d4c2a8', [0, -0.15, 6.9 + depthGain], [6.15, 0.33, 1.8]);
  floorSurface(campus, '#cec7b9', [0, 0.03, 6.85 + depthGain], [5.85, 1.85], true);
  [-2.98, 2.98].forEach((x) => {
    kit.mesh(campus, 'roundedBox', '#e7dfd0', [x, 0.32, 6.75 + depthGain], [0.2, 0.65, 1.9]);
    kit.mesh(campus, 'roundedBox', '#f0e8dc', [x, 0.67, 6.75 + depthGain], [0.24, 0.1, 1.95]);
  });
  kit.mesh(campus, 'roundedBox', '#d5c8b2', [0, -0.29, 7.91 + depthGain], [6.2, 0.14, 0.44]);
  kit.mesh(campus, 'roundedBox', '#e1d4bf', [0, -0.34, 8.15 + depthGain], [6.3, 0.12, 0.35]);
  rug(campus, kit, '#b99c77', 0, 6.83 + depthGain, 2.43, 1.43, ['Same', 'Curiosity', 'Further', 'Together']);
  for (const side of [-1, 1]) {
    const x = side * 6.2;
    const bench = new THREE.Group(); bench.position.set(x, 0, 6.62 + depthGain); campus.add(bench);
    kit.mesh(bench, 'roundedBox', '#b59065', [0, 0.49, 0], [3.7, 0.2, 0.85]);
    for (const legX of [-1.45, 1.45]) kit.mesh(bench, 'roundedBox', '#9b7a52', [legX, 0.2, 0], [0.13, 0.48, 0.65]);
    sign(bench, kit, side < 0 ? 'A quieter, kinder internet.' : 'Built by good people (and AI).', 0, 0.602, 0, 3.24, true, '#b59065', '#493e2d');
    plant(campus, kit, x - 2.05, 6.54 + depthGain, 0.72, 0.02, '#c4af89', 'herb');
    plant(campus, kit, x + 2.05, 6.54 + depthGain, 1.16, 0.02, '#b79d72');
  }
  [-2.35, 2.35].forEach((x) => plant(campus, kit, x, 5.8 + depthGain, 1.05, 0.1, '#d5c8aa'));
  tidyStaticMeshes(campus);
  return campus;
}

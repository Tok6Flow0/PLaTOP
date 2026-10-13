import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SceneKit } from './primitives';

type Point = [number, number, number];
export type RoomSurface = 'wall' | 'rug' | 'furniture';
const surfaceCodes: Record<RoomSurface, number> = { wall: 1, rug: 2, furniture: 3 };
function surface(mesh: THREE.Mesh, role: RoomSurface): THREE.Mesh { mesh.userData.roomSurface = role; return mesh; }
function floorContact(parent: THREE.Object3D, x: number, y: number, z: number, width: number, depth: number): void {
  (parent.userData.floorContacts ??= []).push([x, y, z, width, depth]);
}
/** Keep masonry bevels at a physical scale rather than stretching a unit cube's corners. */
export function beveledBlock(parent: THREE.Object3D, kit: SceneKit, color: string, position: Point, size: Point, radius = 0.035): THREE.Mesh {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(size[0], size[1], size[2], 2, Math.min(radius, ...size.map((dimension) => dimension * 0.46))), kit.material(color));
  mesh.position.set(...position); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function canvasTexture(width: number, height: number, paint: (context: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d'); if (context) paint(context);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return texture;
}
function texturedPlane(parent: THREE.Object3D, texture: THREE.Texture, position: Point, width: number, height: number, horizontal = false): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material); mesh.position.set(...position);
  if (horizontal) mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
export function floorSurface(parent: THREE.Object3D, color: string, position: Point, size: [number, number], tile = false): void {
  const texture = canvasTexture(512, 512, (context) => {
    context.fillStyle = color; context.fillRect(0, 0, 512, 512);
    let seed = 2121;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    if (!tile) {
      const timber = new THREE.Color(color);
      for (let row = 0; row < 10; row++) for (let column = -1; column < 4; column++) {
        const x = column * 171 + (row % 2) * 85, y = row * 51.2;
        context.fillStyle = timber.clone().multiplyScalar(0.93 + random() * 0.105).getStyle();
        context.fillRect(x, y, 171, 51.2);
        for (let line = 0; line < 7; line++) {
          const grainY = y + 4 + line * 6.2, curl = random() * 2.4;
          context.strokeStyle = line % 3 ? 'rgba(116,80,43,.045)' : 'rgba(255,237,193,.15)'; context.lineWidth = 0.6;
          context.beginPath(); context.moveTo(x, grainY); context.bezierCurveTo(x + 45, grainY + curl, x + 112, grainY - curl, x + 171, grainY); context.stroke();
        }
      }
    }
    for (let i = 0; i < 2300; i++) {
      context.fillStyle = i % 2 ? 'rgba(90,66,39,.035)' : 'rgba(255,255,255,.07)';
      context.fillRect(random() * 512, random() * 512, random() * 10 + 1, 0.7);
    }
    context.lineWidth = 1.2; context.strokeStyle = 'rgba(99,77,52,.16)';
    const rows = tile ? 4 : 10;
    for (let row = 0; row <= rows; row++) {
      const y = row * 512 / rows;
      context.beginPath(); context.moveTo(0, y); context.lineTo(512, y); context.stroke();
      for (let column = 0; column < (tile ? 5 : 4); column++) {
        const x = tile ? column * 128 : column * 171 + (row % 2) * 85;
        context.beginPath(); context.moveTo(x, y); context.lineTo(x, y + 512 / rows); context.stroke();
      }
    }
    if (!tile) {
      // Baked ambient contact along the masonry keeps still rooms softly grounded.
      // This local texture costs no extra render passes or realtime light sources.
      const back = context.createLinearGradient(0, 0, 0, 130);
      back.addColorStop(0, 'rgba(70,53,33,.24)'); back.addColorStop(0.34, 'rgba(85,66,43,.10)'); back.addColorStop(1, 'rgba(85,66,43,0)');
      context.fillStyle = back; context.fillRect(0, 0, 512, 140);
      for (const side of [0, 512]) {
        const edge = context.createLinearGradient(side, 0, side === 0 ? 75 : 437, 0);
        edge.addColorStop(0, 'rgba(78,61,40,.17)'); edge.addColorStop(1, 'rgba(78,61,40,0)');
        context.fillStyle = edge; context.fillRect(side === 0 ? 0 : 437, 0, 75, 512);
        const corner = context.createRadialGradient(side, 0, 1, side, 0, 125);
        corner.addColorStop(0, 'rgba(59,46,28,.14)'); corner.addColorStop(1, 'rgba(59,46,28,0)');
        context.fillStyle = corner; context.fillRect(side === 0 ? 0 : 387, 0, 125, 125);
      }
    }
  });
  if (tile) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(size[0] / 2, size[1] / 2);
  }
  texturedPlane(parent, texture, position, size[0], size[1], true);
}
export function rug(parent: THREE.Object3D, kit: SceneKit, color: string, x: number, z: number, width: number, depth: number, words?: string[]): void {
  const outline = (w: number, d: number, radius: number) => {
    const shape = new THREE.Shape(), left = -w / 2, right = w / 2, bottom = -d / 2, top = d / 2;
    shape.moveTo(left + radius, bottom); shape.lineTo(right - radius, bottom);
    shape.quadraticCurveTo(right, bottom, right, bottom + radius); shape.lineTo(right, top - radius);
    shape.quadraticCurveTo(right, top, right - radius, top); shape.lineTo(left + radius, top);
    shape.quadraticCurveTo(left, top, left, top - radius); shape.lineTo(left, bottom + radius);
    shape.quadraticCurveTo(left, bottom, left + radius, bottom); return shape;
  };
  const pile = new THREE.ExtrudeGeometry(outline(width, depth, .30), {depth:.035,bevelEnabled:false,curveSegments:8});
  const base = new THREE.Mesh(pile, kit.material(color, 'fabric')); base.rotation.x = -Math.PI / 2;
  base.position.set(x,.0935,z); base.receiveShadow = true; parent.add(base); surface(base,'rug');
  const texture = canvasTexture(512, 512, (context) => {
    context.fillStyle = color; context.fillRect(0, 0, 512, 512);
    context.strokeStyle = 'rgba(255,245,214,.12)'; context.lineWidth = 1;
    for (let p = 0; p < 512; p += 3) {
      context.beginPath(); context.moveTo(0, p); context.lineTo(512, p); context.stroke();
      context.beginPath(); context.moveTo(p, 0); context.lineTo(p, 512); context.stroke();
    }
    context.strokeStyle = 'rgba(62,56,41,.22)'; context.lineWidth = 3; context.strokeRect(14, 14, 484, 484);
    for (let i = 0; i < 1800; i++) {
      context.fillStyle = i % 3 ? 'rgba(255,242,211,.065)' : 'rgba(55,48,34,.06)';
      context.fillRect((i * 193) % 512, (i * 83) % 512, 1.3, 2.3);
    }
    const edgeShade = context.createRadialGradient(256, 190, 40, 256, 256, 345);
    edgeShade.addColorStop(0, 'rgba(255,238,195,.035)'); edgeShade.addColorStop(0.55, 'rgba(64,54,34,0)'); edgeShade.addColorStop(1, 'rgba(64,54,34,.13)');
    context.fillStyle = edgeShade; context.fillRect(0, 0, 512, 512);
    if (words) { context.fillStyle = '#4e4c37'; context.font = '38px Georgia, serif'; context.textAlign = 'center'; words.forEach((word, i) => context.fillText(word, 256, 136 + i * 69)); }
  });
  const weave = surface(texturedPlane(parent, texture, [x, 0.13, z], width - 0.11, depth - 0.11, true), 'rug');
  weave.geometry.dispose();
  weave.geometry = new THREE.ShapeGeometry(outline(width - .11, depth - .11, .25), 8);
  const points = weave.geometry.getAttribute('position'), uv = weave.geometry.getAttribute('uv');
  for (let i=0;i<points.count;i++) uv.setXY(i,points.getX(i)/(width-.11)+.5,points.getY(i)/(depth-.11)+.5);
  (weave.material as THREE.MeshStandardMaterial).roughness = 0.98;
  (weave.material as THREE.MeshStandardMaterial).envMapIntensity = 0.2;
}
export function sign(parent: THREE.Object3D, kit: SceneKit, text: string, x: number, y: number, z: number, width: number, horizontal = false, background = '#34423b', foreground = '#faf4e8'): void {
  if (!horizontal) kit.mesh(parent, 'roundedBox', '#26362f', [x, y, z], [width + 0.07, 0.73, 0.15]);
  const texture = canvasTexture(1024, 206, (context) => {
    context.fillStyle = background; context.fillRect(0, 0, 1024, 206);
    const gradient = context.createLinearGradient(0, 0, 0, 206); gradient.addColorStop(0, 'rgba(255,255,255,.065)'); gradient.addColorStop(1, 'rgba(0,0,0,.04)');
    context.fillStyle = gradient; context.fillRect(0, 0, 1024, 206); context.fillStyle = foreground;
    context.font = horizontal ? 'italic 66px Georgia, serif' : '600 97px system-ui, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 512, 108, 956);
  });
  texturedPlane(parent, texture, [x, y, z + (horizontal ? 0 : 0.082)], width, horizontal ? 0.57 : 0.67, horizontal);
}
function drawSymbol(context: CanvasRenderingContext2D, symbol: string): void {
  context.save(); context.translate(666, 172); context.strokeStyle = '#667b5f'; context.lineWidth = 5; context.lineCap = 'round'; context.lineJoin = 'round'; context.beginPath();
  if (symbol === 'envelope') { context.rect(-58, -24, 114, 78); context.moveTo(-58, -24); context.lineTo(0, 22); context.lineTo(56, -24); }
  else if (symbol === 'mountain') { context.moveTo(-65, 53); context.lineTo(-22, -23); context.lineTo(7, 22); context.lineTo(30, -7); context.lineTo(66, 53); context.closePath(); }
  else if (symbol === 'chat') { context.ellipse(0, 4, 58, 48, 0, 0.4, Math.PI * 2.13); context.lineTo(-49, 64); context.lineTo(-34, 35); context.moveTo(-20, -10); context.quadraticCurveTo(-25, 30, 26, 29); }
  else if (symbol === 'heart') { context.moveTo(0, 40); context.bezierCurveTo(-92, -17, -41, -68, 0, -21); context.bezierCurveTo(44, -68, 92, -17, 0, 40); }
  else { context.moveTo(0, 58); context.quadraticCurveTo(15, 14, 6, -20); context.moveTo(8, 16); context.bezierCurveTo(72, 20, 58, -43, 8, 16); context.moveTo(5, 7); context.bezierCurveTo(-53, 11, -52, -44, 5, 7); }
  context.stroke(); context.restore();
}
export function board(parent: THREE.Object3D, kit: SceneKit, lines: string[], symbol: string, x: number, y: number, z: number, textColor: string): void {
  kit.mesh(parent, 'roundedBox', '#ac9474', [x, y, z], [2.69, 1.72, 0.105]);
  const texture = canvasTexture(800, 360, (context) => {
    context.fillStyle = '#e9e4d7'; context.fillRect(0, 0, 800, 360); context.fillStyle = 'rgba(122,112,91,.13)'; context.fillRect(18, 17, 764, 3);
    context.fillStyle = textColor; context.font = 'italic 43px Georgia, serif'; lines.forEach((line, i) => context.fillText(line, 76, 93 + i * 75, 485)); drawSymbol(context, symbol);
    context.fillStyle = '#bfb5a3'; for (const px of [23, 777]) for (const py of [23, 337]) { context.beginPath(); context.arc(px, py, 4, 0, Math.PI * 2); context.fill(); }
  });
  texturedPlane(parent, texture, [x, y, z + 0.059], 2.55, 1.57);
  kit.mesh(parent, 'box', '#d9c9ac', [x, y - 0.85, z + 0.08], [2.65, 0.065, 0.16]);
  kit.mesh(parent, 'cylinder', '#748575', [x + 0.68, y - 0.81, z + 0.09], [0.045, 0.39, 0.045], [0, 0, Math.PI / 2]);
}
export function table(parent: THREE.Object3D, kit: SceneKit, x: number, z: number, width: number, depth: number): void {
  surface(kit.mesh(parent, 'roundedBox', '#a77e53', [x, 0.7, z], [width, 0.2, depth], undefined, 'wood'), 'furniture');
  surface(kit.mesh(parent, 'roundedBox', '#b18b60', [x, 0.804, z], [width - 0.07, 0.025, depth - 0.07], undefined, 'wood'), 'furniture');
  for (const dx of [-width / 2 + 0.27, width / 2 - 0.27]) for (const dz of [-depth / 2 + 0.25, depth / 2 - 0.25]) surface(kit.mesh(parent, 'roundedDetail', '#9e7d52', [x + dx, 0.38, z + dz], [0.15, 0.64, 0.15], [0, 0, dx < 0 ? 0.045 : -0.045], 'wood'), 'furniture');
  for (const dx of [-width / 2 + 0.27, width / 2 - 0.27]) for (const dz of [-depth / 2 + 0.25, depth / 2 - 0.25]) floorContact(parent, x + dx, 0.137, z + dz, 0.44, 0.38);
  const grain = canvasTexture(768, 384, (context) => {
    context.beginPath(); context.roundRect(0, 0, 768, 384, 54); context.clip();
    context.fillStyle = '#ad8055'; context.fillRect(0, 0, 768, 384);
    for (let i = 0; i < 160; i++) {
      const y = i * 2.48, phase = i * 3.7;
      context.strokeStyle = i % 3 ? 'rgba(91,56,28,.09)' : 'rgba(237,206,153,.16)'; context.lineWidth = i % 4 ? 0.8 : 1.4;
      context.beginPath(); context.moveTo(0, y); context.bezierCurveTo(180, y + Math.sin(phase) * 5, 450, y + Math.cos(phase) * 8, 768, y + Math.sin(phase + 1) * 4); context.stroke();
    }
  });
  const top = texturedPlane(parent, grain, [x, 0.82, z], width - 0.16, depth - 0.14, true);
  (top.material as THREE.MeshStandardMaterial).alphaTest = 0.3;
  (top.material as THREE.MeshStandardMaterial).roughness = 0.68;
  (top.material as THREE.MeshStandardMaterial).envMapIntensity = 0.65;
  surface(top, 'furniture');
}
export function stool(parent: THREE.Object3D, kit: SceneKit, x: number, z: number, color: string): void {
  surface(kit.mesh(parent, 'cylinder', '#a08055', [x, 0.51, z], [0.68, 0.12, 0.68], undefined, 'wood'), 'furniture');
  kit.mesh(parent, 'sphere', color, [x, 0.575, z], [0.68, 0.16, 0.68], undefined, 'fabric');
  for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) surface(kit.mesh(parent, 'roundedDetail', '#9d7c52', [x + Math.sin(angle) * 0.2, 0.29, z + Math.cos(angle) * 0.2], [0.085, 0.45, 0.085], undefined, 'wood'), 'furniture');
}
export function chair(parent: THREE.Object3D, kit: SceneKit, x: number, z: number, color: string, angle = 0): THREE.Group {
  const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = angle; parent.add(group);
  group.name = 'Desk chair';
  stool(group, kit, 0, 0, color);
  [-0.27, 0.27].forEach((dx) => surface(kit.mesh(group, 'roundedDetail', '#96714c', [dx, 0.79, -0.23], [0.075, 0.55, 0.075], undefined, 'wood'), 'furniture'));
  const backGeometry = new RoundedBoxGeometry(.65,.53,.15,3,.07);
  const positions = backGeometry.getAttribute('position');
  for(let i=0;i<positions.count;i++) positions.setZ(i,positions.getZ(i)+positions.getX(i)**2*.18);
  backGeometry.computeVertexNormals();
  const back = new THREE.Mesh(backGeometry,kit.material(color,'fabric')); back.position.set(0,1.02,-.25); back.rotation.x=.1;
  back.castShadow=back.receiveShadow=true;group.add(back);
  return group;
}
export function laptop(parent: THREE.Object3D, kit: SceneKit, x: number, z: number, color: string, angle = 0): THREE.Group {
  const group = new THREE.Group(); group.position.set(x, 0.836, z); group.rotation.y = angle; parent.add(group);
  group.name = 'Workstation laptop';
  const casing = `#${new THREE.Color(color).lerp(new THREE.Color('#3b3d3b'), 0.65).getHexString()}`;
  beveledBlock(group, kit, casing, [0, 0.02, 0.09], [0.72, 0.04, 0.48], 0.014);
  keyboard(group, kit, '#343b35', [0, 0.043, 0.035], 0.55, 0.205, true);
  // The glass and its content share the shell's hinge transform. Separate
  // world-space offsets made the bottom lines float off a tilted screen.
  const display = new THREE.Group(); display.name = 'Laptop display'; display.position.set(0, 0.25, -0.14); display.rotation.x = -0.14; group.add(display);
  beveledBlock(display, kit, casing, [0, 0, 0], [0.72, 0.46, 0.04], 0.016);
  beveledBlock(display, kit, '#62786f', [0, 0.008, 0.023], [0.636, 0.378, 0.006], 0.002);
  kit.mesh(display, 'box', '#bed0b9', [-0.12, 0.052, 0.027], [0.23, 0.011, 0.001]);
  kit.mesh(display, 'box', '#a0b7a6', [-0.06, 0, 0.027], [0.35, 0.011, 0.001]);
  kit.mesh(display, 'box', '#a0b7a6', [-0.095, -0.052, 0.027], [0.29, 0.011, 0.001]);
  return group;
}
/** Raised keycaps and trackpad remain one mesh and one existing matte batch. */
function keyboard(parent: THREE.Object3D, kit: SceneKit, color: string, position: Point, width: number, depth: number, trackpad: boolean): void {
  const parts: THREE.BufferGeometry[] = [];
  for (let row = 0; row < 3; row++) for (let column = 0; column < 10; column++) {
    const key = new THREE.BoxGeometry(width / 10 - 0.012, 0.006, depth / 3 - 0.014);
    key.translate((column - 4.5) * width / 10, 0, (row - 1) * depth / 3); parts.push(key);
  }
  if (trackpad) {
    const pad = new THREE.BoxGeometry(width * 0.31, 0.003, depth * 0.45);
    pad.translate(0, -0.002, depth * 0.83); parts.push(pad);
  }
  const geometry = mergeGeometries(parts, false)!; parts.forEach(part => part.dispose());
  const mesh = new THREE.Mesh(geometry, kit.material(color));
  mesh.position.set(...position); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh);
}
export function monitor(parent: THREE.Object3D, kit: SceneKit, x: number, z: number, angle = 0): THREE.Group {
  const group = new THREE.Group(); group.position.set(x, 0.836, z); group.rotation.y = angle; parent.add(group);
  group.name = 'Workstation monitor';
  beveledBlock(group, kit, '#424c42', [0, 0.035, 0.01], [0.42, 0.055, 0.27], 0.017);
  kit.mesh(group, 'roundedBox', '#424c42', [0, 0.18, -0.02], [0.075, 0.31, 0.075]);
  beveledBlock(group, kit, '#334039', [0, 0.5, -0.03], [0.96, 0.66, 0.08], 0.032);
  beveledBlock(group, kit, '#60736a', [0, 0.51, 0.014], [0.852, 0.55, 0.008], 0.003);
  beveledBlock(group, kit, '#d3d5bb', [0.12, 0.026, 0.36], [0.73, 0.035, 0.24], 0.012);
  keyboard(group, kit, '#a0a78c', [0.12, 0.047, 0.36], 0.6, 0.18, false);
  kit.mesh(group, 'sphere', '#d3d5bb', [0.61, 0.035, 0.34], [0.12, 0.06, 0.18]);
  return group;
}
export function paper(parent: THREE.Object3D, kit: SceneKit, x: number, z: number, angle: number): void {
  const group = new THREE.Group(); group.position.set(x, 0.836, z); group.rotation.y = angle; parent.add(group);
  kit.mesh(group, 'roundedDetail', '#a99474', [0, 0.002, 0], [0.46, 0.013, 0.59]); kit.mesh(group, 'box', '#f4eddb', [0, 0.015, 0], [0.42, 0.009, 0.54]);
  for (let i = 0; i < 4; i++) kit.mesh(group, 'box', '#a6a798', [-0.015, 0.021, -0.15 + i * 0.07], [0.26 - i % 2 * 0.04, 0.003, 0.009]);
  kit.mesh(group, 'cylinder', '#8a9b76', [0.21, 0.029, 0.05], [0.025, 0.47, 0.025], [Math.PI / 2, 0, 0.12]);
}
export function mug(parent: THREE.Object3D, kit: SceneKit, x: number, z: number, color: string): void {
  kit.mesh(parent, 'pot', color, [x, 0.945, z], [0.24, 0.24, 0.24], undefined, 'ceramic'); kit.mesh(parent, 'cylinder', '#4b4433', [x, 1.067, z], [0.185, 0.006, 0.185]);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.026, 8, 16), kit.material(color, 'ceramic')); handle.position.set(x + 0.15, 0.95, z); handle.castShadow = true; parent.add(handle);
}
export function shelf(parent: THREE.Object3D, kit: SceneKit, x: number, z: number, variant: number, cupboard: boolean, scale = 1): void {
  if (scale !== 1) { const group = new THREE.Group(); group.position.set(x, 0, z); group.scale.setScalar(scale); parent.add(group); parent = group; x = z = 0; }
  floorContact(parent, x, 0.105 / scale, z + 0.04, 1.15, 0.82);
  const height = 1.43;
  // A real open carcass, with the dark backing behind the books rather than across their spines.
  for (const dx of [-0.48, 0.48]) surface(beveledBlock(parent, kit, '#98744f', [x + dx, height / 2 + 0.1, z], [0.09, height, 0.67], 0.02), 'furniture');
  surface(kit.mesh(parent, 'box', '#473a28', [x, height / 2 + 0.1, z - 0.3], [0.91, height - 0.1, 0.055], undefined, 'wood'), 'furniture');
  for (const y of [0.2, 0.62, 1.04, 1.5]) surface(kit.mesh(parent, 'roundedBox', '#b18a5e', [x, y, z + 0.04], [1.09, 0.08, 0.75], undefined, 'wood'), 'furniture');
  if (cupboard) {
    surface(kit.mesh(parent, 'roundedBox', '#9f8861', [x, 0.86, z + 0.396], [0.91, 1.18, 0.055], undefined, 'wood'), 'furniture'); surface(kit.mesh(parent, 'box', '#967f5a', [x, 0.86, z + 0.43], [0.02, 1.1, 0.013], undefined, 'wood'), 'furniture');
    [-0.085, 0.085].forEach((dx) => kit.mesh(parent, 'detailSphere', '#ccba8c', [x + dx, 0.88, z + 0.46], [0.045, 0.045, 0.045]));
  } else {
    const colors = ['#526847', '#dfcfa3', '#516a69', '#9c6242', '#c1ba9e'];
    for (let level = 0; level < 3; level++) for (let book = 0; book < 4; book++) {
      const bookHeight = 0.24 + ((book + level + variant) % 3) * 0.035;
      kit.mesh(parent, 'roundedDetail', colors[(book + level + variant) % colors.length], [x - 0.31 + book * 0.15, 0.25 + level * 0.42 + bookHeight / 2, z + 0.2], [0.12, bookHeight, 0.28], [0, 0, book === 3 ? -0.08 : 0]);
      kit.mesh(parent, 'box', '#e8dab7', [x - 0.31 + book * 0.15, 0.31 + level * 0.42, z + 0.348], [0.074, 0.014, 0.003]);
    }
    for (let level = 0; level < 2; level++) for (let book = 0; book < 3; book++) kit.mesh(parent, 'roundedDetail', book % 2 ? '#e4d7b4' : '#73816b', [x + 0.31, 0.27 + level * 0.42 + book * 0.05, z + 0.19], [0.23, 0.045, 0.31], [0, book * 0.07, 0]);
  }
}
export function leafGeometry(spear: boolean, herb: boolean, broad: boolean): THREE.BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const vertex = (t: number, across: number): Point => {
    const width = Math.pow(Math.sin(Math.PI * t), spear ? 0.65 : broad ? 0.65 : 0.72) * (spear ? 0.06 : herb ? 0.15 : broad ? 0.22 : 0.17), bend = Math.sin(t * 1.7) * (spear ? 0.14 : herb ? 0.24 : broad ? 0.29 : 0.36);
    const length = herb ? 0.53 : broad ? 0.68 : 0.93;
    const cup = Math.sin(Math.PI * t) * (1 - across * across);
    return [width * across, t * length + 0.012 * cup, bend - 0.035 * cup];
  };
  // Five shared ribs describe a soft cup instead of a folded-paper crease.
  // Each pointed end is one vertex, avoiding zero-area triangles and split
  // tip normals. The entire leaf is still only 37 vertices / 56 triangles.
  positions.push(...vertex(0, 0)); uvs.push(0.5, 0);
  for (let row = 1; row < 8; row++) for (let column = 0; column < 5; column++) {
    positions.push(...vertex(row / 8, column / 2 - 1)); uvs.push(column / 4, row / 8);
  }
  positions.push(...vertex(1, 0)); uvs.push(0.5, 1);
  for (let side = 0; side < 4; side++) indices.push(0, 1 + side, 2 + side);
  for (let row = 0; row < 6; row++) for (let side = 0; side < 4; side++) {
    const first = 1 + row * 5 + side, next = first + 5;
    indices.push(first, next, next + 1, first, next + 1, first + 1);
  }
  for (let side = 0; side < 4; side++) indices.push(31 + side, 36, 32 + side);
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
export function plant(parent: THREE.Object3D, kit: SceneKit, x: number, z: number, size: number, base = 0.1, potColor = '#bca581', kind: 'leaf' | 'spear' | 'herb' | 'broad' | 'ivy' = 'leaf'): void {
  const group = new THREE.Group(); group.position.set(x, base, z); group.scale.setScalar(size); parent.add(group);
  if (base <= 0.12) floorContact(group, 0, 0.006 / size, 0, 0.57, 0.57);
  kit.mesh(group, 'pot', potColor, [0, 0.19, 0], [0.44, 0.38, 0.44], undefined, 'ceramic'); kit.mesh(group, 'cylinder', potColor, [0, 0.378, 0], [0.47, 0.06, 0.47], undefined, 'ceramic'); kit.mesh(group, 'cylinder', '#655941', [0, 0.414, 0], [0.37, 0.008, 0.37]);
  const shades = ['#69834b', '#507140', '#7b9254'];
  if (kind === 'ivy') {
    for (const vine of [-1, 1]) for (let step = 0; step < 7; step++) {
      const vineX = vine * 0.1 + Math.sin(step * 0.7) * 0.07, vineY = 0.45 - step * 0.105, vineZ = 0.17 + step * 0.045;
      kit.mesh(group, 'detailCylinder', '#637447', [vineX, vineY, vineZ], [0.018, 0.14, 0.018], [0.35, 0, 0]);
      kit.mesh(group, 'detailSphere', shades[step % 3], [vineX + vine * 0.09, vineY, vineZ + 0.035], [0.25, 0.065, 0.19], [0.45, vine * 0.4, vine * 0.3]);
    }
    return;
  }
  kit.mesh(group, 'cylinder', '#627b47', [0, 0.85, 0], [0.033, 0.9, 0.033]);
  const geometry = leafGeometry(kind === 'spear', kind === 'herb', kind === 'broad');
  for (let i = 0; i < (kind === 'spear' ? 9 : kind === 'herb' ? 13 : 11); i++) {
    const material = kit.material(shades[i % shades.length]); material.side = THREE.DoubleSide;
    const leaf = new THREE.Mesh(geometry, material), rotation = i * 2.399, origin = kind === 'spear' ? 0.42 : 0.46 + i % 4 * (kind === 'herb' ? 0.07 : kind === 'broad' ? 0.24 : 0.17);
    leaf.position.set(Math.sin(rotation) * 0.035, origin, Math.cos(rotation) * 0.035); leaf.rotation.set(i % 2 * 0.1, rotation, (i % 3 - 1) * 0.15); leaf.scale.setScalar(0.62 + i % 4 * 0.17); leaf.castShadow = true; leaf.receiveShadow = true; group.add(leaf);
  }
}
export function lamp(parent: THREE.Object3D, kit: SceneKit, x: number, z: number, variant = 0): void {
  const metal = '#6a6b4c';
  kit.mesh(parent, 'cylinder', metal, [x, 0.16, z], [0.52, 0.09, 0.52]); kit.mesh(parent, 'cylinder', metal, [x, 0.92, z], [0.055, 1.52, 0.055]);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.39, 0.44, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#e5cd98', roughness: 0.9, side: THREE.DoubleSide, emissive: '#efb450', emissiveIntensity: 0.6 })); shade.position.set(x, 1.77, z); shade.castShadow = true; parent.add(shade);
  kit.mesh(parent, 'sphere', '#f7dc9f', [x, 1.68, z], [0.16, 0.2, 0.16]);
  const glow = new THREE.PointLight('#ffd08b', 0.8, 3.6, 2); glow.name = `warm-desk-lamp-${variant}`; glow.position.set(x, 1.57, z); parent.add(glow);
  const haloTexture = canvasTexture(64, 64, (context) => {
    const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 31); gradient.addColorStop(0, 'rgba(255,205,101,.35)'); gradient.addColorStop(0.42, 'rgba(255,208,128,.13)'); gradient.addColorStop(1, 'rgba(255,211,138,0)'); context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.95 })); halo.position.set(x, 1.65, z); halo.scale.set(1.8, 1.8, 1); parent.add(halo);
  const bounce = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.8), new THREE.MeshBasicMaterial({ map: haloTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.65 }));
  bounce.position.set(x, 0.136, z + 0.12); bounce.rotation.x = -Math.PI / 2; parent.add(bounce);
}
/**
 * Bake compatible matte surface colours into vertices, then merge each static root.
 * A green leaf and a brown shelf need the same shader: separate colour uniforms
 * were needlessly costing a draw call per colour. Textures, cutaway wall roots,
 * transparency, emissive finishes and shadow behaviour remain independent.
 */
export function tidyStaticMeshes(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inverseRoot = root.matrixWorld.clone().invert();
  const groups = new Map<string, { material: THREE.MeshStandardMaterial; geometries: THREE.BufferGeometry[]; meshes: THREE.Mesh[]; roles: number[]; castShadow: boolean; receiveShadow: boolean }>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.SkinnedMesh || Array.isArray(object.material)
      || !(object.material instanceof THREE.MeshStandardMaterial) || object.material.transparent
      || object.material.opacity !== 1 || object.geometry.morphAttributes.position?.length
      || Object.values(object.material).some((value) => value instanceof THREE.Texture)) return;
    const material = object.material;
    const key = JSON.stringify([
      material.roughness, material.metalness, material.side, material.flatShading,
      material.emissive.getHex(), material.emissiveIntensity, material.envMapIntensity,
      material.alphaTest, material.depthWrite, material.depthTest, material.depthFunc,
      material.blending, material.blendSrc, material.blendDst, material.blendEquation,
      material.premultipliedAlpha, material.dithering, material.toneMapped, material.fog,
      material.polygonOffset, material.polygonOffsetFactor, material.polygonOffsetUnits,
      material.wireframe, material.visible, object.castShadow, object.receiveShadow,
      object.renderOrder, object.layers.mask
    ]);
    let group = groups.get(key);
    if (!group) {
      group = { material, geometries: [], meshes: [], roles: [], castShadow: object.castShadow, receiveShadow: object.receiveShadow };
      groups.set(key, group);
    }
    let geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverseRoot, object.matrixWorld));
    // These untextured surfaces need position, normal and linear vertex colour only.
    const positions = geometry.getAttribute('position');
    const previous = material.vertexColors ? geometry.getAttribute('color') : undefined;
    const colors = new Float32Array(positions.count * 3);
    for (let vertex = 0; vertex < positions.count; vertex++) {
      colors[vertex * 3] = material.color.r * (previous?.getX(vertex) ?? 1);
      colors[vertex * 3 + 1] = material.color.g * (previous?.getY(vertex) ?? 1);
      colors[vertex * 3 + 2] = material.color.b * (previous?.getZ(vertex) ?? 1);
    }
    for (const attribute of Object.keys(geometry.attributes)) {
      if (attribute !== 'position' && attribute !== 'normal') geometry.deleteAttribute(attribute);
    }
    if (!geometry.hasAttribute('normal')) geometry.computeVertexNormals();
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const role = surfaceCodes[object.userData.roomSurface as RoomSurface] ?? 0;
    for (let vertex = 0; vertex < positions.count; vertex++) group.roles.push(role);
    geometry.clearGroups();
    group.geometries.push(geometry); group.meshes.push(object);
  });
  let retired = root.userData.staticSources as THREE.Group | undefined;
  groups.forEach(({ material, geometries, meshes, roles, castShadow, receiveShadow }) => {
    if (meshes.length < 2) { geometries.forEach((geometry) => geometry.dispose()); return; }
    const geometry = mergeGeometries(geometries, false); geometries.forEach((piece) => piece.dispose()); if (!geometry) return;
    const batchMaterial = material.clone();
    batchMaterial.color.setRGB(1, 1, 1);
    batchMaterial.vertexColors = true;
    const mesh = new THREE.Mesh(geometry, batchMaterial);
    // Semantic finish masks stay on the CPU. The normal render attributes and
    // shader layout are unchanged; a style event recolours and rebatches once.
    geometry.userData.roomSurfaceRoles = new Uint8Array(roles);
    mesh.name = 'Static matte colour batch';
    mesh.castShadow = castShadow; mesh.receiveShadow = receiveShadow;
    mesh.renderOrder = meshes[0].renderOrder; mesh.layers.mask = meshes[0].layers.mask;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    root.add(mesh);
    retired ??= new THREE.Group();
    meshes.forEach((original) => retired!.add(original));
  });
  if (retired) root.userData.staticSources = retired;
}

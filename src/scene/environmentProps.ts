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
        context.fillStyle = timber.clone().multiplyScalar(0.91 + random() * 0.18).getStyle();
        context.fillRect(x, y, 171, 51.2);
        for (let line = 0; line < 7; line++) {
          const grainY = y + 4 + line * 6.2, curl = random() * 2.4;
          context.strokeStyle = line % 3 ? 'rgba(116,80,43,.035)' : 'rgba(255,237,193,.07)'; context.lineWidth = 0.6;
          context.beginPath(); context.moveTo(x, grainY); context.bezierCurveTo(x + 45, grainY + curl, x + 112, grainY - curl, x + 171, grainY); context.stroke();
        }
      }
    }
    for (let i = 0; i < 2300; i++) {
      context.fillStyle = i % 2 ? 'rgba(90,66,39,.035)' : 'rgba(255,255,255,.07)';
      context.fillRect(random() * 512, random() * 512, random() * 10 + 1, 0.7);
    }
    // The source's worn timber and limestone have quiet joins, not a ruled
    // diagram. Small colour clouds give broad surfaces natural variation.
    for (let patch = 0; patch < 14; patch++) {
      const x = random() * 512, y = random() * 512, radius = 45 + random() * 90;
      const cloud = context.createRadialGradient(x, y, 0, x, y, radius);
      cloud.addColorStop(0, patch % 2 ? 'rgba(73,55,37,.045)' : 'rgba(255,239,204,.055)');
      cloud.addColorStop(1, 'rgba(120,100,75,0)');
      context.fillStyle = cloud; context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    context.lineWidth = tile ? 0.7 : 0.8; context.strokeStyle = tile ? 'rgba(99,77,52,.07)' : 'rgba(99,77,52,.13)';
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
  const radius = Math.min(width, depth) * 0.23;
  // The rounded bound stays inside the original rectangle and the bevel retains
  // the certified pile height. A soft woven edge reads better than a paint chip.
  const pile = new THREE.ExtrudeGeometry(outline(width - 0.024, depth - 0.024, radius),
    { depth: 0.021, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 12 });
  const edgeColor = `#${new THREE.Color(color).multiplyScalar(0.86).getHexString()}`;
  const base = new THREE.Mesh(pile, kit.material(edgeColor, 'fabric')); base.rotation.x = -Math.PI / 2;
  base.position.set(x,.0975,z); base.receiveShadow = true; parent.add(base); surface(base,'rug');
  const texture = canvasTexture(512, 512, (context) => {
    context.fillStyle = color; context.fillRect(0, 0, 512, 512);
    // Alternating short warp/weft stitches survive downsampling without the
    // bright regular grid that made the previous rug look like a flat panel.
    for (let row = 0; row < 128; row++) for (let column = 0; column < 128; column++) {
      const horizontal = (row + column) % 2 === 0;
      const variation = (row * 29 + column * 17) % 7;
      context.fillStyle = variation < 3 ? 'rgba(255,237,200,.12)' : 'rgba(61,48,31,.085)';
      const px = column * 4, py = row * 4;
      context.fillRect(px + (horizontal ? 0.1 : 1.15), py + (horizontal ? 1.15 : 0.1), horizontal ? 3.8 : 1.7, horizontal ? 1.7 : 3.8);
    }
    for (let i = 0; i < 2000; i++) {
      context.fillStyle = i % 3 ? 'rgba(255,242,211,.055)' : 'rgba(55,48,34,.055)';
      context.fillRect((i * 193) % 512, (i * 83) % 512, 1.3, 2.3);
    }
    const edgeShade = context.createRadialGradient(256, 190, 40, 256, 256, 345);
    edgeShade.addColorStop(0, 'rgba(255,238,195,.035)'); edgeShade.addColorStop(0.55, 'rgba(64,54,34,0)'); edgeShade.addColorStop(1, 'rgba(64,54,34,.13)');
    context.fillStyle = edgeShade; context.fillRect(0, 0, 512, 512);
    if (words) { context.fillStyle = '#4e4c37'; context.font = '38px Georgia, serif'; context.textAlign = 'center'; words.forEach((word, i) => context.fillText(word, 256, 136 + i * 69)); }
  });
  const weave = surface(texturedPlane(parent, texture, [x, 0.13, z], width - 0.11, depth - 0.11, true), 'rug');
  weave.geometry.dispose();
  weave.geometry = new THREE.ShapeGeometry(outline(width - .11, depth - .11, radius - .055), 12);
  const points = weave.geometry.getAttribute('position'), uv = weave.geometry.getAttribute('uv');
  for (let i=0;i<points.count;i++) uv.setXY(i,points.getX(i)/(width-.11)+.5,points.getY(i)/(depth-.11)+.5);
  (weave.material as THREE.MeshStandardMaterial).roughness = 0.98;
  (weave.material as THREE.MeshStandardMaterial).envMapIntensity = 0.2;
  // The pile and weave used to differ by only 0.0015 world units. At the
  // campus camera that rounds to the same depth values and makes rectangular
  // z-fighting patches. Keep the certified 0.13 top with a real gap beneath it.
  const weaveMaterial=weave.material as THREE.MeshStandardMaterial;
  weaveMaterial.polygonOffset=true;weaveMaterial.polygonOffsetFactor=-1;weaveMaterial.polygonOffsetUnits=-1;
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
    context.fillStyle = `#${new THREE.Color(textColor).multiplyScalar(0.58).getHexString()}`;
    context.font = '61px Kalam, cursive'; lines.forEach((line, i) => context.fillText(line, 76, 93 + i * 75, 485)); drawSymbol(context, symbol);
    context.fillStyle = '#bfb5a3'; for (const px of [23, 777]) for (const py of [23, 337]) { context.beginPath(); context.arc(px, py, 4, 0, Math.PI * 2); context.fill(); }
  });
  texturedPlane(parent, texture, [x, y, z + 0.059], 2.55, 1.57);
  kit.mesh(parent, 'box', '#d9c9ac', [x, y - 0.85, z + 0.08], [2.65, 0.065, 0.16]);
  kit.mesh(parent, 'cylinder', '#748575', [x + 0.68, y - 0.81, z + 0.09], [0.045, 0.39, 0.045], [0, 0, Math.PI / 2]);
}
export function table(parent: THREE.Object3D, kit: SceneKit, x: number, z: number, width: number, depth: number, style: 'rect'|'soft'|'capsule'='rect'): void {
  const corner=style==='capsule'?depth/2-.025:style==='soft'?.34:.09;
  const shapedSlab=(color:string,y:number,w:number,h:number,d:number,r:number)=>{
    if(style==='rect')return beveledBlock(parent,kit,color,[x,y,z],[w,h,d],Math.min(r,.09));
    const bevel=Math.min(.014,h*.3),a=w/2-bevel,b=d/2-bevel,radius=Math.min(r,a,b),shape=new THREE.Shape();
    shape.moveTo(-a+radius,-b);shape.lineTo(a-radius,-b);shape.quadraticCurveTo(a,-b,a,-b+radius);
    shape.lineTo(a,b-radius);shape.quadraticCurveTo(a,b,a-radius,b);
    shape.lineTo(-a+radius,b);shape.quadraticCurveTo(-a,b,-a,b-radius);
    shape.lineTo(-a,-b+radius);shape.quadraticCurveTo(-a,-b,-a+radius,-b);
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:h-2*bevel,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2,curveSegments:8,steps:1});
    geometry.rotateX(-Math.PI/2);geometry.translate(0,-h/2+bevel,0);
    const mesh=new THREE.Mesh(geometry,kit.material(color,'wood'));mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const slab = surface(shapedSlab('#9e754d',.7,width,.2,depth,corner), 'furniture');
  slab.material = kit.material('#9e754d', 'wood');
  const crown = surface(shapedSlab('#b38a5c',.804,width-.07,.025,depth-.07,Math.max(.02,corner-.035)), 'furniture');
  crown.material = kit.material('#b38a5c', 'wood');
  const legGeometry = new THREE.LatheGeometry([[0, -0.5], [0.052, -0.5], [0.068, -0.46], [0.077, -0.25],
    [0.091, 0.4], [0.089, 0.47], [0.072, 0.5], [0, 0.5]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
  for (const dx of [-width / 2 + 0.27, width / 2 - 0.27]) for (const dz of [-depth / 2 + 0.25, depth / 2 - 0.25]) {
    const leg = surface(new THREE.Mesh(legGeometry, kit.material('#987046', 'wood')), 'furniture');
    leg.position.set(x + dx, 0.38, z + dz); leg.scale.y = 0.64;
    leg.rotation.set(dz < 0 ? -0.035 : 0.035, 0, dx < 0 ? 0.045 : -0.045);
    leg.castShadow = leg.receiveShadow = true; parent.add(leg);
  }
  for (const dx of [-width / 2 + 0.27, width / 2 - 0.27]) for (const dz of [-depth / 2 + 0.25, depth / 2 - 0.25]) floorContact(parent, x + dx, 0.137, z + dz, 0.44, 0.38);
  const grain = canvasTexture(768, 384, (context) => {
    context.beginPath(); context.roundRect(0, 0, 768, 384,style==='rect'?54:Math.max(.02,corner-.08)/(depth-.14)*384); context.clip();
    context.fillStyle = '#998065'; context.fillRect(0, 0, 768, 384);
    let seed=7341;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    // Quiet, irregular fibres and broad growth clouds replace the evenly
    // spaced orange rules. This stays one existing baked tabletop texture.
    for(let i=0;i<18;i++){
      const cx=random()*768,cy=random()*384,r=45+random()*120;
      const cloud=context.createRadialGradient(cx,cy,0,cx,cy,r);
      cloud.addColorStop(0,i%2?'rgba(69,49,34,.07)':'rgba(255,236,201,.10)');
      cloud.addColorStop(1,'rgba(130,108,80,0)');context.fillStyle=cloud;
      context.fillRect(cx-r,cy-r,r*2,r*2);
    }
    for (let i = 0; i < 230; i++) {
      const y=random()*384,start=random()*240-80,length=210+random()*650,bend=2+random()*9;
      context.strokeStyle = i % 3 ? 'rgba(76,57,39,.09)' : 'rgba(243,223,186,.13)'; context.lineWidth = .35+random()*.65;
      context.beginPath(); context.moveTo(start,y);context.bezierCurveTo(start+length*.27,y+bend,start+length*.65,y-bend*.6,start+length,y+random()*3);context.stroke();
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
  for (const angle of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) surface(kit.mesh(parent, 'detailCylinder', '#97714a', [x + Math.sin(angle) * 0.2, 0.29, z + Math.cos(angle) * 0.2], [0.09, 0.45, 0.09], [Math.cos(angle) * 0.05, 0, -Math.sin(angle) * 0.05], 'wood'), 'furniture');
}
/** Quiet storage furniture, not a claim that a parcel has been sent. */
export function parcelStack(parent: THREE.Object3D, kit: SceneKit, x: number, z: number): THREE.Group {
  const stack=new THREE.Group();stack.name='Paper-wrapped storage';stack.position.set(x,.104,z);parent.add(stack);
  const cartons:[number,number,number,number,number,number,number][]=[
    [-.15,.20,.05,.50,.40,.48,-.06],[-.12,.555,.04,.44,.31,.42,.04],[.28,.15,-.15,.36,.30,.35,.09],
  ];
  for(const [index,[px,py,pz,w,h,d,angle]]of cartons.entries()){
    const carton=new THREE.Group();carton.position.set(px,py,pz);carton.rotation.y=angle;stack.add(carton);
    surface(beveledBlock(carton,kit,index===1?'#c7ad87':'#b49369',[0,0,0],[w,h,d],.016),'furniture');
    // Thin paper tape wraps real box surfaces. It remains opaque and joins
    // ordinary static batches, with no label text or implied live status.
    for(const sy of [-1,1])kit.mesh(carton,'box','#decaab',[0,sy*(h/2+.002),0],[.052,.003,d+.004]);
    for(const sz of [-1,1])kit.mesh(carton,'box','#decaab',[0,0,sz*(d/2+.002)],[.052,h,.003]);
    kit.mesh(carton,'box','#ecdfc6',[-w*.20,.015,d/2+.004],[w*.24,h*.22,.003]);
  }
  floorContact(stack,0,.003,0,1.05,.85);
  return stack;
}
export function chair(parent: THREE.Object3D, kit: SceneKit, x: number, z: number, color: string, angle = 0): THREE.Group {
  const group = new THREE.Group(); group.position.set(x, 0, z); group.rotation.y = angle; parent.add(group);
  group.name = 'Desk chair';
  stool(group, kit, 0, 0, color);
  [-0.27, 0.27].forEach((dx) => surface(kit.mesh(group, 'detailCylinder', '#96714c', [dx, 0.79, -0.23], [0.065, 0.55, 0.065], [0.08, 0, 0], 'wood'), 'furniture'));
  const curvedBack = (width: number, height: number, depth: number) => {
    const geometry = new RoundedBoxGeometry(width, height, depth, 3, Math.min(depth * 0.45, 0.06));
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const px = positions.getX(i), py = positions.getY(i);
      positions.setXYZ(i, px * (0.94 + 0.06 * (py / height + 0.5)), py + px * px * 0.12, positions.getZ(i) + px * px * 0.24);
    }
    geometry.computeVertexNormals(); return geometry;
  };
  const frame = surface(new THREE.Mesh(curvedBack(0.7, 0.53, 0.14), kit.material('#98734e', 'wood')), 'furniture');
  frame.position.set(0, 1.02, -0.25); frame.rotation.x = 0.08; frame.castShadow = frame.receiveShadow = true; group.add(frame);
  const back = new THREE.Mesh(curvedBack(0.59, 0.42, 0.08), kit.material(color, 'fabric'));
  back.position.set(0, 1.02, -0.165); back.rotation.x = 0.08; back.castShadow = back.receiveShadow = true; group.add(back);
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
/** A closed linen notebook is a furnishing, not a fabricated work event. */
export function notebook(parent: THREE.Object3D, kit: SceneKit, x: number, z: number, color: string, angle=0): THREE.Group {
  const group=new THREE.Group();group.name='Linen notebook';group.position.set(x,.836,z);group.rotation.y=angle;parent.add(group);
  for(const y of [.007,.066])kit.mesh(group,'roundedDetail',color,[0,y,0],[.44,.014,.56],undefined,'fabric');
  kit.mesh(group,'roundedDetail','#e5d8b8',[.008,.036,0],[.412,.045,.526]);
  kit.mesh(group,'roundedDetail',color,[-.216,.036,0],[.025,.066,.56],undefined,'fabric');
  for(const y of [.026,.037,.048])kit.mesh(group,'box','#c5b99c',[.216,y,.005],[.001,.0015,.49]);
  kit.mesh(group,'box','#a9aa89',[.136,.075,0],[.022,.003,.556]);
  kit.mesh(group,'box','#dfcea4',[-.045,.075,-.08],[.18,.002,.15]);
  return group;
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
    const boundBook=(bookParent:THREE.Object3D,color:string,thickness:number,bookHeight:number,depth:number)=>{
      // Separate page block, cloth boards and rounded spine read from above
      // and the side. These opaque details join existing static batches.
      const book=new THREE.Group();book.name='Bound shelf book';bookParent.add(book);
      kit.mesh(book,'box','#e7dab9',[0,0,-.012],[thickness-.018,bookHeight-.014,depth-.027]);
      for(const side of [-1,1])kit.mesh(book,'box',color,[side*(thickness-.008)/2,0,0],[.008,bookHeight,depth]);
      kit.mesh(book,'roundedDetail',color,[0,0,depth/2-.013],[thickness,bookHeight,.028]);
      for(const y of [-bookHeight*.30,bookHeight*.31])kit.mesh(book,'box','#d4b887',[0,y,depth/2+.001],[thickness*.72,.008,.002]);
      for(const y of [-bookHeight*.25,0,bookHeight*.25])kit.mesh(book,'box','#c9b892',[0,y,-depth/2+.001],[thickness-.020,.002,.002]);
      return book;
    };
    for (let level = 0; level < 3; level++) for (let book = 0; book < 4; book++) {
      const bookHeight = 0.23 + ((book * 3 + level + variant) % 5) * 0.025;
      const volume=boundBook(parent,colors[(book+level+variant)%colors.length],.10+(book%2)*.012,bookHeight,.28);
      volume.position.set(x-.31+book*.15,.25+level*.42+bookHeight/2,z+.17+(book+level)%3*.012);
      volume.rotation.z=book===3?-.08:book===0?.035:0;
    }
    for(let level=0;level<2;level++){
      if((variant+level)%3===0){
        const box=kit.mesh(parent,'roundedDetail','#a49a7b',[x+.30,.345+level*.42,z+.14],[.245,.19,.33]);box.name='Archive box';
        kit.mesh(parent,'box','#d8c9a5',[x+.30,.425+level*.42,z+.14],[.255,.028,.34]);
        kit.mesh(parent,'box','#eee2c6',[x+.30,.345+level*.42,z+.307],[.11,.052,.003]);
      }else for(let book=0;book<3;book++){
        const volume=boundBook(parent,colors[(book+variant+level)%colors.length],.045,.23,.31);
        volume.position.set(x+.30,.27+level*.42+book*.05,z+.19);volume.rotation.set(0,book*.07,Math.PI/2);
      }
    }
  }
}
export function leafGeometry(spear: boolean, herb: boolean, broad: boolean, variation=0): THREE.BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  const vertex = (t: number, across: number): Point => {
    const width = Math.pow(Math.sin(Math.PI * t), spear ? 0.68 : herb ? 0.55 : broad ? 0.72 : 0.78) * (spear ? 0.055 : herb ? 0.16 : broad ? 0.21 : 0.16);
    const bend = Math.sin(t * 1.7) * (spear ? 0.14 : herb ? 0.2 : broad ? 0.26 : 0.34);
    const length = herb ? 0.5 : broad ? 0.78 : spear ? 0.93 : 0.87;
    const cup = Math.sin(Math.PI * t) * (1 - across * across);
    return [width * across + Math.sin(Math.PI * t) * (Math.sin(t * 2.1) * 0.012+variation*.022),
      t * length + 0.020 * cup - (spear ? 0 : herb ? .10 : .16+variation*.035) * t ** 3,
      bend*(1+variation*.21) - (spear?.021:.038) * cup + variation*.035*across*Math.sin(Math.PI*t)];
  };
  // Spend the same 56 triangles along the silhouette: fifteen longitudinal
  // sections remove the polygonal paddle edge, while three ribs keep a cup.
  // Each pointed end is one vertex, avoiding zero-area triangles.
  positions.push(...vertex(0, 0)); uvs.push(0.5, 0);
  for (let row = 1; row < 15; row++) for (let column = 0; column < 3; column++) {
    positions.push(...vertex(row / 15, column - 1)); uvs.push(column / 2, row / 15);
  }
  positions.push(...vertex(1, 0)); uvs.push(0.5, 1);
  for (let side = 0; side < 2; side++) indices.push(0, 1 + side, 2 + side);
  for (let row = 0; row < 13; row++) for (let side = 0; side < 2; side++) {
    const first = 1 + row * 3 + side, next = first + 3;
    indices.push(first, next, next + 1, first, next + 1, first + 1);
  }
  for (let side = 0; side < 2; side++) indices.push(40 + side, 43, 41 + side);
  const colors: number[] = [];
  for (let index = 0; index < uvs.length; index += 2) {
    const across = Math.abs(uvs[index] * 2 - 1), t = uvs[index + 1];
    const value = 0.86 + (1 - across) * 0.15 + Math.sin(t * Math.PI) * 0.04;
    colors.push(value, value, value);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
const botanicalGrains = new WeakMap<SceneKit, THREE.DataTexture>();
/** One opaque vein map serves every real cupped leaf. The canopy geometry,
 * navigation bounds and cutaway roots are unchanged. Root disposal owns it. */
function botanicalGrain(kit: SceneKit): THREE.DataTexture {
  const cached=botanicalGrains.get(kit);if(cached)return cached;
  const width=128,height=256,data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const u=(x+.5)/width-.5,v=(y+.5)/height;
    const midrib=Math.exp(-((u/.020)**2));
    const veins=Math.pow(Math.max(0,Math.cos(v*64-Math.abs(u)*22)),26)*(1-Math.abs(u)*1.4);
    const grain=((Math.imul(x+7,374761393)^Math.imul(y+13,668265263))>>>0)%11;
    const tone=222+18*midrib+10*veins-12*Math.abs(u)+grain;
    data.set([tone,tone,tone,255],(y*width+x)*4);
  }
  const texture=new THREE.DataTexture(data,width,height);
  texture.userData.botanicalGrain=true;texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  botanicalGrains.set(kit,texture);return texture;
}
export function plant(parent: THREE.Object3D, kit: SceneKit, x: number, z: number, size: number, base = 0.1, potColor = '#bca581', kind: 'leaf' | 'spear' | 'herb' | 'broad' | 'ivy' = 'leaf'): void {
  const group = new THREE.Group(); group.position.set(x, base, z); group.scale.setScalar(size); parent.add(group);
  group.name = `Botanical plant ${kind}`;
  if (base <= 0.12) floorContact(group, 0, 0.006 / size, 0, 0.57, 0.57);
  const warmth = kind === 'broad' ? 0.3 : kind === 'leaf' ? 0.18 : kind === 'ivy' ? 0.12 : kind === 'spear' ? 0.08 : 0;
  const clay = `#${new THREE.Color(potColor).lerp(new THREE.Color('#ad7651'), warmth).multiplyScalar(0.73).getHexString()}`;
  const potGeometry = new THREE.LatheGeometry([[0, 0], [0.13, 0], [0.155, 0.018], [0.18, 0.07], [0.205, 0.17],
    [0.216, 0.29], [0.207, 0.365], [0.2, 0.39], [0.181, 0.39], [0.189, 0.355], [0.193, 0.29],
    [0.173, 0.1], [0.13, 0.04], [0, 0.04]].map(([r, y]) => new THREE.Vector2(r, y)), 20);
  const pot = new THREE.Mesh(potGeometry, kit.material(clay, 'ceramic'));
  pot.name = 'Rounded plant pot'; pot.castShadow = pot.receiveShadow = true; group.add(pot);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.199, 0.017, 6, 24), kit.material(clay, 'ceramic'));
  lip.name = 'Pot rolled lip'; lip.position.y = 0.39; lip.rotation.x = Math.PI / 2; lip.castShadow = lip.receiveShadow = true; group.add(lip);
  const soil = kit.mesh(group, 'cylinder', '#514630', [0, 0.385, 0], [0.354, 0.008, 0.354]); soil.name = 'Plant soil';
  const shades = ['#647c4b', '#526e40', '#819658'];
  const materials = shades.map(color => {
    const material = kit.material(color).clone(); material.side = THREE.DoubleSide; material.vertexColors = true;
    material.roughness=.68;material.emissive.set('#627546');material.emissiveIntensity=.045;
    material.map=material.bumpMap=botanicalGrain(kit);material.bumpScale=.007;
    return material;
  });
  const canopy = new THREE.Group(); canopy.name = 'Connected botanical canopy';
  // Three shared curved forms vary the leaf blade, not the triangle budget.
  // This is immutable botany; no randomized per-frame motion is introduced.
  const geometries=(kind==='leaf'||kind==='broad'?[-1,0,1]:[0]).map(variation=>leafGeometry(kind==='spear',kind==='herb'||kind==='ivy',kind==='broad',variation));
  // Spend the unchanged per-plant triangle budget on visible leaves. These
  // millimetre-wide stems need only five sides and share one local geometry.
  const stemGeometry=new THREE.CylinderGeometry(.5,.5,1,5);
  const stem = (from: THREE.Vector3, to: THREE.Vector3, radius = 0.009) => {
    const midpoint = from.clone().add(to).multiplyScalar(0.5), direction = to.clone().sub(from);
    const mesh=new THREE.Mesh(stemGeometry,kit.material('#627346'));
    mesh.position.copy(midpoint);mesh.scale.set(radius*2,direction.length(),radius*2);
    mesh.castShadow=mesh.receiveShadow=true;canopy.add(mesh);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  };
  const addLeaf = (index: number, position: Point, rotation: Point, scale: number) => {
    const leaf = new THREE.Mesh(geometries[index%geometries.length], materials[index % materials.length]); leaf.name = 'Cupped botanical leaf';
    // Pitch around the branch's local axis before applying its azimuth.
    // XYZ tilted every bough toward the same world direction, producing
    // flat, paddle-like crowns even when the stems branched radially.
    leaf.position.set(...position); leaf.rotation.set(...rotation, 'YXZ'); leaf.scale.set(scale * (0.9 + index % 3 * 0.06), scale, scale);
    leaf.castShadow = leaf.receiveShadow = true; canopy.add(leaf);
  };
  if (kind === 'ivy') {
    for (const vine of [-1, 1]) {
      let previous = new THREE.Vector3(vine * 0.06, 0.39, 0);
      for (let step = 0; step < 7; step++) {
        const point = new THREE.Vector3(vine * 0.1 + Math.sin(step * 0.7) * 0.07, 0.45 - step * 0.105, 0.17 + step * 0.045);
        stem(previous, point, 0.009); previous = point;
        addLeaf(step + (vine === 1 ? 7 : 0), [point.x, point.y, point.z], [1.1, vine * 0.45, vine * 0.65], 0.45);
      }
    }
  } else {
    const count = kind === 'spear' ? 11 : kind === 'herb' ? 17 : kind === 'broad' ? 17 : 21;
    const trunkHeight = kind === 'spear' || kind === 'herb' ? 0.43 : kind === 'broad' ? 1.23 : 1.25;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.385, 0), new THREE.Vector3(0.025, 0.65, -0.015),
      new THREE.Vector3(-0.018, trunkHeight - 0.12, 0.02), new THREE.Vector3(0.012, trunkHeight, 0)]);
    if (kind !== 'spear' && kind !== 'herb') {
      const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.014, 5, false), kit.material('#627346'));
      trunk.castShadow = trunk.receiveShadow = true; canopy.add(trunk);
    }
    if(kind==='leaf'||kind==='broad'){
      // Three continuous boughs carry offset leaf pairs and an apical leaf.
      // Reuse the same 21/17 stem and leaf budgets instead of arranging every
      // leaf as an identical spoke around a straight pole.
      const sizes=kind==='leaf'?[7,7,7]:[6,6,5],phase=x*1.7+z*2.3+size*5.1+base*.7;let index=0;
      for(let branch=0;branch<3;branch++){
        const angle=branch*2.399+.31+.20*Math.sin(phase+branch);
        const from=new THREE.Vector3(.008,.46+branch*.06+.055*Math.sin(phase+branch*2),0);
        const to=new THREE.Vector3(Math.sin(angle)*.22,1.03+branch*.13+.10*Math.sin(phase*2+branch),Math.cos(angle)*.22);
        stem(from,to,.012);
        for(let local=0;local<sizes[branch];local++,index++){
          const apical=local===sizes[branch]-1,t=.15+.85*Math.pow(local/(sizes[branch]-1),1+.20*Math.sin(branch+phase));
          const root=from.clone().lerp(to,t);
          const bearing=angle+(apical?.10:(local%2?-1:1)*(1.0+.22*Math.sin(index*1.7+phase)));
          const reach=apical?0:.055+.020*Math.sin(index*2.1+phase);
          const point=root.clone().add(new THREE.Vector3(Math.sin(bearing)*reach,.018,Math.cos(bearing)*reach));
          if(!apical)stem(root,point,.008);
          const scale=(kind==='broad'?.89:.77)-.16*t+.055*Math.sin(index*2.3+phase);
          const pitch=apical?.36+.08*Math.sin(phase+branch):.55+.25*Math.sin(index*1.7+phase)+.12*(1-t);
          addLeaf(index,[point.x,point.y,point.z],[pitch,bearing,.06*Math.sin(index*2.1+phase)],scale);
        }
      }
    }else for (let i = 0; i < count; i++) {
      const angle = i * 2.399;
      const origin = kind === 'spear' ? 0.405 : 0.405 + i % 3 * 0.045;
      const reach = kind === 'spear' ? 0.045 : 0.07;
      const point: Point = [Math.sin(angle) * reach, origin, Math.cos(angle) * reach];
      const branchRoot = new THREE.Vector3(0, 0.385, 0);
      stem(branchRoot, new THREE.Vector3(...point));
      const scale = kind === 'herb' ? 0.62 + i % 4 * 0.105 : 0.68 + i % 4 * 0.15;
      addLeaf(i, point, [kind === 'herb' ? -0.18 : i % 2 * 0.08, angle+.10*Math.sin(i*1.9), (i % 3 - 1) * 0.16], scale);
    }
  }
  // Keep every actual leaf vertex within its existing navigation envelope;
  // a fuller canopy must never silently widen a certified floor obstacle.
  canopy.updateMatrixWorld(true);
  let radius = 0;
  canopy.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const positions = object.geometry.getAttribute('position'), point = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      radius = Math.max(radius, Math.hypot(point.x, point.z));
    }
  });
  const bound = kind === 'broad' ? 0.57 : kind === 'spear' ? 0.28 : kind === 'herb' ? 0.48 : 0.5;
  if (radius > bound) canopy.scale.set(bound / radius, 1, bound / radius);
  group.add(canopy);
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
  // Luminous translucent haze has real coverage, unlike additive ONE/ONE
  // alpha. That keeps the one-draw compositor valid even over bare background.
  const haze = new THREE.Color('#fff8e9').multiplyScalar(1.6);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture, color: haze, transparent: true, depthWrite: false, blending: THREE.NormalBlending, opacity: 0.55 }));
  halo.material.userData.officeGlow = true;
  halo.position.set(x, 1.65, z); halo.scale.set(1.4, 1.4, 1); parent.add(halo);
  const bounce = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.8), new THREE.MeshBasicMaterial({ map: haloTexture, color: haze, transparent: true, depthWrite: false, blending: THREE.NormalBlending, opacity: 0.65 }));
  bounce.material.userData.officeGlow = true;
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
      || Object.values(object.material).some((value) => value instanceof THREE.Texture && !value.userData.botanicalGrain)) return;
    const material = object.material;
    const key = JSON.stringify([
      material.roughness, material.metalness, material.side, material.flatShading,
      material.emissive.getHex(), material.emissiveIntensity, material.envMapIntensity,
      material.alphaTest, material.depthWrite, material.depthTest, material.depthFunc,
      material.blending, material.blendSrc, material.blendDst, material.blendEquation,
      material.premultipliedAlpha, material.dithering, material.toneMapped, material.fog,
      material.polygonOffset, material.polygonOffsetFactor, material.polygonOffsetUnits,
      material.wireframe, material.visible, object.castShadow, object.receiveShadow,
      object.renderOrder, object.layers.mask, material.map?.uuid, material.bumpMap?.uuid, material.bumpScale
    ]);
    let group = groups.get(key);
    if (!group) {
      group = { material, geometries: [], meshes: [], roles: [], castShadow: object.castShadow, receiveShadow: object.receiveShadow };
      groups.set(key, group);
    }
    let geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverseRoot, object.matrixWorld));
    // Botanical maps share one immutable UV space. Other static matte surfaces
    // need position, normal and linear vertex colour only.
    const positions = geometry.getAttribute('position');
    const previous = material.vertexColors ? geometry.getAttribute('color') : undefined;
    const colors = new Float32Array(positions.count * 3);
    for (let vertex = 0; vertex < positions.count; vertex++) {
      colors[vertex * 3] = material.color.r * (previous?.getX(vertex) ?? 1);
      colors[vertex * 3 + 1] = material.color.g * (previous?.getY(vertex) ?? 1);
      colors[vertex * 3 + 2] = material.color.b * (previous?.getZ(vertex) ?? 1);
    }
    for (const attribute of Object.keys(geometry.attributes)) {
      if (attribute !== 'position' && attribute !== 'normal' && !(attribute==='uv'&&material.map?.userData.botanicalGrain)) geometry.deleteAttribute(attribute);
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

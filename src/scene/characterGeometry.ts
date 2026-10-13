import * as THREE from 'three';
import type { SceneKit } from './primitives';

export type CharacterForm = 'torso' | 'helmet' | 'owlBody' | 'owlHead' | 'wing' | 'tuft'
  | 'lanternGlass' | 'lanternCap' | 'lanternBase' | 'sphere' | 'bean' | 'detail' | 'limb' | 'ankle' | 'beak' | 'ring' | 'heart'
  | 'book' | 'cloak' | 'cape' | 'capePanel' | 'feather' | 'toe' | 'paperBody' | 'paperEchoHead' | 'paperQuillHead' | 'paperWing' | 'paperTail' | 'paperDisc' | 'paperDiscL' | 'pageFold' | 'hoodTip' | 'scroll'
  | 'spiritBody' | 'spiritHood' | 'spiritRelayHood' | 'merchantTorso' | 'swiftBody' | 'swiftHead' | 'swiftTail' | 'swiftWingL' | 'swiftWingR'
  | 'owlBrowL' | 'owlBrowR' | 'featherFanL' | 'featherFanR' | 'breastFeathers' | 'hexGlass' | 'hexCap' | 'fineRing' | 'compassStar' | 'compassNeedle' | 'paperBeak' | 'pageCorner' | 'merchantBase' | 'spiritFigure' | 'spiritLens' | 'spiritRelay';
export type CharacterFinish = 'clay' | 'glaze' | 'ink' | 'brass' | 'amber' | 'paper' | 'feather';
type Tuple = [number, number, number];
const torsoProfile: Array<[number, number]> = [[0, -.5], [.32, -.48], [.45, -.37], [.50, -.10], [.49, .16], [.43, .34], [.29, .45], [.14, .49], [0, .5]];
interface CharacterResources {
  geometry: Map<string, THREE.BufferGeometry>;
  material: Map<string, THREE.MeshStandardMaterial>;
  grain?: THREE.DataTexture;
  glow?: THREE.DataTexture;
}

// Model resources belong to one office scene. Every cached surface is attached
// to its proxy and is released by the scene's existing recursive disposer.
const resources = new WeakMap<SceneKit, CharacterResources>();
function owned(kit: SceneKit): CharacterResources {
  let value = resources.get(kit);
  if (!value) { value = { geometry: new Map(), material: new Map() }; resources.set(kit, value); }
  return value;
}

function lathe(profile: Array<[number, number]>, segments = 24): THREE.BufferGeometry {
  // LatheGeometry supplies analytic profile normals shared across the two UV
  // edges. Recomputing them from triangles would split the front meridian and
  // turn a continuous glazed surface into two visibly different halves.
  return new THREE.LatheGeometry(profile.map(([radius, y]) => new THREE.Vector2(radius, y)), segments);
}

/** Restore continuous shading where a deformed sphere duplicates its UV seam. */
function smoothDeformedSurface(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.computeVertexNormals();
  const position = geometry.attributes.position, normal = geometry.attributes.normal;
  const coincident = new Map<string, { indices: number[]; sum: THREE.Vector3 }>();
  for (let i = 0; i < position.count; i++) {
    const key = `${Math.round(position.getX(i) * 1e6)}:${Math.round(position.getY(i) * 1e6)}:${Math.round(position.getZ(i) * 1e6)}`;
    let group = coincident.get(key);
    if (!group) { group = { indices: [], sum: new THREE.Vector3() }; coincident.set(key, group); }
    group.indices.push(i); group.sum.x += normal.getX(i); group.sum.y += normal.getY(i); group.sum.z += normal.getZ(i);
  }
  for (const group of coincident.values()) {
    if (group.indices.length < 2) continue;
    group.sum.normalize();
    group.indices.forEach(i => { normal.setXYZ(i, group.sum.x, group.sum.y, group.sum.z); });
  }
  return geometry;
}

/** Densely sample only broad clay contours; paper folds and metal lips stay authored. */
function softLathe(profile: Array<[number, number]>, rows=16, columns=24): THREE.BufferGeometry {
  const curve = new THREE.SplineCurve(profile.map(([radius, y]) => new THREE.Vector2(radius, y)));
  const points = curve.getPoints(rows).map(point => [Math.max(0, point.x), point.y] as [number, number]);
  return lathe(points,columns);
}

/** A soft, slightly squared helmet, with a continuous crown and cheeks. */
function helmet(owl = false): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(.5, 32, 20);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    // Move only the middle latitudes outward. The poles remain smooth and the
    // face has generous cheeks rather than a faceted cube or detached spheres.
    const cheek = 1 + (owl ? .07 : .025) * Math.max(0, 1 - (y * 2) ** 2);
    const back = !owl && z < 0 ? z * (1 - .15 * (z * 2) ** 2) : z;
    // Fill only the side/back lower cheeks. The front remains the same fitted
    // ellipsoid, while the silhouette has a soft rounded-square jaw instead
    // of tapering to the bottom of a ball.
    const side = Math.max(0, 1 - Math.max(0, z) / .25) ** 2;
    const lower = Math.max(0, Math.min(1, (-y - .05) / .45));
    const jaw = owl ? 0 : Math.sin(lower * Math.PI) * side;
    position.setXYZ(i, x * cheek * (1 + .12 * jaw), y - .035 * jaw, back);
  }
  return smoothDeformedSurface(geometry);
}

/** Joined wing/ear surfaces taper to a rounded point, with no paper-thin edges. */
function petal(tuft = false): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(.5, tuft ? 12 : 16, tuft ? 8 : 12);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i), x = position.getX(i), z = position.getZ(i);
    const width = tuft ? .52 + .48 * (.5 - y) : .72 + .28 * (.5 - y);
    position.setXYZ(i, x * width, y, z * (tuft ? .72 : 1));
  }
  return smoothDeformedSurface(geometry);
}

/** Thick folded forms retain their creases through geometry, without a decal. */
function folded(points: Array<[number, number]>, depth = .16, ridge = .10): THREE.BufferGeometry {
  const area=points.reduce((sum,[x,y],i)=>{const next=points[(i+1)%points.length];return sum+x*next[1]-next[0]*y},0);
  if(area<0)points=[...points].reverse();
  const vertices: number[] = [], indices: number[] = [];
  for (const [x, y] of points) vertices.push(x, y, depth * .5);
  const front = points.length; vertices.push(0, 0, depth * .5 + ridge);
  for (const [x, y] of points) vertices.push(x, y, -depth * .5);
  const back = vertices.length / 3; vertices.push(0, 0, -depth * .5);
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length, rear = front + 1;
    indices.push(i, next, front, rear + next, rear + i, back,
      i, rear + i, rear + next, i, rear + next, next);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices);
  // Separate normals give paper its intentional fold planes. Ceramic forms
  // continue to use smooth analytical/averaged normals above.
  const faceted = geometry.toNonIndexed(); geometry.dispose(); faceted.computeVertexNormals(); return faceted;
}

function roundedBook(): THREE.BufferGeometry {
  const shape = new THREE.Shape(), radius = .13;
  shape.moveTo(-.5 + radius, -.5); shape.lineTo(.5 - radius, -.5);
  shape.quadraticCurveTo(.5, -.5, .5, -.5 + radius); shape.lineTo(.5, .5 - radius);
  shape.quadraticCurveTo(.5, .5, .5 - radius, .5); shape.lineTo(-.5 + radius, .5);
  shape.quadraticCurveTo(-.5, .5, -.5, .5 - radius); shape.lineTo(-.5, -.5 + radius);
  shape.quadraticCurveTo(-.5, -.5, -.5 + radius, -.5);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .80, steps: 1, bevelEnabled: true,
    bevelSegments: 3, bevelSize: .035, bevelThickness: .07, curveSegments: 5 });
  geometry.translate(0, 0, -.4); return geometry;
}

function smallHeart(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, -.5);
  shape.bezierCurveTo(-.20, -.32, -.54, -.08, -.48, .20);
  shape.bezierCurveTo(-.43, .48, -.14, .49, 0, .27);
  shape.bezierCurveTo(.14, .49, .43, .48, .48, .20);
  shape.bezierCurveTo(.54, -.08, .20, -.32, 0, -.5);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .8, steps: 1, bevelEnabled: true,
    bevelSegments: 2, bevelSize: .04, bevelThickness: .10, curveSegments: 5 });
  geometry.translate(0, 0, -.4); return geometry;
}

/** Open-backed cape follows the shoulders and flares into a rounded hem. */
function cape(): THREE.BufferGeometry {
  const vertices: number[] = [], indices: number[] = [], columns = 18, rows = 6;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, radius = .31 + .15 * t,bound=.20+1.05*Math.sin(t*Math.PI/2);
    for (let column = 0; column <= columns; column++) {
      const angle = bound + column / columns * (Math.PI*2-bound*2);
      vertices.push(Math.sin(angle) * radius, .29 - t * .72,
        Math.cos(angle) * radius * .80 + .08 + .014*Math.sin(angle*5)*Math.sin(Math.PI*t));
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
        indices.push(a, d, b, a, c, d);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function feather(): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(.5, 8, 6), position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i), taper = .08 + .92 * Math.pow(Math.max(0,y + .5),.45);
    position.setXYZ(i, position.getX(i) * taper, y < -.20 ? -.20 + (y + .20) * 1.27 : y, position.getZ(i));
  }
  return smoothDeformedSurface(geometry);
}

function polyhedron(vertices: Tuple[], faces: number[][],faceColors?: string[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[]=[];
  const centre=vertices.reduce((sum,p)=>sum.add(new THREE.Vector3(...p)),new THREE.Vector3()).divideScalar(vertices.length);
  for (const [f,face] of faces.entries()) for (let i = 1; i < face.length - 1; i++) {
    const a=new THREE.Vector3(...vertices[face[0]]),b=new THREE.Vector3(...vertices[face[i]]),c=new THREE.Vector3(...vertices[face[i+1]]);
    const outward=b.clone().sub(a).cross(c.clone().sub(a)).dot(a.clone().add(b).add(c).multiplyScalar(1/3).sub(centre));
    for (const index of outward<0?[face[0],face[i+1],face[i]]:[face[0], face[i], face[i + 1]]) {positions.push(...vertices[index]);if(faceColors)colors.push(...new THREE.Color(faceColors[f]).toArray());}
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if(faceColors)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals(); return geometry;
}

function swiftHead(): THREE.BufferGeometry {
  // The head and tapered throat are one folded profile. A softly rolled paper
  // crown joins deliberate flat cheeks, rather than a low-poly spherical bead.
  const shape=new THREE.Shape();shape.moveTo(.13,-.055);shape.lineTo(.17,.055);
  shape.bezierCurveTo(.18,.17,.08,.215,-.035,.195);
  shape.bezierCurveTo(-.12,.175,-.145,.12,-.145,.04);
  shape.lineTo(-.105,-.16);shape.lineTo(.045,-.245);shape.lineTo(.09,-.11);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.19,steps:1,bevelEnabled:true,bevelSize:.012,bevelThickness:.016,bevelSegments:2,curveSegments:7});
  geometry.translate(0,0,-.095);geometry.rotateY(-Math.PI/2);return geometry;
}

function swiftWing(): THREE.BufferGeometry {
  const vertices: Tuple[]=[[0,.10,.10],[.07,.27,-.36],[.09,-.23,-.25],[.11,-.10,-.005],[.14,.005,-.06],[-.009,.10,.10],[.061,.27,-.36],[.081,-.23,-.25],[.101,-.10,-.005]];
  return polyhedron(vertices,[[0,4,1],[1,4,2],[2,4,3],[3,4,0],[5,6,7,8],[0,1,6,5],[1,2,7,6],[2,3,8,7],[3,0,5,8]],
    ['#e0b15e','#d5a24e','#bd893b','#e5bc74','#3c6d68','#b38948','#47736b','#3b6e65','#c59854']);
}

/** Folded volumes close into a tapered back, not an extruded cardboard slab. */
function paperOwlHead(quill=false): THREE.BufferGeometry {
  const outline:Array<[number,number]>=quill?
    [[-.41,-.26],[-.30,-.45],[.22,-.45],[.47,-.13],[.45,.24],[.54,.51],[.19,.34],[-.08,.39],[-.48,.53],[-.44,.14]]:
    [[-.44,-.22],[-.27,-.43],[.25,-.44],[.47,-.10],[.42,.28],[.23,.48],[-.23,.44],[-.47,.14]];
  const vertices:Tuple[]=outline.map(([x,y])=>[x,y,.30+(.4-Math.abs(x))*.12]);
  vertices.push(...outline.map(([x,y])=>[x*.87,y*.88,-.29] as Tuple));
  vertices.push([-.025,.06,.52],[0,.03,-.39]);
  const n=outline.length,faces:number[][]=[];
  for(let i=0;i<n;i++){const j=(i+1)%n;faces.push([i,j,2*n],[i,n+i,n+j],[i,n+j,j],[n+j,n+i,2*n+1]);}
  return polyhedron(vertices,faces);
}

function paperOwlBody(): THREE.BufferGeometry {
  const rings:Tuple[][]=[
    [[-.26,-.5,.17],[.25,-.5,.17],[.39,-.36,-.04],[.21,-.5,-.28],[-.22,-.5,-.28],[-.42,-.34,-.04]],
    [[-.40,-.03,.34],[.39,-.08,.34],[.50,.02,-.06],[.26,-.03,-.43],[-.29,.03,-.43],[-.50,.08,-.08]],
    [[-.27,.34,.27],[.26,.35,.27],[.34,.36,-.03],[.17,.36,-.29],[-.20,.35,-.30],[-.35,.32,-.02]],
  ];
  const vertices=rings.flat();vertices.push([0,.49,0],[0,-.5,-.04],[-.04,-.24,.36],[-.04,.20,.38]);
  const faces:number[][]=[];
  for(let r=0;r<2;r++)for(let i=0;i<6;i++){
    const j=(i+1)%6;
    if(i===0){const centre=20+r;faces.push([r*6,r*6+1,centre],[r*6+1,(r+1)*6+1,centre],[(r+1)*6+1,(r+1)*6,centre],[(r+1)*6,r*6,centre]);}
    else faces.push([r*6+i,r*6+j,(r+1)*6+j],[(r+1)*6+j,(r+1)*6+i,r*6+i]);
  }
  for(let i=0;i<6;i++){const j=(i+1)%6;faces.push([12+i,12+j,18],[j,i,19]);}
  return polyhedron(vertices,faces);
}

function reflect(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const reflected = geometry.clone(), position = reflected.attributes.position;
  for (let i = 0; i < position.count; i += 3) {
    const a: Tuple = [-position.getX(i), position.getY(i), position.getZ(i)];
    const b: Tuple = [-position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1)];
    const c: Tuple = [-position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2)];
    position.setXYZ(i, ...a); position.setXYZ(i + 1, ...c); position.setXYZ(i + 2, ...b);
  }
  reflected.computeVertexNormals(); geometry.dispose(); return reflected;
}

function spiritHood(relay = false): THREE.BufferGeometry {
  const geometry = lathe([[0, -.54], [.30, -.50], [.43, -.39], [.50, -.18], [.49, .04], [.42, .28], [.29, .45], [.12, .53], [0, .55]], 24);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i), upper = Math.max(0, y + .10);
    position.setXYZ(i, position.getX(i) + (relay ? -.24 : -.14) * upper ** 1.3,
      y + (relay ? .10 : .04) * position.getX(i), position.getZ(i) + upper * .035);
  }
  return smoothDeformedSurface(geometry);
}

function spiritFigure(variant:'compass'|'lens'|'relay'): THREE.BufferGeometry {
  const profile: Array<[number,number]>=[[0,-.617],[.42,-.617],[.49,-.51],[.48,-.30],[.40,-.08],[.29,.21],[.31,.32],[.36,.46],[.33,.62],[.22,.75]];
  profile.push(...(variant==='compass'?[[.12,.84],[.055,.93],[0,1.03]]:[[.09,.80],[0,.81]]) as Array<[number,number]>);
  const geometry=softLathe(profile,32,32),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const y=p.getY(i),hem=Math.pow(Math.max(0,(.23-y)/.847),1.25);
    const theta=Math.atan2(p.getX(i),p.getZ(i)),fold=.018*hem*Math.sin(theta*3+y*5);
    p.setXYZ(i,p.getX(i)+Math.sin(theta)*fold+(variant==='compass'?0:variant==='lens'?-.17:.17)*hem,y,p.getZ(i)+Math.cos(theta)*fold);
  }
  return smoothDeformedSurface(geometry);
}

function sweptBrow(left = false): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [], length = 10, around = 7;
  for (let row = 0; row <= length; row++) {
    const t = row / length, radius = .080 * (1 - t) ** .70 + .003;
    for (let i = 0; i < around; i++) {
      const a = i / around * Math.PI * 2;
      positions.push((left ? -1 : 1) * (.29 * t + Math.cos(a) * radius * .30),
        -.035 + .14 * t * t + Math.cos(a) * radius, Math.sin(a) * radius * .75);
      if (row < length) { const next = (i + 1) % around, a0 = row * around + i, b = row * around + next, c = a0 + around, d = b + around; indices.push(a0, b, d, a0, d, c); }
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
  if (left) { const index = geometry.index!; for (let i = 0; i < index.count; i += 3) { const b = index.getX(i + 1); index.setX(i + 1, index.getX(i + 2)); index.setX(i + 2, b); } }
  geometry.computeVertexNormals(); return geometry;
}

/** One cached surface owns each layered fan; detail does not add pose matrices. */
function featherFan(sign: number, breast = false): THREE.BufferGeometry {
  const sculpt = feather(), source = sculpt.toNonIndexed(), vertices: number[] = [], normals: number[] = [];
  sculpt.dispose();
  const count = breast ? 11 : 12, matrix = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3(), quaternion = new THREE.Quaternion();
  const point = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let featherIndex = 0; featherIndex < count; featherIndex++) {
    const row = Math.floor(featherIndex / 3), column = featherIndex % 3;
    const x = breast ? (column - 1) * .135 : sign * (column * .045 - .035);
    quaternion.setFromEuler(new THREE.Euler(0, breast ? -x * 1.3 : 0, breast ? -x * 2.0 : -sign * (.20 + column * .18)));
    matrix.compose(new THREE.Vector3(x, breast ? .16 - row * .13 - Math.abs(x)*.18 : .12 - row * .11,
      breast ? .012 - Math.abs(x)*.34 - row*.016 : .102 + column*.012 - row*.018), quaternion,
    new THREE.Vector3(breast ? .205 : .14, breast ? .265 : .30, breast?.013:.022)); normalMatrix.getNormalMatrix(matrix);
    for (let i = 0; i < source.attributes.position.count; i++) {
      point.fromBufferAttribute(source.attributes.position, i).applyMatrix4(matrix); normal.fromBufferAttribute(source.attributes.normal, i).applyMatrix3(normalMatrix).normalize();
      if(breast)point.z=.285*Math.sqrt(Math.max(.04,1-(point.x/.37)**2-(point.y/.52)**2))+.013+point.z-(.012-Math.abs(x)*.34-row*.016);
      vertices.push(point.x, point.y, point.z); normals.push(normal.x, normal.y, normal.z);
    }
  }
  source.dispose(); const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); return breast?smoothDeformedSurface(geometry):geometry;
}

function makeGeometry(form: CharacterForm): THREE.BufferGeometry {
  switch (form) {
    case 'torso': return softLathe(torsoProfile);
    case 'helmet': return helmet();
    case 'owlHead': return helmet(true);
    case 'owlBody': return softLathe([[0, -.5], [.25, -.47], [.42, -.30], [.5, -.02], [.48, .20], [.35, .42], [0, .5]]);
    case 'wing': return petal();
    case 'tuft': return petal(true);
    case 'lanternGlass': return lathe([[0, -.5], [.29, -.49], [.43, -.38], [.5, -.14], [.5, .18], [.42, .40], [.27, .49], [0, .5]]);
    case 'lanternCap': return lathe([[0, -.5], [.44, -.5], [.5, -.35], [.49, -.23], [.38, -.17], [.34, .01], [.25, .30], [.13, .47], [0, .5]]);
    case 'lanternBase': return lathe([[0, -.5], [.38, -.5], [.48, -.40], [.5, -.18], [.47, .02], [.38, .10], [.36, .36], [.28, .5], [0, .5]]);
    case 'limb': return lathe([[0, -.5], [.30, -.45], [.43, -.28], [.48, .04], [.5, .22], [.42, .40], [.22, .49], [0, .5]], 16);
    case 'ankle': return new THREE.CylinderGeometry(.42, .5, 1, 9);
    case 'sphere': return new THREE.SphereGeometry(.5, 24, 16);
    case 'bean': return new THREE.SphereGeometry(.5, 16, 10);
    case 'detail': return new THREE.SphereGeometry(.5, 12, 6);
    case 'beak': return lathe([[0, -.5], [.32, -.46], [.5, -.30], [.47, -.05], [.32, .20], [.12, .43], [0, .5]], 16);
    case 'ring': return new THREE.TorusGeometry(.5, .085, 8, 24);
    case 'heart': return smallHeart();
    case 'book': return roundedBook();
    case 'cloak': return softLathe([[0, -.5], [.36, -.49], [.5, -.39], [.48, -.20], [.34, .12], [.21, .36], [.09, .49], [0, .54]]);
    case 'cape': return cape();
    case 'capePanel': return folded([[-.5, .5], [.5, .20], [.45, -.5], [-.15, -.09]], .08, .018);
    case 'feather': return feather();
    case 'toe': return new THREE.SphereGeometry(.5, 8, 6);
    case 'paperBody': return paperOwlBody();
    case 'paperEchoHead': return paperOwlHead();
    case 'paperQuillHead': return paperOwlHead(true);
    case 'paperWing': return folded([[-.50, .43], [-.18, -.50], [.35, -.34], [.50, .36], [.12, .18]], .16, .14);
    case 'paperTail': return folded([[-.5, -.5], [0, -.26], [.5, -.5], [.27, .5], [-.27, .5]], .12, .07);
    case 'paperDisc': return folded([[-.48,.08],[-.37,.34],[-.12,.49],[.19,.45],[.41,.26],[.49,-.10],[.20,-.50],[-.23,-.43],[-.42,-.22]], .06, .023);
    case 'paperDiscL': return reflect(makeGeometry('paperDisc'));
    case 'pageFold': return folded([[-.5, .5], [.5, .5], [.5, -.5]], .04, .04);
    case 'hoodTip': return lathe([[0, -.5], [.49, -.5], [.43, -.32], [.30, -.12], [.21, .15], [.13, .36], [0, .6]], 16);
    case 'scroll': return new THREE.CylinderGeometry(.5, .5, 1, 12, 1, false, .12, Math.PI * 1.78);
    case 'spiritBody': return softLathe([[0, -.50], [.34, -.50], [.47, -.45], [.5, -.30], [.46, -.12], [.37, .12], [.30, .32], [.26, .46], [.16, .55], [0, .58]]);
    case 'spiritHood': return spiritHood();
    case 'spiritRelayHood': return spiritHood(true);
    case 'merchantTorso': return softLathe([[0, -.50], [.25, -.49], [.32, -.38], [.40, -.16], [.49, .16], [.50, .32], [.42, .46], [0, .5]]);
    case 'swiftBody': return polyhedron([[0,-.25,.13],[-.13,-.17,.05],[.13,-.17,.05],[-.16,.12,0],[.16,.12,0],[0,.24,.08],[0,-.08,-.29],[0,-.17,-.20],[0,.04,.20]],[[0,1,8],[1,3,8],[3,5,8],[5,4,8],[4,2,8],[2,0,8],[1,7,6,3],[3,6,5],[5,6,4],[4,6,7,2],[0,2,7,1]]);
    case 'swiftHead': return swiftHead();
    case 'swiftTail': return polyhedron([[0,.09,.09],[-.09,.07,.03],[.09,.07,.03],[-.16,-.11,-.28],[.16,-.11,-.28],[0,-.03,-.19],[0,.022,-.12]],[[0,1,3,6],[0,6,4,2],[3,5,6],[4,6,5],[0,2,1],[1,2,4,5,3]],['#cda24d','#dfb65d','#386a65','#386a65','#bd964c','#b88b39']);
    case 'swiftWingL': return reflect(makeGeometry('swiftWingR'));
    case 'swiftWingR': return swiftWing();
    case 'paperBeak': return polyhedron([[-.065,-.025,0],[.065,-.025,0],[0,.035,.24],[0,.065,0],[0,-.04,.19]],[[0,3,2],[3,1,2],[0,2,4],[2,1,4],[0,4,1],[0,1,3]]);
    case 'pageCorner': return polyhedron([[-.5,.5,0],[.5,-.5,0],[.5,.5,-.10],[.12,.12,.34]],[[0,3,2],[3,1,2],[0,1,3]]);
    case 'merchantBase': return softLathe([[0,-.5],[.44,-.5],[.5,-.28],[.5,.08],[.46,.38],[.33,.5],[0,.5]]);
    case 'spiritFigure': return spiritFigure('compass');
    case 'spiritLens': return spiritFigure('lens');
    case 'spiritRelay': return spiritFigure('relay');
    case 'owlBrowL': return sweptBrow(true);
    case 'owlBrowR': return sweptBrow();
    case 'featherFanL': return featherFan(-1);
    case 'featherFanR': return featherFan(1);
    case 'breastFeathers': return featherFan(1, true);
    case 'hexGlass': {const source=new THREE.CylinderGeometry(.36,.49,1,6),g=source.toNonIndexed();source.dispose();g.computeVertexNormals();return g;}
    case 'hexCap': {const source=new THREE.CylinderGeometry(.08,.5,1,6),g=source.toNonIndexed();source.dispose();g.computeVertexNormals();return g;}
    case 'fineRing': return new THREE.TorusGeometry(.5, .027, 6, 28);
    case 'compassStar': return folded([[0, .5], [.07, .13], [.32, .32], [.13, .07], [.5, 0], [.13, -.07], [.32, -.32], [.07, -.13], [0, -.5], [-.07, -.13], [-.32, -.32], [-.13, -.07], [-.5, 0], [-.13, .07], [-.32, .32], [-.07, .13]], .03, .025);
    case 'compassNeedle': return folded([[0,.5],[.085,.09],[.33,0],[.085,-.09],[0,-.5],[-.085,-.09],[-.33,0],[-.085,.09]],.03,.035);
  }
}

export function characterGeometry(kit: SceneKit, form: CharacterForm): THREE.BufferGeometry {
  const cache = owned(kit).geometry;
  let geometry = cache.get(form);
  if (!geometry) { geometry = makeGeometry(form); cache.set(form, geometry); }
  if (!geometry.attributes.uv) {
    const p=geometry.attributes.position,uv=new Float32Array(p.count*2);
    for(let i=0;i<p.count;i++){uv[i*2]=p.getX(i)+.5;uv[i*2+1]=p.getY(i)+.5}
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  }
  return geometry;
}

/** A single scene-owned micrograin gives clay/paper tactile detail without more meshes. */
function surfaceGrain(kit: SceneKit): THREE.DataTexture {
  const owner=owned(kit);
  if(owner.grain) return owner.grain;
  const size=256,data=new Uint8Array(size*size*4);let seed=181;
  for(let i=0;i<size*size;i++) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const grain=183+(seed>>>24)*.28;
    data.set([grain,grain,grain,255],i*4);
  }
  const texture=new THREE.DataTexture(data,size,size);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.userData.platopCharacterGrain=true;
  texture.repeat.set(4,4);texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;owner.grain=texture;return texture;
}

/** Warm frosted glass has a luminous centre and a quiet amber edge. */
function glassGlow(kit: SceneKit): THREE.DataTexture {
  const owner=owned(kit);if(owner.glow)return owner.glow;
  const size=128,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=(x+.5)/size-.5,dy=(y+.5)/size-.5;
    const glow=Math.exp(-(dx*dx*5+dy*dy*3.5));
    const grain=((Math.imul(x+1,374761393)^Math.imul(y+1,668265263))>>>0)%23/255;
    data.set([255,Math.round(97+147*glow-grain*40),Math.round(18+130*glow)],(y*size+x)*4);
  }
  const texture=new THREE.DataTexture(data,size,size);texture.needsUpdate=true;texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;owner.glow=texture;return texture;
}

export function characterMaterial(kit: SceneKit, color: string, finish: CharacterFinish = 'clay'): THREE.MeshStandardMaterial {
  const cache = owned(kit).material, key = `${finish}:${color}`;
  let material = cache.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color,
      roughness: finish === 'ink' ? .24 : finish === 'glaze' ? .51 : finish === 'brass' ? .32 : finish === 'amber' ? .30 : finish === 'paper' ? .94 : finish === 'feather' ? .82 : .76,
      metalness: finish === 'brass' ? .52 : 0,
      ...(finish === 'amber' ? { emissive: '#fff3c1', emissiveIntensity: .80, emissiveMap:glassGlow(kit) } : {}),
    });
    if (finish === 'ink') material.envMapIntensity = .65;
    if (['clay','glaze','paper','feather'].includes(finish)) {
      material.envMapIntensity=.5;
      material.bumpMap=surfaceGrain(kit);material.bumpScale=.010;
      material.map=material.bumpMap;
    }
    cache.set(key, material);
  }
  return material;
}

export function characterMesh(kit: SceneKit, parent: THREE.Object3D, form: CharacterForm, color: string,
  position: Tuple, scale: Tuple, rotation?: Tuple, finish: CharacterFinish = 'clay'): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const geometry=characterGeometry(kit,form);
  let material=characterMaterial(kit,color,finish);
  if(geometry.attributes.color) {
    const cache=owned(kit).material,key=`${finish}:${color}:vertex-colour`;
    if(!cache.has(key)){const variant=material.clone();variant.vertexColors=true;cache.set(key,variant)}
    material=cache.get(key)!;
  }
  const mesh = new THREE.Mesh(geometry,material);
  mesh.name = form;
  mesh.position.set(...position); mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

/** Fit an inset to its helmet or pear belly, sharing its curvature and normals. */
export function curvedFace(kit: SceneKit, parent: THREE.Object3D, color: string, width: number, height: number,
  offset: number, centre: Tuple = [0, 0, 0], finish: CharacterFinish = 'ink', surfaceRadii: Tuple = [.461, .38, .345], bubble = false,
  torsoSurface?: [number, number, number, number], cornerRatio = .43,owlSign=0): THREE.Mesh {
  const cache = owned(kit).geometry;
  const key = `face:${width}:${height}:${offset}:${centre.join(':')}:${surfaceRadii.join(':')}:${bubble}:${torsoSurface?.join(':') ?? ''}:${cornerRatio}:${owlSign}`;
  let geometry = cache.get(key);
  if (!geometry) {
    // Four continuous arcs give a rounded boundary at close range while using
    // fewer triangles than the old grid's visibly stair-stepped outline.
    const radius = Math.min(width, height) * cornerRatio, boundary: Array<[number, number]> = [];
    const corners = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    corners.forEach(([sx, sy], corner) => {
      if(bubble&&corner===3) {
        const tail=new THREE.Path();tail.moveTo(width/2-radius,-height/2);
        tail.quadraticCurveTo(width*.28,-height*.5,width*.32,-height*.57);
        tail.bezierCurveTo(width*.48,-height*.72,width*.48,-height*.55,width*.445,-height*.505);
        tail.bezierCurveTo(width*.39,-height*.46,width*.51,-height*.41,width*.5,-height/2+radius);
        tail.getSpacedPoints(12).forEach(p=>boundary.push([p.x,p.y]));return;
      }
      for (let step = 0; step < 8; step++) {
        const angle = (corner + step / 7) * Math.PI / 2;
        let x = sx * (width / 2 - radius) + Math.cos(angle) * radius;
        let y = sy * (height / 2 - radius) + Math.sin(angle) * radius;
        boundary.push([x, y]);
      }
    });
    if(owlSign){
      const disc=new THREE.Path();disc.moveTo(-.169,.06);
      disc.bezierCurveTo(-.14,.16,-.09,.27,.035,.252);
      disc.bezierCurveTo(.12,.24,.18,.15,.183,.045);
      disc.bezierCurveTo(.188,-.10,.08,-.155,-.169,-.245);
      disc.bezierCurveTo(-.169,-.15,-.169,-.03,-.169,.06);
      boundary.length=0;disc.getSpacedPoints(31).forEach(p=>boundary.push([p.x*owlSign,p.y]));
    }
    const area=boundary.reduce((sum,[x,y],i)=>{const next=boundary[(i+1)%boundary.length];return sum+x*next[1]-next[0]*y},0);if(area<0)boundary.reverse();
    const vertices: number[] = [], normals: number[] = [], indices: number[] = [], rings = 6;
    const contour = torsoSurface ? new THREE.SplineCurve(torsoProfile.map(([r, y]) => new THREE.Vector2(r, y))).getPoints(16) : undefined;
    const add = (x: number, y: number) => {
      const px = x + centre[0], py = y + centre[1];
      let surface: number;
      const normal = new THREE.Vector3();
      if (torsoSurface && contour) {
        const [sx, sy, sz, offsetY] = torsoSurface, normalizedY = (py - offsetY) / sy;
        let row = 0;
        while (row < contour.length - 2 && contour[row + 1].y < normalizedY) row++;
        const a = contour[row], b = contour[row + 1], slope = (b.x - a.x) / (b.y - a.y);
        const radius = Math.max(0, a.x + (normalizedY - a.y) * slope);
        const cross = Math.sqrt(Math.max(.0001, radius * radius - (px / sx) ** 2));
        surface = sz * cross;
        normal.set(sz * px / (sx * sx * cross), -sz * radius * slope / (sy * cross), 1).normalize();
      } else {
        surface = surfaceRadii[2] * Math.sqrt(Math.max(.05, 1 - (px / surfaceRadii[0]) ** 2 - (py / surfaceRadii[1]) ** 2));
        normal.set(px / surfaceRadii[0] ** 2, py / surfaceRadii[1] ** 2, surface / surfaceRadii[2] ** 2).normalize();
      }
      vertices.push(px, py, surface + offset + centre[2] + .010);
      normals.push(normal.x, normal.y, normal.z);
    };
    add(0, 0);
    for (let row = 1; row <= rings; row++) boundary.forEach(([x, y]) => add(x * row / rings, y * row / rings));
    for (let i = 0; i < boundary.length; i++) {
      const next = (i + 1) % boundary.length;
      indices.push(0, 1 + i, 1 + next);
      for (let row = 1; row < rings; row++) {
        const a = 1 + (row - 1) * boundary.length + i, b = 1 + (row - 1) * boundary.length + next;
        const c = a + boundary.length, d = b + boundary.length;
        indices.push(a, c, d, a, d, b);
      }
    }
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(vertices.flatMap((value,index)=>index%3===0?[value/width+.5,vertices[index+1]/height+.5]:[]),2));
    geometry.setIndex(indices); cache.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, characterMaterial(kit, color, finish));
  mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

/** One short shared tube forms a real curved smile instead of a painted blob. */
export function characterSmile(kit: SceneKit, parent: THREE.Object3D, color: string, width: number, depth: number, at: Tuple): void {
  const cache = owned(kit).geometry, key = `smile:${width}:${depth}`;
  let geometry = cache.get(key);
  if (!geometry) {
    const path = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => {
      const angle = Math.PI + i / 8 * Math.PI;
      return new THREE.Vector3(Math.cos(angle) * width, Math.sin(angle) * depth, 0);
    }));
    geometry = new THREE.TubeGeometry(path, 12, .008, 5, false); cache.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, characterMaterial(kit, color, 'ink')); mesh.position.set(...at); parent.add(mesh);
}

/** Small inlaid strokes share their tube surface across all scene characters. */
export function characterStroke(kit: SceneKit, parent: THREE.Object3D, color: string, points: Tuple[],
  radius = .008, finish: CharacterFinish = 'brass'): THREE.Mesh {
  const cache = owned(kit).geometry, key = `stroke:${radius}:${points.map(point => point.join(':')).join(';')}`;
  let geometry = cache.get(key);
  if (!geometry) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    geometry = new THREE.TubeGeometry(curve, Math.max(4, points.length * 2), radius, 4, false); cache.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, characterMaterial(kit, color, finish));
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

export function characterEyeArc(kit: SceneKit, parent: THREE.Object3D, color: string, at: Tuple,
  width = .045, height = .026, finish: CharacterFinish = 'ink'): THREE.Mesh {
  const mesh = characterStroke(kit, parent, color,
    [[-width, 0, 0], [-width * .6, height * .82, 0], [0, height, 0], [width * .6, height * .82, 0], [width, 0, 0]], .010, finish);
  mesh.position.set(...at); return mesh;
}

/** Stamp a thin ornamental relief onto a curved shell once, never per frame. */
export function fitCharacterRelief(mark: THREE.Object3D, shell: THREE.Mesh,standOff=.012, conformPaper=false): void {
  shell.parent!.updateWorldMatrix(true,true);mark.updateWorldMatrix(true,true);
  const ray=new THREE.Raycaster(),point=new THREE.Vector3(),inverse=new THREE.Matrix4();
  const bounds=new THREE.Box3().setFromObject(mark);
  mark.traverse(object=>{
    const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
    let geometry=mesh.geometry.clone();
    if(conformPaper) {
      if(geometry.index){const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat;}
      // Broad folded face panels cross several planes of the paper head.
      // Subdivide before projection so an interpolated triangle cannot cut
      // through a ridge between its otherwise correctly fitted endpoints.
      for(let level=0;level<2;level++){
        const next=new THREE.BufferGeometry();
        for(const [name,attribute] of Object.entries(geometry.attributes)){
          const values:number[]=[];
          for(let i=0;i<attribute.count;i+=3){
            const a=Array.from({length:attribute.itemSize},(_,j)=>attribute.array[i*attribute.itemSize+j]);
            const b=Array.from({length:attribute.itemSize},(_,j)=>attribute.array[(i+1)*attribute.itemSize+j]);
            const c=Array.from({length:attribute.itemSize},(_,j)=>attribute.array[(i+2)*attribute.itemSize+j]);
            const ab=a.map((v,j)=>(v+b[j])/2),bc=b.map((v,j)=>(v+c[j])/2),ca=c.map((v,j)=>(v+a[j])/2);
            for(const v of [a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca])values.push(...v);
          }
          next.setAttribute(name,new THREE.Float32BufferAttribute(values,attribute.itemSize));
        }
        geometry.dispose();geometry=next;
      }
    }
    const position=geometry.attributes.position;
    inverse.copy(mesh.matrixWorld).invert();
    for(let i=0;i<position.count;i++) {
      point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
      const relief=conformPaper?0:Math.max(0,point.z-bounds.min.z);
      ray.set(new THREE.Vector3(point.x,point.y,2),new THREE.Vector3(0,0,-1));
      const hit=ray.intersectObject(shell,false)[0];
      if(hit) {point.z=hit.point.z+standOff+relief;point.applyMatrix4(inverse);position.setXYZ(i,point.x,point.y,point.z);}
    }
    geometry.computeVertexNormals();mesh.geometry=geometry;
  });
}

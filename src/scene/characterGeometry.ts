import * as THREE from 'three';
import type { SceneKit } from './primitives';
import { owlEyeRecess, OWL_SOCKET_RADIUS } from './characterSurface';

export type CharacterForm = 'torso' | 'scoutBody' | 'helmet' | 'bridgeHelmet' | 'lanternHousing' | 'lanternBezel' | 'owlBody' | 'owlHead' | 'wing' | 'tuft' | 'embracingBody' | 'embracingArmL' | 'embracingArmR'
  | 'lanternGlass' | 'lanternCap' | 'lanternBase' | 'lanternHandle' | 'sphere' | 'bean' | 'fittedSole' | 'detail' | 'limb' | 'ankle' | 'beak' | 'ring' | 'heart' | 'neckBand'
  | 'book' | 'bowedCover' | 'keeperCover' | 'envelope' | 'cloak' | 'cape' | 'capePanel' | 'feather' | 'featherCore' | 'toe' | 'paperBody' | 'paperChestL' | 'paperChestR' | 'paperBackL' | 'paperBackR' | 'paperBrow' | 'paperEarL' | 'paperEarR' | 'paperEchoHead' | 'paperQuillHead' | 'paperWing' | 'paperTail' | 'paperDisc' | 'paperDiscL' | 'pageFold' | 'hoodTip' | 'scroll'
  | 'spiritBody' | 'spiritHood' | 'spiritRelayHood' | 'merchantTorso' | 'swiftBody' | 'swiftHead' | 'swiftTail' | 'swiftWingL' | 'swiftWingR' | 'paperOwlWingL' | 'paperOwlWingR' | 'paperHoldingWing' | 'paperCrownBackL' | 'paperCrownBackR' | 'wayfinderBody'
  | 'owlBrowL' | 'owlBrowR' | 'featherFanL' | 'featherFanR' | 'breastFeathers' | 'hexGlass' | 'hexCap' | 'hexBase' | 'fineRing' | 'compassStar' | 'compassNeedle' | 'compassPointer' | 'paperBeak' | 'pageCorner' | 'merchantBase' | 'spiritFigure' | 'spiritLens' | 'spiritRelay' | 'compassCowl' | 'lensCowl' | 'relayCowl';
export type CharacterFinish = 'clay' | 'glaze' | 'ink' | 'warmInk' | 'brass' | 'amber' | 'paper' | 'feather' | 'facialFeather' | 'plumage' | 'cloth' | 'glass';
type Tuple = [number, number, number];
const torsoProfile: Array<[number, number]> = [[0, -.5], [.32, -.48], [.45, -.37], [.50, -.10], [.49, .16], [.43, .34], [.29, .45], [.14, .49], [0, .5]];
const wayfinderProfile: Array<[number,number]>=[[0,-.5],[.22,-.48],[.42,-.37],[.51,-.10],[.46,.08],[.29,.18],[.14,.235],[0,.26]];
const wayfinderContour=new THREE.SplineCurve(wayfinderProfile.map(([r,y])=>new THREE.Vector2(r,y))).getPoints(16);
const owlProfile:Array<[number,number]>=[[0,-.5],[.25,-.47],[.42,-.30],[.5,-.02],[.48,.20],[.35,.42],[0,.5]];
const owlContour=new THREE.SplineCurve(owlProfile.map(([r,y])=>new THREE.Vector2(r,y))).getPoints(12);
interface CharacterResources {
  geometry: Map<string, THREE.BufferGeometry>;
  material: Map<string, THREE.MeshStandardMaterial>;
  grains?: Map<string, THREE.DataTexture>;
  glow?: THREE.DataTexture;
  facialGrain?: THREE.DataTexture;
  plumageGrain?: THREE.DataTexture;
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
function helmet(owl = false,boxed=false): THREE.BufferGeometry {
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
    const edge=boxed?1-THREE.MathUtils.smoothstep(z,.12,.27):0;
    const px=THREE.MathUtils.lerp(x*cheek*(1+.12*jaw),Math.sign(x)*.5*Math.pow(Math.abs(x)*2,.63),edge);
    const py=THREE.MathUtils.lerp(y-.035*jaw,Math.sign(y)*.5*Math.pow(Math.abs(y)*2,.72),edge);
    const recess=owl&&back>0?owlEyeRecess(px*.78,py*.65)*1.55/.54:0;
    position.setXYZ(i, px, py, back-recess);
  }
  return smoothDeformedSurface(geometry);
}

function speechBoundary(width:number,height:number):Array<[number,number]> {
  const radius=Math.min(width,height)*.43,boundary:Array<[number,number]>=[];
  [[1,1],[-1,1],[-1,-1],[1,-1]].forEach(([sx,sy],corner)=>{
    if(corner===3){
      const tail=new THREE.Path();tail.moveTo(width/2-radius,-height/2);
      tail.quadraticCurveTo(width*.24,-height*.50,width*.29,-height*.53);
      tail.quadraticCurveTo(width*.41,-height*.65,width*.42,-height*.60);
      tail.quadraticCurveTo(width*.37,-height*.44,width*.435,-height*.36);
      tail.quadraticCurveTo(width*.50,-height*.28,width*.50,-height/2+radius);
      tail.getSpacedPoints(20).forEach(p=>boundary.push([p.x,p.y]));return;
    }
    for(let step=0;step<14;step++){
      const a=(corner+step/13)*Math.PI/2;
      boundary.push([sx*(width/2-radius)+Math.cos(a)*radius,sy*(height/2-radius)+Math.sin(a)*radius]);
    }
  });
  return boundary;
}

/** A true open face aperture: the amber sits inside a green housing, not
 * above an unbroken helmet. Front lip and back share a continuous oval rim. */
function lanternHousing():THREE.BufferGeometry {
  const opening=speechBoundary(.574,.439),columns=opening.length,rows=16;
  const vertices:number[]=[],indices:number[]=[];
  for(let row=0;row<=rows;row++)for(const [x,y]of opening){
    const theta=Math.atan2(y/.375,x/.410),front=row<=6;
    const radial=front?row/6:(row-6)/10;
    const px=front?THREE.MathUtils.lerp(x,.410*Math.cos(theta),radial):.410*Math.cos(theta)*(1-radial);
    const py=front?THREE.MathUtils.lerp(y,.375*Math.sin(theta),radial):.375*Math.sin(theta)*(1-radial);
    const pz=(front?1:-1)*.305*Math.sqrt(Math.max(0,1-(px/.410)**2-(py/.375)**2));
    vertices.push(px,py-.002,pz);
  }
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const a=row*columns+col,b=row*columns+(col+1)%columns,c=a+columns,d=b+columns;
    indices.push(a,c,b,b,c,d);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);
  geometry.userData.characterEllipsoid={radii:[.410,.375,.305],centerY:-.002,shell:true};
  return smoothDeformedSurface(geometry);
}

/** Only a rim, never a second filled face behind the luminous insert. Closely
 * overlapping full panels fight for depth at the wide campus camera distance. */
function lanternBezel():THREE.BufferGeometry {
  const inner=speechBoundary(.554,.419),outer=speechBoundary(.59,.455),columns=inner.length;
  const vertices:number[]=[],indices:number[]=[];
  for(const[ring,points]of[inner,outer].entries())for(const[x,y]of points){
    vertices.push(x,y-.002,.305*Math.sqrt(Math.max(.05,1-(x/.410)**2-((y-.002)/.375)**2))+(ring?.002:.012));
  }
  for(let i=0;i<columns;i++){const j=(i+1)%columns;indices.push(i,i+columns,j,j,i+columns,j+columns);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  geometry.userData.characterEllipsoid={radii:[.410,.375,.305]};return geometry;
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

/** A flexible thin cover has a gently bowed face, not a padded cuboid. Both
 * skins share the bow and join at their edge; the page block stays separate. */
function bowedCover(bow=.65):THREE.BufferGeometry {
  const shape=new THREE.Shape(),r=.13;
  shape.moveTo(-.5+r,-.5);shape.lineTo(.5-r,-.5);shape.quadraticCurveTo(.5,-.5,.5,-.5+r);
  shape.lineTo(.5,.5-r);shape.quadraticCurveTo(.5,.5,.5-r,.5);shape.lineTo(-.5+r,.5);
  shape.quadraticCurveTo(-.5,.5,-.5,.5-r);shape.lineTo(-.5,-.5+r);shape.quadraticCurveTo(-.5,-.5,-.5+r,-.5);
  const boundary=shape.getSpacedPoints(32).slice(0,-1),rings=7,count=boundary.length;
  const positions:number[]=[],uv:number[]=[],indices:number[]=[];
  const add=(x:number,y:number,side:number)=>{
    positions.push(x,y,side*.46+bow*Math.cos(x*Math.PI)*Math.cos(y*Math.PI));uv.push(x+.5,y+.5);
  };
  for(const side of [1,-1]){
    const start=positions.length/3;add(0,0,side);
    for(let row=1;row<=rings;row++)for(const p of boundary)add(p.x*row/rings,p.y*row/rings,side);
    const triangle=(a:number,b:number,c:number)=>indices.push(...(side>0?[a,b,c]:[a,c,b]));
    for(let col=0;col<count;col++){
      const next=(col+1)%count;triangle(start,start+1+col,start+1+next);
      for(let row=1;row<rings;row++){
        const a=start+1+(row-1)*count+col,b=start+1+(row-1)*count+next,c=a+count,d=b+count;
        triangle(a,c,d);triangle(a,d,b);
      }
    }
  }
  const layer=1+count*rings;
  // The cut edge is a separate normal domain. Sharing it with the very thin
  // bowed skins exaggerates the rim after non-uniform scaling.
  const rim=positions.length/3;
  for(const side of [1,-1])for(const p of boundary)add(p.x,p.y,side);
  for(let col=0;col<count;col++){
    const a=rim+col,b=rim+(col+1)%count;
    indices.push(a,a+count,b+count,a,b+count,b);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const normals=geometry.attributes.normal,normal=new THREE.Vector3();
  for(let i=0;i<layer*2;i++){
    const x=positions[i*3],y=positions[i*3+1],sign=i<layer?1:-1;
    normal.set(bow*Math.PI*Math.sin(x*Math.PI)*Math.cos(y*Math.PI),bow*Math.PI*Math.cos(x*Math.PI)*Math.sin(y*Math.PI),1).multiplyScalar(sign).normalize();
    normals.setXYZ(i,normal.x,normal.y,normal.z);
  }
  geometry.userData.coverSkinVertices=layer;
  return geometry;
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

/** Both the cloth and its piping follow the real elliptical torso, including its back. */
export function navigatorCapePoint(t:number,angle:number,inset=0):Tuple {
  const y=.25-t*.70+.018*Math.sin(angle)*Math.sin(Math.PI*t)-.045*Math.sin(angle)**2*(1-t)**2,normalized=(y+.005)/1.06;
  let row=0;while(row<wayfinderContour.length-2&&wayfinderContour[row+1].y<normalized)row++;
  const a=wayfinderContour[row],b=wayfinderContour[row+1],r=a.x+(b.x-a.x)*(normalized-a.y)/(b.y-a.y);
  // The cloth spreads from its neck fastening before hanging in broad folds.
  // Sweeping the pleats diagonally avoids a row of stiff vertical tubes.
  const fold=(.024*Math.sin(angle*3.0+t*.75)+.006*Math.sin(angle*6-t))*Math.sin(t*Math.PI*.85);
  const drape=.265+.225*THREE.MathUtils.smoothstep(t,0,.6);
  // The lining remains inset even at the silhouette limit. Clamping both
  // layers together would erase their thickness at the outermost pleats.
  return [Math.sin(angle)*(Math.min(.512,Math.max(r*.85+.027,drape+fold))-inset),y,Math.cos(angle)*(Math.min(.43,Math.max(r*.64+.029,drape*.78+fold))-inset)];
}

/** Continuous forearm from shoulder into a rounded inward clasp, not a pad
 * pasted onto the belly. The sweep is built once and uses the existing joint. */
function embracingArm():THREE.BufferGeometry {
  const origin=new THREE.Vector3(.245,.23,.05);
  const curve=new THREE.CatmullRomCurve3([[.245,.23,.05],[.25,.13,.13],[.20,.015,.22],[.065,-.055,.245],[-.035,-.07,.245]].map(p=>new THREE.Vector3(...p).sub(origin)));
  const rows=12,columns=12,frames=curve.computeFrenetFrames(rows,false),positions:number[]=[],indices:number[]=[];
  for(let row=0;row<=rows;row++){
    const t=row/rows,centre=curve.getPointAt(t),radius=.104*Math.pow(Math.max(0,Math.sin(Math.PI*t)),.45);
    for(let col=0;col<=columns;col++){
      const angle=col/columns*Math.PI*2,delta=frames.normals[row].clone().multiplyScalar(Math.cos(angle)*radius).addScaledVector(frames.binormals[row],Math.sin(angle)*radius);
      positions.push(Math.max(.0015,centre.x+origin.x+delta.x)-origin.x,centre.y+delta.y,centre.z+delta.z*.80);
      if(row<rows&&col<columns){const a=row*(columns+1)+col,b=a+1,c=a+columns+1,d=c+1;indices.push(a,b,c,b,d,c);}
    }
  }
  const indexed=new THREE.BufferGeometry();indexed.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));indexed.setIndex(indices);
  smoothDeformedSurface(indexed);const geometry=indexed.toNonIndexed();indexed.dispose();return geometry;
}

/** Open-front lined cape follows the shoulders and flares into a rounded hem. */
function cape(): THREE.BufferGeometry {
  const vertices: number[] = [], indices: number[] = [], columns = 28, rows = 13;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows,bound=.035+1.23*Math.sin(t*Math.PI/2);
    for (let column = 0; column <= columns; column++) {
      const angle = bound + column / columns * (Math.PI*2-bound*2);
      vertices.push(...navigatorCapePoint(t,angle));
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
        indices.push(a, d, b, a, c, d);
      }
    }
  }
  // A turned-in lining and joined rims give the cape thickness at the collar
  // and lapels. Both sides remain visible from the close observer camera.
  const outer=vertices.length/3,front=[...indices];
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const t=row/rows,bound=.035+1.23*Math.sin(t*Math.PI/2),angle=bound+col/columns*(Math.PI*2-bound*2);
    vertices.push(...navigatorCapePoint(t,angle,.014));
  }
  for(let i=0;i<front.length;i+=3)indices.push(front[i]+outer,front[i+2]+outer,front[i+1]+outer);
  const join=(a:number,b:number)=>indices.push(a,b,b+outer,a,b+outer,a+outer);
  for(let col=0;col<columns;col++){join(col,col+1);join(rows*(columns+1)+col+1,rows*(columns+1)+col);}
  for(let row=0;row<rows;row++){join((row+1)*(columns+1),row*(columns+1));join(row*(columns+1)+columns,(row+1)*(columns+1)+columns);}
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function feather(): THREE.BufferGeometry {
  // A lightly cupped, thin feather, not a stretched solid diamond. The same
  // closed outline works on the breast and on the overlapping wing fans.
  const outline:Tuple[]=[[0,.5,0],[-.28,.44,0],[-.45,.24,0],[-.46,.04,0],[-.35,-.23,0],[-.17,-.48,0],[0,-.62,0],[.14,-.47,0],[.31,-.23,0],[.42,.04,0],[.40,.26,0],[.25,.44,0]];
  const points:Tuple[]=[...outline,[0,.02,.10],...outline.map(([x,y,z])=>[x,y,z-.014] as Tuple),[0,.02,.086]];
  const faces:number[][]=[];
  for(let i=0;i<12;i++){const j=(i+1)%12;faces.push([i,12,j],[i+13,j+13,25],[i,j,j+13,i+13]);}
  return smoothDeformedSurface(polyhedron(points,faces));
}

/** Broad rounded vanes keep their width almost to the tip. The final short
 * section closes the contour without the long spear-shaped blade that made
 * the layered wing look like hanging armour. Triangle count is unchanged. */
function flightFeather():THREE.BufferGeometry {
  const points:Tuple[]=[[0,.5,0]],faces:number[][]=[];
  for(const t of [.16,.40,.70,.95])for(const side of [-1,0,1]){
    const arch=Math.sin(Math.PI*t),width=.46*Math.pow(arch,.45)*(1-.24*t);
    points.push([side*width,.5-1.12*t,.065*arch+.070*arch*(1-side*side)+.04*t*t]);
  }
  points.push([0,-.62,.04]);
  faces.push([0,2,1],[0,3,2]);
  for(let row=0;row<3;row++)for(let col=0;col<2;col++){
    const a=1+row*3+col,b=a+1,c=a+3,d=c+1;
    faces.push([a,b,d],[a,d,c]);
  }
  faces.push([10,11,13],[11,12,13]);
  // These cupped sheets are concave. A centroid-based convex-solid winding
  // guess flips some vane triangles and leaves hairline silhouettes. Keep the
  // authored front, matching back and connecting rim winding explicitly.
  faces.forEach(face=>face.reverse());
  const count=points.length,front=faces.map(face=>[...face]);
  points.push(...points.map(([x,y,z])=>[x,y,z-.010] as Tuple));
  faces.push(...front.map(face=>face.map(i=>i+count).reverse()));
  const rim=[0,1,4,7,10,13,12,9,6,3];
  for(let i=0;i<rim.length;i++){const a=rim[i],b=rim[(i+1)%rim.length];faces.push([a,b,b+count,a+count]);}
  return smoothDeformedSurface(polyhedron(points,faces,undefined,true));
}

function polyhedron(vertices: Tuple[], faces: number[][],faceColors?: string[],preserveWinding=false): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[]=[];
  const centre=vertices.reduce((sum,p)=>sum.add(new THREE.Vector3(...p)),new THREE.Vector3()).divideScalar(vertices.length);
  for (const [f,face] of faces.entries()) for (let i = 1; i < face.length - 1; i++) {
    const a=new THREE.Vector3(...vertices[face[0]]),b=new THREE.Vector3(...vertices[face[i]]),c=new THREE.Vector3(...vertices[face[i+1]]);
    const outward=b.clone().sub(a).cross(c.clone().sub(a)).dot(a.clone().add(b).add(c).multiplyScalar(1/3).sub(centre));
    for (const index of !preserveWinding&&outward<0?[face[0],face[i+1],face[i]]:[face[0], face[i], face[i + 1]]) {positions.push(...vertices[index]);if(faceColors)colors.push(...new THREE.Color(faceColors[f]).toArray());}
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if(faceColors)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals(); return geometry;
}

function swiftHead(): THREE.BufferGeometry {
  return foldedBirdVolume([[-.21,.055,.07,-.015],[-.10,.125,.16,.01],[.04,.152,.17,.01],[.145,.112,.13,0],[.195,.025,.045,-.02]]);
}

/** Closed elliptical paper sections give the bird a breast and round crown
 * from every viewpoint. Broad quads keep the folds intentional, not noisy. */
function foldedBirdVolume(rings:Array<[number,number,number,number]>,softCrown=false):THREE.BufferGeometry {
  const vertices:Tuple[]=[],faces:number[][]=[],columns=softCrown?16:10;
  for(const[y,rx,rz,z]of rings)for(let i=0;i<columns;i++){
    const a=i/columns*Math.PI*2;
    const fold=softCrown&&y<.23?.025*Math.sin(a+.7)*Math.sin(Math.max(0,(y+.20)/.43)*Math.PI):0;
    let px=Math.sin(a)*rx,py=y+fold,pz=Math.cos(a)*rz+z;
    if(softCrown&&py<.04){
      // The underside folds upward toward the tail. A horizontal bottom ring
      // made the longer breast an extruded peg; a narrow front keel and a
      // higher, broader rear close it as a folded wedge instead.
      const lower=THREE.MathUtils.smoothstep(.04-py,0,.275);
      py+=.15*lower*THREE.MathUtils.smoothstep(-pz,-.02,.08);
      px*=1-.78*THREE.MathUtils.smoothstep(-py,.10,.24);
    }
    if(softCrown&&py<.26){
      // Carry the same diagonal paper planes from cheek through throat.
      // Horizontal elliptical sections alone left a round cap above the
      // wing folds even though the underlying mesh was already connected.
      pz=Math.min(pz,.140+.35*py);
      const cheekWidth=.098+.24*py-.35*Math.max(0,pz);
      px=Math.sign(px)*Math.min(Math.abs(px),Math.max(.018,cheekWidth));
    }
    vertices.push([px,py,pz]);
  }
  for(let row=0;row<rings.length-1;row++)for(let col=0;col<columns;col++){const j=(col+1)%columns;faces.push([row*columns+col,row*columns+j,(row+1)*columns+j,(row+1)*columns+col]);}
  faces.push(Array.from({length:columns},(_,i)=>i),Array.from({length:columns},(_,i)=>(rings.length-1)*columns+i));
  const geometry=polyhedron(vertices,faces);
  if(softCrown){
    const foldedNormals=geometry.attributes.normal.clone();smoothDeformedSurface(geometry);
    const p=geometry.attributes.position,n=geometry.attributes.normal,normal=new THREE.Vector3(),flat=new THREE.Vector3();
    for(let i=0;i<p.count;i++){
      // Keep the same paper language through the neck: a fully smooth crown
      // above a flat-shaded breast read as a ceramic ball glued to origami.
      const blend=.45+.20*THREE.MathUtils.smoothstep(p.getY(i),-.03,.23);
      normal.fromBufferAttribute(n,i);flat.fromBufferAttribute(foldedNormals,i).lerp(normal,blend).normalize();n.setXYZ(i,flat.x,flat.y,flat.z);
    }
  }
  return geometry;
}

function swiftWing(): THREE.BufferGeometry {
  // The long fold begins at the breast and narrows toward two swept tips.
  // A broad squared-off lower lobe read as an attached paddle, rather than
  // the slender overlapping paper folds in Swift's chosen portrait.
  const boundary:Tuple[]=[[0,.045,.075],[.035,.27,-.48],[.045,.005,-.22],[.045,-.30,-.40],[.055,-.125,.005]];
  const front:Tuple[]=[...boundary,[.075,-.025,-.12]];
  const vertices:Tuple[]=[...front,...front.map(([x,y,z])=>[x-.006,y,z] as Tuple)];
  // This concave sheet cannot use the convex-solid centroid winding guess.
  // Match the same ridge on both sides and join their boundary explicitly.
  const faces:number[][]=[[0,5,1],[1,5,2],[2,5,3],[3,5,4],[4,5,0]];
  faces.push(...faces.map(face=>face.map(i=>i+6).reverse()));
  for(let i=0;i<5;i++){const j=(i+1)%5;faces.push([i,j,j+6,i+6]);}
  return polyhedron(vertices,faces,['#e0b15e','#d5a24e','#b59347','#d7ab59','#e5bc74',...Array(5).fill('#3c6d68'),'#b38948','#47736b','#3b6e65','#c59854','#b68b45'],true);
}

/** Folded shoulders wrap around the belly and meet a tucked lower wing tip. */
function paperOwlWing():THREE.BufferGeometry {
  return foldedSheet([[-.035,.09,.035],[.025,-.12,.09],[-.105,-.42,.20],[-.15,-.30,.22],[-.10,-.015,.14]],[-.075,-.20,.18],
    ['#dbc29a','#d8bf97','#cdb089','#dfc69f','#e5ceaa']);
}

/** A folded sheet has two matching creased surfaces and a paper-thin edge.
 * Its rear is not the flat cap of an extruded polygon. Explicit winding is
 * important: concave folds cannot use a solid's centroid to orient faces. */
function foldedSheet(outline:Tuple[],ridge:Tuple,tones:string[]):THREE.BufferGeometry {
  const area=outline.reduce((sum,p,i)=>{const next=outline[(i+1)%outline.length];return sum+p[0]*next[1]-next[0]*p[1]},0);
  if(area>0){outline=[...outline].reverse();tones=[...tones].reverse();}
  const count=outline.length,points=[...outline,ridge],positions:number[]=[],colours:number[]=[];
  const add=(ids:number[],rear:boolean,tone:string)=>{
    // A folded sheet is one stock of paper. Its normals supply the fold
    // contrast; strongly different painted facets made it look carved.
    const colour=new THREE.Color(tone).lerp(new THREE.Color('#dfc7a2'),.65);
    for(const id of ids){const p=points[id];positions.push(p[0],p[1],p[2]-(rear?.010:0));colours.push(...colour.toArray());}
  };
  for(let i=0;i<count;i++){
    const j=(i+1)%count;
    add([i,count,j],false,tones[i]);add([i,j,count],true,'#cbb18d');
    // Matching front/back corner pairs form a narrow turn at the edge.
    const a=points[i],b=points[j];
    for(const p of [a,b,[b[0],b[1],b[2]-.010],a,[b[0],b[1],b[2]-.010],[a[0],a[1],a[2]-.010]]){
      positions.push(...p);colours.push(...new THREE.Color('#c2a37a').toArray());
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));geometry.computeVertexNormals();return geometry;
}

/** Folded volumes close into a tapered back, not an extruded cardboard slab. */
function paperOwlHead(quill=false): THREE.BufferGeometry {
  const outline:Array<[number,number]>=quill?
    [[-.41,-.20],[-.28,-.30],[-.01,-.44],[.28,-.30],[.47,-.10],[.45,.24],[.54,.51],[.19,.41],[-.08,.43],[-.48,.53],[-.44,.14]]:
    [[-.44,-.19],[-.28,-.30],[.015,-.44],[.29,-.30],[.47,-.08],[.42,.28],[.23,.48],[-.23,.44],[-.47,.14]];
  const cheek:Array<[number,number]>=[[.012,.02],[.045,.25],[.16,.36],[.29,.32],[.415,.14],[.39,-.06],[.24,-.26],[.014,-.405]];
  const holes=[cheek.map(([x,y])=>new THREE.Vector2(-x,y)),cheek.map(([x,y])=>new THREE.Vector2(x,y))];
  const outer=outline.map(([x,y])=>new THREE.Vector2(x,y));
  const points=[...outer,...holes.flat()];
  const faceDepth=(x:number,y:number,outer=false)=>(outer?.30+(.4-Math.abs(x))*.12:.45-.10*Math.abs(x))-.20*THREE.MathUtils.smoothstep(-y,.06,.44);
  // The heart's lower folds turn back into the breast. A constant-depth
  // face plane made a projecting mask above an unnecessarily dark neck gap.
  const vertices:Tuple[]=points.map((p,i)=>[p.x,p.y,faceDepth(p.x,p.y,i<outline.length)]);
  const faces=THREE.ShapeUtils.triangulateShape(outer,holes),colors:string[]=faces.map(()=>quill?'#cfb18a':'#c7aa83');
  for(let side=0;side<2;side++){
    const center=vertices.length;vertices.push([side?.18:-.18,-.015,.46]);
    for(let i=0;i<cheek.length;i++){const a=outline.length+side*cheek.length+i,b=outline.length+side*cheek.length+(i+1)%cheek.length;faces.push([a,b,center]);colors.push('#edd6b0');}
  }
  const shoulder=vertices.length;vertices.push(...outline.map(([x,y])=>[
    x*.92,y*.89,
    // A narrow folded return at the exposed jaw; the crown and rear keep
    // their volume. A thick extrusion here made the face look carved.
    THREE.MathUtils.lerp(.07-Math.abs(x)*.10,faceDepth(x,y,true)-.018,THREE.MathUtils.smoothstep(-y,.04,.28)),
  ] as Tuple));
  const back=vertices.length;vertices.push(...outline.map(([x,y])=>[x*.72,y*.76,-.23] as Tuple));
  const rearCenter=vertices.length;vertices.push([-.035,.03,-.30]);
  for(let i=0;i<outline.length;i++){
    const j=(i+1)%outline.length;faces.push([i,shoulder+i,shoulder+j],[i,shoulder+j,j],[shoulder+i,back+i,back+j],[shoulder+i,back+j,shoulder+j],[back+j,back+i,rearCenter]);
    colors.push('#c7ad8a','#d0b591','#c1a582','#c8b18c','#ba9e7a');
  }
  return polyhedron(vertices,faces,colors);
}

function paperOwlBody(): THREE.BufferGeometry {
  // Diagonal valley/mountain folds replace stacked hexagonal box sections.
  // A projecting breast ridge folds into the lower centre seam; the back
  // converges into the same shoulder and foot vertices, with no extruded wall.
  // The visible chest is carried by the two overlapping paper sheets. Keep
  // this closed inner volume behind them instead of piercing their folds.
  const vertices:Tuple[]=[[0,.28,.035],[-.38,.15,.04],[.36,.15,.04],[-.49,-.03,.02],[.46,-.08,.03],[-.29,-.50,.06],[.28,-.50,.07],[-.035,-.08,.07],[.07,-.26,.12],[0,-.50,.08],[0,.22,-.10],[0,-.05,-.22],[0,-.5,-.10],[-.33,0,-.10],[.30,0,-.10]];
  const faces=[[0,1,7],[0,7,2],[1,3,7],[7,3,8],[7,8,4],[7,4,2],[3,5,8],[8,5,9],[8,9,6],[8,6,4],[0,10,1],[0,2,10],[1,10,13],[1,13,3],[2,14,10],[2,4,14],[10,11,13],[10,14,11],[3,13,5],[4,6,14],[13,11,12],[13,12,5],[14,12,11],[14,6,12],[5,12,9],[9,12,6]];
  return polyhedron(vertices,faces,faces.map((_,index)=>index<10?'#dec49e':'#ceb38b'));
}

function reflect(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const reflected = geometry.clone(), position = reflected.attributes.position;
  for (let i = 0; i < position.count; i += 3) {
    const a: Tuple = [-position.getX(i), position.getY(i), position.getZ(i)];
    const b: Tuple = [-position.getX(i + 1), position.getY(i + 1), position.getZ(i + 1)];
    const c: Tuple = [-position.getX(i + 2), position.getY(i + 2), position.getZ(i + 2)];
    position.setXYZ(i, ...a); position.setXYZ(i + 1, ...c); position.setXYZ(i + 2, ...b);
    const normals=reflected.attributes.normal;
    if(normals){
      const a:Tuple=[-normals.getX(i),normals.getY(i),normals.getZ(i)],b:Tuple=[-normals.getX(i+1),normals.getY(i+1),normals.getZ(i+1)],c:Tuple=[-normals.getX(i+2),normals.getY(i+2),normals.getZ(i+2)];
      normals.setXYZ(i,...a);normals.setXYZ(i+1,...c);normals.setXYZ(i+2,...b);
    }
    const colors=reflected.attributes.color;
    if(colors){const r=colors.getX(i+1),g=colors.getY(i+1),b=colors.getZ(i+1);colors.setXYZ(i+1,colors.getX(i+2),colors.getY(i+2),colors.getZ(i+2));colors.setXYZ(i+2,r,g,b);}
  }
  // Recomputing non-indexed normals would make the mirrored half faceted,
  // even when the original surface deliberately carries smooth shading.
  geometry.dispose(); return reflected;
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

function spiritProfile(variant:'compass'|'lens'|'relay'):Array<[number,number]> {
  const profile: Array<[number,number]>=[[0,-.617],[.43,-.617],[.51,-.51],[.51,-.30],[.43,-.08],[.29,.21],[.31,.32],[.36,.46],[.33,.62],[.22,.75]];
  if(variant!=='compass'){profile[1]=[.26,-.603];profile[2]=[.47,-.52];profile[3]=[.49,-.30];}
  profile.push(...(variant==='compass'?[[.12,.84],[.055,.93],[0,1.03]]:[[.09,.80],[0,.81]]) as Array<[number,number]>);
  return profile;
}
function spiritFigure(variant:'compass'|'lens'|'relay'): THREE.BufferGeometry {
  const profile=spiritProfile(variant);
  const geometry=softLathe(profile,32,32),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const y=p.getY(i),hem=Math.pow(Math.max(0,(.23-y)/.847),1.25);
    const theta=Math.atan2(p.getX(i),p.getZ(i)),t=Math.min(1,Math.max(0,(.20-y)/.81));
    const crease=(variant==='lens'?-1:1)*(-.85+1.6*t);
    const fold=.024*hem*Math.sin(theta*3+y*5)+.085*Math.sin(Math.PI*t)*Math.exp(-(((theta-crease)/.40)**2));
    p.setXYZ(i,p.getX(i)+Math.sin(theta)*fold+(variant==='compass'?0:variant==='lens'?-.17:.17)*hem,y,p.getZ(i)+Math.cos(theta)*fold);
  }
  return smoothDeformedSurface(geometry);
}

/** An actual overlapping hood, open around the face and draped down the back. */
function spiritCowl(variant:'compass'|'lens'|'relay'): THREE.BufferGeometry {
  const profile=spiritProfile(variant);
  const contour=new THREE.SplineCurve(profile.map(([r,y])=>new THREE.Vector2(r,y))).getPoints(128);
  const radiusAt=(y:number)=>{let i=0;while(i<contour.length-2&&contour[i+1].y<y)i++;const a=contour[i],b=contour[i+1];return Math.max(0,a.x+(b.x-a.x)*(y-a.y)/(b.y-a.y));};
  const levels=variant==='compass'?[.24,.35,.51,.67,.76,.87,1.025]:[.24,.35,.51,.67,.76,.79,.807];
  const gaps=[0,.85,1.08,.90,.52,.16,0],columns=32,rows=20,vertices:number[]=[],indices:number[]=[],uv:number[]=[];
  const edge=new THREE.SplineCurve(levels.map((y,i)=>new THREE.Vector2(gaps[i],y))).getPoints(rows);
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const bound=Math.max(0,edge[row].x),angle=bound+col/columns*(Math.PI*2-bound*2);
    const drape=Math.max(0,1-row/7),y=edge[row].y-.48*drape*drape*Math.sin(angle/2)**2-.06*drape*Math.sin(angle)-(variant==='relay'?.32*drape*Math.max(0,Math.sin(angle)):0);
    const hem=Math.pow(Math.max(0,(.23-y)/.847),1.25),r=radiusAt(y)+.038+.050*drape*Math.sin(angle/2)**2;
    const fold=.018*hem*Math.sin(angle*3+y*5),shift=(variant==='compass'?0:variant==='lens'?-.17:.17)*hem;
    vertices.push(Math.sin(angle)*(r+fold)+shift,y,Math.cos(angle)*(r+fold));uv.push(col/columns,row/rows);
    if(row<rows&&col<columns){const a=row*(columns+1)+col,b=a+1,c=a+columns+1,d=c+1;indices.push(a,b,d,a,d,c);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
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
  const sculpt = flightFeather(), source = sculpt.index?sculpt.toNonIndexed():sculpt.clone(), vertices: number[] = [], normals: number[] = [], colours:number[]=[],uv:number[]=[];
  sculpt.dispose();
  const count = breast ? 84 : 12, matrix = new THREE.Matrix4(), normalMatrix = new THREE.Matrix3(), quaternion = new THREE.Quaternion();
  const point = new THREE.Vector3(), normal = new THREE.Vector3();
  for (let featherIndex = 0; featherIndex < count; featherIndex++) {
    if(breast){
      // Overlapping plumage wraps the entire oval. Each small feather is
      // tangential to the body, including its sides and rear, with staggered
      // rows. One cached mesh replaces the old front-only breast panel.
      const row=Math.floor(featherIndex/14),column=featherIndex%14;
      const variation=Math.sin(column*2.7+row*1.91),tilt=.055*Math.sin(column*1.7+row*2.2);
      const angle=(column+.5+(row%2?.5:0)+.055*variation)/14*Math.PI*2,y=.22-row*.095+.004*Math.sin(column*2.1+row);
      quaternion.setFromEuler(new THREE.Euler(0,angle,.04*Math.sin(angle*3+row)));
      matrix.compose(new THREE.Vector3(),quaternion,new THREE.Vector3(1,1,1));
      normalMatrix.getNormalMatrix(matrix);
      for(let i=0;i<source.attributes.position.count;i++){
        point.fromBufferAttribute(source.attributes.position,i);
        uv.push(THREE.MathUtils.clamp(point.x+.5,0,1),THREE.MathUtils.clamp((point.y+.62)/1.12,0,1));
        const tone=.93+.075*(point.y+.62)/1.12+.035*Math.max(0,point.z)-.015*Math.abs(point.x)+.027*Math.sin(featherIndex*1.73);
        colours.push(tone,tone,tone);
        // The last row ends above the closed body pole. Projecting through
        // that pole would invert the radius and create long floor spikes.
        const length=(row===5?.145:.23+.015*Math.sin(featherIndex*2.17));
        const py=y+point.y*length+point.x*tilt*.10,normalizedY=py/.83;
        let r=0;while(r<owlContour.length-2&&owlContour[r+1].y<normalizedY)r++;
        const a=owlContour[r],b=owlContour[r+1],radius=a.x+(b.x-a.x)*(normalizedY-a.y)/(b.y-a.y);
        // Angular, not fixed physical width: near the belly pole a fixed
        // width wraps across several neighbours and produces broken patches.
        // Tips overlap the staggered row below, not adjacent equal-depth vanes.
        const theta=angle+point.x*(Math.PI*2/14)*1.38+point.y*tilt*.08;
        const relief=(.006+point.z*.016+(5-row)*.0024)*(1-.30*THREE.MathUtils.smoothstep(py,.14,.29));
        point.set(Math.sin(theta)*(radius*.70+relief),py,Math.cos(theta)*(radius*.55+relief));
        const slope=(b.x-a.x)/(b.y-a.y);
        normal.set(Math.sin(theta)/.70,-slope/.83,Math.cos(theta)/.55).normalize();
        vertices.push(point.x,point.y,point.z);normals.push(normal.x,normal.y,normal.z);
      }
      continue;
    }
    const [row,column]=([[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2],[3,0],[3,1],[4,0]] as const)[featherIndex],x=sign*(column*.041-.020+row*.004);
    quaternion.setFromEuler(new THREE.Euler(0,0,sign*(.18+column*.17-row*.025)));
    matrix.compose(new THREE.Vector3(x,(row===0?.110:.070)-row*.085,.115+column*.008-row*.013),quaternion,new THREE.Vector3(.130,.22+row*.039,.16));normalMatrix.getNormalMatrix(matrix);
    for (let i = 0; i < source.attributes.position.count; i++) {
      point.fromBufferAttribute(source.attributes.position, i);uv.push(THREE.MathUtils.clamp(point.x+.5,0,1),THREE.MathUtils.clamp((point.y+.62)/1.12,0,1));
      point.applyMatrix4(matrix); normal.fromBufferAttribute(source.attributes.normal, i).applyMatrix3(normalMatrix).normalize();
      // Feather roots turn into the shoulder rather than pointing above it
      // as a saw-toothed open edge. The complete thin sheet bends together.
      const collar=THREE.MathUtils.smoothstep(point.y,.06,.23);
      point.x=THREE.MathUtils.lerp(point.x,-sign*.10,collar);point.z*=1-.30*collar;
      vertices.push(point.x, point.y, point.z); normals.push(normal.x, normal.y, normal.z);
    }
  }
  source.dispose(); const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  if(breast){
    const radial=geometry.attributes.normal.clone();smoothDeformedSurface(geometry);
    const n=geometry.attributes.normal,a=new THREE.Vector3(),b=new THREE.Vector3();
    for(let i=0;i<n.count;i++){
      a.fromBufferAttribute(n,i);b.fromBufferAttribute(radial,i);
      // Very thin overlapping plumage follows the body's soft shading. A
      // beveled-solid normal would make each feather read like metal armor.
      if(a.dot(b)>0)a.lerp(b,.62).normalize();
      n.setXYZ(i,a.x,a.y,a.z);
    }
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
  }
  if(!breast){
    smoothDeformedSurface(geometry);
    // The independently fitted breast keeps exact edges. The free wing fans
    // can use their continuous normals to round the authored vane contours
    // at the dense tier instead of merely subdividing polygonal outlines.
    geometry.userData.characterCurvature=.28;
  }
  return geometry;
}

function makeGeometry(form: CharacterForm): THREE.BufferGeometry {
  switch (form) {
    case 'torso': return softLathe(torsoProfile);
    case 'scoutBody': return softLathe([[0,-.5],[.25,-.47],[.42,-.30],[.5,-.02],[.45,.05],[.36,.17],[.15,.22],[0,.24]]);
    case 'wayfinderBody': return softLathe(wayfinderProfile);
    case 'helmet': return helmet();
    case 'bridgeHelmet': return helmet(false,true);
    case 'lanternHousing': return lanternHousing();
    case 'lanternBezel': return lanternBezel();
    case 'owlHead': return helmet(true);
    // The shell is almost entirely covered by feathers. Spend its triangles
    // on the visible overlapping layers instead of an invisible dense core.
    case 'owlBody': {
      // This is a hidden support under fitted plumage. Independently rounding
      // the support at the dense tier pierces the lower feather sheets.
      const geometry=softLathe(owlProfile,12,16);
      geometry.scale(.985,1,.985);geometry.userData.characterFitted=true;
      return geometry;
    }
    case 'embracingBody': {
      const geometry=softLathe([[0,-.5],[.17,-.485],[.36,-.40],[.49,-.15],[.48,.15],[.35,.41],[0,.5]]),p=geometry.attributes.position;
      for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),weight=THREE.MathUtils.smoothstep(-y,.25,.50);p.setY(i,y+.14*Math.exp(-(x*x)/.012)*weight);}
      return smoothDeformedSurface(geometry);
    }
    case 'embracingArmR': return embracingArm();
    case 'embracingArmL': return reflect(embracingArm());
    case 'wing': return petal();
    case 'tuft': return petal(true);
    case 'lanternGlass': return lathe([[0, -.5], [.29, -.49], [.43, -.38], [.5, -.14], [.5, .18], [.42, .40], [.27, .49], [0, .5]]);
    case 'lanternCap': return lathe([[0, -.5], [.44, -.5], [.5, -.35], [.49, -.23], [.38, -.17], [.34, .01], [.25, .30], [.13, .47], [0, .5]]);
    case 'lanternBase': return lathe([[0, -.5], [.38, -.5], [.48, -.40], [.5, -.18], [.47, .02], [.38, .10], [.36, .36], [.28, .5], [0, .5]]);
    case 'limb': return lathe([[0, -.5], [.30, -.45], [.43, -.28], [.48, .04], [.5, .22], [.42, .40], [.22, .49], [0, .5]], 16);
    case 'ankle': return new THREE.CylinderGeometry(.42, .5, 1, 9);
    case 'sphere': return new THREE.SphereGeometry(.5, 24, 16);
    case 'bean': return new THREE.SphereGeometry(.5, 16, 10);
    case 'fittedSole': return new THREE.SphereGeometry(.5, 20, 12);
    case 'detail': return new THREE.SphereGeometry(.5, 12, 6);
    case 'beak': return lathe([[0, -.5], [.32, -.46], [.5, -.30], [.47, -.05], [.32, .20], [.12, .43], [0, .5]], 16);
    case 'ring': return new THREE.TorusGeometry(.5, .085, 8, 24);
    case 'lanternHandle': return new THREE.TorusGeometry(.5,.14,12,32);
    case 'neckBand': return lathe([[.46,-.5],[.5,-.3],[.5,.3],[.46,.5],[.44,.3],[.44,-.3],[.46,-.5]],16);
    case 'heart': return smallHeart();
    case 'book': return roundedBook();
    case 'bowedCover': return bowedCover();
    case 'keeperCover': return bowedCover(1.4);
    case 'envelope': return folded([[-.46,-.5],[.46,-.5],[.5,-.44],[.5,.44],[.46,.5],[-.46,.5],[-.5,.44],[-.5,-.44]],.9,.02);
    case 'cloak': return softLathe([[0, -.5], [.36, -.49], [.5, -.39], [.48, -.20], [.34, .12], [.21, .36], [.09, .49], [0, .54]]);
    case 'cape': return cape();
    case 'capePanel': return folded([[-.5, .5], [.5, .20], [.45, -.5], [-.15, -.09]], .08, .018);
    case 'feather': return feather();
    case 'featherCore': {
      // A tucked support joins the shoulder, then tapers behind the primaries.
      // A full ellipsoid projects past the thin layers as a rounded flipper.
      const geometry=new THREE.SphereGeometry(.5,12,8),p=geometry.attributes.position;
      for(let i=0;i<p.count;i++){
        const taper=THREE.MathUtils.smoothstep(-p.getY(i),-.12,.5);
        p.setXYZ(i,p.getX(i)*(1-.96*taper),p.getY(i),p.getZ(i)*(1-.85*taper));
      }
      return smoothDeformedSurface(geometry);
    }
    case 'toe': return new THREE.SphereGeometry(.5, 8, 6);
    case 'paperBody': return paperOwlBody();
    case 'paperChestL': return foldedSheet([[-.035,.18,.045],[-.38,.10,.05],[-.44,-.06,.10],[-.28,-.48,.10],[.14,-.45,.14]],[-.10,-.28,.275],['#dec59f','#d8bd95','#d0b28a','#d9be99','#e1c8a3']);
    case 'paperChestR': return foldedSheet([[.02,.18,.045],[.37,.10,.05],[.43,-.08,.10],[.27,-.48,.10],[-.03,-.37,.22]],[.14,-.26,.275],['#e3cba6','#d9bd96','#d0b18a','#d8bb96','#dfc59f']);
    case 'paperBackR': return foldedSheet([[-.015,.34,.15],[-.36,.28,.11],[-.47,-.04,.09],[-.28,-.50,.14],[.065,-.32,.23]],[-.21,.015,.25],['#d0b28b','#dec39d','#c5a57c','#dbc09a','#e2c8a3']).rotateY(Math.PI);
    case 'paperBackL': return reflect(makeGeometry('paperBackR'));
    case 'paperBrow': return foldedSheet([[-.40,.20,.32],[-.23,.445,.335],[.19,.475,.335],[.065,.24,.45]],[-.10,.36,.43],['#c9ac83','#dec29b','#cbb08a','#ddc39c']);
    case 'paperEarR': return foldedSheet([[.16,.32,.30],[.28,.41,.24],[.54,.51,.16],[.45,.29,.43]],[.30,.33,.46],['#d1b38b','#e3c79d','#c9a980','#dec299']);
    case 'paperEarL': return reflect(makeGeometry('paperEarR'));
    case 'paperCrownBackR': return foldedSheet([[.015,.30,.28],[.31,.20,.27],[.29,-.12,.27],[.12,-.33,.28],[-.025,-.24,.29]],[.16,.025,.38],['#c7ac85','#d7bb94','#c5a67e','#d6ba91','#dfc59e']).rotateY(Math.PI);
    case 'paperCrownBackL': return reflect(makeGeometry('paperCrownBackR'));
    case 'paperEchoHead': return paperOwlHead();
    case 'paperQuillHead': return paperOwlHead(true);
    case 'paperOwlWingR': return paperOwlWing();
    case 'paperOwlWingL': return reflect(paperOwlWing());
    // The wrist folds forward around the handle, with a narrow return flap.
    // This is an authored rest pose, not a scheduled or simulated action.
    case 'paperHoldingWing': return foldedSheet([[-.02,.095,.07],[.05,-.055,.14],[.055,-.23,.62],[-.065,-.25,.60],[-.15,-.065,.22]],[.002,-.13,.62],['#d9bd94','#e8cda4','#c6a578','#d8b98e','#e4c89f']);
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
    case 'merchantTorso': return softLathe([[0, -.50], [.25, -.49], [.32, -.38], [.40, -.16], [.49, .10], [.47, .22], [.25, .28], [0, .31]]);
    // The lower folded breast descends toward the small feet. Keeping only a
    // short round torso left Swift perched on long exposed wire-like legs.
    case 'swiftBody': return foldedBirdVolume([[-.235,.040,.055,-.025],[-.12,.078,.085,-.006],[-.015,.111,.11,.045],[.10,.125,.117,.082],[.16,.122,.115,.101],[.22,.108,.108,.105],[.27,.082,.080,.095],[.30,.041,.040,.082],[.307,.006,.008,.079]],true);
    case 'swiftHead': return swiftHead();
    case 'swiftTail': return polyhedron([[.025,.11,.04],[.025,.04,-.15],[.025,-.19,-.40],[.025,-.11,-.02],[.062,-.02,-.12],[-.006,.11,.04],[-.006,.04,-.15],[-.006,-.19,-.40],[-.006,-.11,-.02]],[[0,4,1],[1,4,2],[2,4,3],[3,4,0],[5,6,7,8],[0,1,6,5],[1,2,7,6],[2,3,8,7],[3,0,5,8]],['#dcb366','#d7ab5c','#c59c4c','#e3bd73','#386a65','#c99c4f','#386a65','#35615d','#a5813e']);
    case 'swiftWingL': return reflect(makeGeometry('swiftWingR'));
    case 'swiftWingR': return swiftWing();
    case 'paperBeak': return polyhedron([[-.065,-.025,0],[.065,-.025,0],[0,.035,.24],[0,.065,0],[0,-.04,.19]],[[0,3,2],[3,1,2],[0,2,4],[2,1,4],[0,4,1],[0,1,3]]);
    case 'pageCorner': return polyhedron([[-.5,.5,0],[.5,-.5,0],[.5,.5,-.10],[.12,.12,.34]],[[0,3,2],[3,1,2],[0,1,3]]);
    case 'merchantBase': return softLathe([[0,-.5],[.44,-.5],[.5,-.28],[.5,.08],[.46,.38],[.33,.5],[0,.5]]);
    case 'spiritFigure': return spiritFigure('compass');
    case 'spiritLens': return spiritFigure('lens');
    case 'spiritRelay': return spiritFigure('relay');
    case 'compassCowl': return spiritCowl('compass');
    case 'lensCowl': return spiritCowl('lens');
    case 'relayCowl': return spiritCowl('relay');
    case 'owlBrowL': return sweptBrow(true);
    case 'owlBrowR': return sweptBrow();
    case 'featherFanL': return featherFan(-1);
    case 'featherFanR': return featherFan(1);
    case 'breastFeathers': return featherFan(1, true);
    case 'hexGlass': {const source=new THREE.CylinderGeometry(.36,.49,1,6),g=source.toNonIndexed();source.dispose();g.rotateY(Math.PI/6);g.computeVertexNormals();return g;}
    case 'hexCap': {const source=lathe([[0,-.5],[.45,-.5],[.50,-.42],[.48,-.34],[.12,.43],[.08,.5],[0,.5]],6),g=source.toNonIndexed();source.dispose();g.rotateY(Math.PI/6);g.computeVertexNormals();return g;}
    case 'hexBase': {const source=lathe([[0,-.5],[.43,-.5],[.49,-.30],[.49,.19],[.44,.42],[0,.42]],6),g=source.toNonIndexed();source.dispose();g.rotateY(Math.PI/6);g.computeVertexNormals();return g;}
    case 'fineRing': return new THREE.TorusGeometry(.5, .027, 6, 28);
    case 'compassStar': return folded([[0, .5], [.07, .13], [.32, .32], [.13, .07], [.5, 0], [.13, -.07], [.32, -.32], [.07, -.13], [0, -.5], [-.07, -.13], [-.32, -.32], [-.13, -.07], [-.5, 0], [-.13, .07], [-.32, .32], [-.07, .13]], .03, .025);
    case 'compassNeedle': return folded([[0,.5],[.085,.09],[.33,0],[.085,-.09],[0,-.5],[-.085,-.09],[-.33,0],[-.085,.09]],.03,.035);
    case 'compassPointer': return polyhedron([[0,.5,0],[.15,0,.025],[0,-.5,0],[-.15,0,.025],[0,0,.060],[0,0,-.025]],
      [[0,1,4],[0,4,3],[1,2,4],[2,3,4],[0,5,1],[1,5,2],[2,5,3],[3,5,0]],
      ['#d09b4d','#e7b767','#f0d5a0','#ac8d52','#9b763a','#a58950','#90713b','#b18b4a']);
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

/** Finish-specific microstructure: ceramic pores, laid-paper fibres and fine
 * brushed metal. Broad highlights remain clean; texture is not painted noise. */
function surfaceGrain(kit: SceneKit, finish: CharacterFinish): THREE.DataTexture {
  const owner=owned(kit);
  owner.grains ??= new Map();
  const cached=owner.grains.get(finish);if(cached)return cached;
  const size=512,data=new Uint8Array(size*size*4);let seed=181;
  const hash=(x:number,y:number)=>((Math.imul(x+71,374761393)^Math.imul(y+113,668265263))>>>0)%65521/65521;
  const noiseAt=(x:number,y:number)=>{
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),sx),THREE.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),sx),sy);
  };
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const noise=(seed>>>24)/255, broad=Math.sin(x*.063+Math.sin(y*.081))*Math.sin(y*.048);
    const pore=noiseAt(x/6,y/6),fibre=noiseAt(x/2.8+Math.sin(y*.036)*.7,y/25);
    const barbs=Math.pow(Math.max(0,Math.sin(y*.67+Math.abs(x-size*.5)*.28)),12);
    const grain=finish==='paper'?247-24*fibre-13*pore-8*noise-24*noiseAt(x/41,y/37)
      :finish==='brass'?249-4*Math.sin(y*1.17+x*.007)-3*noise
      :finish==='cloth'?238-13*(Math.sin(x*Math.PI/4)**2+Math.sin(y*Math.PI/4)**2)-15*pore-6*noise
      :finish==='feather'?250-16*barbs-28*pore-7*noise-28*noiseAt(x/19,y/17)-22*fibre
      :finish==='glaze'?247-13*pore-6*noise+2*broad:244-29*pore-10*noise+3*broad;
    data.set([grain,grain,grain,255],(y*size+x)*4);
  }
  const texture=new THREE.DataTexture(data,size,size);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.userData.platopCharacterGrain=true;
  texture.repeat.setScalar(finish==='feather'?1:2);texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps=true;texture.needsUpdate=true;owner.grains.set(finish,texture);return texture;
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
  const texture=new THREE.DataTexture(data,size,size);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;owner.glow=texture;return texture;
}

/** Fine radial barbs in the owl's facial discs, shared by both eyes. */
function facialGrain(kit:SceneKit):THREE.DataTexture {
  const owner=owned(kit);if(owner.facialGrain)return owner.facialGrain;
  const size=512,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=(x+.5)/size-.5,dy=(y+.5)/size-.5,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
    const seed=((Math.imul(x+7,374761393)^Math.imul(y+13,668265263))>>>0)%101/100;
    const barbs=Math.pow(Math.max(0,Math.sin(a*97+r*113+Math.sin(r*43+a*13)*4)),8);
    // Broad, softly broken fibre bundles survive downsampling. Their smaller
    // barbs still provide the close surface; neither is a raised crack mesh.
    const bundle=(.5+.5*Math.sin(a*43+r*23+Math.sin(a*11+r*71)*2.7+Math.sin(a*29-r*57)*1.3))**2;
    const broken=(.5+.5*Math.sin(r*89+Math.sin(a*29)*3))**2;
    const middle=(.5+.5*Math.sin(a*71+r*53+Math.sin(r*23)*2))**4;
    const outer=THREE.MathUtils.smoothstep(r,.07,.25);
    const tone=246-17*bundle*broken*outer-12*middle*outer-10*barbs*outer-12*seed;
    data.set([tone,tone,tone,255],(y*size+x)*4);
  }
  const texture=new THREE.DataTexture(data,size,size);texture.userData.platopCharacterGrain=true;texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;owner.facialGrain=texture;return texture;
}

/** Individual feather UVs keep the fine barbs aligned with each overlapping
 * vane. One 512px texture is reused by all breast and wing layers. */
function plumageGrain(kit:SceneKit):THREE.DataTexture {
  const owner=owned(kit);if(owner.plumageGrain)return owner.plumageGrain;
  const size=512,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=(x+.5)/size-.5,v=(y+.5)/size;
    const seed=((Math.imul(x+17,374761393)^Math.imul(y+29,668265263))>>>0)%101/100;
    const barb=Math.pow(Math.max(0,Math.sin(v*193+Math.abs(u)*117+Math.sin(v*41+u*19)*3+Math.sin(u*83+v*61)*1.3)),10);
    const quill=Math.exp(-(u*u)/.00010);
    // Two lower-frequency fibres remain visible after portrait/campus
    // downsampling. Fine barbs alone averaged into a uniform smooth plate.
    const fibre=.5+.5*Math.sin(v*83+Math.abs(u)*49+Math.sin(v*23+u*17)*2);
    const mottling=.5+.5*Math.sin(u*37+Math.sin(v*31)*1.3)*Math.sin(v*47-u*11);
    const tone=250-29*barb*(.4+.6*Math.abs(u)*2)-12*seed-21*fibre-16*mottling+4*quill;
    data.set([tone,tone,tone,255],(y*size+x)*4);
  }
  const texture=new THREE.DataTexture(data,size,size);texture.userData.platopCharacterGrain=true;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  owner.plumageGrain=texture;return texture;
}

export function characterMaterial(kit: SceneKit, color: string, finish: CharacterFinish = 'clay'): THREE.MeshStandardMaterial {
  const cache = owned(kit).material, key = `${finish}:${color}`;
  let material = cache.get(key);
  if (!material) {
    material = new THREE.MeshStandardMaterial({ color,
      roughness: finish === 'glass' ? .08 : finish === 'ink' ? .24 : finish === 'glaze' ? .50 : finish === 'brass' ? .32 : finish === 'amber' ? .38 : finish === 'paper'||finish==='cloth' ? .94 : finish === 'feather'||finish==='plumage' ? .88 : .76,
      metalness: finish === 'brass' ? .52 : 0,
      ...(finish === 'amber' ? { emissive: '#fff3c1', emissiveIntensity: .80, emissiveMap:glassGlow(kit), map:glassGlow(kit) } : {}),
      // Source Wayfinder eyes are softly luminous strokes, not tiny lamps.
      // Emission adds no light, bloom pass, transparency or animation.
      ...(finish === 'warmInk' ? { emissive: '#ffc675', emissiveIntensity: .65, roughness: .62 } : {}),
    });
    material.userData.characterFinish = finish;
    if(finish==='glass'){material.transparent=true;material.opacity=.16;material.depthWrite=false;material.envMapIntensity=1.2;}
    if (finish === 'ink') material.envMapIntensity = .65;
    if (['clay','glaze','paper','feather','facialFeather','plumage','brass','cloth'].includes(finish)) {
      material.envMapIntensity=finish==='glaze'?.60:.5;
      material.bumpMap=finish==='facialFeather'?facialGrain(kit):finish==='plumage'?plumageGrain(kit):surfaceGrain(kit,finish);material.bumpScale=finish==='plumage'?.008:finish==='facialFeather'?.012:finish==='glaze'?.009:finish==='brass'?.0015:finish==='paper'?.014:.012;
      material.map=material.bumpMap;
      // The same cellulose field varies its grazing response without an
      // additional texture allocation, transparent layer or geometry draw.
      if(finish==='paper')material.roughnessMap=material.bumpMap;
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
    if(bubble){boundary.length=0;boundary.push(...speechBoundary(width,height));}
    const area=boundary.reduce((sum,[x,y],i)=>{const next=boundary[(i+1)%boundary.length];return sum+x*next[1]-next[0]*y},0);if(area<0)boundary.reverse();
    const vertices: number[] = [], normals: number[] = [], colours:number[] = [], indices: number[] = [], rings = 6;
    const contour = torsoSurface ? wayfinderContour : undefined;
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
        surface = surfaceRadii[2] * Math.sqrt(Math.max(.05, 1 - (px / surfaceRadii[0]) ** 2 - (py / surfaceRadii[1]) ** 2))-(owlSign?owlEyeRecess(px,py):0);
        normal.set(px / surfaceRadii[0] ** 2, py / surfaceRadii[1] ** 2, (surface+(owlSign?owlEyeRecess(px,py):0)) / surfaceRadii[2] ** 2).normalize();
        if(owlSign){
          const recess=owlEyeRecess(px,py),base=Math.max(.06,surface+recess);
          const dx=-(surfaceRadii[2]**2)*px/(surfaceRadii[0]**2*base)+recess*2.3*(Math.abs(px)-.13)/OWL_SOCKET_RADIUS[0]**2*Math.sign(px);
          const dy=-(surfaceRadii[2]**2)*py/(surfaceRadii[1]**2*base)+recess*2.3*(py-.002)/OWL_SOCKET_RADIUS[1]**2;
          normal.set(-dx,-dy,1).normalize();
        }
      }
      vertices.push(px, py, surface + offset + centre[2] + .010);
      normals.push(normal.x, normal.y, normal.z);
      if(owlSign){
        // Cream barbs darken into the recessed amber eye socket. The colour
        // belongs to the disc, not an extra flat ring placed over the eye.
        const r=((Math.abs(px)-.13)/.108)**2+((py-.002)/.123)**2;
        const warm=Math.exp(-r*.9);
        colours.push(1-.32*warm,1-.52*warm,1-.70*warm);
      }
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
    if(owlSign)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colours,3));
    // Radial facial fibres grow away from the actual eye, not the offset
    // centre of the heart-shaped shield. The two discs share one texture.
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(vertices.flatMap((value,index)=>index%3===0?[(value-(owlSign?owlSign*.130:0))/width+.5,(vertices[index+1]-(owlSign?.002:0))/height+.5]:[]),2));
    geometry.setIndex(indices);
    if(!torsoSurface)geometry.userData.characterEllipsoid={radii:surfaceRadii,owlSocket:!!owlSign};
    cache.set(key, geometry);
  }
  let material=characterMaterial(kit,color,finish);
  if(owlSign){
    const materials=owned(kit).material,key=`${finish}:${color}:vertex-colour`;
    if(!materials.has(key)){const variant=material.clone();variant.vertexColors=true;materials.set(key,variant);}
    material=materials.get(key)!;
  }
  const mesh = new THREE.Mesh(geometry, material);
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
  radius = .008, finish: CharacterFinish = 'brass',rounded=false): THREE.Mesh {
  const cache = owned(kit).geometry, key = `stroke:${radius}:${rounded}:${points.map(point => point.join(':')).join(';')}`;
  let geometry = cache.get(key);
  if (!geometry) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    geometry = new THREE.TubeGeometry(curve, Math.max(4, points.length * 2), radius, rounded?8:4, false);
    if(rounded){
      const parts=[geometry.toNonIndexed(),...([points[0],points[points.length-1]].map(p=>{
        const sphere=new THREE.SphereGeometry(radius,8,6).translate(...p),part=sphere.toNonIndexed();sphere.dispose();return part;
      }))];
      geometry.dispose();geometry=new THREE.BufferGeometry();
      for(const name of ['position','normal','uv']){
        const size=parts[0].attributes[name].itemSize;
        geometry.setAttribute(name,new THREE.Float32BufferAttribute(parts.flatMap(part=>Array.from(part.attributes[name].array)),size));
      }
      parts.forEach(part=>part.dispose());
    }
    cache.set(key, geometry);
  }
  const mesh = new THREE.Mesh(geometry, characterMaterial(kit, color, finish));
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

export function characterEyeArc(kit: SceneKit, parent: THREE.Object3D, color: string, at: Tuple,
  width = .045, height = .026, finish: CharacterFinish = 'ink',strokeRadius=.010): THREE.Mesh {
  const mesh = characterStroke(kit, parent, color,
    [[-width, 0, 0], [-width * .6, height * .82, 0], [0, height, 0], [width * .6, height * .82, 0], [width, 0, 0]], strokeRadius, finish,strokeRadius>.012);
  mesh.position.set(...at); return mesh;
}

/** Stamp a thin ornamental relief onto a curved shell once, never per frame. */
export function fitCharacterRelief(mark: THREE.Object3D, shell: THREE.Mesh,standOff=.012,maxRelief=Infinity): void {
  shell.parent!.updateWorldMatrix(true,true);mark.updateWorldMatrix(true,true);
  const ray=new THREE.Raycaster(),point=new THREE.Vector3(),inverse=new THREE.Matrix4();
  const bounds=new THREE.Box3().setFromObject(mark);
  mark.traverse(object=>{
    const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
    const geometry=mesh.geometry.clone();
    const position=geometry.attributes.position;
    inverse.copy(mesh.matrixWorld).invert();
    for(let i=0;i<position.count;i++) {
      point.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
      const relief=Math.min(maxRelief,Math.max(0,point.z-bounds.min.z));
      ray.set(new THREE.Vector3(point.x,point.y,2),new THREE.Vector3(0,0,-1));
      const hit=ray.intersectObject(shell,false)[0];
      if(hit) {point.z=hit.point.z+standOff+relief;point.applyMatrix4(inverse);position.setXYZ(i,point.x,point.y,point.z);}
    }
    geometry.computeVertexNormals();geometry.userData.characterFitted=true;mesh.geometry=geometry;
  });
}

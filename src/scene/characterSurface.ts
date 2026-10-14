/** Serializable surface patches, shared by the portrait studio and a worker.
 * Frequency ten produces exactly 100 triangles per authored triangle. This is
 * curved Phong tessellation plus material relief, not duplicated flat faces.
 * Split normals remain split: origami folds and metal lips are never welded. */
export const CHARACTER_SURFACE_FREQUENCY = 10;
export const OWL_SOCKET_RADIUS = [.108, .125] as const;
/** One socket field is shared by the shell, fitted face and worker surface. */
export function owlEyeRecess(x: number, y: number): number {
  return .145 * Math.exp(-(((Math.abs(x) - .13) / OWL_SOCKET_RADIUS[0]) ** 2 + ((y - .002) / OWL_SOCKET_RADIUS[1]) ** 2) * 1.15);
}
/** Warm recessed fibres, evaluated on the same field at both mesh tiers. */
export function owlFaceTint(x:number,y:number):[number,number,number] {
  const r=((Math.abs(x)-.13)/.108)**2+((y-.002)/.123)**2;
  const warm=Math.exp(-r*1.05)*(.85+.15*Math.tanh((y-.002)/.07));
  return [1-.39*warm,1-.58*warm,1-.75*warm];
}
export interface SurfaceData {
  attributes: Record<string, { size: number; array: Float32Array }>;
  index: Uint32Array;
  curvature?: number;
  ellipsoid?: { radii: [number, number, number]; centerY?: number; shell?: boolean; owlSocket?: boolean };
}

function relief(x: number, y: number, z: number, finish: string): number {
  const wave = Math.sin(x * 163 + Math.sin(z * 79)) * Math.sin(y * 137 + z * 41);
  if (finish === 'paper') return .0010 * Math.sin(x * 37 + y * 17 + Math.sin(y * 23)) * Math.sin(y * 42 + z * 11) + .0002 * Math.sin(x * 231 + y * 43);
  // Feather layers are thinner than paper. Relief larger than their thickness
  // punctures the back surface and creates stray silhouettes under grazing light.
  if (finish === 'plumage' || finish === 'facialFeather') return .000015 * wave;
  if (finish === 'feather') return .0008 * wave;
  if (finish === 'cloth') return .0004 * Math.sin(x*237)*Math.sin(y*237);
  if (finish === 'brass') return .00018 * Math.sin(y * 307 + x * 13);
  if (finish === 'clay') return .00055 * wave;
  if (finish === 'glaze') return .00018 * wave;
  if (finish === 'satinShell') return .00040 * wave;
  return 0;
}

export function refineCharacterSurface(source: SurfaceData, finish = 'clay', frequency = CHARACTER_SURFACE_FREQUENCY): SurfaceData {
  if (!Number.isInteger(frequency) || frequency < 1 || frequency > 10) throw new Error('Invalid character surface frequency');
  const faces = source.index.length / 3, perFace = (frequency + 1) * (frequency + 2) / 2;
  const attributes: SurfaceData['attributes'] = {};
  for (const [name, attribute] of Object.entries(source.attributes)) {
    attributes[name] = { size: attribute.size, array: new Float32Array(faces * perFace * attribute.size) };
  }
  const index = new Uint32Array(source.index.length * frequency * frequency);
  const p = source.attributes.position.array, n = source.attributes.normal.array;
  const outP = attributes.position.array, outN = attributes.normal.array;
  const attributeEntries = Object.entries(source.attributes);
  let vertex = 0, triangle = 0;
  const rowOffset = (row: number) => row * (frequency + 1) - row * (row - 1) / 2;
  for (let face = 0; face < faces; face++) {
    const a = source.index[face * 3], b = source.index[face * 3 + 1], c = source.index[face * 3 + 2];
    const base = vertex;
    for (let row = 0; row <= frequency; row++) for (let col = 0; col <= frequency - row; col++) {
      const wb = row / frequency, wc = col / frequency, wa = 1 - wb - wc;
      for (const [name, attribute] of attributeEntries) {
        const output = attributes[name].array, size = attribute.size, input = attribute.array;
        for (let axis = 0; axis < size; axis++) output[vertex * size + axis] =
          input[a * size + axis] * wa + input[b * size + axis] * wb + input[c * size + axis] * wc;
      }
      const offset = vertex * 3, x = outP[offset], y = outP[offset + 1], z = outP[offset + 2];
      // Project onto the three tangent planes and blend. Authored flat folds
      // are unchanged; curved helmets, limbs and eye rims gain real curvature.
      for (const [v, weight] of [[a, wa], [b, wb], [c, wc]]) {
        const i = v * 3, d = ((p[i] - x) * n[i] + (p[i + 1] - y) * n[i + 1] + (p[i + 2] - z) * n[i + 2]) * weight * (source.curvature ?? .5);
        outP[offset] += n[i] * d; outP[offset + 1] += n[i + 1] * d; outP[offset + 2] += n[i + 2] * d;
      }
      if (source.ellipsoid) {
        const { radii: [rx, ry, rz], centerY = 0, shell = false, owlSocket = false } = source.ellipsoid;
        const height = (vx: number, vy: number) => rz * Math.sqrt(Math.max(shell ? 0 : .05, 1 - (vx / rx) ** 2 - ((vy - centerY) / ry) ** 2))
          -(owlSocket ? owlEyeRecess(vx, vy) : 0);
        const heightOffset = shell ? 0 : wa * (p[a * 3 + 2] - height(p[a * 3], p[a * 3 + 1]))
          + wb * (p[b * 3 + 2] - height(p[b * 3], p[b * 3 + 1])) + wc * (p[c * 3 + 2] - height(p[c * 3], p[c * 3 + 1]));
        // Analytically evaluate fitted curved panels at every new vertex;
        // interpolating their coarse chord depths produces a scalloped bezel.
        outP[vertex * 3 + 2] = (shell && z < 0 ? -1 : 1) * height(x, y) + heightOffset;
        if(owlSocket){
          const recess=owlEyeRecess(x,y);
          const base=Math.max(.06,height(x,y)+recess);
          outN[offset]=rz*rz*x/(rx*rx*base)-recess*2.3*(Math.abs(x)-.13)/OWL_SOCKET_RADIUS[0]**2*Math.sign(x);
          outN[offset+1]=rz*rz*y/(ry*ry*base)-recess*2.3*(y-.002)/OWL_SOCKET_RADIUS[1]**2;
          outN[offset+2]=1;
        }
      }
      if(finish==='paper'){
        // Normals follow the actual dense relief, including its shallow
        // waviness. Leaving the old planar normals hid these new surfaces
        // from the light even though their vertices were displaced.
        const px=outP[offset],py=outP[offset+1],pz=outP[offset+2];
        const a=px*37+py*17+Math.sin(py*23),b=py*42+pz*11,c=px*231+py*43;
        const sa=Math.sin(a),ca=Math.cos(a),sb=Math.sin(b),cb=Math.cos(b),cc=Math.cos(c);
        const dx=.0010*ca*37*sb+.0002*cc*231;
        const dy=.0010*(ca*(17+23*Math.cos(py*23))*sb+sa*cb*42)+.0002*cc*43;
        const dz=.0010*sa*cb*11;
        // Inverse transpose of p -> p + (0,0,relief(p)). Apply separately to
        // each authored normal, so creases keep their intentional hard edges.
        const nz=outN[offset+2]/(1+dz);
        outN[offset]-=nz*dx;outN[offset+1]-=nz*dy;outN[offset+2]=nz;
      }
      const length = Math.hypot(outN[offset], outN[offset + 1], outN[offset + 2]) || 1;
      const displacement = relief(outP[offset], outP[offset + 1], outP[offset + 2], finish);
      for (let axis = 0; axis < 3; axis++) {
        outN[offset + axis] /= length;
        // A shared paper displacement direction keeps split-normal crease
        // vertices watertight; displacing along each face normal opens cracks.
        outP[offset + axis] += (finish === 'paper' ? (axis === 2 ? 1 : 0) : outN[offset + axis]) * displacement;
      }
      if(source.ellipsoid?.owlSocket&&!source.ellipsoid.shell&&attributes.color?.size===3)
        attributes.color.array.set(owlFaceTint(outP[offset],outP[offset+1]),offset);
      vertex++;
    }
    for (let row = 0; row < frequency; row++) for (let col = 0; col < frequency - row; col++) {
      const a0 = base + rowOffset(row) + col, b0 = base + rowOffset(row + 1) + col;
      index[triangle++] = a0; index[triangle++] = b0; index[triangle++] = a0 + 1;
      if (col < frequency - row - 1) {
        index[triangle++] = a0 + 1; index[triangle++] = b0; index[triangle++] = b0 + 1;
      }
    }
  }
  return { attributes, index };
}

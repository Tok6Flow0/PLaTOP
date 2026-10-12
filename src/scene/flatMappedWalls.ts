import * as THREE from 'three';

function isFlatMappedPlane(mesh: THREE.Mesh): boolean {
  if ((mesh as THREE.SkinnedMesh).isSkinnedMesh || (mesh as THREE.InstancedMesh).isInstancedMesh
    || (mesh as THREE.BatchedMesh).isBatchedMesh || Array.isArray(mesh.material)
    || mesh.morphTargetInfluences?.length
    || mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender
    || mesh.onAfterRender !== THREE.Object3D.prototype.onAfterRender) return false;
  const geometry = mesh.geometry;
  if (!(geometry instanceof THREE.PlaneGeometry) || geometry.parameters.widthSegments !== 1
    || geometry.parameters.heightSegments !== 1 || Object.keys(geometry.morphAttributes).length
    || geometry.groups.length || geometry.drawRange.start !== 0 || geometry.drawRange.count < 6) return false;
  const { width, height } = geometry.parameters;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return false;
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const uvs = geometry.getAttribute('uv');
  if (!(positions instanceof THREE.BufferAttribute) || !(normals instanceof THREE.BufferAttribute)
    || !(uvs instanceof THREE.BufferAttribute) || positions.count !== 4 || normals.count !== 4
    || uvs.count !== 4 || positions.itemSize !== 3 || normals.itemSize !== 3 || uvs.itemSize !== 2) return false;
  const expectedPositions = [-width / 2, height / 2, 0, width / 2, height / 2, 0,
    -width / 2, -height / 2, 0, width / 2, -height / 2, 0].map(Math.fround);
  const expectedUvs = [0, 1, 1, 1, 0, 0, 1, 0];
  const expectedIndices = [0, 2, 1, 2, 3, 1];
  if (expectedPositions.some((value, index) => positions.array[index] !== value)
    || expectedUvs.some((value, index) => uvs.array[index] !== value)
    || Array.from({ length: 12 }, (_, index) => index % 3 === 2 ? 1 : 0)
      .some((value, index) => normals.array[index] !== value)
    || geometry.index?.count !== 6
    || expectedIndices.some((value, index) => geometry.index!.array[index] !== value)) return false;
  const material = mesh.material;
  return material instanceof THREE.MeshStandardMaterial && material.side === THREE.DoubleSide
    && material.transparent && !!material.map && !material.alphaTest && !material.alphaHash
    && !material.alphaToCoverage && !material.normalMap && !material.bumpMap && !material.displacementMap
    && !material.flatShading && !material.clippingPlanes?.length
    && material.onBeforeCompile === THREE.Material.prototype.onBeforeCompile;
}

/** Called only on static wall roots after their materials have been cloned for that wall. */
export function enableFlatMappedWallSinglePass(root: THREE.Object3D): number {
  const users = new Map<THREE.Material, THREE.Mesh[]>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const meshes = users.get(material) ?? [];
      meshes.push(mesh);
      users.set(material, meshes);
    }
  });
  let changed = 0;
  for (const [material, meshes] of users) {
    if (material.forceSinglePass || !meshes.every(isFlatMappedPlane)) continue;
    // A single plane has one facing surface. Keep DoubleSide's front/back
    // lighting, while avoiding the redundant back-then-front transparent draws.
    material.forceSinglePass = true;
    material.needsUpdate = true;
    changed++;
  }
  return changed;
}

import * as THREE from 'three';

interface WindowRoom {
  center: THREE.Vector3;
  navigation: {
    floorY: number;
    task: readonly [number, number];
    desks: ReadonlyArray<{ position: readonly [number, number] }>;
  };
}

/** A fixed observer camera, never an actor pose or an activity instruction. */
export function officeWindowFrame(teamId: string, room: WindowRoom, aspect: number) {
  const { desks, task, floorY } = room.navigation;
  const nearZ = Math.max(task[1] + 1.05, ...desks.map(desk => desk.position[1] + .85));
  const farZ = Math.min(task[1] - 1.05, ...desks.map(desk => desk.position[1] - .85));
  const reflection = teamId === 'reflection';
  const fov = 38;
  const target = room.center.clone().add(new THREE.Vector3(0, reflection ? .85 : 1.25, (nearZ + farZ) / 2));
  // The open foyer has no tall rear wall to frame. Looking from its front
  // reveals the existing neutral faces instead of turning both owls edge-on.
  // Other rooms retain their desk/monitor overview, including the same fit.
  const direction = new THREE.Vector3(...(reflection ? [-.35, .75, 1] : [.65, .62, .48]) as [number, number, number]).normalize();
  const forward = direction.clone().negate();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, forward).normalize();
  const tanVertical = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const tanHorizontal = tanVertical * Math.max(.1, aspect);
  const bounds = new THREE.Box3(
    room.center.clone().add(new THREE.Vector3(-2.3, floorY, farZ)),
    room.center.clone().add(new THREE.Vector3(2.3, reflection ? 1.95 : 3.2, nearZ)),
  );
  let distance = reflection ? 5 : 6.8;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const point = new THREE.Vector3(x, y, z).sub(target);
    distance = Math.max(distance, point.dot(direction) + Math.abs(point.dot(right)) / tanHorizontal,
      point.dot(direction) + Math.abs(point.dot(up)) / tanVertical);
  }
  return { fov, target, position: target.clone().addScaledVector(direction, distance * (reflection ? 1.12 : 1.2)), bounds };
}

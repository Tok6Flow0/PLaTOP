import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Activity, Character, SceneHandle, SceneState, Team } from './types';
import { CLIP_NAMES, fetchCharacter, fetchManifest, type ClipName } from './scene/assets';
import { disposeObject, SceneKit } from './scene/primitives';
import { animateCharacter, makeProxy } from './scene/proxies';
import { makeCampus, makeRoom, type Room } from './scene/rooms';

interface Actor {
  character: Character;
  teamId: string;
  root: THREE.Group;
  model: THREE.Object3D;
  home: THREE.Vector3;
  contact: THREE.Mesh;
  sleep: THREE.Sprite;
  sleepHeight: number;
  index: number;
  facing: number;
  mixer?: THREE.AnimationMixer;
  actions?: Partial<Record<ClipName, THREE.AnimationAction>>;
  clip?: ClipName;
  authoredSleepFx?: boolean;
}
type InteractiveRoom = Room & {
  actorHomes?: THREE.Vector3[];
  actorFacing?: number[];
  walls?: Array<{ root: THREE.Object3D; normal: THREE.Vector3; twoSided?: boolean }>;
};

function sleepIndicator(): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    context.font = '600 64px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.shadowColor = '#435348';
    context.shadowBlur = 10;
    context.lineWidth = 4;
    context.strokeStyle = '#52655a';
    context.fillStyle = '#ffffff';
    context.strokeText('Z z', 128, 66);
    context.fillText('Z z', 128, 66);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false }));
  sprite.scale.set(0.7, 0.38, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** Lightweight local visualisation only. The renderer never controls agent work. */
export function createScene(host: HTMLElement, teams: Team[], onSelect: (id: string) => void,
  onError?: (message: string) => void): SceneHandle {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    const notice = document.createElement('p');
    notice.className = 'scene-fallback';
    notice.textContent = 'The 3D workspace needs WebGL. Your team controls and status are still available.';
    notice.setAttribute('role', 'status');
    host.append(notice);
    onError?.('WebGL unavailable. Showing team details without the 3D workspace.');
    return { update() {}, resetCamera() {}, zoom() {}, dispose() { notice.remove(); } };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.setClearColor('#f5f3ed', 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Six connected 3D team offices. Drag to pan; right-drag or shift-drag to orbit and tilt; scroll to zoom. When focused, arrow keys pan, shift and arrows orbit, plus and minus zoom, and Home resets. Use the team list to select an office.');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  host.append(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(23, 1, 0.1, 180);
  camera.position.set(0, 38, 27);
  camera.lookAt(0, 0.7, 0);
  camera.updateMatrixWorld();
  scene.add(new THREE.HemisphereLight('#fff7e9', '#a3937d', 1.45));
  const sunlight = new THREE.DirectionalLight('#fff0d5', 2.6);
  sunlight.position.set(-9, 19, 11);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  sunlight.shadow.bias = -0.0004;
  sunlight.shadow.normalBias = 0.025;
  sunlight.shadow.radius = 4;
  sunlight.shadow.blurSamples = 8;
  sunlight.shadow.camera.near = 1;
  sunlight.shadow.camera.far = 80;
  sunlight.shadow.camera.left = -16;
  sunlight.shadow.camera.right = 16;
  sunlight.shadow.camera.top = 16;
  sunlight.shadow.camera.bottom = -16;
  scene.add(sunlight);
  const kit = new SceneKit();
  scene.add(makeCampus(kit));
  const rooms = new Map<string, InteractiveRoom>();
  const actors: Actor[] = [];
  const retiredProxies = new THREE.Group();
  const contactCanvas = document.createElement('canvas');
  contactCanvas.width = contactCanvas.height = 64;
  const contactContext = contactCanvas.getContext('2d');
  if (contactContext) {
    const gradient = contactContext.createRadialGradient(32, 32, 3, 32, 32, 31);
    gradient.addColorStop(0, 'rgba(255,255,255,0.8)');
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.38)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    contactContext.fillStyle = gradient;
    contactContext.fillRect(0, 0, 64, 64);
  }
  const contactTexture = new THREE.CanvasTexture(contactCanvas);
  const contactGeometry = new THREE.PlaneGeometry(1, 1);
  teams.slice(0, 6).forEach((team, teamIndex) => {
    const room = makeRoom(team, teamIndex, kit) as InteractiveRoom;
    rooms.set(team.id, room);
    scene.add(room.root);
    team.members.forEach((character, index) => {
      const root = new THREE.Group();
      root.name = character.id;
      root.userData.teamId = team.id;
      const model = makeProxy(character, kit);
      model.traverse((object) => { if ((object as THREE.Mesh).isMesh) (object as THREE.Mesh).castShadow = false; });
      const sleepHeight = new THREE.Box3().setFromObject(model).max.y + 0.2;
      root.add(model);
      const home = room.actorHomes?.[index]?.clone()
        ?? new THREE.Vector3((index - (team.members.length - 1) / 2) * 0.9, 0.1, 0.55 + (index % 2) * 0.16);
      root.position.copy(home);
      const sleep = sleepIndicator();
      sleep.position.set(0.2, sleepHeight, 0);
      sleep.visible = false;
      root.add(sleep);
      room.root.add(root);
      const contact = new THREE.Mesh(contactGeometry, new THREE.MeshBasicMaterial({ map: contactTexture, color: '#76664f', opacity: 0.3, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
      contact.rotation.x = -Math.PI / 2;
      contact.scale.set(0.95, 0.65, 1);
      contact.position.set(home.x, home.y + 0.008, home.z);
      contact.renderOrder = 1;
      room.root.add(contact);
      actors.push({ character, teamId: team.id, root, model, home, contact, sleep, sleepHeight, index, facing: room.actorFacing?.[index] ?? 0 });
    });
  });
  const worldBounds = new THREE.Box3().setFromObject(scene);
  const worldSize = worldBounds.getSize(new THREE.Vector3());
  const framingPoints: THREE.Vector3[] = [];
  scene.traverseVisible((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    if (!bounds) return;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      framingPoints.push(new THREE.Vector3(x, y, z).applyMatrix4(mesh.matrixWorld));
    }
  });
  const defaultTarget = worldBounds.getCenter(new THREE.Vector3());
  defaultTarget.y = 0.7;
  const defaultDirection = new THREE.Vector3(0, Math.sin(THREE.MathUtils.degToRad(43)), Math.cos(THREE.MathUtils.degToRad(43)));
  const defaultPosition = defaultTarget.clone().addScaledVector(defaultDirection, 48);
  camera.position.copy(defaultPosition);
  camera.lookAt(defaultTarget);
  camera.updateMatrixWorld();
  sunlight.target.position.copy(defaultTarget);
  scene.add(sunlight.target);
  const campusContact = new THREE.Mesh(contactGeometry, new THREE.MeshBasicMaterial({ map: contactTexture, color: '#8b755e', opacity: 0.32, transparent: true, depthWrite: false }));
  campusContact.rotation.x = -Math.PI / 2;
  campusContact.scale.set(worldSize.x * 1.13, worldSize.z * 1.18, 1);
  campusContact.position.set(defaultTarget.x, worldBounds.min.y - 0.012, defaultTarget.z);
  scene.add(campusContact);
  host.dataset.proxyCount = String(actors.length);
  host.dataset.loadedCharacters = '0';

  let state: SceneState = { selectedTeam: teams[0]?.id ?? '', activity: {}, decorations: {}, paused: false, reducedMotion: false };
  let disposed = false;
  let contextLost = false;
  let nativeVisible = (window as Window & { __PLATOP_DESKTOP_VISIBLE__?: boolean }).__PLATOP_DESKTOP_VISIBLE__ !== false;
  let documentVisible = !document.hidden;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let systemReducedMotion = motionPreference.matches;
  let timer: number | undefined;
  let timerDeadline = Infinity;
  let lastTick = performance.now();
  let lastRenderAt = -Infinity;
  let wasAnimating = false;
  let wasVisible = false;
  let motionTime = 0;
  let zoomLevel = 1;
  let fittedDistance = 48;
  let width = 0;
  let height = 0;
  let bufferWidth = 0;
  let bufferHeight = 0;
  let bufferDpr = 0;
  let decorationSignature = '';
  const assetAbort = new AbortController();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pickRoots = [...rooms.values()].map((room) => room.root);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(defaultTarget);
  controls.cursor.copy(defaultTarget);
  controls.enableDamping = false;
  controls.autoRotate = false;
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.minZoom = 0.65;
  controls.maxZoom = 2.8;
  controls.minDistance = 48 / 2.8;
  controls.maxDistance = 48 / 0.65;
  controls.minPolarAngle = THREE.MathUtils.degToRad(25);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(55);
  controls.maxTargetRadius = Math.max(worldSize.x, worldSize.z) * 0.65;
  controls.panSpeed = 0.85;
  controls.rotateSpeed = 0.5;
  controls.zoomSpeed = 0.8;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.listenToKeyEvents(canvas);
  controls.update();
  controls.saveState();
  const wallFades: Array<{ normal: THREE.Vector3; twoSided: boolean; materials: Array<{ material: THREE.Material; opacity: number; depthWrite: boolean }> }> = [];
  rooms.forEach((room) => {
    for (const wall of room.walls ?? []) {
      const clones = new Map<THREE.Material, THREE.Material>();
      wall.root.traverse((object) => {
        const renderable = object as THREE.Mesh;
        if (!renderable.material) return;
        const clone = (material: THREE.Material): THREE.Material => {
          let cloned = clones.get(material);
          if (!cloned) {
            cloned = material.clone();
            cloned.transparent = true;
            clones.set(material, cloned);
          }
          return cloned;
        };
        renderable.material = Array.isArray(renderable.material) ? renderable.material.map(clone) : clone(renderable.material);
      });
      wallFades.push({ normal: wall.normal.clone().transformDirection(room.root.matrixWorld), twoSided: !!wall.twoSided, materials: [...clones.values()].map((material) => ({ material, opacity: material.opacity, depthWrite: material.depthWrite })) });
    }
  });
  function fadeWalls(): void {
    const towardCamera = camera.position.clone().sub(controls.target).normalize();
    wallFades.forEach((wall) => {
      const facing = wall.twoSided ? Math.abs(towardCamera.dot(wall.normal)) : towardCamera.dot(wall.normal);
      const opacity = 1 - THREE.MathUtils.smoothstep(facing, 0.05, 0.35) * 0.93;
      wall.materials.forEach(({ material, opacity: originalOpacity, depthWrite }) => {
        material.opacity = opacity * originalOpacity;
        material.depthWrite = opacity > 0.99 && depthWrite;
      });
    });
  }
  const gestures = new Map<number, { x: number; y: number; dragged: boolean }>();
  function cameraChanged(): void {
    const clamped = controls.target.clone();
    clamped.x = THREE.MathUtils.clamp(clamped.x, worldBounds.min.x + 0.7, worldBounds.max.x - 0.7);
    clamped.z = THREE.MathUtils.clamp(clamped.z, worldBounds.min.z + 0.7, worldBounds.max.z - 0.7);
    clamped.y = defaultTarget.y;
    camera.position.add(clamped.clone().sub(controls.target));
    controls.target.copy(clamped);
    // Cursor zoom moves along the pointer ray before rebuilding a floor-plane
    // target. Clamp that resulting distance too, especially at off-center zoom.
    const offset = camera.position.clone().sub(controls.target);
    const distance = offset.length();
    const boundedDistance = THREE.MathUtils.clamp(distance, controls.minDistance, controls.maxDistance);
    if (distance > 0 && Math.abs(distance - boundedDistance) > 0.000001) {
      camera.position.copy(controls.target).addScaledVector(offset, boundedDistance / distance);
    }
    camera.updateMatrixWorld();
    zoomLevel = fittedDistance / camera.position.distanceTo(controls.target);
    fadeWalls();
    wake(true);
  }
  fadeWalls();

  const visible = () => documentVisible && nativeVisible && !contextLost && !disposed;
  const still = () => state.paused || state.reducedMotion || systemReducedMotion;
  const activity = (id: string): Activity => state.activity[id] ?? 'unknown';
  function cadence(): number {
    if (!visible() || still()) return 0;
    if (teams.some((team) => activity(team.id) === 'active')) return 24;
    if (teams.some((team) => activity(team.id) === 'sleeping')) return 4;
    return 0;
  }

  function selectClip(actor: Actor, clip: ClipName): void {
    if (!actor.mixer || !actor.actions || actor.clip === clip) return;
    const action = actor.actions[clip] ?? actor.actions.Idle;
    const previous = actor.clip ? actor.actions[actor.clip] : undefined;
    previous?.stop();
    if (action) {
      action.reset().setLoop(THREE.LoopRepeat, Infinity).play();
      actor.mixer.update(0);
    }
    actor.clip = clip;
  }

  function updateActors(delta: number): void {
    const frozen = still();
    actors.forEach((actor) => {
      const status = activity(actor.teamId);
      const phase = (motionTime + actor.index * 2.1) % 13;
      const moving = status === 'active' && phase < 5.2 && !frozen;
      const angle = motionTime * 0.95 + actor.index * 1.6;
      const floating = actor.character.kind === 'swift' && moving ? 0.18 : 0;
      if (status !== 'active' || frozen) {
        actor.root.position.copy(actor.home);
        actor.root.rotation.set(0, actor.facing, 0);
      } else if (moving) {
        actor.root.position.set(actor.home.x + Math.sin(angle) * 0.28, actor.home.y + floating,
          actor.home.z + Math.cos(angle) * 0.3);
        actor.root.rotation.set(0, Math.atan2(Math.cos(angle), -Math.sin(angle)), 0);
      } else {
        actor.root.position.copy(actor.home);
        actor.root.rotation.set(0, actor.facing + 0.08 * Math.sin(motionTime * 0.5 + actor.index), 0);
      }
      if (!actor.mixer) {
        animateCharacter(actor.model, status, motionTime, actor.index, moving, frozen);
      }
      actor.sleep.visible = status === 'sleeping' && !actor.authoredSleepFx;
      actor.sleep.position.y = actor.sleepHeight + (status === 'sleeping' && !frozen ? Math.sin(motionTime * 1.4 + actor.index) * 0.055 : 0);
      actor.contact.position.set(actor.root.position.x, actor.home.y + 0.008, actor.root.position.z);
      selectClip(actor, status === 'sleeping' ? 'Sleep' : status === 'active' ? moving ? 'Move' : 'Work' : 'Idle');
      if (actor.mixer && !frozen && (status === 'active' || status === 'sleeping')) actor.mixer.update(delta);
    });
  }

  function renderFrame(): void {
    if (!visible() || width <= 0 || height <= 0) return;
    // Sleep-only and static scenes also use fewer pixels. Only resize the GPU
    // drawing buffer when its dimensions or the activity pixel budget change.
    const dpr = Math.min(window.devicePixelRatio || 1, cadence() === 24 ? 1.5 : 1);
    if (bufferDpr !== dpr || bufferWidth !== width || bufferHeight !== height) {
      if (bufferDpr !== dpr) renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      bufferDpr = dpr;
      bufferWidth = width;
      bufferHeight = height;
    }
    renderer.render(scene, camera);
  }
  function cancelTimer(): void {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
    timerDeadline = Infinity;
  }
  function schedule(eventDriven = false, interactive = false): void {
    const fps = cadence();
    host.dataset.sceneFps = String(fps);
    if (!visible() || (!fps && !eventDriven)) { cancelTimer(); return; }
    // Coalesce updates, wheel input and resizes as well as animation frames.
    // One pending timeout always represents the latest state; bursts cannot
    // exceed the scene cap or keep restarting the animation clock.
    const limit = interactive ? 24 : fps || 24;
    const now = performance.now();
    const deadline = Math.max(now, lastRenderAt + 1000 / limit);
    if (timer !== undefined) {
      // Keep an already-due frame in the queue. Replacing it on every incoming
      // event could otherwise starve drawing under a sustained event burst.
      if (timerDeadline <= now || Math.abs(timerDeadline - deadline) < 1) return;
      cancelTimer();
    }
    timerDeadline = deadline;
    timer = window.setTimeout(tick, Math.ceil(Math.max(0, deadline - now)));
  }
  function tick(): void {
    timer = undefined;
    timerDeadline = Infinity;
    if (!visible()) return;
    const now = performance.now();
    const delta = cadence() ? Math.min((now - lastTick) / 1000, 0.3) : 0;
    lastTick = now;
    motionTime += delta;
    updateActors(delta);
    lastRenderAt = now;
    renderFrame();
    schedule();
  }
  function wake(interactive = false): void {
    if (disposed) return;
    const isAnimating = cadence() > 0;
    const isVisible = visible();
    if ((!wasAnimating && isAnimating) || (!wasVisible && isVisible)) lastTick = performance.now();
    wasAnimating = isAnimating;
    wasVisible = isVisible;
    schedule(true, interactive);
  }
  function resize(): void {
    if (disposed) return;
    width = host.clientWidth;
    height = host.clientHeight;
    const aspect = Math.max(width, 1) / Math.max(height, 1);
    // Perspective corner fit preserves the reference's narrow back / wider front.
    const framingCamera = camera.clone();
    framingCamera.position.copy(defaultPosition);
    framingCamera.lookAt(defaultTarget);
    framingCamera.updateMatrixWorld();
    const inverseRotation = framingCamera.quaternion.clone().invert();
    const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanHorizontal = tanVertical * aspect;
    let fit = 0;
    for (const worldPoint of framingPoints) {
      const point = worldPoint.clone().sub(defaultTarget).applyQuaternion(inverseRotation);
      fit = Math.max(fit, point.z + Math.abs(point.x) / tanHorizontal, point.z + Math.abs(point.y) / tanVertical);
    }
    fittedDistance = fit * 1.035;
    defaultPosition.copy(defaultTarget).addScaledVector(defaultDirection, fittedDistance);
    const direction = camera.position.clone().sub(controls.target).normalize();
    controls.minDistance = Math.max(fittedDistance / 2.8, (worldBounds.max.y - defaultTarget.y + 2) / Math.sin(THREE.MathUtils.degToRad(35)));
    controls.maxDistance = fittedDistance / 0.65;
    camera.position.copy(controls.target).addScaledVector(direction, THREE.MathUtils.clamp(fittedDistance / zoomLevel, controls.minDistance, controls.maxDistance));
    camera.aspect = aspect;
    // Lift the starting campus within the canvas, leaving the entry and camera
    // controls breathing room without changing the front-width fit or tilt.
    if (width > 0 && height > 0) camera.setViewOffset(width, height, 0, height * 0.045, width, height);
    camera.updateProjectionMatrix();
    controls.update();
    wake(true);
  }

  function teamAt(event: PointerEvent): string | undefined {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    scene.updateMatrixWorld();
    raycaster.setFromCamera(pointer, camera);
    for (const hit of raycaster.intersectObjects(pickRoots, true)) {
      let node: THREE.Object3D | null = hit.object;
      while (node) {
        if (typeof node.userData.teamId === 'string') return node.userData.teamId;
        node = node.parent;
      }
    }
  }
  function click(event: PointerEvent): void {
    const gesture = gestures.get(event.pointerId);
    gestures.delete(event.pointerId);
    canvas.style.cursor = 'grab';
    if (event.button !== 0 || disposed || gesture?.dragged || event.shiftKey || event.ctrlKey || event.metaKey) return;
    const teamId = teamAt(event);
    if (teamId) onSelect(teamId);
  }
  function pointerDown(event: PointerEvent): void {
    if (event.pointerType !== 'touch') canvas.focus({ preventScroll: true });
    gestures.set(event.pointerId, { x: event.clientX, y: event.clientY, dragged: false });
    if (gestures.size > 1) gestures.forEach((gesture) => { gesture.dragged = true; });
    canvas.style.cursor = 'grabbing';
  }
  function pointerCancel(event: PointerEvent): void { gestures.delete(event.pointerId); canvas.style.cursor = 'grab'; }
  function hover(event: PointerEvent): void {
    const gesture = gestures.get(event.pointerId);
    if (gesture && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 5) gesture.dragged = true;
    canvas.style.cursor = gestures.size ? 'grabbing' : teamAt(event) ? 'pointer' : 'grab';
  }
  function setZoom(factor: number): void {
    if (disposed || !Number.isFinite(factor) || factor <= 0) return;
    const direction = camera.position.clone().sub(controls.target);
    const distance = THREE.MathUtils.clamp(direction.length() / factor, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).addScaledVector(direction.normalize(), distance);
    controls.update();
    wake(true);
  }
  function resetView(): void {
    if (disposed) return;
    zoomLevel = 1;
    controls.reset();
    camera.position.copy(defaultPosition);
    controls.target.copy(defaultTarget);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.update();
    fadeWalls();
    wake(true);
  }
  function keyboard(event: KeyboardEvent): void {
    if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(1.15); }
    else if (event.key === '-' || event.key === '_') { event.preventDefault(); setZoom(1 / 1.15); }
    else if (event.key === 'Home') { event.preventDefault(); resetView(); }
  }
  function visibility(): void { documentVisible = !document.hidden; wake(); }
  function nativeVisibility(event: Event): void {
    const flag = (event as CustomEvent<{ visible?: unknown }>).detail?.visible;
    if (typeof flag !== 'boolean') return;
    nativeVisible = flag;
    wake();
  }
  function motionChanged(): void { systemReducedMotion = motionPreference.matches; wake(); }
  function lost(event: Event): void {
    event.preventDefault();
    contextLost = true;
    cancelTimer();
    host.dataset.sceneFps = '0';
    onError?.('The 3D context was interrupted. Team status remains available.');
  }
  function restored(): void { contextLost = false; bufferDpr = 0; renderer.shadowMap.needsUpdate = true; onError?.(''); wake(); }
  controls.addEventListener('change', cameraChanged);
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointerup', click);
  canvas.addEventListener('pointercancel', pointerCancel);
  canvas.addEventListener('pointermove', hover);
  canvas.addEventListener('keydown', keyboard);
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('platop:visibility', nativeVisibility);
  motionPreference.addEventListener('change', motionChanged);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  async function loadAssets(): Promise<void> {
    try {
      // Authored deliveries remain separate from the critic-approved starting
      // space. An explicit local allowlist selects assets for the default scene.
      const approvalResponse = await fetch('/assets/approved.json', { signal: assetAbort.signal, cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
      if (!approvalResponse.ok) return;
      const approval: unknown = await approvalResponse.json();
      if (!approval || typeof approval !== 'object') return;
      const record = approval as { schemaVersion?: unknown; characterIds?: unknown };
      if (record.schemaVersion !== 1 || !Array.isArray(record.characterIds)) return;
      const approved = new Set(record.characterIds.filter((id): id is string => typeof id === 'string' && actors.some((actor) => actor.character.id === id)));
      if (!approved.size) return;
      const manifest = await fetchManifest([...approved], assetAbort.signal);
      const queued = actors.filter((actor) => approved.has(actor.character.id) && manifest.characters[actor.character.id]?.path);
      // Two concurrent local decodes avoid a startup burst when all sixteen models arrive.
      async function worker(): Promise<void> {
        while (queued.length && !disposed) {
          const actor = queued.shift();
          if (!actor) return;
          const asset = manifest.characters[actor.character.id];
          if (!asset?.path) continue;
          try {
            const gltf = await fetchCharacter(asset.path, assetAbort.signal);
            if (disposed) { disposeObject(gltf.scene); return; }
            const bounds = new THREE.Box3().setFromObject(gltf.scene);
            const modelHeight = bounds.max.y - bounds.min.y;
            if (!Number.isFinite(modelHeight) || modelHeight < 0.001) {
              disposeObject(gltf.scene);
              throw new Error('Character model has no visible geometry.');
            }
            const displayHeight = actor.character.kind === 'owl' || actor.character.kind === 'lantern' ? 1.85 : actor.character.kind === 'swift' ? 0.95 : 1.65;
            const assetScale = displayHeight / modelHeight;
            gltf.scene.scale.multiplyScalar(assetScale);
            gltf.scene.position.multiplyScalar(assetScale);
            gltf.scene.position.y -= bounds.min.y * assetScale;
            gltf.scene.traverse((object) => {
              if ((object as THREE.Mesh).isMesh) {
                (object as THREE.Mesh).castShadow = false;
                (object as THREE.Mesh).receiveShadow = true;
              }
            });
            retiredProxies.add(actor.model);
            actor.model = gltf.scene;
            actor.sleepHeight = displayHeight + 0.2;
            actor.root.add(gltf.scene);
            actor.root.userData.assetStatus = 'authored-model';
            actor.mixer = new THREE.AnimationMixer(gltf.scene);
            actor.actions = {};
            CLIP_NAMES.forEach((name) => {
              const clip = gltf.animations.find((candidate) => candidate.name === asset.clips[name]);
              if (clip) actor.actions![name] = actor.mixer!.clipAction(clip);
            });
            actor.authoredSleepFx = !!gltf.scene.getObjectByName('fx_zzz') && !!actor.actions.Sleep;
            if (!CLIP_NAMES.every((name) => actor.actions?.[name])) {
              onError?.(`Model for ${actor.character.name} is loaded, but some authored clips are still pending.`);
            }
            host.dataset.loadedCharacters = String(actors.filter((candidate) => candidate.mixer).length);
            host.dataset.proxyCount = String(actors.filter((candidate) => !candidate.mixer).length);
            wake();
          } catch (error) {
            if (!disposed && !assetAbort.signal.aborted) onError?.(error instanceof Error ? error.message : 'Character model could not load.');
          }
        }
      }
      await Promise.all([worker(), worker()]);
    } catch (error) {
      if (!disposed && !assetAbort.signal.aborted) onError?.(error instanceof Error ? error.message : 'Character manifest could not load.');
    }
  }
  void loadAssets();

  return {
    update(next) {
      if (disposed) return;
      state = { ...next, activity: { ...next.activity }, decorations: { ...next.decorations } };
      const nextDecorationSignature = teams.map((team) => `${team.id}:${(state.decorations[team.id] ?? []).join(',')}`).join('|');
      if (nextDecorationSignature !== decorationSignature) {
        decorationSignature = nextDecorationSignature;
        renderer.shadowMap.needsUpdate = true;
      }
      rooms.forEach((room, id) => {
        room.outline.visible = id === state.selectedTeam;
        const chosen = state.decorations[id] ?? [];
        Object.entries(room.decorations).forEach(([name, object]) => { object.visible = chosen.includes(name as keyof Room['decorations']); });
      });
      wake();
    },
    resetCamera: resetView,
    zoom: setZoom,
    dispose() {
      if (disposed) return;
      disposed = true;
      assetAbort.abort();
      cancelTimer();
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('platop:visibility', nativeVisibility);
      motionPreference.removeEventListener('change', motionChanged);
      controls.removeEventListener('change', cameraChanged);
      controls.dispose();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointerup', click);
      canvas.removeEventListener('pointercancel', pointerCancel);
      canvas.removeEventListener('pointermove', hover);
      canvas.removeEventListener('keydown', keyboard);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      actors.forEach((actor) => { actor.mixer?.stopAllAction(); actor.mixer?.uncacheRoot(actor.model); });
      const resources = new THREE.Group();
      resources.add(scene, retiredProxies);
      disposeObject(resources);
      kit.dispose();
      sunlight.shadow.dispose();
      resources.clear();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      delete host.dataset.sceneFps;
      delete host.dataset.loadedCharacters;
      delete host.dataset.proxyCount;
    }
  };
}

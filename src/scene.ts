import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Activity, Character, ObserverMode, ObserverMove, ObserverState, SceneHandle, SceneState, Team } from './types';
import { CLIP_NAMES, fetchCharacter, fetchManifest, type ClipName } from './scene/assets';
import { disposeObject, SceneKit } from './scene/primitives';
import { animateCharacter, makeProxy, AuthoredFootPose } from './scene/proxies';
import { makeCampus, makeRoom, campusNavigation, type Room } from './scene/rooms';
import { ActorContactBatch, freezeStaticAuthoredMeshes, SceneBatches } from './scene/performanceBatching';
import { FramePacer } from './scene/framePacing';
import { FrameOutput } from './scene/frameOutput';
import { enableFlatMappedWallSinglePass } from './scene/flatMappedWalls';
import { OfficeMotor, OfficeNavigator, makeOfficeMap } from './scene/officeNavigation';
import { OfficeAssetsRenderer } from './scene/officeAssets';
import { StudioEnvironment, StudioRoomFinishes, roomLightingFactor } from './scene/studioEnvironment';
import { StaticContacts, actorContactHeight } from './scene/staticContacts';
import { agentExpression, type AgentExpression } from './scene/agentExpression';
import { ObserverMist, observerViewportChanged, type ObserverViewport } from './scene/observerMist';
import { daylightAtHour } from './localDaylight';
import { CharacterDetail } from './scene/characterDetail';

// Keep cinematic 3D at a bounded 1.5 backing pixels per CSS pixel with edge smoothing. Interface
// text and controls still use the display's full native pixel density.
const SCENE_PIXEL_RATIO_CAP = 1.5;
const CAMPUS_FOV = 14;
const CAMPUS_ELEVATION = THREE.MathUtils.degToRad(34);
const CLOSE_ZOOM_THRESHOLD = 4.5;
const MAX_CAMPUS_ZOOM = 32;

interface ProxyPose {
  object: THREE.Object3D;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

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
  motor: OfficeMotor;
  expression?: AgentExpression;
  poseSettling?: number;
  seatedFeet?: AuthoredFootPose;
  proxySeatLift?: number;
  physicalOffice?: string;
  mixer?: THREE.AnimationMixer;
  actions?: Partial<Record<ClipName, THREE.AnimationAction>>;
  clip?: ClipName;
  authoredSleepFx?: boolean;
  proxyPose?: ProxyPose[];
}
type InteractiveRoom = Room & {
  actorHomes?: THREE.Vector3[];
  actorFacing?: number[];
  walls?: Array<{ root: THREE.Object3D; normal: THREE.Vector3; twoSided?: boolean }>;
};

function makeSleepMaterial(): THREE.SpriteMaterial {
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
  return new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false });
}

function sleepIndicator(material: THREE.SpriteMaterial): THREE.Sprite {
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.7, 0.38, 1);
  sprite.renderOrder = 10;
  return sprite;
}

/** Lightweight local visualisation only. The renderer never controls agent work. */
export function createScene(host: HTMLElement, teams: Team[], onSelect: (id: string) => void,
  onError?: (message: string) => void, onObserverState?: (state: ObserverState) => void): SceneHandle {
  let renderer: THREE.WebGLRenderer;
  try {
    // Three creates an alpha-enabled context internally. Supply the explicit
    // opaque context so the browser can skip blending the whole 3D canvas.
    const surface = document.createElement('canvas');
    const context = surface.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'low-power' });
    if (!context) throw new Error('WebGL2 unavailable.');
    renderer = new THREE.WebGLRenderer({ canvas: surface, context, antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch {
    const notice = document.createElement('p');
    notice.className = 'scene-fallback';
    notice.textContent = 'The 3D workspace needs WebGL. Your team controls and status are still available.';
    notice.setAttribute('role', 'status');
    host.append(notice);
    onError?.('WebGL unavailable. Showing team details without the 3D workspace.');
    return { update() {}, resetCamera() {}, zoom() {}, rotate() {}, tilt() {}, pan() {}, setNavigationMode() {}, setIdleView() {}, enterObserver() {}, exitObserver() {}, setObserverMode() {}, moveObserver() {}, lookObserver() {}, dispose() { notice.remove(); } };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SCENE_PIXEL_RATIO_CAP));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.setClearColor('#f5f3ed', 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('role', 'img');
  canvas.tabIndex = 0;
  const campusLabel = 'Six connected 3D team offices. Drag to pan; right-drag or shift-drag to orbit and tilt; scroll to zoom. When focused, arrow keys pan, shift and arrows orbit, plus and minus zoom, and Home resets. Use the team list to select an office.';
  canvas.setAttribute('aria-label', campusLabel);
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  host.append(canvas);

  const scene = new THREE.Scene();
  const studio = new StudioEnvironment(renderer, scene);
  const output = new FrameOutput(renderer, scene, host);
  const camera = new THREE.PerspectiveCamera(CAMPUS_FOV, 1, 0.1, 180);
  camera.position.set(0, 38, 27);
  camera.lookAt(0, 0.7, 0);
  camera.updateMatrixWorld();
  const skyLight = new THREE.HemisphereLight('#fff9f0', '#90755f', 0.72);
  scene.add(skyLight);
  const sunlight = new THREE.DirectionalLight('#fff4e5', 2.5);
  sunlight.position.set(-9, 19, 11);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  sunlight.shadow.bias = -0.0004;
  sunlight.shadow.normalBias = 0.025;
  sunlight.shadow.radius = 20;
  sunlight.shadow.blurSamples = 12;
  sunlight.shadow.camera.near = 1;
  sunlight.shadow.camera.far = 80;
  sunlight.shadow.camera.left = -16;
  sunlight.shadow.camera.right = 16;
  sunlight.shadow.camera.top = 16;
  sunlight.shadow.camera.bottom = -16;
  scene.add(sunlight);
  let daylight = daylightAtHour(12);
  function updateDaylight(next = daylight): void {
    daylight = next;
    skyLight.color.set(next.sky); skyLight.groundColor.set(next.ground); skyLight.intensity = next.ambient;
    sunlight.color.set(next.sun); sunlight.intensity = next.sunIntensity;
    sunlight.position.set(...next.sunPosition); sunlight.updateMatrixWorld(true);
    scene.environmentIntensity = next.reflection;
    output.setBackdrop(...next.backdrop, next.dark ? next.backdrop[1] : '#c4c0aa');
    renderer.shadowMap.needsUpdate = true;
  }
  // The first update can be exactly noon. Apply that profile now rather than
  // marking noon current while the lights still contain constructor defaults.
  updateDaylight();
  const kit = new SceneKit();
  const campus = makeCampus(kit);
  scene.add(campus);
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
  // Labels share immutable resources within this scene; each Sprite keeps its own transform.
  let sharedSleepMaterial: THREE.SpriteMaterial | undefined;
  teams.slice(0, 6).forEach((team, teamIndex) => {
    const room = makeRoom(team, teamIndex, kit) as InteractiveRoom;
    rooms.set(team.id, room);
    scene.add(room.root);
  });
  const roomFillLights = new Map<string, THREE.PointLight>();
  rooms.forEach((room, id) => {
    // One bounded shadow-free bounce per room, reused at night and for agent
    // lighting. Daylight defaults still add no point lights to the shader.
    const fill = new THREE.PointLight('#ffe8bf', 0.8, 6.3, 2);
    fill.name = 'Agent room lighting';
    fill.userData.roomStyleFill = true;
    fill.position.set(0, 3.0, room.navigation.task[1]);
    fill.visible = false;
    room.root.add(fill);
    roomFillLights.set(id, fill);
  });
  const navigator = new OfficeNavigator(makeOfficeMap(rooms, teams, campusNavigation));
  const officeAssets = new OfficeAssetsRenderer(rooms);
  teams.slice(0, 6).forEach(team => {
    const room = rooms.get(team.id)!;
    team.members.forEach((character, index) => {
      const root = new THREE.Group();
      root.name = character.id;
      root.userData.teamId = team.id;
      const model = makeProxy(character, kit);
      model.traverse((object) => { if ((object as THREE.Mesh).isMesh) (object as THREE.Mesh).castShadow = false; });
      const sleepHeight = new THREE.Box3().setFromObject(model).max.y + 0.2;
      root.add(model);
      const desk = navigator.desk(character.id)!;
      const home = new THREE.Vector3(desk.position[0], desk.seatHeight ?? desk.floorY, desk.position[1]);
      // Swift's folded transit pose is bounded separately from its spread idle wings.
      const radius = character.kind === 'swift' ? 0.6 : character.kind === 'owl' ? 0.7 : 0.61;
      const motor = new OfficeMotor(character.id, team.id, radius, navigator, desk);
      motor.heading = room.actorFacing?.[index] ?? motor.heading;
      root.position.copy(home);
      root.rotation.y = motor.heading;
      const sleep = sleepIndicator(sharedSleepMaterial ??= makeSleepMaterial());
      sleep.position.set(0.2, sleepHeight, 0);
      sleep.visible = false;
      root.add(sleep);
      // Ownership stays with the team; physical presence can cross rooms.
      scene.add(root);
      const contact = new THREE.Mesh(contactGeometry, new THREE.MeshBasicMaterial({ map: contactTexture, color: '#76664f', opacity: 0.42, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
      contact.rotation.x = -Math.PI / 2;
      contact.scale.set(0.95, 0.65, 1);
      contact.position.set(home.x, desk.floorY + 0.008, home.z);
      contact.renderOrder = 1;
      scene.add(contact);
      actors.push({ character, teamId: team.id, root, model, home, contact, sleep, sleepHeight, index, facing: desk.facing ?? 0, motor });
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
  const defaultDirection = new THREE.Vector3(0, Math.sin(CAMPUS_ELEVATION), Math.cos(CAMPUS_ELEVATION));
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

  let state: SceneState = { selectedTeam: teams[0]?.id ?? '', activity: {}, decorations: {}, paused: false, reducedMotion: false, controlMode: 'offline' };
  let restoredOffice = false;
  let disposed = false;
  let contextLost = false;
  let nativeVisible = (window as Window & { __PLATOP_DESKTOP_VISIBLE__?: boolean }).__PLATOP_DESKTOP_VISIBLE__ !== false;
  let documentVisible = !document.hidden;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let systemReducedMotion = motionPreference.matches;
  const framePacer = new FramePacer();
  let animationFrame: number | undefined;
  let lastTick = performance.now();
  let wasAnimating = false;
  let wasVisible = false;
  let motionTime = 0;
  let settlingRemaining = 0;
  let deferredCampusSettle = false;
  let zoomLevel = 1;
  let fittedDistance = 48;
  let width = 0;
  let height = 0;
  let bufferWidth = 0;
  let bufferHeight = 0;
  let bufferDpr = 0;
  let decorationSignature = '';
  let idleTeamId: string | null = null;
  let navigationMode: 'pan' | 'rotate' = 'pan';
  let campusPose: { position: THREE.Vector3; target: THREE.Vector3; zoom: number } | undefined;
  let observerRig: ObserverMist | undefined;
  let observerStateSignature = '';
  let observerCursor = '';
  let observerLabel = '';
  let observerViewport: ObserverViewport | undefined;
  const queryDiagnostics = new URLSearchParams(window.location.search).get('motion-debug') === '1';
  let diagnosticsEnabled = false;
  const diagnosticFields = ['sceneFrames', 'sceneMeasuredFps', 'sceneIntervalP50', 'sceneIntervalP95', 'sceneIntervalMax', 'sceneLongFrames', 'sceneTargetFps'] as const;
  const stageFields = ['sceneActorsMeanMs', 'sceneBatchesMeanMs', 'sceneContactsMeanMs', 'sceneRenderMeanMs', 'sceneTotalMeanMs', 'sceneTotalP95Ms', 'sceneStageSamples'] as const;
  const stageCapacity = 120;
  let stageFrames: Float64Array | undefined;
  let stageTotals: Float64Array | undefined;
  let stageCurrent: Float64Array | undefined;
  let stageFrameStart: number | undefined;
  let stageCount = 0;
  let stageIndex = 0;
  const resolutionFields = ['sceneDeviceDpr', 'sceneRenderDpr', 'sceneBufferWidth', 'sceneBufferHeight', 'sceneCssWidth', 'sceneCssHeight'] as const;
  const contextFields = ['sceneContextAlpha', 'sceneContextAntialias'] as const;
  const frameIntervals: number[] = [];
  let diagnosticFrameCount = 0;
  let diagnosticLastFrame: number | undefined;
  let diagnosticLastReport = -Infinity;
  const assetAbort = new AbortController();
  const raycaster = new THREE.Raycaster();
  raycaster.layers.enable(1);
  const pointer = new THREE.Vector2();
  const pickBounds = [...rooms].map(([id, room]) => ({ id, room, bounds: new THREE.Box3().setFromObject(room.root) }));
  const roomHit = new THREE.Vector3();
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(defaultTarget);
  controls.cursor.copy(defaultTarget);
  controls.enableDamping = false;
  controls.autoRotate = false;
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.minZoom = 0.65;
  controls.maxZoom = MAX_CAMPUS_ZOOM;
  controls.minDistance = 48 / MAX_CAMPUS_ZOOM;
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
  type WallFade = { normal: THREE.Vector3; twoSided: boolean; officeId?: string; materials: Array<{ material: THREE.Material; opacity: number; depthWrite: boolean }> };
  const wallFades: WallFade[] = [];
  const assetWallFades: WallFade[] = [];
  rooms.forEach((room, officeId) => {
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
      enableFlatMappedWallSinglePass(wall.root);
      wallFades.push({ officeId, normal: wall.normal.clone().transformDirection(room.root.matrixWorld), twoSided: !!wall.twoSided, materials: [...clones.values()].map((material) => ({ material, opacity: material.opacity, depthWrite: material.depthWrite })) });
    }
  });
  function fadeWalls(): void {
    const towardCamera = camera.position.clone().sub(controls.target).normalize();
    [...wallFades, ...assetWallFades].forEach((wall) => {
      const facing = wall.twoSided ? Math.abs(towardCamera.dot(wall.normal)) : towardCamera.dot(wall.normal);
      const opacity = 1 - THREE.MathUtils.smoothstep(facing, 0.05, 0.35) * 0.93;
      wall.materials.forEach(({ material, opacity: originalOpacity, depthWrite }) => {
        material.opacity = opacity * originalOpacity;
        material.depthWrite = opacity > 0.99 && depthWrite;
      });
    });
  }
  function refreshAssetWallFades(): void {
    assetWallFades.length = 0;
    rooms.forEach((room, officeId) => {
      const wall = wallFades.find(entry => entry.officeId === officeId && entry.normal.x < -0.5);
      const materials: WallFade['materials'] = [];
      room.root.children.filter(object => object.userData.decorSlot === 'wall').forEach(root => root.traverse(object => {
        const material = (object as THREE.Mesh).material;
        if (!material || Array.isArray(material)) return;
        material.transparent = true;
        const originalDepth = material.userData.officeWallDepthWrite;
        if (typeof originalDepth !== 'boolean') material.userData.officeWallDepthWrite = material.depthWrite;
        materials.push({ material, opacity: 1, depthWrite: material.userData.officeWallDepthWrite });
      }));
      if (materials.length) assetWallFades.push({ officeId, normal: wall?.normal ?? new THREE.Vector3(-1, 0, 0), twoSided: wall?.twoSided ?? true, materials });
    });
    fadeWalls();
  }
  const roomFinishes = new StudioRoomFinishes(rooms);
  const staticContacts = new StaticContacts(scene, [campus, ...[...rooms.values()].map(room => room.root)]);
  const roomLamps = [...rooms].map(([id, room]) => {
    const lights: Array<{ light: THREE.PointLight; intensity: number; color: THREE.Color }> = [];
    const glow: Array<{ material: THREE.Material & { opacity: number; color: THREE.Color }; opacity: number; color: THREE.Color }> = [];
    const shades: Array<{ material: THREE.MeshStandardMaterial; intensity: number; color: THREE.Color }> = [];
    const assets: Array<{ material: THREE.MeshStandardMaterial; intensity: number }> = [];
    room.root.traverse(object => {
      if ((object as THREE.PointLight).isPointLight && !object.userData.roomStyleFill) {
        const light = object as THREE.PointLight;
        lights.push({ light, intensity: light.intensity, color: light.color.clone() });
      }
      const material = (object as THREE.Mesh | THREE.Sprite).material;
      if (!material || Array.isArray(material)) return;
      if (material.blending === THREE.AdditiveBlending || material.userData.officeGlow) {
        const glowing = material as THREE.Material & { opacity: number; color: THREE.Color };
        glow.push({ material: glowing, opacity: glowing.opacity, color: glowing.color.clone() });
      }
      if ((material as THREE.MeshStandardMaterial).isMeshStandardMaterial && (material as THREE.MeshStandardMaterial).emissive.getHexString() === 'efb450') {
        const shade = material as THREE.MeshStandardMaterial;
        shades.push({ material: shade, intensity: shade.emissiveIntensity, color: shade.emissive.clone() });
      }
    });
    return { id, lights, glow, shades, assets, occupied: true, nextOccupied: false };
  });
  const lampOffices = new Map(roomLamps.map(entry => [entry.id, entry]));
  const assetGlowIntensities = new WeakMap<THREE.MeshStandardMaterial, number>();
  function refreshAssetLamps(): void {
    rooms.forEach((room, id) => {
      const office = lampOffices.get(id)!;
      office.assets.length = 0;
      room.root.children.filter(object => object.userData.decorSlot).forEach(root => root.traverse(object => {
        const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (!material?.isMeshStandardMaterial) return;
        const intensity = assetGlowIntensities.get(material) ?? material.emissiveIntensity;
        if (intensity > 0) {
          assetGlowIntensities.set(material, intensity);
          office.assets.push({ material, intensity });
        }
      }));
    });
  }
  function updateRoomLamps(force = false): void {
    for (const office of roomLamps) office.nextOccupied = false;
    for (const actor of actors) if (actor.motor.present && actor.physicalOffice) {
      const office = lampOffices.get(actor.physicalOffice);
      if (office) office.nextOccupied = true;
    }
    for (const office of roomLamps) {
      if (!force && office.occupied === office.nextOccupied) continue;
      office.occupied = office.nextOccupied;
      const lighting = state.rooms?.[office.id]?.lighting;
      const factor = office.occupied ? roomLightingFactor(lighting) * (1 + daylight.night * .55) : 0;
      const tint = new THREE.Color(lighting?.color ?? '#ffe8bf');
      const baseline = new THREE.Color('#ffe8bf');
      tint.setRGB(tint.r / baseline.r, tint.g / baseline.g, tint.b / baseline.b);
      for (const entry of office.lights) {
        entry.light.intensity = entry.intensity * factor;
        entry.light.color.copy(entry.color).multiply(tint);
      }
      for (const entry of office.glow) {
        entry.material.opacity = entry.opacity * Math.min(factor, 1.5);
        entry.material.color.copy(entry.color).multiply(tint);
      }
      for (const entry of office.shades) {
        entry.material.emissiveIntensity = entry.intensity * factor;
        entry.material.emissive.copy(entry.color).multiply(tint);
      }
      for (const entry of office.assets) entry.material.emissiveIntensity = entry.intensity * factor;
      const fill = roomFillLights.get(office.id)!;
      const ambientFactor = roomLightingFactor({ ...lighting, brightness: lighting?.ambientBrightness ?? lighting?.brightness });
      fill.visible = office.occupied && (daylight.night > .01 || !!lighting && Object.keys(lighting).length > 0) && ambientFactor > 0;
      fill.intensity = (0.8 + daylight.night * 4.2) * ambientFactor;
      fill.color.set(lighting?.ambientColor ?? lighting?.color ?? '#ffe8bf');
      const position = lighting?.ambientPosition ?? [0, 2.4, -0.5];
      // The bounce is a child of room.root; its coordinates are already local.
      fill.position.set(...position);
      fill.updateMatrix();
      fill.updateMatrixWorld(true);
    }
  }
  const gestures = new Map<number, { x: number; y: number; dragged: boolean }>();
  function notifyObserver(): void {
    const next: ObserverState = { active: !!observerRig?.active, available: !idleTeamId && !observerRig?.active && zoomLevel >= CLOSE_ZOOM_THRESHOLD,
      mode: observerRig?.mode ?? 'third-person' };
    const signature = `${next.active}:${next.available}:${next.mode}`;
    if (signature === observerStateSignature) return;
    observerStateSignature = signature;
    host.dataset.observerMode = next.active ? next.mode : 'orbit';
    onObserverState?.(next);
  }
  function cameraChanged(): void {
    if (observerRig?.active) { camera.updateMatrixWorld(); fadeWalls(); wake(true); return; }
    if (idleTeamId) { camera.updateMatrixWorld(); fadeWalls(); wake(true); return; }
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
    notifyObserver();
    fadeWalls();
    wake(true);
  }
  fadeWalls();
  const animatedRoots = new Set<THREE.Object3D>(actors.flatMap((actor) => [actor.root, actor.contact]));
  // Proxy joints and eyes move; their many ceramic mesh surfaces keep the same
  // local transform. Reuse those local matrices while parents animate them.
  for (const actor of actors) {
    const personality = actor.model.userData.personality as {
      body: THREE.Object3D; head: THREE.Object3D; arms: THREE.Object3D[];
      feet: THREE.Object3D[]; wings: THREE.Object3D[]; eyes: THREE.Object3D[];
    } | undefined;
    if (!personality) continue;
    const joints = new Set([personality.body, personality.head, ...personality.arms, ...personality.feet,
      ...personality.wings, ...personality.eyes]);
    actor.model.traverse((object) => {
      if (joints.has(object)) return;
      object.updateMatrix();
      object.matrixAutoUpdate = false;
    });
  }
  const prunableRoots = new Set<THREE.Object3D>(actors.map((actor) => actor.model));
  // Visibility of the campus, rooms and decoration containers is public state.
  // Their static descendants are owned here and never toggle independently.
  // Include only those descendants, so pruning cannot mask a later room toggle.
  const visibilityRoots = new Set<THREE.Object3D>([campus, ...rooms.values()].flatMap((entry) =>
    entry instanceof THREE.Object3D ? [entry] : [entry.root, entry.outline, ...Object.values(entry.decorations)]));
  function collectStaticPrunable(object: THREE.Object3D): void {
    if (animatedRoots.has(object)) return;
    if (object.userData.roomStyleFill) return;
    if (!visibilityRoots.has(object)) prunableRoots.add(object);
    object.children.forEach(collectStaticPrunable);
  }
  campus.children.forEach(collectStaticPrunable);
  rooms.forEach((room) => room.root.children.forEach(collectStaticPrunable));
  const multiDraw = !!renderer.getContext().getExtension('WEBGL_multi_draw');
  let mapArrayLimits: { maxTextureSize: number; maxLayers: number } | undefined;
  try {
    const context = renderer.getContext() as WebGL2RenderingContext;
    if (typeof context.texImage3D === 'function') mapArrayLimits = {
      maxTextureSize: renderer.capabilities.maxTextureSize,
      maxLayers: context.getParameter(context.MAX_ARRAY_TEXTURE_LAYERS) as number,
    };
  } catch { /* Unsupported array capabilities retain the original mapped planes. */ }
  const batches = new SceneBatches(scene, animatedRoots, prunableRoots, multiDraw, mapArrayLimits);
  batches.rebuild();
  const contacts = new ActorContactBatch(scene, actors.map((actor) => actor.contact));
  function freezeEnvironment(object: THREE.Object3D): void {
    if (animatedRoots.has(object)) return;
    object.updateMatrix();
    object.matrixAutoUpdate = false;
    object.children.forEach(freezeEnvironment);
  }
  freezeEnvironment(scene);
  // SceneBatches synchronizes animation transforms once before drawing. Avoid
  // the renderer repeating the same scene traversal after that explicit pass.
  scene.matrixWorldAutoUpdate = false;
  // Kept outside static batching and actor collections. This local camera
  // presence is never an office occupant and cannot enter agent telemetry.
  const observerBounds = worldBounds.clone();
  observerBounds.min.add(new THREE.Vector3(-1.5, 0, -1.5));
  observerBounds.max.add(new THREE.Vector3(1.5, 3, 1.5));
  observerBounds.min.y = Math.max(.3, worldBounds.min.y + .35);
  observerRig = new ObserverMist(camera, controls, observerBounds);
  scene.add(observerRig.mist.root);
  const characterDetail = new CharacterDetail(scene, actors, () => wake(true));

  const visible = () => documentVisible && nativeVisible && !contextLost && !disposed;
  const still = () => state.paused || state.reducedMotion || systemReducedMotion;
  const activity = (id: string): Activity => state.activity[id] ?? 'unknown';
  function cadence(): number {
    if (!visible() || still()) return 0;
    if (idleTeamId || settlingRemaining > 0 || actors.some(actor => {
      const live = state.controlMode !== 'offline';
      const expression = agentExpression(actor.motor.mode, actor.motor.gesture, activity(actor.teamId), live, actor.motor.moving);
      return (live && actor.motor.pending) || (actor.root.visible && ((actor.poseSettling ?? 0) > 0 || expression !== 'idle'));
    })) return 30;
    return 0;
  }

  function selectClip(actor: Actor, clip: ClipName, immediate = false): void {
    if (!actor.mixer || !actor.actions || actor.clip === clip) return;
    const action = actor.actions[clip] ?? actor.actions.Idle;
    const previous = actor.clip ? actor.actions[actor.clip] : undefined;
    if (action && action !== previous) {
      action.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).setLoop(THREE.LoopRepeat, Infinity).play();
      if (previous && immediate) previous.stop();
      else if (previous) previous.crossFadeTo(action, 0.3, false);
      else actor.mixer.update(0);
    }
    actor.clip = clip;
    actor.poseSettling = 0.35;
  }

  function smoothProxyPose(actor: Actor, delta: number): void {
    // Only the few animated joints need interpolation; mesh geometry and eye
    // blinks remain untouched. This softens walking/work gesture changes.
    if (!actor.proxyPose) {
      const personality = actor.model.userData.personality as {
        body: THREE.Object3D; head: THREE.Object3D; arms: THREE.Object3D[];
        feet: THREE.Object3D[]; wings: THREE.Object3D[];
      } | undefined;
      if (!personality) return;
      actor.proxyPose = [personality.body, personality.head, ...personality.arms, ...personality.feet, ...personality.wings]
        .map((object) => ({ object, position: object.position.clone(), quaternion: object.quaternion.clone() }));
      return;
    }
    const blend = 1 - Math.exp(-Math.max(0, delta) / 0.09);
    for (const pose of actor.proxyPose) {
      pose.position.lerp(pose.object.position, blend);
      pose.quaternion.slerp(pose.object.quaternion, blend);
      pose.object.position.copy(pose.position);
      pose.object.quaternion.copy(pose.quaternion);
    }
  }

  function updateActors(delta: number): void {
    const frozen = still();
    const staticPose = !state.paused && (state.reducedMotion || systemReducedMotion);
    const updatePose = !frozen || staticPose;
    actors.forEach((actor) => {
      const motor = actor.motor;
      const report = activity(actor.teamId);
      const live = state.controlMode !== 'offline';
      // Offscreen motors remain cheap and allow a visitor to enter the office
      // being watched. Their skeletons/materials are evaluated only on screen.
      if (!frozen && live) motor.update(delta);
      actor.physicalOffice = motor.officeId;
      const shown = motor.present && (!idleTeamId || actor.physicalOffice === idleTeamId);
      if (shown && !actor.root.visible) actor.proxyPose = undefined;
      actor.root.visible = shown;
      actor.contact.visible = shown;
      if (!shown) { actor.sleep.visible = false; return; }
      const moving = motor.moving && !frozen && live;
      const expression = agentExpression(motor.mode, motor.gesture, report, live, moving);
      if (!state.paused && actor.expression !== expression) {
        actor.expression = expression;
        if (staticPose) actor.proxyPose = undefined;
        else actor.poseSettling = 0.35;
      }
      const status: Activity = expression === 'rest' ? 'sleeping' : expression === 'idle' ? 'waiting' : 'active';
      const gesture = expression === 'work' || expression === 'think' || expression === 'file' || expression === 'talk' || expression === 'wait' ? expression : undefined;
      const floating = actor.character.kind === 'swift' ? 0.18 * Math.min(1, motor.speed / motor.profile.speed) : 0;
      const cheer = expression === 'celebrate' ? Math.abs(Math.sin(motionTime * 7)) * motor.celebration * 0.08 : 0;
      // A paused view switch reveals the latest motor snapshot coherently; it
      // does not advance that snapshot or leave the contact at another place.
      actor.root.position.set(motor.x, motor.y + floating + cheer, motor.z);
      actor.root.rotation.y = motor.heading;
      const seatLift = Math.max(0, motor.y - motor.floorY);
      if (frozen && actor.seatedFeet) {
        actor.seatedFeet.restore();
        actor.seatedFeet.apply(seatLift);
      } else if (frozen && !actor.mixer && actor.proxySeatLift !== undefined && actor.proxySeatLift !== seatLift) {
        const personality = actor.model.userData.personality as { feet: THREE.Object3D[] } | undefined;
        personality?.feet.forEach(foot => { foot.position.y += (actor.proxySeatLift! - seatLift) / actor.model.scale.y; });
        actor.proxySeatLift = seatLift;
      }
      if (updatePose) {
        if (!actor.mixer) {
          animateCharacter(actor.model, motor.mode === 'walk' && !moving ? 'waiting' : gesture && gesture !== 'work' ? 'waiting' : status, motionTime, actor.index, moving, staticPose, {
            phase: motor.walkPhase, speed: motor.speed, seatLift: motor.y - motor.floorY, celebration: expression === 'celebrate' ? motor.celebration : 0,
            gesture,
            foldWings: actor.character.kind === 'swift' && (motor.mode === 'walk' || Math.hypot(motor.x - actor.home.x, motor.z - actor.home.z) > 0.1),
          });
          actor.proxySeatLift = seatLift;
          if (staticPose) actor.proxyPose = undefined;
          else smoothProxyPose(actor, delta);
        }
      }
      actor.sleep.visible = status === 'sleeping' && !actor.authoredSleepFx;
      if (updatePose) actor.sleep.position.y = actor.sleepHeight + (status === 'sleeping' && !staticPose ? Math.sin(motionTime * 1.4 + actor.index) * 0.055 : 0);
      const contactOffice = actor.physicalOffice ? rooms.get(actor.physicalOffice) : undefined;
      const contactY = actorContactHeight(motor.floorY, motor.x - (contactOffice?.center.x ?? 0), motor.z - (contactOffice?.center.z ?? 0), contactOffice?.root.userData.rugSurface);
      actor.contact.position.set(motor.x, contactY, motor.z);
      if (updatePose) {
        actor.seatedFeet?.restore();
        selectClip(actor, !live ? 'Idle' : status === 'sleeping' ? 'Sleep' : moving ? 'Move' : status === 'active' && (motor.mode === 'work' || gesture === 'work' || motor.mode === 'celebrate') ? 'Work' : 'Idle', staticPose);
        // Authored locomotion stays synchronized to real travelled distance.
        const move = actor.actions?.Move;
        if (move) {
          const duration = move.getClip().duration;
          const rate = motor.speed / motor.profile.stride * duration;
          move.setEffectiveTimeScale(rate);
          if (actor.clip === 'Move') {
            move.time = ((motor.walkPhase / (Math.PI * 2) * duration - delta * rate) % duration + duration) % duration;
          }
        }
        if (actor.mixer && (status === 'active' || status === 'sleeping' || (actor.poseSettling ?? 0) > 0 || !!idleTeamId)) {
          actor.mixer.update(staticPose ? 0 : delta);
        }
        actor.seatedFeet?.apply(seatLift);
        actor.poseSettling = Math.max(0, (actor.poseSettling ?? 0) - delta);
      }
    });
    updateRoomLamps();
  }

  function applyMotorState(): void {
    if (state.paused || !visible() || state.controlMode === 'offline') return;
    for (const actor of actors) {
      const action = state.controlMode === 'live' ? state.actions?.[actor.character.id] : undefined;
      if (action) {
        if (!restoredOffice || state.reducedMotion || systemReducedMotion) actor.motor.restore(action);
        else actor.motor.apply(action);
      }
    }
    restoredOffice = true;
  }

  function renderFrame(): void {
    if (!visible() || width <= 0 || height <= 0) return;
    // A steady resolution avoids reallocating the drawing buffer on activity
    // or input changes. Every moving scene shares the cinematic cadence.
    const dpr = Math.min(window.devicePixelRatio || 1, SCENE_PIXEL_RATIO_CAP);
    if (bufferDpr !== dpr || bufferWidth !== width || bufferHeight !== height) {
      if (bufferDpr !== dpr) renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      bufferDpr = dpr;
      bufferWidth = width;
      bufferHeight = height;
      if (diagnosticsEnabled) resolutionDiagnostics();
    }
    if (!diagnosticsEnabled) {
      characterDetail.select(camera, height);
      batches.sync();
      characterDetail.sync();
      contacts.sync(camera);
      output.render(camera, !!idleTeamId, characterDetail.count > 0);
      return;
    }
    const batchStart = performance.now();
    characterDetail.select(camera, height);
    batches.sync();
    characterDetail.sync();
    host.dataset.detailedCharacters = String(characterDetail.count);
    host.dataset.detailPending = String(characterDetail.pending);
    const contactStart = performance.now();
    contacts.sync(camera);
    const renderStart = performance.now();
    output.render(camera, !!idleTeamId, characterDetail.count > 0);
    const renderEnd = performance.now();
    stageCurrent![1] = contactStart - batchStart;
    stageCurrent![2] = renderStart - contactStart;
    stageCurrent![3] = renderEnd - renderStart;
    host.dataset.sceneDrawCalls = String(renderer.info.render.calls);
    host.dataset.sceneTriangles = String(renderer.info.render.triangles);
    host.dataset.sceneRenderMs = (renderEnd - renderStart).toFixed(2);
  }
  function cancelFrame(): void {
    if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
    animationFrame = undefined;
    framePacer.reset();
  }
  function resetFrameObservations(): void {
    diagnosticLastFrame = undefined;
    diagnosticLastReport = -Infinity;
    frameIntervals.length = 0;
    stageFrames?.fill(0);
    stageTotals?.fill(0);
    stageCount = 0;
    stageIndex = 0;
    stageFields.forEach((field) => { delete host.dataset[field]; });
    for (const field of diagnosticFields) {
      if (field !== 'sceneFrames' && field !== 'sceneTargetFps') delete host.dataset[field];
    }
  }
  function motionDiagnostics(): boolean {
    const enabled = host.dataset.motionDebug === '1'
      || (host.dataset.motionDebug === undefined && queryDiagnostics);
    if (enabled !== diagnosticsEnabled) {
      diagnosticsEnabled = enabled;
      diagnosticFrameCount = 0;
      resetFrameObservations();
      diagnosticFields.forEach((field) => { delete host.dataset[field]; });
      if (enabled) {
        stageFrames = new Float64Array(stageCapacity * 5);
        stageTotals = new Float64Array(5);
        stageCurrent = new Float64Array(5);
        stageFrameStart = undefined;
        host.dataset.sceneMultiDraw = multiDraw ? '1' : '0';
        const attributes = renderer.getContext().getContextAttributes();
        if (attributes) {
          host.dataset.sceneContextAlpha = attributes.alpha ? '1' : '0';
          host.dataset.sceneContextAntialias = attributes.antialias ? '1' : '0';
        }
        resolutionDiagnostics();
      } else {
        stageFrames = undefined;
        stageTotals = undefined;
        stageCurrent = undefined;
        stageFrameStart = undefined;
        delete host.dataset.sceneMultiDraw;
        delete host.dataset.sceneDrawCalls;
        delete host.dataset.sceneTriangles;
        delete host.dataset.sceneRenderMs;
        delete host.dataset.sceneCpuMs;
        resolutionFields.forEach((field) => { delete host.dataset[field]; });
        contextFields.forEach((field) => { delete host.dataset[field]; });
      }
    }
    return enabled;
  }
  function resolutionDiagnostics(): void {
    const values = [window.devicePixelRatio || 1, bufferDpr, canvas.width, canvas.height, width, height];
    resolutionFields.forEach((field, index) => {
      const value = values[index];
      if (Number.isFinite(value)) host.dataset[field] = String(value);
      else delete host.dataset[field];
    });
  }
  function schedule(eventDriven = false): void {
    const fps = cadence();
    const fpsLabel = String(fps);
    if (host.dataset.sceneFps !== fpsLabel) {
      host.dataset.sceneFps = String(fps);
    }
    if (motionDiagnostics() && host.dataset.sceneTargetFps !== fpsLabel) host.dataset.sceneTargetFps = fpsLabel;
    if (!visible()) { cancelFrame(); return; }
    if (eventDriven) framePacer.invalidate();
    if (!framePacer.needsFrame(fps > 0) || animationFrame !== undefined) return;
    animationFrame = window.requestAnimationFrame(tick);
  }
  function recordFrame(now: number): void {
    if (!motionDiagnostics() || width <= 0 || height <= 0) return;
    // These are JavaScript wall times through command submission, not process
    // CPU or GPU completion times. Keep all collection local and opt-in.
    const total = performance.now() - now;
    const continuous = cadence() > 0;
    if (continuous && stageFrameStart === now) {
      stageCurrent![4] = total;
      const offset = stageIndex * 5;
      for (let index = 0; index < 5; index++) {
        stageTotals![index] += stageCurrent![index] - stageFrames![offset + index];
        stageFrames![offset + index] = stageCurrent![index];
      }
      stageIndex = (stageIndex + 1) % stageCapacity;
      stageCount = Math.min(stageCount + 1, stageCapacity);
    }
    host.dataset.sceneCpuMs = total.toFixed(2);
    diagnosticFrameCount += 1;
    host.dataset.sceneFrames = String(diagnosticFrameCount);
    if (diagnosticLastFrame !== undefined && continuous) {
      frameIntervals.push(now - diagnosticLastFrame);
      if (frameIntervals.length > 120) frameIntervals.shift();
    }
    diagnosticLastFrame = continuous ? now : undefined;
    if (now - diagnosticLastReport < 500) return;
    diagnosticLastReport = now;
    if (stageCount) {
      for (let index = 0; index < 5; index++) host.dataset[stageFields[index]] = (stageTotals![index] / stageCount).toFixed(3);
      const totals = Array.from({ length: stageCount }, (_, index) => stageFrames![index * 5 + 4]).sort((a, b) => a - b);
      host.dataset.sceneTotalP95Ms = totals[Math.min(totals.length - 1, Math.floor(totals.length * 0.95))].toFixed(3);
      host.dataset.sceneStageSamples = String(stageCount);
    }
    if (!frameIntervals.length) return;
    const sorted = [...frameIntervals].sort((a, b) => a - b);
    const percentile = (fraction: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
    const intervalTotal = frameIntervals.reduce((sum, interval) => sum + interval, 0);
    host.dataset.sceneMeasuredFps = (1000 * frameIntervals.length / intervalTotal).toFixed(2);
    host.dataset.sceneIntervalP50 = percentile(0.5).toFixed(2);
    host.dataset.sceneIntervalP95 = percentile(0.95).toFixed(2);
    host.dataset.sceneIntervalMax = sorted[sorted.length - 1].toFixed(2);
    host.dataset.sceneLongFrames = String(frameIntervals.filter((interval) => interval > 50.5).length);
  }
  function tick(now: number): void {
    animationFrame = undefined;
    if (!visible()) return;
    if (framePacer.shouldRender(now, cadence() > 0)) {
      const delta = cadence() ? Math.min(Math.max(0, now - lastTick) / 1000, 0.1) : 0;
      lastTick = now;
      motionTime += delta;
      const frameStart = performance.now();
      if (diagnosticsEnabled) {
        stageFrameStart = frameStart;
        updateActors(delta);
        stageCurrent![0] = performance.now() - frameStart;
      } else updateActors(delta);
      settlingRemaining = Math.max(0, settlingRemaining - delta);
      const isAnimating = cadence() > 0;
      if (wasAnimating !== isAnimating) resetFrameObservations();
      wasAnimating = isAnimating;
      renderFrame();
      recordFrame(frameStart);
    }
    schedule();
  }
  function wake(_interactive = false): void {
    if (disposed) return;
    applyMotorState();
    const isAnimating = cadence() > 0;
    const isVisible = visible();
    if (wasAnimating !== isAnimating || wasVisible !== isVisible) {
      lastTick = performance.now();
      framePacer.reset();
      resetFrameObservations();
    }
    wasAnimating = isAnimating;
    wasVisible = isVisible;
    schedule(true);
  }
  function resize(): void {
    output.invalidateBackground();
    if (disposed) return;
    width = host.clientWidth;
    height = host.clientHeight;
    const aspect = Math.max(width, 1) / Math.max(height, 1);
    if (observerRig?.active) { observerRig.resize(aspect); wake(true); return; }
    if (idleTeamId) { camera.aspect = aspect; applyIdleCamera(); wake(true); return; }
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
    controls.minDistance = Math.max(.8, fittedDistance / MAX_CAMPUS_ZOOM);
    controls.maxDistance = fittedDistance / 0.65;
    camera.position.copy(controls.target).addScaledVector(direction, THREE.MathUtils.clamp(fittedDistance / zoomLevel, controls.minDistance, controls.maxDistance));
    camera.aspect = aspect;
    // Lift the starting campus within the canvas, leaving the entry and camera
    // controls breathing room without changing the front-width fit or tilt.
    if (width > 0 && height > 0) camera.setViewOffset(width, height, 0, height * 0.020, width, height);
    camera.updateProjectionMatrix();
    controls.update();
    wake(true);
  }

  function teamAt(event: PointerEvent): string | undefined {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    let nearest = Infinity;
    let teamId: string | undefined;
    // Selecting an office does not need hundreds of thousands of triangle
    // tests. Its cached room volume is the stable, generous pointer target.
    for (const room of pickBounds) {
      if (!room.room.root.visible || !raycaster.ray.intersectBox(room.bounds, roomHit)) continue;
      const distance = raycaster.ray.origin.distanceToSquared(roomHit);
      if (distance < nearest) { nearest = distance; teamId = room.id; }
    }
    return teamId;
  }
  function click(event: PointerEvent): void {
    const gesture = gestures.get(event.pointerId);
    gestures.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = idleTeamId ? 'default' : 'grab';
    if (observerRig?.active) return;
    if (event.button !== 0 || disposed || idleTeamId || gesture?.dragged || event.shiftKey || event.ctrlKey || event.metaKey) return;
    const teamId = teamAt(event);
    if (teamId) onSelect(teamId);
  }
  function pointerDown(event: PointerEvent): void {
    if (idleTeamId) return;
    if (!observerRig?.active) controls.mouseButtons.LEFT = event.shiftKey || event.ctrlKey || event.metaKey || navigationMode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    if (event.pointerType !== 'touch') canvas.focus({ preventScroll: true });
    gestures.set(event.pointerId, { x: event.clientX, y: event.clientY, dragged: false });
    if (observerRig?.active) canvas.setPointerCapture(event.pointerId);
    if (gestures.size > 1) gestures.forEach((gesture) => { gesture.dragged = true; });
    canvas.style.cursor = 'grabbing';
  }
  function pointerCancel(event: PointerEvent): void {
    gestures.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    canvas.style.cursor = 'grab';
  }
  function hover(event: PointerEvent): void {
    if (idleTeamId) { canvas.style.cursor = 'default'; return; }
    const gesture = gestures.get(event.pointerId);
    if (observerRig?.active) {
      if (gesture) {
        lookObserver((event.clientX - gesture.x) * .004, -(event.clientY - gesture.y) * .004);
        gesture.x = event.clientX;
        gesture.y = event.clientY;
        gesture.dragged = true;
      }
      canvas.style.cursor = gesture ? 'grabbing' : 'grab';
      return;
    }
    if (gesture && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 5) gesture.dragged = true;
    canvas.style.cursor = gestures.size ? 'grabbing' : teamAt(event) ? 'pointer' : 'grab';
  }
  function setZoom(factor: number): void {
    if (disposed || idleTeamId || observerRig?.active || !Number.isFinite(factor) || factor <= 0) return;
    const direction = camera.position.clone().sub(controls.target);
    const distance = THREE.MathUtils.clamp(direction.length() / factor, controls.minDistance, controls.maxDistance);
    camera.position.copy(controls.target).addScaledVector(direction.normalize(), distance);
    controls.update();
    wake(true);
  }
  function resetView(): void {
    if (disposed || idleTeamId) return;
    exitObserver();
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
  function rotateView(radians: number): void {
    if (disposed || idleTeamId || observerRig?.active || !Number.isFinite(radians)) return;
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    spherical.theta += radians;
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update();
    wake(true);
  }
  function tiltView(radians: number): void {
    if (disposed || idleTeamId || observerRig?.active || !Number.isFinite(radians)) return;
    const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    spherical.phi = THREE.MathUtils.clamp(spherical.phi - radians, controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update();
    wake(true);
  }
  function panView(dx: number, dz: number): void {
    if (disposed || idleTeamId || observerRig?.active || !Number.isFinite(dx) || !Number.isFinite(dz)) return;
    const offset = new THREE.Vector3(dx, 0, dz);
    camera.position.add(offset);
    controls.target.add(offset);
    controls.update();
    wake(true);
  }
  function setNavigationMode(mode: 'pan' | 'rotate'): void {
    if (mode !== 'pan' && mode !== 'rotate') return;
    navigationMode = mode;
    controls.mouseButtons.LEFT = mode === 'pan' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    canvas.dataset.navigationMode = mode;
  }
  function enterObserver(): void {
    if (disposed || idleTeamId || zoomLevel < CLOSE_ZOOM_THRESHOLD || !observerRig || observerRig.active) return;
    observerCursor = canvas.style.cursor;
    observerLabel = canvas.getAttribute('aria-label') ?? campusLabel;
    if (!observerRig.enter()) return;
    observerViewport = { width: host.clientWidth, height: host.clientHeight };
    gestures.clear();
    canvas.style.cursor = 'grab';
    canvas.setAttribute('aria-label', 'Local mist observer. Agents cannot see or respond to you. Click this view, then use W A S D or arrows to float, Q and E to descend and rise. Drag to look. Escape leaves and restores your orbit view.');
    notifyObserver();
    fadeWalls();
    wake(true);
  }
  function exitObserver(): void {
    if (!observerRig?.exit()) return;
    const needsRefit = observerViewportChanged(observerViewport, host.clientWidth, host.clientHeight);
    observerViewport = undefined;
    for (const id of gestures.keys()) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    gestures.clear();
    canvas.style.cursor = observerCursor;
    canvas.setAttribute('aria-label', observerLabel);
    // Restore the exact saved orbit first. A genuinely changed viewport alone
    // needs the regular responsive fit; resize never enters/exits the rig.
    if (needsRefit && !disposed) resize();
    notifyObserver();
    fadeWalls();
    wake(true);
  }
  function setObserverMode(mode: ObserverMode): void {
    if (!observerRig?.setMode(mode)) return;
    notifyObserver(); fadeWalls(); wake(true);
  }
  function moveObserver(direction: ObserverMove): void {
    if (!observerRig?.move(direction)) return;
    fadeWalls(); wake(true);
  }
  function lookObserver(horizontal: number, vertical: number): void {
    if (!observerRig?.look(horizontal, vertical)) return;
    fadeWalls(); wake(true);
  }
  function applyIdleCamera(): void {
    const room = idleTeamId ? rooms.get(idleTeamId) : undefined;
    if (!room) return;
    const desks = room.navigation.desks;
    const deskZ = room.navigation.task[1];
    const nearZ = Math.max(deskZ + 1.05, ...desks.map(desk => desk.position[1] + 0.85));
    const farZ = Math.min(deskZ - 1.05, ...desks.map(desk => desk.position[1] - 0.85));
    camera.fov = 38;
    camera.clearViewOffset();
    // Look across both desk sides, above monitor tops. Fit the whole seated
    // head-to-foot volume so a foreground back cannot fill the window.
    controls.target.copy(room.center).add(new THREE.Vector3(0, 1.25, (nearZ + farZ) / 2));
    const direction = new THREE.Vector3(0.65, 0.62, 0.48).normalize();
    const forward = direction.clone().negate();
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const tanHorizontal = tanVertical * camera.aspect;
    let distance = 6.8;
    for (const x of [-2.3, 2.3]) for (const y of [room.navigation.floorY, 3.2]) for (const z of [farZ, nearZ]) {
      const point = room.center.clone().add(new THREE.Vector3(x, y, z)).sub(controls.target);
      distance = Math.max(distance, point.dot(direction) + Math.abs(point.dot(right)) / tanHorizontal,
        point.dot(direction) + Math.abs(point.dot(up)) / tanVertical);
    }
    camera.position.copy(controls.target).addScaledVector(direction, distance * 1.2);
    camera.updateProjectionMatrix();
    controls.update();
    fadeWalls();
  }
  function setIdleView(teamId: string | null): void {
    if (disposed || (teamId !== null && !rooms.has(teamId)) || teamId === idleTeamId) return;
    exitObserver();
    if (teamId && !idleTeamId) campusPose = { position: camera.position.clone(), target: controls.target.clone(), zoom: zoomLevel };
    // An offscreen actor cannot finish its return-home pose while another
    // office is selected. Resume that bounded transition when campus returns.
    if (teamId && settlingRemaining > 0) deferredCampusSettle = true;
    if (!teamId && deferredCampusSettle) {
      settlingRemaining = Math.max(settlingRemaining, 1);
      deferredCampusSettle = false;
    }
    idleTeamId = teamId;
    controls.enabled = !teamId;
    canvas.style.cursor = teamId ? 'default' : 'grab';
    canvas.setAttribute('aria-label', teamId
      ? `Fixed close-up view into the ${teams.find((team) => team.id === teamId)?.name ?? teamId} office. Camera locked; use the window view controls to choose another office or return to the campus.`
      : campusLabel);
    campus.visible = !teamId;
    rooms.forEach((room, id) => { room.root.visible = !teamId || id === teamId; });
    staticContacts.syncVisibility();
    batches.invalidateVisibility();
    host.dataset.idleTeam = teamId ?? '';
    notifyObserver();
    controls.minPolarAngle = teamId ? 0 : THREE.MathUtils.degToRad(25);
    controls.maxPolarAngle = teamId ? Math.PI : THREE.MathUtils.degToRad(55);
    controls.minDistance = teamId ? 0.1 : controls.minDistance;
    controls.maxDistance = teamId ? 180 : controls.maxDistance;
    if (teamId) applyIdleCamera();
    else {
      camera.fov = CAMPUS_FOV;
      if (campusPose) { camera.position.copy(campusPose.position); controls.target.copy(campusPose.target); zoomLevel = campusPose.zoom; }
      resize();
      campusPose = undefined;
    }
    renderer.shadowMap.needsUpdate = true;
    wake(true);
  }
  function keyboard(event: KeyboardEvent): void {
    if (idleTeamId) return;
    if (observerRig?.active) {
      const key = event.key.toLowerCase();
      const moves: Record<string, ObserverMove> = { w: 'forward', arrowup: 'forward', s: 'back', arrowdown: 'back', a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right', q: 'down', e: 'up' };
      if (moves[key]) { event.preventDefault(); event.stopImmediatePropagation(); moveObserver(moves[key]); }
      else if (key === 'escape') { event.preventDefault(); exitObserver(); }
      return;
    }
    if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(1.15); }
    else if (event.key === '-' || event.key === '_') { event.preventDefault(); setZoom(1 / 1.15); }
    else if (event.key === 'Home') { event.preventDefault(); resetView(); }
  }
  function observerEscape(event: KeyboardEvent): void {
    if (event.key === 'Escape' && observerRig?.active) { event.preventDefault(); exitObserver(); }
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
    exitObserver();
    cancelFrame();
    host.dataset.sceneFps = '0';
    onError?.('The 3D context was interrupted. Team status remains available.');
  }
  function restored(): void { contextLost = false; bufferDpr = 0; studio.restore(); updateDaylight(); staticContacts.restore(); renderer.shadowMap.needsUpdate = true; onError?.(''); wake(); }
  controls.addEventListener('change', cameraChanged);
  canvas.addEventListener('pointerdown', pointerDown, { capture: true });
  canvas.addEventListener('pointerup', click);
  canvas.addEventListener('pointercancel', pointerCancel);
  canvas.addEventListener('pointermove', hover);
  canvas.addEventListener('keydown', keyboard);
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('platop:visibility', nativeVisibility);
  window.addEventListener('keydown', observerEscape);
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
            actor.seatedFeet = new AuthoredFootPose(gltf.scene);
            actor.seatedFeet.apply(Math.max(0, actor.motor.y - actor.motor.floorY));
            actor.actions = {};
            const runtimeClips = CLIP_NAMES.map((name) => gltf.animations.find((candidate) => candidate.name === asset.clips[name]));
            if (runtimeClips.every((clip): clip is THREE.AnimationClip => !!clip)) {
              freezeStaticAuthoredMeshes(gltf.scene, runtimeClips);
            }
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
            batches.rebuild();
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
      const newlyInactive = teams.filter((team) => {
        const previous = activity(team.id);
        const following = next.activity[team.id] ?? 'unknown';
        return (previous === 'active' || previous === 'sleeping') && following !== 'active' && following !== 'sleeping';
      });
      if (newlyInactive.length) settlingRemaining = 1;
      if (idleTeamId && newlyInactive.some((team) => team.id !== idleTeamId)) deferredCampusSettle = true;
      const priorControl = state.controlMode;
      if (next.daylight && next.daylight.hour !== daylight.hour) updateDaylight(next.daylight);
      state = { ...next, controlMode: next.controlMode ?? 'live', activity: { ...next.activity }, decorations: { ...next.decorations } };
      if (priorControl !== state.controlMode) for (const actor of actors) {
        actor.proxyPose = undefined;
      }
      const nextDecorationSignature = teams.map((team) => `${team.id}:${(state.decorations[team.id] ?? []).join(',')}`).join('|');
      if (nextDecorationSignature !== decorationSignature) {
        decorationSignature = nextDecorationSignature;
        renderer.shadowMap.needsUpdate = true;
        batches.invalidateVisibility();
        navigator.setDecorations(state.decorations);
        actors.forEach(actor => actor.motor.replan());
      }
      if (officeAssets.sync(state.assets)) {
        refreshAssetWallFades();
        refreshAssetLamps();
        batches.rebuild();
        renderer.shadowMap.needsUpdate = true;
      }
      if (roomFinishes.sync(state.rooms)) batches.rebuild();
      updateRoomLamps(true);
      applyMotorState();
      rooms.forEach((room, id) => {
        room.outline.visible = id === state.selectedTeam;
        const chosen = state.decorations[id] ?? [];
        Object.entries(room.decorations).forEach(([name, object]) => { object.visible = chosen.includes(name as keyof Room['decorations']); });
      });
      wake();
    },
    resetCamera: resetView,
    zoom: setZoom,
    rotate: rotateView,
    tilt: tiltView,
    pan: panView,
    setNavigationMode,
    setIdleView,
    enterObserver,
    exitObserver,
    setObserverMode,
    moveObserver,
    lookObserver,
    dispose() {
      if (disposed) return;
      disposed = true;
      exitObserver();
      observerRig?.dispose();
      assetAbort.abort();
      cancelFrame();
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('platop:visibility', nativeVisibility);
      window.removeEventListener('keydown', observerEscape);
      motionPreference.removeEventListener('change', motionChanged);
      controls.removeEventListener('change', cameraChanged);
      controls.dispose();
      canvas.removeEventListener('pointerdown', pointerDown, { capture: true });
      canvas.removeEventListener('pointerup', click);
      canvas.removeEventListener('pointercancel', pointerCancel);
      canvas.removeEventListener('pointermove', hover);
      canvas.removeEventListener('keydown', keyboard);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      actors.forEach((actor) => { actor.mixer?.stopAllAction(); actor.mixer?.uncacheRoot(actor.model); });
      contacts.dispose();
      characterDetail.dispose();
      staticContacts.dispose();
      batches.dispose();
      officeAssets.dispose();
      assetWallFades.length = 0;
      output.dispose();
      studio.dispose();
      const resources = new THREE.Group();
      const staticSources = new Set<THREE.Object3D>();
      scene.traverse(object => {
        if (object.userData.staticSources instanceof THREE.Object3D) staticSources.add(object.userData.staticSources);
      });
      resources.add(scene, retiredProxies);
      resources.add(...staticSources);
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
      delete host.dataset.detailedCharacters;
      delete host.dataset.detailPending;
      delete host.dataset.sceneDrawCalls;
      delete host.dataset.sceneTriangles;
      delete host.dataset.sceneRenderMs;
      delete host.dataset.sceneCpuMs;
      delete host.dataset.sceneMultiDraw;
      delete host.dataset.idleTeam;
      delete host.dataset.observerMode;
      diagnosticFields.forEach((field) => { delete host.dataset[field]; });
      stageFields.forEach((field) => { delete host.dataset[field]; });
      stageFrames = undefined;
      stageTotals = undefined;
      stageCurrent = undefined;
      stageFrameStart = undefined;
      resolutionFields.forEach((field) => { delete host.dataset[field]; });
      contextFields.forEach((field) => { delete host.dataset[field]; });
    }
  };
}

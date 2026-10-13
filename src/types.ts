import type { LocalDaylight } from './localDaylight';
export type Activity = 'active' | 'sleeping' | 'waiting' | 'unknown';
export type Decoration = 'plant' | 'lamp' | 'art';
export interface Character { id: string; name: string; kind: 'robot' | 'lantern' | 'owl' | 'swift'; color: string; accent: string; role: string; description: string; }
export interface Team { id: string; name: string; role: string; color: string; floor: string; portrait: string; motto: string; members: Character[]; }
export interface TeamState { teamId: string; state: Activity; updatedAt: string | null; source: string; }
export type OfficeActionKind = 'walk_to' | 'work' | 'rest' | 'celebrate' | 'arrive' | 'leave' | 'interact';
export type OfficePlace = 'desk' | 'door' | 'lounge' | 'whiteboard' | 'cabinet';
export type OfficeGesture = 'work' | 'think' | 'file' | 'talk' | 'wait';
export interface OfficeMotion { pace?: 'unhurried' | 'steady' | 'brisk'; route?: 'direct' | 'roomy'; }
export interface OfficeAction { id: string; actorId: string; kind: OfficeActionKind; target?: { officeId: string; place: OfficePlace }; gesture?: OfficeGesture; motion?: OfficeMotion; }
export type DecorSlot = 'desk' | 'shelf' | 'wall' | 'floor' | 'festive';
export type DecorShape = 'box' | 'sphere' | 'cylinder' | 'cone' | 'torus' | 'capsule' | 'leaf' | 'arch' | 'vase' | 'cushion' | 'dome';
export type DecorFinish = 'matte' | 'ceramic' | 'wood' | 'metal' | 'fabric' | 'stone' | 'lacquer';
export type Vec3Tuple = [number, number, number];
export interface DecorPart { shape: DecorShape; position: Vec3Tuple; size: Vec3Tuple; rotation: Vec3Tuple; color: string; glow: boolean; finish: DecorFinish; }
export interface OfficeAsset { id: string; parts: DecorPart[]; }
export type OfficeActions = Partial<Record<string, OfficeAction>>;
export type OfficeAssets = Partial<Record<string, Partial<Record<DecorSlot, OfficeAsset>>>>;
export interface RoomPalette { wall: string; rug: string; furniture: string; }
export type RoomLightMode = 'day' | 'cozy' | 'night' | 'off';
export interface RoomLighting { color: string; brightness: number; mode: RoomLightMode; ambientColor: string; ambientBrightness: number; ambientPosition: Vec3Tuple; }
export interface OfficeRoomStyle { id: string; palette: Partial<RoomPalette>; lighting: Partial<RoomLighting>; }
export interface RoomStyleUpdate { teamId: string; palette?: Partial<RoomPalette>; lighting?: Partial<RoomLighting>; reset?: true; }
export type OfficeRooms = Partial<Record<string, OfficeRoomStyle>>;
export interface Snapshot { teams: TeamState[]; serverTime: string; actions?: OfficeActions; assets?: OfficeAssets; rooms?: OfficeRooms; }
export interface SceneState { selectedTeam: string; activity: Record<string, Activity>; decorations: Record<string, Decoration[]>; paused: boolean; reducedMotion: boolean; actions?: OfficeActions; assets?: OfficeAssets; rooms?: OfficeRooms; controlMode?: 'live' | 'offline'; daylight?: LocalDaylight; }
export type ObserverMode = 'first-person' | 'third-person';
export type ObserverMove = 'forward' | 'back' | 'left' | 'right' | 'up' | 'down';
export interface ObserverState { active: boolean; available: boolean; mode: ObserverMode; }
export interface SceneHandle {
  update: (state: SceneState) => void;
  resetCamera: () => void;
  zoom: (factor: number) => void;
  rotate: (radians: number) => void;
  tilt: (radians: number) => void;
  pan: (dx: number, dz: number) => void;
  setNavigationMode: (mode: 'pan' | 'rotate') => void;
  setIdleView: (teamId: string | null) => void;
  enterObserver: () => void;
  exitObserver: () => void;
  setObserverMode: (mode: ObserverMode) => void;
  moveObserver: (direction: ObserverMove) => void;
  lookObserver: (horizontal: number, vertical: number) => void;
  dispose: () => void;
}

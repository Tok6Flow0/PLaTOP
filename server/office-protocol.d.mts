import type { DecorFinish, DecorPart, DecorShape, DecorSlot, OfficeActionKind, OfficeActions, OfficeAssets, OfficeGesture, OfficePlace, OfficeRooms, RoomLightMode, RoomStyleUpdate } from '../src/types';

export const TEAM_ACTORS: Readonly<Record<string, readonly string[]>>;
export const ACTOR_IDS: readonly string[];
export const ACTION_KINDS: readonly OfficeActionKind[];
export const PLACES: readonly OfficePlace[];
export const ACTION_GESTURES: readonly OfficeGesture[];
export const DECOR_SLOTS: readonly DecorSlot[];
export const DECOR_SHAPES: readonly DecorShape[];
export const DECOR_FINISHES: readonly DecorFinish[];
export const ROOM_LIGHT_MODES: readonly RoomLightMode[];
export const MAX_DECOR_PARTS: number;
export const DEFAULT_DECOR_COLOR: string;
export function parseAction(value: unknown): { teamId: string; actorId: string; kind: OfficeActionKind; target?: { officeId: string; place: OfficePlace }; gesture?: OfficeGesture };
export function parseDecoration(value: unknown): { teamId: string; slot: DecorSlot; parts: DecorPart[] };
export function parseRoomStyle(value: unknown): RoomStyleUpdate;
export function parseOfficeSnapshot(value: Record<string, unknown>): { actions?: OfficeActions; assets?: OfficeAssets; rooms?: OfficeRooms };

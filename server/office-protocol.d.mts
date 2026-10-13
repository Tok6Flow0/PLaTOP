import type { DecorPart, DecorShape, DecorSlot, OfficeActionKind, OfficeActions, OfficeAssets, OfficePlace } from '../src/types';

export const TEAM_ACTORS: Readonly<Record<string, readonly string[]>>;
export const ACTOR_IDS: readonly string[];
export const ACTION_KINDS: readonly OfficeActionKind[];
export const PLACES: readonly OfficePlace[];
export const DECOR_SLOTS: readonly DecorSlot[];
export const DECOR_SHAPES: readonly DecorShape[];
export const MAX_DECOR_PARTS: number;
export const DEFAULT_DECOR_COLOR: string;
export function parseAction(value: unknown): { teamId: string; actorId: string; kind: OfficeActionKind; target?: { officeId: string; place: OfficePlace } };
export function parseDecoration(value: unknown): { teamId: string; slot: DecorSlot; parts: DecorPart[] };
export function parseOfficeSnapshot(value: Record<string, unknown>): { actions?: OfficeActions; assets?: OfficeAssets };

export type Activity = 'active' | 'sleeping' | 'waiting' | 'unknown';
export type Decoration = 'plant' | 'lamp' | 'art';
export interface Character { id: string; name: string; kind: 'robot' | 'lantern' | 'owl' | 'swift'; color: string; accent: string; role: string; description: string; }
export interface Team { id: string; name: string; role: string; color: string; floor: string; portrait: string; motto: string; members: Character[]; }
export interface TeamState { teamId: string; state: Activity; updatedAt: string | null; source: string; }
export interface Snapshot { teams: TeamState[]; serverTime: string; }
export interface SceneState { selectedTeam: string; activity: Record<string, Activity>; decorations: Record<string, Decoration[]>; paused: boolean; reducedMotion: boolean; }
export interface SceneHandle { update: (state: SceneState) => void; resetCamera: () => void; zoom: (factor: number) => void; dispose: () => void; }

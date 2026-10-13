import type { Activity, OfficeGesture } from '../types';

export type AgentExpression = OfficeGesture | 'idle' | 'walk' | 'rest' | 'celebrate';

/** Status can quiet an outdated pose; only an agent intent chooses expression. */
export function agentExpression(mode: string, gesture: OfficeGesture | undefined,
  report: Activity, connected: boolean, moving: boolean): AgentExpression {
  if (!connected) return 'idle';
  // An accepted route is an explicit choice, even without an activity report.
  if (moving) return 'walk';
  if (mode === 'walk' || report === 'unknown') return 'idle';
  if (mode === 'rest') return 'rest';
  if (report === 'sleeping') return 'idle';
  if (mode === 'celebrate') return 'celebrate';
  if (mode === 'work') return report === 'active' ? 'work' : 'idle';
  if (mode !== 'interact') return 'idle';
  // Waiting may include consideration or real coordination. Work at a computer
  // needs a current work report; no task text or classifier enters this choice.
  if (gesture === 'work' && report !== 'active') return 'idle';
  return gesture ?? 'idle';
}

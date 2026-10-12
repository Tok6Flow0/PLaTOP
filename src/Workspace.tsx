import { useEffect, useRef, useState } from 'react';
import { createScene } from './scene';
import { teams } from './teams';
import type { SceneHandle, SceneState } from './types';
import { Icon } from './icons';
export function Workspace({ state, onSelect, preview }: { state: SceneState; onSelect: (id: string) => void; preview: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<SceneHandle | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!host.current) return;
    try { engine.current = createScene(host.current, teams, onSelect, setError); }
    catch { setError('3D rendering is unavailable here. You can still explore every team in the roster.'); }
    return () => { engine.current?.dispose(); engine.current = null; };
  }, [onSelect]);
  useEffect(() => { engine.current?.update(state); }, [state]);
  return <section className="workspace" aria-label="Team workspace">
    <div className="workspace-heading"><h1>The workspace</h1><p>{preview ? 'Simulated activity · your chats continue normally.' : 'Six teams. One shared home.'}</p></div>
    <div ref={host} className="scene-host" data-testid="scene" aria-label="Isometric office. Select a team from the roster to inspect its members." />
    {error && <div className="scene-error" role="status">{error}</div>}
    <div className="camera-controls" aria-label="View controls"><button aria-label="Zoom out" onClick={() => engine.current?.zoom(0.85)}><Icon name="minus" /></button><button onClick={() => engine.current?.resetCamera()}>Reset view</button><button aria-label="Zoom in" onClick={() => engine.current?.zoom(1.15)}><Icon name="plus" /></button></div>
    <span className="scene-hint">Drag to pan · shift-drag to look around · scroll to zoom</span>
  </section>;
}

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createScene } from './scene';
import { teams } from './teams';
import type { SceneHandle, SceneState } from './types';
import { Icon } from './icons';
import { MotionDiagnostics } from './scene/MotionDiagnostics';

interface WorkspaceProps {
  state: SceneState;
  onSelect: (id: string) => void;
  preview: boolean;
  idleTeam?: string | null;
  children?: ReactNode;
}

export function Workspace({ state, onSelect, preview, idleTeam = null, children }: WorkspaceProps) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<SceneHandle | null>(null);
  const [error, setError] = useState('');
  const [navigation, setNavigation] = useState<'pan' | 'rotate'>('pan');
  const [help, setHelp] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    try { engine.current = createScene(host.current, teams, onSelect, setError); }
    catch { setError('3D rendering is unavailable here. You can still explore every team in the roster.'); }
    return () => { engine.current?.dispose(); engine.current = null; };
  }, [onSelect]);
  useEffect(() => { engine.current?.update(state); }, [state]);
  useEffect(() => { engine.current?.setNavigationMode(navigation); }, [navigation]);
  useEffect(() => { engine.current?.setIdleView(idleTeam); }, [idleTeam]);
  const turn = Math.PI / 12;
  return <section className={`workspace${idleTeam ? ' window-workspace' : ''}`} aria-label={idleTeam ? 'Live office window' : 'Team workspace'}>
    {!idleTeam && <div className="workspace-heading"><h1>The workspace</h1><p>{preview ? 'Simulated activity · your chats continue normally.' : 'Six teams. One shared home.'}</p></div>}
    <div ref={host} className="scene-host" data-testid="scene" aria-label={idleTeam ? 'A fixed close-up view into the live 3D office.' : 'Interactive 3D office. Use the visible controls to move, rotate, tilt or zoom.'} />
    {error && <div className="scene-error" role="status">{error}</div>}
    {!idleTeam && <>
      <div className="navigation-mode" aria-label="Drag action">
        <button aria-pressed={navigation === 'pan'} onClick={() => setNavigation('pan')}><Icon name="move" />Move</button>
        <button aria-pressed={navigation === 'rotate'} onClick={() => setNavigation('rotate')}><Icon name="rotate-right" />Rotate</button>
        <button className="camera-help-toggle" aria-label="Camera help" aria-expanded={help} onClick={() => setHelp(v => !v)}><Icon name="help" /></button>
      </div>
      {help && <div className="camera-help" role="region" aria-label="Camera guide">
        <strong>Make yourself at home</strong>
        <p><b>Move:</b> drag the room. <b>Rotate:</b> choose Rotate, then drag left or right. Drag up or down to tilt.</p>
        <p><b>Zoom:</b> scroll or pinch. On a touch screen, use two fingers to rotate or zoom.</p>
        <p>With the room focused: arrows move, Shift + arrows rotate, + / − zoom, Home resets.</p>
      </div>}
      <div className="camera-controls" aria-label="View controls">
        <div className="camera-group"><button aria-label="Rotate left" title="Rotate left" onClick={() => engine.current?.rotate(-turn)}><Icon name="rotate-left" /></button><span>Rotate</span><button aria-label="Rotate right" title="Rotate right" onClick={() => engine.current?.rotate(turn)}><Icon name="rotate-right" /></button></div>
        <div className="camera-group"><button aria-label="Tilt up" title="Tilt up" onClick={() => engine.current?.tilt(turn / 2)}><Icon name="up" /></button><span>Tilt</span><button aria-label="Tilt down" title="Tilt down" onClick={() => engine.current?.tilt(-turn / 2)}><Icon name="down" /></button></div>
        <div className="camera-group zoom-group"><button aria-label="Zoom out" title="Zoom out" onClick={() => engine.current?.zoom(0.85)}><Icon name="minus" /></button><button className="reset-view" onClick={() => engine.current?.resetCamera()}>Reset view</button><button aria-label="Zoom in" title="Zoom in" onClick={() => engine.current?.zoom(1.15)}><Icon name="plus" /></button></div>
      </div>
      <span className="scene-hint">{navigation === 'pan' ? 'Drag to move' : 'Drag to rotate and tilt'} · scroll to zoom</span>
    </>}
    {children}
    <MotionDiagnostics host={host} />
  </section>;
}

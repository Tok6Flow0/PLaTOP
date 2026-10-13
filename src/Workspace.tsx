import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createScene } from './scene';
import { teams } from './teams';
import type { ObserverState, SceneHandle, SceneState } from './types';
import { Icon } from './icons';
import { MotionDiagnostics } from './scene/MotionDiagnostics';
import './observer.css';

interface WorkspaceProps {
  state: SceneState;
  onSelect: (id: string) => void;
  idleTeam?: string | null;
  children?: ReactNode;
}

export function Workspace({ state, onSelect, idleTeam = null, children }: WorkspaceProps) {
  const host = useRef<HTMLDivElement>(null);
  const engine = useRef<SceneHandle | null>(null);
  const [error, setError] = useState('');
  const [navigation, setNavigation] = useState<'pan' | 'rotate'>('pan');
  const [help, setHelp] = useState(false);
  const [observer, setObserver] = useState<ObserverState>({ active: false, available: false, mode: 'third-person' });
  const [observerDismissed, setObserverDismissed] = useState(false);
  const [observerNavigation, setObserverNavigation] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    try { engine.current = createScene(host.current, teams, onSelect, setError, setObserver); }
    catch { setError('3D rendering is unavailable here. You can still explore every team in the roster.'); }
    return () => { engine.current?.dispose(); engine.current = null; };
  }, [onSelect]);
  useEffect(() => { engine.current?.update(state); }, [state]);
  useEffect(() => { engine.current?.setNavigationMode(navigation); }, [navigation]);
  useEffect(() => { engine.current?.setIdleView(idleTeam); }, [idleTeam]);
  useEffect(() => { if (!observer.available) setObserverDismissed(false); }, [observer.available]);
  useEffect(() => { if (!observer.active) setObserverNavigation(false); }, [observer.active]);
  const turn = Math.PI / 12;
  return <section className={`workspace${idleTeam ? ' window-workspace' : ''}${observer.active ? ' observer-workspace' : ''}`} aria-label={idleTeam ? 'Live office window' : 'Team workspace'}>
    {!idleTeam && <div className="workspace-heading"><h1>The workspace</h1><p>Six teams. One shared home.</p></div>}
    <div ref={host} className="scene-host" data-testid="scene" aria-label={idleTeam ? 'A fixed close-up view into the live 3D office.' : 'Interactive 3D office. Use the visible controls to move, rotate, tilt or zoom.'} />
    {error && <div className="scene-error" role="status">{error}</div>}
    {!idleTeam && !observer.active && <>
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
        <p>Zoom close for an optional mist visit. You remain an unseen spectator, with no control over the agents.</p>
      </div>}
      <div className="camera-controls" aria-label="View controls">
        <div className="camera-group"><button aria-label="Rotate left" title="Rotate left" onClick={() => engine.current?.rotate(-turn)}><Icon name="rotate-left" /></button><span>Rotate</span><button aria-label="Rotate right" title="Rotate right" onClick={() => engine.current?.rotate(turn)}><Icon name="rotate-right" /></button></div>
        <div className="camera-group"><button aria-label="Tilt up" title="Tilt up" onClick={() => engine.current?.tilt(turn / 2)}><Icon name="up" /></button><span>Tilt</span><button aria-label="Tilt down" title="Tilt down" onClick={() => engine.current?.tilt(-turn / 2)}><Icon name="down" /></button></div>
        <div className="camera-group zoom-group"><button aria-label="Zoom out" title="Zoom out" onClick={() => engine.current?.zoom(0.85)}><Icon name="minus" /></button><button className="reset-view" onClick={() => engine.current?.resetCamera()}>Reset view</button><button aria-label="Zoom in" title="Zoom in" onClick={() => engine.current?.zoom(1.15)}><Icon name="plus" /></button></div>
      </div>
      <span className="scene-hint">{navigation === 'pan' ? 'Drag to move' : 'Drag to rotate and tilt'} · scroll to zoom</span>
    </>}
    {!idleTeam && observer.available && !observerDismissed && <aside className="observer-invite" aria-label="Explore as mist">
      <span className="observer-sigil" aria-hidden="true" />
      <div><strong>A little closer?</strong><p>Float through as an unseen mist. Just look around.</p></div>
      <button className="observer-enter" onClick={() => engine.current?.enterObserver()}>Enter as mist</button>
      <button className="observer-dismiss" aria-label="Dismiss mist invitation" onClick={() => setObserverDismissed(true)}><Icon name="close" /></button>
    </aside>}
    {!idleTeam && observer.active && <>
      <div className="observer-toolbar" role="region" aria-label="Mist observer controls">
        <div className="observer-presence"><span className="observer-sigil" aria-hidden="true" /><div><strong>Only observing</strong><small>Unseen by the agents · phase through everything</small></div></div>
        <div className="observer-perspective" role="group" aria-label="Observer perspective">
          <button aria-pressed={observer.mode === 'first-person'} onClick={() => engine.current?.setObserverMode('first-person')}>First person</button>
          <button aria-pressed={observer.mode === 'third-person'} onClick={() => engine.current?.setObserverMode('third-person')}>Third person</button>
        </div>
        <button className="observer-navigation-toggle" aria-expanded={observerNavigation} aria-controls="mist-navigation" onClick={() => setObserverNavigation(v => !v)}>Navigate</button>
        <button className="observer-exit" onClick={() => engine.current?.exitObserver()}>Exit mist <span aria-hidden="true">↗</span></button>
      </div>
      {observerNavigation && <div id="mist-navigation">
      <div className="observer-movement" role="group" aria-label="Float movement">
        <button className="float-forward" aria-label="Float forward" onClick={() => engine.current?.moveObserver('forward')}><Icon name="up" /></button>
        <button className="float-left" aria-label="Float left" onClick={() => engine.current?.moveObserver('left')}><Icon name="left" /></button>
        <span aria-hidden="true">Float</span>
        <button className="float-right" aria-label="Float right" onClick={() => engine.current?.moveObserver('right')}><Icon name="right" /></button>
        <button className="float-back" aria-label="Float backward" onClick={() => engine.current?.moveObserver('back')}><Icon name="down" /></button>
        <button className="float-rise" aria-label="Rise" onClick={() => engine.current?.moveObserver('up')}>Rise</button>
        <button className="float-descend" aria-label="Descend" onClick={() => engine.current?.moveObserver('down')}>Down</button>
      </div>
      <div className="observer-look" role="group" aria-label="Look direction">
        <button aria-label="Look up" onClick={() => engine.current?.lookObserver(0, .15)}><Icon name="up" /></button>
        <button aria-label="Look left" onClick={() => engine.current?.lookObserver(-.15, 0)}><Icon name="left" /></button>
        <span aria-hidden="true">Look</span>
        <button aria-label="Look right" onClick={() => engine.current?.lookObserver(.15, 0)}><Icon name="right" /></button>
        <button aria-label="Look down" onClick={() => engine.current?.lookObserver(0, -.15)}><Icon name="down" /></button>
      </div>
      </div>}
      <p className="observer-hint">Click the view, then WASD / arrows to float · Q / E for height · drag to look · Esc to exit</p>
    </>}
    {children}
    <MotionDiagnostics host={host} />
  </section>;
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { teams } from './teams';
import { useActivity } from './useActivity';
import { Workspace } from './Workspace';
import { Icon } from './icons';
import type { Activity, Decoration, SceneState } from './types';
import { useViewMode } from './useViewMode';
import { useWindowWeather } from './idle/useWindowWeather';
import { WindowGlass, WeatherControls } from './idle/WindowWeather';
const labels: Record<Activity, string> = { active: 'At work', sleeping: 'Resting', waiting: 'Waiting', unknown: 'Awaiting update' };
const demo: Activity[] = ['active', 'sleeping', 'active', 'sleeping', 'sleeping', 'active'];
const portraitCrops: Record<string, [number, number, number, number]> = {
  merchant: [23, 139, 54, 54], hr: [23, 224, 54, 54], intake: [23, 301, 54, 54],
  support: [23, 378, 54, 54], reflection: [23, 457, 54, 54], email: [23, 536, 54, 54],
};
function ReferenceCrop({ crop, label, className = '' }: { crop: [number, number, number, number]; label: string; className?: string }) {
  const [x, y, width, height] = crop;
  return <span className={`reference-crop ${className}`} role="img" aria-label={label} style={{
    aspectRatio: `${width} / ${height}`,
    backgroundSize: `${1536 / width * 100}% auto`,
    backgroundPosition: `${x / (1536 - width) * 100}% ${y / (1024 - height) * 100}%`,
  }} />;
}
function loadDecorations(): Record<string, Decoration[]> {
  try {
    const raw = JSON.parse(localStorage.getItem('platop.decorations') || '{}');
    const safe: Record<string, Decoration[]> = {};
    for (const team of teams) if (Array.isArray(raw[team.id])) safe[team.id] = [...new Set<Decoration>(raw[team.id].filter((v: unknown) => ['plant', 'lamp', 'art'].includes(v as string)))];
    return safe;
  } catch { return {}; }
}
export function App() {
  const [selected, setSelected] = useState(() => {
    try { const saved = localStorage.getItem('platop.selected-team'); return teams.some(team => team.id === saved) ? saved! : teams[0].id; }
    catch { return teams[0].id; }
  });
  const view = useViewMode();
  const weather = useWindowWeather({ enabled: view.idle });
  const [weatherOpen, setWeatherOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [decorations, setDecorations] = useState(loadDecorations);
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const { snapshot, connected } = useActivity();
  useEffect(() => { const query = matchMedia('(prefers-reduced-motion: reduce)'); const change = () => setReducedMotion(query.matches); query.addEventListener('change', change); return () => query.removeEventListener('change', change); }, []);
  useEffect(() => { try { localStorage.setItem('platop.decorations', JSON.stringify(decorations)); } catch { /* Decorations still work for this visit. */ } }, [decorations]);
  useEffect(() => { try { localStorage.setItem('platop.selected-team', selected); } catch { /* Selection still works for this visit. */ } }, [selected]);
  const activity = useMemo(() => Object.fromEntries(teams.map((t, i) => [t.id, preview ? demo[i] : connected ? snapshot?.teams.find(s => s.teamId === t.id)?.state ?? 'unknown' : 'unknown'])) as Record<string, Activity>, [preview, snapshot, connected]);
  const sceneState: SceneState = useMemo(() => ({ selectedTeam: selected, activity, decorations, paused, reducedMotion }), [selected, activity, decorations, paused, reducedMotion]);
  const selectTeam = useCallback((id: string) => setSelected(id), []);
  useEffect(() => {
    if (!view.idle) return;
    const cycle = window.setInterval(() => setSelected(current => teams[(teams.findIndex(t => t.id === current) + 1) % teams.length].id), 2 * 60 * 60 * 1000);
    return () => window.clearInterval(cycle);
  }, [view.idle]);
  useEffect(() => {
    if (!view.idle || view.desktop) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (weatherOpen) setWeatherOpen(false);
      else if (!document.fullscreenElement && !view.fullscreen) view.exitIdle();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [view.idle, view.desktop, view.fullscreen, view.exitIdle, weatherOpen]);
  function nextWindow(direction: number) { setSelected(current => teams[(teams.findIndex(t => t.id === current) + direction + teams.length) % teams.length].id); }
  const team = teams.find(t => t.id === selected)!;
  const updated = snapshot?.teams.find(t => t.teamId === selected)?.updatedAt;
  function toggleDecoration(item: Decoration) { setDecorations(current => { const prior = current[selected] || []; return { ...current, [selected]: prior.includes(item) ? prior.filter(d => d !== item) : [...prior, item] }; }); }
  return <div className={`app-shell${view.idle ? ' idle-shell' : ''}${view.desktop ? ' desktop-shell' : ''}`}>
    <header className="app-header"><a className="brand" href="/" aria-label="PLaTOP home"><img className="brand-logo" src="/brand/platop-logo-128.png" alt="" width="36" height="36" /><strong>PLaTOP</strong></a><span className="tagline">A little place for your team.</span><div className="header-actions"><button className="connection" onClick={() => dialog.current?.showModal()}><span className={`dot ${connected && !preview ? 'live' : ''}`} />{preview ? 'Preview · simulated' : connected ? 'Local playground' : 'Connect your chats'}</button><button className={`button primary ${preview ? 'preview-on' : ''}`} aria-pressed={preview} onClick={() => setPreview(v => !v)}><Icon name="play" /><span>{preview ? 'Exit preview' : 'Preview activity'}</span></button><button className="button view-button" aria-label="Window view" onClick={() => view.setIdle(true)} title="Look through an office window"><Icon name="window" /><span>Window view</span></button><button className="button fullscreen-button" aria-pressed={view.fullscreen} onClick={view.toggleFullscreen} aria-label={view.fullscreen ? 'Exit full screen' : 'Full screen'} title={view.fullscreen ? 'Exit full screen' : 'Full screen'}><Icon name="fullscreen" /><span>{view.fullscreen ? 'Exit full screen' : 'Full screen'}</span></button><button className="button pause-button" aria-pressed={paused} onClick={() => setPaused(v => !v)}><Icon name={paused ? 'play' : 'pause'} /><span>{paused ? 'Resume' : 'Pause'}</span></button></div></header>
    <main className="app-main"><nav className="team-rail" aria-label="Your teams"><h2>Your teams</h2><div className="team-list">{teams.map(t => <button key={t.id} className={`team-button ${selected === t.id ? 'selected' : ''}`} aria-current={selected === t.id ? 'true' : undefined} onClick={() => setSelected(t.id)}><ReferenceCrop crop={portraitCrops[t.id]} label={`${t.name} character portrait`} className="team-chip" /><span className="team-label"><strong>{t.name}</strong><small>{t.role}</small></span><span className={`team-dot ${activity[t.id]}`} aria-label={labels[activity[t.id]]} /></button>)}</div><div className="rail-note"><Icon name="plant" /><p>Small teams,<br />brighter days.</p></div></nav>
      <Workspace state={sceneState} onSelect={selectTeam} preview={preview} idleTeam={view.idle ? selected : null}>
        {view.idle && <>
          <WindowGlass weather={weather.weather} reducedMotion={reducedMotion} paused={paused} />
          <div className="window-frame" aria-hidden="true"><span className="window-mullion" /></div>
          <div className="idle-caption"><span className="idle-brand"><img src="/brand/platop-logo-128.png" alt="" width="24" height="24" />PLaTOP · {preview ? 'Simulated activity' : 'A little window into your team'}</span><h1>{team.name}</h1><p>{labels[activity[selected]]} · windows change every two hours</p></div>
          {!view.desktop && <div className="idle-toolbar" aria-label="Window view controls">
            <div className="window-switcher"><button aria-label="Previous office window" onClick={() => nextWindow(-1)}><Icon name="left" /></button><select aria-label="Office window" value={selected} onChange={event => setSelected(event.target.value)}>{teams.map(t => <option value={t.id} key={t.id}>{t.name}</option>)}</select><button aria-label="Next office window" onClick={() => nextWindow(1)}><Icon name="right" /></button></div>
            <button aria-expanded={weatherOpen} onClick={() => setWeatherOpen(v => !v)}><Icon name="weather" />Weather</button>
            <button aria-pressed={paused} aria-label={paused ? 'Resume window animation' : 'Pause window animation'} onClick={() => setPaused(v => !v)}><Icon name={paused ? 'play' : 'pause'} /></button>
            <button aria-label={view.fullscreen ? 'Exit full screen' : 'Full screen'} onClick={view.toggleFullscreen}><Icon name="fullscreen" /></button>
            {view.native && <button aria-label="Desktop background" title="Desktop background" onClick={view.showDesktop}><Icon name="desktop" /><span>Desktop background</span></button>}
            <button aria-label="Exit window view" title="Exit window view" onClick={view.exitIdle}><Icon name="close" /><span>Exit window view</span></button>
          </div>}
          {weatherOpen && !view.desktop && <div className="idle-weather-panel"><div className="weather-panel-heading"><strong>Weather on your window</strong><button aria-label="Close weather settings" onClick={() => setWeatherOpen(false)}><Icon name="close" /></button></div><WeatherControls controller={weather} embedded /></div>}
        </>}
      </Workspace>
      <aside className="team-inspector" aria-label="Selected team"><h2>{team.name}</h2>{selected === 'merchant' ? <ReferenceCrop crop={[1267, 144, 250, 235]} label="Savor Bridge reference character portrait" className="team-portrait" /> : <img className="team-portrait" src={team.portrait} alt={`${team.name} original team portrait`} width="512" height="512" />}<div className={`activity-label ${activity[selected]}`}><span className={`dot ${activity[selected]}`} />{labels[activity[selected]]}{preview && <small>Preview</small>}</div><blockquote>“{team.motto}”</blockquote><section className="roster"><h3>Team roster</h3>{team.members.map(member => <div className="member" key={member.id}>{selected === 'merchant' ? <ReferenceCrop crop={[1267, member.id === 'bridge-jarvis' ? 550 : member.id === 'bridge-scout' ? 610 : 670, 54, 54]} label={`${member.name} portrait`} className="member-avatar" /> : <span className="member-avatar" style={{ '--member-color': member.color, '--member-accent': member.accent } as React.CSSProperties} aria-hidden="true">{member.kind === 'owl' ? '◉' : member.kind === 'swift' ? '◇' : member.kind === 'lantern' ? '✦' : '• •'}</span>}<span><strong>{member.name}</strong><small>{member.role}</small></span></div>)}</section><section className="decoration-section"><h3>Make it their own</h3><div className="decoration-buttons">{(['plant', 'lamp', 'art'] as Decoration[]).map(item => <button key={item} className={decorations[selected]?.includes(item) ? 'enabled' : ''} aria-pressed={decorations[selected]?.includes(item) || false} onClick={() => toggleDecoration(item)}><Icon name={item} /><span>{item[0].toUpperCase() + item.slice(1)}</span></button>)}</div><small className="decoration-note">A few little things, saved on this device.</small></section><div className="update-note">{preview ? 'Preview changes the scene only.' : !connected ? 'Start the local bridge to receive activity.' : updated ? `Last reported ${new Date(updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Waiting for this team’s first status.'}</div></aside>
    </main><footer className="app-footer"><span><Icon name="cube" />Character models: reference build</span><button onClick={() => dialog.current?.showModal()}><Icon name="link" />{preview ? 'Simulated activity' : connected ? 'Local status bridge connected' : 'Set up the local status bridge'}</button><span className="footer-note">A more human tomorrow.</span></footer>
    {view.error && <div className="view-error" role="status">{view.error}</div>}
    <dialog ref={dialog} className="connect-dialog"><div className="dialog-heading"><h2>Bring your chats along</h2><button aria-label="Close setup" onClick={() => dialog.current?.close()}><Icon name="close" /></button></div><p>The local bridge receives small activity signals. Chat text stays in your chat app. Updates arrive when the skill reports activity; this version does not watch chats in the background.</p><ol><li>From the repository, run <code>npm run build &amp;&amp; npm start</code>.</li><li>Use the included <strong>platop</strong> skill to connect teams and report when work starts or finishes.</li></ol><p>Try one signal:</p><pre>npm run status -- set {selected} active --source manual</pre><button className="button primary" onClick={async () => { try { await navigator.clipboard.writeText(`npm run status -- set ${selected} active --source manual`); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Copied' : 'Copy command'}</button><p className="setup-note">Only reported states appear as live activity. An old active signal becomes “Awaiting update.” Preview activity is simulated. Floating windows are available through the macOS companion.</p></dialog>
  </div>;
}

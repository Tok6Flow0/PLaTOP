import { useEffect, useState, type RefObject } from 'react';

interface MotionStats {
  target: string;
  measured: string;
  median: string;
  p95: string;
  maximum: string;
  longFrames: string;
  frames: string;
}

function value(raw: string | undefined, digits = 1): string {
  const number = raw === undefined || raw === '' ? NaN : Number(raw);
  return Number.isFinite(number) ? number.toFixed(digits) : '—';
}

/** Explicit local timing check; no persistence, network, native bridge or scene data. */
export function MotionDiagnostics({ host }: { host: RefObject<HTMLDivElement | null> }) {
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get('motion-debug') === '1');
  const [stats, setStats] = useState<MotionStats | null>(null);
  useEffect(() => {
    const toggle = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey && !event.metaKey && event.code === 'KeyP') {
        event.preventDefault();
        setOpen(current => !current);
      }
    };
    window.addEventListener('keydown', toggle);
    return () => window.removeEventListener('keydown', toggle);
  }, []);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    element.dataset.motionDebug = open ? '1' : '0';
    if (!open) { setStats(null); return; }
    const sample = () => {
      const data = element.dataset;
      setStats({ target: value(data.sceneTargetFps, 0), measured: value(data.sceneMeasuredFps),
        median: value(data.sceneIntervalP50), p95: value(data.sceneIntervalP95),
        maximum: value(data.sceneIntervalMax), longFrames: value(data.sceneLongFrames, 0),
        frames: value(data.sceneFrames, 0) });
    };
    sample();
    const timer = window.setInterval(sample, 1000);
    return () => { window.clearInterval(timer); delete element.dataset.motionDebug; };
  }, [host, open]);
  if (!open) return null;
  return <aside className="motion-diagnostics" aria-label="Local motion diagnostics">
    <div><strong>Local motion check</strong><button type="button" aria-label="Close motion diagnostics" onClick={() => setOpen(false)}>×</button></div>
    <p>Target {stats?.target ?? '—'} FPS · measured {stats?.measured ?? '—'} FPS</p>
    <p>Frame interval: median {stats?.median ?? '—'} ms · p95 {stats?.p95 ?? '—'} ms</p>
    <p>Longest {stats?.maximum ?? '—'} ms · long frames {stats?.longFrames ?? '—'} · rendered {stats?.frames ?? '—'}</p>
    <small>Recent renderer timing only. Nothing is saved or sent.</small>
  </aside>;
}

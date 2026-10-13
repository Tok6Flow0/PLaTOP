import { useEffect, useState, type RefObject } from 'react';

interface MotionStats {
  target: string;
  measured: string;
  median: string;
  p95: string;
  maximum: string;
  longFrames: string;
  frames: string;
  multiDraw: string;
  deviceDpr: string;
  renderDpr: string;
  buffer: string;
  viewport: string;
  contextAlpha: string;
  contextAntialias: string;
  actorsMs: string;
  batchesMs: string;
  contactsMs: string;
  renderMs: string;
  totalMs: string;
  totalP95Ms: string;
  stageSamples: string;
  draws: string;
  triangles: string;
  loadedCharacters: string;
  proxies: string;
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
        frames: value(data.sceneFrames, 0), multiDraw: data.sceneMultiDraw === '1' ? 'available' : data.sceneMultiDraw === '0' ? 'unavailable' : '—',
        deviceDpr: value(data.sceneDeviceDpr, 2), renderDpr: value(data.sceneRenderDpr, 2),
        buffer: `${value(data.sceneBufferWidth, 0)} × ${value(data.sceneBufferHeight, 0)}`,
        viewport: `${value(data.sceneCssWidth, 0)} × ${value(data.sceneCssHeight, 0)}`,
        contextAlpha: data.sceneContextAlpha === '0' ? 'opaque' : data.sceneContextAlpha === '1' ? 'transparent' : '—',
        contextAntialias: data.sceneContextAntialias === '0' ? 'off' : data.sceneContextAntialias === '1' ? 'on' : '—',
        actorsMs: value(data.sceneActorsMeanMs, 3), batchesMs: value(data.sceneBatchesMeanMs, 3),
        contactsMs: value(data.sceneContactsMeanMs, 3), renderMs: value(data.sceneRenderMeanMs, 3),
        totalMs: value(data.sceneTotalMeanMs, 3), totalP95Ms: value(data.sceneTotalP95Ms, 3),
        stageSamples: value(data.sceneStageSamples, 0), draws: value(data.sceneDrawCalls, 0),
        triangles: value(data.sceneTriangles, 0), loadedCharacters: value(data.loadedCharacters, 0),
        proxies: value(data.proxyCount, 0) });
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
    <p>GPU multi-draw: {stats?.multiDraw ?? '—'}</p>
    <p>Pixel ratio: display {stats?.deviceDpr ?? '—'} · scene {stats?.renderDpr ?? '—'}</p>
    <p>Scene buffer {stats?.buffer ?? '—'} px · viewport {stats?.viewport ?? '—'} CSS px</p>
    <p>Canvas {stats?.contextAlpha ?? '—'} · MSAA {stats?.contextAntialias ?? '—'} · FXAA off</p>
    <p>Mean work: actors {stats?.actorsMs ?? '—'} ms · batches {stats?.batchesMs ?? '—'} ms · contacts {stats?.contactsMs ?? '—'} ms · submit {stats?.renderMs ?? '—'} ms</p>
    <p>Total work: mean {stats?.totalMs ?? '—'} ms · p95 {stats?.totalP95Ms ?? '—'} ms · samples {stats?.stageSamples ?? '—'} / 120</p>
    <p>Draws {stats?.draws ?? '—'} · triangles {stats?.triangles ?? '—'}</p>
    <p>Authored characters {stats?.loadedCharacters ?? '—'} · proxy characters {stats?.proxies ?? '—'}</p>
    <small>Recent JavaScript wall times include command submission; they are not process CPU or GPU times. Nothing is saved or sent.</small>
  </aside>;
}

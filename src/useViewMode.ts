import { useCallback, useEffect, useState } from 'react';

type NativeAction = 'fullscreen' | 'desktop' | 'window';
type NativeMessage = { action: NativeAction } | { action: 'location' | 'cancel-location'; requestId: string };
declare global {
  interface Window {
    __PLATOP_NATIVE__?: boolean;
    __PLATOP_DESKTOP_MODE__?: boolean;
    __PLATOP_FULLSCREEN__?: boolean;
    webkit?: { messageHandlers?: { platop?: { postMessage: (message: NativeMessage) => void } } };
  }
}

export function useViewMode() {
  const [idle, setIdle] = useState(() => {
    if (new URLSearchParams(location.search).get('view') === 'idle' || window.__PLATOP_DESKTOP_MODE__ === true) return true;
    try { return localStorage.getItem('platop.view') === 'window'; } catch { return false; }
  });
  const [desktop, setDesktop] = useState(window.__PLATOP_DESKTOP_MODE__ === true);
  const [fullscreen, setFullscreen] = useState(() => window.__PLATOP_NATIVE__
    ? window.__PLATOP_FULLSCREEN__ === true : Boolean(document.fullscreenElement));
  const [error, setError] = useState('');
  const native = window.__PLATOP_NATIVE__ === true;
  useEffect(() => { try { localStorage.setItem('platop.view', idle ? 'window' : 'workspace'); } catch { /* View changes still work for this visit. */ } }, [idle]);
  useEffect(() => {
    const changed = () => setFullscreen(Boolean(document.fullscreenElement));
    const applyNativeState = (detail: { desktop?: boolean; fullscreen?: boolean }) => {
      if (typeof detail?.desktop === 'boolean') {
        setDesktop(detail.desktop);
        if (detail.desktop) setIdle(true);
      }
      if (typeof detail?.fullscreen === 'boolean') setFullscreen(detail.fullscreen);
    };
    const nativeChanged = (event: Event) => applyNativeState((event as CustomEvent<{ desktop?: boolean; fullscreen?: boolean }>).detail);
    document.addEventListener('fullscreenchange', changed);
    window.addEventListener('platop:native', nativeChanged);
    // didFinish can publish before React commits its listener, including on reload.
    if (window.__PLATOP_NATIVE__) applyNativeState({
      desktop: window.__PLATOP_DESKTOP_MODE__ === true,
      fullscreen: window.__PLATOP_FULLSCREEN__ === true,
    });
    return () => {
      document.removeEventListener('fullscreenchange', changed);
      window.removeEventListener('platop:native', nativeChanged);
    };
  }, []);
  const toggleFullscreen = useCallback(async () => {
    setError('');
    if (window.__PLATOP_NATIVE__ && window.webkit?.messageHandlers?.platop) {
      window.webkit.messageHandlers.platop.postMessage({ action: 'fullscreen' });
      return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else setError('Full screen is available in the PLaTOP Mac app or your browser’s View menu.');
    } catch { setError('Full screen could not open. Use your browser’s View menu to enter full screen.'); }
  }, []);
  const showDesktop = useCallback(() => {
    const bridge = window.webkit?.messageHandlers?.platop;
    if (window.__PLATOP_NATIVE__ && bridge) {
      setIdle(true);
      bridge.postMessage({ action: 'desktop' });
    } else setError('Open PLaTOP’s Mac companion to place this live view behind your desktop icons.');
  }, []);
  const exitIdle = useCallback(() => {
    if (window.__PLATOP_DESKTOP_MODE__) window.webkit?.messageHandlers?.platop?.postMessage({ action: 'window' });
    setIdle(false);
    setError('');
  }, []);
  return { idle, setIdle, desktop, fullscreen, native, error, toggleFullscreen, showDesktop, exitIdle };
}

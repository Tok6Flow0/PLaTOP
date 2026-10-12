import { useCallback, useEffect, useRef, useState } from 'react';
import type { WeatherLocation, WindowWeather, WindowWeatherController } from './types';

const STORAGE_KEY = 'platop.weather-location.v1';
const REFRESH_MS = 15 * 60_000;
function nativeLocationError(code?: string): string {
  switch (code) {
    case 'disabled': return 'Location Services are disabled on this Mac. Enable them in System Settings, or choose a city.';
    case 'denied': return 'Location access for PLaTOP is off. Enable it in System Settings → Privacy & Security → Location Services, or choose a city.';
    case 'restricted': return 'This Mac restricts location access. Choose a city instead.';
    case 'authorization': return 'macOS did not complete the location permission request. Check Location Services in System Settings, or choose a city.';
    case 'timeout': return 'Your Mac could not determine its location in time. Try again or choose a city.';
    default: return 'Location access was unavailable. You can choose a city instead.';
  }
}
function isLocation(value: unknown): value is WeatherLocation {
  if (!value || typeof value !== 'object') return false;
  const item = value as WeatherLocation;
  return typeof item.name === 'string' && item.name.length > 0 && item.name.length <= 250 && Number.isFinite(item.latitude) && Math.abs(item.latitude) <= 90 && Number.isFinite(item.longitude) && Math.abs(item.longitude) <= 180;
}
function loadLocation(): WeatherLocation | null {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); return isLocation(value) ? value : null; } catch { return null; }
}
function isWeather(value: unknown): value is WindowWeather {
  if (!value || typeof value !== 'object') return false;
  const item = value as WindowWeather;
  return ['clear', 'cloudy', 'fog', 'rain', 'snow', 'thunderstorm'].includes(item.condition) && ['day', 'night', 'dawn', 'dusk'].includes(item.phase) && typeof item.isDay === 'boolean' && Number.isFinite(item.temperature) && Number.isFinite(item.rainIntensity) && item.rainIntensity >= 0 && item.rainIntensity <= 1 && Number.isFinite(item.precipitation) && Number.isFinite(item.cloudCover) && Number.isFinite(Date.parse(item.observedAt)) && Number.isFinite(Date.parse(item.fetchedAt)) && item.source === 'Open-Meteo';
}
export function useWindowWeather({ enabled }: { enabled: boolean }): WindowWeatherController {
  const [location, setLocation] = useState(loadLocation);
  const [weather, setWeather] = useState<WindowWeather | null>(null);
  const [status, setStatus] = useState<WindowWeatherController['status']>('off');
  const [error, setError] = useState<string | null>(null);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const lookupAbort = useRef<AbortController | null>(null);
  const locationGeneration = useRef(0);
  const deviceLocationCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => { locationGeneration.current++; lookupAbort.current?.abort(); deviceLocationCleanup.current?.(); }, []);
  useEffect(() => {
    try { if (location) localStorage.setItem(STORAGE_KEY, JSON.stringify(location)); else localStorage.removeItem(STORAGE_KEY); } catch { /* The selected location still works for this visit. */ }
  }, [location]);
  useEffect(() => {
    setWeather(null);
    setError(null);
    if (!enabled || !location) { setStatus('off'); return; }
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let lastAttempt = 0;
    let requestVersion = 0;
    const visible = () => document.visibilityState !== 'hidden' && (window as Window & { __PLATOP_DESKTOP_VISIBLE__?: boolean }).__PLATOP_DESKTOP_VISIBLE__ !== false;
    async function refresh() {
      if (stopped || !visible()) return;
      lastAttempt = Date.now();
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      const version = ++requestVersion;
      const deadline = setTimeout(() => requestController.abort(), 7000);
      setStatus('loading');
      try {
        const query = new URLSearchParams({ latitude: String(location!.latitude), longitude: String(location!.longitude) });
        const response = await fetch(`/api/weather?${query}`, { signal: requestController.signal });
        if (!response.ok) throw new Error('Weather unavailable');
        const next = await response.json();
        if (!isWeather(next)) throw new Error('Weather unavailable');
        if (!stopped && version === requestVersion) { setWeather(next); setStatus('ready'); setError(null); }
      } catch {
        if (!stopped && version === requestVersion && visible()) { setWeather(null); setStatus('unavailable'); setError('Weather is temporarily unavailable. The office stays open.'); }
      } finally {
        clearTimeout(deadline);
        if (!stopped && version === requestVersion && visible()) timer = setTimeout(refresh, REFRESH_MS);
      }
    }
    function visibilityChanged() {
      clearTimeout(timer);
      if (!visible()) { controller?.abort(); lastAttempt = 0; return; }
      const wait = Math.max(0, REFRESH_MS - (Date.now() - lastAttempt));
      if (wait === 0) void refresh(); else timer = setTimeout(refresh, wait);
    }
    void refresh();
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('platop:visibility', visibilityChanged);
    return () => { stopped = true; controller?.abort(); clearTimeout(timer); document.removeEventListener('visibilitychange', visibilityChanged); window.removeEventListener('platop:visibility', visibilityChanged); };
  }, [enabled, location]);
  const lookupCity = useCallback(async (query: string) => {
    lookupAbort.current?.abort();
    const controller = new AbortController();
    lookupAbort.current = controller;
    const deadline = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(`/api/weather/locations?${new URLSearchParams({ q: query.trim() })}`, { signal: controller.signal });
      if (!response.ok) throw new Error('City search unavailable. Try a city and country.');
      const data = await response.json();
      if (!Array.isArray(data.locations) || !data.locations.every(isLocation)) throw new Error('City search unavailable.');
      return data.locations as WeatherLocation[];
    } finally { clearTimeout(deadline); }
  }, []);
  const chooseLocation = useCallback((next: WeatherLocation) => {
    if (!isLocation(next)) return;
    deviceLocationCleanup.current?.();
    setRequestingLocation(false);
    locationGeneration.current++;
    setError(null);
    setLocation({ name: next.name, latitude: Math.round(next.latitude * 100) / 100, longitude: Math.round(next.longitude * 100) / 100 });
  }, []);
  const clearLocation = useCallback(() => { locationGeneration.current++; lookupAbort.current?.abort(); deviceLocationCleanup.current?.(); setRequestingLocation(false); setLocation(null); setWeather(null); setError(null); }, []);
  const useDeviceLocation = useCallback(() => {
    deviceLocationCleanup.current?.();
    const generation = ++locationGeneration.current;
    setError(null);
    setRequestingLocation(true);
    const bridge = window.webkit?.messageHandlers?.platop;
    if (window.__PLATOP_NATIVE__ && bridge) {
      const requestId = crypto.randomUUID();
      let completed = false;
      let deadline: ReturnType<typeof setTimeout>;
      const cleanup = () => {
        clearTimeout(deadline);
        window.removeEventListener('platop:location', received);
        if (deviceLocationCleanup.current === cleanup) deviceLocationCleanup.current = null;
        if (!completed) {
          try { bridge.postMessage({ action: 'cancel-location', requestId }); } catch { /* Native timeout also ends the request. */ }
        }
      };
      const received = (event: Event) => {
        const detail = (event as CustomEvent<{ requestId?: string; latitude?: number; longitude?: number; errorCode?: string }>).detail;
        if (detail?.requestId !== requestId || generation !== locationGeneration.current) return;
        completed = true;
        cleanup();
        setRequestingLocation(false);
        const approximate = { name: 'Approximate device area', latitude: detail.latitude, longitude: detail.longitude };
        if (isLocation(approximate)) chooseLocation(approximate);
        else setError(nativeLocationError(detail.errorCode));
      };
      deviceLocationCleanup.current = cleanup;
      window.addEventListener('platop:location', received);
      deadline = setTimeout(() => {
        cleanup();
        if (generation === locationGeneration.current) { setRequestingLocation(false); setError(nativeLocationError('timeout')); }
      }, 120_000);
      try { bridge.postMessage({ action: 'location', requestId }); }
      catch { cleanup(); setRequestingLocation(false); setError('Device location is unavailable. Choose a city instead.'); }
      return;
    }
    if (window.__PLATOP_NATIVE__ || !navigator.geolocation) { setRequestingLocation(false); setError('Device location is unavailable. Choose a city instead.'); return; }
    navigator.geolocation.getCurrentPosition(position => {
      if (generation !== locationGeneration.current) return;
      chooseLocation({ name: 'Approximate device area', latitude: position.coords.latitude, longitude: position.coords.longitude });
    }, () => {
      if (generation === locationGeneration.current) { setRequestingLocation(false); setError('Location access was unavailable. You can choose a city instead.'); }
    }, { enableHighAccuracy: false, maximumAge: 30 * 60_000, timeout: 10_000 });
  }, [chooseLocation]);
  return { weather, location, status, error, requestingLocation, lookupCity, chooseLocation, useDeviceLocation, clearLocation };
}

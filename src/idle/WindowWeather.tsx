import { memo, useEffect, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import type { WeatherLocation, WindowWeather as Weather, WindowWeatherController } from './types';
import './weather.css';

const drops = Array.from({ length: 16 }, (_, index) => ({
  left: `${(index * 31 + 7) % 98}%`, top: `${(index * 19 + 5) % 94}%`,
  '--drop-duration': `${3.8 + index % 5 * 0.7}s`, '--drop-delay': `${-index * 1.17}s`,
  '--drop-travel': `${48 + index % 4 * 24}px`, '--drop-size': `${3 + index % 3}px`,
} as CSSProperties));
export const WindowGlass = memo(function WindowGlass({ weather, reducedMotion = false, paused = false }: { weather: Weather | null; reducedMotion?: boolean; paused?: boolean }) {
  const [hidden, setHidden] = useState(() => document.visibilityState === 'hidden' || (window as Window & { __PLATOP_DESKTOP_VISIBLE__?: boolean }).__PLATOP_DESKTOP_VISIBLE__ === false);
  useEffect(() => {
    const changed = () => setHidden(document.visibilityState === 'hidden' || (window as Window & { __PLATOP_DESKTOP_VISIBLE__?: boolean }).__PLATOP_DESKTOP_VISIBLE__ === false);
    document.addEventListener('visibilitychange', changed); window.addEventListener('platop:visibility', changed);
    return () => { document.removeEventListener('visibilitychange', changed); window.removeEventListener('platop:visibility', changed); };
  }, []);
  const rain = weather?.condition === 'rain' || weather?.condition === 'thunderstorm';
  const snow = weather?.condition === 'snow';
  return <div className={`window-glass phase-${weather?.phase ?? 'day'} weather-${weather?.condition ?? 'clear'} ${reducedMotion || paused || hidden ? 'glass-still' : ''}`} aria-hidden="true">
    <div className="glass-weather-tint" /><div className="glass-reflection" />
    {rain ? <div className="glass-rain" style={{ opacity: 0.45 + (weather?.rainIntensity ?? 0) * 0.4 }}>{drops.map((style, index) => <i className="glass-drop" key={index} style={style} />)}</div> : null}
    {snow ? <div className="glass-snow">{drops.slice(0, 12).map((style, index) => <i className="glass-flake" key={index} style={style} />)}</div> : null}
  </div>;
});
const conditionLabels = { clear: 'Clear', cloudy: 'Cloudy', fog: 'Fog', rain: 'Rain', snow: 'Snow', thunderstorm: 'Thunderstorm' };
export function WeatherControls({ controller, embedded = false }: { controller: WindowWeatherController; embedded?: boolean }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  async function search(event: FormEvent) {
    event.preventDefault(); setSearching(true); setSearchError(null); setResults([]);
    try {
      const next = await controller.lookupCity(query);
      setResults(next);
      if (next.length === 0) setSearchError('No city found. Try adding the country.');
    } catch (error) { setSearchError(error instanceof Error && error.name === 'AbortError' ? 'Search stopped. Try again.' : 'City search is unavailable. Try again later.'); }
    finally { setSearching(false); }
  }
  const weather = controller.weather;
  return <details className={`window-weather-controls ${embedded ? 'weather-embedded' : ''}`} open={embedded || undefined}>
    <summary>{weather ? `${conditionLabels[weather.condition]} · ${Math.round(weather.temperature)}°C` : controller.status === 'loading' ? 'Checking weather…' : 'Window weather'}</summary>
    <div className="weather-settings">
      <h3>Weather at your window</h3>
      {controller.location ? <p className="weather-chosen-city">{controller.location.name}<button type="button" onClick={() => { controller.clearLocation(); setResults([]); }} aria-label="Turn off local weather">Turn off</button></p> : <p>Choose a city, or enable approximate device location.</p>}
      {embedded && (weather || controller.status === 'loading') ? <p className="weather-current" role="status">{weather ? `${conditionLabels[weather.condition]} · ${Math.round(weather.temperature)}°C` : 'Checking weather…'}</p> : null}
      <form onSubmit={search}><label htmlFor="window-weather-city">City and country</label><div className="weather-city-input"><input id="window-weather-city" value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. Paris, France" minLength={2} maxLength={80} autoComplete="off" /><button type="submit" disabled={searching || query.trim().length < 2}>{searching ? 'Finding…' : 'Find'}</button></div></form>
      {results.length ? <ul className="weather-city-results">{results.map((place, index) => <li key={`${place.latitude},${place.longitude},${index}`}><button type="button" onClick={() => { controller.chooseLocation(place); setResults([]); setQuery(''); }}>{place.name}</button></li>)}</ul> : null}
      <button type="button" className="weather-device-location" onClick={controller.useDeviceLocation} disabled={controller.requestingLocation} aria-busy={controller.requestingLocation}>{controller.requestingLocation ? 'Finding your area…' : 'Use approximate device location'}</button>
      {controller.requestingLocation ? <p className="weather-message" role="status">Choose Allow in the macOS location permission dialog. It may appear behind other windows.</p> : null}
      {searchError || controller.error ? <p className="weather-message" role="status">{searchError ?? controller.error}</p> : null}
      <p className="weather-privacy">Your choice is saved on this device. Approximate coordinates are sent to Open-Meteo to fetch weather, every 15 minutes while visible.</p>
      <p className="weather-privacy">The glass follows estimated weather model conditions, which can differ from rain outside your window.</p>
      <p className="weather-attribution">Weather model: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · Locations: GeoNames{weather ? ` · Updated ${new Date(weather.observedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
    </div>
  </details>;
}

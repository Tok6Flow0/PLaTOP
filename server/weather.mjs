// Open-Meteo model conditions, fetched only after a location is chosen in the UI.
// https://open-meteo.com/en/docs and https://open-meteo.com/en/docs/geocoding-api
const WEATHER_TTL = 15 * 60_000;
const LOCATION_TTL = 24 * 60 * 60_000;
const MAX_RESPONSE_BYTES = 128 * 1024;
const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
const STORM_CODES = new Set([95, 96, 97, 99]);
const WMO_CODES = new Set([0, 1, 2, 3, 45, 48, ...RAIN_CODES, ...SNOW_CODES, ...STORM_CODES]);

function badInput() { return Object.assign(new Error('Invalid weather request.'), { status: 400 }); }
function boundedNumber(value, min, max) { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max; }
function coordinate(value, min, max) {
  if (typeof value !== 'string' || !/^-?\d{1,3}(?:\.\d{1,8})?$/.test(value)) throw badInput();
  const number = Number(value);
  if (!boundedNumber(number, min, max)) throw badInput();
  return Math.round(number * 100) / 100;
}
function onlyParams(params, names) {
  for (const name of params.keys()) if (!names.includes(name) || params.getAll(name).length !== 1) throw badInput();
  for (const name of names) if (!params.has(name)) throw badInput();
}
function cleanLabel(value, max = 80) { return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : ''; }

export function normalizeWeather(payload, fetchedAt) {
  const current = payload?.current;
  if (!current || !WMO_CODES.has(current.weather_code) || ![0, 1].includes(current.is_day)
    || !boundedNumber(current.temperature_2m, -100, 70) || !boundedNumber(current.precipitation, 0, 1000)
    || !boundedNumber(current.cloud_cover, 0, 100) || !boundedNumber(current.time, 0, 20_000_000_000)) throw new Error('Invalid provider response.');
  // A stale provider response must not be labelled as current local weather.
  if (Math.abs(fetchedAt - current.time * 1000) > 36 * 60 * 60_000) throw new Error('Weather observation is stale.');
  const code = current.weather_code;
  const condition = STORM_CODES.has(code) ? 'thunderstorm' : SNOW_CODES.has(code) ? 'snow' : RAIN_CODES.has(code) || current.precipitation > 0.05 ? 'rain' : [45, 48].includes(code) ? 'fog' : code >= 2 ? 'cloudy' : 'clear';
  const sunrise = payload.daily?.sunrise?.[0];
  const sunset = payload.daily?.sunset?.[0];
  const near = value => boundedNumber(value, 0, 20_000_000_000) && Math.abs(current.time - value) <= 45 * 60;
  const phase = near(sunrise) ? 'dawn' : near(sunset) ? 'dusk' : current.is_day ? 'day' : 'night';
  return {
    condition, phase, isDay: current.is_day === 1, temperature: current.temperature_2m,
    precipitation: current.precipitation, cloudCover: current.cloud_cover,
    rainIntensity: ['rain', 'thunderstorm'].includes(condition) ? Math.min(1, Math.max(0.2, current.precipitation / 3)) : 0,
    observedAt: new Date(current.time * 1000).toISOString(), fetchedAt: new Date(fetchedAt).toISOString(),
    source: 'Open-Meteo',
  };
}

export function createWeatherService({ fetchImpl = fetch, now = Date.now, timeoutMs = 4000, maxCacheEntries = 32 } = {}) {
  const cache = new Map();
  const pending = new Map();
  async function upstream(url) {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error', headers: { Accept: 'application/json' } });
    if (!response.ok || Number(response.headers.get('content-length') || 0) > MAX_RESPONSE_BYTES) throw new Error('Weather provider unavailable.');
    let body = '';
    let size = 0;
    const decoder = new TextDecoder();
    if (!response.body) throw new Error('Weather provider unavailable.');
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_RESPONSE_BYTES) throw new Error('Weather response too large.');
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
      return JSON.parse(body);
    } finally { await reader.cancel().catch(() => {}); }
  }
  async function cached(key, ttl, load) {
    const hit = cache.get(key);
    if (hit && hit.expires > now()) return hit.value;
    cache.delete(key);
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 4) throw Object.assign(new Error('Weather is busy.'), { status: 503 });
    const task = Promise.resolve().then(load).then(value => {
      while (cache.size >= maxCacheEntries) cache.delete(cache.keys().next().value);
      cache.set(key, { value, expires: now() + ttl });
      return value;
    }).finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  }
  async function getWeather(params) {
    onlyParams(params, ['latitude', 'longitude']);
    const latitude = coordinate(params.get('latitude'), -90, 90);
    const longitude = coordinate(params.get('longitude'), -180, 180);
    return cached(`weather:${latitude},${longitude}`, WEATHER_TTL, async () => {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), current: 'temperature_2m,precipitation,weather_code,is_day,cloud_cover', daily: 'sunrise,sunset', forecast_days: '1', timezone: 'auto', timeformat: 'unixtime' }).toString();
      return normalizeWeather(await upstream(url), now());
    });
  }
  async function lookupLocations(params) {
    onlyParams(params, ['q']);
    const query = params.get('q').trim();
    if (query.length < 2 || query.length > 80 || !/[\p{L}\p{N}]/u.test(query) || /[\u0000-\u001f\u007f]/.test(query)) throw badInput();
    return cached(`location:${query.toLocaleLowerCase('en')}`, LOCATION_TTL, async () => {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.search = new URLSearchParams({ name: query, count: '5', language: 'en', format: 'json' }).toString();
      const payload = await upstream(url);
      if (payload.error || (payload.results !== undefined && !Array.isArray(payload.results))) throw new Error('Invalid provider response.');
      return { locations: (payload.results ?? []).slice(0, 5).filter(place => boundedNumber(place.latitude, -90, 90) && boundedNumber(place.longitude, -180, 180) && cleanLabel(place.name)).map(place => ({
        name: [...new Set([cleanLabel(place.name), cleanLabel(place.admin1), cleanLabel(place.country)].filter(Boolean))].join(', '),
        latitude: Math.round(place.latitude * 100) / 100,
        longitude: Math.round(place.longitude * 100) / 100,
      })) };
    });
  }
  return { getWeather, lookupLocations };
}

const defaultService = createWeatherService();
export async function handleWeatherRequest(request, response, url, service = defaultService) {
  if (!['/api/weather', '/api/weather/locations'].includes(url.pathname)) return false;
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin' };
  const send = (status, payload) => { response.writeHead(status, headers); response.end(JSON.stringify(payload)); };
  if (request.method !== 'GET') { send(405, { error: 'Method not allowed.' }); return true; }
  try {
    send(200, await (url.pathname === '/api/weather' ? service.getWeather(url.searchParams) : service.lookupLocations(url.searchParams)));
  } catch (error) {
    send(error.status === 400 ? 400 : error.status === 503 ? 503 : 502, { error: error.status === 400 ? 'Choose a valid city or approximate location.' : 'Weather is temporarily unavailable. Try again later.' });
  }
  return true;
}

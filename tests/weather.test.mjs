import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeatherService, handleWeatherRequest, normalizeWeather } from '../server/weather.mjs';

const NOW = Date.parse('2026-10-12T16:00:00Z');
function fixtureWeather(overrides = {}) {
  return { current: { time: NOW / 1000, temperature_2m: 22.5, precipitation: 1.5, weather_code: 63, is_day: 1, cloud_cover: 80, ...overrides }, daily: { sunrise: [NOW / 1000 - 5 * 3600], sunset: [NOW / 1000 + 5 * 3600] } };
}
function params(query) { return new URLSearchParams(query); }
function responseRecorder() {
  return { writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.payload = JSON.parse(body); } };
}

test('weather uses fixed providers, rounds coordinates, and returns no location or provider extras', async () => {
  const urls = [];
  const service = createWeatherService({ now: () => NOW, fetchImpl: async (url, options) => {
    urls.push(url);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ latitude: 12.34567, longitude: 54.32109, private_extra: 'OMIT_THIS', ...fixtureWeather() });
  } });
  const weather = await service.getWeather(params('latitude=12.34567&longitude=54.32109'));
  assert.equal(urls[0].origin, 'https://api.open-meteo.com');
  assert.equal(urls[0].pathname, '/v1/forecast');
  assert.equal(urls[0].searchParams.get('latitude'), '12.35');
  assert.equal(urls[0].searchParams.get('longitude'), '54.32');
  assert.equal(urls[0].searchParams.get('timeformat'), 'unixtime');
  assert.equal(weather.condition, 'rain');
  assert.equal(weather.rainIntensity, 0.5);
  assert.equal(weather.phase, 'day');
  assert.equal(weather.observedAt, '2026-10-12T16:00:00.000Z');
  assert.equal(weather.source, 'Open-Meteo');
  assert.ok(!JSON.stringify(weather).includes('OMIT_THIS'));
  assert.ok(!('latitude' in weather));
});

test('closed query validation rejects out-of-range, repeated, malformed and injected coordinates without fetching', async () => {
  let calls = 0;
  const service = createWeatherService({ fetchImpl: () => { calls++; throw new Error(); } });
  for (const query of ['latitude=91&longitude=1', 'latitude=1&longitude=-181', 'latitude=1e2&longitude=0', 'latitude=&longitude=1', 'latitude=1&longitude=NaN', 'latitude=1&longitude=1&latitude=2', 'latitude=1&longitude=1&url=https://evil.test', 'latitude=1', 'latitude=1&longitude=0x12']) {
    await assert.rejects(service.getWeather(params(query)), error => error.status === 400, query);
  }
  for (const query of ['q=a', 'q=' + 'a'.repeat(81), 'q=Paris&q=London', 'q=%00Paris', 'q=Paris&count=100', 'q=???']) {
    await assert.rejects(service.lookupLocations(params(query)), error => error.status === 400, query);
  }
  assert.equal(calls, 0);
});

test('concurrent requests deduplicate, cache expires after 15 minutes, and cache stays bounded', async () => {
  let calls = 0;
  let clock = NOW;
  const service = createWeatherService({ maxCacheEntries: 2, now: () => clock, fetchImpl: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 5)); return Response.json(fixtureWeather()); } });
  const query = params('latitude=1&longitude=2');
  const [first, second] = await Promise.all([service.getWeather(query), service.getWeather(query)]);
  assert.deepEqual(first, second);
  assert.equal(calls, 1);
  await service.getWeather(query);
  assert.equal(calls, 1);
  clock += 15 * 60_000;
  await service.getWeather(query);
  assert.equal(calls, 2);
  await service.getWeather(params('latitude=2&longitude=2'));
  await service.getWeather(params('latitude=3&longitude=2'));
  await service.getWeather(query);
  assert.equal(calls, 5);
});

test('weather categorizes snow, storms, fog and night without adding rain to snow', () => {
  assert.equal(normalizeWeather(fixtureWeather({ weather_code: 75, precipitation: 2 }), NOW).condition, 'snow');
  assert.equal(normalizeWeather(fixtureWeather({ weather_code: 95 }), NOW).condition, 'thunderstorm');
  assert.equal(normalizeWeather(fixtureWeather({ weather_code: 45, precipitation: 0 }), NOW).condition, 'fog');
  assert.equal(normalizeWeather(fixtureWeather({ weather_code: 0, precipitation: 0, is_day: 0 }), NOW).phase, 'night');
  const dawn = fixtureWeather(); dawn.daily.sunrise[0] = NOW / 1000 - 600;
  assert.equal(normalizeWeather(dawn, NOW).phase, 'dawn');
  const dusk = fixtureWeather(); dusk.daily.sunset[0] = NOW / 1000 + 600;
  assert.equal(normalizeWeather(dusk, NOW).phase, 'dusk');
  assert.throws(() => normalizeWeather(fixtureWeather({ weather_code: 999 }), NOW));
  assert.throws(() => normalizeWeather(fixtureWeather({ time: NOW / 1000 - 2 * 86400 }), NOW));
  assert.throws(() => normalizeWeather(fixtureWeather({ precipitation: null }), NOW));
});

test('city lookup returns at most five minimal safe locations and caches repeated queries', async () => {
  let calls = 0;
  const service = createWeatherService({ now: () => NOW, fetchImpl: async url => {
    calls++;
    assert.equal(url.origin, 'https://geocoding-api.open-meteo.com');
    assert.equal(url.searchParams.get('name'), 'Paris, France');
    assert.equal(url.searchParams.get('count'), '5');
    return Response.json({ results: Array.from({ length: 7 }, (_, index) => ({ id: index, name: 'Paris', admin1: 'Île-de-France', country: 'France', latitude: 48.8567, longitude: 2.351, population: 2000000, private: 'OMIT_THIS' })) });
  } });
  const { locations } = await service.lookupLocations(params('q=Paris%2C%20France'));
  assert.equal(locations.length, 5);
  assert.deepEqual(locations[0], { name: 'Paris, Île-de-France, France', latitude: 48.86, longitude: 2.35 });
  assert.ok(!JSON.stringify(locations).includes('OMIT_THIS'));
  await service.lookupLocations(params('q=paris%2C%20france'));
  assert.equal(calls, 1);
});

test('provider failures and excessive responses are generic and never cached as successful weather', async () => {
  let calls = 0;
  const service = createWeatherService({ now: () => NOW, fetchImpl: async () => { calls++; return new Response('PRIVATE_PROVIDER_ERROR', { status: 503 }); } });
  const response = responseRecorder();
  const handled = await handleWeatherRequest({ method: 'GET' }, response, new URL('http://localhost/api/weather?latitude=1&longitude=2'), service);
  assert.equal(handled, true);
  assert.equal(response.status, 502);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  assert.equal(response.headers['Access-Control-Allow-Origin'], undefined);
  assert.ok(!JSON.stringify(response.payload).includes('PRIVATE_PROVIDER_ERROR'));
  await assert.rejects(service.getWeather(params('latitude=1&longitude=2')));
  assert.equal(calls, 2);
  const oversized = createWeatherService({ fetchImpl: async () => new Response(' '.repeat(128 * 1024 + 1)) });
  await assert.rejects(oversized.getWeather(params('latitude=1&longitude=2')));
});

test('weather handler leaves unrelated routes alone and rejects methods/invalid locations', async () => {
  assert.equal(await handleWeatherRequest({ method: 'GET' }, responseRecorder(), new URL('http://localhost/api/state')), false);
  const post = responseRecorder();
  assert.equal(await handleWeatherRequest({ method: 'POST' }, post, new URL('http://localhost/api/weather')), true);
  assert.equal(post.status, 405);
  const invalid = responseRecorder();
  await handleWeatherRequest({ method: 'GET' }, invalid, new URL('http://localhost/api/weather?latitude=100&longitude=2'));
  assert.equal(invalid.status, 400);
});

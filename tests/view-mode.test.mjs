import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/useViewMode.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const nativeSource = await readFile(new URL('../native/PLaTOP.swift', import.meta.url), 'utf8');
const nativePublication = nativeSource.match(/private func publishNativeState\(\)[\s\S]*?evaluateJavaScript\("""\n([\s\S]*?)\n\s*""", completionHandler/)?.[1];
assert.ok(nativePublication, 'exercise the JavaScript published by the native companion');

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(callback);
    },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    dispatchEvent(event) { for (const callback of listeners.get(event.type) ?? []) callback(event); },
    listenerCount(type) { return listeners.get(type)?.size ?? 0; },
  };
}

// Hold effect commitment separately from rendering to reproduce native events
// delivered during that gap, rather than relying on nondeterministic timing.
function viewClient({ native = true, beforeMount, deferEffects = false, fullscreenGlobal = false } = {}) {
  const window = {
    ...eventTarget(), __PLATOP_NATIVE__: native,
    __PLATOP_DESKTOP_MODE__: false, __PLATOP_FULLSCREEN__: fullscreenGlobal,
  };
  const document = { ...eventTarget(), fullscreenElement: null, documentElement: {} };
  const messages = [];
  const browserCalls = [];
  window.webkit = { messageHandlers: { platop: { postMessage: message => messages.push(message) } } };
  document.documentElement.requestFullscreen = async () => {
    browserCalls.push('enter'); document.fullscreenElement = document.documentElement;
    document.dispatchEvent({ type: 'fullscreenchange' });
  };
  document.exitFullscreen = async () => {
    browserCalls.push('exit'); document.fullscreenElement = null;
    document.dispatchEvent({ type: 'fullscreenchange' });
  };
  class CustomEvent {
    constructor(type, options) { this.type = type; this.detail = options.detail; }
  }
  const publish = ({ desktop, fullscreen }) => vm.runInNewContext(nativePublication
    .replaceAll('\\(desktop)', String(desktop)).replaceAll('\\(fullscreen)', String(fullscreen)),
  { window, CustomEvent });
  if (beforeMount) publish(beforeMount);
  const cells = [];
  const effects = [];
  let stateCursor = 0;
  let effectCursor = 0;
  const hooks = {
    useState(initial) {
      const index = stateCursor++;
      if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial;
      return [cells[index], value => { cells[index] = typeof value === 'function' ? value(cells[index]) : value; }];
    },
    useEffect(effect, dependencies) {
      const index = effectCursor++;
      const previous = effects[index];
      if (!previous || dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))) {
        effects[index] = { dependencies, pending: effect, cleanup: previous?.cleanup };
      }
    },
    useCallback(callback) { return callback; },
  };
  const module = { exports: {} };
  const saved = new Map();
  vm.runInNewContext(javascript, {
    module, exports: module.exports, window, document, URLSearchParams,
    location: { search: '' },
    localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) },
    require(name) { if (name === 'react') return hooks; throw new Error(`Unexpected dependency: ${name}`); },
  });
  const render = () => { stateCursor = 0; effectCursor = 0; return module.exports.useViewMode(); };
  const commit = () => effects.forEach(effect => {
    if (effect.pending) { effect.cleanup?.(); effect.cleanup = effect.pending(); effect.pending = null; }
  });
  render();
  if (!deferEffects) commit();
  return {
    window, document, publish, commit, messages, browserCalls,
    get value() { return render(); },
    unmount() { effects.forEach(effect => effect.cleanup?.()); },
  };
}

test('native fullscreen published before React mounts initializes the correct state', () => {
  const client = viewClient({ beforeMount: { desktop: false, fullscreen: true }, deferEffects: true });
  assert.equal(client.document.fullscreenElement, null, 'native fullscreen is separate from browser fullscreen');
  assert.equal(client.value.fullscreen, true);
  client.commit();
  assert.equal(client.value.fullscreen, true);
  client.unmount();
});

test('native state published between render and effect is reconciled when the listener attaches', () => {
  const client = viewClient({ deferEffects: true });
  assert.equal(client.value.fullscreen, false);
  client.publish({ desktop: true, fullscreen: true });
  assert.equal(client.value.fullscreen, false, 'the event really preceded listener registration');
  client.commit();
  assert.equal(client.value.fullscreen, true);
  assert.equal(client.value.desktop, true);
  assert.equal(client.value.idle, true);
  client.unmount();
});

test('normal native mode events update state and fullscreen actions still use the native bridge', async () => {
  const client = viewClient();
  client.publish({ desktop: false, fullscreen: true });
  assert.equal(client.value.fullscreen, true);
  await client.value.toggleFullscreen();
  assert.equal(client.messages.length, 1);
  assert.equal(client.messages[0].action, 'fullscreen');
  assert.deepEqual(client.browserCalls, []);
  client.publish({ desktop: false, fullscreen: false });
  assert.equal(client.value.fullscreen, false);
  client.unmount();
  assert.equal(client.window.listenerCount('platop:native'), 0);
  assert.equal(client.document.listenerCount('fullscreenchange'), 0);
});

test('browser fullscreen keeps using document state and browser controls', async () => {
  const client = viewClient({ native: false, fullscreenGlobal: true });
  assert.equal(client.value.fullscreen, false, 'a stale native flag cannot affect a browser visit');
  await client.value.toggleFullscreen();
  assert.equal(client.value.fullscreen, true);
  await client.value.toggleFullscreen();
  assert.equal(client.value.fullscreen, false);
  assert.deepEqual(client.browserCalls, ['enter', 'exit']);
  assert.equal(client.messages.length, 0);
  client.unmount();
});

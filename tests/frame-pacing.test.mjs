import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/scene/framePacing.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { FramePacer } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

for (const refreshRate of [60, 120]) {
  test(`30 fps lands on every ${refreshRate / 30} display refreshes at ${refreshRate} Hz`, () => {
    const pacer = new FramePacer();
    const frames = [];
    for (let i = 0; i < refreshRate * 4; i++) {
      const now = i * 1000 / refreshRate;
      if (pacer.shouldRender(now, true)) frames.push(now);
    }
    assert.equal(frames.length, 120);
    for (let i = 1; i < frames.length; i++) assert.ok(Math.abs(frames[i] - frames[i - 1] - 1000 / 30) < 0.001);
  });
}

for (const refreshRate of [59.94, 119.88]) {
  test(`fractional ${refreshRate} Hz display keeps a steady two or four refresh cadence for 24 seconds`, () => {
    const pacer = new FramePacer();
    const frames = [];
    const refreshes = Math.floor(refreshRate * 24);
    for (let i = 0; i < refreshes; i++) {
      const now = i * 1000 / refreshRate;
      if (pacer.shouldRender(now, true)) frames.push(now);
    }
    assert.ok(Math.abs(frames.length / 24 - 30) < 0.1);
    const expected = 1000 / (refreshRate / Math.round(refreshRate / 30));
    for (let i = 1; i < frames.length; i++) assert.ok(Math.abs(frames[i] - frames[i - 1] - expected) < 0.001);
  });
}

test('a late refresh keeps the original deadline and never catches up in a burst', () => {
  const pacer = new FramePacer();
  assert.equal(pacer.shouldRender(0, true), true);
  assert.equal(pacer.shouldRender(16.667, true), false);
  assert.equal(pacer.shouldRender(54, true), true);
  assert.equal(pacer.shouldRender(55, true), false);
  assert.equal(pacer.shouldRender(66.667, true), false);
  assert.equal(pacer.shouldRender(83.333, true), true);
  assert.equal(pacer.shouldRender(100, true), false); // No single-refresh recovery draw.
  assert.equal(pacer.shouldRender(116.667, true), true);
  assert.equal(pacer.shouldRender(500, true), true);
  assert.equal(pacer.shouldRender(501, true), false);
  assert.equal(pacer.shouldRender(516.667, true), false);
  assert.equal(pacer.shouldRender(533.333, true), true);
});

test('continuous input can draw at 60 fps, with coalesced events and no extra loop afterward', () => {
  const pacer = new FramePacer();
  let draws = 0;
  for (let i = 0; i < 120; i++) {
    pacer.invalidate();
    pacer.invalidate();
    if (pacer.shouldRender(i * 1000 / 120, false)) draws++;
  }
  assert.equal(draws, 60);
  // The last invalidation was coalesced behind the 60 fps draw ceiling.
  assert.equal(pacer.needsFrame(false), true);
  assert.equal(pacer.shouldRender(1000, false), true);
  assert.equal(pacer.needsFrame(false), false);
});

test('static scenes request only invalidated frames and reset drops queued work', () => {
  const pacer = new FramePacer();
  assert.equal(pacer.needsFrame(false), false);
  assert.equal(pacer.shouldRender(0, false), false);
  pacer.invalidate();
  assert.equal(pacer.shouldRender(10, false), true);
  assert.equal(pacer.needsFrame(false), false);
  pacer.invalidate();
  pacer.reset();
  assert.equal(pacer.needsFrame(false), false);
  assert.equal(pacer.shouldRender(10_000, true), true);
  assert.equal(pacer.shouldRender(10_016.667, true), false);
});

test('non-finite display timestamps cannot render', () => {
  const pacer = new FramePacer();
  pacer.invalidate();
  assert.equal(pacer.shouldRender(NaN, true), false);
  assert.equal(pacer.shouldRender(Infinity, true), false);
  assert.equal(pacer.shouldRender(0, true), true);
});

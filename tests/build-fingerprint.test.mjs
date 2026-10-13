import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { BUILD_INPUTS, isBuildCurrent, sourceFingerprint, stampBuild } from '../scripts/build-fingerprint.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'platop-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const input of BUILD_INPUTS) {
    if (['src', 'public'].includes(input)) await mkdir(path.join(root, input));
    else {
      await mkdir(path.dirname(path.join(root, input)), { recursive: true });
      await writeFile(path.join(root, input), 'input');
    }
  }
  await writeFile(path.join(root, 'src', 'app.ts'), 'app');
  await writeFile(path.join(root, 'public', 'toy.glb'), 'toy');
  await mkdir(path.join(root, 'dist'));
  await writeFile(path.join(root, 'dist', 'index.html'), '<script src="/app.js"></script>');
  await writeFile(path.join(root, 'dist', 'app.js'), 'built');
  return root;
}

test('launch freshness rejects unstamped builds, source/assets/config edits and missing outputs', async t => {
  const root = await fixture(t);
  assert.equal(await isBuildCurrent(root), false);
  await stampBuild(root);
  assert.equal(await isBuildCurrent(root), true);
  for (const file of ['src/app.ts', 'public/toy.glb', 'vite.config.ts', 'server/protocol.mjs', 'server/office-protocol.mjs']) {
    const before = await readFile(path.join(root, file));
    await writeFile(path.join(root, file), 'changed');
    assert.equal(await isBuildCurrent(root), false, file);
    await writeFile(path.join(root, file), before);
    assert.equal(await isBuildCurrent(root), true);
  }
  await rm(path.join(root, 'dist', 'app.js'));
  assert.equal(await isBuildCurrent(root), false);
});

test('build identity is deterministic and excludes device-local settings', async t => {
  const root = await fixture(t);
  const before = await sourceFingerprint(root);
  await mkdir(path.join(root, '.local'));
  await writeFile(path.join(root, '.local', 'token'), 'PRIVATE_TEST_DATA');
  const stamp = await stampBuild(root);
  assert.equal(await sourceFingerprint(root), before);
  assert.deepEqual(await stampBuild(root), stamp);
  assert.equal(JSON.stringify(stamp).includes(root), false);
  assert.equal(JSON.stringify(stamp).includes('PRIVATE_TEST_DATA'), false);
});

test('a source edit during compilation cannot be stamped as the built source', async t => {
  const root = await fixture(t);
  const before = await sourceFingerprint(root);
  await writeFile(path.join(root, 'src', 'app.ts'), 'changed during build');
  await assert.rejects(stampBuild(root, before), /Source changed/);
  assert.equal(await isBuildCurrent(root), false);
});

test('freshness rejects input and output symlinks rather than following them', async t => {
  const root = await fixture(t);
  await stampBuild(root);
  await symlink(path.join(root, 'index.html'), path.join(root, 'public', 'linked.html'));
  assert.equal(await isBuildCurrent(root), false);
  await assert.rejects(sourceFingerprint(root), /symbolic links/);
  await rm(path.join(root, 'public', 'linked.html'));
  await symlink(path.join(root, 'index.html'), path.join(root, 'dist', 'linked.html'));
  assert.equal(await isBuildCurrent(root), false);
});

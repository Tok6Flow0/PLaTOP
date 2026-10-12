import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('public/assets/characters/manifest.json', root), 'utf8'));
const approved = JSON.parse(await readFile(new URL('public/assets/approved.json', root), 'utf8'));

test('visual approvals resolve only to delivered local character files', () => {
  assert.equal(approved.schemaVersion, 1);
  assert.ok(Array.isArray(approved.characterIds));
  assert.equal(new Set(approved.characterIds).size, approved.characterIds.length);
  for (const id of approved.characterIds) {
    assert.match(id, /^[a-z]+-[a-z]+$/);
    assert.ok(manifest.characters[id]?.path, `${id} needs a delivered asset`);
  }
});

for (const [id, entry] of Object.entries(manifest.characters)) {
  if (!entry.path) continue;
  test(`${id}: embedded glTF2 asset and four usable activity clips`, async () => {
    assert.match(entry.path, /^\/assets\/characters\/[A-Za-z0-9_-]+\.glb$/);
    const bytes = await readFile(new URL(`public${entry.path}`, root));
    assert.ok(bytes.length <= 4 * 1024 * 1024, 'runtime size ceiling');
    assert.equal(bytes.readUInt32LE(0), 0x46546c67);
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    assert.equal(bytes.readUInt32LE(16), 0x4e4f534a);
    const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    assert.equal(document.asset.version, '2.0');
    for (const resource of [...(document.buffers || []), ...(document.images || [])]) {
      assert.ok(resource.uri === undefined || resource.uri.startsWith('data:'), 'no external resource fetch');
    }
    for (const name of ['Idle', 'Move', 'Work', 'Sleep']) {
      const clip = document.animations?.find(candidate => candidate.name === entry.clips[name]);
      assert.ok(clip?.channels?.length > 0 && clip?.samplers?.length > 0, `missing ${name}`);
    }
    assert.ok(!(document.extensionsRequired || []).some(name => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'].includes(name)), 'no optional decoder download');
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { TEAM_ACTORS } from '../server/office-protocol.mjs';
import { portraitFingerprint } from '../scripts/portrait-fingerprint.mjs';

test('rail and roster portraits are current renders of the shipped character models', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const manifest = JSON.parse(await readFile(new URL('../public/avatars/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.generator, 'scripts/render-avatars.mjs');
  assert.equal(manifest.sourceFingerprint, await portraitFingerprint(root), 'regenerate portraits when their model or studio changes');
  const approvals = JSON.parse(await readFile(new URL('../public/assets/approved.json', import.meta.url), 'utf8'));
  assert.deepEqual(approvals.characterIds, [], 'portrait studio must use the same procedural models as the office');
  const expected = [...Object.values(TEAM_ACTORS).flat(), ...Object.keys(TEAM_ACTORS).map(id => `team-${id}`)].sort();
  assert.deepEqual(Object.keys(manifest.files).sort(), expected);
  for (const id of expected) {
    const png = await readFile(new URL(`../public/avatars/${id}.png`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), id.startsWith('team-') ? 512 : 256);
    assert.equal(png.readUInt32BE(20), id.startsWith('team-') ? 480 : 256);
    assert.equal(png[25], 6, 'transparent RGBA portrait');
    assert.ok(png.length > 1000 && png.length < 250_000, 'bounded meaningful portrait');
    assert.equal(createHash('sha256').update(png).digest('hex'), manifest.files[id]);
  }
});

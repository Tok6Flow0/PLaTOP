import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { compressPng } from '../scripts/png-compression.mjs';

function chunks(png) {
  const found = [];
  for (let offset = 8; offset < png.length;) {
    const size = png.readUInt32BE(offset);
    found.push({ type: png.toString('ascii', offset + 4, offset + 8), bytes: png.subarray(offset, offset + size + 12), data: png.subarray(offset + 8, offset + 8 + size) });
    offset += size + 12;
  }
  return found;
}
test('portrait compression preserves every encoded scanline, dimensions, alpha and ancillary chunk', async () => {
  const png = await readFile(new URL('../public/avatars/team-merchant.png', import.meta.url));
  const result = compressPng(png), before = chunks(png), after = chunks(result);
  assert.ok(result.length <= png.length);
  assert.deepEqual(after.filter(chunk => chunk.type !== 'IDAT').map(chunk => chunk.bytes), before.filter(chunk => chunk.type !== 'IDAT').map(chunk => chunk.bytes));
  const pixels = entries => inflateSync(Buffer.concat(entries.filter(chunk => chunk.type === 'IDAT').map(chunk => chunk.data)));
  assert.deepEqual(pixels(after), pixels(before));
  assert.deepEqual(compressPng(result), result, 'already optimal data stays stable');
  assert.throws(() => compressPng(Buffer.from('not a PNG')), /Expected studio PNG/);
});

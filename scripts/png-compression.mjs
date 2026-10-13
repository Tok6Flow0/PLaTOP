import { deflateSync, inflateSync } from 'node:zlib';

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Recompress browser PNG scanlines losslessly; dimensions and RGBA are unchanged. */
export function compressPng(png) {
  const chunks = [], image = [];
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw Error('Expected studio PNG.');
  for (let offset = 8; offset < png.length;) {
    const size = png.readUInt32BE(offset), end = offset + size + 12;
    if (end > png.length) throw Error('Incomplete studio PNG.');
    const type = png.toString('ascii', offset + 4, offset + 8);
    chunks.push({ type, bytes: png.subarray(offset, end) });
    if (type === 'IDAT') image.push(png.subarray(offset + 8, end - 4));
    offset = end;
  }
  if (!image.length) throw Error('Studio PNG has no image data.');
  const data = deflateSync(inflateSync(Buffer.concat(image)), { level: 9 });
  const chunk = Buffer.alloc(data.length + 12);
  chunk.writeUInt32BE(data.length); chunk.write('IDAT', 4); data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
  let inserted = false;
  const output = [png.subarray(0, 8)];
  for (const entry of chunks) {
    if (entry.type !== 'IDAT') output.push(entry.bytes);
    else if (!inserted) { output.push(chunk); inserted = true; }
  }
  const compressed = Buffer.concat(output);
  return compressed.length < png.length ? compressed : png;
}

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { lstat, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const STAMP = 'build-info.json';
export const BUILD_INPUTS = Object.freeze(['index.html', 'package.json', 'package-lock.json',
  'tsconfig.json', 'vite.config.ts', 'scripts/build-fingerprint.mjs', 'src', 'public',
  'server/protocol.mjs', 'server/office-protocol.mjs', 'server/office-protocol.d.mts']);

async function hashEntries(root, entries, exclude = '') {
  const hash = createHash('sha256');
  async function visit(relative) {
    if (relative === exclude) return;
    const target = path.join(root, relative);
    const info = await lstat(target);
    // Build identity must never follow a link to personal files outside inputs.
    if (info.isSymbolicLink()) throw new Error('Build inputs must not be symbolic links.');
    if (info.isDirectory()) {
      for (const name of (await readdir(target)).sort()) await visit(path.join(relative, name));
    } else if (info.isFile()) {
      const name = relative.split(path.sep).join('/');
      hash.update(`${Buffer.byteLength(name)}:${name}${info.size}:`);
      for await (const chunk of createReadStream(target)) hash.update(chunk);
    } else throw new Error('Unsupported build input.');
  }
  for (const relative of [...entries].sort()) await visit(relative);
  return hash.digest('hex');
}

export function sourceFingerprint(root = ROOT) { return hashEntries(root, BUILD_INPUTS); }
async function outputFingerprint(root) {
  const dist = path.join(root, 'dist');
  if (!(await lstat(dist)).isDirectory()) throw new Error('Build directory is unavailable.');
  await readFile(path.join(dist, 'index.html'));
  return hashEntries(dist, await readdir(dist), STAMP);
}

export async function stampBuild(root = ROOT, expectedSource) {
  const actualSource = await sourceFingerprint(root);
  if (expectedSource !== undefined && actualSource !== expectedSource) throw new Error('Source changed during the build.');
  const stamp = { schemaVersion: 1, sourceFingerprint: actualSource,
    outputFingerprint: await outputFingerprint(root) };
  if (actualSource !== await sourceFingerprint(root)) throw new Error('Source changed during the build.');
  await writeFile(path.join(root, 'dist', STAMP), `${JSON.stringify(stamp)}\n`);
  return stamp;
}

async function build() {
  const before = await sourceFingerprint(ROOT);
  await rm(path.join(ROOT, 'dist', STAMP), { force: true });
  for (const [entry, args] of [['node_modules/typescript/bin/tsc', ['-b']], ['node_modules/vite/bin/vite.js', ['build']]]) {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(ROOT, entry), ...args], { cwd: ROOT, stdio: 'inherit' });
      child.once('error', reject);
      child.once('exit', (code) => code === 0 ? resolve() : reject(new Error('Build failed.')));
    });
  }
  await stampBuild(ROOT, before);
}

export async function isBuildCurrent(root = ROOT) {
  try {
    const stamp = JSON.parse(await readFile(path.join(root, 'dist', STAMP), 'utf8'));
    return stamp.schemaVersion === 1 && /^[a-f0-9]{64}$/.test(stamp.sourceFingerprint)
      && /^[a-f0-9]{64}$/.test(stamp.outputFingerprint)
      && stamp.sourceFingerprint === await sourceFingerprint(root)
      && stamp.outputFingerprint === await outputFingerprint(root);
  } catch { return false; }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const mode = process.argv[2];
  if (process.argv.length !== 3 || !['--build', '--write', '--check'].includes(mode)) {
    console.error('Usage: node scripts/build-fingerprint.mjs --build | --write | --check');
    process.exitCode = 2;
  } else if (mode === '--check') process.exitCode = await isBuildCurrent() ? 0 : 1;
  else {
    try { if (mode === '--build') await build(); else await stampBuild(); }
    catch { console.error('Could not verify build inputs and output.'); process.exitCode = 1; }
  }
}

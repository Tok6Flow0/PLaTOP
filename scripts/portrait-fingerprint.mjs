import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
export const PORTRAIT_INPUTS = Object.freeze(['scripts/render-avatars.mjs', 'scripts/png-compression.mjs', 'package-lock.json', 'src/scene/proxies.ts',
  'src/scene/characterGeometry.ts', 'src/scene/characterDetail.ts', 'src/scene/characterSurface.ts', 'src/scene/primitives.ts', 'src/scene/studioEnvironment.ts', 'src/scene/environmentProps.ts',
  'src/teams.ts', 'public/assets/approved.json', 'public/fonts/Kalam-Regular.ttf']);
export async function portraitFingerprint(root) {
  const hash = createHash('sha256');
  for (const file of PORTRAIT_INPUTS) hash.update(file + '\0').update(await readFile(path.join(root, file)));
  return hash.digest('hex');
}

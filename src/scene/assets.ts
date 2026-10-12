import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

export const CLIP_NAMES = ['Idle', 'Move', 'Work', 'Sleep'] as const;
export type ClipName = typeof CLIP_NAMES[number];
export interface CharacterAsset {
  path: string | null;
  clips: Record<ClipName, string>;
}
export interface AssetManifest {
  schemaVersion: 1;
  characters: Record<string, CharacterAsset>;
}

const defaults: Record<ClipName, string> = { Idle: 'Idle', Move: 'Move', Work: 'Work', Sleep: 'Sleep' };

/** Only explicitly listed same-origin assets under our dedicated directory can load. */
export function parseManifest(value: unknown, characterIds: string[]): AssetManifest {
  if (!value || typeof value !== 'object') throw new Error('Character manifest is invalid.');
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== 1 || !raw.characters || typeof raw.characters !== 'object') {
    throw new Error('Character manifest schema is unsupported.');
  }
  const entries = raw.characters as Record<string, unknown>;
  const characters: Record<string, CharacterAsset> = {};
  characterIds.forEach((id) => {
    const entry = entries[id];
    if (!entry || typeof entry !== 'object') return;
    const record = entry as Record<string, unknown>;
    if (record.path !== null && (typeof record.path !== 'string'
      || !/^\/assets\/characters\/[a-zA-Z0-9_/-]+\.glb$/.test(record.path))) {
      throw new Error(`Character path for ${id} must be a local .glb asset.`);
    }
    const clips = { ...defaults };
    if (record.clips && typeof record.clips === 'object') {
      CLIP_NAMES.forEach((name) => {
        const clip = (record.clips as Record<string, unknown>)[name];
        if (typeof clip === 'string' && clip.length > 0 && clip.length <= 80) clips[name] = clip;
      });
    }
    characters[id] = { path: record.path as string | null, clips };
  });
  return { schemaVersion: 1, characters };
}

export async function fetchManifest(characterIds: string[], signal: AbortSignal): Promise<AssetManifest> {
  const response = await fetch('/assets/characters/manifest.json', { signal, cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
  if (!response.ok) throw new Error('Character manifest unavailable; showing integration proxies.');
  const source = await response.text();
  if (source.length > 128 * 1024) throw new Error('Character manifest exceeds its size limit.');
  return parseManifest(JSON.parse(source), characterIds);
}

/** Reject GLB files that would make the loader fetch external images or buffers. */
function validateEmbeddedGlb(buffer: ArrayBuffer): void {
  if (buffer.byteLength < 20) throw new Error('Character GLB is incomplete.');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2
    || view.getUint32(8, true) !== buffer.byteLength || view.getUint32(16, true) !== 0x4e4f534a) {
    throw new Error('Character asset must be a glTF 2 binary model.');
  }
  const length = view.getUint32(12, true);
  if (20 + length > buffer.byteLength) throw new Error('Character GLB JSON is incomplete.');
  const document = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length))) as Record<string, unknown>;
  for (const key of ['buffers', 'images']) {
    const values = document[key];
    if (!Array.isArray(values)) continue;
    values.forEach((value: unknown) => {
      const uri = value && typeof value === 'object' ? (value as Record<string, unknown>).uri : undefined;
      if (uri !== undefined && (typeof uri !== 'string' || !uri.startsWith('data:'))) {
        throw new Error('Character assets must embed all textures and buffers.');
      }
    });
  }
  if (Array.isArray(document.extensionsRequired)
    && document.extensionsRequired.some((extension: unknown) => extension === 'KHR_draco_mesh_compression' || extension === 'EXT_meshopt_compression' || extension === 'KHR_texture_basisu')) {
    throw new Error('Character assets must not require optional decoder downloads.');
  }
}

export async function fetchCharacter(path: string, signal: AbortSignal): Promise<GLTF> {
  const response = await fetch(path, { signal, credentials: 'same-origin', redirect: 'error' });
  if (!response.ok) throw new Error('Character model unavailable; keeping its integration proxy.');
  const size = Number(response.headers.get('content-length'));
  if (size > 4 * 1024 * 1024) throw new Error('Character GLB exceeds the 4 MB integration ceiling.');
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > 4 * 1024 * 1024) throw new Error('Character GLB exceeds the 4 MB integration ceiling.');
  validateEmbeddedGlb(buffer);
  if (signal.aborted) throw new DOMException('Asset load cancelled.', 'AbortError');
  return new GLTFLoader().parseAsync(buffer, '/assets/characters/');
}

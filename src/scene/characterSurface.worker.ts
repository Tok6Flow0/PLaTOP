import { refineCharacterSurface, type SurfaceData } from './characterSurface';

self.onmessage = (event: MessageEvent<{ id: number; source: SurfaceData; finish: string }>) => {
  const { id, source, finish } = event.data;
  try {
    const result = refineCharacterSurface(source, finish);
    const transfer = [result.index.buffer, ...Object.values(result.attributes).map(attribute => attribute.array.buffer)];
    self.postMessage({ id, result }, { transfer });
  } catch {
    self.postMessage({ id, error: 'Character surface refinement failed' });
  }
};

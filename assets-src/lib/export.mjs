// Node-side GLB export using three's GLTFExporter.
import { Buffer } from 'node:buffer';

// GLTFExporter reads Blobs through FileReader, which Node lacks.
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); this.onload?.({ target: this }); });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((b) => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`;
        this.onloadend?.(); this.onload?.({ target: this });
      });
    }
  };
}

const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');

/** Export a scene graph and its clips to a binary glTF buffer. */
export async function toGLB(root, clips = []) {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(root, { binary: true, animations: clips, onlyVisible: false });
  return Buffer.from(result);
}

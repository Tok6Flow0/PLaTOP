import * as THREE from 'three';

/** Opaque default canvas preserves the original MSAA and tone-mapped blending. */
export class FrameOutput {
  private readonly previousInfoReset: boolean;
  private backgroundTexture?: THREE.CanvasTexture;
  private backgroundDirty = true;
  private idle: boolean | undefined;
  private width = 0;
  private height = 0;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly scene: THREE.Scene,
    private readonly host: HTMLElement) {
    this.previousInfoReset = renderer.info.autoReset;
    renderer.info.autoReset = false;
  }

  invalidateBackground(): void { this.backgroundDirty = true; }

  private resize(): void {
    const canvas = this.renderer.domElement;
    if (canvas.width === this.width && canvas.height === this.height) return;
    this.width = canvas.width;
    this.height = canvas.height;
    this.backgroundDirty = true;
  }

  private updateBackground(idle: boolean): void {
    if (!this.backgroundDirty && idle === this.idle) return;
    this.backgroundDirty = false;
    this.idle = idle;
    this.backgroundTexture?.dispose();
    this.backgroundTexture = undefined;
    if (idle) {
      this.scene.background = new THREE.Color('#c4c0aa');
      return;
    }
    const workspace = this.host.closest<HTMLElement>('.workspace');
    if (!workspace) {
      // A standalone scene host has no workspace gradient to reproduce.
      this.scene.background = new THREE.Color('#f5f3ed');
      return;
    }
    const outer = workspace.getBoundingClientRect();
    const inner = this.host.getBoundingClientRect();
    if (outer.width <= 0 || outer.height <= 0 || inner.width <= 0 || inner.height <= 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const context = canvas.getContext('2d');
    if (!context) { this.scene.background = new THREE.Color('#f5f3ed'); return; }
    const image = context.createImageData(this.width, this.height);
    const centerX = outer.width * 0.5;
    const centerY = outer.height * 0.42;
    const radiusX = Math.max(centerX, outer.width - centerX) * Math.SQRT2;
    const radiusY = Math.max(centerY, outer.height - centerY) * Math.SQRT2;
    const left = inner.left - outer.left;
    const top = inner.top - outer.top;
    const cssPerPixelX = inner.width / this.width;
    const cssPerPixelY = inner.height / this.height;
    // Match the CSS ellipse/farthest-corner gradient in encoded sRGB. This work
    // runs only on resize/view changes; the texture is reused on every frame.
    for (let y = 0; y < this.height; y++) {
      const dy = (top + (y + 0.5) * cssPerPixelY - centerY) / radiusY;
      for (let x = 0; x < this.width; x++) {
        const dx = (left + (x + 0.5) * cssPerPixelX - centerX) / radiusX;
        const mix = Math.min(Math.sqrt(dx * dx + dy * dy) / 0.68, 1);
        const offset = (y * this.width + x) * 4;
        image.data[offset] = Math.round(251 - 6 * mix);
        image.data[offset + 1] = Math.round(249 - 6 * mix);
        image.data[offset + 2] = Math.round(241 - 4 * mix);
        image.data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.matrixAutoUpdate = false;
    this.backgroundTexture = texture;
    // Three's sRGB background material bypasses tone mapping. Scene materials,
    // transparent surfaces and glows keep their existing default-buffer path.
    this.scene.background = texture;
  }

  render(camera: THREE.Camera, idle: boolean): void {
    this.resize();
    this.updateBackground(idle);
    this.renderer.info.reset();
    this.renderer.render(this.scene, camera);

  }

  dispose(): void {
    this.scene.background = null;
    this.backgroundTexture?.dispose();
    this.renderer.info.autoReset = this.previousInfoReset;
  }
}

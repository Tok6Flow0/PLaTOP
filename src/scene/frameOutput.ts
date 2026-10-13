import * as THREE from 'three';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export interface OcclusionPipeline {
  resize(width: number, height: number): void;
  render(camera: THREE.Camera): void;
  dispose(): void;
}

/** Reuse the colour draw's depth, rather than drawing every avatar a second time. */
export function makeOcclusionPipeline(renderer: THREE.WebGLRenderer, scene: THREE.Scene,
  camera: THREE.Camera): OcclusionPipeline | undefined {
  if (typeof renderer.getContext !== 'function') return;
  const depth = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  const colour = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType,
    depthTexture: depth, samples: Math.min(2, renderer.capabilities.maxSamples) });
  const ao = new GTAOPass(scene, camera, 1, 1);
  ao.setGBuffer(depth);
  ao.output = GTAOPass.OUTPUT.Off;
  ao.updateGtaoMaterial({ radius: 0.8, thickness: 0.7, distanceFallOff: 1, scale: 1.2, samples: 8 });
  ao.updatePdMaterial({ radius: 4, samples: 8 });
  const material = new THREE.ShaderMaterial({
    uniforms: { tColour: { value: colour.texture }, tDepth: { value: depth },
      tBackground: { value: null }, backgroundColour: { value: new THREE.Color() }, backgroundIsTexture: { value: false },
      tAO: { value: ao.gtaoMap }, strength: { value: 0.88 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
    fragmentShader: `varying vec2 vUv;
      uniform sampler2D tColour; uniform sampler2D tDepth; uniform sampler2D tAO; uniform float strength;
      uniform sampler2D tBackground; uniform vec3 backgroundColour; uniform bool backgroundIsTexture;
      void main(){
        vec4 layer=texture2D(tColour,vUv);
        float coverage=clamp(layer.a,0.0,1.0);
        gl_FragColor=vec4(layer.rgb/max(coverage,0.00001),1.0);
        float depth=texture2D(tDepth,vUv).x;
        if(depth<0.999999){
          gl_FragColor.rgb*=mix(1.0,texture2D(tAO,vUv).r,strength);
        }
        #include <tonemapping_fragment>
        vec3 backdrop=backgroundIsTexture ? texture2D(tBackground,vUv).rgb : backgroundColour;
        gl_FragColor.rgb=mix(backdrop,gl_FragColor.rgb,coverage);
        #include <colorspace_fragment>
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new FullScreenQuad(material);
  const previousColour = new THREE.Color();
  let disposed = false;
  return {
    resize(width, height) {
      const scale = Math.min(1, 1600 / Math.max(width, height));
      const w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
      colour.setSize(w, h);
      // Half-resolution, eight-sample contact shading is capped even on Retina.
      ao.setSize(Math.max(1, Math.ceil(w / 2)), Math.max(1, Math.ceil(h / 2)));
    },
    render(view) {
      const previousTarget = renderer.getRenderTarget();
      const previousClear = renderer.autoClear;
      renderer.getClearColor(previousColour);
      const previousAlpha = renderer.getClearAlpha();
      const background = scene.background;
      try {
        // Coverage, not depth, identifies geometry. Faded walls do not write
        // depth but still need the same tone mapping as their opaque surfaces.
        material.uniforms.backgroundIsTexture.value = !!(background as THREE.Texture)?.isTexture;
        material.uniforms.tBackground.value = material.uniforms.backgroundIsTexture.value ? background : null;
        if ((background as THREE.Color)?.isColor) material.uniforms.backgroundColour.value.copy(background);
        else if (!background) material.uniforms.backgroundColour.value.copy(previousColour);
        scene.background = null;
        renderer.setClearColor(0x000000, 0);
        renderer.autoClear = true;
        renderer.setRenderTarget(colour);
        renderer.render(scene, view);
        ao.camera = view;
        ao.render(renderer, colour, colour, 0, false);
        renderer.setRenderTarget(previousTarget);
        quad.render(renderer);
      } finally {
        renderer.setRenderTarget(previousTarget);
        renderer.autoClear = previousClear;
        renderer.setClearColor(previousColour, previousAlpha);
        scene.background = background;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      colour.dispose(); depth.dispose(); ao.dispose();
      // Three r180 does not dispose these two pass-owned materials itself.
      ao.gtaoMaterial.dispose(); ao.blendMaterial.dispose();
      material.dispose(); quad.dispose();
    },
  };
}

/** Contact shading preserves the original background and a direct-output fallback. */
export class FrameOutput {
  private readonly previousInfoReset: boolean;
  private backgroundTexture?: THREE.CanvasTexture;
  private backgroundDirty = true;
  private idle: boolean | undefined;
  private width = 0;
  private height = 0;
  private pipeline?: OcclusionPipeline;
  private pipelineAttempted = false;
  private disposed = false;
  private backdrop: [string, string] = ['#fbf9f1', '#f5f3ed'];
  private windowBackdrop = '#c4c0aa';

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly scene: THREE.Scene,
    private readonly host: HTMLElement,
    private readonly createPipeline = makeOcclusionPipeline) {
    this.previousInfoReset = renderer.info.autoReset;
    renderer.info.autoReset = false;
  }

  invalidateBackground(): void { this.backgroundDirty = true; }

  setBackdrop(center: string, edge: string, windowColor: string): void {
    if (this.backdrop[0] === center && this.backdrop[1] === edge && this.windowBackdrop === windowColor) return;
    this.backdrop = [center, edge]; this.windowBackdrop = windowColor; this.invalidateBackground();
  }

  private resize(): void {
    const canvas = this.renderer.domElement;
    if (canvas.width === this.width && canvas.height === this.height) return;
    this.width = canvas.width;
    this.height = canvas.height;
    this.backgroundDirty = true;
    try { this.pipeline?.resize(this.width, this.height); }
    catch { this.releasePipeline(); }
  }

  private releasePipeline(): void {
    try { this.pipeline?.dispose(); } catch { /* A lost context must not block direct drawing. */ }
    this.pipeline = undefined;
    if (this.host.dataset) this.host.dataset.contactShading = 'direct';
  }

  private updateBackground(idle: boolean): void {
    if (!this.backgroundDirty && idle === this.idle) return;
    this.backgroundDirty = false;
    this.idle = idle;
    this.backgroundTexture?.dispose();
    this.backgroundTexture = undefined;
    if (idle) {
      this.scene.background = new THREE.Color(this.windowBackdrop);
      return;
    }
    const workspace = this.host.closest<HTMLElement>('.workspace');
    if (!workspace) {
      // A standalone scene host has no workspace gradient to reproduce.
      this.scene.background = new THREE.Color(this.backdrop[1]);
      return;
    }
    const outer = workspace.getBoundingClientRect();
    const inner = this.host.getBoundingClientRect();
    if (outer.width <= 0 || outer.height <= 0 || inner.width <= 0 || inner.height <= 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const context = canvas.getContext('2d');
    if (!context) { this.scene.background = new THREE.Color(this.backdrop[1]); return; }
    const image = context.createImageData(this.width, this.height);
    const centerX = outer.width * 0.5;
    const centerY = outer.height * 0.42;
    const radiusX = Math.max(centerX, outer.width - centerX) * Math.SQRT2;
    const radiusY = Math.max(centerY, outer.height - centerY) * Math.SQRT2;
    const left = inner.left - outer.left;
    const top = inner.top - outer.top;
    const cssPerPixelX = inner.width / this.width;
    const cssPerPixelY = inner.height / this.height;
    const start = [1, 3, 5].map(i => parseInt(this.backdrop[0].slice(i, i + 2), 16));
    const end = [1, 3, 5].map(i => parseInt(this.backdrop[1].slice(i, i + 2), 16));
    // Match the CSS ellipse/farthest-corner gradient in encoded sRGB. This work
    // runs only on resize/view changes; the texture is reused on every frame.
    for (let y = 0; y < this.height; y++) {
      const dy = (top + (y + 0.5) * cssPerPixelY - centerY) / radiusY;
      for (let x = 0; x < this.width; x++) {
        const dx = (left + (x + 0.5) * cssPerPixelX - centerX) / radiusX;
        const mix = Math.min(Math.sqrt(dx * dx + dy * dy) / 0.68, 1);
        const offset = (y * this.width + x) * 4;
        image.data[offset] = Math.round(start[0] + (end[0] - start[0]) * mix);
        image.data[offset + 1] = Math.round(start[1] + (end[1] - start[1]) * mix);
        image.data[offset + 2] = Math.round(start[2] + (end[2] - start[2]) * mix);
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
    if (!this.pipelineAttempted) {
      this.pipelineAttempted = true;
      try { this.pipeline = this.createPipeline(this.renderer, this.scene, camera); }
      catch { this.pipeline = undefined; }
      if (this.host.dataset) this.host.dataset.contactShading = this.pipeline ? 'depth-occlusion' : 'direct';
      try { this.pipeline?.resize(this.width, this.height); }
      catch { this.releasePipeline(); }
    }
    if (this.pipeline) {
      try { this.pipeline.render(camera); return; }
      catch { this.releasePipeline(); }
    }
    this.renderer.render(this.scene, camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.background = null;
    this.backgroundTexture?.dispose();
    this.releasePipeline();
    this.renderer.info.autoReset = this.previousInfoReset;
  }
}

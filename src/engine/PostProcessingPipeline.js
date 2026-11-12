import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * Physical Full-Frame (36x24mm) Linear-HDR Optical Bokeh Pass.
 * Runs in HalfFloat linear HDR space BEFORE UnrealBloomPass & OutputPass (ACES Filmic)
 * so out-of-focus streetlamps, traffic lights, neon, and wet-asphalt specular glints
 * expand into bright circular optical bokeh discs instead of muddy sRGB blur.
 */
const LinearHdrOpticalBokehShader = {
  uniforms: {
    tColor: { value: null },
    tDepth: { value: null },
    uNear: { value: 0.1 },
    uFar: { value: 1000.0 },
    uAspect: { value: 1.777 },
    uFocalLengthMm: { value: 85.0 },
    uFStop: { value: 1.2 },
    uFocusDistance: { value: 5.5 },
    uBokehBoost: { value: 1.45 },
    uMaxCocUv: { value: 0.026 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    #include <packing>

    uniform sampler2D tColor;
    uniform sampler2D tDepth;
    uniform float uNear;
    uniform float uFar;
    uniform float uAspect;
    uniform float uFocalLengthMm;
    uniform float uFStop;
    uniform float uFocusDistance;
    uniform float uBokehBoost;
    uniform float uMaxCocUv;

    varying vec2 vUv;

    float getLinearDepthMeters(const in vec2 uv) {
      float fragCoordZ = unpackRGBAToDepth(texture2D(tDepth, uv));
      // Perspective viewZ is negative in Three.js
      float viewZ = perspectiveDepthToViewZ(fragCoordZ, uNear, uFar);
      return clamp(-viewZ, uNear, uFar);
    }

    // Physical thin-lens Circle of Confusion radius in normalized vertical UV units (24mm full-frame sensor height)
    float computeSignedCocUv(float depthM) {
      float fMm = uFocalLengthMm;
      float s1Mm = max(fMm + 80.0, uFocusDistance * 1000.0);
      float s2Mm = max(fMm + 50.0, depthM * 1000.0);
      float apertureMm = fMm / max(0.95, uFStop);
      // Signed CoC: positive = background (behind focus), negative = foreground (in front of focus)
      float cocDiameterMm = apertureMm * (fMm / (s1Mm - fMm)) * ((s2Mm - s1Mm) / s2Mm);
      float cocRadiusUv = 0.5 * (cocDiameterMm / 24.0);
      return clamp(cocRadiusUv, -uMaxCocUv, uMaxCocUv);
    }

    void main() {
      vec4 baseSample = texture2D(tColor, vUv);
      float centerDepth = getLinearDepthMeters(vUv);
      float centerSignedCoc = computeSignedCocUv(centerDepth);
      float centerCoc = abs(centerSignedCoc);

      // Fast path for razor-sharp in-focus subject pixels (unless foreground blur overlaps)
      vec3 accumColor = baseSample.rgb;
      float accumWeight = 1.0;

      // 48-tap Vogel golden-angle optical aperture disc in Linear HDR
      const int NUM_TAPS = 48;
      const float GOLDEN_ANGLE = 2.39996323;

      // Probe max nearby CoC slightly larger than centerCoc so foreground out-of-focus edges stay smooth
      float searchRadius = max(centerCoc, min(uMaxCocUv, 0.0045));
      if (centerCoc < 0.00055) {
        gl_FragColor = baseSample;
        return;
      }

      searchRadius = centerCoc;

      for (int i = 0; i < NUM_TAPS; i++) {
        float fi = float(i);
        float rNorm = sqrt((fi + 0.5) / float(NUM_TAPS));
        float theta = fi * GOLDEN_ANGLE;
        vec2 unitOffset = vec2(cos(theta), sin(theta)) * rNorm;
        vec2 sampleUv = vUv + vec2(unitOffset.x / max(0.001, uAspect), unitOffset.y) * searchRadius;

        if (sampleUv.x < 0.0 || sampleUv.x > 1.0 || sampleUv.y < 0.0 || sampleUv.y > 1.0) {
          continue;
        }

        float sDepth = getLinearDepthMeters(sampleUv);
        float sSignedCoc = computeSignedCocUv(sDepth);
        float sCoc = abs(sSignedCoc);

        // Prevent sharp foreground car silhouette from bleeding onto out-of-focus background bokeh
        if (sDepth < centerDepth - 0.18 && sCoc < centerCoc * 0.45) {
          continue;
        }

        // Aperture disc coverage check
        float distUv = rNorm * searchRadius;
        float accept = smoothstep(distUv - 0.0008, distUv + 0.0008, max(sCoc, centerCoc * 0.85));
        if (accept <= 0.001) {
          continue;
        }

        vec3 sCol = texture2D(tColor, sampleUv).rgb;
        float luma = dot(sCol, vec3(0.2126, 0.7152, 0.0722));

        // Linear-HDR optical bokeh highlight emphasis + subtle spherical aberration rim ring
        float hdrPop = 1.0 + pow(clamp(luma - 0.65, 0.0, 28.0), 1.12) * uBokehBoost * smoothstep(0.0015, 0.010, sCoc);
        float rimAccent = mix(1.0, 1.18, smoothstep(0.72, 0.98, rNorm));
        float w = accept * hdrPop * rimAccent;

        accumColor += sCol * w;
        accumWeight += w;
      }

      gl_FragColor = vec4(accumColor / max(0.0001, accumWeight), baseSample.a);
    }
  `,
};

class OpticalBokehPass extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.enabled = false;

    this.renderTargetDepth = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
    });
    this.renderTargetDepth.texture.name = 'OpticalBokehPass.depth';

    this.materialDepth = new THREE.MeshDepthMaterial({
      depthPacking: THREE.RGBADepthPacking,
      blending: THREE.NoBlending,
    });

    this.uniforms = THREE.UniformsUtils.clone(LinearHdrOpticalBokehShader.uniforms);
    this.uniforms.tDepth.value = this.renderTargetDepth.texture;

    this.materialBokeh = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: LinearHdrOpticalBokehShader.vertexShader,
      fragmentShader: LinearHdrOpticalBokehShader.fragmentShader,
      depthWrite: false,
      depthTest: false,
    });

    this.fsQuad = new FullScreenQuad(this.materialBokeh);
    this._oldClearColor = new THREE.Color();
  }

  render(renderer, writeBuffer, readBuffer) {
    // 1. Render linearizable scene depth into non-MSAA depth packing buffer
    const prevOverride = this.scene.overrideMaterial;
    this.scene.overrideMaterial = this.materialDepth;

    renderer.getClearColor(this._oldClearColor);
    const oldClearAlpha = renderer.getClearAlpha();
    const oldAutoClear = renderer.autoClear;
    renderer.autoClear = false;

    renderer.setClearColor(0xffffff);
    renderer.setClearAlpha(1.0);
    renderer.setRenderTarget(this.renderTargetDepth);
    renderer.clear();
    renderer.render(this.scene, this.camera);

    this.scene.overrideMaterial = prevOverride;
    renderer.setClearColor(this._oldClearColor);
    renderer.setClearAlpha(oldClearAlpha);
    renderer.autoClear = oldAutoClear;

    // 2. Composite Linear-HDR Circle of Confusion bokeh
    this.uniforms.tColor.value = readBuffer.texture;
    this.uniforms.uNear.value = this.camera.near;
    this.uniforms.uFar.value = this.camera.far;
    this.uniforms.uAspect.value = this.camera.aspect || 1.777;

    if (this.renderToScreen) {
      renderer.setRenderTarget(null);
      this.fsQuad.render(renderer);
    } else {
      renderer.setRenderTarget(writeBuffer);
      renderer.clear();
      this.fsQuad.render(renderer);
    }
  }

  setSize(width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    this.renderTargetDepth.setSize(w, h);
    this.uniforms.uAspect.value = w / h;
  }

  dispose() {
    this.renderTargetDepth.dispose();
    this.materialDepth.dispose();
    this.materialBokeh.dispose();
    this.fsQuad.dispose();
  }
}

const CinematicGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: 1.05 },
    uExposure: { value: 1.0 },
    uBlackLevel: { value: 0.006 },
    uVignette: { value: 0.24 },
    uGrain: { value: 0.006 },
    uTime: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uContrast;
    uniform float uExposure;
    uniform float uBlackLevel;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uTime;
    varying vec2 vUv;

    // Pseudo-random film grain hash
    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 col = tex.rgb * uExposure;

      // Gentle black-point floor in post-tonemapped sRGB space (preserves shadow detail)
      col = max(vec3(0.0), (col - vec3(uBlackLevel)) / max(0.001, 1.0 - uBlackLevel));

      // Filmic pivot contrast around mid-grey so highlights & white liveries stay crisp
      vec3 centered = col - vec3(0.5);
      col = clamp(vec3(0.5) + centered * uContrast, 0.0, 1.0);

      // Subtle anamorphic film grain to eliminate banding in dark gradients
      if (uGrain > 0.001) {
        float noise = (rand(vUv + fract(uTime)) - 0.5) * uGrain;
        col += noise;
      }

      // Smooth cinematic lens vignette
      if (uVignette > 0.01) {
        vec2 uvCenter = (vUv - 0.5) * vec2(1.15, 1.0);
        float dist = dot(uvCenter, uvCenter);
        float vig = 1.0 - smoothstep(0.28, 0.92, dist) * uVignette;
        col *= vig;
      }

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), tex.a);
    }
  `,
};

export class PostProcessingPipeline {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    const size = renderer.getSize(new THREE.Vector2());
    const dpr = renderer.getPixelRatio ? renderer.getPixelRatio() : 1;
    const effW = Math.max(1, Math.floor(size.x * dpr));
    const effH = Math.max(1, Math.floor(size.y * dpr));

    const renderTarget = new THREE.WebGLRenderTarget(effW, effH, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(renderer, renderTarget);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Physical Linear-HDR Optical Bokeh Pass (runs BEFORE Bloom & ACES Tone Mapping!)
    this.bokehPass = new OpticalBokehPass(scene, camera);
    this.bokehPass.setSize(effW, effH);
    this.composer.addPass(this.bokehPass);

    // Subtle HDR bloom strictly on real emissive light sources > 1.08
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      0.12,
      0.2,
      1.08
    );
    this.composer.addPass(this.bloomPass);

    // Tone-map linear HDR -> sRGB via ACES Filmic BEFORE display-referred film grading
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    // Post-tonemap Cinematic Grade & Lens Vignette Pass
    this.gradePass = new ShaderPass(CinematicGradeShader);
    this.composer.addPass(this.gradePass);

    this.enabled = true;
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
    const dpr = this.renderer.getPixelRatio ? this.renderer.getPixelRatio() : 1;
    this.bokehPass.setSize(width * dpr, height * dpr);
    this.bloomPass.resolution.set(width, height);
  }

  setDofConfig({
    enabled,
    focalLengthMm,
    fStop,
    focusDistance,
    bokehBoost,
    maxCocUv,
  } = {}) {
    if (typeof enabled === 'boolean') {
      this.bokehPass.enabled = enabled;
    }
    if (typeof focalLengthMm === 'number' && Number.isFinite(focalLengthMm)) {
      this.bokehPass.uniforms.uFocalLengthMm.value = Math.max(12, Math.min(600, focalLengthMm));
    }
    if (typeof fStop === 'number' && Number.isFinite(fStop)) {
      this.bokehPass.uniforms.uFStop.value = Math.max(0.95, Math.min(22.0, fStop));
    }
    if (typeof focusDistance === 'number' && Number.isFinite(focusDistance)) {
      this.bokehPass.uniforms.uFocusDistance.value = Math.max(0.3, Math.min(500.0, focusDistance));
    }
    if (typeof bokehBoost === 'number' && Number.isFinite(bokehBoost)) {
      this.bokehPass.uniforms.uBokehBoost.value = Math.max(0.0, Math.min(4.0, bokehBoost));
    }
    if (typeof maxCocUv === 'number' && Number.isFinite(maxCocUv)) {
      this.bokehPass.uniforms.uMaxCocUv.value = Math.max(0.005, Math.min(0.055, maxCocUv));
    }
  }

  getDofState() {
    return {
      enabled: this.bokehPass.enabled,
      focalLengthMm: this.bokehPass.uniforms.uFocalLengthMm.value,
      fStop: this.bokehPass.uniforms.uFStop.value,
      focusDistance: this.bokehPass.uniforms.uFocusDistance.value,
      bokehBoost: this.bokehPass.uniforms.uBokehBoost.value,
    };
  }

  setBloom(strength, radius = 0.22, threshold = 1.08) {
    this.bloomPass.strength = strength;
    this.bloomPass.radius = radius;
    this.bloomPass.threshold = threshold;
  }

  setVignette(val) {
    this.gradePass.uniforms.uVignette.value = val;
  }

  setContrast(val) {
    this.gradePass.uniforms.uContrast.value = val;
  }

  setExposure(val) {
    this.gradePass.uniforms.uExposure.value = val;
  }

  setBlackLevel(val) {
    this.gradePass.uniforms.uBlackLevel.value = val;
  }

  dispose() {
    this.bokehPass.dispose();
  }

  render(deltaTime = 0.016) {
    if (!this.enabled) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.gradePass.uniforms.uTime.value += deltaTime;
    this.composer.render();
  }
}

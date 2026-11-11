import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

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
    const renderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(renderer, renderTarget);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

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
    this.bloomPass.resolution.set(width, height);
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

  render(deltaTime = 0.016) {
    if (!this.enabled) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.gradePass.uniforms.uTime.value += deltaTime;
    this.composer.render();
  }
}

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const CinematicGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: 1.22 },
    uExposure: { value: 1.05 },
    uBlackLevel: { value: 0.04 },
    uVignette: { value: 0.45 },
    uGrain: { value: 0.018 },
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

      // Crush blacks slightly to ensure dark scenes have inky depth
      col = max(vec3(0.0), col - vec3(uBlackLevel));

      // S-curve contrast adjustment
      col = pow(col, vec3(uContrast));

      // Subtle anamorphic film grain to eliminate banding in dark gradients
      if (uGrain > 0.001) {
        float noise = (rand(vUv + fract(uTime)) - 0.5) * uGrain;
        col += noise;
      }

      // Smooth cinematic lens vignette
      if (uVignette > 0.01) {
        vec2 uvCenter = (vUv - 0.5) * vec2(1.2, 1.0);
        float dist = dot(uvCenter, uvCenter);
        float vig = 1.0 - smoothstep(0.18, 0.78, dist) * uVignette;
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
    this.composer = new EffectComposer(renderer);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Unreal Bloom: gives headlights, softbox reflections, and glowing neons an anamorphic lens glow
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      0.72, // Strength
      0.38, // Radius
      0.82  // Threshold
    );
    this.composer.addPass(this.bloomPass);

    // Cinematic Grade & Dark Vignette Pass
    this.gradePass = new ShaderPass(CinematicGradeShader);
    this.composer.addPass(this.gradePass);

    // Final color space pass
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.enabled = true;
  }

  setSize(width, height) {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  setBloom(strength, radius = 0.38, threshold = 0.82) {
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

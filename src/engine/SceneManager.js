import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { WeatherSystem } from './WeatherSystem.js';
import { LightingRig } from './LightingRig.js';
import { VehicleDynamics } from './VehicleDynamics.js';
import { CameraDirector } from './CameraDirector.js';
import { CarMaterialEnhancer } from './CarMaterialEnhancer.js';
import { PostProcessingPipeline } from './PostProcessingPipeline.js';

export class SceneManager {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#010204'); // Deep pitch-black cinematic background

    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 800);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 1.2;
    this.controls.maxDistance = 140;

    // GLTF + Draco loader
    this.gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.gltfLoader.setDRACOLoader(dracoLoader);

    this.subjectHolder = new THREE.Group();
    this.subjectHolder.name = 'ActiveSubjectHolder';
    this.scene.add(this.subjectHolder);

    this.locationHolder = new THREE.Group();
    this.locationHolder.name = 'ImportedLocationHolder';
    this.scene.add(this.locationHolder);

    this.lightingRig = new LightingRig(this.scene, this.renderer);
    this.weatherSystem = new WeatherSystem(this.scene);
    this.vehicleDynamics = new VehicleDynamics(this.scene);
    this.cameraDirector = new CameraDirector(this.camera, this.controls);
    this.enhancer = new CarMaterialEnhancer();
    this.pipeline = new PostProcessingPipeline(this.renderer, this.scene, this.camera);

    this.cameraDirector.onShotChangeCallback = (shotId, isSeq, clipIdx) => {
      if (this.callbacks.onShotChange) {
        this.callbacks.onShotChange(shotId, isSeq, clipIdx);
      }
    };

    this.activeSceneId = 'dark_void'; // Start in the gorgeous Obsidian Blackout Stage!
    this.activeMode = 'cars';
    this.subjectCache = new Map();
    this.locationCache = new Map();
    this.loadToken = 0;
    this.windTunnelFan = null;

    this.clock = new THREE.Clock();
    this.elapsed = 0;
    this.disposed = false;

    this.resize();
    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);
    this._animate();
  }

  resize() {
    if (!this.canvas || !this.canvas.parentElement) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = Math.max(320, rect.width);
    const h = Math.max(240, rect.height);
    this.renderer.setSize(w, h, false);
    this.pipeline.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Loads, normalizes, and enhances a Car or Plane GLB model
   */
  async loadSubject(item, mode = 'cars') {
    this.activeMode = mode;
    const token = ++this.loadToken;
    if (this.callbacks.onLoadingChange) {
      this.callbacks.onLoadingChange({ loading: true, progress: 0, label: item.name });
    }

    try {
      let rootGroup;
      let bounds;

      if (this.subjectCache.has(item.id)) {
        const cached = this.subjectCache.get(item.id);
        rootGroup = cached.rootGroup;
        bounds = cached.bounds;
      } else {
        const gltf = await new Promise((resolve, reject) => {
          this.gltfLoader.load(
            item.url,
            resolve,
            (evt) => {
              if (evt.lengthComputable && this.callbacks.onLoadingChange) {
                const pct = Math.round((evt.loaded / evt.total) * 100);
                this.callbacks.onLoadingChange({ loading: true, progress: pct, label: item.name });
              }
            },
            reject
          );
        });

        const rawModel = gltf.scene;

        // Strip any stray backdrop/shadow-catcher floor planes baked into Sketchfab exports
        rawModel.traverse((child) => {
          if (child.isMesh) {
            const mName = (child.name || '').toLowerCase();
            const matName = (child.material?.name || '').toLowerCase();
            if (
              mName.includes('ground_ao') ||
              matName.includes('ground_ao') ||
              mName.includes('shadow_plane') ||
              mName.includes('floor_plane')
            ) {
              child.visible = false;
            }
          }
        });

        // Compute bounding box of visible meshes
        const box = new THREE.Box3().setFromObject(rawModel);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const maxHoriz = Math.max(size.x, size.z, 0.001);
        const targetSpan = item.targetSize || (mode === 'planes' ? 26.0 : 4.8);
        const scale = targetSpan / maxHoriz;

        rootGroup = new THREE.Group();
        rawModel.scale.setScalar(scale);

        // Recompute scaled box so bottom touches Y = 0.000 and X,Z = 0
        const scaledBox = new THREE.Box3().setFromObject(rawModel);
        const scaledCenter = new THREE.Vector3();
        const scaledSize = new THREE.Vector3();
        scaledBox.getCenter(scaledCenter);
        scaledBox.getSize(scaledSize);

        rawModel.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);
        rootGroup.add(rawModel);

        bounds = {
          w: scaledSize.x,
          h: scaledSize.y,
          d: scaledSize.z,
        };

        // AAA Automotive Material Shading Upgrade:
        // Converts flat, chalky GLTF materials to high-gloss clearcoat MeshPhysicalMaterial with wet reflections
        this.enhancer.enhance(rootGroup, mode, bounds);

        // Attach dynamic Snow Accumulation & Wetness shader to subject materials
        this.weatherSystem.applySnowShaderToRoot(rootGroup);

        this.subjectCache.set(item.id, { rootGroup, bounds });
      }

      if (token !== this.loadToken) return;

      // Clear previous subject and mount new subject
      while (this.subjectHolder.children.length > 0) {
        this.subjectHolder.remove(this.subjectHolder.children[0]);
      }
      this.subjectHolder.add(rootGroup);

      this.vehicleDynamics.bindSubject(rootGroup, mode, bounds);
      this.cameraDirector.setBounds(bounds, mode);

      if (this.callbacks.onLoadingChange) {
        this.callbacks.onLoadingChange({ loading: false, progress: 100, label: '' });
      }
    } catch (err) {
      console.error('Error loading 3D subject:', err);
      if (this.callbacks.onLoadingChange) {
        this.callbacks.onLoadingChange({ loading: false, progress: 0, label: 'Load Error' });
      }
    }
  }

  /**
   * Switches between Dark Void, Wind Tunnel, Outdoor World, and Procedural Studios
   */
  async setScene(sceneItem) {
    this.activeSceneId = sceneItem.id;
    this.windTunnelFan = null;

    // Clear imported location holder
    while (this.locationHolder.children.length > 0) {
      this.locationHolder.remove(this.locationHolder.children[0]);
    }

    const isOutdoor = sceneItem.type === 'outdoor';
    this.weatherSystem.setOutdoorVisible(isOutdoor);
    this.lightingRig.setActiveProceduralScene(sceneItem.id);

    if (sceneItem.type === 'glb' && sceneItem.url) {
      if (this.callbacks.onLoadingChange) {
        this.callbacks.onLoadingChange({ loading: true, progress: 0, label: sceneItem.name });
      }
      try {
        let locGroup;
        if (this.locationCache.has(sceneItem.id)) {
          locGroup = this.locationCache.get(sceneItem.id);
        } else {
          const gltf = await new Promise((resolve, reject) => {
            this.gltfLoader.load(
              sceneItem.url,
              resolve,
              (evt) => {
                if (evt.lengthComputable && this.callbacks.onLoadingChange) {
                  const pct = Math.round((evt.loaded / evt.total) * 100);
                  this.callbacks.onLoadingChange({
                    loading: true,
                    progress: pct,
                    label: sceneItem.name,
                  });
                }
              },
              reject
            );
          });

          const rawLoc = gltf.scene;

          // For the Wind Tunnel:
          if (sceneItem.id === 'wind_tunnel') {
            // Find rotating fan blade
            rawLoc.traverse((child) => {
              if (child.name === 'Elice') {
                this.windTunnelFan = child;
              }
              if (child.isMesh) {
                child.receiveShadow = true;
                if (child.material) {
                  child.material.envMapIntensity = 1.8;
                  if (child.material.roughness > 0.4) child.material.roughness = 0.35;
                }
              }
            });

            // The turntable floor 'Sol' in Blender is ALREADY at Y = 0.000!
            // We scale the tunnel chamber cleanly around the car without shifting Y
            locGroup = new THREE.Group();
            rawLoc.scale.setScalar(0.42);
            rawLoc.position.set(0, 0, 0);
            locGroup.add(rawLoc);
            this.locationCache.set(sceneItem.id, locGroup);
          } else {
            rawLoc.traverse((child) => {
              if (child.isMesh) {
                child.receiveShadow = true;
                child.castShadow = true;
                if (child.material) {
                  child.material.envMapIntensity = 1.6;
                }
              }
            });

            const box = new THREE.Box3().setFromObject(rawLoc);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);

            const maxSpan = Math.max(size.x, size.z, 0.001);
            const targetSpan = sceneItem.targetSpan || 30.0;
            const scale = targetSpan / maxSpan;

            locGroup = new THREE.Group();
            rawLoc.scale.setScalar(scale);

            const scaledBox = new THREE.Box3().setFromObject(rawLoc);
            const scaledCenter = new THREE.Vector3();
            scaledBox.getCenter(scaledCenter);

            rawLoc.position.set(-scaledCenter.x, -scaledBox.min.y - 0.02, -scaledCenter.z);
            locGroup.add(rawLoc);
            this.locationCache.set(sceneItem.id, locGroup);
          }
        }

        if (this.activeSceneId === sceneItem.id) {
          this.locationHolder.add(locGroup);
          // If wind tunnel, bind fan
          if (sceneItem.id === 'wind_tunnel') {
            locGroup.traverse((child) => {
              if (child.name === 'Elice') this.windTunnelFan = child;
            });
          }
        }
      } catch (err) {
        console.error('Failed to load location GLB:', err);
      } finally {
        if (this.callbacks.onLoadingChange) {
          this.callbacks.onLoadingChange({ loading: false, progress: 100, label: '' });
        }
      }
    }
  }

  // --- Real-Time Customization Handlers for UI ---
  setCarPaintColor(hex) {
    this.enhancer.setPaintColor(hex);
  }

  setCarPaintFinish(finish) {
    this.enhancer.setPaintFinish(finish);
  }

  setHeadlights(enabled) {
    this.enhancer.setHeadlights(enabled);
    this.vehicleDynamics.setHeadlights(enabled);
  }

  setUnderglow(enabled, colorHex) {
    this.enhancer.setUnderglow(enabled, colorHex);
  }

  setPostProcessing({ bloom, vignette, contrast, blackLevel }) {
    if (bloom !== undefined) this.pipeline.setBloom(bloom);
    if (vignette !== undefined) this.pipeline.setVignette(vignette);
    if (contrast !== undefined) this.pipeline.setContrast(contrast);
    if (blackLevel !== undefined) this.pipeline.setBlackLevel(blackLevel);
  }

  _animate() {
    if (this.disposed) return;
    requestAnimationFrame(() => this._animate());

    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    // 1. Sample Web Audio FFT & Beat-Sync if MusicEngine is bound
    if (this.musicEngine) {
      const audioSample = this.musicEngine.sampleAudioFrame();
      this.lightingRig.beatPulse = audioSample.bassPulse;
      if (audioSample.isBeatHit && this.beatCutEnabled) {
        this.cameraDirector.triggerBeatCut();
      }
      if (this.callbacks.onAudioFrame) {
        this.callbacks.onAudioFrame(audioSample);
      }
    }

    // 2. Rotate Wind Tunnel Fan if in Wind Tunnel scene
    if (this.activeSceneId === 'wind_tunnel' && this.windTunnelFan) {
      this.windTunnelFan.rotation.y += dt * 18.0;
    }

    // 3. Update Outdoor Weather & 24h Time-of-Day
    const isOutdoor = this.activeSceneId === 'outdoor_world';
    const prevLightning = this.weatherSystem.lightningFlash;
    this.weatherSystem.update(dt, this.elapsed, this.lightingRig, isOutdoor);
    if (
      isOutdoor &&
      this.weatherSystem.lightningFlash > 1.5 &&
      prevLightning <= 1.5 &&
      this.musicEngine
    ) {
      this.musicEngine.playThunderRumble();
    }

    if (isOutdoor && this.callbacks.onOutdoorTick) {
      this.callbacks.onOutdoorTick({
        timeOfDay: this.weatherSystem.timeOfDay,
        snowAccumulation: this.weatherSystem.snowAccumulation,
      });
    }

    // 4. Update Studio Lighting Rig & Streamlines
    this.lightingRig.update(dt, this.elapsed, this.vehicleDynamics.state.wheelSpin);

    // 5. Update Vehicle & Plane Live Dynamics
    this.vehicleDynamics.update(
      dt,
      this.elapsed,
      this.weatherSystem.roadTexture,
      this.activeSceneId
    );

    // 6. Update Cinematography Camera Director
    const subjectY = this.vehicleDynamics.subjectRoot
      ? this.vehicleDynamics.subjectRoot.position.y
      : 0;
    this.cameraDirector.update(dt, subjectY);

    // 7. Render with AAA Post-Processing Pipeline (Bloom + Cinematic Grading + Vignette)
    this.pipeline.render(dt);

    // 8. Capture frame into Social Media Video Exporter if recording
    if (this.videoExporter && this.videoExporter.isRecording) {
      this.videoExporter.captureFrame();
    }
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this._resizeHandler);
    this.renderer.dispose();
  }
}

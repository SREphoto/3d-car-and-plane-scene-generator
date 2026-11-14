import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { LightingRig } from './LightingRig.js';
import { VehicleDynamics } from './VehicleDynamics.js';
import { CameraDirector } from './CameraDirector.js';
import { CarMaterialEnhancer } from './CarMaterialEnhancer.js';
import { PostProcessingPipeline } from './PostProcessingPipeline.js';
import { VehicleController } from './VehicleController.js';
import { isMobileDevice, getOptimalPixelRatio } from './device.js';
import {
  STUDIO_LOOK_PRESETS,
  buildProLightingStudioStage,
  buildWarehouseCourtyardStage,
  buildCityBokehStreetStage,
} from './ProceduralStages.js';

const NIGHT_PHOTOGRAMMETRY_SCENES = new Set(['la_night_city']);
const DAY_PHOTOGRAMMETRY_SCENES = new Set([
  'canadian_downtown',
  'vatican_city',
  'building_interior_scan',
  'construction_site',
  'eglise_saint_polycarpe',
  'kent_lumber_yard',
]);
const LIVE_PROBE_PROCEDURAL_SCENES = new Set([
  'pro_lighting_studio',
  'warehouse_courtyard_day',
  'city_bokeh_street_day',
  'wet_night_bokeh_street',
]);
const CIRCUIT_TRACK_SCENES = new Set(['monaco_circuit', 'marina_bay_circuit']);

const CIRCUIT_GLASS_RE = /glass|window|visor|water|flare|glow|smoke|shadow|skid|rubber|groove|light_beam|beam|halo_vis/i;
const CIRCUIT_CUTOUT_RE = /tree|pino|forest|wood|bush|shrub|foliage|leaf|leaves|plant|palm|hedge|fence|catchfence|wire|mesh|net|grid|crowd|people|spectator|flag|banner|decal|logo|sign|lamp/i;
const CIRCUIT_SOLID_RE = /grass|terrain|ground|land|hill|mount|sand|desert|gravel|verge|bank|soil|rock|cliff|field|asph|tar|road|tracksurface|kerb|curb|wall|conc|bldg|build|garag|roof|stand|tribun|barrier|armco|tyre|tire/i;
const CIRCUIT_TERRAIN_DOUBLE_SIDE_RE = /grass|terrain|ground|land|hill|mount|sand|desert|gravel|verge|bank|soil|rock|cliff|field/i;

export class SceneManager {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;

    this.isMobile = isMobileDevice();
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      // Mobile: skip default-framebuffer MSAA + preserved buffer (composer renders offscreen and
      // VideoExporter samples the canvas synchronously right after render in the same frame).
      antialias: !this.isMobile,
      powerPreference: this.isMobile ? 'default' : 'high-performance',
      preserveDrawingBuffer: !this.isMobile,
    });
    this.renderer.setPixelRatio(getOptimalPixelRatio(2.0, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.isContextLost = false;
    this._onContextLost = (event) => {
      event.preventDefault();
      console.warn('[SceneManager] WebGL context lost.');
      this.isContextLost = true;
      if (this.callbacks.onContextLost) {
        this.callbacks.onContextLost();
      }
    };
    this._onContextRestored = () => {
      console.info('[SceneManager] WebGL context restored. Rebuilding pipeline & state.');
      this.isContextLost = false;
      this.resize();
      this._animate();
      if (this.callbacks.onContextRestored) {
        this.callbacks.onContextRestored();
      }
    };
    this.canvas.addEventListener('webglcontextlost', this._onContextLost, false);
    this.canvas.addEventListener('webglcontextrestored', this._onContextRestored, false);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#010204');

    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 3000);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 1.1;
    this.controls.maxDistance = 420;

    // GLTF + Draco + Meshopt loader
    this.gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.gltfLoader.setDRACOLoader(dracoLoader);
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    this.subjectHolder = new THREE.Group();
    this.subjectHolder.name = 'ActiveSubjectHolder';
    this.scene.add(this.subjectHolder);

    this.locationHolder = new THREE.Group();
    this.locationHolder.name = 'ImportedLocationHolder';
    this.scene.add(this.locationHolder);

    this.lightingRig = new LightingRig(this.scene, this.renderer);
    this.vehicleDynamics = new VehicleDynamics(this.scene);
    this.cameraDirector = new CameraDirector(this.camera, this.controls);
    this.cameraDirector.bindSubjectHolder(this.subjectHolder);
    this.enhancer = new CarMaterialEnhancer();
    this.pipeline = new PostProcessingPipeline(this.renderer, this.scene, this.camera);

    // Interactive 3D Vehicle Placement & Live WASD Drive/Fly Controller
    this.vehicleController = new VehicleController({
      scene: this.scene,
      camera: this.camera,
      canvas: this.canvas,
      orbitControls: this.controls,
      subjectHolder: this.subjectHolder,
      locationHolder: this.locationHolder,
      onPoseChange: (pose) => {
        this.lightingRig.updateSubjectFocus(this.subjectHolder.position);
        if (this.callbacks.onVehiclePoseChange) {
          this.callbacks.onVehiclePoseChange(pose);
        }
      },
      onProbeRefreshNeeded: (pos) => {
        this.refreshSceneReflectionProbe(pos);
      },
      onModeChange: (mode) => {
        if (this.callbacks.onTransformModeChange) {
          this.callbacks.onTransformModeChange(mode);
        }
      },
    });
    this.vehicleController.cameraDirectorAllowsOrbit = () =>
      this.cameraDirector.activeShotId === 'free_orbit';

    this.cameraDirector.onShotChangeCallback = (shotId, isSeq, clipIdx) => {
      if (this.callbacks.onShotChange) {
        this.callbacks.onShotChange(shotId, isSeq, clipIdx);
      }
    };

    this.activeSceneId = 'pro_lighting_studio';
    this.activeSceneItem = null;
    this.activeMode = 'cars';
    this.subjectCache = new Map();
    this.locationCache = new Map();
    this.proceduralStageCache = new Map();
    this.proStudioInstance = null;
    this.proStudioState = {
      presetId: 'clean_commercial',
      ...STUDIO_LOOK_PRESETS.clean_commercial,
      turntableEnabled: true,
      turntableSpeed: 0.25,
    };
    this.activeSubjectBounds = { w: 2.0, h: 1.35, d: 4.75 };
    this.lensState = {
      lensId: 'studio_wide',
      focalLengthMm: null,
      fStop: 2.8,
      dofEnabled: false,
      focusMode: 'auto', // 'auto' | 'manual'
      clickFocusArmed: false,
      manualFocusDistance: 5.5,
      bokehBoost: 1.55,
      currentFocusDistance: 5.5,
    };
    this._focusRaycaster = new THREE.Raycaster();
    this._focusNdc = new THREE.Vector2();
    this._focusCenterVec = new THREE.Vector3();
    this._focusDownPt = { x: 0, y: 0, valid: false };

    this._onFocusPointerDown = (e) => {
      if (e.button !== 0 || e.shiftKey) return;
      if (!this.lensState.clickFocusArmed && !e.altKey) return;
      this._focusDownPt = { x: e.clientX, y: e.clientY, valid: true };
    };
    this._onFocusPointerUp = (e) => {
      if (!this._focusDownPt.valid) return;
      const dx = e.clientX - this._focusDownPt.x;
      const dy = e.clientY - this._focusDownPt.y;
      this._focusDownPt.valid = false;
      if (Math.hypot(dx, dy) <= 6 && (this.lensState.clickFocusArmed || e.altKey)) {
        this.pickFocusAtClientPoint(e.clientX, e.clientY);
      }
    };
    this.canvas.addEventListener('pointerdown', this._onFocusPointerDown);
    this.canvas.addEventListener('pointerup', this._onFocusPointerUp);

    this.loadToken = 0;
    this.sceneLoadToken = 0;
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

  _getMaxAniso() {
    const hw = this.renderer.capabilities.getMaxAnisotropy();
    return this.isMobile ? Math.min(2, hw) : hw;
  }

  /**
   * Mobile GPU memory guard: GLB assets often embed 4K/8K textures (64-256 MB each once decoded).
   * Downscale every texture image larger than MOBILE_MAX_TEX on the CPU before first GPU upload.
   */
  _optimizeTexturesForMobile(root) {
    if (!this.isMobile || !root) return;
    const MOBILE_MAX_TEX = 1024;
    const seen = new Set();
    root.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (!mat) continue;
        for (const key of Object.keys(mat)) {
          const tex = mat[key];
          if (!tex || !tex.isTexture || seen.has(tex)) continue;
          seen.add(tex);
          tex.anisotropy = Math.min(tex.anisotropy || 1, 2);
          const img = tex.image;
          const iw = img && (img.width || img.videoWidth);
          const ih = img && (img.height || img.videoHeight);
          if (!iw || !ih || Math.max(iw, ih) <= MOBILE_MAX_TEX) continue;
          if (tex.isDataTexture || tex.isCompressedTexture) continue;
          try {
            const s = MOBILE_MAX_TEX / Math.max(iw, ih);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(iw * s));
            canvas.height = Math.max(1, Math.round(ih * s));
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            if (typeof img.close === 'function') img.close(); // free ImageBitmap memory
            tex.image = canvas;
            tex.needsUpdate = true;
          } catch (err) {
            console.warn('[SceneManager] Mobile texture downscale skipped:', err);
          }
        }
      }
    });
  }

  _disposeObjectTree(root) {
    if (!root) return;
    root.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (!child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (!mat) continue;
        for (const key of Object.keys(mat)) {
          const v = mat[key];
          if (v && v.isTexture) v.dispose();
        }
        mat.dispose();
      }
    });
  }

  /** On mobile keep only the active subject/location resident in memory. */
  _evictMobileCache(cache, keepId, getRoot) {
    if (!this.isMobile) return;
    for (const [id, entry] of cache) {
      if (id === keepId) continue;
      const root = getRoot(entry);
      if (root?.parent) root.parent.remove(root);
      this._disposeObjectTree(root);
      cache.delete(id);
    }
  }

  refreshSceneReflectionProbe(pos = this.subjectHolder.position) {
    if (isMobileDevice() || !this.lightingRig) return;
    const shouldCapture =
      (this.activeSceneItem && this.activeSceneItem.type === 'glb') ||
      LIVE_PROBE_PROCEDURAL_SCENES.has(this.activeSceneId);
    if (shouldCapture) {
      this.lightingRig.captureSceneProbe(pos, [
        this.subjectHolder,
        this.vehicleController?.helper,
        this.vehicleDynamics?.fxGroup,
      ]);
    }
  }

  /**
   * Loads, normalizes, and enhances a Car, Plane, or Part GLB model
   */
  async loadSubject(item, mode = 'cars') {
    this.activeMode = mode;
    this.vehicleController.setSubjectType(mode);
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
        // Re-bind enhancer references to cached rootGroup materials so paint/headlight controls apply to active vehicle
        this.enhancer.enhance(rootGroup, mode, bounds);
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
        this._optimizeTexturesForMobile(rawModel);

        // Strip stray backdrop/shadow-catcher floor planes, collision hulls, or hitboxes baked into Sketchfab exports
        rawModel.traverse((child) => {
          if (child.isMesh) {
            const mName = (child.name || '').toLowerCase();
            const pName = (child.parent?.name || '').toLowerCase();
            const matName = (child.material?.name || '').toLowerCase();
            if (
              mName.includes('ground_ao') ||
              matName.includes('ground_ao') ||
              mName.includes('groundshadow') ||
              pName.includes('groundshadow') ||
              mName.includes('shadow_plane') ||
              mName.includes('floor_plane') ||
              mName.includes('convcolonly') ||
              mName.includes('collision') ||
              mName.includes('hitbox') ||
              mName.includes('bounding') ||
              mName.includes('ucx_') ||
              mName.includes('ubx_') ||
              mName === 'icosphere' ||
              mName.startsWith('icosphere.') ||
              pName === 'icosphere' ||
              matName.includes('f14_lights') ||
              (mode === 'planes' && mName === 'lights')
            ) {
              child.visible = false;
            }
          }
        });

        // Orientation normalization
        if (item.modelRotation) {
          if (item.rotationOrder) rawModel.rotation.order = item.rotationOrder;
          rawModel.rotation.set(
            item.modelRotation[0] || 0,
            item.modelRotation[1] || 0,
            item.modelRotation[2] || 0
          );
          rawModel.updateMatrixWorld(true);
        } else if (mode === 'cars') {
          const testBox = new THREE.Box3().setFromObject(rawModel);
          const testSize = new THREE.Vector3();
          testBox.getSize(testSize);

          if (testSize.y > testSize.z * 1.25 && testSize.y > testSize.x * 1.25) {
            rawModel.rotation.x = -Math.PI / 2;
            rawModel.updateMatrixWorld(true);
          } else if (testSize.x > testSize.z * 1.25 && testSize.x > testSize.y * 1.25) {
            rawModel.rotation.y = Math.PI / 2;
            rawModel.updateMatrixWorld(true);
          }
        } else if (mode === 'planes') {
          const testBox = new THREE.Box3().setFromObject(rawModel);
          const testSize = new THREE.Vector3();
          testBox.getSize(testSize);
          if (testSize.x > testSize.z * 1.35) {
            rawModel.rotation.y = Math.PI / 2;
            rawModel.updateMatrixWorld(true);
          }
        }

        // Compute visible bounding box ONLY (ignoring hidden GroundShadow / collision meshes!)
        const box = new THREE.Box3();
        const meshBox = new THREE.Box3();
        rawModel.updateMatrixWorld(true);
        rawModel.traverse((c) => {
          if (c.isMesh && c.visible && c.geometry) {
            c.geometry.computeBoundingBox();
            if (c.geometry.boundingBox) {
              meshBox.copy(c.geometry.boundingBox).applyMatrix4(c.matrixWorld);
              box.union(meshBox);
            }
          }
        });
        if (box.isEmpty()) {
          box.setFromObject(rawModel);
        }

        const size = new THREE.Vector3();
        box.getSize(size);

        const maxHoriz = Math.max(size.x, size.z, 0.001);
        const targetSpan = item.targetSize || (mode === 'planes' ? 25.0 : mode === 'parts' ? 0.65 : 4.75);
        const scale = targetSpan / maxHoriz;

        rootGroup = new THREE.Group();
        rawModel.scale.setScalar(scale);
        rawModel.updateMatrixWorld(true);

        const scaledBox = new THREE.Box3();
        rawModel.traverse((c) => {
          if (c.isMesh && c.visible && c.geometry?.boundingBox) {
            meshBox.copy(c.geometry.boundingBox).applyMatrix4(c.matrixWorld);
            scaledBox.union(meshBox);
          }
        });
        if (scaledBox.isEmpty()) {
          scaledBox.setFromObject(rawModel);
        }

        const scaledCenter = new THREE.Vector3();
        const scaledSize = new THREE.Vector3();
        scaledBox.getCenter(scaledCenter);
        scaledBox.getSize(scaledSize);

        // Ground vehicle bottom flush at Y = 0.000 and center horizontally at (0, 0)
        rawModel.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);
        rootGroup.add(rawModel);

        bounds = {
          w: scaledSize.x,
          h: scaledSize.y,
          d: scaledSize.z,
        };

        this.enhancer.enhance(rootGroup, mode, bounds);
        this.subjectCache.set(item.id, { rootGroup, bounds });
      }

      if (token !== this.loadToken) return;

      this._evictMobileCache(this.subjectCache, item.id, (e) => e.rootGroup);

      while (this.subjectHolder.children.length > 0) {
        this.subjectHolder.remove(this.subjectHolder.children[0]);
      }
      this.subjectHolder.add(rootGroup);

      // Hide ground contact shadow when flying high in Cloud Deck
      const isCloudFlight = this.activeSceneId === 'cloud_deck';
      const activeProfile = this.lightingRig ? undefined : null;
      this.enhancer.setGroundContactVisible(
        !isCloudFlight,
        this.activeSceneShadowOpacity ?? 0.44
      );

      if (mode === 'cars' && this.vehicleController.snapToGround) {
        this.vehicleController.snapSubjectToGround();
      }

      const modeChanged = this.currentMode !== mode;
      this.currentMode = mode;
      this.activeSubjectBounds = bounds;
      this.vehicleDynamics.bindSubject(rootGroup, mode, bounds, this.subjectHolder);
      this.cameraDirector.setBounds(bounds, mode);
      if (modeChanged) {
        this.cameraDirector.resetToHeroIso();
      }
      this.lightingRig.updateSubjectFocus(this.subjectHolder.position);

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
   * Switches between 3D GLB Cities/Garages, and Procedural Cinema Stages
   */
  async setScene(sceneItem) {
    this.activeSceneId = sceneItem.id;
    this.activeSceneItem = sceneItem;
    const sToken = ++this.sceneLoadToken;
    this.windTunnelFan = null;

    while (this.locationHolder.children.length > 0) {
      this.locationHolder.remove(this.locationHolder.children[0]);
    }

    const appliedProfile = this.lightingRig.setActiveProceduralScene(sceneItem.id);
    this.activeSceneShadowOpacity = appliedProfile?.shadowCatcherOpacity ?? 0.42;

    this.enhancer.setGroundContactVisible(
      sceneItem.id !== 'cloud_deck',
      this.activeSceneShadowOpacity
    );

    if (this.callbacks.onSceneLightingSync && appliedProfile) {
      this.callbacks.onSceneLightingSync(this.lightingRig.state);
    }

    // Reset vehicle to scene's hero staging point when changing scenes
    const spawn = sceneItem.spawn || { x: 0, y: 0, z: 0, yaw: 0 };
    this.subjectHolder.position.set(spawn.x || 0, spawn.y || 0, spawn.z || 0);
    this.subjectHolder.rotation.set(0, spawn.yaw || 0, 0);
    this.lightingRig.updateSubjectFocus(this.subjectHolder.position);

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
          this._optimizeTexturesForMobile(rawLoc);

          if (sceneItem.id === 'wind_tunnel') {
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
            locGroup = new THREE.Group();
            rawLoc.scale.setScalar(0.42);
            rawLoc.position.set(0, 0, 0);
            locGroup.add(rawLoc);
          } else if (sceneItem.id === 'interior_7') {
            rawLoc.traverse((child) => {
              if (child.isMesh) {
                child.receiveShadow = true;
                child.castShadow = true;
                if (child.material) {
                  child.material.envMapIntensity = 1.8;
                  const mName = (child.name || '').toLowerCase();
                  const matName = (child.material?.name || '').toLowerCase();
                  if (mName === 'plane' || matName.includes('material.001')) {
                    child.material.roughness = 0.16;
                    child.material.metalness = 0.2;
                    child.material.envMapIntensity = 2.2;
                  }
                  if (
                    mName.includes('plane.004') ||
                    mName.includes('cube029') ||
                    mName.includes('cube030') ||
                    matName.includes('material.029') ||
                    matName.includes('material.003')
                  ) {
                    child.material.transparent = true;
                    child.material.opacity = 0.22;
                    child.material.roughness = 0.02;
                    child.material.metalness = 0.1;
                    child.material.depthWrite = false;
                  }
                }
              }
            });
            locGroup = new THREE.Group();
            rawLoc.scale.setScalar(1.65);
            rawLoc.position.set(-0.74, 0.0, 3.63);
            locGroup.add(rawLoc);
          } else if (sceneItem.id === 'car_garage') {
            rawLoc.traverse((child) => {
              if (child.isMesh) {
                child.receiveShadow = true;
                child.castShadow = true;
                if (child.material) {
                  child.material.envMapIntensity = 1.2;
                  if (child.name === 'Cube_3') {
                    child.material.roughness = 0.52;
                    child.material.metalness = 0.1;
                  }
                }
              }
            });
            locGroup = new THREE.Group();
            rawLoc.scale.setScalar(1.55);
            rawLoc.position.set(1.908, 0.0, 0.0);
            locGroup.add(rawLoc);
          } else if (sceneItem.id === 'abandoned_vr_gallery') {
            rawLoc.traverse((child) => {
              if (child.isMesh) {
                child.receiveShadow = true;
                child.castShadow = true;
                if (child.material) {
                  const oldMat = child.material;
                  if (oldMat.map) oldMat.map.colorSpace = THREE.SRGBColorSpace;
                  child.material = new THREE.MeshStandardMaterial({
                    map: oldMat.map || null,
                    roughness: 0.88,
                    metalness: 0.04,
                    envMapIntensity: 0.4,
                  });
                }
              }
            });
            locGroup = new THREE.Group();
            rawLoc.scale.setScalar(1.15);
            rawLoc.position.set(-5.6, 0.0, 8.56);
            locGroup.add(rawLoc);
          } else if (NIGHT_PHOTOGRAMMETRY_SCENES.has(sceneItem.id)) {
            // Hybrid Night Photogrammetry Shader:
            // Preserves self-luminous skyscraper windows & streetlamps via emissiveMap while
            // allowing street asphalt to receive real car headlights, taillights, and shadows!
            rawLoc.traverse((child) => {
              if (!child.isMesh) return;
              child.receiveShadow = true;
              child.castShadow = false;
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              const upgraded = mats.map((m) => {
                if (!m) return m;
                if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
                return new THREE.MeshStandardMaterial({
                  map: m.map || null,
                  emissive: new THREE.Color('#ffffff'),
                  emissiveMap: m.map || null,
                  emissiveIntensity: 0.76,
                  roughness: 0.78,
                  metalness: 0.08,
                  envMapIntensity: 0.35,
                });
              });
              child.material = Array.isArray(child.material) ? upgraded : upgraded[0];
            });
            locGroup = new THREE.Group();
            const s = sceneItem.sceneScale || 1.0;
            rawLoc.scale.setScalar(s);
            if (sceneItem.sceneOffset) {
              rawLoc.position.set(...sceneItem.sceneOffset);
            }
            locGroup.add(rawLoc);
          } else if (DAY_PHOTOGRAMMETRY_SCENES.has(sceneItem.id)) {
            // Sketchfab Shadeless / Unlit Photogrammetry Pipeline + 16x Anisotropic Filtering:
            // Preserves 100% of baked 8K photo sharpness, mortar contrast, and real-world shadows
            // without artificial directional-light washout, while VehicleDirectionalShadowCatcher
            // and VehicleContactAOShadow ground the vehicle onto the cobblestones/asphalt.
            const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
            rawLoc.traverse((child) => {
              if (!child.isMesh) return;
              child.receiveShadow = false;
              child.castShadow = false;
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              const upgraded = mats.map((m) => {
                if (!m) return m;
                const tex = m.map || m.emissiveMap || null;
                if (tex) {
                  tex.colorSpace = THREE.SRGBColorSpace;
                  tex.anisotropy = maxAniso;
                  tex.minFilter = THREE.LinearMipmapLinearFilter;
                  tex.magFilter = THREE.LinearFilter;
                  tex.generateMipmaps = true;
                  tex.needsUpdate = true;
                }
                return new THREE.MeshBasicMaterial({
                  map: tex,
                  // Gentle 1.05 linear boost compensates for OutputPass ACES Filmic rolloff
                  // so sunlit travertine & stone match Sketchfab's exact unlit brightness
                  color: tex ? new THREE.Color(1.05, 1.05, 1.05) : (m.color || new THREE.Color('#cccccc')),
                });
              });
              child.material = Array.isArray(child.material) ? upgraded : upgraded[0];
            });
            locGroup = new THREE.Group();
            const s = sceneItem.sceneScale || 1.0;
            rawLoc.scale.setScalar(s);
            if (sceneItem.sceneOffset) {
              rawLoc.position.set(...sceneItem.sceneOffset);
            }
            locGroup.add(rawLoc);
          } else if (CIRCUIT_TRACK_SCENES.has(sceneItem.id)) {
            // FIA Street Circuit Pipeline (Monaco & Singapore Marina Bay):
            // Repairs Assetto Corsa specular-in-alpha BLEND flags so roads, kerbs, and buildings
            // render crisp & opaque while palm trees, catchfences, and spectator crowds keep clean alpha cutouts.
            let alphaProbeCtx = null;
            const alphaDecisionCache = new WeakMap();
            const classifyMatAlpha = (mat) => {
              if (!mat) return 'opaque';
              if (alphaDecisionCache.has(mat)) return alphaDecisionCache.get(mat);
              let decision = 'unknown';
              const img = mat.map?.image;
              if (img && typeof document !== 'undefined') {
                try {
                  if (!alphaProbeCtx) {
                    const cv = document.createElement('canvas');
                    cv.width = 32;
                    cv.height = 32;
                    alphaProbeCtx = cv.getContext('2d', { willReadFrequently: true });
                  }
                  const w = img.width || img.videoWidth || 0;
                  if (alphaProbeCtx && w > 0) {
                    alphaProbeCtx.clearRect(0, 0, 32, 32);
                    alphaProbeCtx.drawImage(img, 0, 0, 32, 32);
                    const px = alphaProbeCtx.getImageData(0, 0, 32, 32).data;
                    let minA = 255;
                    let maxA = 0;
                    let zeroCount = 0;
                    for (let p = 3; p < px.length; p += 4) {
                      const a = px[p];
                      if (a < minA) minA = a;
                      if (a > maxA) maxA = a;
                      if (a < 24) zeroCount++;
                    }
                    const zeroRatio = zeroCount / 1024;
                    decision =
                      minA < 24 && maxA > 200 && zeroRatio >= 0.01 && zeroRatio <= 0.96
                        ? 'cutout'
                        : 'opaque';
                  }
                } catch {
                  // ImageBitmap / GPU texture fallback
                }
              } else {
                decision = 'opaque';
              }
              alphaDecisionCache.set(mat, decision);
              return decision;
            };

            const seenMat = new Set();
            let minLocalY = 0;
            rawLoc.traverse((child) => {
              if (!child.isMesh) return;
              child.receiveShadow = true;
              child.castShadow = false;
              const parentName = child.parent?.name || '';
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((m) => {
                if (!m || seenMat.has(m)) return;
                seenMat.add(m);
                if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
                m.envMapIntensity = sceneItem.id === 'marina_bay_circuit' ? 0.95 : 1.05;
                const matLabel = `${m.name || ''} ${child.name || ''}`;
                if (
                  m.transparent &&
                  (m.opacity === undefined || m.opacity >= 0.9) &&
                  !CIRCUIT_GLASS_RE.test(matLabel)
                ) {
                  const fullLabel = `${matLabel} ${parentName}`;
                  if (CIRCUIT_CUTOUT_RE.test(fullLabel)) {
                    m.transparent = false;
                    m.depthWrite = true;
                    m.alphaTest = 0.35;
                    m.side = THREE.DoubleSide;
                  } else if (CIRCUIT_SOLID_RE.test(fullLabel)) {
                    m.transparent = false;
                    m.depthWrite = true;
                    m.alphaTest = 0;
                  } else {
                    const kind = classifyMatAlpha(m);
                    m.transparent = false;
                    m.depthWrite = true;
                    if (kind === 'cutout' || kind === 'unknown') {
                      m.alphaTest = kind === 'cutout' ? 0.35 : 0.12;
                      m.side = THREE.DoubleSide;
                    } else {
                      m.alphaTest = 0;
                    }
                  }
                  m.needsUpdate = true;
                }
                if (CIRCUIT_TERRAIN_DOUBLE_SIDE_RE.test(matLabel)) {
                  m.side = THREE.DoubleSide;
                  m.needsUpdate = true;
                }
              });
              if (child.geometry) {
                child.geometry.computeBoundingBox?.();
                const bb = child.geometry.boundingBox;
                if (bb && Number.isFinite(bb.min.y)) {
                  minLocalY = Math.min(minLocalY, bb.min.y);
                }
              }
            });

            locGroup = new THREE.Group();
            const s = sceneItem.sceneScale || 1.0;
            rawLoc.scale.setScalar(s);
            if (sceneItem.sceneRotation) {
              rawLoc.rotation.set(...sceneItem.sceneRotation);
            }
            if (sceneItem.sceneOffset) {
              rawLoc.position.set(...sceneItem.sceneOffset);
            }
            locGroup.add(rawLoc);

            // Subtle biome horizon underlay safely below lowest circuit mesh
            const underlayGeo = new THREE.PlaneGeometry(6000, 6000);
            underlayGeo.rotateX(-Math.PI / 2);
            const underlayMat = new THREE.MeshStandardMaterial({
              color: sceneItem.id === 'marina_bay_circuit' ? 0x0b101b : 0x222d2a,
              roughness: 0.96,
              metalness: 0.0,
            });
            const underlay = new THREE.Mesh(underlayGeo, underlayMat);
            underlay.position.y = (sceneItem.sceneOffset?.[1] || 0) + minLocalY * s - 2.0;
            locGroup.add(underlay);
          } else if (sceneItem.calibrated) {
            // Pre-calibrated 1:1 metric scenes (F1 garages, parking garage, collector showroom, hangars)
            const isTonedGarage =
              sceneItem.id === 'red_bull_f1_garage' || sceneItem.id === 'detailed_parking_garage';
            const seenGarageMats = new Set();
            rawLoc.traverse((child) => {
              if (child.isMesh) {
                child.receiveShadow = true;
                child.castShadow = true;
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach((m) => {
                  if (!m || seenGarageMats.has(m)) return;
                  seenGarageMats.add(m);
                  if (m.map) {
                    m.map.colorSpace = THREE.SRGBColorSpace;
                  }
                  if (isTonedGarage) {
                    m.envMapIntensity = 0.55;
                    // Prevent pure-white untextured plaster/ceiling panels from blowing out under ACES
                    if (!m.map && m.color) {
                      const lum = m.color.r * 0.2126 + m.color.g * 0.7152 + m.color.b * 0.0722;
                      if (lum > 0.68) {
                        m.color.multiplyScalar(0.66);
                      }
                    }
                    if (m.emissiveIntensity !== undefined && m.emissiveIntensity > 1.8) {
                      m.emissiveIntensity = 1.8;
                    }
                  } else {
                    m.envMapIntensity = 1.12;
                  }
                });
              }
            });
            locGroup = new THREE.Group();
            const s = sceneItem.sceneScale || 1.0;
            rawLoc.scale.setScalar(s);
            if (sceneItem.sceneRotation) {
              rawLoc.rotation.set(...sceneItem.sceneRotation);
            }
            if (sceneItem.sceneOffset) {
              rawLoc.position.set(...sceneItem.sceneOffset);
            }
            locGroup.add(rawLoc);
          } else {
            rawLoc.traverse((child) => {
              if (child.isMesh) {
                child.receiveShadow = true;
                child.castShadow = true;
                if (child.material) {
                  child.material.envMapIntensity = 1.0;
                }
              }
            });

            const box = new THREE.Box3().setFromObject(rawLoc);
            const size = new THREE.Vector3();
            box.getSize(size);
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
          }

          const maxSceneAniso = this.renderer.capabilities.getMaxAnisotropy();
          locGroup.traverse((c) => {
            if (!c.isMesh || !c.material) return;
            const ms = Array.isArray(c.material) ? c.material : [c.material];
            for (const mat of ms) {
              for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) {
                if (mat && mat[k] && mat[k].anisotropy < maxSceneAniso) {
                  mat[k].anisotropy = maxSceneAniso;
                  mat[k].needsUpdate = true;
                }
              }
            }
          });

          this.locationCache.set(sceneItem.id, locGroup);
        }

        if (sToken === this.sceneLoadToken && this.activeSceneId === sceneItem.id) {
          this._evictMobileCache(this.locationCache, sceneItem.id, (g) => g);
          this.locationHolder.add(locGroup);
          locGroup.updateMatrixWorld(true);

          if (sceneItem.id === 'wind_tunnel') {
            locGroup.traverse((child) => {
              if (child.name === 'Elice') this.windTunnelFan = child;
            });
          }

          // Snap vehicle onto exact road/floor height at spawn, then capture real 360° scene IBL probe!
          if (this.activeMode === 'cars' && this.vehicleController.snapToGround) {
            this.vehicleController.snapSubjectToGround();
          }
          this.lightingRig.updateSubjectFocus(this.subjectHolder.position);
          this.refreshSceneReflectionProbe(this.subjectHolder.position);
          this.cameraDirector.setSceneId(sceneItem.id);
          this.vehicleController._emitPose();
        }
      } catch (err) {
        console.error('Failed to load location GLB:', err);
      } finally {
        if (this.callbacks.onLoadingChange) {
          this.callbacks.onLoadingChange({ loading: false, progress: 100, label: '' });
        }
      }
    } else {
      // High-DPI Procedural Stages (Pro Cyclorama Studio, Day Brick Warehouse, Day/Wet-Night Bokeh Street)
      if (sceneItem.id === 'pro_lighting_studio') {
        if (!this.proStudioInstance) {
          this.proStudioInstance = buildProLightingStudioStage(this.renderer, this.proStudioState);
        } else {
          this.proStudioInstance.applyStudioState(this.proStudioState);
        }
        this.proStudioInstance.turntableGroup.rotation.y = this.subjectHolder.rotation.y;
        this.locationHolder.add(this.proStudioInstance.group);
        this.proStudioInstance.group.updateMatrixWorld(true);
      } else if (
        sceneItem.id === 'warehouse_courtyard_day' ||
        sceneItem.id === 'city_bokeh_street_day' ||
        sceneItem.id === 'wet_night_bokeh_street'
      ) {
        let stageObj = this.proceduralStageCache.get(sceneItem.id);
        if (!stageObj) {
          if (sceneItem.id === 'warehouse_courtyard_day') {
            stageObj = buildWarehouseCourtyardStage(this.renderer);
          } else {
            stageObj = buildCityBokehStreetStage(this.renderer, {
              isNight: sceneItem.id === 'wet_night_bokeh_street',
            });
          }
          this.proceduralStageCache.set(sceneItem.id, stageObj);
        }
        this.locationHolder.add(stageObj.group);
        stageObj.group.updateMatrixWorld(true);
      }

      if (this.activeMode === 'cars' && this.vehicleController.snapToGround) {
        this.vehicleController.snapSubjectToGround();
      }
      this.lightingRig.updateSubjectFocus(this.subjectHolder.position);
      this.refreshSceneReflectionProbe(this.subjectHolder.position);
      this.cameraDirector.setSceneId(sceneItem.id);
      this.vehicleController._emitPose();
    }
  }

  // --- Pro Cyclorama Lighting Studio Controls ---
  setProStudioState(patch = {}) {
    this.proStudioState = {
      ...this.proStudioState,
      ...patch,
    };
    if (this.proStudioInstance) {
      this.proStudioInstance.applyStudioState(this.proStudioState);
      if (this.activeSceneId === 'pro_lighting_studio') {
        this.refreshSceneReflectionProbe(this.subjectHolder.position);
      }
    }
    return { ...this.proStudioState };
  }

  applyProStudioPreset(presetId) {
    const preset = STUDIO_LOOK_PRESETS[presetId];
    if (!preset) return { ...this.proStudioState };
    return this.setProStudioState({
      presetId,
      ...preset,
    });
  }

  getProStudioState() {
    return { ...this.proStudioState };
  }

  // --- Physical Camera Lenses & Linear-HDR Optical Bokeh DoF ---
  setLensAndDof(patch = {}, options = { autoDolly: true }) {
    const prevFocal = this.lensState.focalLengthMm;
    this.lensState = {
      ...this.lensState,
      ...patch,
    };

    if ('focalLengthMm' in patch && patch.focalLengthMm !== prevFocal) {
      this.cameraDirector.setPhysicalLens(patch.focalLengthMm, {
        autoDolly: options.autoDolly !== false,
      });
    }

    const effFocal = this.lensState.focalLengthMm || 31;
    const focusDist =
      this.lensState.focusMode === 'manual'
        ? this.lensState.manualFocusDistance
        : this._computeAutoFocusDistance();
    this.lensState.currentFocusDistance = Number(focusDist.toFixed(2));

    this.pipeline.setDofConfig({
      enabled: Boolean(this.lensState.dofEnabled),
      focalLengthMm: effFocal,
      fStop: this.lensState.fStop,
      focusDistance: focusDist,
      bokehBoost: this.lensState.bokehBoost,
    });

    if (this.callbacks.onDofChange) {
      this.callbacks.onDofChange({ ...this.lensState });
    }
    return { ...this.lensState };
  }

  getLensAndDofState() {
    return { ...this.lensState };
  }

  _computeAutoFocusDistance() {
    const b = this.activeSubjectBounds || { w: 2.0, h: 1.35, d: 4.75 };
    this._focusCenterVec.set(
      this.subjectHolder.position.x,
      this.subjectHolder.position.y + b.h * 0.42,
      this.subjectHolder.position.z
    );
    const centerDist = this.camera.position.distanceTo(this._focusCenterVec);
    // Focus slightly forward toward the camera-facing bodywork/headlight/badge so front 3/4 hero details stay tack-sharp
    const frontBias = Math.min(Math.max(b.d * 0.16, 0.25), 1.35);
    return Math.max(0.45, centerDist - frontBias);
  }

  pickFocusAtClientPoint(clientX, clientY) {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    return this.pickFocusAtNormalizedPoint(ndcX, ndcY);
  }

  pickFocusAtNormalizedPoint(ndcX, ndcY) {
    this._focusNdc.set(ndcX, ndcY);
    this._focusRaycaster.setFromCamera(this._focusNdc, this.camera);
    const candidates = [this.subjectHolder, this.locationHolder].filter(Boolean);
    const hits = this._focusRaycaster.intersectObjects(candidates, true);
    const hit = hits.find(
      (h) =>
        h.object &&
        h.object.visible &&
        h.distance >= 0.35 &&
        h.distance <= 450 &&
        h.object.name !== 'VehicleContactAOShadow' &&
        h.object.name !== 'VehicleDirectionalShadowCatcher'
    );
    if (!hit) return null;

    const pickedDist = Number(hit.distance.toFixed(2));
    this.setLensAndDof(
      {
        dofEnabled: true,
        focusMode: 'manual',
        manualFocusDistance: pickedDist,
        currentFocusDistance: pickedDist,
      },
      { autoDolly: false }
    );
    return {
      distance: pickedDist,
      point: hit.point.clone(),
      objectName: hit.object.name || 'surface',
    };
  }

  applySceneFilmPreset(presetId) {
    this.lightingRig.applySceneFilmPreset(presetId);
    if (this.callbacks.onSceneLightingSync) {
      this.callbacks.onSceneLightingSync({ ...this.lightingRig.state });
    }
  }

  // --- Vehicle Placement & Driving API for UI ---
  setTransformMode(mode) {
    this.vehicleController.setMode(mode);
  }

  resetVehiclePose() {
    const spawn = this.activeSceneItem?.spawn || { x: 0, y: 0, z: 0, yaw: 0 };
    this.vehicleController.resetPose(spawn);
    this.cameraDirector.resetToHeroIso();
  }

  setSnapToGround(enabled) {
    this.vehicleController.setSnapToGround(enabled);
  }

  setAlignToSlope(enabled) {
    this.vehicleController.setAlignToSlope(enabled);
  }

  setVehiclePose(pose) {
    this.vehicleController.setPose(pose);
  }

  // --- Real-Time Customization Handlers for UI ---
  setCarPaintColor(hex) {
    this.enhancer.setPaintColor(hex);
  }

  resetFactoryPaint() {
    this.enhancer.resetFactoryPaint();
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
    if (this.disposed || this.isContextLost) return;
    requestAnimationFrame(() => this._animate());

    const dt = Math.min(0.05, this.clock.getDelta());
    this.elapsed += dt;

    const isRecording = Boolean(this.videoExporter && this.videoExporter.isRecording);
    if (this.vehicleController.recordingSuppressed !== isRecording) {
      this.vehicleController.setRecordingSuppressed(isRecording);
    }

    // 1. Sample Web Audio FFT & Beat-Sync
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

    // 2. Rotate Wind Tunnel Fan & Pro Cyclorama Motorized Turntable
    if (this.activeSceneId === 'wind_tunnel' && this.windTunnelFan) {
      this.windTunnelFan.rotateX(-dt * 22.0);
    }
    if (
      this.activeSceneId === 'pro_lighting_studio' &&
      this.proStudioState.turntableEnabled &&
      this.proStudioState.turntableSpeed > 0 &&
      this.vehicleController.mode !== 'drive'
    ) {
      this.subjectHolder.rotation.y =
        (this.subjectHolder.rotation.y + dt * this.proStudioState.turntableSpeed) % (Math.PI * 2);
      if (this.proStudioInstance?.turntableGroup) {
        this.proStudioInstance.turntableGroup.rotation.y = this.subjectHolder.rotation.y;
      }
    }

    // 3. Update Live WASD Vehicle Driving / Flying
    this.vehicleController.update(dt);

    // 5. Update Studio Lighting Rig
    this.lightingRig.update(dt, this.elapsed, this.vehicleDynamics.state.wheelSpin);

    // 6. Update Vehicle & Plane Live Dynamics
    this.vehicleDynamics.update(
      dt,
      this.elapsed,
      null,
      this.activeSceneId,
      this.vehicleController.speed
    );

    // 7. Update Cinematography Camera Director (locked to movable subjectHolder!)
    const subjectBobY = this.vehicleDynamics.subjectRoot
      ? this.vehicleDynamics.subjectRoot.position.y
      : 0;
    this.cameraDirector.update(dt, subjectBobY);

    // 7b. Real-Time Subject-Tracking Auto-Focus for Optical Bokeh Lens
    if (this.lensState.dofEnabled && this.lensState.focusMode === 'auto') {
      const autoDist = this._computeAutoFocusDistance();
      this.lensState.currentFocusDistance = Number(autoDist.toFixed(2));
      this.pipeline.setDofConfig({ focusDistance: autoDist });
    }

    // 8. Render with AAA Post-Processing Pipeline (Linear-HDR Bokeh -> Bloom -> ACES -> Film Grade)
    this.pipeline.render(dt);

    // 9. Capture frame into Social Media Video Exporter if recording (gizmo guaranteed hidden!)
    if (isRecording) {
      this.videoExporter.captureFrame();
    }
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this._resizeHandler);
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this._onFocusPointerDown);
      this.canvas.removeEventListener('pointerup', this._onFocusPointerUp);
      if (this._onContextLost) {
        this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
      }
      if (this._onContextRestored) {
        this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored);
      }
    }
    this.pipeline.dispose();
    this.vehicleController.dispose();
    this.renderer.dispose();
  }
}

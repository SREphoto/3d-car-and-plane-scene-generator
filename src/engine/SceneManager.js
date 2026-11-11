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
import { VehicleController } from './VehicleController.js';

const NIGHT_PHOTOGRAMMETRY_SCENES = new Set(['la_night_city']);
const DAY_PHOTOGRAMMETRY_SCENES = new Set([
  'canadian_downtown',
  'vatican_city',
  'building_interior_scan',
  'construction_site',
  'eglise_saint_polycarpe',
  'kent_lumber_yard',
]);

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
    this.renderer.toneMappingExposure = 1.04;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#010204');

    this.camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 3000);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.minDistance = 1.1;
    this.controls.maxDistance = 420;

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

    this.activeSceneId = 'interior_7';
    this.activeSceneItem = null;
    this.activeMode = 'cars';
    this.subjectCache = new Map();
    this.locationCache = new Map();
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

  refreshSceneReflectionProbe(pos = this.subjectHolder.position) {
    if (!this.lightingRig) return;
    if (this.activeSceneItem && this.activeSceneItem.type === 'glb') {
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
        this.weatherSystem.applySnowShaderToRoot(rootGroup);
        this.subjectCache.set(item.id, { rootGroup, bounds });
      }

      if (token !== this.loadToken) return;

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
   * Switches between 3D GLB Cities/Garages, Outdoor Weather World, and Procedural Cinema Stages
   */
  async setScene(sceneItem) {
    this.activeSceneId = sceneItem.id;
    this.activeSceneItem = sceneItem;
    const sToken = ++this.sceneLoadToken;
    this.windTunnelFan = null;

    while (this.locationHolder.children.length > 0) {
      this.locationHolder.remove(this.locationHolder.children[0]);
    }

    const isOutdoor = sceneItem.type === 'outdoor';
    this.weatherSystem.setOutdoorVisible(isOutdoor);
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
          } else if (sceneItem.calibrated) {
            // Pre-calibrated 1:1 metric scenes (F1 garages, repaired hangars/halls)
            rawLoc.traverse((child) => {
              if (child.isMesh) {
                child.receiveShadow = true;
                child.castShadow = true;
                if (child.material) {
                  if (child.material.map) {
                    child.material.map.colorSpace = THREE.SRGBColorSpace;
                  }
                  child.material.envMapIntensity = 1.15;
                }
              }
            });
            locGroup = new THREE.Group();
            const s = sceneItem.sceneScale || 1.0;
            rawLoc.scale.setScalar(s);
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
      this.cameraDirector.setSceneId(sceneItem.id);
      this.vehicleController._emitPose();
    }
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
    if (this.disposed) return;
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

    // 2. Rotate Wind Tunnel Fan
    if (this.activeSceneId === 'wind_tunnel' && this.windTunnelFan) {
      this.windTunnelFan.rotateX(-dt * 22.0);
    }

    // 3. Update Live WASD Vehicle Driving / Flying
    this.vehicleController.update(dt);

    // 4. Update Outdoor Weather & 24h Time-of-Day
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

    // 5. Update Studio Lighting Rig
    this.lightingRig.update(dt, this.elapsed, this.vehicleDynamics.state.wheelSpin);

    // 6. Update Vehicle & Plane Live Dynamics
    this.vehicleDynamics.update(
      dt,
      this.elapsed,
      this.weatherSystem.roadTexture,
      this.activeSceneId,
      this.vehicleController.speed
    );

    // 7. Update Cinematography Camera Director (locked to movable subjectHolder!)
    const subjectBobY = this.vehicleDynamics.subjectRoot
      ? this.vehicleDynamics.subjectRoot.position.y
      : 0;
    this.cameraDirector.update(dt, subjectBobY);

    // 8. Render with AAA Post-Processing Pipeline (ACES Filmic -> Film Grade -> Vignette)
    this.pipeline.render(dt);

    // 9. Capture frame into Social Media Video Exporter if recording (gizmo guaranteed hidden!)
    if (isRecording) {
      this.videoExporter.captureFrame();
    }
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this._resizeHandler);
    this.vehicleController.dispose();
    this.renderer.dispose();
  }
}

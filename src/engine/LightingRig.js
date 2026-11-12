import * as THREE from 'three';
import {
  createAutomotiveStudioScene,
  createSkyGradientTexture,
  getEnvironmentSceneForSceneId,
} from './StudioEnvironment.js';

/**
 * Physical Scene Lighting Profiles:
 * Ensures every 3D city, photogrammetry scan, F1 garage, and cinema studio shares
 * matched color temperature, sun/streetlight direction, shadow softness, sky horizon,
 * and IBL intensity between the environment and the vehicle.
 */
export const SCENE_LIGHTING_PROFILES = {
  la_night_city: {
    bg: '#060913',
    fogColor: '#090d1a',
    fogDensity: 0.0045,
    skyDome: ['#040711', '#131b30', '#070910'],
    envIntensity: 1.35,
    exposure: 1.08,
    ambientSky: '#93c5fd',
    ambientGround: '#291d12',
    ambientIntensity: 0.65,
    keyColor: '#ffd6a5', // Warm 3200K urban streetlight / intersection flood
    keyIntensity: 2.65,
    keyOffset: [12, 18, -10],
    fillColor: '#60a5fa', // Cool skyscraper window bounce
    fillIntensity: 0.95,
    fillOffset: [-14, 10, 12],
    rimColor: '#fbbf24',
    rimIntensity: 1.65,
    rimOffset: [-6, 9, 14],
    shadowCatcherOpacity: 0.52,
  },
  red_bull_f1_garage: {
    bg: '#060910',
    fogColor: '#060910',
    fogDensity: 0.0016,
    envIntensity: 0.72,
    exposure: 0.82,
    ambientSky: '#cbd5e1',
    ambientGround: '#0f172a',
    ambientIntensity: 0.28,
    keyColor: '#f8fafc', // 5600K overhead F1 pit bay LED lightbank (calibrated non-clipping)
    keyIntensity: 1.35,
    keyOffset: [2.5, 5.2, -3.5],
    fillColor: '#60a5fa',
    fillIntensity: 0.32,
    fillOffset: [-6, 3.5, 5],
    rimColor: '#ef4444', // Subtle Red Bull pit accent kicker
    rimIntensity: 0.85,
    rimOffset: [0, 4.2, 8],
    shadowCatcherOpacity: 0.34,
  },
  pro_lighting_studio: {
    bg: '#05060a',
    fogColor: '#05060a',
    fogDensity: 0.0008,
    envIntensity: 1.18,
    exposure: 0.98,
    ambientSky: '#e2e8f0',
    ambientGround: '#0f172a',
    ambientIntensity: 0.06,
    keyColor: '#ffffff',
    keyIntensity: 0.08,
    keyOffset: [0, 7.5, -1],
    fillColor: '#93c5fd',
    fillIntensity: 0.05,
    fillOffset: [-8, 4, 5],
    rimColor: '#f8fafc',
    rimIntensity: 0.05,
    rimOffset: [0, 5, 10],
    shadowCatcherOpacity: 0.08,
  },
  warehouse_courtyard_day: {
    bg: '#84b4df',
    fogColor: '#d8cbb7',
    fogDensity: 0.0018,
    skyDome: ['#3570ab', '#dfd2be', '#5e5447'],
    envIntensity: 1.16,
    exposure: 0.98,
    ambientSky: '#fef3c7',
    ambientGround: '#57534e',
    ambientIntensity: 0.78,
    keyColor: '#fff1d6', // Golden late-afternoon sun raking across brick facade
    keyIntensity: 2.95,
    keyOffset: [14, 15, -11],
    fillColor: '#93c5fd',
    fillIntensity: 0.62,
    fillOffset: [-14, 10, 12],
    rimColor: '#fde68a',
    rimIntensity: 0.95,
    rimOffset: [-10, 9, 13],
    shadowCatcherOpacity: 0.08,
  },
  city_bokeh_street_day: {
    bg: '#85b6e0',
    fogColor: '#c3d5e6',
    fogDensity: 0.0022,
    skyDome: ['#3470ac', '#c8daea', '#4a5058'],
    envIntensity: 1.15,
    exposure: 0.98,
    ambientSky: '#e0f2fe',
    ambientGround: '#475569',
    ambientIntensity: 0.82,
    keyColor: '#fff8ea',
    keyIntensity: 2.85,
    keyOffset: [13, 18, -10],
    fillColor: '#93c5fd',
    fillIntensity: 0.65,
    fillOffset: [-14, 11, 12],
    rimColor: '#fffbeb',
    rimIntensity: 0.85,
    rimOffset: [-8, 10, 14],
    shadowCatcherOpacity: 0.08,
  },
  wet_night_bokeh_street: {
    bg: '#04060c',
    fogColor: '#060a14',
    fogDensity: 0.0042,
    skyDome: ['#03060e', '#10182b', '#05070d'],
    envIntensity: 1.28,
    exposure: 1.04,
    ambientSky: '#60a5fa',
    ambientGround: '#1e1b2e',
    ambientIntensity: 0.34,
    keyColor: '#ffd8a8', // Warm urban streetlamp key
    keyIntensity: 1.45,
    keyOffset: [7, 10, -6],
    fillColor: '#38bdf8', // Cyan storefront neon fill
    fillIntensity: 0.55,
    fillOffset: [-9, 5, 7],
    rimColor: '#ff3d8b', // Magenta neon rim kicker
    rimIntensity: 1.35,
    rimOffset: [5, 5, 11],
    shadowCatcherOpacity: 0.12,
  },
  detailed_parking_garage: {
    bg: '#070a11',
    fogColor: '#070a11',
    fogDensity: 0.0024,
    envIntensity: 0.82,
    exposure: 0.88,
    ambientSky: '#cbd5e1',
    ambientGround: '#0f172a',
    ambientIntensity: 0.36,
    keyColor: '#f1f5f9',
    keyIntensity: 1.68,
    keyOffset: [1.5, 4.2, -2.5],
    fillColor: '#64748b',
    fillIntensity: 0.45,
    fillOffset: [-5, 2.8, 4],
    rimColor: '#93c5fd',
    rimIntensity: 0.95,
    rimOffset: [0, 3.6, 7],
    shadowCatcherOpacity: 0.35,
  },
  velvet_curtain_showroom: {
    bg: '#0b0507',
    fogColor: '#0b0507',
    fogDensity: 0.0022,
    envIntensity: 1.08,
    exposure: 0.96,
    ambientSky: '#ffe4e6',
    ambientGround: '#1f1016',
    ambientIntensity: 0.42,
    keyColor: '#fff5e6', // Warm gallery halogen spotlight
    keyIntensity: 2.35,
    keyOffset: [2.4, 2.75, -2.4],
    fillColor: '#fda4af', // Crimson velvet curtain bounce
    fillIntensity: 0.48,
    fillOffset: [-4.5, 2.0, 3.5],
    rimColor: '#fde68a',
    rimIntensity: 1.15,
    rimOffset: [0, 2.5, 5.5],
    shadowCatcherOpacity: 0.24,
  },
  monaco_circuit: {
    bg: '#82b6e2',
    fogColor: '#cfe0ee',
    fogDensity: 0.00065,
    skyDome: ['#2f6ead', '#d9e6f2', '#555b61'],
    envIntensity: 1.16,
    exposure: 0.98,
    ambientSky: '#e0f2fe',
    ambientGround: '#57534e',
    ambientIntensity: 0.88,
    keyColor: '#fff6e0', // Mediterranean Monte Carlo sun
    keyIntensity: 2.9,
    keyOffset: [18, 24, -14],
    fillColor: '#93c5fd',
    fillIntensity: 0.68,
    fillOffset: [-16, 12, 14],
    rimColor: '#fef3c7',
    rimIntensity: 0.9,
    rimOffset: [-10, 11, 15],
    shadowCatcherOpacity: 0.34,
  },
  marina_bay_circuit: {
    bg: '#050811',
    fogColor: '#080e1c',
    fogDensity: 0.0014,
    skyDome: ['#040710', '#121d33', '#06080f'],
    envIntensity: 1.18,
    exposure: 1.02,
    ambientSky: '#93c5fd',
    ambientGround: '#1e293b',
    ambientIntensity: 0.52,
    keyColor: '#f8fafc', // Singapore FIA overhead track floodlights
    keyIntensity: 2.35,
    keyOffset: [3, 18, -8],
    fillColor: '#38bdf8',
    fillIntensity: 0.68,
    fillOffset: [-12, 10, 10],
    rimColor: '#fbbf24',
    rimIntensity: 1.35,
    rimOffset: [-6, 9, 14],
    shadowCatcherOpacity: 0.34,
  },
  f1_pit_garage: {
    bg: '#0b101b',
    fogColor: '#0b101b',
    fogDensity: 0.0018,
    envIntensity: 1.25,
    exposure: 1.05,
    ambientSky: '#f8fafc',
    ambientGround: '#1e293b',
    ambientIntensity: 0.9,
    keyColor: '#ffffff',
    keyIntensity: 2.8,
    keyOffset: [2.0, 6.0, -4.0],
    fillColor: '#cbd5e1',
    fillIntensity: 0.85,
    fillOffset: [-6, 3.8, 5],
    rimColor: '#38bdf8',
    rimIntensity: 1.2,
    rimOffset: [0, 4.6, 8],
    shadowCatcherOpacity: 0.38,
  },
  canadian_downtown: {
    bg: '#8bb8df',
    fogColor: '#b9d1e6',
    fogDensity: 0.0022,
    skyDome: ['#3873ad', '#c8dced', '#545b63'],
    envIntensity: 1.18,
    exposure: 1.0,
    ambientSky: '#e0f2fe',
    ambientGround: '#57534e',
    ambientIntensity: 0.95,
    keyColor: '#fff8e7', // Natural crisp North American afternoon sun
    keyIntensity: 2.85,
    keyOffset: [18, 24, -14],
    fillColor: '#93c5fd',
    fillIntensity: 0.7,
    fillOffset: [-16, 12, 14],
    rimColor: '#fffbeb',
    rimIntensity: 0.85,
    rimOffset: [-10, 12, 16],
    shadowCatcherOpacity: 0.45,
  },
  vatican_city: {
    bg: '#8ec0e4',
    fogColor: '#d6ccb8',
    fogDensity: 0.00045,
    skyDome: ['#3b78b0', '#dfd3be', '#6b604e'],
    envIntensity: 1.2,
    exposure: 1.0,
    ambientSky: '#fef3c7',
    ambientGround: '#78716c',
    ambientIntensity: 0.95,
    keyColor: '#fff3d6', // Warm Roman golden-afternoon sunlight
    keyIntensity: 2.85,
    keyOffset: [20, 22, -16],
    fillColor: '#bae6fd',
    fillIntensity: 0.72,
    fillOffset: [-16, 12, 12],
    rimColor: '#fde68a',
    rimIntensity: 0.9,
    rimOffset: [-12, 10, 14],
    shadowCatcherOpacity: 0.48,
  },
  building_interior_scan: {
    bg: '#141921',
    fogColor: '#141921',
    fogDensity: 0.0025,
    envIntensity: 1.05,
    exposure: 1.02,
    ambientSky: '#e2e8f0',
    ambientGround: '#27272a',
    ambientIntensity: 0.78,
    keyColor: '#fff7ed', // Daylight shaft pouring through industrial windows
    keyIntensity: 2.55,
    keyOffset: [7, 13, -8],
    fillColor: '#94a3b8',
    fillIntensity: 0.68,
    fillOffset: [-8, 5, 7],
    rimColor: '#e2e8f0',
    rimIntensity: 0.95,
    rimOffset: [0, 7, 9],
    shadowCatcherOpacity: 0.42,
  },
  construction_site: {
    bg: '#93bddf',
    fogColor: '#cfc8bc',
    fogDensity: 0.0022,
    skyDome: ['#407ab3', '#d9d2c5', '#696156'],
    envIntensity: 1.15,
    exposure: 1.0,
    ambientSky: '#f1f5f9',
    ambientGround: '#6b5e4c',
    ambientIntensity: 0.92,
    keyColor: '#fff7e6',
    keyIntensity: 2.85,
    keyOffset: [18, 25, -15],
    fillColor: '#93c5fd',
    fillIntensity: 0.68,
    fillOffset: [-16, 12, 14],
    rimColor: '#fef3c7',
    rimIntensity: 0.85,
    rimOffset: [-10, 12, 16],
    shadowCatcherOpacity: 0.46,
  },
  eglise_saint_polycarpe: {
    bg: '#8cb8de',
    fogColor: '#c7d7e6',
    fogDensity: 0.00055,
    skyDome: ['#3c76ad', '#cddbe8', '#525860'],
    envIntensity: 1.18,
    exposure: 1.0,
    ambientSky: '#e0f2fe',
    ambientGround: '#57534e',
    ambientIntensity: 0.92,
    keyColor: '#fff9eb',
    keyIntensity: 2.75,
    keyOffset: [16, 23, -14],
    fillColor: '#93c5fd',
    fillIntensity: 0.7,
    fillOffset: [-15, 11, 13],
    rimColor: '#fffbeb',
    rimIntensity: 0.85,
    rimOffset: [-10, 11, 15],
    shadowCatcherOpacity: 0.46,
  },
  kent_lumber_yard: {
    bg: '#8bb7dd',
    fogColor: '#c4d5e4',
    fogDensity: 0.002,
    skyDome: ['#3973ab', '#cadbe8', '#54585c'],
    envIntensity: 1.18,
    exposure: 1.0,
    ambientSky: '#e0f2fe',
    ambientGround: '#57534e',
    ambientIntensity: 0.92,
    keyColor: '#fff8e8',
    keyIntensity: 2.85,
    keyOffset: [19, 24, -14],
    fillColor: '#93c5fd',
    fillIntensity: 0.7,
    fillOffset: [-16, 12, 14],
    rimColor: '#fffbeb',
    rimIntensity: 0.85,
    rimOffset: [-10, 11, 15],
    shadowCatcherOpacity: 0.45,
  },
  interior_7: {
    bg: '#384659',
    fogColor: '#384659',
    fogDensity: 0.0003,
    envIntensity: 1.32,
    exposure: 1.04,
    ambientSky: '#f1f5f9',
    ambientGround: '#475569',
    ambientIntensity: 1.1,
    keyColor: '#fffcf0',
    keyIntensity: 3.1,
    keyOffset: [-14, 9.5, -9],
    fillColor: '#94a3b8',
    fillIntensity: 0.75,
    fillOffset: [12, 6, 8],
    rimColor: '#ffffff',
    rimIntensity: 1.1,
    rimOffset: [4, 8, 10],
    shadowCatcherOpacity: 0.34,
  },
  wind_tunnel: {
    bg: '#020409',
    fogColor: '#030712',
    fogDensity: 0.004,
    envIntensity: 1.15,
    exposure: 1.05,
    ambientSky: '#38bdf8',
    ambientGround: '#0c1926',
    ambientIntensity: 0.52,
    keyColor: '#f8fafc',
    keyIntensity: 2.8,
    keyOffset: [0, 10, -4],
    fillColor: '#38bdf8',
    fillIntensity: 0.85,
    fillOffset: [10, 5, 4],
    rimColor: '#06b6d4',
    rimIntensity: 2.2,
    rimOffset: [-10, 6, 8],
    shadowCatcherOpacity: 0.36,
  },
  car_garage: {
    bg: '#05080f',
    fogColor: '#05080f',
    fogDensity: 0.0025,
    envIntensity: 1.05,
    exposure: 1.02,
    ambientSky: '#e2e8f0',
    ambientGround: '#0f172a',
    ambientIntensity: 0.65,
    keyColor: '#f1f5f9',
    keyIntensity: 2.5,
    keyOffset: [0, 5.5, -1.5],
    fillColor: '#64748b',
    fillIntensity: 0.7,
    fillOffset: [-6, 3, 4],
    rimColor: '#cbd5e1',
    rimIntensity: 1.15,
    rimOffset: [0, 4.8, -6],
    shadowCatcherOpacity: 0.38,
  },
  abandoned_vr_gallery: {
    bg: '#0a0e17',
    fogColor: '#0a0e17',
    fogDensity: 0.0025,
    envIntensity: 0.95,
    exposure: 0.98,
    ambientSky: '#cbd5e1',
    ambientGround: '#18202c',
    ambientIntensity: 0.45,
    keyColor: '#fff4e0',
    keyIntensity: 2.65,
    keyOffset: [5, 14, -7],
    fillColor: '#475569',
    fillIntensity: 0.55,
    fillOffset: [-6, 4, 6],
    rimColor: '#94a3b8',
    rimIntensity: 0.9,
    rimOffset: [0, 8, 8],
    shadowCatcherOpacity: 0.4,
  },
  architectural_exhibition_hall: {
    bg: '#1e2633',
    fogColor: '#1e2633',
    fogDensity: 0.0015,
    envIntensity: 1.2,
    exposure: 1.02,
    ambientSky: '#f8fafc',
    ambientGround: '#334155',
    ambientIntensity: 0.95,
    keyColor: '#fffbeb',
    keyIntensity: 2.8,
    keyOffset: [10, 16, -8],
    fillColor: '#94a3b8',
    fillIntensity: 0.75,
    fillOffset: [-10, 8, 8],
    rimColor: '#e2e8f0',
    rimIntensity: 1.1,
    rimOffset: [0, 10, 12],
    shadowCatcherOpacity: 0.38,
  },
  catwalk: {
    bg: '#090d16',
    fogColor: '#090d16',
    fogDensity: 0.003,
    envIntensity: 1.15,
    exposure: 1.04,
    ambientSky: '#cbd5e1',
    ambientGround: '#0f172a',
    ambientIntensity: 0.65,
    keyColor: '#f8fafc',
    keyIntensity: 2.7,
    keyOffset: [4, 9, -6],
    fillColor: '#38bdf8',
    fillIntensity: 0.75,
    fillOffset: [-7, 4, 5],
    rimColor: '#f59e0b',
    rimIntensity: 1.35,
    rimOffset: [0, 6, 10],
    shadowCatcherOpacity: 0.36,
  },
  desert_workshop_garage: {
    bg: '#c29b70',
    fogColor: '#d4b48c',
    fogDensity: 0.003,
    skyDome: ['#4f83b5', '#e3c79c', '#7c6043'],
    envIntensity: 1.15,
    exposure: 1.0,
    ambientSky: '#fef3c7',
    ambientGround: '#78553a',
    ambientIntensity: 0.88,
    keyColor: '#ffedd5',
    keyIntensity: 2.9,
    keyOffset: [16, 18, -12],
    fillColor: '#fed7aa',
    fillIntensity: 0.7,
    fillOffset: [-12, 8, 10],
    rimColor: '#fde68a',
    rimIntensity: 1.05,
    rimOffset: [-8, 9, 12],
    shadowCatcherOpacity: 0.45,
  },
  cyberpunk_garage: {
    bg: '#060510',
    fogColor: '#090617',
    fogDensity: 0.004,
    envIntensity: 1.25,
    exposure: 1.08,
    ambientSky: '#818cf8',
    ambientGround: '#1e1b4b',
    ambientIntensity: 0.62,
    keyColor: '#38bdf8',
    keyIntensity: 2.6,
    keyOffset: [6, 8, -6],
    fillColor: '#f472b6',
    fillIntensity: 1.05,
    fillOffset: [-7, 4, 6],
    rimColor: '#00f5d4',
    rimIntensity: 1.85,
    rimOffset: [0, 6, 9],
    shadowCatcherOpacity: 0.4,
  },
  dark_void: {
    bg: '#010204',
    fogColor: '#010204',
    fogDensity: 0.007,
    envIntensity: 1.3,
    exposure: 1.12,
    ambientSky: '#e2e8f0',
    ambientGround: '#05070d',
    ambientIntensity: 0.25,
    keyColor: '#ffffff',
    keyIntensity: 3.4,
    keyOffset: [8, 14, -8],
    fillColor: '#60a5fa',
    fillIntensity: 0.75,
    fillOffset: [-10, 6, 8],
    rimColor: '#f8fafc',
    rimIntensity: 2.6,
    rimOffset: [0, 10, 14],
    shadowCatcherOpacity: 0.3,
  },
  wet_studio: {
    bg: '#02040a',
    fogColor: '#02040a',
    fogDensity: 0.005,
    envIntensity: 1.3,
    exposure: 1.08,
    ambientSky: '#e2e8f0',
    ambientGround: '#090d16',
    ambientIntensity: 0.42,
    keyColor: '#ffffff',
    keyIntensity: 3.0,
    keyOffset: [9, 14, -9],
    fillColor: '#38bdf8',
    fillIntensity: 0.85,
    fillOffset: [-10, 6, 8],
    rimColor: '#f8fafc',
    rimIntensity: 2.1,
    rimOffset: [0, 10, 14],
    shadowCatcherOpacity: 0.3,
  },
};

export class LightingRig {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;

    // PMREM + Real-time 360° Scene Reflection Probe (CubeCamera)
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.pmremGenerator.compileEquirectangularShader();
    this.pmremGenerator.compileCubemapShader();
    this.envCache = new Map();
    this.skyDomeCache = new Map();

    this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
      type: THREE.HalfFloatType,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.cubeCamera = new THREE.CubeCamera(0.25, 1800, this.cubeRenderTarget);
    this.liveProbePMREM = null;

    const studioEnvScene = createAutomotiveStudioScene();
    this.envTexture = this.pmremGenerator.fromScene(studioEnvScene, 0.04).texture;
    this.envCache.set('dark_void', this.envTexture);
    this.scene.environment = this.envTexture;
    this.scene.environmentIntensity = 1.1;

    this.state = {
      keyColor: '#ffffff',
      keyIntensity: 1.8,
      keyAzimuth: 45,
      keyElevation: 48,
      fillColor: '#93c5fd',
      fillIntensity: 0.7,
      rimColor: '#f8fafc',
      rimIntensity: 1.4,
      ambientColor: '#0a0f1d',
      ambientIntensity: 0.55,
      exposure: 1.0,
      floorWetness: 0.65,
      fogDensity: 0.003,
      lightSweep: false,
      softboxIntensity: 2.5,
      blackoutMode: false,
    };

    this.activeKeyOffset = new THREE.Vector3(12, 18, -12);
    this.activeFillOffset = new THREE.Vector3(-14, 10, 12);
    this.activeRimOffset = new THREE.Vector3(0, 12, 16);
    this.activeRimBase = 1.4;
    this.subjectFocus = new THREE.Vector3(0, 0, 0);

    this.beatPulse = 0;

    this.lightsGroup = new THREE.Group();
    this.lightsGroup.name = 'StudioLightingRig';
    this.scene.add(this.lightsGroup);

    // Subtle backing sky sphere for outdoor photogrammetry scenes so horizon & reflections never hit void black
    this.skySphere = new THREE.Mesh(
      new THREE.SphereGeometry(1600, 32, 20),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, depthWrite: false, fog: false })
    );
    this.skySphere.name = 'OutdoorPhotogrammetrySkyDome';
    this.skySphere.visible = false;
    this.scene.add(this.skySphere);

    this._initLights();
    this._initProceduralStudios();
    this._initWindTunnelStreamlines();
    this.applyState(this.state);
  }

  _initLights() {
    this.ambientLight = new THREE.HemisphereLight('#ffffff', '#0a0f1d', 0.55);
    this.lightsGroup.add(this.ambientLight);

    // Primary Key Directional Light with movable target so shadows track vehicle movement anywhere!
    this.keyLight = new THREE.DirectionalLight('#ffffff', 2.4);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 95;
    const d = 16;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.00035;
    this.keyLight.shadow.normalBias = 0.015;
    this.keyLightTarget = new THREE.Object3D();
    this.lightsGroup.add(this.keyLight, this.keyLightTarget);
    this.keyLight.target = this.keyLightTarget;

    // Secondary Fill Light (Soft sky/wall bounce)
    this.fillLight = new THREE.DirectionalLight('#93c5fd', 0.75);
    this.fillLightTarget = new THREE.Object3D();
    this.lightsGroup.add(this.fillLight, this.fillLightTarget);
    this.fillLight.target = this.fillLightTarget;

    // Silhouette Rim Spotlight
    this.rimLight = new THREE.SpotLight('#f8fafc', 1.4, 95, Math.PI / 3.2, 0.6, 1.2);
    this.rimLightTarget = new THREE.Object3D();
    this.lightsGroup.add(this.rimLight, this.rimLightTarget);
    this.rimLight.target = this.rimLightTarget;

    // Subtle overhead sweep softbox light
    this.sweepLight = new THREE.PointLight('#ffffff', 0.5, 30, 2.0);
    this.sweepLight.position.set(0, 7.5, 0);
    this.lightsGroup.add(this.sweepLight);

    this.scene.fog = new THREE.FogExp2('#03060c', 0.003);
  }

  /**
   * Moves key/fill/rim light targets with the vehicle so directional shadows and rim highlights
   * stay locked onto the vehicle wherever the user drags or drives it in a large city scene.
   */
  updateSubjectFocus(worldPos) {
    if (!worldPos) return;
    this.subjectFocus.copy(worldPos);
    this.keyLightTarget.position.copy(worldPos);
    this.keyLight.position.copy(worldPos).add(this.activeKeyOffset);

    this.fillLightTarget.position.copy(worldPos);
    this.fillLight.position.copy(worldPos).add(this.activeFillOffset);

    this.rimLightTarget.position.copy(worldPos);
    this.rimLight.position.copy(worldPos).add(this.activeRimOffset);

    this.skySphere.position.set(worldPos.x, 0, worldPos.z);
  }

  /**
   * Captures a true 360° HDR environment reflection cubemap directly from the loaded 3D scene
   * at the vehicle's exact position (hiding the vehicle itself for 1 micro-pass), then prefilters
   * via PMREMGenerator so car paint, chrome rims, and glass reflect the actual surrounding buildings,
   * streetlights, garage lightbanks, and pavement!
   */
  captureSceneProbe(position = new THREE.Vector3(0, 0, 0), excludeObjects = []) {
    if (!this.renderer || this.currentSceneId === 'outdoor_world') return;

    const prevVis = excludeObjects.map((obj) => {
      const v = obj ? obj.visible : false;
      if (obj) obj.visible = false;
      return v;
    });

    const prevRenderTarget = this.renderer.getRenderTarget();
    const prevCubeActive = this.renderer.xr?.enabled;
    try {
      this.cubeCamera.position.set(position.x, position.y + 0.9, position.z);
      this.cubeCamera.update(this.renderer, this.scene);

      const pmremRT = this.pmremGenerator.fromCubemap(this.cubeRenderTarget.texture);
      if (this.liveProbePMREM) {
        this.liveProbePMREM.dispose();
      }
      this.liveProbePMREM = pmremRT;
      this.scene.environment = pmremRT.texture;
    } catch (err) {
      console.warn('Live IBL probe fallback to procedural PMREM:', err);
    } finally {
      this.renderer.setRenderTarget(prevRenderTarget);
      if (prevCubeActive !== undefined && this.renderer.xr) {
        this.renderer.xr.enabled = prevCubeActive;
      }
      excludeObjects.forEach((obj, i) => {
        if (obj) obj.visible = prevVis[i];
      });
    }
  }

  _initProceduralStudios() {
    // 1. Wet Obsidian Dark Studio
    this.wetStudioGroup = new THREE.Group();
    const floorGeo = new THREE.CircleGeometry(90, 64);
    this.studioFloorMat = new THREE.MeshStandardMaterial({
      color: '#05070d',
      roughness: 0.08,
      metalness: 0.92,
    });
    const floorMesh = new THREE.Mesh(floorGeo, this.studioFloorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.001;
    floorMesh.receiveShadow = true;
    this.wetStudioGroup.add(floorMesh);

    const softboxGeo = new THREE.PlaneGeometry(6.5, 24);
    this.softboxMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      side: THREE.DoubleSide,
    });
    this.softboxMesh = new THREE.Mesh(softboxGeo, this.softboxMat);
    this.softboxMesh.rotation.x = Math.PI / 2;
    this.softboxMesh.position.set(0, 8.8, 0);
    this.wetStudioGroup.add(this.softboxMesh);

    this.studioRimBars = [];
    const barGeo = new THREE.CylinderGeometry(0.06, 0.06, 9.5, 12);
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const r = 18.0;
      const barMat = new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: '#38bdf8',
        emissiveIntensity: 3.5,
      });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(Math.cos(angle) * r, 4.75, Math.sin(angle) * r);
      this.wetStudioGroup.add(bar);
      this.studioRimBars.push(bar);
    }
    this.wetStudioGroup.visible = false;
    this.scene.add(this.wetStudioGroup);

    // 2. Cyberpunk Neon Speed Tunnel
    this.cyberTunnelGroup = new THREE.Group();
    const tunnelFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 220),
      new THREE.MeshStandardMaterial({
        color: '#03050a',
        roughness: 0.06,
        metalness: 0.94,
      })
    );
    tunnelFloor.rotation.x = -Math.PI / 2;
    tunnelFloor.receiveShadow = true;
    this.cyberTunnelGroup.add(tunnelFloor);

    this.tunnelArches = [];
    const archGeo = new THREE.TorusGeometry(11.5, 0.15, 12, 48, Math.PI);
    for (let i = 0; i < 24; i++) {
      const isCyan = i % 2 === 0;
      const col = isCyan ? '#00f5d4' : '#ff007f';
      const archMat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 4.0,
      });
      const arch = new THREE.Mesh(archGeo, archMat);
      arch.position.set(0, 0, -90 + i * 8.0);
      this.cyberTunnelGroup.add(arch);
      this.tunnelArches.push(arch);
    }
    this.cyberTunnelGroup.visible = false;
    this.scene.add(this.cyberTunnelGroup);

    // 3. High-Altitude Volumetric Cloud Deck
    this.cloudDeckGroup = new THREE.Group();
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 256;
    cloudCanvas.height = 256;
    const ctx = cloudCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
    grad.addColorStop(0, 'rgba(255,255,255,0.92)');
    grad.addColorStop(0.55, 'rgba(226,238,255,0.55)');
    grad.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const cloudTex = new THREE.CanvasTexture(cloudCanvas);

    this.flightCloudMat = new THREE.MeshLambertMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.flightClouds = [];
    const puffGeo = new THREE.PlaneGeometry(42, 42);
    for (let i = 0; i < 75; i++) {
      const puff = new THREE.Mesh(puffGeo, this.flightCloudMat);
      puff.rotation.x = -Math.PI / 2;
      puff.position.set(
        (Math.random() - 0.5) * 220,
        -6.5 - (i % 5) * 2.2,
        (Math.random() - 0.5) * 220
      );
      puff.rotation.z = Math.random() * Math.PI * 2;
      this.cloudDeckGroup.add(puff);
      this.flightClouds.push(puff);
    }
    this.cloudDeckGroup.visible = false;
    this.scene.add(this.cloudDeckGroup);

    // 4. Night International Airport Runway
    this.runwayGroup = new THREE.Group();
    const runwayFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 280),
      new THREE.MeshStandardMaterial({
        color: '#050912',
        roughness: 0.12,
        metalness: 0.75,
      })
    );
    runwayFloor.rotation.x = -Math.PI / 2;
    runwayFloor.receiveShadow = true;
    this.runwayGroup.add(runwayFloor);

    this.runwayStrobes = [];
    const strobeGeo = new THREE.SphereGeometry(0.18, 8, 8);
    for (let z = -120; z <= 120; z += 8) {
      const centerMat = new THREE.MeshBasicMaterial({ color: '#22c55e' });
      const centerLight = new THREE.Mesh(strobeGeo, centerMat);
      centerLight.position.set(0, 0.05, z);
      this.runwayGroup.add(centerLight);
      this.runwayStrobes.push({ mesh: centerLight, z });

      [-18, 18].forEach((x) => {
        const edgeMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
        const edgeLight = new THREE.Mesh(strobeGeo, edgeMat);
        edgeLight.position.set(x, 0.08, z);
        this.runwayGroup.add(edgeLight);
      });
    }
    this.runwayGroup.visible = false;
    this.scene.add(this.runwayGroup);
  }

  _initWindTunnelStreamlines() {
    this.windTunnelGroup = new THREE.Group();
    this.windTunnelGroup.visible = false;
    this.scene.add(this.windTunnelGroup);
  }

  getEnvironmentForScene(sceneId) {
    if (this.envCache.has(sceneId)) {
      return this.envCache.get(sceneId);
    }
    const envScene = getEnvironmentSceneForSceneId(sceneId);
    const texture = this.pmremGenerator.fromScene(envScene, 0.04).texture;
    this.envCache.set(sceneId, texture);
    return texture;
  }

  setActiveProceduralScene(sceneId) {
    this.currentSceneId = sceneId;
    this.wetStudioGroup.visible = sceneId === 'wet_studio' || sceneId === 'dark_void';
    this.cyberTunnelGroup.visible = sceneId === 'cyberpunk_tunnel';
    this.cloudDeckGroup.visible = sceneId === 'cloud_deck';
    this.runwayGroup.visible = sceneId === 'night_runway';
    this.windTunnelGroup.visible = false;
    this.keyLight.castShadow = sceneId !== 'pro_lighting_studio';

    if (sceneId !== 'outdoor_world') {
      const envTex = this.getEnvironmentForScene(sceneId);
      this.scene.environment = envTex;
    }

    const profile = SCENE_LIGHTING_PROFILES[sceneId];
    if (profile) {
      const bgCol = new THREE.Color(profile.bg);
      this.scene.background = bgCol;
      if (this.scene.fog) {
        this.scene.fog.color.set(profile.fogColor);
        this.scene.fog.density = profile.fogDensity;
      }

      if (profile.skyDome) {
        if (!this.skyDomeCache.has(sceneId)) {
          const sunDir = new THREE.Vector3(...profile.keyOffset).normalize();
          this.skyDomeCache.set(
            sceneId,
            createSkyGradientTexture(
              profile.skyDome[0],
              profile.skyDome[1],
              profile.skyDome[2],
              profile.keyColor,
              sunDir
            )
          );
        }
        this.skySphere.material.map = this.skyDomeCache.get(sceneId);
        this.skySphere.material.needsUpdate = true;
        this.skySphere.visible = true;
      } else {
        this.skySphere.visible = false;
      }

      this.scene.environmentIntensity = profile.envIntensity;
      this.renderer.toneMappingExposure = profile.exposure;

      this.ambientLight.color.set(profile.ambientSky);
      this.ambientLight.groundColor.set(profile.ambientGround);
      this.ambientLight.intensity = profile.ambientIntensity;

      this.keyLight.color.set(profile.keyColor);
      this.keyLight.intensity = profile.keyIntensity;
      this.activeKeyOffset.set(...profile.keyOffset);

      this.fillLight.color.set(profile.fillColor);
      this.fillLight.intensity = profile.fillIntensity;
      this.activeFillOffset.set(...profile.fillOffset);

      this.rimLight.color.set(profile.rimColor);
      this.rimLight.intensity = profile.rimIntensity;
      this.activeRimBase = profile.rimIntensity;
      this.activeRimOffset.set(...profile.rimOffset);

      this.state = {
        ...this.state,
        keyColor: profile.keyColor,
        keyIntensity: profile.keyIntensity,
        fillColor: profile.fillColor,
        fillIntensity: profile.fillIntensity,
        rimColor: profile.rimColor,
        rimIntensity: profile.rimIntensity,
        ambientColor: profile.ambientGround,
        ambientIntensity: profile.ambientIntensity,
        exposure: profile.exposure,
        fogDensity: profile.fogDensity,
      };

      this.updateSubjectFocus(this.subjectFocus);
      return profile;
    }

    this.skySphere.visible = false;

    if (sceneId === 'cloud_deck') {
      this.scene.background = new THREE.Color('#0c4a6e');
      this.scene.fog.color.set('#38bdf8');
      this.scene.fog.density = 0.0035;
      this.renderer.toneMappingExposure = 1.08;
      this.activeRimBase = 1.4;
    } else if (sceneId === 'cyberpunk_tunnel') {
      this.scene.background = new THREE.Color('#020308');
      this.scene.fog.color.set('#060410');
      this.scene.fog.density = 0.008;
      this.renderer.toneMappingExposure = 1.12;
      this.activeRimBase = 2.0;
    } else if (sceneId === 'night_runway') {
      this.scene.background = new THREE.Color('#02040a');
      this.scene.fog.color.set('#040812');
      this.scene.fog.density = 0.006;
      this.renderer.toneMappingExposure = 1.08;
      this.activeRimBase = 1.6;
    } else if (sceneId !== 'outdoor_world') {
      this.scene.background = new THREE.Color('#03060c');
      this.scene.fog.color.set('#03060c');
      this.scene.fog.density = this.state.fogDensity;
      this.renderer.toneMappingExposure = 1.05;
      this.activeRimBase = this.state.rimIntensity;
    }
    this.updateSubjectFocus(this.subjectFocus);
    return null;
  }

  applySceneFilmPreset(presetId) {
    switch (presetId) {
      case 'loft_daylight':
        this.keyLight.color.set('#fffcf0');
        this.keyLight.intensity = 3.1;
        this.activeKeyOffset.set(-14.0, 9.5, -9.0);
        this.ambientLight.color.set('#f1f5f9');
        this.ambientLight.intensity = 1.1;
        this.scene.background = new THREE.Color('#384659');
        this.scene.environmentIntensity = 1.32;
        this.renderer.toneMappingExposure = 1.04;
        break;
      case 'loft_sunset':
        this.keyLight.color.set('#ff9f43');
        this.keyLight.intensity = 3.5;
        this.activeKeyOffset.set(-18.0, 4.5, -12.0);
        this.ambientLight.color.set('#f472b6');
        this.ambientLight.groundColor.set('#2e1065');
        this.ambientLight.intensity = 0.85;
        this.scene.background = new THREE.Color('#4c1d95');
        this.scene.environmentIntensity = 1.25;
        this.renderer.toneMappingExposure = 1.08;
        break;
      case 'loft_overcast':
        this.keyLight.color.set('#cbd5e1');
        this.keyLight.intensity = 2.4;
        this.activeKeyOffset.set(-10.0, 12.0, -8.0);
        this.ambientLight.color.set('#94a3b8');
        this.ambientLight.intensity = 1.15;
        this.scene.background = new THREE.Color('#475569');
        this.scene.environmentIntensity = 1.1;
        this.renderer.toneMappingExposure = 1.0;
        break;
      case 'loft_midnight':
        this.keyLight.color.set('#06b6d4');
        this.keyLight.intensity = 1.8;
        this.activeKeyOffset.set(-14.0, 6.0, -10.0);
        this.ambientLight.color.set('#1e1b4b');
        this.ambientLight.intensity = 0.35;
        this.rimLight.color.set('#ec4899');
        this.activeRimBase = 1.8;
        this.scene.background = new THREE.Color('#030712');
        this.scene.environmentIntensity = 0.75;
        this.renderer.toneMappingExposure = 1.1;
        break;
      case 'wind_aero':
        this.keyLight.color.set('#f8fafc');
        this.keyLight.intensity = 2.8;
        this.rimLight.color.set('#06b6d4');
        this.activeRimBase = 2.2;
        this.ambientLight.intensity = 0.5;
        break;
      case 'wind_cyan':
        this.keyLight.color.set('#00f5d4');
        this.keyLight.intensity = 3.0;
        this.rimLight.color.set('#38bdf8');
        this.activeRimBase = 2.8;
        this.ambientLight.intensity = 0.4;
        this.scene.background = new THREE.Color('#020617');
        break;
      case 'wind_stealth':
        this.keyLight.color.set('#e2e8f0');
        this.keyLight.intensity = 1.6;
        this.rimLight.color.set('#ffffff');
        this.activeRimBase = 3.2;
        this.ambientLight.intensity = 0.18;
        this.scene.background = new THREE.Color('#010204');
        break;
      case 'garage_fluorescent':
        this.keyLight.color.set('#f1f5f9');
        this.keyLight.intensity = 2.5;
        this.activeKeyOffset.set(0, 5.5, -1.5);
        this.ambientLight.intensity = 0.65;
        this.renderer.toneMappingExposure = 1.02;
        break;
      case 'garage_tuner':
        this.keyLight.color.set('#38bdf8');
        this.keyLight.intensity = 2.0;
        this.rimLight.color.set('#f59e0b');
        this.activeRimBase = 2.2;
        this.ambientLight.intensity = 0.4;
        break;
      case 'garage_drama':
        this.keyLight.color.set('#ffffff');
        this.keyLight.intensity = 3.2;
        this.activeKeyOffset.set(0, 5.0, 0);
        this.ambientLight.intensity = 0.22;
        this.activeRimBase = 2.6;
        break;
      case 'gallery_sunshaft':
        this.keyLight.color.set('#fff4e0');
        this.keyLight.intensity = 2.7;
        this.activeKeyOffset.set(5.0, 14.0, -7.0);
        this.ambientLight.intensity = 0.45;
        this.renderer.toneMappingExposure = 0.98;
        break;
      case 'gallery_brutalist':
        this.keyLight.color.set('#e2e8f0');
        this.keyLight.intensity = 1.9;
        this.ambientLight.intensity = 0.35;
        this.renderer.toneMappingExposure = 0.96;
        break;
      case 'gallery_goldendust':
        this.keyLight.color.set('#f59e0b');
        this.keyLight.intensity = 3.1;
        this.activeKeyOffset.set(8.0, 8.0, -10.0);
        this.ambientLight.intensity = 0.45;
        this.renderer.toneMappingExposure = 1.02;
        break;
      case 'f1_paddock_day':
        this.keyLight.color.set('#f8fafc');
        this.keyLight.intensity = 1.65;
        this.activeKeyOffset.set(0.0, 4.4, -2.5);
        this.fillLight.color.set('#93c5fd');
        this.fillLight.intensity = 0.45;
        this.rimLight.color.set('#ef4444');
        this.activeRimBase = 1.05;
        this.ambientLight.intensity = 0.35;
        this.renderer.toneMappingExposure = 0.86;
        break;
      case 'f1_night_qualifying':
        this.keyLight.color.set('#e2e8f0');
        this.keyLight.intensity = 2.3;
        this.activeKeyOffset.set(1.5, 4.2, -3.0);
        this.fillLight.color.set('#1d4ed8');
        this.fillLight.intensity = 0.85;
        this.rimLight.color.set('#fbbf24');
        this.activeRimBase = 2.35;
        this.ambientLight.intensity = 0.48;
        this.renderer.toneMappingExposure = 1.02;
        break;
      case 'f1_telemetry_glow':
        this.keyLight.color.set('#38bdf8');
        this.keyLight.intensity = 2.4;
        this.activeKeyOffset.set(-2.0, 4.2, -2.5);
        this.fillLight.color.set('#ef4444');
        this.fillLight.intensity = 0.9;
        this.rimLight.color.set('#f8fafc');
        this.activeRimBase = 2.2;
        this.ambientLight.intensity = 0.52;
        this.renderer.toneMappingExposure = 1.04;
        break;
      case 'la_sodium_street':
        this.keyLight.color.set('#ffb36b');
        this.keyLight.intensity = 2.55;
        this.activeKeyOffset.set(7.0, 14.0, -8.0);
        this.fillLight.color.set('#38bdf8');
        this.fillLight.intensity = 0.95;
        this.rimLight.color.set('#fb7185');
        this.activeRimBase = 1.85;
        this.ambientLight.intensity = 0.65;
        this.renderer.toneMappingExposure = 1.08;
        break;
      case 'la_neon_cruise':
        this.keyLight.color.set('#38bdf8');
        this.keyLight.intensity = 2.35;
        this.activeKeyOffset.set(-8.0, 11.0, -9.0);
        this.fillLight.color.set('#ec4899');
        this.fillLight.intensity = 1.15;
        this.rimLight.color.set('#f59e0b');
        this.activeRimBase = 2.15;
        this.ambientLight.intensity = 0.58;
        this.renderer.toneMappingExposure = 1.1;
        break;
      case 'la_wet_midnight':
        this.keyLight.color.set('#fde68a');
        this.keyLight.intensity = 2.1;
        this.activeKeyOffset.set(4.0, 13.0, -7.0);
        this.fillLight.color.set('#0284c7');
        this.fillLight.intensity = 0.85;
        this.rimLight.color.set('#ffffff');
        this.activeRimBase = 2.3;
        this.ambientLight.intensity = 0.45;
        this.renderer.toneMappingExposure = 1.02;
        break;
      default:
        break;
    }
    this.state = {
      ...this.state,
      keyColor: `#${this.keyLight.color.getHexString()}`,
      keyIntensity: this.keyLight.intensity,
      fillColor: `#${this.fillLight.color.getHexString()}`,
      fillIntensity: this.fillLight.intensity,
      rimColor: `#${this.rimLight.color.getHexString()}`,
      rimIntensity: this.activeRimBase,
      ambientIntensity: this.ambientLight.intensity,
      exposure: this.renderer.toneMappingExposure,
    };
    this.updateSubjectFocus(this.subjectFocus);
  }

  applyState(partial) {
    this.state = { ...this.state, ...partial };
    const s = this.state;

    this.keyLight.color.set(s.keyColor);
    this.keyLight.intensity = s.keyIntensity;

    const az = THREE.MathUtils.degToRad(s.keyAzimuth);
    const el = THREE.MathUtils.degToRad(Math.max(5, s.keyElevation));
    const dist = 24;
    this.activeKeyOffset.set(
      dist * Math.cos(el) * Math.cos(az),
      dist * Math.sin(el),
      dist * Math.cos(el) * Math.sin(az)
    );
    this.activeFillOffset.set(
      -dist * Math.cos(el) * Math.cos(az),
      Math.max(6, dist * 0.45),
      -dist * Math.cos(el) * Math.sin(az)
    );

    this.fillLight.color.set(s.fillColor);
    this.fillLight.intensity = s.fillIntensity;

    this.rimLight.color.set(s.rimColor);
    this.activeRimBase = s.rimIntensity;
    this.rimLight.intensity = s.rimIntensity;

    const ambientVal = s.blackoutMode ? 0.04 : Math.max(0.02, s.ambientIntensity);
    this.ambientLight.groundColor.set(s.ambientColor);
    this.ambientLight.intensity = ambientVal;

    this.scene.environmentIntensity = THREE.MathUtils.clamp(ambientVal * 1.45, 0.1, 2.8);
    this.renderer.toneMappingExposure = s.exposure;

    if (this.studioFloorMat) {
      this.studioFloorMat.roughness = THREE.MathUtils.clamp(
        1.0 - s.floorWetness * 0.94,
        0.04,
        0.85
      );
    }

    if (this.softboxMat) {
      const bri = s.softboxIntensity || 2.5;
      this.softboxMat.color.setRGB(bri, bri, bri);
    }

    this.studioRimBars.forEach((bar, idx) => {
      const c = idx % 2 === 0 ? s.rimColor : s.fillColor;
      bar.material.color.set(c);
      bar.material.emissive.set(c);
    });

    this.updateSubjectFocus(this.subjectFocus);
  }

  applyOutdoorSolarState({ sunColor, sunIntensity, azimuth, elevation, fogColor, fogDensity }) {
    const az = THREE.MathUtils.degToRad(azimuth);
    const el = THREE.MathUtils.degToRad(Math.max(6, elevation));
    const dist = 42;
    this.activeKeyOffset.set(
      dist * Math.cos(el) * Math.cos(az),
      dist * Math.sin(el),
      dist * Math.cos(el) * Math.sin(az)
    );
    this.keyLight.color.copy(sunColor);
    this.keyLight.intensity = sunIntensity;
    this.scene.fog.color.copy(fogColor);
    this.scene.fog.density = fogDensity;
    this.updateSubjectFocus(this.subjectFocus);
  }

  update(dt, elapsed, speedActive = true) {
    if (this.state.lightSweep) {
      this.sweepLight.position.set(
        this.subjectFocus.x + Math.cos(elapsed * 0.5) * 2.5,
        this.subjectFocus.y + 7.5,
        this.subjectFocus.z + Math.sin(elapsed * 0.8) * 6.0
      );
      this.sweepLight.intensity = 0.5 + this.beatPulse * 0.5;
    } else {
      this.sweepLight.intensity = 0;
    }

    // Preserve active scene's rim light baseline while adding subtle audio beat pulse
    this.rimLight.intensity = this.activeRimBase + this.beatPulse * 0.55;

    if (this.cyberTunnelGroup.visible && speedActive) {
      for (let i = 0; i < this.tunnelArches.length; i++) {
        const arch = this.tunnelArches[i];
        arch.position.z += dt * 32.0;
        if (arch.position.z > 95) arch.position.z -= 192;
      }
    }

    if (this.cloudDeckGroup.visible) {
      for (let i = 0; i < this.flightClouds.length; i++) {
        const c = this.flightClouds[i];
        c.position.z += dt * 24.0;
        if (c.position.z > 110) c.position.z = -110;
      }
    }

    if (this.runwayGroup.visible) {
      for (let i = 0; i < this.runwayStrobes.length; i++) {
        const item = this.runwayStrobes[i];
        if (speedActive) {
          item.mesh.position.z += dt * 28.0;
          if (item.mesh.position.z > 120) item.mesh.position.z -= 240;
        }
      }
    }
  }
}

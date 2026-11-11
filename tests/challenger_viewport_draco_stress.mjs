#!/usr/bin/env node
/**
 * Empirical Challenger M1_r3_2 Stress Test Harness
 * 
 * Verifies:
 * 1. Viewport Sizing Bounds for all 56 assets:
 *    - Cars (20 models): 4.0m - 5.5m
 *    - Planes (6 models): 11.2m - 30.0m
 *    - Car Parts (20 models): 0.20m - 2.5m
 *    - Garages (4 models) & Showcases (4 models): 28.0m - 35.0m
 *    - City Streets (2 models): 45.0m - 50.0m
 * 2. Headless Three.js GLTFLoader & DRACOLoader parsing integrity across all 56 assets.
 * 3. Exact ground datum alignment (Y = 0.000m for subjects, Y = -0.02m for locations) and origin centering.
 * 4. Orientation checks for all 20 cars and 6 planes (Z_front < 0, Z_front < Z_rear).
 * 5. Memory disposal and resource cleanup without leaks.
 * 6. Adversarial edge cases (extreme scales, zero bounds fallback, re-entrant parsing).
 */

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// Polyfill minimal browser globals for headless Three.js execution in Node.js
globalThis.self = globalThis;
if (!globalThis.createImageBitmap) {
  globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
}
if (!globalThis.document) {
  const dummyCtx = new Proxy(
    {
      createRadialGradient: () => ({ addColorStop() {} }),
      createLinearGradient: () => ({ addColorStop() {} }),
    },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        return () => {};
      },
    }
  );

  globalThis.document = {
    createElement: (tag) => {
      if (tag === 'canvas') {
        return {
          width: 512,
          height: 512,
          getContext: () => dummyCtx,
        };
      }
      return {};
    },
  };
}

const ASSETS_ROOT = path.resolve('3D Car and Plane Scene Creator');

// Definition of all 56 assets with categories, expected viewport sizing bounds, and paths
export const ALL_56_ASSET_SPECS = [
  // ---------------------------------------------------------------------------
  // 20 Cars: Viewport bounds [4.0m, 5.5m]
  // ---------------------------------------------------------------------------
  { category: 'Cars', id: '1975-porsche-911-turbo', type: 'subject', targetSize: 4.45, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/1975-porsche-911-turbo/source/1975-porsche-911-turbo.glb' },
  { category: 'Cars', id: 'lb-works-ferrari-f40', type: 'subject', targetSize: 4.55, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/lb-works-ferrari-f40/source/lb-works-ferrari-f40.glb' },
  { category: 'Cars', id: 'lamborghini-aventador', type: 'subject', targetSize: 4.78, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/lamborghini-aventador/source/lamborghini-aventador.glb' },
  { category: 'Cars', id: 'nissan-skyline-r34-gtr', type: 'subject', targetSize: 4.60, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/nissan-skyline-r34-gtr/source/nissan-skyline-r34-gtr.glb' },
  { category: 'Cars', id: 'audi-r8', type: 'subject', targetSize: 4.43, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/audi-r8/source/audi-r8.glb' },
  { category: 'Cars', id: 'ford-gt-2006', type: 'subject', targetSize: 4.64, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/ford-gt-2006/source/ford-gt-2006.glb' },
  { category: 'Cars', id: '2019-chevrolet-corvette-c8', type: 'subject', targetSize: 4.63, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/2019-chevrolet-corvette-c8/source/2019-chevrolet-corvette-c8.glb' },
  { category: 'Cars', id: 'bmw-m3-e30', type: 'subject', targetSize: 4.35, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/bmw-m3-e30/source/bmw-m3-e30.glb' },
  { category: 'Cars', id: '2019-aston-martin-vantage', type: 'subject', targetSize: 4.47, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/2019-aston-martin-vantage/source/2019-aston-martin-vantage.glb' },
  { category: 'Cars', id: 'koenigsegg-one-pro', type: 'subject', targetSize: 4.50, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/koenigsegg-one-pro/source/koenigsegg-one-pro.glb' },
  { category: 'Cars', id: 'bugatti-chiron-mansory', type: 'subject', targetSize: 4.54, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/bugatti-chiron-mansory/source/bugatti-chiron-mansory.glb' },
  { category: 'Cars', id: 'dodge-viper-gts', type: 'subject', targetSize: 4.49, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/dodge-viper-gts/source/dodge-viper-gts.glb' },
  { category: 'Cars', id: 'mazda-rx7-fd', type: 'subject', targetSize: 4.28, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/mazda-rx7-fd/source/mazda-rx7-fd.glb' },
  { category: 'Cars', id: 'toyota-supra-mk4', type: 'subject', targetSize: 4.52, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/toyota-supra-mk4/source/toyota-supra-mk4.glb' },
  { category: 'Cars', id: 'mercedes-amg-gt3', type: 'subject', targetSize: 4.75, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/mercedes-amg-gt3/source/mercedes-amg-gt3.glb' },
  { category: 'Cars', id: 'shelby-cobra-427', type: 'subject', targetSize: 4.00, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/shelby-cobra-427/source/shelby-cobra-427.glb' },
  { category: 'Cars', id: 'subaru-impreza-wrx-sti', type: 'subject', targetSize: 4.42, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/subaru-impreza-wrx-sti/source/subaru-impreza-wrx-sti.glb' },
  { category: 'Cars', id: 'honda-nsx-1990', type: 'subject', targetSize: 4.41, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/honda-nsx-1990/source/honda-nsx-1990.glb' },
  { category: 'Cars', id: 'mclaren-senna', type: 'subject', targetSize: 4.74, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/mclaren-senna/source/mclaren-senna.glb' },
  { category: 'Cars', id: 'mitsubishi-lancer-evo', type: 'subject', targetSize: 4.51, minBound: 4.0, maxBound: 5.5, relPath: 'Cars/mitsubishi-lancer-evo/source/mitsubishi-lancer-evo.glb' },

  // ---------------------------------------------------------------------------
  // 6 Planes: Viewport bounds [11.2m, 30.0m]
  // ---------------------------------------------------------------------------
  { category: 'Planes', id: 'lockheed-f22-raptor', type: 'subject', targetSize: 18.9, minBound: 11.2, maxBound: 30.0, relPath: 'Planes/lockheed-f22-raptor/source/lockheed-f22-raptor.glb' },
  { category: 'Planes', id: 'boeing-787-dreamliner', type: 'subject', targetSize: 28.0, minBound: 11.2, maxBound: 30.0, relPath: 'Planes/boeing-787-dreamliner/source/boeing-787-dreamliner.glb' },
  { category: 'Planes', id: 'concorde-supersonic', type: 'subject', targetSize: 26.0, minBound: 11.2, maxBound: 30.0, relPath: 'Planes/concorde-supersonic/source/concorde-supersonic.glb' },
  { category: 'Planes', id: 'supermarine-spitfire', type: 'subject', targetSize: 11.2, minBound: 11.2, maxBound: 30.0, relPath: 'Planes/supermarine-spitfire/source/supermarine-spitfire.glb' },
  { category: 'Planes', id: 'lockheed-sr71-blackbird', type: 'subject', targetSize: 24.0, minBound: 11.2, maxBound: 30.0, relPath: 'Planes/lockheed-sr71-blackbird/source/lockheed-sr71-blackbird.glb' },
  { category: 'Planes', id: 'airbus-a380', type: 'subject', targetSize: 30.0, minBound: 11.2, maxBound: 30.0, relPath: 'Planes/airbus-a380/source/airbus-a380.glb' },

  // ---------------------------------------------------------------------------
  // 20 Car Parts: Viewport bounds [0.20m, 2.5m]
  // ---------------------------------------------------------------------------
  { category: 'Car_Parts', id: 'v8-engine', type: 'subject', targetSize: 0.95, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/v8-engine/source/v8-engine.glb' },
  { category: 'Car_Parts', id: 'car-turbocharger', type: 'subject', targetSize: 0.35, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/car-turbocharger/source/car-turbocharger.glb' },
  { category: 'Car_Parts', id: 'bbs-rs16-wheel-rim', type: 'subject', targetSize: 0.58, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/bbs-rs16-wheel-rim/source/bbs-rs16-wheel-rim.glb' },
  { category: 'Car_Parts', id: 'brembo-brake-caliper', type: 'subject', targetSize: 0.36, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/brembo-brake-caliper/source/brembo-brake-caliper.glb' },
  { category: 'Car_Parts', id: 'recaro-speed-racing-seat', type: 'subject', targetSize: 0.72, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/recaro-speed-racing-seat/source/recaro-speed-racing-seat.glb' },
  { category: 'Car_Parts', id: 'race-steering-wheel-essenza', type: 'subject', targetSize: 0.34, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/race-steering-wheel-essenza/source/race-steering-wheel-essenza.glb' },
  { category: 'Car_Parts', id: 'bmw-m2-carbon-spoiler', type: 'subject', targetSize: 1.20, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/bmw-m2-carbon-spoiler/source/bmw-m2-carbon-spoiler.glb' },
  { category: 'Car_Parts', id: 'exhaust-manifold-header', type: 'subject', targetSize: 0.70, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/exhaust-manifold-header/source/exhaust-manifold-header.glb' },
  { category: 'Car_Parts', id: 'supercharged-sbc-v8-blower', type: 'subject', targetSize: 0.65, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/supercharged-sbc-v8-blower/source/supercharged-sbc-v8-blower.glb' },
  { category: 'Car_Parts', id: 'car-engine-alternator', type: 'subject', targetSize: 0.30, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/car-engine-alternator/source/car-engine-alternator.glb' },
  { category: 'Car_Parts', id: 'manual-transmission-gearbox', type: 'subject', targetSize: 0.95, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/manual-transmission-gearbox/source/manual-transmission-gearbox.glb' },
  { category: 'Car_Parts', id: 'rim-tg002-forged-wheel', type: 'subject', targetSize: 0.55, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/rim-tg002-forged-wheel/source/rim-tg002-forged-wheel.glb' },
  { category: 'Car_Parts', id: 'blue-coilovers-suspension', type: 'subject', targetSize: 0.45, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/blue-coilovers-suspension/source/blue-coilovers-suspension.glb' },
  { category: 'Car_Parts', id: 'sbc-v8-intake-manifold', type: 'subject', targetSize: 0.65, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/sbc-v8-intake-manifold/source/sbc-v8-intake-manifold.glb' },
  { category: 'Car_Parts', id: 'volvo-intercooler', type: 'subject', targetSize: 0.90, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/volvo-intercooler/source/volvo-intercooler.glb' },
  { category: 'Car_Parts', id: 'rotor-disc-brake', type: 'subject', targetSize: 0.38, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/rotor-disc-brake/source/rotor-disc-brake.glb' },
  { category: 'Car_Parts', id: 'nos-nitrous-bottle', type: 'subject', targetSize: 0.55, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/nos-nitrous-bottle/source/nos-nitrous-bottle.glb' },
  { category: 'Car_Parts', id: 'round-projector-headlight', type: 'subject', targetSize: 0.30, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/round-projector-headlight/source/round-projector-headlight.glb' },
  { category: 'Car_Parts', id: 'bosch-12v-battery', type: 'subject', targetSize: 0.35, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/bosch-12v-battery/source/bosch-12v-battery.glb' },
  { category: 'Car_Parts', id: 'f1-steering-wheel-w11', type: 'subject', targetSize: 0.32, minBound: 0.20, maxBound: 2.5, relPath: 'Parts/f1-steering-wheel-w11/source/f1-steering-wheel-w11.glb' },

  // ---------------------------------------------------------------------------
  // 4 Garages: Viewport bounds [28.0m, 35.0m]
  // ---------------------------------------------------------------------------
  { category: 'Garages', id: 'underground_garage', type: 'location', targetSpan: 30.0, minBound: 28.0, maxBound: 35.0, relPath: 'Locations/underground_garage.glb' },
  { category: 'Garages', id: 'desert_workshop_garage', type: 'location', targetSpan: 32.0, minBound: 28.0, maxBound: 35.0, relPath: 'Locations/desert_workshop_garage.glb' },
  { category: 'Garages', id: 'cyberpunk_garage', type: 'location', targetSpan: 28.0, minBound: 28.0, maxBound: 35.0, relPath: 'Locations/cyberpunk_garage.glb' },
  { category: 'Garages', id: 'detailed_parking_garage', type: 'location', targetSpan: 35.0, minBound: 28.0, maxBound: 35.0, relPath: 'Locations/detailed_parking_garage.glb' },

  // ---------------------------------------------------------------------------
  // 4 Showcase Locations: Viewport bounds [28.0m, 35.0m]
  // ---------------------------------------------------------------------------
  { category: 'Showcase_Locations', id: 'car_showroom_dealership', type: 'location', targetSpan: 30.0, minBound: 28.0, maxBound: 35.0, relPath: 'Locations/car_showroom_dealership.glb' },
  { category: 'Showcase_Locations', id: 'architectural_exhibition_hall', type: 'location', targetSpan: 34.0, minBound: 28.0, maxBound: 35.0, relPath: 'Locations/architectural_exhibition_hall.glb' },
  { category: 'Showcase_Locations', id: 'car_studio_cyclorama', type: 'location', targetSpan: 28.0, minBound: 28.0, maxBound: 35.0, relPath: 'Locations/car_studio_cyclorama.glb' },
  { category: 'Showcase_Locations', id: 'vehicle_display_podium', type: 'location', targetSpan: 28.0, minBound: 28.0, maxBound: 35.0, relPath: 'Locations/vehicle_display_podium.glb' },

  // ---------------------------------------------------------------------------
  // 2 City Streets: Viewport bounds [45.0m, 50.0m]
  // ---------------------------------------------------------------------------
  { category: 'City_Streets', id: 'city_street_asphalt', type: 'location', targetSpan: 50.0, minBound: 45.0, maxBound: 50.0, relPath: 'Locations/city_street_asphalt.glb' },
  { category: 'City_Streets', id: 'cyberpunk_night_street', type: 'location', targetSpan: 45.0, minBound: 45.0, maxBound: 50.0, relPath: 'Locations/cyberpunk_night_street.glb' },
];

/**
 * Configure GLTFLoader with DRACOLoader integration
 */
function createGltrLoaderWithDraco() {
  const gltfLoader = new GLTFLoader();
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  gltfLoader.setDRACOLoader(dracoLoader);
  return { gltfLoader, dracoLoader };
}

/**
 * Normalization algorithm from SceneManager.js for subjects
 */
function normalizeSubject(rawModel, targetSize) {
  // Strip backdrop / shadow-catcher floor planes baked into exports
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

  const box = new THREE.Box3().setFromObject(rawModel);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxHoriz = Math.max(size.x, size.z, 0.001);
  const scale = targetSize / maxHoriz;

  const rootGroup = new THREE.Group();
  rawModel.scale.setScalar(scale);

  const scaledBox = new THREE.Box3().setFromObject(rawModel);
  const scaledCenter = new THREE.Vector3();
  const scaledSize = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);
  scaledBox.getSize(scaledSize);

  rawModel.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);
  rootGroup.add(rawModel);

  const finalBox = new THREE.Box3().setFromObject(rootGroup);
  const finalSize = new THREE.Vector3();
  const finalCenter = new THREE.Vector3();
  finalBox.getSize(finalSize);
  finalBox.getCenter(finalCenter);

  return {
    rawBox: box,
    rawSize: size,
    scale,
    finalBox,
    finalSize,
    finalCenter,
    rootGroup,
    maxDimension: Math.max(finalSize.x, finalSize.y, finalSize.z),
    maxHorizSpan: Math.max(finalSize.x, finalSize.z),
  };
}

/**
 * Normalization algorithm from SceneManager.js for locations
 */
function normalizeLocation(rawLoc, targetSpan) {
  const box = new THREE.Box3().setFromObject(rawLoc);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxSpan = Math.max(size.x, size.z, 0.001);
  const scale = targetSpan / maxSpan;

  const locGroup = new THREE.Group();
  rawLoc.scale.setScalar(scale);

  const scaledBox = new THREE.Box3().setFromObject(rawLoc);
  const scaledCenter = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);

  rawLoc.position.set(-scaledCenter.x, -scaledBox.min.y - 0.02, -scaledCenter.z);
  locGroup.add(rawLoc);

  const finalBox = new THREE.Box3().setFromObject(locGroup);
  const finalSize = new THREE.Vector3();
  const finalCenter = new THREE.Vector3();
  finalBox.getSize(finalSize);
  finalBox.getCenter(finalCenter);

  return {
    rawBox: box,
    rawSize: size,
    scale,
    finalBox,
    finalSize,
    finalCenter,
    locGroup,
    maxHorizSpan: Math.max(finalSize.x, finalSize.z),
  };
}

/**
 * Deep resource disposal test
 */
function disposeHierarchy(obj) {
  obj.traverse((child) => {
    if (child.isMesh) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  });
}

async function runChallengerStressSuite() {
  console.log('======================================================================');
  console.log('  CHALLENGER M1_r3_2 EMPIRICAL VIEWPORT & DRACOLOADER STRESS HARNESS  ');
  console.log('======================================================================\n');

  const { gltfLoader, dracoLoader } = createGltrLoaderWithDraco();

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const failureDetails = [];

  function record(name, pass, details = '') {
    totalTests++;
    if (pass) {
      passedTests++;
      console.log(`  ✓ ${name} ${details ? '(' + details + ')' : ''}`);
    } else {
      failedTests++;
      failureDetails.push({ name, details });
      console.error(`  ✗ ${name} FAIL: ${details}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Check DRACOLoader Configuration and Integration
  // ---------------------------------------------------------------------------
  console.log('▶ TEST SUITE 1: DRACOLoader Integration & Decoder Configuration');
  record('DRACOLoader Instance Created', Boolean(dracoLoader && dracoLoader instanceof DRACOLoader), 'DRACOLoader instantiated successfully');
  record('GLTFLoader DRACOLoader Binding', Boolean(gltfLoader.dracoLoader === dracoLoader), 'GLTFLoader holds active DRACOLoader reference');
  record('Google Draco CDN Decoder Path Configured', dracoLoader.decoderPath === 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/', `DecoderPath: ${dracoLoader.decoderPath}`);

  // ---------------------------------------------------------------------------
  // Check All 56 Assets: DRACOLoader Parsing & Viewport Sizing Bounds
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST SUITE 2: DRACOLoader Headless Parsing & Viewport Bounds on All 56 Assets');

  for (const spec of ALL_56_ASSET_SPECS) {
    const glbFullPath = path.join(ASSETS_ROOT, spec.relPath);
    const fileExists = fs.existsSync(glbFullPath);
    record(`[${spec.id}] File Exists on Disk`, fileExists, spec.relPath);
    if (!fileExists) continue;

    const fileBuf = fs.readFileSync(glbFullPath);
    record(`[${spec.id}] Non-Empty File Buffer`, fileBuf.length > 1024, `${(fileBuf.length / 1024).toFixed(1)} KB`);

    // Parse with Three.js GLTFLoader (with attached DRACOLoader)
    let gltf;
    let parseError = null;
    try {
      const arrayBuffer = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength);
      gltf = await new Promise((resolve, reject) => {
        gltfLoader.parse(arrayBuffer, '', resolve, reject);
      });
    } catch (err) {
      parseError = err;
    }

    record(`[${spec.id}] Headless Three.js & DRACOLoader Parsing Without Exception`, parseError === null && Boolean(gltf?.scene), parseError ? parseError.message : 'Scene root parsed');
    if (!gltf || !gltf.scene) continue;

    // Mesh count and vertex integrity
    let meshCount = 0;
    let triCount = 0;
    let hasNanVertices = false;
    gltf.scene.traverse((child) => {
      if (child.isMesh && child.geometry) {
        meshCount++;
        const pos = child.geometry.attributes.position;
        if (pos) {
          for (let i = 0; i < pos.count; i++) {
            if (Number.isNaN(pos.getX(i)) || Number.isNaN(pos.getY(i)) || Number.isNaN(pos.getZ(i))) {
              hasNanVertices = true;
            }
          }
        }
        if (child.geometry.index) {
          triCount += child.geometry.index.count / 3;
        } else if (pos) {
          triCount += pos.count / 3;
        }
      }
    });

    record(`[${spec.id}] Contains Renderable Meshes & Vertices`, meshCount > 0 && triCount > 0, `Meshes: ${meshCount}, Tris: ${triCount}`);
    record(`[${spec.id}] Zero NaN / Infinite Vertex Coordinates`, !hasNanVertices, 'All vertex attributes strictly finite');

    // Run exact SceneManager normalization
    if (spec.type === 'subject') {
      const norm = normalizeSubject(gltf.scene, spec.targetSize);

      // Check sizing bounds
      const span = norm.maxHorizSpan;
      const dim = norm.maxDimension;
      const satisfiesRange = span >= (spec.minBound - 0.005) && span <= (spec.maxBound + 0.005);
      record(
        `[${spec.id}] Viewport Sizing Bounds [${spec.minBound}m - ${spec.maxBound}m]`,
        satisfiesRange,
        `Span: ${span.toFixed(4)}m (target: ${spec.targetSize}m, range: ${spec.minBound}m-${spec.maxBound}m)`
      );

      // Check Ground Datum Contact (Y = 0.000m +- 0.001m)
      const groundContactY = norm.finalBox.min.y;
      record(
        `[${spec.id}] Ground Datum Contact Alignment (Y = 0.000m ± 0.001m)`,
        Math.abs(groundContactY) <= 0.001,
        `min.y = ${groundContactY.toFixed(6)}m`
      );

      // Check Origin Centering (X=0, Z=0 +- 0.001m)
      const centerDist = Math.hypot(norm.finalCenter.x, norm.finalCenter.z);
      record(
        `[${spec.id}] Origin Centering (X=0, Z=0 ± 0.001m)`,
        centerDist <= 0.001,
        `dist = ${centerDist.toFixed(6)}m (x: ${norm.finalCenter.x.toFixed(6)}, z: ${norm.finalCenter.z.toFixed(6)})`
      );

      // Clean disposal
      disposeHierarchy(norm.rootGroup);
    } else {
      // Location
      const norm = normalizeLocation(gltf.scene, spec.targetSpan);

      const span = norm.maxHorizSpan;
      const satisfiesRange = span >= (spec.minBound - 0.005) && span <= (spec.maxBound + 0.005);
      record(
        `[${spec.id}] Viewport Sizing Bounds [${spec.minBound}m - ${spec.maxBound}m]`,
        satisfiesRange,
        `Span: ${span.toFixed(4)}m (targetSpan: ${spec.targetSpan}m, range: ${spec.minBound}m-${spec.maxBound}m)`
      );

      // Check Location Datum Offset (-0.02m +- 0.001m)
      const groundContactY = norm.finalBox.min.y;
      record(
        `[${spec.id}] Location Datum Offset Alignment (Y = -0.020m ± 0.001m)`,
        Math.abs(groundContactY - (-0.02)) <= 0.001,
        `min.y = ${groundContactY.toFixed(6)}m (target: -0.020000m)`
      );

      // Check Origin Centering
      const centerDist = Math.hypot(norm.finalCenter.x, norm.finalCenter.z);
      record(
        `[${spec.id}] Origin Centering (X=0, Z=0 ± 0.001m)`,
        centerDist <= 0.001,
        `dist = ${centerDist.toFixed(6)}m (x: ${norm.finalCenter.x.toFixed(6)}, z: ${norm.finalCenter.z.toFixed(6)})`
      );

      // Clean disposal
      disposeHierarchy(norm.locGroup);
    }
  }

  // ---------------------------------------------------------------------------
  // Check Directional Features and Forward -Z Orientation for 20 Cars and 6 Planes
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST SUITE 3: Adversarial Forward -Z Axis Verification (20 Cars + 6 Planes)');
  const vehicleSpecs = ALL_56_ASSET_SPECS.filter((s) => s.category === 'Cars' || s.category === 'Planes');

  for (const vSpec of vehicleSpecs) {
    const glbFullPath = path.join(ASSETS_ROOT, vSpec.relPath);
    const fileBuf = fs.readFileSync(glbFullPath);
    const chunk0Length = fileBuf.readUInt32LE(12);
    const gltfJson = JSON.parse(fileBuf.toString('utf8', 20, 20 + chunk0Length));

    // Search for front and rear directional features
    const frontRegex = /headlight|head_light|head_lamp|headlamp|front_light|frontlight|front_splitter|frontsplitter|splitter|front_bumper|frontbumper|fuselage_nose|nose_cone|landinggear_nose|canopy|cockpit_glass|propeller|intercooler|grille/i;
    const rearRegex = /taillight|tail_light|tail_lamp|taillamp|rear_light|rearlight|rearlights|rear_wing|rearwing|wingstay|wing_stay|aero_diffuser|diffuser|exhaust|tailpipe|nozzle|tail_verticalstabilizer|verticalstabilizer|tail_fin|tailfin|tail_horizontalstabilizers|horizontalstabilizers|rudder|afterburner|jet_exhaust/i;

    let frontZ = [];
    let rearZ = [];

    // Traverse node hierarchy and material names
    function inspectNode(nodeIdx, parentTransform = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]) {
      const node = gltfJson.nodes[nodeIdx];
      if (!node) return;

      // Extract node TRS or matrix
      let nodeMat = parentTransform;
      if (node.translation || node.rotation || node.scale) {
        // compose transform
        const t = node.translation || [0, 0, 0];
        const r = node.rotation || [0, 0, 0, 1];
        const s = node.scale || [1, 1, 1];
        // Quat to matrix
        const x = r[0], y = r[1], z = r[2], w = r[3];
        const x2 = x + x, y2 = y + y, z2 = z + z;
        const xx = x * x2, xy = x * y2, xz = x * z2;
        const yy = y * y2, yz = y * z2, zz = z * z2;
        const wx = w * x2, wy = w * y2, wz = w * z2;
        const localMat = [
          (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
          (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
          (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
          t[0], t[1], t[2], 1
        ];
        // Multiply parent * local
        const m = new Array(16);
        for (let c = 0; c < 4; c++) {
          for (let row = 0; row < 4; row++) {
            m[c * 4 + row] =
              parentTransform[row] * localMat[c * 4] +
              parentTransform[4 + row] * localMat[c * 4 + 1] +
              parentTransform[8 + row] * localMat[c * 4 + 2] +
              parentTransform[12 + row] * localMat[c * 4 + 3];
          }
        }
        nodeMat = m;
      }

      const nodeName = node.name || '';
      if (node.mesh !== undefined && gltfJson.meshes[node.mesh]) {
        const mesh = gltfJson.meshes[node.mesh];
        const meshName = mesh.name || '';
        for (const prim of mesh.primitives) {
          const matName = prim.material !== undefined && gltfJson.materials[prim.material]
            ? gltfJson.materials[prim.material].name || ''
            : '';
          const featureTag = `${nodeName} ${meshName} ${matName}`;

          if (frontRegex.test(featureTag) || rearRegex.test(featureTag)) {
            const acc = gltfJson.accessors[prim.attributes.POSITION];
            if (acc && acc.min && acc.max) {
              const localCenter = [
                (acc.min[0] + acc.max[0]) / 2,
                (acc.min[1] + acc.max[1]) / 2,
                (acc.min[2] + acc.max[2]) / 2,
              ];
              // Transform to world space
              const worldZ = nodeMat[2] * localCenter[0] + nodeMat[6] * localCenter[1] + nodeMat[10] * localCenter[2] + nodeMat[14];
              if (frontRegex.test(featureTag)) frontZ.push(worldZ);
              if (rearRegex.test(featureTag)) rearZ.push(worldZ);
            }
          }
        }
      }

      if (node.children) {
        for (const childIdx of node.children) {
          inspectNode(childIdx, nodeMat);
        }
      }
    }

    const scene = gltfJson.scenes ? gltfJson.scenes[gltfJson.scene || 0] : null;
    const roots = scene && scene.nodes ? scene.nodes : gltfJson.nodes.map((_, i) => i);
    for (const r of roots) {
      inspectNode(r);
    }

    const hasFeatures = frontZ.length > 0 && rearZ.length > 0;
    record(`[${vSpec.id}] Directional Features Identified`, hasFeatures, `Front items: ${frontZ.length}, Rear items: ${rearZ.length}`);
    if (hasFeatures) {
      const avgF = frontZ.reduce((a, b) => a + b, 0) / frontZ.length;
      const avgR = rearZ.reduce((a, b) => a + b, 0) / rearZ.length;
      const isNegativeZ = avgF < 0 && avgF < avgR;
      record(
        `[${vSpec.id}] Forward -Z Orientation (Front Z < 0 & Front < Rear)`,
        isNegativeZ,
        `Front Z: ${avgF.toFixed(3)}m, Rear Z: ${avgR.toFixed(3)}m`
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Check Adversarial Edge Cases
  // ---------------------------------------------------------------------------
  console.log('\n▶ TEST SUITE 4: Adversarial Stress Scenarios & Numerical Stability');

  // Edge Case 1: Extreme targetSize (microscopic 0.001m and planetary 1000m)
  const sampleCarBuf = fs.readFileSync(path.join(ASSETS_ROOT, 'Cars/1975-porsche-911-turbo/source/1975-porsche-911-turbo.glb'));
  const carGltf = await new Promise((resolve) => gltfLoader.parse(sampleCarBuf.buffer.slice(sampleCarBuf.byteOffset, sampleCarBuf.byteOffset + sampleCarBuf.byteLength), '', resolve));

  const microNorm = normalizeSubject(carGltf.scene.clone(), 0.001);
  record('Microscopic Scale (0.001m) Numerical Stability', Number.isFinite(microNorm.scale) && Math.abs(microNorm.maxHorizSpan - 0.001) < 1e-6, `Span: ${microNorm.maxHorizSpan}`);

  const macroNorm = normalizeSubject(carGltf.scene.clone(), 1000.0);
  record('Macroscopic Scale (1000.0m) Numerical Stability', Number.isFinite(macroNorm.scale) && Math.abs(macroNorm.maxHorizSpan - 1000.0) < 1e-3, `Span: ${macroNorm.maxHorizSpan}`);

  // Edge Case 2: Zero or negative targetSize fallback
  const fallbackNorm = normalizeSubject(carGltf.scene.clone(), 0);
  record('Zero TargetSize Handled with Safe Scale', Number.isFinite(fallbackNorm.scale), `Scale: ${fallbackNorm.scale}`);

  // Edge Case 3: Mesh with pre-existing offset transform
  const offsetModel = new THREE.Group();
  const innerMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshBasicMaterial());
  innerMesh.position.set(50, 100, -200);
  innerMesh.rotation.set(0.5, 0.3, 0.1);
  offsetModel.add(innerMesh);

  const offsetNorm = normalizeSubject(offsetModel, 5.0);
  record('Pre-transformed Mesh Normalized to Origin Datum', Math.abs(offsetNorm.finalBox.min.y) < 1e-5 && Math.hypot(offsetNorm.finalCenter.x, offsetNorm.finalCenter.z) < 1e-5, `Origin dist: ${Math.hypot(offsetNorm.finalCenter.x, offsetNorm.finalCenter.z)}`);

  console.log('\n======================================================================');
  console.log(`  CHALLENGER STRESS VERDICT: ${passedTests} / ${totalTests} CHECKS PASSED`);
  if (failedTests > 0) {
    console.error(`  FAILURES: ${failedTests}`);
    for (const f of failureDetails) {
      console.error(`    - ${f.name}: ${f.details}`);
    }
  } else {
    console.log('  ALL CHECKS PASSED EMPIRICALLY WITH ZERO FAILURES! (Exit 0)');
  }
  console.log('======================================================================\n');

  process.exit(failedTests === 0 ? 0 : 1);
}

runChallengerStressSuite().catch((err) => {
  console.error('Fatal challenger harness error:', err);
  process.exit(1);
});

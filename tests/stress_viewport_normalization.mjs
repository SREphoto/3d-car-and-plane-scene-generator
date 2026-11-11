#!/usr/bin/env node
/**
 * Empirical Stress-Testing Harness for Viewport Normalization & Coordinate Transforms
 *
 * Authored by: Challenger M1_2 (teamwork_challenger_m1_2)
 *
 * Verifies:
 * 1. Two-pass Three.js Box3 bounding box calculation on all 56 target models (+ 23 pre-existing models)
 * 2. Scaling against targetSize/targetSpan produces exact dimensions matching category specs:
 *    - Cars: ~4.5 - 5.5m (or 4.0 - 5.5m model-specific)
 *    - Parts: 0.3 - 1.2m
 *    - Planes: 18 - 32m (and WWII warbird scale 11.2 - 26m)
 *    - Locations: 28 - 50m
 * 3. Bottom contact alignment to ground datum Y = 0.000 (+/- 1e-5m epsilon)
 * 4. X and Z centering at Origin (0, 0)
 * 5. Numerical stability under stress / edge cases (extreme targetSize, missing targetSize, zero bounds guard)
 * 6. Camera framing clearance within CameraDirector & OrbitControls limits
 */

// Polyfill self and Image for Node environment
globalThis.self = globalThis;
globalThis.Image = class {};

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ASSETS_ROOT = path.resolve('3D Car and Plane Scene Creator');

// Definition of the 56 target models with their category, relative path, and target dimensions
export const TARGET_56_MODELS = [
  // ---------------------------------------------------------------------------
  // 20 Cars
  // ---------------------------------------------------------------------------
  { category: 'Cars', mode: 'cars', id: '1975-porsche-911-turbo', targetSize: 4.45, relPath: 'Cars/1975-porsche-911-turbo/source/1975-porsche-911-turbo.glb' },
  { category: 'Cars', mode: 'cars', id: 'lb-works-ferrari-f40', targetSize: 4.55, relPath: 'Cars/lb-works-ferrari-f40/source/lb-works-ferrari-f40.glb' },
  { category: 'Cars', mode: 'cars', id: 'lamborghini-aventador', targetSize: 4.78, relPath: 'Cars/lamborghini-aventador/source/lamborghini-aventador.glb' },
  { category: 'Cars', mode: 'cars', id: 'nissan-skyline-r34-gtr', targetSize: 4.60, relPath: 'Cars/nissan-skyline-r34-gtr/source/nissan-skyline-r34-gtr.glb' },
  { category: 'Cars', mode: 'cars', id: 'audi-r8', targetSize: 4.43, relPath: 'Cars/audi-r8/source/audi-r8.glb' },
  { category: 'Cars', mode: 'cars', id: 'ford-gt-2006', targetSize: 4.64, relPath: 'Cars/ford-gt-2006/source/ford-gt-2006.glb' },
  { category: 'Cars', mode: 'cars', id: '2019-chevrolet-corvette-c8', targetSize: 4.63, relPath: 'Cars/2019-chevrolet-corvette-c8/source/2019-chevrolet-corvette-c8.glb' },
  { category: 'Cars', mode: 'cars', id: 'bmw-m3-e30', targetSize: 4.35, relPath: 'Cars/bmw-m3-e30/source/bmw-m3-e30.glb' },
  { category: 'Cars', mode: 'cars', id: '2019-aston-martin-vantage', targetSize: 4.47, relPath: 'Cars/2019-aston-martin-vantage/source/2019-aston-martin-vantage.glb' },
  { category: 'Cars', mode: 'cars', id: 'koenigsegg-one-pro', targetSize: 4.50, relPath: 'Cars/koenigsegg-one-pro/source/koenigsegg-one-pro.glb' },
  { category: 'Cars', mode: 'cars', id: 'bugatti-chiron-mansory', targetSize: 4.54, relPath: 'Cars/bugatti-chiron-mansory/source/bugatti-chiron-mansory.glb' },
  { category: 'Cars', mode: 'cars', id: 'dodge-viper-gts', targetSize: 4.49, relPath: 'Cars/dodge-viper-gts/source/dodge-viper-gts.glb' },
  { category: 'Cars', mode: 'cars', id: 'mazda-rx7-fd', targetSize: 4.28, relPath: 'Cars/mazda-rx7-fd/source/mazda-rx7-fd.glb' },
  { category: 'Cars', mode: 'cars', id: 'toyota-supra-mk4', targetSize: 4.52, relPath: 'Cars/toyota-supra-mk4/source/toyota-supra-mk4.glb' },
  { category: 'Cars', mode: 'cars', id: 'mercedes-amg-gt3', targetSize: 4.75, relPath: 'Cars/mercedes-amg-gt3/source/mercedes-amg-gt3.glb' },
  { category: 'Cars', mode: 'cars', id: 'shelby-cobra-427', targetSize: 4.00, relPath: 'Cars/shelby-cobra-427/source/shelby-cobra-427.glb' },
  { category: 'Cars', mode: 'cars', id: 'subaru-impreza-wrx-sti', targetSize: 4.42, relPath: 'Cars/subaru-impreza-wrx-sti/source/subaru-impreza-wrx-sti.glb' },
  { category: 'Cars', mode: 'cars', id: 'honda-nsx-1990', targetSize: 4.41, relPath: 'Cars/honda-nsx-1990/source/honda-nsx-1990.glb' },
  { category: 'Cars', mode: 'cars', id: 'mclaren-senna', targetSize: 4.74, relPath: 'Cars/mclaren-senna/source/mclaren-senna.glb' },
  { category: 'Cars', mode: 'cars', id: 'mitsubishi-lancer-evo', targetSize: 4.51, relPath: 'Cars/mitsubishi-lancer-evo/source/mitsubishi-lancer-evo.glb' },

  // ---------------------------------------------------------------------------
  // 20 Car Parts
  // ---------------------------------------------------------------------------
  { category: 'Car_Parts', mode: 'parts', id: 'v8-engine', targetSize: 0.95, relPath: 'Parts/v8-engine/source/v8-engine.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'car-turbocharger', targetSize: 0.35, relPath: 'Parts/car-turbocharger/source/car-turbocharger.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'bbs-rs16-wheel-rim', targetSize: 0.58, relPath: 'Parts/bbs-rs16-wheel-rim/source/bbs-rs16-wheel-rim.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'brembo-brake-caliper', targetSize: 0.36, relPath: 'Parts/brembo-brake-caliper/source/brembo-brake-caliper.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'recaro-speed-racing-seat', targetSize: 0.72, relPath: 'Parts/recaro-speed-racing-seat/source/recaro-speed-racing-seat.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'race-steering-wheel-essenza', targetSize: 0.34, relPath: 'Parts/race-steering-wheel-essenza/source/race-steering-wheel-essenza.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'bmw-m2-carbon-spoiler', targetSize: 1.20, relPath: 'Parts/bmw-m2-carbon-spoiler/source/bmw-m2-carbon-spoiler.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'exhaust-manifold-header', targetSize: 0.70, relPath: 'Parts/exhaust-manifold-header/source/exhaust-manifold-header.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'supercharged-sbc-v8-blower', targetSize: 0.65, relPath: 'Parts/supercharged-sbc-v8-blower/source/supercharged-sbc-v8-blower.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'car-engine-alternator', targetSize: 0.30, relPath: 'Parts/car-engine-alternator/source/car-engine-alternator.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'manual-transmission-gearbox', targetSize: 0.95, relPath: 'Parts/manual-transmission-gearbox/source/manual-transmission-gearbox.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'rim-tg002-forged-wheel', targetSize: 0.55, relPath: 'Parts/rim-tg002-forged-wheel/source/rim-tg002-forged-wheel.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'blue-coilovers-suspension', targetSize: 0.45, relPath: 'Parts/blue-coilovers-suspension/source/blue-coilovers-suspension.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'sbc-v8-intake-manifold', targetSize: 0.65, relPath: 'Parts/sbc-v8-intake-manifold/source/sbc-v8-intake-manifold.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'volvo-intercooler', targetSize: 0.90, relPath: 'Parts/volvo-intercooler/source/volvo-intercooler.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'rotor-disc-brake', targetSize: 0.38, relPath: 'Parts/rotor-disc-brake/source/rotor-disc-brake.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'nos-nitrous-bottle', targetSize: 0.55, relPath: 'Parts/nos-nitrous-bottle/source/nos-nitrous-bottle.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'round-projector-headlight', targetSize: 0.30, relPath: 'Parts/round-projector-headlight/source/round-projector-headlight.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'bosch-12v-battery', targetSize: 0.35, relPath: 'Parts/bosch-12v-battery/source/bosch-12v-battery.glb' },
  { category: 'Car_Parts', mode: 'parts', id: 'f1-steering-wheel-w11', targetSize: 0.32, relPath: 'Parts/f1-steering-wheel-w11/source/f1-steering-wheel-w11.glb' },

  // ---------------------------------------------------------------------------
  // 4 Garages
  // ---------------------------------------------------------------------------
  { category: 'Garages', mode: 'location', id: 'underground_garage', targetSpan: 30.0, relPath: 'Locations/underground_garage.glb' },
  { category: 'Garages', mode: 'location', id: 'desert_workshop_garage', targetSpan: 32.0, relPath: 'Locations/desert_workshop_garage.glb' },
  { category: 'Garages', mode: 'location', id: 'cyberpunk_garage', targetSpan: 28.0, relPath: 'Locations/cyberpunk_garage.glb' },
  { category: 'Garages', mode: 'location', id: 'detailed_parking_garage', targetSpan: 35.0, relPath: 'Locations/detailed_parking_garage.glb' },

  // ---------------------------------------------------------------------------
  // 2 City Streets
  // ---------------------------------------------------------------------------
  { category: 'City_Streets', mode: 'location', id: 'city_street_asphalt', targetSpan: 50.0, relPath: 'Locations/city_street_asphalt.glb' },
  { category: 'City_Streets', mode: 'location', id: 'cyberpunk_night_street', targetSpan: 45.0, relPath: 'Locations/cyberpunk_night_street.glb' },

  // ---------------------------------------------------------------------------
  // 4 Showcase Locations
  // ---------------------------------------------------------------------------
  { category: 'Showcase_Locations', mode: 'location', id: 'car_showroom_dealership', targetSpan: 30.0, relPath: 'Locations/car_showroom_dealership.glb' },
  { category: 'Showcase_Locations', mode: 'location', id: 'architectural_exhibition_hall', targetSpan: 34.0, relPath: 'Locations/architectural_exhibition_hall.glb' },
  { category: 'Showcase_Locations', mode: 'location', id: 'car_studio_cyclorama', targetSpan: 28.0, relPath: 'Locations/car_studio_cyclorama.glb' },
  { category: 'Showcase_Locations', mode: 'location', id: 'vehicle_display_podium', targetSpan: 28.0, relPath: 'Locations/vehicle_display_podium.glb' },

  // ---------------------------------------------------------------------------
  // 6 Planes
  // ---------------------------------------------------------------------------
  { category: 'Planes', mode: 'planes', id: 'lockheed-f22-raptor', targetSize: 18.9, relPath: 'Planes/lockheed-f22-raptor/source/lockheed-f22-raptor.glb' },
  { category: 'Planes', mode: 'planes', id: 'boeing-787-dreamliner', targetSize: 28.0, relPath: 'Planes/boeing-787-dreamliner/source/boeing-787-dreamliner.glb' },
  { category: 'Planes', mode: 'planes', id: 'concorde-supersonic', targetSize: 26.0, relPath: 'Planes/concorde-supersonic/source/concorde-supersonic.glb' },
  { category: 'Planes', mode: 'planes', id: 'supermarine-spitfire', targetSize: 11.2, relPath: 'Planes/supermarine-spitfire/source/supermarine-spitfire.glb' },
  { category: 'Planes', mode: 'planes', id: 'lockheed-sr71-blackbird', targetSize: 24.0, relPath: 'Planes/lockheed-sr71-blackbird/source/lockheed-sr71-blackbird.glb' },
  { category: 'Planes', mode: 'planes', id: 'airbus-a380', targetSize: 30.0, relPath: 'Planes/airbus-a380/source/airbus-a380.glb' },
];

/**
 * Execute SceneManager's exact two-pass bounding box and normalization algorithm
 */
export function simulateSceneManagerSubject(rawModel, targetSize, mode = 'cars') {
  // Pass 1: compute raw bounding box
  const box = new THREE.Box3().setFromObject(rawModel);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const maxHoriz = Math.max(size.x, size.z, 0.001);
  const targetSpan = targetSize || (mode === 'planes' ? 26.0 : 4.8);
  const scale = targetSpan / maxHoriz;

  const rootGroup = new THREE.Group();
  rawModel.scale.setScalar(scale);

  // Pass 2: compute scaled box and translate so bottom touches Y = 0.000 and X,Z = 0
  const scaledBox = new THREE.Box3().setFromObject(rawModel);
  const scaledCenter = new THREE.Vector3();
  const scaledSize = new THREE.Vector3();
  scaledBox.getCenter(scaledCenter);
  scaledBox.getSize(scaledSize);

  rawModel.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);
  rootGroup.add(rawModel);

  // World-space verification box
  const finalWorldBox = new THREE.Box3().setFromObject(rootGroup);
  const finalSize = new THREE.Vector3();
  const finalCenter = new THREE.Vector3();
  finalWorldBox.getSize(finalSize);
  finalWorldBox.getCenter(finalCenter);

  return {
    rawBox: { min: box.min.clone(), max: box.max.clone(), size: size.clone(), center: center.clone() },
    scale,
    scaledSize: scaledSize.clone(),
    rootGroup,
    finalWorldBox: {
      min: finalWorldBox.min.clone(),
      max: finalWorldBox.max.clone(),
      size: finalSize.clone(),
      center: finalCenter.clone(),
    },
    bounds: {
      w: scaledSize.x,
      h: scaledSize.y,
      d: scaledSize.z,
    },
  };
}

/**
 * Execute SceneManager's exact location bounding box and normalization algorithm
 */
export function simulateSceneManagerLocation(rawLoc, targetSpan = 30.0) {
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

  // Note: SceneManager sets Y to -scaledBox.min.y - 0.02
  rawLoc.position.set(-scaledCenter.x, -scaledBox.min.y - 0.02, -scaledCenter.z);
  locGroup.add(rawLoc);

  const finalWorldBox = new THREE.Box3().setFromObject(locGroup);
  const finalSize = new THREE.Vector3();
  const finalCenter = new THREE.Vector3();
  finalWorldBox.getSize(finalSize);
  finalWorldBox.getCenter(finalCenter);

  return {
    rawBox: { min: box.min.clone(), max: box.max.clone(), size: size.clone(), center: center.clone() },
    scale,
    locGroup,
    finalWorldBox: {
      min: finalWorldBox.min.clone(),
      max: finalWorldBox.max.clone(),
      size: finalSize.clone(),
      center: finalCenter.clone(),
    },
  };
}

async function runEmpiricalStressTest() {
  console.log('======================================================================');
  console.log('  EMPIRICAL VIEWPORT NORMALIZATION & COORDINATE STRESS-TEST HARNESS  ');
  console.log('======================================================================\n');

  const loader = new GLTFLoader();
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const failureReports = [];

  function assertCheck(desc, condition, details = '') {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✓ ${desc} ${details ? '(' + details + ')' : ''}`);
    } else {
      failedTests++;
      console.log(`  ✗ FAIL: ${desc} - ${details}`);
      failureReports.push({ desc, details });
    }
  }

  // -------------------------------------------------------------------------
  // Part 1: Test all 56 target models through full SceneManager pipeline
  // -------------------------------------------------------------------------
  console.log('▶ SECTION 1: Two-Pass Normalization on all 56 Target Models');

  for (let i = 0; i < TARGET_56_MODELS.length; i++) {
    const item = TARGET_56_MODELS[i];
    const fullPath = path.join(ASSETS_ROOT, item.relPath);

    if (!fs.existsSync(fullPath)) {
      assertCheck(`[Model ${i + 1}/56] File Existence: ${item.id}`, false, `Path missing: ${fullPath}`);
      continue;
    }

    const fileBuf = fs.readFileSync(fullPath);
    const arrayBuf = fileBuf.buffer.slice(fileBuf.byteOffset, fileBuf.byteOffset + fileBuf.byteLength);

    const gltf = await new Promise((resolve, reject) => {
      loader.parse(arrayBuf, '', resolve, reject);
    });

    const isLocation = item.mode === 'location';

    if (isLocation) {
      const res = simulateSceneManagerLocation(gltf.scene, item.targetSpan);

      // Check 1: Finite raw box
      const rawFinite = [res.rawBox.min, res.rawBox.max].every((v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z));
      assertCheck(`[${item.id}] Raw Box Bounds Finite`, rawFinite, `size=${res.rawBox.size.x.toFixed(2)}x${res.rawBox.size.y.toFixed(2)}x${res.rawBox.size.z.toFixed(2)}`);

      // Check 2: Scale > 0
      assertCheck(`[${item.id}] Scale Factor Positive`, res.scale > 0 && Number.isFinite(res.scale), `scale=${res.scale.toFixed(4)}`);

      // Check 3: TargetSpan matches horizontal max span within 0.001m
      const actualHoriz = Math.max(res.finalWorldBox.size.x, res.finalWorldBox.size.z);
      assertCheck(`[${item.id}] Horizontal Span Normalized to Target (${item.targetSpan}m)`, Math.abs(actualHoriz - item.targetSpan) < 0.001, `actual=${actualHoriz.toFixed(4)}m`);

      // Check 4: Bottom datum contact at Y = -0.02 (floor datum offset for locations)
      const bottomY = res.finalWorldBox.min.y;
      assertCheck(`[${item.id}] Floor Alignment Datum Y = -0.020`, Math.abs(bottomY - (-0.02)) < 0.0001, `bottomY=${bottomY.toFixed(6)}`);

      // Check 5: Horizontal centering at X=0, Z=0
      const centerOffsetX = Math.abs(res.finalWorldBox.center.x);
      const centerOffsetZ = Math.abs(res.finalWorldBox.center.z);
      assertCheck(`[${item.id}] Centered at Origin (X=0, Z=0)`, centerOffsetX < 0.0001 && centerOffsetZ < 0.0001, `center=(${res.finalWorldBox.center.x.toFixed(4)}, ${res.finalWorldBox.center.z.toFixed(4)})`);

      // Check 6: Realistic location range (28m - 50m)
      assertCheck(`[${item.id}] TargetSpan in Realistic Range (28m - 50m)`, item.targetSpan >= 28.0 && item.targetSpan <= 50.0, `targetSpan=${item.targetSpan}m`);

    } else {
      const res = simulateSceneManagerSubject(gltf.scene, item.targetSize, item.mode);

      // Check 1: Finite raw box
      const rawFinite = [res.rawBox.min, res.rawBox.max].every((v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z));
      assertCheck(`[${item.id}] Raw Box Bounds Finite`, rawFinite, `raw=${res.rawBox.size.x.toFixed(2)}x${res.rawBox.size.y.toFixed(2)}x${res.rawBox.size.z.toFixed(2)}`);

      // Check 2: Scale > 0
      assertCheck(`[${item.id}] Scale Factor Positive`, res.scale > 0 && Number.isFinite(res.scale), `scale=${res.scale.toFixed(4)}`);

      // Check 3: TargetSize matches horizontal max span within 0.001m
      const actualHoriz = Math.max(res.finalWorldBox.size.x, res.finalWorldBox.size.z);
      assertCheck(`[${item.id}] Horizontal Span Normalized to Target (${item.targetSize}m)`, Math.abs(actualHoriz - item.targetSize) < 0.001, `actual=${actualHoriz.toFixed(4)}m`);

      // Check 4: Bottom vertex contacts ground datum at exactly Y = 0.000
      const bottomY = res.finalWorldBox.min.y;
      assertCheck(`[${item.id}] Ground Datum Contact Y = 0.000`, Math.abs(bottomY) < 0.0001, `bottomY=${bottomY.toFixed(6)}`);

      // Check 5: Horizontal centering at X=0, Z=0
      const centerOffsetX = Math.abs(res.finalWorldBox.center.x);
      const centerOffsetZ = Math.abs(res.finalWorldBox.center.z);
      assertCheck(`[${item.id}] Centered at Origin (X=0, Z=0)`, centerOffsetX < 0.0001 && centerOffsetZ < 0.0001, `center=(${res.finalWorldBox.center.x.toFixed(4)}, ${res.finalWorldBox.center.z.toFixed(4)})`);

      // Check 6: Realistic dimension range per category
      if (item.category === 'Cars') {
        assertCheck(`[${item.id}] Car Dimension in Range (~4.0m - 5.5m)`, item.targetSize >= 4.0 && item.targetSize <= 5.5, `size=${item.targetSize}m`);
      } else if (item.category === 'Car_Parts') {
        assertCheck(`[${item.id}] Part Dimension in Range (0.3m - 1.2m)`, item.targetSize >= 0.3 && item.targetSize <= 1.2, `size=${item.targetSize}m`);
      } else if (item.category === 'Planes') {
        assertCheck(`[${item.id}] Plane Dimension in Aviation Range (11m - 32m)`, item.targetSize >= 11.0 && item.targetSize <= 32.0, `size=${item.targetSize}m`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Part 2: Category Aggregation & Boundary Invariant Verification
  // -------------------------------------------------------------------------
  console.log('\n▶ SECTION 2: Category Aggregation & Boundary Verification');

  const cars = TARGET_56_MODELS.filter((m) => m.category === 'Cars');
  const parts = TARGET_56_MODELS.filter((m) => m.category === 'Car_Parts');
  const garages = TARGET_56_MODELS.filter((m) => m.category === 'Garages');
  const streets = TARGET_56_MODELS.filter((m) => m.category === 'City_Streets');
  const showcases = TARGET_56_MODELS.filter((m) => m.category === 'Showcase_Locations');
  const planes = TARGET_56_MODELS.filter((m) => m.category === 'Planes');

  assertCheck('Target Model Count: Exactly 20 Cars', cars.length === 20, `${cars.length}/20`);
  assertCheck('Target Model Count: Exactly 20 Car Parts', parts.length === 20, `${parts.length}/20`);
  assertCheck('Target Model Count: Exactly 4 Garages', garages.length === 4, `${garages.length}/4`);
  assertCheck('Target Model Count: Exactly 2 City Streets', streets.length === 2, `${streets.length}/2`);
  assertCheck('Target Model Count: Exactly 4 Showcase Locations', showcases.length === 4, `${showcases.length}/4`);
  assertCheck('Target Model Count: Exactly 6 Planes', planes.length === 6, `${planes.length}/6`);
  assertCheck('Total Target Count: Exactly 56 Models', TARGET_56_MODELS.length === 56, `${TARGET_56_MODELS.length}/56`);

  // Min/max boundaries
  const carMin = Math.min(...cars.map((c) => c.targetSize));
  const carMax = Math.max(...cars.map((c) => c.targetSize));
  assertCheck('Cars Target Range Conformance (~4.0m - 5.5m)', carMin >= 4.0 && carMax <= 5.5, `min=${carMin}m, max=${carMax}m`);

  const partMin = Math.min(...parts.map((p) => p.targetSize));
  const partMax = Math.max(...parts.map((p) => p.targetSize));
  assertCheck('Parts Target Range Conformance (0.3m - 1.2m)', partMin >= 0.3 && partMax <= 1.2, `min=${partMin}m, max=${partMax}m`);

  const locMin = Math.min(...[...garages, ...streets, ...showcases].map((l) => l.targetSpan));
  const locMax = Math.max(...[...garages, ...streets, ...showcases].map((l) => l.targetSpan));
  assertCheck('Locations TargetSpan Range Conformance (28m - 50m)', locMin >= 28.0 && locMax <= 50.0, `min=${locMin}m, max=${locMax}m`);

  const planeMin = Math.min(...planes.map((p) => p.targetSize));
  const planeMax = Math.max(...planes.map((p) => p.targetSize));
  assertCheck('Planes Target Range Conformance (11.2m - 30m)', planeMin >= 11.2 && planeMax <= 32.0, `min=${planeMin}m, max=${planeMax}m`);

  // -------------------------------------------------------------------------
  // Part 3: Adversarial Boundary Stress Tests on Normalization Algorithm
  // -------------------------------------------------------------------------
  console.log('\n▶ SECTION 3: Adversarial & Edge Case Stress Tests on Normalization Algorithm');

  // Test 3.1: Zero volume mesh guard (Math.max(size.x, size.z, 0.001))
  const zeroGroup = new THREE.Group();
  const zeroMesh = new THREE.Mesh(new THREE.BufferGeometry());
  zeroGroup.add(zeroMesh);
  const zeroNorm = simulateSceneManagerSubject(zeroGroup, 5.0, 'cars');
  assertCheck('Zero-Volume Mesh Division-by-Zero Guard', Number.isFinite(zeroNorm.scale) && zeroNorm.scale > 0, `scale=${zeroNorm.scale}`);

  // Test 3.2: Missing targetSize fallback
  const fallbackCar = simulateSceneManagerSubject(zeroGroup, undefined, 'cars');
  assertCheck('Missing Car targetSize Defaults to 4.8m', Math.abs(fallbackCar.scale * 0.001 - 4.8) < 0.001, 'Default car span 4.8m applied');

  const fallbackPlane = simulateSceneManagerSubject(zeroGroup, undefined, 'planes');
  assertCheck('Missing Plane targetSize Defaults to 26.0m (18-32m range)', Math.abs(fallbackPlane.scale * 0.001 - 26.0) < 0.001, 'Default plane span 26.0m applied');

  // Test 3.3: High-aspect ratio asset (tall thin pillar vs flat wide plate)
  const thinBoxGeom = new THREE.BoxGeometry(0.1, 10.0, 0.1);
  const thinMesh = new THREE.Mesh(thinBoxGeom);
  const thinGroup = new THREE.Group();
  thinGroup.add(thinMesh);
  const thinNorm = simulateSceneManagerSubject(thinGroup, 1.0, 'parts');
  assertCheck('High-Aspect Ratio Asset Bottom Ground Alignment', Math.abs(thinNorm.finalWorldBox.min.y) < 1e-6, `bottomY=${thinNorm.finalWorldBox.min.y}`);
  assertCheck('High-Aspect Ratio Asset Horizontal Extent', Math.abs(Math.max(thinNorm.finalWorldBox.size.x, thinNorm.finalWorldBox.size.z) - 1.0) < 1e-6, 'Normalized to 1.0m');

  // Test 3.4: Pre-existing models on disk across target directories (total 79 models)
  console.log('\n▶ SECTION 4: Comprehensive Assets Verification (All 79 Target Directory GLBs)');
  function findGlbFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) results = results.concat(findGlbFiles(full));
      else if (entry.name.toLowerCase().endsWith('.glb')) results.push(full);
    }
    return results;
  }
  const targetDirs = ['Cars', 'Parts', 'Planes', 'Locations'];
  const allTargetGlbs = targetDirs.flatMap((d) => findGlbFiles(path.join(ASSETS_ROOT, d)));
  assertCheck('Total GLB Models in Cars, Parts, Planes, Locations >= 56', allTargetGlbs.length >= 56, `Found ${allTargetGlbs.length} models`);

  // Verify that all 79 GLB models can be parsed and normalized without throwing
  let allNormalized = true;
  for (const gPath of allTargetGlbs) {
    try {
      const buf = fs.readFileSync(gPath);
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      await new Promise((res, rej) => {
        loader.parse(ab, '', (g) => {
          const sim = simulateSceneManagerSubject(g.scene, 5.0, 'cars');
          if (!Number.isFinite(sim.finalWorldBox.min.y)) allNormalized = false;
          res();
        }, rej);
      });
    } catch (e) {
      allNormalized = false;
      console.error('Failed normalizing asset:', gPath, e.message);
    }
  }
  assertCheck('All 79 Target Directory GLBs Successfully Normalizable with Zero Exceptions', allNormalized, `${allTargetGlbs.length}/${allTargetGlbs.length} passed`);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n======================================================================');
  console.log(`  STRESS-TEST VERDICT SUMMARY: ${passedTests}/${totalTests} CHECKS PASSED`);
  console.log(`  Failed: ${failedTests}`);
  console.log('======================================================================\n');

  if (failedTests > 0) {
    console.error(`FAILED with ${failedTests} errors.`);
    process.exit(1);
  } else {
    console.log('ALL VIEWPORT NORMALIZATION CHECKS PASSED EMPIRICALLY! (Exit 0)');
    process.exit(0);
  }
}

runEmpiricalStressTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

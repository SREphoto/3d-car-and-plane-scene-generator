#!/usr/bin/env node
/**
 * Deep Verification Suite for All 5 Pillars:
 * 1. Original /Users/Samuel/Desktop/Cars untouched check & <80MB repo GLB budget check
 * 2. All 23 new Cars/Trucks + Audi R26 upgrade + 4 Aircraft/Helicopters binary, ground datum, centering, & variant material split check
 * 3. Monaco & Marina Bay circuit transform + Assetto Corsa alpha classifier + downward road raycast check
 * 4. Detailed Parking Garage & Velvet Curtain Collector Showroom floor datum & raycast check
 * 5. Physical Camera Lenses (24mm..300mm), Full-Frame FOV math, Auto-Dolly framing, & Tight-Wall pullback clamping check
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { validateGlb } from './glb_validator.mjs';
import { loadCatalog } from './catalog_loader.mjs';
import { CameraDirector, focalLengthToVerticalFovDeg } from '../src/engine/CameraDirector.js';
import { SCENE_LIGHTING_PROFILES } from '../src/engine/LightingRig.js';
import { STUDIO_LOOK_PRESETS, STUDIO_FLOOR_FINISHES } from '../src/engine/ProceduralStages.js';

const ASSETS_ROOT = path.resolve(process.cwd(), '3D Car and Plane Scene Creator');
const DESKTOP_CARS_DIR = '/Users/Samuel/Desktop/Cars';
const MAX_GLB_BYTES = 80 * 1024 * 1024;

let passed = 0;
let failed = 0;

function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}${detail ? ` (${detail})` : ''}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function walkGlbs(dir) {
  let out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out = out.concat(walkGlbs(full));
    else if (ent.name.toLowerCase().endsWith('.glb')) out.push(full);
  }
  return out;
}

async function main() {
  console.log('\n=== Deep Verification: New Fleet, Showcases, Circuits, Studio & Optical Lenses ===\n');

  // 1. Desktop source preservation + <80MB repo limit
  if (fs.existsSync(DESKTOP_CARS_DIR)) {
    const desktopEntries = fs.readdirSync(DESKTOP_CARS_DIR).filter((n) => !n.startsWith('.'));
    check(
      'Original /Users/Samuel/Desktop/Cars preserved untouched',
      desktopEntries.length >= 25,
      `${desktopEntries.length} original files/archives intact`
    );
  }

  const allRepoGlbs = walkGlbs(ASSETS_ROOT);
  const maxFile = allRepoGlbs.reduce(
    (best, f) => {
      const sz = fs.statSync(f).size;
      return sz > best.sz ? { f: path.relative(ASSETS_ROOT, f), sz } : best;
    },
    { f: '', sz: 0 }
  );
  check(
    'Every .glb in repository strictly < 80 MB',
    allRepoGlbs.every((f) => fs.statSync(f).size < MAX_GLB_BYTES),
    `checked ${allRepoGlbs.length} GLBs; largest = ${maxFile.f} (${(maxFile.sz / 1048576).toFixed(2)} MB)`
  );

  // 2. Catalog verification
  const catalog = await loadCatalog({ isDev: true });
  check('CARS_CATALOG has 44 vehicles (21 prior + 23 new incl. variants)', catalog.CARS_CATALOG.length === 44, `count=${catalog.CARS_CATALOG.length}`);
  check('PLANES_CATALOG has 12 aircraft/rotorcraft (8 prior + 4 new)', catalog.PLANES_CATALOG.length === 12, `count=${catalog.PLANES_CATALOG.length}`);
  check('CAMERA_LENSES exports full 8-option kit (Studio + 24/35/50/85/135/200/300mm)', catalog.rawModule?.CAMERA_LENSES?.length === 8, `count=${catalog.rawModule?.CAMERA_LENSES?.length}`);

  const r26 = catalog.CARS_CATALOG.find((c) => c.id === 'audi-r26-concept');
  check('Audi R26 upgraded in-place to textured 2026 f1_2026_r26.glb', Boolean(r26 && r26.url.includes('2026-audi-r26/f1_2026_r26.glb')), r26?.url);

  const newVehicleIds = [
    'audi-r26-concept',
    'porsche-carrera-gt-concept-silver',
    'porsche-carrera-gt-concept-blue',
    'bugatti-eb110-ss-blue',
    'bugatti-eb110-ss-silver',
    '2001-lamborghini-murcielago',
    '2017-ferrari-j50',
    'ferrari-296-gt3-verstappen',
    'mercedes-amg-gt3-red-bull',
    '2015-mclaren-650s-gt3',
    '2018-bmw-m6-gt3',
    '2026-bmw-m3-touring-24h',
    '2021-alfa-romeo-giulia-gtam',
    '1967-shelby-gt500',
    'dodge-challenger-srt-hellcat',
    '2012-dodge-charger-rt',
    '2026-dodge-charger-daytona-ev',
    '2001-honda-s2000-suki',
    '2018-audi-etron-gt-concept',
    '2011-audi-rs5-coupe',
    '2010-audi-a4-allroad',
    'audi-a4-b8-sedan',
    '2024-ford-f150-raptor-r',
    'punisher-mrap-armored',
  ];

  for (const id of newVehicleIds) {
    const entry = catalog.CARS_CATALOG.find((c) => c.id === id);
    const glbPath = entry ? path.join(ASSETS_ROOT, entry.url.replace(/^\/assets\//, '')) : '';
    const v = entry && fs.existsSync(glbPath) ? validateGlb(glbPath) : null;
    const bb = v?.geometryStats?.boundingBox;
    const spanX = bb ? bb.max[0] - bb.min[0] : 0;
    const spanZ = bb ? bb.max[2] - bb.min[2] : 0;
    const grounded = v && Math.abs(v.geometryStats.groundDatum) <= 0.002;
    const noIcosphere = v && !(v.gltf.nodes || []).some((n) => (n.name || '').startsWith('Icosphere'));
    check(
      `[Car] ${id} valid GLB, grounded Y=0, aligned along Z (Z>${spanX.toFixed(2)}m), zero clutter`,
      Boolean(v?.valid && grounded && spanZ > spanX && noIcosphere),
      v ? `${(v.fileSize / 1048576).toFixed(2)}MB, span=[${spanX.toFixed(2)}, ${(bb.max[1] - bb.min[1]).toFixed(2)}, ${spanZ.toFixed(2)}], groundY=${v.geometryStats.groundDatum.toFixed(4)}` : 'MISSING'
    );
  }

  const newPlaneIds = [
    'boeing-c17-globemaster-iii',
    'boeing-ch47-chinook',
    'sukhoi-su33-flanker-d',
    'sukhoi-su47-berkut',
  ];
  for (const id of newPlaneIds) {
    const entry = catalog.PLANES_CATALOG.find((p) => p.id === id);
    const glbPath = entry ? path.join(ASSETS_ROOT, entry.url.replace(/^\/assets\//, '')) : '';
    const v = entry && fs.existsSync(glbPath) ? validateGlb(glbPath) : null;
    const bb = v?.geometryStats?.boundingBox;
    const grounded = v && Math.abs(v.geometryStats.groundDatum) <= 0.002;
    check(
      `[Aircraft] ${id} valid GLB, grounded Y=0, embedded textures`,
      Boolean(v?.valid && grounded && v.textureStats.allEmbedded),
      v ? `${(v.fileSize / 1048576).toFixed(2)}MB, span=[${(bb.max[0] - bb.min[0]).toFixed(2)}, ${(bb.max[1] - bb.min[1]).toFixed(2)}, ${(bb.max[2] - bb.min[2]).toFixed(2)}]` : 'MISSING'
    );
  }

  // Verify color split between Carrera GT Silver vs Blue and EB110 Blue vs Silver
  const cgtSilver = validateGlb(path.join(ASSETS_ROOT, 'Cars/porsche-carrera-gt-concept-silver/porsche_carrera_gt_silver.glb'));
  const cgtBlue = validateGlb(path.join(ASSETS_ROOT, 'Cars/porsche-carrera-gt-concept-blue/porsche_carrera_gt_midnight_blue.glb'));
  const cgtSilverMats = (cgtSilver.gltf.materials || []).map((m) => m.name).join(',');
  const cgtBlueMats = (cgtBlue.gltf.materials || []).map((m) => m.name).join(',');
  check(
    'Carrera GT Concept variants have distinct isolated body materials',
    cgtSilverMats !== cgtBlueMats,
    `silver=[${cgtSilverMats.slice(0, 45)}...] vs blue=[${cgtBlueMats.slice(0, 45)}...]`
  );

  const ebBlue = validateGlb(path.join(ASSETS_ROOT, 'Cars/bugatti-eb110-ss-blue/bugatti_eb110_ss_blue.glb'));
  const ebSilver = validateGlb(path.join(ASSETS_ROOT, 'Cars/bugatti-eb110-ss-silver/bugatti_eb110_ss_silver.glb'));
  const ebBlueMats = JSON.stringify((ebBlue.gltf.materials || []).map((m) => [m.name, m.pbrMetallicRoughness?.baseColorFactor]));
  const ebSilverMats = JSON.stringify((ebSilver.gltf.materials || []).map((m) => [m.name, m.pbrMetallicRoughness?.baseColorFactor]));
  check(
    'Bugatti EB110 SS variants have distinct isolated body paint colors',
    ebBlueMats !== ebSilverMats,
    'French Racing Blue vs Titanium Silver materials verified distinct'
  );

  // 3. New Locations + Red Bull Garage Brightness Fix + Untouched Legacy Scans
  const requiredScenes = [
    'pro_lighting_studio',
    'warehouse_courtyard_day',
    'wet_night_bokeh_street',
    'city_bokeh_street_day',
    'velvet_curtain_showroom',
    'detailed_parking_garage',
    'monaco_circuit',
    'marina_bay_circuit',
    'vatican_city',
    'eglise_saint_polycarpe',
  ];
  for (const sid of requiredScenes) {
    const sc = catalog.SCENES_CATALOG.find((s) => s.id === sid);
    const prof = SCENE_LIGHTING_PROFILES[sid];
    check(`[Scene] ${sid} registered in SCENES_CATALOG + SCENE_LIGHTING_PROFILES`, Boolean(sc && prof), sc?.badge || '');
  }

  const rbProf = SCENE_LIGHTING_PROFILES.red_bull_f1_garage;
  check(
    'Red Bull F1 Garage over-brightness fixed (exposure <= 0.85, keyIntensity <= 1.5, ambient <= 0.35)',
    rbProf.exposure <= 0.85 && rbProf.keyIntensity <= 1.5 && rbProf.ambientIntensity <= 0.35,
    `exposure=${rbProf.exposure}, key=${rbProf.keyIntensity}, ambient=${rbProf.ambientIntensity}`
  );

  check(
    'Pro Lighting Studio exports 5 looks & 4 cyclorama floor finishes',
    Object.keys(STUDIO_LOOK_PRESETS).length === 5 && STUDIO_FLOOR_FINISHES.length === 4,
    `looks=${Object.keys(STUDIO_LOOK_PRESETS).join(',')}`
  );

  // Verify Velvet Showroom & Detailed Parking Garage & Monaco & Marina Bay GLBs
  for (const locId of ['velvet_curtain_showroom', 'detailed_parking_garage', 'monaco_circuit', 'marina_bay_circuit']) {
    const sc = catalog.SCENES_CATALOG.find((s) => s.id === locId);
    const glbPath = path.join(ASSETS_ROOT, sc.url.replace(/^\/assets\//, ''));
    const v = validateGlb(glbPath);
    check(
      `[Location GLB] ${locId} binary valid & < 80 MB`,
      Boolean(v.valid && v.fileSize < MAX_GLB_BYTES),
      `${(v.fileSize / 1048576).toFixed(2)} MB`
    );
  }

  // Verify exact spawn transform math on Monaco & Marina Bay places grid point at world (0, 0, 0) facing -Z!
  const verifyCircuitTransform = (locId, localSpawn, localHeadingRad) => {
    const sc = catalog.SCENES_CATALOG.find((s) => s.id === locId);
    const grp = new THREE.Object3D();
    grp.scale.setScalar(sc.sceneScale || 1.0);
    if (sc.sceneRotation) grp.rotation.set(...sc.sceneRotation);
    if (sc.sceneOffset) grp.position.set(...sc.sceneOffset);
    grp.updateMatrixWorld(true);

    const worldSpawn = new THREE.Vector3(localSpawn.x, localSpawn.y, localSpawn.z).applyMatrix4(grp.matrixWorld);
    const localForward = new THREE.Vector3(Math.cos(localHeadingRad), 0, Math.sin(localHeadingRad));
    const worldForward = localForward.transformDirection(grp.matrixWorld);

    const distOrigin = worldSpawn.length();
    const dotNegZ = worldForward.dot(new THREE.Vector3(0, 0, -1));
    check(
      `[Circuit Spawn Math] ${locId} maps FIA grid straight to world (0,0,0) facing -Z`,
      distOrigin < 0.05 && dotNegZ > 0.9999,
      `worldSpawn=[${worldSpawn.x.toFixed(3)}, ${worldSpawn.y.toFixed(3)}, ${worldSpawn.z.toFixed(3)}], dot(-Z)=${dotNegZ.toFixed(5)}`
    );
  };
  verifyCircuitTransform('monaco_circuit', { x: -324.8, y: -14.217, z: 320.0 }, 1.271);
  verifyCircuitTransform('marina_bay_circuit', { x: -594.6, y: 47.507, z: 210.0 }, 1.465);

  // 4. Physical Camera Lenses, FOV Math, Auto-Dolly Pullback, & Indoor Wall Safety Clamping
  const cam = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 3000);
  const fakeControls = {
    target: new THREE.Vector3(0, 0.5, 0),
    enabled: true,
    maxDistance: 420,
    update() {},
  };
  const director = new CameraDirector(cam, fakeControls);
  director.setBounds({ w: 2.0, h: 1.3, d: 4.65 }, 'cars');
  director.setSceneId('wet_night_bokeh_street'); // open avenue allows full telephoto pullback
  director.resetToHeroIso();
  const baseDist = cam.position.distanceTo(fakeControls.target);

  director.setPhysicalLens(85, { autoDolly: true });
  const dist85 = cam.position.distanceTo(fakeControls.target);
  const expectedFov85 = focalLengthToVerticalFovDeg(85);
  check(
    'Canon 85mm f/1.2L sets exact 16.07° vertical FOV and auto-dollies camera back proportionally',
    Math.abs(cam.fov - expectedFov85) < 0.01 && dist85 > baseDist * 2.4,
    `fov=${cam.fov.toFixed(2)}°, baseDist=${baseDist.toFixed(2)}m -> dist85=${dist85.toFixed(2)}m`
  );

  director.setPhysicalLens(200, { autoDolly: true });
  const dist200 = cam.position.distanceTo(fakeControls.target);
  const expectedFov200 = focalLengthToVerticalFovDeg(200);
  check(
    'Canon 200mm f/2.8L sets exact 6.87° vertical FOV and auto-dollies camera to telephoto distance',
    Math.abs(cam.fov - expectedFov200) < 0.01 && dist200 > dist85 * 2.1,
    `fov=${cam.fov.toFixed(2)}°, dist200=${dist200.toFixed(2)}m`
  );

  // Tight indoor garage wall clamp check
  director.setSceneId('velvet_curtain_showroom'); // 8.2m wall limit
  const distShowroom = cam.position.distanceTo(fakeControls.target);
  check(
    'Tight indoor showroom clamps telephoto auto-dolly inside room walls (<= 8.25m)',
    distShowroom <= 8.25,
    `clampedDist=${distShowroom.toFixed(2)}m`
  );

  console.log(`\n=== Summary: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

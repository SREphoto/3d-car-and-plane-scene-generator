/**
 * Empirical Challenger Stress Harness
 * 
 * Performs direct binary-level inspection of all 56 GLB assets:
 * 1. Raw glTF node hierarchy and TRS matrix decomposition
 * 2. True vertex-level world-space bounding boxes and ground datum (Y = 0.000m +- 0.002m)
 * 3. Directional vector verification (Z_front < 0 and Z_front < Z_rear)
 * 4. Topological similarity and diversity matrices
 */

import fs from 'node:fs';
import path from 'node:path';

const CAR_IDS = [
  '1975-porsche-911-turbo', 'lb-works-ferrari-f40', 'lamborghini-aventador', 'nissan-skyline-r34-gtr',
  'audi-r8', 'ford-gt-2006', '2019-chevrolet-corvette-c8', 'bmw-m3-e30', '2019-aston-martin-vantage',
  'koenigsegg-one-pro', 'bugatti-chiron-mansory', 'dodge-viper-gts', 'mazda-rx7-fd', 'toyota-supra-mk4',
  'mercedes-amg-gt3', 'shelby-cobra-427', 'subaru-impreza-wrx-sti', 'honda-nsx-1990', 'mclaren-senna',
  'mitsubishi-lancer-evo'
];

const PLANE_IDS = [
  'lockheed-f22-raptor', 'boeing-787-dreamliner', 'concorde-supersonic', 'supermarine-spitfire',
  'lockheed-sr71-blackbird', 'airbus-a380'
];

const PART_IDS = [
  'v8-engine', 'car-turbocharger', 'bbs-rs16-wheel-rim', 'brembo-brake-caliper', 'recaro-speed-racing-seat',
  'race-steering-wheel-essenza', 'bmw-m2-carbon-spoiler', 'exhaust-manifold-header', 'supercharged-sbc-v8-blower',
  'car-engine-alternator', 'manual-transmission-gearbox', 'rim-tg002-forged-wheel', 'blue-coilovers-suspension',
  'sbc-v8-intake-manifold', 'volvo-intercooler', 'rotor-disc-brake', 'nos-nitrous-bottle',
  'round-projector-headlight', 'bosch-12v-battery', 'f1-steering-wheel-w11'
];

const LOCATION_IDS = [
  'underground_garage', 'desert_workshop_garage', 'cyberpunk_garage', 'detailed_parking_garage',
  'city_street_asphalt', 'cyberpunk_night_street', 'car_showroom_dealership',
  'architectural_exhibition_hall', 'car_studio_cyclorama', 'vehicle_display_podium'
];

export function composeTRS(t = [0, 0, 0], r = [0, 0, 0, 1], s = [1, 1, 1]) {
  const x = r[0], y = r[1], z = r[2], w = r[3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const sx = s[0], sy = s[1], sz = s[2];
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    t[0], t[1], t[2], 1
  ];
}

export function multiply4x4(a, b) {
  const out = new Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[row] * b[col * 4] +
        a[4 + row] * b[col * 4 + 1] +
        a[8 + row] * b[col * 4 + 2] +
        a[12 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

export function transformVec3(m, v) {
  const x = v[0], y = v[1], z = v[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1.0;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
  ];
}

const FRONT_FEATURE_REGEX = /headlight|head_light|head_lamp|front_light|front_splitter|frontsplitter|splitter|front_bumper|frontbumper|fuselage_nose|nose_cone|landinggear_nose|canopy|cockpit_glass|propeller|intercooler|grille/i;
const REAR_FEATURE_REGEX = /taillight|tail_light|tail_lamp|rear_light|rearlight|rear_wing|rearwing|wingstay|wing_stay|aero_diffuser|diffuser|exhaust|tail_verticalstabilizer|verticalstabilizer|tail_fin|tailfin|tail_horizontalstabilizers|horizontalstabilizers|rear_bumper/i;

export function inspectGlbDeep(filePath) {
  const buf = fs.readFileSync(filePath);
  const magic = buf.readUInt32LE(0);
  const version = buf.readUInt32LE(4);
  const declaredLength = buf.readUInt32LE(8);
  const chunk0Length = buf.readUInt32LE(12);
  const chunk0Type = buf.readUInt32LE(16);

  if (magic !== 0x46546C67 || version !== 2) {
    throw new Error(`Invalid GLB header in ${filePath}`);
  }

  const jsonStr = buf.toString('utf8', 20, 20 + chunk0Length);
  const gltf = JSON.parse(jsonStr);

  const chunk1Offset = 20 + chunk0Length;
  let binBuf = null;
  if (chunk1Offset + 8 <= buf.length) {
    const c1Len = buf.readUInt32LE(chunk1Offset);
    binBuf = buf.subarray(chunk1Offset + 8, chunk1Offset + 8 + c1Len);
  }

  const nodes = gltf.nodes || [];
  const parentMap = {};
  nodes.forEach((n, idx) => {
    (n.children || []).forEach((c) => (parentMap[c] = idx));
  });

  const worldMats = new Array(nodes.length);
  function getWorldMat(idx) {
    if (worldMats[idx]) return worldMats[idx];
    const n = nodes[idx];
    const local = n.matrix ? n.matrix : composeTRS(n.translation, n.rotation, n.scale);
    if (parentMap[idx] !== undefined) {
      worldMats[idx] = multiply4x4(getWorldMat(parentMap[idx]), local);
    } else {
      worldMats[idx] = local;
    }
    return worldMats[idx];
  }

  function getNodeHierarchyNames(idx) {
    const names = [];
    let curr = idx;
    while (curr !== undefined) {
      if (nodes[curr]?.name) names.push(nodes[curr].name);
      curr = parentMap[curr];
    }
    return names.join(' -> ');
  }

  let trueMin = [Infinity, Infinity, Infinity];
  let trueMax = [-Infinity, -Infinity, -Infinity];
  let totalRawVertices = 0;
  let totalTriangles = 0;
  let hasVertices = false;

  const frontFeatures = [];
  const rearFeatures = [];

  for (let nodeIdx = 0; nodeIdx < nodes.length; nodeIdx++) {
    const node = nodes[nodeIdx];
    if (node.mesh === undefined || !gltf.meshes[node.mesh]) continue;
    const mesh = gltf.meshes[node.mesh];
    const wm = getWorldMat(nodeIdx);
    const hierarchyName = `${getNodeHierarchyNames(nodeIdx)} [Mesh: ${mesh.name || ''}]`;

    const isFront = FRONT_FEATURE_REGEX.test(hierarchyName);
    const isRear = REAR_FEATURE_REGEX.test(hierarchyName);

    for (const prim of mesh.primitives || []) {
      // Triangles count
      if (prim.indices !== undefined && gltf.accessors?.[prim.indices]) {
        totalTriangles += Math.floor((gltf.accessors[prim.indices].count || 0) / 3);
      } else if (prim.attributes?.POSITION !== undefined && gltf.accessors?.[prim.attributes.POSITION]) {
        totalTriangles += Math.floor((gltf.accessors[prim.attributes.POSITION].count || 0) / 3);
      }

      if (prim.attributes?.POSITION !== undefined && gltf.accessors?.[prim.attributes.POSITION]) {
        const posAcc = gltf.accessors[prim.attributes.POSITION];
        const count = posAcc.count || 0;
        totalRawVertices += count;
        hasVertices = true;

        let primMinZ = Infinity, primMaxZ = -Infinity;
        let primMinY = Infinity, primMaxY = -Infinity;

        // If bin buffer available, sample raw vertices for absolute precision
        if (binBuf && posAcc.bufferView !== undefined && gltf.bufferViews?.[posAcc.bufferView]) {
          const bv = gltf.bufferViews[posAcc.bufferView];
          const byteOffset = (bv.byteOffset || 0) + (posAcc.byteOffset || 0);
          const byteStride = bv.byteStride || 12;

          for (let vIdx = 0; vIdx < count; vIdx++) {
            const off = byteOffset + vIdx * byteStride;
            if (off + 12 <= binBuf.length) {
              const lx = binBuf.readFloatLE(off);
              const ly = binBuf.readFloatLE(off + 4);
              const lz = binBuf.readFloatLE(off + 8);

              const wx = wm[0] * lx + wm[4] * ly + wm[8] * lz + wm[12];
              const wy = wm[1] * lx + wm[5] * ly + wm[9] * lz + wm[13];
              const wz = wm[2] * lx + wm[6] * ly + wm[10] * lz + wm[14];

              if (wx < trueMin[0]) trueMin[0] = wx;
              if (wx > trueMax[0]) trueMax[0] = wx;
              if (wy < trueMin[1]) trueMin[1] = wy;
              if (wy > trueMax[1]) trueMax[1] = wy;
              if (wz < trueMin[2]) trueMin[2] = wz;
              if (wz > trueMax[2]) trueMax[2] = wz;

              if (wz < primMinZ) primMinZ = wz;
              if (wz > primMaxZ) primMaxZ = wz;
              if (wy < primMinY) primMinY = wy;
              if (wy > primMaxY) primMaxY = wy;
            }
          }
        } else if (Array.isArray(posAcc.min) && Array.isArray(posAcc.max)) {
          // Fallback to transformed 8 corners
          const corners = [
            [posAcc.min[0], posAcc.min[1], posAcc.min[2]],
            [posAcc.min[0], posAcc.min[1], posAcc.max[2]],
            [posAcc.min[0], posAcc.max[1], posAcc.min[2]],
            [posAcc.min[0], posAcc.max[1], posAcc.max[2]],
            [posAcc.max[0], posAcc.min[1], posAcc.min[2]],
            [posAcc.max[0], posAcc.min[1], posAcc.max[2]],
            [posAcc.max[0], posAcc.max[1], posAcc.min[2]],
            [posAcc.max[0], posAcc.max[1], posAcc.max[2]],
          ];
          for (const c of corners) {
            const tc = transformVec3(wm, c);
            for (let d = 0; d < 3; d++) {
              if (tc[d] < trueMin[d]) trueMin[d] = tc[d];
              if (tc[d] > trueMax[d]) trueMax[d] = tc[d];
            }
            if (tc[2] < primMinZ) primMinZ = tc[2];
            if (tc[2] > primMaxZ) primMaxZ = tc[2];
            if (tc[1] < primMinY) primMinY = tc[1];
            if (tc[1] > primMaxY) primMaxY = tc[1];
          }
        }

        if (isFront && Number.isFinite(primMinZ)) {
          frontFeatures.push({ hierarchyName, zMin: primMinZ, zMax: primMaxZ, zMid: (primMinZ + primMaxZ) / 2 });
        }
        if (isRear && Number.isFinite(primMinZ)) {
          rearFeatures.push({ hierarchyName, zMin: primMinZ, zMax: primMaxZ, zMid: (primMinZ + primMaxZ) / 2 });
        }
      }
    }
  }

  const avgFrontZ = frontFeatures.length ? frontFeatures.reduce((acc, f) => acc + f.zMid, 0) / frontFeatures.length : null;
  const avgRearZ = rearFeatures.length ? rearFeatures.reduce((acc, f) => acc + f.zMid, 0) / rearFeatures.length : null;

  let isForwardNegativeZ = null;
  if (avgFrontZ !== null && avgRearZ !== null) {
    isForwardNegativeZ = avgFrontZ < 0 && avgFrontZ < avgRearZ;
  } else if (avgFrontZ !== null) {
    isForwardNegativeZ = avgFrontZ < 0;
  }

  const dims = [
    trueMax[0] - trueMin[0],
    trueMax[1] - trueMin[1],
    trueMax[2] - trueMin[2]
  ];

  return {
    filePath,
    id: path.basename(filePath, '.glb'),
    fileSize: buf.length,
    nodeCount: nodes.length,
    meshCount: gltf.meshes?.length || 0,
    materialCount: gltf.materials?.length || 0,
    vertexCount: totalRawVertices,
    triangleCount: totalTriangles,
    bounds: { min: trueMin, max: trueMax },
    dimensions: dims,
    groundDatum: trueMin[1],
    isGrounded: Math.abs(trueMin[1]) <= 0.002,
    orientation: {
      hasFeatures: frontFeatures.length > 0 || rearFeatures.length > 0,
      frontFeaturesCount: frontFeatures.length,
      rearFeaturesCount: rearFeatures.length,
      avgFrontZ,
      avgRearZ,
      isForwardNegativeZ,
      frontFeaturesSample: frontFeatures.slice(0, 3),
      rearFeaturesSample: rearFeatures.slice(0, 3)
    },
    nodeNames: nodes.map(n => n.name || '').filter(Boolean)
  };
}

export function runFullStressVerification() {
  console.log('================================================================');
  console.log('CHALLENGER EMPIRICAL VERIFICATION HARNESS');
  console.log('Inspecting all 56 GLB assets at true vertex & transform levels');
  console.log('================================================================\n');

  const assets = {
    cars: CAR_IDS.map(id => ({ id, path: `3D Car and Plane Scene Creator/Cars/${id}/source/${id}.glb` })),
    planes: PLANE_IDS.map(id => ({ id, path: `3D Car and Plane Scene Creator/Planes/${id}/source/${id}.glb` })),
    parts: PART_IDS.map(id => ({ id, path: `3D Car and Plane Scene Creator/Parts/${id}/source/${id}.glb` })),
    locations: LOCATION_IDS.map(id => ({ id, path: `3D Car and Plane Scene Creator/Locations/${id}.glb` }))
  };

  const results = {
    cars: [],
    planes: [],
    parts: [],
    locations: []
  };

  let totalInspected = 0;
  let groundFailures = [];
  let orientationFailures = [];

  // 1. CARS VERIFICATION
  console.log('--- 1. CARS VERIFICATION (20 Models) ---');
  for (const item of assets.cars) {
    totalInspected++;
    const res = inspectGlbDeep(item.path);
    results.cars.push(res);

    const groundOk = res.isGrounded;
    const orientOk = res.orientation.isForwardNegativeZ === true;

    if (!groundOk) groundFailures.push({ id: item.id, type: 'car', datum: res.groundDatum });
    if (!orientOk) orientationFailures.push({ id: item.id, type: 'car', orient: res.orientation });

    const statusMark = (groundOk && orientOk) ? '✓ PASS' : '✗ FAIL';
    console.log(`[Car] ${item.id.padEnd(28)} | GroundY: ${res.groundDatum.toFixed(6)}m (${groundOk ? 'OK' : 'FAIL'}) | FrontZ: ${res.orientation.avgFrontZ !== null ? res.orientation.avgFrontZ.toFixed(3) + 'm' : 'NONE'} | RearZ: ${res.orientation.avgRearZ !== null ? res.orientation.avgRearZ.toFixed(3) + 'm' : 'NONE'} | Forward-Z: ${orientOk ? 'YES' : 'NO'} | ${statusMark}`);
  }

  // 2. PLANES VERIFICATION
  console.log('\n--- 2. PLANES VERIFICATION (6 Models) ---');
  for (const item of assets.planes) {
    totalInspected++;
    const res = inspectGlbDeep(item.path);
    results.planes.push(res);

    const groundOk = res.isGrounded;
    const orientOk = res.orientation.isForwardNegativeZ === true;

    if (!groundOk) groundFailures.push({ id: item.id, type: 'plane', datum: res.groundDatum });
    if (!orientOk) orientationFailures.push({ id: item.id, type: 'plane', orient: res.orientation });

    const statusMark = (groundOk && orientOk) ? '✓ PASS' : '✗ FAIL';
    console.log(`[Plane] ${item.id.padEnd(26)} | GroundY: ${res.groundDatum.toFixed(6)}m (${groundOk ? 'OK' : 'FAIL'}) | FrontZ: ${res.orientation.avgFrontZ !== null ? res.orientation.avgFrontZ.toFixed(3) + 'm' : 'NONE'} | RearZ: ${res.orientation.avgRearZ !== null ? res.orientation.avgRearZ.toFixed(3) + 'm' : 'NONE'} | Forward-Z: ${orientOk ? 'YES' : 'NO'} | ${statusMark}`);
  }

  // 3. CAR PARTS VERIFICATION
  console.log('\n--- 3. CAR PARTS VERIFICATION (20 Models) ---');
  for (const item of assets.parts) {
    totalInspected++;
    const res = inspectGlbDeep(item.path);
    results.parts.push(res);

    const groundOk = res.isGrounded;
    if (!groundOk) groundFailures.push({ id: item.id, type: 'part', datum: res.groundDatum });

    const statusMark = groundOk ? '✓ PASS' : '✗ FAIL';
    console.log(`[Part] ${item.id.padEnd(28)} | GroundY: ${res.groundDatum.toFixed(6)}m (${groundOk ? 'OK' : 'FAIL'}) | Size: [${res.dimensions[0].toFixed(2)}, ${res.dimensions[1].toFixed(2)}, ${res.dimensions[2].toFixed(2)}]m | ${statusMark}`);
  }

  // 4. LOCATIONS VERIFICATION
  console.log('\n--- 4. ENVIRONMENT LOCATIONS VERIFICATION (10 Models) ---');
  for (const item of assets.locations) {
    totalInspected++;
    const res = inspectGlbDeep(item.path);
    results.locations.push(res);

    const groundOk = res.isGrounded;
    if (!groundOk) groundFailures.push({ id: item.id, type: 'location', datum: res.groundDatum });

    const statusMark = groundOk ? '✓ PASS' : '✗ FAIL';
    console.log(`[Loc] ${item.id.padEnd(29)} | GroundY: ${res.groundDatum.toFixed(6)}m (${groundOk ? 'OK' : 'FAIL'}) | Span: [${res.dimensions[0].toFixed(1)}, ${res.dimensions[1].toFixed(1)}, ${res.dimensions[2].toFixed(1)}]m | ${statusMark}`);
  }

  // 5. TOPOLOGICAL SIMILARITY & DIVERSITY ANALYSIS
  console.log('\n================================================================');
  console.log('TOPOLOGICAL SIMILARITY & DIVERSITY ANALYSIS');
  console.log('================================================================');

  const carClasses = {
    'Class 1: RearEngine_Fastback': ['1975-porsche-911-turbo'],
    'Class 2: MidEngine_ExtremeWedge': ['lamborghini-aventador', '2019-chevrolet-corvette-c8', 'audi-r8', 'honda-nsx-1990'],
    'Class 3: Boxy_Coupe_Sedan': ['nissan-skyline-r34-gtr', 'bmw-m3-e30', 'subaru-impreza-wrx-sti', 'mitsubishi-lancer-evo'],
    'Class 4: LongHood_GT_Racer': ['ford-gt-2006', 'dodge-viper-gts', '2019-aston-martin-vantage', 'mercedes-amg-gt3'],
    'Class 5: Curved_90s_Sports': ['mazda-rx7-fd', 'toyota-supra-mk4'],
    'Class 6: Open_Roadster_Classic': ['shelby-cobra-427'],
    'Class 7: Extreme_Track_Hypercar': ['koenigsegg-one-pro', 'bugatti-chiron-mansory', 'mclaren-senna'],
    'Authentic Ingest': ['lb-works-ferrari-f40']
  };

  console.log('\nCar Class Archetypes and Vertex/Triangle Counts:');
  for (const [clsName, memberIds] of Object.entries(carClasses)) {
    console.log(`\n  ${clsName}:`);
    for (const cid of memberIds) {
      const cRes = results.cars.find(c => c.id === cid);
      if (cRes) {
        console.log(`    - ${cid.padEnd(28)} | Verts: ${cRes.vertexCount.toString().padStart(6)} | Tris: ${cRes.triangleCount.toString().padStart(6)} | Dim: [${cRes.dimensions[0].toFixed(2)}, ${cRes.dimensions[1].toFixed(2)}, ${cRes.dimensions[2].toFixed(2)}]m`);
      }
    }
  }

  // Calculate clone check across all 20 cars
  const signatures = new Map();
  for (const c of results.cars) {
    const sig = `${c.vertexCount}_${c.triangleCount}_${c.nodeCount}`;
    if (!signatures.has(sig)) signatures.set(sig, []);
    signatures.get(sig).push(c.id);
  }
  const duplicates = [...signatures.entries()].filter(([_, list]) => list.length > 1);

  console.log(`\nUnique Car Geometry Signatures: ${signatures.size} / 20`);
  if (duplicates.length > 0) {
    console.log('WARNING - Duplicate geometry signatures detected:');
    for (const [sig, list] of duplicates) {
      console.log(`  Signature ${sig}: ${list.join(', ')}`);
    }
  } else {
    console.log('✓ 100% Geometry Diversity Confirmed: All 20 cars have unique geometric topologies!');
  }

  // Aircraft Builders Check
  console.log('\nAircraft Builders (6 Distinct Airframes):');
  for (const p of results.planes) {
    console.log(`  - ${p.id.padEnd(26)} | Verts: ${p.vertexCount.toString().padStart(6)} | Tris: ${p.triangleCount.toString().padStart(6)} | Span/Length: [${p.dimensions[0].toFixed(1)}, ${p.dimensions[1].toFixed(1)}, ${p.dimensions[2].toFixed(1)}]m`);
  }

  // 6. SUMMARY VERDICT
  console.log('\n================================================================');
  console.log('STRESS TEST VERDICT & SUMMARY');
  console.log('================================================================');
  console.log(`Total Assets Inspected: ${totalInspected} / 56`);
  console.log(`Ground Datum Compliance ($Y = 0.000m +- 0.002m): ${56 - groundFailures.length} / 56`);
  if (groundFailures.length > 0) {
    console.log('Ground Datum Failures:');
    for (const f of groundFailures) console.log(`  - [${f.type}] ${f.id}: datum = ${f.datum}m`);
  }

  console.log(`Directional Forward -Z Compliance (Vehicles & Planes): ${26 - orientationFailures.length} / 26`);
  if (orientationFailures.length > 0) {
    console.log('Directional Orientation Failures:');
    for (const f of orientationFailures) {
      console.log(`  - [${f.type}] ${f.id}: FrontZ = ${f.orient.avgFrontZ}m, RearZ = ${f.orient.avgRearZ}m, isForwardNegativeZ = ${f.orient.isForwardNegativeZ}`);
    }
  }

  return {
    totalInspected,
    groundFailures,
    orientationFailures,
    results
  };
}

if (process.argv[1] && process.argv[1].endsWith('challenger_stress_harness.mjs')) {
  runFullStressVerification();
}

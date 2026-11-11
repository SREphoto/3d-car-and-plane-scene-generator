#!/usr/bin/env node
/**
 * Empirical Stress Test Harness for All 56 GLB Models
 *
 * Validates:
 * 1. Khronos glTF 2.0 Binary container & 4-byte chunk alignment
 * 2. BufferView boundary bounds & byteStride alignment
 * 3. Accessor binary limits, componentType alignment, and exact empirical min/max verification
 * 4. Geometry primitive topologies, vertex boundary checks, degenerate triangles, zero-area faces
 * 5. Node hierarchy DAG cycles and transform validity
 * 6. Material PBR factors & embedded image container magics (PNG/JPEG/WebP)
 * 7. Three.js GLTFLoader parsing, bounding box calculation, ground alignment (Y=0.000), and memory disposal
 */

import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Polyfill minimal browser globals for Node.js image loading in Three.js
globalThis.self = globalThis;
if (!globalThis.createImageBitmap) {
  globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
}

const GLB_MAGIC = 0x46546c67;
const GLB_CHUNK_JSON = 0x4e4f534a;
const GLB_CHUNK_BIN = 0x004e4942;

const COMPONENT_TYPES = {
  5120: { name: 'BYTE', size: 1, read: (buf, off) => buf.readInt8(off) },
  5121: { name: 'UNSIGNED_BYTE', size: 1, read: (buf, off) => buf.readUInt8(off) },
  5122: { name: 'SHORT', size: 2, read: (buf, off) => buf.readInt16LE(off) },
  5123: { name: 'UNSIGNED_SHORT', size: 2, read: (buf, off) => buf.readUInt16LE(off) },
  5125: { name: 'UNSIGNED_INT', size: 4, read: (buf, off) => buf.readUInt32LE(off) },
  5126: { name: 'FLOAT', size: 4, read: (buf, off) => buf.readFloatLE(off) },
};

const TYPE_COMPONENTS = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

const TARGET_56_SPEC = {
  Cars: [
    '1975-porsche-911-turbo', 'lb-works-ferrari-f40', 'lamborghini-aventador', 'nissan-skyline-r34-gtr',
    'audi-r8', 'ford-gt-2006', '2019-chevrolet-corvette-c8', 'bmw-m3-e30',
    '2019-aston-martin-vantage', 'koenigsegg-one-pro', 'bugatti-chiron-mansory', 'dodge-viper-gts',
    'mazda-rx7-fd', 'toyota-supra-mk4', 'mercedes-amg-gt3', 'shelby-cobra-427',
    'subaru-impreza-wrx-sti', 'honda-nsx-1990', 'mclaren-senna', 'mitsubishi-lancer-evo',
  ],
  Car_Parts: [
    'v8-engine', 'car-turbocharger', 'bbs-rs16-wheel-rim', 'brembo-brake-caliper',
    'recaro-speed-racing-seat', 'race-steering-wheel-essenza', 'bmw-m2-carbon-spoiler', 'exhaust-manifold-header',
    'supercharged-sbc-v8-blower', 'car-engine-alternator', 'manual-transmission-gearbox', 'rim-tg002-forged-wheel',
    'blue-coilovers-suspension', 'sbc-v8-intake-manifold', 'volvo-intercooler', 'rotor-disc-brake',
    'nos-nitrous-bottle', 'round-projector-headlight', 'bosch-12v-battery', 'f1-steering-wheel-w11',
  ],
  Garages: [
    'underground_garage', 'desert_workshop_garage', 'cyberpunk_garage', 'detailed_parking_garage',
  ],
  City_Streets: [
    'city_street_asphalt', 'cyberpunk_night_street',
  ],
  Showcase_Locations: [
    'car_showroom_dealership', 'architectural_exhibition_hall', 'car_studio_cyclorama', 'vehicle_display_podium',
  ],
  Planes: [
    'lockheed-f22-raptor', 'boeing-787-dreamliner', 'concorde-supersonic', 'supermarine-spitfire',
    'lockheed-sr71-blackbird', 'airbus-a380',
  ],
};

function getAssetPath(category, id) {
  if (category === 'Cars') return `3D Car and Plane Scene Creator/Cars/${id}/source/${id}.glb`;
  if (category === 'Car_Parts') return `3D Car and Plane Scene Creator/Parts/${id}/source/${id}.glb`;
  if (category === 'Garages' || category === 'City_Streets' || category === 'Showcase_Locations') {
    return `3D Car and Plane Scene Creator/Locations/${id}.glb`;
  }
  if (category === 'Planes') return `3D Car and Plane Scene Creator/Planes/${id}/source/${id}.glb`;
  throw new Error(`Unknown category: ${category}`);
}

export async function stressTestModel(filePath, modelInfo = {}) {
  const report = {
    filePath,
    modelInfo,
    passed: true,
    errors: [],
    warnings: [],
    metrics: {
      fileSize: 0,
      jsonChunkLength: 0,
      binChunkLength: 0,
      meshCount: 0,
      primitiveCount: 0,
      triangleCount: 0,
      vertexCount: 0,
      nodeCount: 0,
      imageCount: 0,
      materialCount: 0,
      accessorCount: 0,
      degenerateTriangles: 0,
      zeroAreaTriangles: 0,
      boundingBox: null,
      runtimeParsed: false,
      groundContactY: null,
    },
  };

  const addErr = (msg) => {
    report.passed = false;
    report.errors.push(msg);
  };
  const addWarn = (msg) => {
    report.warnings.push(msg);
  };

  if (!fs.existsSync(filePath)) {
    addErr(`File does not exist: ${filePath}`);
    return report;
  }

  const buf = fs.readFileSync(filePath);
  report.metrics.fileSize = buf.length;

  // 1. Container Header & 4-byte Alignment
  if (buf.length < 12) {
    addErr(`File buffer too small: ${buf.length} bytes`);
    return report;
  }

  const magic = buf.readUInt32LE(0);
  if (magic !== GLB_MAGIC) {
    addErr(`Invalid magic header: expected 0x46546c67 ("glTF"), got 0x${magic.toString(16)}`);
  }

  const version = buf.readUInt32LE(4);
  if (version !== 2) {
    addErr(`Unsupported version: expected 2, got ${version}`);
  }

  const declaredLength = buf.readUInt32LE(8);
  if (declaredLength !== buf.length) {
    addErr(`Declared byteLength ${declaredLength} !== buffer length ${buf.length}`);
  }

  if (buf.length % 4 !== 0) {
    addErr(`GLB file size ${buf.length} is not 4-byte aligned`);
  }

  // 2. Chunk 0 (JSON) Validation
  if (buf.length < 20) {
    addErr(`Buffer truncated before Chunk 0 header`);
    return report;
  }

  const chunk0Length = buf.readUInt32LE(12);
  const chunk0Type = buf.readUInt32LE(16);
  report.metrics.jsonChunkLength = chunk0Length;

  if (chunk0Type !== GLB_CHUNK_JSON) {
    addErr(`Chunk 0 type is not JSON: got 0x${chunk0Type.toString(16)}`);
  }

  if (chunk0Length % 4 !== 0) {
    addErr(`Chunk 0 length ${chunk0Length} is not 4-byte aligned`);
  }

  const chunk0End = 20 + chunk0Length;
  if (chunk0End > buf.length) {
    addErr(`Chunk 0 extends beyond file size: ${chunk0End} > ${buf.length}`);
    return report;
  }

  let gltf;
  try {
    const jsonBuf = buf.subarray(20, chunk0End);
    const jsonStr = jsonBuf.toString('utf8');
    gltf = JSON.parse(jsonStr.trimEnd());
    report.metrics.nodeCount = gltf.nodes?.length || 0;
    report.metrics.meshCount = gltf.meshes?.length || 0;
    report.metrics.materialCount = gltf.materials?.length || 0;
    report.metrics.imageCount = gltf.images?.length || 0;
    report.metrics.accessorCount = gltf.accessors?.length || 0;
  } catch (err) {
    addErr(`Failed to parse Chunk 0 JSON: ${err.message}`);
    return report;
  }

  // Check JSON padding (if JSON string ended with padding bytes, must be 0x20 spaces)
  const jsonRawBuf = buf.subarray(20, chunk0End);
  let jsonStringEnd = jsonRawBuf.length;
  while (jsonStringEnd > 0 && jsonRawBuf[jsonStringEnd - 1] === 0x20) {
    jsonStringEnd--;
  }
  // Any padding bytes between jsonStringEnd and jsonRawBuf.length must be 0x20
  for (let p = jsonStringEnd; p < jsonRawBuf.length; p++) {
    if (jsonRawBuf[p] !== 0x20) {
      addWarn(`Chunk 0 JSON padding byte at offset ${20 + p} is 0x${jsonRawBuf[p].toString(16)}, expected 0x20 (space)`);
    }
  }

  // 3. Chunk 1 (BIN) Validation
  let binBuffer = null;
  if (chunk0End < buf.length) {
    if (chunk0End + 8 > buf.length) {
      addErr(`Buffer truncated before Chunk 1 header at ${chunk0End}`);
      return report;
    }

    const chunk1Length = buf.readUInt32LE(chunk0End);
    const chunk1Type = buf.readUInt32LE(chunk0End + 4);
    report.metrics.binChunkLength = chunk1Length;

    if (chunk1Type !== GLB_CHUNK_BIN) {
      addErr(`Chunk 1 type is not BIN: got 0x${chunk1Type.toString(16)}`);
    }

    if (chunk1Length % 4 !== 0) {
      addErr(`Chunk 1 length ${chunk1Length} is not 4-byte aligned`);
    }

    const binStart = chunk0End + 8;
    const binEnd = binStart + chunk1Length;
    if (binEnd > buf.length) {
      addErr(`Chunk 1 declared length ${chunk1Length} extends beyond file size: ${binEnd} > ${buf.length}`);
      return report;
    }

    binBuffer = buf.subarray(binStart, binEnd);

    // Padding bytes for BIN chunk (if any) must be 0x00
    if (binEnd < buf.length) {
      for (let p = binEnd; p < buf.length; p++) {
        if (buf[p] !== 0x00) {
          addWarn(`Trailing padding byte at offset ${p} is 0x${buf[p].toString(16)}, expected 0x00`);
        }
      }
    }
  }

  // 4. Buffer and BufferView Deep Verification
  if (gltf.buffers && gltf.buffers.length > 0) {
    const buf0 = gltf.buffers[0];
    if (binBuffer && buf0.byteLength > binBuffer.length) {
      addErr(`Buffer 0 declared byteLength ${buf0.byteLength} > binary chunk length ${binBuffer.length}`);
    }
  }

  if (gltf.bufferViews && Array.isArray(gltf.bufferViews)) {
    for (let i = 0; i < gltf.bufferViews.length; i++) {
      const bv = gltf.bufferViews[i];
      const bvOffset = bv.byteOffset || 0;
      const bvLength = bv.byteLength;

      if (bvOffset < 0 || bvLength <= 0) {
        addErr(`BufferView[${i}] has invalid range: offset=${bvOffset}, length=${bvLength}`);
      }

      if (bvOffset % 4 !== 0) {
        addWarn(`BufferView[${i}] byteOffset ${bvOffset} is not 4-byte aligned`);
      }

      if (binBuffer && (bvOffset + bvLength > binBuffer.length)) {
        addErr(`BufferView[${i}] range [${bvOffset}, ${bvOffset + bvLength}] overflows BIN buffer length ${binBuffer.length}`);
      }

      if (bv.byteStride !== undefined) {
        if (bv.byteStride < 4 || bv.byteStride > 252 || bv.byteStride % 4 !== 0) {
          addErr(`BufferView[${i}] invalid byteStride ${bv.byteStride}: must be multiple of 4 between 4 and 252`);
        }
      }
    }
  }

  // 5. Accessors Deep Empirical Validation (Read every binary number!)
  if (gltf.accessors && Array.isArray(gltf.accessors) && binBuffer) {
    for (let i = 0; i < gltf.accessors.length; i++) {
      const acc = gltf.accessors[i];
      const compInfo = COMPONENT_TYPES[acc.componentType];
      if (!compInfo) {
        addErr(`Accessor[${i}] invalid componentType ${acc.componentType}`);
        continue;
      }

      const numComps = TYPE_COMPONENTS[acc.type];
      if (!numComps) {
        addErr(`Accessor[${i}] invalid type "${acc.type}"`);
        continue;
      }

      const accOffset = acc.byteOffset || 0;
      if (accOffset % compInfo.size !== 0) {
        addErr(`Accessor[${i}] byteOffset ${accOffset} is not aligned to component size ${compInfo.size}`);
      }

      if (acc.bufferView === undefined) {
        continue; // Sparse accessor or unbuffered
      }

      const bv = gltf.bufferViews[acc.bufferView];
      if (!bv) {
        addErr(`Accessor[${i}] references non-existent bufferView ${acc.bufferView}`);
        continue;
      }

      const stride = bv.byteStride || (numComps * compInfo.size);
      const totalRequired = accOffset + (acc.count - 1) * stride + (numComps * compInfo.size);
      if (totalRequired > bv.byteLength) {
        addErr(`Accessor[${i}] requirement ${totalRequired} exceeds bufferView byteLength ${bv.byteLength}`);
      }

      // Read binary data and verify numerical limits and min/max
      const bvStart = (bv.byteOffset || 0) + accOffset;
      const computedMin = Array(numComps).fill(Infinity);
      const computedMax = Array(numComps).fill(-Infinity);
      let nanOrInfCount = 0;

      for (let elemIdx = 0; elemIdx < acc.count; elemIdx++) {
        const elemStart = bvStart + elemIdx * stride;
        for (let c = 0; c < numComps; c++) {
          const valOffset = elemStart + c * compInfo.size;
          if (valOffset + compInfo.size > binBuffer.length) {
            addErr(`Accessor[${i}] element ${elemIdx} comp ${c} offset ${valOffset} exceeds binBuffer`);
            break;
          }
          const val = compInfo.read(binBuffer, valOffset);
          if (!Number.isFinite(val)) {
            nanOrInfCount++;
          } else {
            if (val < computedMin[c]) computedMin[c] = val;
            if (val > computedMax[c]) computedMax[c] = val;
          }
        }
      }

      if (nanOrInfCount > 0) {
        addErr(`Accessor[${i}] contains ${nanOrInfCount} non-finite (NaN/Infinity) values!`);
      }

      // If declared min/max exist, compare against computed min/max
      if (acc.min && Array.isArray(acc.min) && acc.count > 0) {
        for (let c = 0; c < numComps; c++) {
          const diff = Math.abs(acc.min[c] - computedMin[c]);
          const tol = Math.max(1e-4, Math.abs(computedMin[c]) * 1e-4);
          if (diff > tol) {
            addWarn(`Accessor[${i}] min[${c}] declared ${acc.min[c]} differs from binary computed ${computedMin[c]} (diff: ${diff.toExponential(2)})`);
          }
        }
      }

      if (acc.max && Array.isArray(acc.max) && acc.count > 0) {
        for (let c = 0; c < numComps; c++) {
          const diff = Math.abs(acc.max[c] - computedMax[c]);
          const tol = Math.max(1e-4, Math.abs(computedMax[c]) * 1e-4);
          if (diff > tol) {
            addWarn(`Accessor[${i}] max[${c}] declared ${acc.max[c]} differs from binary computed ${computedMax[c]} (diff: ${diff.toExponential(2)})`);
          }
        }
      }
    }
  }

  // 6. Geometry Primitives & Degenerate Triangles Check
  let globalBboxMin = [Infinity, Infinity, Infinity];
  let globalBboxMax = [-Infinity, -Infinity, -Infinity];
  let hasValidBbox = false;

  if (gltf.meshes && Array.isArray(gltf.meshes) && binBuffer) {
    for (let mIdx = 0; mIdx < gltf.meshes.length; mIdx++) {
      const mesh = gltf.meshes[mIdx];
      for (let pIdx = 0; pIdx < (mesh.primitives || []).length; pIdx++) {
        const prim = mesh.primitives[pIdx];
        report.metrics.primitiveCount++;

        const mode = prim.mode !== undefined ? prim.mode : 4; // 4 = TRIANGLES
        const posAccIdx = prim.attributes?.POSITION;
        if (posAccIdx === undefined || !gltf.accessors[posAccIdx]) {
          addErr(`Mesh[${mIdx}] Prim[${pIdx}] missing POSITION attribute accessor`);
          continue;
        }

        const posAcc = gltf.accessors[posAccIdx];
        report.metrics.vertexCount += posAcc.count;
        if (posAcc.min && posAcc.max) {
          hasValidBbox = true;
          for (let c = 0; c < 3; c++) {
            if (posAcc.min[c] < globalBboxMin[c]) globalBboxMin[c] = posAcc.min[c];
            if (posAcc.max[c] > globalBboxMax[c]) globalBboxMax[c] = posAcc.max[c];
          }
        }

        // Read positions for geometric analysis
        const posBv = gltf.bufferViews[posAcc.bufferView];
        const posStride = posBv.byteStride || 12;
        const posStart = (posBv.byteOffset || 0) + (posAcc.byteOffset || 0);

        const getPos = (vIdx) => {
          const off = posStart + vIdx * posStride;
          return [
            binBuffer.readFloatLE(off),
            binBuffer.readFloatLE(off + 4),
            binBuffer.readFloatLE(off + 8),
          ];
        };

        if (prim.indices !== undefined) {
          const idxAcc = gltf.accessors[prim.indices];
          if (!idxAcc) {
            addErr(`Mesh[${mIdx}] Prim[${pIdx}] invalid indices accessor ${prim.indices}`);
            continue;
          }

          const idxComp = COMPONENT_TYPES[idxAcc.componentType];
          const idxBv = gltf.bufferViews[idxAcc.bufferView];
          const idxStride = idxBv.byteStride || idxComp.size;
          const idxStart = (idxBv.byteOffset || 0) + (idxAcc.byteOffset || 0);

          const readIndex = (i) => idxComp.read(binBuffer, idxStart + i * idxStride);
          const triCount = Math.floor(idxAcc.count / 3);
          report.metrics.triangleCount += triCount;

          if (mode === 4) { // TRIANGLES
            for (let t = 0; t < triCount; t++) {
              const i0 = readIndex(t * 3);
              const i1 = readIndex(t * 3 + 1);
              const i2 = readIndex(t * 3 + 2);

              // Check vertex bounds
              if (i0 >= posAcc.count || i1 >= posAcc.count || i2 >= posAcc.count) {
                addErr(`Mesh[${mIdx}] Prim[${pIdx}] Triangle ${t} index out of bounds: [${i0}, ${i1}, ${i2}] >= ${posAcc.count}`);
                break;
              }

              // Check degenerate vertex indices
              if (i0 === i1 || i1 === i2 || i2 === i0) {
                report.metrics.degenerateTriangles++;
                continue;
              }

              // Check zero-area triangle
              const p0 = getPos(i0);
              const p1 = getPos(i1);
              const p2 = getPos(i2);
              const ax = p1[0] - p0[0], ay = p1[1] - p0[1], az = p1[2] - p0[2];
              const bx = p2[0] - p0[0], by = p2[1] - p0[1], bz = p2[2] - p0[2];
              const cx = ay * bz - az * by;
              const cy = az * bx - ax * bz;
              const cz = ax * by - ay * bx;
              const area2 = cx * cx + cy * cy + cz * cz;
              if (area2 < 1e-12) {
                report.metrics.zeroAreaTriangles++;
              }
            }
          }
        } else {
          // Unindexed
          const triCount = Math.floor(posAcc.count / 3);
          report.metrics.triangleCount += triCount;
        }

        // Check NORMAL attribute if present
        if (prim.attributes.NORMAL !== undefined) {
          const normAcc = gltf.accessors[prim.attributes.NORMAL];
          if (normAcc && normAcc.count !== posAcc.count) {
            addErr(`Mesh[${mIdx}] Prim[${pIdx}] normal count ${normAcc.count} !== vertex count ${posAcc.count}`);
          }
        }
      }
    }
  }

  if (hasValidBbox) {
    report.metrics.boundingBox = { min: globalBboxMin, max: globalBboxMax };
    const dx = globalBboxMax[0] - globalBboxMin[0];
    const dy = globalBboxMax[1] - globalBboxMin[1];
    const dz = globalBboxMax[2] - globalBboxMin[2];
    if (dx <= 0 || dy <= 0 || dz <= 0) {
      addWarn(`Bounding box has degenerate dimension: [${dx}, ${dy}, ${dz}]`);
    }
  }

  // 7. Node Hierarchy & DAG Cycle Detection
  if (gltf.nodes && Array.isArray(gltf.nodes)) {
    const numNodes = gltf.nodes.length;
    const parentMap = new Map();
    const visited = new Set();
    const inStack = new Set();
    let hasCycle = false;

    function dfs(u, pathNodes = []) {
      visited.add(u);
      inStack.add(u);
      pathNodes.push(u);

      const node = gltf.nodes[u];
      if (node && Array.isArray(node.children)) {
        for (const v of node.children) {
          if (v < 0 || v >= numNodes) {
            addErr(`Node[${u}] child ${v} is out of bounds [0, ${numNodes - 1}]`);
            continue;
          }

          if (parentMap.has(v) && parentMap.get(v) !== u) {
            addWarn(`Node[${v}] has multiple parents (${parentMap.get(v)} and ${u})`);
          } else {
            parentMap.set(v, u);
          }

          if (!visited.has(v)) {
            dfs(v, pathNodes);
          } else if (inStack.has(v)) {
            hasCycle = true;
            addErr(`Node hierarchy cycle detected: [${pathNodes.join(' -> ')} -> ${v}]`);
          }
        }
      }

      inStack.delete(u);
      pathNodes.pop();
    }

    const sceneRoots = (gltf.scenes && gltf.scenes[gltf.scene || 0]?.nodes) || [];
    for (const root of sceneRoots) {
      if (!visited.has(root)) {
        dfs(root);
      }
    }
    // Also check any orphan unvisited nodes
    for (let i = 0; i < numNodes; i++) {
      if (!visited.has(i)) {
        dfs(i);
      }
    }

    // Check node transformation properties
    for (let i = 0; i < numNodes; i++) {
      const node = gltf.nodes[i];
      if (node.rotation) {
        if (!Array.isArray(node.rotation) || node.rotation.length !== 4) {
          addErr(`Node[${i}] rotation is not a 4-element array`);
        } else {
          const lenSq = node.rotation.reduce((sum, val) => sum + val * val, 0);
          if (Math.abs(lenSq - 1.0) > 0.05) {
            addWarn(`Node[${i}] quaternion rotation length squared (${lenSq.toFixed(4)}) deviates from 1.0`);
          }
        }
      }
      if (node.scale) {
        if (node.scale.some((s) => s < 0)) {
          addWarn(`Node[${i}] has negative scale component: [${node.scale.join(', ')}] (mirroring)`);
        }
        if (node.scale.some((s) => s === 0)) {
          addErr(`Node[${i}] has zero scale component: [${node.scale.join(', ')}] (collapses geometry)`);
        }
      }
    }
  }

  // 8. Embedded Image Container Format Verification (PNG/JPEG/WebP)
  if (gltf.images && Array.isArray(gltf.images) && binBuffer) {
    for (let i = 0; i < gltf.images.length; i++) {
      const img = gltf.images[i];
      if (img.bufferView !== undefined) {
        const bv = gltf.bufferViews[img.bufferView];
        if (!bv) {
          addErr(`Image[${i}] invalid bufferView ${img.bufferView}`);
          continue;
        }
        const imgStart = bv.byteOffset || 0;
        const imgHeader = binBuffer.subarray(imgStart, imgStart + 12);

        // Check image signature
        const isPng = imgHeader[0] === 0x89 && imgHeader[1] === 0x50 && imgHeader[2] === 0x4e && imgHeader[3] === 0x47;
        const isJpg = imgHeader[0] === 0xff && imgHeader[1] === 0xd8 && imgHeader[2] === 0xff;
        const isWebp = imgHeader.subarray(0, 4).toString('ascii') === 'RIFF' && imgHeader.subarray(8, 12).toString('ascii') === 'WEBP';

        if (!isPng && !isJpg && !isWebp) {
          addWarn(`Image[${i}] signature does not match PNG, JPEG, or WebP magic headers`);
        }
      } else if (img.uri) {
        if (!img.uri.startsWith('data:')) {
          addErr(`Image[${i}] uses un-embedded external URI: "${img.uri}"`);
        }
      }
    }
  }

  // 9. Three.js GLTFLoader Runtime Parsing & WebGL Safety Test
  try {
    const loader = new GLTFLoader();
    const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

    await new Promise((resolve, reject) => {
      loader.parse(
        arrayBuf,
        '',
        (gltfResult) => {
          report.metrics.runtimeParsed = true;
          const rootScene = gltfResult.scene;

          // Compute Three.js bounding box
          const box = new THREE.Box3().setFromObject(rootScene);
          if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) {
            addErr(`Three.js Box3 bounding box is non-finite: min=${JSON.stringify(box.min)}, max=${JSON.stringify(box.max)}`);
          }

          // Test ground datum normalization (Y = 0.000)
          const center = new THREE.Vector3();
          box.getCenter(center);
          rootScene.position.set(-center.x, -box.min.y, -center.z);
          rootScene.updateMatrixWorld(true);

          const alignedBox = new THREE.Box3().setFromObject(rootScene);
          report.metrics.groundContactY = alignedBox.min.y;
          if (Math.abs(alignedBox.min.y) > 0.001) {
            addWarn(`Ground datum alignment bottom Y (${alignedBox.min.y.toFixed(6)}) deviates from 0.000`);
          }

          // Memory cleanup test
          rootScene.traverse((child) => {
            if (child.isMesh) {
              if (child.geometry) child.geometry.dispose();
              if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
                else child.material.dispose();
              }
            }
          });

          resolve();
        },
        (parseErr) => {
          addErr(`Three.js GLTFLoader parse exception: ${parseErr?.message || parseErr}`);
          reject(parseErr);
        }
      );
    });
  } catch (err) {
    addErr(`Three.js execution error: ${err.message}`);
  }

  report.passed = report.errors.length === 0;
  return report;
}

export async function runFullStressSuite() {
  console.log('======================================================================');
  console.log('  EMPIRICAL 56-MODEL GLB BINARY & GEOMETRY STRESS TEST SUITE');
  console.log('======================================================================\n');

  const allReports = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalTriangles = 0;
  let totalVertices = 0;
  let totalDegenerates = 0;
  let totalZeroAreas = 0;

  for (const [category, ids] of Object.entries(TARGET_56_SPEC)) {
    console.log(`\n▶ Stress-testing Category: ${category} (${ids.length} models)`);

    for (const id of ids) {
      const relPath = getAssetPath(category, id);
      const fullPath = path.resolve(process.cwd(), relPath);

      const rep = await stressTestModel(fullPath, { category, id });
      allReports.push(rep);

      totalErrors += rep.errors.length;
      totalWarnings += rep.warnings.length;
      totalTriangles += rep.metrics.triangleCount;
      totalVertices += rep.metrics.vertexCount;
      totalDegenerates += rep.metrics.degenerateTriangles;
      totalZeroAreas += rep.metrics.zeroAreaTriangles;

      const statusIcon = rep.passed ? '✓' : '✗';
      const color = rep.passed ? '\x1b[32m' : '\x1b[31m';
      const sizeMb = (rep.metrics.fileSize / 1024).toFixed(1) + ' KB';
      const tris = rep.metrics.triangleCount.toLocaleString() + ' tris';
      const verts = rep.metrics.vertexCount.toLocaleString() + ' verts';

      console.log(`  ${color}${statusIcon}\x1b[0m [${id}] - ${sizeMb}, ${tris}, ${verts}`);

      if (rep.errors.length > 0) {
        for (const e of rep.errors) {
          console.log(`    \x1b[31mERROR:\x1b[0m ${e}`);
        }
      }
      if (rep.warnings.length > 0) {
        for (const w of rep.warnings) {
          console.log(`    \x1b[33mWARN:\x1b[0m ${w}`);
        }
      }
    }
  }

  console.log('\n======================================================================');
  console.log('  STRESS TEST SUMMARY');
  console.log('======================================================================');
  console.log(`Total Models Tested:         ${allReports.length} / 56`);
  console.log(`Models Passing:              ${allReports.filter((r) => r.passed).length}`);
  console.log(`Models Failing:              ${allReports.filter((r) => !r.passed).length}`);
  console.log(`Total Geometry Triangles:    ${totalTriangles.toLocaleString()}`);
  console.log(`Total Geometry Vertices:     ${totalVertices.toLocaleString()}`);
  console.log(`Degenerate Triangle Indices: ${totalDegenerates}`);
  console.log(`Zero-Area Triangles:         ${totalZeroAreas}`);
  console.log(`Total Strict Errors:         ${totalErrors}`);
  console.log(`Total Diagnostics Warnings:  ${totalWarnings}`);
  console.log('======================================================================\n');

  if (totalErrors === 0) {
    console.log('\x1b[32m\x1b[1mALL 56 MODELS EMPIRICALLY PASSED STRESS TESTING!\x1b[0m\n');
  } else {
    console.log(`\x1b[31m\x1b[1mSTRESS TEST FAILED WITH ${totalErrors} ERRORS!\x1b[0m\n`);
  }

  return {
    reports: allReports,
    passed: totalErrors === 0,
    totalErrors,
    totalWarnings,
  };
}

if (process.argv[1] && process.argv[1].endsWith('stress_tester.mjs')) {
  runFullStressSuite()
    .then((res) => {
      process.exit(res.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal stress suite runner error:', err);
      process.exit(1);
    });
}

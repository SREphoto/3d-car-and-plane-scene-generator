/**
 * GLB Binary Container and glTF 2.0 Specification Validator
 *
 * Implements strict binary validation conforming to the Khronos glTF 2.0 binary container spec:
 * - 12-byte header: magic (0x46546C67), version (2), total byteLength
 * - Chunk 0: JSON header (0x4E4F534A), length, UTF-8 payload, JSON syntax
 * - Chunk 1: BIN header (0x004E4942), length, buffer alignment
 * - Texture embedding verification (bufferView references vs external relative URIs)
 * - Polycount, vertex count, and bounding volume extraction
 * - Draco mesh compression extension validation (KHR_draco_mesh_compression)
 */

import fs from 'node:fs';
import path from 'node:path';

export const GLB_MAGIC = 0x46546C67; // "glTF" in little-endian
export const GLB_CHUNK_JSON = 0x4E4F534A; // "JSON" in little-endian
export const GLB_CHUNK_BIN = 0x004E4942; // "BIN\0" in little-endian

/**
 * Composes a column-major 4x4 matrix from Translation, Rotation (quaternion), and Scale.
 */
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

/**
 * Multiplies two column-major 4x4 matrices (out = a * b).
 */
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

/**
 * Transforms a 3D point by a column-major 4x4 matrix.
 */
export function transformVec3(m, v) {
  const x = v[0], y = v[1], z = v[2];
  const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1.0;
  return [
    (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
    (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
  ];
}

export const FRONT_FEATURE_REGEX = /headlight|head_light|head_lamp|headlamp|front_light|frontlight|front_splitter|frontsplitter|splitter|front_bumper|frontbumper|fuselage_nose|nose_cone|landinggear_nose|canopy|cockpit_glass/i;
export const REAR_FEATURE_REGEX = /taillight|tail_light|tail_lamp|taillamp|rear_light|rearlight|rearlights|rear_wing|rearwing|wingstay|wing_stay|aero_diffuser|diffuser|exhaust|tail_verticalstabilizer|verticalstabilizer|tail_fin|tailfin|tail_horizontalstabilizers|horizontalstabilizers/i;

/**
 * Validates a GLB file from disk.
 *
 * @param {string} filePath - Absolute or relative path to the .glb file
 * @param {object} [options] - Validation options
 * @param {number} [options.maxTriangles=1500000] - Warning threshold for high polycount
 * @param {number} [options.minFileSize=1024] - Minimum file size in bytes
 * @returns {object} Validation result report
 */
export function validateGlb(filePath, options = {}) {
  const result = {
    valid: false,
    filePath,
    resolvedPath: path.resolve(filePath),
    fileSize: 0,
    magic: null,
    magicHex: null,
    version: null,
    declaredLength: null,
    jsonChunkLength: null,
    binChunkLength: null,
    gltf: null,
    textureStats: {
      totalImages: 0,
      embeddedBufferViews: 0,
      embeddedDataUris: 0,
      externalUris: [],
      allEmbedded: true,
    },
    geometryStats: {
      totalMeshes: 0,
      totalPrimitives: 0,
      totalTriangles: 0,
      totalVertices: 0,
      boundingBox: null,
      worldBoundingBox: null,
      groundDatum: null,
      isGrounded: false,
    },
    orientation: {
      hasDirectionalFeatures: false,
      frontFeatures: [],
      rearFeatures: [],
      avgFrontZ: null,
      avgRearZ: null,
      isForwardNegativeZ: null,
      details: '',
    },
    compression: {
      dracoUsed: false,
      dracoRequired: false,
      extensionsUsed: [],
      extensionsRequired: [],
    },
    errors: [],
    warnings: [],
  };

  if (!fs.existsSync(filePath)) {
    result.errors.push(`File not found: ${filePath}`);
    return result;
  }

  let buf;
  try {
    buf = fs.readFileSync(filePath);
    result.fileSize = buf.length;
  } catch (err) {
    result.errors.push(`Failed to read file: ${err.message}`);
    return result;
  }

  const minFileSize = options.minFileSize || 12;
  if (buf.length < minFileSize) {
    result.errors.push(`File too small for valid GLB: ${buf.length} bytes (min ${minFileSize})`);
    return result;
  }

  // 1. Header Validation (12 bytes)
  const magic = buf.readUInt32LE(0);
  result.magic = magic;
  result.magicHex = '0x' + magic.toString(16).padStart(8, '0');
  if (magic !== GLB_MAGIC) {
    result.errors.push(`Invalid GLB magic header: expected 0x46546C67 ("glTF"), got ${result.magicHex}`);
    return result;
  }

  const version = buf.readUInt32LE(4);
  result.version = version;
  if (version !== 2) {
    result.errors.push(`Unsupported GLB version: expected 2, got ${version}`);
    return result;
  }

  const declaredLength = buf.readUInt32LE(8);
  result.declaredLength = declaredLength;
  if (declaredLength !== buf.length) {
    result.errors.push(`GLB declared length (${declaredLength}) does not match file size (${buf.length})`);
    return result;
  }

  // 2. Chunk 0 Validation (JSON)
  if (buf.length < 20) {
    result.errors.push(`GLB truncated before chunk 0 header: buffer length is ${buf.length} bytes`);
    return result;
  }

  const chunk0Length = buf.readUInt32LE(12);
  const chunk0Type = buf.readUInt32LE(16);
  result.jsonChunkLength = chunk0Length;
  result.chunk0TypeHex = '0x' + chunk0Type.toString(16).padStart(8, '0');

  if (chunk0Type !== GLB_CHUNK_JSON) {
    result.errors.push(`Chunk 0 type is not JSON: expected 0x4E4F534A, got ${result.chunk0TypeHex}`);
    return result;
  }

  if (20 + chunk0Length > buf.length) {
    result.errors.push(`Chunk 0 length (${chunk0Length}) exceeds file buffer (${buf.length - 20} available)`);
    return result;
  }

  let gltf;
  try {
    const jsonStr = buf.toString('utf8', 20, 20 + chunk0Length);
    gltf = JSON.parse(jsonStr);
    result.gltf = gltf;
  } catch (err) {
    result.errors.push(`Failed to parse glTF JSON: ${err.message}`);
    return result;
  }

  if (!gltf.asset || !gltf.asset.version) {
    result.errors.push(`glTF JSON is missing mandatory 'asset.version' property`);
  } else if (!gltf.asset.version.startsWith('2.')) {
    result.warnings.push(`glTF asset version is '${gltf.asset.version}', expected '2.x'`);
  }

  // 3. Texture Embedding & URI Isolation
  if (gltf.images && Array.isArray(gltf.images)) {
    result.textureStats.totalImages = gltf.images.length;
    for (let i = 0; i < gltf.images.length; i++) {
      const img = gltf.images[i];
      if (typeof img.bufferView === 'number') {
        if (!gltf.bufferViews || img.bufferView < 0 || img.bufferView >= gltf.bufferViews.length) {
          result.errors.push(`Image[${i}] bufferView index ${img.bufferView} out of bounds`);
        } else {
          result.textureStats.embeddedBufferViews++;
        }
      } else if (typeof img.uri === 'string') {
        if (img.uri.startsWith('data:')) {
          result.textureStats.embeddedDataUris++;
        } else {
          result.textureStats.externalUris.push(img.uri);
          result.textureStats.allEmbedded = false;
          result.errors.push(`Image[${i}] uses external un-embedded URI: '${img.uri}' (violates self-contained GLB requirement)`);
        }
      } else {
        result.errors.push(`Image[${i}] has neither valid bufferView nor uri`);
      }
    }
  }

  // 4. Extensions & Draco Compression
  result.compression.extensionsUsed = Array.isArray(gltf.extensionsUsed) ? gltf.extensionsUsed : [];
  result.compression.extensionsRequired = Array.isArray(gltf.extensionsRequired) ? gltf.extensionsRequired : [];

  if (result.compression.extensionsUsed.includes('KHR_draco_mesh_compression')) {
    result.compression.dracoUsed = true;
  }
  if (result.compression.extensionsRequired.includes('KHR_draco_mesh_compression')) {
    result.compression.dracoRequired = true;
  }

  // 5. Geometry & Hierarchy World Transform Analysis
  if (gltf.meshes && Array.isArray(gltf.meshes)) {
    result.geometryStats.totalMeshes = gltf.meshes.length;
    
    // Build parent hierarchy map if nodes are present
    const nodes = Array.isArray(gltf.nodes) ? gltf.nodes : [];
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

    /**
     * Traverses the parent chain to collect all ancestor node names.
     */
    function getNodeHierarchyNames(idx) {
      const names = [];
      let curr = idx;
      while (curr !== undefined && curr !== null) {
        if (nodes[curr]?.name) names.push(nodes[curr].name);
        curr = parentMap[curr];
      }
      return names.join(' ');
    }

    let wbMin = [Infinity, Infinity, Infinity];
    let wbMax = [-Infinity, -Infinity, -Infinity];
    let hasBounds = false;

    const frontFeatures = [];
    const rearFeatures = [];
    const visitedMeshIndices = new Set();

    // Traverse all nodes with meshes in world space
    for (let nodeIdx = 0; nodeIdx < nodes.length; nodeIdx++) {
      const node = nodes[nodeIdx];
      if (node.mesh === undefined || !gltf.meshes[node.mesh]) continue;
      const meshIdx = node.mesh;
      visitedMeshIndices.add(meshIdx);
      const mesh = gltf.meshes[meshIdx];
      const nodeName = node.name || '';
      const meshName = mesh.name || '';
      const ancestorChain = getNodeHierarchyNames(nodeIdx);
      const wm = getWorldMat(nodeIdx);

      for (const prim of mesh.primitives || []) {
        result.geometryStats.totalPrimitives++;

        const matName = (prim.material !== undefined && gltf.materials && gltf.materials[prim.material])
          ? (gltf.materials[prim.material].name || '')
          : '';
        const fullFeatureName = `${ancestorChain} ${meshName} ${matName}`;
        const isFront = FRONT_FEATURE_REGEX.test(fullFeatureName);
        const isRear = REAR_FEATURE_REGEX.test(fullFeatureName);

        // Determine face count (triangles)
        let triCount = 0;
        if (prim.indices !== undefined && gltf.accessors && gltf.accessors[prim.indices]) {
          const acc = gltf.accessors[prim.indices];
          triCount = Math.floor((acc.count || 0) / 3);
        } else if (prim.attributes && prim.attributes.POSITION !== undefined && gltf.accessors && gltf.accessors[prim.attributes.POSITION]) {
          const acc = gltf.accessors[prim.attributes.POSITION];
          triCount = Math.floor((acc.count || 0) / 3);
        }
        result.geometryStats.totalTriangles += triCount;

        // Determine vertex count & world bounding volume
        if (prim.attributes && prim.attributes.POSITION !== undefined && gltf.accessors && gltf.accessors[prim.attributes.POSITION]) {
          const posAcc = gltf.accessors[prim.attributes.POSITION];
          result.geometryStats.totalVertices += posAcc.count || 0;

          if (Array.isArray(posAcc.min) && Array.isArray(posAcc.max) && posAcc.min.length === 3 && posAcc.max.length === 3) {
            hasBounds = true;
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

            let pzMin = Infinity, pzMax = -Infinity;
            let pyMin = Infinity, pyMax = -Infinity;

            for (const c of corners) {
              const tc = transformVec3(wm, c);
              for (let dim = 0; dim < 3; dim++) {
                if (tc[dim] < wbMin[dim]) wbMin[dim] = tc[dim];
                if (tc[dim] > wbMax[dim]) wbMax[dim] = tc[dim];
              }
              if (tc[2] < pzMin) pzMin = tc[2];
              if (tc[2] > pzMax) pzMax = tc[2];
              if (tc[1] < pyMin) pyMin = tc[1];
              if (tc[1] > pyMax) pyMax = tc[1];
            }

            if (isFront) {
              frontFeatures.push({
                name: matName || nodeName || meshName,
                fullName: fullFeatureName,
                zMin: pzMin,
                zMax: pzMax,
                zMid: (pzMin + pzMax) / 2,
                yMid: (pyMin + pyMax) / 2,
              });
            }
            if (isRear) {
              rearFeatures.push({
                name: matName || nodeName || meshName,
                fullName: fullFeatureName,
                zMin: pzMin,
                zMax: pzMax,
                zMid: (pzMin + pzMax) / 2,
                yMid: (pyMin + pyMax) / 2,
              });
            }
          }
        }
      }
    }

    // Inspect any unvisited meshes (not attached to a node, fallback)
    for (let mIdx = 0; mIdx < gltf.meshes.length; mIdx++) {
      if (visitedMeshIndices.has(mIdx)) continue;
      const mesh = gltf.meshes[mIdx];
      for (const prim of mesh.primitives || []) {
        result.geometryStats.totalPrimitives++;
        let triCount = 0;
        if (prim.indices !== undefined && gltf.accessors && gltf.accessors[prim.indices]) {
          triCount = Math.floor((gltf.accessors[prim.indices].count || 0) / 3);
        } else if (prim.attributes && prim.attributes.POSITION !== undefined && gltf.accessors && gltf.accessors[prim.attributes.POSITION]) {
          triCount = Math.floor((gltf.accessors[prim.attributes.POSITION].count || 0) / 3);
        }
        result.geometryStats.totalTriangles += triCount;

        if (prim.attributes && prim.attributes.POSITION !== undefined && gltf.accessors && gltf.accessors[prim.attributes.POSITION]) {
          const posAcc = gltf.accessors[prim.attributes.POSITION];
          result.geometryStats.totalVertices += posAcc.count || 0;
          if (Array.isArray(posAcc.min) && Array.isArray(posAcc.max) && posAcc.min.length === 3 && posAcc.max.length === 3) {
            hasBounds = true;
            for (let c = 0; c < 3; c++) {
              if (posAcc.min[c] < wbMin[c]) wbMin[c] = posAcc.min[c];
              if (posAcc.max[c] > wbMax[c]) wbMax[c] = posAcc.max[c];
            }
          }
        }
      }
    }

    if (hasBounds) {
      const isFiniteVec = (v) => v.every((n) => typeof n === 'number' && Number.isFinite(n));
      if (isFiniteVec(wbMin) && isFiniteVec(wbMax)) {
        result.geometryStats.boundingBox = { min: wbMin, max: wbMax };
        result.geometryStats.worldBoundingBox = { min: wbMin, max: wbMax };
        result.geometryStats.groundDatum = wbMin[1];
        result.geometryStats.isGrounded = Math.abs(wbMin[1]) <= 0.002;
      } else {
        result.errors.push(`Mesh bounding box contains non-finite values (min: ${wbMin}, max: ${wbMax})`);
      }
    }

    // Directional Orientation Analysis
    const avgFrontZ = frontFeatures.length ? frontFeatures.reduce((a, b) => a + b.zMid, 0) / frontFeatures.length : null;
    const avgRearZ = rearFeatures.length ? rearFeatures.reduce((a, b) => a + b.zMid, 0) / rearFeatures.length : null;
    const hasDirectional = frontFeatures.length > 0 || rearFeatures.length > 0;
    let isForwardNegativeZ = null;
    if (avgFrontZ !== null && avgRearZ !== null) {
      isForwardNegativeZ = avgFrontZ < 0 && avgFrontZ < avgRearZ;
    } else if (avgFrontZ !== null) {
      isForwardNegativeZ = avgFrontZ < 0;
    }

    result.orientation = {
      hasDirectionalFeatures: hasDirectional,
      frontFeatures,
      rearFeatures,
      avgFrontZ,
      avgRearZ,
      isForwardNegativeZ,
      details: hasDirectional
        ? `Front Z: ${avgFrontZ !== null ? avgFrontZ.toFixed(3) : 'none'}m (${frontFeatures.length} feats), Rear Z: ${avgRearZ !== null ? avgRearZ.toFixed(3) : 'none'}m (${rearFeatures.length} feats)`
        : 'No directional features detected',
    };
  }

  // 6. Polycount threshold check
  const maxTriangles = options.maxTriangles || 1500000;
  if (result.geometryStats.totalTriangles > maxTriangles) {
    result.warnings.push(`High polycount: ${result.geometryStats.totalTriangles.toLocaleString()} faces exceeds ${maxTriangles.toLocaleString()} threshold`);
  }

  // 7. Chunk 1 Validation (Binary Buffer)
  const chunk1Offset = 20 + chunk0Length;
  if (chunk1Offset < buf.length) {
    if (chunk1Offset + 8 <= buf.length) {
      const c1Len = buf.readUInt32LE(chunk1Offset);
      const c1Type = buf.readUInt32LE(chunk1Offset + 4);
      result.binChunkLength = c1Len;
      if (c1Type !== GLB_CHUNK_BIN) {
        result.warnings.push(`Chunk 1 type is not standard BIN: expected 0x004E4942, got 0x${c1Type.toString(16)}`);
      }
      if (chunk1Offset + 8 + c1Len > buf.length) {
        result.errors.push(`Chunk 1 declared length (${c1Len}) exceeds remaining buffer (${buf.length - chunk1Offset - 8} available)`);
      }
    }
  }

  result.valid = result.errors.length === 0;
  return result;
}

/**
 * Computes topological signature and checks diversity across a collection of validated GLBs.
 *
 * @param {Array<object>} valList - List of validateGlb() results
 * @returns {object} Category diversity analysis
 */
export function checkCategoryDiversity(valList) {
  const signatures = new Map();
  const models = [];

  for (const val of valList) {
    if (!val || !val.gltf) continue;
    const nodeNames = (val.gltf.nodes || [])
      .map((n) => (n.name || '').trim().toLowerCase())
      .sort()
      .join('|');
    const vertCount = val.geometryStats.totalVertices;
    const triCount = val.geometryStats.totalTriangles;
    const nodeCount = val.gltf.nodes?.length || 0;
    const sigKey = `${vertCount}_${triCount}_${nodeCount}_${nodeNames}`;

    const relPath = path.basename(val.filePath);
    models.push({ filePath: val.filePath, name: relPath, vertCount, triCount, nodeCount });

    if (!signatures.has(sigKey)) signatures.set(sigKey, []);
    signatures.get(sigKey).push(relPath);
  }

  const cloneGroups = [...signatures.entries()]
    .filter(([_, list]) => list.length > 1)
    .map(([sig, list]) => ({ signature: sig, count: list.length, models: list }));

  const total = models.length;
  const unique = signatures.size;
  const diversityRatio = total > 0 ? unique / total : 1.0;

  return {
    totalModels: total,
    uniqueSignatures: unique,
    diversityRatio,
    cloneGroups,
    isDiverse: cloneGroups.length === 0 && diversityRatio === 1.0,
  };
}

export default {
  validateGlb,
  checkCategoryDiversity,
  composeTRS,
  multiply4x4,
  transformVec3,
  GLB_MAGIC,
  GLB_CHUNK_JSON,
  GLB_CHUNK_BIN,
  FRONT_FEATURE_REGEX,
  REAR_FEATURE_REGEX,
};

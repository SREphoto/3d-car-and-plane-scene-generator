import * as THREE from 'three';
import { isMobileDevice } from './device.js';

/**
 * High-DPI Procedural Tiled-PBR Stages & Interactive Pro Lighting Studio
 * Built for razor-sharp 1m close-up fidelity + Linear-HDR optical bokeh highlights.
 */

export const STUDIO_LOOK_PRESETS = {
  clean_commercial: {
    id: 'clean_commercial',
    name: 'Clean Commercial',
    floorFinish: 'matte_white',
    overheadIntensity: 2.1,
    overheadColor: '#f8fbff',
    leftRimIntensity: 1.35,
    leftRimColor: '#e8f2ff',
    rightRimIntensity: 1.15,
    rightRimColor: '#fff3e6',
    ringLightIntensity: 0.0,
    ringLightColor: '#ffffff',
    goboIntensity: 0.0,
    goboColor: '#ffcf96',
    cycWallColor: '#dcdfe6',
    ambientIntensity: 0.42,
  },
  moody_rim: {
    id: 'moody_rim',
    name: 'Moody Rim',
    floorFinish: 'dark_obsidian',
    overheadIntensity: 0.38,
    overheadColor: '#dce8ff',
    leftRimIntensity: 2.55,
    leftRimColor: '#d6e9ff',
    rightRimIntensity: 2.25,
    rightRimColor: '#ffdfc2',
    ringLightIntensity: 0.0,
    ringLightColor: '#ffffff',
    goboIntensity: 0.0,
    goboColor: '#ffb870',
    cycWallColor: '#0a0d13',
    ambientIntensity: 0.12,
  },
  rgb_cyber: {
    id: 'rgb_cyber',
    name: 'RGB Cyber',
    floorFinish: 'wet_mirror',
    overheadIntensity: 0.55,
    overheadColor: '#5c4dff',
    leftRimIntensity: 2.85,
    leftRimColor: '#00e5ff',
    rightRimIntensity: 2.85,
    rightRimColor: '#ff1e8a',
    ringLightIntensity: 0.65,
    ringLightColor: '#7b61ff',
    goboIntensity: 0.0,
    goboColor: '#00e5ff',
    cycWallColor: '#070810',
    ambientIntensity: 0.14,
  },
  venetian_gobo: {
    id: 'venetian_gobo',
    name: 'Venetian Gobo',
    floorFinish: 'brushed_concrete',
    overheadIntensity: 0.28,
    overheadColor: '#bcd2ff',
    leftRimIntensity: 1.15,
    leftRimColor: '#8cb4ff',
    rightRimIntensity: 0.65,
    rightRimColor: '#ffd2a6',
    ringLightIntensity: 0.0,
    ringLightColor: '#ffffff',
    goboIntensity: 3.2,
    goboColor: '#ffad60',
    cycWallColor: '#12151c',
    ambientIntensity: 0.12,
  },
  ring_light: {
    id: 'ring_light',
    name: 'Ring Light',
    floorFinish: 'dark_obsidian',
    overheadIntensity: 0.65,
    overheadColor: '#eef4ff',
    leftRimIntensity: 1.25,
    leftRimColor: '#cde2ff',
    rightRimIntensity: 1.25,
    rightRimColor: '#ffe4cc',
    ringLightIntensity: 2.95,
    ringLightColor: '#ffffff',
    goboIntensity: 0.0,
    goboColor: '#ffcf96',
    cycWallColor: '#0d1017',
    ambientIntensity: 0.16,
  },
};

export const STUDIO_FLOOR_FINISHES = [
  { id: 'matte_white', name: 'Matte White Cyc' },
  { id: 'dark_obsidian', name: 'Dark Satin Obsidian' },
  { id: 'wet_mirror', name: 'Wet Mirror Epoxy' },
  { id: 'brushed_concrete', name: 'Brushed Concrete' },
];

// Mobile GPUs: scale down shadow-map resolution to save VRAM
const STAGE_SHADOW_SIZE = isMobileDevice() ? 512 : 2048;

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function makeTiledCanvasTexture(drawFn, size = 1024, repeatX = 12, repeatY = 12, isSRGB = true, maxAniso = 16) {
  const isMobile = isMobileDevice();
  const effSize = isMobile ? Math.min(size, 512) : size;
  const canvas = document.createElement('canvas');
  canvas.width = effSize;
  canvas.height = effSize;
  const ctx = canvas.getContext('2d');
  drawFn(ctx, effSize);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = isMobile ? Math.min(2, maxAniso) : maxAniso;
  tex.colorSpace = isSRGB ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a tileable tangent-space normal map from a procedural heightfield callback h(u, v) in [0..1]
 */
function makeProceduralNormalMap(heightFn, size = 512, repeatX = 12, repeatY = 12, strength = 2.5, maxAniso = 16) {
  const isMobile = isMobileDevice();
  const effSize = isMobile ? Math.min(size, 256) : size;
  const data = new Uint8Array(effSize * effSize * 4);
  const heights = new Float32Array(effSize * effSize);
  for (let y = 0; y < effSize; y++) {
    for (let x = 0; x < effSize; x++) {
      heights[y * effSize + x] = heightFn(x / effSize, y / effSize, x, y, effSize);
    }
  }
  for (let y = 0; y < effSize; y++) {
    const ym = (y - 1 + effSize) % effSize;
    const yp = (y + 1) % effSize;
    for (let x = 0; x < effSize; x++) {
      const xm = (x - 1 + effSize) % effSize;
      const xp = (x + 1) % effSize;
      const dx = (heights[y * effSize + xp] - heights[y * effSize + xm]) * strength;
      const dy = (heights[yp * effSize + x] - heights[ym * effSize + x]) * strength;
      let nx = -dx;
      let ny = -dy;
      let nz = 1.0;
      const len = Math.hypot(nx, ny, nz) || 1.0;
      nx /= len;
      ny /= len;
      nz /= len;
      const idx = (y * effSize + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, effSize, effSize, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = isMobile ? Math.min(2, maxAniso) : maxAniso;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createBrickMaps(maxAniso = 16, repeatX = 14, repeatY = 7) {
  const cols = 8;
  const rows = 16;
  const albedo = makeTiledCanvasTexture((ctx, S) => {
    ctx.fillStyle = '#6c665f'; // Mortar bed
    ctx.fillRect(0, 0, S, S);
    const bw = S / cols;
    const bh = S / rows;
    const mortar = Math.max(3, S * 0.0055);
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (bw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const h1 = hash2(c + 17, r * 3.1);
        const h2 = hash2(c * 2.3, r + 9.7);
        const baseR = Math.round(118 + h1 * 48 - h2 * 18);
        const baseG = Math.round(54 + h1 * 24 - h2 * 10);
        const baseB = Math.round(42 + h1 * 18 - h2 * 8);
        ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
        const x = c * bw + offset + mortar * 0.5;
        const y = r * bh + mortar * 0.5;
        ctx.fillRect(x, y, bw - mortar, bh - mortar);

        // Weathering speckles
        ctx.fillStyle = h2 > 0.5 ? 'rgba(30,22,18,0.16)' : 'rgba(210,185,165,0.09)';
        ctx.fillRect(x + 4, y + 3, (bw - mortar) * 0.65, (bh - mortar) * 0.45);
      }
    }
  }, 1024, repeatX, repeatY, true, maxAniso);

  const normal = makeProceduralNormalMap((u, v, x, y) => {
    const r = Math.floor(v * rows);
    const offset = (r % 2) * 0.5;
    const cu = (u * cols + offset) % 1.0;
    const cv = (v * rows) % 1.0;
    const inMortar = cu < 0.05 || cu > 0.95 || cv < 0.09 || cv > 0.91;
    const grain = (hash2(x * 0.7, y * 0.7) - 0.5) * 0.18;
    return (inMortar ? 0.15 : 0.85) + grain;
  }, 512, repeatX, repeatY, 3.2, maxAniso);

  const roughness = makeTiledCanvasTexture((ctx, S) => {
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(0, 0, S, S);
    const bw = S / cols;
    const bh = S / rows;
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (bw * 0.5);
      for (let c = -1; c <= cols; c++) {
        const g = Math.round(175 + hash2(c, r) * 55);
        ctx.fillStyle = `rgb(${g},${g},${g})`;
        ctx.fillRect(c * bw + offset + 3, r * bh + 3, bw - 6, bh - 6);
      }
    }
  }, 512, repeatX, repeatY, false, maxAniso);

  return { albedo, normal, roughness };
}

function createJointedConcreteMaps(maxAniso = 16, repeatX = 18, repeatY = 18, darkTint = false) {
  const albedo = makeTiledCanvasTexture((ctx, S) => {
    ctx.fillStyle = darkTint ? '#3b3f46' : '#8b8f94';
    ctx.fillRect(0, 0, S, S);
    // Fine aggregate mottling
    for (let i = 0; i < 6500; i++) {
      const x = hash2(i, 1.3) * S;
      const y = hash2(2.7, i) * S;
      const rad = 1 + hash2(i, i) * 5.5;
      const bright = hash2(i * 1.9, 4.1) > 0.5;
      ctx.fillStyle = bright ? 'rgba(255,255,255,0.045)' : 'rgba(15,18,22,0.055)';
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    // Expansion joints (2x2 slab grid per tile)
    ctx.strokeStyle = 'rgba(22,24,28,0.68)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 2); ctx.lineTo(S, 2);
    ctx.moveTo(0, S * 0.5); ctx.lineTo(S, S * 0.5);
    ctx.moveTo(2, 0); ctx.lineTo(2, S);
    ctx.moveTo(S * 0.5, 0); ctx.lineTo(S * 0.5, S);
    ctx.stroke();
  }, 1024, repeatX, repeatY, true, maxAniso);

  const normal = makeProceduralNormalMap((u, v, x, y) => {
    const seamU = Math.min(u, Math.abs(u - 0.5), 1.0 - u);
    const seamV = Math.min(v, Math.abs(v - 0.5), 1.0 - v);
    const seam = (seamU < 0.008 || seamV < 0.008) ? 0.15 : 0.82;
    const micro = (hash2(x * 1.1, y * 1.1) - 0.5) * 0.22;
    return seam + micro;
  }, 512, repeatX, repeatY, 2.4, maxAniso);

  const roughness = makeTiledCanvasTexture((ctx, S) => {
    ctx.fillStyle = darkTint ? '#8a8a8a' : '#bababa';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 2400; i++) {
      const x = hash2(i * 3.1, 0.7) * S;
      const y = hash2(0.9, i * 2.3) * S;
      const r = 4 + hash2(i, 8.2) * 20;
      const v = Math.round((darkTint ? 105 : 155) + hash2(i, 5.5) * 65);
      ctx.fillStyle = `rgba(${v},${v},${v},0.18)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 512, repeatX, repeatY, false, maxAniso);

  return { albedo, normal, roughness };
}

function createCorrugatedSteelMaps(maxAniso = 16, repeatX = 8, repeatY = 4) {
  const normal = makeProceduralNormalMap((u, v, x, y) => {
    const wave = 0.5 + 0.5 * Math.sin(v * Math.PI * 2.0 * 28.0);
    const rib = (u < 0.015 || u > 0.985) ? 0.1 : 0.0;
    return wave * 0.85 - rib + (hash2(x, y) - 0.5) * 0.04;
  }, 512, repeatX, repeatY, 3.6, maxAniso);

  const albedo = makeTiledCanvasTexture((ctx, S) => {
    for (let y = 0; y < S; y++) {
      const s = Math.sin((y / S) * Math.PI * 2.0 * 28.0);
      const c = Math.round(142 + s * 18);
      ctx.fillStyle = `rgb(${c},${c + 4},${c + 9})`;
      ctx.fillRect(0, y, S, 1);
    }
  }, 512, repeatX, repeatY, true, maxAniso);

  return { albedo, normal };
}

function createAsphaltMaps(maxAniso = 16, repeatX = 16, repeatY = 36, isWetNight = false) {
  const albedo = makeTiledCanvasTexture((ctx, S) => {
    ctx.fillStyle = isWetNight ? '#171a20' : '#2f3238';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 12000; i++) {
      const x = hash2(i, 9.1) * S;
      const y = hash2(4.3, i) * S;
      const v = isWetNight
        ? Math.round(18 + hash2(i, 2.2) * 34)
        : Math.round(38 + hash2(i, 2.2) * 48);
      ctx.fillStyle = `rgb(${v},${v},${v + 2})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }, 1024, repeatX, repeatY, true, maxAniso);

  const normal = makeProceduralNormalMap((u, v, x, y) => {
    const p1 = Math.sin(u * Math.PI * 4.0) * Math.cos(v * Math.PI * 4.0);
    const isPuddle = isWetNight && p1 > 0.28;
    if (isPuddle) {
      return 0.5 + (hash2(x * 0.2, y * 0.2) - 0.5) * 0.02;
    }
    return 0.5 + (hash2(x * 1.7, y * 1.7) - 0.5) * 0.45;
  }, 512, repeatX, repeatY, isWetNight ? 1.8 : 2.8, maxAniso);

  const roughness = makeTiledCanvasTexture((ctx, S) => {
    if (!isWetNight) {
      ctx.fillStyle = '#c4c4c4';
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 3000; i++) {
        const g = Math.round(165 + hash2(i, 3.3) * 65);
        ctx.fillStyle = `rgb(${g},${g},${g})`;
        ctx.fillRect(hash2(i, 1.1) * S, hash2(2.2, i) * S, 8, 8);
      }
      return;
    }
    // Wet night asphalt: glossy mirror puddles (roughness ~12/255 = 0.05) + damp aggregate (~72/255 = 0.28)
    const img = ctx.createImageData(S, S);
    const d = img.data;
    for (let y = 0; y < S; y++) {
      const v = y / S;
      for (let x = 0; x < S; x++) {
        const u = x / S;
        const n1 = Math.sin(u * Math.PI * 4.0 + 0.6) * Math.cos(v * Math.PI * 4.0 - 0.4);
        const n2 = Math.sin((u + v) * Math.PI * 6.0) * 0.35;
        const mask = n1 + n2;
        let rVal;
        if (mask > 0.24) {
          rVal = 12; // Mirror rain puddle!
        } else if (mask > 0.05) {
          rVal = Math.round(12 + ((0.24 - mask) / 0.19) * 58);
        } else {
          rVal = Math.round(70 + hash2(x, y) * 38);
        }
        const idx = (y * S + x) * 4;
        d[idx] = rVal;
        d[idx + 1] = rVal;
        d[idx + 2] = rVal;
        d[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, 512, repeatX * 0.25, repeatY * 0.25, false, maxAniso);

  return { albedo, normal, roughness };
}

/**
 * 1. INSIDE PRO LIGHTING STUDIO (`pro_lighting_studio`)
 */
export function buildProLightingStudioStage(renderer, initialState = {}) {
  const maxAniso = Math.min(renderer?.capabilities?.getMaxAnisotropy?.() || 16, isMobileDevice() ? 2 : 16);
  const group = new THREE.Group();
  group.name = 'ProLightingStudioStage';

  const concreteMaps = createJointedConcreteMaps(maxAniso, 16, 16, true);
  const wetNormal = makeProceduralNormalMap((u, v, x, y) => {
    return 0.5 + Math.sin(u * Math.PI * 8.0) * Math.cos(v * Math.PI * 8.0) * 0.06 + (hash2(x * 0.3, y * 0.3) - 0.5) * 0.03;
  }, 256, 10, 10, 0.65, maxAniso);

  // Seamless Infinity Cyclorama Floor + Rear/Side Cove
  const floorMat = new THREE.MeshPhysicalMaterial({
    color: 0xe8ebf0,
    roughness: 0.72,
    metalness: 0.02,
    clearcoat: 0.05,
    clearcoatRoughness: 0.4,
    envMapIntensity: 1.0,
  });

  const cycWallMat = new THREE.MeshStandardMaterial({
    color: 0xdcdfe6,
    roughness: 0.82,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  // Main studio floor (56m x 64m so telephoto pullback up to 46m stays cleanly grounded)
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(58, 72), floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0, -0.001, -6);
  floorMesh.receiveShadow = true;
  group.add(floorMesh);

  // Curved infinity cove sweep along +Z rear wall (Z = +11m curving up to Y = 9.5m)
  const coveShapePts = [];
  const coveRadius = 3.8;
  const wallZ = 12.5;
  coveShapePts.push(new THREE.Vector2(wallZ - coveRadius - 2.0, 0.001));
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * (Math.PI * 0.5);
    const z = (wallZ - coveRadius) + Math.sin(a) * coveRadius;
    const y = coveRadius - Math.cos(a) * coveRadius;
    coveShapePts.push(new THREE.Vector2(z, y));
  }
  coveShapePts.push(new THREE.Vector2(wallZ, 9.8));

  // Extrude cove profile across width X in [-16, +16]
  const coveWidth = 34;
  const covePos = [];
  const coveUv = [];
  const coveIdx = [];
  const segX = 24;
  for (let ix = 0; ix <= segX; ix++) {
    const u = ix / segX;
    const x = -coveWidth * 0.5 + u * coveWidth;
    for (let ip = 0; ip < coveShapePts.length; ip++) {
      const pt = coveShapePts[ip];
      covePos.push(x, pt.y, pt.x);
      coveUv.push(u * 4, ip / (coveShapePts.length - 1));
    }
  }
  const stride = coveShapePts.length;
  for (let ix = 0; ix < segX; ix++) {
    for (let ip = 0; ip < stride - 1; ip++) {
      const a = ix * stride + ip;
      const b = (ix + 1) * stride + ip;
      const c = (ix + 1) * stride + ip + 1;
      const d = ix * stride + ip + 1;
      coveIdx.push(a, d, b, b, d, c);
    }
  }
  const coveGeo = new THREE.BufferGeometry();
  coveGeo.setAttribute('position', new THREE.Float32BufferAttribute(covePos, 3));
  coveGeo.setAttribute('uv', new THREE.Float32BufferAttribute(coveUv, 2));
  coveGeo.setIndex(coveIdx);
  coveGeo.computeVertexNormals();
  const rearCoveMesh = new THREE.Mesh(coveGeo, cycWallMat);
  rearCoveMesh.receiveShadow = true;
  group.add(rearCoveMesh);

  // Side acoustic studio walls & ceiling truss grid
  const darkTrussMat = new THREE.MeshStandardMaterial({ color: 0x161920, roughness: 0.45, metalness: 0.78 });
  for (const sx of [-17, 17]) {
    const sWall = new THREE.Mesh(new THREE.PlaneGeometry(46, 9.8), cycWallMat);
    sWall.position.set(sx, 4.9, -2);
    sWall.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
    sWall.receiveShadow = true;
    group.add(sWall);
  }
  const ceilingMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 46),
    new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.9, metalness: 0.1 })
  );
  ceilingMesh.rotation.x = Math.PI / 2;
  ceilingMesh.position.set(0, 9.8, -2);
  group.add(ceilingMesh);

  for (let z = -14; z <= 10; z += 6) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(33.5, 0.22, 0.22), darkTrussMat);
    beam.position.set(0, 8.6, z);
    group.add(beam);
  }

  // --- OPTIONAL MOTORIZED TURNTABLE PLINTH (flush top at Y = 0.000m!) ---
  const turntableGroup = new THREE.Group();
  turntableGroup.name = 'StudioTurntable';
  const plinthMat = new THREE.MeshPhysicalMaterial({
    color: 0x161922,
    roughness: 0.18,
    metalness: 0.65,
    clearcoat: 0.85,
    clearcoatRoughness: 0.08,
  });
  // Main disc top at Y = -0.0005m so tires sit flush with zero Z-fighting
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(2.95, 3.08, 0.05, 96), plinthMat);
  platter.position.y = -0.0255;
  platter.receiveShadow = true;
  turntableGroup.add(platter);

  const trimRingMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 2.2, 3.2) });
  const trimRing = new THREE.Mesh(new THREE.RingGeometry(2.94, 2.975, 96), trimRingMat);
  trimRing.rotation.x = -Math.PI / 2;
  trimRing.position.y = 0.0008;
  turntableGroup.add(trimRing);

  // Subtle radial index ticks so turntable spin is visually unmistakable
  const tickMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3, metalness: 0.8 });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.002, 0.12), tickMat);
    tick.position.set(Math.sin(a) * 2.86, 0.0006, Math.cos(a) * 2.86);
    tick.rotation.y = a;
    turntableGroup.add(tick);
  }
  group.add(turntableGroup);

  // --- ACCESSORY BUILDERS: BARN DOORS & HONEYCOMB GRID ---
  const accessoryMat = new THREE.MeshStandardMaterial({
    color: 0x090b10,
    roughness: 0.55,
    metalness: 0.72,
    side: THREE.DoubleSide,
  });

  function createFixtureAccessories(width, height, isOverhead = false) {
    const accGroup = new THREE.Group();

    // 4-Leaf Hinged Barn Doors
    const barnGroup = new THREE.Group();
    const flapDepth = Math.min(0.65, Math.max(0.28, Math.min(width, height) * 0.42));
    const tilt = 0.42; // angled inward to shape beam
    if (isOverhead) {
      // Overhead scrim lies in X-Z plane facing -Y
      const topFlap = new THREE.Mesh(new THREE.BoxGeometry(width, flapDepth, 0.025), accessoryMat);
      topFlap.position.set(0, -flapDepth * 0.42, -height * 0.5);
      topFlap.rotation.x = tilt;
      const botFlap = new THREE.Mesh(new THREE.BoxGeometry(width, flapDepth, 0.025), accessoryMat);
      botFlap.position.set(0, -flapDepth * 0.42, height * 0.5);
      botFlap.rotation.x = -tilt;
      const leftFlap = new THREE.Mesh(new THREE.BoxGeometry(0.025, flapDepth, height), accessoryMat);
      leftFlap.position.set(-width * 0.5, -flapDepth * 0.42, 0);
      leftFlap.rotation.z = -tilt;
      const rightFlap = new THREE.Mesh(new THREE.BoxGeometry(0.025, flapDepth, height), accessoryMat);
      rightFlap.position.set(width * 0.5, -flapDepth * 0.42, 0);
      rightFlap.rotation.z = tilt;
      barnGroup.add(topFlap, botFlap, leftFlap, rightFlap);
    } else {
      // Vertical fixture lies in X-Y plane facing +Z
      const topFlap = new THREE.Mesh(new THREE.BoxGeometry(width, 0.025, flapDepth), accessoryMat);
      topFlap.position.set(0, height * 0.5, flapDepth * 0.42);
      topFlap.rotation.x = tilt;
      const botFlap = new THREE.Mesh(new THREE.BoxGeometry(width, 0.025, flapDepth), accessoryMat);
      botFlap.position.set(0, -height * 0.5, flapDepth * 0.42);
      botFlap.rotation.x = -tilt;
      const leftFlap = new THREE.Mesh(new THREE.BoxGeometry(0.025, height, flapDepth), accessoryMat);
      leftFlap.position.set(-width * 0.5, 0, flapDepth * 0.42);
      leftFlap.rotation.y = -tilt;
      const rightFlap = new THREE.Mesh(new THREE.BoxGeometry(0.025, height, flapDepth), accessoryMat);
      rightFlap.position.set(width * 0.5, 0, flapDepth * 0.42);
      rightFlap.rotation.y = tilt;
      barnGroup.add(topFlap, botFlap, leftFlap, rightFlap);
    }
    barnGroup.visible = false;
    accGroup.add(barnGroup);

    // Honeycomb Eggcrate Grid
    const honeyGroup = new THREE.Group();
    const cols = Math.max(4, Math.round(width * 4));
    const rows = Math.max(4, Math.round(height * 4));
    const gridDepth = 0.08;
    if (isOverhead) {
      for (let i = 1; i < cols; i++) {
        const gx = -width * 0.5 + (i / cols) * width;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.012, gridDepth, height), accessoryMat);
        bar.position.set(gx, -gridDepth * 0.5, 0);
        honeyGroup.add(bar);
      }
      for (let j = 1; j < rows; j++) {
        const gz = -height * 0.5 + (j / rows) * height;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(width, gridDepth, 0.012), accessoryMat);
        bar.position.set(0, -gridDepth * 0.5, gz);
        honeyGroup.add(bar);
      }
    } else {
      for (let i = 1; i < cols; i++) {
        const gx = -width * 0.5 + (i / cols) * width;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.012, height, gridDepth), accessoryMat);
        bar.position.set(gx, 0, gridDepth * 0.5);
        honeyGroup.add(bar);
      }
      for (let j = 1; j < rows; j++) {
        const gy = -height * 0.5 + (j / rows) * height;
        const bar = new THREE.Mesh(new THREE.BoxGeometry(width, 0.012, gridDepth), accessoryMat);
        bar.position.set(0, gy, gridDepth * 0.5);
        honeyGroup.add(bar);
      }
    }
    honeyGroup.visible = false;
    accGroup.add(honeyGroup);

    return { accGroup, barnGroup, honeyGroup };
  }

  // --- STUDIO FIXTURE 1: OVERHEAD SOFTBOX BANK ---
  const overheadGroup = new THREE.Group();
  overheadGroup.position.set(0, 3.85, -0.2);
  const softboxHousing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.18, 6.4), darkTrussMat);
  softboxHousing.position.y = 0.1;
  overheadGroup.add(softboxHousing);

  const overheadEmissiveMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5.5, 5.7, 6.0) });
  const overheadScrim = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 6.2), overheadEmissiveMat);
  overheadScrim.rotation.x = Math.PI / 2;
  overheadGroup.add(overheadScrim);

  const overheadAcc = createFixtureAccessories(3.2, 6.2, true);
  overheadGroup.add(overheadAcc.accGroup);

  const overheadSpot = new THREE.SpotLight(0xf8fbff, 22.0, 28.0, Math.PI * 0.44, 0.78, 1.35);
  overheadSpot.position.set(0, 3.8, -0.2);
  overheadSpot.target.position.set(0, 0.4, -0.2);
  overheadSpot.castShadow = true;
  overheadSpot.shadow.mapSize.set(STAGE_SHADOW_SIZE, STAGE_SHADOW_SIZE);
  overheadSpot.shadow.bias = -0.00025;
  group.add(overheadSpot);
  group.add(overheadSpot.target);
  group.add(overheadGroup);

  // --- STUDIO FIXTURE 2 & 3: LEFT & RIGHT VERTICAL STRIP RIM BANKS ---
  function createStripBank(sideSign) {
    const bank = new THREE.Group();
    const xPos = sideSign * 4.55;
    bank.position.set(xPos, 1.75, -0.5);
    bank.lookAt(0, 0.85, -0.2);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.95, 3.2, 0.14), darkTrussMat);
    frame.position.z = -0.08;
    bank.add(frame);

    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 4.8, 5.5) });
    const diffuser = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 3.08), mat);
    bank.add(diffuser);

    const acc = createFixtureAccessories(0.86, 3.08, false);
    bank.add(acc.accGroup);

    // C-stand pole & base
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.8, 12), darkTrussMat);
    stand.position.set(xPos * 1.04, 0.9, -0.5);
    group.add(stand);

    const spot = new THREE.SpotLight(0xffffff, 18.0, 26.0, Math.PI * 0.36, 0.65, 1.35);
    spot.position.set(xPos * 0.96, 1.85, -0.5);
    spot.target.position.set(0, 0.65, -0.15);
    group.add(spot);
    group.add(spot.target);
    group.add(bank);

    return { bank, mat, spot, stand, acc };
  }

  const leftStrip = createStripBank(-1);
  const rightStrip = createStripBank(1);

  // --- STUDIO FIXTURE 4: COMMERCIAL CIRCULAR RING LIGHT ---
  const ringGroup = new THREE.Group();
  ringGroup.position.set(-2.55, 1.58, -4.85);
  ringGroup.lookAt(0, 0.72, -0.25);

  const ringHousing = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.095, 20, 72), darkTrussMat);
  ringHousing.position.z = -0.04;
  ringGroup.add(ringHousing);

  const ringEmissiveMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(8.0, 8.2, 8.6) });
  const ringTube = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.068, 20, 72), ringEmissiveMat);
  ringGroup.add(ringTube);

  const ringAcc = createFixtureAccessories(2.2, 2.2, false);
  ringGroup.add(ringAcc.accGroup);

  const ringSpot = new THREE.SpotLight(0xffffff, 0.0, 28.0, Math.PI * 0.30, 0.45, 1.3);
  ringSpot.position.copy(ringGroup.position);
  ringSpot.target.position.set(0, 0.72, -0.25);
  group.add(ringSpot);
  group.add(ringSpot.target);
  group.add(ringGroup);

  // --- DYNAMIC EXTRA STUDIO LIGHTS CONTAINER ---
  const extraLightsGroup = new THREE.Group();
  extraLightsGroup.name = 'StudioExtraLights';
  group.add(extraLightsGroup);
  const extraLightEntries = new Map();

  // --- STUDIO FIXTURE 5: VENETIAN BLIND GOBO PROJECTOR ---
  const goboGroup = new THREE.Group();
  const goboSpot = new THREE.SpotLight(0xffad60, 0.0, 28.0, Math.PI * 0.24, 0.16, 1.2);
  goboSpot.position.set(5.6, 4.9, -4.4);
  goboSpot.target.position.set(0, 0.35, 0.0);
  goboSpot.castShadow = true;
  goboSpot.shadow.mapSize.set(STAGE_SHADOW_SIZE, STAGE_SHADOW_SIZE);
  goboSpot.shadow.camera.near = 1.2;
  goboSpot.shadow.camera.far = 22.0;
  goboSpot.shadow.bias = -0.00015;
  group.add(goboSpot);
  group.add(goboSpot.target);

  // Physical Venetian blind slat frame 2.1m in front of goboSpot so real slat shadows project across car & floor!
  const goboDir = new THREE.Vector3().subVectors(goboSpot.target.position, goboSpot.position).normalize();
  const blindCenter = goboSpot.position.clone().addScaledVector(goboDir, 2.25);
  const blindRig = new THREE.Group();
  blindRig.position.copy(blindCenter);
  blindRig.lookAt(goboSpot.target.position);

  const slatMat = new THREE.MeshBasicMaterial({ color: 0x050507, side: THREE.DoubleSide });
  for (let i = -9; i <= 9; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.052, 0.012), slatMat);
    slat.position.y = i * 0.095;
    slat.castShadow = true;
    blindRig.add(slat);
  }
  goboGroup.add(blindRig);
  group.add(goboGroup);

  // Studio fill hemisphere
  const studioHemi = new THREE.HemisphereLight(0xf0f5ff, 0x1a1e28, 0.42);
  group.add(studioHemi);

  const state = {
    presetId: 'clean_commercial',
    floorFinish: 'matte_white',
    overheadIntensity: 2.1,
    overheadColor: '#f8fbff',
    overheadPos: { x: 0, y: 3.85, z: -0.2 },
    overheadAccessory: 'none',
    leftRimIntensity: 1.35,
    leftRimColor: '#e8f2ff',
    leftRimPos: { x: -4.55, y: 1.75, z: -0.5 },
    leftRimAccessory: 'none',
    rightRimIntensity: 1.15,
    rightRimColor: '#fff3e6',
    rightRimPos: { x: 4.55, y: 1.75, z: -0.5 },
    rightRimAccessory: 'none',
    ringLightIntensity: 0.0,
    ringLightColor: '#ffffff',
    ringPos: { x: -2.55, y: 1.58, z: -4.85 },
    ringAccessory: 'none',
    goboIntensity: 0.0,
    goboColor: '#ffad60',
    cycWallColor: '#dcdfe6',
    ambientIntensity: 0.42,
    turntableEnabled: true,
    turntableSpeed: 0.25,
    fixturesOutOfWay: false,
    fixtureDistanceScale: 1.0,
    extraLights: [],
    ...initialState,
  };

  function applyAccessoryToFixture(acc, spot, baseAngle, basePenumbra, modeStr) {
    const m = modeStr || 'none';
    const hasBarn = m === 'barn_doors' || m === 'both';
    const hasHoney = m === 'honeycomb' || m === 'both';
    acc.barnGroup.visible = hasBarn;
    acc.honeyGroup.visible = hasHoney;
    let angleMult = 1.0;
    let penumbra = basePenumbra;
    if (hasBarn) {
      angleMult *= 0.66;
      penumbra = Math.max(0.12, penumbra * 0.65);
    }
    if (hasHoney) {
      angleMult *= 0.54;
      penumbra = Math.max(0.08, penumbra * 0.45);
    }
    spot.angle = Math.max(0.14, baseAngle * angleMult);
    spot.penumbra = penumbra;
  }

  function syncExtraLights(list, hidePhysical, distScale) {
    const activeIds = new Set((list || []).map((item) => item.id));
    for (const [id, entry] of extraLightEntries.entries()) {
      if (!activeIds.has(id)) {
        extraLightsGroup.remove(entry.holder, entry.spot, entry.spot.target);
        extraLightEntries.delete(id);
      }
    }
    for (const item of list || []) {
      let entry = extraLightEntries.get(item.id);
      if (!entry) {
        const holder = new THREE.Group();
        const housing = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.16), darkTrussMat);
        housing.position.z = -0.09;
        holder.add(housing);
        const emitMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 4) });
        const face = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.86), emitMat);
        holder.add(face);
        const acc = createFixtureAccessories(0.86, 0.86, false);
        holder.add(acc.accGroup);
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 2.2, 10), darkTrussMat);
        stand.position.set(0, -1.1, -0.1);
        holder.add(stand);

        const spot = new THREE.SpotLight(0xffffff, 15.0, 34.0, Math.PI * 0.34, 0.55, 1.3);
        extraLightsGroup.add(holder, spot, spot.target);
        entry = { holder, emitMat, acc, spot, stand };
        extraLightEntries.set(item.id, entry);
      }
      const lx = (Number(item.x) || 0) * distScale;
      const ly = Number(item.y) ?? 2.4;
      const lz = (Number(item.z) || 0) * distScale;
      entry.holder.position.set(lx, ly, lz);
      entry.holder.lookAt(0, 0.7, 0);
      entry.stand.visible = ly > 0.3 && ly < 4.5;
      entry.spot.position.set(lx, ly, lz);
      entry.spot.target.position.set(0, 0.65, 0);

      const col = new THREE.Color(item.color || '#ffffff');
      const inten = Math.max(0, Number(item.intensity) ?? 1.5);
      entry.spot.color.copy(col);
      entry.spot.intensity = inten * 14.0;
      entry.emitMat.color.copy(col).multiplyScalar(0.3 + inten * 3.4);
      entry.holder.visible = !hidePhysical && inten > 0.01;
      applyAccessoryToFixture(entry.acc, entry.spot, Math.PI * 0.34, 0.55, item.accessory);
    }
  }

  function applyStudioState(patch = {}) {
    Object.assign(state, patch);
    const hidePhysical = Boolean(state.fixturesOutOfWay);
    const distScale = Math.max(0.6, Math.min(2.6, Number(state.fixtureDistanceScale) || 1.0));

    // Floor finish
    if (state.floorFinish === 'matte_white') {
      floorMat.map = null;
      floorMat.normalMap = null;
      floorMat.roughnessMap = null;
      floorMat.color.set('#e8ebf0');
      floorMat.roughness = 0.72;
      floorMat.metalness = 0.02;
      floorMat.clearcoat = 0.06;
      floorMat.clearcoatRoughness = 0.35;
    } else if (state.floorFinish === 'dark_obsidian') {
      floorMat.map = null;
      floorMat.normalMap = null;
      floorMat.roughnessMap = null;
      floorMat.color.set('#11141b');
      floorMat.roughness = 0.23;
      floorMat.metalness = 0.22;
      floorMat.clearcoat = 0.65;
      floorMat.clearcoatRoughness = 0.14;
    } else if (state.floorFinish === 'wet_mirror') {
      floorMat.map = null;
      floorMat.normalMap = wetNormal;
      floorMat.normalScale.set(0.18, 0.18);
      floorMat.roughnessMap = null;
      floorMat.color.set('#080b10');
      floorMat.roughness = 0.045;
      floorMat.metalness = 0.28;
      floorMat.clearcoat = 1.0;
      floorMat.clearcoatRoughness = 0.025;
    } else if (state.floorFinish === 'brushed_concrete') {
      floorMat.map = concreteMaps.albedo;
      floorMat.normalMap = concreteMaps.normal;
      floorMat.normalScale.set(0.65, 0.65);
      floorMat.roughnessMap = concreteMaps.roughness;
      floorMat.color.set('#ffffff');
      floorMat.roughness = 0.78;
      floorMat.metalness = 0.05;
      floorMat.clearcoat = 0.18;
      floorMat.clearcoatRoughness = 0.28;
    }
    floorMat.needsUpdate = true;

    cycWallMat.color.set(state.cycWallColor || '#dcdfe6');
    cycWallMat.needsUpdate = true;

    // Overhead Softbox
    const ohCol = new THREE.Color(state.overheadColor || '#f8fbff');
    const ohInt = Math.max(0, Number(state.overheadIntensity) ?? 1.5);
    const ohPos = state.overheadPos || { x: 0, y: 3.85, z: -0.2 };
    overheadGroup.position.set(ohPos.x ?? 0, ohPos.y ?? 3.85, ohPos.z ?? -0.2);
    overheadSpot.position.set(ohPos.x ?? 0, (ohPos.y ?? 3.85) - 0.05, ohPos.z ?? -0.2);
    overheadSpot.target.position.set(0, 0.4, -0.2);
    overheadSpot.color.copy(ohCol);
    overheadSpot.intensity = ohInt * 12.5;
    overheadEmissiveMat.color.copy(ohCol).multiplyScalar(0.35 + ohInt * 3.2);
    overheadGroup.visible = !hidePhysical && ohInt > 0.01;
    applyAccessoryToFixture(overheadAcc, overheadSpot, Math.PI * 0.44, 0.78, state.overheadAccessory);

    // Left Strip
    const lCol = new THREE.Color(state.leftRimColor || '#e8f2ff');
    const lInt = Math.max(0, Number(state.leftRimIntensity) ?? 1.2);
    const lPos = state.leftRimPos || { x: -4.55, y: 1.75, z: -0.5 };
    const lx = (lPos.x ?? -4.55) * distScale;
    const ly = lPos.y ?? 1.75;
    const lz = (lPos.z ?? -0.5) * distScale;
    leftStrip.bank.position.set(lx, ly, lz);
    leftStrip.bank.lookAt(0, 0.85, -0.2);
    leftStrip.stand.position.set(lx * 1.04, ly * 0.5, lz);
    leftStrip.stand.scale.y = Math.max(0.4, ly / 1.8);
    leftStrip.spot.position.set(lx * 0.96, ly + 0.1, lz);
    leftStrip.spot.target.position.set(0, 0.65, -0.15);
    leftStrip.spot.color.copy(lCol);
    leftStrip.spot.intensity = lInt * 11.5;
    leftStrip.mat.color.copy(lCol).multiplyScalar(0.25 + lInt * 3.4);
    leftStrip.bank.visible = !hidePhysical && lInt > 0.01;
    leftStrip.stand.visible = !hidePhysical && lInt > 0.01;
    applyAccessoryToFixture(leftStrip.acc, leftStrip.spot, Math.PI * 0.36, 0.65, state.leftRimAccessory);

    // Right Strip
    const rCol = new THREE.Color(state.rightRimColor || '#fff3e6');
    const rInt = Math.max(0, Number(state.rightRimIntensity) ?? 1.2);
    const rPos = state.rightRimPos || { x: 4.55, y: 1.75, z: -0.5 };
    const rx = (rPos.x ?? 4.55) * distScale;
    const ry = rPos.y ?? 1.75;
    const rz = (rPos.z ?? -0.5) * distScale;
    rightStrip.bank.position.set(rx, ry, rz);
    rightStrip.bank.lookAt(0, 0.85, -0.2);
    rightStrip.stand.position.set(rx * 1.04, ry * 0.5, rz);
    rightStrip.stand.scale.y = Math.max(0.4, ry / 1.8);
    rightStrip.spot.position.set(rx * 0.96, ry + 0.1, rz);
    rightStrip.spot.target.position.set(0, 0.65, -0.15);
    rightStrip.spot.color.copy(rCol);
    rightStrip.spot.intensity = rInt * 11.5;
    rightStrip.mat.color.copy(rCol).multiplyScalar(0.25 + rInt * 3.4);
    rightStrip.bank.visible = !hidePhysical && rInt > 0.01;
    rightStrip.stand.visible = !hidePhysical && rInt > 0.01;
    applyAccessoryToFixture(rightStrip.acc, rightStrip.spot, Math.PI * 0.36, 0.65, state.rightRimAccessory);

    // Ring Light
    const ringCol = new THREE.Color(state.ringLightColor || '#ffffff');
    const ringInt = Math.max(0, Number(state.ringLightIntensity) ?? 0.0);
    const rgPos = state.ringPos || { x: -2.55, y: 1.58, z: -4.85 };
    const rgx = (rgPos.x ?? -2.55) * distScale;
    const rgy = rgPos.y ?? 1.58;
    const rgz = (rgPos.z ?? -4.85) * distScale;
    ringGroup.position.set(rgx, rgy, rgz);
    ringGroup.lookAt(0, 0.72, -0.25);
    ringSpot.position.copy(ringGroup.position);
    ringSpot.target.position.set(0, 0.72, -0.25);
    ringSpot.color.copy(ringCol);
    ringSpot.intensity = ringInt * 13.0;
    ringEmissiveMat.color.copy(ringCol).multiplyScalar(ringInt > 0.02 ? 1.2 + ringInt * 3.8 : 0.0);
    ringGroup.visible = !hidePhysical && ringInt > 0.02;
    applyAccessoryToFixture(ringAcc, ringSpot, Math.PI * 0.30, 0.45, state.ringAccessory);

    // Venetian Gobo
    const goboCol = new THREE.Color(state.goboColor || '#ffad60');
    const goboInt = Math.max(0, Number(state.goboIntensity) ?? 0.0);
    goboSpot.color.copy(goboCol);
    goboSpot.intensity = goboInt * 24.0;
    goboGroup.visible = !hidePhysical && goboInt > 0.02;

    // Extra Dynamic Studio Lights
    syncExtraLights(state.extraLights, hidePhysical, distScale);

    // Studio Fill & Turntable
    studioHemi.intensity = Math.max(0.05, Number(state.ambientIntensity) ?? 0.35);
    turntableGroup.visible = Boolean(state.turntableEnabled);
    trimRingMat.color.copy(lCol).lerp(rCol, 0.5).multiplyScalar(1.8);

    return { ...state };
  }

  applyStudioState(state);

  return {
    group,
    turntableGroup,
    applyStudioState,
    getState: () => ({ ...state }),
  };
}

/**
 * 2. COMPACT TILED-PBR DAY WAREHOUSE COURTYARD (`warehouse_courtyard_day`)
 */
export function buildWarehouseCourtyardStage(renderer) {
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() || 16;
  const group = new THREE.Group();
  group.name = 'WarehouseCourtyardDayStage';

  const brick = createBrickMaps(maxAniso, 12, 5);
  const brickSide = createBrickMaps(maxAniso, 8, 5);
  const concrete = createJointedConcreteMaps(maxAniso, 22, 22, false);
  const dockConcrete = createJointedConcreteMaps(maxAniso, 8, 2, true);
  const steelRoll = createCorrugatedSteelMaps(maxAniso, 2, 2);

  // Crisp Jointed Concrete Courtyard Pad (76m x 76m)
  const groundMat = new THREE.MeshStandardMaterial({
    map: concrete.albedo,
    normalMap: concrete.normal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: concrete.roughness,
    roughness: 0.86,
    metalness: 0.04,
  });
  const courtyard = new THREE.Mesh(new THREE.PlaneGeometry(84, 84), groundMat);
  courtyard.rotation.x = -Math.PI / 2;
  courtyard.receiveShadow = true;
  group.add(courtyard);

  // Subtle painted parking/loading bay stripes near origin (behind car so hero shot looks clean)
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xd99b26, roughness: 0.72, metalness: 0.05 });
  for (const x of [-2.4, 2.4]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 5.8), stripeMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.002, 0.2);
    line.receiveShadow = true;
    group.add(line);
  }

  // Main Industrial Red-Brick Warehouse Facade behind car at Z = +9.2m
  const brickMat = new THREE.MeshStandardMaterial({
    map: brick.albedo,
    normalMap: brick.normal,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: brick.roughness,
    roughness: 0.88,
    metalness: 0.03,
  });
  const mainWall = new THREE.Mesh(new THREE.BoxGeometry(38, 10.5, 0.8), brickMat);
  mainWall.position.set(0, 5.25, 9.4);
  mainWall.castShadow = true;
  mainWall.receiveShadow = true;
  group.add(mainWall);

  // L-shaped side warehouse wing at X = +16.5m for realistic architectural enclosure & reflections
  const sideBrickMat = new THREE.MeshStandardMaterial({
    map: brickSide.albedo,
    normalMap: brickSide.normal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    roughnessMap: brickSide.roughness,
    roughness: 0.88,
    metalness: 0.03,
  });
  const sideWing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 9.6, 26), sideBrickMat);
  sideWing.position.set(17.5, 4.8, -3.2);
  sideWing.castShadow = true;
  sideWing.receiveShadow = true;
  group.add(sideWing);

  // Raised Concrete Loading Dock Apron along rear warehouse wall
  const dockMat = new THREE.MeshStandardMaterial({
    map: dockConcrete.albedo,
    normalMap: dockConcrete.normal,
    roughnessMap: dockConcrete.roughness,
    roughness: 0.82,
    metalness: 0.05,
  });
  const dockApron = new THREE.Mesh(new THREE.BoxGeometry(28, 0.42, 2.2), dockMat);
  dockApron.position.set(-1.5, 0.21, 8.0);
  dockApron.castShadow = true;
  dockApron.receiveShadow = true;
  group.add(dockApron);

  // 3 Roll-Up Corrugated Steel Loading Bay Doors + Steel Frames + Overhang Canopy
  const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x22262d, roughness: 0.42, metalness: 0.82 });
  const rollDoorMat = new THREE.MeshStandardMaterial({
    map: steelRoll.albedo,
    normalMap: steelRoll.normal,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughness: 0.38,
    metalness: 0.76,
  });

  for (const bx of [-8.5, 0.0, 8.5]) {
    // Steel bay surround
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.24, 0.32), darkSteelMat);
    frameTop.position.set(bx, 4.62, 8.95);
    frameTop.castShadow = true;
    group.add(frameTop);

    for (const sx of [-2.05, 2.05]) {
      const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4.3, 0.32), darkSteelMat);
      jamb.position.set(bx + sx, 2.45, 8.95);
      jamb.castShadow = true;
      group.add(jamb);
    }

    const rollDoor = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 4.15), rollDoorMat);
    rollDoor.position.set(bx, 2.48, 8.98);
    rollDoor.rotation.y = Math.PI;
    rollDoor.receiveShadow = true;
    group.add(rollDoor);

    // Industrial multi-pane factory clerestory window above each bay
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x1b2836,
      roughness: 0.12,
      metalness: 0.2,
      clearcoat: 1.0,
    });
    const upperWin = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.8), glassMat);
    upperWin.position.set(bx, 7.2, 8.98);
    upperWin.rotation.y = Math.PI;
    group.add(upperWin);

    for (let g = -1; g <= 1; g++) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.84, 0.08), darkSteelMat);
      mullion.position.set(bx + g * 0.95, 7.2, 8.96);
      group.add(mullion);
    }

    // Safety yellow steel bollards flanking bay
    const bollardMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.34, metalness: 0.45 });
    for (const sB of [-2.25, 2.25]) {
      const bollard = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.05, 16), bollardMat);
      bollard.position.set(bx + sB, 0.525, 6.75);
      bollard.castShadow = true;
      bollard.receiveShadow = true;
      group.add(bollard);
    }

    // Gooseneck warm wall sconce above bay
    const sconceShade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 16), darkSteelMat);
    sconceShade.position.set(bx, 5.25, 8.6);
    group.add(sconceShade);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 2.6, 1.4) })
    );
    bulb.position.set(bx, 5.16, 8.6);
    group.add(bulb);
  }

  // Corrugated steel canopy overhang casting crisp geometric shadow lines
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(30, 0.18, 3.1), darkSteelMat);
  canopy.position.set(-1.5, 5.65, 7.45);
  canopy.castShadow = true;
  canopy.receiveShadow = true;
  group.add(canopy);

  // Diagonal steel tie rods holding canopy
  for (let x = -13.5; x <= 10.5; x += 6.0) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 3.4, 8), darkSteelMat);
    rod.position.set(x, 6.85, 7.85);
    rod.rotation.x = -0.68;
    rod.castShadow = true;
    group.add(rod);
  }

  // Rooftop galvanized HVAC ducting + coping
  const coping = new THREE.Mesh(new THREE.BoxGeometry(38.4, 0.32, 1.0), darkSteelMat);
  coping.position.set(0, 10.6, 9.4);
  group.add(coping);

  // Clear crisp golden-daylight sky dome
  const skyGeo = new THREE.SphereGeometry(220, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      void main() {
        float h = clamp(normalize(vWorldPos).y, 0.0, 1.0);
        vec3 horizon = vec3(0.76, 0.81, 0.88);
        vec3 zenith = vec3(0.20, 0.42, 0.74);
        vec3 col = mix(horizon, zenith, pow(h, 0.58));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  group.add(new THREE.Mesh(skyGeo, skyMat));

  return { group };
}

/**
 * 3. COMPACT TILED-PBR URBAN STREET AVENUE (`city_bokeh_street_day` & `wet_night_bokeh_street`)
 * Engineered with real HDR point/emissive streetlamps, traffic lights, neon signs,
 * oncoming/outgoing light orbs, and rain-puddle specular asphalt for 85mm f/1.2 & 200mm f/2.8 bokeh!
 */
export function buildCityBokehStreetStage(renderer, { isNight = true } = {}) {
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() || 16;
  const group = new THREE.Group();
  group.name = isNight ? 'WetNightBokehStreetStage' : 'CityBokehStreetDayStage';

  const asphalt = createAsphaltMaps(maxAniso, 8, 44, isNight);
  const sidewalkMaps = createJointedConcreteMaps(maxAniso, 6, 48, isNight);
  const brickMaps = createBrickMaps(maxAniso, 6, 4);

  // Roadway (13.6m wide x 150m long avenue along Z)
  const roadMat = isNight
    ? new THREE.MeshPhysicalMaterial({
        map: asphalt.albedo,
        normalMap: asphalt.normal,
        normalScale: new THREE.Vector2(0.55, 0.55),
        roughnessMap: asphalt.roughness,
        roughness: 1.0,
        metalness: 0.18,
        clearcoat: 0.92,
        clearcoatRoughnessMap: asphalt.roughness,
        clearcoatRoughness: 0.22,
        envMapIntensity: 1.65,
      })
    : new THREE.MeshStandardMaterial({
        map: asphalt.albedo,
        normalMap: asphalt.normal,
        normalScale: new THREE.Vector2(0.9, 0.9),
        roughnessMap: asphalt.roughness,
        roughness: 0.84,
        metalness: 0.04,
      });

  const roadMesh = new THREE.Mesh(new THREE.PlaneGeometry(13.6, 160), roadMat);
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // Double-yellow center line & white lane markings
  const yellowPaint = new THREE.MeshStandardMaterial({
    color: isNight ? 0xc89218 : 0xeab308,
    roughness: isNight ? 0.25 : 0.65,
  });
  const whitePaint = new THREE.MeshStandardMaterial({
    color: isNight ? 0xcbd5e1 : 0xf1f5f9,
    roughness: isNight ? 0.25 : 0.65,
  });
  for (const xOff of [-2.45, -2.30]) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 156), yellowPaint);
    line.rotation.x = -Math.PI / 2;
    line.position.set(xOff, 0.002, 0);
    line.receiveShadow = true;
    group.add(line);
  }
  // Crosswalk bars at Z = +9.5m (behind hero car for authentic urban graphic framing!)
  for (let cx = -5.8; cx <= 5.8; cx += 0.95) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 2.8), whitePaint);
    bar.rotation.x = -Math.PI / 2;
    bar.position.set(cx, 0.0025, 9.8);
    bar.receiveShadow = true;
    group.add(bar);
  }

  // Granite Curbs & Tiled Sidewalks on Left (-X) & Right (+X)
  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: sidewalkMaps.albedo,
    normalMap: sidewalkMaps.normal,
    roughnessMap: sidewalkMaps.roughness,
    roughness: isNight ? 0.36 : 0.82,
    metalness: 0.06,
  });
  const curbMat = new THREE.MeshStandardMaterial({
    color: isNight ? 0x3b4049 : 0x7c828d,
    roughness: isNight ? 0.32 : 0.75,
  });

  for (const side of [-1, 1]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 160), curbMat);
    curb.position.set(side * 6.94, 0.08, 0);
    curb.castShadow = true;
    curb.receiveShadow = true;
    group.add(curb);

    const walk = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.15, 160), sidewalkMat);
    walk.position.set(side * 9.88, 0.075, 0);
    walk.receiveShadow = true;
    group.add(walk);
  }

  // Architectural Storefront Blocks & Neon Signs along Z = -60 .. +75
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x161920, roughness: 0.36, metalness: 0.82 });
  const facadeBrickMat = new THREE.MeshStandardMaterial({
    map: brickMaps.albedo,
    normalMap: brickMaps.normal,
    roughnessMap: brickMaps.roughness,
    roughness: 0.85,
  });
  const stoneFacadeMat = new THREE.MeshStandardMaterial({
    color: isNight ? 0x262a33 : 0x8f8a82,
    roughness: 0.78,
  });
  const glassStoreMat = new THREE.MeshPhysicalMaterial({
    color: isNight ? 0x0b1320 : 0x1e2c3a,
    roughness: 0.08,
    metalness: 0.15,
    clearcoat: 1.0,
  });

  const neonPalette = [
    new THREE.Color(0.0, 14.0, 22.0),  // Electric Cyan HDR
    new THREE.Color(24.0, 2.2, 7.5),   // Crimson Neon Pink HDR
    new THREE.Color(22.0, 11.5, 1.2),  // Warm Amber Gold HDR
    new THREE.Color(3.5, 9.0, 24.0),   // Cobalt Blue HDR
    new THREE.Color(2.0, 20.0, 9.5),   // Emerald Mint HDR
  ];

  let bIdx = 0;
  for (const side of [-1, 1]) {
    for (let z = -54; z <= 72; z += 14) {
      bIdx++;
      const bHeight = 11.5 + (bIdx % 4) * 3.4;
      const bMat = bIdx % 2 === 0 ? facadeBrickMat : stoneFacadeMat;
      const bldg = new THREE.Mesh(new THREE.BoxGeometry(8.0, bHeight, 13.4), bMat);
      bldg.position.set(side * 16.5, bHeight * 0.5, z);
      bldg.castShadow = !isNight;
      bldg.receiveShadow = true;
      group.add(bldg);

      // Ground-floor recessed storefront window
      const win = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 3.1), glassStoreMat);
      win.position.set(side * 12.46, 1.85, z);
      win.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(win);

      // Warm interior storefront glow panel at night
      if (isNight) {
        const warmGlow = new THREE.Mesh(
          new THREE.PlaneGeometry(8.8, 2.4),
          new THREE.MeshBasicMaterial({
            color: bIdx % 3 === 0 ? new THREE.Color(1.4, 2.0, 3.2) : new THREE.Color(3.2, 2.1, 1.1),
          })
        );
        warmGlow.position.set(side * 12.48, 1.85, z);
        warmGlow.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        group.add(warmGlow);

        // Blade Neon Sign projecting over sidewalk -> melts into gorgeous color bokeh discs!
        const neonCol = neonPalette[bIdx % neonPalette.length];
        const neonMat = new THREE.MeshBasicMaterial({ color: neonCol });
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.1, 0.12), neonMat);
        blade.position.set(side * 11.75, 4.4 + (bIdx % 2) * 0.9, z + 2.8);
        group.add(blade);

        // Accent neon point-orb accents on sign corners (discrete circular bokeh highlights!)
        for (const oy of [-0.85, 0.0, 0.85]) {
          const orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.095, 12, 12),
            new THREE.MeshBasicMaterial({ color: neonCol.clone().multiplyScalar(1.45) })
          );
          orb.position.set(side * 11.2, 4.4 + (bIdx % 2) * 0.9 + oy, z + 2.8);
          group.add(orb);
        }
      }
    }
  }

  // Streetlamps every 14m down both curbs (+ real Spot/Point lights near the car + HDR emissive bulbs all the way to Z = ±72m!)
  const warmSodiumHdr = new THREE.Color(24.0, 15.5, 6.2);
  const coolLedHdr = new THREE.Color(14.0, 17.5, 24.0);

  for (const side of [-1, 1]) {
    for (let z = -56; z <= 70; z += 14) {
      const poleX = side * 7.35;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.095, 6.2, 12), darkMetalMat);
      pole.position.set(poleX, 3.1, z);
      pole.castShadow = !isNight;
      group.add(pole);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.08, 0.08), darkMetalMat);
      arm.position.set(poleX - side * 0.78, 6.15, z);
      group.add(arm);

      if (isNight) {
        const bulbCol = Math.abs(z) < 16 ? coolLedHdr : warmSodiumHdr;
        const luminaire = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 16, 16),
          new THREE.MeshBasicMaterial({ color: bulbCol })
        );
        luminaire.position.set(poleX - side * 1.52, 6.06, z);
        group.add(luminaire);

        // Real dynamic lights on the 4 closest streetlamps around the car so wet puddles & clearcoat gleam!
        if (Math.abs(z) <= 15) {
          const pLight = new THREE.PointLight(
            z === 0 ? 0xdbeafe : 0xffb36b,
            z === 0 ? 14.0 : 9.5,
            24.0,
            1.45
          );
          pLight.position.set(poleX - side * 1.52, 5.9, z);
          group.add(pLight);
        }
      }
    }
  }

  // Traffic Light Gantries at Z = +18m & Z = +46m & Z = -24m (classic ruby-red / emerald-green / amber night bokeh!)
  const sigRed = new THREE.MeshBasicMaterial({ color: isNight ? new THREE.Color(28.0, 1.8, 1.8) : 0xef4444 });
  const sigAmb = new THREE.MeshBasicMaterial({ color: isNight ? new THREE.Color(26.0, 14.0, 1.2) : 0xf59e0b });
  const sigGrn = new THREE.MeshBasicMaterial({ color: isNight ? new THREE.Color(1.8, 24.0, 8.5) : 0x10b981 });

  for (const gz of [19.5, 47.5, -24.0]) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 6.4, 12), darkMetalMat);
    mast.position.set(7.2, 3.2, gz);
    group.add(mast);

    const beam = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.11, 0.11), darkMetalMat);
    beam.position.set(2.4, 6.1, gz);
    group.add(beam);

    for (const lx of [-1.2, 3.2]) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.96, 0.24), darkMetalMat);
      box.position.set(lx, 5.85, gz);
      group.add(box);

      const matChoice = gz > 30 ? sigGrn : lx < 0 ? sigRed : sigAmb;
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 14), matChoice);
      lens.position.set(lx, 5.85, gz - 0.12);
      group.add(lens);
    }
  }

  // Distant traffic headlight & ruby taillight bokeh clusters at Z = +28m .. +74m and Z = -30m .. -64m
  if (isNight) {
    const headOrbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(26.0, 24.0, 20.0) });
    const tailOrbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(28.0, 1.4, 2.0) });

    const trafficPairs = [
      { x: 1.6, z: 26, mat: tailOrbMat },
      { x: 4.4, z: 37, mat: tailOrbMat },
      { x: 1.8, z: 52, mat: tailOrbMat },
      { x: 4.3, z: 66, mat: tailOrbMat },
      { x: -4.2, z: 33, mat: headOrbMat },
      { x: -1.5, z: 45, mat: headOrbMat },
      { x: -4.4, z: 61, mat: headOrbMat },
      { x: 1.7, z: -32, mat: headOrbMat },
      { x: -4.1, z: -44, mat: tailOrbMat },
    ];
    for (const tp of trafficPairs) {
      for (const wx of [-0.68, 0.68]) {
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 14), tp.mat);
        orb.position.set(tp.x + wx, 0.68, tp.z);
        group.add(orb);
      }
    }
  }

  // Sky Dome (deep twilight/midnight urban glow at night, crisp blue city sky by day)
  const skyGeo = new THREE.SphereGeometry(220, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uNight: { value: isNight ? 1.0 : 0.0 } },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uNight;
      varying vec3 vWorldPos;
      void main() {
        float h = clamp(normalize(vWorldPos).y, 0.0, 1.0);
        vec3 dayCol = mix(vec3(0.72, 0.79, 0.88), vec3(0.18, 0.40, 0.72), pow(h, 0.55));
        vec3 nightCol = mix(vec3(0.035, 0.045, 0.085), vec3(0.005, 0.008, 0.020), pow(h, 0.48));
        gl_FragColor = vec4(mix(dayCol, nightCol, uNight), 1.0);
      }
    `,
  });
  group.add(new THREE.Mesh(skyGeo, skyMat));

  return { group };
}

/**
 * Shared procedural GP track builder (ribbon asphalt + FIA red/white kerbs + Armco barriers + start/finish gantry)
 */
function buildCircuitRibbon(group, maxAniso, { trackWidth = 13.0, curvePoints, kerbColorA = 0xdc2626, kerbColorB = 0xf8fafc, barrierColor = 0x94a3b8 }) {
  const curve = new THREE.CatmullRomCurve3(curvePoints, true, 'catmullrom', 0.45);
  const segs = 220;
  const halfW = trackWidth * 0.5;
  const kerbW = 0.85;

  const roadPos = [];
  const roadUv = [];
  const roadIdx = [];

  const kerbPosA = [];
  const kerbIdxA = [];
  const kerbPosB = [];
  const kerbIdxB = [];

  const barrierPosL = [];
  const barrierIdxL = [];
  const barrierPosR = [];
  const barrierIdxR = [];

  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();

    const pL = pt.clone().addScaledVector(right, -halfW);
    const pR = pt.clone().addScaledVector(right, halfW);
    roadPos.push(pL.x, 0.002, pL.z, pR.x, 0.002, pR.z);
    roadUv.push(0, t * 48, 1, t * 48);

    // Alternating kerbs on outer/inner edges
    const kL0 = pt.clone().addScaledVector(right, -(halfW + kerbW));
    const kL1 = pt.clone().addScaledVector(right, -halfW);
    const kR0 = pt.clone().addScaledVector(right, halfW);
    const kR1 = pt.clone().addScaledVector(right, halfW + kerbW);

    const targetPos = i % 2 === 0 ? kerbPosA : kerbPosB;
    const base = targetPos.length / 3;
    targetPos.push(
      kL0.x, 0.012, kL0.z,
      kL1.x, 0.012, kL1.z,
      kR0.x, 0.012, kR0.z,
      kR1.x, 0.012, kR1.z
    );
    const targetIdx = i % 2 === 0 ? kerbIdxA : kerbIdxB;
    if (i < segs) {
      // Connect to previous or next small strip
    }

    // Armco barrier wall 1.4m outside kerb
    const bL = pt.clone().addScaledVector(right, -(halfW + kerbW + 1.4));
    const bR = pt.clone().addScaledVector(right, halfW + kerbW + 1.4);
    barrierPosL.push(bL.x, 0.0, bL.z, bL.x, 0.92, bL.z);
    barrierPosR.push(bR.x, 0.0, bR.z, bR.x, 0.92, bR.z);

    if (i < segs) {
      const rBase = i * 2;
      roadIdx.push(rBase, rBase + 1, rBase + 2, rBase + 1, rBase + 3, rBase + 2);
      barrierIdxL.push(rBase, rBase + 2, rBase + 1, rBase + 1, rBase + 2, rBase + 3);
      barrierIdxR.push(rBase, rBase + 1, rBase + 2, rBase + 1, rBase + 3, rBase + 2);
    }
  }

  // Asphalt texture
  const asphCanvas = document.createElement('canvas');
  asphCanvas.width = 512;
  asphCanvas.height = 512;
  const ctx = asphCanvas.getContext('2d');
  ctx.fillStyle = '#1e222a';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6500; i++) {
    const v = 22 + Math.floor(Math.random() * 26);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  // White track boundary lines + center racing rubber
  ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
  ctx.fillRect(14, 0, 8, 512);
  ctx.fillRect(490, 0, 8, 512);
  ctx.fillStyle = 'rgba(10, 12, 16, 0.35)';
  ctx.fillRect(180, 0, 152, 512);

  const asphTex = new THREE.CanvasTexture(asphCanvas);
  asphTex.wrapS = asphTex.wrapT = THREE.RepeatWrapping;
  asphTex.colorSpace = THREE.SRGBColorSpace;
  asphTex.anisotropy = maxAniso;

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUv, 2));
  roadGeo.setIndex(roadIdx);
  roadGeo.computeVertexNormals();

  const roadMat = new THREE.MeshStandardMaterial({
    map: asphTex,
    roughness: 0.62,
    metalness: 0.08,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // FIA Alternating Kerb Blocks
  const kerbMatA = new THREE.MeshStandardMaterial({ color: kerbColorA, roughness: 0.55 });
  const kerbMatB = new THREE.MeshStandardMaterial({ color: kerbColorB, roughness: 0.55 });
  const kerbBoxGeo = new THREE.BoxGeometry(kerbW, 0.05, 1.45);
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const pt = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tan, up).normalize();
    const yaw = Math.atan2(tan.x, tan.z);
    const mat = i % 2 === 0 ? kerbMatA : kerbMatB;

    const kL = new THREE.Mesh(kerbBoxGeo, mat);
    kL.position.copy(pt).addScaledVector(right, -(halfW + kerbW * 0.5));
    kL.position.y = 0.025;
    kL.rotation.y = yaw;
    kL.receiveShadow = true;
    group.add(kL);

    const kR = new THREE.Mesh(kerbBoxGeo, mat);
    kR.position.copy(pt).addScaledVector(right, halfW + kerbW * 0.5);
    kR.position.y = 0.025;
    kR.rotation.y = yaw;
    kR.receiveShadow = true;
    group.add(kR);
  }

  // Armco Barriers
  const barrierMat = new THREE.MeshStandardMaterial({
    color: barrierColor,
    roughness: 0.35,
    metalness: 0.68,
    side: THREE.DoubleSide,
  });
  for (const [bPos, bIdx] of [[barrierPosL, barrierIdxL], [barrierPosR, barrierIdxR]]) {
    const bGeo = new THREE.BufferGeometry();
    bGeo.setAttribute('position', new THREE.Float32BufferAttribute(bPos, 3));
    bGeo.setIndex(bIdx);
    bGeo.computeVertexNormals();
    const bMesh = new THREE.Mesh(bGeo, barrierMat);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    group.add(bMesh);
  }

  // Start / Finish Gantry at Z = -8m (ahead of spawn at 0,0,0 facing -Z)
  const gantryMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.78 });
  for (const gx of [-(halfW + 1.4), halfW + 1.4]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.65, 6.2, 0.65), gantryMat);
    pillar.position.set(gx, 3.1, -8);
    pillar.castShadow = true;
    group.add(pillar);
  }
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(trackWidth + 3.6, 1.15, 0.8), gantryMat);
  bridge.position.set(0, 5.75, -8);
  bridge.castShadow = true;
  group.add(bridge);

  // 5 FIA Starting Lights
  const startLightMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(12.0, 1.2, 1.2) });
  for (let i = -2; i <= 2; i++) {
    const pod = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), startLightMat);
    pod.position.set(i * 0.95, 5.45, -7.55);
    group.add(pod);
  }

  // Checkered Start/Finish Line at Z = -8m
  const sfCanvas = document.createElement('canvas');
  sfCanvas.width = 256;
  sfCanvas.height = 64;
  const sctx = sfCanvas.getContext('2d');
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 16; x++) {
      sctx.fillStyle = (x + y) % 2 === 0 ? '#f8fafc' : '#0f172a';
      sctx.fillRect(x * 16, y * 16, 16, 16);
    }
  }
  const sfTex = new THREE.CanvasTexture(sfCanvas);
  sfTex.colorSpace = THREE.SRGBColorSpace;
  const sfLine = new THREE.Mesh(
    new THREE.PlaneGeometry(trackWidth - 0.6, 1.6),
    new THREE.MeshStandardMaterial({ map: sfTex, roughness: 0.5 })
  );
  sfLine.rotation.x = -Math.PI / 2;
  sfLine.position.set(0, 0.008, -8);
  sfLine.receiveShadow = true;
  group.add(sfLine);

  return curve;
}

/**
 * 6. METROPOLITAN CITY GRAND PRIX STREET CIRCUIT (`city_gp_circuit`)
 */
export function buildCityGpCircuitStage(renderer) {
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() || 16;
  const group = new THREE.Group();
  group.name = 'CityGpCircuitStage';

  // Ground apron
  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 460),
    new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.85, metalness: 0.05 })
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  apron.receiveShadow = true;
  group.add(apron);

  // Sweeping urban circuit passing straight through (0, 0, 0) along -Z
  const curvePoints = [
    new THREE.Vector3(0, 0, 25),
    new THREE.Vector3(0, 0, -45),
    new THREE.Vector3(24, 0, -92),
    new THREE.Vector3(82, 0, -96),
    new THREE.Vector3(115, 0, -48),
    new THREE.Vector3(98, 0, 18),
    new THREE.Vector3(118, 0, 72),
    new THREE.Vector3(64, 0, 96),
    new THREE.Vector3(12, 0, 74),
  ];
  buildCircuitRibbon(group, maxAniso, { trackWidth: 13.5, curvePoints });

  // City Skyscrapers & Lit Window Towers around the circuit
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.6 });
  const winCanvas = document.createElement('canvas');
  winCanvas.width = 256;
  winCanvas.height = 512;
  const wctx = winCanvas.getContext('2d');
  wctx.fillStyle = '#0f172a';
  wctx.fillRect(0, 0, 256, 512);
  for (let row = 0; row < 32; row++) {
    for (let col = 0; col < 12; col++) {
      const lit = Math.random() > 0.32;
      wctx.fillStyle = lit
        ? Math.random() > 0.7 ? '#bae6fd' : '#fde68a'
        : '#1e293b';
      wctx.fillRect(8 + col * 20, 8 + row * 15, 13, 9);
    }
  }
  const winTex = new THREE.CanvasTexture(winCanvas);
  winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
  winTex.colorSpace = THREE.SRGBColorSpace;
  const winMat = new THREE.MeshStandardMaterial({
    map: winTex,
    emissiveMap: winTex,
    emissive: new THREE.Color(0.55, 0.65, 0.8),
    roughness: 0.25,
    metalness: 0.5,
  });

  const buildings = [
    [-26, -32, 16, 48, 16], [-28, -4, 14, 34, 18], [-25, 24, 16, 56, 16],
    [-28, 56, 18, 42, 20], [26, -24, 14, 38, 16], [28, 16, 16, 62, 16],
    [54, -46, 20, 72, 20], [56, 26, 18, 52, 18], [148, -60, 22, 68, 22],
    [146, 20, 20, 58, 20], [92, -130, 24, 78, 20], [-12, -124, 22, 64, 20],
    [60, 130, 22, 54, 22], [-18, 110, 18, 46, 18],
  ];
  for (const [bx, bz, bw, bh, bd] of buildings) {
    const bMesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), [winMat, winMat, towerMat, towerMat, winMat, winMat]);
    bMesh.position.set(bx, bh * 0.5, bz);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    group.add(bMesh);
  }

  // Pit Grandstand along the main straight (left side)
  const standMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6, metalness: 0.3 });
  for (let tier = 0; tier < 4; tier++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 36), standMat);
    step.position.set(-13.5 - tier * 2.1, 0.6 + tier * 0.8, -14);
    step.castShadow = true;
    step.receiveShadow = true;
    group.add(step);
  }

  // Streetlight Poles along main straight
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.8 });
  const lampMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6.0, 6.4, 7.2) });
  for (let z = -55; z <= 35; z += 18) {
    for (const side of [-1, 1]) {
      const px = side * 9.8;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 6.2, 8), poleMat);
      pole.position.set(px, 3.1, z);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 0.35), lampMat);
      lamp.position.set(px - side * 0.7, 6.15, z);
      group.add(lamp);
    }
  }

  // Crisp twilight/daylight city sky dome
  const skyGeo = new THREE.SphereGeometry(320, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      void main() {
        float h = clamp(normalize(vWorldPos).y, 0.0, 1.0);
        vec3 col = mix(vec3(0.45, 0.56, 0.72), vec3(0.11, 0.24, 0.48), pow(h, 0.55));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  group.add(new THREE.Mesh(skyGeo, skyMat));

  return { group };
}

/**
 * 7. HOT AIR BALLOON VALLEY RACE CIRCUIT (`balloon_valley_circuit`)
 */
export function buildBalloonValleyCircuitStage(renderer) {
  const maxAniso = renderer?.capabilities?.getMaxAnisotropy?.() || 16;
  const group = new THREE.Group();
  group.name = 'BalloonValleyCircuitStage';

  // Rolling emerald valley floor
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 256;
  grassCanvas.height = 256;
  const gctx = grassCanvas.getContext('2d');
  gctx.fillStyle = '#2d4c2b';
  gctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) {
    gctx.fillStyle = Math.random() > 0.5 ? '#355c32' : '#253f23';
    gctx.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  const grassTex = new THREE.CanvasTexture(grassCanvas);
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(48, 48);
  grassTex.colorSpace = THREE.SRGBColorSpace;
  grassTex.anisotropy = maxAniso;

  const valleyFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.92, metalness: 0.0 })
  );
  valleyFloor.rotation.x = -Math.PI / 2;
  valleyFloor.position.y = -0.025;
  valleyFloor.receiveShadow = true;
  group.add(valleyFloor);

  // Scenic valley circuit passing through (0,0,0) along -Z
  const curvePoints = [
    new THREE.Vector3(0, 0, 28),
    new THREE.Vector3(0, 0, -50),
    new THREE.Vector3(-34, 0, -104),
    new THREE.Vector3(-96, 0, -90),
    new THREE.Vector3(-124, 0, -28),
    new THREE.Vector3(-94, 0, 42),
    new THREE.Vector3(-110, 0, 96),
    new THREE.Vector3(-48, 0, 114),
    new THREE.Vector3(-6, 0, 78),
  ];
  buildCircuitRibbon(group, maxAniso, {
    trackWidth: 13.0,
    curvePoints,
    kerbColorA: 0xea580c,
    kerbColorB: 0xfef3c7,
    barrierColor: 0xcbd5e1,
  });

  // Distant Valley Hills & City Silhouette on Horizon
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x26412a, roughness: 0.95 });
  const hillCoords = [
    [-190, -160, 55, 28], [-80, -200, 68, 34], [60, -195, 72, 32],
    [175, -135, 60, 26], [185, 25, 65, 30], [150, 155, 58, 25],
    [-195, 130, 62, 28],
  ];
  for (const [hx, hz, hr, hh] of hillCoords) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(hr, hh, 16), hillMat);
    hill.position.set(hx, hh * 0.42, hz);
    group.add(hill);
  }

  // Distant City Skyline Cluster on East Horizon
  const cityMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.35 });
  for (let i = 0; i < 16; i++) {
    const bh = 18 + (i % 5) * 9;
    const bw = 7 + (i % 3) * 3;
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw), cityMat);
    b.position.set(110 + (i % 4) * 14, bh * 0.5, -130 + i * 16);
    group.add(b);
  }

  // Animated Hot Air Balloons (16 colorful striped envelopes + baskets + flickering burner flames)
  const balloonPalettes = [
    ['#ef4444', '#facc15'],
    ['#3b82f6', '#f8fafc'],
    ['#10b981', '#fde047'],
    ['#f97316', '#7c3aed'],
    ['#ec4899', '#38bdf8'],
    ['#06b6d4', '#f43f5e'],
  ];
  const basketMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7 });
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(12.0, 5.5, 1.2) });

  const balloons = [];
  const balloonSpots = [
    [-22, 26, -55], [26, 32, -68], [-58, 38, -110], [18, 24, -120],
    [-108, 42, -55], [-72, 29, 14], [44, 36, -18], [58, 44, 48],
    [-34, 34, 88], [-125, 48, 52], [85, 52, -88], [-145, 38, -125],
    [14, 45, 115], [-68, 50, -155], [96, 39, 92], [-18, 28, -90],
  ];

  balloonSpots.forEach(([bx, by, bz], idx) => {
    const pal = balloonPalettes[idx % balloonPalettes.length];
    const bCanvas = document.createElement('canvas');
    bCanvas.width = 128;
    bCanvas.height = 64;
    const bctx = bCanvas.getContext('2d');
    for (let s = 0; s < 12; s++) {
      bctx.fillStyle = s % 2 === 0 ? pal[0] : pal[1];
      bctx.fillRect((s / 12) * 128, 0, 128 / 12 + 1, 64);
    }
    const bTex = new THREE.CanvasTexture(bCanvas);
    bTex.colorSpace = THREE.SRGBColorSpace;

    const bGroup = new THREE.Group();
    const scale = 0.85 + (idx % 4) * 0.22;
    bGroup.scale.setScalar(scale);

    // Teardrop envelope (sphere + tapered lower cone)
    const envSphere = new THREE.Mesh(
      new THREE.SphereGeometry(3.4, 24, 18),
      new THREE.MeshStandardMaterial({ map: bTex, roughness: 0.65 })
    );
    envSphere.position.y = 3.8;
    envSphere.castShadow = true;
    bGroup.add(envSphere);

    const envNeck = new THREE.Mesh(
      new THREE.CylinderGeometry(3.15, 1.15, 3.2, 24),
      new THREE.MeshStandardMaterial({ map: bTex, roughness: 0.65 })
    );
    envNeck.position.y = 1.6;
    bGroup.add(envNeck);

    // Wicker Basket & 4 suspension cables
    const basket = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.05, 1.35), basketMat);
    basket.position.y = -1.35;
    bGroup.add(basket);

    for (const [rx, rz] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.9, 6), ropeMat);
      rope.position.set(rx * 0.9, -0.25, rz * 0.9);
      bGroup.add(rope);
    }

    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8), flameMat);
    flame.position.y = 0.15;
    bGroup.add(flame);

    bGroup.position.set(bx, by, bz);
    group.add(bGroup);
    balloons.push({
      group: bGroup,
      flame,
      baseX: bx,
      baseY: by,
      baseZ: bz,
      phase: idx * 1.17,
      speed: 0.32 + (idx % 5) * 0.08,
    });
  });

  // Golden-hour alpine sky dome
  const skyGeo = new THREE.SphereGeometry(340, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      varying vec3 vWorldPos;
      void main() {
        float h = clamp(normalize(vWorldPos).y, 0.0, 1.0);
        vec3 col = mix(vec3(0.86, 0.78, 0.68), vec3(0.24, 0.52, 0.85), pow(h, 0.52));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  group.add(new THREE.Mesh(skyGeo, skyMat));

  function update(elapsed) {
    for (const b of balloons) {
      b.group.position.y = b.baseY + Math.sin(elapsed * b.speed + b.phase) * 2.2;
      b.group.position.x = b.baseX + Math.sin(elapsed * 0.14 + b.phase) * 2.8;
      b.group.position.z = b.baseZ + Math.cos(elapsed * 0.11 + b.phase) * 2.2;
      b.group.rotation.y = elapsed * 0.08 + b.phase;
      const pulse = 0.7 + Math.max(0, Math.sin(elapsed * 3.5 + b.phase * 2.0)) * 0.8;
      b.flame.scale.setScalar(pulse);
    }
  }

  return { group, update };
}

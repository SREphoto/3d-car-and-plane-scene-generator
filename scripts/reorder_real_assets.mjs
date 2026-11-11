import fs from 'node:fs';
import path from 'node:path';

const orig = fs.readFileSync('scripts/orig_catalog.js', 'utf8');

function extractArrayCode(name, src) {
  const start = src.indexOf('export const ' + name + ' = [');
  if (start === -1) return null;
  const arrStart = src.indexOf('[', start);
  let depth = 0;
  for (let i = arrStart; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') {
      depth--;
      if (depth === 0) return src.slice(arrStart, i + 1);
    }
  }
  return null;
}

const current = fs.readFileSync('src/data/catalog.js', 'utf8');
const dummyAssetUrl = (p) => p;

// Safely evaluate original array code
const origCarsCode = extractArrayCode('CARS_CATALOG', orig);
const origPlanesCode = extractArrayCode('PLANES_CATALOG', orig);
const origScenesCode = extractArrayCode('SCENES_CATALOG', orig);

const origSandbox = new Function('assetUrl', `
  return {
    CARS: ${origCarsCode},
    PLANES: ${origPlanesCode},
    SCENES: ${origScenesCode}
  };
`);

const currentCarsCode = extractArrayCode('CARS_CATALOG', current);
const currentPartsCode = extractArrayCode('CAR_PARTS_CATALOG', current);
const currentPlanesCode = extractArrayCode('PLANES_CATALOG', current);
const currentScenesCode = extractArrayCode('SCENES_CATALOG', current);

const currentSandbox = new Function('assetUrl', `
  return {
    CARS: ${currentCarsCode},
    PARTS: ${currentPartsCode},
    PLANES: ${currentPlanesCode},
    SCENES: ${currentScenesCode}
  };
`);

const { CARS: origCars, PLANES: origPlanes, SCENES: origScenes } = origSandbox(dummyAssetUrl);
const { CARS: curCars, PARTS: curParts, PLANES: curPlanes, SCENES: curScenes } = currentSandbox(dummyAssetUrl);

// Put original REAL cars first, then others
const realCarIds = new Set(origCars.map((c) => c.id));
const sortedCars = [
  ...origCars,
  ...curCars.filter((c) => !realCarIds.has(c.id)),
];

// Put original REAL planes first, then others
const realPlaneIds = new Set(origPlanes.map((p) => p.id));
const sortedPlanes = [
  ...origPlanes.map((p) => {
    if (!p.enginesCount) p.enginesCount = p.name.includes('747') ? 4 : 2;
    return p;
  }),
  ...curPlanes.filter((p) => !realPlaneIds.has(p.id)),
];

// Put original REAL scenes first, then others
const realSceneIds = new Set(origScenes.map((s) => s.id));
const sortedScenes = [
  ...origScenes,
  ...curScenes.filter((s) => !realSceneIds.has(s.id)),
];

console.log('Real High-Poly Cars placed at the top:', origCars.length);
console.log('Top Car is:', sortedCars[0].name, '->', sortedCars[0].url);
console.log('Top Plane is:', sortedPlanes[0].name, '->', sortedPlanes[0].url);
console.log('Top Scene is:', sortedScenes[0].name);

function serializeObject(obj) {
  const lines = ['{'];
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'url' && typeof v === 'string') {
      lines.push(`    ${k}: assetUrl(${JSON.stringify(v)}),`);
    } else {
      lines.push(`    ${k}: ${JSON.stringify(v)},`);
    }
  }
  lines.push('  }');
  return lines.join('\n');
}

function serializeArray(arr) {
  return '[\n  ' + arr.map(serializeObject).join(',\n  ') + '\n]';
}

const weatherIndex = orig.indexOf('export const WEATHER_PRESETS = [');
const presetsBlock = orig.slice(weatherIndex);

const out = `// Complete Verified Catalog: Real High-Poly Assets First, Followed by Additional Catalog Models

const IS_DEV = import.meta.env.DEV;
const GITHUB_RAW_ROOT = 'https://raw.githubusercontent.com/SREphoto/3d-car-and-plane-scene-generator/main/3D%20Car%20and%20Plane%20Scene%20Creator';

export const assetUrl = (relPath) => {
  if (!relPath) return '';
  if (IS_DEV) {
    return \`/\${relPath.replace(/^\\//, '')}\`;
  }
  const clean = relPath.replace(/^\\/?assets\\//, '').replace(/^\\//, '');
  const encodedSegments = clean.split('/').map((seg) => encodeURIComponent(seg)).join('/');
  return \`\${GITHUB_RAW_ROOT}/\${encodedSegments}\`;
};

export const CARS_CATALOG = ${serializeArray(sortedCars)};

export const CAR_PARTS_CATALOG = ${serializeArray(curParts)};

export const PLANES_CATALOG = ${serializeArray(sortedPlanes)};

export const SCENES_CATALOG = ${serializeArray(sortedScenes)};

${presetsBlock}
`;

fs.writeFileSync('src/data/catalog.js', out, 'utf8');
console.log('Successfully reordered src/data/catalog.js!');

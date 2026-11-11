import fs from 'node:fs';
import path from 'node:path';

// 1. Read original catalog from git HEAD
const orig = fs.readFileSync('scripts/orig_catalog.js', 'utf8');

function extractArrayCode(name) {
  const start = orig.indexOf('export const ' + name + ' = [');
  if (start === -1) return null;
  const arrStart = orig.indexOf('[', start);
  let depth = 0;
  for (let i = arrStart; i < orig.length; i++) {
    if (orig[i] === '[') depth++;
    else if (orig[i] === ']') {
      depth--;
      if (depth === 0) {
        return orig.slice(arrStart, i + 1);
      }
    }
  }
  return null;
}

// 2. Read newly acquired assets catalog
const newCat = JSON.parse(fs.readFileSync('assets_catalog.json', 'utf8'));

const carAccents = {
  '1975-porsche-911-turbo': '#ffcc00',
  'lb-works-ferrari-f40': '#ff2800',
  'lamborghini-aventador': '#f59e0b',
  'nissan-skyline-r34-gtr': '#38bdf8',
  'audi-r8': '#ef4444',
  'ford-gt-2006': '#3b82f6',
  '2019-chevrolet-corvette-c8': '#dc2626',
  'bmw-m3-e30': '#10b981',
  '2019-aston-martin-vantage': '#00a88f',
  'koenigsegg-one-pro': '#e11d48',
  'bugatti-chiron-mansory': '#6366f1',
  'dodge-viper-gts': '#2563eb',
  'mazda-rx7-fd': '#f97316',
  'toyota-supra-mk4': '#ea580c',
  'mercedes-amg-gt3': '#eab308',
  'shelby-cobra-427': '#1d4ed8',
  'subaru-impreza-wrx-sti': '#0284c7',
  'honda-nsx-1990': '#ec4899',
  'mclaren-senna': '#f43f5e',
  'mitsubishi-lancer-evo': '#0ea5e9'
};

const partAccents = {
  'v8-engine': '#ef4444',
  'bbs-rs16-wheel-rim': '#f59e0b',
  'brembo-brake-caliper': '#dc2626',
  'recaro-speed-racing-seat': '#e11d48',
  'race-steering-wheel-essenza': '#eab308',
  'bmw-m2-carbon-spoiler': '#64748b',
  'exhaust-manifold-header': '#f97316',
  'supercharged-sbc-v8-blower': '#ef4444',
  'car-engine-alternator': '#3b82f6',
  'manual-transmission-gearbox': '#6b7280',
  'rim-tg002-forged-wheel': '#38bdf8',
  'blue-coilovers-suspension': '#0284c7',
  'sbc-v8-intake-manifold': '#f43f5e',
  'volvo-intercooler': '#06b6d4',
  'rotor-disc-brake': '#94a3b8',
  'nos-nitrous-bottle': '#06b6d4',
  'round-projector-headlight': '#fbbf24',
  'bosch-12v-battery': '#10b981',
  'f1-steering-wheel-w11': '#00a88f',
  'car-turbocharger': '#8b5cf6'
};

const planeAccents = {
  'lockheed-f22-raptor': '#38bdf8',
  'boeing-787-dreamliner': '#0ea5e9',
  'concorde-supersonic': '#f43f5e',
  'supermarine-spitfire': '#10b981',
  'lockheed-sr71-blackbird': '#a855f7',
  'airbus-a380': '#06b6d4'
};

function cleanRelPath(p) {
  return p.replace(/^3D Car and Plane Scene Creator\//, 'assets/');
}

// Parse original arrays
// We can safely evaluate the code block for CARS_CATALOG, PLANES_CATALOG, SCENES_CATALOG
const sandboxFn = new Function('assetUrl', `
  const CARS_CATALOG = ${extractArrayCode('CARS_CATALOG')};
  const PLANES_CATALOG = ${extractArrayCode('PLANES_CATALOG')};
  const SCENES_CATALOG = ${extractArrayCode('SCENES_CATALOG')};
  return { CARS_CATALOG, PLANES_CATALOG, SCENES_CATALOG };
`);

const dummyAssetUrl = (p) => p;
const { CARS_CATALOG: origCars, PLANES_CATALOG: origPlanes, SCENES_CATALOG: origScenes } = sandboxFn(dummyAssetUrl);

console.log('Original items found:');
console.log(' - Cars:', origCars.length);
console.log(' - Planes:', origPlanes.length);
console.log(' - Scenes:', origScenes.length);

// Format newly discovered models
const newCars = newCat.categories.find((c) => c.category === 'Cars').models.map((m) => {
  const cleanName = m.title
    .replace(/FREE\s+/i, '')
    .replace(/\[FREE\]\s+/i, '')
    .replace(/\|\s*www\.vecarz\.com/i, '')
    .trim();
  return {
    id: m.id,
    name: cleanName,
    brand: m.author?.name || 'Automotive',
    category: 'Supercar / Legend',
    accent: carAccents[m.id] || '#38bdf8',
    targetSize: 4.8,
    url: cleanRelPath(m.file.path),
    specs: `${m.geometry.triangles.toLocaleString()} tris • ${m.geometry.dimensions.formatted}`,
    sketchfabUrl: m.sketchfab?.url,
    license: m.licensing?.licenseCode || 'CC BY 4.0',
    author: m.author?.name || 'Sketchfab Creator',
  };
});

const newParts = newCat.categories.find((c) => c.category === 'Car Parts').models.map((m) => {
  return {
    id: m.id,
    name: m.title,
    brand: m.author?.name || 'Motorsport',
    category: 'Performance Component',
    accent: partAccents[m.id] || '#f59e0b',
    targetSize: 1.1,
    url: cleanRelPath(m.file.path),
    specs: `${m.geometry.triangles.toLocaleString()} tris • ${m.geometry.dimensions.formatted}`,
    sketchfabUrl: m.sketchfab?.url,
    license: m.licensing?.licenseCode || 'CC BY 4.0',
    author: m.author?.name || 'Sketchfab Creator',
  };
});

const newPlanes = newCat.categories.find((c) => c.category === 'Planes').models.map((m) => {
  const engines = m.id.includes('a380') ? 4 : m.id.includes('spitfire') ? 1 : 2;
  return {
    id: m.id,
    name: m.title.replace(/\s*-\s*Free/i, '').trim(),
    brand: m.author?.name || 'Aviation',
    category: 'Military & Commercial Aviation',
    accent: planeAccents[m.id] || '#0ea5e9',
    targetSize: 26.0,
    enginesCount: engines,
    url: cleanRelPath(m.file.path),
    specs: `${m.geometry.triangles.toLocaleString()} tris • ${m.geometry.dimensions.formatted}`,
    sketchfabUrl: m.sketchfab?.url,
    license: m.licensing?.licenseCode || 'CC BY 4.0',
    author: m.author?.name || 'Sketchfab Creator',
  };
});

const newGarages = newCat.categories.find((c) => c.category === 'Garages').models.map((m) => {
  return {
    id: m.id,
    name: m.title,
    type: 'glb',
    modes: ['cars', 'parts', 'planes'],
    badge: 'GARAGE',
    category: 'Garages',
    url: cleanRelPath(m.file.path),
    targetSpan: 30,
    description: `${m.title} — ${m.geometry.triangles.toLocaleString()} tris, enclosed architectural garage workshop.`,
    sketchfabUrl: m.sketchfab?.url,
    license: m.licensing?.licenseCode || 'CC BY 4.0',
    author: m.author?.name || 'Sketchfab Creator',
  };
});

const newStreets = newCat.categories.find((c) => c.category === 'City Streets').models.map((m) => {
  return {
    id: m.id,
    name: m.title,
    type: 'glb',
    modes: ['cars', 'parts', 'planes'],
    badge: 'STREET',
    category: 'City Streets',
    url: cleanRelPath(m.file.path),
    targetSpan: 48,
    description: `${m.title} — ${m.geometry.triangles.toLocaleString()} tris, urban street asphalt roadway scene.`,
    sketchfabUrl: m.sketchfab?.url,
    license: m.licensing?.licenseCode || 'CC BY 4.0',
    author: m.author?.name || 'Sketchfab Creator',
  };
});

const newShowcases = newCat.categories.find((c) => c.category === 'Showcase Locations').models.map((m) => {
  return {
    id: m.id,
    name: m.title,
    type: 'glb',
    modes: ['cars', 'parts', 'planes'],
    badge: 'SHOWCASE',
    category: 'Showcase Locations',
    url: cleanRelPath(m.file.path),
    targetSpan: 32,
    description: `${m.title} — ${m.geometry.triangles.toLocaleString()} tris, prestige automotive showcase environment.`,
    sketchfabUrl: m.sketchfab?.url,
    license: m.licensing?.licenseCode || 'CC BY 4.0',
    author: m.author?.name || 'Sketchfab Creator',
  };
});

// MERGE CARS (Keep existing + Add new without duplicates)
const carMap = new Map();
origCars.forEach((c) => carMap.set(c.id, c));
newCars.forEach((c) => {
  if (!carMap.has(c.id)) {
    carMap.set(c.id, c);
  }
});
const mergedCars = Array.from(carMap.values());

// MERGE PLANES (Keep existing + Add new without duplicates)
const planeMap = new Map();
origPlanes.forEach((p) => {
  if (!p.enginesCount) p.enginesCount = p.name.includes('747') ? 4 : 2;
  planeMap.set(p.id, p);
});
newPlanes.forEach((p) => {
  if (!planeMap.has(p.id)) {
    planeMap.set(p.id, p);
  }
});
const mergedPlanes = Array.from(planeMap.values());

// MERGE SCENES (Keep existing + Add 4 Garages + 2 Streets + 4 Showcases)
const sceneMap = new Map();
origScenes.forEach((s) => {
  if (!s.category) {
    if (s.id.includes('garage')) s.category = 'Garages';
    else if (s.id.includes('street') || s.id.includes('tunnel')) s.category = 'City Streets';
    else if (s.id.includes('gallery') || s.id.includes('hall') || s.id.includes('interior')) s.category = 'Showcase Locations';
    else s.category = 'Studios';
  }
  sceneMap.set(s.id, s);
});

[...newGarages, ...newStreets, ...newShowcases].forEach((s) => {
  if (!sceneMap.has(s.id)) {
    sceneMap.set(s.id, s);
  }
});
const mergedScenes = Array.from(sceneMap.values());

console.log('MERGED INVENTORY:');
console.log(' -> Total Cars:', mergedCars.length, `(${origCars.length} original + ${mergedCars.length - origCars.length} added)`);
console.log(' -> Total Car Parts:', newParts.length, `(20 added)`);
console.log(' -> Total Planes:', mergedPlanes.length, `(${origPlanes.length} original + ${mergedPlanes.length - origPlanes.length} added)`);
console.log(' -> Total Scenes:', mergedScenes.length, `(${origScenes.length} original + ${mergedScenes.length - origScenes.length} added)`);

// Generate catalog.js string
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

const outputCode = `// Complete Merged Catalog of ${mergedCars.length} Cars, ${newParts.length} Car Parts, ${mergedPlanes.length} Planes, ${mergedScenes.length} Scenes, Weather, Lighting, Camera, and Music

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

export const CARS_CATALOG = ${serializeArray(mergedCars)};

export const CAR_PARTS_CATALOG = ${serializeArray(newParts)};

export const PLANES_CATALOG = ${serializeArray(mergedPlanes)};

export const SCENES_CATALOG = ${serializeArray(mergedScenes)};

${presetsBlock}
`;

fs.writeFileSync('src/data/catalog.js', outputCode, 'utf8');
console.log('Successfully wrote combined src/data/catalog.js!');

import fs from 'node:fs';

const orig = fs.readFileSync('scripts/orig_catalog.js', 'utf8');

// 1. Extract the original CARS_CATALOG
const carsStart = orig.indexOf('export const CARS_CATALOG = [');
const carsEnd = orig.indexOf('export const PLANES_CATALOG = [');
const origCarsBlock = orig.slice(carsStart, carsEnd).trim();

// 2. Extract original PLANES_CATALOG
const planesStart = carsEnd;
const planesEnd = orig.indexOf('export const SCENES_CATALOG = [');
const origPlanesBlock = orig.slice(planesStart, planesEnd).trim();

// 3. Extract original SCENES_CATALOG
const scenesStart = planesEnd;
const scenesEnd = orig.indexOf('export const WEATHER_PRESETS = [');
const origScenesBlock = orig.slice(scenesStart, scenesEnd).trim();

// 4. Presets block
const presetsBlock = orig.slice(scenesEnd);

// Read newly added parts and locations from assets_catalog.json
const cat = JSON.parse(fs.readFileSync('assets_catalog.json', 'utf8'));

function cleanRelPath(p) {
  return p.replace(/^3D Car and Plane Scene Creator\//, 'assets/');
}

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
  'car-turbocharger': '#8b5cf6',
};

const parts = cat.categories.find((c) => c.category === 'Car Parts').models.map((m) => ({
  id: m.id,
  name: m.title,
  brand: m.author?.name || 'Performance Parts',
  category: 'Mechanical / Component',
  accent: partAccents[m.id] || '#f59e0b',
  targetSize: 1.1,
  urlPath: cleanRelPath(m.file.path),
  specs: `${m.geometry.triangles.toLocaleString()} tris • ${m.geometry.dimensions.formatted}`,
  sketchfabUrl: m.sketchfab?.url,
  license: m.licensing?.licenseCode || 'CC BY 4.0',
  author: m.author?.name || 'Sketchfab Creator',
}));

// Additional planes from catalog
const additionalPlanes = cat.categories.find((c) => c.category === 'Planes').models.map((m) => {
  const engines = m.id.includes('a380') ? 4 : m.id.includes('spitfire') ? 1 : 2;
  return {
    id: m.id,
    name: m.title.replace(/\s*-\s*Free/i, '').trim(),
    brand: m.author?.name || 'Aviation',
    category: 'Military & Commercial Aviation',
    accent: '#0ea5e9',
    targetSize: 26.0,
    enginesCount: engines,
    urlPath: cleanRelPath(m.file.path),
    specs: `${m.geometry.triangles.toLocaleString()} tris • ${m.geometry.dimensions.formatted}`,
    sketchfabUrl: m.sketchfab?.url,
    license: m.licensing?.licenseCode || 'CC BY 4.0',
    author: m.author?.name || 'Sketchfab Creator',
  };
});

// Additional locations
const additionalGarages = cat.categories.find((c) => c.category === 'Garages').models
  .filter((m) => m.id !== 'underground-garage') // underground garage is already original car_garage
  .map((m) => ({
    id: m.id,
    name: m.title,
    type: 'glb',
    modes: ['cars', 'parts', 'planes'],
    badge: 'GARAGE',
    category: 'Garages',
    urlPath: cleanRelPath(m.file.path),
    targetSpan: 30,
    description: `${m.title} — ${m.geometry.triangles.toLocaleString()} tris, architectural garage workshop.`,
    sketchfabUrl: m.sketchfab?.url,
    license: m.licensing?.licenseCode || 'CC BY 4.0',
    author: m.author?.name || 'Sketchfab Creator',
  }));

const additionalStreets = cat.categories.find((c) => c.category === 'City Streets').models.map((m) => ({
  id: m.id,
  name: m.title,
  type: 'glb',
  modes: ['cars', 'parts', 'planes'],
  badge: 'STREET',
  category: 'City Streets',
  urlPath: cleanRelPath(m.file.path),
  targetSpan: 48,
  description: `${m.title} — ${m.geometry.triangles.toLocaleString()} tris, urban street roadway scene.`,
  sketchfabUrl: m.sketchfab?.url,
  license: m.licensing?.licenseCode || 'CC BY 4.0',
  author: m.author?.name || 'Sketchfab Creator',
}));

const additionalShowcases = cat.categories.find((c) => c.category === 'Showcase Locations').models.map((m) => ({
  id: m.id,
  name: m.title,
  type: 'glb',
  modes: ['cars', 'parts', 'planes'],
  badge: 'SHOWCASE',
  category: 'Showcase Locations',
  urlPath: cleanRelPath(m.file.path),
  targetSpan: 32,
  description: `${m.title} — ${m.geometry.triangles.toLocaleString()} tris, showcase environment.`,
  sketchfabUrl: m.sketchfab?.url,
  license: m.licensing?.licenseCode || 'CC BY 4.0',
  author: m.author?.name || 'Sketchfab Creator',
}));

// Serialize helper
function serializeItem(item) {
  const lines = ['  {'];
  for (const [k, v] of Object.entries(item)) {
    if (k === 'urlPath') {
      lines.push(`    url: assetUrl(${JSON.stringify(v)}),`);
    } else {
      lines.push(`    ${k}: ${JSON.stringify(v)},`);
    }
  }
  lines.push('  }');
  return lines.join('\n');
}

// Format CAR_PARTS_CATALOG
const partsCatalogCode = `export const CAR_PARTS_CATALOG = [\n` +
  parts.map(serializeItem).join(',\n') +
  `\n];\n\nexport const PARTS_CATALOG = CAR_PARTS_CATALOG;\nexport const CAR_PARTS = CAR_PARTS_CATALOG;`;

// Modify PLANES_CATALOG to append additional planes after the 2 original real planes
// Remove trailing ]; from origPlanesBlock
const origPlanesTrimmed = origPlanesBlock.replace(/\];\s*$/, '');
const planesCatalogCode = `${origPlanesTrimmed},\n` +
  additionalPlanes.map(serializeItem).join(',\n') +
  `\n];`;

// Modify SCENES_CATALOG to append additional scenes after the 11 original real scenes
const origScenesTrimmed = origScenesBlock.replace(/\];\s*$/, '');
const allAdditionalScenes = [...additionalGarages, ...additionalStreets, ...additionalShowcases];
const scenesCatalogCode = `${origScenesTrimmed},\n` +
  allAdditionalScenes.map(serializeItem).join(',\n') +
  `\n];`;

// Construct full file
const fullCode = `// High-Fidelity 3D Studio Catalog
// Original High-Poly Authentic Models Front & Center, with Expanded Parts, Planes, and Locations

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

${origCarsBlock};

${partsCatalogCode}

${planesCatalogCode}

${scenesCatalogCode}

${presetsBlock}
`;

fs.writeFileSync('src/data/catalog.js', fullCode, 'utf8');
console.log('Successfully wrote pristine src/data/catalog.js!');

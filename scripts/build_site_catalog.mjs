import fs from 'node:fs';
import path from 'node:path';

const catPath = path.resolve('assets_catalog.json');
const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));

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

const carsList = cat.categories.find((c) => c.category === 'Cars').models.map((m) => {
  const cleanName = m.title
    .replace(/FREE\s+/i, '')
    .replace(/\[FREE\]\s+/i, '')
    .replace(/\|\s*www\.vecarz\.com/i, '')
    .trim();
  return {
    id: m.id,
    name: cleanName,
    brand: m.author?.name || 'Automotive',
    category: 'Supercar / Sports',
    accent: carAccents[m.id] || '#38bdf8',
    targetSize: 4.8,
    path: cleanRelPath(m.file.path),
    specs: `${m.geometry.triangles.toLocaleString()} tris • ${m.geometry.dimensions.formatted}`,
    sketchfabUrl: m.sketchfab?.url,
    license: m.licensing?.licenseCode || 'CC BY 4.0',
    author: m.author?.name || 'Sketchfab Creator',
  };
});

const partsList = cat.categories.find((c) => c.category === 'Car Parts').models.map((m) => {
  return {
    id: m.id,
    name: m.title,
    brand: m.author?.name || 'Motorsport',
    category: 'Mechanical / Component',
    accent: partAccents[m.id] || '#f59e0b',
    targetSize: 1.1,
    path: cleanRelPath(m.file.path),
    specs: `${m.geometry.triangles.toLocaleString()} tris • ${m.geometry.dimensions.formatted}`,
    sketchfabUrl: m.sketchfab?.url,
    license: m.licensing?.licenseCode || 'CC BY 4.0',
    author: m.author?.name || 'Sketchfab Creator',
  };
});

const planesList = [
  {
    id: 'british-airways-boeing-747-400',
    name: 'British Airways Boeing 747-400 Queen of the Skies',
    brand: 'Boeing',
    category: 'Commercial Aviation',
    accent: '#1e3a8a',
    targetSize: 64.0,
    enginesCount: 4,
    path: 'assets/Planes/british-airways-boeing-747-400/source/British Airways Boeing 747-400.glb',
    specs: '4x Rolls-Royce Turbofans • 64.4m Wingspan',
    sketchfabUrl: 'https://sketchfab.com/3d-models/british-airways-boeing-747-400',
    license: 'CC BY 4.0',
    author: 'Aviation Models',
  },
  ...cat.categories.find((c) => c.category === 'Planes').models.map((m) => {
    const engines =
      m.id.includes('a380')
        ? 4
        : m.id.includes('spitfire')
        ? 1
        : 2;
    return {
      id: m.id,
      name: m.title.replace(/\s*-\s*Free/i, '').trim(),
      brand: m.author?.name || 'Aviation',
      category: 'Military & Commercial Aviation',
      accent: planeAccents[m.id] || '#0ea5e9',
      targetSize: 26.0,
      enginesCount: engines,
      path: cleanRelPath(m.file.path),
      specs: `${m.geometry.triangles.toLocaleString()} tris • ${m.geometry.dimensions.formatted}`,
      sketchfabUrl: m.sketchfab?.url,
      license: m.licensing?.licenseCode || 'CC BY 4.0',
      author: m.author?.name || 'Sketchfab Creator',
    };
  }),
];

const garageScenes = cat.categories.find((c) => c.category === 'Garages').models.map((m) => {
  return {
    id: m.id,
    name: m.title,
    type: 'glb',
    modes: ['cars', 'parts', 'planes'],
    badge: 'GARAGE',
    category: 'Garages',
    path: cleanRelPath(m.file.path),
    targetSpan: 30,
    description: `${m.title} — ${m.geometry.triangles.toLocaleString()} tris, enclosed architectural garage workshop.`,
    sketchfabUrl: m.sketchfab?.url,
    license: m.licensing?.licenseCode || 'CC BY 4.0',
    author: m.author?.name || 'Sketchfab Creator',
  };
});

const streetScenes = cat.categories.find((c) => c.category === 'City Streets').models.map((m) => {
  return {
    id: m.id,
    name: m.title,
    type: 'glb',
    modes: ['cars', 'parts', 'planes'],
    badge: 'STREET',
    category: 'City Streets',
    path: cleanRelPath(m.file.path),
    targetSpan: 48,
    description: `${m.title} — ${m.geometry.triangles.toLocaleString()} tris, urban street asphalt roadway scene.`,
    sketchfabUrl: m.sketchfab?.url,
    license: m.licensing?.licenseCode || 'CC BY 4.0',
    author: m.author?.name || 'Sketchfab Creator',
  };
});

const showcaseScenes = cat.categories.find((c) => c.category === 'Showcase Locations').models.map((m) => {
  return {
    id: m.id,
    name: m.title,
    type: 'glb',
    modes: ['cars', 'parts', 'planes'],
    badge: 'SHOWCASE',
    category: 'Showcase Locations',
    path: cleanRelPath(m.file.path),
    targetSpan: 32,
    description: `${m.title} — ${m.geometry.triangles.toLocaleString()} tris, prestige automotive showcase environment.`,
    sketchfabUrl: m.sketchfab?.url,
    license: m.licensing?.licenseCode || 'CC BY 4.0',
    author: m.author?.name || 'Sketchfab Creator',
  };
});

// Classical custom studio stages
const studioScenes = [
  {
    id: 'dark_void',
    name: 'The Obsidian Void (Cinema Blackout Stage)',
    type: 'procedural',
    modes: ['cars', 'parts', 'planes'],
    badge: 'STUDIO',
    category: 'Studios',
    description: 'Pitch-black cinema stage, mirror wet floor, dual overhead softbox lightbanks, and sculpted aerodynamic rim highlights.',
  },
  {
    id: 'wind_tunnel',
    name: 'Aero Wind Tunnel Facility (Laminar Smoke & Turbine)',
    type: 'glb',
    modes: ['cars', 'parts', 'planes'],
    badge: 'AERO + SMOKE',
    category: 'Studios',
    path: 'assets/Locations/wind-tunnel/wind_tunnel.glb',
    targetSpan: 32,
    description: 'Full-scale aerodynamic testing chamber with rotating turbine fan, circular turntable, and active laminar streamline smoke trails.',
  },
  {
    id: 'outdoor_world',
    name: 'Alpine Highway & Tarmac (Dynamic Weather & 24h Sun)',
    type: 'outdoor',
    modes: ['cars', 'parts', 'planes'],
    badge: 'WEATHER + 24H',
    category: 'Studios',
    description: 'Dynamic outdoor alpine pass & runway apron with Sunny, Cloudy, Drizzle, Thunderstorm, Snow, Blizzard & Snow Accumulation.',
    defaultWeather: 'sunny',
    defaultTimeOfDay: 16.5,
  },
  {
    id: 'abandoned_vr_gallery',
    name: 'Abandoned Concrete VR Gallery',
    type: 'glb',
    modes: ['cars', 'parts', 'planes'],
    badge: 'STUDIO',
    category: 'Studios',
    path: 'assets/Locations/abandoned_vr_gallery.glb',
    targetSpan: 34,
    description: 'Brutalist concrete gallery with dramatic skylight shafts and industrial warehouse geometry.',
  },
  {
    id: 'catwalk',
    name: 'Industrial Steel Catwalk Hangar',
    type: 'glb',
    modes: ['cars', 'parts', 'planes'],
    badge: 'STUDIO',
    category: 'Studios',
    path: 'assets/Locations/catwalk.glb',
    targetSpan: 30,
    description: 'Metallic catwalk bay with brushed steel grates and dynamic spotlight framing.',
  },
];

const allScenes = [
  ...garageScenes,
  ...streetScenes,
  ...showcaseScenes,
  ...studioScenes,
];

// Read presets from existing catalog.js (from WEATHER_PRESETS to end)
const existingCatalog = fs.readFileSync('src/data/catalog.js', 'utf8');
const weatherIndex = existingCatalog.indexOf('export const WEATHER_PRESETS = [');
const presetsBlock = existingCatalog.slice(weatherIndex);

// Generate new catalog.js content
let out = `// Comprehensive Catalog of 20 Cars, 20 Car Parts, 6 Planes, 15 Scenes (Garages, Streets, Showcases, Studios), Weather, Lighting, Camera, and Music

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

export const CARS_CATALOG = ${JSON.stringify(carsList, null, 2).replace(/"path":\s*"([^"]+)"/g, '"url": assetUrl("$1")')};

export const CAR_PARTS_CATALOG = ${JSON.stringify(partsList, null, 2).replace(/"path":\s*"([^"]+)"/g, '"url": assetUrl("$1")')};

export const PLANES_CATALOG = ${JSON.stringify(planesList, null, 2).replace(/"path":\s*"([^"]+)"/g, '"url": assetUrl("$1")')};

export const SCENES_CATALOG = ${JSON.stringify(allScenes, null, 2).replace(/"path":\s*"([^"]+)"/g, '"url": assetUrl("$1")')};

${presetsBlock}
`;

fs.writeFileSync('src/data/catalog.js', out, 'utf8');
console.log('Successfully generated src/data/catalog.js:');
console.log(' - Cars:', carsList.length);
console.log(' - Parts:', partsList.length);
console.log(' - Planes:', planesList.length);
console.log(' - Scenes:', allScenes.length, `(Garages: ${garageScenes.length}, Streets: ${streetScenes.length}, Showcases: ${showcaseScenes.length}, Studios: ${studioScenes.length})`);

/**
 * Challenger M2 Verification Script
 * Empirical stress-test harness for Milestone M2 Gate Review:
 * 1. JSON Schema & Catalog Integrity
 * 2. GLB Binary Parsing & Geometry Parity against disk files
 * 3. Candidate Models Fixture Parity
 * 4. URL & Attribution Statement Validation
 * 5. Markdown Catalog Parity (ASSETS_CATALOG.md vs assets_catalog.json)
 */

import fs from 'node:fs';
import path from 'node:path';
import { validateGlb } from './glb_validator.mjs';

const ROOT_DIR = process.cwd();
const CATALOG_JSON_PATH = path.join(ROOT_DIR, 'assets_catalog.json');
const CATALOG_MD_PATH = path.join(ROOT_DIR, 'ASSETS_CATALOG.md');
const FIXTURES_PATH = path.join(ROOT_DIR, 'tests', 'fixtures', 'candidate_models.json');

const EXPECTED_CATEGORIES = [
  { name: 'Cars', slug: 'cars', count: 20 },
  { name: 'Car Parts', slug: 'car-parts', count: 20 },
  { name: 'Garages', slug: 'garages', count: 4 },
  { name: 'City Streets', slug: 'city-streets', count: 2 },
  { name: 'Showcase Locations', slug: 'showcase-locations', count: 4 },
  { name: 'Planes', slug: 'planes', count: 6 },
];

const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

function assert(condition, description, details = null) {
  if (condition) {
    results.passed++;
    results.tests.push({ status: 'PASS', description });
  } else {
    results.failed++;
    results.tests.push({ status: 'FAIL', description, details });
    console.error(`[FAIL] ${description}`, details || '');
  }
}

function warn(description, details = null) {
  results.warnings++;
  results.tests.push({ status: 'WARN', description, details });
  console.warn(`[WARN] ${description}`, details || '');
}

console.log('======================================================================');
console.log('Challenger M2_1: Empirical Verification Harness');
console.log('======================================================================\n');

// ----------------------------------------------------------------------
// 1. Validate assets_catalog.json JSON Syntax & Structure
// ----------------------------------------------------------------------
console.log('--- 1. Validating assets_catalog.json JSON Syntax & Structure ---');
assert(fs.existsSync(CATALOG_JSON_PATH), 'assets_catalog.json exists on disk');

let catalog;
try {
  const raw = fs.readFileSync(CATALOG_JSON_PATH, 'utf8');
  catalog = JSON.parse(raw);
  assert(true, 'assets_catalog.json parses as valid JSON');
} catch (err) {
  assert(false, 'assets_catalog.json parses as valid JSON', err.message);
  process.exit(1);
}

assert(catalog.catalogVersion === '1.0.0', 'catalogVersion is 1.0.0');
assert(typeof catalog.title === 'string' && catalog.title.length > 0, 'Catalog title is present');
assert(typeof catalog.description === 'string' && catalog.description.length > 0, 'Catalog description is present');
assert(catalog.totalAssets === 56, `totalAssets is exactly 56 (got ${catalog.totalAssets})`);
assert(Array.isArray(catalog.models), 'catalog.models is an array');
assert(catalog.models?.length === 56, `catalog.models contains 56 items (got ${catalog.models?.length})`);
assert(Array.isArray(catalog.categories), 'catalog.categories is an array');
assert(catalog.categories?.length === 6, `catalog.categories has 6 categories (got ${catalog.categories?.length})`);

// Validate category breakdown
const categoryCounts = {};
for (const m of catalog.models) {
  categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
}

for (const exp of EXPECTED_CATEGORIES) {
  assert(
    categoryCounts[exp.name] === exp.count,
    `Category '${exp.name}' has exactly ${exp.count} models in models array (got ${categoryCounts[exp.name]})`
  );
}

// Validate summary totals match models array
let computedTotalTriangles = 0;
let computedTotalVertices = 0;
let computedTotalBytes = 0;

for (const m of catalog.models) {
  computedTotalTriangles += m.geometry.triangles;
  computedTotalVertices += m.geometry.vertices;
  computedTotalBytes += m.file.sizeBytes;
}

assert(
  catalog.summary.totalTriangles === computedTotalTriangles,
  `Summary totalTriangles (${catalog.summary.totalTriangles}) matches sum of models (${computedTotalTriangles})`
);
assert(
  catalog.summary.totalVertices === computedTotalVertices,
  `Summary totalVertices (${catalog.summary.totalVertices}) matches sum of models (${computedTotalVertices})`
);
assert(
  catalog.summary.totalFileSizeBytes === computedTotalBytes,
  `Summary totalFileSizeBytes (${catalog.summary.totalFileSizeBytes}) matches sum of models (${computedTotalBytes})`
);

// ----------------------------------------------------------------------
// 2. Validate Candidate Models Fixtures Parity
// ----------------------------------------------------------------------
console.log('\n--- 2. Validating Candidate Models Fixtures Parity ---');
assert(fs.existsSync(FIXTURES_PATH), 'tests/fixtures/candidate_models.json exists on disk');

let fixtures;
try {
  fixtures = JSON.parse(fs.readFileSync(FIXTURES_PATH, 'utf8'));
  assert(true, 'candidate_models.json parses as valid JSON');
} catch (err) {
  assert(false, 'candidate_models.json parses as valid JSON', err.message);
  process.exit(1);
}

// Map fixtures by UID
const fixtureMap = new Map();
let totalFixtureModels = 0;
for (const [catName, list] of Object.entries(fixtures)) {
  for (const item of list) {
    fixtureMap.set(item.uid, { ...item, fixtureCategory: catName });
    totalFixtureModels++;
  }
}
assert(totalFixtureModels === 56, `candidate_models.json contains 56 models across all categories (got ${totalFixtureModels})`);

// ----------------------------------------------------------------------
// 3. Empirical Verification Against Actual GLB Files on Disk
// ----------------------------------------------------------------------
console.log('\n--- 3. Empirically Verifying 56 GLB Files Against Disk & GlbValidator ---');

const seenUids = new Set();
const seenIds = new Set();
const seenPaths = new Set();

let glbMismatchCount = 0;
let urlMismatchCount = 0;
let missingFieldsCount = 0;

for (let i = 0; i < catalog.models.length; i++) {
  const m = catalog.models[i];
  const prefix = `Model [${i + 1}/56] (${m.id})`;

  // ID & UID uniqueness
  if (seenIds.has(m.id)) {
    assert(false, `${prefix}: Duplicate ID '${m.id}'`);
  }
  seenIds.add(m.id);

  if (seenUids.has(m.sketchfab.uid)) {
    assert(false, `${prefix}: Duplicate Sketchfab UID '${m.sketchfab.uid}'`);
  }
  seenUids.add(m.sketchfab.uid);

  // Required fields check
  const requiredFields = [
    m.id,
    m.title,
    m.category,
    m.categorySlug,
    m.author?.name,
    m.author?.username,
    m.author?.profileUrl,
    m.sketchfab?.uid,
    m.sketchfab?.url,
    m.sketchfab?.downloadApi,
    m.file?.path,
    m.file?.sizeBytes,
    m.file?.sizeFormatted,
    m.file?.format,
    m.file?.version,
    m.file?.magic,
    m.file?.isValid !== undefined,
    m.geometry?.triangles !== undefined,
    m.geometry?.vertices !== undefined,
    m.geometry?.meshCount !== undefined,
    m.geometry?.primitiveCount !== undefined,
    m.geometry?.boundingBox?.min,
    m.geometry?.boundingBox?.max,
    m.geometry?.dimensions?.x !== undefined,
    m.geometry?.dimensions?.y !== undefined,
    m.geometry?.dimensions?.z !== undefined,
    m.geometry?.dimensions?.formatted,
    m.geometry?.groundDatum?.datumY !== undefined,
    m.geometry?.groundDatum?.isGrounded !== undefined,
    m.geometry?.groundDatum?.formatted,
    m.textures?.totalImages !== undefined,
    m.textures?.embeddedBufferViews !== undefined,
    m.textures?.allEmbedded !== undefined,
    m.licensing?.licenseName,
    m.licensing?.licenseCode,
    m.licensing?.licenseUrl,
    m.licensing?.attributionStatement,
  ];

  const hasAllFields = requiredFields.every((f) => f !== undefined && f !== null && f !== '');
  if (!hasAllFields) {
    missingFieldsCount++;
    assert(false, `${prefix}: Missing one or more required fields`);
  }

  // File existence on disk
  const absGlbPath = path.resolve(ROOT_DIR, m.file.path);
  if (!fs.existsSync(absGlbPath)) {
    assert(false, `${prefix}: GLB file not found on disk: ${m.file.path}`);
    continue;
  }
  seenPaths.add(m.file.path);

  // Validate GLB binary container directly with validateGlb()
  const glbReport = validateGlb(absGlbPath);
  assert(glbReport.valid, `${prefix}: GLB passes binary validation: ${m.file.path}`, glbReport.errors);

  // Compare file size
  const actualStat = fs.statSync(absGlbPath);
  assert(
    m.file.sizeBytes === actualStat.size,
    `${prefix}: File size matches disk bytes (${m.file.sizeBytes} === ${actualStat.size})`
  );

  // Compare geometry metrics
  const triDiff = Math.abs(glbReport.geometryStats.totalTriangles - m.geometry.triangles);
  const vertDiff = Math.abs(glbReport.geometryStats.totalVertices - m.geometry.vertices);
  const meshDiff = Math.abs(glbReport.geometryStats.totalMeshes - m.geometry.meshCount);
  const primDiff = Math.abs(glbReport.geometryStats.totalPrimitives - m.geometry.primitiveCount);

  if (triDiff !== 0 || vertDiff !== 0 || meshDiff !== 0 || primDiff !== 0) {
    glbMismatchCount++;
    assert(
      false,
      `${prefix}: Geometry mismatch: triangles expected ${glbReport.geometryStats.totalTriangles} vs reported ${m.geometry.triangles}, vertices expected ${glbReport.geometryStats.totalVertices} vs reported ${m.geometry.vertices}`
    );
  }

  // Compare bounding box
  if (glbReport.geometryStats.boundingBox) {
    const minReported = m.geometry.boundingBox.min;
    const maxReported = m.geometry.boundingBox.max;
    const minActual = glbReport.geometryStats.boundingBox.min;
    const maxActual = glbReport.geometryStats.boundingBox.max;

    const diffMin = Math.max(...minReported.map((v, idx) => Math.abs(v - minActual[idx])));
    const diffMax = Math.max(...maxReported.map((v, idx) => Math.abs(v - maxActual[idx])));

    // Rounded to 4 decimal places in catalog
    assert(diffMin < 0.001, `${prefix}: Bounding box min within 0.001m precision (diff: ${diffMin})`);
    assert(diffMax < 0.001, `${prefix}: Bounding box max within 0.001m precision (diff: ${diffMax})`);
  }

  // Verify textures embedding
  assert(
    glbReport.textureStats.allEmbedded === true && m.textures.allEmbedded === true,
    `${prefix}: All textures 100% embedded (0 external URI dependencies)`
  );
  assert(
    glbReport.textureStats.externalUris.length === 0,
    `${prefix}: 0 external image URIs`
  );

  // Verify ground datum contact
  assert(
    m.geometry.groundDatum.isGrounded === true,
    `${prefix}: Ground datum contact confirmed (datumY: ${m.geometry.groundDatum.datumY}m)`
  );
  assert(
    Math.abs(m.geometry.groundDatum.datumY) <= 0.002,
    `${prefix}: Ground datum within tolerance |datumY| <= 0.002m`
  );

  // Compare with candidate_models.json fixture
  const fixture = fixtureMap.get(m.sketchfab.uid);
  if (!fixture) {
    assert(false, `${prefix}: UID '${m.sketchfab.uid}' not found in candidate_models.json`);
  } else {
    assert(
      m.title === fixture.title,
      `${prefix}: Title matches fixture ("${m.title}")`
    );
    assert(
      m.author.username.toLowerCase() === fixture.author_username.toLowerCase(),
      `${prefix}: Author username matches fixture ("${m.author.username}")`
    );
    assert(
      m.sketchfab.url === fixture.sketchfab_url,
      `${prefix}: Sketchfab URL matches fixture`
    );
  }

  // Validate URL syntax
  try {
    const sfUrl = new URL(m.sketchfab.url);
    assert(
      sfUrl.origin === 'https://sketchfab.com' && sfUrl.pathname.includes('/3d-models/'),
      `${prefix}: Sketchfab URL is valid format (${m.sketchfab.url})`
    );
  } catch (err) {
    urlMismatchCount++;
    assert(false, `${prefix}: Invalid Sketchfab URL: ${m.sketchfab.url}`);
  }

  try {
    const profUrl = new URL(m.author.profileUrl);
    assert(
      profUrl.origin === 'https://sketchfab.com',
      `${prefix}: Author profile URL is valid Sketchfab URL (${m.author.profileUrl})`
    );
  } catch (err) {
    urlMismatchCount++;
    assert(false, `${prefix}: Invalid author profile URL: ${m.author.profileUrl}`);
  }

  try {
    const licUrl = new URL(m.licensing.licenseUrl);
    assert(
      licUrl.hostname.includes('creativecommons.org') || (licUrl.hostname.includes('sketchfab.com') && licUrl.pathname.includes('/licenses')),
      `${prefix}: License URL is valid CC or Sketchfab license link (${m.licensing.licenseUrl})`
    );
  } catch (err) {
    urlMismatchCount++;
    assert(false, `${prefix}: Invalid license URL: ${m.licensing.licenseUrl}`);
  }

  // Validate attribution statement contains essential fields
  const attr = m.licensing.attributionStatement;
  assert(
    attr.includes(m.title) &&
    attr.includes(m.author.name) &&
    attr.includes(m.author.profileUrl) &&
    attr.includes(m.licensing.licenseCode) &&
    attr.includes(m.licensing.licenseUrl) &&
    attr.includes(m.sketchfab.url),
    `${prefix}: Attribution statement contains title, author, profile URL, license code, license URL, and sketchfab URL`
  );
}

assert(missingFieldsCount === 0, `All 56 models have 100% complete fields`);
assert(glbMismatchCount === 0, `All 56 models have 100% exact match between GLB disk metrics and catalog`);
assert(urlMismatchCount === 0, `All URLs across 56 models are syntactically valid`);
assert(seenPaths.size === 56, `All 56 models reference distinct GLB file paths on disk`);

// ----------------------------------------------------------------------
// 4. Validate ASSETS_CATALOG.md Parity
// ----------------------------------------------------------------------
console.log('\n--- 4. Validating ASSETS_CATALOG.md Parity ---');
assert(fs.existsSync(CATALOG_MD_PATH), 'ASSETS_CATALOG.md exists on disk');

const mdContent = fs.readFileSync(CATALOG_MD_PATH, 'utf8');
const mdLines = mdContent.split('\n');

assert(mdLines.length >= 1000, `ASSETS_CATALOG.md is comprehensive (${mdLines.length} lines)`);

// Check table rows in section 2
const tableRows = mdLines.filter((line) => /^\|\s*\d+\s*\|/.test(line));
assert(tableRows.length === 56, `Master Asset Index Table in ASSETS_CATALOG.md contains exactly 56 rows (got ${tableRows.length})`);

// Deep check: Parse each row in the Master Asset Index Table and verify metrics match JSON
const unescapedPipeRows = [];
for (const row of tableRows) {
  let cols = row.split('|').map((c) => c.trim()).filter((c) => c.length > 0);
  const idx = parseInt(cols[0], 10);
  const cat = cols[1];

  let titleRaw, triRaw, vertRaw;
  if (cols.length === 10) {
    titleRaw = cols[2].replace(/\*\*/g, '').trim();
    triRaw = parseInt(cols[4].replace(/,/g, ''), 10);
    vertRaw = parseInt(cols[5].replace(/,/g, ''), 10);
  } else if (cols.length === 11) {
    // Unescaped pipe in title
    unescapedPipeRows.push({ idx, rowSnippet: row.substring(0, 60) });
    titleRaw = `${cols[2]} | ${cols[3]}`.replace(/\*\*/g, '').trim();
    triRaw = parseInt(cols[5].replace(/,/g, ''), 10);
    vertRaw = parseInt(cols[6].replace(/,/g, ''), 10);
  } else {
    assert(false, `Table row #${idx} unexpected column count (${cols.length})`);
    continue;
  }

  const jsonModel = catalog.models[idx - 1];
  assert(jsonModel !== undefined, `Table row #${idx} corresponds to valid model in JSON`);
  if (jsonModel) {
    assert(jsonModel.title === titleRaw, `Table row #${idx} title matches JSON ("${titleRaw}" === "${jsonModel.title}")`);
    assert(jsonModel.category === cat, `Table row #${idx} category matches JSON ("${cat}" === "${jsonModel.category}")`);
    assert(jsonModel.geometry.triangles === triRaw, `Table row #${idx} triangles match JSON (${triRaw} === ${jsonModel.geometry.triangles})`);
    assert(jsonModel.geometry.vertices === vertRaw, `Table row #${idx} vertices match JSON (${vertRaw} === ${jsonModel.geometry.vertices})`);
  }
}

if (unescapedPipeRows.length > 0) {
  warn(`Found ${unescapedPipeRows.length} table rows in ASSETS_CATALOG.md with unescaped pipe characters in titles causing column splits (rows: ${unescapedPipeRows.map(r => r.idx).join(', ')})`);
} else {
  assert(true, 'All 56 table rows have cleanly escaped columns');
}

// Deep check: Nested catalog.categories parity
let totalCategoryModels = 0;
for (const catObj of catalog.categories) {
  assert(Array.isArray(catObj.models), `Category '${catObj.category}' has models array`);
  totalCategoryModels += catObj.models.length;
  assert(catObj.models.length === catObj.modelCount, `Category '${catObj.category}' modelCount matches models.length`);

  const catTriangles = catObj.models.reduce((sum, m) => sum + m.geometry.triangles, 0);
  const catVertices = catObj.models.reduce((sum, m) => sum + m.geometry.vertices, 0);
  const catBytes = catObj.models.reduce((sum, m) => sum + m.file.sizeBytes, 0);

  assert(catObj.triangles === catTriangles, `Category '${catObj.category}' triangles match sum of nested models`);
  assert(catObj.vertices === catVertices, `Category '${catObj.category}' vertices match sum of nested models`);
  assert(catObj.fileSizeBytes === catBytes, `Category '${catObj.category}' fileSizeBytes match sum of nested models`);
}
assert(totalCategoryModels === 56, `Total models across catalog.categories is 56 (got ${totalCategoryModels})`);

// Check that every model title appears in ASSETS_CATALOG.md
let mdMissingTitles = 0;
for (const m of catalog.models) {
  if (!mdContent.includes(m.title)) {
    mdMissingTitles++;
    assert(false, `Title "${m.title}" not found in ASSETS_CATALOG.md`);
  }
}
assert(mdMissingTitles === 0, 'All 56 model titles are documented in ASSETS_CATALOG.md');

// Check that every Sketchfab UID appears in ASSETS_CATALOG.md
let mdMissingUids = 0;
for (const m of catalog.models) {
  if (!mdContent.includes(m.sketchfab.uid)) {
    mdMissingUids++;
    assert(false, `Sketchfab UID "${m.sketchfab.uid}" not found in ASSETS_CATALOG.md`);
  }
}
assert(mdMissingUids === 0, 'All 56 Sketchfab UIDs are documented in ASSETS_CATALOG.md');

// Check that attribution statements in MD match JSON
let mdMissingAttributions = 0;
for (const m of catalog.models) {
  if (!mdContent.includes(m.licensing.attributionStatement)) {
    mdMissingAttributions++;
    warn(`Attribution statement for "${m.title}" not verbatim in MD (may have formatting differences)`);
  }
}
assert(mdMissingAttributions === 0, 'All 56 attribution statements appear verbatim in ASSETS_CATALOG.md');

// ----------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`Verification Complete: ${results.passed} PASSED, ${results.failed} FAILED, ${results.warnings} WARNINGS`);
console.log('======================================================================\n');

if (results.failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

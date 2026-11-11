/**
 * Safe Catalog Loader for Node.js E2E Test Suite
 *
 * Allows loading `src/data/catalog.js` in standard Node.js environments
 * without requiring Vite dev server, while supporting testing in both
 * DEV mode (local /assets/ routes) and PROD mode (CDN/GitHub raw URLs).
 */

import fs from 'node:fs';
import path from 'node:path';

const CATALOG_PATH = path.resolve(process.cwd(), 'src/data/catalog.js');

/**
 * Loads the application catalog module with customizable environment flags.
 *
 * @param {object} [options]
 * @param {boolean} [options.isDev=true] - Emulates import.meta.env.DEV
 * @returns {Promise<object>} Exported catalog objects (CARS_CATALOG, PLANES_CATALOG, SCENES_CATALOG, PARTS_CATALOG, assetUrl)
 */
export async function loadCatalog({ isDev = true } = {}) {
  if (!fs.existsSync(CATALOG_PATH)) {
    throw new Error(`Catalog file not found at ${CATALOG_PATH}`);
  }

  let code = fs.readFileSync(CATALOG_PATH, 'utf8');

  // Replace import.meta.env.DEV with boolean literal
  code = code.replace(/import\.meta\.env\.DEV/g, isDev ? 'true' : 'false');

  // Encode as ESM data URL to import in Node.js
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code, 'utf8').toString('base64')}`;
  const mod = await import(dataUrl);

  return {
    CARS_CATALOG: mod.CARS_CATALOG || [],
    PLANES_CATALOG: mod.PLANES_CATALOG || [],
    SCENES_CATALOG: mod.SCENES_CATALOG || [],
    PARTS_CATALOG: mod.PARTS_CATALOG || [],
    assetUrl: mod.assetUrl,
    rawModule: mod,
  };
}

export default { loadCatalog };

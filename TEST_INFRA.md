# Test Infrastructure: 4-Tier Opaque-Box E2E Testing Framework

**Application:** 3D Car & Plane Cinema Studio (Scene Generator)  
**Location:** `/Users/Samuel/AGapps/3D Car and Plane Scene Generator/`  
**Test Suite Root:** `tests/`  
**Execution Command:** `npm test` or `node tests/e2e_runner.mjs`

---

## 1. Overview & Architecture

The 3D Car and Plane Scene Generator relies on real-time WebGL rendering of high-fidelity 3D assets (Cars, Planes, Garages, City Streets, Showcase Locations, and Car Parts) powered by React 18, Vite 6, and Three.js 0.170.

To guarantee zero runtime exceptions, zero asset 404s, strict glTF 2.0 binary conformance, and seamless UI workflows, this test infrastructure implements a **4-tier opaque-box E2E testing framework**:

```
                                  +---------------------------------------+
                                  |       npm test / e2e_runner.mjs       |
                                  +---------------------------------------+
                                                      |
         +--------------------+-----------------------+-----------------------+--------------------+
         |                    |                                               |                    |
         v                    v                                               v                    v
+-----------------+  +-------------------------+             +----------------------+  +----------------------+
|     Tier 1      |  |         Tier 2          |             |        Tier 3        |  |        Tier 4        |
| Feature Coverage|  |  Boundary & Corner Cases|             |Cross-Feature Dynamics|  | Real-World Scenarios |
+-----------------+  +-------------------------+             +----------------------+  +----------------------+
| • File Presence |  | • Texture Embedding     |             | • Catalog Schema     |  | • Car + Garage Flow  |
| • Non-Zero Size |  | • Polycount Limits      |             | • Subject-Scene Pair |  | • Plane + Runway Flow|
| • Magic Header  |  | • Draco Compression     |             | • Dynamic Sizing     |  | • Part Inspection    |
| • GLB Version 2 |  | • Corruption Rejection  |             | • Dev/Prod assetUrl  |  | • Mode Lifecycle     |
| • JSON Chunk 0  |  | • Coordinate Bounds     |             | • Vite Asset Bundling|  | • Production Build   |
| • 56 Target Sync|  | • Adversarial Fixtures  |             | • ID Uniqueness      |  | • dist/ Validation   |
+-----------------+  +-------------------------+             +----------------------+  +----------------------+
```

---

## 2. The 4-Tier Test Suite Specification

### Tier 1: Feature Coverage (Binary Integrity & Spec Conformance)
- **Target Scope:** All 56 required models (20 Cars, 20 Car Parts, 4 Garages, 2 City Streets, 4 Showcase Locations, 6 Planes).
- **Core Checks (Executed per asset):**
  1. **File Existence & Resolvability:** Validates physical file presence under `3D Car and Plane Scene Creator/`.
  2. **Non-Empty Content & Realistic Size:** Enforces minimum size threshold ($> 10\text{ KB}$) to eliminate placeholder or zero-byte stubs.
  3. **GLB Magic Header:** Verifies first 4 bytes match `0x46546C67` (ASCII `glTF` in little-endian).
  4. **Container Version & Length:** Asserts container version `2` and header byteLength equals actual file size.
  5. **JSON Chunk 0 Header & Syntax:** Validates chunk type `0x4E4F534A` (`JSON`), non-zero chunk length, valid UTF-8 payload, and glTF `asset.version === "2.0"`.
  6. **Binary Chunk 1 Header:** If present, validates chunk type `0x004E4942` (`BIN\0`) and buffer boundaries.
  7. **Category Feature Completeness:** Enforces minimum discovered asset counts across all 6 model categories.

### Tier 2: Boundary & Corner Cases (Adversarial Robustness)
- **Category 2.1 — Texture Embedding & URI Isolation:**
  - Verifies all model images use embedded `bufferView` indices or embedded `data:` URIs.
  - Rejects external relative paths (e.g. `textures/diffuse.png`) that cause runtime HTTP 404s in WebGL.
  - Enforces supported image MIME types (`image/png`, `image/jpeg`, `image/webp`).
- **Category 2.2 — Polycount Limits & Geometry Boundaries:**
  - Enforces non-zero geometry: primitives must contain position attributes and $> 0$ triangle count.
  - Monitors high polycounts with automated WebGL warnings for models $> 1,500,000$ triangles.
  - Validates finite bounding volume coordinates ($\min \le \max$, no `NaN` or `+/-Infinity`).
- **Category 2.3 — Draco Compression & Extensions:**
  - Validates `KHR_draco_mesh_compression` declaration and fallback compatibility.
  - Asserts that `SceneManager.js` imports `DRACOLoader` and configures the official Google Draco 1.5.7 CDN decoder path (`https://www.gstatic.com/draco/versioned/decoders/1.5.7/`).
  - Whitelists supported web glTF extensions (`KHR_draco_mesh_compression`, `KHR_materials_specular`, `KHR_mesh_quantization`, `EXT_meshopt_compression`, `EXT_texture_webp`, `KHR_texture_transform`).
- **Category 2.4 — Binary Corruption Rejection (Synthetic Adversarial Fixtures):**
  - Exercises error handling against dedicated corrupted files in `tests/fixtures/`:
    - `bad_magic.glb`: Invalid magic header `0x00000000` is rejected with detailed error.
    - `bad_version.glb`: glTF container version 1 is rejected as unsupported.
    - `truncated_file.glb`: Buffer shorter than declared length is rejected.
    - `corrupted_json.glb`: Syntax error in JSON chunk is safely caught.
    - `missing_texture_uri.glb`: External unbundled image URI is rejected.
    - `empty_file.glb`: 0-byte file is caught before header read.
- **Category 2.5 — Dynamic Sizing & Coordinate Boundaries:**
  - Validates component sizing envelopes:
    - Cars: $3.5\text{m} \le targetSize \le 6.5\text{m}$
    - Planes: $12.0\text{m} \le targetSize \le 80.0\text{m}$
    - Car Parts: $0.2\text{m} \le targetSize \le 2.5\text{m}$
    - Garages / Showcases: $20.0\text{m} \le targetSpan \le 80.0\text{m}$
    - City Streets: $30.0\text{m} \le targetSpan \le 120.0\text{m}$
  - Asserts rejection of negative, zero, or NaN scale factors.

### Tier 3: Cross-Feature Interactions (Catalog & Bundler Integration)
- **Area 3.1 — Catalog Schema Conformance (`src/data/catalog.js`):**
  - Strict validation of `CARS_CATALOG`, `PLANES_CATALOG`, and `SCENES_CATALOG`.
  - Global ID collision detection across all catalog exports.
  - Regex validation of CSS accent colors (`^#[0-9a-fA-F]{6}$`).
- **Area 3.2 — Scene-to-Subject Pairing Matrix:**
  - Validates that car models pair with all scenes supporting `'cars'`.
  - Validates that plane models pair with all scenes supporting `'planes'`.
  - Validates that component parts pair with inspection-capable scenes.
  - Validates lighting and weather presets (`sunny`, `clear`, `rain`, `fog`, `cloudy`, `overcast`).
- **Area 3.3 — Dynamic Viewport Normalization:**
  - Validates horizontal scaling formula: $scale = targetSpan / \max(dimX, dimZ)$.
  - Validates ground alignment formula: $offsetY = -box.min.y \cdot scale \implies Y_{contact} = 0.000\text{m}$.
- **Area 3.4 — Asset URL Routing & Vite Bundling:**
  - Validates `assetUrl()` in dev mode producing local `/assets/...` routes.
  - Validates production URL encoding for spaces and special characters.
  - Asserts that all catalog URL routes map to real existing files in the workspace.
  - Verifies Vite `serveWorkspaceAssetsPlugin` middleware mounting.

### Tier 4: Real-World Scenarios (End-to-End User Workflows)
- **Scenario 4.1 — Car & Garage Showcase:**
  - Simulates selecting a car (e.g., Aston Martin AMR26) and a garage (`car_garage.glb`).
  - Verifies car scaling ($5.5\text{m}$), floor contact at $Y = 0.000$, and garage clearance ($targetSize < targetSpan$).
- **Scenario 4.2 — Plane & Cloud Runway:**
  - Simulates selecting a commercial airliner (Boeing 747-400) on an open runway.
  - Verifies wingspan scale ($28\text{m}$), 4-engine spec conformance, and camera frustum range ($1.2\text{m} - 140\text{m}$).
- **Scenario 4.3 — Car Part & Inspection Station:**
  - Simulates selecting a component part (Alpine Car Radio) in a studio gallery.
  - Verifies compact normalization ($0.6\text{m}$ component scale vs $4.75\text{m}$ vehicle default) and orbit camera centering.
- **Scenario 4.4 — Mode Switching & Memory Lifecycle:**
  - Simulates mode navigation (`cars` $\to$ `planes` $\to$ `parts` $\to$ `cars`).
  - Verifies active subject group disposal, zero memory leaks, and cache reuse without duplicate geometry instantiation.
- **Scenario 4.5 — Production Build Bundle Validation:**
  - Verifies `dist/index.html` structure (`<!doctype html>`, `<div id="root"></div>`).
  - Verifies production bundled JavaScript and CSS files are non-empty.
  - Verifies production compilation exits with code 0.

---

## 3. Test Runner Directory Layout

```
tests/
├── e2e_runner.mjs             # Primary executable 4-tier test runner
├── glb_validator.mjs          # Khronos glTF 2.0 binary parser & geometry inspector
├── catalog_loader.mjs         # Safe isomorphic catalog loader (DEV & PROD URL modes)
├── e2e_scenarios.mjs          # Tier 4 real-world user workflow simulations
└── fixtures/                  # Synthetic test fixtures for boundary verification
    ├── bad_magic.glb          # Magic 0x00000000 violation
    ├── bad_version.glb        # Unsupported version 1 violation
    ├── truncated_file.glb     # Truncated buffer violation
    ├── corrupted_json.glb     # Malformed JSON chunk violation
    ├── missing_texture_uri.glb# Unbundled external URI violation
    ├── empty_file.glb         # 0-byte buffer violation
    └── candidate_models.json  # Authoritative 56 curated model specification
scripts/
└── run_e2e_tests.py           # Python CLI test runner bridge
```

---

## 4. How to Run the Tests

### Quick Start
```bash
# Run complete 4-tier test suite
npm test

# Alternatively, execute with Node directly
node tests/e2e_runner.mjs

# Or execute with Python
python3 scripts/run_e2e_tests.py
```

### Advanced CLI Options

| Flag | Purpose | Example |
| :--- | :--- | :--- |
| `--tier=<1,2,3,4>` | Run specific tiers only | `node tests/e2e_runner.mjs --tier=1,4` |
| `--strict-56` | Strictly assert all 56 target assets exist on disk | `node tests/e2e_runner.mjs --strict-56` |
| `--json` | Output machine-readable JSON summary for CI pipelines | `node tests/e2e_runner.mjs --json` |

---

## 5. Progressive Testability Policy

- **During Active Milestone Implementation (Milestones 1–4):**
  Running `npm test` operates in **Progressive Mode**, validating all currently integrated assets, testing all boundary/corner conditions with synthetic fixtures, verifying cross-feature interactions, and running end-to-end user scenarios. It tracks target asset acquisition and passes with **Exit Code 0**.
- **Final Milestone 5 Verification:**
  Passing `--strict-56` (or `STRICT_56=1`) enforces that all 56 curated models are physically present, validly packed, registered in `src/data/catalog.js`, and fully integrated into the build pipeline.

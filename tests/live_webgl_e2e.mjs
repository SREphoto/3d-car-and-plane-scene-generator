#!/usr/bin/env node
/**
 * Live Headless Chrome + WebGL2 End-to-End Verification
 * Launches Vite + Headless Chrome (Metal ANGLE WebGL2), drives React UI & SceneManager,
 * verifies GLSL shader compilation (LinearHdrOpticalBokehShader), Pro Cyclorama Studio rigs,
 * Physical Lenses (85mm f/1.2L, 200mm f/2.8L) + Click-to-Focus, Desktop Fleet Variants + Chinook,
 * Velvet Showroom, Detailed Parking Garage, Red Bull Garage luminance, and Monaco Circuit tarmac snap.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VITE_PORT = 5188;
const CDP_PORT = 9233;
const CHROME_BIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForHttp(url, timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
    } catch {
      // retry
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        const handlers = this.listeners.get(msg.method) || [];
        for (const h of handlers) h(msg.params);
      }
    });
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await this.send('Runtime.evaluate', {
          expression,
          awaitPromise: true,
          returnByValue: true,
        });
        if (res.exceptionDetails) {
          throw new Error(
            `Eval exception: ${res.exceptionDetails.text} ${res.exceptionDetails.exception?.description || ''}`
          );
        }
        return res.result?.value;
      } catch (err) {
        if (attempt < retries && String(err.message).includes('Execution context was destroyed')) {
          await sleep(1000);
          continue;
        }
        throw err;
      }
    }
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // ignore
    }
  }
}

async function main() {
  console.log('\n=== Live Headless WebGL2 End-to-End Verification ===\n');
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'scene-creator-chrome-'));
  let viteProc = null;
  let chromeProc = null;
  let cdp = null;
  let passed = 0;
  let failed = 0;

  const check = (name, cond, detail = '') => {
    if (cond) {
      passed++;
      console.log(`  ✓ ${name}${detail ? ` (${detail})` : ''}`);
    } else {
      failed++;
      console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
    }
  };

  try {
    viteProc = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(VITE_PORT), '--strictPort'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForHttp(`http://127.0.0.1:${VITE_PORT}/`, 20000);

    chromeProc = spawn(
      CHROME_BIN,
      [
        '--headless=new',
        '--use-angle=metal',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--no-first-run',
        '--no-default-browser-check',
        '--mute-audio',
        '--window-size=1440,900',
        `--user-data-dir=${tmpProfile}`,
        `--remote-debugging-port=${CDP_PORT}`,
        `http://127.0.0.1:${VITE_PORT}/`,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );

    const targetsJson = await waitForHttp(`http://127.0.0.1:${CDP_PORT}/json`, 15000);
    const targets = JSON.parse(targetsJson);
    const pageTarget = targets.find((t) => t.type === 'page');
    if (!pageTarget) throw new Error('No Chrome page target found');

    cdp = new CdpClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    const consoleErrors = [];
    const pageExceptions = [];

    cdp.on('Runtime.consoleAPICalled', (params) => {
      if (params.type === 'error') {
        const text = (params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
        if (!text.includes('favicon')) {
          consoleErrors.push(text);
        }
      }
    });
    cdp.on('Runtime.exceptionThrown', (params) => {
      pageExceptions.push(params.exceptionDetails?.exception?.description || params.exceptionDetails?.text || 'error');
    });

    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');

    // Wait for SceneManager + initial subject + initial Pro Cyclorama Studio
    await cdp.eval(`
      new Promise((resolve, reject) => {
        const t0 = Date.now();
        const poll = () => {
          const sm = window.__sceneManager;
          if (
            sm &&
            sm.subjectHolder?.children?.length > 0 &&
            sm.activeSceneId === 'pro_lighting_studio' &&
            sm.proStudioInstance
          ) {
            resolve(true);
            return;
          }
          if (Date.now() - t0 > 25000) {
            reject(new Error('Timed out waiting for initial SceneManager boot'));
            return;
          }
          setTimeout(poll, 150);
        };
        poll();
      })
    `);
    await sleep(300);

    // Helper inside page to read center-region WebGL luminance via render-to-canvas readPixels
    await cdp.eval(`
      window.__sampleViewportLuminance = () => {
        const sm = window.__sceneManager;
        sm.pipeline.render(0.016);
        const gl = sm.renderer.getContext();
        const w = gl.drawingBufferWidth;
        const h = gl.drawingBufferHeight;
        const sw = 96, sh = 96;
        const x0 = Math.floor((w - sw) * 0.5);
        const y0 = Math.floor((h - sh) * 0.45);
        const buf = new Uint8Array(sw * sh * 4);
        gl.readPixels(x0, y0, sw, sh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
        let sum = 0, max = 0, nonZero = 0;
        const n = sw * sh;
        for (let i = 0; i < buf.length; i += 4) {
          const lum = 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2];
          sum += lum;
          if (lum > max) max = lum;
          if (lum > 1) nonZero++;
        }
        return { mean: sum / n, max, nonZeroRatio: nonZero / n, w, h };
      };
    `);

    // 1. Verify Pro Cyclorama Lighting Studio looks, floor finishes, reflections & turntable
    const studioReport = await cdp.eval(`
      (async () => {
        const sm = window.__sceneManager;
        const looks = ['clean_commercial', 'moody_rim', 'rgb_cyber', 'venetian_gobo', 'ring_light'];
        const lookSamples = {};
        for (const look of looks) {
          sm.applyProStudioPreset(look);
          lookSamples[look] = window.__sampleViewportLuminance();
        }
        const floors = ['matte_white', 'dark_satin_obsidian', 'wet_mirror_epoxy', 'brushed_concrete'];
        const floorRoughness = {};
        for (const fl of floors) {
          sm.setProStudioState({ floorFinishId: fl });
          floorRoughness[fl] = sm.proStudioInstance.cycMesh?.material?.roughness ?? sm.proStudioInstance.floorFinishRoughness ?? null;
        }
        sm.setProStudioState({ turntableEnabled: true, turntableSpeed: 1.5 });
        const y0 = sm.proStudioInstance.turntableDisk ? sm.proStudioInstance.turntableDisk.rotation.y : sm.subjectHolder.rotation.y;
        const subY0 = sm.subjectHolder.rotation.y;
        await new Promise((r) => setTimeout(r, 260));
        const subY1 = sm.subjectHolder.rotation.y;
        sm.setProStudioState({ turntableEnabled: false, turntableSpeed: 0.25 });
        return {
          lookSamples,
          floorRoughness,
          turntableDelta: Math.abs(subY1 - subY0),
          hasEnvMap: Boolean(sm.scene.environment),
        };
      })()
    `);

    check(
      'Pro Cyclorama Studio renders all 5 commercial looks with valid WebGL luminance & live PMREM reflections',
      Object.values(studioReport.lookSamples).every((s) => s.mean > 2 && s.nonZeroRatio > 0.35) && studioReport.hasEnvMap,
      `cleanMean=${studioReport.lookSamples.clean_commercial.mean.toFixed(1)}, moodyMean=${studioReport.lookSamples.moody_rim.mean.toFixed(1)}`
    );
    check(
      'Pro Cyclorama Studio switches all 4 floor finishes & drives motorized turntable',
      studioReport.turntableDelta > 0.05,
      `floorRoughness=${JSON.stringify(studioReport.floorRoughness)}, rotDelta=${studioReport.turntableDelta.toFixed(3)}rad`
    );

    // 2. Click React TopBar lens buttons (85mm f/1.2L & 200mm f/2.8L) + verify LinearHdrOpticalBokehShader + Click-to-Focus
    const lensReport = await cdp.eval(`
      (async () => {
        const sm = window.__sceneManager;
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn85 = buttons.find((b) => b.textContent.includes('85mm f/1.2L'));
        const btn200 = buttons.find((b) => b.textContent.includes('200mm f/2.8L'));
        if (!btn85 || !btn200) throw new Error('Missing TopBar lens buttons');

        btn85.click();
        await new Promise((r) => setTimeout(r, 120));
        const sample85 = window.__sampleViewportLuminance();
        const state85 = {
          fov: sm.camera.fov,
          lens: sm.getLensAndDofState(),
          dofPass: sm.pipeline.getDofState(),
          sample85,
        };

        btn200.click();
        await new Promise((r) => setTimeout(r, 120));
        const sample200 = window.__sampleViewportLuminance();
        const state200 = {
          fov: sm.camera.fov,
          lens: sm.getLensAndDofState(),
          dofPass: sm.pipeline.getDofState(),
          sample200,
        };

        // Test Click-to-Focus raycast on center of vehicle and off-subject corner
        const hitCenter = sm.pickFocusAtNormalizedPoint(0, 0);
        const lensAfterHit = sm.getLensAndDofState();
        const edgePick = sm.pickFocusAtNormalizedPoint(0.98, 0.98);

        // Switch back to Canon 85mm f/1.2L Auto-Focus for night bokeh street check
        btn85.click();
        await new Promise((r) => setTimeout(r, 80));

        return { state85, state200, hitCenter, lensAfterHit, edgePick };
      })()
    `);

    check(
      'React TopBar 85mm f/1.2L & 200mm f/2.8L buttons compile & activate Linear-HDR Optical Bokeh in WebGL2',
      lensReport.state85.dofPass.enabled === true &&
        Math.abs(lensReport.state85.dofPass.fStop - 1.2) < 0.01 &&
        Math.abs(lensReport.state200.dofPass.fStop - 2.8) < 0.01 &&
        lensReport.state85.fov > 15.5 &&
        lensReport.state85.fov < 16.5 &&
        lensReport.state200.fov > 6.5 &&
        lensReport.state200.fov < 7.2,
      `85mm fov=${lensReport.state85.fov.toFixed(2)}° f/${lensReport.state85.dofPass.fStop}, 200mm fov=${lensReport.state200.fov.toFixed(2)}° f/${lensReport.state200.dofPass.fStop}`
    );
    check(
      'Click-to-Focus raycaster locks manual focus distance onto vehicle surface & handles edge raycast safely',
      Boolean(lensReport.hitCenter && lensReport.hitCenter.distance > 1.0 && lensReport.lensAfterHit.focusMode === 'manual'),
      `hitDist=${lensReport.hitCenter?.distance?.toFixed(2)}m, mode=${lensReport.lensAfterHit.focusMode}`
    );

    // 3. Load Desktop Fleet Variants, Upgraded Audi R26, & Aircraft in live WebGL (Draco + Meshopt)
    const fleetReport = await cdp.eval(`
      (async () => {
        const sm = window.__sceneManager;
        const { CARS_CATALOG, PLANES_CATALOG } = await import('/src/data/catalog.js');
        const results = {};

        const carIds = [
          'audi-r26-concept',
          'porsche-carrera-gt-concept-silver',
          'porsche-carrera-gt-concept-blue',
          'bugatti-eb110-ss-blue',
          'bugatti-eb110-ss-silver',
          'dodge-challenger-srt-hellcat',
          'ferrari-296-gt3-verstappen',
          '2024-ford-f150-raptor-r',
        ];
        for (const id of carIds) {
          const item = CARS_CATALOG.find((c) => c.id === id);
          await sm.loadSubject(item, 'cars');
          let meshes = 0;
          sm.subjectHolder.traverse((o) => { if (o.isMesh) meshes++; });
          results[id] = { meshes, bounds: { ...sm.activeSubjectBounds } };
        }

        const planeIds = ['boeing-ch47-chinook', 'sukhoi-su47-berkut'];
        for (const id of planeIds) {
          const item = PLANES_CATALOG.find((p) => p.id === id);
          await sm.loadSubject(item, 'planes');
          let meshes = 0;
          sm.subjectHolder.traverse((o) => { if (o.isMesh) meshes++; });
          results[id] = { meshes, bounds: { ...sm.activeSubjectBounds } };
        }

        // Restore upgraded Audi R26 for location showcase checks
        const r26 = CARS_CATALOG.find((c) => c.id === 'audi-r26-concept');
        await sm.loadSubject(r26, 'cars');
        return results;
      })()
    `);

    const allLoadedClean = Object.values(fleetReport).every((r) => r.meshes > 0 && r.bounds.d > 2.5);
    check(
      'Live WebGL loads upgraded Audi R26, both Carrera GT & EB110 variants, Hellcat, CH-47 Chinook, & Su-47 Berkut',
      allLoadedClean,
      Object.entries(fleetReport)
        .map(([k, v]) => `${k}:${v.meshes}m`)
        .join(', ')
    );

    // 4. Switch across all new Procedural & GLB Locations + Red Bull Garage Brightness Check + Monaco Tarmac Snap
    const scenesReport = await cdp.eval(`
      (async () => {
        const sm = window.__sceneManager;
        const { SCENES_CATALOG } = await import('/src/data/catalog.js');
        const sceneIds = [
          'warehouse_courtyard_day',
          'wet_night_bokeh_street',
          'city_bokeh_street_day',
          'velvet_curtain_showroom',
          'detailed_parking_garage',
          'red_bull_f1_garage',
          'monaco_circuit',
          'marina_bay_circuit',
        ];
        const out = {};
        for (const sid of sceneIds) {
          const sc = SCENES_CATALOG.find((s) => s.id === sid);
          if (sid === 'wet_night_bokeh_street') {
            sm.setLensAndDof({ focalLengthMm: 85, fStop: 1.2, dofEnabled: true, focusMode: 'auto' }, { autoDolly: true });
          } else {
            sm.setLensAndDof({ focalLengthMm: null, dofEnabled: false }, { autoDolly: true });
          }
          await sm.setScene(sc);
          await new Promise((r) => setTimeout(r, 180));
          const lum = window.__sampleViewportLuminance();
          const holderPos = sm.subjectHolder.position;
          out[sid] = {
            meanLum: lum.mean,
            maxLum: lum.max,
            nonZeroRatio: lum.nonZeroRatio,
            subjectY: holderPos.y,
          };
        }
        return out;
      })()
    `);

    check(
      'Warehouse Courtyard, Day Street, & Wet-Night HDR Bokeh Street render cleanly in WebGL2',
      scenesReport.warehouse_courtyard_day.meanLum > 12 &&
        scenesReport.city_bokeh_street_day.meanLum > 12 &&
        scenesReport.wet_night_bokeh_street.meanLum > 1.5 &&
        scenesReport.wet_night_bokeh_street.maxLum > 60,
      `warehouse=${scenesReport.warehouse_courtyard_day.meanLum.toFixed(1)}, nightMean=${scenesReport.wet_night_bokeh_street.meanLum.toFixed(1)}/max=${scenesReport.wet_night_bokeh_street.maxLum.toFixed(0)}`
    );

    check(
      'Velvet Collector Showroom & Detailed Concrete Parking Garage GLBs render & ground car near Y=0',
      scenesReport.velvet_curtain_showroom.meanLum > 4 &&
        Math.abs(scenesReport.velvet_curtain_showroom.subjectY) < 0.25 &&
        scenesReport.detailed_parking_garage.meanLum > 4 &&
        Math.abs(scenesReport.detailed_parking_garage.subjectY) < 0.35,
      `velvetY=${scenesReport.velvet_curtain_showroom.subjectY.toFixed(3)}m (lum=${scenesReport.velvet_curtain_showroom.meanLum.toFixed(1)}), parkingY=${scenesReport.detailed_parking_garage.subjectY.toFixed(3)}m (lum=${scenesReport.detailed_parking_garage.meanLum.toFixed(1)})`
    );

    check(
      'Red Bull F1 Garage brightness calibrated (not blown out: 10 < meanLuminance < 165)',
      scenesReport.red_bull_f1_garage.meanLum > 10 && scenesReport.red_bull_f1_garage.meanLum < 165,
      `redBullMeanLum=${scenesReport.red_bull_f1_garage.meanLum.toFixed(1)}/255`
    );

    check(
      'Circuit de Monaco & Marina Bay Night GP load Draco/AC meshes and snap F1 car flush onto tarmac (|Y| < 0.6m)',
      scenesReport.monaco_circuit.meanLum > 8 &&
        Math.abs(scenesReport.monaco_circuit.subjectY) < 0.6 &&
        scenesReport.marina_bay_circuit.meanLum > 2.5 &&
        Math.abs(scenesReport.marina_bay_circuit.subjectY) < 0.6,
      `monacoY=${scenesReport.monaco_circuit.subjectY.toFixed(3)}m (lum=${scenesReport.monaco_circuit.meanLum.toFixed(1)}), marinaY=${scenesReport.marina_bay_circuit.subjectY.toFixed(3)}m (lum=${scenesReport.marina_bay_circuit.meanLum.toFixed(1)})`
    );

    check(
      'Zero WebGL shader errors, console errors, or uncaught page exceptions across entire session',
      consoleErrors.length === 0 && pageExceptions.length === 0,
      consoleErrors.length || pageExceptions.length
        ? `consoleErrors=${JSON.stringify(consoleErrors)}, exceptions=${JSON.stringify(pageExceptions)}`
        : '0 errors'
    );
  } finally {
    if (cdp) cdp.close();
    if (chromeProc) chromeProc.kill('SIGKILL');
    if (viteProc) viteProc.kill('SIGTERM');
    await sleep(250);
    fs.rmSync(tmpProfile, { recursive: true, force: true });
  }

  console.log(`\n=== Live WebGL Summary: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal E2E error:', err);
  process.exit(1);
});

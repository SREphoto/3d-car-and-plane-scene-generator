#!/usr/bin/env node
/**
 * Unit checks for CarMaterialEnhancer paint handling (runs headless in Node, no WebGL needed).
 *
 * Covers the car-paint regressions fixed on fix/car-paint-loading:
 *  - GLBs without materials (GLTFLoader default white metalness=1) must not render as raw chrome.
 *  - Silver / white paints are toned down so the white studio IBL doesn't blow them out.
 *  - Shared source materials are upgraded once (no per-mesh material explosion).
 *  - Re-enhancing a cached subject re-binds stored materials instead of re-upgrading them.
 *  - Replaced source materials are disposed.
 *  - Textured paint keeps its glTF baseColorFactor instead of being forced to #ffffff.
 */
import * as THREE from 'three';

// Minimal 2D canvas stub so createContactShadow() can run outside the browser.
const fakeCtx = new Proxy(
  {},
  {
    get: (t, k) => {
      if (k === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (k in t) return t[k];
      return () => {};
    },
    set: (t, k, v) => {
      t[k] = v;
      return true;
    },
  }
);
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx }),
};

const {
  CarMaterialEnhancer,
  isGltfDefaultMaterial,
  paintResponseFor,
  applyPaintHints,
  colorLuminance,
} = await import('../src/engine/CarMaterialEnhancer.js');

let passed = 0;
let failed = 0;
function check(name, cond, details = '') {
  if (cond) {
    passed++;
    console.log(`  \u2713 ${name}${details ? ` (${details})` : ''}`);
  } else {
    failed++;
    console.log(`  \u2717 ${name}${details ? ` - ${details}` : ''}`);
  }
}

const geo = new THREE.BoxGeometry(1, 1, 1);
const bounds = { w: 2, h: 1.2, d: 4.5 };

console.log('CarMaterialEnhancer paint checks');

// 1. GLTFLoader default material
{
  const gltfDefault = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 1 });
  check('isGltfDefaultMaterial detects GLTFLoader fallback', isGltfDefaultMaterial(gltfDefault));
  check(
    'isGltfDefaultMaterial ignores named materials',
    !isGltfDefaultMaterial(new THREE.MeshStandardMaterial({ name: 'Chrome', metalness: 1, roughness: 1 }))
  );
  const root = new THREE.Group();
  const body = new THREE.Mesh(geo, gltfDefault);
  body.name = 'mesh_0';
  const tyre = new THREE.Mesh(geo, gltfDefault);
  tyre.name = 'WheelBR_pivot_tyres';
  root.add(body, tyre);
  const enh = new CarMaterialEnhancer();
  enh.setSubjectHints({ paintColor: '#0d5c46' });
  enh.enhance(root, 'cars', bounds);
  check('default-material body becomes physical paint', body.material.isMeshPhysicalMaterial);
  check('default-material body is no longer metalness 1', body.material.metalness < 0.8, `metalness=${body.material.metalness}`);
  check(
    'default-material body uses catalog paintColor hint',
    body.material.color.getHexString() === new THREE.Color('#0d5c46').getHexString(),
    `#${body.material.color.getHexString()}`
  );
  check('default-material tyre becomes dark rubber', colorLuminance(tyre.material.color) < 0.05);
  check('default-material body is bound to paint controls', enh.bodyMaterials.length === 1);
}

// 2. Bright metallic paints are toned down
{
  const silver = paintResponseFor(new THREE.Color(0.86, 0.88, 0.91), 0.72);
  check('silver paint metalness capped', silver.metalness <= 0.6, `metalness=${silver.metalness}`);
  check('silver paint albedo pulled down', silver.colorScale < 0.5, `scale=${silver.colorScale.toFixed(2)}`);
  check('silver paint IBL gain reduced', silver.envMapIntensity < 1.0);
  const white = paintResponseFor(new THREE.Color(1, 1, 1), 0.05);
  check('white dielectric paint stays dielectric', white.metalness < 0.2);
  const red = paintResponseFor(new THREE.Color(0.6, 0.02, 0.02), 0.6);
  check('dark saturated paint keeps metallic flake', red.metalness >= 0.5 && red.colorScale === 1);
}

// 3. Shared materials upgraded once + originals disposed + idempotent re-enhance
{
  const root = new THREE.Group();
  const rimSrc = new THREE.MeshStandardMaterial({ name: 'EXT_RIM', color: 0xcccccc, metalness: 1, roughness: 0.2 });
  let disposed = 0;
  rimSrc.addEventListener('dispose', () => disposed++);
  for (let i = 0; i < 60; i++) {
    const m = new THREE.Mesh(geo, rimSrc);
    m.name = `rim_${i}`;
    root.add(m);
  }
  const paintSrc = new THREE.MeshStandardMaterial({ name: 'CarPaint_Body', color: 0x8a0000, metalness: 0.6, roughness: 0.3 });
  const bodyMesh = new THREE.Mesh(geo, paintSrc);
  bodyMesh.name = 'body';
  root.add(bodyMesh);

  const enh = new CarMaterialEnhancer();
  enh.enhance(root, 'cars', bounds);
  const rimMats = new Set();
  root.traverse((c) => c.isMesh && c.name.startsWith('rim_') && rimMats.add(c.material));
  check('60 meshes sharing a rim material share one upgraded material', rimMats.size === 1, `unique=${rimMats.size}`);
  check('wheel group holds a single entry', enh.wheelMaterials.length === 1, `wheel=${enh.wheelMaterials.length}`);
  check('replaced source material disposed', disposed === 1, `dispose events=${disposed}`);
  check('upgraded material keeps source name', bodyMesh.material.name === 'CarPaint_Body');

  const paintMat = bodyMesh.material;
  enh.setPaintColor('#00ff00');
  enh.enhance(root, 'cars', bounds); // cached subject re-shown
  check('re-enhance keeps the same paint material instance', bodyMesh.material === paintMat);
  check('re-enhance restores body bindings', enh.bodyMaterials.length === 1 && enh.bodyMaterials[0].paintMat === paintMat);
  check(
    're-enhance restores factory paint after a custom colour',
    paintMat.color.getHexString() === enh.bodyMaterials[0].origColor.getHexString()
  );
  let shadowCount = 0;
  root.traverse((c) => c.name === 'VehicleDirectionalShadowCatcher' && shadowCount++);
  check('re-enhance does not stack shadow catchers', shadowCount === 1, `catchers=${shadowCount}`);
}

// 4. baseColorFactor is kept as the tint for textured paint (glTF: factor x texture)
{
  const root = new THREE.Group();
  const tex = new THREE.Texture();
  const src = new THREE.MeshStandardMaterial({ name: 'AMGMAT_AMG_One_CarPaint2_014', color: 0x000000, map: tex, metalness: 0, roughness: 0.3 });
  const m = new THREE.Mesh(geo, src);
  m.name = 'body';
  root.add(m);
  const enh = new CarMaterialEnhancer();
  enh.enhance(root, 'cars', bounds);
  check('textured paint keeps black baseColorFactor', m.material.color.getHex() === 0x000000, `#${m.material.color.getHexString()}`);
  check('textured paint keeps its livery map', m.material.map === tex);
  enh.setPaintColor('#ff0000');
  enh.resetFactoryPaint();
  check('factory reset restores factor tint + map', m.material.color.getHex() === 0x000000 && m.material.map === tex);
}


// 5. Untextured white CarPaint (AMG One main shell) uses catalog paintColor
{
  const root = new THREE.Group();
  const src = new THREE.MeshStandardMaterial({
    name: 'AMGMAT_CarPaint_Metallic_White_074',
    color: 0xffffff,
    metalness: 0,
    roughness: 0.3,
  });
  const m = new THREE.Mesh(geo, src);
  m.name = 'AMG:SM_Base_0000_001_MAT_CarPaint_Metallic';
  root.add(m);
  const enh = new CarMaterialEnhancer();
  enh.setSubjectHints({ paintColor: '#0a0a0c' });
  enh.enhance(root, 'cars', bounds);
  check(
    'untextured white CarPaint uses catalog paintColor',
    m.material.color.getHexString() === new THREE.Color('#0a0a0c').getHexString(),
    `#${m.material.color.getHexString()}`
  );
  check('untextured white CarPaint stays untextured', !m.material.map);
  check('untextured white CarPaint is bound to paint controls', enh.bodyMaterials.length === 1);
}

// 6. Per-car catalog paint hints (AMG ONE gloss / Carrera GT brightness) do not change other cars
{
  const baseBlack = paintResponseFor(new THREE.Color('#0a0a0c'), 0.55);
  const amg = applyPaintHints(baseBlack, {
    paintMetalness: 0.08,
    paintRoughness: 0.36,
    paintClearcoat: 0.28,
    paintClearcoatRoughness: 0.24,
    paintEnvMapIntensity: 0.4,
  });
  check('AMG hint lowers metalness vs default dark paint', amg.metalness === 0.08 && baseBlack.metalness > 0.3);
  check('AMG hint raises roughness vs default dark paint', amg.roughness === 0.36 && baseBlack.roughness < 0.2);
  check('AMG hint lowers clearcoat', amg.clearcoat === 0.28);
  check('untouched dark paint response stays unchanged', baseBlack.clearcoat == null && baseBlack.envMapIntensity === 1.6);

  const silver = paintResponseFor(new THREE.Color(0.86, 0.88, 0.91), 0.72);
  const carrera = applyPaintHints(silver, {
    paintMetalness: 0.55,
    paintRoughness: 0.28,
    paintEnvMapIntensity: 0.38,
    paintColorScale: 0.45,
  });
  check('Carrera hint lowers IBL vs shared silver path', carrera.envMapIntensity === 0.38 && silver.envMapIntensity === 0.8);
  check('Carrera hint overrides albedo scale absolutely', carrera.colorScale === 0.45);
  check('shared silver path is unchanged without hints', silver.envMapIntensity === 0.8 && silver.metalness <= 0.6);

  const root = new THREE.Group();
  const src = new THREE.MeshStandardMaterial({
    name: 'AMGMAT_CarPaint_Metallic_White_074',
    color: 0xffffff,
    metalness: 0,
    roughness: 0.3,
  });
  const m = new THREE.Mesh(geo, src);
  m.name = 'AMG:SM_Base_0000_001_MAT_CarPaint_Metallic';
  root.add(m);
  const enh = new CarMaterialEnhancer();
  enh.setSubjectHints({
    paintColor: '#0a0a0c',
    paintMetalness: 0.08,
    paintRoughness: 0.36,
    paintClearcoat: 0.28,
    paintClearcoatRoughness: 0.24,
    paintEnvMapIntensity: 0.4,
  });
  enh.enhance(root, 'cars', bounds);
  check('AMG catalog hints applied to body material', m.material.metalness === 0.08 && m.material.roughness === 0.36);
  check('AMG catalog hints applied to clearcoat', m.material.clearcoat === 0.28 && m.material.clearcoatRoughness === 0.24);
  check('AMG catalog hints applied to IBL gain', m.material.envMapIntensity === 0.4);
  enh.resetFactoryPaint();
  check('factory reset keeps AMG clearcoat hints', m.material.clearcoat === 0.28 && m.material.envMapIntensity === 0.4);
}

// 7. Catalog paintMaterialNames can opt a uniquely named shell into body paint
{
  const root = new THREE.Group();
  const src = new THREE.MeshStandardMaterial({
    name: 'Porsche_Carrera_GT_Concept_2000_Replica_By_Alex_Ka_2',
    color: 0xbcbcbc,
    metalness: 1,
    roughness: 0.35,
  });
  const m = new THREE.Mesh(geo, src);
  m.name = 'Object_6001';
  root.add(m);
  const enh = new CarMaterialEnhancer();
  enh.setSubjectHints({
    paintMaterialNames: ['porsche_carrera_gt_concept_2000_replica'],
    paintMetalness: 0.55,
    paintRoughness: 0.28,
    paintClearcoat: 0.55,
    paintClearcoatRoughness: 0.14,
    paintEnvMapIntensity: 0.38,
    paintColorScale: 0.45,
  });
  enh.enhance(root, 'cars', bounds);
  check('hinted Carrera shell is bound as body paint', enh.bodyMaterials.length === 1);
  check('hinted Carrera shell is no longer metalness 1', m.material.metalness === 0.55, `metalness=${m.material.metalness}`);
  check('hinted Carrera shell uses lower IBL gain', m.material.envMapIntensity === 0.38);
  check('hinted Carrera shell albedo is scaled', m.material.color.getHexString() < 'bcbcbc', `#${m.material.color.getHexString()}`);
}

console.log(`\n${passed} passed, ${failed} failed`);

process.exit(failed ? 1 : 0);

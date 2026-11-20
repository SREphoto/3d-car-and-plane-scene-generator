import * as THREE from 'three';

// Strict token boundary helpers so 'light' never matches 'flight', 'cf' never matches 'rcf',
// and 'ext' never matches 'texture'.
const TOKEN_SPLIT_RE = /[^a-z0-9]+/i;

function hasAnyToken(str, tokens) {
  const parts = str.toLowerCase().split(TOKEN_SPLIT_RE).filter(Boolean);
  for (const p of parts) {
    if (tokens.has(p)) return true;
  }
  return false;
}

function hasSubstring(str, subs) {
  const s = str.toLowerCase();
  for (const sub of subs) {
    if (s.includes(sub)) return true;
  }
  return false;
}

const DECAL_TOKENS = new Set([
  'decal', 'decals', 'sticker', 'stickers', 'sponsor', 'sponsors',
  'badge', 'badges', 'emblem', 'logo', 'logos', 'numberplate', 'plate', 'banner',
]);

const GLASS_TOKENS = new Set([
  'glass', 'glasses', 'glas', 'window', 'windows', 'windo', 'windofs', 'windor',
  'windshield', 'windscreen', 'vitre', 'canopy', 'visor', 'hud',
]);

const LIGHT_GLASS_SUBS = ['lightglass', 'light_glass', 'headlight_glass', 'lens_glass', 'glass_light'];

const LIGHT_EMITTER_TOKENS = new Set([
  'headlight', 'headlights', 'taillight', 'taillights', 'emissive',
  'drl', 'led', 'leds', 'glow', 'glows', 'lamp', 'lamps', 'brakelight', 'turnsignal',
]);

const CARBON_TOKENS = new Set(['carbon', 'carbonfiber', 'cf', 'kevlar']);
const TIRE_TOKENS = new Set([
  'tire', 'tires', 'tyre', 'tyres', 'tyrewall', 'tyrewallblack', 'tirewall',
  'sidewall', 'rubber', 'gomma', 'tread', 'proxes',
]);
const RIM_TOKENS = new Set(['rim', 'rims', 'alloy', 'bbs', 'spoke', 'rotor', 'disc', 'diskbrake', 'caliper', 'calliper', 'exhaust', 'chrome']);
const INTERIOR_TOKENS = new Set([
  'interior', 'int', 'cockpit', 'seat', 'seats', 'belt', 'cinture', 'carpet',
  'steering', 'dashboard', 'dash', 'cab', 'cabin', 'alcantara', 'leather',
]);

const BODY_TOKENS = new Set([
  'body', 'carpaint', 'paint', 'exterior', 'hood', 'bonnet', 'door', 'doors',
  'fender', 'bumper', 'trunk', 'boot', 'roof', 'quarter', 'sidepanel',
  'monocoque', 'fuselage', 'livery', 'skin',
]);

// Body textures whose name marks them as a tint / instance mask (paint colour applied by the game engine).
const TINT_MASK_NAME_RE = /(^|[^a-z])(inst|instance|tint|tintable|mask)([^a-z]|$)/i;
const DEFAULT_FALLBACK_PAINT = '#8f9399';

// Per-texture greyscale analysis cache so shared textures are only sampled once.
const greyscaleCache = new WeakMap();

/**
 * True when a texture image is (almost) pure greyscale, i.e. an AO / tint mask that expects a paint
 * colour multiplied on top. Returns false whenever the image cannot be inspected (no DOM, compressed,
 * tainted) so a real livery is never recoloured by accident.
 */
export function isGreyscaleTexture(tex) {
  if (!tex || !tex.image || tex.isCompressedTexture || tex.isDataTexture) return false;
  if (greyscaleCache.has(tex)) return greyscaleCache.get(tex);
  let result = false;
  try {
    if (typeof document !== 'undefined') {
      const img = tex.image;
      const iw = img.width || img.videoWidth;
      const ih = img.height || img.videoHeight;
      if (iw && ih) {
        const S = 48;
        const c = document.createElement('canvas');
        c.width = S;
        c.height = S;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, S, S);
        const data = ctx.getImageData(0, 0, S, S).data;
        let colourful = 0;
        let counted = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 16) continue;
          counted++;
          const chroma = (Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2])) / 255;
          if (chroma > 0.08) colourful++;
        }
        result = counted > 0 && colourful / counted < 0.015;
      }
    }
  } catch (err) {
    result = false;
  }
  greyscaleCache.set(tex, result);
  return result;
}

/**
 * GLTFLoader assigns one shared default MeshStandardMaterial (white, metalness 1, roughness 1, no
 * name) to primitives that have no material. Under the bright studio IBL that renders as raw chrome.
 */
export function isGltfDefaultMaterial(mat) {
  return Boolean(
    mat &&
      mat.isMeshStandardMaterial &&
      !mat.isMeshPhysicalMaterial &&
      !mat.name &&
      !mat.map &&
      mat.metalness === 1 &&
      mat.roughness === 1 &&
      mat.color &&
      mat.color.r === 1 &&
      mat.color.g === 1 &&
      mat.color.b === 1
  );
}

/**
 * glTF base colour = baseColorFactor x baseColorTexture. Textured materials used to be forced to
 * #ffffff, discarding the factor, so e.g. the AMG One / Charger Daytona black paint (factor ~0 over a
 * white AO/flake texture) rendered white. Keep the factor as the tint.
 */
export function textureTint(mat) {
  return mat && mat.color ? mat.color.clone() : new THREE.Color('#ffffff');
}

export function colorLuminance(col) {
  return 0.2126 * col.r + 0.7152 * col.g + 0.0722 * col.b;
}

/**
 * Bright (white / silver) metallic paints mirror the white studio IBL and blow out to pure white.
 * Real paint is a dielectric clearcoat over metallic flake, so cap the base metalness and IBL gain
 * for light colours while leaving dark / saturated paints untouched.
 */
export function paintResponseFor(color, metalness) {
  const lum = colorLuminance(color);
  const srcMetal = metalness ?? 0.55;
  const base = Math.min(Math.max(srcMetal, 0.35), 0.72);
  if (lum > 0.45 && srcMetal >= 0.4) {
    // Silver / chrome-like paint: pull albedo down to a mid silver so the white cyc doesn't flatten it.
    return { metalness: Math.min(base, 0.6), roughness: 0.24, envMapIntensity: 0.8, colorScale: 0.22 / lum };
  }
  if (lum > 0.45) {
    // Solid white paint: stay white but stop clearcoat + IBL from clipping it.
    return { metalness: 0.08, roughness: 0.24, envMapIntensity: 0.85, colorScale: Math.min(1, 0.62 / lum) };
  }
  if (lum > 0.25) {
    return { metalness: Math.min(base, 0.5), roughness: 0.2, envMapIntensity: 1.25, colorScale: 1 };
  }
  return { metalness: base, roughness: 0.16, envMapIntensity: 1.6, colorScale: 1 };
}

/**
 * CarMaterialEnhancer:
 * Upgrades vehicle and aircraft GLB materials into physically accurate clearcoated PBR shaders
 * while strictly preserving embedded racing liveries, sponsor decal alpha layers, tire/wheel maps,
 * and optical glass transparency. Also attaches a real directional ShadowMaterial ground catcher
 * plus tight under-chassis/tire ambient occlusion contact shadows.
 */
export class CarMaterialEnhancer {
  constructor() {
    this.bodyMaterials = [];
    this.glassMaterials = [];
    this.wheelMaterials = [];
    this.lightMaterials = [];

    this.currentPaintColor = '#b91c1c';
    this.currentFinish = 'metallic'; // 'metallic' | 'matte' | 'candy' | 'carbon'
    this.customPaintActive = false;

    this.contactShadowMesh = null;
    this.directionalShadowMesh = null;
    this.underglowLight = null;
    this.headlightsActive = true;
    this.underglowActive = false; // Off by default for natural photorealism!
    this.underglowColor = '#00f5d4';

    // Per-subject hints (e.g. catalog `paintColor`) used when a model ships without paint colour.
    this.subjectHints = {};
  }

  /** Per-subject hints such as `{ paintColor: '#ff8000' }`, applied by the next enhance() call. */
  setSubjectHints(hints = {}) {
    this.subjectHints = hints || {};
  }

  _fallbackPaintColor() {
    return new THREE.Color(this.subjectHints.paintColor || DEFAULT_FALLBACK_PAINT);
  }

  /**
   * Copies PBR texture channels safely onto an upgraded material.
   */
  _copyMaps(src, dst) {
    if (!src || !dst) return;
    const mapKeys = [
      'map',
      'normalMap',
      'roughnessMap',
      'metalnessMap',
      'aoMap',
      'alphaMap',
      'emissiveMap',
      'bumpMap',
    ];
    for (const k of mapKeys) {
      if (src[k]) {
        dst[k] = src[k];
      }
    }
    if (src.normalScale && dst.normalScale) {
      dst.normalScale.copy(src.normalScale);
    }
    if (src.map && src.map.colorSpace !== THREE.SRGBColorSpace) {
      src.map.colorSpace = THREE.SRGBColorSpace;
      src.map.needsUpdate = true;
    }
    if (src.emissiveMap && src.emissiveMap.colorSpace !== THREE.SRGBColorSpace) {
      src.emissiveMap.colorSpace = THREE.SRGBColorSpace;
      src.emissiveMap.needsUpdate = true;
    }
    if (src.vertexColors) {
      dst.vertexColors = true;
    }
    dst.side = src.side ?? THREE.FrontSide;
  }

  /**
   * Scans and enhances every material in the loaded vehicle, aircraft, or part model.
   */
  enhance(rootGroup, mode = 'cars', bounds = { w: 2.1, h: 1.3, d: 4.8 }) {
    // Re-entering an already enhanced (cached) subject: re-bind the stored material groups instead of
    // upgrading the upgraded materials again (that leaked a new set of GPU materials on every car
    // switch and dropped body-paint bindings because upgraded materials had no names).
    const stored = rootGroup.userData?.carPaintEnhancerState;
    if (stored) {
      this.bodyMaterials = stored.bodyMaterials;
      this.glassMaterials = stored.glassMaterials;
      this.wheelMaterials = stored.wheelMaterials;
      this.lightMaterials = stored.lightMaterials;
      this.customPaintActive = false;
      this.resetFactoryPaint();
      this.setHeadlights(this.headlightsActive);
      this.createContactShadow(rootGroup, bounds, mode);
      this.createUnderglow(rootGroup, bounds, mode);
      return;
    }

    this.bodyMaterials = [];
    this.glassMaterials = [];
    this.wheelMaterials = [];
    this.lightMaterials = [];
    this.customPaintActive = false;

    // One upgraded material per (source material, classification) instead of one per mesh.
    // e.g. the Honda S2000 reuses one wheel material on 1,100+ meshes.
    const upgradeMemo = new Map();
    const replacedOriginals = new Set();

    rootGroup.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;

      const meshName = (child.name || '').toLowerCase();
      const parentName = (child.parent?.name || '').toLowerCase();
      const mats = Array.isArray(child.material) ? child.material : [child.material];

      const upgradeOne = (mat, combined) => {
        // Handle meshes exported with null material slots, and primitives that GLTFLoader gave its
        // shared white metalness=1 default material (no material in the GLB at all).
        if (!mat || isGltfDefaultMaterial(mat)) {
          if (hasAnyToken(combined, GLASS_TOKENS) || hasSubstring(combined, LIGHT_GLASS_SUBS)) {
            const gm = new THREE.MeshPhysicalMaterial({
              color: new THREE.Color('#0f172a'),
              roughness: 0.03,
              metalness: 0.05,
              transmission: 0.82,
              ior: 1.52,
              transparent: true,
              opacity: 0.36,
              envMapIntensity: 2.2,
              depthWrite: false,
            });
            this.glassMaterials.push(gm);
            return gm;
          }
          if (hasAnyToken(combined, TIRE_TOKENS)) {
            return new THREE.MeshStandardMaterial({
              color: new THREE.Color('#141619'),
              roughness: 0.85,
              metalness: 0.04,
            });
          }
          if (hasAnyToken(combined, RIM_TOKENS) || (combined.includes('wheel') && !combined.includes('steering'))) {
            const isCaliper = combined.includes('caliper') || combined.includes('calliper');
            return new THREE.MeshStandardMaterial({
              color: isCaliper ? new THREE.Color('#dc2626') : new THREE.Color('#cbd5e1'),
              metalness: isCaliper ? 0.45 : 0.88,
              roughness: isCaliper ? 0.2 : 0.16,
              envMapIntensity: 2.0,
            });
          }
          if (hasAnyToken(combined, LIGHT_EMITTER_TOKENS)) {
            const isRear = combined.includes('rear') || combined.includes('tail') || combined.includes('back');
            const lightCol = isRear ? new THREE.Color('#dc2626') : new THREE.Color('#f8fafc');
            const lm = new THREE.MeshStandardMaterial({
              color: lightCol,
              emissive: lightCol,
              emissiveIntensity: this.headlightsActive ? (isRear ? 1.1 : 1.3) : 0.0,
              roughness: 0.15,
              metalness: 0.1,
            });
            this.lightMaterials.push({ mat: lm, isRear, color: lightCol });
            return lm;
          }
          if (hasAnyToken(combined, CARBON_TOKENS) || combined.includes('plastic') || combined.includes('grill') || combined.includes('details')) {
            return new THREE.MeshPhysicalMaterial({
              color: new THREE.Color('#181b20'),
              roughness: 0.32,
              metalness: 0.2,
              clearcoat: 0.5,
              clearcoatRoughness: 0.15,
            });
          }
          const origCol = this._fallbackPaintColor();
          const resp = paintResponseFor(origCol, 0.55);
          origCol.multiplyScalar(resp.colorScale);
          const defaultBody = new THREE.MeshPhysicalMaterial({
            color: origCol.clone(),
            roughness: resp.roughness,
            metalness: resp.metalness,
            clearcoat: 1.0,
            clearcoatRoughness: 0.04,
            envMapIntensity: resp.envMapIntensity,
          });
          this.bodyMaterials.push({
            origMat: null,
            origColor: origCol,
            origMap: null,
            origMetalness: resp.metalness,
            origRoughness: resp.roughness,
            hasLiveryTexture: false,
            paintMat: defaultBody,
          });
          return defaultBody;
        }

        const isAlphaOverlay =
          Boolean(mat.transparent && mat.opacity < 0.999) ||
          Boolean(mat.transparent && mat.map) ||
          mat.alphaTest > 0 ||
          Boolean(mat.alphaMap);

        // 0. TRANSPARENT DECALS / SPONSOR STICKERS / BADGES (MUST preserve alpha & never be overwritten by paint!)
        if (
          hasAnyToken(combined, DECAL_TOKENS) ||
          (isAlphaOverlay &&
            !hasAnyToken(combined, GLASS_TOKENS) &&
            !hasSubstring(combined, LIGHT_GLASS_SUBS))
        ) {
          const decalMat = new THREE.MeshPhysicalMaterial({
            color: mat.color ? mat.color.clone() : new THREE.Color('#ffffff'),
            roughness: Math.min(mat.roughness ?? 0.2, 0.25),
            metalness: Math.min(mat.metalness ?? 0.08, 0.2),
            clearcoat: 0.9,
            clearcoatRoughness: 0.05,
            transparent: Boolean(mat.transparent || mat.alphaMap),
            opacity: mat.opacity ?? 1.0,
            alphaTest: mat.alphaTest ?? 0,
            depthWrite: mat.alphaTest > 0 ? true : false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
            envMapIntensity: 1.5,
          });
          this._copyMaps(mat, decalMat);
          child.castShadow = false; // Transparent decal sheets shouldn't cast double-shadows onto body
          return decalMat;
        }

        // 1. OPTICAL GLASS, WINDSHIELDS, CANOPIES & CLEAR HEADLIGHT COVERS
        if (
          hasSubstring(combined, LIGHT_GLASS_SUBS) ||
          (hasAnyToken(combined, GLASS_TOKENS) && !hasAnyToken(combined, INTERIOR_TOKENS))
        ) {
          // If textured windshield banner / HUD / baked window frame map exists, preserve its map!
          if (mat.map) {
            const texGlass = new THREE.MeshPhysicalMaterial({
              color: mat.color ? mat.color.clone() : new THREE.Color('#ffffff'),
              roughness: 0.05,
              metalness: 0.1,
              clearcoat: 1.0,
              clearcoatRoughness: 0.02,
              transparent: true,
              opacity: mat.transparent ? Math.max(0.42, mat.opacity ?? 0.65) : 0.72,
              envMapIntensity: 2.2,
              depthWrite: false,
            });
            this._copyMaps(mat, texGlass);
            this.glassMaterials.push(texGlass);
            return texGlass;
          }

          const glassMat = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color('#0b1322'),
            roughness: 0.03,
            metalness: 0.08,
            transmission: 0.78,
            ior: 1.52,
            transparent: true,
            opacity: 0.42,
            envMapIntensity: 2.4,
            depthWrite: false,
          });
          this.glassMaterials.push(glassMat);
          return glassMat;
        }

        // 2. HEADLIGHTS, TAILLIGHTS, DRLs & EMISSIVES (only genuine light emitters, never 'flight'!)
        const hasExistingEmissive =
          Boolean(mat.emissiveMap) ||
          (mat.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b > 0.15));

        if (
          mode !== 'planes' &&
          (hasAnyToken(combined, LIGHT_EMITTER_TOKENS) || hasExistingEmissive) &&
          !hasAnyToken(combined, INTERIOR_TOKENS)
        ) {
          const isRear =
            combined.includes('rear') ||
            combined.includes('tail') ||
            combined.includes('brake') ||
            combined.includes('stop') ||
            combined.includes('red');
          const defaultCol = isRear ? new THREE.Color('#dc2626') : new THREE.Color('#f8fafc');
          const baseCol = mat.map ? textureTint(mat) : (mat.color ? mat.color.clone() : defaultCol);
          const emitCol = mat.emissiveMap
            ? new THREE.Color('#ffffff')
            : isRear
            ? new THREE.Color('#ef4444')
            : new THREE.Color('#f8fafc');

          const lightMat = new THREE.MeshPhysicalMaterial({
            color: baseCol,
            emissive: emitCol,
            emissiveIntensity: this.headlightsActive ? (isRear ? 0.95 : 1.1) : 0.0,
            roughness: 0.12,
            metalness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.03,
            envMapIntensity: 1.8,
          });
          this._copyMaps(mat, lightMat);
          this.lightMaterials.push({ mat: lightMat, isRear, color: emitCol });
          return lightMat;
        }

        // 3. INTERIOR / COCKPIT / STEERING WHEEL (preserve authentic dark cabin materials)
        if (hasAnyToken(combined, INTERIOR_TOKENS)) {
          if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
            mat.envMapIntensity = 0.65;
            if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
          }
          return mat;
        }

        // 4. CARBON FIBER / SPLITTER / DIFFUSER
        if (
          hasAnyToken(combined, CARBON_TOKENS) ||
          combined.includes('diffuser') ||
          combined.includes('splitter')
        ) {
          const carbonMat = new THREE.MeshPhysicalMaterial({
            color: mat.map ? textureTint(mat) : new THREE.Color('#16191f'),
            roughness: mat.roughnessMap ? (mat.roughness ?? 0.24) : 0.22,
            metalness: 0.22,
            clearcoat: 0.85,
            clearcoatRoughness: 0.1,
            envMapIntensity: 1.6,
          });
          this._copyMaps(mat, carbonMat);
          return carbonMat;
        }

        // 5. TIRES & RUBBER TREADS (preserve Toyo/Pirelli/Michelin sidewall textures!)
        if (hasAnyToken(combined, TIRE_TOKENS)) {
          const tireMat = new THREE.MeshStandardMaterial({
            color: mat.map ? textureTint(mat) : new THREE.Color('#14161a'),
            roughness: mat.roughnessMap ? Math.max(0.65, mat.roughness ?? 0.85) : 0.84,
            metalness: 0.04,
            envMapIntensity: 0.55,
          });
          this._copyMaps(mat, tireMat);
          return tireMat;
        }

        // 6. RIMS, BRAKE ROTORS, CALIPERS & EXHAUST TIPS (preserve BBS/forged wheel textures!)
        if (
          hasAnyToken(combined, RIM_TOKENS) ||
          (combined.includes('wheel') && !combined.includes('steering'))
        ) {
          const isCaliper = combined.includes('caliper') || combined.includes('calliper');
          // If wheel has a texture map (often combined wheel + tire sidewall or center cap), preserve its map!
          if (mat.map) {
            const texRim = new THREE.MeshPhysicalMaterial({
              color: textureTint(mat),
              metalness: mat.metalnessMap ? (mat.metalness ?? 0.6) : 0.45,
              roughness: mat.roughnessMap ? (mat.roughness ?? 0.28) : 0.26,
              clearcoat: 0.6,
              clearcoatRoughness: 0.12,
              envMapIntensity: 1.7,
            });
            this._copyMaps(mat, texRim);
            this.wheelMaterials.push(texRim);
            return texRim;
          }

          const rimMat = new THREE.MeshStandardMaterial({
            color: isCaliper
              ? (mat.color ? mat.color.clone() : new THREE.Color('#dc2626'))
              : (mat.color && (mat.color.r + mat.color.g + mat.color.b > 0.12)
                  ? mat.color.clone()
                  : new THREE.Color('#cbd5e1')),
            metalness: isCaliper ? 0.45 : 0.88,
            roughness: isCaliper ? 0.18 : 0.15,
            envMapIntensity: 2.1,
          });
          this._copyMaps(mat, rimMat);
          this.wheelMaterials.push(rimMat);
          return rimMat;
        }

        // 7. EXTERIOR AUTOMOTIVE / AIRCRAFT PAINT & RACING LIVERIES
        const isBodyCandidate =
          hasAnyToken(combined, BODY_TOKENS) ||
          (mode === 'cars' &&
            (combined.includes('paint') ||
              combined.includes('shell') ||
              combined.includes('chass') ||
              combined.includes('template_icon') ||
              combined.includes('amr26') ||
              combined.includes('a525') ||
              combined.includes('r26') ||
              combined.includes('f40') ||
              combined.includes('gt3') ||
              combined.includes('kop_body')));

        if (isBodyCandidate) {
          // Greyscale "instance"/tint masks (e.g. ACC exports' EXT_Carpaint_Inst) carry only AO/panel
          // shading; the game multiplies a paint colour on top. Rendering them with #ffffff gave pure
          // white cars, so tint them with the catalog paint colour instead.
          const isTintMask =
            Boolean(mode === 'cars' && mat.map) &&
            (TINT_MASK_NAME_RE.test(mat.name || '') || Boolean(this.subjectHints.paintColor)) &&
            isGreyscaleTexture(mat.map);
          const hasLivery = Boolean(mat.map) && !isTintMask;
          // Untextured body paint (the AMG One shell is literally CarPaint_Metallic_White with no
          // factor) should take the catalog paint colour when one is provided, rather than staying
          // at the glTF default of white.
          const origColor = isTintMask
            ? this._fallbackPaintColor()
            : hasLivery
            ? textureTint(mat)
            : this.subjectHints.paintColor
            ? this._fallbackPaintColor()
            : mat.color
            ? mat.color.clone()
            : new THREE.Color('#b91c1c');
          const resp = paintResponseFor(origColor, mat.metalness);
          if (!hasLivery) origColor.multiplyScalar(resp.colorScale);

          // CRITICAL FIX FOR LIVERIES & PAINT:
          // Textured racing liveries use dielectric basecoat (low metalness ~0.12) + 1.0 physical clearcoat
          // so 100% of diffuse colors, stripes, and sponsor logos render vividly instead of turning dark chrome!
          const origMetalness = hasLivery
            ? (mat.metalnessMap ? Math.min(mat.metalness ?? 0.35, 0.45) : 0.12)
            : resp.metalness;
          const origRoughness = hasLivery
            ? (mat.roughnessMap ? Math.min(mat.roughness ?? 0.28, 0.38) : 0.18)
            : resp.roughness;

          const paintMat = new THREE.MeshPhysicalMaterial({
            color: origColor.clone(),
            metalness: origMetalness,
            roughness: origRoughness,
            clearcoat: mode === 'planes' ? 0.75 : 1.0,
            clearcoatRoughness: mode === 'planes' ? 0.08 : 0.04,
            ior: 1.5,
            envMapIntensity: mode === 'planes' ? 1.45 : hasLivery ? 1.5 : resp.envMapIntensity,
          });
          this._copyMaps(mat, paintMat);

          this.bodyMaterials.push({
            origMat: mat,
            origColor: origColor.clone(),
            origMap: mat.map || null,
            origMetalness,
            origRoughness,
            hasLiveryTexture: hasLivery,
            paintMat,
          });
          return paintMat;
        }

        // 8. DEFAULT PRESERVATION: Keep original textures & colors crisp, never crush albedo!
        if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
          if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            // Prevent unmapped metallic=1.0 exports from turning diffuse textures black
            if (!mat.metalnessMap && mat.metalness > 0.55) {
              mat.metalness = 0.18;
            }
          }
          mat.envMapIntensity = mode === 'planes' ? 1.35 : 1.55;
        }
        return mat;
      };

      const upgradedMats = mats.map((mat) => {
        const matName = (mat?.name || '').toLowerCase();
        const combined = `${parentName} ${meshName} ${matName}`;
        if (!mat) return upgradeOne(mat, combined);
        const signature = [
          hasAnyToken(combined, DECAL_TOKENS),
          hasAnyToken(combined, GLASS_TOKENS),
          hasSubstring(combined, LIGHT_GLASS_SUBS),
          hasAnyToken(combined, LIGHT_EMITTER_TOKENS),
          hasAnyToken(combined, INTERIOR_TOKENS),
          hasAnyToken(combined, CARBON_TOKENS),
          /diffuser|splitter|plastic|grill|details/.test(combined),
          hasAnyToken(combined, TIRE_TOKENS),
          hasAnyToken(combined, RIM_TOKENS),
          combined.includes('wheel') && !combined.includes('steering'),
          /caliper|calliper/.test(combined),
          /rear|tail|brake|stop|red|back/.test(combined),
          hasAnyToken(combined, BODY_TOKENS),
          /paint|shell|chass|template_icon|amr26|a525|r26|f40|gt3|kop_body/.test(combined),
        ]
          .map((b) => (b ? 1 : 0))
          .join('');
        const key = `${mat.uuid}|${signature}`;
        if (upgradeMemo.has(key)) return upgradeMemo.get(key);
        const out = upgradeOne(mat, combined);
        if (out !== mat) {
          if (!out.name) out.name = mat.name || '';
          out.userData = { ...out.userData, carPaintEnhanced: true, sourceMaterialName: mat.name || '' };
          replacedOriginals.add(mat);
        }
        upgradeMemo.set(key, out);
        return out;
      });

      child.material = Array.isArray(child.material) ? upgradedMats : upgradedMats[0];
    });

    // Free original materials that no mesh references any more (their textures were moved onto the
    // upgraded materials, so only the material/program side is released here).
    if (replacedOriginals.size) {
      const stillUsed = new Set();
      rootGroup.traverse((c) => {
        if (!c.isMesh || !c.material) return;
        (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => m && stillUsed.add(m));
      });
      replacedOriginals.forEach((m) => {
        if (!stillUsed.has(m)) m.dispose();
      });
    }

    rootGroup.userData.carPaintEnhancerState = {
      bodyMaterials: this.bodyMaterials,
      glassMaterials: this.glassMaterials,
      wheelMaterials: this.wheelMaterials,
      lightMaterials: this.lightMaterials,
    };

    // Ground contact shadows + real directional shadow-catcher
    this.createContactShadow(rootGroup, bounds, mode);

    // Subtle optional underglow (OFF by default)
    this.createUnderglow(rootGroup, bounds, mode);
  }

  /**
   * Creates:
   * 1) A real THREE.ShadowMaterial ground shadow-catcher so directional sun/streetlights cast
   *    accurate vehicle silhouettes even onto unlit photogrammetry streets (LA Night, Vatican, etc.)
   * 2) A tight, realistic under-chassis & 4-wheel ambient occlusion contact shadow
   */
  createContactShadow(rootGroup, bounds, mode) {
    if (this.contactShadowMesh) {
      this.contactShadowMesh.removeFromParent();
      this.contactShadowMesh.geometry.dispose();
      this.contactShadowMesh.material.dispose();
      this.contactShadowMesh = null;
    }
    if (this.directionalShadowMesh) {
      this.directionalShadowMesh.removeFromParent();
      this.directionalShadowMesh.geometry.dispose();
      this.directionalShadowMesh.material.dispose();
      this.directionalShadowMesh = null;
    }

    // 1. Real Directional Shadow-Catcher Disc
    const catcherRadius = Math.max(bounds.w, bounds.d) * 1.65;
    const catcherGeo = new THREE.CircleGeometry(catcherRadius, 48);
    const catcherMat = new THREE.ShadowMaterial({
      opacity: 0.44,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -6,
    });
    this.directionalShadowMesh = new THREE.Mesh(catcherGeo, catcherMat);
    this.directionalShadowMesh.name = 'VehicleDirectionalShadowCatcher';
    this.directionalShadowMesh.rotation.x = -Math.PI / 2;
    this.directionalShadowMesh.position.set(0, 0.006, 0);
    this.directionalShadowMesh.receiveShadow = true;
    this.directionalShadowMesh.renderOrder = 0;
    rootGroup.add(this.directionalShadowMesh);

    // 2. Soft Under-Chassis & Tire Contact AO Shadow
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    const cx = 256;
    const cy = 256;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(0.68, 0.94);
    const grad = ctx.createRadialGradient(0, 0, 24, 0, 0, 220);
    grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.88)');
    grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.68)');
    grad.addColorStop(0.75, 'rgba(0, 0, 0, 0.22)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 220, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (mode === 'cars') {
      const tireOffsets = [
        { x: cx - 118, y: cy - 142 },
        { x: cx + 118, y: cy - 142 },
        { x: cx - 120, y: cy + 142 },
        { x: cx + 120, y: cy + 142 },
      ];
      tireOffsets.forEach((pt) => {
        const tGrad = ctx.createRadialGradient(pt.x, pt.y, 4, pt.x, pt.y, 42);
        tGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.95)');
        tGrad.addColorStop(0.45, 'rgba(0, 0, 0, 0.55)');
        tGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, 24, 40, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const shadowGeo = new THREE.PlaneGeometry(bounds.w * 1.24, bounds.d * 1.18);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: mode === 'planes' ? 0.55 : 0.78,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -8,
    });

    this.contactShadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadowMesh.name = 'VehicleContactAOShadow';
    this.contactShadowMesh.rotation.x = -Math.PI / 2;
    this.contactShadowMesh.position.set(0, 0.009, 0);
    this.contactShadowMesh.renderOrder = 1;
    rootGroup.add(this.contactShadowMesh);
  }

  setGroundContactVisible(visible, shadowOpacity = 0.44) {
    if (this.contactShadowMesh) {
      this.contactShadowMesh.visible = visible;
    }
    if (this.directionalShadowMesh) {
      this.directionalShadowMesh.visible = visible;
      this.directionalShadowMesh.material.opacity = shadowOpacity;
    }
  }

  createUnderglow(rootGroup, bounds, mode) {
    if (this.underglowLight) {
      this.underglowLight.removeFromParent();
      this.underglowLight = null;
    }

    if (mode === 'planes' || mode === 'parts') return;

    const group = new THREE.Group();
    group.name = 'ChassisUnderglowGroup';

    const col = new THREE.Color(this.underglowColor);
    const positions = [
      [0, 0.12, bounds.d * 0.22],
      [0, 0.12, -bounds.d * 0.22],
      [bounds.w * 0.38, 0.12, 0],
      [-bounds.w * 0.38, 0.12, 0],
    ];

    positions.forEach((pos) => {
      const p = new THREE.PointLight(col, 1.2, 3.2, 2.0);
      p.position.set(pos[0], pos[1], pos[2]);
      group.add(p);
    });

    this.underglowLight = group;
    this.underglowLight.visible = this.underglowActive;
    rootGroup.add(group);
  }

  /**
   * Customizes car body paint color in real-time (user-triggered).
   */
  setPaintColor(hex) {
    this.currentPaintColor = hex;
    this.customPaintActive = true;
    const col = new THREE.Color(hex);

    this.bodyMaterials.forEach(({ paintMat }) => {
      paintMat.color.copy(col);
      paintMat.map = null;
      paintMat.metalness = this.currentFinish === 'matte' ? 0.15 : 0.62;
      paintMat.roughness = this.currentFinish === 'matte' ? 0.42 : 0.15;
      paintMat.needsUpdate = true;
    });
  }

  /**
   * Restores the original factory paint / racing livery textures!
   */
  resetFactoryPaint() {
    this.customPaintActive = false;
    this.bodyMaterials.forEach(({ origColor, origMap, origMetalness, origRoughness, paintMat }) => {
      paintMat.color.copy(origColor);
      paintMat.map = origMap;
      paintMat.metalness = origMetalness;
      paintMat.roughness = origRoughness;
      paintMat.clearcoat = 1.0;
      paintMat.clearcoatRoughness = 0.04;
      paintMat.needsUpdate = true;
    });
  }

  setPaintFinish(finish) {
    this.currentFinish = finish;
    this.bodyMaterials.forEach(({ hasLiveryTexture, origMetalness, paintMat }) => {
      const keepDielectric = hasLiveryTexture && !this.customPaintActive;
      if (finish === 'matte') {
        paintMat.clearcoat = 0.05;
        paintMat.roughness = 0.44;
        paintMat.metalness = keepDielectric ? 0.08 : 0.15;
      } else if (finish === 'candy') {
        paintMat.clearcoat = 1.0;
        paintMat.clearcoatRoughness = 0.01;
        paintMat.roughness = 0.08;
        paintMat.metalness = keepDielectric ? 0.18 : 0.78;
      } else if (finish === 'carbon') {
        if (!keepDielectric) {
          paintMat.color.set('#14171d');
        }
        paintMat.clearcoat = 0.8;
        paintMat.roughness = 0.26;
        paintMat.metalness = 0.25;
      } else {
        // 'metallic'
        paintMat.clearcoat = 1.0;
        paintMat.clearcoatRoughness = 0.04;
        paintMat.roughness = 0.16;
        paintMat.metalness = keepDielectric ? origMetalness : 0.62;
      }
      paintMat.needsUpdate = true;
    });
  }

  setHeadlights(enabled) {
    this.headlightsActive = enabled;
    this.lightMaterials.forEach(({ mat, isRear }) => {
      mat.emissiveIntensity = enabled ? (isRear ? 0.95 : 1.1) : 0.0;
    });
  }

  setUnderglow(enabled, colorHex) {
    this.underglowActive = enabled;
    if (colorHex) this.underglowColor = colorHex;
    if (this.underglowLight) {
      this.underglowLight.visible = enabled;
      const col = new THREE.Color(this.underglowColor);
      this.underglowLight.traverse((child) => {
        if (child.isPointLight) child.color.copy(col);
        if (child.isMesh && child.material) child.material.color.copy(col);
      });
    }
  }
}

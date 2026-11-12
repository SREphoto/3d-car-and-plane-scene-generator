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
    if (src.map) {
      src.map.colorSpace = THREE.SRGBColorSpace;
    }
    if (src.emissiveMap) {
      src.emissiveMap.colorSpace = THREE.SRGBColorSpace;
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
    this.bodyMaterials = [];
    this.glassMaterials = [];
    this.wheelMaterials = [];
    this.lightMaterials = [];
    this.customPaintActive = false;

    rootGroup.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;

      const meshName = (child.name || '').toLowerCase();
      const parentName = (child.parent?.name || '').toLowerCase();
      const mats = Array.isArray(child.material) ? child.material : [child.material];

      const upgradedMats = mats.map((mat) => {
        const matName = (mat?.name || '').toLowerCase();
        const combined = `${parentName} ${meshName} ${matName}`;

        // Handle meshes exported with null material slots
        if (!mat) {
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
          const origCol = new THREE.Color('#cbd5e1');
          const defaultBody = new THREE.MeshPhysicalMaterial({
            color: origCol.clone(),
            roughness: 0.18,
            metalness: 0.55,
            clearcoat: 1.0,
            clearcoatRoughness: 0.04,
            envMapIntensity: 1.8,
          });
          this.bodyMaterials.push({
            origMat: null,
            origColor: origCol,
            origMap: null,
            origMetalness: 0.55,
            origRoughness: 0.18,
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
          const baseCol = mat.map ? new THREE.Color('#ffffff') : (mat.color ? mat.color.clone() : defaultCol);
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
            color: mat.map ? new THREE.Color('#ffffff') : new THREE.Color('#16191f'),
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
            color: mat.map ? new THREE.Color('#ffffff') : new THREE.Color('#14161a'),
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
              color: new THREE.Color('#ffffff'),
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
          const hasLivery = Boolean(mat.map);
          const origColor = hasLivery
            ? new THREE.Color('#ffffff')
            : mat.color
            ? mat.color.clone()
            : new THREE.Color('#b91c1c');

          // CRITICAL FIX FOR LIVERIES & PAINT:
          // Textured racing liveries use dielectric basecoat (low metalness ~0.12) + 1.0 physical clearcoat
          // so 100% of diffuse colors, stripes, and sponsor logos render vividly instead of turning dark chrome!
          const origMetalness = hasLivery
            ? (mat.metalnessMap ? Math.min(mat.metalness ?? 0.35, 0.45) : 0.12)
            : Math.min(Math.max(mat.metalness ?? 0.55, 0.35), 0.72);
          const origRoughness = hasLivery
            ? (mat.roughnessMap ? Math.min(mat.roughness ?? 0.28, 0.38) : 0.18)
            : 0.16;

          const paintMat = new THREE.MeshPhysicalMaterial({
            color: origColor.clone(),
            metalness: origMetalness,
            roughness: origRoughness,
            clearcoat: mode === 'planes' ? 0.75 : 1.0,
            clearcoatRoughness: mode === 'planes' ? 0.08 : 0.04,
            ior: 1.5,
            envMapIntensity: mode === 'planes' ? 1.45 : 1.85,
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
      });

      child.material = Array.isArray(child.material) ? upgradedMats : upgradedMats[0];
    });

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

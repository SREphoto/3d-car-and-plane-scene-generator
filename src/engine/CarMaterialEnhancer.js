import * as THREE from 'three';

/**
 * CarMaterialEnhancer:
 * Transforms flat, low-poly, chalky GLB exports into AAA photorealistic automotive studio materials:
 * - Upgrades body paint to MeshPhysicalMaterial with wet clearcoat, metallic flakes, and deep reflections
 * - Upgrades glass to optical automotive glass with transmission, refraction, and tint
 * - Upgrades alloy rims to mirror-forged chrome/satin aluminum
 * - Upgrades tires to rich carbon-black matte rubber
 * - Upgrades carbon fiber components to gloss clearcoat carbon weave
 * - Upgrades lights/DRLs to glowing HDR emissives
 * - Injects high-resolution soft contact shadows directly beneath the wheels & chassis
 * - Projects forward headlight beams onto the road/floor
 * - Projects chassis underglow neon onto the floor
 */
export class CarMaterialEnhancer {
  constructor() {
    this.bodyMaterials = [];
    this.glassMaterials = [];
    this.wheelMaterials = [];
    this.lightMaterials = [];

    this.currentPaintColor = '#b91c1c'; // Default Rosso Corsa
    this.currentFinish = 'metallic'; // 'metallic', 'matte', 'candy', 'carbon'
    this.customPaintActive = false;

    this.contactShadowMesh = null;
    this.headlightProjectors = null;
    this.underglowLight = null;
    this.headlightsActive = true;
    this.underglowActive = true;
    this.underglowColor = '#00f5d4'; // Cyan neon
  }

  /**
   * Scans and enhances every material in the loaded vehicle or plane model.
   */
  enhance(rootGroup, mode = 'cars', bounds = { w: 2.1, h: 1.3, d: 4.8 }) {
    this.bodyMaterials = [];
    this.glassMaterials = [];
    this.wheelMaterials = [];
    this.lightMaterials = [];

    rootGroup.traverse((child) => {
      if (!child.isMesh) return;

      child.castShadow = true;
      child.receiveShadow = true;

      const meshName = (child.name || '').toLowerCase();
      const mats = Array.isArray(child.material) ? child.material : [child.material];

      const upgradedMats = mats.map((mat) => {
        if (!mat) return mat;
        const matName = (mat.name || '').toLowerCase();
        const combined = `${meshName} ${matName}`;

        // 1. GLASS & WINDSHIELDS
        if (
          combined.includes('glass') ||
          combined.includes('window') ||
          combined.includes('windshield') ||
          combined.includes('cockpit') ||
          combined.includes('vitre')
        ) {
          const glassMat = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color('#0f172a'),
            roughness: 0.02,
            metalness: 0.1,
            transmission: 0.82,
            ior: 1.52,
            transparent: true,
            opacity: 0.38,
            envMapIntensity: 3.2,
            depthWrite: false,
          });
          this.glassMaterials.push(glassMat);
          return glassMat;
        }

        // 2. LIGHTS, HEADLIGHTS, TAILLIGHTS, DRLs
        if (
          combined.includes('light') ||
          combined.includes('lamp') ||
          combined.includes('headlight') ||
          combined.includes('taillight') ||
          combined.includes('emissive') ||
          combined.includes('led') ||
          combined.includes('lens')
        ) {
          const isRear = combined.includes('rear') || combined.includes('tail') || combined.includes('third');
          const lightCol = isRear ? new THREE.Color('#ff0033') : new THREE.Color('#f8fafc');

          const lightMat = new THREE.MeshStandardMaterial({
            color: lightCol,
            emissive: lightCol,
            emissiveIntensity: 3.6,
            roughness: 0.1,
            metalness: 0.2,
          });
          this.lightMaterials.push({ mat: lightMat, isRear });
          return lightMat;
        }

        // 3. CARBON FIBER COMPONENTS
        if (combined.includes('carbon') || combined.includes('cf') || combined.includes('diffuser') || combined.includes('splitter')) {
          const carbonMat = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color('#14171c'),
            roughness: 0.2,
            metalness: 0.25,
            clearcoat: 0.85,
            clearcoatRoughness: 0.12,
            envMapIntensity: 2.2,
          });
          if (mat.map) carbonMat.map = mat.map;
          return carbonMat;
        }

        // 4. TIRES / RUBBER
        if (combined.includes('tyre') || combined.includes('tire') || combined.includes('rubber')) {
          const tireMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color('#101216'),
            roughness: 0.86,
            metalness: 0.04,
          });
          if (mat.map) tireMat.map = mat.map;
          return tireMat;
        }

        // 5. WHEELS, RIMS, BRAKE ROTORS, CHROME EXHAUSTS
        if (
          combined.includes('wheel') ||
          combined.includes('rim') ||
          combined.includes('rotor') ||
          combined.includes('disc') ||
          combined.includes('caliper') ||
          combined.includes('exhaust') ||
          combined.includes('chrome')
        ) {
          const isCaliper = combined.includes('caliper');
          const rimMat = new THREE.MeshStandardMaterial({
            color: isCaliper ? new THREE.Color('#dc2626') : new THREE.Color('#e2e8f0'),
            metalness: isCaliper ? 0.45 : 0.96,
            roughness: isCaliper ? 0.15 : 0.08,
            envMapIntensity: 3.5,
          });
          this.wheelMaterials.push(rimMat);
          return rimMat;
        }

        // 6. EXTERIOR BODY PAINT / CHASSIS / LIVERY
        if (
          mode === 'cars' &&
          (combined.includes('chassis') ||
            combined.includes('paint') ||
            combined.includes('body') ||
            combined.includes('exterior') ||
            combined.includes('carpaint') ||
            combined.includes('base') ||
            combined.includes('ext') ||
            combined.includes('hood') ||
            combined.includes('door') ||
            combined.includes('trunk') ||
            combined.includes('wing') ||
            combined.includes('amr26') ||
            combined.includes('a525') ||
            combined.includes('f40') ||
            combined.includes('gt3'))
        ) {
          const paintMat = new THREE.MeshPhysicalMaterial({
            color: mat.color ? mat.color.clone() : new THREE.Color('#b91c1c'),
            metalness: 0.82,
            roughness: 0.12,
            clearcoat: 1.0,
            clearcoatRoughness: 0.03,
            reflectivity: 0.9,
            envMapIntensity: 2.8,
          });
          if (mat.map) {
            paintMat.map = mat.map;
            // For textured liveries (F1, GT3 sponsors), keep base map while imparting high-gloss clearcoat
            paintMat.color = new THREE.Color('#ffffff');
          }
          this.bodyMaterials.push({ origMat: mat, paintMat });
          return paintMat;
        }

        // Default fallback: ensure material has rich environment reflections
        if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
          mat.envMapIntensity = 2.0;
          if (mat.roughness > 0.45) mat.roughness = 0.35;
        }
        return mat;
      });

      child.material = Array.isArray(child.material) ? upgradedMats : upgradedMats[0];
    });

    // Create high-resolution soft contact shadow directly under wheels & chassis
    this.createContactShadow(rootGroup, bounds, mode);

    // Create active forward headlight projectors & underglow
    this.createHeadlightProjectors(rootGroup, bounds, mode);
    this.createUnderglow(rootGroup, bounds, mode);
  }

  /**
   * Generates a 1024x1024 soft blurred ambient occlusion contact shadow plane
   * anchored directly beneath the vehicle at Y = 0.002
   */
  createContactShadow(rootGroup, bounds, mode) {
    if (this.contactShadowMesh) {
      this.contactShadowMesh.removeFromParent();
      this.contactShadowMesh.geometry.dispose();
      this.contactShadowMesh.material.dispose();
      this.contactShadowMesh = null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Soft chassis shadow gradient
    const cx = 512;
    const cy = 512;
    const grad = ctx.createRadialGradient(cx, cy, 60, cx, cy, 460);
    grad.addColorStop(0.0, 'rgba(0, 0, 0, 0.95)');
    grad.addColorStop(0.35, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.45)');
    grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.15)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 340, 480, 0, 0, Math.PI * 2);
    ctx.fill();

    // Four intensified contact patches for the 4 tires
    if (mode === 'cars') {
      const tireOffsets = [
        { x: cx - 220, y: cy - 280 },
        { x: cx + 220, y: cy - 280 },
        { x: cx - 230, y: cy + 280 },
        { x: cx + 230, y: cy + 280 },
      ];
      tireOffsets.forEach((pt) => {
        const tGrad = ctx.createRadialGradient(pt.x, pt.y, 10, pt.x, pt.y, 90);
        tGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.98)');
        tGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0.7)');
        tGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.ellipse(pt.x, pt.y, 45, 80, 0, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;

    const shadowGeo = new THREE.PlaneGeometry(bounds.w * 1.5, bounds.d * 1.35);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    this.contactShadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    this.contactShadowMesh.rotation.x = -Math.PI / 2;
    this.contactShadowMesh.position.set(0, 0.003, 0);
    this.contactShadowMesh.renderOrder = 1;
    rootGroup.add(this.contactShadowMesh);
  }

  /**
   * Creates twin forward headlight spotlight cones casting light forward onto the pavement
   */
  createHeadlightProjectors(rootGroup, bounds, mode) {
    if (this.headlightProjectors) {
      this.headlightProjectors.removeFromParent();
      this.headlightProjectors = null;
    }

    if (mode === 'planes') return; // Planes use landing gear floodlights in VehicleDynamics

    const group = new THREE.Group();
    group.name = 'CarHeadlightProjectors';

    const halfW = bounds.w * 0.38;
    const yPos = Math.max(0.35, bounds.h * 0.32);
    const zPos = bounds.d * 0.45;

    [-halfW, halfW].forEach((xPos) => {
      const spot = new THREE.SpotLight('#f8fafc', 4.5, 45, Math.PI / 5.5, 0.5, 1.2);
      spot.position.set(xPos, yPos, zPos);
      spot.castShadow = true;
      spot.shadow.mapSize.set(1024, 1024);
      spot.shadow.bias = -0.0005;

      const target = new THREE.Object3D();
      target.position.set(xPos * 0.4, 0, zPos + 18);
      group.add(target);
      spot.target = target;
      group.add(spot);
    });

    this.headlightProjectors = group;
    this.headlightProjectors.visible = this.headlightsActive;
    rootGroup.add(group);
  }

  /**
   * Creates cinematic neon chassis underglow
   */
  createUnderglow(rootGroup, bounds, mode) {
    if (this.underglowLight) {
      this.underglowLight.removeFromParent();
      this.underglowLight = null;
    }

    if (mode === 'planes') return;

    const group = new THREE.Group();
    group.name = 'ChassisUnderglowGroup';

    // 4 directional soft pointlights under front, back, left, right sills
    const col = new THREE.Color(this.underglowColor);
    const positions = [
      [0, 0.15, bounds.d * 0.25],
      [0, 0.15, -bounds.d * 0.25],
      [bounds.w * 0.4, 0.15, 0],
      [-bounds.w * 0.4, 0.15, 0],
    ];

    positions.forEach((pos) => {
      const p = new THREE.PointLight(col, 2.8, 6.5, 2.0);
      p.position.set(pos[0], pos[1], pos[2]);
      group.add(p);
    });

    // Floor glow plane
    const glowGeo = new THREE.PlaneGeometry(bounds.w * 1.3, bounds.d * 1.2);
    const glowMat = new THREE.MeshBasicMaterial({
      color: col,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    glowMesh.rotation.x = -Math.PI / 2;
    glowMesh.position.y = 0.004;
    group.add(glowMesh);

    this.underglowLight = group;
    this.underglowLight.visible = this.underglowActive;
    rootGroup.add(group);
  }

  /**
   * Customizes car body paint color and finish in real-time
   */
  setPaintColor(hex) {
    this.currentPaintColor = hex;
    this.customPaintActive = true;
    const col = new THREE.Color(hex);

    this.bodyMaterials.forEach(({ paintMat }) => {
      paintMat.color = col;
      if (paintMat.map) {
        // If it had a texture, tint it cleanly
        paintMat.map = null;
      }
      paintMat.needsUpdate = true;
    });
  }

  setPaintFinish(finish) {
    this.currentFinish = finish;
    this.bodyMaterials.forEach(({ paintMat }) => {
      if (finish === 'matte') {
        paintMat.clearcoat = 0.0;
        paintMat.roughness = 0.42;
        paintMat.metalness = 0.15;
      } else if (finish === 'candy') {
        paintMat.clearcoat = 1.0;
        paintMat.clearcoatRoughness = 0.01;
        paintMat.roughness = 0.06;
        paintMat.metalness = 0.92;
      } else if (finish === 'carbon') {
        paintMat.color = new THREE.Color('#14171d');
        paintMat.clearcoat = 0.75;
        paintMat.roughness = 0.28;
        paintMat.metalness = 0.3;
      } else {
        // 'metallic'
        paintMat.clearcoat = 1.0;
        paintMat.clearcoatRoughness = 0.03;
        paintMat.roughness = 0.12;
        paintMat.metalness = 0.82;
      }
      paintMat.needsUpdate = true;
    });
  }

  setHeadlights(enabled) {
    this.headlightsActive = enabled;
    if (this.headlightProjectors) {
      this.headlightProjectors.visible = enabled;
    }
    this.lightMaterials.forEach(({ mat, isRear }) => {
      mat.emissiveIntensity = enabled ? (isRear ? 3.6 : 4.0) : 0.2;
    });
  }

  setUnderglow(enabled, colorHex) {
    this.underglowActive = enabled;
    if (colorHex) this.underglowColor = colorHex;
    if (this.underglowLight) {
      this.underglowLight.visible = enabled;
      const col = new THREE.Color(this.underglowColor);
      this.underglowLight.traverse((child) => {
        if (child.isPointLight) child.color = col;
        if (child.isMesh && child.material) child.material.color = col;
      });
    }
  }
}

import * as THREE from 'three';

/**
 * Injects a world-space +Y normal Snow Accumulation & Wetness layer into any Three.js MeshStandardMaterial / MeshPhysicalMaterial
 * so that both the Car/Plane body and environment meshes accumulate realistic snow on their top surfaces.
 */
export function attachSnowShaderToMaterial(material, sharedUniforms) {
  if (!material || material.userData?.hasSnowShader) return;
  if (!material.isMeshStandardMaterial && !material.isMeshPhysicalMaterial) return;

  // Skip purely transparent glass with very low opacity if needed, or let windshields frost slightly
  material.userData = material.userData || {};
  material.userData.hasSnowShader = true;
  material.userData.origRoughness = material.roughness ?? 0.4;
  material.userData.origMetalness = material.metalness ?? 0.5;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnowAmount = sharedUniforms.uSnowAmount;
    shader.uniforms.uWetness = sharedUniforms.uWetness;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vSnowWorldNormal;
         varying vec3 vSnowWorldPos;`
      )
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vSnowWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
         vSnowWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uSnowAmount;
         uniform float uWetness;
         varying vec3 vSnowWorldNormal;
         varying vec3 vSnowWorldPos;

         float snowHash(vec3 p) {
           p = fract(p * 0.3183099 + 0.1);
           p *= 17.0;
           return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
         }
         float snowNoise(vec3 x) {
           vec3 i = floor(x);
           vec3 f = fract(x);
           f = f * f * (3.0 - 2.0 * f);
           return mix(
             mix(mix(snowHash(i + vec3(0,0,0)), snowHash(i + vec3(1,0,0)), f.x),
                 mix(snowHash(i + vec3(0,1,0)), snowHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(snowHash(i + vec3(0,0,1)), snowHash(i + vec3(1,0,1)), f.x),
                 mix(snowHash(i + vec3(0,1,1)), snowHash(i + vec3(1,1,1)), f.x), f.y), f.z);
         }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
         if (uSnowAmount > 0.001) {
           float upDot = clamp(vSnowWorldNormal.y, 0.0, 1.0);
           float n = snowNoise(vSnowWorldPos * 3.5) * 0.25 + snowNoise(vSnowWorldPos * 14.0) * 0.12;
           float snowMask = smoothstep(0.58 - uSnowAmount * 0.48, 0.82 - uSnowAmount * 0.32, upDot + n * uSnowAmount);
           snowMask = clamp(snowMask * pow(uSnowAmount, 0.65), 0.0, 0.96);
           vec3 snowCol = vec3(0.93, 0.96, 1.0);
           diffuseColor.rgb = mix(diffuseColor.rgb, snowCol, snowMask);
         }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         if (uSnowAmount > 0.001) {
           float upDotR = clamp(vSnowWorldNormal.y, 0.0, 1.0);
           float snowMaskR = smoothstep(0.55 - uSnowAmount * 0.45, 0.80 - uSnowAmount * 0.30, upDotR) * uSnowAmount;
           roughnessFactor = mix(roughnessFactor, 0.72, clamp(snowMaskR, 0.0, 0.95));
         }
         if (uWetness > 0.01 && uSnowAmount < 0.3) {
           roughnessFactor = mix(roughnessFactor, max(0.05, roughnessFactor * 0.35), uWetness * 0.65);
         }`
      );
  };
  material.needsUpdate = true;
}

export class WeatherSystem {
  constructor(scene) {
    this.scene = scene;
    this.sharedUniforms = {
      uSnowAmount: { value: 0.0 },
      uWetness: { value: 0.0 },
    };

    this.weatherId = 'sunny';
    this.timeOfDay = 16.5; // 0..24 hours (16.5 = 16:30 Golden Hour)
    this.autoTimeLapse = false;
    this.timeLapseSpeed = 0.5;
    this.snowAccumulation = 0.0; // 0..1
    this.autoAccumulateSnow = true;
    this.windSpeed = 0.25;
    this.lightningFlash = 0.0;
    this.nextLightningTimer = 3.5;

    this.outdoorGroup = new THREE.Group();
    this.outdoorGroup.name = 'OutdoorWorldGroup';
    this.weatherParticlesGroup = new THREE.Group();
    this.weatherParticlesGroup.name = 'WeatherParticlesGroup';

    this.scene.add(this.outdoorGroup);
    this.scene.add(this.weatherParticlesGroup);

    this._buildSkyAndCelestialBodies();
    this._buildOutdoorTerrainAndRoad();
    this._buildCloudCanopy();
    this._buildRainParticles();
    this._buildPuddleRipples();
    this._buildSnowParticles();
    this._buildLightningBolt();
  }

  _buildSkyAndCelestialBodies() {
    // Procedural atmospheric sky dome
    const skyGeo = new THREE.SphereGeometry(260, 48, 32);
    this.skyUniforms = {
      uTopColor: { value: new THREE.Color('#0c4a6e') },
      uHorizonColor: { value: new THREE.Color('#fdba74') },
      uBottomColor: { value: new THREE.Color('#0f172a') },
      uSunDir: { value: new THREE.Vector3(0.4, 0.3, -0.8).normalize() },
      uSunColor: { value: new THREE.Color('#fff7ed') },
      uStarIntensity: { value: 0.0 },
      uCloudDarkness: { value: 0.0 },
      uLightning: { value: 0.0 },
    };

    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: this.skyUniforms,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uBottomColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uStarIntensity;
        uniform float uCloudDarkness;
        uniform float uLightning;
        varying vec3 vWorldPosition;

        float starHash(vec3 p) {
          p = fract(p * vec3(443.897, 441.423, 437.195));
          p += dot(p, p.yzx + 19.19);
          return fract((p.x + p.y) * p.z);
        }

        void main() {
          vec3 dir = normalize(vWorldPosition);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.55));
          if (dir.y < 0.0) {
            col = mix(uHorizonColor, uBottomColor, clamp(-dir.y * 4.0, 0.0, 1.0));
          }

          // Solar glow & disc
          float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
          float sunVisibility = 1.0 - uCloudDarkness * 0.88;
          col += uSunColor * pow(sunAmt, 14.0) * 0.45 * sunVisibility;
          col += uSunColor * smoothstep(0.9982, 0.9996, sunAmt) * 2.2 * sunVisibility;

          // Starfield at night
          if (uStarIntensity > 0.01 && dir.y > 0.05) {
            float s = starHash(floor(dir * 380.0));
            if (s > 0.9965) {
              float twinkle = (s - 0.9965) / 0.0035;
              col += vec3(0.85, 0.92, 1.0) * twinkle * uStarIntensity * (1.0 - uCloudDarkness) * smoothstep(0.05, 0.25, dir.y);
            }
          }

          // Lightning flash
          col += vec3(0.75, 0.85, 1.0) * uLightning * 0.85;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.outdoorGroup.add(this.skyDome);
  }

  _buildOutdoorTerrainAndRoad() {
    // Procedural high-res asphalt road & runway texture
    const roadCanvas = document.createElement('canvas');
    roadCanvas.width = 1024;
    roadCanvas.height = 1024;
    const ctx = roadCanvas.getContext('2d');

    ctx.fillStyle = '#181b20';
    ctx.fillRect(0, 0, 1024, 1024);

    // Asphalt grain
    for (let i = 0; i < 28000; i++) {
      const x = Math.random() * 1024;
      const y = Math.random() * 1024;
      const v = 20 + Math.floor(Math.random() * 24);
      ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
      ctx.fillRect(x, y, 2, 2);
    }

    // Highway / Runway sideline markings
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(90, 0, 14, 1024);
    ctx.fillRect(920, 0, 14, 1024);

    // Dashed centerline
    ctx.fillStyle = '#f59e0b';
    for (let y = 0; y < 1024; y += 128) {
      ctx.fillRect(506, y + 16, 12, 72);
    }

    const roadTex = new THREE.CanvasTexture(roadCanvas);
    roadTex.wrapS = THREE.RepeatWrapping;
    roadTex.wrapT = THREE.RepeatWrapping;
    roadTex.repeat.set(1, 14);
    roadTex.colorSpace = THREE.SRGBColorSpace;
    this.roadTexture = roadTex;

    const roadGeo = new THREE.PlaneGeometry(28, 280, 32, 64);
    this.roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      roughness: 0.42,
      metalness: 0.15,
    });
    attachSnowShaderToMaterial(this.roadMat, this.sharedUniforms);

    this.roadMesh = new THREE.Mesh(roadGeo, this.roadMat);
    this.roadMesh.rotation.x = -Math.PI / 2;
    this.roadMesh.position.y = 0.002;
    this.roadMesh.receiveShadow = true;
    this.outdoorGroup.add(this.roadMesh);

    // Surrounding Alpine terrain & mountain ring
    const terrainGeo = new THREE.PlaneGeometry(360, 360, 96, 96);
    const pos = terrainGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i); // becomes world Z after rotation
      const distFromRoad = Math.max(0, Math.abs(x) - 15.5);
      const radialDist = Math.hypot(x, y);
      let h = 0;
      if (distFromRoad > 0) {
        const ridge =
          Math.sin(x * 0.045) * Math.cos(y * 0.045) * 8.0 +
          Math.sin(x * 0.11 + 1.3) * Math.cos(y * 0.09) * 3.2;
        const mountainRing = Math.pow(Math.max(0, radialDist - 42) / 95, 1.85) * 36.0;
        h = Math.max(0, (ridge + mountainRing) * Math.min(1, distFromRoad / 14.0));
      }
      pos.setZ(i, h);
    }
    terrainGeo.computeVertexNormals();

    this.terrainMat = new THREE.MeshStandardMaterial({
      color: '#253129',
      roughness: 0.88,
      metalness: 0.05,
    });
    attachSnowShaderToMaterial(this.terrainMat, this.sharedUniforms);

    this.terrainMesh = new THREE.Mesh(terrainGeo, this.terrainMat);
    this.terrainMesh.rotation.x = -Math.PI / 2;
    this.terrainMesh.position.y = -0.02;
    this.terrainMesh.receiveShadow = true;
    this.outdoorGroup.add(this.terrainMesh);

    // Pine trees & highway edge light posts
    this.treesGroup = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#3e2723', roughness: 0.9 });
    this.foliageMat = new THREE.MeshStandardMaterial({ color: '#1b3b2b', roughness: 0.8 });
    attachSnowShaderToMaterial(this.foliageMat, this.sharedUniforms);

    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.8, 7);
    const cone1Geo = new THREE.ConeGeometry(1.7, 3.6, 8);
    const cone2Geo = new THREE.ConeGeometry(1.3, 3.0, 8);

    for (let i = 0; i < 65; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const x = side * (17.5 + (i * 13.7) % 58);
      const z = -110 + ((i * 29.3) % 220);
      const scale = 0.85 + (i % 5) * 0.22;

      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.9;
      const c1 = new THREE.Mesh(cone1Geo, this.foliageMat);
      c1.position.y = 2.6;
      c1.castShadow = true;
      const c2 = new THREE.Mesh(cone2Geo, this.foliageMat);
      c2.position.y = 4.3;
      c2.castShadow = true;

      tree.add(trunk, c1, c2);
      tree.position.set(x, 0, z);
      tree.scale.setScalar(scale);
      this.treesGroup.add(tree);
    }
    this.outdoorGroup.add(this.treesGroup);

    // Highway / Tarmac guide bollards with warm/cyan emissive beacons
    this.roadLightsGroup = new THREE.Group();
    const postGeo = new THREE.CylinderGeometry(0.06, 0.08, 1.1, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.7, roughness: 0.3 });
    const bulbGeo = new THREE.SphereGeometry(0.11, 10, 10);
    this.bollardBulbMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#38bdf8',
      emissiveIntensity: 2.2,
    });

    for (let z = -90; z <= 90; z += 15) {
      [-14.2, 14.2].forEach((x) => {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, 0.55, z);
        const bulb = new THREE.Mesh(bulbGeo, this.bollardBulbMat);
        bulb.position.set(x, 1.15, z);
        this.roadLightsGroup.add(post, bulb);
      });
    }
    this.outdoorGroup.add(this.roadLightsGroup);
  }

  _buildCloudCanopy() {
    this.cloudGroup = new THREE.Group();
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 256;
    cloudCanvas.height = 256;
    const ctx = cloudCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
    grad.addColorStop(0, 'rgba(255,255,255,0.85)');
    grad.addColorStop(0.5, 'rgba(225,232,245,0.45)');
    grad.addColorStop(1, 'rgba(200,210,225,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const cloudTex = new THREE.CanvasTexture(cloudCanvas);
    this.cloudMat = new THREE.MeshLambertMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const planeGeo = new THREE.PlaneGeometry(55, 55);
    this.cloudPuffs = [];
    for (let i = 0; i < 36; i++) {
      const puff = new THREE.Mesh(planeGeo, this.cloudMat);
      puff.rotation.x = Math.PI / 2;
      puff.position.set(
        (Math.random() - 0.5) * 240,
        36 + (i % 5) * 4.5,
        (Math.random() - 0.5) * 240
      );
      puff.rotation.z = Math.random() * Math.PI * 2;
      this.cloudGroup.add(puff);
      this.cloudPuffs.push(puff);
    }
    this.outdoorGroup.add(this.cloudGroup);
  }

  _buildRainParticles() {
    const count = 9000;
    const positions = new Float32Array(count * 6); // 2 vertices per raindrop streak
    this.rainSeeds = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 90;
      const y = Math.random() * 38;
      const z = (Math.random() - 0.5) * 90;
      this.rainSeeds[i * 3] = x;
      this.rainSeeds[i * 3 + 1] = y;
      this.rainSeeds[i * 3 + 2] = z;

      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;
      positions[i * 6 + 3] = x - 0.15;
      positions[i * 6 + 4] = y - 1.15;
      positions[i * 6 + 5] = z;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.rainMat = new THREE.LineBasicMaterial({
      color: '#bae6fd',
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    this.rainLines = new THREE.LineSegments(geo, this.rainMat);
    this.rainLines.visible = false;
    this.weatherParticlesGroup.add(this.rainLines);
  }

  _buildPuddleRipples() {
    this.ripplesGroup = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(0.08, 0.12, 24);
    ringGeo.rotateX(-Math.PI / 2);
    this.ripples = [];
    for (let i = 0; i < 45; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#bae6fd',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.position.set((Math.random() - 0.5) * 24, 0.015, (Math.random() - 0.5) * 28);
      mesh.userData.phase = Math.random();
      this.ripplesGroup.add(mesh);
      this.ripples.push(mesh);
    }
    this.ripplesGroup.visible = false;
    this.weatherParticlesGroup.add(this.ripplesGroup);
  }

  _buildSnowParticles() {
    const count = 14000;
    const positions = new Float32Array(count * 3);
    this.snowPhase = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 95;
      positions[i * 3 + 1] = Math.random() * 36;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 95;
      this.snowPhase[i] = Math.random() * Math.PI * 2;
    }

    const flakeCanvas = document.createElement('canvas');
    flakeCanvas.width = 64;
    flakeCanvas.height = 64;
    const ctx = flakeCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(240,248,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const flakeTex = new THREE.CanvasTexture(flakeCanvas);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.snowMat = new THREE.PointsMaterial({
      size: 0.26,
      map: flakeTex,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.snowPoints = new THREE.Points(geo, this.snowMat);
    this.snowPoints.visible = false;
    this.weatherParticlesGroup.add(this.snowPoints);
  }

  _buildLightningBolt() {
    const pts = [];
    let x = 0;
    let y = 48;
    let z = -65;
    for (let i = 0; i < 16; i++) {
      pts.push(new THREE.Vector3(x, y, z));
      x += (Math.random() - 0.5) * 4.5;
      y -= 3.1;
      z += (Math.random() - 0.5) * 2.0;
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    this.lightningMat = new THREE.LineBasicMaterial({
      color: '#e0f2fe',
      transparent: true,
      opacity: 0,
    });
    this.lightningMesh = new THREE.Line(geo, this.lightningMat);
    this.outdoorGroup.add(this.lightningMesh);
  }

  setOutdoorVisible(visible) {
    this.outdoorGroup.visible = visible;
    // Note: weatherParticlesGroup stays visible if weather is active so user can even enjoy snow/rain in outdoor or open scenes
    this.weatherParticlesGroup.visible = visible;
  }

  applySnowShaderToRoot(rootObject) {
    if (!rootObject) return;
    rootObject.traverse((child) => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => attachSnowShaderToMaterial(m, this.sharedUniforms));
        } else {
          attachSnowShaderToMaterial(child.material, this.sharedUniforms);
        }
      }
    });
  }

  triggerLightningStrike() {
    this.lightningFlash = 1.8;
    // Randomize lightning bolt position along horizon
    const baseX = (Math.random() - 0.5) * 90;
    const baseZ = -55 - Math.random() * 45;
    const pos = this.lightningMesh.geometry.attributes.position;
    let cx = baseX;
    let cy = 52;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, cx, cy, baseZ);
      cx += (Math.random() - 0.5) * 5.2;
      cy -= 3.4;
    }
    pos.needsUpdate = true;
  }

  /**
   * Computes solar/lunar lighting & sky palette from 24-Hour Time-of-Day + active Weather
   */
  update(dt, elapsed, lightingRig, isOutdoorActive) {
    if (this.autoTimeLapse) {
      this.timeOfDay = (this.timeOfDay + dt * this.timeLapseSpeed) % 24;
    }

    const isSnowWeather = this.weatherId === 'snow' || this.weatherId === 'blizzard';
    const isRainWeather = this.weatherId === 'drizzle' || this.weatherId === 'thunderstorm';

    // Progressive snow accumulation during Snow / Blizzard
    if (this.autoAccumulateSnow && isSnowWeather) {
      const rate = this.weatherId === 'blizzard' ? 0.085 : 0.035;
      this.snowAccumulation = Math.min(1.0, this.snowAccumulation + dt * rate);
    }

    this.sharedUniforms.uSnowAmount.value = isOutdoorActive ? this.snowAccumulation : 0.0;

    let targetWetness = 0.0;
    if (this.weatherId === 'drizzle') targetWetness = 0.8;
    else if (this.weatherId === 'thunderstorm') targetWetness = 0.96;
    else if (this.weatherId === 'cloudy') targetWetness = 0.2;
    this.sharedUniforms.uWetness.value = THREE.MathUtils.lerp(
      this.sharedUniforms.uWetness.value,
      isOutdoorActive ? targetWetness : 0.0,
      dt * 3.0
    );

    if (!isOutdoorActive) return;

    // 1. Compute 24h solar position
    // 06:00 sunrise, 12:00 zenith, 18:30 sunset
    const hourAngle = ((this.timeOfDay - 6.0) / 24.0) * Math.PI * 2.0;
    const rawSin = Math.sin(hourAngle); // >0 daytime, <0 nighttime
    const azimuthRad = ((this.timeOfDay / 24.0) * Math.PI * 2.0) - Math.PI / 2;

    const sunDir = new THREE.Vector3(
      Math.cos(azimuthRad) * 0.85,
      Math.max(-0.4, rawSin * 0.92),
      Math.sin(azimuthRad) * 0.85
    ).normalize();
    this.skyUniforms.uSunDir.value.copy(sunDir);

    // 2. Compute Sky & Sun Colors across Dawn / Day / Golden Hour / Night
    const topCol = new THREE.Color();
    const horCol = new THREE.Color();
    const sunCol = new THREE.Color();
    let starIntensity = 0.0;
    let baseSunIntensity = 3.2;

    if (rawSin > 0.28) {
      // Midday
      const t = Math.min(1, (rawSin - 0.28) / 0.65);
      topCol.lerpColors(new THREE.Color('#1d4ed8'), new THREE.Color('#0284c7'), t);
      horCol.lerpColors(new THREE.Color('#fdba74'), new THREE.Color('#bae6fd'), t);
      sunCol.lerpColors(new THREE.Color('#ffedd5'), new THREE.Color('#ffffff'), t);
      baseSunIntensity = 3.6;
    } else if (rawSin > -0.08) {
      // Sunrise / Golden Hour / Sunset
      const t = (rawSin + 0.08) / 0.36; // 0 at twilight, 1 at golden morning/afternoon
      topCol.lerpColors(new THREE.Color('#1e1b4b'), new THREE.Color('#1d4ed8'), t);
      horCol.lerpColors(new THREE.Color('#f97316'), new THREE.Color('#fdba74'), t);
      sunCol.set('#ff7b29');
      baseSunIntensity = 1.4 + t * 2.2;
      starIntensity = (1.0 - t) * 0.45;
    } else {
      // Nighttime
      const nightDepth = Math.min(1, (-rawSin - 0.08) / 0.5);
      topCol.lerpColors(new THREE.Color('#1e1b4b'), new THREE.Color('#030712'), nightDepth);
      horCol.lerpColors(new THREE.Color('#312e81'), new THREE.Color('#0f172a'), nightDepth);
      sunCol.set('#60a5fa'); // Cool moonlight
      baseSunIntensity = 0.75;
      starIntensity = 0.95;
    }

    // 3. Weather Overcast / Storm / Snow tinting
    let cloudDarkness = 0.0;
    if (this.weatherId === 'cloudy') cloudDarkness = 0.55;
    else if (this.weatherId === 'drizzle') cloudDarkness = 0.72;
    else if (this.weatherId === 'thunderstorm') cloudDarkness = 0.92;
    else if (this.weatherId === 'snow') cloudDarkness = 0.65;
    else if (this.weatherId === 'blizzard') cloudDarkness = 0.88;

    const overcastTop = new THREE.Color(isSnowWeather ? '#64748b' : '#1e293b');
    const overcastHor = new THREE.Color(isSnowWeather ? '#cbd5e1' : '#334155');
    topCol.lerp(overcastTop, cloudDarkness);
    horCol.lerp(overcastHor, cloudDarkness);

    this.skyUniforms.uTopColor.value.copy(topCol);
    this.skyUniforms.uHorizonColor.value.copy(horCol);
    this.skyUniforms.uSunColor.value.copy(sunCol);
    this.skyUniforms.uStarIntensity.value = starIntensity;
    this.skyUniforms.uCloudDarkness.value = cloudDarkness;

    // 4. Thunderstorm Lightning
    if (this.weatherId === 'thunderstorm') {
      this.nextLightningTimer -= dt;
      if (this.nextLightningTimer <= 0) {
        this.triggerLightningStrike();
        this.nextLightningTimer = 2.2 + Math.random() * 4.5;
      }
    }
    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt * 6.5);
    }
    this.skyUniforms.uLightning.value = this.lightningFlash;
    this.lightningMat.opacity = Math.min(1, this.lightningFlash * 0.9);

    // 5. Update Cloud Canopy
    this.cloudMat.opacity = 0.12 + cloudDarkness * 0.68;
    const cloudTint = isSnowWeather ? new THREE.Color('#e2e8f0') : horCol.clone().lerp(new THREE.Color('#ffffff'), 0.4);
    this.cloudMat.color.copy(cloudTint);
    for (let i = 0; i < this.cloudPuffs.length; i++) {
      const p = this.cloudPuffs[i];
      p.position.x += dt * (2.5 + this.windSpeed * 12.0);
      if (p.position.x > 120) p.position.x = -120;
    }

    // 6. Sync Outdoor Sun/Moon + Fog with LightingRig
    if (lightingRig) {
      const elevDeg = Math.max(10, Math.abs(rawSin) * 72);
      const azimDeg = ((this.timeOfDay / 24.0) * 360) % 360;
      lightingRig.applyOutdoorSolarState({
        sunColor: sunCol,
        sunIntensity: baseSunIntensity * (1.0 - cloudDarkness * 0.55) + this.lightningFlash * 4.5,
        azimuth: azimDeg,
        elevation: elevDeg,
        fogColor: horCol,
        fogDensity:
          this.weatherId === 'blizzard'
            ? 0.022
            : this.weatherId === 'thunderstorm'
            ? 0.013
            : this.weatherId === 'snow' || this.weatherId === 'drizzle'
            ? 0.0085
            : 0.0022,
      });
    }

    // 7. Animate Rain Streaks & Puddle Ripples
    this.rainLines.visible = isRainWeather;
    this.ripplesGroup.visible = isRainWeather;
    if (isRainWeather) {
      const isStorm = this.weatherId === 'thunderstorm';
      this.rainMat.opacity = isStorm ? 0.62 : 0.36;
      const pos = this.rainLines.geometry.attributes.position;
      const fallSpeed = isStorm ? 46.0 : 28.0;
      const windX = isStorm ? -9.5 * this.windSpeed : -2.8 * this.windSpeed;
      const streakLen = isStorm ? 1.65 : 0.95;

      for (let i = 0; i < pos.count / 2; i++) {
        let x = this.rainSeeds[i * 3];
        let y = this.rainSeeds[i * 3 + 1];
        let z = this.rainSeeds[i * 3 + 2];

        y -= dt * fallSpeed;
        x += dt * windX;
        if (y < 0) {
          y += 38;
          x = (Math.random() - 0.5) * 90;
        }
        if (x < -45) x += 90;

        this.rainSeeds[i * 3] = x;
        this.rainSeeds[i * 3 + 1] = y;

        pos.setXYZ(i * 2, x, y, z);
        pos.setXYZ(i * 2 + 1, x + windX * 0.04, y - streakLen, z);
      }
      pos.needsUpdate = true;

      // Animate concentric puddle ripples on wet asphalt
      for (let i = 0; i < this.ripples.length; i++) {
        const r = this.ripples[i];
        r.userData.phase = (r.userData.phase + dt * (isStorm ? 2.4 : 1.4)) % 1.0;
        const p = r.userData.phase;
        r.scale.setScalar(0.5 + p * 4.2);
        r.material.opacity = (1.0 - p) * (isStorm ? 0.55 : 0.32);
      }
    }

    // 8. Animate Snow & Blizzard Flakes
    this.snowPoints.visible = isSnowWeather;
    if (isSnowWeather) {
      const isBlizzard = this.weatherId === 'blizzard';
      this.snowMat.opacity = isBlizzard ? 0.92 : 0.72;
      this.snowMat.size = isBlizzard ? 0.32 : 0.24;
      const pos = this.snowPoints.geometry.attributes.position;
      const fallSpeed = isBlizzard ? 9.5 : 3.2;
      const lateralWind = isBlizzard ? 24.0 * Math.max(0.5, this.windSpeed) : 2.2 * this.windSpeed;

      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        const ph = this.snowPhase[i];

        y -= dt * fallSpeed;
        x += dt * (lateralWind + Math.sin(elapsed * 2.2 + ph) * 1.6);
        z += dt * Math.cos(elapsed * 1.8 + ph) * (isBlizzard ? 6.0 : 1.2);

        if (y < 0) y = 35;
        if (x > 47) x = -47;
        if (x < -47) x = 47;
        if (z > 47) z = -47;
        if (z < -47) z = 47;

        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }
  }
}

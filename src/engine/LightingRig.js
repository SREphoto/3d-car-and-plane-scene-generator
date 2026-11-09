import * as THREE from 'three';
import { createAutomotiveStudioScene } from './StudioEnvironment.js';

export class LightingRig {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;

    // Generate crisp HDR studio reflection environment for car paint, clearcoat & fuselage
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const studioEnvScene = createAutomotiveStudioScene();
    this.envTexture = pmremGenerator.fromScene(studioEnvScene, 0.04).texture;
    this.scene.environment = this.envTexture;
    this.scene.environmentIntensity = 2.2;

    this.state = {
      keyColor: '#ffffff',
      keyIntensity: 3.8,
      keyAzimuth: 45,
      keyElevation: 52,
      fillColor: '#93c5fd',
      fillIntensity: 1.6,
      rimColor: '#f8fafc',
      rimIntensity: 3.2,
      ambientColor: '#0a0f1d',
      ambientIntensity: 0.45, // Dropped down from 1.1 so dark scenes are truly deep & moody
      exposure: 1.15,
      floorWetness: 0.75, // Default wet mirror floor
      fogDensity: 0.005,
      lightSweep: true,
      softboxIntensity: 4.5,
      blackoutMode: false,
    };

    this.beatPulse = 0; // 0..1 from MusicEngine bass beat detector

    this.lightsGroup = new THREE.Group();
    this.lightsGroup.name = 'StudioLightingRig';
    this.scene.add(this.lightsGroup);

    this._initLights();
    this._initProceduralStudios();
    this._initWindTunnelStreamlines();
    this.applyState(this.state);
  }

  _initLights() {
    this.ambientLight = new THREE.HemisphereLight('#ffffff', '#030712', 0.45);
    this.lightsGroup.add(this.ambientLight);

    // Primary Key Spotlight
    this.keyLight = new THREE.DirectionalLight('#ffffff', 3.8);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 140;
    const d = 22;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0004;
    this.lightsGroup.add(this.keyLight);

    // Secondary Fill Light
    this.fillLight = new THREE.DirectionalLight('#93c5fd', 1.6);
    this.fillLight.position.set(-18, 12, -12);
    this.lightsGroup.add(this.fillLight);

    // Sharp Razor Rim Spotlight
    this.rimLight = new THREE.SpotLight('#f8fafc', 3.5, 95, Math.PI / 3.2, 0.45, 1.0);
    this.rimLight.position.set(0, 14, 22);
    this.lightsGroup.add(this.rimLight);

    // Moving overhead sweep softbox light for cinematic clearcoat highlights
    this.sweepLight = new THREE.PointLight('#ffffff', 2.8, 40, 1.6);
    this.sweepLight.position.set(0, 7.5, 0);
    this.lightsGroup.add(this.sweepLight);

    this.scene.fog = new THREE.FogExp2('#03060c', 0.005);
  }

  _initProceduralStudios() {
    // 1. Wet Obsidian Dark Studio (Automotive Blackout Stage)
    this.wetStudioGroup = new THREE.Group();
    const floorGeo = new THREE.CircleGeometry(90, 64);
    this.studioFloorMat = new THREE.MeshStandardMaterial({
      color: '#05070d',
      roughness: 0.08,
      metalness: 0.92,
    });
    const floorMesh = new THREE.Mesh(floorGeo, this.studioFloorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.001;
    floorMesh.receiveShadow = true;
    this.wetStudioGroup.add(floorMesh);

    // Overhead high-intensity studio softbox panel
    const softboxGeo = new THREE.PlaneGeometry(6.5, 24);
    this.softboxMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      side: THREE.DoubleSide,
    });
    this.softboxMesh = new THREE.Mesh(softboxGeo, this.softboxMat);
    this.softboxMesh.rotation.x = Math.PI / 2;
    this.softboxMesh.position.set(0, 8.8, 0);
    this.wetStudioGroup.add(this.softboxMesh);

    // Twin vertical LED neon light pillars framing the background
    this.studioRimBars = [];
    const barGeo = new THREE.CylinderGeometry(0.06, 0.06, 9.5, 12);
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const r = 18.0;
      const barMat = new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: '#38bdf8',
        emissiveIntensity: 3.5,
      });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(Math.cos(angle) * r, 4.75, Math.sin(angle) * r);
      this.wetStudioGroup.add(bar);
      this.studioRimBars.push(bar);
    }
    this.wetStudioGroup.visible = false;
    this.scene.add(this.wetStudioGroup);

    // 2. Cyberpunk Neon Speed Tunnel
    this.cyberTunnelGroup = new THREE.Group();
    const tunnelFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 220),
      new THREE.MeshStandardMaterial({
        color: '#03050a',
        roughness: 0.06,
        metalness: 0.94,
      })
    );
    tunnelFloor.rotation.x = -Math.PI / 2;
    tunnelFloor.receiveShadow = true;
    this.cyberTunnelGroup.add(tunnelFloor);

    this.tunnelArches = [];
    const archGeo = new THREE.TorusGeometry(11.5, 0.15, 12, 48, Math.PI);
    for (let i = 0; i < 24; i++) {
      const isCyan = i % 2 === 0;
      const col = isCyan ? '#00f5d4' : '#ff007f';
      const archMat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 4.0,
      });
      const arch = new THREE.Mesh(archGeo, archMat);
      arch.position.set(0, 0, -90 + i * 8.0);
      this.cyberTunnelGroup.add(arch);
      this.tunnelArches.push(arch);
    }
    this.cyberTunnelGroup.visible = false;
    this.scene.add(this.cyberTunnelGroup);

    // 3. High-Altitude Volumetric Cloud Deck (Flight Mode)
    this.cloudDeckGroup = new THREE.Group();
    const cloudCanvas = document.createElement('canvas');
    cloudCanvas.width = 256;
    cloudCanvas.height = 256;
    const ctx = cloudCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
    grad.addColorStop(0, 'rgba(255,255,255,0.92)');
    grad.addColorStop(0.55, 'rgba(226,238,255,0.55)');
    grad.addColorStop(1, 'rgba(200,220,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    const cloudTex = new THREE.CanvasTexture(cloudCanvas);

    this.flightCloudMat = new THREE.MeshLambertMaterial({
      map: cloudTex,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.flightClouds = [];
    const puffGeo = new THREE.PlaneGeometry(42, 42);
    for (let i = 0; i < 75; i++) {
      const puff = new THREE.Mesh(puffGeo, this.flightCloudMat);
      puff.rotation.x = -Math.PI / 2;
      puff.position.set(
        (Math.random() - 0.5) * 220,
        -6.5 - (i % 5) * 2.2,
        (Math.random() - 0.5) * 220
      );
      puff.rotation.z = Math.random() * Math.PI * 2;
      this.cloudDeckGroup.add(puff);
      this.flightClouds.push(puff);
    }
    this.cloudDeckGroup.visible = false;
    this.scene.add(this.cloudDeckGroup);

    // 4. Night International Airport Runway
    this.runwayGroup = new THREE.Group();
    const runwayFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(48, 280),
      new THREE.MeshStandardMaterial({
        color: '#050912',
        roughness: 0.12,
        metalness: 0.75,
      })
    );
    runwayFloor.rotation.x = -Math.PI / 2;
    runwayFloor.receiveShadow = true;
    this.runwayGroup.add(runwayFloor);

    this.runwayStrobes = [];
    const strobeGeo = new THREE.SphereGeometry(0.18, 8, 8);
    for (let z = -120; z <= 120; z += 8) {
      // Green centerline lights
      const centerMat = new THREE.MeshBasicMaterial({ color: '#22c55e' });
      const centerLight = new THREE.Mesh(strobeGeo, centerMat);
      centerLight.position.set(0, 0.05, z);
      this.runwayGroup.add(centerLight);
      this.runwayStrobes.push({ mesh: centerLight, z });

      // White/amber edge lights
      [-18, 18].forEach((x) => {
        const edgeMat = new THREE.MeshBasicMaterial({ color: '#fef08a' });
        const edgeLight = new THREE.Mesh(strobeGeo, edgeMat);
        edgeLight.position.set(x, 0.08, z);
        this.runwayGroup.add(edgeLight);
      });
    }
    this.runwayGroup.visible = false;
    this.scene.add(this.runwayGroup);
  }

  /**
   * High-Speed Aerodynamic Smoke Streamlines for the Wind Tunnel
   */
  _initWindTunnelStreamlines() {
    this.windTunnelGroup = new THREE.Group();
    this.windTunnelGroup.name = 'WindTunnelStreamlinesGroup';

    // 14 animated particle streamlines flowing from front to back over the car body
    this.streamlines = [];
    const particleCount = 75;
    const numLines = 14;

    const streamGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(numLines * particleCount * 3);
    const alphas = new Float32Array(numLines * particleCount);

    this.streamlineData = [];
    for (let line = 0; line < numLines; line++) {
      const xOffset = ((line - (numLines - 1) / 2) / numLines) * 2.8;
      const yOffset = 0.45 + (Math.abs(line - numLines / 2) / (numLines / 2)) * 0.55;
      this.streamlineData.push({
        x: xOffset,
        yBase: yOffset,
        speed: 18.0 + Math.random() * 4.0,
        phase: Math.random() * 10.0,
      });
    }

    streamGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    streamGeo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    const streamMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (18.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          float intensity = smoothstep(0.5, 0.05, dist);
          vec3 col = mix(vec3(0.0, 0.95, 0.85), vec3(1.0, 1.0, 1.0), intensity * 0.6);
          gl_FragColor = vec4(col, intensity * vAlpha * 0.85);
        }
      `,
    });

    this.streamlineParticles = new THREE.Points(streamGeo, streamMat);
    this.windTunnelGroup.add(this.streamlineParticles);
    this.windTunnelGroup.visible = false;
    this.scene.add(this.windTunnelGroup);
  }

  setActiveProceduralScene(sceneId) {
    this.wetStudioGroup.visible = sceneId === 'wet_studio' || sceneId === 'dark_void';
    this.cyberTunnelGroup.visible = sceneId === 'cyberpunk_tunnel';
    this.cloudDeckGroup.visible = sceneId === 'cloud_deck';
    this.runwayGroup.visible = sceneId === 'night_runway';
    this.windTunnelGroup.visible = sceneId === 'wind_tunnel';

    if (sceneId === 'dark_void') {
      this.scene.background = new THREE.Color('#010204');
      this.scene.fog.color.set('#010204');
      this.scene.fog.density = 0.008;
      this.ambientLight.intensity = 0.15; // Inky black void
      this.keyLight.intensity = 4.2;
      this.rimLight.intensity = 4.5;
    } else if (sceneId === 'wind_tunnel') {
      this.scene.background = new THREE.Color('#020409');
      this.scene.fog.color.set('#040813');
      this.scene.fog.density = 0.006;
      this.ambientLight.intensity = 0.35;
      this.keyLight.intensity = 3.6;
    } else if (sceneId === 'cloud_deck') {
      this.scene.background = new THREE.Color('#0c4a6e');
      this.scene.fog.color.set('#38bdf8');
      this.scene.fog.density = 0.0035;
    } else if (sceneId === 'cyberpunk_tunnel') {
      this.scene.background = new THREE.Color('#020308');
      this.scene.fog.color.set('#060410');
      this.scene.fog.density = 0.008;
    } else if (sceneId === 'night_runway') {
      this.scene.background = new THREE.Color('#02040a');
      this.scene.fog.color.set('#040812');
      this.scene.fog.density = 0.006;
    } else if (sceneId !== 'outdoor_world') {
      this.scene.background = new THREE.Color('#03060c');
      this.scene.fog.color.set('#03060c');
      this.scene.fog.density = this.state.fogDensity;
    }
  }

  applyState(partial) {
    this.state = { ...this.state, ...partial };
    const s = this.state;

    this.keyLight.color.set(s.keyColor);
    this.keyLight.intensity = s.keyIntensity;

    const az = THREE.MathUtils.degToRad(s.keyAzimuth);
    const el = THREE.MathUtils.degToRad(Math.max(5, s.keyElevation));
    const dist = 28;
    this.keyLight.position.set(
      dist * Math.cos(el) * Math.cos(az),
      dist * Math.sin(el),
      dist * Math.cos(el) * Math.sin(az)
    );

    this.fillLight.color.set(s.fillColor);
    this.fillLight.intensity = s.fillIntensity;
    this.fillLight.position.set(
      -dist * Math.cos(el) * Math.cos(az),
      Math.max(6, dist * 0.45),
      -dist * Math.cos(el) * Math.sin(az)
    );

    this.rimLight.color.set(s.rimColor);
    this.rimLight.intensity = s.rimIntensity;

    this.ambientLight.color.set('#ffffff');
    this.ambientLight.groundColor.set(s.ambientColor);
    this.ambientLight.intensity = s.blackoutMode ? 0.05 : s.ambientIntensity;

    this.renderer.toneMappingExposure = s.exposure;

    if (this.studioFloorMat) {
      this.studioFloorMat.roughness = THREE.MathUtils.clamp(1.0 - s.floorWetness * 0.94, 0.04, 0.85);
    }

    if (this.softboxMat) {
      const bri = s.softboxIntensity || 4.5;
      this.softboxMat.color.setRGB(bri, bri, bri);
    }

    this.studioRimBars.forEach((bar, idx) => {
      const c = idx % 2 === 0 ? s.rimColor : s.fillColor;
      bar.material.color.set(c);
      bar.material.emissive.set(c);
    });
  }

  applyOutdoorSolarState({ sunColor, sunIntensity, azimuth, elevation, fogColor, fogDensity }) {
    const az = THREE.MathUtils.degToRad(azimuth);
    const el = THREE.MathUtils.degToRad(Math.max(6, elevation));
    const dist = 42;
    this.keyLight.position.set(
      dist * Math.cos(el) * Math.cos(az),
      dist * Math.sin(el),
      dist * Math.cos(el) * Math.sin(az)
    );
    this.keyLight.color.copy(sunColor);
    this.keyLight.intensity = sunIntensity;
    this.scene.fog.color.copy(fogColor);
    this.scene.fog.density = fogDensity;
  }

  update(dt, elapsed, speedActive = true) {
    // 1. Studio overhead light sweep
    if (this.state.lightSweep) {
      this.sweepLight.position.z = Math.sin(elapsed * 1.1) * 9.0;
      this.sweepLight.position.x = Math.cos(elapsed * 0.7) * 3.5;
      this.sweepLight.intensity = 2.4 + this.beatPulse * 2.8;
    } else {
      this.sweepLight.intensity = 0;
    }

    // 2. Beat-sync pulse on rim light & studio neon bars
    this.rimLight.intensity = this.state.rimIntensity + this.beatPulse * 3.0;

    // 3. Update aerodynamic streamlines in Wind Tunnel
    if (this.windTunnelGroup.visible) {
      const posAttr = this.streamlineParticles.geometry.attributes.position;
      const alphaAttr = this.streamlineParticles.geometry.attributes.alpha;
      const posArray = posAttr.array;
      const alphaArray = alphaAttr.array;

      const particleCount = 75;
      let ptr = 0;
      let aPtr = 0;

      for (let line = 0; line < this.streamlineData.length; line++) {
        const lineData = this.streamlineData[line];
        const x = lineData.x;

        for (let p = 0; p < particleCount; p++) {
          const t = (elapsed * lineData.speed * 0.2 + (p / particleCount) * 16.0 + lineData.phase) % 18.0;
          const z = 9.0 - t; // Flows from front (+Z) to back (-Z)

          // Aerodynamic curve over car profile (hood, windshield, roof, rear diffuser)
          let y = lineData.yBase;
          if (z > 1.8 && z <= 5.0) {
            // Over hood
            y += Math.sin(((5.0 - z) / 3.2) * Math.PI * 0.5) * 0.45;
          } else if (z > -0.5 && z <= 1.8) {
            // Over windshield
            y += 0.45 + ((1.8 - z) / 2.3) * 0.65;
          } else if (z > -2.2 && z <= -0.5) {
            // Over roof
            y += 1.1 + Math.sin(((z + 0.5) / 1.7) * Math.PI) * 0.15;
          } else if (z <= -2.2) {
            // Down rear deck & diffuser wake
            y += Math.max(0.2, 1.1 - (( -2.2 - z) / 6.0) * 0.8);
          }

          posArray[ptr] = x + Math.sin(z * 0.4 + elapsed) * 0.08;
          posArray[ptr + 1] = y;
          posArray[ptr + 2] = z;

          // Fade in at front and fade out into fan
          const alpha = Math.sin((t / 18.0) * Math.PI);
          alphaArray[aPtr] = Math.max(0.0, alpha);

          ptr += 3;
          aPtr += 1;
        }
      }

      posAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
    }

    // 4. Animate Cyberpunk Tunnel arches
    if (this.cyberTunnelGroup.visible && speedActive) {
      for (let i = 0; i < this.tunnelArches.length; i++) {
        const arch = this.tunnelArches[i];
        arch.position.z += dt * 32.0;
        if (arch.position.z > 95) arch.position.z -= 192;
      }
    }

    // 5. Animate Flight Cloud Deck
    if (this.cloudDeckGroup.visible) {
      for (let i = 0; i < this.flightClouds.length; i++) {
        const c = this.flightClouds[i];
        c.position.z += dt * 24.0;
        if (c.position.z > 110) c.position.z = -110;
      }
    }

    // 6. Animate Runway approach strobes
    if (this.runwayGroup.visible) {
      for (let i = 0; i < this.runwayStrobes.length; i++) {
        const item = this.runwayStrobes[i];
        if (speedActive) {
          item.mesh.position.z += dt * 28.0;
          if (item.mesh.position.z > 120) item.mesh.position.z -= 240;
        }
      }
    }
  }
}

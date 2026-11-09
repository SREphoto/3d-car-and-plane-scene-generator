import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export class LightingRig {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;

    // Generate crisp PMREM studio reflection environment for metallic car paint & fuselage
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    this.envTexture = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    this.scene.environment = this.envTexture;
    this.scene.environmentIntensity = 1.1;

    this.state = {
      keyColor: '#ffffff',
      keyIntensity: 3.2,
      keyAzimuth: 42,
      keyElevation: 48,
      fillColor: '#60a5fa',
      fillIntensity: 1.4,
      rimColor: '#f8fafc',
      rimIntensity: 2.4,
      ambientColor: '#1e293b',
      ambientIntensity: 1.1,
      exposure: 1.15,
      floorWetness: 0.55,
      fogDensity: 0.004,
      lightSweep: true,
    };

    this.beatPulse = 0; // 0..1 from MusicEngine bass beat detector

    this.lightsGroup = new THREE.Group();
    this.lightsGroup.name = 'StudioLightingRig';
    this.scene.add(this.lightsGroup);

    this._initLights();
    this._initProceduralStudios();
    this.applyState(this.state);
  }

  _initLights() {
    this.ambientLight = new THREE.HemisphereLight('#ffffff', '#0f172a', 1.1);
    this.lightsGroup.add(this.ambientLight);

    this.keyLight = new THREE.DirectionalLight('#ffffff', 3.2);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 120;
    const d = 24;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.lightsGroup.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight('#60a5fa', 1.4);
    this.fillLight.position.set(-18, 10, -12);
    this.lightsGroup.add(this.fillLight);

    this.rimLight = new THREE.SpotLight('#38bdf8', 2.8, 95, Math.PI / 3, 0.6, 1.0);
    this.rimLight.position.set(0, 14, 24);
    this.lightsGroup.add(this.rimLight);

    // Moving overhead sweep softbox light for cinematic clearcoat highlights
    this.sweepLight = new THREE.PointLight('#ffffff', 2.2, 35, 1.5);
    this.sweepLight.position.set(0, 6.5, 0);
    this.lightsGroup.add(this.sweepLight);

    this.scene.fog = new THREE.FogExp2('#070b14', 0.004);
  }

  _initProceduralStudios() {
    // 1. Wet Asphalt Dark Studio
    this.wetStudioGroup = new THREE.Group();
    const floorGeo = new THREE.CircleGeometry(85, 64);
    this.studioFloorMat = new THREE.MeshStandardMaterial({
      color: '#0b0f17',
      roughness: 0.14,
      metalness: 0.65,
    });
    const floorMesh = new THREE.Mesh(floorGeo, this.studioFloorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    this.wetStudioGroup.add(floorMesh);

    // Overhead studio softbox panels & neon rim pillars
    const softboxGeo = new THREE.PlaneGeometry(5.5, 16);
    this.softboxMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      side: THREE.DoubleSide,
    });
    const softbox = new THREE.Mesh(softboxGeo, this.softboxMat);
    softbox.rotation.x = Math.PI / 2;
    softbox.position.set(0, 8.5, 0);
    this.wetStudioGroup.add(softbox);

    this.studioRimBars = [];
    const barGeo = new THREE.CylinderGeometry(0.08, 0.08, 7.5, 12);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = 16.5;
      const barMat = new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: '#38bdf8',
        emissiveIntensity: 2.5,
      });
      const bar = new THREE.Mesh(barGeo, barMat);
      bar.position.set(Math.cos(angle) * r, 3.75, Math.sin(angle) * r);
      this.wetStudioGroup.add(bar);
      this.studioRimBars.push(bar);
    }
    this.wetStudioGroup.visible = false;
    this.scene.add(this.wetStudioGroup);

    // 2. Cyberpunk Neon Speed Tunnel
    this.cyberTunnelGroup = new THREE.Group();
    const tunnelFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 220),
      new THREE.MeshStandardMaterial({
        color: '#060812',
        roughness: 0.08,
        metalness: 0.85,
      })
    );
    tunnelFloor.rotation.x = -Math.PI / 2;
    tunnelFloor.receiveShadow = true;
    this.cyberTunnelGroup.add(tunnelFloor);

    this.tunnelArches = [];
    const archGeo = new THREE.TorusGeometry(11.5, 0.14, 12, 48, Math.PI);
    for (let i = 0; i < 24; i++) {
      const isCyan = i % 2 === 0;
      const col = isCyan ? '#00f5d4' : '#ff007f';
      const archMat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 3.2,
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
        color: '#0e131d',
        roughness: 0.16,
        metalness: 0.5,
      })
    );
    runwayFloor.rotation.x = -Math.PI / 2;
    runwayFloor.receiveShadow = true;
    this.runwayGroup.add(runwayFloor);

    this.runwayStrobes = [];
    const strobeGeo = new THREE.SphereGeometry(0.16, 8, 8);
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

  setActiveProceduralScene(sceneId) {
    this.wetStudioGroup.visible = sceneId === 'wet_studio';
    this.cyberTunnelGroup.visible = sceneId === 'cyberpunk_tunnel';
    this.cloudDeckGroup.visible = sceneId === 'cloud_deck';
    this.runwayGroup.visible = sceneId === 'night_runway';

    if (sceneId === 'cloud_deck') {
      this.scene.background = new THREE.Color('#0c4a6e');
      this.scene.fog.color.set('#38bdf8');
      this.scene.fog.density = 0.0035;
    } else if (sceneId === 'cyberpunk_tunnel') {
      this.scene.background = new THREE.Color('#05050b');
      this.scene.fog.color.set('#090614');
      this.scene.fog.density = 0.008;
    } else if (sceneId === 'night_runway') {
      this.scene.background = new THREE.Color('#040710');
      this.scene.fog.color.set('#060b16');
      this.scene.fog.density = 0.006;
    } else if (sceneId !== 'outdoor_world') {
      this.scene.background = new THREE.Color('#070a12');
      this.scene.fog.color.set('#070a12');
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
    this.ambientLight.intensity = s.ambientIntensity;

    this.renderer.toneMappingExposure = s.exposure;

    if (this.studioFloorMat) {
      this.studioFloorMat.roughness = THREE.MathUtils.clamp(1.0 - s.floorWetness * 0.9, 0.04, 0.85);
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
      this.sweepLight.intensity = 1.8 + this.beatPulse * 2.5;
    } else {
      this.sweepLight.intensity = 0;
    }

    // 2. Beat-sync pulse on rim light & studio neon bars
    this.rimLight.intensity = this.state.rimIntensity + this.beatPulse * 2.8;

    // 3. Animate Cyberpunk Tunnel arches if visible
    if (this.cyberTunnelGroup.visible && speedActive) {
      for (let i = 0; i < this.tunnelArches.length; i++) {
        const arch = this.tunnelArches[i];
        arch.position.z += dt * 32.0;
        if (arch.position.z > 95) arch.position.z -= 192;
      }
    }

    // 4. Animate Flight Cloud Deck if visible
    if (this.cloudDeckGroup.visible) {
      for (let i = 0; i < this.flightClouds.length; i++) {
        const c = this.flightClouds[i];
        c.position.z += dt * 24.0;
        if (c.position.z > 110) c.position.z = -110;
      }
    }

    // 5. Animate Runway sequential approach strobes
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

import * as THREE from 'three';

export class VehicleDynamics {
  constructor(scene) {
    this.scene = scene;
    this.fxGroup = new THREE.Group();
    this.fxGroup.name = 'VehicleDynamicsFX';
    this.scene.add(this.fxGroup);

    this.state = {
      headlightsOn: true,
      wheelSpin: true,
      aeroStreamlines: false,
      planeBanking: true,
      planeContrails: true,
      planeStrobes: true,
    };

    this.wheelMeshes = [];
    this.currentMode = 'cars'; // 'cars' | 'planes'
    this.subjectRoot = null;
    this.bounds = { w: 2.2, h: 1.4, d: 4.8 };

    this._buildHeadlightsAndStrobes();
    this._buildAeroStreamlines();
    this._buildPlaneContrails();
  }

  _buildHeadlightsAndStrobes() {
    this.lightsRig = new THREE.Group();
    this.fxGroup.add(this.lightsRig);

    // Front left & right headlight spotlights + flare sprites
    this.headlightL = new THREE.SpotLight('#fffbeb', 6.5, 45, Math.PI / 5, 0.45, 1.2);
    this.headlightR = new THREE.SpotLight('#fffbeb', 6.5, 45, Math.PI / 5, 0.45, 1.2);
    this.headlightTargetL = new THREE.Object3D();
    this.headlightTargetR = new THREE.Object3D();
    this.lightsRig.add(
      this.headlightL,
      this.headlightR,
      this.headlightTargetL,
      this.headlightTargetR
    );
    this.headlightL.target = this.headlightTargetL;
    this.headlightR.target = this.headlightTargetR;

    const flareGeo = new THREE.SphereGeometry(0.09, 12, 12);
    const frontFlareMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const rearFlareMat = new THREE.MeshBasicMaterial({ color: '#ff1e1e' });

    this.flareFL = new THREE.Mesh(flareGeo, frontFlareMat);
    this.flareFR = new THREE.Mesh(flareGeo, frontFlareMat);
    this.flareRL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.06), rearFlareMat);
    this.flareRR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.06, 0.06), rearFlareMat);

    // Plane Wingtip Navigation Lights (Port Red, Starboard Green, Strobe White)
    this.navPort = new THREE.PointLight('#ef4444', 4.0, 12);
    this.navStarboard = new THREE.PointLight('#22c55e', 4.0, 12);
    this.strobeTail = new THREE.PointLight('#ffffff', 8.0, 22);

    const navSphere = new THREE.SphereGeometry(0.16, 10, 10);
    this.navPortMesh = new THREE.Mesh(navSphere, new THREE.MeshBasicMaterial({ color: '#ff2222' }));
    this.navStarboardMesh = new THREE.Mesh(navSphere, new THREE.MeshBasicMaterial({ color: '#22ff55' }));
    this.strobeWingL = new THREE.Mesh(navSphere, new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    this.strobeWingR = new THREE.Mesh(navSphere, new THREE.MeshBasicMaterial({ color: '#ffffff' }));

    this.lightsRig.add(
      this.flareFL,
      this.flareFR,
      this.flareRL,
      this.flareRR,
      this.navPort,
      this.navStarboard,
      this.strobeTail,
      this.navPortMesh,
      this.navStarboardMesh,
      this.strobeWingL,
      this.strobeWingR
    );
  }

  _buildAeroStreamlines() {
    this.streamlinesGroup = new THREE.Group();
    this.streamlineMeshes = [];
    this.fxGroup.add(this.streamlinesGroup);

    const numLines = 13;
    for (let i = 0; i < numLines; i++) {
      const pts = [];
      for (let j = 0; j < 40; j++) {
        pts.push(new THREE.Vector3(0, 1, (j / 39 - 0.5) * 12));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.TubeGeometry(curve, 48, 0.022, 6, false);
      const mat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? '#38bdf8' : '#e0f2fe',
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      this.streamlinesGroup.add(mesh);
      this.streamlineMeshes.push({ mesh, index: i, total: numLines });
    }
    this.streamlinesGroup.visible = false;
  }

  _buildPlaneContrails() {
    this.contrailsGroup = new THREE.Group();
    this.fxGroup.add(this.contrailsGroup);

    const count = 900;
    const positions = new Float32Array(count * 3);
    this.contrailData = [];

    for (let i = 0; i < count; i++) {
      const streamIdx = i % 4; // 4 engine / wingtip emitters
      const progress = (i / count);
      this.contrailData.push({ streamIdx, progress });
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 1;
      positions[i * 3 + 2] = 0;
    }

    const puffCanvas = document.createElement('canvas');
    puffCanvas.width = 64;
    puffCanvas.height = 64;
    const ctx = puffCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255,255,255,0.65)');
    grad.addColorStop(0.5, 'rgba(224,242,254,0.32)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.contrailMat = new THREE.PointsMaterial({
      size: 1.4,
      map: new THREE.CanvasTexture(puffCanvas),
      transparent: true,
      opacity: 0.52,
      depthWrite: false,
    });
    this.contrailPoints = new THREE.Points(geo, this.contrailMat);
    this.contrailsGroup.add(this.contrailPoints);
    this.contrailsGroup.visible = false;
  }

  bindSubject(subjectRoot, mode, bounds) {
    this.subjectRoot = subjectRoot;
    this.currentMode = mode;
    this.bounds = bounds || { w: 2.2, h: 1.4, d: 4.8 };
    this.wheelMeshes = [];

    if (!subjectRoot) return;

    // Detect wheel / tire / rim meshes heuristically for rotation
    subjectRoot.traverse((obj) => {
      if (obj.isMesh) {
        const n = (obj.name || '').toLowerCase();
        const p = (obj.parent?.name || '').toLowerCase();
        if (
          n.includes('wheel') ||
          n.includes('tire') ||
          n.includes('tyre') ||
          n.includes('rim') ||
          p.includes('wheel')
        ) {
          this.wheelMeshes.push(obj);
        }
      }
    });

    const { w, h, d } = this.bounds;
    const halfW = w * 0.36;
    const frontZ = -d * 0.47;
    const rearZ = d * 0.47;
    const lightY = Math.max(0.42, h * 0.38);

    // Position headlights & taillights relative to normalized subject bounds
    this.headlightL.position.set(halfW, lightY, frontZ);
    this.headlightR.position.set(-halfW, lightY, frontZ);
    this.headlightTargetL.position.set(halfW * 1.1, 0.1, frontZ - 18);
    this.headlightTargetR.position.set(-halfW * 1.1, 0.1, frontZ - 18);

    this.flareFL.position.set(halfW, lightY, frontZ - 0.04);
    this.flareFR.position.set(-halfW, lightY, frontZ - 0.04);
    this.flareRL.position.set(halfW * 0.95, lightY * 1.08, rearZ + 0.04);
    this.flareRR.position.set(-halfW * 0.95, lightY * 1.08, rearZ + 0.04);

    // Position Plane wingtip navigation lights
    const wingTipX = w * 0.49;
    const wingTipY = h * 0.44;
    const wingTipZ = d * 0.06;
    this.navPort.position.set(wingTipX, wingTipY, wingTipZ);
    this.navPortMesh.position.copy(this.navPort.position);
    this.strobeWingL.position.set(wingTipX, wingTipY + 0.08, wingTipZ + 0.2);

    this.navStarboard.position.set(-wingTipX, wingTipY, wingTipZ);
    this.navStarboardMesh.position.copy(this.navStarboard.position);
    this.strobeWingR.position.set(-wingTipX, wingTipY + 0.08, wingTipZ + 0.2);

    this.strobeTail.position.set(0, h * 0.92, d * 0.48);

    this.rebuildStreamlineCurves(0);
  }

  rebuildStreamlineCurves(elapsed) {
    const { w, h, d } = this.bounds;
    this.streamlineMeshes.forEach(({ mesh, index, total }) => {
      const frac = index / (total - 1) - 0.5; // -0.5 .. +0.5
      const xBase = frac * w * 0.78;
      const pts = [];
      for (let j = 0; j < 36; j++) {
        const u = j / 35; // 0 (in front at -Z) to 1 (behind at +Z)
        const z = (u - 0.5) * d * 1.65;
        // Arch smoothly over the car/plane profile
        const bodyEnvelope = Math.exp(-Math.pow((u - 0.52) / 0.26, 2));
        const centerLift = (1.0 - Math.abs(frac) * 1.15) * h * 0.95 * bodyEnvelope;
        const wave = Math.sin(u * 14.0 - elapsed * 9.0 + index) * 0.045;
        const y = Math.max(0.18, 0.35 + centerLift + wave);
        const x = xBase * (1.0 + bodyEnvelope * 0.12) + Math.cos(u * 10.0 - elapsed * 7.0) * 0.03;
        pts.push(new THREE.Vector3(x, y, z));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      mesh.geometry.dispose();
      mesh.geometry = new THREE.TubeGeometry(curve, 40, 0.02, 5, false);
    });
  }

  applyState(partial) {
    this.state = { ...this.state, ...partial };
  }

  update(dt, elapsed, roadTexture, activeSceneId) {
    const s = this.state;
    const isPlane = this.currentMode === 'planes';

    // 1. Headlights & Plane Navigation Strobes visibility
    this.headlightL.visible = s.headlightsOn;
    this.headlightR.visible = s.headlightsOn;
    this.flareFL.visible = s.headlightsOn;
    this.flareFR.visible = s.headlightsOn;
    this.flareRL.visible = s.headlightsOn && !isPlane;
    this.flareRR.visible = s.headlightsOn && !isPlane;

    const showPlaneLights = isPlane && s.planeStrobes;
    this.navPort.visible = showPlaneLights;
    this.navStarboard.visible = showPlaneLights;
    this.navPortMesh.visible = showPlaneLights;
    this.navStarboardMesh.visible = showPlaneLights;

    // Double-flash aviation anti-collision strobe pattern
    const strobeCycle = elapsed % 1.4;
    const strobeOn =
      showPlaneLights &&
      ((strobeCycle > 0.0 && strobeCycle < 0.08) || (strobeCycle > 0.16 && strobeCycle < 0.24));
    this.strobeTail.visible = strobeOn;
    this.strobeWingL.visible = strobeOn;
    this.strobeWingR.visible = strobeOn;

    // 2. Road texture scroll when wheelSpin / motion is active
    if (s.wheelSpin && roadTexture) {
      roadTexture.offset.y -= dt * 3.6;
    }

    // 3. Plane Banking & Pitch Dynamics
    if (this.subjectRoot) {
      if (isPlane && s.planeBanking) {
        const roll = Math.sin(elapsed * 0.85) * 0.14;
        const pitch = Math.sin(elapsed * 0.55) * 0.045 + (activeSceneId === 'cloud_deck' ? 0.05 : 0);
        const bobY = activeSceneId === 'cloud_deck' ? 1.8 + Math.sin(elapsed * 1.1) * 0.35 : 0;
        this.subjectRoot.rotation.z = roll;
        this.subjectRoot.rotation.x = pitch;
        this.subjectRoot.position.y = bobY;
        this.lightsRig.rotation.copy(this.subjectRoot.rotation);
        this.lightsRig.position.copy(this.subjectRoot.position);
      } else {
        this.subjectRoot.rotation.set(0, 0, 0);
        this.subjectRoot.position.y = 0;
        this.lightsRig.rotation.set(0, 0, 0);
        this.lightsRig.position.set(0, 0, 0);
      }
    }

    // 4. Aero Wind Tunnel Streamlines
    const showAero = s.aeroStreamlines || activeSceneId === 'wind_tunnel';
    this.streamlinesGroup.visible = showAero;
    if (showAero) {
      this.rebuildStreamlineCurves(elapsed);
    }

    // 5. Plane Jet Engine & Wingtip Contrails
    const showContrails = isPlane && s.planeContrails;
    this.contrailsGroup.visible = showContrails;
    if (showContrails) {
      const { w, h, d } = this.bounds;
      const emitters = [
        new THREE.Vector3(w * 0.22, h * 0.32, d * 0.08),
        new THREE.Vector3(-w * 0.22, h * 0.32, d * 0.08),
        new THREE.Vector3(w * 0.48, h * 0.44, d * 0.14),
        new THREE.Vector3(-w * 0.48, h * 0.44, d * 0.14),
      ];
      const pos = this.contrailPoints.geometry.attributes.position;
      for (let i = 0; i < this.contrailData.length; i++) {
        const item = this.contrailData[i];
        item.progress = (item.progress + dt * 0.65) % 1.0;
        const p = item.progress;
        const em = emitters[item.streamIdx];
        const spread = p * 1.25;
        const x = em.x + Math.sin(elapsed * 4.0 + i) * spread * 0.35;
        const y =
          em.y +
          (this.subjectRoot ? this.subjectRoot.position.y : 0) +
          Math.cos(elapsed * 3.0 + i) * spread * 0.25;
        const z = em.z + p * d * 1.8;
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }
  }
}

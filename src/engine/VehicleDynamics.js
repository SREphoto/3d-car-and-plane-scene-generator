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

    this.spinnableWheels = [];
    this.currentMode = 'cars'; // 'cars' | 'planes' | 'parts'
    this.subjectRoot = null;
    this.subjectHolder = null;
    this.bounds = { w: 2.2, h: 1.4, d: 4.8 };

    this._buildHeadlightsAndStrobes();
    this._buildPlaneContrails();
  }

  _buildHeadlightsAndStrobes() {
    this.lightsRig = new THREE.Group();
    this.fxGroup.add(this.lightsRig);

    // Front left & right automotive headlight spotlights (5600K LED/Xenon road throw)
    this.headlightL = new THREE.SpotLight('#f8fafc', 3.4, 42, Math.PI / 5.2, 0.65, 1.6);
    this.headlightR = new THREE.SpotLight('#f8fafc', 3.4, 42, Math.PI / 5.2, 0.65, 1.6);
    this.headlightL.castShadow = true;
    this.headlightR.castShadow = true;
    this.headlightL.shadow.mapSize.set(512, 512);
    this.headlightR.shadow.mapSize.set(512, 512);
    this.headlightL.shadow.bias = -0.0005;
    this.headlightR.shadow.bias = -0.0005;

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

    // Subtle rear taillight ground bounce illumination
    this.taillightL = new THREE.PointLight('#dc2626', 0.75, 3.6, 2.0);
    this.taillightR = new THREE.PointLight('#dc2626', 0.75, 3.6, 2.0);
    this.lightsRig.add(this.taillightL, this.taillightR);

    // Plane Wingtip Navigation Lights (Port Red, Starboard Green, Strobe White)
    this.navPort = new THREE.PointLight('#ef4444', 2.5, 8);
    this.navStarboard = new THREE.PointLight('#22c55e', 2.5, 8);
    this.strobeTail = new THREE.PointLight('#ffffff', 4.0, 14);

    const navSphere = new THREE.SphereGeometry(0.08, 8, 8);
    this.navPortMesh = new THREE.Mesh(navSphere, new THREE.MeshBasicMaterial({ color: '#ef4444' }));
    this.navStarboardMesh = new THREE.Mesh(navSphere, new THREE.MeshBasicMaterial({ color: '#22c55e' }));
    this.strobeWingL = new THREE.Mesh(navSphere, new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    this.strobeWingR = new THREE.Mesh(navSphere, new THREE.MeshBasicMaterial({ color: '#ffffff' }));

    this.lightsRig.add(
      this.navPort,
      this.navStarboard,
      this.strobeTail,
      this.navPortMesh,
      this.navStarboardMesh,
      this.strobeWingL,
      this.strobeWingR
    );
  }

  _buildPlaneContrails() {
    this.contrailsGroup = new THREE.Group();
    this.fxGroup.add(this.contrailsGroup);

    const count = 900;
    const positions = new Float32Array(count * 3);
    this.contrailData = [];

    for (let i = 0; i < count; i++) {
      const streamIdx = i % 4;
      const progress = i / count;
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

  bindSubject(subjectRoot, mode, bounds, subjectHolder = null) {
    this.subjectRoot = subjectRoot;
    this.subjectHolder = subjectHolder;
    this.currentMode = mode;
    this.bounds = bounds || { w: 2.2, h: 1.4, d: 4.8 };
    this.spinnableWheels = [];

    if (!subjectRoot) return;

    // Only spin individual wheel/tire meshes whose local geometry pivot is centered at the hub
    // (prevents Ferris-wheel orbiting on merged chassis-origin wheel meshes)
    const tmpBox = new THREE.Box3();
    const tmpCenter = new THREE.Vector3();
    const tmpSize = new THREE.Vector3();
    subjectRoot.traverse((obj) => {
      if (obj.isMesh && obj.geometry) {
        const n = (obj.name || '').toLowerCase();
        if (n.includes('steering')) return;
        if (n.includes('wheel') || n.includes('tire') || n.includes('tyre') || n.includes('rim')) {
          obj.geometry.computeBoundingBox();
          if (obj.geometry.boundingBox) {
            tmpBox.copy(obj.geometry.boundingBox);
            tmpBox.getCenter(tmpCenter);
            tmpBox.getSize(tmpSize);
            // Hub-centered single wheel check: local geometry center near (0,0,0) and width < 45% of car
            if (tmpCenter.length() < Math.max(tmpSize.y, tmpSize.z) * 0.18 && tmpSize.x < this.bounds.w * 0.45) {
              this.spinnableWheels.push({
                mesh: obj,
                radius: Math.max(0.24, Math.max(tmpSize.y, tmpSize.z) * 0.5),
              });
            }
          }
        }
      }
    });

    const { w, h, d } = this.bounds;
    const halfW = w * 0.36;
    const frontZ = -d * 0.47;
    const rearZ = d * 0.47;
    const lightY = Math.max(0.42, h * 0.38);

    // Position headlights & taillights in subjectHolder's local canonical (-Z forward) frame
    this.headlightL.position.set(halfW, lightY, frontZ);
    this.headlightR.position.set(-halfW, lightY, frontZ);
    this.headlightTargetL.position.set(halfW * 1.05, 0.02, frontZ - 22);
    this.headlightTargetR.position.set(-halfW * 1.05, 0.02, frontZ - 22);

    this.taillightL.position.set(halfW * 0.85, Math.max(0.22, lightY * 0.7), rearZ + 0.35);
    this.taillightR.position.set(-halfW * 0.85, Math.max(0.22, lightY * 0.7), rearZ + 0.35);

    // Plane wingtip navigation lights (Port = Left -X Red, Starboard = Right +X Green in -Z forward frame)
    const wingTipX = w * 0.49;
    const wingTipY = h * 0.44;
    const wingTipZ = d * 0.06;
    this.navPort.position.set(-wingTipX, wingTipY, wingTipZ);
    this.navPortMesh.position.copy(this.navPort.position);
    this.strobeWingL.position.set(-wingTipX, wingTipY + 0.08, wingTipZ + 0.2);

    this.navStarboard.position.set(wingTipX, wingTipY, wingTipZ);
    this.navStarboardMesh.position.copy(this.navStarboard.position);
    this.strobeWingR.position.set(wingTipX, wingTipY + 0.08, wingTipZ + 0.2);

    this.strobeTail.position.set(0, h * 0.92, d * 0.48);
  }

  setHeadlights(enabled) {
    this.state.headlightsOn = Boolean(enabled);
  }

  applyState(partial) {
    this.state = { ...this.state, ...partial };
  }

  update(dt, elapsed, roadTexture, activeSceneId, driveSpeed = 0) {
    const s = this.state;
    const isPlane = this.currentMode === 'planes';
    const isPart = this.currentMode === 'parts';

    // Synchronize FX group pose with movable subjectHolder so lights & contrails move with the vehicle!
    if (this.subjectHolder) {
      this.fxGroup.position.copy(this.subjectHolder.position);
      this.fxGroup.quaternion.copy(this.subjectHolder.quaternion);
    }

    // 1. Headlights & Taillights visibility
    const showCarLights = s.headlightsOn && !isPart;
    this.headlightL.visible = showCarLights;
    this.headlightR.visible = showCarLights;
    this.taillightL.visible = showCarLights && !isPlane;
    this.taillightR.visible = showCarLights && !isPlane;

    const showPlaneLights = isPlane && s.planeStrobes;
    this.navPort.visible = showPlaneLights;
    this.navStarboard.visible = showPlaneLights;
    this.navPortMesh.visible = showPlaneLights;
    this.navStarboardMesh.visible = showPlaneLights;

    const strobeCycle = elapsed % 1.4;
    const strobeOn =
      showPlaneLights &&
      ((strobeCycle > 0.0 && strobeCycle < 0.08) || (strobeCycle > 0.16 && strobeCycle < 0.24));
    this.strobeTail.visible = strobeOn;
    this.strobeWingL.visible = strobeOn;
    this.strobeWingR.visible = strobeOn;

    // 2. Road texture scroll + hub-centered wheel spin
    if (s.wheelSpin && roadTexture && activeSceneId === 'outdoor_world') {
      roadTexture.offset.y -= dt * 3.6;
    }

    if (!isPlane && !isPart && Math.abs(driveSpeed) > 0.03 && this.spinnableWheels.length > 0) {
      for (const w of this.spinnableWheels) {
        w.mesh.rotateX(-(driveSpeed / w.radius) * dt);
      }
    }

    // 3. Plane Banking & Pitch Dynamics
    if (this.subjectRoot) {
      if (isPlane && s.planeBanking && activeSceneId === 'cloud_deck') {
        const roll = Math.sin(elapsed * 0.85) * 0.14;
        const pitch = Math.sin(elapsed * 0.55) * 0.045 + 0.05;
        const bobY = 1.8 + Math.sin(elapsed * 1.1) * 0.35;
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

    // 4. Plane Jet Engine & Wingtip Contrails (only in flight scenes or when airborne)
    const isAirborne =
      activeSceneId === 'cloud_deck' ||
      (this.subjectHolder && this.subjectHolder.position.y > 0.75);
    const showContrails = isPlane && s.planeContrails && isAirborne;
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
      const rootBob = this.subjectRoot ? this.subjectRoot.position.y : 0;
      for (let i = 0; i < this.contrailData.length; i++) {
        const item = this.contrailData[i];
        item.progress = (item.progress + dt * 0.65) % 1.0;
        const p = item.progress;
        const em = emitters[item.streamIdx];
        const spread = p * 1.25;
        const x = em.x + Math.sin(elapsed * 4.0 + i) * spread * 0.35;
        const y = em.y + rootBob + Math.cos(elapsed * 3.0 + i) * spread * 0.25;
        const z = em.z + p * d * 1.8;
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }
  }
}

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
      planeLandingGearRetracted: false,
      planeLandingLights: true,
      planeBeacons: true,
      planeAfterburner: false,
    };

    this.spinnableWheels = [];
    this.landingGearParts = [];
    this.gearRetractProgress = 0; // 0 = extended, 1 = retracted
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

    // Anti-Collision Red Beacons (Top & Belly)
    this.beaconTop = new THREE.PointLight('#ff1e38', 3.6, 12, 1.8);
    this.beaconBelly = new THREE.PointLight('#ff1e38', 2.8, 10, 1.8);
    const beaconGeo = new THREE.SphereGeometry(0.11, 10, 10);
    this.beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(14.0, 0.8, 1.2) });
    this.beaconTopMesh = new THREE.Mesh(beaconGeo, this.beaconMat);
    this.beaconBellyMesh = new THREE.Mesh(beaconGeo, this.beaconMat);
    this.lightsRig.add(this.beaconTop, this.beaconBelly, this.beaconTopMesh, this.beaconBellyMesh);

    // Plane Landing / Taxi Lights + Soft Volumetric Beam Cones
    this.landingLightL = new THREE.SpotLight('#fffbeb', 6.5, 48, Math.PI / 7.5, 0.55, 1.4);
    this.landingLightR = new THREE.SpotLight('#fffbeb', 6.5, 48, Math.PI / 7.5, 0.55, 1.4);
    this.landingTargetL = new THREE.Object3D();
    this.landingTargetR = new THREE.Object3D();
    this.landingLightL.target = this.landingTargetL;
    this.landingLightR.target = this.landingTargetR;

    const coneGeo = new THREE.ConeGeometry(1.1, 6.5, 20, 1, true);
    coneGeo.translate(0, -3.25, 0);
    coneGeo.rotateX(Math.PI / 2);
    this.landingConeMat = new THREE.MeshBasicMaterial({
      color: '#fef9c3',
      transparent: true,
      opacity: 0.085,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.landingConeL = new THREE.Mesh(coneGeo, this.landingConeMat);
    this.landingConeR = new THREE.Mesh(coneGeo, this.landingConeMat);
    this.lightsRig.add(
      this.landingLightL,
      this.landingLightR,
      this.landingTargetL,
      this.landingTargetR,
      this.landingConeL,
      this.landingConeR
    );

    // Jet Afterburner / Engine Exhaust Glow
    const abGeo = new THREE.ConeGeometry(0.32, 2.2, 16, 1, true);
    abGeo.rotateX(Math.PI / 2);
    this.afterburnerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(5.5, 2.8, 0.6),
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.afterburnerL = new THREE.Mesh(abGeo, this.afterburnerMat);
    this.afterburnerR = new THREE.Mesh(abGeo, this.afterburnerMat);
    this.afterburnerLight = new THREE.PointLight('#fb923c', 5.0, 16, 1.6);
    this.lightsRig.add(this.afterburnerL, this.afterburnerR, this.afterburnerLight);
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
    this.landingGearParts = [];
    this.gearRetractProgress = this.state.planeLandingGearRetracted ? 1 : 0;

    if (!subjectRoot) return;

    // Only spin individual wheel/tire meshes whose local geometry pivot is centered at the hub
    // (prevents Ferris-wheel orbiting on merged chassis-origin wheel meshes)
    const tmpBox = new THREE.Box3();
    const tmpCenter = new THREE.Vector3();
    const tmpSize = new THREE.Vector3();
    const gearRe = /\b(gear|landing|strut|bogie|undercarriage|nosegear|maingear|wheel|tire|tyre)\b|landing_gear|nose_gear|main_gear/i;
    subjectRoot.traverse((obj) => {
      if (obj.isMesh && obj.geometry) {
        const n = (obj.name || '').toLowerCase();
        const pName = (obj.parent?.name || '').toLowerCase();
        if (n.includes('steering')) return;

        if (mode === 'planes' && (gearRe.test(n) || gearRe.test(pName))) {
          tmpBox.setFromObject(obj);
          tmpBox.getCenter(tmpCenter);
          tmpBox.getSize(tmpSize);
          // Only retract lower-body gear parts (below mid-fuselage) so wings/fuselage are never touched
          if (tmpCenter.y < this.bounds.h * 0.45 && tmpSize.length() < this.bounds.w * 0.45) {
            this.landingGearParts.push({
              mesh: obj,
              origPos: obj.position.clone(),
              origRot: obj.rotation.clone(),
              origScale: obj.scale.clone(),
              origVisible: obj.visible,
              sideSign: tmpCenter.x >= 0 ? 1 : -1,
            });
          }
        }

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

    // Anti-collision beacons (top spine & belly)
    this.beaconTop.position.set(0, h * 0.85, -d * 0.05);
    this.beaconTopMesh.position.copy(this.beaconTop.position);
    this.beaconBelly.position.set(0, Math.max(0.15, h * 0.14), d * 0.08);
    this.beaconBellyMesh.position.copy(this.beaconBelly.position);

    // Landing / taxi lights & volumetric cones
    const landX = w * 0.14;
    const landY = Math.max(0.28, h * 0.34);
    const landZ = -d * 0.32;
    this.landingLightL.position.set(-landX, landY, landZ);
    this.landingLightR.position.set(landX, landY, landZ);
    this.landingTargetL.position.set(-landX * 1.1, -1.4, landZ - 18);
    this.landingTargetR.position.set(landX * 1.1, -1.4, landZ - 18);
    this.landingConeL.position.set(-landX, landY, landZ);
    this.landingConeR.position.set(landX, landY, landZ);
    this.landingConeL.lookAt(this.landingTargetL.position);
    this.landingConeR.lookAt(this.landingTargetR.position);

    // Afterburner / jet exhaust glow
    const abX = w * 0.11;
    const abY = Math.max(0.35, h * 0.42);
    const abZ = d * 0.48;
    this.afterburnerL.position.set(-abX, abY, abZ + 0.95);
    this.afterburnerR.position.set(abX, abY, abZ + 0.95);
    this.afterburnerLight.position.set(0, abY, abZ + 1.2);
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

    // Anti-collision red beacons (pulsing 0.9s sweep)
    const showBeacons = isPlane && Boolean(s.planeBeacons);
    const beaconPulse = showBeacons ? Math.pow(Math.max(0, Math.sin(elapsed * 4.2)), 4.0) : 0;
    this.beaconTop.visible = showBeacons && beaconPulse > 0.08;
    this.beaconBelly.visible = showBeacons && beaconPulse > 0.08;
    this.beaconTop.intensity = beaconPulse * 5.2;
    this.beaconBelly.intensity = beaconPulse * 3.8;
    this.beaconTopMesh.visible = showBeacons;
    this.beaconBellyMesh.visible = showBeacons;
    this.beaconMat.color.setRGB(1.5 + beaconPulse * 14.0, 0.1 + beaconPulse * 0.8, 0.15 + beaconPulse * 1.1);

    // Plane Landing / Taxi Lights + Volumetric Cones
    const showLanding = isPlane && Boolean(s.planeLandingLights) && !s.planeLandingGearRetracted;
    this.landingLightL.visible = showLanding;
    this.landingLightR.visible = showLanding;
    this.landingConeL.visible = showLanding;
    this.landingConeR.visible = showLanding;

    // Plane Afterburner / Jet Exhaust Glow
    const showAfterburner = isPlane && Boolean(s.planeAfterburner);
    this.afterburnerL.visible = showAfterburner;
    this.afterburnerR.visible = showAfterburner;
    this.afterburnerLight.visible = showAfterburner;
    if (showAfterburner) {
      const flicker = 0.85 + Math.sin(elapsed * 38.0) * 0.15 + Math.cos(elapsed * 23.0) * 0.08;
      this.afterburnerL.scale.set(1, 1, flicker);
      this.afterburnerR.scale.set(1, 1, flicker);
      this.afterburnerLight.intensity = 4.5 * flicker;
      this.afterburnerMat.opacity = 0.62 * flicker;
    }

    // 1b. Landing Gear Retraction Animation (planes)
    if (isPlane && this.landingGearParts.length > 0) {
      const targetGear = s.planeLandingGearRetracted ? 1 : 0;
      this.gearRetractProgress = THREE.MathUtils.lerp(
        this.gearRetractProgress,
        targetGear,
        Math.min(1, dt * 3.5)
      );
      const p = this.gearRetractProgress;
      const hidden = p > 0.96;
      for (const g of this.landingGearParts) {
        g.mesh.visible = g.origVisible && !hidden;
        if (!hidden) {
          // Fold upward & inward into fuselage/wing bays
          g.mesh.position.set(
            g.origPos.x * (1 - p * 0.25),
            g.origPos.y + p * 0.42,
            g.origPos.z + p * 0.22
          );
          g.mesh.rotation.x = g.origRot.x + p * 1.25;
          g.mesh.rotation.z = g.origRot.z + g.sideSign * p * 0.35;
          const sc = 1 - p * 0.45;
          g.mesh.scale.set(g.origScale.x * sc, g.origScale.y * sc, g.origScale.z * sc);
        }
      }
    }

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
    const isAirborne =
      activeSceneId === 'cloud_deck' ||
      (this.subjectHolder && this.subjectHolder.position.y > 0.25) ||
      Boolean(s.planeLandingGearRetracted);
    if (this.subjectRoot) {
      if (isPlane && s.planeBanking && isAirborne) {
        const roll = Math.sin(elapsed * 0.85) * 0.14;
        const pitch = Math.sin(elapsed * 0.55) * 0.045 + 0.05;
        const bobY = (activeSceneId === 'cloud_deck' ? 1.8 : 0.35) + Math.sin(elapsed * 1.1) * 0.28;
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

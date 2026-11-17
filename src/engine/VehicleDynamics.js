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
    };

    this.spinnableWheels = [];
    this.currentMode = 'cars'; // 'cars' | 'planes' | 'parts'
    this.subjectRoot = null;
    this.subjectHolder = null;
    this.bounds = { w: 2.2, h: 1.4, d: 4.8 };

    this._buildHeadlights();
  }

  _buildHeadlights() {
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

    // Synchronize FX group pose with movable subjectHolder so lights move with the vehicle
    if (this.subjectHolder) {
      this.fxGroup.position.copy(this.subjectHolder.position);
      this.fxGroup.quaternion.copy(this.subjectHolder.quaternion);
    }

    // 1. Headlights & Taillights visibility (automotive only; no synthetic plane lights)
    const showCarLights = s.headlightsOn && !isPlane && !isPart;
    this.headlightL.visible = showCarLights;
    this.headlightR.visible = showCarLights;
    this.taillightL.visible = showCarLights;
    this.taillightR.visible = showCarLights;

    // 2. Road texture scroll + hub-centered wheel spin
    if (s.wheelSpin && roadTexture && activeSceneId === 'outdoor_world') {
      roadTexture.offset.y -= dt * 3.6;
    }

    if (!isPlane && !isPart && Math.abs(driveSpeed) > 0.03 && this.spinnableWheels.length > 0) {
      for (const w of this.spinnableWheels) {
        w.mesh.rotateX(-(driveSpeed / w.radius) * dt);
      }
    }

    // 3. Gentle Plane Airborne Banking & Pitch Dynamics (subtle, composed movement)
    const isAirborne =
      activeSceneId === 'cloud_deck' ||
      (this.subjectHolder && this.subjectHolder.position.y > 0.25);
    if (this.subjectRoot) {
      if (isPlane && s.planeBanking && isAirborne) {
        const roll = Math.sin(elapsed * 0.52) * 0.042;
        const pitch = Math.sin(elapsed * 0.38) * 0.014 + 0.018;
        const bobY = (activeSceneId === 'cloud_deck' ? 1.5 : 0.28) + Math.sin(elapsed * 0.68) * 0.075;
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
  }
}

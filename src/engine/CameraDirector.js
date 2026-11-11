import * as THREE from 'three';

const ENCLOSED_SCENES = new Set([
  'car_garage',
  'red_bull_f1_garage',
  'f1_pit_garage',
  'interior_7',
  'abandoned_vr_gallery',
  'building_interior_scan',
  'cyberpunk_garage',
  'desert_workshop_garage',
  'architectural_exhibition_hall',
  'catwalk',
]);

export class CameraDirector {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;

    this.activeShotId = 'free_orbit';
    this.shotSpeed = 1.0;
    this.baseFov = 42;
    this.bounds = { w: 2.2, h: 1.4, d: 4.8 };
    this.subjectYOffset = 0;
    this.subjectHolder = null;
    this.sceneId = 'interior_7';

    // Multi-shot sequence state
    this.isPlayingSequence = false;
    this.sequence = [
      { id: 'seq-1', shotId: 'low_hero_pan', duration: 3.5 },
      { id: 'seq-2', shotId: 'vertigo_dolly_zoom', duration: 3.5 },
      { id: 'seq-3', shotId: 'crane_reveal', duration: 4.0 },
      { id: 'seq-4', shotId: 'orbit_360', duration: 4.5 },
    ];
    this.currentClipIndex = 0;
    this.clipElapsed = 0;
    this.shotElapsed = 0;
    this.beatCutCooldown = 0;

    this.onShotChangeCallback = null;

    this._localCam = new THREE.Vector3();
    this._localTarget = new THREE.Vector3();
    this._yAxis = new THREE.Vector3(0, 1, 0);
  }

  bindSubjectHolder(holder) {
    this.subjectHolder = holder;
  }

  _applySubjectFrame(localCam, localTarget) {
    if (!this.subjectHolder) {
      this.camera.position.copy(localCam);
      this.controls.target.copy(localTarget);
      return;
    }
    const pos = this.subjectHolder.position;
    const yaw = this.subjectHolder.rotation.y;
    this._localCam.copy(localCam).applyAxisAngle(this._yAxis, yaw).add(pos);
    this._localTarget.copy(localTarget).applyAxisAngle(this._yAxis, yaw).add(pos);
    this.camera.position.copy(this._localCam);
    this.controls.target.copy(this._localTarget);
  }

  setSceneId(sceneId) {
    this.sceneId = sceneId;
    if (sceneId === 'car_garage' || sceneId === 'red_bull_f1_garage' || sceneId === 'f1_pit_garage') {
      this.controls.maxDistance = 8.5;
      this.controls.minDistance = 1.0;
      this.controls.maxPolarAngle = Math.PI * 0.495;
    } else if (sceneId === 'interior_7') {
      this.controls.maxDistance = 9.0;
      this.controls.minDistance = 1.0;
      this.controls.maxPolarAngle = Math.PI * 0.495;
    } else if (sceneId === 'abandoned_vr_gallery' || sceneId === 'building_interior_scan') {
      this.controls.maxDistance = 10.5;
      this.controls.minDistance = 1.0;
      this.controls.maxPolarAngle = Math.PI * 0.495;
    } else if (sceneId === 'cyberpunk_garage' || sceneId === 'desert_workshop_garage' || sceneId === 'catwalk') {
      this.controls.maxDistance = 14.0;
      this.controls.minDistance = 1.0;
      this.controls.maxPolarAngle = Math.PI * 0.495;
    } else if (sceneId === 'wind_tunnel' || sceneId === 'architectural_exhibition_hall') {
      this.controls.maxDistance = 24.0;
      this.controls.minDistance = 1.2;
      this.controls.maxPolarAngle = Math.PI * 0.495;
    } else {
      this.controls.maxDistance = 420;
      this.controls.minDistance = 1.2;
      this.controls.maxPolarAngle = Math.PI * 0.495;
    }
    if (this.activeShotId === 'free_orbit') {
      this.resetToHeroIso();
    }
  }

  setBounds(bounds, mode = 'cars') {
    this.bounds = bounds || { w: 2.2, h: 1.4, d: 4.8 };
    this.mode = mode;
    if (this.activeShotId === 'free_orbit') {
      this.resetToHeroIso();
    }
  }

  resetToHeroIso() {
    const { w, h, d } = this.bounds;
    const span = Math.max(w, d);
    const hMid = h * 0.48 + this.subjectYOffset;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();

    const localCam = new THREE.Vector3();
    const localTarget = new THREE.Vector3(0, hMid, 0);

    if (this.sceneId === 'interior_7') {
      localCam.set(3.4, Math.max(1.25, h * 0.95) + this.subjectYOffset, 1.2);
      localTarget.set(0, hMid, -0.4);
    } else if (
      this.sceneId === 'car_garage' ||
      this.sceneId === 'red_bull_f1_garage' ||
      this.sceneId === 'f1_pit_garage'
    ) {
      localCam.set(-3.6, Math.max(1.08, h * 0.9) + this.subjectYOffset, -3.5);
    } else if (this.sceneId === 'abandoned_vr_gallery' || this.sceneId === 'building_interior_scan') {
      localCam.set(-3.8, Math.max(1.18, h * 0.92) + this.subjectYOffset, -4.0);
    } else if (this.sceneId === 'wind_tunnel') {
      localCam.set(-4.2, Math.max(1.2, h * 0.95) + this.subjectYOffset, -4.6);
    } else if (this.sceneId === 'vatican_city' || this.sceneId === 'eglise_saint_polycarpe') {
      // Low architectural 3/4 hero angle tilted gently upward so St. Peter's Dome & heritage facades fill the upper frame
      localCam.set(-span * 1.02, Math.max(1.02, h * 0.78) + this.subjectYOffset, -span * 1.24);
      localTarget.set(0, Math.max(1.38, h * 1.08) + this.subjectYOffset, d * 0.12);
    } else if (
      this.sceneId === 'la_night_city' ||
      this.sceneId === 'canadian_downtown' ||
      this.sceneId === 'kent_lumber_yard' ||
      this.sceneId === 'construction_site'
    ) {
      // Cinema street-level 3/4 front-left hero framing
      localCam.set(-span * 0.95, Math.max(1.15, h * 0.88) + this.subjectYOffset, -span * 1.18);
      localTarget.set(0, hMid, -d * 0.08);
    } else {
      localCam.set(-span * 1.05, Math.max(1.15, h * 1.05) + this.subjectYOffset, -span * 1.25);
    }

    this._applySubjectFrame(localCam, localTarget);
    this.controls.update();
  }

  setShot(shotId) {
    this.activeShotId = shotId;
    this.shotElapsed = 0;
    this.controls.enabled = shotId === 'free_orbit';
    if (shotId === 'free_orbit') {
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
    }
    if (this.onShotChangeCallback) {
      this.onShotChangeCallback(shotId, this.isPlayingSequence, this.currentClipIndex);
    }
  }

  startSequence(customSequence = null) {
    if (customSequence && customSequence.length > 0) {
      this.sequence = customSequence;
    }
    this.isPlayingSequence = true;
    this.currentClipIndex = 0;
    this.clipElapsed = 0;
    this.setShot(this.sequence[0].shotId);
  }

  stopSequence() {
    this.isPlayingSequence = false;
    this.setShot('free_orbit');
  }

  triggerBeatCut() {
    if (!this.isPlayingSequence || this.sequence.length < 2) return;
    if (this.beatCutCooldown > 0) return;
    this.currentClipIndex = (this.currentClipIndex + 1) % this.sequence.length;
    this.clipElapsed = 0;
    this.beatCutCooldown = 1.35;
    this.setShot(this.sequence[this.currentClipIndex].shotId);
  }

  getTotalSequenceDuration() {
    return this.sequence.reduce((acc, c) => acc + (Number(c.duration) || 3.5), 0);
  }

  update(dt, subjectBobY = 0) {
    this.subjectYOffset = subjectBobY;
    if (this.beatCutCooldown > 0) {
      this.beatCutCooldown = Math.max(0, this.beatCutCooldown - dt);
    }

    if (this.isPlayingSequence && this.sequence.length > 0) {
      const currentClip = this.sequence[this.currentClipIndex];
      const clipDur = Math.max(1.0, Number(currentClip?.duration) || 3.5);
      this.clipElapsed += dt;
      if (this.clipElapsed >= clipDur) {
        this.clipElapsed = 0;
        this.currentClipIndex = (this.currentClipIndex + 1) % this.sequence.length;
        this.setShot(this.sequence[this.currentClipIndex].shotId);
      }
    }

    if (this.activeShotId === 'free_orbit') {
      this.controls.update();
      return;
    }

    this.shotElapsed += dt * this.shotSpeed;
    const t = this.shotElapsed;
    const { w, h, d } = this.bounds;
    const span = Math.max(w, d);
    const hMid = h * 0.45 + subjectBobY;

    const activeDur =
      this.isPlayingSequence && this.sequence[this.currentClipIndex]
        ? Math.max(1.5, Number(this.sequence[this.currentClipIndex].duration) || 4.0)
        : 5.0;
    const u = (this.shotElapsed % activeDur) / activeDur;
    const smoothU = u * u * (3.0 - 2.0 * u);

    const isEnclosed = ENCLOSED_SCENES.has(this.sceneId);
    const isTightGarage =
      this.sceneId === 'car_garage' ||
      this.sceneId === 'red_bull_f1_garage' ||
      this.sceneId === 'f1_pit_garage';

    const localCam = new THREE.Vector3();
    const localTarget = new THREE.Vector3(0, hMid, 0);

    switch (this.activeShotId) {
      case 'orbit_360': {
        const maxR = isTightGarage
          ? 3.9
          : this.sceneId === 'interior_7'
          ? 4.6
          : isEnclosed
          ? 4.8
          : span * 1.45;
        const radius = Math.min(span * 1.35, maxR);
        const maxAlt = isTightGarage ? 2.3 : this.sceneId === 'interior_7' ? 4.6 : 4.2;
        const angle = -Math.PI * 0.75 + t * 0.65;
        this.camera.fov = this.baseFov;
        localCam.set(
          Math.cos(angle) * radius,
          Math.min(maxAlt, h * 0.85 + Math.sin(t * 0.8) * h * 0.22 + subjectBobY),
          Math.sin(angle) * radius
        );
        localTarget.set(0, hMid, 0);
        break;
      }

      case 'low_hero_pan': {
        const angle = THREE.MathUtils.lerp(-Math.PI * 0.78, -Math.PI * 0.22, smoothU);
        const maxR = isTightGarage ? 3.6 : span * 1.05;
        const radius = Math.min(span * 1.05, maxR);
        this.camera.fov = 52;
        localCam.set(
          Math.cos(angle) * radius,
          Math.max(0.28, h * 0.24) + subjectBobY,
          Math.sin(angle) * radius
        );
        localTarget.set(0, h * 0.38 + subjectBobY, -d * 0.18);
        break;
      }

      case 'vertigo_dolly_zoom': {
        const pingPong = 0.5 - 0.5 * Math.cos(u * Math.PI * 2.0);
        const minFov = isEnclosed ? 34 : 18;
        const maxFov = isEnclosed ? 58 : 66;
        const fovDeg = THREE.MathUtils.lerp(maxFov, minFov, pingPong);
        const fovRad = THREE.MathUtils.degToRad(fovDeg);
        const frameWidth = span * 0.92;
        let dist = frameWidth / (2.0 * Math.tan(fovRad * 0.5));
        const maxDist = isTightGarage ? 5.0 : isEnclosed ? 6.4 : span * 3.2;
        dist = Math.min(dist, maxDist);

        const dir = new THREE.Vector3(-0.62, 0.22, -0.75).normalize();
        this.camera.fov = fovDeg;
        localCam.set(
          dir.x * dist,
          Math.max(0.4, hMid + dir.y * dist * 0.45),
          dir.z * dist
        );
        localTarget.set(0, hMid, -d * 0.08);
        break;
      }

      case 'tracking_slider': {
        const zPos = THREE.MathUtils.lerp(-d * 0.85, d * 0.85, smoothU);
        const latDist = isTightGarage ? Math.min(span * 1.18, 3.4) : span * 1.18;
        this.camera.fov = 38;
        localCam.set(-latDist, h * 0.55 + subjectBobY, zPos);
        localTarget.set(0, h * 0.44 + subjectBobY, zPos * 0.55);
        break;
      }

      case 'crane_reveal': {
        const maxZ = isTightGarage ? 4.2 : span * 1.15;
        const zPos = THREE.MathUtils.lerp(-span * 0.85, maxZ, smoothU);
        const maxY = isTightGarage ? 2.4 : isEnclosed ? 4.6 : h * 3.0;
        const rawY = THREE.MathUtils.lerp(h * 0.28, h * 2.35, Math.sin(smoothU * Math.PI * 0.85));
        const yPos = Math.min(maxY, rawY);
        const xPos = THREE.MathUtils.lerp(-span * 0.35, span * 0.65, smoothU);
        this.camera.fov = 42;
        localCam.set(xPos, yPos + subjectBobY, zPos);
        localTarget.set(0, hMid, THREE.MathUtils.lerp(-d * 0.3, d * 0.1, smoothU));
        break;
      }

      case 'macro_aero_sweep': {
        const zPos = THREE.MathUtils.lerp(-d * 0.42, d * 0.42, smoothU);
        this.camera.fov = 24;
        localCam.set(-w * 0.92, h * 0.78 + subjectBobY, zPos - span * 0.35);
        localTarget.set(0, h * 0.56 + subjectBobY, zPos);
        break;
      }

      case 'whip_pan_speed': {
        const shakeX = Math.sin(t * 28.0) * 0.035;
        const shakeY = Math.cos(t * 34.0) * 0.025;
        const swing = Math.sin(u * Math.PI * 2.0) * span * 0.48;
        this.camera.fov = 56;
        localCam.set(
          swing + shakeX,
          h * 0.58 + shakeY + subjectBobY,
          -Math.min(span * 1.15, 4.4)
        );
        localTarget.set(0, h * 0.42 + subjectBobY, 0);
        break;
      }

      case 'loft_skyline_hero': {
        const xPos = THREE.MathUtils.lerp(3.6, 2.0, smoothU);
        const zPos = THREE.MathUtils.lerp(-1.8, 1.8, smoothU);
        const yPos = 1.35 + Math.sin(smoothU * Math.PI) * 0.35 + subjectBobY;
        this.camera.fov = 40;
        localCam.set(xPos, yPos, zPos);
        localTarget.set(0, hMid, -0.3);
        break;
      }

      case 'loft_glass_pan': {
        const xPos = THREE.MathUtils.lerp(2.2, -1.2, smoothU);
        const zPos = THREE.MathUtils.lerp(-2.8, -3.2, smoothU);
        this.camera.fov = 54;
        localCam.set(xPos, 0.42 + subjectBobY, zPos);
        localTarget.set(0, h * 0.4 + subjectBobY, -d * 0.15);
        break;
      }

      case 'loft_profile_slider': {
        const zPos = THREE.MathUtils.lerp(-d * 0.7, d * 0.7, smoothU);
        this.camera.fov = 36;
        localCam.set(2.8, 1.25 + subjectBobY, zPos);
        localTarget.set(0, hMid, zPos * 0.6);
        break;
      }

      case 'garage_bay_orbit': {
        const radius = 3.6;
        const angle = -Math.PI * 0.75 + t * 0.55;
        this.camera.fov = 48;
        localCam.set(
          Math.cos(angle) * radius,
          1.25 + Math.sin(t * 0.7) * 0.2 + subjectBobY,
          Math.sin(angle) * radius
        );
        localTarget.set(0, hMid, 0);
        break;
      }

      case 'garage_alignment_track': {
        const zPos = THREE.MathUtils.lerp(-d * 0.6, d * 0.6, smoothU);
        this.camera.fov = 44;
        localCam.set(-2.2, 0.38 + subjectBobY, zPos);
        localTarget.set(-0.4, 0.35 + subjectBobY, zPos);
        break;
      }

      case 'garage_front_hero': {
        const angle = THREE.MathUtils.lerp(-Math.PI * 0.65, -Math.PI * 0.35, smoothU);
        this.camera.fov = 52;
        localCam.set(
          Math.cos(angle) * 3.4,
          0.55 + subjectBobY,
          Math.sin(angle) * 3.4
        );
        localTarget.set(0, h * 0.42 + subjectBobY, -d * 0.2);
        break;
      }

      case 'gallery_skylight_beam': {
        const angle = THREE.MathUtils.lerp(-Math.PI * 0.8, -Math.PI * 0.25, smoothU);
        const radius = 3.8;
        this.camera.fov = 50;
        localCam.set(
          Math.cos(angle) * radius,
          0.65 + smoothU * 0.7 + subjectBobY,
          Math.sin(angle) * radius
        );
        localTarget.set(0, h * 0.5 + subjectBobY, 0);
        break;
      }

      case 'gallery_brutalist_arc': {
        const xPos = THREE.MathUtils.lerp(-3.8, 3.8, smoothU);
        this.camera.fov = 42;
        localCam.set(xPos, 1.45 + subjectBobY, -3.6);
        localTarget.set(0, hMid, 0);
        break;
      }

      case 'wind_intake_zoom': {
        const zDist = THREE.MathUtils.lerp(-16.0, -5.2, smoothU);
        this.camera.fov = 34;
        localCam.set(0.1, 1.25 + subjectBobY, zDist);
        localTarget.set(0, h * 0.45 + subjectBobY, -d * 0.25);
        break;
      }

      case 'wind_aero_track': {
        const zPos = THREE.MathUtils.lerp(-d * 0.75, d * 0.75, smoothU);
        this.camera.fov = 38;
        localCam.set(-4.2, 1.35 + subjectBobY, zPos);
        localTarget.set(0, hMid, zPos * 0.55);
        break;
      }

      case 'plane_flyby_underpass': {
        const zPos = THREE.MathUtils.lerp(-span * 1.1, span * 1.1, u);
        this.camera.fov = 54;
        localCam.set(span * 0.18, Math.max(0.25, subjectBobY - h * 0.45), zPos);
        localTarget.set(0, h * 0.55 + subjectBobY, 0);
        break;
      }

      case 'plane_wingtip_to_nose': {
        const xPos = THREE.MathUtils.lerp(-w * 0.72, -w * 0.15, smoothU);
        const zPos = THREE.MathUtils.lerp(d * 0.15, -d * 0.72, smoothU);
        const yPos = THREE.MathUtils.lerp(h * 0.52, h * 0.65, smoothU) + subjectBobY;
        this.camera.fov = 36;
        localCam.set(xPos, yPos, zPos);
        localTarget.set(
          THREE.MathUtils.lerp(-w * 0.25, 0, smoothU),
          h * 0.46 + subjectBobY,
          THREE.MathUtils.lerp(0, -d * 0.35, smoothU)
        );
        break;
      }

      case 'plane_runway_takeoff': {
        const angle = THREE.MathUtils.lerp(-Math.PI * 0.68, -Math.PI * 0.35, smoothU);
        const radius = span * 1.1;
        this.camera.fov = 44;
        localCam.set(
          Math.cos(angle) * radius,
          h * 0.38 + smoothU * h * 0.6 + subjectBobY,
          Math.sin(angle) * radius
        );
        localTarget.set(0, h * 0.5 + subjectBobY, -d * 0.12);
        break;
      }

      default:
        break;
    }

    this._applySubjectFrame(localCam, localTarget);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.controls.target);
  }
}

import * as THREE from 'three';

export class CameraDirector {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;

    this.activeShotId = 'free_orbit';
    this.shotSpeed = 1.0;
    this.baseFov = 42;
    this.bounds = { w: 2.2, h: 1.4, d: 4.8 };
    this.subjectYOffset = 0;
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
  }

  setSceneId(sceneId) {
    this.sceneId = sceneId;
    if (sceneId === 'car_garage') {
      this.controls.maxDistance = 6.8;
      this.controls.minDistance = 1.0;
      this.controls.maxPolarAngle = Math.PI * 0.495;
    } else if (sceneId === 'interior_7') {
      this.controls.maxDistance = 8.5;
      this.controls.minDistance = 1.0;
      this.controls.maxPolarAngle = Math.PI * 0.495;
    } else if (sceneId === 'abandoned_vr_gallery') {
      this.controls.maxDistance = 7.8;
      this.controls.minDistance = 1.0;
      this.controls.maxPolarAngle = Math.PI * 0.495;
    } else if (sceneId === 'wind_tunnel') {
      this.controls.maxDistance = 24.0;
      this.controls.minDistance = 1.2;
      this.controls.maxPolarAngle = Math.PI * 0.495;
    } else {
      this.controls.maxDistance = 140;
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

    if (this.sceneId === 'interior_7') {
      // Place camera in the great room looking across the vehicle towards the panoramic glass windows & city skyline
      this.camera.position.set(3.4, Math.max(1.25, h * 0.95) + this.subjectYOffset, 1.2);
      this.controls.target.set(0, hMid, -0.4);
    } else if (this.sceneId === 'car_garage') {
      // Underground garage bay framing
      this.camera.position.set(-3.6, Math.max(1.05, h * 0.88) + this.subjectYOffset, -3.2);
      this.controls.target.set(0, hMid, 0);
    } else if (this.sceneId === 'abandoned_vr_gallery') {
      // Under the skylight sunbeam shaft
      this.camera.position.set(-3.5, Math.max(1.15, h * 0.92) + this.subjectYOffset, -3.8);
      this.controls.target.set(0, hMid, 0);
    } else if (this.sceneId === 'wind_tunnel') {
      // Framing on the aerodynamic turntable
      this.camera.position.set(-4.2, Math.max(1.2, h * 0.95) + this.subjectYOffset, -4.6);
      this.controls.target.set(0, hMid, 0);
    } else {
      // Standard 3/4 front-right isometric hero view
      this.camera.position.set(-span * 1.05, h * 1.1 + this.subjectYOffset, -span * 1.25);
      this.controls.target.set(0, hMid, 0);
    }
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
    this.beatCutCooldown = 1.35; // Minimum 1.35s between beat-triggered cuts
    this.setShot(this.sequence[this.currentClipIndex].shotId);
  }

  getTotalSequenceDuration() {
    return this.sequence.reduce((acc, c) => acc + (Number(c.duration) || 3.5), 0);
  }

  update(dt, subjectYOffset = 0) {
    this.subjectYOffset = subjectYOffset;
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
    const hMid = h * 0.45 + subjectYOffset;

    // Progress [0..1] over current clip or 5s loop
    const activeDur =
      this.isPlayingSequence && this.sequence[this.currentClipIndex]
        ? Math.max(1.5, Number(this.sequence[this.currentClipIndex].duration) || 4.0)
        : 5.0;
    const u = (this.shotElapsed % activeDur) / activeDur;
    const smoothU = u * u * (3.0 - 2.0 * u);

    const isEnclosed =
      this.sceneId === 'car_garage' ||
      this.sceneId === 'interior_7' ||
      this.sceneId === 'abandoned_vr_gallery';

    switch (this.activeShotId) {
      case 'orbit_360': {
        const maxR =
          this.sceneId === 'car_garage'
            ? 3.8
            : this.sceneId === 'interior_7'
            ? 4.6
            : this.sceneId === 'abandoned_vr_gallery'
            ? 4.2
            : span * 1.45;
        const radius = Math.min(span * 1.35, maxR);
        const maxAlt = this.sceneId === 'car_garage' ? 2.3 : this.sceneId === 'interior_7' ? 4.6 : 4.0;
        const angle = -Math.PI * 0.75 + t * 0.65;
        this.camera.fov = this.baseFov;
        this.camera.position.set(
          Math.cos(angle) * radius,
          Math.min(maxAlt, h * 0.85 + Math.sin(t * 0.8) * h * 0.22 + subjectYOffset),
          Math.sin(angle) * radius
        );
        this.controls.target.set(0, hMid, 0);
        break;
      }

      case 'low_hero_pan': {
        // Low ground-skimming wide lens arc across the front nose (-Z)
        const angle = THREE.MathUtils.lerp(-Math.PI * 0.78, -Math.PI * 0.22, smoothU);
        const maxR = this.sceneId === 'car_garage' ? 3.6 : span * 1.05;
        const radius = Math.min(span * 1.05, maxR);
        this.camera.fov = 52;
        this.camera.position.set(
          Math.cos(angle) * radius,
          Math.max(0.28, h * 0.24) + subjectYOffset,
          Math.sin(angle) * radius
        );
        this.controls.target.set(0, h * 0.38 + subjectYOffset, -d * 0.18);
        break;
      }

      case 'vertigo_dolly_zoom': {
        // Hitchcock contra-zoom: FOV narrows while camera pulls back proportionally
        // In enclosed rooms, clamp travel distance so camera never clips outside walls!
        const pingPong = 0.5 - 0.5 * Math.cos(u * Math.PI * 2.0);
        const minFov = isEnclosed ? 34 : 17;
        const maxFov = isEnclosed ? 58 : 66;
        const fovDeg = THREE.MathUtils.lerp(maxFov, minFov, pingPong);
        const fovRad = THREE.MathUtils.degToRad(fovDeg);
        const frameWidth = span * 0.92;
        let dist = frameWidth / (2.0 * Math.tan(fovRad * 0.5));
        const maxDist = this.sceneId === 'car_garage' ? 5.0 : this.sceneId === 'interior_7' ? 6.2 : 6.0;
        dist = Math.min(dist, maxDist);

        const dir = new THREE.Vector3(-0.62, 0.22, -0.75).normalize();
        this.camera.fov = fovDeg;
        this.camera.position.set(
          dir.x * dist,
          Math.max(0.4, hMid + dir.y * dist * 0.45),
          dir.z * dist
        );
        this.controls.target.set(0, hMid, -d * 0.08);
        break;
      }

      case 'tracking_slider': {
        // Parallel lateral slider along the profile from front (-Z) to rear (+Z)
        const zPos = THREE.MathUtils.lerp(-d * 0.85, d * 0.85, smoothU);
        const latDist = this.sceneId === 'car_garage' ? Math.min(span * 1.18, 3.4) : span * 1.18;
        this.camera.fov = 38;
        this.camera.position.set(-latDist, h * 0.55 + subjectYOffset, zPos);
        this.controls.target.set(0, h * 0.44 + subjectYOffset, zPos * 0.55);
        break;
      }

      case 'crane_reveal': {
        // Starts low & close on nose, cranes high and arcs over roof
        const maxZ = this.sceneId === 'car_garage' ? 4.2 : span * 1.15;
        const zPos = THREE.MathUtils.lerp(-span * 0.85, maxZ, smoothU);
        const maxY = this.sceneId === 'car_garage' ? 2.4 : this.sceneId === 'interior_7' ? 4.8 : 4.0;
        const rawY = THREE.MathUtils.lerp(h * 0.28, h * 2.35, Math.sin(smoothU * Math.PI * 0.85));
        const yPos = Math.min(maxY, rawY);
        const xPos = THREE.MathUtils.lerp(-span * 0.35, span * 0.65, smoothU);
        this.camera.fov = 42;
        this.camera.position.set(xPos, yPos + subjectYOffset, zPos);
        this.controls.target.set(0, hMid, THREE.MathUtils.lerp(-d * 0.3, d * 0.1, smoothU));
        break;
      }

      case 'macro_aero_sweep': {
        // Tight telephoto detail sweep along upper bodywork / canopy
        const zPos = THREE.MathUtils.lerp(-d * 0.42, d * 0.42, smoothU);
        this.camera.fov = 24;
        this.camera.position.set(-w * 0.92, h * 0.78 + subjectYOffset, zPos - span * 0.35);
        this.controls.target.set(0, h * 0.56 + subjectYOffset, zPos);
        break;
      }

      case 'whip_pan_speed': {
        // Energetic low chase cam with subtle vibration
        const shakeX = Math.sin(t * 28.0) * 0.035;
        const shakeY = Math.cos(t * 34.0) * 0.025;
        const swing = Math.sin(u * Math.PI * 2.0) * span * 0.48;
        this.camera.fov = 56;
        this.camera.position.set(
          swing + shakeX,
          h * 0.58 + shakeY + subjectYOffset,
          -Math.min(span * 1.15, 4.2)
        );
        this.controls.target.set(0, h * 0.42 + subjectYOffset, 0);
        break;
      }

      // --- Scene-Specific Signature Cinematic Camera Moves ---

      case 'loft_skyline_hero': {
        // Glides past the panoramic glass windows framing the car against the towering skyscrapers
        const xPos = THREE.MathUtils.lerp(3.6, 2.0, smoothU);
        const zPos = THREE.MathUtils.lerp(-1.8, 1.8, smoothU);
        const yPos = 1.35 + Math.sin(smoothU * Math.PI) * 0.35 + subjectYOffset;
        this.camera.fov = 40;
        this.camera.position.set(xPos, yPos, zPos);
        this.controls.target.set(0, hMid, -0.3);
        break;
      }

      case 'loft_glass_pan': {
        // Skims low along the polished floor catching panoramic window reflections
        const xPos = THREE.MathUtils.lerp(2.2, -1.2, smoothU);
        const zPos = THREE.MathUtils.lerp(-2.8, -3.2, smoothU);
        this.camera.fov = 54;
        this.camera.position.set(xPos, 0.42 + subjectYOffset, zPos);
        this.controls.target.set(0, h * 0.4 + subjectYOffset, -d * 0.15);
        break;
      }

      case 'loft_profile_slider': {
        // Parallel track along the driver profile with natural daylight illumination
        const zPos = THREE.MathUtils.lerp(-d * 0.7, d * 0.7, smoothU);
        this.camera.fov = 36;
        this.camera.position.set(2.8, 1.25 + subjectYOffset, zPos);
        this.controls.target.set(0, hMid, zPos * 0.6);
        break;
      }

      case 'garage_bay_orbit': {
        // Tight 360 orbit strictly inside the underground tuner bay under ceiling beams
        const radius = 3.6;
        const angle = -Math.PI * 0.75 + t * 0.55;
        this.camera.fov = 48;
        this.camera.position.set(
          Math.cos(angle) * radius,
          1.25 + Math.sin(t * 0.7) * 0.2 + subjectYOffset,
          Math.sin(angle) * radius
        );
        this.controls.target.set(0, hMid, 0);
        break;
      }

      case 'garage_alignment_track': {
        // Ultra-low tracking shot along forged wheels, tires, and brake calipers
        const zPos = THREE.MathUtils.lerp(-d * 0.6, d * 0.6, smoothU);
        this.camera.fov = 44;
        this.camera.position.set(-2.2, 0.38 + subjectYOffset, zPos);
        this.controls.target.set(-0.4, 0.35 + subjectYOffset, zPos);
        break;
      }

      case 'garage_front_hero': {
        // Low frontal heroic angle catching the overhead fluorescent strip lights
        const angle = THREE.MathUtils.lerp(-Math.PI * 0.65, -Math.PI * 0.35, smoothU);
        this.camera.fov = 52;
        this.camera.position.set(
          Math.cos(angle) * 3.4,
          0.55 + subjectYOffset,
          Math.sin(angle) * 3.4
        );
        this.controls.target.set(0, h * 0.42 + subjectYOffset, -d * 0.2);
        break;
      }

      case 'gallery_skylight_beam': {
        // Upward angle looking through the dramatic skylight sunbeam shaft at the car
        const angle = THREE.MathUtils.lerp(-Math.PI * 0.8, -Math.PI * 0.25, smoothU);
        const radius = 3.8;
        this.camera.fov = 50;
        this.camera.position.set(
          Math.cos(angle) * radius,
          0.65 + smoothU * 0.7 + subjectYOffset,
          Math.sin(angle) * radius
        );
        this.controls.target.set(0, h * 0.5 + subjectYOffset, 0);
        break;
      }

      case 'gallery_brutalist_arc': {
        // Atmospheric low arc moving between weathered concrete gallery columns
        const xPos = THREE.MathUtils.lerp(-3.8, 3.8, smoothU);
        this.camera.fov = 42;
        this.camera.position.set(xPos, 1.45 + subjectYOffset, -3.6);
        this.controls.target.set(0, hMid, 0);
        break;
      }

      case 'wind_intake_zoom': {
        // Cinematic zoom looking down the turbine shaft towards the front aero splitter
        const zDist = THREE.MathUtils.lerp(-16.0, -5.2, smoothU);
        this.camera.fov = 34;
        this.camera.position.set(0.1, 1.25 + subjectYOffset, zDist);
        this.controls.target.set(0, h * 0.45 + subjectYOffset, -d * 0.25);
        break;
      }

      case 'wind_aero_track': {
        // Lateral aerodynamic track capturing active aero surfaces & wings
        const zPos = THREE.MathUtils.lerp(-d * 0.75, d * 0.75, smoothU);
        this.camera.fov = 38;
        this.camera.position.set(-4.2, 1.35 + subjectYOffset, zPos);
        this.controls.target.set(0, hMid, zPos * 0.55);
        break;
      }

      case 'plane_flyby_underpass': {
        // Dramatic upward pass directly underneath the aircraft belly & wing engines
        const zPos = THREE.MathUtils.lerp(-span * 1.1, span * 1.1, u);
        this.camera.fov = 54;
        this.camera.position.set(
          span * 0.18,
          Math.max(0.25, subjectYOffset - h * 0.45),
          zPos
        );
        this.controls.target.set(0, h * 0.55 + subjectYOffset, 0);
        break;
      }

      case 'plane_wingtip_to_nose': {
        // Glides from starboard wingtip strobe across engine nacelles to cockpit flight deck
        const xPos = THREE.MathUtils.lerp(-w * 0.72, -w * 0.15, smoothU);
        const zPos = THREE.MathUtils.lerp(d * 0.15, -d * 0.72, smoothU);
        const yPos = THREE.MathUtils.lerp(h * 0.52, h * 0.65, smoothU) + subjectYOffset;
        this.camera.fov = 36;
        this.camera.position.set(xPos, yPos, zPos);
        this.controls.target.set(
          THREE.MathUtils.lerp(-w * 0.25, 0, smoothU),
          h * 0.46 + subjectYOffset,
          THREE.MathUtils.lerp(0, -d * 0.35, smoothU)
        );
        break;
      }

      case 'plane_runway_takeoff': {
        // Parallel runway chase tracking shot
        const angle = THREE.MathUtils.lerp(-Math.PI * 0.68, -Math.PI * 0.35, smoothU);
        const radius = span * 1.1;
        this.camera.fov = 44;
        this.camera.position.set(
          Math.cos(angle) * radius,
          h * 0.38 + smoothU * h * 0.6 + subjectYOffset,
          Math.sin(angle) * radius
        );
        this.controls.target.set(0, h * 0.5 + subjectYOffset, -d * 0.12);
        break;
      }

      default:
        break;
    }

    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.controls.target);
  }
}

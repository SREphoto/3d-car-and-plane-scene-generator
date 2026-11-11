import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

/**
 * VehicleController:
 * Enables interactive 3D placement and live driving/flying of any vehicle or aircraft inside any scene:
 * - 'orbit'     : Clean viewport, OrbitControls active
 * - 'translate' : 3D Move Gizmo on subjectHolder (auto-snaps tires to road surface)
 * - 'rotate'    : 3D Yaw/Pitch/Roll Gizmo on subjectHolder
 * - 'drive'     : Live WASD / Arrow-Key driving (or 3D flight for planes) with physics inertia,
 *                 steering yaw, road-surface raycast following, and camera chase tracking
 * - Shift+Click : Instant click-to-place anywhere on a 3D street, piazza, or garage floor
 */
export class VehicleController {
  constructor({
    scene,
    camera,
    canvas,
    orbitControls,
    subjectHolder,
    locationHolder,
    onPoseChange,
    onProbeRefreshNeeded,
    onModeChange,
  }) {
    this.scene = scene;
    this.camera = camera;
    this.canvas = canvas;
    this.orbitControls = orbitControls;
    this.subjectHolder = subjectHolder;
    this.locationHolder = locationHolder;
    this.onPoseChange = onPoseChange || null;
    this.onProbeRefreshNeeded = onProbeRefreshNeeded || null;
    this.onModeChange = onModeChange || null;

    this.mode = 'orbit'; // 'orbit' | 'translate' | 'rotate' | 'drive'
    this.subjectType = 'cars'; // 'cars' | 'planes' | 'parts'
    this.snapToGround = true;
    this.alignToSlope = false;
    this.followCamera = true;
    this.recordingSuppressed = false;

    // Driving / Flying kinematics
    this.keys = new Set();
    this.speed = 0; // m/s (positive = forward along local -Z)
    this.steerAngle = 0; // rad
    this.verticalSpeed = 0;
    this.probeCooldown = 0;
    this.distanceDrivenSinceProbe = 0;

    this._raycaster = new THREE.Raycaster();
    this._downDir = new THREE.Vector3(0, -1, 0);
    this._rayOrigin = new THREE.Vector3();
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._pointerNDC = new THREE.Vector2();
    this._prevPos = new THREE.Vector3();
    this._deltaPos = new THREE.Vector3();
    this._forwardVec = new THREE.Vector3();
    this._normalMatrix = new THREE.Matrix3();
    this._worldNormal = new THREE.Vector3(0, 1, 0);
    this._targetSlopeQuat = new THREE.Quaternion();

    // Initialize Three.js r170 TransformControls + Helper Object3D
    this.transformControls = new TransformControls(this.camera, this.canvas);
    this.transformControls.setSize(0.95);
    this.transformControls.setSpace('local');
    this.helper = this.transformControls.getHelper();
    this.helper.name = 'VehicleTransformGizmoHelper';
    this.helper.visible = false;
    this.transformControls.enabled = false;
    this.scene.add(this.helper);

    this._bindEvents();
  }

  _bindEvents() {
    this._onDraggingChanged = (event) => {
      const isDragging = event.value;
      if (this.orbitControls && this.cameraDirectorAllowsOrbit()) {
        this.orbitControls.enabled = !isDragging;
      }
      if (isDragging) {
        this._prevPos.copy(this.subjectHolder.position);
      } else {
        // Re-capture local reflection probe once user finishes dragging the vehicle
        if (this.onProbeRefreshNeeded) {
          this.onProbeRefreshNeeded(this.subjectHolder.position);
        }
        this._emitPose();
      }
    };

    this._onObjectChange = () => {
      if (this.mode === 'translate' && this.snapToGround && this.subjectType === 'cars') {
        // Only snap Y when dragging horizontal X/Z/XZ handles (allow explicit Y lift if dragging Y arrow)
        if (this.transformControls.axis !== 'Y') {
          this.snapSubjectToGround();
        }
      }
      this._deltaPos.subVectors(this.subjectHolder.position, this._prevPos);
      if (this.followCamera && this._deltaPos.lengthSq() > 1e-8 && this.orbitControls) {
        this.orbitControls.target.add(this._deltaPos);
      }
      this._prevPos.copy(this.subjectHolder.position);
      this._emitPose();
    };

    this.transformControls.addEventListener('dragging-changed', this._onDraggingChanged);
    this.transformControls.addEventListener('objectChange', this._onObjectChange);

    // Shift + Click on scene floor/road to place vehicle immediately
    this._onPointerDown = (e) => {
      if (!e.shiftKey || e.button !== 0 || this.recordingSuppressed) return;
      const rect = this.canvas.getBoundingClientRect();
      this._pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this._raycaster.setFromCamera(this._pointerNDC, this.camera);
      const targetPt = new THREE.Vector3();
      let hitFound = false;

      if (this.locationHolder && this.locationHolder.children.length > 0) {
        const hits = this._raycaster.intersectObjects(this.locationHolder.children, true);
        const validHit = hits.find((h) => h.object.visible && h.point);
        if (validHit) {
          targetPt.copy(validHit.point);
          hitFound = true;
        }
      }

      if (!hitFound) {
        hitFound = Boolean(this._raycaster.ray.intersectPlane(this._groundPlane, targetPt));
      }

      if (hitFound) {
        const prev = this.subjectHolder.position.clone();
        this.subjectHolder.position.copy(targetPt);
        if (this.snapToGround && this.subjectType === 'cars') {
          this.snapSubjectToGround();
        }
        const delta = this.subjectHolder.position.clone().sub(prev);
        if (this.orbitControls) {
          this.orbitControls.target.add(delta);
          this.camera.position.add(delta);
          this.orbitControls.update();
        }
        if (this.onProbeRefreshNeeded) {
          this.onProbeRefreshNeeded(this.subjectHolder.position);
        }
        this._emitPose();
      }
    };

    this._onKeyDown = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) {
        return;
      }

      const code = e.code;
      this.keys.add(code);

      // Tool hotkeys when not actively driving with W
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (code === 'Escape' && this.mode !== 'orbit') {
          this.setMode('orbit');
        } else if (code === 'KeyG') {
          this.setMode(this.mode === 'drive' ? 'orbit' : 'drive');
        } else if (this.mode !== 'drive') {
          if (code === 'KeyW') this.setMode(this.mode === 'translate' ? 'orbit' : 'translate');
          if (code === 'KeyE') this.setMode(this.mode === 'rotate' ? 'orbit' : 'rotate');
        }
      }

      if (
        this.mode === 'drive' &&
        (code === 'ArrowUp' ||
          code === 'ArrowDown' ||
          code === 'ArrowLeft' ||
          code === 'ArrowRight' ||
          code === 'Space')
      ) {
        e.preventDefault();
      }
    };

    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };

    this._onBlur = () => {
      this.keys.clear();
    };

    this.canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  cameraDirectorAllowsOrbit() {
    return true;
  }

  setSubjectType(type) {
    this.subjectType = type;
    if (type === 'planes') {
      this.alignToSlope = false;
    }
  }

  setMode(newMode) {
    this.mode = newMode;
    this.speed = 0;
    this.verticalSpeed = 0;

    const showGizmo = (newMode === 'translate' || newMode === 'rotate') && !this.recordingSuppressed;
    if (showGizmo) {
      this.transformControls.attach(this.subjectHolder);
      this.transformControls.setMode(newMode);
      this.transformControls.setSpace(newMode === 'rotate' ? 'local' : 'world');
      this.transformControls.showX = true;
      this.transformControls.showY = true;
      this.transformControls.showZ = true;
      this.transformControls.enabled = true;
      this.helper.visible = true;
    } else {
      this.transformControls.detach();
      this.transformControls.enabled = false;
      this.helper.visible = false;
    }

    if (this.onModeChange) {
      this.onModeChange(newMode);
    }
  }

  setSnapToGround(enabled) {
    this.snapToGround = Boolean(enabled);
    if (this.snapToGround && this.subjectType === 'cars') {
      this.snapSubjectToGround();
      this._emitPose();
    }
  }

  setAlignToSlope(enabled) {
    this.alignToSlope = Boolean(enabled);
    if (!this.alignToSlope) {
      this.subjectHolder.rotation.x = 0;
      this.subjectHolder.rotation.z = 0;
    } else {
      this.snapSubjectToGround();
    }
    this._emitPose();
  }

  setRecordingSuppressed(suppressed) {
    this.recordingSuppressed = Boolean(suppressed);
    const shouldShow =
      !this.recordingSuppressed && (this.mode === 'translate' || this.mode === 'rotate');
    this.helper.visible = shouldShow;
    this.transformControls.enabled = shouldShow;
  }

  /**
   * Resets vehicle to canonical scene origin (0, 0, 0) facing -Z (or scene spawn)
   */
  resetPose(spawn = { x: 0, y: 0, z: 0, yaw: 0 }) {
    const prev = this.subjectHolder.position.clone();
    this.subjectHolder.position.set(spawn.x || 0, spawn.y || 0, spawn.z || 0);
    this.subjectHolder.rotation.set(0, spawn.yaw || 0, 0);
    this.speed = 0;
    this.steerAngle = 0;
    this.verticalSpeed = 0;

    if (this.snapToGround && this.subjectType === 'cars' && spawn.y === undefined) {
      this.snapSubjectToGround();
    }

    const delta = this.subjectHolder.position.clone().sub(prev);
    if (this.orbitControls && delta.lengthSq() > 1e-6) {
      this.orbitControls.target.add(delta);
      this.camera.position.add(delta);
      this.orbitControls.update();
    }

    if (this.onProbeRefreshNeeded) {
      this.onProbeRefreshNeeded(this.subjectHolder.position);
    }
    this._emitPose();
  }

  setPose({ x, y, z, yawDeg }) {
    const prev = this.subjectHolder.position.clone();
    if (x !== undefined) this.subjectHolder.position.x = Number(x);
    if (y !== undefined) this.subjectHolder.position.y = Number(y);
    if (z !== undefined) this.subjectHolder.position.z = Number(z);
    if (yawDeg !== undefined) {
      this.subjectHolder.rotation.y = THREE.MathUtils.degToRad(Number(yawDeg));
    }
    if (y === undefined && this.snapToGround && this.subjectType === 'cars') {
      this.snapSubjectToGround();
    }
    const delta = this.subjectHolder.position.clone().sub(prev);
    if (this.followCamera && this.orbitControls && delta.lengthSq() > 1e-6) {
      this.orbitControls.target.add(delta);
      this.camera.position.add(delta);
    }
    this._emitPose();
  }

  /**
   * Raycasts downward from chest/hood height (+1.85m above current tire base) so indoor ceilings
   * (e.g. 5m garage roofs) are never hit, landing cleanly on streets, ramps, and uneven terrain.
   */
  snapSubjectToGround() {
    if (!this.locationHolder || this.locationHolder.children.length === 0) {
      // Procedural flat stage datum is Y = 0.000
      if (this.subjectType === 'cars') {
        this.subjectHolder.position.y = 0;
      }
      return;
    }

    const cur = this.subjectHolder.position;
    this._rayOrigin.set(cur.x, cur.y + 1.85, cur.z);
    this._raycaster.set(this._rayOrigin, this._downDir);
    this._raycaster.near = 0.02;
    this._raycaster.far = 18.0;

    const hits = this._raycaster.intersectObjects(this.locationHolder.children, true);
    const groundHit = hits.find((h) => {
      if (!h.object.visible || !h.face) return false;
      this._normalMatrix.getNormalMatrix(h.object.matrixWorld);
      this._worldNormal.copy(h.face.normal).applyMatrix3(this._normalMatrix).normalize();
      if (this._worldNormal.y < 0) this._worldNormal.negate();
      // Only snap to walkable/drivable surfaces (< ~48 deg slope), ignoring vertical walls
      return this._worldNormal.y > 0.66;
    });

    if (groundHit) {
      this.subjectHolder.position.y = groundHit.point.y;

      if (this.alignToSlope && groundHit.face) {
        this._normalMatrix.getNormalMatrix(groundHit.object.matrixWorld);
        this._worldNormal.copy(groundHit.face.normal).applyMatrix3(this._normalMatrix).normalize();
        if (this._worldNormal.y < 0) this._worldNormal.negate();

        const yaw = this.subjectHolder.rotation.y;
        const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
        const right = new THREE.Vector3().crossVectors(forward, this._worldNormal).normalize();
        const alignedForward = new THREE.Vector3().crossVectors(this._worldNormal, right).normalize();
        const basis = new THREE.Matrix4().makeBasis(
          right,
          this._worldNormal,
          alignedForward.clone().negate()
        );
        this._targetSlopeQuat.setFromRotationMatrix(basis);
        this.subjectHolder.quaternion.slerp(this._targetSlopeQuat, 0.25);
      }
    }
  }

  _emitPose() {
    if (!this.onPoseChange) return;
    const p = this.subjectHolder.position;
    const yawDeg = Math.round(THREE.MathUtils.radToDeg(this.subjectHolder.rotation.y));
    this.onPoseChange({
      x: Number(p.x.toFixed(2)),
      y: Number(p.y.toFixed(2)),
      z: Number(p.z.toFixed(2)),
      yawDeg,
      speed: Number(this.speed.toFixed(1)),
    });
  }

  update(dt) {
    if (this.probeCooldown > 0) {
      this.probeCooldown = Math.max(0, this.probeCooldown - dt);
    }

    if (this.mode !== 'drive') return;

    const isPlane = this.subjectType === 'planes';
    const throttle =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const steerInput =
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) -
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0);
    const liftInput =
      (this.keys.has('Space') || this.keys.has('KeyQ') ? 1 : 0) -
      (this.keys.has('KeyC') || this.keys.has('ControlLeft') ? 1 : 0);

    const maxSpeed = isPlane ? 28.0 : 14.0;
    const accel = isPlane ? 16.0 : 11.0;
    const drag = isPlane ? 2.6 : 4.2;

    if (throttle !== 0) {
      this.speed = THREE.MathUtils.clamp(
        this.speed + throttle * accel * dt,
        -maxSpeed * 0.55,
        maxSpeed
      );
    } else {
      const damping = Math.exp(-drag * dt);
      this.speed *= damping;
      if (Math.abs(this.speed) < 0.02) this.speed = 0;
    }

    // Smooth front-wheel steering angle
    const targetSteer = steerInput * 0.52;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteer, Math.min(1, dt * 10));

    // Yaw rate: realistic steering when moving, plus gentle pivot assist if Shift held or aircraft
    const speedFactor = Math.min(1.0, Math.abs(this.speed) / 2.2);
    const reverseSign = this.speed >= -0.05 ? 1 : -1;
    let yawRate = 0;
    if (Math.abs(this.speed) > 0.08) {
      yawRate = steerInput * (isPlane ? 1.15 : 1.55) * speedFactor * reverseSign;
    } else if (steerInput !== 0 && (isPlane || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'))) {
      yawRate = steerInput * 1.1;
    }

    if (yawRate !== 0) {
      this.subjectHolder.rotation.y += yawRate * dt;
    }

    // Altitude control for planes (or unlocked vertical placement)
    if (isPlane || !this.snapToGround) {
      if (liftInput !== 0) {
        this.verticalSpeed = THREE.MathUtils.lerp(this.verticalSpeed, liftInput * 7.5, dt * 6);
      } else {
        this.verticalSpeed *= Math.exp(-5 * dt);
      }
    } else {
      this.verticalSpeed = 0;
    }

    if (Math.abs(this.speed) > 0.001 || Math.abs(this.verticalSpeed) > 0.001 || yawRate !== 0) {
      this._prevPos.copy(this.subjectHolder.position);

      // Canonical forward is local -Z rotated by yaw
      const yaw = this.subjectHolder.rotation.y;
      this._forwardVec.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      this.subjectHolder.position.addScaledVector(this._forwardVec, this.speed * dt);

      if (Math.abs(this.verticalSpeed) > 0.001) {
        this.subjectHolder.position.y = Math.max(
          isPlane ? 0.0 : -5.0,
          this.subjectHolder.position.y + this.verticalSpeed * dt
        );
      }

      if (this.snapToGround && !isPlane) {
        this.snapSubjectToGround();
      }

      this._deltaPos.subVectors(this.subjectHolder.position, this._prevPos);
      const stepDist = this._deltaPos.length();
      this.distanceDrivenSinceProbe += stepDist;

      if (this.followCamera && this.orbitControls && stepDist > 1e-6) {
        this.orbitControls.target.add(this._deltaPos);
        this.camera.position.add(this._deltaPos);
      }

      // Refresh local scene reflection probe periodically after driving 4.5m+
      if (
        this.distanceDrivenSinceProbe > 4.5 &&
        this.probeCooldown <= 0 &&
        this.onProbeRefreshNeeded
      ) {
        this.distanceDrivenSinceProbe = 0;
        this.probeCooldown = 0.85;
        this.onProbeRefreshNeeded(this.subjectHolder.position);
      }

      this._emitPose();
    }
  }

  dispose() {
    this.canvas.removeEventListener('pointerdown', this._onPointerDown);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.transformControls.removeEventListener('dragging-changed', this._onDraggingChanged);
    this.transformControls.removeEventListener('objectChange', this._onObjectChange);
    this.transformControls.detach();
    this.transformControls.dispose();
    this.helper.removeFromParent();
  }
}

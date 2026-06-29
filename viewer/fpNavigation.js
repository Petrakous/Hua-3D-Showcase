const POINTER_LOOK_SENSITIVITY = 0.11;
const TOUCH_LOOK_SENSITIVITY = 0.16;
const MAX_PITCH = 89;
const MIN_MOVE_EPSILON = 1e-6;
const MAX_LOOK_DELTA_PER_EVENT = 40;
const TOUCH_TAP_MAX_TRAVEL = 8;
const NAVIGATION_STOP_DISTANCE = 0.3;
const NAVIGATION_BLOCKED_TIMEOUT = 0.75;
const NAVIGATION_MAX_DISTANCE = 40;
const DEBUG_FP_NAVIGATION = false;

function debugFpNavigation(...args) {
  if (DEBUG_FP_NAVIGATION) console.log(...args);
}

const DEFAULT_FLY_SPEED = 4.0;
const DEFAULT_FLY_SPRINT_MULTIPLIER = 1.8;
const DEFAULT_WALK_SPEED = 2.5;
const DEFAULT_WALK_SPRINT_MULTIPLIER = 1.45;
const DEFAULT_GRAVITY = 9.8;
const DEFAULT_JUMP_SPEED = 5.2;
const DEFAULT_EYE_HEIGHT = 1.65;
const DEFAULT_COLLISION_RADIUS = 0.18;
const DEFAULT_STEP_HEIGHT = 0.28;
const DEFAULT_GROUND_STICK_DISTANCE = 0.45;
const DEFAULT_HEAD_OFFSET = 0.16;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapAngleDegrees(angle) {
  let wrapped = angle % 360;
  if (wrapped > 180) {
    wrapped -= 360;
  } else if (wrapped < -180) {
    wrapped += 360;
  }
  return wrapped;
}

function normalize2D(x, z) {
  const length = Math.hypot(x, z);
  if (length <= MIN_MOVE_EPSILON) {
    return { x: 0, z: 0 };
  }

  return {
    x: x / length,
    z: z / length,
  };
}

function normalize3D(x, y, z, fallback = { x: 0, y: 0, z: -1 }) {
  const length = Math.hypot(x, y, z);
  if (length <= MIN_MOVE_EPSILON) {
    return { ...fallback };
  }

  return {
    x: x / length,
    y: y / length,
    z: z / length,
  };
}

function forwardFromAngles(yawDegrees, pitchDegrees) {
  const yaw = (yawDegrees * Math.PI) / 180;
  const pitch = (pitchDegrees * Math.PI) / 180;

  return {
    x: -Math.cos(pitch) * Math.sin(yaw),
    y: -Math.sin(pitch),
    z: -Math.cos(pitch) * Math.cos(yaw),
  };
}

function rightFromYaw(yawDegrees) {
  const yaw = (yawDegrees * Math.PI) / 180;
  return {
    x: Math.cos(yaw),
    y: 0,
    z: -Math.sin(yaw),
  };
}

function upFromForwardRight(forward, right) {
  return normalize3D(
    right.y * forward.z - right.z * forward.y,
    right.z * forward.x - right.x * forward.z,
    right.x * forward.y - right.y * forward.x,
    { x: 0, y: 1, z: 0 }
  );
}

function createPose(position, yaw, pitch, fov = 90) {
  return {
    position: { x: position.x, y: position.y, z: position.z },
    yaw,
    pitch,
    fov,
  };
}

function buildLookTarget(position, yaw, pitch, distance = 1) {
  const forward = forwardFromAngles(yaw, pitch);
  return {
    x: position.x + forward.x * distance,
    y: position.y + forward.y * distance,
    z: position.z + forward.z * distance,
  };
}

function poseFromOrbitState(orbitState, fov = 90) {
  const target = orbitState?.target;
  if (!target) {
    return createPose({ x: 0, y: 1.6, z: 0 }, 180, 0, fov);
  }

  const yaw = Number.isFinite(orbitState.yaw) ? orbitState.yaw : 180;
  const pitch = Number.isFinite(orbitState.pitch) ? orbitState.pitch : 0;
  const distance = Math.max(Number(orbitState.distance) || 0.001, 0.001);
  const yawRadians = (yaw * Math.PI) / 180;
  const pitchRadians = (pitch * Math.PI) / 180;

  const position = {
    x: target.x + distance * Math.cos(pitchRadians) * Math.sin(yawRadians),
    y: target.y + distance * Math.sin(pitchRadians),
    z: target.z + distance * Math.cos(pitchRadians) * Math.cos(yawRadians),
  };
  return createPose(position, wrapAngleDegrees(yaw), clamp(pitch, -MAX_PITCH, MAX_PITCH), fov);
}

class FirstPersonInput {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.onTouchTap = typeof options.onTouchTap === "function" ? options.onTouchTap : null;
    this.keys = new Set();
    this.dragging = false;
    this.pointerLocked = false;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.lastClientX = 0;
    this.lastClientY = 0;
    this.touchPointerId = null;
    this.touchTravel = 0;
    this.mobileMovePointers = new Map();
    this.mobileMoveX = 0;
    this.mobileMoveZ = 0;
    this.mobileControls = null;
    this.userInteracted = false;
    this.boundHandlers = [];
    this.bind();
    this.createMobileControls();
  }

  bind() {
    const resetPointerLockState = () => {
      this.pointerLocked = false;
      this.dragging = false;
      this.keys.clear();
      this.lastClientX = 0;
      this.lastClientY = 0;
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
    };

    const onKeyDown = (event) => {
      this.keys.add(event.code);
      this.userInteracted = true;
    };

    const onKeyUp = (event) => {
      this.keys.delete(event.code);
    };

    const onPointerDown = (event) => {
      if (event.button !== 0) {
        return;
      }

      this.dragging = true;
      this.userInteracted = true;
      this.lastClientX = event.clientX;
      this.lastClientY = event.clientY;
      this.canvas.focus?.();
      if (event.pointerType === "touch") {
        this.touchPointerId = event.pointerId;
        this.touchTravel = 0;
        this.canvas.setPointerCapture?.(event.pointerId);
      } else if (document.pointerLockElement !== this.canvas) {
        try {
          const request = this.canvas.requestPointerLock?.({ unadjustedMovement: true });
          request?.catch?.(resetPointerLockState);
        } catch {
          try {
            const request = this.canvas.requestPointerLock?.();
            request?.catch?.(resetPointerLockState);
          } catch {
            resetPointerLockState();
          }
        }
      }
      event.preventDefault();
    };

    const releaseLook = (button = 0) => {
      if (button !== 0) {
        return;
      }

      this.dragging = false;
      if (document.pointerLockElement === this.canvas) {
        document.exitPointerLock?.();
      }
    };

    const onPointerMove = (event) => {
      if (event.pointerType !== "touch" || event.pointerId !== this.touchPointerId || !this.dragging) {
        return;
      }

      const movementX = clamp(event.clientX - this.lastClientX, -MAX_LOOK_DELTA_PER_EVENT, MAX_LOOK_DELTA_PER_EVENT);
      const movementY = clamp(event.clientY - this.lastClientY, -MAX_LOOK_DELTA_PER_EVENT, MAX_LOOK_DELTA_PER_EVENT);
      this.lastClientX = event.clientX;
      this.lastClientY = event.clientY;
      this.touchTravel += Math.hypot(movementX, movementY);
      this.mouseDeltaX += movementX * (TOUCH_LOOK_SENSITIVITY / POINTER_LOOK_SENSITIVITY);
      this.mouseDeltaY += movementY * (TOUCH_LOOK_SENSITIVITY / POINTER_LOOK_SENSITIVITY);
      event.preventDefault();
    };

    const onPointerUp = (event) => {
      if (event.pointerType === "touch") {
        if (event.pointerId === this.touchPointerId) {
          const isTap = event.type === "pointerup" && this.touchTravel <= TOUCH_TAP_MAX_TRAVEL;
          this.dragging = false;
          this.touchPointerId = null;
          if (isTap) {
            this.onTouchTap?.({ clientX: event.clientX, clientY: event.clientY });
          }
          this.touchTravel = 0;
        }
        return;
      }
      releaseLook(event.button);
    };

    const onMouseUp = (event) => {
      releaseLook(event.button);
    };

    const onMouseMove = (event) => {
      if (!this.pointerLocked || !this.dragging) {
        return;
      }

      const movementX = clamp(event.movementX || 0, -MAX_LOOK_DELTA_PER_EVENT, MAX_LOOK_DELTA_PER_EVENT);
      const movementY = clamp(event.movementY || 0, -MAX_LOOK_DELTA_PER_EVENT, MAX_LOOK_DELTA_PER_EVENT);
      this.mouseDeltaX += movementX;
      this.mouseDeltaY += movementY;
    };

    const onPointerLockChange = () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.pointerLocked) {
        this.dragging = false;
      }
      this.lastClientX = 0;
      this.lastClientY = 0;
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
    };

    const onPointerLockError = () => {
      resetPointerLockState();
    };

    const onContextMenu = (event) => {
      event.preventDefault();
    };

    const onBlur = () => {
      this.keys.clear();
      this.dragging = false;
      this.touchPointerId = null;
      this.touchTravel = 0;
      this.mobileMovePointers.clear();
      this.updateMobileMovement();
      this.mouseDeltaX = 0;
      this.mouseDeltaY = 0;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("pointerlockerror", onPointerLockError);
    this.canvas.addEventListener("pointerdown", onPointerDown);
    this.canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    this.canvas.addEventListener("pointerup", onPointerUp);
    this.canvas.addEventListener("pointercancel", onPointerUp);
    this.canvas.addEventListener("contextmenu", onContextMenu);

    this.boundHandlers.push(() => window.removeEventListener("keydown", onKeyDown));
    this.boundHandlers.push(() => window.removeEventListener("keyup", onKeyUp));
    this.boundHandlers.push(() => window.removeEventListener("blur", onBlur));
    this.boundHandlers.push(() => window.removeEventListener("mouseup", onMouseUp));
    this.boundHandlers.push(() => document.removeEventListener("mousemove", onMouseMove));
    this.boundHandlers.push(() => document.removeEventListener("pointerlockchange", onPointerLockChange));
    this.boundHandlers.push(() => document.removeEventListener("pointerlockerror", onPointerLockError));
    this.boundHandlers.push(() => this.canvas.removeEventListener("pointerdown", onPointerDown));
    this.boundHandlers.push(() => this.canvas.removeEventListener("pointermove", onPointerMove));
    this.boundHandlers.push(() => this.canvas.removeEventListener("pointerup", onPointerUp));
    this.boundHandlers.push(() => this.canvas.removeEventListener("pointercancel", onPointerUp));
    this.boundHandlers.push(() => this.canvas.removeEventListener("contextmenu", onContextMenu));
  }

  createMobileControls() {
    const host = this.canvas.closest?.(".hero-media") || this.canvas.parentElement;
    if (!host) {
      return;
    }

    const controls = document.createElement("div");
    controls.className = "fp-mobile-controls";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "First-person movement");
    controls.innerHTML = `
      <button class="fp-mobile-control fp-mobile-control--forward" type="button" data-move-x="0" data-move-z="1" aria-label="Move forward">W</button>
      <button class="fp-mobile-control fp-mobile-control--left" type="button" data-move-x="-1" data-move-z="0" aria-label="Strafe left">A</button>
      <button class="fp-mobile-control fp-mobile-control--back" type="button" data-move-x="0" data-move-z="-1" aria-label="Move backward">S</button>
      <button class="fp-mobile-control fp-mobile-control--right" type="button" data-move-x="1" data-move-z="0" aria-label="Strafe right">D</button>
    `;

    for (const button of controls.querySelectorAll("button")) {
      const startMove = (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        button.setPointerCapture?.(event.pointerId);
        this.mobileMovePointers.set(event.pointerId, {
          x: Number(button.dataset.moveX) || 0,
          z: Number(button.dataset.moveZ) || 0,
        });
        this.userInteracted = true;
        this.updateMobileMovement();
      };
      const stopMove = (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.mobileMovePointers.delete(event.pointerId);
        this.updateMobileMovement();
      };
      button.addEventListener("pointerdown", startMove);
      button.addEventListener("pointerup", stopMove);
      button.addEventListener("pointercancel", stopMove);
      button.addEventListener("lostpointercapture", stopMove);
    }

    host.appendChild(controls);
    this.mobileControls = controls;
  }

  updateMobileMovement() {
    let moveX = 0;
    let moveZ = 0;
    for (const movement of this.mobileMovePointers.values()) {
      moveX += movement.x;
      moveZ += movement.z;
    }
    const normalized = normalize2D(moveX, moveZ);
    this.mobileMoveX = normalized.x;
    this.mobileMoveZ = normalized.z;
  }

  readFrame() {
    let moveX = this.mobileMoveX;
    let moveZ = this.mobileMoveZ;

    if (this.keys.has("KeyA")) moveX -= 1;
    if (this.keys.has("KeyD")) moveX += 1;
    if (this.keys.has("KeyW")) moveZ += 1;
    if (this.keys.has("KeyS")) moveZ -= 1;

    const normalizedMove = normalize2D(moveX, moveZ);
    const vertical =
      (this.keys.has("Space") ? 1 : 0) -
      (this.keys.has("KeyQ") || this.keys.has("ControlLeft") || this.keys.has("ControlRight") ? 1 : 0);

    const lookYaw = -this.mouseDeltaX * POINTER_LOOK_SENSITIVITY;
    const lookPitch = this.mouseDeltaY * POINTER_LOOK_SENSITIVITY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;

    return {
      moveX: normalizedMove.x,
      moveY: vertical,
      moveZ: normalizedMove.z,
      lookYaw,
      lookPitch,
      jumpPressed: this.keys.has("Space"),
      sprint: this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"),
    };
  }

  hasUserInteracted() {
    return this.userInteracted;
  }

  clearInteraction() {
    this.userInteracted = false;
  }

  dispose() {
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock?.();
    }

    for (const dispose of this.boundHandlers.splice(0)) {
      try {
        dispose();
      } catch {}
    }
    this.mobileMovePointers.clear();
    this.mobileControls?.remove();
    this.mobileControls = null;
  }
}

class SphereMover {
  constructor(collision, radius) {
    this.collision = collision;
    this.radius = radius;
    this.pushOut = { x: 0, y: 0, z: 0 };
  }

  resolve(position) {
    if (!this.collision) {
      return false;
    }

    let collided = false;
    for (let iteration = 0; iteration < 4; iteration += 1) {
      if (!this.collision.querySphere(position.x, position.y, position.z, this.radius, this.pushOut)) {
        break;
      }

      position.x += this.pushOut.x;
      position.y += this.pushOut.y;
      position.z += this.pushOut.z;
      collided = true;

      if (Math.hypot(this.pushOut.x, this.pushOut.y, this.pushOut.z) <= 1e-5) {
        break;
      }
    }

    return collided;
  }

  move(position, delta) {
    const distance = Math.hypot(delta.x, delta.y, delta.z);
    if (distance <= MIN_MOVE_EPSILON) {
      return this.resolve(position);
    }

    const stepDistance = Math.max(this.radius * 0.6, 0.05);
    const stepCount = Math.max(1, Math.ceil(distance / stepDistance));
    const stepX = delta.x / stepCount;
    const stepY = delta.y / stepCount;
    const stepZ = delta.z / stepCount;
    let collided = false;

    for (let step = 0; step < stepCount; step += 1) {
      position.x += stepX;
      position.y += stepY;
      position.z += stepZ;
      collided = this.resolve(position) || collided;
    }

    return collided;
  }
}

class FlyController {
  constructor(collision, options = {}) {
    this.collision = collision || null;
    this.radius = options.radius || DEFAULT_COLLISION_RADIUS;
    this.speed = options.speed || DEFAULT_FLY_SPEED;
    this.sprintMultiplier = options.sprintMultiplier || DEFAULT_FLY_SPRINT_MULTIPLIER;
    this.fov = options.fov || 90;
    this.position = { x: 0, y: 1.6, z: 0 };
    this.yaw = 180;
    this.pitch = 0;
    this.spawnPose = null;
    this.mover = new SphereMover(this.collision, this.radius);
  }

  setCollision(collision) {
    this.collision = collision || null;
    this.mover = new SphereMover(this.collision, this.radius);
  }

  enter(pose, options = {}) {
    const allowSpawnAdjustment = options.allowSpawnAdjustment !== false;
    this.position = { ...pose.position };
    this.yaw = pose.yaw;
    this.pitch = pose.pitch;
    this.fov = pose.fov || this.fov;

    debugFpNavigation("[FlyController enter] initial position:", { ...this.position }, "allowSpawnAdjustment:", allowSpawnAdjustment);

    if (this.collision && allowSpawnAdjustment) {
      const collidedAtPreset = this.collision.querySphere?.(
        this.position.x,
        this.position.y,
        this.position.z,
        this.radius,
        this.mover.pushOut
      );
      debugFpNavigation("[FlyController enter] collidedAtPreset:", collidedAtPreset, "pushOut:", { ...this.mover.pushOut });

      if (collidedAtPreset) {
        const cameraSpawn = this.collision.findCameraSpawnNear?.([this.position.x, this.position.y, this.position.z], {
          radius: this.radius,
          headClearance: 1.25,
        });
        debugFpNavigation("[FlyController enter] cameraSpawn found:", cameraSpawn);
        if (cameraSpawn) {
          this.position = { x: cameraSpawn.x, y: cameraSpawn.y, z: cameraSpawn.z };
        } else {
          const spawn = this.collision.findSphereSpawnNear?.([this.position.x, this.position.y, this.position.z], {
            radius: this.radius,
          });
          debugFpNavigation("[FlyController enter] sphereSpawn found:", spawn);
          if (spawn) {
            this.position = { x: spawn.x, y: spawn.y, z: spawn.z };
          } else {
            this.mover.resolve(this.position);
            debugFpNavigation("[FlyController enter] mover resolved to position:", { ...this.position });
          }
        }
      }
    }

    debugFpNavigation("[FlyController enter] final position set:", { ...this.position });
    this.spawnPose = createPose(this.position, this.yaw, this.pitch, this.fov);
  }

  update(deltaSeconds, frame) {
    this.yaw = wrapAngleDegrees(this.yaw + frame.lookYaw);
    this.pitch = clamp(this.pitch + frame.lookPitch, -MAX_PITCH, MAX_PITCH);

    const forward = forwardFromAngles(this.yaw, this.pitch);
    const right = rightFromYaw(this.yaw);
    const up = upFromForwardRight(forward, right);
    const speed = this.speed * (frame.sprint ? this.sprintMultiplier : 1) * deltaSeconds;

    const delta = {
      x: (right.x * frame.moveX + forward.x * frame.moveZ + up.x * frame.moveY) * speed,
      y: (right.y * frame.moveX + forward.y * frame.moveZ + up.y * frame.moveY) * speed,
      z: (right.z * frame.moveX + forward.z * frame.moveZ + up.z * frame.moveY) * speed,
    };

    this.mover.move(this.position, delta);
  }

  reset() {
    if (!this.spawnPose) {
      return false;
    }

    this.position = { ...this.spawnPose.position };
    this.yaw = this.spawnPose.yaw;
    this.pitch = this.spawnPose.pitch;
    this.fov = this.spawnPose.fov;
    return true;
  }

  getPose() {
    return createPose(this.position, this.yaw, this.pitch, this.fov);
  }
}

class WalkController {
  constructor(collision, options = {}) {
    this.collision = collision || null;
    this.radius = options.radius || DEFAULT_COLLISION_RADIUS;
    this.eyeHeight = options.eyeHeight || DEFAULT_EYE_HEIGHT;
    this.walkSpeed = options.speed || DEFAULT_WALK_SPEED;
    this.sprintMultiplier = options.sprintMultiplier || DEFAULT_WALK_SPRINT_MULTIPLIER;
    this.gravity = options.gravity || DEFAULT_GRAVITY;
    this.jumpSpeed = options.jumpSpeed || DEFAULT_JUMP_SPEED;
    this.stepHeight = options.stepHeight || DEFAULT_STEP_HEIGHT;
    this.groundStickDistance = options.groundStickDistance || DEFAULT_GROUND_STICK_DISTANCE;
    this.headOffset = options.headOffset || DEFAULT_HEAD_OFFSET;
    this.fov = options.fov || 90;
    this.position = { x: 0, y: this.eyeHeight, z: 0 };
    this.yaw = 180;
    this.pitch = 0;
    this.velocityY = 0;
    this.grounded = false;
    this.jumpLatch = false;
    this.jumping = false;
    this.spawnPose = null;
    this.pushOut = { x: 0, y: 0, z: 0 };
    this.referenceFloorY = null;
  }

  setCollision(collision) {
    this.collision = collision || null;
  }

  enter(pose, options = {}) {
    const allowSpawnAdjustment = options.allowSpawnAdjustment !== false;
    this.position = { ...pose.position };
    this.yaw = pose.yaw;
    this.pitch = pose.pitch;
    this.fov = pose.fov || this.fov;
    this.velocityY = 0;
    this.grounded = false;
    this.jumpLatch = false;
    this.jumping = false;
    this.referenceFloorY = null;

    debugFpNavigation("[WalkController enter] initial position:", { ...this.position }, "allowSpawnAdjustment:", allowSpawnAdjustment);

    if (this.collision && allowSpawnAdjustment) {
      const collidedAtPreset = this.collision.querySphere?.(
        this.position.x,
        this.position.y,
        this.position.z,
        this.radius,
        this.pushOut
      );
      debugFpNavigation("[WalkController enter] collidedAtPreset:", collidedAtPreset, "pushOut:", { ...this.pushOut });

      if (collidedAtPreset) {
        const spawn = this.collision.findCameraSpawnNear?.([this.position.x, this.position.y, this.position.z], {
          radius: this.radius,
          headClearance: this.eyeHeight,
        });
        debugFpNavigation("[WalkController enter] cameraSpawn found:", spawn);
        if (spawn) {
          this.position = { x: spawn.x, y: spawn.y, z: spawn.z };
          this.referenceFloorY = Number.isFinite(spawn.floorY) ? spawn.floorY : (this.position.y - this.eyeHeight);
        } else {
          const sphereSpawn = this.collision.findSphereSpawnNear?.([this.position.x, this.position.y, this.position.z], {
            radius: this.radius,
          });
          debugFpNavigation("[WalkController enter] sphereSpawn found:", sphereSpawn);
          if (sphereSpawn) {
            this.position = { x: sphereSpawn.x, y: sphereSpawn.y, z: sphereSpawn.z };
            this.referenceFloorY = this.position.y - this.eyeHeight;
          }
        }
      } else {
        this.referenceFloorY = this.position.y - this.eyeHeight;
      }

      this.resolveBodyCollision();
      this.snapToGround(true);
      this.grounded = true;
      this.velocityY = 0;
    } else {
      this.referenceFloorY = this.position.y - this.eyeHeight;
    }

    debugFpNavigation("[WalkController enter] final position set:", { ...this.position }, "referenceFloorY:", this.referenceFloorY);
    this.spawnPose = createPose(this.position, this.yaw, this.pitch, this.fov);
  }

  applySpherePushAtOffset(offsetY) {
    if (!this.collision) {
      return { x: 0, y: 0, z: 0 };
    }

    const sphereCenterY = this.position.y + offsetY;
    if (!this.collision.querySphere(this.position.x, sphereCenterY, this.position.z, this.radius, this.pushOut)) {
      return { x: 0, y: 0, z: 0 };
    }

    this.position.x += this.pushOut.x;
    this.position.y += this.pushOut.y;
    this.position.z += this.pushOut.z;
    return { ...this.pushOut };
  }

  resolveBodyCollision() {
    if (!this.collision) {
      return;
    }

    const footOffset = -(this.eyeHeight - this.radius);
    const torsoOffset = footOffset * 0.5;
    const headOffset = -this.headOffset;

    for (let iteration = 0; iteration < 4; iteration += 1) {
      const footPush = this.applySpherePushAtOffset(footOffset);
      const torsoPush = this.applySpherePushAtOffset(torsoOffset);
      const headPush = this.applySpherePushAtOffset(headOffset);

      if (footPush.y > 0.001) {
        if (this.velocityY < 0) {
          this.velocityY = 0;
        }
        this.grounded = true;
        this.jumping = false;
      }

      if (headPush.y < -0.001) {
        if (this.velocityY > 0) {
          this.velocityY = 0;
        }
      }

      const maxPushLength = Math.max(
        Math.hypot(footPush.x, footPush.y, footPush.z),
        Math.hypot(torsoPush.x, torsoPush.y, torsoPush.z),
        Math.hypot(headPush.x, headPush.y, headPush.z)
      );

      if (maxPushLength <= 1e-5) {
        break;
      }
    }
  }

  snapToGround(force = false) {
    if (!this.collision) {
      this.grounded = false;
      return;
    }

    const startY = this.position.y - 0.05;
    const maxDistance = this.eyeHeight + this.stepHeight + 1.5;

    // Cast 5 rays (center, and 4 orthogonal offsets within collision radius) to prevent falling through small gaps/holes.
    const rayOffset = this.radius * 0.7; // 0.18 * 0.7 = ~0.126m offset
    const testOffsets = [
      { dx: 0, dz: 0 },
      { dx: rayOffset, dz: 0 },
      { dx: -rayOffset, dz: 0 },
      { dx: 0, dz: rayOffset },
      { dx: 0, dz: -rayOffset }
    ];

    let detectedGroundY = null;
    let bestGroundHit = null;

    for (const offset of testOffsets) {
      const groundHit = this.collision.queryRay(
        this.position.x + offset.dx,
        startY,
        this.position.z + offset.dz,
        0,
        -1,
        0,
        maxDistance
      );

      if (groundHit && groundHit.ny >= 0.4) {
        if (detectedGroundY === null || groundHit.y > detectedGroundY) {
          detectedGroundY = groundHit.y;
          bestGroundHit = groundHit;
        }
      }
    }

    const referenceFloorY = Number.isFinite(this.referenceFloorY) ? this.referenceFloorY : null;

    // Guard: never snap to a floor that is much lower than the last known floor.
    // This prevents a nearby lower surface (staircase, sub-floor) from pulling the
    // player down when they are walking on a flat corridor above it.
    const maxDropFromReference = this.groundStickDistance; // same as downward stick distance
    let guardedDetectedY = null;
    if (detectedGroundY !== null) {
      if (referenceFloorY === null || detectedGroundY >= referenceFloorY - maxDropFromReference) {
        guardedDetectedY = detectedGroundY;
      }
      // else: detected floor is too far below last known floor — ignore it.
    }

    const targetFloorY = guardedDetectedY !== null ? guardedDetectedY : referenceFloorY;

    debugFpNavigation("[WalkController snapToGround] position.y:", this.position.y, "startY:", startY, "bestGroundHit:", bestGroundHit, "referenceFloorY:", referenceFloorY, "detectedGroundY:", detectedGroundY, "guardedDetectedY:", guardedDetectedY, "targetFloorY:", targetFloorY);

    if (targetFloorY === null) {
      this.grounded = false;
      return;
    }

    const targetEyeY = targetFloorY + this.eyeHeight;
    const deltaY = targetEyeY - this.position.y;
 
    const currentStickDistance = this.jumping ? 0.05 : this.groundStickDistance;
 
    if (force || (deltaY >= -currentStickDistance && deltaY <= this.stepHeight && this.velocityY <= 0)) {
      this.position.y = targetEyeY;
      this.velocityY = 0;
      this.grounded = true;
      this.jumping = false;
      this.referenceFloorY = targetFloorY;
      debugFpNavigation("[WalkController snapToGround] SNAPPED to targetEyeY:", targetEyeY);
      return;
    }

    this.grounded = false;
  }

  update(deltaSeconds, frame) {
    this.yaw = wrapAngleDegrees(this.yaw + frame.lookYaw);
    this.pitch = clamp(this.pitch + frame.lookPitch, -MAX_PITCH, MAX_PITCH);

    const move = normalize2D(frame.moveX, frame.moveZ);
    const right = rightFromYaw(this.yaw);
    const planarForward = {
      x: -Math.sin((this.yaw * Math.PI) / 180),
      z: -Math.cos((this.yaw * Math.PI) / 180),
    };

    // Sub-step the physics update to prevent tunneling through collision geometry on lag frames.
    const maxSubStepTime = 0.015; // ~60fps step size
    let remainingTime = Math.min(deltaSeconds, 0.1); // clamp extreme lag frames to 100ms to avoid freezing

    if (frame.jumpPressed && this.grounded && !this.jumpLatch) {
      this.velocityY = this.jumpSpeed;
      this.grounded = false;
      this.jumpLatch = true;
      this.jumping = true;
    } else if (!frame.jumpPressed) {
      this.jumpLatch = false;
    }

    while (remainingTime > 0) {
      const subDelta = Math.min(remainingTime, maxSubStepTime);
      remainingTime -= subDelta;

      // Horizontal movement
      const speed = this.walkSpeed * (frame.sprint ? this.sprintMultiplier : 1) * subDelta;
      this.position.x += (right.x * move.x + planarForward.x * move.z) * speed;
      this.position.z += (right.z * move.x + planarForward.z * move.z) * speed;

      // Vertical movement
      this.velocityY -= this.gravity * subDelta;
      this.position.y += this.velocityY * subDelta;

      // Collision resolution
      this.resolveBodyCollision();

      if (this.velocityY > 0) {
        this.grounded = false;
      }

      // Ground snapping
      this.snapToGround(false);
    }
  }

  reset() {
    if (!this.spawnPose) {
      return false;
    }

    this.position = { ...this.spawnPose.position };
    this.yaw = this.spawnPose.yaw;
    this.pitch = this.spawnPose.pitch;
    this.fov = this.spawnPose.fov;
    this.velocityY = 0;
    this.grounded = false;
    this.jumpLatch = false;
    this.jumping = false;
    this.referenceFloorY = this.position.y - this.eyeHeight;
    this.resolveBodyCollision();
    this.grounded = true;
    return true;
  }

  getPose() {
    return createPose(this.position, this.yaw, this.pitch, this.fov);
  }
}

class FirstPersonNavigationController {
  constructor(canvas, collision, options = {}) {
    this.canvas = canvas;
    this.collision = collision || null;
    this.input = new FirstPersonInput(canvas, { onTouchTap: options.onTouchTap });
    this.flyController = new FlyController(this.collision, options.fly || {});
    this.walkController = new WalkController(this.collision, options.walk || {});
    this.mode = options.mode === "fly" ? "fly" : "walk";
    this.activeController = this.mode === "fly" ? this.flyController : this.walkController;
    this.passiveYawSpeed = options.passiveYawSpeed ?? 7;
    this.preservePresetSpawn = options.preservePresetSpawn === true;
    this.navigationTarget = null;
    this.navigationBlockedTime = 0;
  }

  setCollision(collision) {
    this.collision = collision || null;
    this.flyController.setCollision(this.collision);
    this.walkController.setCollision(this.collision);
  }

  setFlyCollisionIgnored(ignored) {
    this.flyController.setCollision(ignored ? null : this.collision);
  }

  setMode(mode) {
    const nextMode = mode === "fly" ? "fly" : "walk";
    if (nextMode === this.mode) {
      return;
    }

    this.cancelNavigation();

    const pose = this.activeController.getPose();
    this.mode = nextMode;
    this.activeController = this.mode === "fly" ? this.flyController : this.walkController;

    if (this.mode === "walk" && this.collision) {
      const startY = pose.position.y - 0.05;
      const groundHit = this.collision.queryRay(
        pose.position.x,
        startY,
        pose.position.z,
        0,
        -1,
        0,
        50.0
      );
      if (groundHit && groundHit.ny >= 0.4) {
        pose.position.y = groundHit.y + this.walkController.eyeHeight;
        debugFpNavigation("[FirstPersonNavigationController setMode] Snapped from fly to walk floor at Y:", groundHit.y);
      }
    }

    this.activeController.enter(pose, {
      allowSpawnAdjustment: false,
    });
  }

  setPreservePresetSpawn(enabled) {
    this.preservePresetSpawn = enabled === true;
  }

  enterFromOrbitState(orbitState, fov) {
    this.cancelNavigation();
    const pose = poseFromOrbitState(orbitState, fov);
    this.activeController.enter(pose, {
      allowSpawnAdjustment: !this.preservePresetSpawn,
    });
    this.input.clearInteraction();
    return this.activeController.getPose();
  }

  navigateToFloor(target) {
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y) || !Number.isFinite(target.z)) {
      return false;
    }

    const pose = this.activeController.getPose();
    const targetPosition = {
      x: target.x,
      y: target.y + this.walkController.eyeHeight,
      z: target.z,
    };
    const distance = Math.hypot(
      targetPosition.x - pose.position.x,
      this.mode === "fly" ? targetPosition.y - pose.position.y : 0,
      targetPosition.z - pose.position.z
    );
    if (distance <= NAVIGATION_STOP_DISTANCE || distance > NAVIGATION_MAX_DISTANCE) {
      return false;
    }

    if (this.collision?.querySphere?.(
      targetPosition.x,
      targetPosition.y,
      targetPosition.z,
      this.walkController.radius,
      { x: 0, y: 0, z: 0 }
    )) {
      return false;
    }

    this.navigationTarget = targetPosition;
    this.navigationBlockedTime = 0;
    return true;
  }

  cancelNavigation() {
    this.navigationTarget = null;
    this.navigationBlockedTime = 0;
  }

  applyNavigationTarget(frame) {
    if (!this.navigationTarget) {
      return false;
    }

    const hasManualMovement = Math.abs(frame.moveX) > MIN_MOVE_EPSILON ||
      Math.abs(frame.moveY) > MIN_MOVE_EPSILON ||
      Math.abs(frame.moveZ) > MIN_MOVE_EPSILON ||
      frame.jumpPressed;
    if (hasManualMovement) {
      this.cancelNavigation();
      return false;
    }

    const pose = this.activeController.getPose();
    const dx = this.navigationTarget.x - pose.position.x;
    const dy = this.navigationTarget.y - pose.position.y;
    const dz = this.navigationTarget.z - pose.position.z;
    const distance = this.mode === "fly" ? Math.hypot(dx, dy, dz) : Math.hypot(dx, dz);
    if (distance <= NAVIGATION_STOP_DISTANCE) {
      this.cancelNavigation();
      return false;
    }

    if (this.mode === "fly") {
      const desired = normalize3D(dx, dy, dz);
      const forward = forwardFromAngles(pose.yaw, pose.pitch);
      const right = rightFromYaw(pose.yaw);
      const up = upFromForwardRight(forward, right);
      frame.moveX = desired.x * right.x + desired.y * right.y + desired.z * right.z;
      frame.moveY = desired.x * up.x + desired.y * up.y + desired.z * up.z;
      frame.moveZ = desired.x * forward.x + desired.y * forward.y + desired.z * forward.z;
    } else {
      const desired = normalize2D(dx, dz);
      const right = rightFromYaw(pose.yaw);
      const forward = {
        x: -Math.sin((pose.yaw * Math.PI) / 180),
        z: -Math.cos((pose.yaw * Math.PI) / 180),
      };
      frame.moveX = desired.x * right.x + desired.z * right.z;
      frame.moveZ = desired.x * forward.x + desired.z * forward.z;
    }

    return true;
  }

  update(deltaSeconds, cameraEntity, options = {}) {
    const frame = this.input.readFrame();
    if (options.autoRotate && !this.input.hasUserInteracted()) {
      frame.lookYaw -= this.passiveYawSpeed * deltaSeconds;
    }
    const previousPose = this.activeController.getPose();
    const navigating = this.applyNavigationTarget(frame);
    this.activeController.update(deltaSeconds, frame);
    const pose = this.activeController.getPose();
    if (navigating && this.navigationTarget) {
      const moved = Math.hypot(
        pose.position.x - previousPose.position.x,
        pose.position.y - previousPose.position.y,
        pose.position.z - previousPose.position.z
      );
      this.navigationBlockedTime = moved < 0.002
        ? this.navigationBlockedTime + deltaSeconds
        : 0;
      if (this.navigationBlockedTime >= NAVIGATION_BLOCKED_TIMEOUT) {
        this.cancelNavigation();
      }
    }
    const target = buildLookTarget(pose.position, pose.yaw, pose.pitch);
    cameraEntity.setPosition(pose.position.x, pose.position.y, pose.position.z);
    cameraEntity.lookAt(target.x, target.y, target.z);
    cameraEntity.camera.fov = pose.fov;
    return pose;
  }

  hasUserInteracted() {
    return this.input.hasUserInteracted();
  }

  reset(cameraEntity) {
    this.cancelNavigation();
    if (!this.activeController.reset()) {
      return false;
    }

    const pose = this.activeController.getPose();
    const target = buildLookTarget(pose.position, pose.yaw, pose.pitch);
    cameraEntity.setPosition(pose.position.x, pose.position.y, pose.position.z);
    cameraEntity.lookAt(target.x, target.y, target.z);
    cameraEntity.camera.fov = pose.fov;
    return true;
  }

  getOrbitState(pc) {
    const pose = this.activeController.getPose();
    const target = buildLookTarget(pose.position, pose.yaw, pose.pitch);
    return {
      target: new pc.Vec3(target.x, target.y, target.z),
      distance: 0.001,
      yaw: pose.yaw,
      pitch: pose.pitch,
    };
  }

  dispose() {
    this.cancelNavigation();
    this.input.dispose();
  }
}

export { FirstPersonNavigationController };

import { computeAutoCutaway } from "./autoCutaway.js?v=20260610fp21";
import { buildCollisionAdjustedViewPreset, loadMeshCollisionFromGlb } from "./fpCollision.js?v=20260610fp21";
import { FirstPersonNavigationController } from "./fpNavigation.js?v=20260610fp21";

const PLAYCANVAS_CDN = "https://cdn.jsdelivr.net/npm/playcanvas/+esm";
const ORBIT_DAMPING_DECAY_MS = 140;
const CUTAWAY_DAMPING_DECAY_MS = 110;
const AUTO_ROTATE_DEGREES_PER_SECOND = 6;
const MODEL_VIEWER_PAN_SENSITIVITY = 0.018;
const AUTO_CUTAWAY_FADE_WIDTH = 0.12;
const SOG_BOX_CULLING_MODIFIER = {
  glsl: `
uniform mat4 orientedClipBoxWorldToUnit;
uniform float orientedClipBoxEnabled;
uniform float orientedClipBoxFadeWidth;
uniform vec3 cameraWorldPosition;
uniform float backfaceCullingEnabled;
uniform float backfaceThreshold;
uniform float backfaceFadeWidth;

vec3 rotateByQuaternion(vec3 v, vec4 q) {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

vec3 selectNormalAxis(vec3 scale) {
  if (scale.x <= scale.y && scale.x <= scale.z) {
    return vec3(1.0, 0.0, 0.0);
  }
  if (scale.y <= scale.x && scale.y <= scale.z) {
    return vec3(0.0, 1.0, 0.0);
  }
  return vec3(0.0, 0.0, 1.0);
}

void modifySplatCenter(inout vec3 center) {
}

void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
  if (orientedClipBoxEnabled > 0.5) {
    vec3 clipLocalPoint = (orientedClipBoxWorldToUnit * vec4(modifiedCenter, 1.0)).xyz;
    vec3 outsideDistance = abs(clipLocalPoint) - vec3(0.5);
    float maxOutsideDistance = max(max(outsideDistance.x, outsideDistance.y), outsideDistance.z);
    float fadeWidth = max(orientedClipBoxFadeWidth, 0.0001);
    float clipVisibility = 1.0 - smoothstep(0.0, fadeWidth, maxOutsideDistance);
    if (clipVisibility <= 0.001) {
      scale = vec3(0.0);
      return;
    }
    scale *= max(clipVisibility, 0.05);
  }

  if (backfaceCullingEnabled > 0.5) {
    vec3 axis = selectNormalAxis(max(scale, vec3(0.0001)));
    vec3 worldNormal = normalize(rotateByQuaternion(axis, rotation));
    vec3 directionToCamera = normalize(cameraWorldPosition - modifiedCenter);
    float facingDot = dot(worldNormal, directionToCamera);
    float visibility = smoothstep(
      backfaceThreshold - max(backfaceFadeWidth, 0.0001),
      backfaceThreshold + max(backfaceFadeWidth, 0.0001),
      facingDot
    );
    if (visibility <= 0.001) {
      scale = vec3(0.0);
      return;
    }
    scale *= max(visibility, 0.08);
  }
}

void modifySplatColor(vec3 center, inout vec4 color) {
  float visibility = 1.0;

  if (orientedClipBoxEnabled < 0.5) {
  } else {
    vec3 clipLocalPoint = (orientedClipBoxWorldToUnit * vec4(center, 1.0)).xyz;
    vec3 outsideDistance = abs(clipLocalPoint) - vec3(0.5);
    float maxOutsideDistance = max(max(outsideDistance.x, outsideDistance.y), outsideDistance.z);

    if (maxOutsideDistance > 0.0) {
      float fadeWidth = max(orientedClipBoxFadeWidth, 0.0001);
      visibility *= 1.0 - smoothstep(0.0, fadeWidth, maxOutsideDistance);
    }
  }

  if (backfaceCullingEnabled > 0.5) {
    color.a *= visibility;
  }

  color.a *= visibility;
}
`,
  wgsl: `
uniform orientedClipBoxWorldToUnit: mat4x4f;
uniform orientedClipBoxEnabled: f32;
uniform orientedClipBoxFadeWidth: f32;
uniform cameraWorldPosition: vec3f;
uniform backfaceCullingEnabled: f32;
uniform backfaceThreshold: f32;
uniform backfaceFadeWidth: f32;

fn rotateByQuaternion(v: vec3f, q: vec4f) -> vec3f {
  return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
}

fn selectNormalAxis(scale: vec3f) -> vec3f {
  if (scale.x <= scale.y && scale.x <= scale.z) {
    return vec3f(1.0, 0.0, 0.0);
  }
  if (scale.y <= scale.x && scale.y <= scale.z) {
    return vec3f(0.0, 1.0, 0.0);
  }
  return vec3f(0.0, 0.0, 1.0);
}

fn modifySplatCenter(center: ptr<function, vec3f>) {
}

fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
  if (uniform.orientedClipBoxEnabled > 0.5) {
    let clipLocalPoint = (uniform.orientedClipBoxWorldToUnit * vec4f(modifiedCenter, 1.0)).xyz;
    let outsideDistance = abs(clipLocalPoint) - vec3f(0.5, 0.5, 0.5);
    let maxOutsideDistance = max(max(outsideDistance.x, outsideDistance.y), outsideDistance.z);
    let fadeWidth = max(uniform.orientedClipBoxFadeWidth, 0.0001);
    let clipVisibility = 1.0 - smoothstep(0.0, fadeWidth, maxOutsideDistance);
    if (clipVisibility <= 0.001) {
      (*scale) = vec3f(0.0, 0.0, 0.0);
      return;
    }
    let clipScale = max(clipVisibility, 0.05);
    (*scale) *= vec3f(clipScale, clipScale, clipScale);
  }

  if (uniform.backfaceCullingEnabled > 0.5) {
    let axis = selectNormalAxis(max((*scale), vec3f(0.0001, 0.0001, 0.0001)));
    let worldNormal = normalize(rotateByQuaternion(axis, (*rotation)));
    let directionToCamera = normalize(uniform.cameraWorldPosition - modifiedCenter);
    let fadeWidth = max(uniform.backfaceFadeWidth, 0.0001);
    let facingDot = dot(worldNormal, directionToCamera);
    let visibility = smoothstep(
      uniform.backfaceThreshold - fadeWidth,
      uniform.backfaceThreshold + fadeWidth,
      facingDot
    );
    if (visibility <= 0.001) {
      (*scale) = vec3f(0.0, 0.0, 0.0);
      return;
    }
    let backfaceScale = max(visibility, 0.08);
    (*scale) *= vec3f(backfaceScale, backfaceScale, backfaceScale);
  }
}

fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  var visibility = 1.0;

  if (uniform.orientedClipBoxEnabled > 0.5) {
    let clipLocalPoint = (uniform.orientedClipBoxWorldToUnit * vec4f(center, 1.0)).xyz;
    let outsideDistance = abs(clipLocalPoint) - vec3f(0.5, 0.5, 0.5);
    let maxOutsideDistance = max(max(outsideDistance.x, outsideDistance.y), outsideDistance.z);

    if (maxOutsideDistance > 0.0) {
      let fadeWidth = max(uniform.orientedClipBoxFadeWidth, 0.0001);
      visibility *= 1.0 - smoothstep(0.0, fadeWidth, maxOutsideDistance);
    }
  }

  (*color).a *= visibility;
}
`,
};

function supportsPlayCanvasSogViewer() {
  const canvas = document.createElement("canvas");
  return !!canvas.getContext("webgl2");
}

class SimpleOrbitController {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.onChange = options.onChange || (() => {});
    this.onPanStateChange = options.onPanStateChange || (() => {});
    this.getFieldOfView = options.getFieldOfView || (() => 45);
    this.dragging = false;
    this.dragMode = "orbit";
    this.lastX = 0;
    this.lastY = 0;
    this.pinchDistance = 0;
    this.touchCenterX = 0;
    this.touchCenterY = 0;
    this.touchMode = null;
    this.activePointerId = null;
    this.ignorePointerEvents = false;
    this.disposeFns = [];
  }

  bind(state) {
    const pointerDown = (event) => {
      if (event.pointerType === "touch" || this.ignorePointerEvents) {
        return;
      }

      if (event.button !== 0 && event.button !== 2) {
        return;
      }

      this.dragging = true;
      this.activePointerId = event.pointerId;
      this.dragMode = event.button === 2 ? "pan" : "orbit";
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.onPanStateChange(this.dragMode === "pan");
      this.canvas.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };

    const pointerMove = (event) => {
      if (!this.dragging || this.ignorePointerEvents || event.pointerId !== this.activePointerId) {
        return;
      }

      const deltaX = event.clientX - this.lastX;
      const deltaY = event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;

      if (this.dragMode === "pan") {
        this.panOrbitTarget(state, deltaX, deltaY);
      } else {
        state.yaw -= deltaX * 0.25;
        state.pitch = Math.max(-85, Math.min(85, state.pitch + deltaY * 0.2));
      }
      this.onChange();
      event.preventDefault();
    };

    const pointerUp = (event) => {
      if (event.pointerId !== this.activePointerId) {
        return;
      }

      const wasPanning = this.dragMode === "pan";
      this.dragging = false;
      this.activePointerId = null;
      this.dragMode = "orbit";
      if (wasPanning) {
        this.onPanStateChange(false);
      }
      this.canvas.releasePointerCapture?.(event.pointerId);
    };

    const wheel = (event) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 1.08 : 0.92;
      state.distance = Math.max(0.2, Math.min(200, state.distance * factor));
      this.onChange();
    };

    const touchStart = (event) => {
      this.ignorePointerEvents = true;
      this.dragging = false;
      this.activePointerId = null;

      if (event.touches.length === 1) {
        if (this.touchMode === "pinch") {
          this.onPanStateChange(false);
        }
        this.touchMode = "orbit";
        this.lastX = event.touches[0].clientX;
        this.lastY = event.touches[0].clientY;
      } else if (event.touches.length === 2) {
        this.touchMode = "pinch";
        this.pinchDistance = this.computeTouchDistance(event.touches);
        const touchCenter = this.computeTouchCenter(event.touches);
        this.touchCenterX = touchCenter.x;
        this.touchCenterY = touchCenter.y;
        this.onPanStateChange(true);
      }

      event.preventDefault();
    };

    const touchMove = (event) => {
      if (this.touchMode === "orbit" && event.touches.length === 1) {
        const touch = event.touches[0];
        const deltaX = touch.clientX - this.lastX;
        const deltaY = touch.clientY - this.lastY;
        this.lastX = touch.clientX;
        this.lastY = touch.clientY;
        state.yaw -= deltaX * 0.25;
        state.pitch = Math.max(-85, Math.min(85, state.pitch + deltaY * 0.2));
        this.onChange();
      } else if (this.touchMode === "pinch" && event.touches.length === 2) {
        const nextDistance = this.computeTouchDistance(event.touches);
        const nextCenter = this.computeTouchCenter(event.touches);
        const deltaX = nextCenter.x - this.touchCenterX;
        const deltaY = nextCenter.y - this.touchCenterY;

        if (Math.abs(deltaX) > 0.01 || Math.abs(deltaY) > 0.01) {
          this.panOrbitTarget(state, deltaX, deltaY);
        }

        if (this.pinchDistance > 0) {
          const ratio = this.pinchDistance / Math.max(nextDistance, 1);
          const dampedRatio = 1 + (ratio - 1) * 0.65;
          state.distance = Math.max(0.2, Math.min(200, state.distance * dampedRatio));
        }
        this.pinchDistance = nextDistance;
        this.touchCenterX = nextCenter.x;
        this.touchCenterY = nextCenter.y;
        this.onChange();
      }

      event.preventDefault();
    };

    const touchEnd = (event) => {
      if (event.touches.length === 0) {
        if (this.touchMode === "pinch") {
          this.onPanStateChange(false);
        }
        this.touchMode = null;
        this.pinchDistance = 0;
        this.touchCenterX = 0;
        this.touchCenterY = 0;
        this.ignorePointerEvents = false;
      } else if (event.touches.length === 1) {
        if (this.touchMode === "pinch") {
          this.onPanStateChange(false);
        }
        this.touchMode = "orbit";
        this.lastX = event.touches[0].clientX;
        this.lastY = event.touches[0].clientY;
        this.pinchDistance = 0;
        this.ignorePointerEvents = true;
      }
    };

    const contextMenu = (event) => {
      event.preventDefault();
    };

    this.canvas.addEventListener("pointerdown", pointerDown);
    this.canvas.addEventListener("pointermove", pointerMove);
    this.canvas.addEventListener("pointerup", pointerUp);
    this.canvas.addEventListener("pointercancel", pointerUp);
    this.canvas.addEventListener("wheel", wheel, { passive: false });
    this.canvas.addEventListener("touchstart", touchStart, { passive: false });
    this.canvas.addEventListener("touchmove", touchMove, { passive: false });
    this.canvas.addEventListener("touchend", touchEnd);
    this.canvas.addEventListener("touchcancel", touchEnd);
    this.canvas.addEventListener("contextmenu", contextMenu);

    this.disposeFns.push(() => this.canvas.removeEventListener("pointerdown", pointerDown));
    this.disposeFns.push(() => this.canvas.removeEventListener("pointermove", pointerMove));
    this.disposeFns.push(() => this.canvas.removeEventListener("pointerup", pointerUp));
    this.disposeFns.push(() => this.canvas.removeEventListener("pointercancel", pointerUp));
    this.disposeFns.push(() => this.canvas.removeEventListener("wheel", wheel));
    this.disposeFns.push(() => this.canvas.removeEventListener("touchstart", touchStart));
    this.disposeFns.push(() => this.canvas.removeEventListener("touchmove", touchMove));
    this.disposeFns.push(() => this.canvas.removeEventListener("touchend", touchEnd));
    this.disposeFns.push(() => this.canvas.removeEventListener("touchcancel", touchEnd));
    this.disposeFns.push(() => this.canvas.removeEventListener("contextmenu", contextMenu));
  }

  panOrbitTarget(state, deltaX, deltaY) {
    if (!state.target?.clone) {
      return;
    }

    const yaw = (state.yaw * Math.PI) / 180;
    const pitch = (state.pitch * Math.PI) / 180;
    const distance = Math.max(state.distance, 0.2);
    const canvasHeight = Math.max(this.canvas.clientHeight || 1, 1);
    const fovDegrees = Math.max(1, Number(this.getFieldOfView()) || 45);
    const panScale = (distance * fovDegrees * MODEL_VIEWER_PAN_SENSITIVITY) / canvasHeight;

    const cameraForward = {
      x: -Math.cos(pitch) * Math.sin(yaw),
      y: -Math.sin(pitch),
      z: -Math.cos(pitch) * Math.cos(yaw),
    };

    const right = {
      x: Math.cos(yaw),
      y: 0,
      z: -Math.sin(yaw),
    };

    const up = {
      x: right.y * cameraForward.z - right.z * cameraForward.y,
      y: right.z * cameraForward.x - right.x * cameraForward.z,
      z: right.x * cameraForward.y - right.y * cameraForward.x,
    };

    state.target.x += (-deltaX * right.x + deltaY * up.x) * panScale;
    state.target.y += (-deltaX * right.y + deltaY * up.y) * panScale;
    state.target.z += (-deltaX * right.z + deltaY * up.z) * panScale;
  }

  computeTouchDistance(touches) {
    const a = touches[0];
    const b = touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  computeTouchCenter(touches) {
    const a = touches[0];
    const b = touches[1];
    return {
      x: (a.clientX + b.clientX) * 0.5,
      y: (a.clientY + b.clientY) * 0.5,
    };
  }

  dispose() {
    for (const fn of this.disposeFns.splice(0)) {
      try {
        fn();
      } catch {}
    }
  }
}

class PlayCanvasSogViewer {
  constructor(container) {
    this.container = container;
    this.canvas = null;
    this.app = null;
    this.camera = null;
    this.splatEntity = null;
    this.pc = null;
    this.resizeObserver = null;
    this.orbitController = null;
    this.orbitState = null;
    this.goalOrbitState = null;
    this.defaultOrbitState = null;
    this.autoRotate = false;
    this.cutawayEnabled = true;
    this.activeManualBoxConfig = null;
    this.activeFpCollisionBoxConfig = null;
    this.currentCutawayBoxConfig = null;
    this.currentAsset = null;
    this.cutawayModifierInstalled = false;
    this.panIndicatorVisible = false;
    this.streamingState = null;
    this.frameReadyHandler = null;
    this.currentCutawayBoxConfig = null;
    this.fpCollision = null;
    this.fpNavigationController = null;
    this.fpNavigationMode = "walk";
    this.firstPersonActive = false;
    this.firstPersonTransitionPending = false;
    this.fpInteractionCommitted = false;
  }

  setPanIndicatorVisible(visible) {
    const nextVisible = !!visible;
    if (this.panIndicatorVisible === nextVisible) {
      return;
    }

    this.panIndicatorVisible = nextVisible;
    this.container?.dispatchEvent?.(
      new CustomEvent("sog-pan-visibilitychange", {
        detail: {
          visible: nextVisible,
        },
      })
    );
  }

  transformPointToWorld(pc, entity, point) {
    const worldPoint = point?.clone?.() || new pc.Vec3(0, 0, 0);
    entity.getWorldTransform().transformPoint(worldPoint, worldPoint);
    return worldPoint;
  }

  resolveOrbitStateFromCamera(pc, target, cameraPosition) {
    const offsetX = cameraPosition.x - target.x;
    const offsetY = cameraPosition.y - target.y;
    const offsetZ = cameraPosition.z - target.z;
    const distance = Math.max(Math.hypot(offsetX, offsetY, offsetZ), 0.001);
    const pitch = pc.math.RAD_TO_DEG * Math.asin(offsetY / distance);
    const yaw = pc.math.RAD_TO_DEG * Math.atan2(offsetX, offsetZ);

    return {
      target,
      distance,
      yaw,
      pitch,
    };
  }

  resolveOrbitState(pc, asset, entity, localBoundsCenter, boundsRadius) {
    const viewPreset = asset.viewPreset || {};
    const target = viewPreset.target
      ? this.transformPointToWorld(pc, entity, new pc.Vec3(...viewPreset.target))
      : this.transformPointToWorld(pc, entity, localBoundsCenter);

    if (viewPreset.cameraPosition) {
      const cameraPosition = this.transformPointToWorld(pc, entity, new pc.Vec3(...viewPreset.cameraPosition));
      return this.resolveOrbitStateFromCamera(pc, target, cameraPosition);
    }

    return {
      target,
      distance: Number.isFinite(viewPreset.distance)
        ? viewPreset.distance
        : Math.max(boundsRadius * (viewPreset.distanceMultiplier ?? 1.8), 1.5),
      yaw: viewPreset.yaw ?? 180,
      pitch: viewPreset.pitch ?? 15,
    };
  }

  cloneOrbitState(state) {
    if (!state) {
      return null;
    }

    return {
      target: state.target.clone(),
      distance: state.distance,
      yaw: state.yaw,
      pitch: state.pitch,
    };
  }

  getOrbitState() {
    if (this.firstPersonActive && this.fpNavigationController && this.pc) {
      return this.fpNavigationController.getOrbitState(this.pc);
    }

    return this.cloneOrbitState(this.orbitState || this.goalOrbitState);
  }

  setFirstPersonNavigationMode(mode = "walk") {
    this.fpNavigationMode = mode === "fly" ? "fly" : "walk";
    this.fpNavigationController?.setMode?.(this.fpNavigationMode);
    if (this.app) {
      this.app.renderNextFrame = true;
    }
  }

  isOrbitSettled() {
    if (!this.orbitState || !this.goalOrbitState) {
      return true;
    }

    const yawDelta = Math.abs(this.shortestAngleDeltaDegrees(this.orbitState.yaw, this.goalOrbitState.yaw));
    const pitchDelta = Math.abs(this.orbitState.pitch - this.goalOrbitState.pitch);
    const distanceDelta = Math.abs(this.orbitState.distance - this.goalOrbitState.distance);
    const targetDelta = Math.hypot(
      this.orbitState.target.x - this.goalOrbitState.target.x,
      this.orbitState.target.y - this.goalOrbitState.target.y,
      this.orbitState.target.z - this.goalOrbitState.target.z
    );

    return yawDelta <= 0.7 && pitchDelta <= 0.5 && distanceDelta <= 0.03 && targetDelta <= 0.03;
  }

  ensureFirstPersonNavigation(pc) {
    if (!this.canvas) {
      return null;
    }

    if (!this.fpNavigationController) {
      this.fpNavigationController = new FirstPersonNavigationController(this.canvas, this.fpCollision, {
        mode: this.fpNavigationMode,
        preservePresetSpawn: !!this.currentAsset?.fpViewPreset?.cameraPosition,
        walk: {
          fov: this.camera?.camera?.fov ?? 90,
        },
        fly: {
          fov: this.camera?.camera?.fov ?? 90,
        },
      });
    } else {
      this.fpNavigationController.setCollision(this.fpCollision);
      this.fpNavigationController.setPreservePresetSpawn(!!this.currentAsset?.fpViewPreset?.cameraPosition);
      this.fpNavigationController.setMode(this.fpNavigationMode);
    }

    return this.fpNavigationController;
  }

  startFirstPersonNavigation(pc) {
    if (!this.currentAsset?.streamingEnabled || !this.camera) {
      return;
    }

    const controller = this.ensureFirstPersonNavigation(pc);
    if (!controller) {
      return;
    }

    controller.enterFromOrbitState(this.orbitState || this.goalOrbitState, this.camera.camera?.fov ?? 90);
    this.firstPersonActive = true;
    this.firstPersonTransitionPending = false;
    this.fpInteractionCommitted = false;
    this.setPanIndicatorVisible(false);
    if (this.app) {
      this.app.renderNextFrame = true;
    }
  }

  stopFirstPersonNavigation() {
    this.firstPersonActive = false;
    this.firstPersonTransitionPending = false;
    this.fpInteractionCommitted = false;
    if (this.fpNavigationController) {
      this.fpNavigationController.dispose();
      this.fpNavigationController = null;
    }
  }

  async prepareFirstPersonAsset(asset, onState) {
    if (
      !asset?.streamingEnabled ||
      !asset?.fpCollisionSource ||
      asset?.fpCollisionStrategy === "box" ||
      !this.app ||
      !this.pc
    ) {
      this.fpCollision = null;
      return asset;
    }

    onState?.({
      status: "loading",
      title: "Preparing FP",
      message: "Loading collision mesh and validating an inside spawn point.",
    });

    try {
      const collision = await loadMeshCollisionFromGlb(this.app, this.pc, asset.fpCollisionSource, {
        position: asset.position,
        rotation: asset.rotation,
        scale: asset.scale,
      });
      this.fpCollision = collision;
      if (!collision) {
        return asset;
      }

      if (asset.fpViewPreset?.cameraPosition) {
        return asset;
      }

      return {
        ...asset,
        viewPreset: buildCollisionAdjustedViewPreset(
          collision,
          asset.viewPreset || {},
          asset.manualBox?.position || [0, 0, 0]
        ),
      };
    } catch (error) {
      console.warn("FP collision preparation failed:", error);
      this.fpCollision = null;
      return asset;
    }
  }

  cloneManualBoxConfig(config) {
    if (!config) {
      return null;
    }

    return {
      position: [...(config.position || [0, 0, 0])],
      rotationDegrees: [...(config.rotationDegrees || [0, 0, 0])],
      scale: [...(config.scale || [1, 1, 1])],
      cutRatio: Number.isFinite(config.cutRatio) ? config.cutRatio : 0.2,
      cutFadeWidth: Number.isFinite(config.cutFadeWidth) ? config.cutFadeWidth : undefined,
      cutDepthByFace: config.cutDepthByFace ? { ...config.cutDepthByFace } : undefined,
    };
  }

  normalizeAngleDegrees(angle) {
    return ((angle % 360) + 360) % 360;
  }

  shortestAngleDeltaDegrees(fromAngle, toAngle) {
    let delta = this.normalizeAngleDegrees(toAngle) - this.normalizeAngleDegrees(fromAngle);
    if (delta > 180) {
      delta -= 360;
    }
    if (delta < -180) {
      delta += 360;
    }
    return delta;
  }

  dampScalar(current, goal, deltaMs, epsilon = 0.0001) {
    if (!Number.isFinite(current) || !Number.isFinite(goal)) {
      return goal;
    }

    if (Math.abs(goal - current) <= epsilon) {
      return goal;
    }

    const alpha = 1 - Math.exp(-deltaMs / ORBIT_DAMPING_DECAY_MS);
    return current + (goal - current) * alpha;
  }

  dampAngleDegrees(current, goal, deltaMs, epsilon = 0.01) {
    const delta = this.shortestAngleDeltaDegrees(current, goal);
    if (Math.abs(delta) <= epsilon) {
      return goal;
    }

    const alpha = 1 - Math.exp(-deltaMs / ORBIT_DAMPING_DECAY_MS);
    return current + delta * alpha;
  }

  animateOrbit(pc, deltaSeconds) {
    if (!this.app || !this.orbitState || !this.goalOrbitState) {
      return;
    }

    const deltaMs = Math.max(deltaSeconds * 1000, 0);
    if (!deltaMs) {
      return;
    }

    if (this.autoRotate) {
      this.goalOrbitState.yaw += AUTO_ROTATE_DEGREES_PER_SECOND * deltaSeconds;
    }

    const nextYaw = this.dampAngleDegrees(this.orbitState.yaw, this.goalOrbitState.yaw, deltaMs);
    const nextPitch = this.dampScalar(this.orbitState.pitch, this.goalOrbitState.pitch, deltaMs, 0.01);
    const nextDistance = this.dampScalar(this.orbitState.distance, this.goalOrbitState.distance, deltaMs, 0.001);
    const nextTargetX = this.dampScalar(this.orbitState.target.x, this.goalOrbitState.target.x, deltaMs, 0.0001);
    const nextTargetY = this.dampScalar(this.orbitState.target.y, this.goalOrbitState.target.y, deltaMs, 0.0001);
    const nextTargetZ = this.dampScalar(this.orbitState.target.z, this.goalOrbitState.target.z, deltaMs, 0.0001);

    const changed =
      Math.abs(this.shortestAngleDeltaDegrees(this.orbitState.yaw, nextYaw)) > 0.0001 ||
      Math.abs(this.orbitState.pitch - nextPitch) > 0.0001 ||
      Math.abs(this.orbitState.distance - nextDistance) > 0.0001 ||
      Math.abs(this.orbitState.target.x - nextTargetX) > 0.0001 ||
      Math.abs(this.orbitState.target.y - nextTargetY) > 0.0001 ||
      Math.abs(this.orbitState.target.z - nextTargetZ) > 0.0001;

    if (!changed) {
      return;
    }

    this.orbitState.yaw = nextYaw;
    this.orbitState.pitch = nextPitch;
    this.orbitState.distance = nextDistance;
    this.orbitState.target.set(nextTargetX, nextTargetY, nextTargetZ);
    this.updateCameraOrbit(pc);
  }

  createStandardEulerQuaternion(pc, rotationDegrees = [0, 0, 0]) {
    const [xDegrees = 0, yDegrees = 0, zDegrees = 0] = rotationDegrees;
    const halfToRadians = Math.PI / 360;
    const x = xDegrees * halfToRadians;
    const y = yDegrees * halfToRadians;
    const z = zDegrees * halfToRadians;

    const sx = Math.sin(x);
    const cx = Math.cos(x);
    const sy = Math.sin(y);
    const cy = Math.cos(y);
    const sz = Math.sin(z);
    const cz = Math.cos(z);

    return new pc.Quat(
      sx * cy * cz + cx * sy * sz,
      cx * sy * cz - sx * cy * sz,
      cx * cy * sz + sx * sy * cz,
      cx * cy * cz - sx * sy * sz
    );
  }

  createBoxLocalMatrix(pc, boxConfig) {
    const position = boxConfig?.position || [0, 0, 0];
    const scale = boxConfig?.scale || [1, 1, 1];
    const rotation = this.createStandardEulerQuaternion(pc, boxConfig?.rotationDegrees || [0, 0, 0]);

    return new pc.Mat4().setTRS(
      new pc.Vec3(position[0] || 0, position[1] || 0, position[2] || 0),
      rotation,
      new pc.Vec3(
        Math.max(scale[0] || 0, 0.001),
        Math.max(scale[1] || 0, 0.001),
        Math.max(scale[2] || 0, 0.001)
      )
    );
  }

  createBoxWorldMatrix(pc, boxConfig) {
    const localBoxMatrix = this.createBoxLocalMatrix(pc, boxConfig);
    return new pc.Mat4().mul2(this.splatEntity.getWorldTransform(), localBoxMatrix);
  }

  createFallbackBoxCollision(pc, entity, boxConfig) {
    if (!pc || !entity || !boxConfig?.scale) {
      return null;
    }

    const worldMatrix = new pc.Mat4().mul2(entity.getWorldTransform(), this.createBoxLocalMatrix(pc, boxConfig));
    const unitCorners = [
      [-0.5, -0.5, -0.5],
      [0.5, -0.5, -0.5],
      [-0.5, 0.5, -0.5],
      [0.5, 0.5, -0.5],
      [-0.5, -0.5, 0.5],
      [0.5, -0.5, 0.5],
      [-0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5],
    ];

    const bounds = {
      minX: Infinity,
      minY: Infinity,
      minZ: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
      maxZ: -Infinity,
    };

    for (const [x, y, z] of unitCorners) {
      const point = new pc.Vec3();
      worldMatrix.transformPoint(new pc.Vec3(x, y, z), point);
      if (point.x < bounds.minX) bounds.minX = point.x;
      if (point.y < bounds.minY) bounds.minY = point.y;
      if (point.z < bounds.minZ) bounds.minZ = point.z;
      if (point.x > bounds.maxX) bounds.maxX = point.x;
      if (point.y > bounds.maxY) bounds.maxY = point.y;
      if (point.z > bounds.maxZ) bounds.maxZ = point.z;
    }

    const padding = 0.02;
    bounds.minX += padding;
    bounds.minY += padding;
    bounds.minZ += padding;
    bounds.maxX -= padding;
    bounds.maxY -= padding;
    bounds.maxZ -= padding;

    const clampPointForRadius = (x, y, z, radius) => ({
      x: Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, x)),
      y: Math.max(bounds.minY + radius, Math.min(bounds.maxY - radius, y)),
      z: Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, z)),
    });

    const intersectSegmentWithAabb = (start, end) => {
      const direction = {
        x: end.x - start.x,
        y: end.y - start.y,
        z: end.z - start.z,
      };

      let tMin = 0;
      let tMax = 1;
      let nearNormal = { x: 0, y: 1, z: 0 };
      let farNormal = { x: 0, y: -1, z: 0 };

      const axes = [
        ["x", "minX", "maxX"],
        ["y", "minY", "maxY"],
        ["z", "minZ", "maxZ"],
      ];

      for (const [axis, minKey, maxKey] of axes) {
        const origin = start[axis];
        const delta = direction[axis];
        const min = bounds[minKey];
        const max = bounds[maxKey];

        if (Math.abs(delta) < 1e-8) {
          if (origin < min || origin > max) {
            return null;
          }
          continue;
        }

        let t1 = (min - origin) / delta;
        let t2 = (max - origin) / delta;
        let normal1;
        let normal2;

        if (axis === "x") {
          normal1 = { x: -1, y: 0, z: 0 };
          normal2 = { x: 1, y: 0, z: 0 };
        } else if (axis === "y") {
          normal1 = { x: 0, y: -1, z: 0 };
          normal2 = { x: 0, y: 1, z: 0 };
        } else {
          normal1 = { x: 0, y: 0, z: -1 };
          normal2 = { x: 0, y: 0, z: 1 };
        }

        if (t1 > t2) {
          [t1, t2] = [t2, t1];
          [normal1, normal2] = [normal2, normal1];
        }

        if (t1 > tMin) {
          tMin = t1;
          nearNormal = normal1;
        }
        if (t2 < tMax) {
          tMax = t2;
          farNormal = normal2;
        }

        if (tMin > tMax) {
          return null;
        }
      }

      return { nearT: tMin, farT: tMax, nearNormal, farNormal };
    };

    const makeHit = (point, normal, originX, originY, originZ) => {
      const worldNormal = new pc.Vec3(normal.x, normal.y, normal.z).normalize();
      return {
        distance: Math.hypot(point.x - originX, point.y - originY, point.z - originZ),
        x: point.x,
        y: point.y,
        z: point.z,
        nx: worldNormal.x,
        ny: worldNormal.y,
        nz: worldNormal.z,
      };
    };

    const collision = {
      voxelResolution: 0.12,
      querySphere: (x, y, z, radius, out = { x: 0, y: 0, z: 0 }) => {
        const clamped = clampPointForRadius(x, y, z, radius);
        const push = {
          x: clamped.x - x,
          y: clamped.y - y,
          z: clamped.z - z,
        };

        if (Math.hypot(push.x, push.y, push.z) <= 1e-8) {
          out.x = 0;
          out.y = 0;
          out.z = 0;
          return false;
        }

        out.x = push.x;
        out.y = push.y;
        out.z = push.z;
        return true;
      },
      isFreeAt: (x, y, z) => {
        return (
          x >= bounds.minX &&
          x <= bounds.maxX &&
          y >= bounds.minY &&
          y <= bounds.maxY &&
          z >= bounds.minZ &&
          z <= bounds.maxZ
        );
      },
      queryRay: (ox, oy, oz, dx, dy, dz, maxDist = Infinity) => {
        const safeMaxDist = Number.isFinite(maxDist) ? maxDist : 1000;
        const worldStart = { x: ox, y: oy, z: oz };
        const worldEnd = {
          x: ox + dx * safeMaxDist,
          y: oy + dy * safeMaxDist,
          z: oz + dz * safeMaxDist,
        };
        const result = intersectSegmentWithAabb(worldStart, worldEnd);
        if (!result) {
          return null;
        }

        const nearPoint = {
          x: worldStart.x + (worldEnd.x - worldStart.x) * result.nearT,
          y: worldStart.y + (worldEnd.y - worldStart.y) * result.nearT,
          z: worldStart.z + (worldEnd.z - worldStart.z) * result.nearT,
        };
        const farPoint = {
          x: worldStart.x + (worldEnd.x - worldStart.x) * result.farT,
          y: worldStart.y + (worldEnd.y - worldStart.y) * result.farT,
          z: worldStart.z + (worldEnd.z - worldStart.z) * result.farT,
        };

        const nearHit = makeHit(nearPoint, result.nearNormal, ox, oy, oz);
        const farHit = makeHit(farPoint, result.farNormal, ox, oy, oz);

        if (dy < -0.0001) {
          return farHit.y < nearHit.y ? farHit : nearHit;
        }
        if (dy > 0.0001) {
          return farHit.y > nearHit.y ? farHit : nearHit;
        }

        return nearHit.distance <= farHit.distance ? nearHit : farHit;
      },
      querySurfaceNormal: (x, y, z) => {
        const distances = [
          { axis: "x", sign: -1, value: Math.abs(x - bounds.minX) },
          { axis: "x", sign: 1, value: Math.abs(x - bounds.maxX) },
          { axis: "y", sign: -1, value: Math.abs(y - bounds.minY) },
          { axis: "y", sign: 1, value: Math.abs(y - bounds.maxY) },
          { axis: "z", sign: -1, value: Math.abs(z - bounds.minZ) },
          { axis: "z", sign: 1, value: Math.abs(z - bounds.maxZ) },
        ].sort((left, right) => left.value - right.value);

        const closest = distances[0];
        const normal =
          closest.axis === "x"
            ? { x: closest.sign, y: 0, z: 0 }
            : closest.axis === "y"
              ? { x: 0, y: closest.sign, z: 0 }
              : { x: 0, y: 0, z: closest.sign };
        return { x: normal.x, y: normal.y, z: normal.z, nx: normal.x, ny: normal.y, nz: normal.z };
      },
      findSphereSpawnNear: (origin, options = {}) => {
        const radius = options.radius ?? 0.18;
        const clamped = clampPointForRadius(origin[0], origin[1], origin[2], radius);
        return { x: clamped.x, y: clamped.y, z: clamped.z };
      },
      findCameraSpawnNear: (origin, options = {}) => {
        const headClearance = options.headClearance ?? 1.65;
        const clamped = {
          x: Math.max(bounds.minX + 0.12, Math.min(bounds.maxX - 0.12, origin[0])),
          y: origin[1],
          z: Math.max(bounds.minZ + 0.12, Math.min(bounds.maxZ - 0.12, origin[2])),
        };

        const floorY = bounds.minY;
        const ceilingY = bounds.maxY;
        const cameraY = Math.min(
          ceilingY - 0.12,
          Math.max(
            floorY + Math.max(headClearance * 0.82, 1.25),
            origin[1] ?? floorY + 1.5
          )
        );

        return {
          x: clamped.x,
          y: cameraY,
          z: clamped.z,
          floorY,
        };
      },
    };

    return collision;
  }

  createDefaultManualBoxConfig(localBoundsCenter, localHalfExtents) {
    return {
      position: [localBoundsCenter.x, localBoundsCenter.y, localBoundsCenter.z],
      rotationDegrees: [0, 0, 0],
      scale: [
        Math.max(localHalfExtents.x * 2, 0.001),
        Math.max(localHalfExtents.y * 2, 0.001),
        Math.max(localHalfExtents.z * 2, 0.001),
      ],
      cutRatio: 0.2,
      cutDepthByFace: {
        left: 0.2,
        right: 0.2,
        front: 0.2,
        back: 0.2,
        top: 0.2,
        bottom: 0.2,
      },
    };
  }

  ensureCutawayModifier(gsplat) {
    if (!gsplat?.setWorkBufferModifier || !gsplat?.setParameter) {
      return false;
    }

    if (!this.cutawayModifierInstalled) {
      gsplat.setWorkBufferModifier(SOG_BOX_CULLING_MODIFIER);
      this.cutawayModifierInstalled = true;
    }

    return true;
  }

  setCutawayParameters(pc, gsplat, boxConfig, enabled) {
    if (!gsplat?.setParameter) {
      return;
    }

    const worldCameraPosition = this.camera?.getPosition?.();
    if (worldCameraPosition) {
      gsplat.setParameter("cameraWorldPosition", [
        worldCameraPosition.x,
        worldCameraPosition.y,
        worldCameraPosition.z,
      ]);
    }
    gsplat.setParameter("backfaceCullingEnabled", 0);
    gsplat.setParameter("backfaceThreshold", 0);
    gsplat.setParameter("backfaceFadeWidth", 1);

    if (!enabled || !boxConfig) {
      gsplat.setParameter("orientedClipBoxEnabled", 0);
      gsplat.setParameter("orientedClipBoxFadeWidth", AUTO_CUTAWAY_FADE_WIDTH);
      return;
    }

    const worldToUnitBox = this.createBoxWorldMatrix(pc, boxConfig).invert();
    gsplat.setParameter("orientedClipBoxWorldToUnit", worldToUnitBox.data);
    gsplat.setParameter("orientedClipBoxEnabled", 1);
    gsplat.setParameter("orientedClipBoxFadeWidth", boxConfig.cutFadeWidth ?? AUTO_CUTAWAY_FADE_WIDTH);
  }

  getCameraPositionInBoxSpace(pc, boxConfig = this.activeManualBoxConfig) {
    if (!boxConfig) {
      return null;
    }

    const worldBoxMatrix = this.createBoxWorldMatrix(pc, boxConfig);
    const inverseWorldBoxMatrix = worldBoxMatrix.clone().invert();
    const worldCameraPosition = this.camera?.getPosition?.();

    if (!worldCameraPosition) {
      return null;
    }

    return inverseWorldBoxMatrix.transformPoint(worldCameraPosition.clone(), new pc.Vec3());
  }

  getEffectiveCutawayBoxConfig(pc, boxConfig = this.activeManualBoxConfig) {
    if (!boxConfig) {
      return null;
    }

    if (!this.cutawayEnabled) {
      return boxConfig;
    }

    const cameraPositionInBoxSpace = this.getCameraPositionInBoxSpace(pc, boxConfig);
    if (!cameraPositionInBoxSpace) {
      return boxConfig;
    }

    const computed = computeAutoCutaway(
      boxConfig,
      cameraPositionInBoxSpace,
      boxConfig.cutRatio ?? 0.2
    ).boxConfig;

    return {
      ...computed,
      cutFadeWidth: boxConfig.cutFadeWidth,
    };
  }

  smoothCutawayBoxConfig(currentConfig, targetConfig, deltaMs) {
    if (!currentConfig) {
      return this.cloneManualBoxConfig(targetConfig);
    }

    if (!targetConfig) {
      return null;
    }

    return {
      position: [
        this.dampScalar(currentConfig.position?.[0] ?? 0, targetConfig.position?.[0] ?? 0, deltaMs, 0.0001),
        this.dampScalar(currentConfig.position?.[1] ?? 0, targetConfig.position?.[1] ?? 0, deltaMs, 0.0001),
        this.dampScalar(currentConfig.position?.[2] ?? 0, targetConfig.position?.[2] ?? 0, deltaMs, 0.0001),
      ],
      rotationDegrees: [...(targetConfig.rotationDegrees || currentConfig.rotationDegrees || [0, 0, 0])],
      scale: [
        this.dampScalar(currentConfig.scale?.[0] ?? 1, targetConfig.scale?.[0] ?? 1, deltaMs, 0.0001),
        this.dampScalar(currentConfig.scale?.[1] ?? 1, targetConfig.scale?.[1] ?? 1, deltaMs, 0.0001),
        this.dampScalar(currentConfig.scale?.[2] ?? 1, targetConfig.scale?.[2] ?? 1, deltaMs, 0.0001),
      ],
      cutRatio: targetConfig.cutRatio ?? currentConfig.cutRatio ?? 0.2,
      cutFadeWidth: targetConfig.cutFadeWidth ?? currentConfig.cutFadeWidth,
      cutDepthByFace: targetConfig.cutDepthByFace ? { ...targetConfig.cutDepthByFace } : currentConfig.cutDepthByFace,
    };
  }

  isSameCutawayBoxConfig(left, right, epsilon = 0.0005) {
    if (!left || !right) {
      return left === right;
    }

    for (let index = 0; index < 3; index += 1) {
      if (Math.abs((left.position?.[index] ?? 0) - (right.position?.[index] ?? 0)) > epsilon) {
        return false;
      }
      if (Math.abs((left.scale?.[index] ?? 1) - (right.scale?.[index] ?? 1)) > epsilon) {
        return false;
      }
      if (Math.abs((left.rotationDegrees?.[index] ?? 0) - (right.rotationDegrees?.[index] ?? 0)) > epsilon) {
        return false;
      }
    }

    return true;
  }

  syncCutawayState(pc, options = {}) {
    const gsplat = this.splatEntity?.gsplat;
    if (!this.ensureCutawayModifier(gsplat)) {
      return;
    }

    const immediate = !!options.immediate;
    const deltaMs = Math.max((options.deltaSeconds || 0) * 1000, 0);

    if (!this.cutawayEnabled || !this.activeManualBoxConfig) {
      this.currentCutawayBoxConfig = null;
      this.setCutawayParameters(pc, gsplat, null, false);
      if (this.app) {
        this.app.renderNextFrame = true;
      }
      return;
    }

    const targetBoxConfig = this.getEffectiveCutawayBoxConfig(pc, this.activeManualBoxConfig);
    const nextBoxConfig = immediate || !this.currentCutawayBoxConfig
      ? this.cloneManualBoxConfig(targetBoxConfig)
      : this.smoothCutawayBoxConfig(
          this.currentCutawayBoxConfig,
          targetBoxConfig,
          deltaMs || CUTAWAY_DAMPING_DECAY_MS
        );

    const shouldContinueSmoothing = !this.isSameCutawayBoxConfig(nextBoxConfig, targetBoxConfig);
    this.currentCutawayBoxConfig = nextBoxConfig;
    this.setCutawayParameters(pc, gsplat, nextBoxConfig, true);
    if (this.app && (shouldContinueSmoothing || immediate)) {
      this.app.renderNextFrame = true;
    }
  }

  updateCameraOrbit(pc) {
    if (!this.camera || !this.orbitState) {
      return;
    }

    const yaw = pc.math.DEG_TO_RAD * this.orbitState.yaw;
    const pitch = pc.math.DEG_TO_RAD * this.orbitState.pitch;
    const distance = this.orbitState.distance;
    const target = this.orbitState.target;

    const x = target.x + distance * Math.cos(pitch) * Math.sin(yaw);
    const y = target.y + distance * Math.sin(pitch);
    const z = target.z + distance * Math.cos(pitch) * Math.cos(yaw);
    this.camera.setPosition(x, y, z);
    this.camera.lookAt(target);
    if (this.app) {
      this.app.renderNextFrame = true;
    }
  }

  startAutoRotate(pc = this.pc) {
    if (!pc || !this.app || !this.goalOrbitState) {
      return;
    }

    this.autoRotate = true;
    this.app.renderNextFrame = true;
  }

  stopAutoRotate() {
    this.autoRotate = false;
  }

  setAutoRotate(enabled) {
    if (enabled) {
      this.startAutoRotate(this.pc);
      return;
    }

    this.stopAutoRotate();
  }

  isStreamingAsset(asset = this.currentAsset) {
    return !!asset?.streamingEnabled || /\.lod-meta\.json(?:$|\?)/i.test(asset?.src || "");
  }

  clearStreamingHandlers() {
    if (this.frameReadyHandler && this.app?.systems?.gsplat?.off) {
      this.app.systems.gsplat.off("frame:ready", this.frameReadyHandler);
    }

    this.frameReadyHandler = null;
  }

  getStreamingState() {
    return this.streamingState ? { ...this.streamingState } : null;
  }

  setStreamingSplatBudget(splatBudget) {
    if (!this.app?.scene?.gsplat || !Number.isFinite(splatBudget)) {
      return;
    }

    this.app.scene.gsplat.splatBudget = Math.max(0, Math.round(splatBudget));
    if (this.streamingState) {
      this.streamingState.splatBudget = Math.max(0, Math.round(splatBudget));
    }
    this.app.renderNextFrame = true;
  }

  setStreamingLodRange(lodRangeMin, lodRangeMax) {
    if (!this.app?.scene?.gsplat || !this.streamingState) {
      return;
    }

    const maxIndex = Math.max(0, (this.streamingState.lodLevels || 1) - 1);
    const nextMin = Math.max(0, Math.min(Math.round(lodRangeMin), maxIndex));
    const nextMax = Math.max(nextMin, Math.min(Math.round(lodRangeMax), maxIndex));

    this.app.scene.gsplat.lodRangeMin = nextMin;
    this.app.scene.gsplat.lodRangeMax = nextMax;
    this.streamingState.lodRangeMin = nextMin;
    this.streamingState.lodRangeMax = nextMax;
    this.app.renderNextFrame = true;
  }

  setStreamingDistances(lodBaseDistance, lodMultiplier) {
    if (!this.splatEntity?.gsplat || !this.streamingState) {
      return;
    }

    if (Number.isFinite(lodBaseDistance)) {
      this.splatEntity.gsplat.lodBaseDistance = Math.max(0.1, lodBaseDistance);
      this.streamingState.lodBaseDistance = Math.max(0.1, lodBaseDistance);
    }

    if (Number.isFinite(lodMultiplier)) {
      this.splatEntity.gsplat.lodMultiplier = Math.max(1.2, lodMultiplier);
      this.streamingState.lodMultiplier = Math.max(1.2, lodMultiplier);
    }

    if (this.app) {
      this.app.renderNextFrame = true;
    }
  }

  applyStreamingQuality(settings = {}) {
    if (!this.streamingState) {
      return;
    }

    if (Number.isFinite(settings.splatBudget)) {
      this.setStreamingSplatBudget(settings.splatBudget);
    }

    if (Number.isFinite(settings.lodBaseDistance) || Number.isFinite(settings.lodMultiplier)) {
      this.setStreamingDistances(settings.lodBaseDistance, settings.lodMultiplier);
    }

    if (Number.isFinite(settings.lodRangeMin) || Number.isFinite(settings.lodRangeMax)) {
      const nextMin = Number.isFinite(settings.lodRangeMin) ? settings.lodRangeMin : this.streamingState.lodRangeMin;
      const nextMax = Number.isFinite(settings.lodRangeMax) ? settings.lodRangeMax : this.streamingState.lodRangeMax;
      this.setStreamingLodRange(nextMin, nextMax);
    }
  }

  configureStreaming(asset) {
    this.clearStreamingHandlers();
    this.streamingState = null;

    if (!this.isStreamingAsset(asset) || !this.app?.scene?.gsplat || !this.splatEntity?.gsplat) {
      return;
    }

    const lodLevels = Math.max(1, Number(this.splatEntity.gsplat.resource?.octree?.lodLevels) || 1);
    const settings = asset.streamingSettings || {};
    const targetRangeMin = Math.max(0, Math.min(Math.round(settings.lodRangeMin ?? 0), lodLevels - 1));
    const targetRangeMax = Math.max(
      targetRangeMin,
      Math.min(Math.round(settings.lodRangeMax ?? (lodLevels - 1)), lodLevels - 1)
    );

    this.streamingState = {
      enabled: true,
      lodLevels,
      splatBudget: Math.max(0, Math.round(settings.splatBudget ?? 0)),
      minSplatBudget: Math.max(0, Math.round(settings.minSplatBudget ?? 0)),
      maxSplatBudget: Math.max(0, Math.round(settings.maxSplatBudget ?? 0)),
      lodBaseDistance: Math.max(0.1, settings.lodBaseDistance ?? 5),
      minLodBaseDistance: Math.max(0.1, settings.minLodBaseDistance ?? 2.5),
      maxLodBaseDistance: Math.max(0.1, settings.maxLodBaseDistance ?? 18),
      lodMultiplier: Math.max(1.2, settings.lodMultiplier ?? 2),
      minLodMultiplier: Math.max(1.2, settings.minLodMultiplier ?? 1.6),
      maxLodMultiplier: Math.max(1.2, settings.maxLodMultiplier ?? 3.4),
      lodRangeMin: targetRangeMin,
      lodRangeMax: targetRangeMax,
      targetLodRangeMin: targetRangeMin,
      targetLodRangeMax: targetRangeMax,
    };

    this.app.scene.gsplat.splatBudget = this.streamingState.splatBudget;
    this.app.scene.gsplat.lodUnderfillLimit = Math.max(0, Math.round(settings.lodUnderfillLimit ?? 1));
    this.splatEntity.gsplat.lodBaseDistance = this.streamingState.lodBaseDistance;
    this.splatEntity.gsplat.lodMultiplier = this.streamingState.lodMultiplier;

    const coarseFirst = settings.coarseFirst !== false && lodLevels > 1;
    if (coarseFirst) {
      const worstLod = lodLevels - 1;
      this.setStreamingLodRange(worstLod, worstLod);

      this.frameReadyHandler = (_camera, _layer, ready, loadingCount) => {
        if (!ready || loadingCount !== 0 || !this.streamingState) {
          return;
        }

        this.clearStreamingHandlers();
        this.setStreamingLodRange(
          this.streamingState.targetLodRangeMin,
          this.streamingState.targetLodRangeMax
        );
      };

      this.app.systems?.gsplat?.on?.("frame:ready", this.frameReadyHandler);
      return;
    }

    this.setStreamingLodRange(targetRangeMin, targetRangeMax);
  }

  async load(asset, profile = { maxDpr: 1.05 }, onState) {
    if (this.app && this.pc && this.splatEntity && this.currentAsset?.key === asset.key) {
      this.stopFirstPersonNavigation();
      const splatAsset = new this.pc.Asset(asset.label || "Scene", "gsplat", {
        url: asset.src,
      });

      await new Promise((resolve, reject) => {
        splatAsset.on("progress", (received, total) => {
          if (!total) {
            return;
          }

          onState?.({
            status: "loading",
            title: "Loading SOG",
            message: `${asset.label || "SOG scene"} loading (${Math.round((received / total) * 100)}%)`,
          });
        });
        splatAsset.on("load", resolve);
        splatAsset.on("error", (error) => {
          const detail =
            typeof error === "string"
              ? error
              : error?.message || error?.status || error?.statusText || "Unknown PlayCanvas asset loader error";
          reject(new Error(`Failed to load SOG asset: ${asset.src} (${detail})`));
        });
        this.app.assets.add(splatAsset);
        this.app.assets.load(splatAsset);
      });

      if (!this.app || !this.splatEntity) {
        return;
      }

      const oldEntity = this.splatEntity;
      const splatEntity = new this.pc.Entity(asset.label || "SOG");
      splatEntity.setLocalPosition(...(asset.position || [0, 0, 0]));
      const rotation = asset.rotation || [0, 0, 0, 1];
      splatEntity.setLocalRotation(rotation[0], rotation[1], rotation[2], rotation[3]);
      splatEntity.setLocalScale(...(asset.scale || [1, 1, 1]));
      splatEntity.addComponent("gsplat", {
        asset: splatAsset,
        unified: true,
      });
      this.app.root.addChild(splatEntity);
      this.splatEntity = splatEntity;

      const oldAsset = oldEntity.gsplat?.asset;
      oldEntity.enabled = false;

      setTimeout(() => {
        if (!this.app) return;
        try {
          oldEntity.destroy();
          if (oldAsset) {
            this.app.assets.remove(oldAsset);
            oldAsset.unload();
          }
        } catch (e) {
          console.warn("Cleanup warning:", e);
        }
      }, 200);

      this.currentAsset = asset;
      this.cutawayModifierInstalled = false;
      this.autoRotate = !!asset.autoRotate;
      this.cutawayEnabled = asset.cutawayEnabled !== false;
      this.activeManualBoxConfig = this.cloneManualBoxConfig(asset.manualBox) || this.activeManualBoxConfig;
      this.activeFpCollisionBoxConfig = this.cloneManualBoxConfig(asset.fpCollisionBox || asset.manualBox) || this.activeFpCollisionBoxConfig;
      this.currentCutawayBoxConfig = null;
      this.fpCollision = asset.streamingEnabled
        ? (this.fpCollision || this.createFallbackBoxCollision(this.pc, splatEntity, this.activeFpCollisionBoxConfig || this.activeManualBoxConfig))
        : null;
      this.syncCutawayState(this.pc, { immediate: true });
      this.configureStreaming(asset);
      if (asset.streamingEnabled) {
        this.firstPersonTransitionPending = false;
        this.startFirstPersonNavigation(this.pc);
      }
      
      this.app.renderNextFrame = true;
      return;
    }

    this.dispose();

    if (!supportsPlayCanvasSogViewer()) {
      throw new Error("This browser or device cannot run the PlayCanvas SOG viewer.");
    }

    this.container.innerHTML = "";
    onState?.({
      status: "loading",
      title: "Loading SOG",
      message: `Fetching ${asset.src}`,
    });

    const pc = await import(PLAYCANVAS_CDN);
    const canvas = document.createElement("canvas");
    canvas.className = "viewer-canvas playcanvas-sog-canvas";
    this.container.appendChild(canvas);
    this.canvas = canvas;

    const app = new pc.Application(canvas, {
      graphicsDeviceOptions: {
        antialias: false,
        alpha: true,
        powerPreference: "high-performance",
      },
    });
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.start();
    app.scene.ambientLight = new pc.Color(0.55, 0.57, 0.62);
    app.graphicsDevice.maxPixelRatio = Math.max(
      0.5,
      Math.min(window.devicePixelRatio || 1, profile.maxDpr || 1.05)
    );
    canvas.tabIndex = 0;
    app.on("update", (deltaSeconds) => {
      if (this.firstPersonActive && this.fpNavigationController && this.camera) {
        this.fpNavigationController.update(deltaSeconds, this.camera, {
          autoRotate: this.autoRotate,
        });
        if (!this.fpInteractionCommitted && this.fpNavigationController.hasUserInteracted()) {
          this.fpInteractionCommitted = true;
          this.autoRotate = false;
          this.container?.dispatchEvent?.(
            new CustomEvent("fp-user-interaction", {
              detail: { active: true },
            })
          );
        }
        app.renderNextFrame = true;
      } else {
        this.animateOrbit(pc, deltaSeconds);
        if (this.currentAsset?.streamingEnabled && this.firstPersonTransitionPending && this.isOrbitSettled()) {
          this.startFirstPersonNavigation(pc);
        }
      }
      this.syncCutawayState(pc, { deltaSeconds });
    });

    this.app = app;
    this.pc = pc;
    const preparedAsset = await this.prepareFirstPersonAsset(asset, onState);

    const camera = new pc.Entity("Camera");
    camera.addComponent("camera", {
      clearColor: new pc.Color(0.03, 0.05, 0.07, 0),
      farClip: 5000,
      nearClip: 0.01,
      fov: preparedAsset.viewPreset?.fov ?? asset.viewPreset?.fov ?? 60,
    });
    app.root.addChild(camera);

    const light = new pc.Entity("Light");
    light.addComponent("light", {
      type: "directional",
      color: new pc.Color(1, 1, 1),
      intensity: 1.2,
    });
    light.setEulerAngles(35, 35, 0);
    app.root.addChild(light);

    this.camera = camera;
    this.currentAsset = preparedAsset;
    this.autoRotate = !!preparedAsset.autoRotate;
    this.cutawayEnabled = preparedAsset.cutawayEnabled !== false;
    this.cutawayModifierInstalled = false;
    this.activeManualBoxConfig = this.cloneManualBoxConfig(preparedAsset.manualBox);
    this.activeFpCollisionBoxConfig = this.cloneManualBoxConfig(preparedAsset.fpCollisionBox || preparedAsset.manualBox);
    this.currentCutawayBoxConfig = null;

    const onResize = () => {
      const width = Math.max(1, this.container.clientWidth || 800);
      const height = Math.max(1, this.container.clientHeight || 600);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      app.resizeCanvas(width, height);
      app.renderNextFrame = true;
    };

    this.resizeObserver = new ResizeObserver(onResize);
    this.resizeObserver.observe(this.container);
    onResize();

    const splatAsset = new pc.Asset(preparedAsset.label || "Scene", "gsplat", {
      url: preparedAsset.src,
    });

    await new Promise((resolve, reject) => {
      splatAsset.on("progress", (received, total) => {
        if (!total) {
          return;
        }

        onState?.({
          status: "loading",
          title: "Loading SOG",
          message: `${preparedAsset.label || "SOG scene"} loading (${Math.round((received / total) * 100)}%)`,
        });
      });
      splatAsset.on("load", resolve);
      splatAsset.on("error", (error) => {
        const detail =
          typeof error === "string"
            ? error
            : error?.message || error?.status || error?.statusText || "Unknown PlayCanvas asset loader error";
        reject(new Error(`Failed to load SOG asset: ${preparedAsset.src} (${detail})`));
      });
      app.assets.add(splatAsset);
      app.assets.load(splatAsset);
    });

    const splatEntity = new pc.Entity(preparedAsset.label || "SOG");
    splatEntity.setLocalPosition(...(preparedAsset.position || [0, 0, 0]));
    const rotation = preparedAsset.rotation || [0, 0, 0, 1];
    splatEntity.setLocalRotation(rotation[0], rotation[1], rotation[2], rotation[3]);
    splatEntity.setLocalScale(...(preparedAsset.scale || [1, 1, 1]));
    splatEntity.addComponent("gsplat", {
      asset: splatAsset,
      unified: true,
    });
    app.root.addChild(splatEntity);
    this.splatEntity = splatEntity;

    const aabb = splatEntity.gsplat?.customAabb || splatEntity.gsplat?.aabb || splatAsset.resource?.aabb;
    const center = aabb?.center?.clone?.() || new pc.Vec3(0, 0, 0);
    const halfExtents = aabb?.halfExtents?.clone?.() || new pc.Vec3(1, 1, 1);
    if (!this.activeManualBoxConfig) {
      this.activeManualBoxConfig = this.createDefaultManualBoxConfig(center, halfExtents);
    }
    if (!this.activeFpCollisionBoxConfig) {
      this.activeFpCollisionBoxConfig = this.cloneManualBoxConfig(this.activeManualBoxConfig);
    }
    this.fpCollision = preparedAsset.streamingEnabled
      ? (this.fpCollision || this.createFallbackBoxCollision(pc, splatEntity, this.activeFpCollisionBoxConfig || this.activeManualBoxConfig))
      : null;

    const radius = Math.max(halfExtents.length(), 1);
    this.goalOrbitState = this.resolveOrbitState(pc, preparedAsset, splatEntity, center, radius);
    const transitionOrbitState =
      preparedAsset.streamingEnabled
        ? null
        : preparedAsset.transitionOrbitState
          ? this.cloneOrbitState(preparedAsset.transitionOrbitState)
          : null;
    this.orbitState = transitionOrbitState || this.cloneOrbitState(this.goalOrbitState);
    this.defaultOrbitState = this.cloneOrbitState(this.goalOrbitState);
    this.updateCameraOrbit(pc);
    this.syncCutawayState(pc, { immediate: true });
    this.configureStreaming(preparedAsset);

    if (preparedAsset.streamingEnabled) {
      this.firstPersonActive = false;
      this.firstPersonTransitionPending = false;
      this.startFirstPersonNavigation(pc);
    } else {
      this.orbitController = new SimpleOrbitController(canvas, {
        getFieldOfView: () => this.camera?.camera?.fov ?? preparedAsset.viewPreset?.fov ?? 60,
        onChange: () => {
          if (this.app) {
            this.app.renderNextFrame = true;
          }
        },
        onPanStateChange: (visible) => {
          this.setPanIndicatorVisible(visible);
        },
      });
      this.orbitController.bind(this.goalOrbitState);
    }

    if (this.autoRotate && !preparedAsset.streamingEnabled) {
      this.startAutoRotate(pc);
    }

    onState?.({
      status: "ready",
      title: "SOG ready",
      message: `${preparedAsset.label || "SOG scene"} loaded successfully.`,
    });
  }

  setManualBoxConfig(config) {
    this.activeManualBoxConfig = this.cloneManualBoxConfig(config);
    this.currentCutawayBoxConfig = null;

    if (this.app && this.splatEntity && this.pc) {
      this.syncCutawayState(this.pc, { immediate: true });
    }
  }

  setCutawayEnabled(enabled) {
    this.cutawayEnabled = !!enabled;
    if (this.app && this.splatEntity && this.pc) {
      this.syncCutawayState(this.pc, { immediate: true });
    }
  }

  setMaxDpr(maxDpr) {
    if (!this.app || !this.app.graphicsDevice) {
      return;
    }

    const nextPixelRatio = Math.max(
      0.5,
      Math.min(maxDpr || 1, window.devicePixelRatio || 1)
    );

    if (this.app.graphicsDevice.maxPixelRatio === nextPixelRatio) {
      return;
    }

    this.app.graphicsDevice.maxPixelRatio = nextPixelRatio;
    const width = Math.max(1, this.container.clientWidth || 800);
    const height = Math.max(1, this.container.clientHeight || 600);
    this.app.resizeCanvas(width, height);
    this.app.renderNextFrame = true;
  }

  resetView() {
    if (this.firstPersonActive && this.fpNavigationController && this.camera) {
      if (this.fpNavigationController.reset(this.camera) && this.app) {
        this.app.renderNextFrame = true;
      }
      return;
    }

    if (!this.pc || !this.defaultOrbitState || !this.goalOrbitState) {
      return;
    }

    this.goalOrbitState = this.cloneOrbitState(this.defaultOrbitState);
    if (this.app) {
      this.app.renderNextFrame = true;
    }
  }

  dispose() {
    this.stopAutoRotate();
    this.stopFirstPersonNavigation();
    this.setPanIndicatorVisible(false);
    this.clearStreamingHandlers();
    if (this.orbitController) {
      this.orbitController.dispose();
      this.orbitController = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.activeManualBoxConfig = null;
    this.activeFpCollisionBoxConfig = null;
    this.currentAsset = null;
    this.fpCollision = null;
    this.cutawayModifierInstalled = false;
    this.cutawayEnabled = true;
    this.defaultOrbitState = null;
    this.streamingState = null;
    this.fpNavigationMode = "walk";

    if (this.app) {
      this.app.destroy();
      this.app = null;
    }

    this.pc = null;
    this.camera = null;
    this.splatEntity = null;
    this.orbitState = null;
    this.goalOrbitState = null;
    this.canvas?.remove?.();
    this.canvas = null;

    // Removed container wipe to avoid destroying the active canvas
  }
}

export { PlayCanvasSogViewer };

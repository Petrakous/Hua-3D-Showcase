import { computeAutoCutaway } from "./autoCutaway.js?v=20260625fp22";
import { buildCollisionAdjustedViewPreset, loadMeshCollisionFromGlb, buildMeshCollisionFromEntity } from "./fpCollision.js?v=20260728ray1";
import { FirstPersonNavigationController } from "./fpNavigation.js?v=20260629tap1";
import { logger } from "./logger.js";

const PLAYCANVAS_CDN = "https://cdn.jsdelivr.net/npm/playcanvas@2.20.1/+esm";
const CANVAS_PIXEL_BUDGET = {
  desktop: 2073600, // Max 1920 * 1080 pixels (Full HD)
  mobile: 1024000,  // Max 1280 * 800 pixels (HD-ish)
};
const ORBIT_DAMPING_DECAY_MS = 140;
const CUTAWAY_DAMPING_DECAY_MS = 110;
const AUTO_ROTATE_DEGREES_PER_SECOND = 6;
const HOTSPOT_PICKER_SCALE = 0.25;
const HOTSPOT_HOVER_LIFT_PIXELS = 10;
const HOTSPOT_HOVER_LIFT_DECAY_MS = 110;
const HOTSPOT_OCCLUSION_TARGET_EPSILON = 0.4;
const HOTSPOT_OCCLUSION_MIN_INTERVAL_MS = 50;
const HOTSPOT_OCCLUSION_POSITION_EPSILON = 0.02;
const MODEL_VIEWER_PAN_SENSITIVITY = 0.018;
const DEFAULT_ORBIT_MIN_DISTANCE = 0.2;
const DEFAULT_ORBIT_MAX_DISTANCE = 200;
const STREAMING_READY_TIMEOUT_MS = 22000;
const STREAMING_STALL_WARNING_MS = 9000;
const STREAMING_SAFE_REMAINING_LOADS = 16;
const STREAMING_SAFE_READY_FRAMES = 2;
const STREAMING_MIN_READY_MS = 2500;
const ASSET_LOAD_TIMEOUT_MS = 45000;
const VIEWER_INIT_TIMEOUT_MS = 20000;
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

function withTimeout(promise, timeoutMs, message, details = {}) {
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(message);
      error.details = details;
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function getPlayCanvasAssetErrorDetail(error) {
  if (typeof error === "string") {
    return error;
  }
  return error?.message || error?.status || error?.statusText || "Unknown PlayCanvas asset loader error";
}

class SimpleOrbitController {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.onChange = options.onChange || (() => {});
    this.onUserInteraction = options.onUserInteraction || (() => {});
    this.onPanStateChange = options.onPanStateChange || (() => {});
    this.getFieldOfView = options.getFieldOfView || (() => 45);
    this.minDistance = options.minDistance ?? DEFAULT_ORBIT_MIN_DISTANCE;
    this.maxDistance = options.maxDistance ?? DEFAULT_ORBIT_MAX_DISTANCE;
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

  setDistanceLimits({ minDistance = DEFAULT_ORBIT_MIN_DISTANCE, maxDistance = DEFAULT_ORBIT_MAX_DISTANCE } = {}) {
    this.minDistance = Number.isFinite(minDistance) ? minDistance : DEFAULT_ORBIT_MIN_DISTANCE;
    this.maxDistance = Number.isFinite(maxDistance) ? maxDistance : DEFAULT_ORBIT_MAX_DISTANCE;
  }

  clampDistance(distance) {
    return Math.max(this.minDistance, Math.min(this.maxDistance, distance));
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

      if (deltaX || deltaY) {
        this.onUserInteraction();
      }
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
      this.onUserInteraction();
      const factor = event.deltaY > 0 ? 1.08 : 0.92;
      state.distance = this.clampDistance(state.distance * factor);
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
        if (deltaX || deltaY) {
          this.onUserInteraction();
        }
        state.yaw -= deltaX * 0.25;
        state.pitch = Math.max(-85, Math.min(85, state.pitch + deltaY * 0.2));
        this.onChange();
      } else if (this.touchMode === "pinch" && event.touches.length === 2) {
        const nextDistance = this.computeTouchDistance(event.touches);
        const nextCenter = this.computeTouchCenter(event.touches);
        const deltaX = nextCenter.x - this.touchCenterX;
        const deltaY = nextCenter.y - this.touchCenterY;
        if (
          Math.abs(deltaX) > 0.01 ||
          Math.abs(deltaY) > 0.01 ||
          Math.abs(nextDistance - this.pinchDistance) > 0.01
        ) {
          this.onUserInteraction();
        }

        if (Math.abs(deltaX) > 0.01 || Math.abs(deltaY) > 0.01) {
          this.panOrbitTarget(state, deltaX, deltaY);
        }

        if (this.pinchDistance > 0) {
          const ratio = this.pinchDistance / Math.max(nextDistance, 1);
          const dampedRatio = 1 + (ratio - 1) * 0.65;
          state.distance = this.clampDistance(state.distance * dampedRatio);
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
    this.streamingReadyState = null;
    this.currentCutawayBoxConfig = null;
    this.fpCollision = null;
    this.hotspotOcclusionCollision = null;
    this.hotspotOcclusionSource = "";
    this.collisionPreviewEntity = null;
    this.collisionPreviewAsset = null;
    this.collisionPreviewLoadPromise = null;
    this.collisionPreviewTransform = null;
    this.sceneTransform = null;
    this.collisionPreviewVisible = false;
    this._collisionRebuildTimer = null;
    // Spawn point editor state
    this.spawnEditConfig = null;       // { cameraPosition:[x,y,z], yaw:deg, pitch:deg, fov }
    this._spawnMarkerEntity = null;    // visible orange sphere
    this.spawnMarkerVisible = false;
    this.editorGuidesVisible = true;
    this.editorAxesVisible = true;
    this.cameraStartTransform = null;
    this.cameraStartMarkerVisible = false;
    this._cameraStartMarkerEntity = null;
    this.manualBoxPreviewVisible = false;
    this._manualBoxLabels = [];
    this.hotspotMarkerVisible = false;
    this.hotspotMarkerData = [];
    this.hotspotMarkerEntities = new Map();
    this.hotspotSurfaceAnchors = new Map();
    this.hotspotOverlayLayer = null;
    this.hotspotOverlayCamera = null;
    this.hotspotMaterials = null;
    this.hotspotTextures = [];
    this.hotspotPicker = null;
    this.hotspotPickQueue = Promise.resolve("");
    this.hotspotHoverPickPending = false;
    this.hotspotHoverPointer = null;
    this.hotspotHoverSequence = 0;
    this.hotspotHoveredId = "";
    this.hotspotPointerStart = null;
    this.hotspotInteractionDisposeFns = [];
    this.fpNavigationController = null;
    this.fpNavigationMode = "walk";
    this.flyCollisionIgnored = false;
    this.firstPersonActive = false;
    this.firstPersonTransitionPending = false;
    this.fpInteractionCommitted = false;
    this.cinematicCameraActive = false;
    this.cinematicPreviousAutoRotate = false;
    this.targetMaxDpr = null;
    this.loadGeneration = 0;
    this.disposed = true;
  }

  isLoadCurrent(generation) {
    return !this.disposed && generation === this.loadGeneration;
  }

  updateMaxPixelRatio(width, height) {
    if (!this.app || !this.app.graphicsDevice) {
      return;
    }
    const area = width * height;
    const isMobileOrTablet =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const budget = isMobileOrTablet ? CANVAS_PIXEL_BUDGET.mobile : CANVAS_PIXEL_BUDGET.desktop;
    const budgetRatio = Math.sqrt(budget / area);
    let pixelRatio = Math.min(window.devicePixelRatio || 1, this.targetMaxDpr || 1.05);
    pixelRatio = Math.min(pixelRatio, budgetRatio);
    pixelRatio = Math.max(0.5, pixelRatio);
    this.app.graphicsDevice.maxPixelRatio = pixelRatio;
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

  getManualBoxParentWorldMatrix(pc) {
    const referenceRotation = this.currentAsset?.manualBoxReferenceRotation;
    if (!referenceRotation) {
      return this.splatEntity.getWorldTransform();
    }

    const asset = this.currentAsset;
    return new pc.Mat4().setTRS(
      new pc.Vec3(...(asset.position || [0, 0, 0])),
      new pc.Quat(...referenceRotation),
      new pc.Vec3(...(asset.scale || [1, 1, 1]))
    );
  }

  transformManualBoxPointToWorld(pc, point) {
    const worldPoint = point?.clone?.() || new pc.Vec3(0, 0, 0);
    this.getManualBoxParentWorldMatrix(pc).transformPoint(worldPoint, worldPoint);
    return worldPoint;
  }

  transformScenePointToWorld(pc, point) {
    if (!this.splatEntity) {
      return point?.clone?.() || new pc.Vec3(0, 0, 0);
    }
    return this.transformPointToWorld(pc, this.splatEntity, point);
  }

  worldToContainerPoint(worldPoint) {
    if (!this.app || !this.camera?.camera || !this.container || !worldPoint) {
      return null;
    }

    const width = Math.max(1, this.canvas?.offsetWidth || this.container.clientWidth || 1);
    const height = Math.max(1, this.canvas?.offsetHeight || this.container.clientHeight || 1);
    const screen = this.camera.camera.worldToScreen(worldPoint, new this.pc.Vec3());
    if (!screen || ![screen.x, screen.y, screen.z].every(Number.isFinite)) {
      return null;
    }

    const x = screen.x;
    const y = screen.y;
    const margin = 72;
    const visible =
      x >= -margin &&
      y >= -margin &&
      x <= width + margin &&
      y <= height + margin;

    return {
      x,
      y,
      z: screen.z,
      visible: screen.z >= 0 && visible,
    };
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
    if (asset.cameraStartOverride?.position) {
      const transform = asset.cameraStartOverride;
      const position = new pc.Vec3(...transform.position);
      const rotation = this.createStandardEulerQuaternion(pc, transform.rotationDegrees || [0, 0, 0]);
      const forward = rotation.transformVector(new pc.Vec3(0, 0, -1));
      this.cameraStartTransform = {
        position: [...transform.position],
        rotationDegrees: [...(transform.rotationDegrees || [0, 0, 0])],
        scale: [1, 1, 1],
      };
      return this.resolveOrbitStateFromCamera(pc, position.clone().add(forward), position);
    }

    const viewPreset = asset.viewPreset || {};
    const manualBox = asset.streamingEnabled ? asset.manualBox : null;
    const useManualBoxAnchor = !!manualBox && !viewPreset.target && !viewPreset.cameraPosition;
    const orbitAnchor = useManualBoxAnchor
      ? new pc.Vec3(...(manualBox.position || [0, 0, 0]))
      : localBoundsCenter;
    const toWorld = asset.manualBoxReferenceRotation
      ? (point) => this.transformManualBoxPointToWorld(pc, point)
      : (point) => this.transformPointToWorld(pc, entity, point);
    const target = viewPreset.target
      ? toWorld(new pc.Vec3(...viewPreset.target))
      : toWorld(orbitAnchor);

    if (viewPreset.cameraPosition) {
      const cameraPosition = toWorld(new pc.Vec3(...viewPreset.cameraPosition));
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

  beginCinematicCamera() {
    if (!this.camera || !this.pc) {
      return false;
    }

    if (!this.cinematicCameraActive) {
      this.cinematicPreviousAutoRotate = this.autoRotate;
    }
    this.cinematicCameraActive = true;
    this.autoRotate = false;
    this.setPanIndicatorVisible(false);
    if (this.app) this.app.renderNextFrame = true;
    return true;
  }

  setCinematicCameraPose(position, target, fov = null, coordinateSpace = "local") {
    if (!this.cinematicCameraActive || !this.camera || !this.pc || !position || !target) {
      return false;
    }

    let cameraPosition = new this.pc.Vec3(...position);
    let lookTarget = new this.pc.Vec3(...target);
    if (coordinateSpace === "local" && this.splatEntity) {
      cameraPosition = this.transformPointToWorld(this.pc, this.splatEntity, cameraPosition);
      lookTarget = this.transformPointToWorld(this.pc, this.splatEntity, lookTarget);
    }

    this.camera.setPosition(cameraPosition);
    this.camera.lookAt(lookTarget);
    if (Number.isFinite(fov) && this.camera.camera) {
      this.camera.camera.fov = fov;
    }
    if (this.app) this.app.renderNextFrame = true;
    return true;
  }

  getCinematicCameraPose(coordinateSpace = "local", fallbackTargetDistance = 5) {
    if (!this.camera || !this.pc) {
      return null;
    }

    let position = this.camera.getPosition().clone();
    const orbitState = this.getOrbitState();
    let target = orbitState?.target?.clone?.() || null;
    if (!target) {
      const forward = this.camera.forward?.clone?.() || new this.pc.Vec3(0, 0, -1);
      target = position.clone().add(forward.mulScalar(fallbackTargetDistance));
    }

    if (coordinateSpace === "local" && this.splatEntity) {
      const inverseWorld = this.splatEntity.getWorldTransform().clone().invert();
      inverseWorld.transformPoint(position, position);
      inverseWorld.transformPoint(target, target);
    }

    return {
      position: [position.x, position.y, position.z],
      target: [target.x, target.y, target.z],
      fov: Number.isFinite(this.camera.camera?.fov) ? this.camera.camera.fov : null,
    };
  }

  setDefaultCameraPose(pose, coordinateSpace = "local") {
    if (!this.pc || !pose?.position || !pose?.target) return false;

    let position = new this.pc.Vec3(...pose.position);
    let target = new this.pc.Vec3(...pose.target);
    if (coordinateSpace === "local" && this.splatEntity) {
      position = this.transformPointToWorld(this.pc, this.splatEntity, position);
      target = this.transformPointToWorld(this.pc, this.splatEntity, target);
    }

    const savedState = this.resolveOrbitStateFromCamera(this.pc, target, position);
    this.defaultOrbitState = this.cloneOrbitState(savedState);
    if (!this.firstPersonActive && this.goalOrbitState && this.orbitState) {
      this.goalOrbitState.target.copy(savedState.target);
      this.goalOrbitState.distance = savedState.distance;
      this.goalOrbitState.yaw = savedState.yaw;
      this.goalOrbitState.pitch = savedState.pitch;
      this.orbitState.target.copy(savedState.target);
      this.orbitState.distance = savedState.distance;
      this.orbitState.yaw = savedState.yaw;
      this.orbitState.pitch = savedState.pitch;
      this.updateCameraOrbit(this.pc);
    }
    if (Number.isFinite(pose.fov) && this.camera?.camera) {
      this.camera.camera.fov = pose.fov;
    }
    if (this.app) this.app.renderNextFrame = true;
    return true;
  }

  createOrbitKeyframes(pose, {
    duration = 14,
    steps = 16,
    coordinateSpace = "local",
    rotations = 1,
    simple = false,
  } = {}) {
    if (!this.pc || !pose?.position || !pose?.target || steps < 3) return [];

    let startPosition = new this.pc.Vec3(...pose.position);
    let target = new this.pc.Vec3(...pose.target);
    if (coordinateSpace === "local" && this.splatEntity) {
      startPosition = this.transformPointToWorld(this.pc, this.splatEntity, startPosition);
      target = this.transformPointToWorld(this.pc, this.splatEntity, target);
    }

    const offset = startPosition.clone().sub(target);
    const horizontalRadius = Math.hypot(offset.x, offset.z);
    if (horizontalRadius < 0.001) return [];
    const inverseWorld = coordinateSpace === "local" && this.splatEntity
      ? this.splatEntity.getWorldTransform().clone().invert()
      : null;
    const safeDuration = Math.max(1, duration);
    const safeSteps = Math.max(3, Math.round(steps));
    const safeRotations = Math.max(1, rotations);

    return Array.from({ length: safeSteps + 1 }, (_, index) => {
      if (index === safeSteps) {
        return {
          time: safeDuration,
          position: [...pose.position],
          target: [...pose.target],
          fov: pose.fov,
        };
      }

      const progress = index / safeSteps;
      // Ease only the beginning and end of the complete shot. Internal
      // keyframes remain one continuous move with no stop-start rhythm.
      const motionProgress = simple
        ? progress
        : progress * progress * progress * (progress * (progress * 6 - 15) + 10);
      const angle = motionProgress * Math.PI * 2 * safeRotations;
      const cosine = Math.cos(angle);
      const sine = Math.sin(angle);
      const revealArc = simple ? 0 : Math.sin(Math.PI * progress);
      const orbitPulse = simple ? 0 : Math.sin(Math.PI * progress) ** 2;
      const radialScale = simple ? 1 : 1 - orbitPulse * 0.14 + Math.sin(Math.PI * 2 * progress) * 0.035;
      const cameraLift = simple ? 0 : horizontalRadius * 0.14 * revealArc;
      const focusLift = simple ? 0 : horizontalRadius * 0.035 * revealArc;
      const worldTarget = new this.pc.Vec3(target.x, target.y + focusLift, target.z);
      const worldPosition = new this.pc.Vec3(
        target.x + (offset.x * cosine + offset.z * sine) * radialScale,
        target.y + offset.y + cameraLift,
        target.z + (-offset.x * sine + offset.z * cosine) * radialScale
      );
      const outputPosition = inverseWorld
        ? inverseWorld.transformPoint(worldPosition, new this.pc.Vec3())
        : worldPosition;
      const outputTarget = inverseWorld
        ? inverseWorld.transformPoint(worldTarget, new this.pc.Vec3())
        : worldTarget;
      const baseFov = Number.isFinite(pose.fov) ? pose.fov : 60;
      const cinematicFov = simple
        ? baseFov
        : Math.max(30, Math.min(85,
            baseFov - orbitPulse * 5 + Math.sin(Math.PI * 2 * progress) * 1.5
          ));
      return {
        time: progress * safeDuration,
        position: [outputPosition.x, outputPosition.y, outputPosition.z],
        target: [outputTarget.x, outputTarget.y, outputTarget.z],
        fov: cinematicFov,
      };
    });
  }

  endCinematicCamera() {
    if (!this.cinematicCameraActive) {
      return;
    }

    this.cinematicCameraActive = false;
    this.autoRotate = this.cinematicPreviousAutoRotate;
    this.cinematicPreviousAutoRotate = false;
    // Return to a controller-owned, internally consistent pose.
    this.resetView();
    if (this.app) this.app.renderNextFrame = true;
  }

  setFirstPersonNavigationMode(mode = "walk") {
    this.fpNavigationMode = mode === "fly" ? "fly" : "walk";
    this.fpNavigationController?.setMode?.(this.fpNavigationMode);
    if (this.app) {
      this.app.renderNextFrame = true;
    }
  }

  setFlyCollisionIgnored(ignored) {
    this.flyCollisionIgnored = ignored === true;
    this.fpNavigationController?.setFlyCollisionIgnored(this.flyCollisionIgnored);
    if (this.app) this.app.renderNextFrame = true;
  }

  getFlyCollisionIgnored() {
    return this.flyCollisionIgnored;
  }

  getSceneTransform() {
    if (this.sceneTransform) return this.sceneTransform;
    if (!this.splatEntity) return null;
    const position = this.splatEntity.getLocalPosition();
    const rotation = this.splatEntity.getLocalEulerAngles();
    const scale = this.splatEntity.getLocalScale();
    return {
      position: [position.x, position.y, position.z],
      rotationDegrees: [rotation.x, rotation.y, rotation.z],
      scale: [scale.x, scale.y, scale.z],
    };
  }

  setSceneTransform(transform) {
    this.sceneTransform = transform;
    if (!this.splatEntity || !transform) return;
    this.splatEntity.setLocalPosition(...(transform.position || [0, 0, 0]));
    this.splatEntity.setLocalEulerAngles(...(transform.rotationDegrees || [0, 0, 0]));
    this.splatEntity.setLocalScale(...(transform.scale || [1, 1, 1]));
    this.splatEntity.syncHierarchy();
    this.hotspotSurfaceAnchors.clear();
    if (this.app) this.app.renderNextFrame = true;
  }

  async loadCollisionPreview(asset = this.currentAsset, generation = this.loadGeneration) {
    if (!asset?.fpCollisionSource || !this.app || !this.pc) return;
    const app = this.app;
    if (this.collisionPreviewEntity) this.collisionPreviewEntity.destroy();
    if (this.collisionPreviewAsset) {
      this.app.assets.remove(this.collisionPreviewAsset);
      this.collisionPreviewAsset.unload();
    }

    const previewAsset = new this.pc.Asset("Collision preview", "container", { url: asset.fpCollisionSource });
    await new Promise((resolve, reject) => {
      previewAsset.once("load", resolve);
      previewAsset.once("error", reject);
      this.app.assets.add(previewAsset);
      this.app.assets.load(previewAsset);
    });
    if (!this.isLoadCurrent(generation) || this.app !== app || !previewAsset.resource) {
      app.assets.remove(previewAsset);
      previewAsset.unload();
      return;
    }

    const entity = previewAsset.resource.instantiateRenderEntity();
    entity.name = "CollisionPreview";

    // Initialise the collision preview so it starts overlapping the rendered SOG.
    // We reuse a previously saved collision transform if one exists, otherwise we
    // seed it from the splat entity's current local transform so the mesh appears
    // right on top of the model and the user can fine-tune from there.
    const seedTransform = this.collisionPreviewTransform || (asset.collisionPosition ? {
      position: asset.collisionPosition,
      rotationDegrees: asset.collisionRotationDegrees || [0, 0, 0],
      scale: asset.collisionScale || [1, 1, 1]
    } : null) || this.getSceneTransform() || {
      position: asset.position || [0, 0, 0],
      rotationDegrees: [0, 0, 0],
      scale: asset.scale || [1, 1, 1],
    };
    entity.setLocalPosition(...(seedTransform.position || [0, 0, 0]));
    entity.setLocalEulerAngles(...(seedTransform.rotationDegrees || [0, 0, 0]));
    entity.setLocalScale(...(seedTransform.scale || [1, 1, 1]));

    // Bright collision overlay material. CRITICAL: depthTest = false so the mesh
    // ALWAYS draws on top of the splat cloud. Without this, the mesh sits inside
    // the transparent gaussian cloud and depth-sorting makes it flicker/vanish.
    const overlayMaterial = new this.pc.StandardMaterial();
    overlayMaterial.useLighting = false;
    overlayMaterial.diffuse = new this.pc.Color(0, 0, 0);
    overlayMaterial.emissive = new this.pc.Color(0.15, 1.0, 0.45);
    overlayMaterial.opacity = 0.55;
    overlayMaterial.blendType = this.pc.BLEND_NORMAL;
    overlayMaterial.depthTest = false;
    overlayMaterial.depthWrite = false;
    overlayMaterial.cull = this.pc.CULLFACE_NONE;
    overlayMaterial.update();
    const applyOverlay = (node) => {
      for (const meshInstance of node.render?.meshInstances || []) {
        meshInstance.material = overlayMaterial;
        // Force the overlay to render after the splat cloud within its layer.
        meshInstance.drawOrder = 1e6;
      }
      for (const child of node.children || []) applyOverlay(child);
    };
    applyOverlay(entity);
    entity.enabled = this.collisionPreviewVisible;
    this.app.root.addChild(entity);
    this.collisionPreviewEntity = entity;
    this.collisionPreviewAsset = previewAsset;
    this.collisionPreviewTransform = seedTransform;
    if (this.app) this.app.renderNextFrame = true;

    // The visible mesh becomes the real physics collision — what you see blocks you.
    this.rebuildCollisionFromPreview();
  }

  setCollisionPreviewVisible(visible) {
    this.collisionPreviewVisible = visible === true;
    if (this.collisionPreviewEntity) this.collisionPreviewEntity.enabled = this.collisionPreviewVisible;
    if (
      this.collisionPreviewVisible &&
      !this.collisionPreviewEntity &&
      !this.collisionPreviewLoadPromise &&
      this.currentAsset?.fpCollisionSource
    ) {
      const generation = this.loadGeneration;
      const loadPromise = this.loadCollisionPreview(this.currentAsset, generation)
        .catch((error) => {
          if (this.isLoadCurrent(generation)) {
            logger.warn("sog-loader", "Collision preview failed", {
              source: this.currentAsset?.fpCollisionSource || null,
            }, error);
          }
        })
        .finally(() => {
          if (this.collisionPreviewLoadPromise === loadPromise) {
            this.collisionPreviewLoadPromise = null;
          }
        });
      this.collisionPreviewLoadPromise = loadPromise;
    }
    if (this.app) this.app.renderNextFrame = true;
  }

  getCollisionPreviewVisible() {
    return this.collisionPreviewVisible;
  }

  getCollisionPreviewTransform() {
    if (this.collisionPreviewTransform) return this.collisionPreviewTransform;
    if (!this.collisionPreviewEntity) return null;
    const p = this.collisionPreviewEntity.getLocalPosition();
    const r = this.collisionPreviewEntity.getLocalEulerAngles();
    const s = this.collisionPreviewEntity.getLocalScale();
    return { position: [p.x, p.y, p.z], rotationDegrees: [r.x, r.y, r.z], scale: [s.x, s.y, s.z] };
  }

  setCollisionPreviewTransform(transform) {
    this.collisionPreviewTransform = transform;
    if (!this.collisionPreviewEntity || !transform) return;
    this.collisionPreviewEntity.setLocalPosition(...transform.position);
    this.collisionPreviewEntity.setLocalEulerAngles(...transform.rotationDegrees);
    this.collisionPreviewEntity.setLocalScale(...transform.scale);
    this.collisionPreviewEntity.syncHierarchy();
    if (this.app) this.app.renderNextFrame = true;
    // Rebuild the actual physics collision so what you SEE is what blocks you.
    this.scheduleCollisionRebuild();
  }

  // Rebuild the physics collision (used by Walk/Fly) from the live preview mesh,
  // so it matches exactly what is rendered. Debounced to avoid rebuilding the
  // spatial hash on every keystroke.
  scheduleCollisionRebuild() {
    if (this._collisionRebuildTimer) {
      clearTimeout(this._collisionRebuildTimer);
    }
    this._collisionRebuildTimer = setTimeout(() => {
      this._collisionRebuildTimer = null;
      this.rebuildCollisionFromPreview();
    }, 220);
  }

  rebuildCollisionFromPreview() {
    if (!this.pc || !this.collisionPreviewEntity) {
      return;
    }
    try {
      const collision = buildMeshCollisionFromEntity(this.pc, this.collisionPreviewEntity);
      if (collision) {
        this.fpCollision = collision;
        this.hotspotOcclusionCollision = collision;
        this.hotspotOcclusionSource = this.currentAsset?.fpCollisionSource || "";
        this.hotspotSurfaceAnchors.clear();
        this.invalidateHotspotOcclusionCache();
        this.fpNavigationController?.setCollision?.(collision);
      }
    } catch (error) {
      logger.warn("sog-loader", "Collision rebuild from preview failed", {
        source: this.currentAsset?.fpCollisionSource || null,
      }, error);
    }
  }

  setEditorGuidesVisible(visible) {
    this.editorGuidesVisible = visible === true;
    if (this.app) this.app.renderNextFrame = true;
  }

  projectWorldPoint(position, options = {}) {
    if (!this.app || !this.pc || !this.camera?.camera || !this.container) {
      return null;
    }

    const values = Array.isArray(position)
      ? position
      : [position?.x, position?.y, position?.z];
    const [x, y, z] = values.map(Number);
    if (![x, y, z].every(Number.isFinite)) {
      return null;
    }

    const localPoint = new this.pc.Vec3(x, y, z);
    const point = options.coordinateSpace === "world"
      ? localPoint
      : this.transformScenePointToWorld(this.pc, localPoint);
    const projected = this.worldToContainerPoint(point);
    if (!projected) {
      return null;
    }

    const cameraPosition = this.camera.getPosition();
    const toPoint = point.clone().sub(cameraPosition);

    return {
      x: projected.x,
      y: projected.y,
      z: projected.z,
      visible: projected.visible,
      distance: toPoint.length(),
    };
  }

  setHotspotMarkers(hotspots = [], options = {}) {
    this.hotspotMarkerData = Array.isArray(hotspots) ? hotspots.map((hotspot) => ({
      id: hotspot.id,
      selected: hotspot.selected === true,
      position: Array.isArray(hotspot.position)
        ? [...hotspot.position]
        : [
            Number(hotspot.position?.x ?? 0),
            Number(hotspot.position?.y ?? 0),
            Number(hotspot.position?.z ?? 0),
          ],
    })) : [];
    this.hotspotMarkerVisible = options.visible !== false && this.hotspotMarkerData.length > 0;
    this.syncHotspotMarkerEntities();
    if (this.app) this.app.renderNextFrame = true;
  }

  clearHotspotMarkers() {
    this.hotspotMarkerData = [];
    this.hotspotMarkerVisible = false;
    for (const entity of this.hotspotMarkerEntities.values()) {
      entity.destroy?.();
    }
    this.hotspotMarkerEntities.clear();
    this.hotspotSurfaceAnchors.clear();
    if (this.app) this.app.renderNextFrame = true;
  }

  createHotspotArtworkCanvas(kind = "marker") {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) return null;

    const center = 128;
    context.clearRect(0, 0, 256, 256);
    context.lineCap = "round";
    context.lineJoin = "round";

    if (kind === "pulse") {
      const glow = context.createRadialGradient(center, center, 66, center, center, 116);
      glow.addColorStop(0, "rgba(59, 241, 226, 0)");
      glow.addColorStop(0.62, "rgba(59, 241, 226, 0.08)");
      glow.addColorStop(0.78, "rgba(110, 255, 242, 0.52)");
      glow.addColorStop(0.84, "rgba(110, 255, 242, 0.10)");
      glow.addColorStop(1, "rgba(59, 241, 226, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, 256, 256);
    } else {
      const halo = context.createRadialGradient(center, center, 18, center, center, 122);
      halo.addColorStop(0, "rgba(141, 255, 244, 0.56)");
      halo.addColorStop(0.34, "rgba(38, 224, 215, 0.24)");
      halo.addColorStop(0.68, "rgba(38, 224, 215, 0.07)");
      halo.addColorStop(1, "rgba(38, 224, 215, 0)");
      context.fillStyle = halo;
      context.fillRect(0, 0, 256, 256);

      context.shadowColor = "rgba(41, 236, 222, 0.92)";
      context.shadowBlur = 18;
      context.strokeStyle = "rgba(119, 255, 243, 0.9)";
      context.lineWidth = 5;
      context.beginPath();
      context.arc(center, center, 76, 0, Math.PI * 2);
      context.stroke();

      context.shadowBlur = 10;
      context.strokeStyle = "rgba(184, 255, 247, 0.48)";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(center, center, 96, 0, Math.PI * 2);
      context.stroke();

      const glass = context.createRadialGradient(105, 100, 8, center, center, 62);
      glass.addColorStop(0, "rgba(226, 255, 252, 0.96)");
      glass.addColorStop(0.22, "rgba(93, 247, 233, 0.94)");
      glass.addColorStop(0.62, "rgba(14, 155, 161, 0.90)");
      glass.addColorStop(1, "rgba(5, 55, 70, 0.96)");
      context.shadowBlur = 22;
      context.fillStyle = glass;
      context.beginPath();
      context.arc(center, center, 53, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
      context.strokeStyle = "rgba(210, 255, 250, 0.72)";
      context.lineWidth = 3;
      context.stroke();

      // A minimal doorway/entry glyph keeps the marker meaningful at small sizes.
      context.strokeStyle = "rgba(239, 255, 253, 0.98)";
      context.fillStyle = "rgba(239, 255, 253, 0.98)";
      context.lineWidth = 7;
      context.beginPath();
      context.rect(109, 94, 38, 55);
      context.stroke();
      context.beginPath();
      context.moveTo(128, 106);
      context.lineTo(128, 137);
      context.moveTo(117, 126);
      context.lineTo(128, 137);
      context.lineTo(139, 126);
      context.stroke();
    }

    return canvas;
  }

  createHotspotTexture(kind) {
    const source = this.createHotspotArtworkCanvas(kind);
    if (!source || !this.pc || !this.app) return null;
    const texture = new this.pc.Texture(this.app.graphicsDevice, {
      name: `HuaHotspot:${kind}`,
      width: source.width,
      height: source.height,
      mipmaps: false,
      minFilter: this.pc.FILTER_LINEAR,
      magFilter: this.pc.FILTER_LINEAR,
      addressU: this.pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: this.pc.ADDRESS_CLAMP_TO_EDGE,
    });
    texture.setSource(source);
    this.hotspotTextures.push(texture);
    return texture;
  }

  createHotspotMaterial(texture, opacity = 1) {
    const material = new this.pc.StandardMaterial();
    material.useLighting = false;
    material.diffuse = new this.pc.Color(0, 0, 0);
    material.emissive = new this.pc.Color(1, 1, 1);
    material.emissiveMap = texture;
    material.opacityMap = texture;
    material.opacityMapChannel = "a";
    material.opacity = opacity;
    material.blendType = this.pc.BLEND_NORMAL;
    material.depthTest = false;
    material.depthWrite = false;
    material.cull = this.pc.CULLFACE_NONE;
    material.update();
    return material;
  }

  ensureHotspotOverlayRenderer() {
    if (!this.pc || !this.app || !this.camera?.camera) return false;
    if (!this.hotspotOverlayLayer) {
      const layer = new this.pc.Layer({
        name: "HotspotOverlay",
        opaqueSortMode: this.pc.SORTMODE_MANUAL,
        transparentSortMode: this.pc.SORTMODE_MANUAL,
      });
      this.app.scene.layers.pushTransparent(layer);
      this.hotspotOverlayLayer = layer;
    }

    if (!this.hotspotOverlayCamera) {
      const overlayCamera = new this.pc.Entity("HotspotOverlayCamera");
      overlayCamera.addComponent("camera", {
        clearColorBuffer: false,
        clearDepthBuffer: true,
        clearStencilBuffer: false,
        priority: (this.camera.camera.priority || 0) + 100,
        nearClip: this.camera.camera.nearClip,
        farClip: this.camera.camera.farClip,
        fov: this.camera.camera.fov,
        layers: [this.hotspotOverlayLayer.id],
      });
      this.app.root.addChild(overlayCamera);
      this.hotspotOverlayCamera = overlayCamera;
    }

    if (!this.hotspotMaterials) {
      const markerTexture = this.createHotspotTexture("marker");
      const pulseTexture = this.createHotspotTexture("pulse");
      this.hotspotMaterials = {
        marker: this.createHotspotMaterial(markerTexture, 0.98),
        pulse: this.createHotspotMaterial(pulseTexture, 0.5),
      };
    }
    return true;
  }

  syncHotspotOverlayCamera() {
    if (!this.hotspotOverlayCamera?.camera || !this.camera?.camera) return;
    this.hotspotOverlayCamera.setPosition(this.camera.getPosition());
    this.hotspotOverlayCamera.setRotation(this.camera.getRotation());
    this.hotspotOverlayCamera.camera.fov = this.camera.camera.fov;
    this.hotspotOverlayCamera.camera.horizontalFov = this.camera.camera.horizontalFov;
    this.hotspotOverlayCamera.camera.nearClip = this.camera.camera.nearClip;
    this.hotspotOverlayCamera.camera.farClip = this.camera.camera.farClip;
    this.hotspotOverlayCamera.camera.projection = this.camera.camera.projection;
    this.hotspotOverlayCamera.camera.orthoHeight = this.camera.camera.orthoHeight;
    this.hotspotOverlayCamera.camera.rect = this.camera.camera.rect;
  }

  async prepareHotspotOcclusionCollision(asset = this.currentAsset, generation = this.loadGeneration) {
    if (!asset?.fpCollisionSource || asset.fpCollisionStrategy === "box" || !this.app || !this.pc) {
      this.hotspotOcclusionCollision = this.fpCollision;
      this.hotspotOcclusionSource = "";
      return;
    }
    if (
      this.hotspotOcclusionCollision &&
      this.hotspotOcclusionSource === asset.fpCollisionSource
    ) {
      return;
    }

    const app = this.app;
    this.hotspotOcclusionCollision = null;
    this.hotspotOcclusionSource = "";
    this.hotspotSurfaceAnchors.clear();
    try {
      const collision = this.fpCollision || await loadMeshCollisionFromGlb(
        app,
        this.pc,
        asset.fpCollisionSource,
        {
          position: asset.collisionPosition || asset.position,
          rotation: asset.collisionRotation || asset.rotation,
          scale: asset.collisionScale || asset.scale,
        }
      );
      if (!this.isLoadCurrent(generation) || this.app !== app) return;
      this.hotspotOcclusionCollision = collision;
      this.hotspotOcclusionSource = collision ? asset.fpCollisionSource : "";
      this.hotspotSurfaceAnchors.clear();
      this.invalidateHotspotOcclusionCache();
      this.app.renderNextFrame = true;
    } catch (error) {
      if (!this.isLoadCurrent(generation) || this.app !== app) return;
      this.hotspotOcclusionCollision = this.fpCollision;
      this.hotspotOcclusionSource = "";
      logger.warn("sog-loader", "Hotspot occlusion collision failed", {
        source: asset.fpCollisionSource,
        scene_source: asset.src,
      }, error);
    }
  }

  invalidateHotspotOcclusionCache() {
    for (const entity of this.hotspotMarkerEntities.values()) {
      entity._huaHotspotOcclusionCheckedAt = -Infinity;
      entity._huaHotspotOcclusionCameraPosition = null;
      entity._huaHotspotOcclusionWorldPoint = null;
    }
  }

  resolveHotspotWorldPoint(hotspot) {
    const surfaceCollision = this.hotspotOcclusionCollision || this.fpCollision;
    const signature = hotspot.position.map((value) => Number(value).toFixed(5)).join("|");
    const cached = this.hotspotSurfaceAnchors.get(hotspot.id);
    if (
      cached?.signature === signature &&
      (cached.snapped || !surfaceCollision?.queryClosestPoint)
    ) {
      return cached.point.clone();
    }

    const local = new this.pc.Vec3(...hotspot.position);
    const configuredWorld = this.transformScenePointToWorld(this.pc, local);
    const snapped = surfaceCollision?.queryClosestPoint?.(
      configuredWorld.x,
      configuredWorld.y,
      configuredWorld.z,
      4
    );
    const point = snapped
      ? new this.pc.Vec3(snapped.x, snapped.y, snapped.z)
      : configuredWorld;
    this.hotspotSurfaceAnchors.set(hotspot.id, {
      signature,
      point: point.clone(),
      snapped: !!snapped,
      snapDistance: snapped?.distance ?? null,
    });
    return point;
  }

  isHotspotOccluded(worldPoint, entity = null, now = performance.now()) {
    const collision = this.hotspotOcclusionCollision || this.fpCollision;
    if (!collision?.queryRay || !this.camera) return false;

    const cameraPosition = this.camera.getPosition();
    const lastCameraPosition = entity?._huaHotspotOcclusionCameraPosition;
    const lastWorldPoint = entity?._huaHotspotOcclusionWorldPoint;
    const positionEpsilonSq = HOTSPOT_OCCLUSION_POSITION_EPSILON ** 2;
    const cameraMovedSq = lastCameraPosition
      ? (
          (cameraPosition.x - lastCameraPosition.x) ** 2 +
          (cameraPosition.y - lastCameraPosition.y) ** 2 +
          (cameraPosition.z - lastCameraPosition.z) ** 2
        )
      : Infinity;
    const markerMovedSq = lastWorldPoint
      ? (
          (worldPoint.x - lastWorldPoint.x) ** 2 +
          (worldPoint.y - lastWorldPoint.y) ** 2 +
          (worldPoint.z - lastWorldPoint.z) ** 2
        )
      : Infinity;
    const lastCheckedAt = Number(entity?._huaHotspotOcclusionCheckedAt ?? -Infinity);
    if (
      entity &&
      cameraMovedSq <= positionEpsilonSq &&
      markerMovedSq <= positionEpsilonSq
    ) {
      return entity._huaHotspotOccluded === true;
    }
    if (
      entity &&
      now - lastCheckedAt < HOTSPOT_OCCLUSION_MIN_INTERVAL_MS
    ) {
      return entity._huaHotspotOccluded === true;
    }

    const direction = worldPoint.clone().sub(cameraPosition);
    const distance = direction.length();
    const maxDistance = distance - HOTSPOT_OCCLUSION_TARGET_EPSILON;
    if (maxDistance <= 0.01) return false;
    direction.mulScalar(1 / distance);

    const occluded = !!collision.queryRay(
      cameraPosition.x,
      cameraPosition.y,
      cameraPosition.z,
      direction.x,
      direction.y,
      direction.z,
      maxDistance
    );
    if (entity) {
      entity._huaHotspotOccluded = occluded;
      entity._huaHotspotOcclusionCheckedAt = now;
      entity._huaHotspotOcclusionCameraPosition = cameraPosition.clone();
      entity._huaHotspotOcclusionWorldPoint = worldPoint.clone();
    }
    return occluded;
  }

  createHotspotMarkerEntity(id) {
    if (!this.ensureHotspotOverlayRenderer()) return null;
    const marker = new this.pc.Entity(`HotspotMarker:${id}`);
    const pulse = new this.pc.Entity("HotspotPulse");
    const base = new this.pc.Entity("HotspotBase");
    pulse.addComponent("render", {
      type: "plane",
      material: this.hotspotMaterials.pulse,
      castShadows: false,
      receiveShadows: false,
      layers: [this.hotspotOverlayLayer.id],
    });
    base.addComponent("render", {
      type: "plane",
      material: this.hotspotMaterials.marker,
      castShadows: false,
      receiveShadows: false,
      layers: [this.hotspotOverlayLayer.id],
    });
    for (const meshInstance of pulse.render.meshInstances || []) {
      meshInstance.material = this.hotspotMaterials.pulse;
      meshInstance.drawOrder = 0;
      meshInstance._huaHotspotId = id;
    }
    for (const meshInstance of base.render.meshInstances || []) {
      meshInstance.material = this.hotspotMaterials.marker;
      meshInstance.drawOrder = 1;
      meshInstance._huaHotspotId = id;
    }
    marker._huaHotspotId = id;
    pulse._huaHotspotId = id;
    base._huaHotspotId = id;
    pulse.setLocalEulerAngles(90, 0, 0);
    base.setLocalEulerAngles(90, 0, 0);
    pulse.setLocalPosition(0, 0, 0.002);
    marker.addChild(pulse);
    marker.addChild(base);
    marker._huaHotspotVisual = { base, pulse };
    this.app.root.addChild(marker);
    return marker;
  }

  ensureHotspotPicker() {
    if (
      !this.hotspotPicker &&
      this.pc?.Picker &&
      this.app &&
      this.hotspotOverlayCamera?.camera &&
      this.hotspotOverlayLayer
    ) {
      this.hotspotPicker = new this.pc.Picker(this.app, 1, 1);
    }
    return this.hotspotPicker;
  }

  getPickedHotspotId(selection = []) {
    for (const picked of selection) {
      if (picked?._huaHotspotId) {
        return picked._huaHotspotId;
      }
      let node = picked?.node || null;
      while (node) {
        if (node._huaHotspotId) {
          return node._huaHotspotId;
        }
        node = node.parent || node.getParent?.() || null;
      }
    }
    return "";
  }

  async pickHotspotAtCanvasPoint(clientX, clientY) {
    if (!this.canvas || !this.hotspotMarkerVisible) return "";
    const picker = this.ensureHotspotPicker();
    if (!picker) return "";
    const rect = this.canvas.getBoundingClientRect();
    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      clientX < rect.left ||
      clientY < rect.top ||
      clientX > rect.right ||
      clientY > rect.bottom
    ) return "";

    // Picker renders the actual overlay mesh IDs into its own buffer. The only
    // conversion here maps pointer position into that buffer; no 3D projection
    // or inferred screen-space hotspot is involved.
    const width = Math.max(1, Math.round(rect.width * HOTSPOT_PICKER_SCALE));
    const height = Math.max(1, Math.round(rect.height * HOTSPOT_PICKER_SCALE));
    picker.resize(width, height);
    picker.prepare(
      this.hotspotOverlayCamera.camera,
      this.app.scene,
      [this.hotspotOverlayLayer]
    );
    const x = Math.max(0, Math.min(width - 1, Math.floor(
      (clientX - rect.left) * (width / rect.width)
    )));
    const y = Math.max(0, Math.min(height - 1, Math.floor(
      (clientY - rect.top) * (height / rect.height)
    )));
    const selection = picker.getSelectionAsync
      ? await picker.getSelectionAsync(x, y, 1, 1)
      : picker.getSelection(x, y, 1, 1);
    if (picker !== this.hotspotPicker) return "";
    return this.getPickedHotspotId(selection);
  }

  queueHotspotPick(clientX, clientY) {
    const run = () => this.pickHotspotAtCanvasPoint(clientX, clientY);
    const result = this.hotspotPickQueue.then(run, run).catch(() => "");
    this.hotspotPickQueue = result;
    return result;
  }

  setHotspotHover(id) {
    const nextId = id || "";
    this.canvas.dataset.hotspotHoverId = nextId;
    if (nextId !== this.hotspotHoveredId) {
      this.hotspotHoveredId = nextId;
      this.canvas.style.cursor = nextId ? "pointer" : "grab";
      if (this.app) this.app.renderNextFrame = true;
    }
  }

  async flushHotspotHoverPick() {
    if (this.hotspotHoverPickPending) return;
    this.hotspotHoverPickPending = true;
    try {
      while (this.hotspotHoverPointer) {
        const pointer = this.hotspotHoverPointer;
        this.hotspotHoverPointer = null;
        const id = await this.queueHotspotPick(pointer.x, pointer.y);
        if (
          pointer.sequence === this.hotspotHoverSequence &&
          !this.hotspotHoverPointer
        ) {
          this.setHotspotHover(id);
        }
      }
    } finally {
      this.hotspotHoverPickPending = false;
    }
  }

  bindHotspotMarkerInteraction() {
    if (!this.canvas) return;
    const onPointerDown = (event) => {
      if (event.button !== 0) return;
      this.hotspotPointerStart = {
        x: event.clientX,
        y: event.clientY,
        id: this.hotspotHoveredId || "",
      };
    };
    const onPointerMove = (event) => {
      this.hotspotHoverSequence += 1;
      this.hotspotHoverPointer = {
        x: event.clientX,
        y: event.clientY,
        sequence: this.hotspotHoverSequence,
      };
      void this.flushHotspotHoverPick();
    };
    const onPointerUp = async (event) => {
      const start = this.hotspotPointerStart;
      this.hotspotPointerStart = null;
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 7) return;
      const id =
        start.id && start.id === this.hotspotHoveredId
          ? start.id
          : await this.queueHotspotPick(event.clientX, event.clientY);
      if (!id) return;
      this.container?.dispatchEvent?.(new CustomEvent("sog-hotspot-activate", { detail: { id } }));
    };
    const onPointerLeave = () => {
      this.hotspotHoverSequence += 1;
      this.hotspotHoverPointer = null;
      this.hotspotPointerStart = null;
      this.setHotspotHover("");
    };
    this.canvas.addEventListener("pointerdown", onPointerDown);
    this.canvas.addEventListener("pointermove", onPointerMove);
    this.canvas.addEventListener("pointerup", onPointerUp);
    this.canvas.addEventListener("pointercancel", onPointerLeave);
    this.canvas.addEventListener("pointerleave", onPointerLeave);
    const canvas = this.canvas;
    this.hotspotInteractionDisposeFns.push(() => canvas.removeEventListener("pointerdown", onPointerDown));
    this.hotspotInteractionDisposeFns.push(() => canvas.removeEventListener("pointermove", onPointerMove));
    this.hotspotInteractionDisposeFns.push(() => canvas.removeEventListener("pointerup", onPointerUp));
    this.hotspotInteractionDisposeFns.push(() => canvas.removeEventListener("pointercancel", onPointerLeave));
    this.hotspotInteractionDisposeFns.push(() => canvas.removeEventListener("pointerleave", onPointerLeave));
  }

  syncHotspotMarkerEntities(deltaSeconds = 0) {
    if (!this.pc || !this.app || !this.camera?.camera) return;
    if (!this.ensureHotspotOverlayRenderer()) return;
    this.syncHotspotOverlayCamera();
    const canvasHeight = Math.max(1, this.canvas?.offsetHeight || this.container?.clientHeight || 720);

    const activeIds = new Set(this.hotspotMarkerData.map((hotspot) => hotspot.id));
    for (const [id, entity] of this.hotspotMarkerEntities.entries()) {
      if (!activeIds.has(id)) {
        entity.destroy();
        this.hotspotMarkerEntities.delete(id);
        this.hotspotSurfaceAnchors.delete(id);
      }
    }

    const time = performance.now() * 0.001;
    const fovRadians = ((this.camera.camera.fov || 60) * Math.PI) / 180;
    const cameraUp = this.camera
      .getRotation()
      .transformVector(new this.pc.Vec3(0, 1, 0))
      .normalize();
    const liftAlpha = deltaSeconds > 0
      ? 1 - Math.exp(-(deltaSeconds * 1000) / HOTSPOT_HOVER_LIFT_DECAY_MS)
      : 1;

    for (const hotspot of this.hotspotMarkerData) {
      if (!hotspot.id || !hotspot.position.every(Number.isFinite)) continue;
      let entity = this.hotspotMarkerEntities.get(hotspot.id);
      if (!entity) {
        entity = this.createHotspotMarkerEntity(hotspot.id);
        if (entity) this.hotspotMarkerEntities.set(hotspot.id, entity);
      }
      if (!entity) continue;

      const world = this.resolveHotspotWorldPoint(hotspot);
      const occluded = this.isHotspotOccluded(world, entity, time * 1000);
      const hovered = hotspot.id === this.hotspotHoveredId;
      const basePixels = hotspot.selected ? 56 : 50;
      const distance = Math.max(0.1, world.distance(this.camera.getPosition()));
      const worldPerPixel = (2 * distance * Math.tan(fovRadians * 0.5)) / canvasHeight;
      const worldSize = worldPerPixel * basePixels;
      const targetLift = hovered ? 1 : 0;
      const currentLift = Number(entity._huaHotspotHoverLift || 0);
      const nextLift = currentLift + (targetLift - currentLift) * liftAlpha;
      entity._huaHotspotHoverLift = Math.abs(targetLift - nextLift) < 0.001
        ? targetLift
        : nextLift;
      const renderPosition = world.clone().add(
        cameraUp.clone().mulScalar(
          worldPerPixel * HOTSPOT_HOVER_LIFT_PIXELS * entity._huaHotspotHoverLift
        )
      );
      const pulseProgress = (time * 0.62) % 1;
      const pulseScale = 1.12 + pulseProgress * 0.48;

      entity.setPosition(renderPosition);
      entity.lookAt(this.camera.getPosition());
      entity.setLocalScale(worldSize, worldSize, worldSize);
      entity._huaHotspotVisual?.pulse?.setLocalScale(pulseScale, pulseScale, pulseScale);
      entity.enabled = this.hotspotMarkerVisible && !occluded;
      if (occluded && hovered) {
        this.setHotspotHover("");
      }
    }

    if (this.hotspotMaterials?.pulse) {
      const pulseProgress = (time * 0.62) % 1;
      this.hotspotMaterials.pulse.opacity = (1 - pulseProgress) * 0.55;
      this.hotspotMaterials.pulse.update();
    }
  }

  focusWorldPoint(position, options = {}) {
    if (!this.pc || !this.goalOrbitState) {
      return false;
    }

    const values = Array.isArray(position)
      ? position
      : [position?.x, position?.y, position?.z];
    const [x, y, z] = values.map(Number);
    if (![x, y, z].every(Number.isFinite)) {
      return false;
    }

    this.stopFirstPersonNavigation();
    this.ensureOrbitController(this.currentAsset?.viewPreset);
    const localTarget = new this.pc.Vec3(x, y, z);
    const target = options.coordinateSpace === "world"
      ? localTarget
      : this.transformScenePointToWorld(this.pc, localTarget);
    const currentDistance = this.orbitState?.distance || this.goalOrbitState.distance || 8;
    this.goalOrbitState.target.copy(target);
    this.goalOrbitState.distance = Math.max(
      0.85,
      Math.min(currentDistance * (options.distanceMultiplier ?? 0.42), options.maxDistance ?? 14)
    );
    if (this.app) this.app.renderNextFrame = true;
    return true;
  }

  setEditorAxesVisible(visible) {
    this.editorAxesVisible = visible === true;
    if (this.app) this.app.renderNextFrame = true;
  }

  drawEditorGuides(pc) {
    if ((!this.editorGuidesVisible && !this.editorAxesVisible) || !this.app?.drawLine) return;
    this.app.renderNextFrame = true;
    const size = 24;
    const step = 2;
    const gridColor = new pc.Color(0.16, 0.72, 0.7, 0.32);
    const xAxisColor = new pc.Color(1, 0.28, 0.28, 0.9);
    const yAxisColor = new pc.Color(0.35, 1, 0.42, 0.9);
    const zAxisColor = new pc.Color(0.35, 0.58, 1, 0.9);
    if (this.editorGuidesVisible) {
      for (let value = -size; value <= size; value += step) {
        this.app.drawLine(new pc.Vec3(-size, 0, value), new pc.Vec3(size, 0, value), gridColor);
        this.app.drawLine(new pc.Vec3(value, 0, -size), new pc.Vec3(value, 0, size), gridColor);
      }
    }
    if (this.editorAxesVisible) {
      this.app.drawLine(new pc.Vec3(-size, 0, 0), new pc.Vec3(size, 0, 0), xAxisColor);
      this.app.drawLine(new pc.Vec3(0, -size * 0.25, 0), new pc.Vec3(0, size * 0.25, 0), yAxisColor);
      this.app.drawLine(new pc.Vec3(0, 0, -size), new pc.Vec3(0, 0, size), zAxisColor);
    }
  }

  captureCurrentCameraTransform() {
    if (!this.camera) return null;
    const position = this.camera.getPosition();
    const rotation = this.camera.getEulerAngles();
    return {
      position: [position.x, position.y, position.z],
      rotationDegrees: [rotation.x, rotation.y, rotation.z],
      scale: [1, 1, 1],
    };
  }

  getCameraStartTransform() {
    return this.cameraStartTransform ? {
      position: [...this.cameraStartTransform.position],
      rotationDegrees: [...this.cameraStartTransform.rotationDegrees],
      scale: [1, 1, 1],
    } : null;
  }

  setCameraStartTransform(transform) {
    if (!transform) return;
    this.cameraStartTransform = {
      position: [...(transform.position || [0, 0, 0])],
      rotationDegrees: [...(transform.rotationDegrees || [0, 0, 0])],
      scale: [1, 1, 1],
    };
    this._updateCameraStartMarker();
    if (this.app) this.app.renderNextFrame = true;
  }

  _ensureCameraStartMarker() {
    if (this._cameraStartMarkerEntity || !this.pc || !this.app) return;
    const pc = this.pc;
    const marker = new pc.Entity("CameraStartMarker");
    marker.addComponent("render", { type: "sphere" });
    const material = new pc.StandardMaterial();
    material.useLighting = false;
    material.emissive = new pc.Color(0.25, 0.75, 1.0);
    material.opacity = 0.9;
    material.blendType = pc.BLEND_NORMAL;
    material.depthTest = false;
    material.depthWrite = false;
    material.update();
    for (const meshInstance of marker.render.meshInstances || []) {
      meshInstance.material = material;
      meshInstance.drawOrder = 1e6;
    }
    marker.setLocalScale(0.3, 0.3, 0.3);
    this.app.root.addChild(marker);
    this._cameraStartMarkerEntity = marker;
    this._updateCameraStartMarker();
  }

  _updateCameraStartMarker() {
    if (!this._cameraStartMarkerEntity || !this.cameraStartTransform) return;
    this._cameraStartMarkerEntity.setPosition(...this.cameraStartTransform.position);
  }

  setCameraStartMarkerVisible(visible) {
    this.cameraStartMarkerVisible = visible === true;
    if (this.cameraStartMarkerVisible) {
      if (!this.cameraStartTransform) this.cameraStartTransform = this.captureCurrentCameraTransform();
      this._ensureCameraStartMarker();
    }
    if (this._cameraStartMarkerEntity) this._cameraStartMarkerEntity.enabled = this.cameraStartMarkerVisible;
    if (this.app) this.app.renderNextFrame = true;
  }

  drawCameraStartMarker(pc) {
    if (!this.cameraStartMarkerVisible || !this.cameraStartTransform || !this.app?.drawLine) return;
    this.app.renderNextFrame = true;
    const origin = new pc.Vec3(...this.cameraStartTransform.position);
    const rotation = this.createStandardEulerQuaternion(pc, this.cameraStartTransform.rotationDegrees);
    const forward = rotation.transformVector(new pc.Vec3(0, 0, -1)).normalize();
    const tip = origin.clone().add(forward.clone().mulScalar(2));
    const color = new pc.Color(0.25, 0.75, 1.0, 1);
    this.app.drawLine(origin, tip, color);
    const side = new pc.Vec3(-forward.z, 0, forward.x).normalize().mulScalar(0.3);
    const back = forward.clone().mulScalar(-0.35);
    this.app.drawLine(tip, tip.clone().add(back).add(side), color);
    this.app.drawLine(tip, tip.clone().add(back).sub(side), color);
  }

  setManualBoxPreviewVisible(visible) {
    this.manualBoxPreviewVisible = visible === true;
    if (!this.manualBoxPreviewVisible) this._hideManualBoxLabels();
    if (this.app) this.app.renderNextFrame = true;
  }

  _ensureManualBoxLabels() {
    if (this._manualBoxLabels.length || !this.container) return;
    for (const name of ["Left", "Right", "Top", "Bottom", "Front", "Back"]) {
      const label = document.createElement("div");
      label.className = "calibration-box-label";
      label.textContent = name;
      label.hidden = true;
      this.container.appendChild(label);
      this._manualBoxLabels.push(label);
    }
  }

  _hideManualBoxLabels() {
    for (const label of this._manualBoxLabels) label.hidden = true;
  }

  drawManualBoxPreview(pc) {
    const config = this.activeManualBoxConfig;
    if (!this.manualBoxPreviewVisible || !config || !this.app?.drawLine) {
      this._hideManualBoxLabels();
      return;
    }
    this.app.renderNextFrame = true;
    const matrix = this.createBoxWorldMatrix(pc, config);
    const units = [
      [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5],
      [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5],
    ];
    const corners = units.map((value) => matrix.transformPoint(new pc.Vec3(...value)));
    const edges = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
    const color = new pc.Color(0.65, 1.0, 0.08, 1);
    for (const [a, b] of edges) this.app.drawLine(corners[a], corners[b], color);

    this._ensureManualBoxLabels();
    const faces = [[-0.5, 0, 0], [0.5, 0, 0], [0, 0.5, 0], [0, -0.5, 0], [0, 0, 0.5], [0, 0, -0.5]];
    faces.forEach((face, index) => {
      const world = matrix.transformPoint(new pc.Vec3(...face));
      const screen = this.worldToContainerPoint(world);
      const label = this._manualBoxLabels[index];
      if (!screen || !screen.visible) {
        label.hidden = true;
        return;
      }
      label.hidden = false;
      label.style.left = `${screen.x}px`;
      label.style.top = `${screen.y}px`;
    });
  }

  // ===========================================================================
  // SPAWN POINT EDITOR
  // ===========================================================================

  // Look direction from yaw/pitch (matches fpNavigation.forwardFromAngles).
  _forwardFromAngles(yawDeg, pitchDeg) {
    const yaw = (yawDeg * Math.PI) / 180;
    const pitch = (pitchDeg * Math.PI) / 180;
    return {
      x: -Math.cos(pitch) * Math.sin(yaw),
      y: -Math.sin(pitch),
      z: -Math.cos(pitch) * Math.cos(yaw),
    };
  }

  // Initialise spawn config from the asset's fpViewPreset (cameraPosition + target).
  initSpawnConfig(asset = this.currentAsset) {
    // Prefer a saved spawn override (from localStorage via applyCalibrationOverrideToAsset)
    if (asset?.spawnOverride?.position) {
      const [x, y, z] = asset.spawnOverride.position;
      const pitch = asset.spawnOverride.rotationDegrees?.[0] ?? 0;
      const yaw = asset.spawnOverride.rotationDegrees?.[1] ?? 0;
      const fov = asset?.fpViewPreset?.fov ?? 90;
      this.spawnEditConfig = { cameraPosition: [x, y, z], yaw, pitch, fov };
      return this.spawnEditConfig;
    }

    const preset = asset?.resolvedFpViewPreset || asset?.fpViewPreset || asset?.viewPreset || {};
    const cameraPosition = [...(preset.cameraPosition || [0, 1.6, 0])];
    const target = preset.target || [cameraPosition[0], cameraPosition[1], cameraPosition[2] - 1];
    const fov = Number.isFinite(preset.fov) ? preset.fov : 90;

    const dx = target[0] - cameraPosition[0];
    const dy = target[1] - cameraPosition[1];
    const dz = target[2] - cameraPosition[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    const ny = dy / len;
    const pitch = -Math.asin(Math.max(-1, Math.min(1, ny))) * 180 / Math.PI;
    const yaw = Math.atan2(-dx, -dz) * 180 / Math.PI;

    this.spawnEditConfig = { cameraPosition, yaw, pitch, fov };
    return this.spawnEditConfig;
  }

  // Expose to the panel as position + rotationDegrees ([pitch, yaw, 0]).
  getSpawnConfig() {
    if (!this.spawnEditConfig) this.initSpawnConfig();
    const c = this.spawnEditConfig;
    return {
      position: [...c.cameraPosition],
      rotationDegrees: [c.pitch, c.yaw, 0],
      scale: [1, 1, 1],
    };
  }

  setSpawnConfig(transform) {
    if (!transform) return;
    if (!this.spawnEditConfig) this.initSpawnConfig();
    if (transform.position) {
      this.spawnEditConfig.cameraPosition = [...transform.position];
    }
    if (transform.rotationDegrees) {
      this.spawnEditConfig.pitch = transform.rotationDegrees[0] || 0;
      this.spawnEditConfig.yaw = transform.rotationDegrees[1] || 0;
    }
    this._updateSpawnMarker();
    if (this.app) this.app.renderNextFrame = true;
  }

  _ensureSpawnMarker() {
    if (this._spawnMarkerEntity || !this.pc || !this.app) return;
    const pc = this.pc;
    const marker = new pc.Entity("SpawnMarker");
    marker.addComponent("render", { type: "sphere" });
    const mat = new pc.StandardMaterial();
    mat.useLighting = false;
    mat.diffuse = new pc.Color(0, 0, 0);
    mat.emissive = new pc.Color(1.0, 0.55, 0.1); // orange
    mat.opacity = 0.85;
    mat.blendType = pc.BLEND_NORMAL;
    mat.depthTest = false;
    mat.depthWrite = false;
    mat.update();
    for (const mi of marker.render.meshInstances || []) {
      mi.material = mat;
      mi.drawOrder = 1e6;
    }
    marker.setLocalScale(0.3, 0.3, 0.3);
    this.app.root.addChild(marker);
    this._spawnMarkerEntity = marker;
    this._updateSpawnMarker();
  }

  _updateSpawnMarker() {
    if (!this._spawnMarkerEntity || !this.spawnEditConfig) return;
    const [x, y, z] = this.spawnEditConfig.cameraPosition;
    this._spawnMarkerEntity.setLocalPosition(x, y, z);
  }

  setSpawnMarkerVisible(visible) {
    this.spawnMarkerVisible = visible === true;
    if (this.spawnMarkerVisible) {
      if (!this.spawnEditConfig) this.initSpawnConfig();
      this._ensureSpawnMarker();
    }
    if (this._spawnMarkerEntity) {
      this._spawnMarkerEntity.enabled = this.spawnMarkerVisible;
    }
    if (this.app) this.app.renderNextFrame = true;
  }

  // Draw the look-direction arrow each frame when the marker is visible.
  drawSpawnMarker(pc) {
    if (!this.spawnMarkerVisible || !this.app?.drawLine || !this.spawnEditConfig) return;
    const c = this.spawnEditConfig;
    const origin = new pc.Vec3(c.cameraPosition[0], c.cameraPosition[1], c.cameraPosition[2]);
    const fwd = this._forwardFromAngles(c.yaw, c.pitch);
    const length = 1.6;
    const tip = new pc.Vec3(
      origin.x + fwd.x * length,
      origin.y + fwd.y * length,
      origin.z + fwd.z * length
    );
    const dirColor = new pc.Color(1.0, 0.7, 0.15, 1);
    this.app.drawLine(origin, tip, dirColor);

    // Small arrowhead: two short lines back from the tip
    const back = { x: -fwd.x, y: -fwd.y, z: -fwd.z };
    const side = { x: -fwd.z, y: 0, z: fwd.x }; // perpendicular on XZ
    const sideLen = Math.hypot(side.x, side.z) || 1;
    side.x /= sideLen; side.z /= sideLen;
    const headLen = 0.28;
    this.app.drawLine(tip, new pc.Vec3(
      tip.x + (back.x + side.x) * headLen,
      tip.y + back.y * headLen,
      tip.z + (back.z + side.z) * headLen
    ), dirColor);
    this.app.drawLine(tip, new pc.Vec3(
      tip.x + (back.x - side.x) * headLen,
      tip.y + back.y * headLen,
      tip.z + (back.z - side.z) * headLen
    ), dirColor);
  }

  // Teleport the player to the current spawn config (used by Reset while in FP).
  applySpawnToPlayer() {
    if (!this.firstPersonActive || !this.fpNavigationController || !this.pc || !this.spawnEditConfig) {
      return false;
    }
    const c = this.spawnEditConfig;
    const orbitState = {
      target: new this.pc.Vec3(c.cameraPosition[0], c.cameraPosition[1], c.cameraPosition[2]),
      distance: 0.001,
      yaw: c.yaw,
      pitch: c.pitch,
    };
    if (this.camera?.camera && Number.isFinite(c.fov)) {
      this.camera.camera.fov = c.fov;
    }
    this.fpNavigationController.setPreservePresetSpawn(true);
    this.fpNavigationController.enterFromOrbitState(orbitState, c.fov ?? 90);
    if (this.app) this.app.renderNextFrame = true;
    return true;
  }

  ensureOrbitController(viewPreset = this.currentAsset?.viewPreset) {
    if (!this.canvas || !this.goalOrbitState) {
      return null;
    }

    if (!this.orbitController) {
      this.orbitController = new SimpleOrbitController(this.canvas, {
        getFieldOfView: () => this.camera?.camera?.fov ?? viewPreset?.fov ?? 60,
        onUserInteraction: () => {
          if (!this.autoRotate) {
            return;
          }
          this.stopAutoRotate();
          this.container?.dispatchEvent?.(
            new CustomEvent("sog-user-interaction", {
              detail: { mode: "orbit" },
            })
          );
        },
        onChange: () => {
          if (this.app) {
            this.app.renderNextFrame = true;
          }
        },
        onPanStateChange: (visible) => {
          this.setPanIndicatorVisible(visible);
        },
      });
    }

    this.orbitController.setDistanceLimits({
      maxDistance: this.currentAsset?.maxOrbitDistance,
    });
    this.orbitController.bind(this.goalOrbitState);
    return this.orbitController;
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
        onTouchTap: (tap) => this.handleFirstPersonTap(tap),
        walk: {
          fov: this.camera?.camera?.fov ?? 90,
        },
        fly: {
          fov: this.camera?.camera?.fov ?? 90,
        },
      });
    } else {
      this.fpNavigationController.setCollision(this.fpCollision);
      this.fpNavigationController.setFlyCollisionIgnored(this.flyCollisionIgnored);
      this.fpNavigationController.setPreservePresetSpawn(!!this.currentAsset?.fpViewPreset?.cameraPosition);
      this.fpNavigationController.setMode(this.fpNavigationMode);
    }

    return this.fpNavigationController;
  }

  handleFirstPersonTap(tap) {
    if (
      !this.firstPersonActive ||
      !this.currentAsset?.streamingEnabled ||
      !this.fpCollision ||
      !this.fpNavigationController ||
      !this.camera?.camera ||
      !this.canvas ||
      !this.pc
    ) {
      return false;
    }

    const rect = this.canvas.getBoundingClientRect();
    const offsetX = tap.clientX - rect.left;
    const offsetY = tap.clientY - rect.top;
    if (offsetX < 0 || offsetY < 0 || offsetX > rect.width || offsetY > rect.height) {
      return false;
    }
    const screenX = offsetX * (this.canvas.clientWidth / Math.max(rect.width, 1));
    const screenY = offsetY * (this.canvas.clientHeight / Math.max(rect.height, 1));

    const origin = this.camera.getPosition();
    const worldPoint = this.camera.camera.screenToWorld(screenX, screenY, 1, new this.pc.Vec3());
    const direction = worldPoint.sub(origin).normalize();
    const hit = this.fpCollision.queryRay(
      origin.x,
      origin.y,
      origin.z,
      direction.x,
      direction.y,
      direction.z,
      60
    );
    if (!hit || hit.ny < 0.45) {
      return false;
    }

    return this.fpNavigationController.navigateToFloor(hit);
  }

  startFirstPersonNavigation(pc) {
    if (!this.currentAsset?.streamingEnabled || !this.camera) {
      return;
    }

    if (this.orbitController) {
      this.orbitController.dispose();
      this.orbitController = null;
    }

    const controller = this.ensureFirstPersonNavigation(pc);
    if (!controller) {
      return;
    }

    const fpViewPreset =
      this.currentAsset?.resolvedFpViewPreset ||
      this.currentAsset?.fpViewPreset ||
      this.currentAsset?.viewPreset;
    if (fpViewPreset?.fov && this.camera?.camera) {
      this.camera.camera.fov = fpViewPreset.fov;
    }

    // Only treat persisted/calibrated camera data as an explicit spawn. For an
    // outdoor streamed scene without one, preserve the camera pose from which
    // the user entered Streamed mode instead of teleporting to [0, 1.6, 0].
    const hasExplicitSpawn = !!(
      this.currentAsset?.spawnOverride?.position ||
      this.currentAsset?.resolvedFpViewPreset?.cameraPosition ||
      this.currentAsset?.fpViewPreset?.cameraPosition
    );
    if (hasExplicitSpawn && !this.spawnEditConfig) {
      this.initSpawnConfig();
    }
    if (hasExplicitSpawn && this.spawnEditConfig) {
      const c = this.spawnEditConfig;
      const spawnOrbitState = {
        target: new pc.Vec3(c.cameraPosition[0], c.cameraPosition[1], c.cameraPosition[2]),
        distance: 0.001,
        yaw: c.yaw,
        pitch: c.pitch,
      };
      if (this.camera?.camera && Number.isFinite(c.fov)) {
        this.camera.camera.fov = c.fov;
      }
      controller.setPreservePresetSpawn(true);
      controller.enterFromOrbitState(spawnOrbitState, c.fov ?? 90);
    } else {
      controller.enterFromOrbitState(this.orbitState || this.goalOrbitState, this.camera.camera?.fov ?? 90);
    }
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

  async prepareFirstPersonAsset(asset, onState, generation = this.loadGeneration) {
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
        position: asset.collisionPosition || asset.position,
        rotation: asset.collisionRotation || asset.rotation,
        scale: asset.collisionScale || asset.scale,
      });
      if (!this.isLoadCurrent(generation)) return asset;
      this.fpCollision = collision;
      this.hotspotOcclusionCollision = collision;
      this.hotspotOcclusionSource = collision ? asset.fpCollisionSource : "";
      this.invalidateHotspotOcclusionCache();
      if (!collision) {
        return asset;
      }

      if (asset.fpViewPreset?.cameraPosition) {
        return asset;
      }

      return {
        ...asset,
        resolvedFpViewPreset: buildCollisionAdjustedViewPreset(
          collision,
          asset.fpViewPreset || asset.viewPreset || {},
          asset.manualBox?.position || [0, 0, 0]
        ),
      };
    } catch (error) {
      logger.warn("sog-loader", "First-person collision preparation failed", {
        source: asset.fpCollisionSource,
        scene_source: asset.src,
      }, error);
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
      cutDepthLockedByFace: config.cutDepthLockedByFace ? { ...config.cutDepthLockedByFace } : undefined,
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
    return new pc.Mat4().mul2(this.getManualBoxParentWorldMatrix(pc), localBoxMatrix);
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

  isCameraOutsideBox(cameraPositionInBoxSpace) {
    if (!cameraPositionInBoxSpace) {
      return false;
    }

    // Auto cutaway has a meaningful "camera side" only outside the box.
    return Math.max(
      Math.abs(cameraPositionInBoxSpace.x),
      Math.abs(cameraPositionInBoxSpace.y),
      Math.abs(cameraPositionInBoxSpace.z)
    ) > 0.5 + 0.001;
  }

  shouldApplyCutaway() {
    if (!this.cutawayEnabled) {
      return false;
    }

    return !this.currentAsset?.streamingEnabled;
  }

  getEffectiveCutawayBoxConfig(pc, boxConfig = this.activeManualBoxConfig) {
    if (!boxConfig) {
      return null;
    }

    if (!this.shouldApplyCutaway()) {
      return boxConfig;
    }

    const cameraPositionInBoxSpace = this.getCameraPositionInBoxSpace(pc, boxConfig);
    if (!this.isCameraOutsideBox(cameraPositionInBoxSpace)) {
      // Preserve the calibrated bounding box, but do not invent a cut face
      // from an inside-camera position (for example immediately after FP).
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

    if (!this.activeManualBoxConfig || !this.shouldApplyCutaway()) {
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
    if (this.streamingReadyState) {
      for (const cleanup of this.streamingReadyState.cleanupFns || []) {
        try {
          cleanup();
        } catch (_error) {}
      }
      if (this.streamingReadyState.timeoutId) clearTimeout(this.streamingReadyState.timeoutId);
      if (this.streamingReadyState.warningId) clearTimeout(this.streamingReadyState.warningId);
    }
    this.streamingReadyState = null;
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

  waitForStreamingInitialReady(asset, generation, onState) {
    if (!asset?.streamingEnabled || !this.app || !this.app.systems?.gsplat) {
      return Promise.resolve();
    }

    const app = this.app;
    const state = {
      assetKey: asset.key || asset.src || "",
      startedAt: (typeof performance !== "undefined" ? performance.now() : Date.now()),
      settled: false,
      sawReadyFrame: false,
      sawPostRender: false,
      readyFrameCount: 0,
      lastLoadingCount: null,
      bestLoadingCount: null,
      cleanupFns: [],
      timeoutId: null,
      warningId: null,
    };
    this.streamingReadyState = state;

    onState?.({
      status: "loading",
      title: "Preparing streamed LOD",
      message: "The streamed model is still preparing. Please wait...",
      progress: 0.72,
      details: {
        source: asset.src,
        lod_range_min: this.streamingState?.targetLodRangeMin ?? null,
        lod_range_max: this.streamingState?.targetLodRangeMax ?? null,
      },
    });

    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        state.settled = true;
        for (const fn of state.cleanupFns.splice(0)) {
          try {
            fn();
          } catch (_error) {}
        }
        if (state.timeoutId) clearTimeout(state.timeoutId);
        if (state.warningId) clearTimeout(state.warningId);
        if (this.streamingReadyState === state) {
          this.streamingReadyState = null;
        }
      };

      const finish = () => {
        if (settled || !this.isLoadCurrent(generation) || this.app !== app) {
          return;
        }
        settled = true;
        cleanup();
        onState?.({
          status: "loading",
          title: "Finalizing first view",
          message: "Finalizing the first streamed view...",
          progress: 0.92,
          details: {
            frame_ready: true,
            postrender_seen: true,
            loading_count: state.lastLoadingCount,
          },
        });
        resolve();
      };

      const fail = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      const getElapsedMs = () =>
        (typeof performance !== "undefined" ? performance.now() : Date.now()) - state.startedAt;

      const isInitialViewSafe = () => {
        if (!state.sawReadyFrame || !state.sawPostRender) {
          return false;
        }

        if (!Number.isFinite(state.lastLoadingCount) || state.lastLoadingCount === 0) {
          return true;
        }

        return (
          state.lastLoadingCount <= STREAMING_SAFE_REMAINING_LOADS &&
          state.readyFrameCount >= STREAMING_SAFE_READY_FRAMES &&
          getElapsedMs() >= STREAMING_MIN_READY_MS
        );
      };

      const maybeFinish = () => {
        if (isInitialViewSafe()) {
          finish();
        }
      };

      const onFrameReady = (_camera, _layer, ready, loadingCount) => {
        if (!this.isLoadCurrent(generation) || this.app !== app) {
          return;
        }

        state.lastLoadingCount = Number.isFinite(loadingCount) ? loadingCount : null;
        if (Number.isFinite(loadingCount)) {
          state.bestLoadingCount = Number.isFinite(state.bestLoadingCount)
            ? Math.min(state.bestLoadingCount, loadingCount)
            : loadingCount;
        }
        if (Number.isFinite(loadingCount) && loadingCount > 0) {
          onState?.({
            status: "loading",
            title: "Preparing streamed LOD",
            message: `Loading streamed tiles (${loadingCount} remaining)...`,
            progress: 0.76,
            details: {
              loading_count: loadingCount,
              lod_range_min: this.streamingState?.lodRangeMin ?? null,
              lod_range_max: this.streamingState?.lodRangeMax ?? null,
            },
          });
        }

        if (ready) {
          state.sawReadyFrame = true;
          state.readyFrameCount += 1;
          app.renderNextFrame = true;
          maybeFinish();
        }
      };

      const onPostRender = () => {
        if (!this.isLoadCurrent(generation) || this.app !== app) {
          return;
        }
        state.sawPostRender = true;
        maybeFinish();
      };

      app.systems.gsplat.on("frame:ready", onFrameReady);
      app.on("postrender", onPostRender);
      state.cleanupFns.push(() => app.systems.gsplat.off("frame:ready", onFrameReady));
      state.cleanupFns.push(() => app.off("postrender", onPostRender));

      state.warningId = setTimeout(() => {
        if (
          settled ||
          state.settled ||
          this.streamingReadyState !== state ||
          !this.isLoadCurrent(generation) ||
          this.app !== app ||
          (this.currentAsset?.key || this.currentAsset?.src || "") !== state.assetKey
        ) {
          return;
        }
        const details = {
          source: asset.src,
          loading_count: state.lastLoadingCount,
          best_loading_count: state.bestLoadingCount,
          ready_frames: state.readyFrameCount,
          safe_remaining_loads: STREAMING_SAFE_REMAINING_LOADS,
          lod_range_min: this.streamingState?.lodRangeMin ?? null,
          lod_range_max: this.streamingState?.lodRangeMax ?? null,
        };
        logger.warn("sog-loader", "Streamed initial LOD is still preparing", details);
        onState?.({
          status: "warning",
          code: "streaming-initial-lod-stalled",
          title: "Preparing streamed LOD",
          message: "The streamed model is still preparing. Please wait...",
          details,
        });
      }, STREAMING_STALL_WARNING_MS);

      state.timeoutId = setTimeout(() => {
        if (
          settled ||
          state.settled ||
          this.streamingReadyState !== state ||
          !this.isLoadCurrent(generation) ||
          this.app !== app ||
          (this.currentAsset?.key || this.currentAsset?.src || "") !== state.assetKey
        ) {
          return;
        }
        const error = new Error("Timed out while preparing the initial streamed LOD view.");
        error.details = {
          source: asset.src,
          loading_count: state.lastLoadingCount,
          best_loading_count: state.bestLoadingCount,
          ready_frames: state.readyFrameCount,
          safe_remaining_loads: STREAMING_SAFE_REMAINING_LOADS,
          frame_ready: state.sawReadyFrame,
          postrender_seen: state.sawPostRender,
        };
        fail(error);
      }, STREAMING_READY_TIMEOUT_MS);

      app.renderNextFrame = true;
    });
  }

  loadGsplatAsset(pc, app, asset, generation, onState) {
    const splatAsset = new pc.Asset(asset.label || "Scene", "gsplat", {
      url: asset.src,
    });

    const loadPromise = new Promise((resolve, reject) => {
      splatAsset.on("progress", (received, total) => {
        if (!total || !this.isLoadCurrent(generation)) {
          return;
        }

        onState?.({
          status: "loading",
          title: asset.streamingEnabled ? "Loading scene metadata" : "Loading SOG",
          message: asset.streamingEnabled
            ? `Loading streamed metadata (${Math.round((received / total) * 100)}%)`
            : `${asset.label || "SOG scene"} loading (${Math.round((received / total) * 100)}%)`,
          received,
          total,
          details: {
            source: asset.src,
            streamed: !!asset.streamingEnabled,
          },
        });
      });
      splatAsset.on("load", () => resolve(splatAsset));
      splatAsset.on("error", (error) => {
        const detail = getPlayCanvasAssetErrorDetail(error);
        const loadError = new Error(`Failed to load SOG asset: ${asset.streamingEnabled ? "streamed scene data" : asset.src} (${detail})`);
        loadError.details = {
          source: asset.src,
          streamed: !!asset.streamingEnabled,
          detail,
        };
        reject(loadError);
      });
      app.assets.add(splatAsset);
      app.assets.load(splatAsset);
    });

    return withTimeout(
      loadPromise,
      ASSET_LOAD_TIMEOUT_MS,
      `Timed out while loading SOG asset: ${asset.streamingEnabled ? "streamed scene data" : asset.src}`,
      {
        source: asset.src,
        streamed: !!asset.streamingEnabled,
      }
    );
  }

  async load(asset, profile = { maxDpr: 1.05 }, onState) {
    if (this.app && this.pc && this.splatEntity && this.currentAsset?.key === asset.key) {
      const generation = ++this.loadGeneration;
      this.disposed = false;
      const app = this.app;
      this.stopFirstPersonNavigation();
      const splatAsset = await this.loadGsplatAsset(this.pc, app, asset, generation, onState);

      if (!this.isLoadCurrent(generation) || this.app !== app || !this.splatEntity) {
        app.assets.remove(splatAsset);
        splatAsset.unload();
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
        if (this.app !== app) return;
        try {
          oldEntity.destroy();
          if (oldAsset) {
            this.app.assets.remove(oldAsset);
            oldAsset.unload();
          }
        } catch (e) {
          logger.warn("sog-loader", "Previous SOG entity cleanup failed", {
            source: asset.src,
          }, e);
        }
      }, 200);

      this.currentAsset = asset;
      const r = splatEntity.getLocalEulerAngles();
      this.sceneTransform = {
        position: asset.position || [0, 0, 0],
        rotationDegrees: asset.rotationDegrees || [r.x, r.y, r.z],
        scale: asset.scale || [1, 1, 1],
      };
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
      void this.prepareHotspotOcclusionCollision(asset, generation);
      if (asset.streamingEnabled) {
        this.firstPersonTransitionPending = false;
        this.startFirstPersonNavigation(this.pc);
        await this.waitForStreamingInitialReady(asset, generation, onState);
      }
      
      this.app.renderNextFrame = true;
      return;
    }

    this.dispose();
    const generation = ++this.loadGeneration;
    this.disposed = false;

    if (!supportsPlayCanvasSogViewer()) {
      throw new Error("This browser or device cannot run the PlayCanvas SOG viewer.");
    }

    this.container.innerHTML = "";
    onState?.({
      status: "loading",
      title: "Loading SOG",
      message: `Fetching ${asset.src}`,
    });

    const pc = await withTimeout(
      import(PLAYCANVAS_CDN),
      VIEWER_INIT_TIMEOUT_MS,
      "Timed out while preparing the 3D viewer.",
      { source: PLAYCANVAS_CDN }
    );
    if (!this.isLoadCurrent(generation)) return;
    const canvas = document.createElement("canvas");
    canvas.className = "viewer-canvas playcanvas-sog-canvas";
    this.container.appendChild(canvas);
    this.canvas = canvas;
    this.bindHotspotMarkerInteraction();

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
    this.targetMaxDpr = profile.maxDpr || 1.05;
    this.updateMaxPixelRatio(Math.max(1, this.container.clientWidth || 800), Math.max(1, this.container.clientHeight || 600));
    canvas.tabIndex = 0;
    app.on("update", (deltaSeconds) => {
      if (this.cinematicCameraActive) {
        app.renderNextFrame = true;
      } else if (this.firstPersonActive && this.fpNavigationController && this.camera) {
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
      try {
        this.syncHotspotMarkerEntities(deltaSeconds);
        this.drawEditorGuides(pc);
        this.drawSpawnMarker(pc);
        this.drawCameraStartMarker(pc);
        this.drawManualBoxPreview(pc);
      } catch (error) {
        logger.error("ui", "Calibration overlay rendering failed", {
          source: "playcanvas-editor-guides",
        }, error);
        this.manualBoxPreviewVisible = false;
        this._hideManualBoxLabels();
      }
    });
    app.on("postrender", () => {
      this.container?.dispatchEvent?.(
        new CustomEvent("sog-camera-frame", {
          detail: {
            firstPerson: this.firstPersonActive,
          },
        })
      );
    });

    this.app = app;
    this.pc = pc;
    const preparedAsset = await this.prepareFirstPersonAsset(asset, (state) => {
      if (this.isLoadCurrent(generation)) onState?.(state);
    }, generation);
    if (!this.isLoadCurrent(generation) || this.app !== app) return;

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
      this.updateMaxPixelRatio(width, height);
      app.resizeCanvas(width, height);
      app.renderNextFrame = true;
    };

    this.resizeObserver = new ResizeObserver(onResize);
    this.resizeObserver.observe(this.container);
    onResize();

    const splatAsset = await this.loadGsplatAsset(pc, app, preparedAsset, generation, onState);

    if (!this.isLoadCurrent(generation) || this.app !== app) {
      app.assets.remove(splatAsset);
      splatAsset.unload();
      return;
    }

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

    const r = splatEntity.getLocalEulerAngles();
    this.sceneTransform = {
      position: preparedAsset.position || [0, 0, 0],
      rotationDegrees: preparedAsset.rotationDegrees || [r.x, r.y, r.z],
      scale: preparedAsset.scale || [1, 1, 1],
    };
    void this.prepareHotspotOcclusionCollision(preparedAsset, generation);

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
    if (preparedAsset.streamingEnabled) {
      this.loadCollisionPreview(preparedAsset, generation).catch((error) => {
        if (this.isLoadCurrent(generation)) {
          logger.warn("sog-loader", "Collision preview failed", {
            source: preparedAsset.fpCollisionSource,
            scene_source: preparedAsset.src,
          }, error);
        }
      });
    }

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
      this.ensureOrbitController(preparedAsset.viewPreset);
    }

    if (this.autoRotate && !preparedAsset.streamingEnabled) {
      this.startAutoRotate(pc);
    }

    if (preparedAsset.streamingEnabled) {
      await this.waitForStreamingInitialReady(preparedAsset, generation, onState);
    }

    if (this.isLoadCurrent(generation)) {
      onState?.({
        status: "ready",
        title: "SOG ready",
        message: `${preparedAsset.label || "SOG scene"} loaded successfully.`,
      });
    }
  }

  setManualBoxConfig(config) {
    this.activeManualBoxConfig = this.cloneManualBoxConfig(config);
    this.currentCutawayBoxConfig = null;

    if (this.app && this.splatEntity && this.pc) {
      this.syncCutawayState(this.pc, { immediate: true });
    }
  }

  getManualBoxConfig() {
    return this.cloneManualBoxConfig(this.activeManualBoxConfig);
  }

  setCutawayEnabled(enabled) {
    this.cutawayEnabled = !!enabled;
    if (this.app && this.splatEntity && this.pc) {
      this.syncCutawayState(this.pc, { immediate: true });
    }
  }

  getCutawayEnabled() {
    return this.cutawayEnabled;
  }

  setMaxDpr(maxDpr) {
    this.targetMaxDpr = maxDpr;
    if (!this.app || !this.app.graphicsDevice || !this.container) {
      return;
    }
    const width = Math.max(1, this.container.clientWidth || 800);
    const height = Math.max(1, this.container.clientHeight || 600);
    this.updateMaxPixelRatio(width, height);
    this.app.resizeCanvas(width, height);
    this.app.renderNextFrame = true;
  }

  resetView() {
    if (this.firstPersonActive && this.fpNavigationController && this.camera) {
      // Prefer respawning at the (possibly edited) spawn config so Reset doubles
      // as a "go to spawn point" / test button while calibrating.
      if (this.applySpawnToPlayer()) {
        return;
      }
      if (this.fpNavigationController.reset(this.camera) && this.app) {
        this.app.renderNextFrame = true;
      }
      return;
    }

    if (!this.pc || !this.defaultOrbitState || !this.goalOrbitState) {
      return;
    }

    // Keep the existing object identity: SimpleOrbitController binds directly
    // to this state, so replacing it leaves pointer input writing to a stale
    // object after cinematic camera ownership is released.
    this.goalOrbitState.target.copy(this.defaultOrbitState.target);
    this.goalOrbitState.distance = this.defaultOrbitState.distance;
    this.goalOrbitState.yaw = this.defaultOrbitState.yaw;
    this.goalOrbitState.pitch = this.defaultOrbitState.pitch;
    if (this.app) {
      this.app.renderNextFrame = true;
    }
  }

  dispose() {
    this.loadGeneration += 1;
    this.disposed = true;
    this.stopAutoRotate();
    this.stopFirstPersonNavigation();
    this.cinematicCameraActive = false;
    this.cinematicPreviousAutoRotate = false;
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
    this.hotspotOcclusionCollision = null;
    this.hotspotOcclusionSource = "";
    if (this._collisionRebuildTimer) {
      clearTimeout(this._collisionRebuildTimer);
      this._collisionRebuildTimer = null;
    }
    // Reset stored collision transform so the next scene seeds fresh
    this.collisionPreviewTransform = null;
    this.sceneTransform = null;
    if (this.collisionPreviewEntity) this.collisionPreviewEntity.destroy();
    this.collisionPreviewEntity = null;
    this.collisionPreviewLoadPromise = null;
    // Spawn marker cleanup
    if (this._spawnMarkerEntity) this._spawnMarkerEntity.destroy();
    this._spawnMarkerEntity = null;
    this.spawnMarkerVisible = false;
    this.spawnEditConfig = null;
    if (this._cameraStartMarkerEntity) this._cameraStartMarkerEntity.destroy();
    this._cameraStartMarkerEntity = null;
    this.cameraStartMarkerVisible = false;
    this.cameraStartTransform = null;
    for (const label of this._manualBoxLabels || []) label.remove();
    this._manualBoxLabels = [];
    this.manualBoxPreviewVisible = false;
    for (const disposeInteraction of this.hotspotInteractionDisposeFns.splice(0)) {
      try {
        disposeInteraction();
      } catch {}
    }
    this.hotspotPicker?.destroy?.();
    this.hotspotPicker = null;
    this.hotspotPickQueue = Promise.resolve("");
    this.hotspotHoverPickPending = false;
    this.hotspotHoverPointer = null;
    this.hotspotHoverSequence += 1;
    this.hotspotHoveredId = "";
    this.hotspotPointerStart = null;
    this.clearHotspotMarkers();
    this.hotspotOverlayCamera?.destroy?.();
    this.hotspotOverlayCamera = null;
    if (this.hotspotOverlayLayer && this.app?.scene?.layers) {
      this.app.scene.layers.remove(this.hotspotOverlayLayer);
    }
    this.hotspotOverlayLayer = null;
    for (const material of Object.values(this.hotspotMaterials || {})) {
      material?.destroy?.();
    }
    this.hotspotMaterials = null;
    for (const texture of this.hotspotTextures.splice(0)) {
      texture?.destroy?.();
    }
    this.hotspotSurfaceAnchors.clear();
    if (this.collisionPreviewAsset && this.app) {
      this.app.assets.remove(this.collisionPreviewAsset);
      this.collisionPreviewAsset.unload();
    }
    this.collisionPreviewAsset = null;
    this.cutawayModifierInstalled = false;
    this.cutawayEnabled = true;
    this.defaultOrbitState = null;
    this.streamingState = null;
    this.fpNavigationMode = "walk";
    this.flyCollisionIgnored = false;

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

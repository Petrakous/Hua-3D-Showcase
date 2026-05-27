import { computeAutoCutaway } from "./autoCutaway.js";

const PLAYCANVAS_CDN = "https://cdn.jsdelivr.net/npm/playcanvas/+esm";
const SOG_BOX_CULLING_MODIFIER = {
  glsl: `
uniform mat4 orientedClipBoxWorldToUnit;
uniform float orientedClipBoxEnabled;

void modifySplatCenter(inout vec3 center) {
}

void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
}

void modifySplatColor(vec3 center, inout vec4 color) {
  if (orientedClipBoxEnabled < 0.5) {
    return;
  }

  vec3 clipLocalPoint = (orientedClipBoxWorldToUnit * vec4(center, 1.0)).xyz;

  if (abs(clipLocalPoint.x) > 0.5 ||
      abs(clipLocalPoint.y) > 0.5 ||
      abs(clipLocalPoint.z) > 0.5) {
    color.a = 0.0;
  }
}
`,
  wgsl: `
uniform orientedClipBoxWorldToUnit: mat4x4f;
uniform orientedClipBoxEnabled: f32;

fn modifySplatCenter(center: ptr<function, vec3f>) {
}

fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
}

fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  if (uniform.orientedClipBoxEnabled < 0.5) {
    return;
  }

  let clipLocalPoint = (uniform.orientedClipBoxWorldToUnit * vec4f(center, 1.0)).xyz;

  if (abs(clipLocalPoint.x) > 0.5 ||
      abs(clipLocalPoint.y) > 0.5 ||
      abs(clipLocalPoint.z) > 0.5) {
    (*color).a = 0.0;
  }
}
`,
};

function supportsPlayCanvasSogViewer() {
  const canvas = document.createElement("canvas");
  return !!canvas.getContext("webgl2");
}

class SimpleOrbitController {
  constructor(canvas, onChange) {
    this.canvas = canvas;
    this.onChange = onChange;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.pinchDistance = 0;
    this.touchMode = null;
    this.disposeFns = [];
  }

  bind(state) {
    const pointerDown = (event) => {
      this.dragging = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.canvas.setPointerCapture?.(event.pointerId);
    };

    const pointerMove = (event) => {
      if (!this.dragging) {
        return;
      }

      const deltaX = event.clientX - this.lastX;
      const deltaY = event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;

      state.yaw -= deltaX * 0.25;
      state.pitch = Math.max(-85, Math.min(85, state.pitch - deltaY * 0.2));
      this.onChange();
    };

    const pointerUp = (event) => {
      this.dragging = false;
      this.canvas.releasePointerCapture?.(event.pointerId);
    };

    const wheel = (event) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 1.08 : 0.92;
      state.distance = Math.max(0.2, Math.min(200, state.distance * factor));
      this.onChange();
    };

    const touchStart = (event) => {
      if (event.touches.length === 1) {
        this.touchMode = "orbit";
        this.lastX = event.touches[0].clientX;
        this.lastY = event.touches[0].clientY;
      } else if (event.touches.length === 2) {
        this.touchMode = "pinch";
        this.pinchDistance = this.computeTouchDistance(event.touches);
      }
    };

    const touchMove = (event) => {
      if (this.touchMode === "orbit" && event.touches.length === 1) {
        const touch = event.touches[0];
        const deltaX = touch.clientX - this.lastX;
        const deltaY = touch.clientY - this.lastY;
        this.lastX = touch.clientX;
        this.lastY = touch.clientY;
        state.yaw -= deltaX * 0.25;
        state.pitch = Math.max(-85, Math.min(85, state.pitch - deltaY * 0.2));
        this.onChange();
      } else if (event.touches.length === 2) {
        const nextDistance = this.computeTouchDistance(event.touches);
        if (this.pinchDistance > 0) {
          const ratio = this.pinchDistance / Math.max(nextDistance, 1);
          state.distance = Math.max(0.2, Math.min(200, state.distance * ratio));
          this.onChange();
        }
        this.pinchDistance = nextDistance;
      }

      event.preventDefault();
    };

    const touchEnd = () => {
      this.touchMode = null;
      this.pinchDistance = 0;
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

    this.disposeFns.push(() => this.canvas.removeEventListener("pointerdown", pointerDown));
    this.disposeFns.push(() => this.canvas.removeEventListener("pointermove", pointerMove));
    this.disposeFns.push(() => this.canvas.removeEventListener("pointerup", pointerUp));
    this.disposeFns.push(() => this.canvas.removeEventListener("pointercancel", pointerUp));
    this.disposeFns.push(() => this.canvas.removeEventListener("wheel", wheel));
    this.disposeFns.push(() => this.canvas.removeEventListener("touchstart", touchStart));
    this.disposeFns.push(() => this.canvas.removeEventListener("touchmove", touchMove));
    this.disposeFns.push(() => this.canvas.removeEventListener("touchend", touchEnd));
    this.disposeFns.push(() => this.canvas.removeEventListener("touchcancel", touchEnd));
  }

  computeTouchDistance(touches) {
    const a = touches[0];
    const b = touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
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
    this.defaultOrbitState = null;
    this.autoRotate = false;
    this.autoRotateFrameId = 0;
    this.cutawayEnabled = true;
    this.activeManualBoxConfig = null;
    this.currentAsset = null;
    this.cutawayModifierInstalled = false;
  }

  transformPointToWorld(pc, entity, point) {
    const worldPoint = point?.clone?.() || new pc.Vec3(0, 0, 0);
    entity.getWorldTransform().transformPoint(worldPoint, worldPoint);
    return worldPoint;
  }

  resolveOrbitState(pc, asset, entity, localBoundsCenter, boundsRadius) {
    const viewPreset = asset.viewPreset || {};
    const target = viewPreset.target
      ? this.transformPointToWorld(pc, entity, new pc.Vec3(...viewPreset.target))
      : this.transformPointToWorld(pc, entity, localBoundsCenter);

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

    if (!enabled || !boxConfig) {
      gsplat.setParameter("orientedClipBoxEnabled", 0);
      return;
    }

    const worldToUnitBox = this.createBoxWorldMatrix(pc, boxConfig).invert();
    gsplat.setParameter("orientedClipBoxWorldToUnit", worldToUnitBox.data);
    gsplat.setParameter("orientedClipBoxEnabled", 1);
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

    return computeAutoCutaway(
      boxConfig,
      cameraPositionInBoxSpace,
      boxConfig.cutRatio ?? 0.2
    ).boxConfig;
  }

  syncCutawayState(pc) {
    const gsplat = this.splatEntity?.gsplat;
    if (!this.ensureCutawayModifier(gsplat)) {
      return;
    }

    if (!this.cutawayEnabled || !this.activeManualBoxConfig) {
      this.setCutawayParameters(pc, gsplat, null, false);
      if (this.app) {
        this.app.renderNextFrame = true;
      }
      return;
    }

    const boxConfig = this.getEffectiveCutawayBoxConfig(pc, this.activeManualBoxConfig);
    this.setCutawayParameters(pc, gsplat, boxConfig, true);
    if (this.app) {
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
    if (!pc || !this.app || !this.orbitState || this.autoRotateFrameId) {
      return;
    }

    this.autoRotate = true;
    const spin = () => {
      if (!this.orbitState || !this.app || !this.autoRotate) {
        this.autoRotateFrameId = 0;
        return;
      }

      this.orbitState.yaw -= 0.1;
      this.updateCameraOrbit(pc);
      this.syncCutawayState(pc);
      this.autoRotateFrameId = window.requestAnimationFrame(spin);
    };

    this.autoRotateFrameId = window.requestAnimationFrame(spin);
  }

  stopAutoRotate() {
    this.autoRotate = false;
    if (this.autoRotateFrameId) {
      window.cancelAnimationFrame(this.autoRotateFrameId);
      this.autoRotateFrameId = 0;
    }
  }

  setAutoRotate(enabled) {
    if (enabled) {
      this.startAutoRotate(this.pc);
      return;
    }

    this.stopAutoRotate();
  }

  async load(asset, profile = { maxDpr: 1.05 }, onState) {
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

    const camera = new pc.Entity("Camera");
    camera.addComponent("camera", {
      clearColor: new pc.Color(0.03, 0.05, 0.07, 0),
      farClip: 5000,
      nearClip: 0.01,
      fov: asset.viewPreset?.fov ?? 60,
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

    this.app = app;
    this.camera = camera;
    this.pc = pc;
    this.currentAsset = asset;
    this.autoRotate = !!asset.autoRotate;
    this.cutawayEnabled = asset.cutawayEnabled !== false;
    this.cutawayModifierInstalled = false;
    this.activeManualBoxConfig = asset.manualBox
      ? {
          position: [...asset.manualBox.position],
          rotationDegrees: [...asset.manualBox.rotationDegrees],
          scale: [...asset.manualBox.scale],
          cutRatio: Number.isFinite(asset.manualBox.cutRatio) ? asset.manualBox.cutRatio : 0.2,
          cutDepthByFace: asset.manualBox.cutDepthByFace ? { ...asset.manualBox.cutDepthByFace } : undefined,
        }
      : null;

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

    const splatAsset = new pc.Asset(asset.label || "Scene", "gsplat", {
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
      splatAsset.on("error", reject);
      app.assets.add(splatAsset);
      app.assets.load(splatAsset);
    });

    const splatEntity = new pc.Entity(asset.label || "SOG");
    splatEntity.setLocalPosition(...(asset.position || [0, 0, 0]));
    const rotation = asset.rotation || [0, 0, 0, 1];
    splatEntity.setLocalRotation(rotation[0], rotation[1], rotation[2], rotation[3]);
    splatEntity.setLocalScale(...(asset.scale || [1, 1, 1]));
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

    const radius = Math.max(halfExtents.length(), 1);
    this.orbitState = this.resolveOrbitState(pc, asset, splatEntity, center, radius);
    this.defaultOrbitState = this.cloneOrbitState(this.orbitState);
    this.updateCameraOrbit(pc);
    this.syncCutawayState(pc);

    this.orbitController = new SimpleOrbitController(canvas, () => {
      this.updateCameraOrbit(pc);
      this.syncCutawayState(pc);
    });
    this.orbitController.bind(this.orbitState);

    if (this.autoRotate) {
      this.startAutoRotate(pc);
    }

    onState?.({
      status: "ready",
      title: "SOG ready",
      message: `${asset.label || "SOG scene"} loaded successfully.`,
    });
  }

  setManualBoxConfig(config) {
    this.activeManualBoxConfig = config
      ? {
          position: [...config.position],
          rotationDegrees: [...config.rotationDegrees],
          scale: [...config.scale],
          cutRatio: Number.isFinite(config.cutRatio) ? config.cutRatio : 0.2,
          cutDepthByFace: config.cutDepthByFace ? { ...config.cutDepthByFace } : undefined,
        }
      : null;

    if (this.app && this.splatEntity && this.pc) {
      this.syncCutawayState(this.pc);
    }
  }

  setCutawayEnabled(enabled) {
    this.cutawayEnabled = !!enabled;
    if (this.app && this.splatEntity && this.pc) {
      this.syncCutawayState(this.pc);
    }
  }

  resetView() {
    if (!this.pc || !this.defaultOrbitState) {
      return;
    }

    this.orbitState = this.cloneOrbitState(this.defaultOrbitState);
    this.updateCameraOrbit(this.pc);
    this.syncCutawayState(this.pc);
  }

  dispose() {
    this.stopAutoRotate();
    if (this.orbitController) {
      this.orbitController.dispose();
      this.orbitController = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.activeManualBoxConfig = null;
    this.currentAsset = null;
    this.cutawayModifierInstalled = false;
    this.cutawayEnabled = true;
    this.defaultOrbitState = null;

    if (this.app) {
      this.app.destroy();
      this.app = null;
    }

    this.pc = null;
    this.camera = null;
    this.splatEntity = null;
    this.orbitState = null;
    this.canvas?.remove?.();
    this.canvas = null;

    if (this.container) {
      this.container.innerHTML = "";
    }
  }
}

export { PlayCanvasSogViewer };

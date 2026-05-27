import * as GaussianSplats3D from "@mkkellogg/gaussian-splats-3d";
import * as THREE from "three";
import { computeAutoCutaway } from "./autoCutaway.js";
import { installSplatShaderController } from "./clipShader.js";

function supportsSplatViewer() {
  const canvas = document.createElement("canvas");
  return !!canvas.getContext("webgl2") && typeof Worker !== "undefined";
}

class SiteSplatViewer {
  constructor(container) {
    this.container = container;
    this.viewer = null;
    this.shaderController = null;
    this.autoCutawayFrameId = 0;
    this.activeManualBoxConfig = null;
    this.baseClipBox = null;
    this.currentAsset = null;
    this.cutawayEnabled = true;
    this.profile = { maxDpr: 1.5 };
  }

  async load(asset, profile = { maxDpr: 1.5 }, onState) {
    this.dispose();
    this.profile = profile;

    if (!supportsSplatViewer()) {
      throw new Error("This browser or device cannot run the Gaussian splat viewer.");
    }

    this.container.innerHTML = "";
    onState?.({
      status: "loading",
      title: "Loading scene",
      message: `Fetching ${asset.src}`,
    });

    const viewer = new GaussianSplats3D.Viewer({
      rootElement: this.container,
      cameraUp: asset.cameraUp || [0, 0, 1],
      initialCameraPosition: asset.initialCameraPosition || [8, -8, 4],
      initialCameraLookAt: asset.initialCameraLookAt || [0, 0, 0],
      useBuiltInControls: true,
      selfDrivenMode: true,
      gpuAcceleratedSort: false,
      sharedMemoryForWorkers: false,
      enableOptionalEffects: false,
      sphericalHarmonicsDegree: 1,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
      ignoreDevicePixelRatio: profile.maxDpr <= 1.25,
    });

    this.viewer = viewer;
    this.currentAsset = asset;
    this.cutawayEnabled = asset.cutawayEnabled !== false;

    // The default refocus-on-click behavior is distracting in this showcase shell.
    viewer.checkForFocalPointChange = () => {};

    await viewer.addSplatScene(asset.src, {
      progressiveLoad: false,
      showLoadingUI: false,
      position: asset.position || [0, 0, 0],
      rotation: asset.rotation || [0, 0, 0, 1],
      scale: asset.scale || [1, 1, 1],
    });

    if (viewer.renderer?.setPixelRatio) {
      viewer.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.maxDpr || 1.5));
    }

    const splatMesh = viewer.getSplatMesh?.();
    if (!splatMesh?.material) {
      throw new Error("The splat scene loaded without a renderable splat material.");
    }

    this.shaderController = installSplatShaderController(splatMesh);
    this.baseClipBox = asset.clipBox || {
      minX: -1e6,
      maxX: 1e6,
      minY: -1e6,
      maxY: 1e6,
      minZ: -1e6,
      maxZ: 1e6,
    };
    this.shaderController.updateClipBox(this.baseClipBox);

    if (asset.manualBox) {
      this.setManualBoxConfig(asset.manualBox);
    }

    this.resetView();
    this.setAutoRotate(asset.autoRotate !== false);
    this.startAutoCutawayLoop();
    viewer.start();

    if (viewer.sceneHelper?.setFocusMarkerVisibility) {
      viewer.sceneHelper.setFocusMarkerVisibility(false);
    }
  }

  setAutoRotate(enabled) {
    if (!this.viewer?.controls) {
      return;
    }

    this.viewer.controls.autoRotate = !!enabled;
    if (typeof this.viewer.controls.autoRotateSpeed === "number") {
      this.viewer.controls.autoRotateSpeed = -0.8;
    }
    this.viewer.controls.update?.();
  }

  setManualBoxConfig(config) {
    this.activeManualBoxConfig = config
      ? {
          position: [...config.position],
          rotationDegrees: [...config.rotationDegrees],
          scale: [...config.scale],
          cutRatio: Number.isFinite(config.cutRatio) ? config.cutRatio : 0.2,
          cutDepthByFace: config.cutDepthByFace
            ? {
                left: config.cutDepthByFace.left,
                right: config.cutDepthByFace.right,
                front: config.cutDepthByFace.front,
                back: config.cutDepthByFace.back,
                top: config.cutDepthByFace.top,
                bottom: config.cutDepthByFace.bottom,
              }
            : undefined,
        }
      : null;
    this.refreshCutaway();
  }

  setCutawayEnabled(enabled) {
    this.cutawayEnabled = !!enabled;
    this.refreshCutaway();
  }

  refreshCutaway() {
    if (!this.shaderController) {
      return;
    }

    if (!this.cutawayEnabled) {
      this.shaderController.updateClipBox(this.baseClipBox || {
        minX: -1e6,
        maxX: 1e6,
        minY: -1e6,
        maxY: 1e6,
        minZ: -1e6,
        maxZ: 1e6,
      }, false);
      return;
    }

    if (!this.activeManualBoxConfig) {
      this.shaderController.updateClipBox(this.baseClipBox, true);
      return;
    }

    const cameraPositionInBoxSpace = this.getCameraPositionInBoxSpace();
    if (!cameraPositionInBoxSpace) {
      this.shaderController.updateOrientedClipBox(this.activeManualBoxConfig, true);
      return;
    }

    const nextCutaway = computeAutoCutaway(
      this.activeManualBoxConfig,
      cameraPositionInBoxSpace,
      this.activeManualBoxConfig.cutRatio ?? 0.2
    );
    this.shaderController.updateOrientedClipBox(nextCutaway.boxConfig, true);
  }

  getCameraPositionInBoxSpace() {
    if (!this.viewer?.camera || !this.activeManualBoxConfig) {
      return null;
    }

    const boxConfig = this.activeManualBoxConfig;
    const boxPosition = new THREE.Vector3(...boxConfig.position);
    const boxRotation = new THREE.Euler(
      THREE.MathUtils.degToRad(boxConfig.rotationDegrees?.[0] || 0),
      THREE.MathUtils.degToRad(boxConfig.rotationDegrees?.[1] || 0),
      THREE.MathUtils.degToRad(boxConfig.rotationDegrees?.[2] || 0),
      "XYZ"
    );
    const boxQuaternion = new THREE.Quaternion().setFromEuler(boxRotation);
    const boxScale = new THREE.Vector3(
      Math.max(boxConfig.scale?.[0] || 0, 0.001),
      Math.max(boxConfig.scale?.[1] || 0, 0.001),
      Math.max(boxConfig.scale?.[2] || 0, 0.001)
    );

    return this.viewer.camera.position
      .clone()
      .sub(boxPosition)
      .applyQuaternion(boxQuaternion.invert())
      .divide(boxScale);
  }

  startAutoCutawayLoop() {
    if (this.autoCutawayFrameId) {
      window.cancelAnimationFrame(this.autoCutawayFrameId);
    }

    const tick = () => {
      this.refreshCutaway();
      this.autoCutawayFrameId = window.requestAnimationFrame(tick);
    };

    this.autoCutawayFrameId = window.requestAnimationFrame(tick);
  }

  resetView() {
    if (!this.viewer?.camera || !this.viewer?.controls || !this.currentAsset) {
      return;
    }

    const position = this.currentAsset.initialCameraPosition || [8, -8, 4];
    const lookAt = this.currentAsset.initialCameraLookAt || [0, 0, 0];

    this.viewer.camera.position.set(position[0], position[1], position[2]);
    this.viewer.controls.target.set(lookAt[0], lookAt[1], lookAt[2]);
    this.viewer.controls.update?.();
  }

  dispose() {
    if (this.autoCutawayFrameId) {
      window.cancelAnimationFrame(this.autoCutawayFrameId);
      this.autoCutawayFrameId = 0;
    }

    this.shaderController = null;
    this.activeManualBoxConfig = null;
    this.baseClipBox = null;
    this.currentAsset = null;

    if (this.viewer) {
      this.viewer.dispose();
      this.viewer = null;
    }

    if (this.container) {
      this.container.innerHTML = "";
    }
  }
}

export { SiteSplatViewer };

// Developer-only trailer paths. Coordinates are intentionally rough placeholders
// in each splat's local coordinate frame. Tune position/target values here after
// reviewing test captures; no scene calibration data needs to change.
const CINEMATIC_PATHS = [
  {
    id: "exterior_day_push_to_entrance",
    name: "Exterior Day - Entrance Push",
    scene: { kind: "outdoor", stage: "day" },
    keyframes: [
      { time: 0, position: [0, -30, 7], target: [0, 0, 2], fov: 58 },
      { time: 4.5, position: [-1.5, -19, 5.8], target: [0, 1, 2.2], fov: 54 },
      { time: 10, position: [0.4, -8, 3.8], target: [0, 3, 2.1], fov: 48 },
    ],
  },
  {
    id: "exterior_dusk_same_angle",
    name: "Exterior Dusk - Matching Angle",
    scene: { kind: "outdoor", stage: "dusk" },
    keyframes: [
      { time: 0, position: [0, -30, 7], target: [0, 0, 2], fov: 58 },
      { time: 5, position: [-1.2, -20, 5.9], target: [0, 1, 2.2], fov: 54 },
      { time: 10, position: [0.2, -10, 4.1], target: [0, 3, 2.1], fov: 49 },
    ],
  },
  {
    id: "main_hall_walkthrough",
    name: "Main Hall Walkthrough",
    scene: { kind: "indoor", sceneId: "main-hall" },
    keyframes: [
      { time: 0, position: [0, -12, 1.8], target: [0, -2, 1.7], fov: 72 },
      { time: 4, position: [-1.1, -6, 1.75], target: [0.3, 2, 1.65], fov: 68 },
      { time: 9, position: [0.8, 1, 1.7], target: [-0.4, 9, 1.8], fov: 64 },
      { time: 14, position: [-0.3, 8, 1.75], target: [0, 15, 1.7], fov: 60 },
    ],
  },
  {
    id: "amphitheater_reveal",
    name: "Amphitheater Reveal",
    scene: { kind: "indoor", sceneId: "amphitheater" },
    keyframes: [
      { time: 0, position: [-7, -7, 2.2], target: [0, 0, 1.3], fov: 58 },
      { time: 5, position: [-4, -2, 3.4], target: [1, 2, 1.1], fov: 64 },
      { time: 11, position: [0, 4, 5.2], target: [0, 0, 0.8], fov: 72 },
    ],
  },
  {
    id: "general_montage_placeholder",
    name: "Exterior Night - Montage Placeholder",
    scene: { kind: "outdoor", stage: "night" },
    keyframes: [
      { time: 0, position: [12, -24, 8], target: [0, 0, 2], fov: 60 },
      { time: 5, position: [7, -17, 6.5], target: [0, 1, 2.2], fov: 55 },
      { time: 11, position: [2, -9, 4.2], target: [0, 3, 2], fov: 49 },
    ],
  },
];

const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeInOutCubic = (value) => {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

function catmullRomScalar(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function interpolateVector(frames, index, property, t) {
  const p0 = frames[Math.max(0, index - 1)][property];
  const p1 = frames[index][property];
  const p2 = frames[index + 1][property];
  const p3 = frames[Math.min(frames.length - 1, index + 2)][property];
  return p1.map((_, axis) => catmullRomScalar(p0[axis], p1[axis], p2[axis], p3[axis], t));
}

function samplePath(path, elapsed) {
  const frames = path.keyframes;
  const duration = frames[frames.length - 1].time;
  const time = Math.max(0, Math.min(duration, elapsed));
  let index = frames.length - 2;
  for (let i = 0; i < frames.length - 1; i += 1) {
    if (time <= frames[i + 1].time) {
      index = i;
      break;
    }
  }

  const start = frames[index];
  const end = frames[index + 1];
  const segmentDuration = Math.max(0.001, end.time - start.time);
  const t = easeInOutCubic((time - start.time) / segmentDuration);
  const startFov = Number.isFinite(start.fov) ? start.fov : end.fov;
  const endFov = Number.isFinite(end.fov) ? end.fov : startFov;
  return {
    position: interpolateVector(frames, index, "position", t),
    target: interpolateVector(frames, index, "target", t),
    fov: Number.isFinite(startFov) && Number.isFinite(endFov)
      ? startFov + (endFov - startFov) * t
      : null,
  };
}

const AUTHORING_STORAGE_PREFIX = "hua3d.cinematic.authoring.";
const AUTHORING_SEGMENT_SECONDS = 3;
const roundVector = (vector) => vector?.map((value) => Number(value.toFixed(2))) || null;
const slugify = (value) => String(value || "custom_path")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "") || "custom_path";

class CinematicMode {
  constructor({ viewer, preparePath, getSceneInfo, authorEnabled = false }) {
    this.viewer = viewer;
    this.preparePath = preparePath;
    this.getSceneInfo = getSceneInfo;
    this.authorEnabled = authorEnabled;
    this.currentPath = null;
    this.elapsed = 0;
    this.running = false;
    this.paused = false;
    this.lastTimestamp = null;
    this.requestId = 0;
    this.animationFrame = null;
    this.overlayVisible = true;
    this.authoredKeyframes = [];
    this.selectedKeyframeIndex = -1;
    this.authorSceneId = null;
    this.authorSceneName = null;
    this.authorStatus = "Move the camera, then press K";
    this.overlay = this.createOverlay();
    this.onKeyDown = this.onKeyDown.bind(this);
    this.tick = this.tick.bind(this);
    window.addEventListener("keydown", this.onKeyDown);
    this.authorRefreshTimer = this.authorEnabled
      ? window.setInterval(() => this.updateOverlay(), 250)
      : null;
    this.updateOverlay();
  }

  createOverlay() {
    const overlay = document.createElement("aside");
    overlay.className = "cinematic-overlay";
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = `
      <strong data-cinematic-name>Cinematic ready</strong>
      <span data-cinematic-time>Press 1-5 to play a path</span>
      <small data-cinematic-state>READY</small>
      <div class="cinematic-author-details" data-cinematic-author-details hidden>
        <span data-author-scene>No active SOG scene</span>
        <span data-author-summary>0 keyframes</span>
        <span data-author-pose>Position: -- | Target: --</span>
        <span data-author-controls>K add · Shift+K update · [ ] select · Del remove · P preview · C copy · L log · Esc release</span>
        <small data-author-status>Move the camera, then press K</small>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  syncAuthorScene() {
    if (!this.authorEnabled) return null;
    const scene = this.getSceneInfo?.() || null;
    if (!scene?.sceneId) return null;
    if (scene.sceneId === this.authorSceneId) return scene;

    this.stop(true);
    this.currentPath = null;
    this.authorSceneId = scene.sceneId;
    this.authorSceneName = scene.name || scene.sceneId;
    this.authoredKeyframes = this.loadAuthoredKeyframes(scene.sceneId);
    this.selectedKeyframeIndex = this.authoredKeyframes.length - 1;
    this.authorStatus = this.authoredKeyframes.length
      ? `Restored ${this.authoredKeyframes.length} saved keyframe(s)`
      : "Move the camera, then press K";
    return scene;
  }

  loadAuthoredKeyframes(sceneId) {
    try {
      const saved = JSON.parse(localStorage.getItem(`${AUTHORING_STORAGE_PREFIX}${sceneId}`) || "[]");
      return Array.isArray(saved) ? saved.filter((frame) =>
        Array.isArray(frame.position) && Array.isArray(frame.target) && Number.isFinite(frame.time)
      ) : [];
    } catch {
      return [];
    }
  }

  saveAuthoredKeyframes() {
    if (!this.authorSceneId) return;
    localStorage.setItem(
      `${AUTHORING_STORAGE_PREFIX}${this.authorSceneId}`,
      JSON.stringify(this.authoredKeyframes)
    );
  }

  captureKeyframe(updateSelected = false) {
    const scene = this.syncAuthorScene();
    const pose = this.viewer.getCinematicCameraPose?.("local");
    if (!scene || !pose) {
      this.authorStatus = "Load a PlayCanvas SOG scene first";
      this.updateOverlay("AUTHOR");
      return;
    }

    const previous = this.authoredKeyframes[this.authoredKeyframes.length - 1];
    const time = updateSelected && this.selectedKeyframeIndex >= 0
      ? this.authoredKeyframes[this.selectedKeyframeIndex].time
      : previous ? previous.time + AUTHORING_SEGMENT_SECONDS : 0;
    const frame = {
      time,
      position: pose.position,
      target: pose.target,
      fov: pose.fov,
      easing: "easeInOutCubic",
      capturedAt: new Date().toISOString(),
    };

    if (updateSelected && this.selectedKeyframeIndex >= 0) {
      this.authoredKeyframes[this.selectedKeyframeIndex] = frame;
      this.authorStatus = `Updated keyframe ${this.selectedKeyframeIndex + 1}`;
    } else {
      this.authoredKeyframes.push(frame);
      this.selectedKeyframeIndex = this.authoredKeyframes.length - 1;
      this.authorStatus = `Added keyframe ${this.selectedKeyframeIndex + 1}`;
    }
    this.saveAuthoredKeyframes();
    console.info("[Cinematic author]", this.authorStatus, {
      position: roundVector(frame.position),
      target: roundVector(frame.target),
      fov: Number(frame.fov?.toFixed?.(2) ?? frame.fov),
    });
    this.updateOverlay("AUTHOR");
  }

  selectAuthoredKeyframe(step) {
    this.syncAuthorScene();
    if (!this.authoredKeyframes.length) return;
    this.selectedKeyframeIndex = Math.max(
      0,
      Math.min(this.authoredKeyframes.length - 1, this.selectedKeyframeIndex + step)
    );
    this.authorStatus = `Selected keyframe ${this.selectedKeyframeIndex + 1}`;
    this.updateOverlay("AUTHOR");
  }

  removeSelectedKeyframe() {
    this.syncAuthorScene();
    if (this.selectedKeyframeIndex < 0) return;
    this.authoredKeyframes.splice(this.selectedKeyframeIndex, 1);
    this.authoredKeyframes.forEach((frame, index) => {
      frame.time = index * AUTHORING_SEGMENT_SECONDS;
    });
    this.selectedKeyframeIndex = Math.min(
      this.selectedKeyframeIndex,
      this.authoredKeyframes.length - 1
    );
    this.saveAuthoredKeyframes();
    this.authorStatus = "Removed selected keyframe";
    this.updateOverlay("AUTHOR");
  }

  buildAuthoredPath() {
    if (!this.authorSceneId || this.authoredKeyframes.length < 2) return null;
    return {
      id: slugify(`custom_${this.authorSceneId}`),
      name: `Custom ${this.authorSceneName || this.authorSceneId}`,
      sceneId: this.authorSceneId,
      defaultDuration: this.authoredKeyframes[this.authoredKeyframes.length - 1].time,
      keyframes: this.authoredKeyframes.map(({ capturedAt, ...frame }) => ({
        ...frame,
        position: [...frame.position],
        target: [...frame.target],
      })),
    };
  }

  previewAuthoredPath() {
    this.syncAuthorScene();
    const path = this.buildAuthoredPath();
    if (!path) {
      this.authorStatus = "Add at least two keyframes to preview";
      this.updateOverlay("AUTHOR");
      return;
    }
    this.stop(false);
    this.currentPath = path;
    this.elapsed = 0;
    this.paused = false;
    if (!this.viewer.beginCinematicCamera()) return;
    this.running = true;
    this.lastTimestamp = null;
    this.authorStatus = "Preview running; Esc returns camera control";
    this.applyCurrentPose();
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  exportAuthoredPath() {
    this.syncAuthorScene();
    const path = this.buildAuthoredPath();
    return path ? JSON.stringify(path, null, 2) : null;
  }

  async copyAuthoredPath() {
    const json = this.exportAuthoredPath();
    if (!json) {
      this.authorStatus = "Add at least two keyframes before exporting";
      this.updateOverlay("AUTHOR");
      return;
    }
    try {
      await navigator.clipboard.writeText(json);
      this.authorStatus = "Path JSON copied to clipboard";
    } catch {
      this.authorStatus = "Clipboard unavailable; press L and copy from console";
    }
    this.updateOverlay("AUTHOR");
  }

  logAuthoredPath() {
    const json = this.exportAuthoredPath();
    if (!json) return;
    console.info("[Cinematic author] Exported path:\n", json);
    this.authorStatus = "Path JSON logged to console";
    this.updateOverlay("AUTHOR");
  }

  async playPath(pathOrIndex) {
    const path = typeof pathOrIndex === "number" ? CINEMATIC_PATHS[pathOrIndex] : pathOrIndex;
    if (!path) return;
    const requestId = ++this.requestId;
    this.stop(false);
    this.currentPath = path;
    this.elapsed = 0;
    this.paused = false;
    this.updateOverlay("LOADING");

    const ready = await this.preparePath(path);
    if (requestId !== this.requestId || !ready || !this.viewer.beginCinematicCamera()) {
      if (requestId === this.requestId) this.updateOverlay("UNAVAILABLE");
      return;
    }

    this.running = true;
    this.lastTimestamp = null;
    this.applyCurrentPose();
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  tick(timestamp) {
    if (!this.running || !this.currentPath) return;
    if (this.lastTimestamp === null) this.lastTimestamp = timestamp;
    if (!this.paused) {
      this.elapsed += Math.max(0, timestamp - this.lastTimestamp) / 1000;
      const duration = this.getDuration();
      if (this.elapsed >= duration) {
        this.elapsed = duration;
        this.applyCurrentPose();
        this.running = false;
        this.updateOverlay("COMPLETE");
        return;
      }
      this.applyCurrentPose();
    }
    this.lastTimestamp = timestamp;
    this.updateOverlay();
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  applyCurrentPose() {
    if (!this.currentPath) return;
    const pose = samplePath(this.currentPath, this.elapsed);
    this.viewer.setCinematicCameraPose(pose.position, pose.target, pose.fov, "local");
  }

  togglePause() {
    if (!this.currentPath) return;
    if (!this.running) {
      if (this.elapsed >= this.getDuration()) this.elapsed = 0;
      this.running = true;
      this.lastTimestamp = null;
      this.animationFrame = requestAnimationFrame(this.tick);
    }
    this.paused = !this.paused;
    this.lastTimestamp = null;
    this.updateOverlay();
  }

  restart() {
    if (!this.currentPath) return;
    this.elapsed = 0;
    this.paused = false;
    this.running = true;
    this.lastTimestamp = null;
    this.viewer.beginCinematicCamera();
    this.applyCurrentPose();
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = requestAnimationFrame(this.tick);
  }

  stop(releaseCamera = true) {
    this.running = false;
    this.paused = false;
    this.lastTimestamp = null;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
    if (releaseCamera) this.viewer.endCinematicCamera();
  }

  toggleOverlay() {
    this.overlayVisible = !this.overlayVisible;
    this.overlay.hidden = !this.overlayVisible;
  }

  getDuration() {
    const frames = this.currentPath?.keyframes || [];
    return frames.length ? frames[frames.length - 1].time : 0;
  }

  updateOverlay(forcedState = null) {
    const duration = this.getDuration();
    const state = forcedState || (this.paused ? "PAUSED" : this.running ? "RUNNING" : this.currentPath ? "STOPPED" : "READY");
    this.overlay.querySelector("[data-cinematic-name]").textContent = this.currentPath?.name || "Cinematic ready";
    this.overlay.querySelector("[data-cinematic-time]").textContent = this.currentPath
      ? `${this.elapsed.toFixed(1)} / ${duration.toFixed(1)} s`
      : "Press 1-5 to play a path";
    this.overlay.querySelector("[data-cinematic-state]").textContent = state;

    const authorDetails = this.overlay.querySelector("[data-cinematic-author-details]");
    authorDetails.hidden = !this.authorEnabled;
    if (this.authorEnabled) {
      const scene = this.syncAuthorScene();
      const pose = this.viewer.getCinematicCameraPose?.("local");
      const selected = this.selectedKeyframeIndex >= 0 ? this.selectedKeyframeIndex + 1 : 0;
      const authoredDuration = this.authoredKeyframes.length
        ? this.authoredKeyframes[this.authoredKeyframes.length - 1].time
        : 0;
      this.overlay.querySelector("[data-author-scene]").textContent = scene
        ? `AUTHOR · ${scene.name} (${scene.sceneId})`
        : "AUTHOR · No active PlayCanvas SOG scene";
      this.overlay.querySelector("[data-author-summary]").textContent =
        `${this.authoredKeyframes.length} keyframe(s) · selected ${selected || "--"} · ${authoredDuration.toFixed(1)} s`;
      this.overlay.querySelector("[data-author-pose]").textContent = pose
        ? `Position: ${roundVector(pose.position).join(", ")} | Target: ${roundVector(pose.target).join(", ")} | FOV: ${pose.fov?.toFixed?.(1) ?? "--"}`
        : "Position: -- | Target: --";
      this.overlay.querySelector("[data-author-status]").textContent = this.authorStatus;
    }
  }

  onKeyDown(event) {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const tag = event.target?.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return;
    const key = event.key.toLowerCase();
    if (this.authorEnabled && key === "k") {
      event.preventDefault();
      this.captureKeyframe(event.shiftKey);
    } else if (this.authorEnabled && event.key === "[") {
      event.preventDefault();
      this.selectAuthoredKeyframe(-1);
    } else if (this.authorEnabled && event.key === "]") {
      event.preventDefault();
      this.selectAuthoredKeyframe(1);
    } else if (this.authorEnabled && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault();
      this.removeSelectedKeyframe();
    } else if (this.authorEnabled && key === "p") {
      event.preventDefault();
      this.previewAuthoredPath();
    } else if (this.authorEnabled && key === "c") {
      event.preventDefault();
      this.copyAuthoredPath();
    } else if (this.authorEnabled && key === "l") {
      event.preventDefault();
      this.logAuthoredPath();
    } else if (/^[1-5]$/.test(event.key)) {
      event.preventDefault();
      this.playPath(Number(event.key) - 1);
    } else if (event.code === "Space") {
      event.preventDefault();
      this.togglePause();
    } else if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      this.restart();
    } else if (event.key.toLowerCase() === "h") {
      event.preventDefault();
      this.toggleOverlay();
    } else if (event.key === "Escape") {
      this.stop(true);
      if (this.authorEnabled) this.authorStatus = "Camera control released";
      this.updateOverlay(this.authorEnabled ? "AUTHOR" : "STOPPED");
    }
  }

  dispose() {
    ++this.requestId;
    this.stop(true);
    window.removeEventListener("keydown", this.onKeyDown);
    if (this.authorRefreshTimer) window.clearInterval(this.authorRefreshTimer);
    this.overlay.remove();
  }
}

function createCinematicMode(options) {
  return new CinematicMode(options);
}

export { CINEMATIC_PATHS, createCinematicMode };

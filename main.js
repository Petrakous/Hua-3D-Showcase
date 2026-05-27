import { LOCATION_CATALOG, LOCATION_LABELS } from "./viewer/sceneCatalog.js";
import { SiteSplatViewer } from "./viewer/splatViewer.js";
import { PlayCanvasSogViewer } from "./viewer/playCanvasSogViewer.js";

const modelViewer = document.getElementById("siteModel");
const splatViewerMount = document.getElementById("splatViewerMount");
const siteHeader = document.getElementById("siteHeader");
const progressBar = document.getElementById("progressBar");
const statusPill = document.getElementById("statusPill");
const statusCopy = document.getElementById("statusCopy");
const viewerStatus = document.getElementById("viewerStatus");
const fullscreenToggle = document.getElementById("fullscreenToggle");
const warmCacheToggle = document.getElementById("warmCacheToggle");
const qualityToggle = document.getElementById("qualityToggle");
const timeDial = document.getElementById("timeDial");
const timeStageMarkers = [...document.querySelectorAll(".time-stage-marker")];
const locationStageMarkers = [...document.querySelectorAll(".location-stage-marker")];
const sceneControl = document.getElementById("sceneControl");
const sceneStageMarkers = document.getElementById("sceneStageMarkers");
const formatControl = document.getElementById("formatControl");
const formatStageMarkers = document.getElementById("formatStageMarkers");
const resetCamera = document.getElementById("resetCamera");
const turntableToggle = document.getElementById("turntableToggle");
const materialToggle = document.getElementById("materialToggle");

const timeStages = ["day", "dusk", "night"];
const timeLabels = {
  day: "Day",
  dusk: "Dusk",
  night: "Night",
};
const timeStageAngles = {
  day: 0,
  dusk: 90,
  night: 180,
};
const clayColor = [0.86, 0.89, 0.92, 1];
const isMobileDevice =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const useBlobPreloading = !isMobileDevice;
const splatProfile = {
  maxDpr: isMobileDevice ? 1.05 : 1.35,
};

let activeTimeStage = "day";
let activeLocationStage = "outdoors";
let activeSceneId = null;
let activeFormat = "glb";
let hdEnabled = false;
let warmCacheEnabled = false;
let clayEnabled = false;
let turntableEnabled = true;
let originalMaterials = [];
let currentStageRotation = timeStageAngles[activeTimeStage];
let currentAssetKey = "";
let currentEngineType = "glb";
let currentActiveAsset = null;
let activeAssetSwapId = 0;
let dialPointerId = null;
let dialStartAngle = 0;
let dialDragged = false;
let skipNextDialClick = false;
const preloadedModelUrls = new Map();
const preloadPromises = new Map();
const plyViewer = new SiteSplatViewer(splatViewerMount);
const sogViewer = new PlayCanvasSogViewer(splatViewerMount);

const FORMAT_LABELS = {
  glb: "GLB",
  splat: "PLY",
  sog: "SOG",
};

function setProgress(value) {
  progressBar.style.width = `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`;
}

function setStatus(title, text) {
  statusPill.textContent = title;
  statusCopy.textContent = text;
}

function setStatusOverlayState(isIdle) {
  viewerStatus.classList.toggle("is-idle", isIdle);
}

function getCurrentLocationEntry() {
  return LOCATION_CATALOG[activeLocationStage];
}

function getCurrentSceneCollection() {
  const locationEntry = getCurrentLocationEntry();
  if (!locationEntry) {
    return [];
  }

  if (locationEntry.kind === "scene-group") {
    return locationEntry.scenes || [];
  }

  if (locationEntry.kind === "single-scene" && locationEntry.scene) {
    return [locationEntry.scene];
  }

  return [];
}

function getCurrentSceneEntry() {
  const scenes = getCurrentSceneCollection();
  if (!scenes.length) {
    return null;
  }

  if (activeSceneId) {
    const exactMatch = scenes.find((scene) => scene.id === activeSceneId);
    if (exactMatch) {
      return exactMatch;
    }
  }

  return scenes[0];
}

function normalizeActiveScene() {
  const locationEntry = getCurrentLocationEntry();
  const scenes = getCurrentSceneCollection();

  if (!scenes.length) {
    activeSceneId = null;
    return;
  }

  const hasExactScene = activeSceneId && scenes.some((scene) => scene.id === activeSceneId);
  if (hasExactScene) {
    return;
  }

  activeSceneId = locationEntry?.defaultSceneId || scenes[0].id;
}

function getAvailableFormats() {
  const locationEntry = getCurrentLocationEntry();
  if (!locationEntry || locationEntry.kind === "outdoor-cycle") {
    return ["glb"];
  }

  normalizeActiveScene();
  const scene = getCurrentSceneEntry();
  return Object.keys(scene?.assets || {});
}

function normalizeActiveFormat() {
  normalizeActiveScene();
  const availableFormats = getAvailableFormats();
  if (!availableFormats.includes(activeFormat)) {
    activeFormat = availableFormats[0] || "glb";
  }
}

function getOutdoorAsset(stage, qualityKey) {
  const outdoorCatalog = LOCATION_CATALOG.outdoors;
  if (isMobileDevice && outdoorCatalog.mobileStages?.[stage]?.[qualityKey]) {
    return outdoorCatalog.mobileStages[stage][qualityKey];
  }

  return outdoorCatalog.stages[stage][qualityKey];
}

function getActiveAssetDescriptor() {
  normalizeActiveFormat();

  if (activeLocationStage === "outdoors") {
    const qualityKey = hdEnabled ? "hd" : "web";
    const asset = getOutdoorAsset(activeTimeStage, qualityKey);
    return {
      ...asset,
      key: `outdoors:${activeTimeStage}:${qualityKey}`,
      label: `${timeLabels[activeTimeStage]}${hdEnabled ? " HD" : ""}`,
      locationId: "outdoors",
      format: "glb",
    };
  }

  const locationEntry = getCurrentLocationEntry();
  normalizeActiveScene();
  const scene = getCurrentSceneEntry();
  const asset = scene?.assets?.[activeFormat] || scene?.assets?.glb || Object.values(scene?.assets || {})[0];

  if (!asset) {
    return null;
  }

  return {
    ...asset,
    key: `${locationEntry.id}:${scene.id}:${activeFormat}`,
    label: scene.label,
    locationId: locationEntry.id,
    format: activeFormat,
  };
}

function describeActiveAsset(asset = getActiveAssetDescriptor()) {
  if (!asset) {
    return "scene";
  }

  if (asset.locationId === "outdoors") {
    return asset.label;
  }

  const sceneLabel = asset.label;
  const baseLocationLabel = LOCATION_LABELS[asset.locationId] || sceneLabel;
  const formatLabel = FORMAT_LABELS[asset.format] || FORMAT_LABELS[asset.fileFormat] || "GLB";
  return `${baseLocationLabel} / ${sceneLabel} (${formatLabel})`;
}

function getActiveOverlayViewer() {
  if (currentEngineType !== "splat") {
    return null;
  }

  return currentActiveAsset?.runtime === "playcanvas" ? sogViewer : plyViewer;
}

function updateViewerLayerVisibility(engineType) {
  const showSplat = engineType === "splat";
  modelViewer.hidden = showSplat;
  modelViewer.setAttribute("aria-hidden", String(showSplat));
  splatViewerMount.hidden = !showSplat;
  splatViewerMount.setAttribute("aria-hidden", String(!showSplat));
}

function applyGlbView(asset) {
  modelViewer.orientation = asset.orientation || "0deg 0deg 0deg";
  modelViewer.cameraTarget = asset.cameraTarget || "auto auto auto";
  modelViewer.cameraOrbit = asset.cameraOrbit || "0deg 72deg auto";
  modelViewer.fieldOfView = asset.fieldOfView || "30deg";
  modelViewer.minCameraOrbit = asset.minCameraOrbit || "auto 10deg auto";
  modelViewer.maxCameraOrbit = asset.maxCameraOrbit || "auto 88deg auto";
  modelViewer.jumpCameraToGoal();
}

async function resetGlbViewAfterLoad() {
  if (!currentActiveAsset || currentEngineType !== "glb") {
    return;
  }

  applyGlbView(currentActiveAsset);
  await modelViewer.updateComplete;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (currentEngineType === "glb" && currentActiveAsset) {
        applyGlbView(currentActiveAsset);
      }
    });
  });
}

function resetActiveViewer() {
  if (currentEngineType === "splat") {
    getActiveOverlayViewer()?.resetView();
    return;
  }

  resetGlbViewAfterLoad();
}

function cacheMaterialState() {
  originalMaterials =
    modelViewer.model?.materials?.map((material) => {
      const pbr = material.pbrMetallicRoughness;
      return {
        material,
        baseColorFactor: pbr.baseColorFactor.slice(),
        metallicFactor: pbr.metallicFactor,
        roughnessFactor: pbr.roughnessFactor,
        emissiveFactor: material.emissiveFactor.slice(),
      };
    }) ?? [];
}

function applyClayMaterials() {
  for (const entry of originalMaterials) {
    entry.material.pbrMetallicRoughness.setBaseColorFactor(clayColor);
    entry.material.pbrMetallicRoughness.setMetallicFactor(0);
    entry.material.pbrMetallicRoughness.setRoughnessFactor(1);
    entry.material.setEmissiveFactor([0.02, 0.03, 0.04]);
  }
}

function restoreMaterials() {
  for (const entry of originalMaterials) {
    entry.material.pbrMetallicRoughness.setBaseColorFactor(entry.baseColorFactor);
    entry.material.pbrMetallicRoughness.setMetallicFactor(entry.metallicFactor);
    entry.material.pbrMetallicRoughness.setRoughnessFactor(entry.roughnessFactor);
    entry.material.setEmissiveFactor(entry.emissiveFactor);
  }
}

function preloadModel(src) {
  if (preloadedModelUrls.has(src)) {
    return Promise.resolve(preloadedModelUrls.get(src));
  }

  if (preloadPromises.has(src)) {
    return preloadPromises.get(src);
  }

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "fetch";
  link.href = src;
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);

  if (!useBlobPreloading) {
    const preloadPromise = fetch(src, { cache: "force-cache" })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to warm model cache: ${src}`);
        }

        preloadedModelUrls.set(src, src);
        return src;
      })
      .catch(() => src)
      .finally(() => {
        preloadPromises.delete(src);
      });

    preloadPromises.set(src, preloadPromise);
    return preloadPromise;
  }

  const preloadPromise = fetch(src, { cache: "force-cache" })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to preload model: ${src}`);
      }

      return response.blob();
    })
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      preloadedModelUrls.set(src, objectUrl);
      return objectUrl;
    })
    .catch(() => src)
    .finally(() => {
      preloadPromises.delete(src);
    });

  preloadPromises.set(src, preloadPromise);
  return preloadPromise;
}

async function getModelUrl(src) {
  if (preloadedModelUrls.has(src)) {
    return preloadedModelUrls.get(src);
  }

  return preloadModel(src);
}

function collectWarmModelSources() {
  const sources = new Set();
  const outdoorCatalog = LOCATION_CATALOG.outdoors;

  for (const stage of timeStages) {
    sources.add(outdoorCatalog.stages[stage].web.src);
    if (outdoorCatalog.qualityAvailability?.[stage]) {
      sources.add(outdoorCatalog.stages[stage].hd.src);
    }

    if (outdoorCatalog.mobileStages?.[stage]?.web?.src) {
      sources.add(outdoorCatalog.mobileStages[stage].web.src);
    }

    if (outdoorCatalog.mobileStages?.[stage]?.hd?.src) {
      sources.add(outdoorCatalog.mobileStages[stage].hd.src);
    }
  }

  for (const locationId of Object.keys(LOCATION_CATALOG)) {
    const locationEntry = LOCATION_CATALOG[locationId];
    const scenes =
      locationEntry.kind === "single-scene"
        ? [locationEntry.scene]
        : locationEntry.kind === "scene-group"
          ? locationEntry.scenes || []
          : [];

    for (const scene of scenes) {
      for (const asset of Object.values(scene?.assets || {})) {
        if (asset.type === "glb") {
          sources.add(asset.src);
        }
      }
    }
  }

  return [...sources];
}

function warmModelCache() {
  if (!warmCacheEnabled) {
    return;
  }

  for (const src of collectWarmModelSources()) {
    preloadModel(src);
  }
}

function updateWarmCacheToggle() {
  warmCacheToggle.setAttribute("aria-pressed", String(warmCacheEnabled));
  warmCacheToggle.setAttribute("aria-label", warmCacheEnabled ? "Warm Model Cache On" : "Warm Model Cache Off");
  warmCacheToggle.title = warmCacheEnabled ? "Warm Model Cache On" : "Warm Model Cache Off";
}

function updateQualityToggle() {
  const outdoorCatalog = LOCATION_CATALOG.outdoors;
  const hdAvailable = activeLocationStage === "outdoors" && outdoorCatalog.qualityAvailability?.[activeTimeStage];
  if (!hdAvailable) {
    hdEnabled = false;
  }

  qualityToggle.hidden = !hdAvailable;
  qualityToggle.style.display = hdAvailable ? "inline-flex" : "none";
  qualityToggle.setAttribute("aria-pressed", String(hdEnabled));
  qualityToggle.setAttribute("aria-label", "HD");
  qualityToggle.title = "HD";
  qualityToggle.disabled = !hdAvailable;
}

function updateMaterialToggle() {
  const activeAsset = getActiveAssetDescriptor();
  const isGlb = activeAsset?.type === "glb";
  materialToggle.hidden = !isGlb;
  materialToggle.style.display = isGlb ? "inline-flex" : "none";
  materialToggle.disabled = !isGlb;
}

function renderSceneMarkers() {
  const locationEntry = getCurrentLocationEntry();
  const scenes = getCurrentSceneCollection();
  const shouldShowSceneControl = locationEntry?.kind === "scene-group" && scenes.length > 0;

  sceneControl.hidden = !shouldShowSceneControl;
  if (!shouldShowSceneControl) {
    sceneStageMarkers.innerHTML = "";
    return;
  }

  normalizeActiveScene();
  sceneStageMarkers.innerHTML = scenes
    .map((scene) => `
      <button
        class="scene-stage-marker"
        data-scene-id="${scene.id}"
        data-active="${String(scene.id === activeSceneId)}"
        type="button"
      >${scene.label}</button>
    `)
    .join("");

  for (const button of sceneStageMarkers.querySelectorAll(".scene-stage-marker")) {
    button.addEventListener("click", () => {
      const sceneId = button.dataset.sceneId;
      if (!sceneId || sceneId === activeSceneId) {
        return;
      }

      setActiveScene(sceneId);
    });
  }
}

function renderFormatMarkers() {
  const availableFormats = getAvailableFormats();
  const shouldShowFormatControl = availableFormats.length > 1;
  formatControl.hidden = !shouldShowFormatControl;

  if (!shouldShowFormatControl) {
    formatStageMarkers.innerHTML = "";
    return;
  }

  formatStageMarkers.innerHTML = availableFormats
    .map((format) => `
      <button
        class="format-stage-marker"
        data-format="${format}"
        data-active="${String(format === activeFormat)}"
        type="button"
      >${FORMAT_LABELS[format] || format.toUpperCase()}</button>
    `)
    .join("");

  for (const button of formatStageMarkers.querySelectorAll(".format-stage-marker")) {
    button.addEventListener("click", () => {
      const format = button.dataset.format;
      if (!format || format === activeFormat) {
        return;
      }

      setActiveFormat(format);
    });
  }
}

function updateSceneAndFormatUi() {
  renderSceneMarkers();
  renderFormatMarkers();
}

function updateLocationUi() {
  document.body.dataset.location = activeLocationStage;
  const timeControlsDisabled = activeLocationStage !== "outdoors";
  timeDial.disabled = timeControlsDisabled;
  timeDial.setAttribute("aria-disabled", String(timeControlsDisabled));

  for (const marker of locationStageMarkers) {
    marker.dataset.active = String(marker.dataset.location === activeLocationStage);
  }

  for (const marker of timeStageMarkers) {
    marker.disabled = timeControlsDisabled;
    marker.setAttribute("aria-disabled", String(timeControlsDisabled));
  }

  updateSceneAndFormatUi();
}

function setDialRotation(rotation) {
  currentStageRotation = rotation;
  timeDial.style.setProperty("--orbit-rotation", `${rotation}deg`);
}

function updateTimeUi(direction = 0) {
  const stageAngle = timeStageAngles[activeTimeStage];
  let targetRotation = stageAngle;

  if (direction > 0) {
    while (targetRotation <= currentStageRotation) {
      targetRotation += 360;
    }
  } else if (direction < 0) {
    while (targetRotation >= currentStageRotation) {
      targetRotation -= 360;
    }
  } else {
    const cycleBase = Math.round(currentStageRotation / 360) * 360;
    const candidates = [stageAngle + cycleBase - 360, stageAngle + cycleBase, stageAngle + cycleBase + 360];
    targetRotation = candidates.reduce((closest, candidate) => {
      return Math.abs(candidate - currentStageRotation) < Math.abs(closest - currentStageRotation)
        ? candidate
        : closest;
    }, candidates[1]);
  }

  setDialRotation(targetRotation);
  timeDial.dataset.stage = activeTimeStage;

  for (const marker of timeStageMarkers) {
    marker.dataset.active = String(marker.dataset.stage === activeTimeStage);
  }
}

function setControlsBusy(isBusy) {
  const timeControlsDisabled = isBusy || activeLocationStage !== "outdoors";
  timeDial.disabled = timeControlsDisabled;
  timeDial.setAttribute("aria-disabled", String(timeControlsDisabled));
  for (const marker of timeStageMarkers) {
    marker.disabled = timeControlsDisabled;
    marker.setAttribute("aria-disabled", String(timeControlsDisabled));
  }
  for (const marker of locationStageMarkers) {
    marker.disabled = isBusy;
  }
  for (const marker of sceneStageMarkers.querySelectorAll(".scene-stage-marker")) {
    marker.disabled = isBusy;
  }
  for (const marker of formatStageMarkers.querySelectorAll(".format-stage-marker")) {
    marker.disabled = isBusy;
  }

  if (isBusy) {
    qualityToggle.disabled = true;
    materialToggle.disabled = true;
  } else {
    updateQualityToggle();
    updateMaterialToggle();
  }
}

function updateTurntableUi() {
  turntableToggle.setAttribute("aria-pressed", String(turntableEnabled));
  turntableToggle.setAttribute("aria-label", turntableEnabled ? "Rotate on" : "Rotate off");
  turntableToggle.title = turntableEnabled ? "Rotate on" : "Rotate off";
}

function applyTurntableState() {
  if (currentEngineType === "splat") {
    getActiveOverlayViewer()?.setAutoRotate(turntableEnabled);
    return;
  }

  modelViewer.autoRotate = turntableEnabled;
}

async function activateGlbAsset(asset, swapId) {
  const resolvedSource = warmCacheEnabled ? await getModelUrl(asset.src) : asset.src;
  if (swapId !== activeAssetSwapId) {
    return;
  }

  plyViewer.dispose();
  sogViewer.dispose();
  updateViewerLayerVisibility("glb");
  currentEngineType = "glb";
  currentActiveAsset = asset;
  currentAssetKey = asset.key;
  modelViewer.autoRotate = turntableEnabled;
  applyGlbView(asset);
  modelViewer.src = resolvedSource;
  await modelViewer.updateComplete;
}

async function activateSplatAsset(asset, swapId) {
  if (swapId !== activeAssetSwapId) {
    return;
  }

  const viewer = asset.runtime === "playcanvas" ? sogViewer : plyViewer;
  const inactiveViewer = viewer === sogViewer ? plyViewer : sogViewer;

  inactiveViewer.dispose();
  updateViewerLayerVisibility("splat");
  currentEngineType = "splat";
  currentActiveAsset = asset;
  currentAssetKey = asset.key;
  setProgress(0.22);
  await viewer.load(
    {
      ...asset,
      autoRotate: turntableEnabled,
    },
    splatProfile,
    (nextState) => {
      if (swapId !== activeAssetSwapId) {
        return;
      }

      if (nextState.status === "loading") {
        setProgress(0.56);
      }

      setStatus(nextState.title, nextState.message);
    }
  );
}

async function applyActiveAssetSelection() {
  const nextAsset = getActiveAssetDescriptor();
  if (!nextAsset) {
    return;
  }

  const swapId = ++activeAssetSwapId;

  if (nextAsset.key === currentAssetKey && nextAsset.type === currentEngineType) {
    setStatusOverlayState(false);
    setStatus("Scene ready", `${describeActiveAsset(nextAsset)} is already active.`);
    updateMaterialToggle();
    updateQualityToggle();
    return;
  }

  setControlsBusy(true);
  setStatusOverlayState(false);
  setStatus("Switching scene", `Loading ${describeActiveAsset(nextAsset)}...`);

  try {
    if (nextAsset.type === "splat") {
      await activateSplatAsset(nextAsset, swapId);
      if (swapId !== activeAssetSwapId) {
        return;
      }

      document.body.classList.add("is-loaded");
      document.body.classList.remove("is-error");
      setProgress(1);
      setStatus(
        "3D hero active",
        `${describeActiveAsset(nextAsset)} is loaded in ${FORMAT_LABELS[nextAsset.format] || "splat"} mode.`
      );
      requestAnimationFrame(() => {
        if (swapId === activeAssetSwapId) {
          setStatusOverlayState(true);
        }
      });
    } else {
      await activateGlbAsset(nextAsset, swapId);
    }
  } catch (error) {
    if (swapId !== activeAssetSwapId) {
      return;
    }

    document.body.classList.add("is-error");
    setStatusOverlayState(false);
    setStatus("Asset issue", error?.message || "The selected scene did not render correctly.");
  } finally {
    if (swapId === activeAssetSwapId) {
      setControlsBusy(false);
      updateMaterialToggle();
      updateQualityToggle();
    }
  }
}

async function setActiveTimeStage(stage, direction = 0) {
  if (!timeStages.includes(stage)) {
    return;
  }

  activeLocationStage = "outdoors";
  activeTimeStage = stage;
  activeFormat = "glb";
  updateLocationUi();
  updateQualityToggle();
  updateMaterialToggle();
  updateTimeUi(direction);
  await applyActiveAssetSelection();
}

async function setActiveLocationStage(stage) {
  if (!LOCATION_CATALOG[stage] || stage === activeLocationStage) {
    return;
  }

  activeLocationStage = stage;
  activeSceneId = null;
  if (stage === "outdoors") {
    activeFormat = "glb";
  } else {
    normalizeActiveScene();
    normalizeActiveFormat();
  }
  updateLocationUi();
  updateQualityToggle();
  updateMaterialToggle();
  await applyActiveAssetSelection();
}

async function setActiveScene(sceneId) {
  const scenes = getCurrentSceneCollection();
  if (!scenes.some((scene) => scene.id === sceneId) || sceneId === activeSceneId) {
    return;
  }

  activeSceneId = sceneId;
  normalizeActiveFormat();
  updateLocationUi();
  updateQualityToggle();
  updateMaterialToggle();
  await applyActiveAssetSelection();
}

async function setActiveFormat(format) {
  const availableFormats = getAvailableFormats();
  if (!availableFormats.includes(format) || format === activeFormat) {
    return;
  }

  activeFormat = format;
  updateLocationUi();
  updateQualityToggle();
  updateMaterialToggle();
  await applyActiveAssetSelection();
}

function changeStageBy(step) {
  const currentIndex = timeStages.indexOf(activeTimeStage);
  const nextIndex = (currentIndex + step + timeStages.length) % timeStages.length;
  setActiveTimeStage(timeStages[nextIndex], step);
}

function getPointerAngle(event) {
  const rect = timeDial.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const angle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI) + 90;
  return angle < 0 ? angle + 360 : angle;
}

function normalizeAngleDelta(start, end) {
  let delta = end - start;

  if (delta > 180) {
    delta -= 360;
  }

  if (delta < -180) {
    delta += 360;
  }

  return delta;
}

modelViewer.addEventListener("progress", (event) => {
  if (currentEngineType !== "glb") {
    return;
  }

  setStatusOverlayState(false);
  setProgress(event.detail.totalProgress);
  setStatus(
    event.detail.totalProgress >= 1 ? "Scene ready" : "Loading scene",
    `${Math.round(event.detail.totalProgress * 100)}% complete`
  );
});

modelViewer.addEventListener("load", async () => {
  if (currentEngineType !== "glb") {
    return;
  }

  document.body.classList.add("is-loaded");
  document.body.classList.remove("is-error");
  setProgress(1);
  setStatus("3D hero active", `${describeActiveAsset()} is loaded.`);
  cacheMaterialState();
  await resetGlbViewAfterLoad();
  applyTurntableState();

  if (clayEnabled) {
    applyClayMaterials();
  }

  requestAnimationFrame(() => {
    setStatusOverlayState(true);
  });
});

modelViewer.addEventListener("error", (event) => {
  if (currentEngineType !== "glb") {
    return;
  }

  document.body.classList.add("is-error");
  setStatusOverlayState(false);
  setStatus("Asset issue", event.detail?.type || "The model did not render correctly.");
  setControlsBusy(false);
});

resetCamera.addEventListener("click", () => {
  resetActiveViewer();
});

fullscreenToggle.addEventListener("click", async () => {
  const hero = document.querySelector(".hero");
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }

  await hero.requestFullscreen();
});

warmCacheToggle.addEventListener("click", () => {
  warmCacheEnabled = !warmCacheEnabled;
  updateWarmCacheToggle();
  if (warmCacheEnabled) {
    warmModelCache();
  }
});

qualityToggle.addEventListener("click", async () => {
  if (activeLocationStage !== "outdoors") {
    return;
  }

  const outdoorCatalog = LOCATION_CATALOG.outdoors;
  if (!outdoorCatalog.qualityAvailability?.[activeTimeStage]) {
    return;
  }

  hdEnabled = !hdEnabled;
  updateQualityToggle();
  await applyActiveAssetSelection();
});

turntableToggle.addEventListener("click", () => {
  turntableEnabled = !turntableEnabled;
  updateTurntableUi();
  applyTurntableState();
});

materialToggle.addEventListener("click", () => {
  if (currentEngineType !== "glb") {
    return;
  }

  clayEnabled = !clayEnabled;
  materialToggle.setAttribute("aria-pressed", String(clayEnabled));
  materialToggle.setAttribute("aria-label", clayEnabled ? "Textured View" : "Clay View");
  materialToggle.title = clayEnabled ? "Textured View" : "Clay View";

  if (clayEnabled) {
    applyClayMaterials();
  } else {
    restoreMaterials();
  }
});

timeDial.addEventListener("click", (event) => {
  if (skipNextDialClick) {
    skipNextDialClick = false;
    return;
  }

  event.preventDefault();
  changeStageBy(1);
});

timeDial.addEventListener("pointerdown", (event) => {
  dialPointerId = event.pointerId;
  dialStartAngle = getPointerAngle(event);
  dialDragged = false;
  timeDial.setPointerCapture(event.pointerId);
});

timeDial.addEventListener("pointermove", (event) => {
  if (event.pointerId !== dialPointerId) {
    return;
  }

  const currentAngle = getPointerAngle(event);
  const delta = normalizeAngleDelta(dialStartAngle, currentAngle);

  if (Math.abs(delta) > 10) {
    dialDragged = true;
  }

  if (dialDragged) {
    timeDial.style.setProperty("--orbit-rotation", `${currentStageRotation + delta}deg`);
  }
});

timeDial.addEventListener("pointerup", (event) => {
  if (event.pointerId !== dialPointerId) {
    return;
  }

  timeDial.releasePointerCapture(event.pointerId);
  const endAngle = getPointerAngle(event);
  const delta = normalizeAngleDelta(dialStartAngle, endAngle);

  if (dialDragged && Math.abs(delta) > 18) {
    skipNextDialClick = true;
    changeStageBy(delta > 0 ? 1 : -1);
  } else {
    updateTimeUi();
  }

  dialPointerId = null;
  dialStartAngle = 0;
  dialDragged = false;
});

timeDial.addEventListener("pointercancel", (event) => {
  if (event.pointerId !== dialPointerId) {
    return;
  }

  timeDial.releasePointerCapture(event.pointerId);
  dialPointerId = null;
  dialStartAngle = 0;
  dialDragged = false;
  updateTimeUi();
});

for (const marker of timeStageMarkers) {
  marker.addEventListener("click", () => {
    const stage = marker.dataset.stage;
    if (!stage || stage === activeTimeStage) {
      return;
    }

    const currentIndex = timeStages.indexOf(activeTimeStage);
    const targetIndex = timeStages.indexOf(stage);
    const direction = targetIndex > currentIndex ? 1 : -1;
    setActiveTimeStage(stage, direction);
  });
}

for (const marker of locationStageMarkers) {
  marker.addEventListener("click", () => {
    const stage = marker.dataset.location;
    if (!stage) {
      return;
    }

    setActiveLocationStage(stage);
  });
}

document.addEventListener("scroll", () => {
  siteHeader.classList.toggle("is-solid", window.scrollY > 24);
});

document.addEventListener("fullscreenchange", () => {
  const fullscreenLabel = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
  fullscreenToggle.setAttribute("aria-label", fullscreenLabel);
  fullscreenToggle.title = fullscreenLabel;
});

updateWarmCacheToggle();
updateLocationUi();
updateQualityToggle();
updateMaterialToggle();
updateTimeUi();
updateTurntableUi();
setStatusOverlayState(false);
warmModelCache();
applyTurntableState();

setProgress(0.08);
setStatus("Loading scene", "Preparing the 3D viewer and resolving the active campus scene.");
applyActiveAssetSelection();

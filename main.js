import { LOCATION_CATALOG } from "./viewer/sceneCatalog.js?v=20260604a";
import { SiteSplatViewer } from "./viewer/splatViewer.js?v=20260604a";
import { PlayCanvasSogViewer } from "./viewer/playCanvasSogViewer.js?v=20260604a";

let modelViewer = document.getElementById("siteModel");
const splatViewerMount = document.getElementById("splatViewerMount");
const orbitTargetIndicator = document.getElementById("orbitTargetIndicator");
const siteHeader = document.getElementById("siteHeader");
const progressBar = document.getElementById("progressBar");
const statusPill = document.getElementById("statusPill");
const statusCopy = document.getElementById("statusCopy");
const viewerStatus = document.getElementById("viewerStatus");
const fullscreenToggle = document.getElementById("fullscreenToggle");
const warmCacheToggle = document.getElementById("warmCacheToggle");
const qualityToggle = document.getElementById("qualityToggle");
const timeDial = document.getElementById("timeDial");
const timeControlGroup = document.getElementById("timeControlGroup");
const timeStageMarkers = [...document.querySelectorAll(".time-stage-marker")];
const navigationGroups = document.getElementById("navigationGroups");
const formatControl = document.getElementById("formatControl");
const formatStageMarkers = document.getElementById("formatStageMarkers");
const lodControl = document.getElementById("lodControl");
const lodMarkers = document.getElementById("lodMarkers");
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
const deviceMemory = Number.isFinite(navigator.deviceMemory) ? navigator.deviceMemory : null;
const hardwareConcurrency = Number.isFinite(navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : null;
const useBlobPreloading = !isMobileDevice;

const SOG_ADAPTIVE_PERFORMANCE = {
  minDpr: 0.65,
  dprStep: 0.15,
  lowFpsThreshold: 35,
  highFpsThreshold: 50,
  sampleIntervalMs: 1000,
  downgradeHoldMs: 3000,
  upgradeHoldMs: 5000,
};

let sogPerformanceMonitor = null;

function getAutoPerformanceProfile() {
  if (isMobileDevice) {
    if ((deviceMemory && deviceMemory <= 4) || (hardwareConcurrency && hardwareConcurrency <= 6)) {
      return { tier: "lod4", maxDpr: 0.85 };
    }

    return { tier: "lod3", maxDpr: 1 };
  }

  if ((deviceMemory && deviceMemory <= 4) || (hardwareConcurrency && hardwareConcurrency <= 4)) {
    return { tier: "lod3", maxDpr: 1.1 };
  }

  return { tier: "lod1", maxDpr: 1.35 };
}

const autoPerformanceProfile = getAutoPerformanceProfile();
const splatProfile = {
  maxDpr: autoPerformanceProfile.maxDpr,
};

function getPerformanceTierRank(tier) {
  switch (tier) {
    case "lod4":
      return 0;
    case "lod3":
      return 1;
    case "lod2":
      return 2;
    case "lod1":
    default:
      return 3;
  }
}

function getSogAssetForPerformanceTier(asset, tier) {
  if (!asset || asset.type !== "splat" || asset.fileFormat !== "sog") {
    return null;
  }

  const normalizedTier = ["lod1", "lod2", "lod3", "lod4"].includes(tier) ? tier : "lod1";
  
  if (normalizedTier === "lod1") {
    const originalSrc = asset.originalSrc || asset.src;
    if (!originalSrc) {
      return null;
    }

    const lod1Source = asset.performanceSources?.lod1 || originalSrc;

    return {
      ...asset,
      src: lod1Source,
      performanceTier: "lod1",
    };
  }

  const tierSource = asset.performanceSources?.[normalizedTier];
  if (!tierSource) {
    return null;
  }

  return {
    ...asset,
    src: tierSource,
    performanceTier: normalizedTier,
  };
}

function getLowerSogAsset(asset) {
  if (!asset || asset.type !== "splat" || asset.fileFormat !== "sog") {
    return null;
  }

  const ranks = ["lod1", "lod2", "lod3", "lod4"];
  const currentIndex = ranks.indexOf(asset.performanceTier);
  if (currentIndex === -1 || currentIndex === ranks.length - 1) return null;

  for (let i = currentIndex + 1; i < ranks.length; i++) {
    const nextAsset = getSogAssetForPerformanceTier(asset, ranks[i]);
    if (nextAsset) return nextAsset;
  }

  return null;
}

function getHigherSogAsset(asset) {
  if (!asset || asset.type !== "splat" || asset.fileFormat !== "sog") {
    return null;
  }

  const ranks = ["lod1", "lod2", "lod3", "lod4"];
  const currentIndex = ranks.indexOf(asset.performanceTier);
  if (currentIndex <= 0) return null;

  for (let i = currentIndex - 1; i >= 0; i--) {
    const nextAsset = getSogAssetForPerformanceTier(asset, ranks[i]);
    if (nextAsset) return nextAsset;
  }

  return null;
}

function stopSogPerformanceMonitor() {
  if (sogPerformanceMonitor?.frameRequestId) {
    cancelAnimationFrame(sogPerformanceMonitor.frameRequestId);
  }
  sogPerformanceMonitor = null;
}

function startSogPerformanceMonitor(asset) {
  stopSogPerformanceMonitor();

  if (!asset || asset.type !== "splat" || asset.runtime !== "playcanvas" || currentEngineType !== "splat") {
    return;
  }

  const monitor = {
    assetKey: asset.key,
    lastTimestamp: performance.now(),
    sampleStart: performance.now(),
    sampleFrames: 0,
    stableHighSince: null,
    stableLowSince: null,
    currentDpr: Math.max(0.5, Math.min(autoPerformanceProfile.maxDpr || 1, window.devicePixelRatio || 1)),
  };
  sogPerformanceMonitor = monitor;

  const tick = (timestamp) => {
    if (!sogPerformanceMonitor || sogPerformanceMonitor.assetKey !== asset.key) {
      return;
    }

    monitor.sampleFrames += 1;
    monitor.lastTimestamp = timestamp;
    const elapsed = timestamp - monitor.sampleStart;

    if (elapsed >= SOG_ADAPTIVE_PERFORMANCE.sampleIntervalMs) {
      const fps = Math.max(0, Math.round((monitor.sampleFrames * 1000) / elapsed));
      monitor.sampleFrames = 0;
      monitor.sampleStart = timestamp;
      evaluateSogPerformance(asset, fps, timestamp, monitor);
    }

    monitor.frameRequestId = requestAnimationFrame(tick);
  };

  monitor.frameRequestId = requestAnimationFrame(tick);
}

function evaluateSogPerformance(asset, fps, timestamp, monitor) {
  if (currentEngineType !== "splat" || !currentActiveAsset || currentActiveAsset.key !== monitor.assetKey) {
    stopSogPerformanceMonitor();
    return;
  }

  const activeAsset = currentActiveAsset;
  const maxDpr = autoPerformanceProfile.maxDpr;
  let targetDpr = monitor.currentDpr;

  if (fps >= SOG_ADAPTIVE_PERFORMANCE.highFpsThreshold) {
    monitor.stableHighSince = monitor.stableHighSince || timestamp;
    monitor.stableLowSince = null;
  } else if (fps <= SOG_ADAPTIVE_PERFORMANCE.lowFpsThreshold) {
    monitor.stableLowSince = monitor.stableLowSince || timestamp;
    monitor.stableHighSince = null;
  } else {
    monitor.stableHighSince = null;
    monitor.stableLowSince = null;
  }

  if (fps < SOG_ADAPTIVE_PERFORMANCE.lowFpsThreshold) {
    targetDpr = Math.max(SOG_ADAPTIVE_PERFORMANCE.minDpr, monitor.currentDpr - SOG_ADAPTIVE_PERFORMANCE.dprStep);
  } else if (fps > SOG_ADAPTIVE_PERFORMANCE.highFpsThreshold) {
    targetDpr = Math.min(maxDpr, monitor.currentDpr + SOG_ADAPTIVE_PERFORMANCE.dprStep);
  }

  if (targetDpr !== monitor.currentDpr) {
    monitor.currentDpr = targetDpr;
    sogViewer.setMaxDpr(targetDpr);
  }

  if (monitor.stableLowSince && timestamp - monitor.stableLowSince >= SOG_ADAPTIVE_PERFORMANCE.downgradeHoldMs) {
    const lowerAsset = getLowerSogAsset(activeAsset);
    if (lowerAsset) {
      stopSogPerformanceMonitor();
      reloadSogAsset(lowerAsset, { silent: true });
      return;
    }
  }

  if (monitor.stableHighSince && timestamp - monitor.stableHighSince >= SOG_ADAPTIVE_PERFORMANCE.upgradeHoldMs) {
    const higherAsset = getHigherSogAsset(activeAsset);
    if (higherAsset) {
      stopSogPerformanceMonitor();
      reloadSogAsset(higherAsset, { silent: true });
      return;
    }
  }
}

async function reloadSogAsset(asset, options = {}) {
  const swapId = ++activeAssetSwapId;
  try {
    await activateSplatAsset(asset, swapId, { silent: !!options.silent });
  } catch (error) {
    if (!options.silent) {
      document.body.classList.add("is-error");
      setStatusOverlayState(false);
      setStatus("Asset issue", error?.message || "The selected scene did not render correctly.");
    }
  }
}

let activeTimeStage = "day";
let activeSiteId = "campus";
let activeEnvironmentId = "outside";
let activeLocationStage = "outdoors";
let activeBuildingId = "main";
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
let sogPanIndicatorVisible = false;
let dialPointerId = null;
let dialStartAngle = 0;
let dialDragged = false;
let skipNextDialClick = false;
const preloadedModelUrls = new Map();
const preloadPromises = new Map();
const preloadAbortControllers = new Map();
const preloadLinkElements = new Map();
const plyViewer = new SiteSplatViewer(splatViewerMount);
const sogViewer = new PlayCanvasSogViewer(splatViewerMount);

const FORMAT_LABELS = {
  glb: "GLB",
  splat: "PLY",
  sog: "SOG",
};
const FORMAT_PRIORITY = ["sog", "glb", "splat"];
const GITHUB_MEDIA_BASE_URL = "https://media.githubusercontent.com/media/Petrakous/Hua-3D-Showcase/main/";
const GITHUB_RAW_BASE_URL = "https://raw.githubusercontent.com/Petrakous/Hua-3D-Showcase/main/";

function encodeUrlPathSegments(path = "") {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
const CAMPUS_INDOOR_BUILDINGS = [
  {
    id: "main",
    label: "Main",
    spaces: [
      { id: "main-hall", label: "Main Hall", sceneId: "main-hall" },
      { id: "amphitheater", label: "Amphitheater", sceneId: "amphitheater" },
      { id: "classroom-5", label: "Classroom 5", sceneId: "classroom-5" },
      { id: "biology", label: "Biology", sceneId: "biology-lab" },
    ],
  },
  {
    id: "geo",
    label: "Geo",
    spaces: [
      { id: "lab-3-3", label: "Lab 3.3", sceneId: "geo3-3" },
      { id: "systasis", label: "Systasis", sceneId: "systasis" },
      { id: "fitness", label: "Fitness", sceneId: "fitness" },
      { id: "ceremonial-hall", label: "Ceremonial Hall", sceneId: null },
    ],
  },
  {
    id: "diet",
    label: "Diet",
    spaces: [
      { id: "metabolism", label: "Metabolism", sceneId: "metabolism" },
      { id: "kitchen", label: "Kitchen", sceneId: "kitchen" },
    ],
  },
];
const DIT_INSIDE_SPACES = [
  { id: "pc-lab", label: "PC Lab", sceneId: null },
];

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

function sortFormats(formats = []) {
  return [...formats].sort((left, right) => {
    const leftIndex = FORMAT_PRIORITY.indexOf(left);
    const rightIndex = FORMAT_PRIORITY.indexOf(right);
    const safeLeftIndex = leftIndex === -1 ? FORMAT_PRIORITY.length : leftIndex;
    const safeRightIndex = rightIndex === -1 ? FORMAT_PRIORITY.length : rightIndex;

    if (safeLeftIndex !== safeRightIndex) {
      return safeLeftIndex - safeRightIndex;
    }

    return left.localeCompare(right);
  });
}

function getCampusIndoorScenes() {
  return LOCATION_CATALOG.indoors?.scenes || [];
}

function getCampusIndoorSceneById(sceneId) {
  return getCampusIndoorScenes().find((scene) => scene.id === sceneId) || null;
}

function getCampusBuilding(buildingId = activeBuildingId) {
  return CAMPUS_INDOOR_BUILDINGS.find((building) => building.id === buildingId) || null;
}

function isCampusSpaceAvailable(space) {
  return !!space?.sceneId && !!getCampusIndoorSceneById(space.sceneId);
}

function getEnabledCampusSpaces(buildingId = activeBuildingId) {
  return (getCampusBuilding(buildingId)?.spaces || []).filter(isCampusSpaceAvailable);
}

function getActiveCampusSpace() {
  return (getCampusBuilding()?.spaces || []).find((space) => space.sceneId === activeSceneId) || null;
}

function isTimeSelectionVisible() {
  return activeEnvironmentId === "outside";
}

function isCampusOutsideSelected() {
  return activeSiteId === "campus" && activeEnvironmentId === "outside";
}

function isDitOutsideSelected() {
  return activeSiteId === "dit" && activeEnvironmentId === "outside";
}

function isTimeStageAvailable(stage) {
  if (activeSiteId === "campus") {
    const stageAssets = LOCATION_CATALOG.outdoors?.stages?.[stage] || {};
    return Object.values(stageAssets).some((assetsByQuality) => Object.keys(assetsByQuality || {}).length > 0);
  }

  if (activeSiteId === "dit") {
    return stage === "dusk" && !!LOCATION_CATALOG.dit?.scene?.assets?.glb;
  }

  return false;
}

function getFirstAvailableTimeStage() {
  return timeStages.find((stage) => isTimeStageAvailable(stage)) || timeStages[0];
}

function hasMultipleAvailableTimeStages() {
  return timeStages.filter((stage) => isTimeStageAvailable(stage)).length > 1;
}

function getCurrentContextLabel() {
  const siteLabel = activeSiteId === "dit" ? "DIT" : "Campus";
  const environmentLabel = activeEnvironmentId === "inside" ? "Inside" : "Outside";

  if (activeEnvironmentId === "outside") {
    return `${siteLabel} / ${environmentLabel} / ${timeLabels[activeTimeStage]}`;
  }

  if (activeSiteId === "campus") {
    const building = getCampusBuilding();
    const space = getActiveCampusSpace();
    if (building?.label && space?.label) {
      return `${siteLabel} / ${environmentLabel} / ${building.label} / ${space.label}`;
    }
  }

  return `${siteLabel} / ${environmentLabel}`;
}

function getPreferredFormat(scene) {
  return sortFormats(Object.keys(scene?.assets || {}))[0] || "glb";
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
  const locationEntry = getCurrentLocationEntry();
  const scenes = getCurrentSceneCollection();
  if (!scenes.length) {
    return null;
  }

  if (locationEntry?.kind === "single-scene") {
    return scenes[0];
  }

  if (activeSceneId) {
    const exactMatch = scenes.find((scene) => scene.id === activeSceneId);
    if (exactMatch) {
      return exactMatch;
    }
  }

  return null;
}

function normalizeActiveScene() {
  if (activeSiteId === "campus" && activeEnvironmentId === "inside") {
    const enabledSpaces = getEnabledCampusSpaces();
    const enabledSceneIds = enabledSpaces.map((space) => space.sceneId);
    if (!enabledSceneIds.length) {
      activeSceneId = null;
      return;
    }

    if (!enabledSceneIds.includes(activeSceneId)) {
      activeSceneId = enabledSceneIds[0];
    }
    return;
  }

  if (activeSiteId === "dit" && activeEnvironmentId === "inside") {
    activeSceneId = null;
    return;
  }

  const locationEntry = getCurrentLocationEntry();
  const scenes = getCurrentSceneCollection();

  if (!scenes.length) {
    activeSceneId = null;
    return;
  }

  if (locationEntry?.kind === "single-scene") {
    activeSceneId = locationEntry.scene?.id || scenes[0].id;
    return;
  }

  const hasExactScene = activeSceneId && scenes.some((scene) => scene.id === activeSceneId);
  if (hasExactScene) {
    return;
  }

  activeSceneId = null;
}

function syncNavigationState() {
  if (activeSiteId === "campus") {
    if (activeEnvironmentId === "outside") {
      activeLocationStage = "outdoors";
      activeSceneId = null;
    } else {
      activeLocationStage = "indoors";
      if (!getCampusBuilding(activeBuildingId)) {
        activeBuildingId = CAMPUS_INDOOR_BUILDINGS[0]?.id || "main";
      }
      normalizeActiveScene();
    }
    return;
  }

  activeLocationStage = "dit";
  if (activeEnvironmentId === "outside") {
    if (!isTimeStageAvailable(activeTimeStage)) {
      activeTimeStage = getFirstAvailableTimeStage();
    }
    activeSceneId = LOCATION_CATALOG.dit?.scene?.id || null;
    return;
  }

  activeSceneId = null;
}

function getAvailableFormats() {
  syncNavigationState();

  if (activeSiteId === "dit" && activeEnvironmentId === "inside") {
    return [];
  }

  const locationEntry = getCurrentLocationEntry();
  if (!locationEntry) {
    return ["glb"];
  }

  if (isCampusOutsideSelected()) {
    const stageAssets = locationEntry.stages?.[activeTimeStage] || {};
    const outdoorFormats = Object.keys(stageAssets);
    const outdoorPriority = ["glb", "sog"];
    return outdoorFormats.sort((left, right) => {
      const leftIndex = outdoorPriority.indexOf(left);
      const rightIndex = outdoorPriority.indexOf(right);
      const safeLeftIndex = leftIndex === -1 ? outdoorPriority.length : leftIndex;
      const safeRightIndex = rightIndex === -1 ? outdoorPriority.length : rightIndex;

      if (safeLeftIndex !== safeRightIndex) {
        return safeLeftIndex - safeRightIndex;
      }

      return left.localeCompare(right);
    });
  }

  normalizeActiveScene();
  const scene = getCurrentSceneEntry();
  return sortFormats(Object.keys(scene?.assets || {}));
}

function normalizeActiveFormat() {
  const availableFormats = getAvailableFormats();
  if (!availableFormats.length) {
    activeFormat = "glb";
    return;
  }

  if (!availableFormats.includes(activeFormat)) {
    activeFormat = availableFormats[0] || "glb";
  }
}

function getOutdoorAsset(stage, qualityKey, formatKey = activeFormat) {
  const outdoorCatalog = LOCATION_CATALOG.outdoors;
  const stageAssets = outdoorCatalog.stages?.[stage]?.[formatKey] || outdoorCatalog.stages?.[stage]?.glb || {};
  const mobileStageAssets = outdoorCatalog.mobileStages?.[stage]?.[formatKey] || {};

  if (isMobileDevice && mobileStageAssets?.[qualityKey]) {
    return mobileStageAssets[qualityKey];
  }

  return stageAssets[qualityKey] || stageAssets.web || Object.values(stageAssets)[0] || null;
}

function selectPerformanceSogAsset(asset) {
  if (!asset || asset.type !== "splat" || asset.fileFormat !== "sog") {
    return asset;
  }

  const tier = autoPerformanceProfile.tier;
  const performanceSources = asset.performanceSources || {};
  let nextSrc = asset.src;
  let performanceTier = "lod1";

  if (tier === "lod4") {
    nextSrc = performanceSources.lod4 || performanceSources.lod3 || performanceSources.lod2 || performanceSources.lod1 || asset.src;
    performanceTier = "lod4";
  } else if (tier === "lod3") {
    nextSrc = performanceSources.lod3 || performanceSources.lod4 || performanceSources.lod2 || performanceSources.lod1 || asset.src;
    performanceTier = "lod3";
  } else if (tier === "lod2") {
    nextSrc = performanceSources.lod2 || performanceSources.lod1 || performanceSources.lod3 || performanceSources.lod4 || asset.src;
    performanceTier = "lod2";
  } else {
    nextSrc = performanceSources.lod1 || asset.src;
    performanceTier = "lod1";
  }

  if (nextSrc === asset.src && !performanceSources[performanceTier]) {
      performanceTier = "lod1"; 
  } else {
      if (nextSrc === performanceSources.lod4) performanceTier = "lod4";
      else if (nextSrc === performanceSources.lod3) performanceTier = "lod3";
      else if (nextSrc === performanceSources.lod2) performanceTier = "lod2";
      else if (nextSrc === performanceSources.lod1) performanceTier = "lod1";
  }

  return {
    ...asset,
    src: nextSrc,
    originalSrc: asset.src,
    performanceTier,
  };
}

function getActiveAssetDescriptor() {
  syncNavigationState();
  normalizeActiveFormat();

  if (isCampusOutsideSelected()) {
    const qualityKey = hdEnabled ? "hd" : "web";
    const asset = getOutdoorAsset(activeTimeStage, qualityKey, activeFormat);
    return selectPerformanceSogAsset({
      ...asset,
      key: `outdoors:${activeTimeStage}:${activeFormat}:${qualityKey}`,
      label: `${timeLabels[activeTimeStage]}${hdEnabled ? " HD" : ""}`,
      locationId: "outdoors",
      format: activeFormat,
    });
  }

  if (activeSiteId === "dit") {
    if (activeEnvironmentId !== "outside" || activeTimeStage !== "dusk") {
      return null;
    }

    const scene = LOCATION_CATALOG.dit?.scene;
    const asset = scene?.assets?.[activeFormat] || scene?.assets?.glb || Object.values(scene?.assets || {})[0];
    if (!asset) {
      return null;
    }

    return selectPerformanceSogAsset({
      ...asset,
      key: `dit:outside:${activeTimeStage}:${activeFormat}`,
      label: scene.label,
      locationId: "dit",
      format: activeFormat,
    });
  }

  const locationEntry = getCurrentLocationEntry();
  normalizeActiveScene();
  const scene = getCurrentSceneEntry();
  const asset = scene?.assets?.[activeFormat] || scene?.assets?.glb || Object.values(scene?.assets || {})[0];

  if (!asset) {
    return null;
  }

  return selectPerformanceSogAsset({
    ...asset,
    key: `${locationEntry.id}:${scene.id}:${activeFormat}`,
    label: scene.label,
    locationId: locationEntry.id,
    format: activeFormat,
  });
}

function describeActiveAsset(asset = getActiveAssetDescriptor()) {
  if (!asset) {
    return getCurrentContextLabel();
  }

  const tierMap = { lod1: "LOD1", lod2: "LOD2", lod3: "LOD3", lod4: "LOD4" };
  const tierName = tierMap[asset.performanceTier] || asset.performanceTier;

  if (isCampusOutsideSelected()) {
    const tierSuffix = asset.performanceTier && asset.performanceTier !== "lod1"
      ? ` / ${tierName}`
      : "";
    return `${getCurrentContextLabel()} (${FORMAT_LABELS[asset.format] || "GLB"}${tierSuffix})`;
  }

  const formatLabel = FORMAT_LABELS[asset.format] || FORMAT_LABELS[asset.fileFormat] || "GLB";
  const tierSuffix = asset.performanceTier && asset.performanceTier !== "lod1"
    ? ` / ${tierName}`
    : "";
  return `${getCurrentContextLabel()} (${formatLabel}${tierSuffix})`;
}

function getActiveOverlayViewer() {
  if (currentEngineType !== "splat") {
    return null;
  }

  return currentActiveAsset?.runtime === "playcanvas" ? sogViewer : plyViewer;
}

function createModelViewerElement() {
  const element = document.createElement("model-viewer");
  element.id = "siteModel";
  element.setAttribute("alt", "3D model of the campus");
  element.setAttribute("camera-controls", "");
  element.setAttribute("interaction-prompt", "none");
  element.setAttribute("environment-image", "neutral");
  element.setAttribute("exposure", "1.35");
  element.setAttribute("shadow-intensity", "0.9");
  element.setAttribute("tone-mapping", "commerce");
  element.setAttribute("camera-orbit", "180deg 75deg auto");
  element.setAttribute("min-camera-orbit", "auto 55deg auto");
  element.setAttribute("max-camera-orbit", "auto 85deg auto");
  element.setAttribute("field-of-view", "24deg");
  element.setAttribute("min-field-of-view", "5deg");
  element.setAttribute("max-field-of-view", "40deg");
  element.setAttribute("interpolation-decay", "140");
  element.setAttribute("touch-action", "none");
  element.setAttribute("orientation", "0deg 0deg 0deg");
  element.setAttribute("camera-target", "auto auto auto");
  element.setAttribute("loading", "eager");

  if (turntableEnabled) {
    element.setAttribute("auto-rotate", "");
    element.setAttribute("auto-rotate-delay", "0");
    element.setAttribute("rotation-per-second", "-10deg");
  }

  return element;
}

function bindModelViewerEvents(element) {
  element.addEventListener("progress", handleModelViewerProgress);
  element.addEventListener("load", handleModelViewerLoad);
  element.addEventListener("error", handleModelViewerError);
}

function replaceModelViewerElement() {
  const nextModelViewer = createModelViewerElement();
  nextModelViewer.hidden = modelViewer.hidden;
  nextModelViewer.setAttribute("aria-hidden", modelViewer.getAttribute("aria-hidden") || "false");
  modelViewer.replaceWith(nextModelViewer);
  modelViewer = nextModelViewer;
  bindModelViewerEvents(modelViewer);
  return modelViewer;
}

function updateViewerLayerVisibility(engineType) {
  const showGlb = engineType === "glb";
  const showSplat = engineType === "splat";
  modelViewer.hidden = !showGlb;
  modelViewer.setAttribute("aria-hidden", String(!showGlb));
  splatViewerMount.hidden = !showSplat;
  splatViewerMount.setAttribute("aria-hidden", String(!showSplat));
  updateOrbitTargetIndicatorVisibility();
}

function updateOrbitTargetIndicatorVisibility() {
  const shouldShow =
    sogPanIndicatorVisible &&
    currentEngineType === "splat" &&
    currentActiveAsset?.runtime === "playcanvas";
  orbitTargetIndicator.classList.toggle("is-visible", shouldShow);
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

function revokeObjectUrl(url) {
  if (typeof url === "string" && url.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function clearWarmModelCache() {
  const protectedUrl = modelViewer?.src || "";

  for (const controller of preloadAbortControllers.values()) {
    controller.abort();
  }
  preloadAbortControllers.clear();

  for (const link of preloadLinkElements.values()) {
    link.remove();
  }
  preloadLinkElements.clear();

  for (const url of preloadedModelUrls.values()) {
    if (url !== protectedUrl) {
      revokeObjectUrl(url);
    }
  }
  preloadedModelUrls.clear();
  preloadPromises.clear();
}

function releaseActiveViewerResources({ preserveWarmCache = warmCacheEnabled } = {}) {
  plyViewer.dispose();
  sogViewer.dispose();
  stopSogPerformanceMonitor();
  replaceModelViewerElement();
  currentEngineType = "none";
  currentActiveAsset = null;
  sogPanIndicatorVisible = false;
  updateViewerLayerVisibility("none");
  document.body.classList.remove("is-loaded");
  document.body.classList.remove("is-error");
  originalMaterials = [];
  currentAssetKey = "";

  if (!preserveWarmCache) {
    clearWarmModelCache();
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
  preloadLinkElements.set(src, link);
  const controller = new AbortController();
  preloadAbortControllers.set(src, controller);

  if (!useBlobPreloading) {
    const preloadPromise = fetch(src, { cache: "force-cache", signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to warm model cache: ${src}`);
        }

        preloadedModelUrls.set(src, src);
        return src;
      })
      .catch((error) => {
        if (error?.name === "AbortError") {
          return null;
        }

        return src;
      })
      .finally(() => {
        preloadPromises.delete(src);
        preloadAbortControllers.delete(src);
        preloadLinkElements.get(src)?.remove?.();
        preloadLinkElements.delete(src);
      });

    preloadPromises.set(src, preloadPromise);
    return preloadPromise;
  }

  const preloadPromise = fetch(src, { cache: "force-cache", signal: controller.signal })
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
    .catch((error) => {
      if (error?.name === "AbortError") {
        return null;
      }

      return src;
    })
    .finally(() => {
      preloadPromises.delete(src);
      preloadAbortControllers.delete(src);
      preloadLinkElements.get(src)?.remove?.();
      preloadLinkElements.delete(src);
    });

  preloadPromises.set(src, preloadPromise);
  return preloadPromise;
}

async function getModelUrl(src) {
  if (preloadedModelUrls.has(src)) {
    return preloadedModelUrls.get(src);
  }

  return (await preloadModel(src)) || src;
}

function resolveHostedSogUrl(src) {
  if (!src || !/\.sog(?:$|\?)/i.test(src)) {
    return src;
  }

  if (/^https?:\/\//i.test(src)) {
    return src;
  }

  if (window.location.hostname.endsWith("github.io")) {
    const normalized = src.replace(/^\.\//, "").replace(/^\//, "");
    const encodedPath = encodeUrlPathSegments(normalized);
    const baseUrl = /\/generated_lods\/lod[34]\.sog(?:$|\?)/i.test(normalized)
      ? GITHUB_RAW_BASE_URL
      : GITHUB_MEDIA_BASE_URL;
    return new URL(encodedPath, baseUrl).toString();
  }

  return new URL(src, window.location.href).toString();
}

function collectWarmModelSources() {
  const sources = new Set();
  const outdoorCatalog = LOCATION_CATALOG.outdoors;

  for (const stage of timeStages) {
    const stageAssets = outdoorCatalog.stages?.[stage] || {};
    for (const formatAssets of Object.values(stageAssets)) {
      if (formatAssets?.web?.src) {
        sources.add(formatAssets.web.src);
      }
      if (formatAssets?.hd?.src) {
        sources.add(formatAssets.hd.src);
      }
    }

    const mobileStageAssets = outdoorCatalog.mobileStages?.[stage] || {};
    for (const formatAssets of Object.values(mobileStageAssets)) {
      if (formatAssets?.web?.src) {
        sources.add(formatAssets.web.src);
      }
      if (formatAssets?.hd?.src) {
        sources.add(formatAssets.hd.src);
      }
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
  const hdAvailable =
    isCampusOutsideSelected() &&
    !!getOutdoorAsset(activeTimeStage, "hd", activeFormat);
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

function renderLodMarkers() {
  const isSogActive = currentEngineType === "splat" && currentActiveAsset?.runtime === "playcanvas";
  const shouldShowLodControl = isSogActive && currentActiveAsset?.performanceSources && Object.keys(currentActiveAsset.performanceSources).length > 0;
  
  lodControl.hidden = !shouldShowLodControl;

  if (!shouldShowLodControl) {
    lodMarkers.innerHTML = "";
    return;
  }

  const availableTiers = [];
  if (currentActiveAsset?.performanceSources?.lod1) availableTiers.push("lod1");
  if (currentActiveAsset?.performanceSources?.lod2) availableTiers.push("lod2");
  if (currentActiveAsset?.performanceSources?.lod3) availableTiers.push("lod3");
  if (currentActiveAsset?.performanceSources?.lod4) availableTiers.push("lod4");

  // Fallback if the active asset's original source acts as LOD1 and wasn't explicitly in performanceSources
  if (availableTiers.length > 0 && !availableTiers.includes("lod1")) {
      availableTiers.unshift("lod1");
  } else if (availableTiers.length === 0) {
      // Just in case nothing matched but we decided to show the control anyway
      availableTiers.push("lod1");
  }

  const tierLabels = {
    lod1: "LOD1",
    lod2: "LOD2",
    lod3: "LOD3",
    lod4: "LOD4",
  };

  lodMarkers.innerHTML = availableTiers
    .map((tier) => `
      <button
        class="lod-marker"
        data-lod-tier="${tier}"
        data-active="${String(tier === currentActiveAsset?.performanceTier)}"
        type="button"
      >${tierLabels[tier]}</button>
    `)
    .join("");

  for (const button of lodMarkers.querySelectorAll(".lod-marker")) {
    button.addEventListener("click", () => {
      const tier = button.dataset.lodTier;
      if (!tier || tier === currentActiveAsset?.performanceTier) {
        return;
      }

      setActiveLodTier(tier);
    });
  }
}

function updateLodToggle() {
  renderLodMarkers();
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
  renderNavigationUi();
  renderFormatMarkers();
  updateLodToggle();
}

function renderNavigationGroup(label, items = []) {
  return `
    <div class="navigation-group">
      <span class="time-label">${label}</span>
      <div class="location-stage-markers location-stage-markers--wrap" role="group" aria-label="${label}">
        ${items.map((item) => `
          <button
            class="nav-marker"
            type="button"
            data-nav-type="${item.type}"
            data-nav-id="${item.id}"
            data-active="${String(!!item.active)}"
            ${item.disabled ? "disabled aria-disabled=\"true\"" : ""}
          >${item.label}</button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderNavigationUi() {
  const groups = [
    {
      label: "Location",
      items: [
        { type: "site", id: "campus", label: "Campus", active: activeSiteId === "campus" },
        { type: "site", id: "dit", label: "DIT", active: activeSiteId === "dit" },
      ],
    },
    {
      label: "Environment",
      items: [
        { type: "environment", id: "outside", label: "Outside", active: activeEnvironmentId === "outside" },
        { type: "environment", id: "inside", label: "Inside", active: activeEnvironmentId === "inside" },
      ],
    },
  ];

  if (activeSiteId === "campus" && activeEnvironmentId === "inside") {
    groups.push({
      label: "Building",
      items: CAMPUS_INDOOR_BUILDINGS.map((building) => ({
        type: "building",
        id: building.id,
        label: building.label,
        active: activeBuildingId === building.id,
      })),
    });

    groups.push({
      label: "Space",
      items: (getCampusBuilding()?.spaces || []).map((space) => ({
        type: "space",
        id: space.id,
        label: space.label,
        active: activeSceneId === space.sceneId,
        disabled: !isCampusSpaceAvailable(space),
      })),
    });
  } else if (activeSiteId === "dit" && activeEnvironmentId === "inside") {
    groups.push({
      label: "Space",
      items: DIT_INSIDE_SPACES.map((space) => ({
        type: "space",
        id: space.id,
        label: space.label,
        active: false,
        disabled: true,
      })),
    });
  }

  navigationGroups.className = "navigation-groups";
  navigationGroups.innerHTML = groups.map((group) => renderNavigationGroup(group.label, group.items)).join("");

  for (const button of navigationGroups.querySelectorAll(".nav-marker")) {
    button.addEventListener("click", () => {
      if (button.disabled) {
        return;
      }

      const type = button.dataset.navType;
      const id = button.dataset.navId;
      if (!type || !id) {
        return;
      }

      if (type === "site") {
        setActiveSite(id);
      } else if (type === "environment") {
        setActiveEnvironment(id);
      } else if (type === "building") {
        setActiveBuilding(id);
      } else if (type === "space") {
        setActiveSpace(id);
      }
    });
  }
}

function updateLocationUi() {
  syncNavigationState();
  document.body.dataset.location = activeLocationStage;
  document.body.dataset.showTimeControl = String(isTimeSelectionVisible());
  timeControlGroup.hidden = !isTimeSelectionVisible();
  const timeControlsDisabled = !isTimeSelectionVisible() || !hasMultipleAvailableTimeStages();
  timeDial.disabled = timeControlsDisabled;
  timeDial.setAttribute("aria-disabled", String(timeControlsDisabled));

  for (const marker of timeStageMarkers) {
    const stageEnabled = isTimeSelectionVisible() && isTimeStageAvailable(marker.dataset.stage);
    marker.disabled = !stageEnabled;
    marker.setAttribute("aria-disabled", String(!stageEnabled));
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
  const timeControlsDisabled = isBusy || !isTimeSelectionVisible() || !hasMultipleAvailableTimeStages();
  timeDial.disabled = timeControlsDisabled;
  timeDial.setAttribute("aria-disabled", String(timeControlsDisabled));
  for (const marker of timeStageMarkers) {
    const stageEnabled = !isBusy && isTimeSelectionVisible() && isTimeStageAvailable(marker.dataset.stage);
    marker.disabled = !stageEnabled;
    marker.setAttribute("aria-disabled", String(!stageEnabled));
  }
  for (const marker of navigationGroups.querySelectorAll(".nav-marker")) {
    if (!marker.hasAttribute("aria-disabled") || marker.getAttribute("aria-disabled") === "false") {
      marker.disabled = isBusy;
    }
  }
  for (const marker of formatStageMarkers.querySelectorAll(".format-stage-marker")) {
    marker.disabled = isBusy;
  }
  for (const marker of lodMarkers.querySelectorAll(".lod-marker")) {
    marker.disabled = isBusy;
  }

  if (isBusy) {
    qualityToggle.disabled = true;
    materialToggle.disabled = true;
  } else {
    updateQualityToggle();
    updateMaterialToggle();
    updateLodToggle();
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
  currentEngineType = "glb";
  currentActiveAsset = asset;
  currentAssetKey = asset.key;
  updateViewerLayerVisibility("glb");
  modelViewer.autoRotate = turntableEnabled;
  applyGlbView(asset);
  modelViewer.src = resolvedSource;
  await modelViewer.updateComplete;
}

async function activateSplatAsset(asset, swapId, options = {}) {
  const resolvedSource = asset.runtime === "playcanvas"
    ? resolveHostedSogUrl(asset.src)
    : asset.src;
  if (swapId !== activeAssetSwapId) {
    return;
  }

  const viewer = asset.runtime === "playcanvas" ? sogViewer : plyViewer;
  const inactiveViewer = viewer === sogViewer ? plyViewer : sogViewer;

  inactiveViewer.dispose();
  currentEngineType = "splat";
  currentActiveAsset = asset;
  currentAssetKey = asset.key;
  updateViewerLayerVisibility("splat");
  if (!options.silent) {
    setProgress(0.22);
  }

  await viewer.load(
    {
      ...asset,
      src: resolvedSource,
      autoRotate: turntableEnabled,
    },
    splatProfile,
    options.silent
      ? undefined
      : (nextState) => {
          if (swapId !== activeAssetSwapId) {
            return;
          }

          if (nextState.status === "loading") {
            setProgress(0.56);
          }

          setStatus(nextState.title, nextState.message);
        }
  );

  if (swapId !== activeAssetSwapId) {
    return;
  }

  if (!options.silent) {
    document.body.classList.add("is-loaded");
    document.body.classList.remove("is-error");
    setProgress(1);
    setStatus("3D hero active", `${describeActiveAsset(asset)} is loaded in ${FORMAT_LABELS[asset.format] || "splat"} mode.`);
    requestAnimationFrame(() => {
      if (swapId === activeAssetSwapId) {
        setStatusOverlayState(true);
      }
    });
  }

  if (asset.runtime === "playcanvas") {
    startSogPerformanceMonitor(asset);
  }
}

async function applyActiveAssetSelection() {
  const nextAsset = getActiveAssetDescriptor();
  if (!nextAsset) {
    ++activeAssetSwapId;
    releaseActiveViewerResources();
    document.body.classList.remove("is-error");
    setProgress(0);
    setStatusOverlayState(false);
    setStatus("Select scene", `Choose an available item in ${getCurrentContextLabel()} to load it.`);
    updateMaterialToggle();
    updateQualityToggle();
    updateLodToggle();
    return;
  }

  const swapId = ++activeAssetSwapId;

  if (nextAsset.key === currentAssetKey && nextAsset.type === currentEngineType) {
    setStatusOverlayState(false);
    setStatus("Scene ready", `${describeActiveAsset(nextAsset)} is already active.`);
    updateMaterialToggle();
    updateQualityToggle();
    updateLodToggle();
    return;
  }

  setControlsBusy(true);
  setStatusOverlayState(false);
  setStatus("Switching scene", `Loading ${describeActiveAsset(nextAsset)}...`);
  releaseActiveViewerResources();

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
  if (!timeStages.includes(stage) || !isTimeStageAvailable(stage)) {
    return;
  }

  activeTimeStage = stage;
  activeFormat = getAvailableFormats()[0] || "glb";
  updateLocationUi();
  updateQualityToggle();
  updateMaterialToggle();
  updateTimeUi(direction);
  await applyActiveAssetSelection();
}

async function setActiveSite(siteId) {
  if (!["campus", "dit"].includes(siteId) || siteId === activeSiteId) {
    return;
  }

  activeSiteId = siteId;
  activeEnvironmentId = "outside";
  if (siteId === "campus" && !getCampusBuilding(activeBuildingId)) {
    activeBuildingId = CAMPUS_INDOOR_BUILDINGS[0]?.id || "main";
  }
  syncNavigationState();
  activeFormat = getAvailableFormats()[0] || "glb";
  updateLocationUi();
  updateQualityToggle();
  updateMaterialToggle();
  updateTimeUi();
  await applyActiveAssetSelection();
}

async function setActiveEnvironment(environmentId) {
  if (!["outside", "inside"].includes(environmentId) || environmentId === activeEnvironmentId) {
    return;
  }

  activeEnvironmentId = environmentId;
  syncNavigationState();
  if (activeSiteId === "campus" && activeEnvironmentId === "inside") {
    activeFormat = getPreferredFormat(getCurrentSceneEntry());
  } else {
    activeFormat = getAvailableFormats()[0] || "glb";
  }
  updateLocationUi();
  updateQualityToggle();
  updateMaterialToggle();
  updateTimeUi();
  await applyActiveAssetSelection();
}

async function setActiveBuilding(buildingId) {
  if (!getCampusBuilding(buildingId) || buildingId === activeBuildingId) {
    return;
  }

  activeBuildingId = buildingId;
  normalizeActiveScene();
  activeFormat = getPreferredFormat(getCurrentSceneEntry());
  updateLocationUi();
  updateQualityToggle();
  updateMaterialToggle();
  await applyActiveAssetSelection();
}

async function setActiveSpace(spaceId) {
  const space = (getCampusBuilding()?.spaces || []).find((item) => item.id === spaceId);
  if (!space || !isCampusSpaceAvailable(space) || space.sceneId === activeSceneId) {
    return;
  }

  activeSceneId = space.sceneId;
  const nextScene = getCampusIndoorSceneById(space.sceneId);
  activeFormat = getPreferredFormat(nextScene);
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

async function setActiveLodTier(tier) {
  if (!currentActiveAsset || currentActiveAsset.type !== "splat" || currentActiveAsset.runtime !== "playcanvas") {
    return;
  }

  if (tier === currentActiveAsset.performanceTier) {
    return;
  }

  const nextAsset = getSogAssetForPerformanceTier(currentActiveAsset, tier);
  if (!nextAsset) {
    return;
  }

  stopSogPerformanceMonitor();
  await reloadSogAsset(nextAsset, { silent: false });
  updateLodToggle();
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

function handleModelViewerProgress(event) {
  if (event.currentTarget !== modelViewer || currentEngineType !== "glb") {
    return;
  }

  setStatusOverlayState(false);
  setProgress(event.detail.totalProgress);
  setStatus(
    event.detail.totalProgress >= 1 ? "Scene ready" : "Loading scene",
    `${Math.round(event.detail.totalProgress * 100)}% complete`
  );
}

async function handleModelViewerLoad(event) {
  if (event.currentTarget !== modelViewer || currentEngineType !== "glb") {
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
}

function handleModelViewerError(event) {
  if (event.currentTarget !== modelViewer || currentEngineType !== "glb") {
    return;
  }

  document.body.classList.add("is-error");
  setStatusOverlayState(false);
  setStatus("Asset issue", event.detail?.type || "The model did not render correctly.");
  setControlsBusy(false);
}

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
    return;
  }

  clearWarmModelCache();
});

qualityToggle.addEventListener("click", async () => {
  if (!isCampusOutsideSelected()) {
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

document.addEventListener("scroll", () => {
  siteHeader.classList.toggle("is-solid", window.scrollY > 24);
});

document.addEventListener("fullscreenchange", () => {
  const fullscreenLabel = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
  fullscreenToggle.setAttribute("aria-label", fullscreenLabel);
  fullscreenToggle.title = fullscreenLabel;
});

splatViewerMount.addEventListener("sog-pan-visibilitychange", (event) => {
  sogPanIndicatorVisible = !!event.detail?.visible;
  updateOrbitTargetIndicatorVisibility();
});

bindModelViewerEvents(modelViewer);
syncNavigationState();
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













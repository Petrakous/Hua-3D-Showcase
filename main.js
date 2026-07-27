import { LOCATION_CATALOG } from "./viewer/sceneCatalog.js?v=20260708diag1";
import { PlayCanvasSogViewer } from "./viewer/playCanvasSogViewer.js?v=20260728multiray2";
import { SCENE_CALIBRATION_DEFAULTS, installSceneCalibrationExportHelper } from "./viewer/sceneCalibrations.js?v=20260626cal1";
import { resolveSceneExperience, getCategoryLabel } from "./viewer/sceneExperience.js?v=20260709lodsafe1";
import { logger, setLoggerContextProvider } from "./viewer/logger.js";
import {
  initAnalytics,
  trackPageView,
  trackSceneOpen,
  trackSceneLoaded,
  trackSceneLoadFailed,
  trackLodSelected,
  trackQualityChanged,
  trackViewerError,
  trackPerformanceSample,
} from "./analytics/client.js";
import { initAnalyticsDashboard } from "./analytics/dashboard.js";

let modelViewer = document.getElementById("siteModel");
const splatViewerMount = document.getElementById("splatViewerMount");
const orbitTargetIndicator = document.getElementById("orbitTargetIndicator");
const siteHeader = document.getElementById("siteHeader");
const progressBar = document.getElementById("progressBar");
const progressTrack = progressBar.closest("[role='progressbar']");
const progressMeta = document.getElementById("progressMeta");
const statusPill = document.getElementById("statusPill");
const statusCopy = document.getElementById("statusCopy");
const viewerStatus = document.getElementById("viewerStatus");
const statusCancel = document.getElementById("statusCancel");
const statusRetry = document.getElementById("statusRetry");
const statusBack = document.getElementById("statusBack");
const statusDetails = document.getElementById("statusDetails");
const statusDetailsText = document.getElementById("statusDetailsText");
const sceneSelection = document.getElementById("sceneSelection");
const sceneCardGrid = document.getElementById("sceneCardGrid");
const hotspotOverlay = document.getElementById("hotspotOverlay");
const hotspotTransitionOverlay = document.getElementById("hotspotTransitionOverlay");
const hotspotTransitionText = document.getElementById("hotspotTransitionText");
const viewerBackButton = document.getElementById("viewerBackButton");
const fullscreenToggle = document.getElementById("fullscreenToggle");
const glbQualityControl = document.getElementById("glbQualityControl");
const glbQualityMarkers = document.getElementById("glbQualityMarkers");
const calibrationToggle = document.getElementById("calibrationToggle");
const calibrationPanel = document.getElementById("calibrationPanel");
const calibrationSceneLabel = document.getElementById("calibrationSceneLabel");
const calibrationHint = document.getElementById("calibrationHint");
const calibrationClose = document.getElementById("calibrationClose");
const calibrationReset = document.getElementById("calibrationReset");
const calibrationSave = document.getElementById("calibrationSave");
const calibrationCopy = document.getElementById("calibrationCopy");
const calibrationLodControls = document.getElementById("calibrationLodControls");
const calibrationFlyCollisionControl = document.getElementById("calibrationFlyCollisionControl");
const calibrationFlyIgnoreCollision = document.getElementById("calibrationFlyIgnoreCollision");
const calibrationCollisionPreviewControl = document.getElementById("calibrationCollisionPreviewControl");
const calibrationShowCollision = document.getElementById("calibrationShowCollision");
const calibrationGridControl = document.getElementById("calibrationGridControl");
const calibrationShowGrid = document.getElementById("calibrationShowGrid");
const calibrationAxesControl = document.getElementById("calibrationAxesControl");
const calibrationShowAxes = document.getElementById("calibrationShowAxes");
const calibrationCameraMarkerControl = document.getElementById("calibrationCameraMarkerControl");
const calibrationShowCameraMarker = document.getElementById("calibrationShowCameraMarker");
const calibrationCullingControl = document.getElementById("calibrationCullingControl");
const calibrationCullingEnabled = document.getElementById("calibrationCullingEnabled");
const calibrationBoxPreviewControl = document.getElementById("calibrationBoxPreviewControl");
const calibrationShowBox = document.getElementById("calibrationShowBox");
const calibrationSetCurrent = document.getElementById("calibrationSetCurrent");
const calibrationTargetControl = document.getElementById("calibrationTargetControl");
const calibrationTargetButtons = [...document.querySelectorAll("[data-calib-target]")];
const hotspotCalibrationControls = document.getElementById("hotspotCalibrationControls");
const hotspotCalibrationSelect = document.getElementById("hotspotCalibrationSelect");
const hotspotCalibrationStep = document.getElementById("hotspotCalibrationStep");
const hotspotCalibrationPosition = document.getElementById("hotspotCalibrationPosition");
const hotspotCopyPosition = document.getElementById("hotspotCopyPosition");
const hotspotCopyJson = document.getElementById("hotspotCopyJson");
const hotspotCopyAllJson = document.getElementById("hotspotCopyAllJson");
const timeDial = document.getElementById("timeDial");
const timeControlGroup = document.getElementById("timeControlGroup");
const timeStageMarkers = [...document.querySelectorAll(".time-stage-marker")];
const navigationControl = document.getElementById("navigationControl");
const navigationGroups = document.getElementById("navigationGroups");
const formatControl = document.getElementById("formatControl");
const formatStageMarkers = document.getElementById("formatStageMarkers");
const sogModeControl = document.getElementById("sogModeControl");
const sogModeMarkers = document.getElementById("sogModeMarkers");
const fpNavControl = document.getElementById("fpNavControl");
const fpNavMarkers = document.getElementById("fpNavMarkers");
const lodControl = document.getElementById("lodControl");
const lodMarkers = document.getElementById("lodMarkers");
const resetCamera = document.getElementById("resetCamera");
const turntableToggle = document.getElementById("turntableToggle");
const materialToggle = document.getElementById("materialToggle");
const performanceToast = document.getElementById("performanceToast");
const mobileControlsDock = document.getElementById("mobileControlsDock");
const mobileControlsScrim = document.getElementById("mobileControlsScrim");
const mobileDockButtons = [...document.querySelectorAll("[data-mobile-panel]")];
const controlsHelpToggle = document.getElementById("controlsHelpToggle");
const controlsHelpOverlay = document.getElementById("controlsHelpOverlay");
const controlsHelpGrid = document.getElementById("controlsHelpGrid");
const sceneFilterSearch = document.getElementById("sceneFilterSearch");
const sceneFilterChips = document.getElementById("sceneFilterChips");
const sceneCardsEmpty = document.getElementById("sceneCardsEmpty");
const sceneCardsEmptyReset = document.getElementById("sceneCardsEmptyReset");
let activeFilter = "all";
let searchQuery = "";
let helpOverlayTimer = null;
const calibrationInputs = {
  position: [
    document.getElementById("calibrationPositionX"),
    document.getElementById("calibrationPositionY"),
    document.getElementById("calibrationPositionZ"),
  ],
  rotationDegrees: [
    document.getElementById("calibrationRotationX"),
    document.getElementById("calibrationRotationY"),
    document.getElementById("calibrationRotationZ"),
  ],
  scale: [
    document.getElementById("calibrationScaleX"),
    document.getElementById("calibrationScaleY"),
    document.getElementById("calibrationScaleZ"),
  ],
};

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

const SOG_ADAPTIVE_PERFORMANCE = {
  minDpr: 0.65,
  dprStep: 0.15,
  lowFpsThreshold: 35,
  highFpsThreshold: 50,
  sampleIntervalMs: 1000,
  downgradeHoldMs: 3000,
  upgradeHoldMs: 5000,
  tierChangeCooldownMs: 12000,
  reverseTierChangeCooldownMs: 20000,
};

const SOG_MODE_LABELS = {
  classic: "LOD",
  streamed: "Streamed",
};

const DEFAULT_FORMAT = "sog";
const GLB_LOAD_TIMEOUT_MS = isMobileDevice ? 35000 : 60000;
const SOG_CALIBRATION_QUERY_PARAM = "sog-calibration";
const SOG_CALIBRATION_OVERRIDES_KEY = "hua:sog-calibration-overrides:v1";
const SOG_STREAMED_TRANSFORMS_KEY = "hua:sog-streamed-transforms:v1";
const SELECTION_PREFERENCES_KEY = "hua3d.selection.preferences:v1";
const calibrationQueryEnabled =
  new URLSearchParams(window.location.search).get(SOG_CALIBRATION_QUERY_PARAM) === "1";
const calibrationUiUnlocked = calibrationQueryEnabled;
const collisionPilotEnabled =
  calibrationUiUnlocked &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
  new URLSearchParams(window.location.search).get("collision-pilot") === "1";
const CAMPUS_DAY_COLLISION_PILOT_URL =
  "./.collision-pilot/campus-day/campus-day-structural-v0p5-f80000.glb?v=20260728pilot2";
const cinematicModeEnabled = new URLSearchParams(window.location.search).get("cinematic") === "1";
const cinematicAuthorEnabled =
  cinematicModeEnabled && new URLSearchParams(window.location.search).get("author") === "1";

installSceneCalibrationExportHelper();

const streamedTransformsDefaults = SCENE_CALIBRATION_DEFAULTS.streamedTransforms || {};
const manualBoxDefaults = SCENE_CALIBRATION_DEFAULTS.manualBoxOverrides || {};
const streamedTransformsOverrides = loadStreamedTransformsOverrides();

function loadStreamedTransformsOverrides() {
  const raw = safeLocalStorageGet(SOG_STREAMED_TRANSFORMS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_e) {
    return {};
  }
}

function saveStreamedTransformsOverrides() {
  safeLocalStorageSet(SOG_STREAMED_TRANSFORMS_KEY, JSON.stringify(streamedTransformsOverrides));
}

function degreesToQuaternion(rotationDegrees = [0, 0, 0]) {
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

  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ];
}

function safeLocalStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (_error) {
    return false;
  }
}

function safeLocalStorageRemove(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch (_error) {
    return false;
  }
}

const CINEMATIC_START_VIEW_STORAGE_PREFIX = "hua3d.cinematic.startView.";

function getAssetSceneId(asset) {
  return asset?.sceneId ||
    (asset?.locationId === "outdoors" ? `campus-${activeTimeStage}` : asset?.key) ||
    null;
}

function applySavedCinematicStartView(asset) {
  if (!cinematicAuthorEnabled || !asset || asset.streamingEnabled) return asset;
  const sceneId = getAssetSceneId(asset);
  if (!sceneId) return asset;

  try {
    const pose = JSON.parse(safeLocalStorageGet(`${CINEMATIC_START_VIEW_STORAGE_PREFIX}${sceneId}`) || "null");
    const validVector = (vector) =>
      Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite);
    if (!validVector(pose?.position) || !validVector(pose?.target)) return asset;

    const savedPreset = {
      cameraPosition: [...pose.position],
      target: [...pose.target],
      ...(Number.isFinite(pose.fov) ? { fov: pose.fov } : {}),
    };
    return {
      ...asset,
      viewPreset: { ...(asset.viewPreset || {}), ...savedPreset },
    };
  } catch (_error) {
    return asset;
  }
}

function loadCalibrationOverrides() {
  const raw = safeLocalStorageGet(SOG_CALIBRATION_OVERRIDES_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

let sogPerformanceMonitor = null;
let sogAdaptiveTierState = {
  sceneKey: null,
  lastTierChangeAt: 0,
  lastDirection: null,
};

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

function sanitizeSelectionPreferences(value = {}) {
  const defaults = {
    timeStage: "day",
    format: DEFAULT_FORMAT,
    hdEnabled: false,
    sogMode: "classic",
    fpNavigationMode: "walk",
    lodTier: "auto",
  };

  return {
    timeStage: timeStages.includes(value.timeStage) ? value.timeStage : defaults.timeStage,
    format: ["glb", "sog"].includes(value.format) ? value.format : defaults.format,
    hdEnabled: value.hdEnabled === true,
    sogMode: ["classic", "streamed"].includes(value.sogMode) ? value.sogMode : defaults.sogMode,
    fpNavigationMode: ["walk", "fly"].includes(value.fpNavigationMode) ? value.fpNavigationMode : defaults.fpNavigationMode,
    lodTier: ["auto", "lod0", "lod1", "lod2", "lod3", "lod4"].includes(value.lodTier) ? value.lodTier : defaults.lodTier,
  };
}

function loadSelectionPreferences() {
  try {
    return sanitizeSelectionPreferences(JSON.parse(safeLocalStorageGet(SELECTION_PREFERENCES_KEY) || "{}"));
  } catch (_error) {
    return sanitizeSelectionPreferences();
  }
}

let selectionPreferences = loadSelectionPreferences();

function saveSelectionPreferences() {
  safeLocalStorageSet(SELECTION_PREFERENCES_KEY, JSON.stringify(selectionPreferences));
}

function updateSelectionPreferences(patch = {}) {
  selectionPreferences = sanitizeSelectionPreferences({
    ...selectionPreferences,
    ...patch,
  });
  saveSelectionPreferences();
}

function getStreamingPerformanceProfile() {
  if (isMobileDevice) {
    if ((deviceMemory && deviceMemory <= 4) || (hardwareConcurrency && hardwareConcurrency <= 6)) {
        return {
          maxDpr: 0.85,
          splatBudget: 350000,
          minSplatBudget: 220000,
          maxSplatBudget: 700000,
        lodBaseDistance: 4.5,
        minLodBaseDistance: 3.2,
        maxLodBaseDistance: 14,
        lodMultiplier: 2.8,
        minLodMultiplier: 2.1,
        maxLodMultiplier: 3.5,
        lodRangeMin: 2,
          lodUnderfillLimit: 2,
          coarseFirst: true,
        };
    }

      return {
        maxDpr: 1,
        splatBudget: 700000,
        minSplatBudget: 350000,
        maxSplatBudget: 1400000,
      lodBaseDistance: 5.5,
      minLodBaseDistance: 3.4,
      maxLodBaseDistance: 16,
      lodMultiplier: 2.45,
      minLodMultiplier: 1.9,
      maxLodMultiplier: 3.2,
      lodRangeMin: 1,
        lodUnderfillLimit: 2,
        coarseFirst: true,
      };
  }

  if ((deviceMemory && deviceMemory <= 4) || (hardwareConcurrency && hardwareConcurrency <= 4)) {
      return {
        maxDpr: 1.1,
        splatBudget: 1200000,
        minSplatBudget: 650000,
        maxSplatBudget: 2200000,
      lodBaseDistance: 6.5,
      minLodBaseDistance: 4.2,
      maxLodBaseDistance: 18,
      lodMultiplier: 2.2,
      minLodMultiplier: 1.8,
      maxLodMultiplier: 3,
      lodRangeMin: 1,
        lodUnderfillLimit: 1,
        coarseFirst: true,
      };
  }

    return {
      maxDpr: 1.25,
      splatBudget: 2400000,
      minSplatBudget: 1200000,
      maxSplatBudget: 4200000,
    lodBaseDistance: 7,
    minLodBaseDistance: 4.5,
    maxLodBaseDistance: 22,
    lodMultiplier: 2,
    minLodMultiplier: 1.65,
    maxLodMultiplier: 2.8,
    lodRangeMin: 0,
      lodUnderfillLimit: 1,
      coarseFirst: true,
    };
  }

const sogStreamingPerformanceProfile = getStreamingPerformanceProfile();

function getPerformanceTierRank(tier) {
  switch (tier) {
    case "lod4": return 0;
    case "lod3": return 1;
    case "lod2": return 2;
    case "lod1": return 3;
    case "lod0": return 4;
    default: return 3;
  }
}

function getSogAssetForPerformanceTier(asset, tier) {
  if (!asset || asset.type !== "splat" || asset.fileFormat !== "sog") {
    return null;
  }

  const normalizedTier = ["lod0", "lod1", "lod2", "lod3", "lod4"].includes(tier) ? tier : "lod1";
  
  if (normalizedTier === "lod1" || normalizedTier === "lod0") {
    const originalSrc = asset.originalSrc || asset.src;
    if (!originalSrc) {
      return null;
    }

    const source = asset.performanceSources?.[normalizedTier] || originalSrc;

    return {
      ...asset,
      src: source,
      performanceTier: normalizedTier,
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

  const ranks = ["lod0", "lod1", "lod2", "lod3", "lod4"];
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

  const ranks = ["lod0", "lod1", "lod2", "lod3", "lod4"];
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
  if (sogPerformanceMonitor?.cleanup) {
    try {
      sogPerformanceMonitor.cleanup();
    } catch (e) {
      logger.warn("sog-loader", "Performance monitor cleanup failed", null, e);
    }
  }
  sogPerformanceMonitor = null;
}

function resetSogAdaptiveTierState(sceneKey = null) {
  sogAdaptiveTierState = {
    sceneKey,
    lastTierChangeAt: 0,
    lastDirection: null,
  };
}

function canAutoChangeSogTier(asset, direction, timestamp) {
  const sceneKey = asset?.key || null;
  if (!sceneKey) {
    return false;
  }

  if (sogAdaptiveTierState.sceneKey !== sceneKey) {
    resetSogAdaptiveTierState(sceneKey);
  }

  if (!sogAdaptiveTierState.lastTierChangeAt) {
    return true;
  }

  const elapsedSinceLastChange = timestamp - (sogAdaptiveTierState.lastTierChangeAt || 0);
  const cooldownMs =
    sogAdaptiveTierState.lastDirection && sogAdaptiveTierState.lastDirection !== direction
      ? SOG_ADAPTIVE_PERFORMANCE.reverseTierChangeCooldownMs
      : SOG_ADAPTIVE_PERFORMANCE.tierChangeCooldownMs;

  return elapsedSinceLastChange >= cooldownMs;
}

function recordAutoSogTierChange(asset, direction, timestamp) {
  sogAdaptiveTierState = {
    sceneKey: asset?.key || null,
    lastTierChangeAt: timestamp,
    lastDirection: direction,
  };
}

function getCurrentSogDpr() {
  return Math.max(
    0.5,
    Math.min(
      sogViewer?.app?.graphicsDevice?.maxPixelRatio || autoPerformanceProfile.maxDpr || 1,
      window.devicePixelRatio || 1
    )
  );
}

function startSogPerformanceMonitor(asset, initialDpr = null) {
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
    currentDpr: Number.isFinite(initialDpr) ? initialDpr : getCurrentSogDpr(),
    frameRequestId: null,
    cleanup: null,
  };
  sogPerformanceMonitor = monitor;

  // We measure frame intervals (FPS) on the CPU-side render loop.
  // Note: GPU-exclusive hardware timers are generally blocked or unavailable in general browsers
  // for security reasons. Measuring CPU-side PlayCanvas frame intervals captures all main-thread update
  // and WebGL draw call dispatch overhead, providing a reliable proxy for render-loop performance.
  if (sogViewer && sogViewer.app) {
    const pcApp = sogViewer.app;
    const onPcPostRender = () => {
      if (!sogPerformanceMonitor || sogPerformanceMonitor.assetKey !== asset.key) {
        pcApp.off("postrender", onPcPostRender);
        return;
      }

      const timestamp = performance.now();
      monitor.sampleFrames += 1;
      monitor.lastTimestamp = timestamp;
      const elapsed = timestamp - monitor.sampleStart;

      if (elapsed >= SOG_ADAPTIVE_PERFORMANCE.sampleIntervalMs) {
        const fps = Math.max(0, Math.round((monitor.sampleFrames * 1000) / elapsed));
        monitor.sampleFrames = 0;
        monitor.sampleStart = timestamp;
        trackPerformanceSample(getAnalyticsAssetMetadata(asset, {
          fps,
          dpr: monitor.currentDpr,
          streaming: !!asset.streamingEnabled,
        }));
        evaluateSogPerformance(asset, fps, timestamp, monitor);
      }
    };

    pcApp.on("postrender", onPcPostRender);
    monitor.cleanup = () => {
      pcApp.off("postrender", onPcPostRender);
    };
  } else {
    // Fallback to requestAnimationFrame if PlayCanvas is not initialized yet
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
        trackPerformanceSample(getAnalyticsAssetMetadata(asset, {
          fps,
          dpr: monitor.currentDpr,
          streaming: !!asset.streamingEnabled,
        }));
        evaluateSogPerformance(asset, fps, timestamp, monitor);
      }

      monitor.frameRequestId = requestAnimationFrame(tick);
    };

    monitor.frameRequestId = requestAnimationFrame(tick);
  }
}

function adjustStreamingQuality(direction) {
  const state = sogViewer.getStreamingState?.();
  if (!state?.enabled) {
    return false;
  }

  const lodLevels = Math.max(1, state.lodLevels || 1);
  const currentRangeMin = Math.max(0, state.lodRangeMin || 0);
  const currentRangeMax = Math.max(currentRangeMin, state.lodRangeMax || (lodLevels - 1));
  if (direction === "downgrade") {
    const nextBudget = Math.max(
      state.minSplatBudget || 0,
      Math.round((state.splatBudget || 0) * 0.82)
    );
    if (nextBudget < (state.splatBudget || 0) - 20000) {
      sogViewer.applyStreamingQuality({ splatBudget: nextBudget });
      trackQualityChanged("streaming_splat_budget", getAnalyticsAssetMetadata(currentActiveAsset, {
        direction,
        previous_value: state.splatBudget || 0,
        next_value: nextBudget,
      }));
      return true;
    }

    const nextRangeMin = Math.min(lodLevels - 1, currentRangeMin + 1);
    if (nextRangeMin > currentRangeMin) {
      sogViewer.applyStreamingQuality({
        lodRangeMin: nextRangeMin,
        lodRangeMax: lodLevels - 1,
      });
      trackQualityChanged("streaming_lod_range", getAnalyticsAssetMetadata(currentActiveAsset, {
        direction,
        previous_value: currentRangeMin,
        next_value: nextRangeMin,
      }));
      return true;
    }

    const nextBaseDistance = Math.min(
      state.maxLodBaseDistance || state.lodBaseDistance,
      (state.lodBaseDistance || 5) * 1.1
    );
    const nextMultiplier = Math.min(
      state.maxLodMultiplier || state.lodMultiplier,
      (state.lodMultiplier || 2) + 0.18
    );
    if (
      nextBaseDistance > (state.lodBaseDistance || 5) + 0.01 ||
      nextMultiplier > (state.lodMultiplier || 2) + 0.01
    ) {
      sogViewer.applyStreamingQuality({
        lodBaseDistance: nextBaseDistance,
        lodMultiplier: nextMultiplier,
      });
      trackQualityChanged("streaming_lod_distance", getAnalyticsAssetMetadata(currentActiveAsset, {
        direction,
        previous_base_distance: state.lodBaseDistance || null,
        next_base_distance: nextBaseDistance,
        previous_multiplier: state.lodMultiplier || null,
        next_multiplier: nextMultiplier,
      }));
      return true;
    }

    return false;
  }

  const targetRangeMin = Math.max(0, state.targetLodRangeMin || 0);
  if (currentRangeMin > targetRangeMin) {
    sogViewer.applyStreamingQuality({
      lodRangeMin: currentRangeMin - 1,
      lodRangeMax: currentRangeMax,
    });
    trackQualityChanged("streaming_lod_range", getAnalyticsAssetMetadata(currentActiveAsset, {
      direction,
      previous_value: currentRangeMin,
      next_value: currentRangeMin - 1,
    }));
    return true;
  }

  const nextBudget = Math.min(
    state.maxSplatBudget || state.splatBudget || 0,
    Math.round((state.splatBudget || 0) * 1.15)
  );
  if (nextBudget > (state.splatBudget || 0) + 20000) {
    sogViewer.applyStreamingQuality({ splatBudget: nextBudget });
    trackQualityChanged("streaming_splat_budget", getAnalyticsAssetMetadata(currentActiveAsset, {
      direction,
      previous_value: state.splatBudget || 0,
      next_value: nextBudget,
    }));
    return true;
  }

  const nextBaseDistance = Math.max(
    state.minLodBaseDistance || state.lodBaseDistance,
    (state.lodBaseDistance || 5) * 0.92
  );
  const nextMultiplier = Math.max(
    state.minLodMultiplier || state.lodMultiplier,
    (state.lodMultiplier || 2) - 0.12
  );
  if (
    nextBaseDistance < (state.lodBaseDistance || 5) - 0.01 ||
    nextMultiplier < (state.lodMultiplier || 2) - 0.01
  ) {
    sogViewer.applyStreamingQuality({
      lodBaseDistance: nextBaseDistance,
      lodMultiplier: nextMultiplier,
    });
    trackQualityChanged("streaming_lod_distance", getAnalyticsAssetMetadata(currentActiveAsset, {
      direction,
      previous_base_distance: state.lodBaseDistance || null,
      next_base_distance: nextBaseDistance,
      previous_multiplier: state.lodMultiplier || null,
      next_multiplier: nextMultiplier,
    }));
    return true;
  }

  return false;
}

function evaluateSogPerformance(asset, fps, timestamp, monitor) {
  if (currentEngineType !== "splat" || !currentActiveAsset || currentActiveAsset.key !== monitor.assetKey) {
    stopSogPerformanceMonitor();
    return;
  }

  const activeAsset = currentActiveAsset;
  const maxDpr = activeAsset.streamingEnabled
    ? activeAsset.streamingSettings?.maxDpr || autoPerformanceProfile.maxDpr
    : autoPerformanceProfile.maxDpr;
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

  // To prevent aggressive adjustments from short performance spikes,
  // we only change the resolution (DPR) tier if the performance has been stable
  // for the holding duration.
  if (fps < SOG_ADAPTIVE_PERFORMANCE.lowFpsThreshold) {
    if (monitor.stableLowSince && (timestamp - monitor.stableLowSince >= SOG_ADAPTIVE_PERFORMANCE.downgradeHoldMs)) {
      targetDpr = Math.max(SOG_ADAPTIVE_PERFORMANCE.minDpr, monitor.currentDpr - SOG_ADAPTIVE_PERFORMANCE.dprStep);
      // Reset tracker so we hold at the new tier
      monitor.stableLowSince = timestamp;
    }
  } else if (fps > SOG_ADAPTIVE_PERFORMANCE.highFpsThreshold) {
    if (monitor.stableHighSince && (timestamp - monitor.stableHighSince >= SOG_ADAPTIVE_PERFORMANCE.upgradeHoldMs)) {
      targetDpr = Math.min(maxDpr, monitor.currentDpr + SOG_ADAPTIVE_PERFORMANCE.dprStep);
      // Reset tracker so we hold at the new tier
      monitor.stableHighSince = timestamp;
    }
  }

  if (targetDpr !== monitor.currentDpr) {
    monitor.currentDpr = targetDpr;
    sogViewer.setMaxDpr(targetDpr);
    // Clear stable states to re-evaluate on the new resolution tier
    monitor.stableLowSince = null;
    monitor.stableHighSince = null;
  }

  const isAtMinDpr = monitor.currentDpr <= SOG_ADAPTIVE_PERFORMANCE.minDpr + 0.01;
  const isAtMaxDpr = monitor.currentDpr >= maxDpr - 0.01;

  if (activeAsset.streamingEnabled) {
    if (
      isAtMinDpr &&
      monitor.stableLowSince &&
      timestamp - monitor.stableLowSince >= SOG_ADAPTIVE_PERFORMANCE.downgradeHoldMs
    ) {
      if (adjustStreamingQuality("downgrade")) {
        monitor.stableLowSince = timestamp;
      }
    }

    if (
      isAtMaxDpr &&
      monitor.stableHighSince &&
      timestamp - monitor.stableHighSince >= SOG_ADAPTIVE_PERFORMANCE.upgradeHoldMs
    ) {
      if (adjustStreamingQuality("upgrade")) {
        monitor.stableHighSince = timestamp;
      }
    }

    return;
  }

  if (selectionPreferences.lodTier !== "auto") {
    return;
  }

  if (
    isAtMinDpr &&
    monitor.stableLowSince &&
    timestamp - monitor.stableLowSince >= SOG_ADAPTIVE_PERFORMANCE.downgradeHoldMs
  ) {
    const lowerAsset = getLowerSogAsset(activeAsset);
    if (lowerAsset && canAutoChangeSogTier(activeAsset, "downgrade", timestamp)) {
      recordAutoSogTierChange(activeAsset, "downgrade", timestamp);
      trackLodSelected(getAnalyticsSceneId(lowerAsset), lowerAsset.performanceTier, getAnalyticsAssetMetadata(lowerAsset, {
        reason: "auto_downgrade",
        previous_tier: activeAsset.performanceTier,
      }));
      stopSogPerformanceMonitor();
      reloadSogAsset(lowerAsset, { silent: true, targetDpr: monitor.currentDpr });
      return;
    }
  }

  if (
    isAtMaxDpr &&
    monitor.stableHighSince &&
    timestamp - monitor.stableHighSince >= SOG_ADAPTIVE_PERFORMANCE.upgradeHoldMs
  ) {
    const higherAsset = getHigherSogAsset(activeAsset);
    if (higherAsset && canAutoChangeSogTier(activeAsset, "upgrade", timestamp)) {
      recordAutoSogTierChange(activeAsset, "upgrade", timestamp);
      trackLodSelected(getAnalyticsSceneId(higherAsset), higherAsset.performanceTier, getAnalyticsAssetMetadata(higherAsset, {
        reason: "auto_upgrade",
        previous_tier: activeAsset.performanceTier,
      }));
      stopSogPerformanceMonitor();
      reloadSogAsset(higherAsset, { silent: true, targetDpr: monitor.currentDpr });
      return;
    }
  }
}

function buildStreamingSettings(asset) {
  const baseProfile = {
    ...sogStreamingPerformanceProfile,
  };

  if (asset?.locationId === "outdoors") {
    baseProfile.splatBudget = Math.round(baseProfile.splatBudget * 1.15);
    baseProfile.maxSplatBudget = Math.round(baseProfile.maxSplatBudget * 1.15);
  }

  return baseProfile;
}

function buildFirstPersonViewPreset(asset) {
  if (asset?.fpViewPreset) {
    const cameraPosition = asset.fpViewPreset.cameraPosition || null;
    const rawTarget = asset.fpViewPreset.target || null;
    let normalizedTarget = rawTarget;

    if (cameraPosition && rawTarget) {
      const directionX = rawTarget[0] - cameraPosition[0];
      const directionY = rawTarget[1] - cameraPosition[1];
      const directionZ = rawTarget[2] - cameraPosition[2];
      const directionLength = Math.hypot(directionX, directionY, directionZ);
      const minTargetDistance = 0.85;

      if (directionLength < minTargetDistance) {
        const fallbackDirection =
          directionLength > 1e-5
            ? [directionX / Math.max(directionLength, 1e-5), directionY / Math.max(directionLength, 1e-5), directionZ / Math.max(directionLength, 1e-5)]
            : [0, 0, 1];
        normalizedTarget = [
          cameraPosition[0] + fallbackDirection[0] * minTargetDistance,
          cameraPosition[1] + fallbackDirection[1] * minTargetDistance,
          cameraPosition[2] + fallbackDirection[2] * minTargetDistance,
        ];
      }
    }

    return {
      ...(asset.viewPreset || {}),
      ...asset.fpViewPreset,
      target: normalizedTarget || asset.fpViewPreset.target,
      distance: Number.isFinite(asset.fpViewPreset.distance) ? asset.fpViewPreset.distance : 0.001,
      yaw: Number.isFinite(asset.fpViewPreset.yaw) ? asset.fpViewPreset.yaw : 180,
      pitch: Number.isFinite(asset.fpViewPreset.pitch) ? asset.fpViewPreset.pitch : 0,
      fov: asset.fpViewPreset.fov ?? asset.viewPreset?.fov ?? 72,
    };
  }

  const manualBox = asset?.manualBox;
  if (!manualBox?.position || !manualBox?.scale) {
    return asset?.viewPreset || null;
  }

  const [boxX = 0, boxY = 0, boxZ = 0] = manualBox.position;
  const [, scaleY = 1, scaleZ = 1] = manualBox.scale;
  const eyeHeightOffset = Math.max(0.22, scaleZ * 0.22);
  const lookForwardOffset = Math.max(0.18, Math.min(scaleY * 0.12, 0.65));

  return {
    ...(asset?.viewPreset || {}),
    cameraPosition: [boxX, boxY - lookForwardOffset, boxZ + eyeHeightOffset],
    target: [boxX, boxY + lookForwardOffset, boxZ + eyeHeightOffset],
    distance: 0.001,
    yaw: 180,
    pitch: 0,
    fov: asset?.viewPreset?.fov ?? 72,
  };
}

function selectStreamingSogAsset(asset) {
  if (!asset || asset.type !== "splat" || asset.fileFormat !== "sog" || !asset.streamingSource) {
    return asset;
  }

  return {
    ...asset,
    src: asset.streamingSource,
    originalSrc: asset.src,
    rotation: asset.streamingRotation || asset.rotation,
    // Manual boxes are calibrated in the regular SOG (LOD) coordinate frame.
    // Keep that frame so the viewer can rebase the box when Streamed uses a
    // different baked rotation.
    manualBoxReferenceRotation: asset.rotation,
    streamingEnabled: true,
    streamingSettings: buildStreamingSettings(asset),
    autoRotate: false,
    cutawayEnabled: asset.cutawayEnabled !== false,
  };
}

async function reloadSogAsset(asset, options = {}) {
  const swapId = ++activeAssetSwapId;
  if (!options.silent) {
    setControlsBusy(true);
    setLoadingState(true);
    setStatusOverlayState(false);
    setProgress(0.08);
    setStatus("Switching scene", `Loading ${describeActiveAsset(asset)}...`, {
      loading: true,
    });
  }
  try {
    await activateSplatAsset(asset, swapId, {
      silent: !!options.silent,
      targetDpr: options.targetDpr,
    });
  } catch (error) {
    if (swapId !== activeAssetSwapId) {
      return;
    }
    if (!options.silent) {
      setLoadingState(false);
      setSplatPreparing(false);
    }
    trackSceneLoadFailed(getAnalyticsSceneId(asset), error, getAnalyticsAssetMetadata(asset, {
      silent: !!options.silent,
      source: "sog_reload",
    }));
    if (!options.silent) {
      document.body.classList.add("is-error");
      setStatusOverlayState(false);
      setStatus("Asset issue", getFriendlyLoadError(error, asset), {
        severity: "fatal",
        details: buildErrorDetails(error, asset, { source: "sog_reload" }),
      });
    }
  } finally {
    if (swapId === activeAssetSwapId && !options.silent) {
      setLoadingState(false);
      setControlsBusy(false);
      updateMaterialToggle();
      updateQualityToggle();
      renderSogModeMarkers();
      renderFpNavMarkers();
      updateLodToggle();
      updateCalibrationUi();
    }
  }
}

let activeTimeStage = selectionPreferences.timeStage;
let activeSiteId = "campus";
let activeEnvironmentId = "outside";
let activeLocationStage = "outdoors";
let activeBuildingId = "main";
let activeSceneId = null;
let activeFormat = DEFAULT_FORMAT;
let activeSogMode = "classic";
let activeFpNavigationMode = selectionPreferences.fpNavigationMode;
let hdEnabled = selectionPreferences.hdEnabled;
let clayEnabled = false;
let turntableEnabled = !cinematicAuthorEnabled;
let originalMaterials = [];
let currentStageRotation = timeStageAngles[activeTimeStage];
let currentAssetKey = "";
let currentEngineType = "glb";
let currentActiveAsset = null;
let activeAssetSwapId = 0;
let pendingSogModeTransitionOrbitState = null;
let sogPanIndicatorVisible = false;
let calibrationPanelOpen = false;
let calibrationInputSyncSuspended = false;
let activeHotspots = [];
let activeHotspotId = "";
let selectedHotspotId = "";
let lastHotspotPointerType = "mouse";
let hotspotTransitionActive = false;
let hotspotCloseTimer = null;
// Which target the Streamed Move/Rotate/Scale controls edit: "scene" | "collision"
let streamedCalibTarget = "scene";
// Which target the regular LOD controls edit: "scene" | "box" | "camera"
let lodCalibTarget = "box";
let dialPointerId = null;
let dialStartAngle = 0;
let dialDragged = false;
let skipNextDialClick = false;
let isViewerMode = false;
let isSceneLoading = false;
let performanceToastTimer = null;
let activeMobileControlsPanel = "";
const performanceNoticeKeys = new Set();
const sogViewer = new PlayCanvasSogViewer(splatViewerMount);

setLoggerContextProvider(() => {
  const asset = currentActiveAsset || getActiveAssetDescriptor?.();
  return {
    sceneId: getAnalyticsSceneId(asset),
    sceneName: asset?.label || null,
    format: asset?.format || asset?.fileFormat || activeFormat,
    mode: asset?.streamingEnabled ? "streamed" : (asset?.type === "splat" ? activeSogMode : activeFormat),
  };
});

const FORMAT_LABELS = {
  glb: "GLB",
  sog: "SOG",
};
const FORMAT_PRIORITY = ["sog", "glb"];
const GITHUB_MEDIA_BASE_URL = "https://media.githubusercontent.com/media/Petrakous/Hua-3D-Showcase/main/";
const GITHUB_RAW_BASE_URL = "https://raw.githubusercontent.com/Petrakous/Hua-3D-Showcase/main/";
const calibrationOverrides = loadCalibrationOverrides();
const calibrationSessionDefaults = new Map();
const calibrationSessionSceneDefaults = new Map();
const calibrationSessionCameraDefaults = new Map();

function getAnalyticsSceneId(asset = currentActiveAsset) {
  if (!asset) {
    return activeLocationStage === "outdoors" ? `campus-${activeTimeStage}` : activeSceneId;
  }

  return asset.sceneId ||
    (asset.locationId === "outdoors" ? `campus-${activeTimeStage}` : null) ||
    asset.key ||
    null;
}

function getAnalyticsAssetMetadata(asset = currentActiveAsset, extra = {}) {
  return {
    scene_id: getAnalyticsSceneId(asset),
    asset_key: asset?.key || null,
    label: asset?.label || null,
    location_id: asset?.locationId || activeLocationStage,
    format: asset?.format || activeFormat,
    engine: asset?.type || currentEngineType,
    sog_mode: asset?.streamingEnabled ? "streamed" : activeSogMode,
    fp_navigation_mode: activeFpNavigationMode,
    performance_tier: asset?.performanceTier || null,
    time_stage: activeTimeStage,
    hd_enabled: hdEnabled,
    ...extra,
  };
}

function encodeUrlPathSegments(path = "") {
  return path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function cloneManualBoxConfig(config) {
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

function cloneTransformConfig(config) {
  if (!config) {
    return null;
  }

  return {
    position: [...(config.position || [0, 0, 0])],
    rotationDegrees: [...(config.rotationDegrees || [0, 0, 0])],
    scale: [...(config.scale || [1, 1, 1])],
  };
}

function cloneStreamedTransformConfig(config) {
  if (!config) {
    return null;
  }

  return {
    ...(config.scene ? { scene: cloneTransformConfig(config.scene) } : {}),
    ...(config.collision ? { collision: cloneTransformConfig(config.collision) } : {}),
    ...(config.spawn ? {
      spawn: {
        position: [...(config.spawn.position || [0, 0, 0])],
        rotationDegrees: [...(config.spawn.rotationDegrees || [0, 0, 0])],
      },
    } : {}),
  };
}

function saveCalibrationOverrides() {
  safeLocalStorageSet(SOG_CALIBRATION_OVERRIDES_KEY, JSON.stringify(calibrationOverrides));
}

function buildSceneCalibrationKey(locationId, sceneId = null, stageId = null) {
  if (locationId === "outdoors") {
    return `${locationId}:${stageId || "day"}`;
  }

  return `${locationId}:${sceneId || "default"}`;
}

function getCalibrationOverride(asset) {
  if (!asset?.sceneCalibrationKey) {
    return null;
  }

  return (
    cloneManualBoxConfig(calibrationOverrides[asset.sceneCalibrationKey]) ||
    cloneManualBoxConfig(manualBoxDefaults[asset.sceneCalibrationKey])
  );
}

function getStreamedTransformOverride(asset) {
  if (!asset?.sceneCalibrationKey) {
    return null;
  }

  return (
    cloneStreamedTransformConfig(streamedTransformsOverrides[asset.sceneCalibrationKey]) ||
    cloneStreamedTransformConfig(streamedTransformsDefaults[asset.sceneCalibrationKey])
  );
}

function applyCalibrationOverrideToAsset(asset) {
  if (!asset || asset.type !== "splat") {
    return asset;
  }

  if (collisionPilotEnabled && asset.sceneCalibrationKey === "outdoors:day") {
    asset = {
      ...asset,
      fpCollisionSource: CAMPUS_DAY_COLLISION_PILOT_URL,
      collisionPilot: true,
    };
  }

  if (asset.sceneCalibrationKey) {
    const streamedOverride = getStreamedTransformOverride(asset);
    if (streamedOverride) {
      const updatedAsset = { ...asset };
      if (streamedOverride.scene) {
        updatedAsset.position = streamedOverride.scene.position;
        updatedAsset.rotationDegrees = streamedOverride.scene.rotationDegrees;
        updatedAsset.rotation = degreesToQuaternion(streamedOverride.scene.rotationDegrees);
        updatedAsset.scale = streamedOverride.scene.scale;
      }
      if (!asset.streamingEnabled && streamedOverride.cameraStart) {
        updatedAsset.cameraStartOverride = {
          position: streamedOverride.cameraStart.position,
          rotationDegrees: streamedOverride.cameraStart.rotationDegrees,
        };
        updatedAsset.fpViewPreset = {
          ...(updatedAsset.fpViewPreset || {}),
          cameraPosition: streamedOverride.cameraStart.position,
          cameraRotationDegrees: streamedOverride.cameraStart.rotationDegrees,
        };
      }
      if (streamedOverride.collision) {
        updatedAsset.collisionPosition = streamedOverride.collision.position;
        updatedAsset.collisionRotationDegrees = streamedOverride.collision.rotationDegrees;
        updatedAsset.collisionRotation = degreesToQuaternion(streamedOverride.collision.rotationDegrees);
        updatedAsset.collisionScale = streamedOverride.collision.scale;
      }
      if (asset.streamingEnabled && streamedOverride.spawn) {
        updatedAsset.spawnOverride = {
          position: streamedOverride.spawn.position,
          rotationDegrees: streamedOverride.spawn.rotationDegrees,
        };
      }
      asset = updatedAsset;
    }
  }

  const override = getCalibrationOverride(asset);
  if (!override) {
    return asset;
  }

  return {
    ...asset,
    manualBox: override,
  };
}

function setCalibrationOverride(sceneCalibrationKey, config) {
  if (!sceneCalibrationKey) {
    return;
  }

  calibrationOverrides[sceneCalibrationKey] = cloneManualBoxConfig(config);
  saveCalibrationOverrides();
}

function clearCalibrationOverride(sceneCalibrationKey) {
  if (!sceneCalibrationKey || !Object.prototype.hasOwnProperty.call(calibrationOverrides, sceneCalibrationKey)) {
    return;
  }

  delete calibrationOverrides[sceneCalibrationKey];
  if (Object.keys(calibrationOverrides).length === 0) {
    safeLocalStorageRemove(SOG_CALIBRATION_OVERRIDES_KEY);
    return;
  }

  saveCalibrationOverrides();
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

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "";
  }
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
}

function setProgress(value, details = null) {
  const percent = Math.max(0, Math.min(100, Math.round(value * 100)));
  progressBar.style.width = `${percent}%`;
  progressTrack?.setAttribute("aria-valuenow", String(percent));

  if (details?.total > 0 && Number.isFinite(details.received)) {
    progressMeta.textContent = `${formatBytes(details.received)} of ${formatBytes(details.total)}`;
  } else if (percent > 0 && percent < 100) {
    progressMeta.textContent = `${percent}%`;
  } else {
    progressMeta.textContent = "";
  }
}

function formatTechnicalDetails(details) {
  if (!details) {
    return "";
  }

  if (typeof details === "string") {
    return details;
  }

  try {
    return JSON.stringify(details, null, 2).slice(0, 4000);
  } catch (_error) {
    return String(details).slice(0, 4000);
  }
}

function setStatus(title, text, options = {}) {
  const friendlyTitles = {
    "Loading SOG": "Loading your space",
    "Loading scene metadata": "Loading scene metadata",
    "Preparing FP": "Preparing navigation",
    "Preparing interactions": "Preparing interactions",
    "Preparing streamed LOD": "Preparing streamed view",
    "Finalizing first view": "Finalizing first view",
    "Switching scene": "Preparing your space",
    "Loading scene": "Loading your space",
    "Scene ready": "Ready to explore",
    "SOG ready": "Ready to explore",
    "3D hero active": "Ready to explore",
    "Asset issue": "We couldn't open this space",
  };

  const asset = currentActiveAsset || getActiveAssetDescriptor();
  const sceneId = asset?.sceneId || (asset?.locationId === "outdoors" ? `campus-${activeTimeStage}` : null);
  const exp = sceneId ? resolveSceneExperience(sceneId) : null;

  let finalTitle = friendlyTitles[title] || title;
  let finalCopy = text;

  if (exp) {
    if (title === "Loading SOG" || title === "Loading scene" || title === "Switching scene") {
      finalTitle = exp.loading.title;
      if (/^Fetching\s+https?:|^Fetching\s+\.\//i.test(text || "")) {
        finalCopy = exp.performance.weight === "heavy" && exp.loading.heavyMessage
          ? exp.loading.heavyMessage
          : exp.loading.message;
      }
    } else if (title === "Scene ready" || title === "SOG ready" || title === "3D hero active") {
      finalTitle = "Ready to explore";
      if (exp.loading.readyMessage) {
        finalCopy = exp.loading.readyMessage;
      }
    }
  }

  statusPill.textContent = finalTitle;
  statusCopy.textContent = finalCopy;
  const isError = options.severity === "fatal" || title === "Asset issue";
  const isLoading = options.loading === true || document.body.classList.contains("is-loading");
  statusCancel.hidden = !isLoading || isError;
  statusCancel.disabled = !isLoading || isError;
  statusRetry.hidden = !isError;
  statusBack.hidden = !isError;
  statusRetry.disabled = false;
  const detailsText = formatTechnicalDetails(options.details);
  statusDetails.hidden = !detailsText;
  if (detailsText) {
    statusDetailsText.textContent = detailsText;
  } else {
    statusDetails.open = false;
    statusDetailsText.textContent = "";
  }
}

function setLoadingState(isLoading) {
  isSceneLoading = !!isLoading;
  document.body.classList.toggle("is-loading", isSceneLoading);
  if (!isSceneLoading) {
    statusCancel.hidden = true;
    statusCancel.disabled = false;
  }
}

function setStatusOverlayState(isIdle) {
  viewerStatus.classList.toggle("is-idle", isIdle);
  const shouldHide = isIdle || !isViewerMode;
  viewerStatus.hidden = shouldHide;
  viewerStatus.setAttribute("aria-hidden", String(shouldHide));
}

function isMobileControlPanelAvailable(panel) {
  if (!isViewerMode) {
    return false;
  }

  if (panel === "time") {
    return !timeControlGroup.hidden && isTimeSelectionVisible();
  }

  if (panel === "format") {
    return !formatControl.hidden;
  }

  if (panel === "engine") {
    return !sogModeControl.hidden;
  }

  if (panel === "quality") {
    return [glbQualityControl, fpNavControl, lodControl].some((control) => control && !control.hidden);
  }

  if (panel === "more") {
    return !navigationControl.hidden && !!navigationGroups?.textContent?.trim();
  }

  return false;
}

function setMobileControlsPanel(panel = "") {
  const nextPanel = panel && isMobileControlPanelAvailable(panel) ? panel : "";
  activeMobileControlsPanel = nextPanel;
  document.body.dataset.mobileControlsPanel = nextPanel;

  for (const button of mobileDockButtons) {
    const isActive = button.dataset.mobilePanel === nextPanel;
    button.dataset.active = String(isActive);
    button.setAttribute("aria-expanded", String(isActive));
  }

  const hasOpenPanel = !!nextPanel;
  if (mobileControlsScrim) {
    mobileControlsScrim.hidden = !hasOpenPanel;
    mobileControlsScrim.setAttribute("aria-hidden", String(!hasOpenPanel));
  }
}

function updateMobileControlsUi() {
  if (!mobileControlsDock) {
    return;
  }

  for (const button of mobileDockButtons) {
    const panel = button.dataset.mobilePanel;
    const available = isMobileControlPanelAvailable(panel);
    button.hidden = !available;
    button.disabled = !available;
  }

  mobileControlsDock.hidden = !mobileDockButtons.some((button) => !button.hidden);

  if (activeMobileControlsPanel && !isMobileControlPanelAvailable(activeMobileControlsPanel)) {
    setMobileControlsPanel("");
  } else {
    setMobileControlsPanel(activeMobileControlsPanel);
  }
}

function showPerformanceNotice(key, message) {
  if (!performanceToast || !key || performanceNoticeKeys.has(key)) {
    return;
  }

  performanceNoticeKeys.add(key);
  performanceToast.textContent = message;
  performanceToast.hidden = false;
  performanceToast.setAttribute("aria-hidden", "false");
  performanceToast.classList.add("is-visible");

  if (performanceToastTimer) {
    clearTimeout(performanceToastTimer);
  }

  performanceToastTimer = setTimeout(() => {
    performanceToast.classList.remove("is-visible");
    performanceToast.setAttribute("aria-hidden", "true");
  }, 4600);
}

function getFriendlyLoadError(error, asset = currentActiveAsset || getActiveAssetDescriptor()) {
  const message = String(error?.message || error || "");
  const networkAdvice = " If this persists, try switching to a different network, using mobile data, or connecting to a personal hotspot.";
  if (/webgl|graphics device|context/i.test(message)) {
    return "The 3D renderer was interrupted. Try a lighter LOD, choose SOG LOD again, or use a desktop device for the highest detail.";
  }
  if (/lod-meta|metadata|json/i.test(message)) {
    return "This streamed space could not load its scene metadata." + networkAdvice;
  }
  if (/timeout|timed out|stalled/i.test(message)) {
    return "This model is taking too long to prepare. You can choose another format or a lighter LOD without leaving the page.";
  }
  if (/failed to load|fetch|network|cors|404|403|asset/i.test(message)) {
    return (asset?.streamingEnabled
      ? "Some 3D data failed to download. Check your connection."
      : "This space could not be loaded. Check your connection.") + networkAdvice;
  }
  if (/memory|budget|allocation/i.test(message)) {
    return "This model may need more device resources. The highest-detail models are best on desktop; try Fast or Balanced LOD.";
  }
  return "This space could not be loaded. Choose another format or LOD, or go back to all spaces." + networkAdvice;
}

function buildErrorDetails(error, asset = currentActiveAsset || getActiveAssetDescriptor(), extra = {}) {
  return {
    scene_id: getAnalyticsSceneId(asset),
    scene_name: asset?.label || null,
    format: asset?.format || asset?.fileFormat || null,
    mode: asset?.streamingEnabled ? "streamed" : (asset?.type || null),
    source: asset?.src || null,
    message: error?.message || String(error || "Unknown error"),
    stack: error?.stack || "",
    error_details: error?.details || null,
    ...extra,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cloneHotspot(hotspot) {
  return {
    ...hotspot,
    position: {
      x: Number(hotspot.position?.x ?? 0),
      y: Number(hotspot.position?.y ?? 0),
      z: Number(hotspot.position?.z ?? 0),
    },
  };
}

function getActiveExperienceSceneId(asset = currentActiveAsset) {
  return asset?.sceneId || (asset?.locationId === "outdoors" ? `campus-${activeTimeStage}` : null);
}

function getHotspotsForAsset(asset = currentActiveAsset) {
  const sceneId = getActiveExperienceSceneId(asset);
  if (!sceneId) return [];
  const exp = resolveSceneExperience(sceneId);
  return (exp.future?.hotspots || [])
    .filter((hotspot) => hotspot.enabled || calibrationUiUnlocked)
    .map(cloneHotspot);
}

function getActiveHotspotById(id = activeHotspotId) {
  return activeHotspots.find((hotspot) => hotspot.id === id) || null;
}

function getSelectedHotspot() {
  return getActiveHotspotById(selectedHotspotId) || activeHotspots[0] || null;
}

function hotspotPositionArray(hotspot) {
  return [
    Number(hotspot?.position?.x ?? 0),
    Number(hotspot?.position?.y ?? 0),
    Number(hotspot?.position?.z ?? 0),
  ];
}

function getHotspotTargetScene(hotspot) {
  return hotspot?.targetSceneId ? getCampusIndoorSceneById(hotspot.targetSceneId) : null;
}

function resolveHotspotThumbnail(hotspot) {
  if (hotspot?.thumbnail) return hotspot.thumbnail;
  const targetScene = getHotspotTargetScene(hotspot);
  return targetScene?.thumbnail || null;
}

function renderHotspotCard(hotspot) {
  const thumbnail = resolveHotspotThumbnail(hotspot);
  const media = thumbnail
    ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy" />`
    : `<span>${escapeHtml((hotspot.title || "Go").slice(0, 2).toUpperCase())}</span>`;
  return `
    <div class="hotspot-card__shell">
      <div class="hotspot-card__media">${media}</div>
      <div class="hotspot-card__body">
        <h3>${escapeHtml(hotspot.title)}</h3>
        <p>${escapeHtml(hotspot.description || "")}</p>
        <button class="hotspot-card__cta" type="button" data-hotspot-enter="${escapeHtml(hotspot.id)}">Enter</button>
      </div>
    </div>
  `;
}

function clearHotspotOverlay() {
  activeHotspots = [];
  activeHotspotId = "";
  selectedHotspotId = "";
  hotspotOverlay.innerHTML = "";
  sogViewer?.clearHotspotMarkers?.();
  updateHotspotCalibrationUi();
}

function renderActiveHotspots() {
  activeHotspots = getHotspotsForAsset();
  activeHotspotId = "";
  // SOG hotspots use the viewer's dedicated GPU overlay layer. Keeping the legacy
  // DOM overlay out of that path avoids a second coordinate system and projection drift.
  hotspotOverlay.hidden = currentEngineType === "splat";
  if (!activeHotspots.some((hotspot) => hotspot.id === selectedHotspotId)) {
    selectedHotspotId = activeHotspots[0]?.id || "";
  }

  hotspotOverlay.innerHTML = activeHotspots.map((hotspot) => `
    <button
      class="hotspot-marker"
      type="button"
      data-hotspot-id="${escapeHtml(hotspot.id)}"
      data-active="false"
      data-selected="${String(hotspot.id === selectedHotspotId)}"
      aria-label="${escapeHtml(hotspot.title)}"
      title="${escapeHtml(hotspot.title)}"
    ><span class="hotspot-marker__visual" aria-hidden="true"></span></button>
    <article class="hotspot-card" data-hotspot-card="${escapeHtml(hotspot.id)}" data-open="false" hidden>
      ${renderHotspotCard(hotspot)}
    </article>
  `).join("");

  for (const marker of hotspotOverlay.querySelectorAll(".hotspot-marker")) {
    marker.addEventListener("pointerdown", (event) => {
      lastHotspotPointerType = event.pointerType || "mouse";
    });
    marker.addEventListener("mouseenter", () => {
      if (currentEngineType === "splat") return;
      if (lastHotspotPointerType !== "touch") openHotspotCard(marker.dataset.hotspotId);
    });
    marker.addEventListener("mouseleave", () => {
      if (lastHotspotPointerType !== "touch") scheduleHotspotCardClose();
    });
    marker.addEventListener("focus", () => openHotspotCard(marker.dataset.hotspotId));
    marker.addEventListener("blur", () => scheduleHotspotCardClose());
    marker.addEventListener("click", () => {
      const hotspot = getActiveHotspotById(marker.dataset.hotspotId);
      if (!hotspot) return;
      if (calibrationPanelOpen) {
        selectHotspotForCalibration(hotspot.id);
        openHotspotCard(hotspot.id);
        return;
      }
      if (currentEngineType === "splat") {
        activateHotspot(hotspot);
        return;
      }
      if (lastHotspotPointerType === "touch") {
        if (activeHotspotId === hotspot.id) {
          closeHotspotCard();
        } else {
          openHotspotCard(hotspot.id);
        }
        return;
      }
      activateHotspot(hotspot);
    });
  }

  for (const card of hotspotOverlay.querySelectorAll(".hotspot-card")) {
    card.addEventListener("mouseenter", cancelHotspotCardClose);
    card.addEventListener("mouseleave", scheduleHotspotCardClose);
    card.addEventListener("focusin", cancelHotspotCardClose);
    card.addEventListener("focusout", scheduleHotspotCardClose);
  }

  for (const button of hotspotOverlay.querySelectorAll("[data-hotspot-enter]")) {
    button.addEventListener("click", () => {
      const hotspot = getActiveHotspotById(button.dataset.hotspotEnter);
      if (hotspot) activateHotspot(hotspot);
    });
  }

  updateHotspotOverlay();
  syncViewerHotspotMarkers();
  updateHotspotCalibrationUi();
}

function openHotspotCard(hotspotId) {
  cancelHotspotCardClose();
  activeHotspotId = hotspotId || "";
  for (const marker of hotspotOverlay.querySelectorAll(".hotspot-marker")) {
    marker.dataset.active = String(marker.dataset.hotspotId === activeHotspotId);
  }
  for (const card of hotspotOverlay.querySelectorAll(".hotspot-card")) {
    const open = card.dataset.hotspotCard === activeHotspotId;
    card.hidden = !open;
    requestAnimationFrame(() => {
      card.dataset.open = String(open);
    });
  }
  updateHotspotOverlay();
}

function closeHotspotCard() {
  cancelHotspotCardClose();
  activeHotspotId = "";
  for (const marker of hotspotOverlay.querySelectorAll(".hotspot-marker")) {
    marker.dataset.active = "false";
  }
  for (const card of hotspotOverlay.querySelectorAll(".hotspot-card")) {
    card.dataset.open = "false";
    card.hidden = true;
  }
}

function cancelHotspotCardClose() {
  if (hotspotCloseTimer) {
    clearTimeout(hotspotCloseTimer);
    hotspotCloseTimer = null;
  }
}

function scheduleHotspotCardClose() {
  cancelHotspotCardClose();
  hotspotCloseTimer = setTimeout(() => {
    const activeElement = document.activeElement;
    if (activeElement?.closest?.(".hotspot-marker, .hotspot-card")) {
      return;
    }
    closeHotspotCard();
  }, 90);
}

function getHotspotNudgeForKey(key, code = "") {
  const codeNudges = {
    ArrowLeft: ["x", -1],
    ArrowRight: ["x", 1],
    KeyA: ["x", -1],
    KeyD: ["x", 1],
    KeyQ: ["y", -1],
    KeyE: ["y", 1],
    ArrowDown: ["z", -1],
    ArrowUp: ["z", 1],
    KeyS: ["z", -1],
    KeyW: ["z", 1],
  };
  if (codeNudges[code]) return codeNudges[code];

  return {
    ArrowLeft: ["x", -1],
    ArrowRight: ["x", 1],
    a: ["x", -1],
    A: ["x", -1],
    d: ["x", 1],
    D: ["x", 1],
    q: ["y", -1],
    Q: ["y", -1],
    e: ["y", 1],
    E: ["y", 1],
    ArrowDown: ["z", -1],
    ArrowUp: ["z", 1],
    s: ["z", -1],
    S: ["z", -1],
    w: ["z", 1],
    W: ["z", 1],
  }[key] || null;
}

function shouldIgnoreHotspotNudgeEvent(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const target = event.target;
  if (target?.isContentEditable) return true;
  const tagName = target?.tagName?.toLowerCase();
  return tagName === "textarea";
}

function handleHotspotNudgeKeydown(event) {
  if (
    !calibrationUiUnlocked ||
    !calibrationPanelOpen ||
    !activeHotspots.length ||
    shouldIgnoreHotspotNudgeEvent(event)
  ) {
    return;
  }
  const nudge = getHotspotNudgeForKey(event.key, event.code);
  if (!nudge) return;
  if (nudgeSelectedHotspot(nudge[0], nudge[1])) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function updateHotspotOverlay() {
  if (currentEngineType === "splat") {
    hotspotOverlay.hidden = true;
    return;
  }
  if (!activeHotspots.length || !sogViewer?.projectWorldPoint) {
    return;
  }

  for (const hotspot of activeHotspots) {
    const projection = sogViewer.projectWorldPoint(hotspotPositionArray(hotspot));
    const marker = hotspotOverlay.querySelector(`[data-hotspot-id="${CSS.escape(hotspot.id)}"]`);
    const card = hotspotOverlay.querySelector(`[data-hotspot-card="${CSS.escape(hotspot.id)}"]`);
    const visible = !!projection?.visible;
    if (marker) {
      marker.hidden = !visible;
      marker.dataset.selected = String(hotspot.id === selectedHotspotId && calibrationPanelOpen);
      const markerVisual = marker.querySelector(".hotspot-marker__visual");
      if (markerVisual) markerVisual.hidden = false;
      if (visible) {
        marker.style.left = `${projection.x}px`;
        marker.style.top = `${projection.y}px`;
        marker.style.setProperty("--hotspot-scale", "1");
      }
    }
    if (card) {
      if (currentEngineType === "splat" || !visible || card.dataset.open !== "true") {
        card.hidden = true;
      } else {
        card.hidden = false;
        card.style.left = `${Math.max(14, Math.min(projection.x, hotspotOverlay.clientWidth - 14))}px`;
        card.style.top = `${Math.max(120, Math.min(projection.y, hotspotOverlay.clientHeight - 14))}px`;
      }
    }
  }
}

function syncViewerHotspotMarkers() {
  if (currentEngineType !== "splat" || !sogViewer?.setHotspotMarkers) {
    return;
  }
  sogViewer.setHotspotMarkers(activeHotspots.map((hotspot) => ({
    id: hotspot.id,
    position: hotspot.position,
    selected: hotspot.id === selectedHotspotId && calibrationPanelOpen,
  })), {
    visible: activeHotspots.length > 0,
  });
}

function updateHotspotCalibrationUi() {
  const available = calibrationUiUnlocked && currentEngineType === "splat" && activeHotspots.length > 0;
  hotspotCalibrationControls.hidden = !available;
  if (!available) {
    hotspotCalibrationSelect.innerHTML = "";
    hotspotCalibrationPosition.textContent = "x 0.000 · y 0.000 · z 0.000";
    return;
  }

  if (!activeHotspots.some((hotspot) => hotspot.id === selectedHotspotId)) {
    selectedHotspotId = activeHotspots[0]?.id || "";
  }

  hotspotCalibrationSelect.innerHTML = activeHotspots.map((hotspot) => `
    <option value="${escapeHtml(hotspot.id)}"${hotspot.id === selectedHotspotId ? " selected" : ""}>${escapeHtml(hotspot.title)}</option>
  `).join("");
  const hotspot = getSelectedHotspot();
  const [x, y, z] = hotspotPositionArray(hotspot);
  hotspotCalibrationPosition.textContent = `x ${x.toFixed(3)} · y ${y.toFixed(3)} · z ${z.toFixed(3)}`;
  syncViewerHotspotMarkers();
  updateHotspotOverlay();
}

function selectHotspotForCalibration(hotspotId) {
  selectedHotspotId = hotspotId || selectedHotspotId;
  updateHotspotCalibrationUi();
}

function nudgeSelectedHotspot(axis, direction) {
  if (!calibrationUiUnlocked || !calibrationPanelOpen || !activeHotspots.length) return false;
  const hotspot = getSelectedHotspot();
  if (!hotspot) return false;
  const step = Number.parseFloat(hotspotCalibrationStep.value) || 0.1;
  hotspot.position[axis] = Number((Number(hotspot.position[axis] ?? 0) + direction * step).toFixed(4));
  openHotspotCard(hotspot.id);
  updateHotspotCalibrationUi();
  return true;
}

async function copyHotspotPayload(payload, successMessage) {
  try {
    await navigator.clipboard.writeText(payload);
    setStatus("Hotspot copied", successMessage);
  } catch (_error) {
    setStatus("Copy unavailable", "Clipboard access is blocked in this browser context.");
  }
  setStatusOverlayState(false);
  requestAnimationFrame(() => setStatusOverlayState(true));
}

function copySelectedHotspotPosition() {
  const hotspot = getSelectedHotspot();
  if (!hotspot) return;
  copyHotspotPayload(JSON.stringify({ position: hotspot.position }, null, 2), "The hotspot position JSON was copied.");
}

function copySelectedHotspotJson() {
  const hotspot = getSelectedHotspot();
  if (!hotspot) return;
  copyHotspotPayload(JSON.stringify(hotspot, null, 2), "The selected hotspot JSON was copied.");
}

function copyAllHotspotsJson() {
  copyHotspotPayload(JSON.stringify(activeHotspots, null, 2), "All hotspots for this scene were copied.");
}

function setHotspotTransitionVisible(visible, text = "Entering space...") {
  hotspotTransitionActive = !!visible;
  hotspotTransitionText.textContent = text;
  hotspotTransitionOverlay.hidden = false;
  hotspotTransitionOverlay.setAttribute("aria-hidden", String(!visible));
  requestAnimationFrame(() => {
    hotspotTransitionOverlay.dataset.active = String(visible);
  });
  if (!visible) {
    setTimeout(() => {
      if (!hotspotTransitionActive) {
        hotspotTransitionOverlay.hidden = true;
      }
    }, 260);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function activateHotspot(hotspot) {
  if (!hotspot || hotspotTransitionActive) return;
  if (hotspot.type !== "scene-link") {
    setStatus("Hotspot unavailable", "This hotspot type is not supported yet.");
    return;
  }

  const targetScene = getHotspotTargetScene(hotspot);
  if (!targetScene) {
    setStatus("Hotspot unavailable", "The linked scene is not available yet.");
    return;
  }

  closeHotspotCard();
  sogViewer.focusWorldPoint?.(hotspotPositionArray(hotspot), { distanceMultiplier: 0.34, maxDistance: 10 });
  setHotspotTransitionVisible(true, `Entering ${hotspot.targetSceneTitle || targetScene.label || "space"}...`);
  try {
    await wait(420);

    activeSiteId = "campus";
    activeEnvironmentId = "inside";
    activeBuildingId = CAMPUS_INDOOR_BUILDINGS.find((building) =>
      building.spaces.some((space) => space.sceneId === hotspot.targetSceneId)
    )?.id || activeBuildingId;
    activeSceneId = hotspot.targetSceneId;
    activeSogMode = selectionPreferences.sogMode;
    activeFpNavigationMode = selectionPreferences.fpNavigationMode;
    syncNavigationState();
    preferDefaultFormatForCurrentContext();
    updateLocationUi();
    updateQualityToggle();
    updateMaterialToggle();
    updateTimeUi();
    enterViewerMode();
    await applyActiveAssetSelection({ forceReload: true });
  } finally {
    setHotspotTransitionVisible(false);
  }
}

function getSceneCardEntries() {
  const campusExp = resolveSceneExperience("campus-day");
  const ditExp = resolveSceneExperience("dit-main");
  const laboratorySectionSceneIds = new Set(["biology-lab", "systasis", "metabolism", "geo3-3", "fitness", "kitchen"]);

  const cards = [
    {
      id: "campus-outside",
      section: "outdoor",
      title: campusExp.title.split(" ")[0], // Campus
      context: campusExp.subtitle,
      description: "Explore the university grounds across day, dusk and night.",
      formats: Object.keys(LOCATION_CATALOG.outdoors?.stages?.day || {}),
      selection: { site: "campus", environment: "outside", stage: "day" },
      thumbnail: LOCATION_CATALOG.outdoors?.thumbnail || null,
    },
    {
      id: "dit-outside",
      section: "outdoor",
      title: ditExp.title,
      context: ditExp.subtitle,
      description: ditExp.description,
      formats: Object.keys(LOCATION_CATALOG.dit?.scene?.assets || {}),
      selection: { site: "dit", environment: "outside", stage: "dusk" },
      thumbnail: LOCATION_CATALOG.dit?.scene?.thumbnail || null,
    },
  ];

  for (const building of CAMPUS_INDOOR_BUILDINGS) {
    for (const space of building.spaces) {
      const scene = getCampusIndoorSceneById(space.sceneId);
      if (!scene) continue;
      const exp = resolveSceneExperience(scene.id);
      cards.push({
        id: `indoor-${scene.id}`,
        section: laboratorySectionSceneIds.has(scene.id) ? "labs" : "interiors",
        title: exp.title,
        context: `${building.label} - ${getCategoryLabel(exp.category)}`,
        description: exp.description,
        formats: Object.keys(scene.assets || {}),
        selection: { site: "campus", environment: "inside", building: building.id, scene: scene.id },
        thumbnail: scene.thumbnail || null,
      });
    }
  }

  return cards;
}

function renderSceneCards() {
  const allCards = getSceneCardEntries();
  const searchLower = searchQuery.trim().toLowerCase();

  const cards = allCards.filter((card) => {
    if (activeFilter === "outdoor" && card.section !== "outdoor") return false;
    if (activeFilter === "indoor" && card.section !== "interiors") return false;
    if (activeFilter === "lab" && card.section !== "labs") return false;

    if (searchLower) {
      const matchTitle = card.title.toLowerCase().includes(searchLower);
      const matchDesc = card.description.toLowerCase().includes(searchLower);
      const matchContext = card.context.toLowerCase().includes(searchLower);
      if (!matchTitle && !matchDesc && !matchContext) return false;
    }
    return true;
  });

  const isEmpty = cards.length === 0;
  sceneCardsEmpty.hidden = !isEmpty;
  sceneCardGrid.hidden = isEmpty;

  if (isEmpty) {
    sceneCardGrid.innerHTML = "";
    return;
  }

  const sections = [
    { id: "outdoor", eyebrow: "Campus & buildings", title: "Explore from the outside" },
    { id: "interiors", eyebrow: "Teaching & community", title: "Step inside" },
    { id: "labs", eyebrow: "Research facilities", title: "Visit our laboratories" },
  ];
  let cardIndex = 0;

  sceneCardGrid.innerHTML = sections.map((section) => {
    const sectionCards = cards.filter((card) => card.section === section.id);
    if (!sectionCards.length) return "";
    const cardMarkup = sectionCards.map((card) => {
      const index = cardIndex++;
      const media = card.thumbnail
        ? `<img src="${escapeHtml(card.thumbnail)}" alt="" loading="lazy" />`
        : `<span class="scene-card__monogram" aria-hidden="true">${escapeHtml(card.title.slice(0, 2).toUpperCase())}</span>`;
      const formats = card.formats.map((format) => `<span>${escapeHtml(FORMAT_LABELS[format] || format.toUpperCase())}</span>`).join("");

      const sceneId = card.selection.scene || (card.selection.site === "campus" ? "campus-day" : "dit-main");
      const exp = resolveSceneExperience(sceneId);
      let badgeHtml = "";
      if (isMobileDevice) {
        if (exp?.performance?.weight === "heavy") {
          badgeHtml = `<span class="scene-card__device-badge scene-card__device-badge--warn">⚠️ Best on desktop</span>`;
        } else {
          badgeHtml = `<span class="scene-card__device-badge scene-card__device-badge--good">✓ Recommended for device</span>`;
        }
      } else {
        badgeHtml = `<span class="scene-card__device-badge scene-card__device-badge--good">✓ Optimized for desktop</span>`;
      }

      return `
      <article class="scene-card" style="--card-index:${index}" data-card-id="${escapeHtml(card.id)}">
        <div class="scene-card__media${card.thumbnail ? " scene-card__media--thumbnail" : ""}">${media}</div>
        <div class="scene-card__body">
          <div class="scene-card__meta">
            <span>${escapeHtml(card.context)}</span>
            <span class="scene-card__formats">${formats}</span>
          </div>
          ${badgeHtml}
          <h2>${escapeHtml(card.title)}</h2>
          <p>${escapeHtml(card.description)}</p>
          <button class="scene-card__cta" type="button" data-scene-card="${escapeHtml(card.id)}">
            <span>Explore space</span><span class="scene-card__arrow" aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </article>
      `;
    }).join("");

    return `
      <section class="scene-group" aria-labelledby="scene-group-${escapeHtml(section.id)}">
        <div class="scene-group__heading">
          <p>${escapeHtml(section.eyebrow)}</p>
          <h2 id="scene-group-${escapeHtml(section.id)}">${escapeHtml(section.title)}</h2>
          <span>${sectionCards.length} ${sectionCards.length === 1 ? "space" : "spaces"}</span>
        </div>
        <div class="scene-group__grid">${cardMarkup}</div>
      </section>
    `;
  }).join("");

  for (const button of sceneCardGrid.querySelectorAll("[data-scene-card]")) {
    button.addEventListener("click", () => selectSceneCard(button.dataset.sceneCard));
  }
}

function enterViewerMode() {
  isViewerMode = true;
  document.body.classList.remove("is-scene-selection");
  document.body.classList.add("is-viewer-mode");
  sceneSelection.hidden = true;
  sceneSelection.setAttribute("aria-hidden", "true");
  viewerBackButton.hidden = false;
  updateMobileControlsUi();
  showControlsHelpOverlay();
}

function exitViewerMode() {
  ++activeAssetSwapId;
  setLoadingState(false);
  setMobileControlsPanel("");
  releaseActiveViewerResources();
  isViewerMode = false;
  document.body.classList.remove("is-viewer-mode");
  document.body.classList.add("is-scene-selection");
  document.body.classList.remove("is-error");
  sceneSelection.hidden = false;
  sceneSelection.setAttribute("aria-hidden", "false");
  sceneSelection.scrollTop = 0;
  viewerBackButton.hidden = true;
  setStatusOverlayState(true);
  updateMobileControlsUi();
  hideControlsHelpOverlay();
}

async function selectSceneCard(cardId) {
  const card = getSceneCardEntries().find((entry) => entry.id === cardId);
  if (!card) return;

  const selection = card.selection;
  activeSiteId = selection.site;
  activeEnvironmentId = selection.environment;
  activeTimeStage = selection.stage || activeTimeStage;
  activeBuildingId = selection.building || activeBuildingId;
  activeSceneId = selection.scene || null;
  updateSelectionPreferences({ timeStage: activeTimeStage });
  activeSogMode = selectionPreferences.sogMode;
  activeFpNavigationMode = selectionPreferences.fpNavigationMode;
  syncNavigationState();
  preferDefaultFormatForCurrentContext();
  updateLocationUi();
  updateQualityToggle();
  updateMaterialToggle();
  updateTimeUi();
  enterViewerMode();
  await applyActiveAssetSelection();
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
  const sceneId = scene?.id || (activeLocationStage === "outdoors" ? `campus-${activeTimeStage}` : null);
  const exp = sceneId ? resolveSceneExperience(sceneId) : null;
  const preferredOrder = exp?.fallbacks?.preferredOrder || ["sog", "glb"];

  const formats = Object.keys(scene?.assets || {});
  if (cinematicAuthorEnabled && formats.includes("sog")) {
    return "sog";
  }

  for (const fmt of preferredOrder) {
    if (formats.includes(fmt)) {
      return fmt;
    }
  }
  return sortFormats(formats)[0] || "glb";
}

function getDefaultFormat(scene = getCurrentSceneEntry()) {
  const availableFormats = getAvailableFormats();
  if (availableFormats.includes(DEFAULT_FORMAT)) {
    return "sog";
  }

  const preferredFormat = scene ? getPreferredFormat(scene) : null;
  return availableFormats.includes(preferredFormat)
    ? preferredFormat
    : availableFormats[0] || "glb";
}

function preferDefaultFormatForCurrentContext() {
  const availableFormats = getAvailableFormats();
  const defaultFormat = getDefaultFormat();
  activeFormat = availableFormats.includes(defaultFormat)
    ? defaultFormat
    : availableFormats[0] || "glb";
  if (activeFormat === "sog") {
    activeSogMode = "classic";
  }
  updateSelectionPreferences({
    format: activeFormat,
    ...(activeFormat === "sog" ? {
      sogMode: "classic",
      lodTier: autoPerformanceProfile.tier,
    } : {}),
  });
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
      if (isTimeStageAvailable(selectionPreferences.timeStage)) {
        activeTimeStage = selectionPreferences.timeStage;
      } else if (!isTimeStageAvailable(activeTimeStage)) {
        activeTimeStage = getFirstAvailableTimeStage();
      }
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
    const outdoorPriority = ["sog", "glb"];
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
  const formats = sortFormats(Object.keys(scene?.assets || {}));
  if (cinematicAuthorEnabled && formats.includes("sog")) {
    return ["sog", ...formats.filter((format) => format !== "sog")];
  }
  return formats;
}

function normalizeActiveFormat() {
  const availableFormats = getAvailableFormats();
  if (!availableFormats.length) {
    activeFormat = "glb";
    return;
  }

  if (availableFormats.includes(activeFormat)) {
    return;
  }

  if (availableFormats.includes(DEFAULT_FORMAT)) {
    activeFormat = DEFAULT_FORMAT;
  } else {
    activeFormat = getDefaultFormat() || availableFormats[0] || "glb";
  }
}

function normalizeActiveQuality() {
  const hdAvailable =
    isCampusOutsideSelected() &&
    activeFormat === "glb" &&
    !!getOutdoorAsset(activeTimeStage, "hd", activeFormat);
  hdEnabled = hdAvailable && selectionPreferences.hdEnabled === true;
}

function getFpNavigationModesForAsset(asset) {
  const sceneId = asset?.sceneId || (asset?.locationId === "outdoors" ? `campus-${activeTimeStage}` : null);
  const exp = sceneId ? resolveSceneExperience(sceneId) : null;
  const hasWalk = exp ? exp.navigation.walk : !!asset?.streamingEnabled;
  const hasFly = exp ? exp.navigation.fly : !!asset?.streamingEnabled;
  const modes = [];
  if (hasWalk) modes.push("walk");
  if (hasFly) modes.push("fly");
  return { modes, exp };
}

function normalizeActiveFpNavigationMode(asset) {
  const { modes, exp } = getFpNavigationModesForAsset(asset);
  const defaultToWalk = isMobileDevice && exp?.navigation?.tapToMove && modes.includes("walk");
  const preferredMode = defaultToWalk ? "walk" : selectionPreferences.fpNavigationMode;

  if (!asset?.streamingEnabled) {
    activeFpNavigationMode = preferredMode;
    return;
  }

  if (!modes.length || modes.includes(preferredMode)) {
    activeFpNavigationMode = preferredMode;
    return;
  }

  activeFpNavigationMode =
    (exp?.defaults?.firstPersonMode && modes.includes(exp.defaults.firstPersonMode))
      ? exp.defaults.firstPersonMode
      : modes[0];
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

  let tier = selectionPreferences.lodTier || autoPerformanceProfile.tier;
  if (tier === "auto") {
    tier = autoPerformanceProfile.tier;
  }
  const performanceSources = asset.performanceSources || {};
  let nextSrc = asset.src;
  let performanceTier = "lod0";

  if (tier === "lod4") {
    nextSrc = performanceSources.lod4 || performanceSources.lod3 || performanceSources.lod2 || performanceSources.lod1 || performanceSources.lod0 || asset.src;
    performanceTier = "lod4";
  } else if (tier === "lod3") {
    nextSrc = performanceSources.lod3 || performanceSources.lod4 || performanceSources.lod2 || performanceSources.lod1 || performanceSources.lod0 || asset.src;
    performanceTier = "lod3";
  } else if (tier === "lod2") {
    nextSrc = performanceSources.lod2 || performanceSources.lod1 || performanceSources.lod0 || performanceSources.lod3 || performanceSources.lod4 || asset.src;
    performanceTier = "lod2";
  } else if (tier === "lod1") {
    nextSrc = performanceSources.lod1 || performanceSources.lod0 || asset.src;
    performanceTier = "lod1";
  } else {
    nextSrc = performanceSources.lod0 || asset.src;
    performanceTier = "lod0";
  }

  if (nextSrc === asset.src && !performanceSources[performanceTier]) {
      performanceTier = "lod0"; 
  } else {
      if (nextSrc === performanceSources.lod4) performanceTier = "lod4";
      else if (nextSrc === performanceSources.lod3) performanceTier = "lod3";
      else if (nextSrc === performanceSources.lod2) performanceTier = "lod2";
      else if (nextSrc === performanceSources.lod1) performanceTier = "lod1";
      else if (nextSrc === performanceSources.lod0) performanceTier = "lod0";
  }

  return {
    ...asset,
    src: nextSrc,
    originalSrc: asset.src,
    performanceTier,
  };
}

function getEffectiveSogMode(asset) {
  if (!asset || asset.type !== "splat" || asset.fileFormat !== "sog") {
    return "classic";
  }

  // A culling/collision box is useful for indoor walk mode, but it is not a
  // prerequisite for loading a streamed SOG. Outdoor scenes can start in fly
  // mode from the current orbit camera without one.
  return activeSogMode === "streamed" && asset.streamingSource ? "streamed" : "classic";
}

function finalizeSogAsset(asset) {
  if (!asset || asset.type !== "splat") {
    return asset;
  }

  const nextAsset = getEffectiveSogMode(asset) === "streamed"
    ? selectStreamingSogAsset(asset)
    : selectPerformanceSogAsset(asset);

  return applyCalibrationOverrideToAsset(nextAsset);
}

function getActiveAssetDescriptor() {
  syncNavigationState();
  normalizeActiveFormat();
  normalizeActiveQuality();

  if (isCampusOutsideSelected()) {
    const qualityKey = hdEnabled ? "hd" : "web";
    const asset = getOutdoorAsset(activeTimeStage, qualityKey, activeFormat);
    const baseAsset = {
      ...asset,
      key: `outdoors:${activeTimeStage}:${activeFormat}:${qualityKey}:${getEffectiveSogMode(asset)}`,
      label: `${timeLabels[activeTimeStage]}${hdEnabled ? " HD" : ""}`,
      locationId: "outdoors",
      format: activeFormat,
      sceneCalibrationKey: buildSceneCalibrationKey("outdoors", null, activeTimeStage),
      sourceManualBox: cloneManualBoxConfig(asset?.manualBox),
    };

    const finalAsset = finalizeSogAsset(baseAsset);
    normalizeActiveFpNavigationMode(finalAsset);
    return finalAsset;
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

    const baseAsset = {
      ...asset,
      key: `dit:outside:${activeTimeStage}:${activeFormat}:${getEffectiveSogMode(asset)}`,
      label: scene.label,
      locationId: "dit",
      format: activeFormat,
      sceneCalibrationKey: buildSceneCalibrationKey("dit", scene.id, activeTimeStage),
      sourceManualBox: cloneManualBoxConfig(asset?.manualBox),
    };

    const finalAsset = finalizeSogAsset(baseAsset);
    normalizeActiveFpNavigationMode(finalAsset);
    return finalAsset;
  }

  const locationEntry = getCurrentLocationEntry();
  normalizeActiveScene();
  const scene = getCurrentSceneEntry();
  const asset = scene?.assets?.[activeFormat] || scene?.assets?.glb || Object.values(scene?.assets || {})[0];

  if (!asset) {
    return null;
  }

  const baseAsset = {
    ...asset,
    key: `${locationEntry.id}:${scene.id}:${activeFormat}:${getEffectiveSogMode(asset)}`,
    label: scene.label,
    locationId: locationEntry.id,
    sceneId: scene.id,
    format: activeFormat,
    sceneCalibrationKey: buildSceneCalibrationKey(locationEntry.id, scene.id),
    sourceManualBox: cloneManualBoxConfig(asset?.manualBox),
  };

  const finalAsset = finalizeSogAsset(baseAsset);
  normalizeActiveFpNavigationMode(finalAsset);
  return finalAsset;
}

function describeActiveAsset(asset = getActiveAssetDescriptor()) {
  if (!asset) {
    return getCurrentContextLabel();
  }

  const tierMap = { lod0: "LOD0", lod1: "LOD1", lod2: "LOD2", lod3: "LOD3", lod4: "LOD4" };
  const tierName = tierMap[asset.performanceTier] || asset.performanceTier;
  const modeSuffix =
    asset?.type === "splat" && asset?.runtime === "playcanvas" && asset?.fileFormat === "sog"
      ? (asset.streamingEnabled ? ` / ${activeFpNavigationMode === "fly" ? "Fly" : "Walk"}` : " / LOD")
      : "";

  if (isCampusOutsideSelected()) {
    const tierSuffix = asset.performanceTier && asset.performanceTier !== "lod0"
      ? ` / ${tierName}`
      : "";
    return `${getCurrentContextLabel()} (${FORMAT_LABELS[asset.format] || "GLB"}${modeSuffix}${!asset.streamingEnabled ? tierSuffix : ""})`;
  }

  const formatLabel = FORMAT_LABELS[asset.format] || FORMAT_LABELS[asset.fileFormat] || "GLB";
  const tierSuffix = asset.performanceTier && asset.performanceTier !== "lod0"
    ? ` / ${tierName}`
    : "";
  return `${getCurrentContextLabel()} (${formatLabel}${modeSuffix}${!asset.streamingEnabled ? tierSuffix : ""})`;
}

function describeLoadedAssetStatus(asset = getActiveAssetDescriptor()) {
  const base = `${describeActiveAsset(asset)} is loaded`;
  if (asset?.streamingEnabled) {
    return `${base}. Click inside the viewer, then use WASD + mouse. ${activeFpNavigationMode === "fly" ? "Space goes up and Q goes down." : "Space jumps."}`;
  }

  return `${base} in ${FORMAT_LABELS[asset?.format] || "SOG"} mode.`;
}

function getActiveOverlayViewer() {
  if (currentEngineType !== "splat") {
    return null;
  }

  return sogViewer;
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
  element.addEventListener("camera-change", handleModelViewerCameraChange);
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

function setSplatPreparing(isPreparing) {
  splatViewerMount.classList.toggle("is-preparing", !!isPreparing);
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

function isTextEntryTarget(element) {
  const tagName = element?.tagName;
  return element?.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT";
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

function releaseActiveViewerResources() {
  setMobileControlsPanel("");
  clearHotspotOverlay();
  sogViewer.dispose();
  stopSogPerformanceMonitor();
  replaceModelViewerElement();
  currentEngineType = "none";
  currentActiveAsset = null;
  sogPanIndicatorVisible = false;
  updateViewerLayerVisibility("none");
  setSplatPreparing(false);
  document.body.classList.remove("is-loaded");
  document.body.classList.remove("is-error");
  originalMaterials = [];
  currentAssetKey = "";
  setCalibrationPanelOpen(false);
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



function updateQualityToggle() {
  normalizeActiveQuality();
  const hdAvailable =
    isCampusOutsideSelected() &&
    activeFormat === "glb" &&
    !!getOutdoorAsset(activeTimeStage, "hd", activeFormat);

  glbQualityControl.hidden = !hdAvailable;
  if (!hdAvailable) {
    glbQualityMarkers.innerHTML = "";
    return;
  }

  glbQualityMarkers.innerHTML = ["normal", "hd"]
    .map((quality) => `
      <button
        class="location-stage-marker quality-stage-marker"
        data-glb-quality="${quality}"
        data-active="${String((quality === "hd") === hdEnabled)}"
        type="button"
      >${quality === "hd" ? "High Definition" : "Normal"}</button>
    `)
    .join("");

  for (const button of glbQualityMarkers.querySelectorAll("[data-glb-quality]")) {
    button.addEventListener("click", async () => {
      const nextHdEnabled = button.dataset.glbQuality === "hd";
      if (nextHdEnabled === hdEnabled) {
        return;
      }

      hdEnabled = nextHdEnabled;
      updateSelectionPreferences({ hdEnabled });
      trackQualityChanged(nextHdEnabled ? "hd" : "normal", getAnalyticsAssetMetadata(getActiveAssetDescriptor(), {
        control: "glb_quality",
      }));
      updateQualityToggle();
      if (hdEnabled) {
        showPerformanceNotice(
          `glb-hd:${activeTimeStage}`,
          "High Definition may take longer to load on mobile or slower connections."
        );
      }
      await applyActiveAssetSelection();
    });
  }
}

function updateMaterialToggle() {
  clayEnabled = false;
  if (!materialToggle) {
    return;
  }

  materialToggle.hidden = true;
  materialToggle.style.display = "none";
  materialToggle.disabled = true;
}

function getCurrentCalibrationConfig() {
  if (currentEngineType !== "splat") {
    return null;
  }

  return cloneManualBoxConfig(sogViewer.getManualBoxConfig?.() || currentActiveAsset?.manualBox);
}

function isSogCalibrationAvailable() {
  return calibrationUiUnlocked && currentEngineType === "splat";
}

function setCalibrationPanelOpen(open) {
  calibrationPanelOpen = !!open && isSogCalibrationAvailable();
  calibrationPanel.hidden = !calibrationPanelOpen;
  calibrationPanel.setAttribute("aria-hidden", String(!calibrationPanelOpen));
  calibrationToggle.setAttribute("aria-pressed", String(calibrationPanelOpen));
  calibrationToggle.setAttribute("aria-expanded", String(calibrationPanelOpen));

  if (sogViewer) {
    if (calibrationPanelOpen) {
      sogViewer.setCollisionPreviewVisible?.(calibrationShowCollision.checked);
      sogViewer.setEditorGuidesVisible?.(calibrationShowGrid.checked);
      sogViewer.setEditorAxesVisible?.(calibrationShowAxes.checked);
      sogViewer.setCameraStartMarkerVisible?.(!currentActiveAsset?.streamingEnabled && calibrationShowCameraMarker.checked);
      sogViewer.setManualBoxPreviewVisible?.(!currentActiveAsset?.streamingEnabled && calibrationShowBox.checked);
    } else {
      sogViewer.setCollisionPreviewVisible?.(false);
      sogViewer.setEditorGuidesVisible?.(false);
      sogViewer.setEditorAxesVisible?.(false);
      sogViewer.setCameraStartMarkerVisible?.(false);
      sogViewer.setManualBoxPreviewVisible?.(false);
      sogViewer.setSpawnMarkerVisible?.(false);
      streamedCalibTarget = "scene";
      lodCalibTarget = "box";
      closeHotspotCard();
    }
  }
  updateHotspotCalibrationUi();
}

function setCalibrationInputsDisabled(disabled) {
  const controls = [
    ...calibrationInputs.position,
    ...calibrationInputs.rotationDegrees,
    ...calibrationInputs.scale,
    calibrationReset,
    calibrationSetCurrent,
    calibrationSave,
    calibrationCopy,
    calibrationClose,
  ];

  for (const control of controls) {
    if (control) {
      control.disabled = !!disabled;
    }
  }
}

function populateCalibrationInputs(config) {
  calibrationInputSyncSuspended = true;

  for (const [groupKey, inputs] of Object.entries(calibrationInputs)) {
    const values = config?.[groupKey] || [0, 0, 0];
    inputs.forEach((input, index) => {
      input.value = Number(values[index] ?? (groupKey === "scale" ? 1 : 0)).toFixed(3);
    });
  }

  calibrationInputSyncSuspended = false;
}

function updateCalibrationUi() {
  calibrationToggle.hidden = !calibrationUiUnlocked;

  const available = isSogCalibrationAvailable();
  calibrationToggle.disabled = !available;
  calibrationToggle.setAttribute("aria-disabled", String(!available));

  if (!available) {
    calibrationSceneLabel.textContent = "No active SOG scene";
    calibrationHint.textContent = calibrationUiUnlocked
      ? "Switch to a SOG scene to edit its culling box."
      : "Calibration is locked.";
    setCalibrationPanelOpen(false);
    setCalibrationInputsDisabled(true);
    return;
  }

  const isStreamed = !!currentActiveAsset?.streamingEnabled;
  calibrationSave.style.display = "";
  calibrationLodControls.hidden = isStreamed;
  calibrationFlyCollisionControl.hidden = !isStreamed;
  calibrationCollisionPreviewControl.hidden = !currentActiveAsset?.fpCollisionSource;
  calibrationGridControl.hidden = false;
  calibrationAxesControl.hidden = false;
  calibrationTargetControl.hidden = false;
  calibrationCameraMarkerControl.hidden = isStreamed;
  calibrationCullingControl.hidden = isStreamed;
  calibrationBoxPreviewControl.hidden = isStreamed;
  calibrationSetCurrent.hidden = true;
  calibrationFlyIgnoreCollision.checked = isStreamed && sogViewer.getFlyCollisionIgnored?.() === true;
  calibrationShowCollision.checked = sogViewer.getCollisionPreviewVisible?.() === true;
  if (!isStreamed) {
    calibrationCullingEnabled.checked = sogViewer.getCutawayEnabled?.() !== false;
  }

  if (isStreamed) {
    calibrationSceneLabel.textContent = currentActiveAsset?.label || "Active streamed SOG";
    calibrationLodControls.hidden = false;

    const editingCollision = streamedCalibTarget === "collision";
    const editingSpawn = streamedCalibTarget === "spawn";
    const prefix = editingCollision ? "Collision" : editingSpawn ? "Spawn" : "Scene / SOG";
    calibrationHint.textContent = editingCollision
      ? "Editing the green collision mesh. Move, rotate and scale it to match the model."
      : editingSpawn
        ? "Orange ball = player spawn. Move = position · Rotate X/Y = look direction. Reset to test."
        : "Editing the rendered SOG scene. Move, rotate and scale the splat.";

    const labels = calibrationLodControls.querySelectorAll(".calibration-group__label");
    if (labels[0]) labels[0].textContent = `${prefix} Move`;
    if (labels[1]) labels[1].textContent = editingSpawn ? "Spawn Look (X=pitch, Y=yaw)" : `${prefix} Rotate`;
    if (labels[2]) labels[2].textContent = `${prefix} Scale`;

    // Spawn has no scale — hide the scale group when editing spawn
    const scaleGroup = labels[2]?.closest(".calibration-group");
    if (scaleGroup) scaleGroup.hidden = editingSpawn;

    // Reflect active target on the buttons
    for (const btn of calibrationTargetButtons) {
      btn.hidden = btn.dataset.calibTarget === "box" || btn.dataset.calibTarget === "camera";
      btn.dataset.active = String(btn.dataset.calibTarget === streamedCalibTarget);
    }

    // Show the relevant gizmo for the active target
    if (editingCollision) {
      sogViewer.setCollisionPreviewVisible?.(true);
      calibrationShowCollision.checked = true;
    }
    sogViewer.setSpawnMarkerVisible?.(editingSpawn);

    populateCalibrationInputs(getStreamedTargetTransform());
    setCalibrationInputsDisabled(false);
    calibrationClose.disabled = false;
    return;
  }

  const editingBox = lodCalibTarget === "box";
  const editingCamera = lodCalibTarget === "camera";
  const prefix = editingBox ? "Box" : editingCamera ? "Camera Start" : "Scene / SOG";
  const lodLabels = calibrationLodControls.querySelectorAll(".calibration-group__label");
  if (lodLabels[0]) lodLabels[0].textContent = `${prefix} Move`;
  if (lodLabels[1]) lodLabels[1].textContent = `${prefix} Rotate`;
  if (lodLabels[2]) lodLabels[2].textContent = `${prefix} Scale`;

  for (const btn of calibrationTargetButtons) {
    const target = btn.dataset.calibTarget;
    btn.hidden = target === "collision" || target === "spawn";
    btn.dataset.active = String(target === lodCalibTarget);
  }

  const config = getCurrentCalibrationConfig();
  calibrationSceneLabel.textContent = currentActiveAsset?.label || "Active SOG scene";
  calibrationHint.textContent = editingBox
    ? "Editing the culling box independently from the rendered splat."
    : editingCamera
      ? "Editing the saved initial camera. Use Set to current to capture this view."
      : "Editing the rendered SOG scene transform.";
  const lodScaleGroup = lodLabels[2]?.closest(".calibration-group");
  if (lodScaleGroup) lodScaleGroup.hidden = editingCamera;
  calibrationSetCurrent.hidden = !editingCamera;
  populateCalibrationInputs(editingBox ? config : getLodTargetTransform());
  setCalibrationInputsDisabled(false);
}

function readCalibrationInputs() {
  // In streamed mode the inputs represent the scene OR collision transform,
  // not the manual box, so use the active target transform as the base.
  const currentConfig = currentActiveAsset?.streamingEnabled
    ? getStreamedTargetTransform()
    : getLodTargetTransform();
  if (!currentConfig) {
    return null;
  }

  const parseInput = (input, fallback) => {
    const value = Number.parseFloat(input.value);
    return Number.isFinite(value) ? value : fallback;
  };

  return {
    ...currentConfig,
    position: calibrationInputs.position.map((input, index) => parseInput(input, currentConfig.position?.[index] ?? 0)),
    rotationDegrees: calibrationInputs.rotationDegrees.map((input, index) => parseInput(input, currentConfig.rotationDegrees?.[index] ?? 0)),
    scale: calibrationInputs.scale.map((input, index) => Math.max(0.001, parseInput(input, currentConfig.scale?.[index] ?? 1))),
  };
}

function getLodTargetTransform() {
  if (lodCalibTarget === "camera") {
    return sogViewer.getCameraStartTransform?.() || sogViewer.captureCurrentCameraTransform?.() || {
      position: [0, 0, 0], rotationDegrees: [0, 0, 0], scale: [1, 1, 1],
    };
  }
  if (lodCalibTarget === "scene") {
    return sogViewer.getSceneTransform?.() || {
      position: [0, 0, 0],
      rotationDegrees: [0, 0, 0],
      scale: [1, 1, 1],
    };
  }
  return getCurrentCalibrationConfig();
}

// Read the transform of whichever target is currently selected in streamed mode.
function getStreamedTargetTransform() {
  if (streamedCalibTarget === "collision") {
    return sogViewer.getCollisionPreviewTransform?.() || {
      position: [0, 0, 0], rotationDegrees: [0, 0, 0], scale: [1, 1, 1],
    };
  }
  if (streamedCalibTarget === "spawn") {
    return sogViewer.getSpawnConfig?.() || {
      position: [0, 1.6, 0], rotationDegrees: [0, 0, 0], scale: [1, 1, 1],
    };
  }
  return sogViewer.getSceneTransform?.() || {
    position: [0, 0, 0], rotationDegrees: [0, 0, 0], scale: [1, 1, 1],
  };
}

function applyCalibrationConfig(config) {
  if (!config || currentEngineType !== "splat") {
    return;
  }

  if (currentActiveAsset?.streamingEnabled) {
    if (streamedCalibTarget === "collision") {
      // Ensure the preview is visible so the user can see what they move
      sogViewer.setCollisionPreviewVisible?.(true);
      calibrationShowCollision.checked = true;
      sogViewer.setCollisionPreviewTransform?.({
        position: config.position,
        rotationDegrees: config.rotationDegrees,
        scale: config.scale,
      });
      populateCalibrationInputs(sogViewer.getCollisionPreviewTransform?.());
      setStatus("Collision updated", `${currentActiveAsset?.label || "SOG scene"} collision mesh moved.`);
      return;
    }

    if (streamedCalibTarget === "spawn") {
      sogViewer.setSpawnMarkerVisible?.(true);
      sogViewer.setSpawnConfig?.({
        position: config.position,
        rotationDegrees: config.rotationDegrees,
      });
      populateCalibrationInputs(sogViewer.getSpawnConfig?.());
      setStatus("Spawn updated", "Move = spawn position · Rotate X/Y = look direction. Press Reset to test.");
      return;
    }

    sogViewer.setSceneTransform(config);
    populateCalibrationInputs(sogViewer.getSceneTransform?.());
    setStatus("Streamed scene updated", `${currentActiveAsset?.label || "SOG scene"} live transform updated.`);
    return;
  }

  if (lodCalibTarget === "scene") {
    sogViewer.setSceneTransform(config);
    populateCalibrationInputs(sogViewer.getSceneTransform?.());
    setStatus("Scene updated", `${currentActiveAsset?.label || "SOG scene"} transform updated.`);
    return;
  }

  if (lodCalibTarget === "camera") {
    sogViewer.setCameraStartTransform?.(config);
    populateCalibrationInputs(sogViewer.getCameraStartTransform?.());
    setStatus("Camera start updated", "Saved camera marker transform updated.");
    return;
  }

  const nextConfig = cloneManualBoxConfig(config);
  sogViewer.setManualBoxConfig(nextConfig);
  currentActiveAsset = {
    ...currentActiveAsset,
    manualBox: cloneManualBoxConfig(nextConfig),
  };

  if (currentActiveAsset?.sceneCalibrationKey) {
    setCalibrationOverride(currentActiveAsset.sceneCalibrationKey, nextConfig);
  }

  populateCalibrationInputs(nextConfig);
  setStatus("Calibration updated", `${currentActiveAsset?.label || "SOG scene"} culling box updated.`);
  setStatusOverlayState(false);
  requestAnimationFrame(() => {
    setStatusOverlayState(true);
  });
}

async function copyCalibrationConfig() {
  const boxConfig = getCurrentCalibrationConfig();
  const sceneTransform = sogViewer.getSceneTransform?.();
  if (!boxConfig && !sceneTransform) {
    return;
  }

  const payload = JSON.stringify({
    scene: sceneTransform,
    manualBox: boxConfig,
    cameraStart: sogViewer.getCameraStartTransform?.(),
  }, null, 2);

  try {
    await navigator.clipboard.writeText(payload);
    setStatus("Calibration copied", "The current manualBox JSON was copied to the clipboard.");
  } catch (_error) {
    setStatus("Copy unavailable", "Clipboard access is blocked in this browser context.");
  }

  setStatusOverlayState(false);
  requestAnimationFrame(() => {
    setStatusOverlayState(true);
  });
}

function saveCurrentLodTransforms() {
  const key = currentActiveAsset?.sceneCalibrationKey;
  if (!key || currentActiveAsset?.streamingEnabled) return;

  const sceneTransform = sogViewer.getSceneTransform?.();
  const boxConfig = getCurrentCalibrationConfig();
  const cameraStart = sogViewer.getCameraStartTransform?.();
  if (sceneTransform) {
    streamedTransformsOverrides[key] = {
      ...(streamedTransformsOverrides[key] || {}),
      scene: cloneTransformConfig(sceneTransform),
      ...(cameraStart ? { cameraStart: cloneTransformConfig(cameraStart) } : {}),
    };
    saveStreamedTransformsOverrides();
  }
  if (boxConfig) {
    setCalibrationOverride(key, boxConfig);
  }

  setStatus("Calibration Saved", `Saved scene and box transforms for ${currentActiveAsset.label || "SOG scene"}.`);
  setStatusOverlayState(false);
  requestAnimationFrame(() => setStatusOverlayState(true));
}

function saveCurrentStreamedTransforms() {
  if (!currentActiveAsset?.sceneCalibrationKey || !currentActiveAsset?.streamingEnabled) return;
  
  const sceneTransform = sogViewer.getSceneTransform?.();
  const collisionTransform = sogViewer.getCollisionPreviewTransform?.();
  
  if (!streamedTransformsOverrides[currentActiveAsset.sceneCalibrationKey]) {
    streamedTransformsOverrides[currentActiveAsset.sceneCalibrationKey] = {};
  }
  
  if (sceneTransform) {
    streamedTransformsOverrides[currentActiveAsset.sceneCalibrationKey].scene = {
      position: sceneTransform.position,
      rotationDegrees: sceneTransform.rotationDegrees,
      scale: sceneTransform.scale
    };
  }

  if (collisionTransform) {
    streamedTransformsOverrides[currentActiveAsset.sceneCalibrationKey].collision = {
      position: collisionTransform.position,
      rotationDegrees: collisionTransform.rotationDegrees,
      scale: collisionTransform.scale
    };
  }

  const spawnConfig = sogViewer.getSpawnConfig?.();
  if (spawnConfig) {
    streamedTransformsOverrides[currentActiveAsset.sceneCalibrationKey].spawn = {
      position: spawnConfig.position,
      rotationDegrees: spawnConfig.rotationDegrees,
    };
  }

  saveStreamedTransformsOverrides();
  setStatus("Calibration Saved", `Saved transforms for ${currentActiveAsset.label || "SOG scene"} to local storage.`);
  
  setStatusOverlayState(false);
  requestAnimationFrame(() => {
    setStatusOverlayState(true);
  });
}

function resetCalibrationConfig() {
  if (!currentActiveAsset?.sceneCalibrationKey) {
    return;
  }

  if (currentActiveAsset.streamingEnabled) {
    if (streamedTransformsOverrides[currentActiveAsset.sceneCalibrationKey]) {
      delete streamedTransformsOverrides[currentActiveAsset.sceneCalibrationKey];
      saveStreamedTransformsOverrides();
    }
    reloadSogAsset(currentActiveAsset, { silent: true });
    setStatus("Calibration Reset", `Reset transforms for ${currentActiveAsset.label || "SOG scene"} to defaults.`);
    return;
  }

  if (lodCalibTarget === "scene") {
    const fallbackScene = calibrationSessionSceneDefaults.get(currentActiveAsset.sceneCalibrationKey);
    if (!fallbackScene) return;
    if (streamedTransformsOverrides[currentActiveAsset.sceneCalibrationKey]) {
      delete streamedTransformsOverrides[currentActiveAsset.sceneCalibrationKey].scene;
      if (Object.keys(streamedTransformsOverrides[currentActiveAsset.sceneCalibrationKey]).length === 0) {
        delete streamedTransformsOverrides[currentActiveAsset.sceneCalibrationKey];
      }
      saveStreamedTransformsOverrides();
    }
    sogViewer.setSceneTransform(cloneTransformConfig(fallbackScene));
    populateCalibrationInputs(sogViewer.getSceneTransform?.());
    setStatus("Scene reset", `${currentActiveAsset?.label || "SOG scene"} transform restored.`);
    return;
  }

  if (lodCalibTarget === "camera") {
    const fallbackCamera = calibrationSessionCameraDefaults.get(currentActiveAsset.sceneCalibrationKey);
    if (!fallbackCamera) return;
    sogViewer.setCameraStartTransform?.(cloneTransformConfig(fallbackCamera));
    populateCalibrationInputs(sogViewer.getCameraStartTransform?.());
    setStatus("Camera reset", "Camera start restored to its session default.");
    return;
  }

  const fallbackConfig =
    cloneManualBoxConfig(calibrationSessionDefaults.get(currentActiveAsset.sceneCalibrationKey)) ||
    cloneManualBoxConfig(currentActiveAsset.sourceManualBox);

  if (!fallbackConfig) {
    return;
  }

  clearCalibrationOverride(currentActiveAsset.sceneCalibrationKey);
  sogViewer.setManualBoxConfig(fallbackConfig);
  currentActiveAsset = {
    ...currentActiveAsset,
    manualBox: cloneManualBoxConfig(fallbackConfig),
  };
  populateCalibrationInputs(fallbackConfig);
  setStatus("Calibration reset", `${currentActiveAsset?.label || "SOG scene"} culling box restored.`);
  setStatusOverlayState(false);
  requestAnimationFrame(() => {
    setStatusOverlayState(true);
  });
}

function renderSogModeMarkers() {
  const asset = currentActiveAsset?.type === "splat" ? currentActiveAsset : getActiveAssetDescriptor();
  const isSogActive =
    currentEngineType === "splat" &&
    asset?.type === "splat" &&
    asset?.runtime === "playcanvas" &&
    asset?.fileFormat === "sog";
  const shouldShowModeControl =
    isSogActive && !!asset?.streamingSource;

  sogModeControl.hidden = !shouldShowModeControl;

  if (!shouldShowModeControl) {
    sogModeMarkers.innerHTML = "";
    updateMobileControlsUi();
    return;
  }

  const markersHtml = ["classic", "streamed"]
    .map((mode) => `
      <button
        class="location-stage-marker"
        data-sog-mode="${mode}"
        data-active="${String(mode === activeSogMode)}"
        type="button"
      >${SOG_MODE_LABELS[mode]}</button>
    `)
    .join("");

  const noteHtml = isMobileDevice
    ? `<p class="sog-mode-note">Note: Streamed mode is best on a Wi-Fi connection.</p>`
    : "";

  sogModeMarkers.innerHTML = markersHtml + noteHtml;

  for (const button of sogModeMarkers.querySelectorAll(".location-stage-marker")) {
    button.addEventListener("click", () => {
      const mode = button.dataset.sogMode;
      if (!mode || mode === activeSogMode) {
        return;
      }

      if (mode === "streamed" && !asset?.streamingSource) {
        setStatus("Streamed mode unavailable", "This scene does not have streamed LOD data yet.");
        setStatusOverlayState(false);
        requestAnimationFrame(() => {
          setStatusOverlayState(true);
        });
        return;
      }

      setActiveSogMode(mode);
    });
  }
  updateMobileControlsUi();
}

function renderFpNavMarkers() {
  const asset = currentActiveAsset?.type === "splat" ? currentActiveAsset : getActiveAssetDescriptor();
  normalizeActiveFpNavigationMode(asset);
  const { modes } = getFpNavigationModesForAsset(asset);

  const shouldShowFpNavControl =
    currentEngineType === "splat" &&
    asset?.type === "splat" &&
    asset?.runtime === "playcanvas" &&
    asset?.fileFormat === "sog" &&
    asset?.streamingEnabled &&
    modes.length > 0;

  fpNavControl.hidden = !shouldShowFpNavControl;

  if (!shouldShowFpNavControl) {
    fpNavMarkers.innerHTML = "";
    return;
  }

  fpNavMarkers.innerHTML = modes
    .map((mode) => `
      <button
        class="location-stage-marker"
        data-fp-navigation-mode="${mode}"
        data-active="${String(mode === activeFpNavigationMode)}"
        type="button"
      >${mode === "walk" ? "Walk" : "Fly"}</button>
    `)
    .join("");

  for (const button of fpNavMarkers.querySelectorAll(".location-stage-marker")) {
    button.addEventListener("click", () => {
      const mode = button.dataset.fpNavigationMode;
      if (!mode || mode === activeFpNavigationMode) {
        return;
      }

      setActiveFpNavigationMode(mode);
    });
  }
}

function renderLodMarkers() {
  const isSogActive = currentEngineType === "splat" && currentActiveAsset?.runtime === "playcanvas";
  const shouldShowLodControl =
    isSogActive &&
    activeSogMode === "classic" &&
    !currentActiveAsset?.streamingEnabled &&
    currentActiveAsset?.performanceSources &&
    Object.keys(currentActiveAsset.performanceSources).length > 0;
  
  lodControl.hidden = !shouldShowLodControl;

  if (!shouldShowLodControl) {
    lodMarkers.innerHTML = "";
    return;
  }

  const availableTiers = ["auto"];
  if (currentActiveAsset?.performanceSources?.lod0) availableTiers.push("lod0");
  if (currentActiveAsset?.performanceSources?.lod1) availableTiers.push("lod1");
  if (currentActiveAsset?.performanceSources?.lod2) availableTiers.push("lod2");
  if (currentActiveAsset?.performanceSources?.lod3) availableTiers.push("lod3");
  if (currentActiveAsset?.performanceSources?.lod4) availableTiers.push("lod4");

  if (availableTiers.length > 1 && !availableTiers.includes("lod0")) {
      availableTiers.push("lod0");
  }

  const tierLabels = {
    auto: "Auto",
    lod0: "Max",
    lod1: "High",
    lod2: "Balanced",
    lod3: "Light",
    lod4: "Fast",
  };

  lodMarkers.innerHTML = availableTiers
    .map((tier) => {
      const isActive = (tier === "auto")
        ? (selectionPreferences.lodTier === "auto")
        : (selectionPreferences.lodTier !== "auto" && tier === currentActiveAsset?.performanceTier);
      return `
        <button
          class="location-stage-marker detail-stage-marker"
          data-lod-tier="${tier}"
          data-active="${String(isActive)}"
          aria-label="${tier === "auto" ? "Auto quality" : tier.toUpperCase() + " detail"}"
          type="button"
        ><span>${tierLabels[tier]}</span><small>${tier === "auto" ? "AUTO" : tier.toUpperCase()}</small></button>
      `;
    })
    .join("");

  for (const button of lodMarkers.querySelectorAll(".location-stage-marker")) {
    button.addEventListener("click", () => {
      const tier = button.dataset.lodTier;
      if (!tier) {
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
  updateQualityToggle();
  renderSogModeMarkers();
  renderFpNavMarkers();
  updateLodToggle();
  updateMobileControlsUi();
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
  const timeControlsDisabled = !isTimeSelectionVisible() || !hasMultipleAvailableTimeStages();
  timeDial.disabled = timeControlsDisabled;
  timeDial.setAttribute("aria-disabled", String(timeControlsDisabled));
  for (const marker of timeStageMarkers) {
    const stageEnabled = isTimeSelectionVisible() && isTimeStageAvailable(marker.dataset.stage);
    marker.disabled = !stageEnabled;
    marker.setAttribute("aria-disabled", String(!stageEnabled));
  }
  for (const marker of navigationGroups.querySelectorAll(".nav-marker")) {
    marker.disabled = marker.getAttribute("aria-disabled") === "true";
  }
  calibrationToggle.disabled = isBusy || !isSogCalibrationAvailable();
  setCalibrationInputsDisabled(isBusy || !isSogCalibrationAvailable());

  if (isBusy) {
    if (materialToggle) {
      materialToggle.disabled = true;
    }
  } else {
    updateQualityToggle();
    updateMaterialToggle();
    renderSogModeMarkers();
    renderFpNavMarkers();
    updateLodToggle();
    updateCalibrationUi();
  }
  updateMobileControlsUi();
}

function updateTurntableUi() {
  const shouldShowTurntable =
    isViewerMode &&
    !(currentEngineType === "splat" && currentActiveAsset?.streamingEnabled);
  turntableToggle.hidden = !shouldShowTurntable;
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

function shouldEnableTurntableByDefault(asset) {
  return (
    !cinematicAuthorEnabled &&
    activeEnvironmentId === "outside" &&
    !asset?.streamingEnabled
  );
}

function disableTurntableFromUserInteraction() {
  if (!turntableEnabled) {
    return false;
  }

  turntableEnabled = false;
  updateTurntableUi();
  applyTurntableState();
  return true;
}

function handleModelViewerCameraChange(event) {
  if (event.detail?.source === "user-interaction") {
    disableTurntableFromUserInteraction();
  }
}

function toggleTurntable() {
  turntableEnabled = !turntableEnabled;
  updateTurntableUi();
  applyTurntableState();
  return turntableEnabled;
}

function waitForModelViewerLoad(element, asset, swapId) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      element.removeEventListener("load", handleLoad);
      element.removeEventListener("error", handleError);
      clearTimeout(timeoutId);
    };
    const settle = (callback, value) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback(value);
    };
    const handleLoad = () => {
      settle(resolve);
    };
    const handleError = (event) => {
      const error = new Error(event.detail?.type || "The GLB model did not render correctly.");
      error.details = {
        source: asset?.src || null,
        event_type: event.detail?.type || null,
      };
      settle(reject, error);
    };
    const timeoutId = setTimeout(() => {
      if (swapId !== activeAssetSwapId) {
        settle(resolve);
        return;
      }
      const error = new Error("Timed out while loading GLB model.");
      error.details = {
        source: asset?.src || null,
        timeout_ms: GLB_LOAD_TIMEOUT_MS,
      };
      settle(reject, error);
    }, GLB_LOAD_TIMEOUT_MS);

    element.addEventListener("load", handleLoad);
    element.addEventListener("error", handleError);
  });
}

async function activateGlbAsset(asset, swapId) {
  const resolvedSource = asset.src;
  if (swapId !== activeAssetSwapId) {
    return;
  }

  logger.info("glb-loader", "Starting GLB scene load", {
    scene_id: getAnalyticsSceneId(asset),
    source: resolvedSource,
  });
  turntableEnabled = shouldEnableTurntableByDefault(asset);
  updateTurntableUi();

  sogViewer.dispose();
  currentEngineType = "glb";
  currentActiveAsset = asset;
  currentAssetKey = asset.key;
  updateTurntableUi();
  updateViewerLayerVisibility("glb");
  modelViewer.autoRotate = turntableEnabled;
  applyGlbView(asset);
  const loadPromise = waitForModelViewerLoad(modelViewer, asset, swapId);
  modelViewer.src = resolvedSource;
  await modelViewer.updateComplete;
  await loadPromise;
}

async function activateSplatAsset(asset, swapId, options = {}) {
  const resolvedSource = resolveHostedSogUrl(asset.src);
  const targetSplatProfile = {
    maxDpr: asset.streamingEnabled
      ? Math.min(asset.streamingSettings?.maxDpr || autoPerformanceProfile.maxDpr, window.devicePixelRatio || 1)
      : splatProfile.maxDpr,
  };
  if (swapId !== activeAssetSwapId) {
    return;
  }

  turntableEnabled = shouldEnableTurntableByDefault(asset);
  updateTurntableUi();

  if (currentEngineType !== "splat" || currentAssetKey !== asset.key) {
    sogViewer.dispose();
  }

  if (currentAssetKey && currentAssetKey !== asset.key) {
    resetSogAdaptiveTierState(asset.key);
  }

  currentEngineType = "splat";
  currentActiveAsset = asset;
  currentAssetKey = asset.key;
  updateTurntableUi();
  updateViewerLayerVisibility("splat");
  setSplatPreparing(!!asset.streamingEnabled);
  if (!options.silent) {
    setProgress(0.22);
  }

  logger.info("sog-loader", "Starting SOG scene load", {
    scene_id: getAnalyticsSceneId(asset),
    source: resolvedSource,
    streamed: !!asset.streamingEnabled,
  });

  await sogViewer.load(
    applySavedCinematicStartView({
      ...asset,
      src: resolvedSource,
      autoRotate: turntableEnabled,
      // Streamed outdoor scenes without a calibrated spawn use this pose as
      // their safe initial FP entry point.
      transitionOrbitState: pendingSogModeTransitionOrbitState,
    }),
    targetSplatProfile,
    options.silent
      ? undefined
      : (nextState) => {
          if (swapId !== activeAssetSwapId) {
            return;
          }

          if (nextState.total > 0 && Number.isFinite(nextState.received)) {
            setProgress(nextState.received / nextState.total, nextState);
          } else if (Number.isFinite(nextState.progress)) {
            setProgress(nextState.progress);
          } else if (nextState.status === "loading") {
            setProgress(0.56);
          }

          if (nextState.status === "warning") {
            showPerformanceNotice(
              `${asset.key}:${nextState.code || nextState.title}`,
              nextState.message || "The streamed model is still preparing. Please wait..."
            );
            logger.warn("sog-loader", nextState.message || "Recoverable SOG loading warning", {
              scene_id: getAnalyticsSceneId(asset),
              ...nextState.details,
            });
            return;
          }

          setStatus(nextState.title, nextState.message, {
            details: logger.isDebugEnabled() ? nextState.details : null,
          });
        }
  );

  if (swapId !== activeAssetSwapId) {
    return;
  }

  const liveManualBox = cloneManualBoxConfig(sogViewer.getManualBoxConfig?.());
  currentActiveAsset = {
    ...asset,
    manualBox: liveManualBox || cloneManualBoxConfig(asset.manualBox),
  };

  if (currentActiveAsset.sceneCalibrationKey && !calibrationSessionDefaults.has(currentActiveAsset.sceneCalibrationKey)) {
    calibrationSessionDefaults.set(
      currentActiveAsset.sceneCalibrationKey,
      cloneManualBoxConfig(currentActiveAsset.sourceManualBox || currentActiveAsset.manualBox)
    );
  }
  if (currentActiveAsset.sceneCalibrationKey && !calibrationSessionSceneDefaults.has(currentActiveAsset.sceneCalibrationKey)) {
    calibrationSessionSceneDefaults.set(
      currentActiveAsset.sceneCalibrationKey,
      cloneTransformConfig(sogViewer.getSceneTransform?.())
    );
  }
  if (currentActiveAsset.sceneCalibrationKey && !calibrationSessionCameraDefaults.has(currentActiveAsset.sceneCalibrationKey)) {
    calibrationSessionCameraDefaults.set(
      currentActiveAsset.sceneCalibrationKey,
      cloneTransformConfig(sogViewer.getCameraStartTransform?.() || sogViewer.captureCurrentCameraTransform?.())
    );
  }

  if (Number.isFinite(options.targetDpr)) {
    sogViewer.setMaxDpr(options.targetDpr);
  }

  if (asset.streamingEnabled) {
    sogViewer.setFirstPersonNavigationMode(activeFpNavigationMode);
  }

  pendingSogModeTransitionOrbitState = null;

  setSplatPreparing(false);

  if (!options.silent) {
    document.body.classList.add("is-loaded");
    document.body.classList.remove("is-error");
    setProgress(1);
    setStatus("3D hero active", describeLoadedAssetStatus(asset));
    requestAnimationFrame(() => {
      if (swapId === activeAssetSwapId) {
        setStatusOverlayState(true);
      }
    });
  }

  renderSogModeMarkers();
  renderFpNavMarkers();
  updateLodToggle();
  updateCalibrationUi();
  renderActiveHotspots();
  trackSceneLoaded(getAnalyticsSceneId(asset), getAnalyticsAssetMetadata(asset, {
    load_engine: "playcanvas_sog",
    silent: !!options.silent,
  }));

  startSogPerformanceMonitor(
    asset,
    Number.isFinite(options.targetDpr) ? options.targetDpr : null
  );
}

async function applyActiveAssetSelection({ forceReload = false } = {}) {
  const nextAsset = getActiveAssetDescriptor();
  if (!nextAsset) {
    ++activeAssetSwapId;
    setLoadingState(false);
    releaseActiveViewerResources();
    document.body.classList.remove("is-error");
    setProgress(0);
    setStatusOverlayState(false);
    setStatus("Select scene", `Choose an available item in ${getCurrentContextLabel()} to load it.`);
    updateMaterialToggle();
    updateQualityToggle();
    renderFpNavMarkers();
    updateLodToggle();
    updateCalibrationUi();
    clearHotspotOverlay();
    return;
  }

  const swapId = ++activeAssetSwapId;

  if (!forceReload && nextAsset.key === currentAssetKey && nextAsset.type === currentEngineType) {
    setStatusOverlayState(false);
    setStatus("Scene ready", `${describeActiveAsset(nextAsset)} is already active.`);
    updateMaterialToggle();
    updateQualityToggle();
    renderFpNavMarkers();
    updateLodToggle();
    updateCalibrationUi();
    renderActiveHotspots();
    return;
  }

  setControlsBusy(true);
  setLoadingState(true);
  setStatusOverlayState(false);
  setProgress(0.08);
  setStatus("Switching scene", `Loading ${describeActiveAsset(nextAsset)}...`, {
    loading: true,
  });
  trackPageView(getAnalyticsAssetMetadata(nextAsset, { source: "scene_selection" }));
  trackSceneOpen(getAnalyticsSceneId(nextAsset), getAnalyticsAssetMetadata(nextAsset));
  releaseActiveViewerResources();

  try {
    if (nextAsset.type === "splat") {
      await activateSplatAsset(nextAsset, swapId);
      if (swapId !== activeAssetSwapId) {
        return;
      }

      document.body.classList.add("is-loaded");
      document.body.classList.remove("is-error");
      setLoadingState(false);
      setProgress(1);
      setStatus("3D hero active", describeLoadedAssetStatus(nextAsset));
      requestAnimationFrame(() => {
        if (swapId === activeAssetSwapId) {
          setStatusOverlayState(true);
        }
      });
    } else {
      await activateGlbAsset(nextAsset, swapId);
      setLoadingState(false);
      updateCalibrationUi();
    }
  } catch (error) {
    if (swapId !== activeAssetSwapId) {
      return;
    }

    setSplatPreparing(false);
    setLoadingState(false);
    logger.error("scene-loader", "Scene load failed", buildErrorDetails(error, nextAsset), error);
    trackSceneLoadFailed(getAnalyticsSceneId(nextAsset), error, getAnalyticsAssetMetadata(nextAsset));
    document.body.classList.add("is-error");
    setStatusOverlayState(false);
    setStatus("Asset issue", getFriendlyLoadError(error, nextAsset), {
      severity: "fatal",
      details: buildErrorDetails(error, nextAsset),
    });
  } finally {
    if (swapId === activeAssetSwapId) {
      setControlsBusy(false);
      updateMaterialToggle();
      updateQualityToggle();
      renderSogModeMarkers();
      renderFpNavMarkers();
      updateLodToggle();
      updateCalibrationUi();
    }
  }
}

function cancelActiveLoad() {
  if (!isSceneLoading) {
    return;
  }

  ++activeAssetSwapId;
  setLoadingState(false);
  setControlsBusy(false);
  releaseActiveViewerResources();
  document.body.classList.remove("is-error");
  setProgress(0);
  setStatusOverlayState(false);
  setStatus("Load cancelled", "Choose another format, LOD, or space to continue.");
  updateLocationUi();
  updateQualityToggle();
  updateMaterialToggle();
  renderSogModeMarkers();
  renderFpNavMarkers();
  updateLodToggle();
  updateCalibrationUi();
  updateMobileControlsUi();
}

async function prepareCinematicPath(path) {
  const scene = path?.scene;
  if (!scene) return false;

  if (scene.kind === "outdoor") {
    activeSiteId = "campus";
    activeEnvironmentId = "outside";
    activeTimeStage = scene.stage || "day";
    activeSceneId = null;
  } else if (scene.kind === "indoor") {
    const building = CAMPUS_INDOOR_BUILDINGS.find((entry) =>
      entry.spaces.some((space) => space.sceneId === scene.sceneId)
    );
    if (!building || !getCampusIndoorSceneById(scene.sceneId)) return false;
    activeSiteId = "campus";
    activeEnvironmentId = "inside";
    activeBuildingId = building.id;
    activeSceneId = scene.sceneId;
  } else {
    return false;
  }

  syncNavigationState();
  const formats = getAvailableFormats();
  if (!formats.includes("sog")) return false;
  activeFormat = "sog";
  if (!isViewerMode) enterViewerMode();
  updateLocationUi();
  updateQualityToggle();
  updateMaterialToggle();
  updateTimeUi();
  await applyActiveAssetSelection();
  return currentEngineType === "splat" && currentActiveAsset?.runtime === "playcanvas";
}

function getCinematicSceneInfo() {
  if (currentEngineType !== "splat" || currentActiveAsset?.runtime !== "playcanvas") {
    return null;
  }

  const sceneId = currentActiveAsset.sceneId ||
    (currentActiveAsset.locationId === "outdoors" ? `campus-${activeTimeStage}` : currentActiveAsset.key);
  return {
    sceneId,
    name: currentActiveAsset.label || sceneId,
    orbitStartViewEnabled: !currentActiveAsset.streamingEnabled,
  };
}

async function setActiveTimeStage(stage, direction = 0) {
  if (!timeStages.includes(stage) || !isTimeStageAvailable(stage)) {
    return;
  }

  activeTimeStage = stage;
  updateSelectionPreferences({ timeStage: stage });
  preferDefaultFormatForCurrentContext();
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
  preferDefaultFormatForCurrentContext();
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
  preferDefaultFormatForCurrentContext();
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
  preferDefaultFormatForCurrentContext();
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
  preferDefaultFormatForCurrentContext();
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
  if (format === "sog") {
    activeSogMode = "classic";
  }
  updateSelectionPreferences({
    format,
    ...(format === "sog" ? {
      sogMode: "classic",
      lodTier: autoPerformanceProfile.tier,
    } : {}),
  });
  updateLocationUi();
  updateQualityToggle();
  updateMaterialToggle();
  await applyActiveAssetSelection();
}

async function setActiveSogMode(mode) {
  if (!["classic", "streamed"].includes(mode) || mode === activeSogMode) {
    return;
  }

  pendingSogModeTransitionOrbitState =
    currentEngineType === "splat" && currentActiveAsset?.runtime === "playcanvas"
      ? sogViewer.getOrbitState?.()
      : null;
  if (mode === "streamed") {
    const asset = currentActiveAsset?.type === "splat" ? currentActiveAsset : getActiveAssetDescriptor();
    const sceneId = asset?.sceneId || (asset?.locationId === "outdoors" ? `campus-${activeTimeStage}` : null);
    const exp = sceneId ? resolveSceneExperience(sceneId) : null;
    if (exp?.defaults?.firstPersonMode === "fly" || (!exp?.navigation?.walk && exp?.navigation?.fly)) {
      activeFpNavigationMode = "fly";
    }
  }
  activeSogMode = mode;
  updateSelectionPreferences({ sogMode: mode });
  trackQualityChanged(mode, getAnalyticsAssetMetadata(getActiveAssetDescriptor(), {
    control: "sog_mode",
  }));
  updateLocationUi();
  updateQualityToggle();
  updateMaterialToggle();
  await applyActiveAssetSelection();
}

function setActiveFpNavigationMode(mode) {
  if (!["walk", "fly"].includes(mode) || mode === activeFpNavigationMode) {
    return;
  }

  activeFpNavigationMode = mode;
  updateSelectionPreferences({ fpNavigationMode: mode });
  trackQualityChanged(mode, getAnalyticsAssetMetadata(currentActiveAsset, {
    control: "fp_navigation_mode",
  }));
  if (currentEngineType === "splat" && currentActiveAsset?.runtime === "playcanvas" && currentActiveAsset?.streamingEnabled) {
    sogViewer.setFirstPersonNavigationMode(mode);
    setStatus(
      "FP navigation updated",
      mode === "walk"
        ? "Walk mode active. Click inside the viewer, then use WASD + mouse. Space jumps."
        : "Fly mode active. Click inside the viewer, then use WASD + mouse. Space goes up, Q goes down."
    );
  }

  renderFpNavMarkers();
}

async function setActiveLodTier(tier) {
  if (!currentActiveAsset || currentActiveAsset.type !== "splat" || currentActiveAsset.runtime !== "playcanvas") {
    return;
  }

  if (tier === selectionPreferences.lodTier) {
    return;
  }

  const targetTier = tier === "auto" ? autoPerformanceProfile.tier : tier;
  updateSelectionPreferences({ lodTier: tier });

  if (tier === "auto") {
    startSogPerformanceMonitor(currentActiveAsset);
    if (currentActiveAsset.performanceTier === targetTier) {
      updateLodToggle();
      return;
    }
  }

  const nextAsset = getSogAssetForPerformanceTier(currentActiveAsset, targetTier);
  if (!nextAsset) {
    updateLodToggle();
    return;
  }

  if (tier === "lod0") {
    showPerformanceNotice(
      `sog-max:${currentActiveAsset.sceneId || currentActiveAsset.key}`,
      "Maximum detail is best on desktop or a strong Wi-Fi connection."
    );
  }

  trackLodSelected(getAnalyticsSceneId(nextAsset), tier, getAnalyticsAssetMetadata(nextAsset, {
    reason: "manual",
    previous_tier: currentActiveAsset.performanceTier,
  }));

  if (tier !== "auto") {
    stopSogPerformanceMonitor();
  }

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

  setLoadingState(false);
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

  trackSceneLoaded(getAnalyticsSceneId(currentActiveAsset), getAnalyticsAssetMetadata(currentActiveAsset, {
    load_engine: "model_viewer_glb",
  }));

  requestAnimationFrame(() => {
    setStatusOverlayState(true);
  });
}

function handleModelViewerError(event) {
  if (event.currentTarget !== modelViewer || currentEngineType !== "glb") {
    return;
  }

  setLoadingState(false);
  document.body.classList.add("is-error");
  setStatusOverlayState(false);
  const error = new Error(event.detail?.type || "The model did not render correctly.");
  logger.error("glb-loader", "GLB viewer reported a load error", buildErrorDetails(error, currentActiveAsset, {
    event_type: event.detail?.type || null,
  }), error);
  setStatus("Asset issue", getFriendlyLoadError(error, currentActiveAsset), {
    severity: "fatal",
    details: buildErrorDetails(error, currentActiveAsset, {
      event_type: event.detail?.type || null,
    }),
  });
  trackSceneLoadFailed(
    getAnalyticsSceneId(currentActiveAsset),
    error,
    getAnalyticsAssetMetadata(currentActiveAsset, { load_engine: "model_viewer_glb" })
  );
  setControlsBusy(false);
}

function installGlobalSafetyHandlers() {
  window.addEventListener("error", (event) => {
    const error = event.error || new Error(event.message || "Unhandled browser error");
    logger.error("app", "Unhandled browser error", {
      source: event.filename || "",
      line: event.lineno || null,
      column: event.colno || null,
    }, error);
    if (isViewerMode && isSceneLoading) {
      setLoadingState(false);
      document.body.classList.add("is-error");
      setStatusOverlayState(false);
      setStatus("Asset issue", getFriendlyLoadError(error), {
        severity: "fatal",
        details: buildErrorDetails(error, currentActiveAsset, { source: "window_error" }),
      });
      setControlsBusy(false);
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason || "Unhandled promise rejection"));
    logger.error("app", "Unhandled promise rejection", {
      source: "unhandledrejection",
    }, error);
    if (isViewerMode && isSceneLoading) {
      setLoadingState(false);
      document.body.classList.add("is-error");
      setStatusOverlayState(false);
      setStatus("Asset issue", getFriendlyLoadError(error), {
        severity: "fatal",
        details: buildErrorDetails(error, currentActiveAsset, { source: "unhandledrejection" }),
      });
      setControlsBusy(false);
    }
  });

  const bindContextLoss = () => {
    const canvas = sogViewer?.canvas || modelViewer?.shadowRoot?.querySelector?.("canvas");
    if (!canvas || canvas.dataset.huaDiagnosticsContextListener === "1") {
      return;
    }

    canvas.dataset.huaDiagnosticsContextListener = "1";
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault?.();
      const error = new Error("WebGL context lost");
      logger.error("webgl", "WebGL context was lost", buildErrorDetails(error), error);
      trackViewerError(error, getAnalyticsAssetMetadata(currentActiveAsset, {
        source: "webglcontextlost",
        fatal: true,
      }));
      if (isViewerMode) {
        setLoadingState(false);
        document.body.classList.add("is-error");
        setStatusOverlayState(false);
        setStatus("Asset issue", "WebGL is not available or was interrupted.", {
          severity: "fatal",
          details: buildErrorDetails(error),
        });
      }
    });
    canvas.addEventListener("webglcontextrestored", () => {
      logger.info("webgl", "WebGL context was restored");
      showPerformanceNotice("webgl-restored", "Graphics context was restored. Retry the space if it does not resume.");
    });
  };

  bindContextLoss();
  setInterval(bindContextLoss, 5000);
}

resetCamera.addEventListener("click", () => {
  resetActiveViewer();
});

window.addEventListener("keydown", (event) => {
  if (
    !cinematicAuthorEnabled ||
    event.defaultPrevented ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.key.toLowerCase() !== "r" ||
    isTextEntryTarget(event.target)
  ) {
    return;
  }

  event.preventDefault();
  resetActiveViewer();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeMobileControlsPanel) {
    setMobileControlsPanel("");
  }
});

window.addEventListener("resize", () => {
  if (window.innerWidth > 760 && activeMobileControlsPanel) {
    setMobileControlsPanel("");
  }
  updateMobileControlsUi();
});

viewerBackButton.addEventListener("click", exitViewerMode);
statusBack.addEventListener("click", exitViewerMode);
statusCancel.addEventListener("click", cancelActiveLoad);

for (const button of mobileDockButtons) {
  button.addEventListener("click", () => {
    const panel = button.dataset.mobilePanel;
    setMobileControlsPanel(activeMobileControlsPanel === panel ? "" : panel);
  });
}

mobileControlsScrim?.addEventListener("click", () => {
  setMobileControlsPanel("");
});

for (const control of [
  timeControlGroup,
  formatControl,
  glbQualityControl,
  sogModeControl,
  fpNavControl,
  lodControl,
  navigationControl,
]) {
  control?.addEventListener("click", (event) => {
    const button = event.target?.closest?.("button");
    if (!button || button.disabled || button.id === "timeDial") {
      return;
    }

    window.setTimeout(() => {
      setMobileControlsPanel("");
    }, 0);
  });
}

statusRetry.addEventListener("click", async () => {
  if (!isViewerMode || statusRetry.disabled) return;
  statusRetry.disabled = true;
  logger.info("ui", "Retrying active scene load from status overlay", {
    scene_id: getAnalyticsSceneId(getActiveAssetDescriptor()),
  });
  await applyActiveAssetSelection({ forceReload: true });
});

fullscreenToggle.addEventListener("click", async () => {
  const hero = document.querySelector(".hero");
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await hero.requestFullscreen();
  } catch (error) {
    logger.warn("ui", "Fullscreen request failed", { source: "fullscreenToggle" }, error);
    showPerformanceNotice("fullscreen-failed", "Fullscreen was blocked by the browser.");
    trackViewerError(error, getAnalyticsAssetMetadata(currentActiveAsset, {
      source: "fullscreen",
      recoverable: true,
    }));
  }
});

turntableToggle.addEventListener("click", () => {
  toggleTurntable();
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

document.addEventListener("keydown", handleHotspotNudgeKeydown, true);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeHotspotId) {
    closeHotspotCard();
    return;
  }
});

splatViewerMount.addEventListener("sog-pan-visibilitychange", (event) => {
  sogPanIndicatorVisible = !!event.detail?.visible;
  updateOrbitTargetIndicatorVisibility();
});

splatViewerMount.addEventListener("fp-user-interaction", disableTurntableFromUserInteraction);
splatViewerMount.addEventListener("sog-user-interaction", disableTurntableFromUserInteraction);

splatViewerMount.addEventListener("sog-camera-frame", () => {
  updateHotspotOverlay();
});

splatViewerMount.addEventListener("sog-hotspot-activate", (event) => {
  const hotspot = getActiveHotspotById(event.detail?.id);
  if (!hotspot) return;
  if (calibrationPanelOpen) {
    selectHotspotForCalibration(hotspot.id);
    return;
  }
  activateHotspot(hotspot);
});

hotspotCalibrationSelect.addEventListener("change", () => {
  selectHotspotForCalibration(hotspotCalibrationSelect.value);
  openHotspotCard(hotspotCalibrationSelect.value);
});

hotspotCalibrationStep.addEventListener("change", () => {
  updateHotspotCalibrationUi();
});

hotspotCopyPosition.addEventListener("click", copySelectedHotspotPosition);
hotspotCopyJson.addEventListener("click", copySelectedHotspotJson);
hotspotCopyAllJson.addEventListener("click", copyAllHotspotsJson);

calibrationToggle.addEventListener("click", () => {
  if (!isSogCalibrationAvailable()) {
    return;
  }

  updateCalibrationUi();
  setCalibrationPanelOpen(!calibrationPanelOpen);
});

calibrationClose.addEventListener("click", () => {
  setCalibrationPanelOpen(false);
});

calibrationReset.addEventListener("click", () => {
  resetCalibrationConfig();
});

calibrationSave.addEventListener("click", () => {
  if (currentActiveAsset?.streamingEnabled) {
    saveCurrentStreamedTransforms();
  } else {
    saveCurrentLodTransforms();
  }
});

calibrationCopy.addEventListener("click", async () => {
  await copyCalibrationConfig();
});

calibrationFlyIgnoreCollision.addEventListener("change", () => {
  if (!currentActiveAsset?.streamingEnabled) return;

  sogViewer.setFlyCollisionIgnored?.(calibrationFlyIgnoreCollision.checked);
  setStatus(
    "Fly collision updated",
    calibrationFlyIgnoreCollision.checked
      ? "Fly now passes through collision. Walk remains collision-enabled."
      : "Fly collision is enabled again."
  );
  setStatusOverlayState(false);
  requestAnimationFrame(() => setStatusOverlayState(true));
});

calibrationShowCollision.addEventListener("change", () => {
  sogViewer.setCollisionPreviewVisible?.(calibrationShowCollision.checked);
});

calibrationShowGrid.addEventListener("change", () => {
  sogViewer.setEditorGuidesVisible?.(calibrationShowGrid.checked);
});

calibrationShowAxes.addEventListener("change", () => {
  sogViewer.setEditorAxesVisible?.(calibrationShowAxes.checked);
});

calibrationShowCameraMarker.addEventListener("change", () => {
  sogViewer.setCameraStartMarkerVisible?.(calibrationShowCameraMarker.checked);
});

calibrationCullingEnabled.addEventListener("change", () => {
  sogViewer.setCutawayEnabled?.(calibrationCullingEnabled.checked);
});

calibrationShowBox.addEventListener("change", () => {
  sogViewer.setManualBoxPreviewVisible?.(calibrationShowBox.checked);
});

calibrationSetCurrent.addEventListener("click", () => {
  if (currentActiveAsset?.streamingEnabled || lodCalibTarget !== "camera") return;
  const captured = sogViewer.captureCurrentCameraTransform?.();
  if (!captured) return;
  sogViewer.setCameraStartTransform?.(captured);
  calibrationShowCameraMarker.checked = true;
  populateCalibrationInputs(captured);
  setStatus("Camera start captured", "Initial camera transform set from the current view.");
});

// Target switch for streamed and regular LOD calibration modes.
for (const btn of calibrationTargetButtons) {
  btn.addEventListener("click", () => {
    const nextTarget = btn.dataset.calibTarget;
    if (!nextTarget) return;

    if (!currentActiveAsset?.streamingEnabled) {
      if (!["scene", "box", "camera"].includes(nextTarget) || nextTarget === lodCalibTarget) return;
      lodCalibTarget = nextTarget;
      sogViewer.setManualBoxPreviewVisible?.(nextTarget === "box" && calibrationShowBox.checked);
      sogViewer.setCameraStartMarkerVisible?.(nextTarget === "camera" && calibrationShowCameraMarker.checked);
      updateCalibrationUi();
      return;
    }

    if (!["scene", "collision", "spawn"].includes(nextTarget) || nextTarget === streamedCalibTarget) return;

    streamedCalibTarget = nextTarget;
    if (streamedCalibTarget === "collision") {
      sogViewer.setCollisionPreviewVisible?.(true);
      calibrationShowCollision.checked = true;
    } else if (streamedCalibTarget === "spawn") {
      sogViewer.setSpawnMarkerVisible?.(true);
    }
    updateCalibrationUi();
  });
}

for (const input of [
  ...calibrationInputs.position,
  ...calibrationInputs.rotationDegrees,
  ...calibrationInputs.scale,
]) {
  input.addEventListener("change", () => {
    if (calibrationInputSyncSuspended || !isSogCalibrationAvailable()) {
      return;
    }

    const nextConfig = readCalibrationInputs();
    if (!nextConfig) {
      return;
    }

    applyCalibrationConfig(nextConfig);
  });
}

function showControlsHelpOverlay() {
  if (helpOverlayTimer) {
    clearTimeout(helpOverlayTimer);
  }

  let markup = "";
  if (isMobileDevice) {
    markup = `
      <kbd>Drag</kbd> <span>Look around</span>
      <kbd>Pinch</kbd> <span>Zoom in / out</span>
      <kbd>Double Tap</kbd> <span>Reset camera</span>
      <kbd>Tap on Floor</kbd> <span>Move (Indoor walk)</span>
    `;
  } else {
    markup = `
      <kbd>Left Click + Drag</kbd> <span>Rotate camera</span>
      <kbd>Right Click + Drag</kbd> <span>Pan camera</span>
      <kbd>Scroll</kbd> <span>Zoom in / out</span>
      <kbd>W / A / S / D</kbd> <span>Move (First-person)</span>
      <kbd>Space / Q</kbd> <span>Go Up / Down</span>
    `;
  }
  if (controlsHelpGrid) {
    controlsHelpGrid.innerHTML = markup;
  }
  if (controlsHelpOverlay) {
    controlsHelpOverlay.classList.add("is-visible");
    controlsHelpOverlay.setAttribute("aria-hidden", "false");
  }

  helpOverlayTimer = setTimeout(() => {
    hideControlsHelpOverlay();
  }, 8000);
}

function hideControlsHelpOverlay() {
  if (controlsHelpOverlay) {
    controlsHelpOverlay.classList.remove("is-visible");
    controlsHelpOverlay.setAttribute("aria-hidden", "true");
  }
  if (helpOverlayTimer) {
    clearTimeout(helpOverlayTimer);
    helpOverlayTimer = null;
  }
}

function bindInteractiveUiEvents() {
  if (sceneFilterSearch) {
    sceneFilterSearch.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderSceneCards();
    });
  }

  if (sceneFilterChips) {
    const chips = sceneFilterChips.querySelectorAll(".scene-filter-chip");
    for (const chip of chips) {
      chip.addEventListener("click", () => {
        for (const other of chips) {
          other.setAttribute("data-active", "false");
        }
        chip.setAttribute("data-active", "true");
        activeFilter = chip.dataset.filter || "all";
        renderSceneCards();
      });
    }
  }

  if (sceneCardsEmptyReset) {
    sceneCardsEmptyReset.addEventListener("click", () => {
      searchQuery = "";
      activeFilter = "all";
      if (sceneFilterSearch) {
        sceneFilterSearch.value = "";
      }
      if (sceneFilterChips) {
        for (const chip of sceneFilterChips.querySelectorAll(".scene-filter-chip")) {
          chip.setAttribute("data-active", chip.dataset.filter === "all" ? "true" : "false");
        }
      }
      renderSceneCards();
    });
  }

  if (controlsHelpToggle) {
    controlsHelpToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = controlsHelpOverlay && controlsHelpOverlay.classList.contains("is-visible");
      if (isVisible) {
        hideControlsHelpOverlay();
      } else {
        showControlsHelpOverlay();
      }
    });
  }

  if (controlsHelpOverlay) {
    controlsHelpOverlay.addEventListener("click", (e) => {
      e.stopPropagation();
      hideControlsHelpOverlay();
    });
  }

  document.addEventListener("click", (e) => {
    if (controlsHelpOverlay && controlsHelpOverlay.classList.contains("is-visible")) {
      if (controlsHelpOverlay.contains(e.target) || (controlsHelpToggle && controlsHelpToggle.contains(e.target))) {
        return;
      }
      hideControlsHelpOverlay();
    }
  });
}

bindModelViewerEvents(modelViewer);
syncNavigationState();
updateLocationUi();
updateQualityToggle();
updateMaterialToggle();
updateCalibrationUi();
updateTimeUi();
updateTurntableUi();
isViewerMode = false;
document.body.classList.add("is-scene-selection");
renderSceneCards();
bindInteractiveUiEvents();
updateViewerLayerVisibility("none");
setStatusOverlayState(true);
updateMobileControlsUi();
applyTurntableState();
installGlobalSafetyHandlers();
initAnalytics({
  getSceneId: () => getAnalyticsSceneId(),
  getCanvas: () => sogViewer?.canvas || modelViewer?.shadowRoot?.querySelector?.("canvas") || null,
});
initAnalyticsDashboard();

if (cinematicModeEnabled) {
  document.body.classList.add("is-cinematic");
  document.body.classList.toggle("is-cinematic-author", cinematicAuthorEnabled);
  import("./viewer/cinematicMode.js")
    .then(({ createCinematicMode }) => {
      window.__huaCinematicMode = createCinematicMode({
        viewer: sogViewer,
        preparePath: prepareCinematicPath,
        getSceneInfo: getCinematicSceneInfo,
        toggleRotation: toggleTurntable,
        authorEnabled: cinematicAuthorEnabled,
      });
    })
    .catch((error) => {
      logger.error("ui", "Cinematic mode failed to initialize", { source: "cinematic_mode_init" }, error);
      trackViewerError(error, { source: "cinematic_mode_init" });
    });
}

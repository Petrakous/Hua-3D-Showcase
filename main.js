import { LOCATION_CATALOG } from "./viewer/sceneCatalog.js?v=20260625fp22";
import { PlayCanvasSogViewer } from "./viewer/playCanvasSogViewer.js?v=20260629touch1";
import { SCENE_CALIBRATION_DEFAULTS, installSceneCalibrationExportHelper } from "./viewer/sceneCalibrations.js?v=20260626cal1";

let modelViewer = document.getElementById("siteModel");
const splatViewerMount = document.getElementById("splatViewerMount");
const orbitTargetIndicator = document.getElementById("orbitTargetIndicator");
const siteHeader = document.getElementById("siteHeader");
const progressBar = document.getElementById("progressBar");
const statusPill = document.getElementById("statusPill");
const statusCopy = document.getElementById("statusCopy");
const viewerStatus = document.getElementById("viewerStatus");
const fullscreenToggle = document.getElementById("fullscreenToggle");
const qualityToggle = document.getElementById("qualityToggle");
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
const calibrationTargetControl = document.getElementById("calibrationTargetControl");
const calibrationTargetButtons = [...document.querySelectorAll("[data-calib-target]")];
const timeDial = document.getElementById("timeDial");
const timeControlGroup = document.getElementById("timeControlGroup");
const timeStageMarkers = [...document.querySelectorAll(".time-stage-marker")];
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

const SOG_CALIBRATION_QUERY_PARAM = "sog-calibration";
const SOG_CALIBRATION_FLAG_KEY = "hua:sog-calibration-ui-enabled";
const SOG_CALIBRATION_OVERRIDES_KEY = "hua:sog-calibration-overrides:v1";
const SOG_STREAMED_TRANSFORMS_KEY = "hua:sog-streamed-transforms:v1";
const calibrationQueryEnabled =
  new URLSearchParams(window.location.search).get(SOG_CALIBRATION_QUERY_PARAM) === "1";
const calibrationFlagEnabled =
  safeLocalStorageGet(SOG_CALIBRATION_FLAG_KEY) === "1" ||
  safeLocalStorageGet(SOG_CALIBRATION_FLAG_KEY) === "true";
const calibrationUiUnlocked = calibrationQueryEnabled || calibrationFlagEnabled;

if (calibrationQueryEnabled) {
  safeLocalStorageSet(SOG_CALIBRATION_FLAG_KEY, "1");
}

installSceneCalibrationExportHelper();

const streamedTransformsDefaults = SCENE_CALIBRATION_DEFAULTS.streamedTransforms || {};
const manualBoxDefaults = SCENE_CALIBRATION_DEFAULTS.manualBoxOverrides || {};
const streamedTransformsOverrides = calibrationUiUnlocked ? loadStreamedTransformsOverrides() : {};

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
      return true;
    }

    const nextRangeMin = Math.min(lodLevels - 1, currentRangeMin + 1);
    if (nextRangeMin > currentRangeMin) {
      sogViewer.applyStreamingQuality({
        lodRangeMin: nextRangeMin,
        lodRangeMax: lodLevels - 1,
      });
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
    return true;
  }

  const nextBudget = Math.min(
    state.maxSplatBudget || state.splatBudget || 0,
    Math.round((state.splatBudget || 0) * 1.15)
  );
  if (nextBudget > (state.splatBudget || 0) + 20000) {
    sogViewer.applyStreamingQuality({ splatBudget: nextBudget });
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

  if (fps < SOG_ADAPTIVE_PERFORMANCE.lowFpsThreshold) {
    targetDpr = Math.max(SOG_ADAPTIVE_PERFORMANCE.minDpr, monitor.currentDpr - SOG_ADAPTIVE_PERFORMANCE.dprStep);
  } else if (fps > SOG_ADAPTIVE_PERFORMANCE.highFpsThreshold) {
    targetDpr = Math.min(maxDpr, monitor.currentDpr + SOG_ADAPTIVE_PERFORMANCE.dprStep);
  }

  if (targetDpr !== monitor.currentDpr) {
    monitor.currentDpr = targetDpr;
    sogViewer.setMaxDpr(targetDpr);
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

  if (
    isAtMinDpr &&
    monitor.stableLowSince &&
    timestamp - monitor.stableLowSince >= SOG_ADAPTIVE_PERFORMANCE.downgradeHoldMs
  ) {
    const lowerAsset = getLowerSogAsset(activeAsset);
    if (lowerAsset && canAutoChangeSogTier(activeAsset, "downgrade", timestamp)) {
      recordAutoSogTierChange(activeAsset, "downgrade", timestamp);
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
  try {
    await activateSplatAsset(asset, swapId, {
      silent: !!options.silent,
      targetDpr: options.targetDpr,
    });
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
let activeSogMode = "classic";
let activeFpNavigationMode = "walk";
let hdEnabled = false;
let clayEnabled = false;
let turntableEnabled = true;
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
// Which target the Streamed Move/Rotate/Scale controls edit: "scene" | "collision"
let streamedCalibTarget = "scene";
let dialPointerId = null;
let dialStartAngle = 0;
let dialDragged = false;
let skipNextDialClick = false;
const sogViewer = new PlayCanvasSogViewer(splatViewerMount);

const FORMAT_LABELS = {
  glb: "GLB",
  sog: "SOG",
};
const FORMAT_PRIORITY = ["sog", "glb"];
const GITHUB_MEDIA_BASE_URL = "https://media.githubusercontent.com/media/Petrakous/Hua-3D-Showcase/main/";
const GITHUB_RAW_BASE_URL = "https://raw.githubusercontent.com/Petrakous/Hua-3D-Showcase/main/";
const calibrationOverrides = calibrationUiUnlocked ? loadCalibrationOverrides() : {};
const calibrationSessionDefaults = new Map();

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

  if (asset.streamingEnabled && asset.sceneCalibrationKey) {
    const streamedOverride = getStreamedTransformOverride(asset);
    if (streamedOverride) {
      const updatedAsset = { ...asset };
      if (streamedOverride.scene) {
        updatedAsset.position = streamedOverride.scene.position;
        updatedAsset.rotationDegrees = streamedOverride.scene.rotationDegrees;
        updatedAsset.rotation = degreesToQuaternion(streamedOverride.scene.rotationDegrees);
        updatedAsset.scale = streamedOverride.scene.scale;
      }
      if (streamedOverride.collision) {
        updatedAsset.collisionPosition = streamedOverride.collision.position;
        updatedAsset.collisionRotationDegrees = streamedOverride.collision.rotationDegrees;
        updatedAsset.collisionRotation = degreesToQuaternion(streamedOverride.collision.rotationDegrees);
        updatedAsset.collisionScale = streamedOverride.collision.scale;
      }
      if (streamedOverride.spawn) {
        updatedAsset.spawnOverride = {
          position: streamedOverride.spawn.position,
          rotationDegrees: streamedOverride.spawn.rotationDegrees,
        };
      }
      return updatedAsset;
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

  return activeSogMode === "streamed" && asset.streamingSource && asset.manualBox ? "streamed" : "classic";
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

    return finalizeSogAsset(baseAsset);
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

    return finalizeSogAsset(baseAsset);
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

  return finalizeSogAsset(baseAsset);
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

function releaseActiveViewerResources() {
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
    } else {
      sogViewer.setCollisionPreviewVisible?.(false);
      sogViewer.setEditorGuidesVisible?.(false);
      sogViewer.setSpawnMarkerVisible?.(false);
      streamedCalibTarget = "scene";
    }
  }
}

function setCalibrationInputsDisabled(disabled) {
  const controls = [
    ...calibrationInputs.position,
    ...calibrationInputs.rotationDegrees,
    ...calibrationInputs.scale,
    calibrationReset,
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
  calibrationSave.style.display = isStreamed ? "" : "none";
  calibrationLodControls.hidden = isStreamed;
  calibrationFlyCollisionControl.hidden = !isStreamed;
  calibrationCollisionPreviewControl.hidden = !isStreamed;
  calibrationGridControl.hidden = !isStreamed;
  calibrationTargetControl.hidden = !isStreamed;
  calibrationFlyIgnoreCollision.checked = isStreamed && sogViewer.getFlyCollisionIgnored?.() === true;
  calibrationShowCollision.checked = isStreamed && sogViewer.getCollisionPreviewVisible?.() === true;

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

  const lodLabels = calibrationLodControls.querySelectorAll(".calibration-group__label");
  if (lodLabels[0]) lodLabels[0].textContent = "Move";
  if (lodLabels[1]) lodLabels[1].textContent = "Rotate";
  if (lodLabels[2]) lodLabels[2].textContent = "Scale";

  const config = getCurrentCalibrationConfig();
  calibrationSceneLabel.textContent = currentActiveAsset?.label || "Active SOG scene";
  calibrationHint.textContent = currentActiveAsset?.sceneCalibrationKey
    ? `Scene key: ${currentActiveAsset.sceneCalibrationKey}`
    : "Live transform controls for the active SOG cutaway box.";
  populateCalibrationInputs(config);
  setCalibrationInputsDisabled(false);
}

function readCalibrationInputs() {
  // In streamed mode the inputs represent the scene OR collision transform,
  // not the manual box, so use the active target transform as the base.
  const currentConfig = currentActiveAsset?.streamingEnabled
    ? getStreamedTargetTransform()
    : getCurrentCalibrationConfig();
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
  const config = getCurrentCalibrationConfig();
  if (!config) {
    return;
  }

  const payload = JSON.stringify({
    manualBox: config,
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
    isSogActive && !!asset?.manualBox;

  sogModeControl.hidden = !shouldShowModeControl;

  if (!shouldShowModeControl) {
    sogModeMarkers.innerHTML = "";
    return;
  }

  sogModeMarkers.innerHTML = ["classic", "streamed"]
    .map((mode) => `
      <button
        class="location-stage-marker"
        data-sog-mode="${mode}"
        data-active="${String(mode === activeSogMode)}"
        type="button"
      >${SOG_MODE_LABELS[mode]}</button>
    `)
    .join("");

  for (const button of sogModeMarkers.querySelectorAll(".location-stage-marker")) {
    button.addEventListener("click", () => {
      const mode = button.dataset.sogMode;
      if (!mode || mode === activeSogMode) {
        return;
      }

      if (mode === "streamed" && (!asset?.streamingSource || !asset?.manualBox)) {
        setStatus("FP mode unavailable", "This scene does not have inside exploration data yet.");
        setStatusOverlayState(false);
        requestAnimationFrame(() => {
          setStatusOverlayState(true);
        });
        return;
      }

      setActiveSogMode(mode);
    });
  }
}

function renderFpNavMarkers() {
  const asset = currentActiveAsset?.type === "splat" ? currentActiveAsset : getActiveAssetDescriptor();
  const shouldShowFpNavControl =
    currentEngineType === "splat" &&
    asset?.type === "splat" &&
    asset?.runtime === "playcanvas" &&
    asset?.fileFormat === "sog" &&
    !!asset?.streamingEnabled;

  fpNavControl.hidden = !shouldShowFpNavControl;

  if (!shouldShowFpNavControl) {
    fpNavMarkers.innerHTML = "";
    return;
  }

  fpNavMarkers.innerHTML = ["walk", "fly"]
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

  const availableTiers = [];
  if (currentActiveAsset?.performanceSources?.lod0) availableTiers.push("lod0");
  if (currentActiveAsset?.performanceSources?.lod1) availableTiers.push("lod1");
  if (currentActiveAsset?.performanceSources?.lod2) availableTiers.push("lod2");
  if (currentActiveAsset?.performanceSources?.lod3) availableTiers.push("lod3");
  if (currentActiveAsset?.performanceSources?.lod4) availableTiers.push("lod4");

  if (availableTiers.length > 0 && !availableTiers.includes("lod0")) {
      availableTiers.unshift("lod0");
  } else if (availableTiers.length === 0) {
      availableTiers.push("lod0");
  }

  const tierLabels = {
    lod0: "LOD0",
    lod1: "LOD1",
    lod2: "LOD2",
    lod3: "LOD3",
    lod4: "LOD4",
  };

  lodMarkers.innerHTML = availableTiers
    .map((tier) => `
      <button
        class="location-stage-marker"
        data-lod-tier="${tier}"
        data-active="${String(tier === currentActiveAsset?.performanceTier)}"
        type="button"
      >${tierLabels[tier]}</button>
    `)
    .join("");

  for (const button of lodMarkers.querySelectorAll(".location-stage-marker")) {
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
  renderSogModeMarkers();
  renderFpNavMarkers();
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
  for (const marker of sogModeMarkers.querySelectorAll(".location-stage-marker")) {
    marker.disabled = isBusy;
  }
  for (const marker of fpNavMarkers.querySelectorAll(".location-stage-marker")) {
    marker.disabled = isBusy;
  }
  for (const marker of lodMarkers.querySelectorAll(".location-stage-marker")) {
    marker.disabled = isBusy;
  }
  calibrationToggle.disabled = isBusy || !isSogCalibrationAvailable();
  setCalibrationInputsDisabled(isBusy || !isSogCalibrationAvailable());

  if (isBusy) {
    qualityToggle.disabled = true;
    materialToggle.disabled = true;
  } else {
    updateQualityToggle();
    updateMaterialToggle();
    renderSogModeMarkers();
    renderFpNavMarkers();
    updateLodToggle();
    updateCalibrationUi();
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
  const resolvedSource = asset.src;
  if (swapId !== activeAssetSwapId) {
    return;
  }

  turntableEnabled = true;
  updateTurntableUi();

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
  const resolvedSource = resolveHostedSogUrl(asset.src);
  const targetSplatProfile = {
    maxDpr: asset.streamingEnabled
      ? Math.min(asset.streamingSettings?.maxDpr || autoPerformanceProfile.maxDpr, window.devicePixelRatio || 1)
      : splatProfile.maxDpr,
  };
  if (swapId !== activeAssetSwapId) {
    return;
  }

  if (asset.streamingEnabled) {
    turntableEnabled = false;
  } else {
    turntableEnabled = true;
  }
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
  updateViewerLayerVisibility("splat");
  if (!options.silent) {
    setProgress(0.22);
  }

  await sogViewer.load(
    {
      ...asset,
      src: resolvedSource,
      autoRotate: turntableEnabled,
      transitionOrbitState:
        !asset.streamingEnabled
          ? pendingSogModeTransitionOrbitState
          : null,
    },
    targetSplatProfile,
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

  if (Number.isFinite(options.targetDpr)) {
    sogViewer.setMaxDpr(options.targetDpr);
  }

  if (asset.streamingEnabled) {
    sogViewer.setFirstPersonNavigationMode(activeFpNavigationMode);
  }

  pendingSogModeTransitionOrbitState = null;

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

  startSogPerformanceMonitor(
    asset,
    Number.isFinite(options.targetDpr) ? options.targetDpr : null
  );
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
    renderFpNavMarkers();
    updateLodToggle();
    updateCalibrationUi();
    return;
  }

  const swapId = ++activeAssetSwapId;

  if (nextAsset.key === currentAssetKey && nextAsset.type === currentEngineType) {
    setStatusOverlayState(false);
    setStatus("Scene ready", `${describeActiveAsset(nextAsset)} is already active.`);
    updateMaterialToggle();
    updateQualityToggle();
    renderFpNavMarkers();
    updateLodToggle();
    updateCalibrationUi();
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
      setStatus("3D hero active", describeLoadedAssetStatus(nextAsset));
      requestAnimationFrame(() => {
        if (swapId === activeAssetSwapId) {
          setStatusOverlayState(true);
        }
      });
    } else {
      await activateGlbAsset(nextAsset, swapId);
      updateCalibrationUi();
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
      renderSogModeMarkers();
      renderFpNavMarkers();
      updateLodToggle();
      updateCalibrationUi();
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

async function setActiveSogMode(mode) {
  if (!["classic", "streamed"].includes(mode) || mode === activeSogMode) {
    return;
  }

  pendingSogModeTransitionOrbitState =
    currentEngineType === "splat" && currentActiveAsset?.runtime === "playcanvas"
      ? sogViewer.getOrbitState?.()
      : null;
  activeSogMode = mode;
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

splatViewerMount.addEventListener("fp-user-interaction", () => {
  if (!turntableEnabled) {
    return;
  }

  turntableEnabled = false;
  updateTurntableUi();
});

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
  saveCurrentStreamedTransforms();
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
  if (!currentActiveAsset?.streamingEnabled) return;
  sogViewer.setCollisionPreviewVisible?.(calibrationShowCollision.checked);
});

calibrationShowGrid.addEventListener("change", () => {
  sogViewer.setEditorGuidesVisible?.(calibrationShowGrid.checked);
});

// Scene / Collision / Spawn target switch (streamed mode only)
for (const btn of calibrationTargetButtons) {
  btn.addEventListener("click", () => {
    if (!currentActiveAsset?.streamingEnabled) return;
    const nextTarget = btn.dataset.calibTarget;
    if (nextTarget === streamedCalibTarget) return;

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

bindModelViewerEvents(modelViewer);
syncNavigationState();
updateLocationUi();
updateQualityToggle();
updateMaterialToggle();
updateCalibrationUi();
updateTimeUi();
updateTurntableUi();
setStatusOverlayState(false);
applyTurntableState();

setProgress(0.08);
setStatus("Loading scene", "Preparing the 3D viewer and resolving the active campus scene.");
applyActiveAssetSelection();













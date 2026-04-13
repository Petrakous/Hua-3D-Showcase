const modelViewer = document.getElementById("siteModel");
const siteHeader = document.getElementById("siteHeader");
const progressBar = document.getElementById("progressBar");
const statusPill = document.getElementById("statusPill");
const statusCopy = document.getElementById("statusCopy");
const viewerStatus = document.getElementById("viewerStatus");
const fullscreenToggle = document.getElementById("fullscreenToggle");
const qualityToggle = document.getElementById("qualityToggle");
const timeDial = document.getElementById("timeDial");
const timeStageMarkers = [...document.querySelectorAll(".time-stage-marker")];
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
const modelSources = {
  day: {
    web: "./HuaDayBest1_web.glb",
    hd: "./HuaDayBest1.glb",
  },
  dusk: {
    web: "./HuaMainDraco.glb",
    hd: "./HuaMainDraco.glb",
  },
  night: {
    web: "./HuaMainNightDraco.glb",
    hd: "./HuaMainNightDraco.glb",
  },
};
const mobileModelSources = {
  night: {
    web: "./HuaMainNightDraco_mobile.glb",
    hd: "./HuaMainNightDraco_mobile.glb",
  },
};
const hdAvailability = {
  day: true,
  dusk: false,
  night: false,
};
const clayColor = [0.86, 0.89, 0.92, 1];
const stageViews = {
  day: {
    web: {
      orientation: "0deg 0deg 0deg",
      cameraTarget: "auto auto auto",
      cameraOrbit: "180deg 75deg auto",
      fieldOfView: "24deg",
      minCameraOrbit: "auto 55deg auto",
      maxCameraOrbit: "auto 85deg auto",
    },
    hd: {
      orientation: "0deg 0deg 0deg",
      cameraTarget: "auto auto auto",
      cameraOrbit: "180deg 75deg auto",
      fieldOfView: "24deg",
      minCameraOrbit: "auto 55deg auto",
      maxCameraOrbit: "auto 85deg auto",
    },
  },
  dusk: {
    web: {
      orientation: "0deg 0deg 0deg",
      cameraTarget: "auto auto auto",
      cameraOrbit: "0deg 0deg auto",
      fieldOfView: "10deg",
      minCameraOrbit: "auto 55deg auto",
      maxCameraOrbit: "auto 85deg auto",
    },
    hd: {
      orientation: "180deg 90deg 0deg",
      cameraTarget: "auto auto auto",
      cameraOrbit: "0deg 0deg auto",
      fieldOfView: "10deg",
      minCameraOrbit: "auto 55deg auto",
      maxCameraOrbit: "auto 85deg auto",
    },
  },
  night: {
    web: {
      orientation: "0deg 0deg 0deg",
      cameraTarget: "auto auto auto",
      cameraOrbit: "0deg 0deg auto",
      fieldOfView: "10deg",
      minCameraOrbit: "auto 55deg auto",
      maxCameraOrbit: "auto 85deg auto",
    },
    hd: {
      orientation: "0deg 0deg 0deg",
      cameraTarget: "auto auto auto",
      cameraOrbit: "0deg 0deg auto",
      fieldOfView: "10deg",
      minCameraOrbit: "auto 55deg auto",
      maxCameraOrbit: "auto 85deg auto",
    },
  },
};

let activeTimeStage = "day";
let hdEnabled = false;
let clayEnabled = false;
let originalMaterials = [];
let currentStageRotation = timeStageAngles[activeTimeStage];
let currentModelSource = modelSources[activeTimeStage].web;
let activeModelSwapId = 0;
let dialPointerId = null;
let dialStartAngle = 0;
let dialDragged = false;
let skipNextDialClick = false;
const preloadedModelUrls = new Map();
const preloadPromises = new Map();
const isMobileDevice =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const useBlobPreloading = !isMobileDevice;

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

function getActiveView() {
  return stageViews[activeTimeStage][hdEnabled ? "hd" : "web"];
}

function frameDefaultView() {
  const view = getActiveView();
  modelViewer.orientation = view.orientation;
  modelViewer.cameraTarget = view.cameraTarget;
  modelViewer.cameraOrbit = view.cameraOrbit;
  modelViewer.fieldOfView = view.fieldOfView;
  modelViewer.minCameraOrbit = view.minCameraOrbit;
  modelViewer.maxCameraOrbit = view.maxCameraOrbit;
  modelViewer.jumpCameraToGoal();
}

async function resetViewAfterLoad() {
  frameDefaultView();
  await modelViewer.updateComplete;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      frameDefaultView();
    });
  });
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
  if (!useBlobPreloading) {
    return Promise.resolve(src);
  }

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
  if (!useBlobPreloading) {
    return src;
  }

  if (preloadedModelUrls.has(src)) {
    return preloadedModelUrls.get(src);
  }

  return preloadModel(src);
}

function getActiveModelSource() {
  const qualityKey = hdEnabled ? "hd" : "web";
  if (isMobileDevice && mobileModelSources[activeTimeStage]?.[qualityKey]) {
    return mobileModelSources[activeTimeStage][qualityKey];
  }
  return modelSources[activeTimeStage][qualityKey];
}

function updateQualityToggle() {
  const hdAvailable = hdAvailability[activeTimeStage];
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
  timeDial.disabled = isBusy;
  if (isBusy) {
    qualityToggle.disabled = true;
  } else {
    updateQualityToggle();
  }
}

async function applyActiveModelSelection() {
  const nextSource = getActiveModelSource();
  const swapId = ++activeModelSwapId;

  if (nextSource === currentModelSource) {
    setStatusOverlayState(false);
    setStatus(
      "Model ready",
      `${timeLabels[activeTimeStage]}${hdEnabled ? " HD" : ""} is already active.`
    );
    return;
  }

  setControlsBusy(true);
  setStatusOverlayState(false);
  setStatus("Switching model", `Loading ${timeLabels[activeTimeStage]}${hdEnabled ? " HD" : ""}...`);

  try {
    const resolvedSource = await getModelUrl(nextSource);

    if (swapId !== activeModelSwapId) {
      return;
    }

    currentModelSource = nextSource;
    modelViewer.src = resolvedSource;
    await modelViewer.updateComplete;
  } finally {
    if (swapId === activeModelSwapId) {
      setControlsBusy(false);
    }
  }
}

async function setActiveTimeStage(stage, direction = 0) {
  if (!timeStages.includes(stage)) {
    return;
  }

  activeTimeStage = stage;
  updateQualityToggle();
  updateTimeUi(direction);
  await applyActiveModelSelection();
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
  setStatusOverlayState(false);
  setProgress(event.detail.totalProgress);
  setStatus(
    event.detail.totalProgress >= 1 ? "Model ready" : "Loading model",
    `${Math.round(event.detail.totalProgress * 100)}% complete`
  );
});

modelViewer.addEventListener("load", async () => {
  document.body.classList.add("is-loaded");
  setProgress(1);
  setStatus("3D hero active", "The model has loaded and the camera is orbiting around the campus.");
  cacheMaterialState();
  await resetViewAfterLoad();

  if (clayEnabled) {
    applyClayMaterials();
  }

  requestAnimationFrame(() => {
    setStatusOverlayState(true);
  });
});

modelViewer.addEventListener("error", (event) => {
  document.body.classList.add("is-error");
  setStatusOverlayState(false);
  setStatus("Asset issue", event.detail?.type || "The model did not render correctly.");
  setControlsBusy(false);
});

resetCamera.addEventListener("click", () => {
  resetViewAfterLoad();
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
  if (!hdAvailability[activeTimeStage]) {
    return;
  }

  hdEnabled = !hdEnabled;
  updateQualityToggle();
  await applyActiveModelSelection();
});

turntableToggle.addEventListener("click", () => {
  const shouldRotate = !modelViewer.autoRotate;
  modelViewer.autoRotate = shouldRotate;
  turntableToggle.setAttribute("aria-pressed", String(shouldRotate));
  turntableToggle.setAttribute("aria-label", shouldRotate ? "Rotate on" : "Rotate off");
  turntableToggle.title = shouldRotate ? "Rotate on" : "Rotate off";
});

materialToggle.addEventListener("click", () => {
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

updateQualityToggle();
updateTimeUi();
setStatusOverlayState(false);

if (useBlobPreloading) {
  for (const src of new Set([
    modelSources.day.web,
    modelSources.day.hd,
    modelSources.dusk.web,
    modelSources.dusk.hd,
    modelSources.night.web,
    modelSources.night.hd,
  ])) {
    preloadModel(src);
  }
}

setProgress(0.08);

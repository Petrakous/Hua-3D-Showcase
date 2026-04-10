const modelViewer = document.getElementById("siteModel");
const siteHeader = document.getElementById("siteHeader");
const progressBar = document.getElementById("progressBar");
const statusPill = document.getElementById("statusPill");
const statusCopy = document.getElementById("statusCopy");
const fullscreenToggle = document.getElementById("fullscreenToggle");
const resetCamera = document.getElementById("resetCamera");
const turntableToggle = document.getElementById("turntableToggle");
const materialToggle = document.getElementById("materialToggle");
const nightModeToggle = document.getElementById("nightModeToggle");

const dayModelSrc = "../HuaMainDraco.glb";
const nightModelSrc = "../HuaMainNightDraco.glb";
const defaultCameraOrbit = "0deg 0deg auto";
const defaultFieldOfView = "10deg";
const clayColor = [0.86, 0.89, 0.92, 1];
const dayView = {
  orientation: "180deg 90deg 0deg",
  cameraTarget: "auto auto auto",
  cameraOrbit: defaultCameraOrbit,
  fieldOfView: defaultFieldOfView,
  minCameraOrbit: "auto 55deg auto",
  maxCameraOrbit: "auto 85deg auto",
};
const nightView = {
  orientation: "0deg 0deg 0deg",
  cameraTarget: "auto auto auto",
  cameraOrbit: defaultCameraOrbit,
  fieldOfView: defaultFieldOfView,
  minCameraOrbit: "auto 55deg auto",
  maxCameraOrbit: "auto 85deg auto",
};

let clayEnabled = false;
let nightModeEnabled = false;
let originalMaterials = [];
const preloadedModelUrls = new Map();
const preloadPromises = new Map();

function setProgress(value) {
  progressBar.style.width = `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`;
}

function setStatus(title, text) {
  statusPill.textContent = title;
  statusCopy.textContent = text;
}

function frameDefaultView() {
  const view = nightModeEnabled ? nightView : dayView;
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
  originalMaterials = modelViewer.model?.materials?.map((material) => {
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

modelViewer.addEventListener("progress", (event) => {
  setProgress(event.detail.totalProgress);
  setStatus(
    event.detail.totalProgress >= 1 ? "Το μοντέλο είναι έτοιμο" : "Φόρτωση μοντέλου",
    `${Math.round(event.detail.totalProgress * 100)}% ολοκληρώθηκε`
  );
});

modelViewer.addEventListener("load", async () => {
  document.body.classList.add("is-loaded");
  setProgress(1);
  setStatus("3D hero ενεργό", "Το μοντέλο φορτώθηκε και η κάμερα κάνει drone-style orbit γύρω από το campus.");
  cacheMaterialState();
  await resetViewAfterLoad();

  if (clayEnabled) {
    applyClayMaterials();
  }
});

modelViewer.addEventListener("error", (event) => {
  document.body.classList.add("is-error");
  setStatus("Πρόβλημα asset", event.detail?.type || "Το μοντέλο δεν έγινε render σωστά.");
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

turntableToggle.addEventListener("click", () => {
  const shouldRotate = !modelViewer.autoRotate;
  modelViewer.autoRotate = shouldRotate;
  turntableToggle.setAttribute("aria-pressed", String(shouldRotate));
  turntableToggle.textContent = shouldRotate ? "Παύση drone orbit" : "Έναρξη drone orbit";
});

materialToggle.addEventListener("click", () => {
  clayEnabled = !clayEnabled;
  materialToggle.setAttribute("aria-pressed", String(clayEnabled));
  materialToggle.textContent = clayEnabled ? "Textured view" : "Clay view";

  if (clayEnabled) {
    applyClayMaterials();
  } else {
    restoreMaterials();
  }
});

nightModeToggle.addEventListener("click", async () => {
  if (nightModeToggle.disabled) {
    return;
  }

  nightModeEnabled = !nightModeEnabled;
  nightModeToggle.disabled = true;
  nightModeToggle.setAttribute("aria-pressed", String(nightModeEnabled));
  nightModeToggle.textContent = nightModeEnabled ? "Day mode" : "Night mode";

  try {
    const nextSrc = nightModeEnabled ? nightModelSrc : dayModelSrc;
    const resolvedSrc = await getModelUrl(nextSrc);
    modelViewer.src = resolvedSrc;
    await modelViewer.updateComplete;
  } finally {
    nightModeToggle.disabled = false;
  }
});

document.addEventListener("scroll", () => {
  siteHeader.classList.toggle("is-solid", window.scrollY > 24);
});

document.addEventListener("fullscreenchange", () => {
  fullscreenToggle.textContent = document.fullscreenElement ? "Έξοδος πλήρους" : "Πλήρης οθόνη";
});

preloadModel(nightModelSrc);
preloadModel(dayModelSrc);
setProgress(0.08);

const modelViewer = document.getElementById("siteModel");
const siteHeader = document.getElementById("siteHeader");
const progressBar = document.getElementById("progressBar");
const statusPill = document.getElementById("statusPill");
const statusCopy = document.getElementById("statusCopy");
const fullscreenToggle = document.getElementById("fullscreenToggle");
const resetCamera = document.getElementById("resetCamera");
const turntableToggle = document.getElementById("turntableToggle");
const materialToggle = document.getElementById("materialToggle");

const defaultCameraOrbit = "0deg 0deg auto";
const defaultFieldOfView = "10deg";
const clayColor = [0.86, 0.89, 0.92, 1];

let clayEnabled = false;
let originalMaterials = [];

function setProgress(value) {
  progressBar.style.width = `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`;
}

function setStatus(title, text) {
  statusPill.textContent = title;
  statusCopy.textContent = text;
}

function frameDefaultView() {
  modelViewer.cameraTarget = "auto auto auto";
  modelViewer.cameraOrbit = defaultCameraOrbit;
  modelViewer.fieldOfView = defaultFieldOfView;
  modelViewer.jumpCameraToGoal();
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

modelViewer.addEventListener("progress", (event) => {
  setProgress(event.detail.totalProgress);
  setStatus(
    event.detail.totalProgress >= 1 ? "Το μοντέλο είναι έτοιμο" : "Φόρτωση μοντέλου",
    `${Math.round(event.detail.totalProgress * 100)}% ολοκληρώθηκε`
  );
});

modelViewer.addEventListener("load", () => {
  document.body.classList.add("is-loaded");
  setProgress(1);
  setStatus("3D hero ενεργό", "Το μοντέλο φορτώθηκε και η κάμερα κάνει drone-style orbit γύρω από το campus.");
  cacheMaterialState();
  frameDefaultView();
});

modelViewer.addEventListener("error", (event) => {
  document.body.classList.add("is-error");
  setStatus("Πρόβλημα asset", event.detail?.type || "Το μοντέλο δεν έγινε render σωστά.");
});

resetCamera.addEventListener("click", () => {
  frameDefaultView();
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

document.addEventListener("scroll", () => {
  siteHeader.classList.toggle("is-solid", window.scrollY > 24);
});

document.addEventListener("fullscreenchange", () => {
  fullscreenToggle.textContent = document.fullscreenElement ? "Έξοδος πλήρους" : "Πλήρης οθόνη";
});

setProgress(0.08);

import {
  MAX_CUTAWAY_OUTLINE_VERTICES,
  MAX_SPLAT_EXCLUSION_BOXES,
  MAX_SPLAT_PATCHES,
  buildPaddedOutlineVertices,
  cloneCutawayOutline,
  getCutawayOutlineLevels,
  normalizeSplatExclusionBoxes,
  normalizeSplatPatches,
} from "./cutawayOutline.js?v=20261002editor5";

const SVG_NS = "http://www.w3.org/2000/svg";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function option(value, label) {
  const element = document.createElement("option");
  element.value = String(value);
  element.textContent = label;
  return element;
}

function createSvg(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function setValue(element, value, digits = 3) {
  if (!element) return;
  element.value = Number(finite(value)).toFixed(digits);
}

function getEditableOutlineLevels(outline) {
  if (Array.isArray(outline?.levels) && outline.levels.length > 1) return outline.levels;
  return outline ? [outline] : [];
}

function createCutawayEditor({ getConfig, applyConfig, getSourceConfig, setStatus }) {
  const root = document.getElementById("calibrationCutawayWorkspace");
  if (!root) return { refresh() {}, setVisible() {} };

  for (const panel of root.querySelectorAll("[data-transform-panel]")) {
    const kind = panel.dataset.transformPanel;
    panel.innerHTML = ["position", "rotationDegrees", "scale"].map((field) => `
      <div class="calibration-transform-row">
        <span>${field === "position" ? "Move" : field === "rotationDegrees" ? "Rotate" : "Scale"}</span>
        ${["X", "Y", "Z"].map((axis, index) => `<label><span>${axis}</span><input data-editor-transform="${kind}" data-transform-field="${field}" data-axis="${index}" type="number" step="${field === "rotationDegrees" ? "0.1" : "0.01"}" /></label>`).join("")}
      </div>`).join("");
  }

  const byId = (id) => document.getElementById(id);
  const controls = {
    modeButtons: [...root.querySelectorAll("[data-cutaway-mode]")],
    level: byId("calibrationOutlineLevelSelect"),
    map: byId("calibrationOutlineMap"),
    edge: byId("calibrationOutlineEdgeSelect"),
    split: byId("calibrationOutlineAddVertex"),
    remove: byId("calibrationOutlineDeleteVertex"),
    restore: byId("calibrationOutlineRestoreAuto"),
    resetTransform: byId("calibrationOutlineResetTransform"),
    edgeEnabled: byId("calibrationOutlineEdgeEnabled"),
    edgeActivation: byId("calibrationOutlineEdgeActivation"),
    globalDepthEnabled: byId("calibrationOutlineGlobalDepthEnabled"),
    globalDepth: byId("calibrationOutlineGlobalDepth"),
    edgeDepthMode: byId("calibrationOutlineEdgeDepthMode"),
    edgeDepth: byId("calibrationOutlineEdgeDepth"),
    edgeSlope: byId("calibrationOutlineEdgeSlope"),
    paddingMode: byId("calibrationOutlinePaddingMode"),
    paddingDistance: byId("calibrationOutlinePaddingDistance"),
    cleanupMode: byId("calibrationOutlineCleanupMode"),
    cleanupMargin: byId("calibrationOutlineCleanupMargin"),
    cleanupStrength: byId("calibrationOutlineCleanupStrength"),
    edgePaddingMode: byId("calibrationOutlineEdgePaddingMode"),
    edgePaddingDistance: byId("calibrationOutlineEdgePaddingDistance"),
    edgeCleanupMode: byId("calibrationOutlineEdgeCleanupMode"),
    edgeCleanupMargin: byId("calibrationOutlineEdgeCleanupMargin"),
    floor: byId("calibrationOutlineFloor"),
    ceiling: byId("calibrationOutlineCeiling"),
    fade: byId("calibrationOutlineFade"),
    topDepth: byId("calibrationOutlineTopDepth"),
    bottomDepth: byId("calibrationOutlineBottomDepth"),
    smoothing: byId("calibrationOutlineMotionSmoothing"),
    acceleration: byId("calibrationOutlineMotionAcceleration"),
    faceInputs: [...root.querySelectorAll("[data-cutaway-face]")],
    faceRanges: [...root.querySelectorAll("[data-cutaway-face-range]")],
    faceEnabled: [...root.querySelectorAll("[data-cutaway-face-enabled]")],
    exclusionSelect: byId("calibrationExclusionSelect"),
    exclusionAdd: byId("calibrationExclusionAdd"),
    exclusionDelete: byId("calibrationExclusionDelete"),
    exclusionEnabled: byId("calibrationExclusionEnabled"),
    exclusionFade: byId("calibrationExclusionFade"),
    patchSelect: byId("calibrationPatchSelect"),
    patchAdd: byId("calibrationPatchAdd"),
    patchDelete: byId("calibrationPatchDelete"),
    patchMode: byId("calibrationPatchMode"),
    patchFade: byId("calibrationPatchFade"),
    transformInputs: [...root.querySelectorAll("[data-editor-transform]")],
    importText: byId("calibrationImportText"),
    importApply: byId("calibrationImportApply"),
    importMessage: byId("calibrationImportMessage"),
  };

  let selectedLevel = 0;
  let selectedEdge = 0;
  let selectedExclusion = 0;
  let selectedPatch = 0;
  let syncing = false;
  let projection = null;
  let drag = null;

  const currentOutline = (config = getConfig()) => {
    const outline = cloneCutawayOutline(config?.outline);
    if (!outline) return null;
    const levels = getEditableOutlineLevels(outline);
    selectedLevel = Math.max(0, Math.min(selectedLevel, levels.length - 1));
    return { root: outline, levels, level: levels[selectedLevel] };
  };

  function commit(mutator, message = "Cutaway updated", { refreshUi = true, announce = true } = {}) {
    const config = getConfig();
    if (!config) return;
    mutator(config);
    applyConfig(config);
    if (refreshUi) refresh();
    if (announce) setStatus?.(message, "The current scene preview was updated. Press Save to keep it in this browser.");
  }

  function mutateOutline(mutator, message, options) {
    commit((config) => {
      const outline = cloneCutawayOutline(config.outline);
      if (!outline) return;
      const levels = getEditableOutlineLevels(outline);
      selectedLevel = Math.max(0, Math.min(selectedLevel, levels.length - 1));
      mutator(levels[selectedLevel], outline, levels);
      config.outline = outline;
      config.cutawayMode = "outline";
    }, message, options);
  }

  function getProjection(vertices) {
    const xs = vertices.map((point) => point[0]);
    const zs = vertices.map((point) => point[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    const width = Math.max(maxX - minX, 0.001);
    const height = Math.max(maxZ - minZ, 0.001);
    const scale = Math.min(270 / width, 180 / height);
    return { minX, minZ, scale, offsetX: (320 - width * scale) / 2, offsetY: (230 - height * scale) / 2 };
  }

  function toScreen(point) {
    return [projection.offsetX + (point[0] - projection.minX) * projection.scale,
      230 - projection.offsetY - (point[1] - projection.minZ) * projection.scale];
  }

  function toModel(event) {
    const rect = controls.map.getBoundingClientRect();
    const x = (event.clientX - rect.left) * 320 / Math.max(rect.width, 1);
    const y = (event.clientY - rect.top) * 230 / Math.max(rect.height, 1);
    return [(x - projection.offsetX) / projection.scale + projection.minX,
      ((230 - y) - projection.offsetY) / projection.scale + projection.minZ];
  }

  function renderMap(level, { preserveProjection = false } = {}) {
    controls.map.replaceChildren();
    if (!level?.vertices?.length) return;
    const effective = buildPaddedOutlineVertices(level);
    if (!preserveProjection || !projection) projection = getProjection([...level.vertices, ...effective]);
    const polygon = createSvg("polygon", {
      points: level.vertices.map((point) => toScreen(point).join(",")).join(" "),
      class: "calibration-outline-map__shape",
    });
    controls.map.append(polygon);
    level.vertices.forEach((point, index) => {
      const next = level.vertices[(index + 1) % level.vertices.length];
      const [x1, y1] = toScreen(point);
      const [x2, y2] = toScreen(next);
      const line = createSvg("line", { x1, y1, x2, y2, class: `calibration-outline-map__edge${index === selectedEdge ? " is-selected" : ""}` });
      line.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectedEdge = index;
        drag = { type: "edge", start: toModel(event), vertices: level.vertices.map((item) => [...item]) };
        controls.map.setPointerCapture(event.pointerId);
      });
      controls.map.append(line);
      const vertex = createSvg("circle", { cx: x1, cy: y1, r: 7, class: `calibration-outline-map__vertex${index === selectedEdge ? " is-selected" : ""}` });
      vertex.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectedEdge = index;
        drag = { type: "vertex", index };
        controls.map.setPointerCapture(event.pointerId);
      });
      controls.map.append(vertex);
      const label = createSvg("text", { x: x1 + 7, y: y1 - 7, class: "calibration-outline-map__label" });
      label.textContent = String(index + 1);
      controls.map.append(label);
    });
  }

  function populateTransformInputs(kind, transform) {
    for (const input of controls.transformInputs.filter((item) => item.dataset.editorTransform === kind)) {
      const field = input.dataset.transformField;
      const axis = Number(input.dataset.axis);
      setValue(input, transform?.[field]?.[axis] ?? (field === "scale" ? 1 : 0));
    }
  }

  function refresh() {
    syncing = true;
    const config = getConfig();
    root.hidden = !config;
    if (!config) { syncing = false; return; }
    controls.modeButtons.forEach((button) => { button.dataset.active = String(button.dataset.cutawayMode === config.cutawayMode); });
    controls.faceInputs.forEach((input) => {
      const face = input.dataset.cutawayFace;
      const value = config.cutDepthByFace?.[face] ?? config.cutRatio ?? 0.2;
      setValue(input, value);
      const range = controls.faceRanges.find((item) => item.dataset.cutawayFaceRange === face);
      const enabled = config.cutEnabledByFace?.[face] !== false;
      if (range) { range.value = String(value); range.disabled = !enabled; }
      input.disabled = !enabled;
      input.closest(".calibration-box-face")?.setAttribute("data-enabled", String(enabled));
    });
    controls.faceEnabled.forEach((input) => {
      input.checked = config.cutEnabledByFace?.[input.dataset.cutawayFaceEnabled] !== false;
    });

    const outlineState = currentOutline(config);
    const outlineAvailable = !!outlineState;
    byId("calibrationOutlineDisclosure").hidden = !outlineAvailable;
    if (outlineAvailable) {
      const { root: outline, levels, level } = outlineState;
      controls.level.replaceChildren(...levels.map((item, index) => option(index, item.label || `Floor ${index + 1}`)));
      controls.level.value = String(selectedLevel);
      selectedEdge = Math.max(0, Math.min(selectedEdge, level.edges.length - 1));
      controls.edge.replaceChildren(...level.edges.map((edge, index) => option(index, edge.label || `Edge ${index + 1}`)));
      controls.edge.value = String(selectedEdge);
      const edge = level.edges[selectedEdge];
      controls.edgeEnabled.checked = edge.enabled !== false;
      controls.edgeActivation.value = edge.cameraActivation || "face";
      controls.globalDepthEnabled.checked = level.edgeDepth?.useGlobal === true;
      setValue(controls.globalDepth, level.edgeDepth?.global ?? 0.25);
      controls.edgeDepthMode.value = edge.depthMode || "custom";
      setValue(controls.edgeDepth, edge.cutDepth ?? 0.25);
      setValue(controls.edgeSlope, edge.depthSlope ?? 0);
      controls.paddingMode.value = outline.padding?.mode || "auto";
      setValue(controls.paddingDistance, outline.padding?.mode === "manual" ? outline.padding.distance : outline.padding?.autoDistance ?? 0.18);
      controls.cleanupMode.value = outline.cleanup?.mode || "auto";
      setValue(controls.cleanupMargin, outline.cleanup?.mode === "manual" ? outline.cleanup.margin : outline.cleanup?.autoMargin ?? 0.12);
      setValue(controls.cleanupStrength, outline.cleanup?.strength ?? 1);
      controls.edgePaddingMode.value = edge.paddingMode || "inherit";
      setValue(controls.edgePaddingDistance, edge.paddingDistance ?? 0.18);
      controls.edgeCleanupMode.value = edge.cleanupMode || "inherit";
      setValue(controls.edgeCleanupMargin, edge.cleanupMargin ?? 0.12);
      setValue(controls.floor, level.floorY);
      setValue(controls.ceiling, level.ceilingY);
      setValue(controls.fade, outline.fadeWidth);
      setValue(controls.topDepth, outline.topCutDepth);
      setValue(controls.bottomDepth, outline.bottomCutDepth);
      setValue(controls.smoothing, outline.cameraMotionSmoothing, 2);
      setValue(controls.acceleration, outline.cameraMotionAcceleration, 2);
      populateTransformInputs("outline", outline.transform);
      controls.remove.disabled = level.vertices.length <= 3;
      controls.split.disabled = levels.reduce((total, item) => total + item.vertices.length, 0) >= MAX_CUTAWAY_OUTLINE_VERTICES;
      renderMap(level);
    }

    const exclusions = normalizeSplatExclusionBoxes(config.exclusionBoxes);
    selectedExclusion = Math.max(0, Math.min(selectedExclusion, Math.max(0, exclusions.length - 1)));
    controls.exclusionSelect.replaceChildren(...exclusions.map((box, index) => option(index, box.label)));
    controls.exclusionSelect.value = exclusions.length ? String(selectedExclusion) : "";
    const exclusion = exclusions[selectedExclusion];
    controls.exclusionEnabled.disabled = !exclusion;
    controls.exclusionEnabled.checked = exclusion?.enabled === true;
    controls.exclusionFade.disabled = !exclusion;
    setValue(controls.exclusionFade, exclusion?.fadeWidth ?? 0.04);
    controls.exclusionDelete.disabled = !exclusion;
    controls.exclusionAdd.disabled = exclusions.length >= MAX_SPLAT_EXCLUSION_BOXES;
    populateTransformInputs("exclusion", exclusion);

    const patches = normalizeSplatPatches(config.splatPatches);
    selectedPatch = Math.max(0, Math.min(selectedPatch, Math.max(0, patches.length - 1)));
    controls.patchSelect.replaceChildren(...patches.map((patch, index) => option(index, patch.label)));
    controls.patchSelect.value = patches.length ? String(selectedPatch) : "";
    const patch = patches[selectedPatch];
    controls.patchMode.disabled = !patch;
    controls.patchMode.value = patch?.mode || "copy";
    controls.patchFade.disabled = !patch;
    setValue(controls.patchFade, patch?.fadeWidth ?? 0.04);
    controls.patchDelete.disabled = !patch;
    controls.patchAdd.disabled = patches.length >= MAX_SPLAT_PATCHES;
    populateTransformInputs("patch-source", patch?.source);
    populateTransformInputs("patch-target", patch?.target);
    syncing = false;
  }

  controls.modeButtons.forEach((button) => button.addEventListener("click", () => commit((config) => { config.cutawayMode = button.dataset.cutawayMode; }, "Cutaway mode updated")));
  controls.level.addEventListener("change", () => { selectedLevel = Number(controls.level.value) || 0; selectedEdge = 0; refresh(); });
  controls.edge.addEventListener("change", () => { selectedEdge = Number(controls.edge.value) || 0; refresh(); });
  controls.map.addEventListener("pointermove", (event) => {
    if (!drag || !projection) return;
    event.preventDefault();
    event.stopPropagation();
    const point = toModel(event);
    mutateOutline((level) => {
      if (drag.type === "vertex") level.vertices[drag.index] = point;
      else {
        const dx = point[0] - drag.start[0];
        const dz = point[1] - drag.start[1];
        const a = selectedEdge;
        const b = (selectedEdge + 1) % level.vertices.length;
        level.vertices[a] = [drag.vertices[a][0] + dx, drag.vertices[a][1] + dz];
        level.vertices[b] = [drag.vertices[b][0] + dx, drag.vertices[b][1] + dz];
      }
    }, "Outline reshaped", { refreshUi: false, announce: false });
    const latest = currentOutline();
    if (latest?.level) renderMap(latest.level, { preserveProjection: true });
  });
  const finishDrag = (event) => {
    if (!drag) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (event?.pointerId !== undefined && controls.map.hasPointerCapture?.(event.pointerId)) {
      controls.map.releasePointerCapture?.(event.pointerId);
    }
    drag = null;
    refresh();
    setStatus?.("Outline reshaped", "The current scene preview was updated. Press Save to keep it in this browser.");
  };
  controls.map.addEventListener("pointerup", finishDrag);
  controls.map.addEventListener("pointercancel", finishDrag);
  controls.split.addEventListener("click", () => mutateOutline((level) => {
    const config = getConfig();
    const vertexCount = getCutawayOutlineLevels(config?.outline)
      .reduce((total, item) => total + item.vertices.length, 0);
    if (vertexCount >= MAX_CUTAWAY_OUTLINE_VERTICES) return;
    const a = level.vertices[selectedEdge];
    const b = level.vertices[(selectedEdge + 1) % level.vertices.length];
    level.vertices.splice(selectedEdge + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
    level.edges.splice(selectedEdge + 1, 0, { ...level.edges[selectedEdge] });
    level.edges.forEach((edge, index) => {
      edge.id = `edge-${index + 1}`;
      edge.label = `Edge ${index + 1}`;
    });
    selectedEdge += 1;
  }, "Outline edge split"));
  controls.remove.addEventListener("click", () => mutateOutline((level) => {
    if (level.vertices.length <= 3) return;
    level.vertices.splice(selectedEdge, 1);
    level.edges.splice(selectedEdge, 1);
    level.edges.forEach((edge, index) => {
      edge.id = `edge-${index + 1}`;
      edge.label = `Edge ${index + 1}`;
    });
    selectedEdge = Math.max(0, selectedEdge - 1);
  }, "Outline point deleted"));
  controls.restore.addEventListener("click", () => commit((config) => {
    const source = getSourceConfig()?.outline;
    if (source) { config.outline = cloneCutawayOutline(source); config.cutawayMode = "outline"; }
  }, "Automatic outline restored"));
  controls.resetTransform.addEventListener("click", () => mutateOutline((_level, outline) => {
    outline.transform = {
      position: [0, 0, 0],
      rotationDegrees: [0, 0, 0],
      scale: [1, 1, 1],
    };
  }, "Outline placement reset"));

  const edgeBinding = [
    [controls.edgeEnabled, "change", (edge) => { edge.enabled = controls.edgeEnabled.checked; }],
    [controls.edgeActivation, "change", (edge) => { edge.cameraActivation = controls.edgeActivation.value; }],
    [controls.edgeDepthMode, "change", (edge) => { edge.depthMode = controls.edgeDepthMode.value; }],
    [controls.edgeDepth, "change", (edge) => { edge.cutDepth = Math.max(0, finite(controls.edgeDepth.value)); }],
    [controls.edgeSlope, "change", (edge) => { edge.depthSlope = finite(controls.edgeSlope.value); }],
    [controls.edgePaddingMode, "change", (edge) => { edge.paddingMode = controls.edgePaddingMode.value; }],
    [controls.edgePaddingDistance, "change", (edge) => { edge.paddingDistance = Math.max(0, finite(controls.edgePaddingDistance.value)); }],
    [controls.edgeCleanupMode, "change", (edge) => { edge.cleanupMode = controls.edgeCleanupMode.value; }],
    [controls.edgeCleanupMargin, "change", (edge) => { edge.cleanupMargin = Math.max(0.001, finite(controls.edgeCleanupMargin.value)); }],
  ];
  edgeBinding.forEach(([element, event, mutate]) => element.addEventListener(event, () => !syncing && mutateOutline((level) => mutate(level.edges[selectedEdge]), "Outline edge updated")));

  const outlineBinding = [
    [controls.globalDepthEnabled, (level) => { level.edgeDepth.useGlobal = controls.globalDepthEnabled.checked; }],
    [controls.globalDepth, (level) => { level.edgeDepth.global = Math.max(0, finite(controls.globalDepth.value)); }],
    [controls.paddingMode, (_level, outline) => { outline.padding.mode = controls.paddingMode.value; }],
    [controls.paddingDistance, (_level, outline) => { outline.padding.distance = Math.max(0, finite(controls.paddingDistance.value)); }],
    [controls.cleanupMode, (_level, outline) => { outline.cleanup.mode = controls.cleanupMode.value; }],
    [controls.cleanupMargin, (_level, outline) => { outline.cleanup.margin = Math.max(0.001, finite(controls.cleanupMargin.value)); }],
    [controls.cleanupStrength, (_level, outline) => { outline.cleanup.strength = Math.max(0, Math.min(1, finite(controls.cleanupStrength.value))); }],
    [controls.floor, (level) => { level.floorY = finite(controls.floor.value); }],
    [controls.ceiling, (level) => { level.ceilingY = finite(controls.ceiling.value); }],
    [controls.fade, (_level, outline) => { outline.fadeWidth = Math.max(0.001, finite(controls.fade.value)); }],
    [controls.topDepth, (_level, outline) => { outline.topCutDepth = Math.max(0, finite(controls.topDepth.value)); }],
    [controls.bottomDepth, (_level, outline) => { outline.bottomCutDepth = Math.max(0, finite(controls.bottomDepth.value)); }],
    [controls.smoothing, (_level, outline) => { outline.cameraMotionSmoothing = Math.max(0, finite(controls.smoothing.value)); }],
    [controls.acceleration, (_level, outline) => { outline.cameraMotionAcceleration = Math.max(0.1, finite(controls.acceleration.value)); }],
  ];
  outlineBinding.forEach(([element, mutate]) => element.addEventListener("change", () => !syncing && mutateOutline(mutate, "Auto outline updated")));
  const updateBoxFaceDepth = (face, rawValue, { refreshUi = true, announce = true } = {}) => {
    if (syncing) return;
    const value = Math.max(0.01, Math.min(0.95, finite(rawValue, 0.2)));
    commit((config) => {
      config.cutDepthByFace = { ...(config.cutDepthByFace || {}), [face]: value };
      config.cutDepthLockedByFace = { ...(config.cutDepthLockedByFace || {}), [face]: true };
      config.cutawayMode = "box";
    }, "Box cutaway updated", { refreshUi, announce });
  };
  controls.faceRanges.forEach((range) => range.addEventListener("input", () => {
    const face = range.dataset.cutawayFaceRange;
    const number = controls.faceInputs.find((item) => item.dataset.cutawayFace === face);
    if (number) number.value = Number(range.value).toFixed(3);
    updateBoxFaceDepth(face, range.value, { refreshUi: false, announce: false });
  }));
  controls.faceInputs.forEach((input) => input.addEventListener("change", () => {
    const face = input.dataset.cutawayFace;
    updateBoxFaceDepth(face, input.value);
  }));
  controls.faceEnabled.forEach((input) => input.addEventListener("change", () => !syncing && commit((config) => {
    const face = input.dataset.cutawayFaceEnabled;
    config.cutEnabledByFace = { ...(config.cutEnabledByFace || {}), [face]: input.checked };
    config.cutawayMode = "box";
  }, input.checked ? "Box face enabled" : "Box face disabled")));

  controls.exclusionSelect.addEventListener("change", () => { selectedExclusion = Number(controls.exclusionSelect.value) || 0; refresh(); });
  controls.exclusionAdd.addEventListener("click", () => commit((config) => {
    const boxes = normalizeSplatExclusionBoxes(config.exclusionBoxes);
    boxes.push({ id: `exclusion-${Date.now()}`, label: `Hide box ${boxes.length + 1}`, enabled: true, position: [0, 0, 0], rotationDegrees: [0, 0, 0], scale: [1, 1, 1], fadeWidth: 0.04 });
    config.exclusionBoxes = boxes;
    selectedExclusion = boxes.length - 1;
  }, "Hide box added"));
  controls.exclusionDelete.addEventListener("click", () => commit((config) => { const boxes = normalizeSplatExclusionBoxes(config.exclusionBoxes); boxes.splice(selectedExclusion, 1); config.exclusionBoxes = boxes; selectedExclusion = Math.max(0, selectedExclusion - 1); }, "Hide box deleted"));
  controls.exclusionEnabled.addEventListener("change", () => commit((config) => { const boxes = normalizeSplatExclusionBoxes(config.exclusionBoxes); if (boxes[selectedExclusion]) boxes[selectedExclusion].enabled = controls.exclusionEnabled.checked; config.exclusionBoxes = boxes; }, "Hide box updated"));
  controls.exclusionFade.addEventListener("change", () => commit((config) => { const boxes = normalizeSplatExclusionBoxes(config.exclusionBoxes); if (boxes[selectedExclusion]) boxes[selectedExclusion].fadeWidth = Math.max(0.001, finite(controls.exclusionFade.value)); config.exclusionBoxes = boxes; }, "Hide box updated"));

  controls.patchSelect.addEventListener("change", () => { selectedPatch = Number(controls.patchSelect.value) || 0; refresh(); });
  controls.patchAdd.addEventListener("click", () => commit((config) => {
    const patches = normalizeSplatPatches(config.splatPatches);
    patches.push({ id: `splat-patch-${Date.now()}`, label: `Splat patch ${patches.length + 1}`, mode: "copy", source: { position: [0, 0, 0], rotationDegrees: [0, 0, 0], scale: [1, 1, 1] }, target: { position: [1, 0, 0], rotationDegrees: [0, 0, 0], scale: [1, 1, 1] }, fadeWidth: 0.04 });
    config.splatPatches = patches;
    selectedPatch = patches.length - 1;
  }, "Splat patch added"));
  controls.patchDelete.addEventListener("click", () => commit((config) => { const patches = normalizeSplatPatches(config.splatPatches); patches.splice(selectedPatch, 1); config.splatPatches = patches; selectedPatch = Math.max(0, selectedPatch - 1); }, "Splat patch deleted"));
  controls.patchMode.addEventListener("change", () => commit((config) => { const patches = normalizeSplatPatches(config.splatPatches); if (patches[selectedPatch]) patches[selectedPatch].mode = controls.patchMode.value; config.splatPatches = patches; }, "Splat patch updated"));
  controls.patchFade.addEventListener("change", () => commit((config) => { const patches = normalizeSplatPatches(config.splatPatches); if (patches[selectedPatch]) patches[selectedPatch].fadeWidth = Math.max(0.001, finite(controls.patchFade.value)); config.splatPatches = patches; }, "Splat patch updated"));

  controls.transformInputs.forEach((input) => input.addEventListener("change", () => {
    if (syncing) return;
    const kind = input.dataset.editorTransform;
    const field = input.dataset.transformField;
    const axis = Number(input.dataset.axis);
    if (kind === "outline") {
      mutateOutline((_level, outline) => {
        outline.transform ||= {
          position: [0, 0, 0],
          rotationDegrees: [0, 0, 0],
          scale: [1, 1, 1],
        };
        outline.transform[field][axis] = field === "scale"
          ? Math.max(0.001, finite(input.value, 1))
          : finite(input.value);
      }, "Outline placement updated");
      return;
    }
    commit((config) => {
      if (kind === "exclusion") {
        const boxes = normalizeSplatExclusionBoxes(config.exclusionBoxes);
        if (boxes[selectedExclusion]) boxes[selectedExclusion][field][axis] = finite(input.value, field === "scale" ? 1 : 0);
        config.exclusionBoxes = boxes;
      } else {
        const patches = normalizeSplatPatches(config.splatPatches);
        const target = kind === "patch-source" ? patches[selectedPatch]?.source : patches[selectedPatch]?.target;
        if (target) target[field][axis] = finite(input.value, field === "scale" ? 1 : 0);
        config.splatPatches = patches;
      }
    }, kind === "exclusion" ? "Hide box transformed" : "Splat patch transformed");
  }));

  controls.importApply.addEventListener("click", () => {
    try {
      const parsed = JSON.parse(controls.importText.value);
      const config = parsed.manualBox || parsed;
      if (!config || typeof config !== "object") throw new Error("The JSON does not contain a manualBox configuration.");
      applyConfig(config);
      controls.importMessage.textContent = "Applied. Press Save to keep it in this browser.";
      controls.importMessage.dataset.error = "false";
      refresh();
    } catch (error) {
      controls.importMessage.textContent = error.message || "Invalid calibration JSON.";
      controls.importMessage.dataset.error = "true";
    }
  });

  return {
    refresh,
    setVisible(visible) { root.hidden = !visible; if (visible) refresh(); },
  };
}

export { createCutawayEditor, getEditableOutlineLevels };

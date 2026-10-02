const MAX_CUTAWAY_OUTLINE_VERTICES = 24;
const MAX_SPLAT_EXCLUSION_BOXES = 4;
const MAX_SPLAT_PATCHES = 2;

function finiteNumber(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function polygonArea(vertices) {
  return vertices.reduce((sum, vertex, index) => {
    const next = vertices[(index + 1) % vertices.length];
    return sum + vertex[0] * next[1] - next[0] * vertex[1];
  }, 0) * 0.5;
}

function normalizeTransformBox(config) {
  if (!config) return null;
  const normalized = {
    position: [0, 1, 2].map((index) => finiteNumber(config.position?.[index], 0)),
    rotationDegrees: [0, 1, 2].map((index) => finiteNumber(config.rotationDegrees?.[index], 0)),
    scale: [0, 1, 2].map((index) => Math.max(0.001, finiteNumber(config.scale?.[index], 1))),
  };
  return normalized;
}

function normalizeSplatExclusionBoxes(config) {
  if (!Array.isArray(config)) return [];
  return config.slice(0, MAX_SPLAT_EXCLUSION_BOXES).map((box, index) => ({
    id: String(box?.id || `exclusion-${index + 1}`),
    label: String(box?.label || `Hide box ${index + 1}`),
    enabled: box?.enabled !== false,
    position: [0, 1, 2].map((axis) => finiteNumber(box?.position?.[axis], 0)),
    rotationDegrees: [0, 1, 2].map((axis) => finiteNumber(box?.rotationDegrees?.[axis], 0)),
    scale: [0, 1, 2].map((axis) => Math.max(0.001, finiteNumber(box?.scale?.[axis], 1))),
    fadeWidth: Math.max(0.001, finiteNumber(box?.fadeWidth, 0.04)),
  }));
}

function normalizeSplatPatches(config) {
  if (!Array.isArray(config)) return [];
  return config.slice(0, MAX_SPLAT_PATCHES).map((patch, index) => {
    const source = normalizeTransformBox(patch?.source) || {
      position: [0, 0, 0], rotationDegrees: [0, 0, 0], scale: [1, 1, 1],
    };
    const target = normalizeTransformBox(patch?.target) || {
      position: [...source.position],
      rotationDegrees: [...source.rotationDegrees],
      scale: [...source.scale],
    };
    return {
      id: String(patch?.id || `splat-patch-${index + 1}`),
      label: String(patch?.label || `Splat patch ${index + 1}`),
      mode: ["off", "copy", "move"].includes(patch?.mode) ? patch.mode : "copy",
      source,
      target,
      fadeWidth: Math.max(0.001, finiteNumber(patch?.fadeWidth, 0.04)),
    };
  });
}

function normalizeOutlineRegistration(config) {
  const sourceBox = normalizeTransformBox(config?.sourceBox);
  const targetBox = normalizeTransformBox(config?.targetBox);
  if (!sourceBox || !targetBox) return null;
  return { sourceBox, targetBox };
}

function resolveOutlineEdgePadding(outline, edgeIndex) {
  const padding = outline?.padding || {};
  const edge = outline?.edges?.[edgeIndex] || {};
  if (edge.paddingMode === "custom") return Math.max(0, finiteNumber(edge.paddingDistance, 0));
  if (edge.paddingMode === "off") return 0;
  if (padding.mode === "off") return 0;
  return Math.max(0, finiteNumber(
    padding.mode === "manual" ? padding.distance : padding.autoDistance,
    0
  ));
}

function lineIntersection(startA, endA, startB, endB) {
  const directionA = [endA[0] - startA[0], endA[1] - startA[1]];
  const directionB = [endB[0] - startB[0], endB[1] - startB[1]];
  const denominator = directionA[0] * directionB[1] - directionA[1] * directionB[0];
  if (Math.abs(denominator) < 1e-7) return null;
  const delta = [startB[0] - startA[0], startB[1] - startA[1]];
  const t = (delta[0] * directionB[1] - delta[1] * directionB[0]) / denominator;
  return [startA[0] + directionA[0] * t, startA[1] + directionA[1] * t];
}

function buildPaddedOutlineVertices(config) {
  const outline = normalizeCutawayOutline(config);
  if (!outline) return [];
  const count = outline.vertices.length;
  const offsetEdges = outline.vertices.map((start, index) => {
    const end = outline.vertices[(index + 1) % count];
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz) || 1;
    const distance = resolveOutlineEdgePadding(outline, index);
    const outward = [dz / length, -dx / length];
    return {
      start: [start[0] + outward[0] * distance, start[1] + outward[1] * distance],
      end: [end[0] + outward[0] * distance, end[1] + outward[1] * distance],
      outward,
      distance,
    };
  });

  return outline.vertices.map((vertex, index) => {
    const previous = offsetEdges[(index - 1 + count) % count];
    const current = offsetEdges[index];
    const intersection = lineIntersection(previous.start, previous.end, current.start, current.end);
    if (!intersection) {
      return [
        vertex[0] + (previous.outward[0] * previous.distance + current.outward[0] * current.distance) * 0.5,
        vertex[1] + (previous.outward[1] * previous.distance + current.outward[1] * current.distance) * 0.5,
      ];
    }
    const maximumMiter = Math.max(0.25, previous.distance, current.distance) * 8;
    const miterDistance = Math.hypot(intersection[0] - vertex[0], intersection[1] - vertex[1]);
    if (miterDistance <= maximumMiter) return intersection;
    const ratio = maximumMiter / miterDistance;
    return [
      vertex[0] + (intersection[0] - vertex[0]) * ratio,
      vertex[1] + (intersection[1] - vertex[1]) * ratio,
    ];
  });
}

function normalizeCutawayOutline(config) {
  if (!config?.vertices || !Array.isArray(config.vertices)) return null;
  let vertices = config.vertices
    .slice(0, MAX_CUTAWAY_OUTLINE_VERTICES)
    .map((vertex) => [finiteNumber(vertex?.[0], 0), finiteNumber(vertex?.[1], 0)]);
  if (vertices.length < 3) return null;
  if (polygonArea(vertices) < 0) vertices = vertices.reverse();
  const sourceEdges = Array.isArray(config.edges) ? config.edges : [];
  const edges = vertices.map((_, index) => {
    const source = sourceEdges[index] || {};
    const cleanupMode = ["inherit", "custom", "off"].includes(source.cleanupMode)
      ? source.cleanupMode
      : "inherit";
    const depthMode = ["inherit", "custom"].includes(source.depthMode)
      ? source.depthMode
      : config.edgeDepth?.useGlobal === true
        ? "inherit"
        : "custom";
    return {
      id: String(source.id || `edge-${index + 1}`),
      label: String(source.label || `Edge ${index + 1}`),
      enabled: source.enabled !== false,
      cutDepth: Math.max(0, finiteNumber(source.cutDepth, 0.25)),
      depthSlope: finiteNumber(source.depthSlope, 0),
      depthMode,
      cleanupMode,
      cleanupMargin: Math.max(0, finiteNumber(source.cleanupMargin, 0.12)),
      paddingMode: ["inherit", "custom", "off"].includes(source.paddingMode) ? source.paddingMode : "inherit",
      paddingDistance: Math.max(0, finiteNumber(source.paddingDistance, 0.18)),
      cameraActivation: ["face", "previous", "next", "neighbors", "always"].includes(source.cameraActivation)
        ? source.cameraActivation
        : "face",
    };
  });
  const floorY = finiteNumber(config.floorY, -1);
  const ceilingY = Math.max(floorY + 0.001, finiteNumber(config.ceilingY, 1));
  const fadeWidth = Math.max(0.001, finiteNumber(config.fadeWidth, 0.12));
  const cameraMotionSmoothing = Math.max(0, Math.min(5, finiteNumber(config.cameraMotionSmoothing, 0.18)));
  const cameraMotionAcceleration = Math.max(0.1, Math.min(8, finiteNumber(config.cameraMotionAcceleration, 1)));
  const cleanupMode = ["auto", "manual", "off"].includes(config.cleanup?.mode)
    ? config.cleanup.mode
    : "auto";
  const autoCleanupMargin = Math.max(0.001, finiteNumber(config.cleanup?.autoMargin, fadeWidth));
  const normalized = {
    version: 1,
    mode: "outline",
    vertices,
    edges,
    floorY,
    ceilingY,
    fadeWidth,
    cameraMotionSmoothing,
    cameraMotionAcceleration,
    topCutDepth: Math.max(0, finiteNumber(config.topCutDepth, 0.25)),
    bottomCutDepth: Math.max(0, finiteNumber(config.bottomCutDepth, 0.08)),
    edgeDepth: {
      useGlobal: config.edgeDepth?.useGlobal === true,
      global: Math.max(0, finiteNumber(config.edgeDepth?.global, 0.25)),
    },
    padding: {
      mode: ["auto", "manual", "off"].includes(config.padding?.mode) ? config.padding.mode : "auto",
      autoDistance: Math.max(0, finiteNumber(config.padding?.autoDistance, 0.18)),
      distance: Math.max(0, finiteNumber(config.padding?.distance, config.padding?.autoDistance ?? 0.18)),
    },
    cleanup: {
      mode: cleanupMode,
      autoMargin: autoCleanupMargin,
      margin: Math.max(0.001, finiteNumber(config.cleanup?.margin, autoCleanupMargin)),
      strength: Math.max(0, Math.min(1, finiteNumber(config.cleanup?.strength, 1))),
    },
    registration: normalizeOutlineRegistration(config.registration),
    source: config.source ? structuredClone(config.source) : undefined,
  };
  if (Array.isArray(config.levels) && config.levels.length > 1) {
    normalized.levels = config.levels
      .slice(0, 4)
      .map((level, index) => {
        const normalizedLevel = normalizeCutawayOutline({
          ...config,
          ...level,
          levels: undefined,
          registration: undefined,
          source: undefined,
        });
        if (!normalizedLevel) return null;
        return {
          ...normalizedLevel,
          id: String(level.id || `level-${index + 1}`),
          label: String(level.label || `Level ${index + 1}`),
        };
      })
      .filter(Boolean);
  }
  return normalized;
}

function cloneCutawayOutline(config) {
  const normalized = normalizeCutawayOutline(config);
  if (!normalized) return null;
  return {
    ...normalized,
    vertices: normalized.vertices.map((vertex) => [...vertex]),
    edges: normalized.edges.map((edge) => ({ ...edge })),
    edgeDepth: { ...normalized.edgeDepth },
    padding: { ...normalized.padding },
    cleanup: { ...normalized.cleanup },
    levels: normalized.levels?.map((level) => ({
      ...cloneCutawayOutline(level),
      id: level.id,
      label: level.label,
    })),
    registration: normalized.registration ? structuredClone(normalized.registration) : null,
    source: normalized.source ? structuredClone(normalized.source) : undefined,
  };
}

function getCutawayOutlineLevels(config) {
  const normalized = normalizeCutawayOutline(config);
  if (!normalized) return [];
  return normalized.levels?.length > 1 ? normalized.levels : [normalized];
}

function cloneSurfaceCullingConfig(config) {
  if (!config) return { enabled: false, threshold: 0, fadeWidth: 0.35, strength: 0.75 };
  return {
    enabled: config.enabled === true,
    threshold: Math.max(-1, Math.min(1, finiteNumber(config.threshold, 0))),
    fadeWidth: Math.max(0.01, Math.min(1, finiteNumber(config.fadeWidth, 0.35))),
    strength: Math.max(0, Math.min(1, finiteNumber(config.strength, 0.75))),
  };
}

export {
  MAX_CUTAWAY_OUTLINE_VERTICES,
  MAX_SPLAT_EXCLUSION_BOXES,
  MAX_SPLAT_PATCHES,
  buildPaddedOutlineVertices,
  cloneCutawayOutline,
  cloneSurfaceCullingConfig,
  getCutawayOutlineLevels,
  normalizeCutawayOutline,
  normalizeSplatExclusionBoxes,
  normalizeSplatPatches,
  polygonArea,
  resolveOutlineEdgePadding,
};

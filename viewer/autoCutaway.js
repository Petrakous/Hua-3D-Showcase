import * as THREE from "three";
const MAX_ACTIVE_FACES = 3;
const CUTAWAY_EDGE_FADE_START = 0.45;
const CUTAWAY_EDGE_FADE_END = 0.51;
const FACE_SHARE_BLEND_START = 0.18;
const FACE_SHARE_BLEND_END = 0.34;

function clampScale(scale = [1, 1, 1]) {
  return [
    Math.max(scale[0] || 0, 0.001),
    Math.max(scale[1] || 0, 0.001),
    Math.max(scale[2] || 0, 0.001),
  ];
}

function getQuaternionFromRotationDegrees(rotationDegrees = [0, 0, 0]) {
  const euler = new THREE.Euler(
    THREE.MathUtils.degToRad(rotationDegrees[0] || 0),
    THREE.MathUtils.degToRad(rotationDegrees[1] || 0),
    THREE.MathUtils.degToRad(rotationDegrees[2] || 0),
    "XYZ"
  );
  return new THREE.Quaternion().setFromEuler(euler);
}

function createFaceCandidate(axis, signedComponent) {
  const sign = signedComponent >= 0 ? 1 : -1;
  const faceAxis = `${sign >= 0 ? "+" : "-"}${axis}`;
  const faceKey = faceAxis === "-x"
    ? "left"
    : faceAxis === "+x"
      ? "right"
      : faceAxis === "-y"
        ? "front"
        : faceAxis === "+y"
          ? "back"
          : faceAxis === "+z"
            ? "top"
            : "bottom";

  return {
    axis,
    sign,
    faceAxis,
    faceKey,
    strength: Math.abs(signedComponent),
  };
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) {
    return value >= edge1 ? 1 : 0;
  }

  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function selectActiveFaces(cameraPositionInBoxSpace) {
  const candidates = [
    createFaceCandidate("x", cameraPositionInBoxSpace.x),
    createFaceCandidate("y", cameraPositionInBoxSpace.y),
    createFaceCandidate("z", cameraPositionInBoxSpace.z),
  ];
  const totalStrength = Math.max(
    candidates.reduce((sum, candidate) => sum + candidate.strength, 0),
    0.0001
  );

  const weightedFaces = candidates
    .map((candidate) => {
      const share = candidate.strength / totalStrength;
      const presence = smoothstep(
        CUTAWAY_EDGE_FADE_START,
        CUTAWAY_EDGE_FADE_END,
        candidate.strength
      );
      const weight = presence * smoothstep(FACE_SHARE_BLEND_START, FACE_SHARE_BLEND_END, share);
      return {
        ...candidate,
        share,
        weight,
      };
    })
    .filter((candidate) => candidate.weight > 0.0001)
    .sort((a, b) => b.weight - a.weight);

  if (weightedFaces.length) {
    return weightedFaces.slice(0, MAX_ACTIVE_FACES);
  }

  const dominantCandidate = [...candidates].sort((a, b) => b.strength - a.strength)[0];
  return [{ ...dominantCandidate, share: 1, weight: 1 }];
}

function clampCutRatio(value, fallback) {
  return Math.min(Math.max(value ?? fallback, 0.01), 0.95);
}

function buildFaceBounds(activeFaces, faceCutRatioResolver, defaultCutRatio) {
  const bounds = {
    x: { min: -0.5, max: 0.5 },
    y: { min: -0.5, max: 0.5 },
    z: { min: -0.5, max: 0.5 },
  };

  for (const face of activeFaces) {
    const baseCutRatio = clampCutRatio(faceCutRatioResolver(face.faceKey), defaultCutRatio);
    const effectiveCutRatio = Math.min(Math.max(baseCutRatio * (face.weight ?? 1), 0), 0.95);

    if (effectiveCutRatio <= 0.0001) {
      continue;
    }

    if (face.sign > 0) {
      bounds[face.axis].max = Math.max(bounds[face.axis].min + 0.001, 0.5 - effectiveCutRatio);
    } else {
      bounds[face.axis].min = Math.min(bounds[face.axis].max - 0.001, -0.5 + effectiveCutRatio);
    }
  }

  return bounds;
}

function insetManualBox(baseConfig, activeFaces, defaultCutRatio) {
  const scale = clampScale(baseConfig.scale);
  const rotationDegrees = [...(baseConfig.rotationDegrees || [0, 0, 0])];
  const position = new THREE.Vector3(...(baseConfig.position || [0, 0, 0]));
  const rotation = getQuaternionFromRotationDegrees(rotationDegrees);
  const bounds = buildFaceBounds(
    activeFaces,
    (faceKey) => baseConfig?.cutDepthByFace?.[faceKey],
    defaultCutRatio
  );

  const newScale = [
    Math.max(scale[0] * (bounds.x.max - bounds.x.min), 0.001),
    Math.max(scale[1] * (bounds.y.max - bounds.y.min), 0.001),
    Math.max(scale[2] * (bounds.z.max - bounds.z.min), 0.001),
  ];

  const localShift = new THREE.Vector3(
    ((bounds.x.min + bounds.x.max) * 0.5) * scale[0],
    ((bounds.y.min + bounds.y.max) * 0.5) * scale[1],
    ((bounds.z.min + bounds.z.max) * 0.5) * scale[2]
  );
  const worldShift = localShift.applyQuaternion(rotation);
  position.add(worldShift);

  return {
    position: [position.x, position.y, position.z],
    rotationDegrees,
    scale: newScale,
  };
}

function createClipBoxCutaway(modelConfig, cameraPosition, sceneBounds) {
  const baseClipBox = modelConfig?.clipBox;
  if (!baseClipBox || !cameraPosition || !sceneBounds?.center || !sceneBounds?.size) {
    return {
      mode: "full",
      clipBox: baseClipBox,
    };
  }

  const halfSize = {
    x: Math.max((sceneBounds.size.x || 0) * 0.5, 0.001),
    y: Math.max((sceneBounds.size.y || 0) * 0.5, 0.001),
    z: Math.max((sceneBounds.size.z || 0) * 0.5, 0.001),
  };
  const normalizedCameraPosition = {
    x: (cameraPosition.x - sceneBounds.center.x) / halfSize.x,
    y: (cameraPosition.y - sceneBounds.center.y) / halfSize.y,
    z: (cameraPosition.z - sceneBounds.center.z) / halfSize.z,
  };
  const activeFaces = selectActiveFaces(normalizedCameraPosition);
  const bounds = buildFaceBounds(
    activeFaces,
    () => modelConfig?.autoCutaway?.clipRatio,
    modelConfig?.autoCutaway?.clipRatio ?? 0.2
  );
  const clipBox = {
    minX: baseClipBox.minX + (baseClipBox.maxX - baseClipBox.minX) * (bounds.x.min + 0.5),
    maxX: baseClipBox.minX + (baseClipBox.maxX - baseClipBox.minX) * (bounds.x.max + 0.5),
    minY: baseClipBox.minY + (baseClipBox.maxY - baseClipBox.minY) * (bounds.y.min + 0.5),
    maxY: baseClipBox.minY + (baseClipBox.maxY - baseClipBox.minY) * (bounds.y.max + 0.5),
    minZ: baseClipBox.minZ + (baseClipBox.maxZ - baseClipBox.minZ) * (bounds.z.min + 0.5),
    maxZ: baseClipBox.minZ + (baseClipBox.maxZ - baseClipBox.minZ) * (bounds.z.max + 0.5),
  };

  return {
    mode: `camera-side-${activeFaces.map((face) => face.faceAxis).join("-")}`,
    faceAxes: activeFaces.map((face) => face.faceAxis),
    faceKeys: activeFaces.map((face) => face.faceKey),
    faceWeights: activeFaces.map((face) => face.weight),
    clipBox,
  };
}

function computeAutoCutaway(boxConfig, cameraPositionInBoxSpace, cutRatio = 0.2) {
  if (boxConfig?.clipBox && typeof cutRatio !== "number") {
    return createClipBoxCutaway(boxConfig, cameraPositionInBoxSpace, cutRatio);
  }

  const activeFaces = selectActiveFaces(cameraPositionInBoxSpace);

  return {
    mode: `camera-side-${activeFaces.map((face) => face.faceAxis).join("-")}`,
    faceAxes: activeFaces.map((face) => face.faceAxis),
    faceKeys: activeFaces.map((face) => face.faceKey),
    faceWeights: activeFaces.map((face) => face.weight),
    boxConfig: insetManualBox(boxConfig, activeFaces, cutRatio),
  };
}

export { computeAutoCutaway };

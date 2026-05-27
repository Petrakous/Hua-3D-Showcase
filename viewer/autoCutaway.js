import * as THREE from "three";

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

function insetManualBox(baseConfig, axis, sign, cutRatio) {
  const scale = clampScale(baseConfig.scale);
  const rotationDegrees = [...(baseConfig.rotationDegrees || [0, 0, 0])];
  const position = new THREE.Vector3(...(baseConfig.position || [0, 0, 0]));
  const rotation = getQuaternionFromRotationDegrees(rotationDegrees);
  const newScale = [...scale];
  const axisIndex = axis === "x" ? 0 : axis === "y" ? 1 : 2;
  const removedDistance = scale[axisIndex] * cutRatio;

  newScale[axisIndex] = Math.max(scale[axisIndex] - removedDistance, 0.001);

  const localShift = new THREE.Vector3();
  localShift[axis] = sign > 0 ? -removedDistance * 0.5 : removedDistance * 0.5;
  position.add(localShift.applyQuaternion(rotation));

  return {
    position: [position.x, position.y, position.z],
    rotationDegrees,
    scale: newScale,
  };
}

function computeAutoCutaway(boxConfig, cameraPositionInBoxSpace, cutRatio = 0.2) {
  const normalized = cameraPositionInBoxSpace;
  const absNormalized = {
    x: Math.abs(normalized.x),
    y: Math.abs(normalized.y),
    z: Math.abs(normalized.z),
  };

  let dominantAxis = "z";
  let dominantValue = absNormalized.z;
  if (absNormalized.x > dominantValue) {
    dominantAxis = "x";
    dominantValue = absNormalized.x;
  }
  if (absNormalized.y > dominantValue) {
    dominantAxis = "y";
    dominantValue = absNormalized.y;
  }

  const dominantSign = normalized[dominantAxis] >= 0 ? 1 : -1;
  const faceAxis = `${dominantSign >= 0 ? "+" : "-"}${dominantAxis}`;
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
  const effectiveCutRatio = Math.min(
    Math.max(boxConfig?.cutDepthByFace?.[faceKey] ?? cutRatio, 0.05),
    0.95
  );

  return {
    mode: `camera-side-${faceAxis}`,
    faceAxis,
    boxConfig: insetManualBox(boxConfig, dominantAxis, dominantSign, effectiveCutRatio),
  };
}

export { computeAutoCutaway };

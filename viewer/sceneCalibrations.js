const SCENE_CALIBRATION_DEFAULTS = {
  streamedTransforms: {
    "indoors:classroom-5": {
      scene: {
        position: [0, 1.4, 0],
        rotationDegrees: [180, -2, 0],
        scale: [1, 1, 1],
      },
      collision: {
        position: [0, 1.4, 0],
        rotationDegrees: [0, 0, 0],
        scale: [1, 1, 1],
      },
      spawn: {
        position: [4.2, 1.6, -0.5],
        rotationDegrees: [0, 90, 0],
      },
      cameraStart: {
        position: [-10.251, 6.432, -10.286],
        rotationDegrees: [200, -44.8, 0],
        scale: [1, 1, 1],
      },
    },
    "indoors:main-hall": {
      scene: {
        position: [0, 0, 0],
        rotationDegrees: [180, 0, 0],
        scale: [1, 1, 1],
      },
      collision: {
        position: [0, 7.9, 0],
        rotationDegrees: [-77.1, -1.5000000000000002, -9.94264047414099e-17],
        scale: [1, 1, 1],
      },
      spawn: {
        position: [1, 7.5, 17.5],
        rotationDegrees: [0, 0, 0],
      },
    },
    "indoors:amphitheater": {
      scene: {
        position: [0, 0, 0],
        rotationDegrees: [180, 0, 0],
        scale: [1, 1, 1],
      },
      collision: {
        position: [0, 1.6, 0],
        rotationDegrees: [-180, -19.8, 180],
        scale: [1, 1, 1],
      },
      spawn: {
        position: [4.8, 2.8, -8.5],
        rotationDegrees: [3, 180, 0],
      },
    },
    "indoors:biology-lab": {
      scene: {
        position: [0, 0, 0],
        rotationDegrees: [180, 0, 0],
        scale: [1, 1, 1],
      },
      collision: {
        position: [0, 2.6, 0],
        rotationDegrees: [-97.00000000000001, 38.49999999999999, -0.800000000000005],
        scale: [1, 1, 1],
      },
      spawn: {
        position: [7, 3.8, 3],
        rotationDegrees: [0, 50, 0],
      },
    },
    "indoors:geo3-3": {
      scene: {
        position: [0, 0, 0],
        rotationDegrees: [180, 0, 0],
        scale: [1, 1, 1],
      },
      collision: {
        position: [-0.3, 2.2, 0],
        rotationDegrees: [-180, -39.3, 180],
        scale: [1, 1, 1],
      },
      spawn: {
        position: [-0.9, 2.2, -3.7],
        rotationDegrees: [0, 170.6, 0],
      },
    },
    "indoors:systasis": {
      scene: {
        position: [0, 0, 0],
        rotationDegrees: [180, 0, 0],
        scale: [1, 1, 1],
      },
      collision: {
        position: [0, 1.7, 0],
        rotationDegrees: [-2.8, 144.3, -1.3],
        scale: [1, 1, 1],
      },
      spawn: {
        position: [1.3, 2, -2.5],
        rotationDegrees: [0, 150, 0],
      },
    },
    "indoors:fitness": {
      scene: {
        position: [0, 0, 0],
        rotationDegrees: [180, 0, 0],
        scale: [1, 1, 1],
      },
      collision: {
        position: [0, 1.4, 0],
        rotationDegrees: [0, -46.9, 0],
        scale: [1, 1, 1],
      },
      spawn: {
        position: [-2.7, 1.6, 1.7],
        rotationDegrees: [0, -60.7, 0],
      },
    },
    "indoors:metabolism": {
      scene: {
        position: [0, 0, 0],
        rotationDegrees: [180, 0, 0],
        scale: [1, 1, 1],
      },
      collision: {
        position: [0, 0, 0],
        rotationDegrees: [0, 0, 0],
        scale: [1, 1, 1],
      },
      spawn: {
        position: [0, 0.5, 2.2],
        rotationDegrees: [0, 0, 0],
      },
      cameraStart: {
        position: [-7.152371406555176, 3.3036532402038574, -1.0008203983306885],
        rotationDegrees: [168.00000126640109, -78.8875566105402, 179.99999991298583],
        scale: [1, 1, 1],
      },
    },
    "indoors:kitchen": {
      scene: {
        position: [0, 0, 0],
        rotationDegrees: [180, 0, 0],
        scale: [1, 1, 1],
      },
      collision: {
        position: [0, 1.6, 0.1],
        rotationDegrees: [0, 135.8, 0],
        scale: [1, 1, 1],
      },
      spawn: {
        position: [0.5, 1.9, -3.2],
        rotationDegrees: [0, 180, 0],
      },
    },
  },
  manualBoxOverrides: {
    "indoors:classroom-5": {
      position: [0, -2.2, -0.3],
      rotationDegrees: [89.6, -0.1, -449.4],
      scale: [9.2, 9.8, 4.4],
      cutRatio: 0.23,
      cutDepthByFace: {
        left: 0.19,
        right: 0.23,
        front: 0.19,
        back: 0.2,
        top: 0.19,
        bottom: 0.23,
      },
      cutDepthLockedByFace: {
        left: true,
        right: true,
        front: true,
        back: true,
        top: true,
        bottom: true,
      },
    },
    "indoors:metabolism": {
      position: [0, -1.7, 0],
      rotationDegrees: [90, 0, 178.7],
      scale: [3.9, 5.7, 3.4],
      cutRatio: 0.23,
      cutDepthByFace: {
        left: 0.19,
        right: 0.17,
        front: 0.19,
        back: 0.27,
        top: 0.23,
        bottom: 0.23,
      },
      cutDepthLockedByFace: {
        left: true,
        right: true,
        front: true,
        back: true,
        top: true,
        bottom: true,
      },
    },
  },
};

function readCalibrationLocalStorageSnapshot() {
  const keys = [
    'hua:sog-streamed-transforms:v1',
    'hua:sog-calibration-overrides:v1',
    'hua:sog-calibration-ui-enabled',
  ];

  const snapshot = {};
  for (const key of keys) {
    snapshot[key] = window.localStorage.getItem(key);
  }

  return snapshot;
}

function installSceneCalibrationExportHelper() {
  if (typeof window === 'undefined') {
    return;
  }

  window.exportHuaSceneCalibrations = () => {
    const snapshot = readCalibrationLocalStorageSnapshot();
    console.log(JSON.stringify(snapshot, null, 2));
    return snapshot;
  };
}

export { SCENE_CALIBRATION_DEFAULTS, installSceneCalibrationExportHelper };

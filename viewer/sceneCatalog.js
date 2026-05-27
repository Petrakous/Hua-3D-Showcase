const DEFAULT_SPLAT_ROTATION = [0.70710678, 0, 0, 0.70710678];
const DEFAULT_SOG_ROTATION_DEGREES = [180, 0, 0];
const DEFAULT_CLIP_BOX = {
  minX: -8,
  maxX: 8,
  minY: -8,
  maxY: 8,
  minZ: -2,
  maxZ: 5,
};

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

const DEFAULT_SOG_ROTATION = degreesToQuaternion(DEFAULT_SOG_ROTATION_DEGREES);

function createGlbAsset(src, view = {}, extras = {}) {
  return {
    type: "glb",
    src,
    orientation: view.orientation || "0deg 0deg 0deg",
    cameraTarget: view.cameraTarget || "auto auto auto",
    cameraOrbit: view.cameraOrbit || "0deg 72deg auto",
    fieldOfView: view.fieldOfView || "30deg",
    minCameraOrbit: view.minCameraOrbit || "auto 10deg auto",
    maxCameraOrbit: view.maxCameraOrbit || "auto 88deg auto",
    ...extras,
  };
}

function createSplatAsset(src, options = {}) {
  const fileFormat = options.fileFormat || "ply";
  const runtime = options.runtime || (fileFormat === "sog" ? "playcanvas" : "gaussian-splats-3d");

  return {
    type: "splat",
    src,
    fileFormat,
    runtime,
    cameraUp: options.cameraUp || [0, 0, 1],
    position: options.position || [0, 0, 0],
    rotation: options.rotation || (
      options.rotationDegrees
        ? degreesToQuaternion(options.rotationDegrees)
        : fileFormat === "sog"
          ? DEFAULT_SOG_ROTATION
          : DEFAULT_SPLAT_ROTATION
    ),
    scale: options.scale || [1, 1, 1],
    manualBox: options.manualBox || null,
    initialCameraPosition: options.initialCameraPosition || [8, -8, 0],
    initialCameraLookAt: options.initialCameraLookAt || [0, 0, 1],
    clipBox: options.clipBox || DEFAULT_CLIP_BOX,
    viewPreset: options.viewPreset || null,
    autoRotate: options.autoRotate !== false,
    cutawayEnabled: options.cutawayEnabled !== false,
  };
}

function createSogAsset(src, options = {}) {
  return createSplatAsset(src, {
    ...options,
    fileFormat: "sog",
    runtime: "playcanvas",
  });
}

const OUTDOOR_VIEW = {
  orientation: "0deg 0deg 0deg",
  cameraTarget: "auto auto auto",
  cameraOrbit: "0deg 0deg auto",
  fieldOfView: "10deg",
  minCameraOrbit: "auto 55deg auto",
  maxCameraOrbit: "auto 85deg auto",
};

const INDOOR_VIEW = {
  orientation: "0deg 0deg 0deg",
  cameraTarget: "auto auto auto",
  cameraOrbit: "0deg 72deg auto",
  fieldOfView: "30deg",
  minCameraOrbit: "auto 10deg auto",
  maxCameraOrbit: "auto 88deg auto",
};

const DIT_VIEW = {
  orientation: "0deg 0deg 0deg",
  cameraTarget: "auto auto auto",
  cameraOrbit: "0deg 72deg auto",
  fieldOfView: "30deg",
  minCameraOrbit: "auto 35deg auto",
  maxCameraOrbit: "auto 88deg auto",
};

const LOCATION_LABELS = {
  outdoors: "OutdoorsM",
  indoors: "IndoorsM",
  dit: "DIT",
};

function createIndoorScene(id, label, glbSrc, splatSrc = null, manualBox = null, options = {}) {
  const sogOptions = options.sog || null;

  return {
    id,
    label,
    assets: {
      glb: createGlbAsset(glbSrc, INDOOR_VIEW),
      ...(splatSrc
        ? {
            splat: createSplatAsset(splatSrc, {
              rotationDegrees: [90, 20, 0],
              initialCameraPosition: [8, -8, 0],
              initialCameraLookAt: [0, 0, 1],
              manualBox,
            }),
          }
        : {}),
      ...(sogOptions?.src
        ? {
            sog: createSogAsset(sogOptions.src, {
              manualBox: sogOptions.manualBox || manualBox,
              rotationDegrees: sogOptions.rotationDegrees,
              viewPreset: sogOptions.viewPreset || null,
              cutawayEnabled: sogOptions.cutawayEnabled !== false,
            }),
          }
        : {}),
    },
  };
}

const LOCATION_CATALOG = {
  outdoors: {
    id: "outdoors",
    label: LOCATION_LABELS.outdoors,
    kind: "outdoor-cycle",
    stages: {
      day: {
        web: createGlbAsset("./HuaDayBest1_web.glb", OUTDOOR_VIEW),
        hd: createGlbAsset("./HuaDayBest1.glb", OUTDOOR_VIEW),
      },
      dusk: {
        web: createGlbAsset("./HuaMainDraco.glb", OUTDOOR_VIEW),
        hd: createGlbAsset("./NoonHDDraco.glb", OUTDOOR_VIEW),
      },
      night: {
        web: createGlbAsset("./HuaMainNightDraco.glb", OUTDOOR_VIEW),
        hd: createGlbAsset("./NightHD.glb", OUTDOOR_VIEW),
      },
    },
    mobileStages: {
      dusk: {
        hd: createGlbAsset("./NoonHDDraco_mobile.glb", OUTDOOR_VIEW),
      },
      night: {
        web: createGlbAsset("./HuaMainNightDraco_mobile.glb", OUTDOOR_VIEW),
        hd: createGlbAsset("./NightHD_mobile.glb", OUTDOOR_VIEW),
      },
    },
    qualityAvailability: {
      day: true,
      dusk: true,
      night: true,
    },
  },
  indoors: {
    id: "indoors",
    label: LOCATION_LABELS.indoors,
    kind: "scene-group",
    defaultSceneId: "indoors-main",
    scenes: [
      {
        id: "indoors-main",
        label: "Indoor Main",
        assets: {
          glb: createGlbAsset("./Indoors.glb", INDOOR_VIEW),
        },
      },
      createIndoorScene(
        "metabolism",
        "Metabolism",
        "./GLBs/Metabolism.glb",
        null,
        null,
        {
          sog: {
            src: "./PLYs/Metabolism/Metabolism.sog",
            rotationDegrees: [180, 0, 0],
            viewPreset: {
              distanceMultiplier: 1.8,
              yaw: 180,
              pitch: 12,
              fov: 70,
            },
            manualBox: {
              position: [0, -1.7, -0.1],
              rotationDegrees: [90, 0, 180.2],
              scale: [3.9, 5.7, 3.4],
              cutRatio: 0.15,
              cutDepthByFace: {
                left: 0.15,
                right: 0.15,
                front: 0.15,
                back: 0.15,
                top: 0.15,
                bottom: 0.15,
              },
              cutDepthLockedByFace: {
                left: false,
                right: false,
                front: false,
                back: false,
                top: false,
                bottom: false,
              },
            },
          },
        }
      ),
      createIndoorScene(
        "systasis",
        "Systasis",
        "./GLBs/Systasis.glb",
        null,
        null,
        {
          sog: {
            src: "./PLYs/Systasis/Systasis.sog",
            manualBox: {
              position: [0.1, -2, 0],
              rotationDegrees: [90, 360, 179],
              scale: [4.8, 6, 4],
              cutRatio: 0.16,
              cutDepthByFace: {
                left: 0.16,
                right: 0.19,
                front: 0.16,
                back: 0.16,
                top: 0.16,
                bottom: 0.16,
              },
              cutDepthLockedByFace: {
                left: false,
                right: true,
                front: false,
                back: false,
                top: false,
                bottom: false,
              },
            },
          },
        }
      ),
      createIndoorScene(
        "fitness",
        "Fitness",
        "./GLBs/Fitness.glb"
      ),
      createIndoorScene(
        "classroom-5",
        "Classroom 5",
        "./GLBs/Classroom 5.glb"
      ),
    ],
  },
  dit: {
    id: "dit",
    label: LOCATION_LABELS.dit,
    kind: "single-scene",
    scene: {
      id: "dit-main",
      label: "DIT",
      assets: {
        glb: createGlbAsset("./HuaDITDusk.glb", DIT_VIEW),
      },
    },
  },
};

export { LOCATION_CATALOG, LOCATION_LABELS, createSplatAsset };

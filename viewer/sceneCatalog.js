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
    type: 'glb',
    src,
    orientation: view.orientation || '0deg 0deg 0deg',
    cameraTarget: view.cameraTarget || 'auto auto auto',
    cameraOrbit: view.cameraOrbit || '0deg 72deg auto',
    fieldOfView: view.fieldOfView || '30deg',
    minCameraOrbit: view.minCameraOrbit || 'auto 10deg auto',
    maxCameraOrbit: view.maxCameraOrbit || 'auto 88deg auto',
    ...extras,
  };
}

function createSplatAsset(src, options = {}) {
  const fileFormat = options.fileFormat || 'ply';
  const runtime = options.runtime || (fileFormat === 'sog' ? 'playcanvas' : 'gaussian-splats-3d');

  return {
    type: 'splat',
    src,
    fileFormat,
    runtime,
    cameraUp: options.cameraUp || [0, 0, 1],
    position: options.position || [0, 0, 0],
    rotation: options.rotation || (
      options.rotationDegrees
        ? degreesToQuaternion(options.rotationDegrees)
        : fileFormat === 'sog'
          ? DEFAULT_SOG_ROTATION
          : DEFAULT_SPLAT_ROTATION
    ),
    scale: options.scale || [1, 1, 1],
    manualBox: options.manualBox || null,
    initialCameraPosition: options.initialCameraPosition || [8, -8, 0],
    initialCameraLookAt: options.initialCameraLookAt || [0, 0, 1],
    clipBox: options.clipBox || DEFAULT_CLIP_BOX,
    viewPreset: options.viewPreset || null,
    performanceSources: options.performanceSources || null,
    autoRotate: options.autoRotate !== false,
    cutawayEnabled: options.cutawayEnabled !== false,
  };
}

function createSogAsset(src, options = {}) {
  return createSplatAsset(src, {
    ...options,
    fileFormat: 'sog',
    runtime: 'playcanvas',
  });
}

const OUTDOOR_VIEW = {
  orientation: '0deg 0deg 0deg',
  cameraTarget: 'auto auto auto',
  cameraOrbit: '0deg 0deg auto',
  fieldOfView: '10deg',
  minCameraOrbit: 'auto 55deg auto',
  maxCameraOrbit: 'auto 85deg auto',
};

const INDOOR_VIEW = {
  orientation: '0deg 0deg 0deg',
  cameraTarget: 'auto auto auto',
  cameraOrbit: '0deg 72deg auto',
  fieldOfView: '30deg',
  minCameraOrbit: 'auto 10deg auto',
  maxCameraOrbit: 'auto 88deg auto',
};

const DIT_VIEW = {
  orientation: '0deg 0deg 0deg',
  cameraTarget: 'auto auto auto',
  cameraOrbit: '0deg 72deg auto',
  fieldOfView: '30deg',
  minCameraOrbit: 'auto 35deg auto',
  maxCameraOrbit: 'auto 88deg auto',
};

const LOCATION_LABELS = {
  outdoors: 'OutdoorsM',
  indoors: 'IndoorsM',
  dit: 'DIT',
};

function createSogPerformanceSources(folderName) {
  return {
    lod0: `./PLYs/${folderName}/generated_lods/lod0.sog`,
    lod1: `./PLYs/${folderName}/generated_lods/lod1.sog`,
    lod2: `./PLYs/${folderName}/generated_lods/lod2.sog`,
    lod3: `./PLYs/${folderName}/generated_lods/lod3.sog`,
    lod4: `./PLYs/${folderName}/generated_lods/lod4.sog`,
  };
}

function createIndoorScene(id, label, glbSrc = null, sogOptions = null) {
  return {
    id,
    label,
    assets: {
      ...(glbSrc ? { glb: createGlbAsset(glbSrc, INDOOR_VIEW) } : {}),
      ...(sogOptions?.src ? {
        sog: createSogAsset(sogOptions.src, {
          manualBox: sogOptions.manualBox || null,
          performanceSources: sogOptions.performanceSources || null,
          rotationDegrees: sogOptions.rotationDegrees,
          viewPreset: sogOptions.viewPreset || null,
          cutawayEnabled: sogOptions.cutawayEnabled !== false,
        }),
      } : {}),
    },
  };
}

const LOCATION_CATALOG = {
  outdoors: {
    id: 'outdoors',
    label: LOCATION_LABELS.outdoors,
    kind: 'outdoor-cycle',
    stages: {
      day: {
        glb: {
          web: createGlbAsset('./HuaDayBest1_web.glb', OUTDOOR_VIEW),
          hd: createGlbAsset('./HuaDayBest1.glb', OUTDOOR_VIEW),
        },
        sog: {
          web: createSogAsset('./PLYs/Campus Day/Campus Day.sog', {
            cutawayEnabled: false,
            performanceSources: createSogPerformanceSources('Campus Day'),
          }),
          hd: createSogAsset('./PLYs/Campus Day/Campus Day.sog', {
            cutawayEnabled: false,
            performanceSources: createSogPerformanceSources('Campus Day'),
          }),
        },
      },
      dusk: {
        glb: {
          web: createGlbAsset('./HuaMainDraco.glb', OUTDOOR_VIEW),
          hd: createGlbAsset('./NoonHDDraco.glb', OUTDOOR_VIEW),
        },
        sog: {
          web: createSogAsset('./PLYs/Campus Dusk/Campus Dusk.sog', {
            cutawayEnabled: false,
            performanceSources: createSogPerformanceSources('Campus Dusk'),
          }),
          hd: createSogAsset('./PLYs/Campus Dusk/Campus Dusk.sog', {
            cutawayEnabled: false,
            performanceSources: createSogPerformanceSources('Campus Dusk'),
          }),
        },
      },
      night: {
        glb: {
          web: createGlbAsset('./HuaMainNightDraco.glb', OUTDOOR_VIEW),
          hd: createGlbAsset('./NightHD.glb', OUTDOOR_VIEW),
        },
        sog: {
          web: createSogAsset('./PLYs/Campus Night/Campus Night.sog', {
            cutawayEnabled: false,
            performanceSources: createSogPerformanceSources('Campus Night'),
          }),
          hd: createSogAsset('./PLYs/Campus Night/Campus Night.sog', {
            cutawayEnabled: false,
            performanceSources: createSogPerformanceSources('Campus Night'),
          }),
        },
      },
    },
    mobileStages: {
      day: {
        glb: {},
        sog: {},
      },
      dusk: {
        glb: {
          hd: createGlbAsset('./NoonHDDraco_mobile.glb', OUTDOOR_VIEW),
        },
        sog: {},
      },
      night: {
        glb: {
          web: createGlbAsset('./HuaMainNightDraco_mobile.glb', OUTDOOR_VIEW),
          hd: createGlbAsset('./NightHD_mobile.glb', OUTDOOR_VIEW),
        },
        sog: {},
      },
    },
    qualityAvailability: {
      day: true,
      dusk: true,
      night: true,
    },
  },
  indoors: {
    id: 'indoors',
    label: LOCATION_LABELS.indoors,
    kind: 'scene-group',
    defaultSceneId: 'main-hall',
    scenes: [

      createIndoorScene('metabolism', 'Metabolism', './GLBs/Metabolism.glb', {
        src: './PLYs/Metabolism/Metabolism.sog',
        performanceSources: createSogPerformanceSources('Metabolism'),
        rotationDegrees: [180, 0, 0],
        viewPreset: { distanceMultiplier: 1.8, yaw: 180, pitch: 12, fov: 70 },
        manualBox: {
          position: [0, -1.7, 0],
          rotationDegrees: [90, 0, 178.7],
          scale: [3.9, 5.7, 3.4],
          cutRatio: 0.23,
          cutDepthByFace: { left: 0.19, right: 0.17, front: 0.19, back: 0.27, top: 0.23, bottom: 0.23 },
          cutDepthLockedByFace: { left: true, right: true, front: true, back: true, top: true, bottom: true },
        },
      }),
      createIndoorScene('systasis', 'Systasis', './GLBs/Systasis.glb', {
        src: './PLYs/Systasis/Systasis.sog',
        performanceSources: createSogPerformanceSources('Systasis'),
        manualBox: {
          position: [0.1, -2, 0],
          rotationDegrees: [90, 360, 179],
          scale: [4.3, 5.8, 3.7],
          cutRatio: 0.16,
          cutDepthByFace: { left: 0.21, right: 0.23, front: 0.14, back: 0.15, top: 0.17, bottom: 0.16 },
          cutDepthLockedByFace: { left: true, right: true, front: true, back: true, top: true, bottom: true },
        },
      }),
      createIndoorScene('fitness', 'Fitness', './GLBs/Fitness.glb', {
        src: './PLYs/Fitness/Fitness.sog',
        performanceSources: createSogPerformanceSources('Fitness'),
        manualBox: {
          position: [0.1, -1.8, -0.2],
          rotationDegrees: [90.3, -1.9, 361.1],
          scale: [7.5, 4.9, 4],
          cutRatio: 0.17,
          cutDepthByFace: { left: 0.15, right: 0.19, front: 0.24, back: 0.22, top: 0.23, bottom: 0.17 },
          cutDepthLockedByFace: { left: true, right: true, front: true, back: true, top: true, bottom: true },
        },
      }),
      createIndoorScene('classroom-5', 'Classroom 5', './GLBs/Classroom 5.glb', {
        src: './PLYs/Classroom 5/Classroom 5.sog',
        performanceSources: createSogPerformanceSources('Classroom 5'),
        manualBox: {
          position: [0.1, -2.2, -0.3],
          rotationDegrees: [89.5, -0.1, -450.4],
          scale: [9.2, 9.8, 4.4],
          cutRatio: 0.23,
          cutDepthByFace: { left: 0.19, right: 0.23, front: 0.19, back: 0.2, top: 0.19, bottom: 0.23 },
          cutDepthLockedByFace: { left: true, right: true, front: true, back: true, top: true, bottom: true },
        },
      }),
      createIndoorScene('biology-lab', 'Biology Lab', null, {
        src: './PLYs/BioLab/BioLab.sog',
        performanceSources: createSogPerformanceSources('BioLab'),
        manualBox: {
          position: [0.1, -3, 0.5],
          rotationDegrees: [90.3, -0.1, -450.4],
          scale: [10.2, 19.1, 7.4],
          cutRatio: 0.28,
          cutDepthByFace: { left: 0.34, right: 0.27, front: 0.2, back: 0.19, top: 0.35, bottom: 0.28 },
          cutDepthLockedByFace: { left: true, right: true, front: true, back: true, top: true, bottom: true },
        },
      }),
      createIndoorScene('amphitheater', 'Amphitheater', null, {
        src: './PLYs/Amphitheater/Amphitheater.sog',
        performanceSources: createSogPerformanceSources('Amphitheater'),
        manualBox: {
          position: [-0.5, -2.8, -1.1],
          rotationDegrees: [94.3, -0.1, -542.4],
          scale: [16.7, 23.6, 6.9],
          cutRatio: 0.24,
          cutDepthByFace: { left: 0.23, right: 0.24, front: 0.21, back: 0.19, top: 0.46, bottom: 0.24 },
          cutDepthLockedByFace: { left: true, right: true, front: true, back: true, top: true, bottom: true },
        },
      }),
      createIndoorScene('geo3-3', 'Geo 3.3', null, {
        src: './PLYs/3.3/3.3.sog',
        performanceSources: createSogPerformanceSources('3.3'),
        manualBox: {
          position: [-0.1, -2.4, -0.5],
          rotationDegrees: [90.3, -0.1, -540.4],
          scale: [7.2, 11.1, 3.9],
          cutRatio: 0.2,
          cutDepthByFace: { left: 0.32, right: 0.3, front: 0.22, back: 0.25, top: 0.22, bottom: 0.2 },
          cutDepthLockedByFace: { left: true, right: true, front: true, back: true, top: true, bottom: true },
        },
      }),
      createIndoorScene('kitchen', 'Kitchen', null, {
        src: './PLYs/Kitchen/Kitchen.sog',
        performanceSources: createSogPerformanceSources('Kitchen'),
        manualBox: {
          position: [-0.1, -1.6, -0.1],
          rotationDegrees: [90.3, -0.1, -537.4],
          scale: [7.7, 7.6, 3.9],
          cutRatio: 0.25,
          cutDepthByFace: { left: 0.2, right: 0.27, front: 0.27, back: 0.25, top: 0.33, bottom: 0.25 },
          cutDepthLockedByFace: { left: true, right: true, front: true, back: true, top: true, bottom: true },
        },
      }),
      createIndoorScene('main-hall', 'Main Hall', './Indoors.glb', {
        src: './PLYs/MainHall/MainHall.sog',
        performanceSources: createSogPerformanceSources('MainHall'),
        manualBox: {
          position: [-0.1, -11.6, 7.7],
          rotationDegrees: [90.3, -0.1, -537.4],
          scale: [77.7, 77.6, 23.9],
          cutRatio: 0.33,
          cutDepthByFace: { left: 0.51, right: 0.52, front: 0.01, back: 0.19, top: 0.52, bottom: 0.33 },
          cutDepthLockedByFace: { left: true, right: true, front: true, back: true, top: true, bottom: true },
        },
      }),
    ],
  },
  dit: {
    id: 'dit',
    label: LOCATION_LABELS.dit,
    kind: 'single-scene',
    scene: {
      id: 'dit-main',
      label: 'DIT',
      assets: {
        glb: createGlbAsset('./HuaDITDusk.glb', DIT_VIEW),
      },
    },
  },
};

export { LOCATION_CATALOG, LOCATION_LABELS, createSplatAsset };



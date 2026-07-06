const DEFAULT_SOG_ROTATION_DEGREES = [180, 0, 0];
const DEFAULT_CLIP_BOX = {
  minX: -8,
  maxX: 8,
  minY: -8,
  maxY: 8,
  minZ: -2,
  maxZ: 5,
};

const ASSET_MANIFEST_PATH = './assets/manifest.json';
const ASSET_MODE_LOCAL = 'local';
const ASSET_MODE_REMOTE = 'remote';
const DEBUG_ASSET_ROLES = new Set([
  'glb',
  'glb-web',
  'glb-hd',
  'glb-web-mobile',
  'glb-hd-mobile',
  'sog-source',
  'streamed',
  'collision',
]);
const loggedAssetResolutions = new Set();

function getRuntimeAssetMode() {
  if (typeof window === 'undefined') {
    return ASSET_MODE_REMOTE;
  }

  const params = new URLSearchParams(window.location.search);
  const override = params.get('assets');
  if (override === ASSET_MODE_LOCAL || override === ASSET_MODE_REMOTE) {
    return override;
  }

  const host = window.location.hostname;
  const isLocal =
    window.location.protocol === 'file:' ||
    host === '' ||
    host === 'localhost' ||
    host === '127.0.0.1';

  return isLocal ? ASSET_MODE_LOCAL : ASSET_MODE_REMOTE;
}

function joinAssetUrl(base, assetPath) {
  const cleanPath = String(assetPath || '').replace(/^\/+/, '');
  const cleanBase = String(base || '.').replace(/\/+$/, '');
  return `${cleanBase}/${cleanPath}`;
}

async function loadAssetManifest() {
  if (typeof fetch !== 'function') {
    console.error('[asset-manifest] fetch is not available; active scenes will use fallback local paths.');
    return null;
  }

  try {
    const response = await fetch(ASSET_MANIFEST_PATH, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[asset-manifest] Failed to load assets/manifest.json; active scenes will use fallback local paths.', error);
    return null;
  }
}

const ASSET_MANIFEST = await loadAssetManifest();
const ACTIVE_ASSET_MODE = getRuntimeAssetMode();

function logAssetResolution(sceneId, role, resolvedUrl) {
  if (!DEBUG_ASSET_ROLES.has(role)) {
    return;
  }

  const logKey = `${ACTIVE_ASSET_MODE}:${sceneId}:${role}:${resolvedUrl}`;
  if (loggedAssetResolutions.has(logKey)) {
    return;
  }

  loggedAssetResolutions.add(logKey);
  console.info('[asset-manifest] Resolved active asset', {
    assetMode: ACTIVE_ASSET_MODE,
    sceneId,
    role,
    url: resolvedUrl,
  });
}

function resolveManifestAsset(sceneId, role, fallback, suffix = '') {
  if (!ASSET_MANIFEST) {
    return fallback;
  }

  const scene = ASSET_MANIFEST.scenes?.[sceneId];
  if (!scene) {
    console.error(`[asset-manifest] Active scene "${sceneId}" is missing from manifest.`);
    return fallback;
  }

  const asset = scene.assets?.find((candidate) => candidate.role === role || candidate.id === role);
  if (!asset) {
    console.error(`[asset-manifest] Asset role "${role}" is missing for active scene "${sceneId}".`);
    return fallback;
  }

  const assetPath = asset.assetPath || asset.r2Key;
  if (!assetPath) {
    console.error(`[asset-manifest] Asset role "${role}" for pilot scene "${sceneId}" has no assetPath/r2Key.`);
    return fallback;
  }

  const base = ASSET_MANIFEST.assetBases?.[ACTIVE_ASSET_MODE];
  if (!base) {
    console.error(`[asset-manifest] Asset base "${ACTIVE_ASSET_MODE}" is missing from manifest.`);
    return fallback;
  }

  const resolvedPath = suffix
    ? `${assetPath.replace(/\/+$/, '')}/${String(suffix).replace(/^\/+/, '')}`
    : assetPath;

  const resolvedUrl = joinAssetUrl(base, resolvedPath);
  logAssetResolution(sceneId, role, resolvedUrl);
  return resolvedUrl;
}

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
  const fileFormat = options.fileFormat || 'sog';
  const runtime = options.runtime || 'playcanvas';

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
        : DEFAULT_SOG_ROTATION
    ),
    streamingRotation: options.streamingRotation || null,
    scale: options.scale || [1, 1, 1],
    manualBox: options.manualBox || null,
    fpCollisionBox: options.fpCollisionBox || null,
    initialCameraPosition: options.initialCameraPosition || [8, -8, 0],
    initialCameraLookAt: options.initialCameraLookAt || [0, 0, 1],
    clipBox: options.clipBox || DEFAULT_CLIP_BOX,
    viewPreset: options.viewPreset || null,
    fpViewPreset: options.fpViewPreset || null,
    performanceSources: options.performanceSources || null,
    streamingSource: options.streamingSource || null,
    fpCollisionSource: options.fpCollisionSource || null,
    fpCollisionStrategy: options.fpCollisionStrategy || null,
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
    lod0: `./PLYs/${folderName}/${folderName}.sog`,
    lod1: `./PLYs/${folderName}/generated_lods/lod1.sog`,
    lod2: `./PLYs/${folderName}/generated_lods/lod2.sog`,
    lod3: `./PLYs/${folderName}/generated_lods/lod3.sog`,
    lod4: `./PLYs/${folderName}/generated_lods/lod4.sog`,
  };
}

function createSogStreamingSource(folderName) {
  return `./PLYs/${folderName}/output_lod/lod-meta.json`;
}

function createManifestSogPerformanceSources(sceneId, fallbackFolderName) {
  return {
    lod0: resolveManifestAsset(sceneId, 'sog-source', `./PLYs/${fallbackFolderName}/${fallbackFolderName}.sog`),
    lod1: resolveManifestAsset(sceneId, 'generated-lods', `./PLYs/${fallbackFolderName}/generated_lods/lod1.sog`, 'lod1.sog'),
    lod2: resolveManifestAsset(sceneId, 'generated-lods', `./PLYs/${fallbackFolderName}/generated_lods/lod2.sog`, 'lod2.sog'),
    lod3: resolveManifestAsset(sceneId, 'generated-lods', `./PLYs/${fallbackFolderName}/generated_lods/lod3.sog`, 'lod3.sog'),
    lod4: resolveManifestAsset(sceneId, 'generated-lods', `./PLYs/${fallbackFolderName}/generated_lods/lod4.sog`, 'lod4.sog'),
  };
}

function createManifestSogStreamingSource(sceneId, fallbackFolderName) {
  return resolveManifestAsset(sceneId, 'streamed', `./PLYs/${fallbackFolderName}/output_lod/lod-meta.json`, 'lod-meta.json');
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
            streamingSource: sogOptions.streamingSource || null,
            streamingRotation: sogOptions.streamingRotation || null,
            rotationDegrees: sogOptions.rotationDegrees,
            viewPreset: sogOptions.viewPreset || null,
            fpViewPreset: sogOptions.fpViewPreset || null,
            fpCollisionSource: sogOptions.fpCollisionSource || glbSrc || null,
            fpCollisionStrategy: sogOptions.fpCollisionStrategy || (sogOptions.manualBox ? 'box' : null),
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
          web: createGlbAsset(resolveManifestAsset('campus-day', 'glb-web', './HuaDayBest1_web.glb'), OUTDOOR_VIEW),
          hd: createGlbAsset(resolveManifestAsset('campus-day', 'glb-hd', './HuaDayBest1.glb'), OUTDOOR_VIEW),
        },
        sog: {
          web: createSogAsset(resolveManifestAsset('campus-day', 'sog-source', './PLYs/Campus Day/Campus Day.sog'), {
            cutawayEnabled: false,
            performanceSources: createManifestSogPerformanceSources('campus-day', 'Campus Day'),
            streamingSource: createManifestSogStreamingSource('campus-day', 'Campus Day'),
          }),
          hd: createSogAsset(resolveManifestAsset('campus-day', 'sog-source', './PLYs/Campus Day/Campus Day.sog'), {
            cutawayEnabled: false,
            performanceSources: createManifestSogPerformanceSources('campus-day', 'Campus Day'),
            streamingSource: createManifestSogStreamingSource('campus-day', 'Campus Day'),
          }),
        },
      },
      dusk: {
        glb: {
          web: createGlbAsset(resolveManifestAsset('campus-dusk', 'glb-web', './HuaMainDraco.glb'), OUTDOOR_VIEW),
          hd: createGlbAsset(resolveManifestAsset('campus-dusk', 'glb-hd', './NoonHDDraco.glb'), OUTDOOR_VIEW),
        },
        sog: {
          web: createSogAsset(resolveManifestAsset('campus-dusk', 'sog-source', './PLYs/Campus Dusk/Campus Dusk.sog'), {
            cutawayEnabled: false,
            performanceSources: createManifestSogPerformanceSources('campus-dusk', 'Campus Dusk'),
            streamingSource: createManifestSogStreamingSource('campus-dusk', 'Campus Dusk'),
          }),
          hd: createSogAsset(resolveManifestAsset('campus-dusk', 'sog-source', './PLYs/Campus Dusk/Campus Dusk.sog'), {
            cutawayEnabled: false,
            performanceSources: createManifestSogPerformanceSources('campus-dusk', 'Campus Dusk'),
            streamingSource: createManifestSogStreamingSource('campus-dusk', 'Campus Dusk'),
          }),
        },
      },
      night: {
        glb: {
          web: createGlbAsset(resolveManifestAsset('campus-night', 'glb-web', './HuaMainNightDraco.glb'), OUTDOOR_VIEW),
          hd: createGlbAsset(resolveManifestAsset('campus-night', 'glb-hd', './NightHD.glb'), OUTDOOR_VIEW),
        },
        sog: {
          web: createSogAsset(resolveManifestAsset('campus-night', 'sog-source', './PLYs/Campus Night/Campus Night.sog'), {
            cutawayEnabled: false,
            performanceSources: createManifestSogPerformanceSources('campus-night', 'Campus Night'),
            streamingSource: createManifestSogStreamingSource('campus-night', 'Campus Night'),
          }),
          hd: createSogAsset(resolveManifestAsset('campus-night', 'sog-source', './PLYs/Campus Night/Campus Night.sog'), {
            cutawayEnabled: false,
            performanceSources: createManifestSogPerformanceSources('campus-night', 'Campus Night'),
            streamingSource: createManifestSogStreamingSource('campus-night', 'Campus Night'),
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
          hd: createGlbAsset(resolveManifestAsset('campus-dusk', 'glb-hd-mobile', './NoonHDDraco_mobile.glb'), OUTDOOR_VIEW),
        },
        sog: {},
      },
      night: {
        glb: {
          web: createGlbAsset(resolveManifestAsset('campus-night', 'glb-web-mobile', './HuaMainNightDraco_mobile.glb'), OUTDOOR_VIEW),
          hd: createGlbAsset(resolveManifestAsset('campus-night', 'glb-hd-mobile', './NightHD_mobile.glb'), OUTDOOR_VIEW),
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

        createIndoorScene('metabolism', 'Metabolism', resolveManifestAsset('metabolism', 'glb', './GLBs/Metabolism.glb'), {
          src: resolveManifestAsset('metabolism', 'sog-source', './PLYs/Metabolism/Metabolism.sog'),
          performanceSources: createManifestSogPerformanceSources('metabolism', 'Metabolism'),
          streamingSource: createManifestSogStreamingSource('metabolism', 'Metabolism'),
          fpCollisionSource: resolveManifestAsset('metabolism', 'collision', './GLBs/Metabolism_collision.glb'),
          fpCollisionStrategy: 'mesh',
          streamingRotation: [0, 0, 0, 1],
          rotationDegrees: [180, 0, 0],
          viewPreset: { distanceMultiplier: 1.8, yaw: 180, pitch: 12, fov: 70 },
          fpViewPreset: {
            cameraPosition: [-0.5617085695266724, 1.7075152397155762, 0.20549151301383972],
            target: [-0.5617023871473766, 1.7075135007754372, 0.20549363465114281],
            fov: 120,
          },
          manualBox: {
            position: [0, -1.7, 0],
          rotationDegrees: [90, 0, 178.7],
          scale: [3.9, 5.7, 3.4],
          cutRatio: 0.23,
          cutDepthByFace: { left: 0.19, right: 0.17, front: 0.19, back: 0.27, top: 0.23, bottom: 0.23 },
          cutDepthLockedByFace: { left: true, right: true, front: true, back: true, top: true, bottom: true },
        },
          fpCollisionBox: {
            position: [0, -1.7, 0],
            rotationDegrees: [90, 0, 180],
            scale: [3.9, 5.7, 3.4],
          },
      }),
      createIndoorScene('systasis', 'Systasis', resolveManifestAsset('systasis', 'glb', './GLBs/Systasis.glb'), {
        src: resolveManifestAsset('systasis', 'sog-source', './PLYs/Systasis/Systasis.sog'),
        performanceSources: createManifestSogPerformanceSources('systasis', 'Systasis'),
        streamingSource: createManifestSogStreamingSource('systasis', 'Systasis'),
        fpCollisionSource: resolveManifestAsset('systasis', 'collision', './GLBs/Systasis_collision.glb'),
        fpCollisionStrategy: 'mesh',
        manualBox: {
          position: [0.1, -2, 0],
          rotationDegrees: [90, 360, 179],
          scale: [4.3, 5.8, 3.7],
          cutRatio: 0.16,
          cutDepthByFace: { left: 0.21, right: 0.23, front: 0.14, back: 0.15, top: 0.17, bottom: 0.16 },
          cutDepthLockedByFace: { left: true, right: true, front: true, back: true, top: true, bottom: true },
        },
      }),
      createIndoorScene('fitness', 'Fitness', resolveManifestAsset('fitness', 'glb', './GLBs/Fitness.glb'), {
        src: resolveManifestAsset('fitness', 'sog-source', './PLYs/Fitness/Fitness.sog'),
        performanceSources: createManifestSogPerformanceSources('fitness', 'Fitness'),
        streamingSource: createManifestSogStreamingSource('fitness', 'Fitness'),
        fpCollisionSource: resolveManifestAsset('fitness', 'collision', './GLBs/Fitness_collision.glb'),
        fpCollisionStrategy: 'mesh',
        manualBox: {
          position: [0.1, -1.8, -0.2],
          rotationDegrees: [90.3, -1.9, 361.1],
          scale: [7.5, 4.9, 4],
          cutRatio: 0.17,
          cutDepthByFace: { left: 0.15, right: 0.19, front: 0.24, back: 0.22, top: 0.23, bottom: 0.17 },
          cutDepthLockedByFace: { left: true, right: true, front: true, back: true, top: true, bottom: true },
        },
      }),
      createIndoorScene('classroom-5', 'Classroom 5', resolveManifestAsset('classroom-5', 'glb', './GLBs/Classroom 5.glb'), {
        src: resolveManifestAsset('classroom-5', 'sog-source', './PLYs/Classroom 5/Classroom 5.sog'),
        performanceSources: createManifestSogPerformanceSources('classroom-5', 'Classroom 5'),
        streamingSource: createManifestSogStreamingSource('classroom-5', 'Classroom 5'),
        fpCollisionSource: resolveManifestAsset('classroom-5', 'collision', './GLBs/Classroom 5_collision.glb'),
        fpCollisionStrategy: 'mesh',
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
        src: resolveManifestAsset('biology-lab', 'sog-source', './PLYs/BioLab/BioLab.sog'),
        performanceSources: createManifestSogPerformanceSources('biology-lab', 'BioLab'),
        streamingSource: createManifestSogStreamingSource('biology-lab', 'BioLab'),
        fpCollisionSource: resolveManifestAsset('biology-lab', 'collision', './GLBs/Biolab_collision.glb'),
        fpCollisionStrategy: 'mesh',
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
        src: resolveManifestAsset('amphitheater', 'sog-source', './PLYs/Amphitheater/Amphitheater.sog'),
        performanceSources: createManifestSogPerformanceSources('amphitheater', 'Amphitheater'),
        streamingSource: createManifestSogStreamingSource('amphitheater', 'Amphitheater'),
        fpCollisionSource: resolveManifestAsset('amphitheater', 'collision', './GLBs/Amphitheater_collision.glb'),
        fpCollisionStrategy: 'mesh',
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
        src: resolveManifestAsset('geo3-3', 'sog-source', './PLYs/3.3/3.3.sog'),
        performanceSources: createManifestSogPerformanceSources('geo3-3', '3.3'),
        streamingSource: createManifestSogStreamingSource('geo3-3', '3.3'),
        fpCollisionSource: resolveManifestAsset('geo3-3', 'collision', './GLBs/Geo3.3_collision.glb'),
        fpCollisionStrategy: 'mesh',
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
        src: resolveManifestAsset('kitchen', 'sog-source', './PLYs/Kitchen/Kitchen.sog'),
        performanceSources: createManifestSogPerformanceSources('kitchen', 'Kitchen'),
        streamingSource: createManifestSogStreamingSource('kitchen', 'Kitchen'),
        fpCollisionSource: resolveManifestAsset('kitchen', 'collision', './GLBs/Kitchen_collision.glb'),
        fpCollisionStrategy: 'mesh',
        manualBox: {
          position: [-0.1, -1.6, -0.1],
          rotationDegrees: [90.3, -0.1, -537.4],
          scale: [7.7, 7.6, 3.9],
          cutRatio: 0.25,
          cutDepthByFace: { left: 0.2, right: 0.27, front: 0.27, back: 0.25, top: 0.33, bottom: 0.25 },
          cutDepthLockedByFace: { left: true, right: true, front: true, back: true, top: true, bottom: true },
        },
      }),
      createIndoorScene('main-hall', 'Main Hall', resolveManifestAsset('main-hall', 'glb', './Indoors.glb'), {
        src: resolveManifestAsset('main-hall', 'sog-source', './PLYs/MainHall/MainHall.sog'),
        performanceSources: createManifestSogPerformanceSources('main-hall', 'MainHall'),
        streamingSource: createManifestSogStreamingSource('main-hall', 'MainHall'),
        fpCollisionSource: resolveManifestAsset('main-hall', 'collision', './GLBs/MainHall_collision.glb'),
        fpCollisionStrategy: 'mesh',
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
        glb: createGlbAsset(resolveManifestAsset('dit-main', 'glb', './HuaDITDusk.glb'), DIT_VIEW),
        sog: createSogAsset(resolveManifestAsset('dit-main', 'sog-source', './PLYs/DIT/DIT.sog'), {
          performanceSources: createManifestSogPerformanceSources('dit-main', 'DIT'),
          streamingSource: createManifestSogStreamingSource('dit-main', 'DIT'),
          fpCollisionSource: resolveManifestAsset('dit-main', 'collision', './GLBs/DIT_collision.glb'),
          fpCollisionStrategy: 'mesh',
          cutawayEnabled: false,
        }),
      },
    },
  },
};

export { LOCATION_CATALOG, LOCATION_LABELS, createSplatAsset };



import { logger } from "./logger.js";
import { withGeneratedCutaway } from "./generatedCutawayOutlines.js?v=20261001selected1";

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
const ASSET_MODE_HYBRID = 'hybrid';
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

  return isLocal ? ASSET_MODE_HYBRID : ASSET_MODE_REMOTE;
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

function logAssetResolution(sceneId, role, resolvedUrl, assetMode = ACTIVE_ASSET_MODE) {
  if (!DEBUG_ASSET_ROLES.has(role)) {
    return;
  }

  const logKey = `${assetMode}:${sceneId}:${role}:${resolvedUrl}`;
  if (loggedAssetResolutions.has(logKey)) {
    return;
  }

  loggedAssetResolutions.add(logKey);
  logger.debug('asset-manifest', 'Resolved active asset', {
    assetMode,
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

  const localPreviewScenes = Array.isArray(ASSET_MANIFEST.localPreviewScenes)
    ? ASSET_MANIFEST.localPreviewScenes
    : [];
  const resolvedAssetMode = ACTIVE_ASSET_MODE === ASSET_MODE_HYBRID
    ? (localPreviewScenes.includes(sceneId) ? ASSET_MODE_LOCAL : ASSET_MODE_REMOTE)
    : ACTIVE_ASSET_MODE;
  const base = ASSET_MANIFEST.assetBases?.[resolvedAssetMode];
  if (!base) {
    console.error(`[asset-manifest] Asset base "${resolvedAssetMode}" is missing from manifest.`);
    return fallback;
  }

  const resolvedPath = suffix
    ? `${assetPath.replace(/\/+$/, '')}/${String(suffix).replace(/^\/+/, '')}`
    : assetPath;

  const resolvedUrl = joinAssetUrl(base, resolvedPath);
  logAssetResolution(sceneId, role, resolvedUrl, resolvedAssetMode);
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
    maxOrbitDistance: options.maxOrbitDistance || null,
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
  maxCameraOrbit: 'auto 85deg 900m',
};

const OUTDOOR_SOG_OPTIONS = {
  maxOrbitDistance: 900,
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
    thumbnail: sogOptions?.thumbnail || null,
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

function createPcLabDraftManualBox() {
  const vertices = [
    [-0.6333, 5.786],
    [-3.7766, 1.8354],
    [-2.749296661578224, 0.42940927374550597],
    [-2.7904, -0.7571],
    [-4.956216301801794, -3.71095541878753],
    [-0.15350468794989602, -6.168451485802855],
    [5.5049891074013715, 1.3569755238924452],
  ];
  return {
    position: [0.1063, 0.0432, -0.2941],
    rotationDegrees: [0, 0, 0],
    scale: [9.4914, 2.625, 12.1602],
    cutRatio: 0.2,
    cutawayMode: 'outline',
    outline: {
      version: 1,
      mode: 'outline',
      vertices,
      edges: vertices.map((_, index) => ({
        id: `edge-${index + 1}`,
        label: `Edge ${index + 1}`,
        enabled: true,
        cutDepth: 0.324,
        depthSlope: 0,
        depthMode: 'inherit',
        cleanupMode: 'inherit',
        cleanupMargin: 0.12,
        paddingMode: 'inherit',
        paddingDistance: 0.249,
        cameraActivation: index === 3 ? 'previous' : 'face',
      })),
      floorY: -1.41,
      ceilingY: 1.53,
      fadeWidth: 0.12,
      cameraMotionSmoothing: 0.3,
      cameraMotionAcceleration: 1,
      topCutDepth: 0.6,
      bottomCutDepth: 0.28,
      edgeDepth: { useGlobal: true, global: 0.64 },
      padding: { mode: 'auto', autoDistance: 0.249, distance: 0.249 },
      cleanup: { mode: 'auto', autoMargin: 0.12, margin: 0.12, strength: 1 },
      transform: {
        position: [0, 0, 0],
        rotationDegrees: [0, 0, 0],
        scale: [1, 1, 1],
      },
      registration: null,
      source: {
        type: 'mipmap-glb-floor',
        confidence: 1,
        metrics: {
          retainedComponentRatio: 1,
          dominantFloorAreaRatio: 0.22,
          acceptedFloorTriangles: 99617,
        },
      },
    },
    surfaceCulling: { enabled: false, threshold: 0, fadeWidth: 0.35, strength: 0.75 },
    exclusionBoxes: [],
    splatPatches: [],
  };
}

function createMainHallDraftManualBox() {
  const manualBox = withGeneratedCutaway('main-hall', {
    position: [-0.1, -11.6, 7.7],
    rotationDegrees: [90.3, -0.1, -537.4],
    scale: [77.7, 77.6, 23.9],
    cutRatio: 0.33,
    cutDepthByFace: { left: 0.51, right: 0.52, front: 0.01, back: 0.19, top: 0.52, bottom: 0.33 },
    cutDepthLockedByFace: { left: true, right: true, front: true, back: true, top: true, bottom: true },
  });
  const vertices = [
    [13.296811209300007, 35.679663854276235],
    [-16.486386556610167, 34.77852987764923],
    [-16.048969202615563, 5.623604810302421],
    [-3.5884881322823112, 5.634190505003449],
    [-2.9105866917218854, -6.532278218912943],
    [-28.217147199336488, -6.984945436532442],
    [-28.54873515446023, -27.978558072950776],
    [28.300938979477905, -26.890283669030183],
    [28.02513838444918, -7.513889899618942],
    [6.136723074181944, -7.647488143701423],
    [5.3073576261285496, 5.736466363848791],
    [13.731895309031898, 5.955432296929516],
  ];
  return {
    ...manualBox,
    cutawayMode: 'outline',
    outline: {
      ...manualBox.outline,
      vertices,
      edges: vertices.map((_, index) => ({
        id: `edge-${index + 1}`,
        label: `Edge ${index + 1}`,
        enabled: true,
        cutDepth: 0.38,
        depthSlope: 0,
        depthMode: 'inherit',
        cleanupMode: 'inherit',
        cleanupMargin: 0.12,
        paddingMode: 'inherit',
        paddingDistance: 0.34,
        cameraActivation: 'face',
      })),
      floorY: -0.3,
      ceilingY: 3.22,
      fadeWidth: 0.001,
      cameraMotionSmoothing: 0.93,
      cameraMotionAcceleration: 1,
      topCutDepth: 0.5,
      bottomCutDepth: 1.82,
      edgeDepth: { useGlobal: true, global: 8 },
      padding: { mode: 'auto', autoDistance: 0.34, distance: 0 },
      cleanup: { mode: 'auto', autoMargin: 0.12, margin: 0.101, strength: 1 },
      transform: {
        position: [0, -20.19, 0],
        rotationDegrees: [0, 0, 0],
        scale: [1, 5.5, 1],
      },
    },
  };
}

const LOCATION_CATALOG = {
  outdoors: {
    id: 'outdoors',
    label: LOCATION_LABELS.outdoors,
    kind: 'outdoor-cycle',
    thumbnail: './assets/thumbnails/campus.webp',
    stages: {
      day: {
        glb: {
          web: createGlbAsset(resolveManifestAsset('campus-day', 'glb-web', './HuaDayBest1_web.glb'), OUTDOOR_VIEW),
          hd: createGlbAsset(resolveManifestAsset('campus-day', 'glb-hd', './HuaDayBest1.glb'), OUTDOOR_VIEW),
        },
        sog: {
          web: createSogAsset(resolveManifestAsset('campus-day', 'sog-source', './PLYs/Campus Day/Campus Day.sog'), {
            ...OUTDOOR_SOG_OPTIONS,
            cutawayEnabled: false,
            performanceSources: createManifestSogPerformanceSources('campus-day', 'Campus Day'),
            streamingSource: createManifestSogStreamingSource('campus-day', 'Campus Day'),
            fpCollisionSource: `${resolveManifestAsset('campus-day', 'collision', './GLBs/CampusDay_collision80.glb')}?v=20260705-scale01`,
            fpCollisionStrategy: 'mesh',
          }),
          hd: createSogAsset(resolveManifestAsset('campus-day', 'sog-source', './PLYs/Campus Day/Campus Day.sog'), {
            ...OUTDOOR_SOG_OPTIONS,
            cutawayEnabled: false,
            performanceSources: createManifestSogPerformanceSources('campus-day', 'Campus Day'),
            streamingSource: createManifestSogStreamingSource('campus-day', 'Campus Day'),
            fpCollisionSource: `${resolveManifestAsset('campus-day', 'collision', './GLBs/CampusDay_collision80.glb')}?v=20260705-scale01`,
            fpCollisionStrategy: 'mesh',
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
            ...OUTDOOR_SOG_OPTIONS,
            cutawayEnabled: false,
            performanceSources: createManifestSogPerformanceSources('campus-dusk', 'Campus Dusk'),
            streamingSource: createManifestSogStreamingSource('campus-dusk', 'Campus Dusk'),
            fpCollisionSource: `${resolveManifestAsset('campus-dusk', 'collision', './GLBs/CampusDusk_collision80.glb')}?v=20260705-scale01`,
            fpCollisionStrategy: 'mesh',
          }),
          hd: createSogAsset(resolveManifestAsset('campus-dusk', 'sog-source', './PLYs/Campus Dusk/Campus Dusk.sog'), {
            ...OUTDOOR_SOG_OPTIONS,
            cutawayEnabled: false,
            performanceSources: createManifestSogPerformanceSources('campus-dusk', 'Campus Dusk'),
            streamingSource: createManifestSogStreamingSource('campus-dusk', 'Campus Dusk'),
            fpCollisionSource: `${resolveManifestAsset('campus-dusk', 'collision', './GLBs/CampusDusk_collision80.glb')}?v=20260705-scale01`,
            fpCollisionStrategy: 'mesh',
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
            ...OUTDOOR_SOG_OPTIONS,
            cutawayEnabled: false,
            performanceSources: createManifestSogPerformanceSources('campus-night', 'Campus Night'),
            streamingSource: createManifestSogStreamingSource('campus-night', 'Campus Night'),
            fpCollisionSource: `${resolveManifestAsset('campus-night', 'collision', './GLBs/CampusNight_collision80.glb')}?v=20260705-scale01`,
            fpCollisionStrategy: 'mesh',
          }),
          hd: createSogAsset(resolveManifestAsset('campus-night', 'sog-source', './PLYs/Campus Night/Campus Night.sog'), {
            ...OUTDOOR_SOG_OPTIONS,
            cutawayEnabled: false,
            performanceSources: createManifestSogPerformanceSources('campus-night', 'Campus Night'),
            streamingSource: createManifestSogStreamingSource('campus-night', 'Campus Night'),
            fpCollisionSource: `${resolveManifestAsset('campus-night', 'collision', './GLBs/CampusNight_collision80.glb')}?v=20260705-scale01`,
            fpCollisionStrategy: 'mesh',
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
          thumbnail: './assets/thumbnails/metabolism.webp',
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
        thumbnail: './assets/thumbnails/systasis.webp',
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
        thumbnail: './assets/thumbnails/fitness.webp',
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
      createIndoorScene('geo-entrance', 'GEO Entrance', null, {
        src: resolveManifestAsset('geo-entrance', 'sog-source', './PLYs/Geo Entrance/source.sog'),
        thumbnail: './assets/thumbnails/geo-entrance.webp',
        streamingSource: createManifestSogStreamingSource('geo-entrance', 'Geo Entrance'),
        fpCollisionSource: resolveManifestAsset('geo-entrance', 'collision', './collision-assets/geo-entrance/collision.glb'),
        fpCollisionStrategy: 'mesh',
        rotationDegrees: [0, 0, 0],
        manualBox: withGeneratedCutaway('geo-entrance', {
          position: [0.0076, -0.0242, -0.5343],
          rotationDegrees: [0, 0, 0],
          scale: [24.6617, 6.2596, 26.1637],
          cutRatio: 0.2,
        }),
        viewPreset: { distanceMultiplier: 1, yaw: 180, pitch: 12, fov: 70 },
        fpViewPreset: { cameraPosition: [0, 0, 0], target: [0, 0, 1], fov: 72 },
      }),
      createIndoorScene('ceremonial-hall', 'Ceremonial Hall', null, {
        src: resolveManifestAsset('ceremonial-hall', 'sog-source', './PLYs/Ceremonial Hall/source.sog'),
        thumbnail: './assets/thumbnails/ceremonial-hall.webp',
        streamingSource: createManifestSogStreamingSource('ceremonial-hall', 'Ceremonial Hall'),
        fpCollisionSource: resolveManifestAsset('ceremonial-hall', 'collision', './collision-assets/ceremonial-hall/collision.glb'),
        fpCollisionStrategy: 'mesh',
        rotationDegrees: [0, 0, 0],
        manualBox: {
          position: [-0.1, 0.1, 0.011],
          rotationDegrees: [0, 0, 0],
          scale: [11.601, 3.301, 15.104],
          cutRatio: 0.2,
          cutDepthByFace: { top: 0.2, back: 0.23 },
          cutDepthLockedByFace: { top: true, back: true },
          cutEnabledByFace: { top: true },
          cutawayMode: 'box',
          outline: null,
          surfaceCulling: { enabled: false, threshold: 0, fadeWidth: 0.35, strength: 0.75 },
          exclusionBoxes: [],
          splatPatches: [],
        },
        viewPreset: { distanceMultiplier: 1, yaw: 180, pitch: 12, fov: 70 },
        fpViewPreset: { cameraPosition: [0, 0, 0], target: [0, 0, 1], fov: 72 },
      }),
      createIndoorScene('library', 'Library', null, {
        src: resolveManifestAsset('library', 'sog-source', './PLYs/Library/source.sog'),
        thumbnail: './assets/thumbnails/library.webp',
        streamingSource: createManifestSogStreamingSource('library', 'Library'),
        fpCollisionSource: resolveManifestAsset('library', 'collision', './collision-assets/library/collision.glb'),
        fpCollisionStrategy: 'mesh',
        rotationDegrees: [0, 0, 0],
        manualBox: {
          position: [0.1, 0.4, -0.6],
          rotationDegrees: [0, 23, 0],
          scale: [18.401, 8.001, 26.701],
          cutRatio: 0.2,
          cutDepthByFace: { bottom: 0.2, front: 0.27, back: 0.29 },
          cutDepthLockedByFace: { bottom: true, front: true, back: true },
        },
        viewPreset: { distanceMultiplier: 1, yaw: 180, pitch: 12, fov: 70 },
        fpViewPreset: { cameraPosition: [0, 0, 0], target: [0, 0, 1], fov: 72 },
      }),
      createIndoorScene('classroom-5', 'Classroom 5', resolveManifestAsset('classroom-5', 'glb', './GLBs/Classroom 5.glb'), {
        src: resolveManifestAsset('classroom-5', 'sog-source', './PLYs/Classroom 5/Classroom 5.sog'),
        thumbnail: './assets/thumbnails/classroom-5.webp',
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
        thumbnail: './assets/thumbnails/biology-lab.webp',
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
        thumbnail: './assets/thumbnails/amphitheater.webp',
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
        thumbnail: './assets/thumbnails/geo3-3.webp',
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
        thumbnail: './assets/thumbnails/kitchen.webp',
        performanceSources: createManifestSogPerformanceSources('kitchen', 'Kitchen'),
        streamingSource: createManifestSogStreamingSource('kitchen', 'Kitchen'),
        fpCollisionSource: resolveManifestAsset('kitchen', 'collision', './GLBs/Kitchen_collision.glb'),
        fpCollisionStrategy: 'box',
        manualBox: withGeneratedCutaway('kitchen', {
          position: [-0.1, -1.6, -0.1],
          rotationDegrees: [90.3, -0.1, -537.4],
          scale: [7.7, 7.6, 3.9],
          cutRatio: 0.25,
          cutDepthByFace: { left: 0.2, right: 0.27, front: 0.27, back: 0.25, top: 0.33, bottom: 0.25 },
          cutDepthLockedByFace: { left: true, right: true, front: true, back: true, top: true, bottom: true },
        }),
      }),
      createIndoorScene('main-hall', 'Main Hall', resolveManifestAsset('main-hall', 'glb', './Indoors.glb'), {
        src: resolveManifestAsset('main-hall', 'sog-source', './PLYs/MainHall/MainHall.sog'),
        thumbnail: './assets/thumbnails/main-hall.webp',
        performanceSources: createManifestSogPerformanceSources('main-hall', 'MainHall'),
        streamingSource: createManifestSogStreamingSource('main-hall', 'MainHall'),
        fpCollisionSource: resolveManifestAsset('main-hall', 'collision', './GLBs/MainHall_collision.glb'),
        fpCollisionStrategy: 'mesh',
        manualBox: createMainHallDraftManualBox(),
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
      thumbnail: './assets/thumbnails/dit.png',
      assets: {
        glb: createGlbAsset(resolveManifestAsset('dit-main', 'glb', './HuaDITDusk.glb'), DIT_VIEW),
        sog: createSogAsset(resolveManifestAsset('dit-main', 'sog-source', './PLYs/DIT/DIT.sog'), {
          performanceSources: createManifestSogPerformanceSources('dit-main', 'DIT'),
          streamingSource: createManifestSogStreamingSource('dit-main', 'DIT'),
          fpCollisionSource: `${resolveManifestAsset('dit-main', 'collision', './GLBs/DIT_collision.glb')}?v=20260707-dit1`,
          fpCollisionStrategy: 'mesh',
          cutawayEnabled: false,
        }),
      },
    },
    insideScenes: [
      createIndoorScene('pc-lab', 'PC Lab', null, {
        src: resolveManifestAsset('pc-lab', 'sog-source', './PLYs/PC Lab/source.sog'),
        thumbnail: './assets/thumbnails/pc-lab.webp',
        streamingSource: createManifestSogStreamingSource('pc-lab', 'PC Lab'),
        fpCollisionSource: resolveManifestAsset('pc-lab', 'collision', './collision-assets/pc-lab/collision.glb'),
        fpCollisionStrategy: 'mesh',
        rotationDegrees: [0, 0, 0],
        manualBox: createPcLabDraftManualBox(),
        viewPreset: { distanceMultiplier: 1, yaw: 180, pitch: 12, fov: 70 },
        fpViewPreset: { cameraPosition: [0, 0, 0], target: [0, 0, 1], fov: 72 },
      }),
    ],
  },
};

export { LOCATION_CATALOG, LOCATION_LABELS, createSplatAsset };



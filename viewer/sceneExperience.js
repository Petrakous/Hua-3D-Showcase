const SCENE_EXPERIENCE_DEFAULTS = {
  defaults: {
    format: "sog",
    sogRuntime: "playcanvas",
    quality: "web",
    firstPersonMode: "walk"
  },
  navigation: {
    orbit: true,
    walk: false,
    fly: false,
    tapToMove: false,
    collision: false,
    defaultMode: "orbit"
  },
  performance: {
    weight: "light",
    mobileQuality: "web",
    desktopQuality: "hd",
    preferredRuntimeByDevice: {
      mobile: "playcanvas",
      desktop: "playcanvas"
    }
  },
  loading: {
    title: "Loading Scene",
    message: "Preparing 3D environment...",
    heavyMessage: "Loading high-fidelity data. Please wait...",
    readyMessage: "Scene loaded. Tap to explore!"
  },
  fallbacks: {
    preferredOrder: ["sog", "glb"],
    onStreamedFailure: "classic",
    onSogFailure: "glb",
    onCollisionFailure: "orbit"
  },
  future: {
    hotspots: [],
    tour: null,
    portals: []
  }
};

const SCENE_EXPERIENCES = {
  "campus-day": {
    id: "campus-day",
    title: "Campus Day",
    subtitle: "Outdoor campus",
    description: "Explore the university grounds in bright daylight.",
    category: "outdoor",
    group: "campus",
    defaults: {
      format: "sog",
      quality: "web",
      firstPersonMode: "fly"
    },
    navigation: {
      orbit: true,
      walk: true,
      fly: true,
      tapToMove: false,
      collision: true,
      defaultMode: "orbit"
    },
    performance: {
      weight: "heavy",
      mobileQuality: "web",
      desktopQuality: "hd"
    },
    loading: {
      title: "Campus Day",
      message: "Loading outdoor campus scene...",
      heavyMessage: "Loading high-quality 3D splat data (large payload)..."
    },
    future: {
      hotspots: [
        {
          id: "enter-main-hall",
          type: "scene-link",
          title: "Enter Main Hall",
          description: "Go inside the main building and explore the Main Hall.",
          targetSceneId: "main-hall",
          targetSceneTitle: "Main Hall",
          thumbnail: "./assets/thumbnails/main-hall.webp",
          position: { x: 0, y: 0, z: 0 },
          radius: 1,
          icon: "door",
          enabled: true
        }
      ]
    }
  },
  "campus-dusk": {
    id: "campus-dusk",
    title: "Campus Dusk",
    subtitle: "Outdoor campus",
    description: "Explore the university grounds in calm dusk light.",
    category: "outdoor",
    group: "campus",
    defaults: {
      format: "sog",
      quality: "web",
      firstPersonMode: "fly"
    },
    navigation: {
      orbit: true,
      walk: true,
      fly: true,
      tapToMove: false,
      collision: true,
      defaultMode: "orbit"
    },
    performance: {
      weight: "heavy",
      mobileQuality: "web",
      desktopQuality: "hd"
    },
    loading: {
      title: "Campus Dusk",
      message: "Loading outdoor campus at dusk...",
      heavyMessage: "Loading high-quality dusk lighting details..."
    }
  },
  "campus-night": {
    id: "campus-night",
    title: "Campus Night",
    subtitle: "Outdoor campus",
    description: "Explore the university grounds under night lighting.",
    category: "outdoor",
    group: "campus",
    defaults: {
      format: "sog",
      quality: "web",
      firstPersonMode: "fly"
    },
    navigation: {
      orbit: true,
      walk: true,
      fly: true,
      tapToMove: false,
      collision: true,
      defaultMode: "orbit"
    },
    performance: {
      weight: "heavy",
      mobileQuality: "web",
      desktopQuality: "hd"
    },
    loading: {
      title: "Campus Night",
      message: "Loading outdoor campus at night...",
      heavyMessage: "Preparing night view lights and shaders..."
    }
  },
  "dit-main": {
    id: "dit-main",
    title: "DIT",
    subtitle: "University building",
    description: "View the Department of Informatics and Telematics in 3D.",
    category: "outdoor",
    group: "dit",
    defaults: {
      format: "sog",
      quality: "web",
      firstPersonMode: "walk"
    },
    navigation: {
      orbit: true,
      walk: false,
      fly: false,
      tapToMove: false,
      collision: false,
      defaultMode: "orbit"
    },
    performance: {
      weight: "medium",
      mobileQuality: "web",
      desktopQuality: "hd"
    },
    loading: {
      title: "DIT Building",
      message: "Loading DIT building exteriors..."
    }
  },
  "main-hall": {
    id: "main-hall",
    title: "Main Hall",
    subtitle: "Main building space",
    description: "Step inside the grand main lobby of the campus.",
    category: "indoor",
    group: "campus",
    defaults: {
      format: "sog",
      firstPersonMode: "walk"
    },
    navigation: {
      orbit: true,
      walk: true,
      fly: true,
      tapToMove: true,
      collision: true,
      defaultMode: "orbit"
    },
    performance: {
      weight: "heavy",
      mobileQuality: "web",
      desktopQuality: "hd"
    },
    loading: {
      title: "Main Hall",
      message: "Loading main hall interior...",
      heavyMessage: "Loading high-fidelity indoor structure..."
    }
  },
  "metabolism": {
    id: "metabolism",
    title: "Metabolism",
    subtitle: "Diet building space",
    description: "Inspect the metabolism laboratory and equipment.",
    category: "lab",
    group: "campus",
    defaults: {
      format: "sog",
      firstPersonMode: "walk"
    },
    navigation: {
      orbit: true,
      walk: true,
      fly: true,
      tapToMove: true,
      collision: true,
      defaultMode: "orbit"
    },
    performance: {
      weight: "medium",
      mobileQuality: "web",
      desktopQuality: "hd"
    },
    loading: {
      title: "Metabolism Lab",
      message: "Loading metabolism laboratory room..."
    }
  },
  "systasis": {
    id: "systasis",
    title: "Systasis",
    subtitle: "Geo building space",
    description: "Explore the systasis and research setup.",
    category: "lab",
    group: "campus",
    defaults: {
      format: "sog",
      firstPersonMode: "walk"
    },
    navigation: {
      orbit: true,
      walk: true,
      fly: true,
      tapToMove: true,
      collision: true,
      defaultMode: "orbit"
    },
    performance: {
      weight: "medium",
      mobileQuality: "web",
      desktopQuality: "hd"
    },
    loading: {
      title: "Systasis",
      message: "Loading research lab..."
    }
  },
  "fitness": {
    id: "fitness",
    title: "Fitness",
    subtitle: "Geo building space",
    description: "Inspect the fitness gym and training center.",
    category: "indoor",
    group: "campus",
    defaults: {
      format: "sog",
      firstPersonMode: "walk"
    },
    navigation: {
      orbit: true,
      walk: true,
      fly: true,
      tapToMove: true,
      collision: true,
      defaultMode: "orbit"
    },
    performance: {
      weight: "medium",
      mobileQuality: "web",
      desktopQuality: "hd"
    },
    loading: {
      title: "Fitness Center",
      message: "Loading gym and fitness training equipment..."
    }
  },
  "classroom-5": {
    id: "classroom-5",
    title: "Classroom 5",
    subtitle: "Main building space",
    description: "Step inside a standard university lecture classroom.",
    category: "indoor",
    group: "campus",
    defaults: {
      format: "sog",
      firstPersonMode: "walk"
    },
    navigation: {
      orbit: true,
      walk: true,
      fly: true,
      tapToMove: true,
      collision: true,
      defaultMode: "orbit"
    },
    performance: {
      weight: "medium",
      mobileQuality: "web",
      desktopQuality: "hd"
    },
    loading: {
      title: "Classroom 5",
      message: "Loading classroom interior..."
    }
  },
  "biology-lab": {
    id: "biology-lab",
    title: "Biology Lab",
    subtitle: "Main building space",
    description: "Explore the biology and research laboratory environment.",
    category: "lab",
    group: "campus",
    defaults: {
      format: "sog",
      firstPersonMode: "walk"
    },
    navigation: {
      orbit: true,
      walk: true,
      fly: true,
      tapToMove: true,
      collision: true,
      defaultMode: "orbit"
    },
    performance: {
      weight: "heavy",
      mobileQuality: "web",
      desktopQuality: "hd"
    },
    loading: {
      title: "Biology Lab",
      message: "Loading biology lab environment..."
    }
  },
  "amphitheater": {
    id: "amphitheater",
    title: "Amphitheater",
    subtitle: "Main building space",
    description: "View the large central university lecture theater.",
    category: "indoor",
    group: "campus",
    defaults: {
      format: "sog",
      firstPersonMode: "walk"
    },
    navigation: {
      orbit: true,
      walk: true,
      fly: true,
      tapToMove: true,
      collision: true,
      defaultMode: "orbit"
    },
    performance: {
      weight: "heavy",
      mobileQuality: "web",
      desktopQuality: "hd"
    },
    loading: {
      title: "Amphitheater",
      message: "Loading central university lecture theater..."
    }
  },
  "geo3-3": {
    id: "geo3-3",
    title: "Geo 3.3",
    subtitle: "Geo building space",
    description: "Step into lab 3.3 for chemical studies.",
    category: "indoor",
    group: "campus",
    defaults: {
      format: "sog",
      firstPersonMode: "walk"
    },
    navigation: {
      orbit: true,
      walk: true,
      fly: true,
      tapToMove: true,
      collision: true,
      defaultMode: "orbit"
    },
    performance: {
      weight: "medium",
      mobileQuality: "web",
      desktopQuality: "hd"
    },
    loading: {
      title: "Geo 3.3 Laboratory",
      message: "Loading Geo 3.3 laboratory environment..."
    }
  },
  "kitchen": {
    id: "kitchen",
    title: "Kitchen",
    subtitle: "Diet building space",
    description: "View the nutritional and dietary preparation kitchen.",
    category: "indoor",
    group: "campus",
    defaults: {
      format: "sog",
      firstPersonMode: "walk"
    },
    navigation: {
      orbit: true,
      walk: true,
      fly: true,
      tapToMove: true,
      collision: true,
      defaultMode: "orbit"
    },
    performance: {
      weight: "medium",
      mobileQuality: "web",
      desktopQuality: "hd"
    },
    loading: {
      title: "Kitchen",
      message: "Loading nutritional and dietary kitchen room..."
    }
  }
};

function normalizeExperience(spec, options = {}) {
  const normalizeHotspot = (hotspot) => ({
    id: hotspot.id,
    type: hotspot.type || "scene-link",
    title: hotspot.title || "Explore",
    description: hotspot.description || "",
    targetSceneId: hotspot.targetSceneId || null,
    targetSceneTitle: hotspot.targetSceneTitle || "",
    thumbnail: hotspot.thumbnail || null,
    position: {
      x: Number(hotspot.position?.x ?? 0),
      y: Number(hotspot.position?.y ?? 0),
      z: Number(hotspot.position?.z ?? 0)
    },
    radius: Number.isFinite(hotspot.radius) ? hotspot.radius : 1,
    icon: hotspot.icon || "portal",
    enabled: hotspot.enabled !== false
  });
  const future = {
    ...SCENE_EXPERIENCE_DEFAULTS.future,
    ...spec.future,
    ...options.future
  };
  future.hotspots = (future.hotspots || []).map(normalizeHotspot);

  return {
    id: spec.id,
    title: spec.title || "Scene",
    subtitle: spec.subtitle || "",
    description: spec.description || "",
    category: spec.category || "indoor",
    group: spec.group || "campus",
    card: {
      thumbnail: spec.card?.thumbnail || null,
      description: spec.card?.description || spec.description || ""
    },
    defaults: {
      ...SCENE_EXPERIENCE_DEFAULTS.defaults,
      ...spec.defaults,
      ...options.defaults
    },
    navigation: {
      ...SCENE_EXPERIENCE_DEFAULTS.navigation,
      ...spec.navigation,
      ...options.navigation
    },
    performance: {
      ...SCENE_EXPERIENCE_DEFAULTS.performance,
      ...spec.performance,
      ...options.performance
    },
    loading: {
      ...SCENE_EXPERIENCE_DEFAULTS.loading,
      ...spec.loading,
      ...options.loading
    },
    fallbacks: {
      ...SCENE_EXPERIENCE_DEFAULTS.fallbacks,
      ...spec.fallbacks,
      ...options.fallbacks
    },
    future
  };
}

function resolveSceneExperience(scene, options = {}) {
  const sceneId = typeof scene === "string" ? scene : (scene?.id || "");
  const spec = SCENE_EXPERIENCES[sceneId];
  if (!spec) {
    return normalizeExperience({ id: sceneId }, options);
  }
  return normalizeExperience(spec, options);
}

function getSceneExperience(sceneId, options = {}) {
  return resolveSceneExperience(sceneId, options);
}

function getCategoryLabel(category) {
  const labels = {
    outdoor: "Outdoor campus",
    indoor: "Indoor room",
    lab: "Laboratory environment"
  };
  return labels[category] || "3D Space";
}

function getPreferredDeviceQuality(experience, deviceType = "desktop") {
  if (deviceType === "mobile") {
    return experience.performance.mobileQuality;
  }
  return experience.performance.desktopQuality;
}

function isNavigationCapable(experience, mode) {
  return !!experience.navigation[mode];
}

export {
  SCENE_EXPERIENCE_DEFAULTS,
  SCENE_EXPERIENCES,
  resolveSceneExperience,
  getSceneExperience,
  getCategoryLabel,
  getPreferredDeviceQuality,
  isNavigationCapable
};

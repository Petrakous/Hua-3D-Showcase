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
    description: "Walk, fly, or orbit around the full Harokopio University campus under bright midday sun. Great for getting your bearings before diving into individual buildings.",
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
          position: { x: 0.1, y: -11.6, z: -0.1 },
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
    description: "The same campus grounds captured at dusk, with warm low-angle light and long shadows across the courtyards.",
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
    description: "The campus after dark, lit by its own building and pathway lighting rather than daylight — a good stress test of the splat renderer's low-light detail.",
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
    description: "The exterior of the Department of Informatics and Telematics (DIT) building, captured at dusk. Orbit around the building or walk its immediate surroundings.",
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
    description: "The main building's central lobby — the widest indoor space in the showcase, and the default entry point when you head indoors. Walk or fly through it to reach other indoor spaces.",
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
    description: "A teaching laboratory in the Diet building used for metabolism-related coursework. Walk between the benches and equipment at ground level, or orbit for a full overview.",
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
    description: "A research and composition ('systasis') space in the Geo building, set up for lab-based coursework and equipment demonstrations.",
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
    description: "The campus fitness and training center, with its full layout of equipment captured in 3D. Walk through it to get a sense of scale that photos alone don't give.",
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
    description: "A standard university lecture classroom, captured as a representative example of the campus's everyday teaching spaces.",
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
    description: "A biology research laboratory, with its benches and equipment preserved at full scale. This scene is splat-only (no GLB mesh), so it's best viewed via the SOG renderer.",
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
    description: "The university's large, tiered lecture theater — one of the biggest indoor volumes in the showcase. Orbit from the stage or walk up through the seating rows.",
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
    description: "Laboratory room 3.3 in the Geo building, a working teaching lab captured with its fittings and equipment in place.",
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
    description: "A teaching kitchen in the Diet building, used for nutritional science and food preparation coursework.",
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

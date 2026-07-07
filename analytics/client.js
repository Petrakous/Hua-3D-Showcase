const ANALYTICS_CONFIG = {
  endpoint: "https://3dhua-analytics.peterkoutroulis2004.workers.dev/track",
  enabled: true,
  heartbeatIntervalMs: 30000,
  maxMetadataBytes: 6000,
  visitorStorageKey: "hua3d.analytics.visitor_id:v1",
};

const ALLOWED_EVENTS = new Set([
  "session_start",
  "page_view",
  "session_heartbeat",
  "session_end",
  "scene_open",
  "scene_loaded",
  "scene_load_failed",
  "lod_selected",
  "quality_changed",
  "hotspot_click",
  "viewer_error",
  "performance_sample",
]);

let initialized = false;
let visitorId = null;
let sessionId = null;
let heartbeatTimer = null;
let sessionStartedAt = 0;
let lastPerformanceSampleAt = 0;
let sceneResolver = () => null;

function safeRandomId(prefix) {
  try {
    if (crypto?.randomUUID) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch (_error) {
    // Fall through to the non-cryptographic fallback.
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function safeLocalStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (_error) {
    // Analytics must not affect the viewer.
  }
}

function getVisitorId() {
  const existing = safeLocalStorageGet(ANALYTICS_CONFIG.visitorStorageKey);
  if (existing) {
    return existing;
  }

  const next = safeRandomId("v");
  safeLocalStorageSet(ANALYTICS_CONFIG.visitorStorageKey, next);
  return next;
}

function getCurrentAnalyticsVisitorId() {
  if (visitorId) {
    return visitorId;
  }

  visitorId = getVisitorId();
  return visitorId;
}

function guessDeviceCategory() {
  const width = Math.min(window.screen?.width || window.innerWidth || 0, window.innerWidth || 0);
  const touch = navigator.maxTouchPoints || 0;
  if (width && width <= 767) return "mobile";
  if ((width && width <= 1100) || touch > 1) return "tablet";
  return "desktop";
}

function summarizeUserAgent() {
  const ua = navigator.userAgent || "";
  const browser =
    ua.includes("Edg/") ? "Edge" :
    ua.includes("Chrome/") ? "Chrome" :
    ua.includes("Firefox/") ? "Firefox" :
    ua.includes("Safari/") ? "Safari" :
    "Other";
  const os =
    ua.includes("Windows") ? "Windows" :
    ua.includes("Android") ? "Android" :
    ua.includes("iPhone") || ua.includes("iPad") ? "iOS/iPadOS" :
    ua.includes("Mac OS") ? "macOS" :
    ua.includes("Linux") ? "Linux" :
    "Other";
  return { browser, os };
}

function getClientMetadata() {
  const ua = summarizeUserAgent();
  return {
    path: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || "",
    screen_width: window.screen?.width || null,
    screen_height: window.screen?.height || null,
    viewport_width: window.innerWidth || null,
    viewport_height: window.innerHeight || null,
    device_category: guessDeviceCategory(),
    browser: ua.browser,
    os: ua.os,
    language: navigator.language || "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  };
}

function normalizeError(error) {
  if (!error) {
    return { error_type: "Error", message: "Unknown error", stack: "" };
  }

  if (error instanceof Error) {
    return {
      error_type: error.name || "Error",
      message: error.message || "Unknown error",
      stack: error.stack || "",
    };
  }

  if (typeof error === "string") {
    return { error_type: "Error", message: error, stack: "" };
  }

  return {
    error_type: error.name || error.type || "Error",
    message: error.message || error.reason?.message || JSON.stringify(error).slice(0, 500),
    stack: error.stack || error.reason?.stack || "",
  };
}

function sanitizeMetadata(metadata = {}) {
  const base = metadata && typeof metadata === "object" ? metadata : { value: metadata };
  const copy = {};

  for (const [key, value] of Object.entries(base)) {
    if (typeof value === "function" || typeof value === "symbol") continue;
    if (typeof value === "string") {
      copy[key] = value.slice(0, 1000);
    } else {
      copy[key] = value;
    }
  }

  try {
    const json = JSON.stringify(copy);
    if (json.length <= ANALYTICS_CONFIG.maxMetadataBytes) {
      return copy;
    }
    return { truncated: true, original_bytes: json.length };
  } catch (_error) {
    return { serialization_error: true };
  }
}

function buildPayload(eventName, metadata = {}) {
  const error = eventName === "viewer_error" || eventName === "scene_load_failed"
    ? normalizeError(metadata.error || metadata)
    : null;
  const safeMetadata = sanitizeMetadata(error ? { ...metadata, error: undefined } : metadata);

  return {
    event_name: eventName,
    visitor_id: visitorId,
    session_id: sessionId,
    scene_id: metadata.scene_id || metadata.sceneId || sceneResolver() || null,
    client_timestamp: new Date().toISOString(),
    client: getClientMetadata(),
    metadata: safeMetadata,
    ...(error ? error : {}),
  };
}

function sendPayload(payload, { beacon = false } = {}) {
  if (!ANALYTICS_CONFIG.enabled || !ANALYTICS_CONFIG.endpoint || !ALLOWED_EVENTS.has(payload.event_name)) {
    return;
  }

  try {
    const body = JSON.stringify(payload);
    if (body.length > 64000) {
      return;
    }

    if (beacon && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ANALYTICS_CONFIG.endpoint, blob)) {
        return;
      }
    }

    fetch(ANALYTICS_CONFIG.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: beacon,
    }).catch(() => {});
  } catch (_error) {
    // Fail-safe by design.
  }
}

function track(eventName, metadata = {}, options = {}) {
  if (!initialized || !ALLOWED_EVENTS.has(eventName)) {
    return;
  }

  sendPayload(buildPayload(eventName, metadata), options);
}

function startHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }

  heartbeatTimer = setInterval(() => {
    if (document.visibilityState !== "visible") {
      return;
    }

    track("session_heartbeat", {
      duration_seconds: Math.round((Date.now() - sessionStartedAt) / 1000),
    });
  }, ANALYTICS_CONFIG.heartbeatIntervalMs);
}

function installLifecycleListeners() {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      track("session_heartbeat", {
        duration_seconds: Math.round((Date.now() - sessionStartedAt) / 1000),
      }, { beacon: true });
    }
  });

  window.addEventListener("pagehide", () => {
    track("session_end", {
      duration_seconds: Math.round((Date.now() - sessionStartedAt) / 1000),
    }, { beacon: true });
  });

  window.addEventListener("error", (event) => {
    trackViewerError(event.error || event.message, {
      source: event.filename || "",
      line: event.lineno || null,
      column: event.colno || null,
      scene_id: sceneResolver(),
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    trackViewerError(event.reason || "Unhandled promise rejection", {
      source: "unhandledrejection",
      scene_id: sceneResolver(),
    });
  });
}

function installCanvasContextLossListener(getCanvas) {
  const bind = () => {
    const canvas = typeof getCanvas === "function" ? getCanvas() : null;
    if (!canvas || canvas.dataset.analyticsContextListener === "1") {
      return;
    }

    canvas.dataset.analyticsContextListener = "1";
    canvas.addEventListener("webglcontextlost", () => {
      trackViewerError(new Error("WebGL context lost"), {
        scene_id: sceneResolver(),
        source: "webglcontextlost",
      });
    }, { passive: true });
  };

  bind();
  setInterval(bind, 5000);
}

function initAnalytics(options = {}) {
  if (initialized || typeof window === "undefined") {
    return;
  }

  if (options.endpoint) {
    ANALYTICS_CONFIG.endpoint = options.endpoint;
  }
  if (options.enabled === false) {
    ANALYTICS_CONFIG.enabled = false;
  }

  sceneResolver = typeof options.getSceneId === "function" ? options.getSceneId : sceneResolver;
  visitorId = getVisitorId();
  sessionId = safeRandomId("s");
  sessionStartedAt = Date.now();
  initialized = true;

  installLifecycleListeners();
  if (options.getCanvas) {
    installCanvasContextLossListener(options.getCanvas);
  }

  track("session_start");
  trackPageView();
  startHeartbeat();
}

function trackPageView(metadata = {}) {
  track("page_view", metadata);
}

function trackSceneOpen(sceneId, metadata = {}) {
  track("scene_open", { ...metadata, scene_id: sceneId });
}

function trackSceneLoaded(sceneId, metadata = {}) {
  track("scene_loaded", { ...metadata, scene_id: sceneId });
}

function trackSceneLoadFailed(sceneId, error, metadata = {}) {
  track("scene_load_failed", { ...metadata, scene_id: sceneId, error });
}

function trackLodSelected(sceneId, lod, metadata = {}) {
  track("lod_selected", { ...metadata, scene_id: sceneId, lod });
}

function trackQualityChanged(value, metadata = {}) {
  track("quality_changed", { ...metadata, value });
}

function trackHotspotClick(hotspotId, metadata = {}) {
  track("hotspot_click", { ...metadata, hotspot_id: hotspotId });
}

function trackViewerError(error, metadata = {}) {
  track("viewer_error", { ...metadata, error });
}

function trackPerformanceSample(metadata = {}) {
  const now = Date.now();
  if (now - lastPerformanceSampleAt < 30000) {
    return;
  }
  lastPerformanceSampleAt = now;
  track("performance_sample", metadata);
}

export {
  ANALYTICS_CONFIG,
  getCurrentAnalyticsVisitorId,
  initAnalytics,
  trackPageView,
  trackSceneOpen,
  trackSceneLoaded,
  trackSceneLoadFailed,
  trackLodSelected,
  trackQualityChanged,
  trackHotspotClick,
  trackViewerError,
  trackPerformanceSample,
};

const DEBUG_FLAG_KEY = "hua3d.debugLogs";
const LEVELS = new Set(["debug", "info", "warn", "error"]);

let contextProvider = () => ({});

function safeLocalStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (_error) {
    return null;
  }
}

function debugEnabled() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1" || params.get("logs") === "verbose") {
      return true;
    }
  } catch (_error) {}

  const flag = safeLocalStorageGet(DEBUG_FLAG_KEY);
  return flag === "1" || flag === "true" || flag === "verbose";
}

function summarizeDevice() {
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

  return {
    browser,
    os,
    touch: navigator.maxTouchPoints || 0,
    memoryGb: Number.isFinite(navigator.deviceMemory) ? navigator.deviceMemory : null,
    cores: Number.isFinite(navigator.hardwareConcurrency) ? navigator.hardwareConcurrency : null,
  };
}

function sanitizeDetails(value, depth = 0) {
  if (value == null || depth > 3) {
    return value ?? null;
  }

  if (value instanceof Error) {
    return {
      name: value.name || "Error",
      message: value.message || "Unknown error",
      stack: value.stack || "",
    };
  }

  if (typeof value === "string") {
    return value
      .replace(/([?&](?:token|key|signature|sig|auth|password|secret)=)[^&\s]+/gi, "$1[redacted]")
      .slice(0, 1200);
  }

  if (typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => sanitizeDetails(item, depth + 1));
  }

  const copy = {};
  for (const [key, item] of Object.entries(value)) {
    if (/token|password|secret|signature|authorization/i.test(key)) {
      copy[key] = "[redacted]";
      continue;
    }
    copy[key] = sanitizeDetails(item, depth + 1);
  }
  return copy;
}

function buildEntry(level, category, message, details = null, error = null) {
  const context = typeof contextProvider === "function" ? contextProvider() || {} : {};
  return {
    timestamp: new Date().toISOString(),
    level,
    category: category || "app",
    message: String(message || ""),
    sceneId: context.sceneId || null,
    sceneName: context.sceneName || null,
    format: context.format || null,
    mode: context.mode || null,
    device: summarizeDevice(),
    details: sanitizeDetails(details),
    error: error ? sanitizeDetails(error) : null,
  };
}

function write(level, category, message, details = null, error = null) {
  const normalizedLevel = LEVELS.has(level) ? level : "info";
  if (normalizedLevel === "debug" && !debugEnabled()) {
    return null;
  }

  const entry = buildEntry(normalizedLevel, category, message, details, error);
  const method = normalizedLevel === "debug" ? "debug" : normalizedLevel;
  const label = `[hua3d:${entry.category}] ${entry.message}`;
  (console[method] || console.log)(label, entry);
  return entry;
}

function setLoggerContextProvider(provider) {
  contextProvider = typeof provider === "function" ? provider : () => ({});
}

const logger = {
  debug: (category, message, details = null) => write("debug", category, message, details),
  info: (category, message, details = null) => write("info", category, message, details),
  warn: (category, message, details = null, error = null) => write("warn", category, message, details, error),
  error: (category, message, details = null, error = null) => write("error", category, message, details, error),
  isDebugEnabled: debugEnabled,
};

export { DEBUG_FLAG_KEY, logger, setLoggerContextProvider };

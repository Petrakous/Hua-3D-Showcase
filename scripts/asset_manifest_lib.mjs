import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_MANIFEST_PATH = "assets/manifest.json";

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, "");
}

function joinUrl(baseUrl, key) {
  return `${baseUrl.replace(/\/+$/g, "")}/${trimSlashes(key)}`;
}

function getRemoteBaseUrl(manifest) {
  return manifest.assetBases?.remote || manifest.assetBaseUrl;
}

function getAssetPath(asset) {
  return asset.assetPath || asset.r2Key;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "missing";
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}

async function pathExists(fullPath) {
  try {
    await fs.access(fullPath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function listFilesRecursive(folder) {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function readManifest(manifestPath = DEFAULT_MANIFEST_PATH) {
  const raw = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(raw);
}

async function expandManifestAssets({ manifestPath = DEFAULT_MANIFEST_PATH, sceneIds = null } = {}) {
  const manifest = await readManifest(manifestPath);
  const root = process.cwd();
  const selectedSceneIds = sceneIds?.length ? sceneIds : Object.keys(manifest.scenes || {});
  const rows = [];
  const missing = [];

  for (const sceneId of selectedSceneIds) {
    const scene = manifest.scenes?.[sceneId];
    if (!scene) {
      missing.push({ sceneId, reason: "scene-not-found" });
      continue;
    }

    for (const asset of scene.assets || []) {
      const assetPath = getAssetPath(asset);
      const source = path.resolve(root, asset.localSource);
      const sourceExists = await pathExists(source);

      if (!sourceExists) {
        missing.push({
          sceneId,
          assetId: asset.id,
          sourcePath: asset.localSource,
          reason: "source-missing",
        });
        rows.push({
          sceneId,
          sceneLabel: scene.label,
          assetId: asset.id,
          role: asset.role,
          type: asset.type,
          sourcePath: asset.localSource,
          stagedPath: path.join(manifest.stagingRoot || "dist-r2-assets", assetPath),
          assetPath,
          r2Key: asset.r2Key || assetPath,
          r2Url: joinUrl(getRemoteBaseUrl(manifest), assetPath),
          bytes: null,
          size: "missing",
          exists: false,
        });
        continue;
      }

      const stat = await fs.stat(source);

      if (asset.type === "tree") {
        if (!stat.isDirectory()) {
          missing.push({
            sceneId,
            assetId: asset.id,
            sourcePath: asset.localSource,
            reason: "source-not-directory",
          });
          continue;
        }

        const files = await listFilesRecursive(source);
        for (const file of files) {
          const fileStat = await fs.stat(file);
          const relativeToAsset = toPosixPath(path.relative(source, file));
          const resolvedAssetPath = `${trimSlashes(assetPath)}/${relativeToAsset}`;
          rows.push({
            sceneId,
            sceneLabel: scene.label,
            assetId: asset.id,
            role: asset.role,
            type: "file",
            sourcePath: toPosixPath(path.relative(root, file)),
            stagedPath: toPosixPath(path.join(manifest.stagingRoot || "dist-r2-assets", resolvedAssetPath)),
            assetPath: resolvedAssetPath,
            r2Key: resolvedAssetPath,
            r2Url: joinUrl(getRemoteBaseUrl(manifest), resolvedAssetPath),
            bytes: fileStat.size,
            size: formatBytes(fileStat.size),
            exists: true,
          });
        }
      } else {
        if (!stat.isFile()) {
          missing.push({
            sceneId,
            assetId: asset.id,
            sourcePath: asset.localSource,
            reason: "source-not-file",
          });
          continue;
        }

        rows.push({
          sceneId,
          sceneLabel: scene.label,
          assetId: asset.id,
          role: asset.role,
          type: "file",
          sourcePath: asset.localSource,
          stagedPath: toPosixPath(path.join(manifest.stagingRoot || "dist-r2-assets", assetPath)),
          assetPath,
          r2Key: asset.r2Key || assetPath,
          r2Url: joinUrl(getRemoteBaseUrl(manifest), assetPath),
          bytes: stat.size,
          size: formatBytes(stat.size),
          exists: true,
        });
      }
    }
  }

  rows.sort((a, b) => a.sceneId.localeCompare(b.sceneId) || a.assetPath.localeCompare(b.assetPath));

  const { errors, warnings } = await validateManifestAndCrossSource(manifest, manifestPath, rows, missing);

  return { manifest, rows, missing, errors, warnings };
}

function parseArgs(argv) {
  const args = {
    manifestPath: DEFAULT_MANIFEST_PATH,
    sceneIds: null,
    json: false,
    execute: false,
    force: false,
    verify: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") {
      args.manifestPath = argv[++index];
    } else if (arg === "--scene") {
      args.sceneIds = [...(args.sceneIds || []), argv[++index]];
    } else if (arg === "--pilot") {
      args.sceneIds = null;
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--execute") {
      args.execute = true;
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg === "--verify") {
      args.verify = true;
    }
  }

  return args;
}

function summarizeRows(rows) {
  const byScene = new Map();
  for (const row of rows) {
    const current = byScene.get(row.sceneId) || {
      sceneId: row.sceneId,
      sceneLabel: row.sceneLabel,
      files: 0,
      bytes: 0,
    };
    current.files += row.exists ? 1 : 0;
    current.bytes += row.bytes || 0;
    byScene.set(row.sceneId, current);
  }

  return [...byScene.values()].map((entry) => ({
    ...entry,
    size: formatBytes(entry.bytes),
  }));
}

async function validateManifestAndCrossSource(manifest, manifestPath, rows, missing) {
  const errors = [];
  const warnings = [];

  // 1. Validate top-level schema
  if (!manifest) {
    errors.push({ type: "schema", message: "Manifest is empty or invalid JSON." });
    return { errors, warnings };
  }

  if (typeof manifest.version !== "number") {
    errors.push({ type: "schema", message: "Top-level 'version' is missing or not a number." });
  }
  if (typeof manifest.name !== "string") {
    errors.push({ type: "schema", message: "Top-level 'name' is missing or not a string." });
  }

  const hasBaseUrl = typeof manifest.assetBaseUrl === "string";
  const hasBases = manifest.assetBases &&
                    typeof manifest.assetBases.local === "string" &&
                    typeof manifest.assetBases.remote === "string";
  if (!hasBaseUrl && !hasBases) {
    errors.push({ type: "schema", message: "Manifest must define 'assetBaseUrl' or 'assetBases' with local and remote bases." });
  }

  if (typeof manifest.stagingRoot !== "string") {
    errors.push({ type: "schema", message: "Top-level 'stagingRoot' is missing or not a string." });
  }

  if (!Array.isArray(manifest.activeScenes)) {
    errors.push({ type: "schema", message: "Top-level 'activeScenes' is missing or not an array." });
  }

  if (!manifest.scenes || typeof manifest.scenes !== "object" || Array.isArray(manifest.scenes)) {
    errors.push({ type: "schema", message: "Top-level 'scenes' is missing or not an object." });
  }

  // 2. Validate duplicate scene IDs in activeScenes / pilotScenes
  if (Array.isArray(manifest.activeScenes)) {
    const seenActive = new Set();
    for (const id of manifest.activeScenes) {
      if (typeof id !== "string") {
        errors.push({ type: "schema", message: `activeScenes contains a non-string value: ${id}` });
        continue;
      }
      if (seenActive.has(id)) {
        errors.push({ type: "duplicate-scene", id, message: `Duplicate scene ID '${id}' in activeScenes.` });
      }
      seenActive.add(id);
    }
  }
  if (Array.isArray(manifest.pilotScenes)) {
    const seenPilot = new Set();
    for (const id of manifest.pilotScenes) {
      if (typeof id !== "string") {
        errors.push({ type: "schema", message: `pilotScenes contains a non-string value: ${id}` });
        continue;
      }
      if (seenPilot.has(id)) {
        errors.push({ type: "duplicate-scene", id, message: `Duplicate scene ID '${id}' in pilotScenes.` });
      }
      seenPilot.add(id);
    }
  }

  // 3. Unsafe path checks helper
  const checkUnsafePath = (pathVal, fieldName, context) => {
    if (!pathVal) {
      errors.push({ type: "unsafe-path", ...context, message: `Path field '${fieldName}' is empty.` });
      return;
    }
    // Absolute paths
    if (pathVal.startsWith("/") || pathVal.startsWith("\\") || /^[a-zA-Z]:/.test(pathVal)) {
      errors.push({ type: "unsafe-path", ...context, message: `Path field '${fieldName}' ('${pathVal}') is absolute.` });
    }
    // Traversal
    if (pathVal.includes("..")) {
      errors.push({ type: "unsafe-path", ...context, message: `Path field '${fieldName}' ('${pathVal}') contains parent traversal '..'.` });
    }
  };

  // Malformed remote key checks
  const checkRemoteKey = (keyVal, fieldName, context) => {
    if (!keyVal) {
      errors.push({ type: "malformed-remote-key", ...context, message: `Remote key '${fieldName}' is empty.` });
      return;
    }
    if (keyVal.startsWith("/")) {
      errors.push({ type: "malformed-remote-key", ...context, message: `Remote key '${fieldName}' ('${keyVal}') starts with a slash.` });
    }
    if (keyVal.includes("\\")) {
      errors.push({ type: "malformed-remote-key", ...context, message: `Remote key '${fieldName}' ('${keyVal}') contains backslashes.` });
    }
  };

  // 4. Validate scenes and assets properties
  const manifestSceneIds = manifest.scenes ? Object.keys(manifest.scenes) : [];
  if (manifest.scenes) {
    for (const [sceneId, scene] of Object.entries(manifest.scenes)) {
      if (!scene || typeof scene !== "object" || Array.isArray(scene)) {
        errors.push({ type: "schema", sceneId, message: `Scene '${sceneId}' is not a valid object.` });
        continue;
      }
      if (typeof scene.label !== "string") {
        errors.push({ type: "schema", sceneId, message: `Scene '${sceneId}' is missing 'label' or label is not a string.` });
      }
      if (!Array.isArray(scene.assets)) {
        errors.push({ type: "schema", sceneId, message: `Scene '${sceneId}' 'assets' is missing or not an array.` });
        continue;
      }

      // Check duplicate assets in this scene
      const seenAssetIds = new Set();
      for (const asset of scene.assets) {
        if (!asset || typeof asset !== "object") {
          errors.push({ type: "schema", sceneId, message: "Asset entry is not an object." });
          continue;
        }

        // Validate required fields
        if (typeof asset.id !== "string") {
          errors.push({ type: "schema", sceneId, message: "Asset is missing 'id' or id is not a string." });
        } else {
          if (seenAssetIds.has(asset.id)) {
            errors.push({ type: "duplicate-asset", sceneId, assetId: asset.id, message: `Duplicate asset ID '${asset.id}' in scene '${sceneId}'.` });
          }
          seenAssetIds.add(asset.id);
        }

        if (typeof asset.role !== "string") {
          errors.push({ type: "schema", sceneId, assetId: asset.id, message: "Asset is missing 'role' or role is not a string." });
        }
        if (asset.type !== "file" && asset.type !== "tree") {
          errors.push({ type: "schema", sceneId, assetId: asset.id, message: `Asset type must be 'file' or 'tree', got '${asset.type}'.` });
        }
        if (typeof asset.localSource !== "string") {
          errors.push({ type: "schema", sceneId, assetId: asset.id, message: "Asset is missing 'localSource' or localSource is not a string." });
        } else {
          checkUnsafePath(asset.localSource, "localSource", { sceneId, assetId: asset.id });
        }

        const assetPath = asset.assetPath || asset.r2Key;
        if (typeof assetPath !== "string") {
          errors.push({ type: "schema", sceneId, assetId: asset.id, message: "Asset is missing both 'assetPath' and 'r2Key'." });
        } else {
          checkRemoteKey(asset.assetPath || asset.r2Key, "assetPath/r2Key", { sceneId, assetId: asset.id });
        }
      }
    }
  }

  // 5. Detect duplicate R2 keys / remote keys
  const r2KeyToAssets = new Map();
  for (const row of rows) {
    if (!row.r2Key) continue;
    const key = row.r2Key;
    const current = r2KeyToAssets.get(key) || [];
    current.push(row);
    r2KeyToAssets.set(key, current);
  }
  for (const [key, assets] of r2KeyToAssets.entries()) {
    if (assets.length > 1) {
      const descriptions = assets.map(a => `${a.sceneId}:${a.assetId || "unnamed"} (${a.sourcePath})`).join(", ");
      errors.push({
        type: "duplicate-r2-key",
        key,
        message: `Duplicate staging destination R2 key '${key}' maps to multiple assets: ${descriptions}`
      });
    }
  }

  const root = process.cwd();

  // 6. Cross-check manifest active scenes against sceneCatalog.js
  let catalogSceneIds = new Set();
  const originalFetch = globalThis.fetch;
  try {
    // Stub global fetch to prevent relative URL parse errors in Node.js
    globalThis.fetch = async (url) => {
      try {
        const raw = await fs.readFile(path.resolve(root, "assets/manifest.json"), "utf8");
        return {
          ok: true,
          json: async () => JSON.parse(raw)
        };
      } catch (e) {
        return { ok: false, status: 404 };
      }
    };

    // Suppress console info output of sceneCatalog.js during import
    const originalInfo = console.info;
    console.info = () => {};
    const catalogUrl = pathToFileURL(path.resolve(root, "viewer/sceneCatalog.js")).href;
    const { LOCATION_CATALOG } = await import(catalogUrl);
    console.info = originalInfo;

    if (LOCATION_CATALOG) {
      for (const loc of Object.values(LOCATION_CATALOG)) {
        if (loc.stages) {
          catalogSceneIds.add("campus-day");
          catalogSceneIds.add("campus-dusk");
          catalogSceneIds.add("campus-night");
        }
        if (loc.scenes && Array.isArray(loc.scenes)) {
          for (const scene of loc.scenes) {
            if (scene.id) catalogSceneIds.add(scene.id);
          }
        }
        if (loc.scene && loc.scene.id) {
          catalogSceneIds.add(loc.scene.id);
        }
      }
    }
  } catch (err) {
    warnings.push({ type: "catalog-check", message: `Could not load viewer/sceneCatalog.js for cross-checking: ${err.message}` });
  } finally {
    globalThis.fetch = originalFetch;
  }

  if (catalogSceneIds.size > 0) {
    const activeScenesSet = new Set(manifest.activeScenes || []);
    const pilotScenesSet = new Set(manifest.pilotScenes || []);

    // Catalog scenes missing from activeScenes
    for (const catId of catalogSceneIds) {
      if (!activeScenesSet.has(catId)) {
        if (pilotScenesSet.has(catId)) {
          // Intentionally pilot/inactive
        } else {
          warnings.push({
            type: "catalog-check",
            sceneId: catId,
            message: `Catalog scene '${catId}' is missing from manifest's activeScenes (and not marked as pilot).`
          });
        }
      }
    }

    // Active scenes missing from catalog
    for (const actId of activeScenesSet) {
      if (!catalogSceneIds.has(actId)) {
        errors.push({
          type: "catalog-check",
          sceneId: actId,
          message: `Manifest active scene '${actId}' does not exist in viewer/sceneCatalog.js.`
        });
      }
    }
  }

  // 7. Cross-check viewer/sceneCalibrations.js
  try {
    const calibrationsUrl = pathToFileURL(path.resolve(root, "viewer/sceneCalibrations.js")).href;
    const { SCENE_CALIBRATION_DEFAULTS } = await import(calibrationsUrl);
    if (SCENE_CALIBRATION_DEFAULTS) {
      const validateCalibrationKeys = (sectionName, sectionObj) => {
        if (!sectionObj) return;
        for (const key of Object.keys(sectionObj)) {
          const parts = key.split(":");
          const sceneId = parts[parts.length - 1];
          // Check if this scene ID exists in catalog or manifest
          const existsInCatalog = catalogSceneIds.has(sceneId);
          const existsInManifest = manifestSceneIds.includes(sceneId);
          if (catalogSceneIds.size > 0 && !existsInCatalog && !existsInManifest) {
            warnings.push({
              type: "calibration-check",
              key,
              message: `Calibration key '${key}' in SCENE_CALIBRATION_DEFAULTS.${sectionName} refers to non-existent scene ID '${sceneId}'.`
            });
          }
        }
      };

      validateCalibrationKeys("streamedTransforms", SCENE_CALIBRATION_DEFAULTS.streamedTransforms);
      validateCalibrationKeys("manualBoxOverrides", SCENE_CALIBRATION_DEFAULTS.manualBoxOverrides);
    }
  } catch (err) {
    warnings.push({ type: "calibration-check", message: `Could not load viewer/sceneCalibrations.js for cross-checking: ${err.message}` });
  }

  // 8. Add local source file errors from `missing` array
  for (const m of missing) {
    errors.push({
      type: "source-missing",
      sceneId: m.sceneId,
      assetId: m.assetId,
      message: `Local source path is missing or of incorrect type: ${m.sourcePath || m.sceneId} (${m.reason})`
    });
  }

  // 9. Cross-check viewer/sceneExperience.js
  try {
    const experienceUrl = pathToFileURL(path.resolve(root, "viewer/sceneExperience.js")).href;
    const { SCENE_EXPERIENCES } = await import(experienceUrl);

    if (SCENE_EXPERIENCES) {
      const activeScenesSet = new Set(manifest.activeScenes || []);
      const pilotScenesSet = new Set(manifest.pilotScenes || []);
      const allActiveAndPilot = new Set([...activeScenesSet, ...pilotScenesSet]);

      // Verify every active scene has an experience entry
      for (const sceneId of allActiveAndPilot) {
        if (!SCENE_EXPERIENCES[sceneId]) {
          errors.push({
            type: "experience-check",
            sceneId,
            message: `Active/pilot scene '${sceneId}' is missing experience metadata in viewer/sceneExperience.js.`
          });
        }
      }

      // Validate each experience entry
      const validCategories = ["outdoor", "indoor", "lab"];
      for (const [expId, exp] of Object.entries(SCENE_EXPERIENCES)) {
        if (exp.id !== expId) {
          errors.push({
            type: "experience-check",
            sceneId: expId,
            message: `Experience key '${expId}' does not match experience ID '${exp.id}'.`
          });
        }

        // Must exist in catalog
        if (catalogSceneIds.size > 0 && !catalogSceneIds.has(expId)) {
          errors.push({
            type: "experience-check",
            sceneId: expId,
            message: `Scene experience ID '${expId}' does not exist in viewer/sceneCatalog.js.`
          });
        }

        // Category is valid
        if (exp.category && !validCategories.includes(exp.category)) {
          errors.push({
            type: "experience-check",
            sceneId: expId,
            message: `Experience category '${exp.category}' is invalid. Expected one of: ${validCategories.join(", ")}`
          });
        }

        // Defaults checks
        if (exp.defaults) {
          if (exp.defaults.format && !["glb", "sog", "splat"].includes(exp.defaults.format)) {
            errors.push({
              type: "experience-check",
              sceneId: expId,
              message: `Experience preferred format '${exp.defaults.format}' is invalid.`
            });
          }
          if (exp.defaults.sogRuntime && !["playcanvas", "luma"].includes(exp.defaults.sogRuntime)) {
            errors.push({
              type: "experience-check",
              sceneId: expId,
              message: `Experience SOG runtime '${exp.defaults.sogRuntime}' is invalid.`
            });
          }
        }

        // Navigation check (must be boolean flags)
        if (exp.navigation) {
          for (const [navKey, val] of Object.entries(exp.navigation)) {
            if (navKey !== "defaultMode" && typeof val !== "boolean") {
              errors.push({
                type: "experience-check",
                sceneId: expId,
                message: `Navigation flag '${navKey}' must be a boolean.`
              });
            }
          }
        }

        // Fallbacks checks
        if (exp.fallbacks) {
          if (exp.fallbacks.preferredOrder && !Array.isArray(exp.fallbacks.preferredOrder)) {
            errors.push({
              type: "experience-check",
              sceneId: expId,
              message: `Fallbacks preferredOrder must be an array.`
            });
          }
        }

        // Future hooks structure
        if (exp.future) {
          if (exp.future.hotspots && !Array.isArray(exp.future.hotspots)) {
            errors.push({
              type: "experience-check",
              sceneId: expId,
              message: `Future hotspot hook must be an array.`
            });
          }
          if (exp.future.portals && !Array.isArray(exp.future.portals)) {
            errors.push({
              type: "experience-check",
              sceneId: expId,
              message: `Future portals hook must be an array.`
            });
          }
        }
      }
    }
  } catch (err) {
    errors.push({
      type: "experience-check",
      message: `Failed to load or validate viewer/sceneExperience.js: ${err.message}`
    });
  }

  return { errors, warnings };
}

export {
  DEFAULT_MANIFEST_PATH,
  expandManifestAssets,
  formatBytes,
  joinUrl,
  parseArgs,
  readManifest,
  summarizeRows,
  toPosixPath,
};

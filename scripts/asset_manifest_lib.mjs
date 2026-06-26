import fs from "node:fs/promises";
import path from "node:path";

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

  return { manifest, rows, missing };
}

function parseArgs(argv) {
  const args = {
    manifestPath: DEFAULT_MANIFEST_PATH,
    sceneIds: null,
    json: false,
    execute: false,
    force: false,
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

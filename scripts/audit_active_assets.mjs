#!/usr/bin/env node
import { expandManifestAssets, parseArgs, summarizeRows } from "./asset_manifest_lib.mjs";

const args = parseArgs(process.argv.slice(2));
const { manifest, rows, missing } = await expandManifestAssets({
  manifestPath: args.manifestPath,
  sceneIds: args.sceneIds || undefined,
});

const summary = summarizeRows(rows);

if (args.json) {
  console.log(JSON.stringify({ summary, missing, rows }, null, 2));
} else {
  console.log(`Manifest: ${args.manifestPath}`);
  console.log(`Asset base URL: ${manifest.assetBaseUrl}`);
  console.log("");
  console.table(summary);

  if (missing.length) {
    console.log("");
    console.log("Missing sources:");
    console.table(missing);
  }

  console.log("");
  console.log("Detailed asset report:");
  console.table(rows.map((row) => ({
    scene: row.sceneId,
    source: row.sourcePath,
    staged: row.stagedPath,
    url: row.r2Url,
    size: row.size,
    exists: row.exists,
  })));
}

process.exitCode = missing.length ? 1 : 0;

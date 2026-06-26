#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { expandManifestAssets, parseArgs, summarizeRows } from "./asset_manifest_lib.mjs";

const args = parseArgs(process.argv.slice(2));
const { manifest, rows, missing } = await expandManifestAssets({
  manifestPath: args.manifestPath,
  sceneIds: args.sceneIds || undefined,
});

if (missing.length) {
  console.log("Upload dry-run aborted because manifest validation found missing sources:");
  console.table(missing);
  process.exit(1);
}

const summary = summarizeRows(rows);
console.table(summary);
console.log("");

if (!args.execute) {
  console.log("Dry run only. No files were uploaded.");
  console.log("Run with --execute after R2 credentials and AWS CLI configuration are ready.");
  console.table(rows.map((row) => ({
    source: row.stagedPath,
    r2Key: row.r2Key,
    url: row.r2Url,
    size: row.size,
  })));
  process.exit(0);
}

const bucket = process.env.R2_BUCKET || "hua-3d-assets";
const endpoint = process.env.R2_ENDPOINT;

if (!endpoint) {
  console.error("Missing R2_ENDPOINT. Refusing to upload.");
  process.exit(1);
}

for (const row of rows) {
  const result = spawnSync("aws", [
    "s3",
    "cp",
    row.stagedPath,
    `s3://${bucket}/${row.r2Key}`,
    "--endpoint-url",
    endpoint,
    "--only-show-errors",
  ], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    console.error(`Upload failed for ${row.stagedPath}`);
    process.exit(result.status || 1);
  }
}

console.log(`Uploaded ${rows.length} files to ${manifest.assetBaseUrl}`);

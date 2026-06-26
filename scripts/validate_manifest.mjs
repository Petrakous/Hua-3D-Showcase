#!/usr/bin/env node
import { expandManifestAssets, parseArgs, summarizeRows } from "./asset_manifest_lib.mjs";

const args = parseArgs(process.argv.slice(2));
const { rows, missing } = await expandManifestAssets({
  manifestPath: args.manifestPath,
  sceneIds: args.sceneIds || undefined,
});

const summary = summarizeRows(rows);

if (args.json) {
  console.log(JSON.stringify({ valid: missing.length === 0, summary, missing }, null, 2));
} else {
  console.table(summary);

  if (missing.length) {
    console.log("");
    console.log("Manifest validation failed. Missing or invalid local sources:");
    console.table(missing);
  } else {
    console.log("");
    console.log(`Manifest validation passed for ${rows.length} files.`);
  }
}

process.exitCode = missing.length ? 1 : 0;

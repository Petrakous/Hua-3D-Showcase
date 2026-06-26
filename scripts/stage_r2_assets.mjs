#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { expandManifestAssets, parseArgs, summarizeRows } from "./asset_manifest_lib.mjs";

const args = parseArgs(process.argv.slice(2));
const { rows, missing } = await expandManifestAssets({
  manifestPath: args.manifestPath,
  sceneIds: args.sceneIds || undefined,
});

if (missing.length) {
  console.log("Staging aborted because manifest validation found missing sources:");
  console.table(missing);
  process.exit(1);
}

const staged = [];
const skipped = [];

for (const row of rows) {
  const source = path.resolve(process.cwd(), row.sourcePath);
  const destination = path.resolve(process.cwd(), row.stagedPath);

  await fs.mkdir(path.dirname(destination), { recursive: true });

  let shouldCopy = args.force;
  try {
    const existing = await fs.stat(destination);
    if (existing.size !== row.bytes) {
      shouldCopy = true;
    }
  } catch (_error) {
    shouldCopy = true;
  }

  if (shouldCopy) {
    await fs.copyFile(source, destination);
    staged.push(row);
  } else {
    skipped.push(row);
  }
}

const summary = summarizeRows(rows);

if (args.json) {
  console.log(JSON.stringify({
    summary,
    staged: staged.length,
    skipped: skipped.length,
    rows,
  }, null, 2));
} else {
  console.table(summary);
  console.log("");
  console.log(`Staged ${staged.length} files. Skipped ${skipped.length} already-matching files.`);
  console.log("");
  console.log("Staging report:");
  console.table(rows.map((row) => ({
    scene: row.sceneId,
    source: row.sourcePath,
    staged: row.stagedPath,
    url: row.r2Url,
    size: row.size,
  })));
}

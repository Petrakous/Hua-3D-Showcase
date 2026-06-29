#!/usr/bin/env node
import { expandManifestAssets, parseArgs, summarizeRows } from "./asset_manifest_lib.mjs";

const args = parseArgs(process.argv.slice(2));
const { rows, missing, errors, warnings } = await expandManifestAssets({
  manifestPath: args.manifestPath,
  sceneIds: args.sceneIds || undefined,
});

const summary = summarizeRows(rows);

const totalErrors = errors ? errors.length : 0;
const totalWarnings = warnings ? warnings.length : 0;
const isValid = totalErrors === 0;

if (args.json) {
  console.log(
    JSON.stringify(
      {
        valid: isValid,
        summary,
        errors: errors || [],
        warnings: warnings || [],
        missing,
      },
      null,
      2
    )
  );
} else {
  console.table(summary);

  if (totalWarnings > 0) {
    console.log("");
    console.log(`\x1b[33mManifest validation warnings (${totalWarnings}):\x1b[0m`);
    console.table(warnings);
  }

  if (totalErrors > 0) {
    console.log("");
    console.log(`\x1b[31mManifest validation failed. Errors (${totalErrors}):\x1b[0m`);
    console.table(errors);
  } else {
    console.log("");
    console.log(`\x1b[32mManifest validation passed for ${rows.length} files.\x1b[0m`);
  }
}

process.exitCode = isValid ? 0 : 1;

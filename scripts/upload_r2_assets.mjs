#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { expandManifestAssets, parseArgs, formatBytes, summarizeRows } from "./asset_manifest_lib.mjs";

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html": return "text/html; charset=utf-8";
    case ".js": return "application/javascript; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".json": return "application/json; charset=utf-8";
    case ".glb": return "model/gltf-binary";
    case ".sog": return "application/octet-stream";
    case ".ply": return "application/octet-stream";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".svg": return "image/svg+xml";
    case ".wasm": return "application/wasm";
    case ".txt": return "text/plain; charset=utf-8";
    default: return "application/octet-stream";
  }
}

function getCacheControl(filePath) {
  const filename = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();

  if (filename === "manifest.json" || filename === "lod-meta.json" || filename === "meta.json" || ext === ".html") {
    return "no-cache, no-store, must-revalidate";
  }

  return "public, max-age=31536000, immutable";
}

function computeSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (err) => reject(err));
  });
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const { manifest, rows, missing } = await expandManifestAssets({
    manifestPath: args.manifestPath,
    sceneIds: args.sceneIds || undefined,
  });

  if (missing.length) {
    console.log("Upload flow aborted because manifest validation found missing sources:");
    console.table(missing);
    process.exit(1);
  }

  const summary = summarizeRows(rows);
  console.table(summary);
  console.log("");

  // Post-Upload Verification Mode
  if (args.verify) {
    console.log("Starting post-upload verification via HEAD requests to public CDN/R2 URLs...");
    let passedCount = 0;
    let failedCount = 0;

    for (const row of rows) {
      const contentType = getContentType(row.stagedPath);
      const cacheControl = getCacheControl(row.stagedPath);
      const localHash = await computeSha256(row.stagedPath);

      try {
        const res = await fetch(row.r2Url, { method: "HEAD" });
        if (!res.ok) {
          console.error(`\x1b[31m[FAIL]\x1b[0m ${row.r2Key}: HTTP ${res.status} ${res.statusText}`);
          failedCount++;
          continue;
        }

        const remoteSize = parseInt(res.headers.get("content-length"), 10);
        const remoteType = res.headers.get("content-type");
        const remoteCache = res.headers.get("cache-control");
        const remoteHash = res.headers.get("x-amz-meta-sha256");

        const sizeMatch = remoteSize === row.bytes;
        const hashMatch = remoteHash ? remoteHash === localHash : null;

        if (!sizeMatch) {
          console.error(`\x1b[31m[FAIL]\x1b[0m ${row.r2Key}: Size mismatch (local: ${row.bytes}, remote: ${remoteSize})`);
          failedCount++;
        } else if (hashMatch === false) {
          console.error(`\x1b[31m[FAIL]\x1b[0m ${row.r2Key}: Checksum mismatch (local: ${localHash}, remote: ${remoteHash})`);
          failedCount++;
        } else {
          let details = `size matches (${row.size})`;
          if (remoteHash) details += `, sha256 matches`;
          if (remoteType && remoteType !== contentType) details += `, warning: content-type mismatch (expected: ${contentType}, got: ${remoteType})`;
          if (remoteCache && remoteCache !== cacheControl) details += `, warning: cache-control mismatch (expected: ${cacheControl}, got: ${remoteCache})`;

          console.log(`\x1b[32m[PASS]\x1b[0m ${row.r2Key}: ${details}`);
          passedCount++;
        }
      } catch (e) {
        console.error(`\x1b[31m[FAIL]\x1b[0m ${row.r2Key}: Connection error: ${e.message}`);
        failedCount++;
      }
    }

    console.log(`\nVerification finished: ${passedCount} passed, ${failedCount} failed.`);
    process.exit(failedCount > 0 ? 1 : 0);
  }

  // Calculate local metadata for reports/dry-runs
  console.log("Analyzing local assets and computing checksums...");
  const enrichedRows = [];
  let totalBytes = 0;

  for (const row of rows) {
    const contentType = getContentType(row.stagedPath);
    const cacheControl = getCacheControl(row.stagedPath);
    const sha256 = await computeSha256(row.stagedPath);
    totalBytes += row.bytes || 0;

    enrichedRows.push({
      ...row,
      contentType,
      cacheControl,
      sha256,
    });
  }

  // Create Local Upload Report JSON
  const report = {
    timestamp: new Date().toISOString(),
    execute: !!args.execute,
    fileCount: enrichedRows.length,
    totalBytes,
    totalSize: formatBytes(totalBytes),
    files: enrichedRows.map((row) => ({
      source: row.stagedPath,
      r2Key: row.r2Key,
      bytes: row.bytes,
      size: row.size,
      contentType: row.contentType,
      cacheControl: row.cacheControl,
      sha256: row.sha256,
    })),
  };

  const reportPath = path.resolve(process.cwd(), "upload_report.json");
  await fsPromises.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  // Dry-Run Mode
  if (!args.execute) {
    console.log("Dry run only. No files were uploaded.");
    console.log("Run with --execute after R2 credentials and AWS CLI configuration are ready.");
    console.log(`Local deployment report written to: ${reportPath}\n`);

    console.table(
      enrichedRows.map((row) => ({
        source: row.stagedPath,
        r2Key: row.r2Key,
        size: row.size,
        contentType: row.contentType,
        cacheControl: row.cacheControl,
        sha256: row.sha256.substring(0, 8) + "...",
      }))
    );
    process.exit(0);
  }

  // Real Upload Execution Mode
  const bucket = process.env.R2_BUCKET || "hua-3d-assets";
  const endpoint = process.env.R2_ENDPOINT;

  if (!endpoint) {
    console.error("Missing R2_ENDPOINT. Refusing to upload.");
    process.exit(1);
  }

  console.log(`Starting deployment of ${enrichedRows.length} files to Cloudflare R2 bucket: ${bucket}...`);

  for (const row of enrichedRows) {
    console.log(`Uploading ${row.r2Key} (${row.size}) [${row.contentType}] [${row.cacheControl}]`);
    const result = spawnSync("aws", [
      "s3",
      "cp",
      row.stagedPath,
      `s3://${bucket}/${row.r2Key}`,
      "--endpoint-url",
      endpoint,
      "--content-type",
      row.contentType,
      "--cache-control",
      row.cacheControl,
      "--metadata",
      `sha256=${row.sha256}`,
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

  console.log(`Uploaded ${enrichedRows.length} files to ${manifest.assetBaseUrl}`);
  console.log(`Local deployment report written to: ${reportPath}`);
}

run().catch((err) => {
  console.error("Critical error in upload script:", err);
  process.exit(1);
});

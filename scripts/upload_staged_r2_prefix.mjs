#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_PREFIX = "assets/dit/main";
const DEFAULT_STAGING_ROOT = "dist-r2-assets";
const DEFAULT_BUCKET = "hua-3d-assets";
const DEFAULT_REGION = "auto";

function parseArgs(argv) {
  const args = {
    prefix: DEFAULT_PREFIX,
    stagingRoot: DEFAULT_STAGING_ROOT,
    dryRun: false,
    verify: false,
    verifyS3Only: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--prefix") {
      args.prefix = argv[++index];
    } else if (arg === "--staging-root") {
      args.stagingRoot = argv[++index];
    } else if (arg === "--dry-run") {
      args.dryRun = true;
    } else if (arg === "--verify") {
      args.verify = true;
    } else if (arg === "--verify-s3-only") {
      args.verifyS3Only = true;
    }
  }

  return args;
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function encodePath(value) {
  return value
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".json": return "application/json; charset=utf-8";
    case ".glb": return "model/gltf-binary";
    case ".sog": return "application/octet-stream";
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    default: return "application/octet-stream";
  }
}

function getCacheControl(filePath) {
  const filename = path.basename(filePath).toLowerCase();
  if (filename === "lod-meta.json" || filename === "meta.json") {
    return "no-cache, no-store, must-revalidate";
  }
  return "public, max-age=31536000, immutable";
}

function hmac(key, value) {
  return crypto.createHmac("sha256", key).update(value).digest();
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function signingKey(secretAccessKey, date, region, service) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, date);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, "aws4_request");
}

function amzDate(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function credentialDate(value) {
  return value.slice(0, 8);
}

function signRequest({ method, url, headers, payloadHash, accessKeyId, secretAccessKey, region = DEFAULT_REGION }) {
  const parsedUrl = new URL(url);
  const date = headers["x-amz-date"];
  const dateScope = credentialDate(date);
  const service = "s3";
  const scope = `${dateScope}/${region}/${service}/aws4_request`;

  const canonicalHeaders = Object.entries(headers)
    .map(([name, value]) => [name.toLowerCase(), String(value).trim().replace(/\s+/g, " ")])
    .sort(([left], [right]) => left.localeCompare(right));
  const signedHeaders = canonicalHeaders.map(([name]) => name).join(";");
  const canonicalHeaderText = canonicalHeaders.map(([name, value]) => `${name}:${value}\n`).join("");
  const canonicalRequest = [
    method,
    parsedUrl.pathname,
    parsedUrl.searchParams.toString(),
    canonicalHeaderText,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    date,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = crypto
    .createHmac("sha256", signingKey(secretAccessKey, dateScope, region, service))
    .update(stringToSign)
    .digest("hex");

  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function listFiles(root) {
  const output = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        output.push(fullPath);
      }
    }
  }
  await walk(root);
  output.sort((left, right) => left.localeCompare(right));
  return output;
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

async function uploadFile({ filePath, key, endpoint, bucket, accessKeyId, secretAccessKey, region }) {
  const body = await fs.readFile(filePath);
  const payloadHash = sha256Hex(body);
  const contentType = getContentType(filePath);
  const cacheControl = getCacheControl(filePath);
  const date = amzDate();
  const endpointUrl = new URL(endpoint);
  const uploadUrl = `${endpointUrl.origin}/${bucket}/${encodePath(key)}`;
  const headers = {
    "cache-control": cacheControl,
    "content-type": contentType,
    "host": endpointUrl.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": date,
    "x-amz-meta-sha256": payloadHash,
  };
  headers.authorization = signRequest({
    method: "PUT",
    url: uploadUrl,
    headers,
    payloadHash,
    accessKeyId,
    secretAccessKey,
    region,
  });

  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${await response.text()}`);
  }

  return { bytes: body.length, sha256: payloadHash, contentType, cacheControl };
}

async function headObject({ key, endpoint, bucket, accessKeyId, secretAccessKey, region }) {
  const payloadHash = sha256Hex("");
  const date = amzDate();
  const endpointUrl = new URL(endpoint);
  const headUrl = `${endpointUrl.origin}/${bucket}/${encodePath(key)}`;
  const headers = {
    "host": endpointUrl.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": date,
  };
  headers.authorization = signRequest({
    method: "HEAD",
    url: headUrl,
    headers,
    payloadHash,
    accessKeyId,
    secretAccessKey,
    region,
  });

  const response = await fetch(headUrl, {
    method: "HEAD",
    headers,
  });

  if (!response.ok) {
    return { ok: false, status: response.status, statusText: response.statusText };
  }

  return {
    ok: true,
    status: response.status,
    bytes: Number.parseInt(response.headers.get("content-length") || "", 10),
    contentType: response.headers.get("content-type"),
    cacheControl: response.headers.get("cache-control"),
    sha256: response.headers.get("x-amz-meta-sha256"),
  };
}

async function getObjectBytes({ key, endpoint, bucket, accessKeyId, secretAccessKey, region }) {
  const payloadHash = sha256Hex("");
  const date = amzDate();
  const endpointUrl = new URL(endpoint);
  const getUrl = `${endpointUrl.origin}/${bucket}/${encodePath(key)}`;
  const headers = {
    "host": endpointUrl.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": date,
  };
  headers.authorization = signRequest({
    method: "GET",
    url: getUrl,
    headers,
    payloadHash,
    accessKeyId,
    secretAccessKey,
    region,
  });

  const response = await fetch(getUrl, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    return { ok: false, status: response.status, statusText: response.statusText };
  }

  const body = Buffer.from(await response.arrayBuffer());
  return { ok: true, status: response.status, bytes: body.length };
}

async function verifyPublic({ publicBaseUrl, key, bytes }) {
  const url = `${publicBaseUrl.replace(/\/+$/, "")}/${key}`;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (response.ok) {
      const remoteBytes = Number.parseInt(response.headers.get("content-length") || "", 10);
      if (remoteBytes === bytes) {
        return { ok: true, status: response.status, remoteBytes };
      }
      return { ok: false, status: response.status, remoteBytes, reason: "size-mismatch" };
    }
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
    }
  }
  return { ok: false, reason: "not-public" };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET || DEFAULT_BUCKET;
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || DEFAULT_REGION;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    console.error("Missing R2_ENDPOINT, AWS_ACCESS_KEY_ID, or AWS_SECRET_ACCESS_KEY.");
    process.exit(1);
  }

  const stagingRoot = path.resolve(process.cwd(), args.stagingRoot);
  const prefix = args.prefix.replace(/^\/+|\/+$/g, "");
  const sourceRoot = path.join(stagingRoot, ...prefix.split("/"));
  const files = await listFiles(sourceRoot);
  const rows = await Promise.all(files.map(async (filePath) => {
    const stat = await fs.stat(filePath);
    return {
      filePath,
      key: toPosixPath(path.relative(stagingRoot, filePath)),
      bytes: stat.size,
    };
  }));
  const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0);

  console.log(`Prepared ${rows.length} files from ${toPosixPath(path.relative(process.cwd(), sourceRoot))}`);
  console.log(`Destination bucket/prefix: ${bucket}/${prefix}`);
  console.log(`Total size: ${formatBytes(totalBytes)}`);

  if (args.dryRun) {
    console.table(rows.slice(0, 20).map((row) => ({ key: row.key, size: formatBytes(row.bytes) })));
    if (rows.length > 20) console.log(`... ${rows.length - 20} more files`);
    return;
  }

  if (args.verifyS3Only) {
    let passed = 0;
    let failed = 0;
    for (const row of rows) {
      const result = await headObject({
        key: row.key,
        endpoint,
        bucket,
        accessKeyId,
        secretAccessKey,
        region,
      });
      let verified = result.ok && result.bytes === row.bytes;
      if (result.ok && !Number.isFinite(result.bytes)) {
        const fallback = await getObjectBytes({
          key: row.key,
          endpoint,
          bucket,
          accessKeyId,
          secretAccessKey,
          region,
        });
        verified = fallback.ok && fallback.bytes === row.bytes;
        result.bytes = fallback.bytes;
      }
      if (verified) {
        passed += 1;
      } else {
        failed += 1;
        console.error(`[S3 HEAD FAIL] ${row.key}: ${result.status || ""} ${result.statusText || ""} local=${row.bytes} remote=${result.bytes ?? "missing"}`);
      }
    }
    console.log(`Authenticated S3 HEAD verification finished: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exitCode = 1;
    return;
  }

  let uploadedBytes = 0;
  const uploaded = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const meta = await uploadFile({
      filePath: row.filePath,
      key: row.key,
      endpoint,
      bucket,
      accessKeyId,
      secretAccessKey,
      region,
    });
    uploadedBytes += row.bytes;
    uploaded.push({ ...row, ...meta });
    console.log(`[${index + 1}/${rows.length}] ${row.key} ${formatBytes(row.bytes)} uploaded (${formatBytes(uploadedBytes)}/${formatBytes(totalBytes)})`);
  }

  if (args.verify) {
    if (!publicBaseUrl) {
      console.warn("R2_PUBLIC_BASE_URL is missing; skipping public HEAD verification.");
      return;
    }
    let passed = 0;
    let failed = 0;
    for (const row of uploaded) {
      const result = await verifyPublic({ publicBaseUrl, key: row.key, bytes: row.bytes });
      if (result.ok) {
        passed += 1;
      } else {
        failed += 1;
        console.error(`[VERIFY FAIL] ${row.key}: ${result.reason || result.status}`);
      }
    }
    console.log(`Public verification finished: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

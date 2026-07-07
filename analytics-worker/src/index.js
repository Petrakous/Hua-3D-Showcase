const ALLOWED_EVENTS = new Set([
  "session_start",
  "page_view",
  "session_heartbeat",
  "session_end",
  "scene_open",
  "scene_loaded",
  "scene_load_failed",
  "lod_selected",
  "quality_changed",
  "hotspot_click",
  "viewer_error",
  "performance_sample",
]);

const ERROR_EVENTS = new Set(["viewer_error", "scene_load_failed"]);
const MAX_BODY_BYTES = 64 * 1024;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...headers,
    },
  });
}

function getAllowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getCorsHeaders(request, env, { admin = false } = {}) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = getAllowedOrigins(env);
  const allowed = allowedOrigins.includes(origin);

  if (admin && !allowed) {
    return {};
  }

  return {
    "access-control-allow-origin": allowed ? origin : allowedOrigins[0] || origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "access-control-max-age": "86400",
    "vary": "Origin",
  };
}

function isOriginAllowed(request, env) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return getAllowedOrigins(env).includes(origin);
}

function textLimit(value, max = 1000) {
  if (value === null || value === undefined) return null;
  return String(value).slice(0, max);
}

function safeJson(value, max = 8000) {
  try {
    return JSON.stringify(value || {}).slice(0, max);
  } catch (_error) {
    return JSON.stringify({ serialization_error: true });
  }
}

function normalizeVisitorId(value) {
  const visitorId = textLimit(value, 120);
  if (!visitorId || !/^v_[a-zA-Z0-9_-]+/.test(visitorId)) {
    throw new Error("Invalid visitor ID");
  }
  return visitorId;
}

function normalizeLabel(value) {
  const label = textLimit(value, 80);
  return label ? label.trim() : "";
}

function normalizeNotes(value) {
  const notes = textLimit(value, 500);
  return notes ? notes.trim() : "";
}

async function readJsonRequest(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) {
    throw new Error("Payload too large");
  }

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    throw new Error("Payload too large");
  }

  return JSON.parse(body || "{}");
}

function getCfLocation(request) {
  const cf = request.cf || {};
  return {
    country: textLimit(cf.country, 80),
    city: textLimit(cf.city, 120),
    region: textLimit(cf.region, 120),
    colo: textLimit(cf.colo, 20),
  };
}

function normalizeTrackPayload(payload) {
  const eventName = textLimit(payload.event_name, 80);
  if (!ALLOWED_EVENTS.has(eventName)) {
    throw new Error("Unsupported event");
  }

  const visitorId = textLimit(payload.visitor_id, 120);
  const sessionId = textLimit(payload.session_id, 120);
  if (!visitorId || !sessionId) {
    throw new Error("Missing visitor/session");
  }

  const client = payload.client && typeof payload.client === "object" ? payload.client : {};
  const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {};

  return {
    eventName,
    visitorId,
    sessionId,
    sceneId: textLimit(payload.scene_id || metadata.scene_id, 200),
    path: textLimit(client.path || metadata.path, 1000),
    referrer: textLimit(client.referrer, 1000),
    deviceCategory: textLimit(client.device_category, 40),
    browser: textLimit(client.browser, 80),
    os: textLimit(client.os, 80),
    metadata,
    errorType: textLimit(payload.error_type || "Error", 120),
    message: textLimit(payload.message, 1200),
    stack: textLimit(payload.stack, 4000),
    durationSeconds: Number.isFinite(metadata.duration_seconds) ? Math.max(0, Math.round(metadata.duration_seconds)) : null,
  };
}

async function handleTrack(request, env) {
  const cors = getCorsHeaders(request, env);
  if (!isOriginAllowed(request, env)) {
    return json({ ok: false, error: "Origin not allowed" }, 403, cors);
  }

  let normalized;
  try {
    normalized = normalizeTrackPayload(await readJsonRequest(request));
  } catch (error) {
    return json({ ok: false, error: error.message }, 400, cors);
  }

  const now = new Date().toISOString();
  const location = getCfLocation(request);
  const metadataJson = safeJson(normalized.metadata);
  const currentScene = normalized.sceneId || null;
  const endedAt = normalized.eventName === "session_end" ? now : null;

  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO visitors (visitor_id, first_seen_at, last_seen_at, first_country, last_country, device_category)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(visitor_id) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        last_country = excluded.last_country,
        device_category = COALESCE(excluded.device_category, visitors.device_category)
    `).bind(normalized.visitorId, now, now, location.country, location.country, normalized.deviceCategory),
    env.DB.prepare(`
      INSERT INTO sessions (
        session_id, visitor_id, started_at, last_seen_at, ended_at, duration_seconds,
        entry_path, referrer, country, city, region, colo, device_category, browser, os, current_scene
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        last_seen_at = excluded.last_seen_at,
        ended_at = COALESCE(excluded.ended_at, sessions.ended_at),
        duration_seconds = COALESCE(excluded.duration_seconds, sessions.duration_seconds),
        current_scene = COALESCE(excluded.current_scene, sessions.current_scene)
    `).bind(
      normalized.sessionId,
      normalized.visitorId,
      now,
      now,
      endedAt,
      normalized.durationSeconds,
      normalized.path,
      normalized.referrer,
      location.country,
      location.city,
      location.region,
      location.colo,
      normalized.deviceCategory,
      normalized.browser,
      normalized.os,
      currentScene
    ),
    env.DB.prepare(`
      INSERT INTO events (timestamp, event_name, visitor_id, session_id, path, scene_id, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(now, normalized.eventName, normalized.visitorId, normalized.sessionId, normalized.path, normalized.sceneId, metadataJson),
  ]);

  if (ERROR_EVENTS.has(normalized.eventName)) {
    await env.DB.prepare(`
      INSERT INTO errors (timestamp, visitor_id, session_id, scene_id, error_type, message, stack, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      now,
      normalized.visitorId,
      normalized.sessionId,
      normalized.sceneId,
      normalized.errorType,
      normalized.message,
      normalized.stack,
      metadataJson
    ).run();
  }

  return json({ ok: true }, 202, cors);
}

function base64UrlEncode(bytes) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signToken(payload, env) {
  const secret = env.ADMIN_TOKEN_SECRET || env.ADMIN_PASSWORD;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const payloadPart = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadPart));
  return `${payloadPart}.${base64UrlEncode(signature)}`;
}

async function verifyToken(token, env) {
  if (!token || !token.includes(".")) return false;
  const [payloadPart, signaturePart] = token.split(".");
  const secret = env.ADMIN_TOKEN_SECRET || env.ADMIN_PASSWORD;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(signaturePart),
    new TextEncoder().encode(payloadPart)
  );
  if (!ok) return false;
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart)));
  return payload.exp && payload.exp > Math.floor(Date.now() / 1000);
}

async function requireAdmin(request, env) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return verifyToken(token, env);
}

async function handleLogin(request, env) {
  const cors = getCorsHeaders(request, env, { admin: true });
  if (!isOriginAllowed(request, env)) {
    return json({ ok: false }, 403, cors);
  }

  const body = await readJsonRequest(request);
  if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) {
    return json({ ok: false }, 401, cors);
  }

  const ttl = Number(env.TOKEN_TTL_SECONDS || 3600);
  const token = await signToken({
    scope: "admin",
    exp: Math.floor(Date.now() / 1000) + ttl,
  }, env);

  return json({ ok: true, token, expires_in: ttl }, 200, cors);
}

async function queryFirst(env, sql, params = []) {
  return env.DB.prepare(sql).bind(...params).first();
}

async function queryAll(env, sql, params = []) {
  const result = await env.DB.prepare(sql).bind(...params).all();
  return result.results || [];
}

async function handleStats(request, env) {
  const cors = getCorsHeaders(request, env, { admin: true });
  if (!(await requireAdmin(request, env))) {
    return json({ ok: false }, 401, cors);
  }

  const summary = await queryFirst(env, `
    SELECT
      COUNT(DISTINCT CASE WHEN unixepoch(last_seen_at) >= unixepoch('now', '-1 day') THEN visitor_id END) AS visitors_today,
      COUNT(DISTINCT CASE WHEN unixepoch(last_seen_at) >= unixepoch('now', '-7 day') THEN visitor_id END) AS visitors_7d,
      COUNT(DISTINCT CASE WHEN unixepoch(last_seen_at) >= unixepoch('now', '-30 day') THEN visitor_id END) AS visitors_30d,
      (
        SELECT COUNT(*)
        FROM (
          SELECT visitor_id
          FROM sessions
          WHERE unixepoch(started_at) >= unixepoch('now', '-30 day')
          GROUP BY visitor_id
          HAVING COUNT(*) > 1
        )
      ) AS returning_visitors_30d,
      (SELECT COUNT(*) FROM sessions WHERE unixepoch(started_at) >= unixepoch('now', '-1 day')) AS sessions_today,
      (SELECT COUNT(*) FROM sessions WHERE unixepoch(started_at) >= unixepoch('now', '-7 day')) AS sessions_7d,
      (SELECT COUNT(*) FROM sessions WHERE unixepoch(started_at) >= unixepoch('now', '-30 day')) AS sessions_30d,
      (SELECT COUNT(*) FROM events WHERE event_name = 'page_view' AND unixepoch(timestamp) >= unixepoch('now', '-30 day')) AS page_views_30d,
      (SELECT AVG(COALESCE(duration_seconds, unixepoch(last_seen_at) - unixepoch(started_at))) FROM sessions WHERE unixepoch(started_at) >= unixepoch('now', '-30 day')) AS avg_session_duration
    FROM visitors
  `);

  return json({
    ok: true,
    summary,
    top_scenes: await queryAll(env, `
      SELECT
        COALESCE(scene_id, 'unknown') AS scene_id,
        COUNT(*) AS events,
        COUNT(DISTINCT session_id) AS sessions,
        SUM(CASE WHEN event_name = 'scene_open' THEN 1 ELSE 0 END) AS opens,
        SUM(CASE WHEN event_name = 'scene_loaded' THEN 1 ELSE 0 END) AS loads,
        SUM(CASE WHEN event_name = 'scene_load_failed' THEN 1 ELSE 0 END) AS failures
      FROM events
      WHERE event_name IN ('scene_open', 'scene_loaded', 'scene_load_failed') AND unixepoch(timestamp) >= unixepoch('now', '-30 day')
      GROUP BY scene_id
      ORDER BY events DESC
      LIMIT 10
    `),
    traffic_by_day: await queryAll(env, `
      SELECT
        substr(timestamp, 1, 10) AS bucket,
        SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END) AS page_views,
        COUNT(DISTINCT CASE WHEN event_name = 'session_start' THEN session_id END) AS sessions
      FROM events
      WHERE event_name IN ('page_view', 'session_start') AND unixepoch(timestamp) >= unixepoch('now', '-30 day')
      GROUP BY bucket
      ORDER BY bucket ASC
      LIMIT 31
    `),
    traffic_by_hour: await queryAll(env, `
      SELECT
        substr(timestamp, 1, 13) || ':00Z' AS bucket,
        SUM(CASE WHEN event_name = 'page_view' THEN 1 ELSE 0 END) AS page_views,
        COUNT(DISTINCT CASE WHEN event_name = 'session_start' THEN session_id END) AS sessions
      FROM events
      WHERE event_name IN ('page_view', 'session_start') AND unixepoch(timestamp) >= unixepoch('now', '-24 hours')
      GROUP BY bucket
      ORDER BY bucket ASC
      LIMIT 25
    `),
    event_totals: await queryAll(env, `
      SELECT event_name, COUNT(*) AS events
      FROM events
      WHERE unixepoch(timestamp) >= unixepoch('now', '-30 day')
      GROUP BY event_name
      ORDER BY events DESC
    `),
    top_devices: await queryAll(env, `
      SELECT COALESCE(device_category, 'unknown') AS device_category, COUNT(*) AS sessions
      FROM sessions
      WHERE unixepoch(started_at) >= unixepoch('now', '-30 day')
      GROUP BY device_category
      ORDER BY sessions DESC
      LIMIT 10
    `),
    top_browsers: await queryAll(env, `
      SELECT COALESCE(browser, 'unknown') AS browser, COUNT(*) AS sessions
      FROM sessions
      WHERE unixepoch(started_at) >= unixepoch('now', '-30 day')
      GROUP BY browser
      ORDER BY sessions DESC
      LIMIT 8
    `),
    top_os: await queryAll(env, `
      SELECT COALESCE(os, 'unknown') AS os, COUNT(*) AS sessions
      FROM sessions
      WHERE unixepoch(started_at) >= unixepoch('now', '-30 day')
      GROUP BY os
      ORDER BY sessions DESC
      LIMIT 8
    `),
    top_locations: await queryAll(env, `
      SELECT COALESCE(country, 'unknown') AS country, COALESCE(city, '') AS city, COUNT(*) AS sessions
      FROM sessions
      WHERE unixepoch(started_at) >= unixepoch('now', '-30 day')
      GROUP BY country, city
      ORDER BY sessions DESC
      LIMIT 10
    `),
    top_referrers: await queryAll(env, `
      SELECT COALESCE(NULLIF(referrer, ''), 'direct') AS referrer, COUNT(*) AS sessions
      FROM sessions
      WHERE unixepoch(started_at) >= unixepoch('now', '-30 day')
      GROUP BY referrer
      ORDER BY sessions DESC
      LIMIT 10
    `),
    load_failures: await queryAll(env, `
      SELECT COALESCE(scene_id, 'unknown') AS scene_id, COUNT(*) AS failures
      FROM events
      WHERE event_name = 'scene_load_failed' AND unixepoch(timestamp) >= unixepoch('now', '-30 day')
      GROUP BY scene_id
      ORDER BY failures DESC
      LIMIT 10
    `),
    failures_by_day: await queryAll(env, `
      SELECT substr(timestamp, 1, 10) AS bucket, COUNT(*) AS failures
      FROM events
      WHERE event_name = 'scene_load_failed' AND unixepoch(timestamp) >= unixepoch('now', '-30 day')
      GROUP BY bucket
      ORDER BY bucket ASC
      LIMIT 31
    `),
    errors_by_day: await queryAll(env, `
      SELECT substr(timestamp, 1, 10) AS bucket, COUNT(*) AS errors
      FROM errors
      WHERE unixepoch(timestamp) >= unixepoch('now', '-30 day')
      GROUP BY bucket
      ORDER BY bucket ASC
      LIMIT 31
    `),
    performance_summary: await queryFirst(env, `
      SELECT
        COUNT(*) AS samples,
        ROUND(AVG(CAST(json_extract(metadata_json, '$.fps') AS REAL)), 1) AS avg_fps,
        ROUND(MIN(CAST(json_extract(metadata_json, '$.fps') AS REAL)), 1) AS min_fps,
        ROUND(AVG(CAST(json_extract(metadata_json, '$.dpr') AS REAL)), 2) AS avg_dpr
      FROM events
      WHERE event_name = 'performance_sample'
        AND unixepoch(timestamp) >= unixepoch('now', '-30 day')
        AND json_extract(metadata_json, '$.fps') IS NOT NULL
    `),
    fps_by_device: await queryAll(env, `
      SELECT
        COALESCE(s.device_category, 'unknown') AS device_category,
        COUNT(*) AS samples,
        ROUND(AVG(CAST(json_extract(e.metadata_json, '$.fps') AS REAL)), 1) AS avg_fps,
        ROUND(MIN(CAST(json_extract(e.metadata_json, '$.fps') AS REAL)), 1) AS min_fps,
        ROUND(AVG(CAST(json_extract(e.metadata_json, '$.dpr') AS REAL)), 2) AS avg_dpr
      FROM events e
      LEFT JOIN sessions s ON s.session_id = e.session_id
      WHERE e.event_name = 'performance_sample'
        AND unixepoch(e.timestamp) >= unixepoch('now', '-30 day')
        AND json_extract(e.metadata_json, '$.fps') IS NOT NULL
      GROUP BY s.device_category
      ORDER BY avg_fps DESC
      LIMIT 8
    `),
    fps_by_browser: await queryAll(env, `
      SELECT
        COALESCE(s.browser, 'unknown') AS browser,
        COUNT(*) AS samples,
        ROUND(AVG(CAST(json_extract(e.metadata_json, '$.fps') AS REAL)), 1) AS avg_fps,
        ROUND(MIN(CAST(json_extract(e.metadata_json, '$.fps') AS REAL)), 1) AS min_fps,
        ROUND(AVG(CAST(json_extract(e.metadata_json, '$.dpr') AS REAL)), 2) AS avg_dpr
      FROM events e
      LEFT JOIN sessions s ON s.session_id = e.session_id
      WHERE e.event_name = 'performance_sample'
        AND unixepoch(e.timestamp) >= unixepoch('now', '-30 day')
        AND json_extract(e.metadata_json, '$.fps') IS NOT NULL
      GROUP BY s.browser
      ORDER BY avg_fps DESC
      LIMIT 8
    `),
    duration_by_device: await queryAll(env, `
      SELECT
        COALESCE(device_category, 'unknown') AS device_category,
        COUNT(*) AS sessions,
        ROUND(AVG(COALESCE(duration_seconds, unixepoch(last_seen_at) - unixepoch(started_at))), 1) AS avg_duration_seconds
      FROM sessions
      WHERE unixepoch(started_at) >= unixepoch('now', '-30 day')
      GROUP BY device_category
      ORDER BY avg_duration_seconds DESC
      LIMIT 8
    `),
    scene_success_rates: await queryAll(env, `
      SELECT
        COALESCE(scene_id, 'unknown') AS scene_id,
        SUM(CASE WHEN event_name = 'scene_loaded' THEN 1 ELSE 0 END) AS loads,
        SUM(CASE WHEN event_name = 'scene_load_failed' THEN 1 ELSE 0 END) AS failures,
        COUNT(DISTINCT session_id) AS sessions
      FROM events
      WHERE event_name IN ('scene_loaded', 'scene_load_failed') AND unixepoch(timestamp) >= unixepoch('now', '-30 day')
      GROUP BY scene_id
      ORDER BY (loads + failures) DESC
      LIMIT 10
    `),
    errors_by_scene: await queryAll(env, `
      SELECT COALESCE(scene_id, 'unknown') AS scene_id, COUNT(*) AS errors
      FROM errors
      WHERE unixepoch(timestamp) >= unixepoch('now', '-30 day')
      GROUP BY scene_id
      ORDER BY errors DESC
      LIMIT 10
    `),
    errors_by_device: await queryAll(env, `
      SELECT COALESCE(s.device_category, 'unknown') AS device_category, COUNT(*) AS errors
      FROM errors er
      LEFT JOIN sessions s ON s.session_id = er.session_id
      WHERE unixepoch(er.timestamp) >= unixepoch('now', '-30 day')
      GROUP BY s.device_category
      ORDER BY errors DESC
      LIMIT 8
    `),
  }, 200, cors);
}

async function handleSessions(request, env) {
  const cors = getCorsHeaders(request, env, { admin: true });
  if (!(await requireAdmin(request, env))) {
    return json({ ok: false }, 401, cors);
  }

  const active = await queryFirst(env, `
    SELECT COUNT(*) AS active_sessions
    FROM sessions
    WHERE unixepoch(last_seen_at) >= unixepoch('now', '-90 seconds') AND ended_at IS NULL
  `);
  const activeSessions = await queryAll(env, `
    SELECT
      s.session_id,
      s.visitor_id,
      vl.label AS visitor_label,
      vl.notes AS visitor_notes,
      s.started_at,
      s.last_seen_at,
      s.duration_seconds,
      s.entry_path,
      s.referrer,
      s.country,
      s.city,
      s.device_category,
      s.browser,
      s.os,
      s.current_scene,
      (
        SELECT COUNT(*)
        FROM events e
        WHERE e.session_id = s.session_id
      ) AS event_count,
      (
        SELECT COUNT(*)
        FROM events e
        WHERE e.session_id = s.session_id AND e.event_name = 'page_view'
      ) AS page_views
    FROM sessions s
    LEFT JOIN visitor_labels vl ON vl.visitor_id = s.visitor_id
    WHERE unixepoch(s.last_seen_at) >= unixepoch('now', '-90 seconds') AND s.ended_at IS NULL
    ORDER BY s.last_seen_at DESC
    LIMIT 25
  `);
  const sessions = await queryAll(env, `
    SELECT
      s.session_id,
      s.visitor_id,
      vl.label AS visitor_label,
      vl.notes AS visitor_notes,
      vl.updated_at AS visitor_label_updated_at,
      s.started_at,
      s.last_seen_at,
      s.duration_seconds,
      s.entry_path,
      s.referrer,
      s.country,
      s.city,
      s.device_category,
      s.browser,
      s.os,
      s.current_scene,
      (
        SELECT COUNT(*)
        FROM events e
        WHERE e.session_id = s.session_id
      ) AS event_count,
      (
        SELECT COUNT(*)
        FROM events e
        WHERE e.session_id = s.session_id AND e.event_name = 'page_view'
      ) AS page_views
    FROM sessions s
    LEFT JOIN visitor_labels vl ON vl.visitor_id = s.visitor_id
    ORDER BY s.last_seen_at DESC
    LIMIT 50
  `);

  return json({ ok: true, active_sessions: active?.active_sessions || 0, active_sessions_list: activeSessions, sessions }, 200, cors);
}

async function handleErrors(request, env) {
  const cors = getCorsHeaders(request, env, { admin: true });
  if (!(await requireAdmin(request, env))) {
    return json({ ok: false }, 401, cors);
  }

  const errors = await queryAll(env, `
    SELECT
      e.timestamp,
      e.visitor_id,
      vl.label AS visitor_label,
      e.session_id,
      e.scene_id,
      e.error_type,
      e.message,
      e.stack
    FROM errors e
    LEFT JOIN visitor_labels vl ON vl.visitor_id = e.visitor_id
    ORDER BY e.timestamp DESC
    LIMIT 50
  `);

  return json({ ok: true, errors }, 200, cors);
}

async function handleVisitorDetail(request, env, visitorId) {
  const cors = getCorsHeaders(request, env, { admin: true });
  if (!(await requireAdmin(request, env))) {
    return json({ ok: false }, 401, cors);
  }

  let normalizedVisitorId;
  try {
    normalizedVisitorId = normalizeVisitorId(visitorId);
  } catch (error) {
    return json({ ok: false, error: error.message }, 400, cors);
  }

  const visitor = await queryFirst(env, `
    SELECT
      v.visitor_id,
      v.first_seen_at,
      v.last_seen_at,
      v.first_country,
      v.last_country,
      v.device_category,
      vl.label,
      vl.notes,
      vl.updated_at AS label_updated_at,
      (
        SELECT COUNT(*)
        FROM sessions s
        WHERE s.visitor_id = v.visitor_id
      ) AS sessions,
      (
        SELECT COUNT(*)
        FROM events e
        WHERE e.visitor_id = v.visitor_id
      ) AS events,
      (
        SELECT COUNT(*)
        FROM events e
        WHERE e.visitor_id = v.visitor_id AND e.event_name = 'page_view'
      ) AS page_views,
      (
        SELECT COUNT(*)
        FROM errors er
        WHERE er.visitor_id = v.visitor_id
      ) AS errors
    FROM visitors v
    LEFT JOIN visitor_labels vl ON vl.visitor_id = v.visitor_id
    WHERE v.visitor_id = ?
  `, [normalizedVisitorId]);

  if (!visitor) {
    return json({ ok: false, error: "Visitor not found" }, 404, cors);
  }

  const sessions = await queryAll(env, `
    SELECT session_id, started_at, last_seen_at, ended_at, duration_seconds, entry_path, referrer, country, city, device_category, browser, os, current_scene
    FROM sessions
    WHERE visitor_id = ?
    ORDER BY last_seen_at DESC
    LIMIT 20
  `, [normalizedVisitorId]);

  const events = await queryAll(env, `
    SELECT event_name, COUNT(*) AS events
    FROM events
    WHERE visitor_id = ?
    GROUP BY event_name
    ORDER BY events DESC
    LIMIT 20
  `, [normalizedVisitorId]);

  const recent_errors = await queryAll(env, `
    SELECT timestamp, session_id, scene_id, error_type, message
    FROM errors
    WHERE visitor_id = ?
    ORDER BY timestamp DESC
    LIMIT 10
  `, [normalizedVisitorId]);

  return json({ ok: true, visitor, sessions, events, recent_errors }, 200, cors);
}

async function handleVisitorLabel(request, env) {
  const cors = getCorsHeaders(request, env, { admin: true });
  if (!(await requireAdmin(request, env))) {
    return json({ ok: false }, 401, cors);
  }

  let body;
  try {
    body = await readJsonRequest(request);
  } catch (error) {
    return json({ ok: false, error: error.message }, 400, cors);
  }

  let visitorId;
  try {
    visitorId = normalizeVisitorId(body.visitor_id);
  } catch (error) {
    return json({ ok: false, error: error.message }, 400, cors);
  }

  const label = normalizeLabel(body.label);
  const notes = normalizeNotes(body.notes);
  const now = new Date().toISOString();

  if (!label && !notes) {
    await env.DB.prepare("DELETE FROM visitor_labels WHERE visitor_id = ?").bind(visitorId).run();
    return json({ ok: true, deleted: true }, 200, cors);
  }

  await env.DB.prepare(`
    INSERT INTO visitor_labels (visitor_id, label, notes, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(visitor_id) DO UPDATE SET
      label = excluded.label,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `).bind(visitorId, label || null, notes || null, now).run();

  return json({ ok: true, visitor_id: visitorId, label, notes, updated_at: now }, 200, cors);
}

async function handleVisitorLabelDelete(request, env) {
  const cors = getCorsHeaders(request, env, { admin: true });
  if (!(await requireAdmin(request, env))) {
    return json({ ok: false }, 401, cors);
  }

  let body;
  try {
    body = await readJsonRequest(request);
  } catch (error) {
    return json({ ok: false, error: error.message }, 400, cors);
  }

  let visitorId;
  try {
    visitorId = normalizeVisitorId(body.visitor_id);
  } catch (error) {
    return json({ ok: false, error: error.message }, 400, cors);
  }

  await env.DB.prepare("DELETE FROM visitor_labels WHERE visitor_id = ?").bind(visitorId).run();
  return json({ ok: true, deleted: true }, 200, cors);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isAdmin = url.pathname.startsWith("/admin/");
    const cors = getCorsHeaders(request, env, { admin: isAdmin });

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (request.method === "POST" && url.pathname === "/track") {
        return handleTrack(request, env);
      }
      if (request.method === "POST" && url.pathname === "/admin/login") {
        return handleLogin(request, env);
      }
      if (request.method === "GET" && url.pathname === "/admin/stats") {
        return handleStats(request, env);
      }
      if (request.method === "GET" && url.pathname === "/admin/sessions") {
        return handleSessions(request, env);
      }
      if (request.method === "GET" && url.pathname === "/admin/errors") {
        return handleErrors(request, env);
      }
      if (request.method === "GET" && url.pathname.startsWith("/admin/visitor/")) {
        const visitorId = decodeURIComponent(url.pathname.slice("/admin/visitor/".length));
        return handleVisitorDetail(request, env, visitorId);
      }
      if (request.method === "POST" && url.pathname === "/admin/visitor-label") {
        return handleVisitorLabel(request, env);
      }
      if (request.method === "DELETE" && url.pathname === "/admin/visitor-label") {
        return handleVisitorLabelDelete(request, env);
      }
      return json({ ok: false, error: "Not found" }, 404, cors);
    } catch (error) {
      return json({ ok: false, error: "Internal error" }, 500, cors);
    }
  },
};

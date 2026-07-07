import { ANALYTICS_CONFIG, getCurrentAnalyticsVisitorId } from "./client.js";

const TOKEN_KEY = "hua3d.analytics.admin_token";

function adminUrl(path) {
  return new URL(path, ANALYTICS_CONFIG.endpoint).toString();
}

function injectStyles() {
  if (document.getElementById("analyticsDashboardStyles")) return;
  const style = document.createElement("style");
  style.id = "analyticsDashboardStyles";
  style.textContent = `
    .analytics-dashboard {
      position: fixed;
      inset: 0;
      z-index: 10000;
      overflow: auto;
      background:
        radial-gradient(circle at 16% 8%, rgba(0, 182, 255, 0.18), transparent 28rem),
        radial-gradient(circle at 82% 4%, rgba(80, 114, 255, 0.2), transparent 30rem),
        linear-gradient(135deg, #06101f 0%, #071728 42%, #040811 100%);
      color: #e9f6ff;
      font-family: Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: clamp(16px, 2vw, 32px);
    }
    .analytics-dashboard * { box-sizing: border-box; }
    .analytics-dashboard h1,
    .analytics-dashboard h2,
    .analytics-dashboard h3,
    .analytics-dashboard p { margin: 0; }
    .analytics-dashboard__shell {
      width: min(1560px, 100%);
      margin: 0 auto;
    }
    .analytics-dashboard__top {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 18px;
      align-items: end;
      margin-bottom: 20px;
    }
    .analytics-dashboard__eyebrow {
      color: #6ee7ff;
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .analytics-dashboard h1 {
      font-size: clamp(1.9rem, 3.4vw, 3.15rem);
      line-height: 1;
      letter-spacing: 0;
    }
    .analytics-dashboard__subtitle {
      max-width: 760px;
      margin-top: 10px;
      color: #9db3c9;
      font-size: 0.98rem;
      line-height: 1.55;
    }
    .analytics-dashboard__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 10px;
    }
    .analytics-dashboard__status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 12px;
      border: 1px solid rgba(92, 220, 255, 0.22);
      border-radius: 8px;
      background: rgba(7, 22, 39, 0.68);
      color: #b8cbe0;
      font-size: 0.84rem;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
    }
    .analytics-dashboard__status-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: #25f6a5;
      box-shadow: 0 0 16px rgba(37, 246, 165, 0.85);
    }
    .analytics-dashboard__visitor-tools {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-top: 10px;
    }
    .analytics-dashboard__visitor-badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      max-width: 100%;
      border: 1px solid rgba(96, 211, 255, 0.28);
      border-radius: 999px;
      padding: 5px 9px;
      background: rgba(0, 174, 255, 0.09);
      color: #dff8ff;
      font-size: 0.78rem;
      font-weight: 800;
      white-space: nowrap;
    }
    .analytics-dashboard__visitor-badge small {
      color: #7edfff;
      font: inherit;
      opacity: 0.82;
    }
    .analytics-dashboard__icon-button {
      min-height: 28px;
      border-radius: 7px;
      padding: 0 9px;
      font-size: 0.76rem;
      box-shadow: none;
    }
    .analytics-dashboard button {
      min-height: 40px;
      border: 1px solid rgba(80, 207, 255, 0.55);
      border-radius: 8px;
      padding: 0 15px;
      background: linear-gradient(135deg, rgba(25, 126, 204, 0.9), rgba(10, 209, 235, 0.75));
      color: #f4fbff;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 0 22px rgba(0, 195, 255, 0.18);
    }
    .analytics-dashboard button:hover {
      border-color: rgba(147, 233, 255, 0.9);
      box-shadow: 0 0 32px rgba(0, 195, 255, 0.28);
    }
    .analytics-dashboard__grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: clamp(12px, 1.2vw, 18px);
    }
    .analytics-dashboard__panel,
    .analytics-dashboard__metric,
    .analytics-dashboard__login {
      position: relative;
      overflow: hidden;
      border: 1px solid rgba(122, 213, 255, 0.17);
      border-radius: 8px;
      background:
        linear-gradient(180deg, rgba(17, 41, 68, 0.84), rgba(7, 18, 32, 0.82)),
        rgba(8, 19, 35, 0.86);
      box-shadow:
        0 20px 70px rgba(0, 0, 0, 0.32),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(18px);
    }
    .analytics-dashboard__panel::before,
    .analytics-dashboard__metric::before,
    .analytics-dashboard__login::before {
      content: "";
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: linear-gradient(135deg, rgba(87, 211, 255, 0.12), transparent 38%);
      opacity: 0.78;
    }
    .analytics-dashboard__metric {
      grid-column: span 3;
      min-height: 142px;
      padding: 17px;
    }
    .analytics-dashboard__metric > *,
    .analytics-dashboard__panel > *,
    .analytics-dashboard__login > * {
      position: relative;
      z-index: 1;
    }
    .analytics-dashboard__metric-label {
      color: #9fb4ca;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .analytics-dashboard__metric-value {
      display: block;
      margin-top: 12px;
      color: #f8fcff;
      font-size: clamp(1.8rem, 3vw, 2.65rem);
      line-height: 1;
      font-weight: 800;
      text-shadow: 0 0 24px rgba(66, 213, 255, 0.28);
    }
    .analytics-dashboard__metric-note {
      margin-top: 12px;
      color: #7f95ad;
      font-size: 0.82rem;
      line-height: 1.35;
    }
    .analytics-dashboard__panel {
      grid-column: span 6;
      min-height: 300px;
      padding: 18px;
    }
    .analytics-dashboard__panel--wide { grid-column: span 8; }
    .analytics-dashboard__panel--narrow { grid-column: span 4; }
    .analytics-dashboard__panel--full { grid-column: 1 / -1; }
    .analytics-dashboard__panel--compact { min-height: auto; }
    .analytics-dashboard__panel-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 16px;
    }
    .analytics-dashboard h2 {
      color: #f3fbff;
      font-size: 1rem;
      line-height: 1.2;
      letter-spacing: 0;
    }
    .analytics-dashboard__muted {
      color: #8ea4ba;
      font-size: 0.84rem;
      line-height: 1.45;
    }
    .analytics-dashboard__pill {
      flex: 0 0 auto;
      border: 1px solid rgba(96, 211, 255, 0.24);
      border-radius: 999px;
      padding: 5px 9px;
      color: #8de9ff;
      background: rgba(0, 174, 255, 0.08);
      font-size: 0.74rem;
      font-weight: 800;
    }
    .analytics-dashboard__chart {
      position: relative;
      min-height: 210px;
    }
    .analytics-dashboard svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }
    .analytics-dashboard__axis {
      color: #62788f;
      font-size: 11px;
    }
    .analytics-dashboard__empty {
      display: grid;
      place-items: center;
      min-height: 180px;
      border: 1px dashed rgba(115, 197, 241, 0.23);
      border-radius: 8px;
      color: #7d93aa;
      text-align: center;
      padding: 22px;
      background: rgba(5, 15, 28, 0.28);
    }
    .analytics-dashboard__bars {
      display: grid;
      gap: 11px;
    }
    .analytics-dashboard__bar-row {
      display: grid;
      grid-template-columns: minmax(100px, 1fr) minmax(120px, 2.1fr) auto;
      gap: 10px;
      align-items: center;
      color: #d8ecfa;
      font-size: 0.86rem;
    }
    .analytics-dashboard__bar-label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .analytics-dashboard__bar-track {
      height: 9px;
      border-radius: 999px;
      background: rgba(83, 111, 138, 0.24);
      overflow: hidden;
    }
    .analytics-dashboard__bar-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #1a8dff, #35f2ff);
      box-shadow: 0 0 18px rgba(43, 224, 255, 0.42);
    }
    .analytics-dashboard__bar-value {
      color: #9edff6;
      font-weight: 800;
      min-width: 44px;
      text-align: right;
    }
    .analytics-dashboard__split {
      display: grid;
      grid-template-columns: 210px minmax(0, 1fr);
      gap: 18px;
      align-items: center;
    }
    .analytics-dashboard__donut-center {
      fill: #f5fbff;
      font-size: 22px;
      font-weight: 800;
      text-anchor: middle;
    }
    .analytics-dashboard__donut-label {
      fill: #8ea4ba;
      font-size: 10px;
      text-anchor: middle;
      text-transform: uppercase;
    }
    .analytics-dashboard__table-wrap {
      overflow-x: auto;
      overflow-y: auto;
      max-height: 400px;
      border-radius: 8px;
      border: 1px solid rgba(126, 202, 255, 0.13);
    }
    .analytics-dashboard table {
      min-width: 760px;
      width: 100%;
      border-collapse: collapse;
      font-size: 0.84rem;
    }
    .analytics-dashboard th,
    .analytics-dashboard td {
      text-align: left;
      border-bottom: 1px solid rgba(128, 180, 219, 0.11);
      padding: 10px 9px;
      vertical-align: top;
      word-break: normal;
      overflow-wrap: normal;
    }
    .analytics-dashboard th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: rgba(8, 24, 42, 0.96);
      color: #79dfff;
      font-size: 0.7rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .analytics-dashboard td { color: #d7e8f5; }
    .analytics-dashboard td:not(:last-child) {
      white-space: nowrap;
    }
    .analytics-dashboard td:last-child {
      min-width: 220px;
    }
    .analytics-dashboard__cell-muted { color: #7f95ad; }
    .analytics-dashboard__session-list {
      display: grid;
      gap: 10px;
      max-height: 520px;
      overflow: auto;
      padding-right: 4px;
    }
    .analytics-dashboard__session-card {
      display: grid;
      grid-template-columns: minmax(220px, 1.1fr) minmax(180px, 0.9fr) minmax(150px, 0.8fr);
      gap: 12px;
      align-items: start;
      border: 1px solid rgba(126, 202, 255, 0.13);
      border-radius: 8px;
      padding: 12px;
      background: rgba(5, 15, 28, 0.34);
    }
    .analytics-dashboard__session-meta {
      display: grid;
      gap: 4px;
      min-width: 0;
      color: #d7e8f5;
      font-size: 0.84rem;
    }
    .analytics-dashboard__session-meta span {
      color: #84a0b9;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }
    .analytics-dashboard__truncate {
      display: block;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .analytics-dashboard__stack {
      display: grid;
      gap: 16px;
    }
    .analytics-dashboard__health {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      margin-top: 12px;
    }
    .analytics-dashboard__health-item {
      border: 1px solid rgba(125, 211, 252, 0.14);
      border-radius: 8px;
      padding: 12px;
      background: rgba(4, 14, 27, 0.34);
    }
    .analytics-dashboard__health-item strong {
      display: block;
      color: #f4fbff;
      font-size: 1.35rem;
      line-height: 1;
    }
    .analytics-dashboard__health-item span {
      display: block;
      margin-top: 7px;
      color: #89a0b8;
      font-size: 0.76rem;
      font-weight: 800;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }
    .analytics-dashboard__login {
      width: min(460px, 100%);
      margin: 14vh auto 0;
      padding: 28px;
    }
    .analytics-dashboard label {
      display: grid;
      gap: 8px;
      margin: 22px 0 14px;
      color: #d7e8f5;
      font-weight: 800;
      font-size: 0.86rem;
    }
    .analytics-dashboard input {
      height: 46px;
      border: 1px solid rgba(116, 207, 255, 0.32);
      border-radius: 8px;
      padding: 0 12px;
      background: rgba(3, 10, 20, 0.74);
      color: #f4fbff;
      font: inherit;
      outline: none;
    }
    .analytics-dashboard input:focus {
      border-color: #54d9ff;
      box-shadow: 0 0 0 3px rgba(84, 217, 255, 0.14);
    }
    .analytics-dashboard__error {
      color: #ff9b9b;
      min-height: 1.4em;
      margin-top: 12px;
      font-size: 0.9rem;
    }
    .analytics-dashboard__modal {
      position: fixed;
      inset: 0;
      z-index: 10001;
      display: grid;
      place-items: center;
      padding: 22px;
      background: rgba(0, 4, 12, 0.74);
      backdrop-filter: blur(10px);
    }
    .analytics-dashboard__modal-card {
      width: min(760px, 100%);
      max-height: min(760px, 92vh);
      overflow: auto;
      border: 1px solid rgba(122, 213, 255, 0.24);
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(15, 37, 62, 0.98), rgba(5, 13, 24, 0.98));
      box-shadow: 0 30px 100px rgba(0, 0, 0, 0.55);
      padding: 22px;
    }
    .analytics-dashboard__modal-head {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }
    .analytics-dashboard__modal-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin: 14px 0;
    }
    .analytics-dashboard__detail-cell {
      border: 1px solid rgba(125, 211, 252, 0.14);
      border-radius: 8px;
      padding: 11px;
      background: rgba(4, 14, 27, 0.34);
    }
    .analytics-dashboard__detail-cell span {
      display: block;
      color: #89a0b8;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }
    .analytics-dashboard__detail-cell strong {
      display: block;
      margin-top: 6px;
      color: #f4fbff;
      word-break: break-word;
    }
    @media (max-width: 1180px) {
      .analytics-dashboard__metric { grid-column: span 4; }
      .analytics-dashboard__panel,
      .analytics-dashboard__panel--wide,
      .analytics-dashboard__panel--narrow { grid-column: 1 / -1; }
      .analytics-dashboard__session-card {
        grid-template-columns: minmax(220px, 1fr) minmax(180px, 1fr);
      }
    }
    @media (max-width: 760px) {
      .analytics-dashboard { padding: 16px; }
      .analytics-dashboard__top { grid-template-columns: 1fr; align-items: start; }
      .analytics-dashboard__actions { justify-content: flex-start; }
      .analytics-dashboard__metric { grid-column: 1 / -1; }
      .analytics-dashboard__split { grid-template-columns: 1fr; }
      .analytics-dashboard__bar-row { grid-template-columns: 1fr; gap: 6px; }
      .analytics-dashboard__bar-value { text-align: left; }
      .analytics-dashboard__health { grid-template-columns: 1fr; }
      .analytics-dashboard__modal-grid { grid-template-columns: 1fr; }
      .analytics-dashboard table { min-width: 680px; }
      .analytics-dashboard__session-card { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(toNumber(value));
}

function formatDuration(seconds) {
  const value = Math.max(0, Math.round(toNumber(seconds)));
  if (value < 60) return `${value}s`;
  const minutes = Math.floor(value / 60);
  const remainingSeconds = value % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatDateTime(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatBucket(value) {
  if (!value) return "Unknown";
  const normalized = value.length === 10 ? `${value}T00:00:00Z` : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return value.length === 10
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)
    : new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

function cleanReferrer(value) {
  if (!value || value === "direct") return "Direct";
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "");
  } catch (_error) {
    return value;
  }
}

function shortVisitorId(visitorId = "") {
  const value = String(visitorId || "");
  if (value.length <= 12) return value || "Unknown";
  return value.slice(0, 11);
}

function shortSessionId(sessionId = "") {
  const value = String(sessionId || "");
  if (value.length <= 13) return value || "Unknown";
  return value.slice(0, 13);
}

function visitorDisplayName(row = {}) {
  return row.visitor_label || shortVisitorId(row.visitor_id);
}

function renderVisitorBadge(row = {}) {
  const visitorId = row.visitor_id || "";
  if (!visitorId) return `<span class="analytics-dashboard__cell-muted">Unknown</span>`;
  const label = row.visitor_label || "";
  return `
    <span class="analytics-dashboard__visitor-badge" title="${escapeHtml(visitorId)}">
      ${escapeHtml(label || shortVisitorId(visitorId))}
      ${label ? `<small>${escapeHtml(shortVisitorId(visitorId))}</small>` : ""}
    </span>
    <div class="analytics-dashboard__visitor-tools">
      <button class="analytics-dashboard__icon-button" type="button" data-copy-visitor="${escapeHtml(visitorId)}">Copy</button>
      <button class="analytics-dashboard__icon-button" type="button" data-label-visitor="${escapeHtml(visitorId)}" data-label="${escapeHtml(label)}" data-notes="${escapeHtml(row.visitor_notes || "")}">${label ? "Edit label" : "Label"}</button>
      <button class="analytics-dashboard__icon-button" type="button" data-detail-visitor="${escapeHtml(visitorId)}">Details</button>
    </div>
  `;
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (_error) {
    return false;
  }
}

async function saveVisitorLabel(visitorId, label, notes = "") {
  return adminFetch("/admin/visitor-label", {
    method: "POST",
    body: JSON.stringify({ visitor_id: visitorId, label, notes }),
  });
}

async function deleteVisitorLabel(visitorId) {
  return adminFetch("/admin/visitor-label", {
    method: "DELETE",
    body: JSON.stringify({ visitor_id: visitorId }),
  });
}

async function fetchVisitorDetail(visitorId) {
  return adminFetch(`/admin/visitor/${encodeURIComponent(visitorId)}`);
}

async function adminFetch(path, options = {}) {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const response = await fetch(adminUrl(path), {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function renderEmpty(message = "No data yet.") {
  return `<div class="analytics-dashboard__empty"><p>${escapeHtml(message)}</p></div>`;
}

function renderPanel(title, subtitle, body, options = {}) {
  const className = options.className
    ? String(options.className)
      .split(/\s+/)
      .filter(Boolean)
      .map((name) => ` analytics-dashboard__panel--${name}`)
      .join("")
    : "";
  return `
    <section class="analytics-dashboard__panel${className}">
      <div class="analytics-dashboard__panel-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          ${subtitle ? `<p class="analytics-dashboard__muted">${escapeHtml(subtitle)}</p>` : ""}
        </div>
        ${options.pill ? `<span class="analytics-dashboard__pill">${escapeHtml(options.pill)}</span>` : ""}
      </div>
      ${body}
    </section>
  `;
}

function renderMetricCard(label, value, note) {
  return `
    <article class="analytics-dashboard__metric">
      <p class="analytics-dashboard__metric-label">${escapeHtml(label)}</p>
      <strong class="analytics-dashboard__metric-value">${escapeHtml(value)}</strong>
      <p class="analytics-dashboard__metric-note">${escapeHtml(note)}</p>
    </article>
  `;
}

function renderRows(rows = [], columns = []) {
  if (!rows.length) {
    return renderEmpty("No rows to show yet.");
  }

  return `
    <div class="analytics-dashboard__table-wrap">
      <table>
        <thead><tr>${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              ${columns.map((column) => {
                const value = column.format ? column.format(row[column.key], row) : row[column.key];
                return `<td>${column.html ? value : escapeHtml(value)}</td>`;
              }).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSessionCards(rows = []) {
  if (!rows.length) {
    return renderEmpty("No sessions to show yet.");
  }

  return `
    <div class="analytics-dashboard__session-list">
      ${rows.map((row) => `
        <article class="analytics-dashboard__session-card">
          <div class="analytics-dashboard__session-meta">
            <span>Visitor</span>
            ${renderVisitorBadge(row)}
          </div>
          <div class="analytics-dashboard__session-meta">
            <span>Session</span>
            <strong class="analytics-dashboard__truncate" title="${escapeHtml(row.session_id || "")}">${escapeHtml(shortSessionId(row.session_id))}</strong>
            <small>${escapeHtml(formatDateTime(row.started_at))} · ${escapeHtml(formatDuration(row.duration_seconds))}</small>
          </div>
          <div class="analytics-dashboard__session-meta">
            <span>Scene</span>
            <strong class="analytics-dashboard__truncate" title="${escapeHtml(row.current_scene || "")}">${escapeHtml(row.current_scene || "Unknown")}</strong>
            <small>${escapeHtml(formatNumber(row.page_views || 0))} views · ${escapeHtml(formatNumber(row.event_count || 0))} events</small>
          </div>
          <div class="analytics-dashboard__session-meta">
            <span>Device</span>
            <strong class="analytics-dashboard__truncate">${escapeHtml(row.device_category || "unknown")} / ${escapeHtml(row.browser || "browser")}</strong>
            <small>${escapeHtml(row.os || "OS unknown")}</small>
          </div>
          <div class="analytics-dashboard__session-meta">
            <span>Location</span>
            <strong class="analytics-dashboard__truncate">${escapeHtml([row.country, row.city].filter(Boolean).join(", ") || "Unknown")}</strong>
            <small class="analytics-dashboard__truncate" title="${escapeHtml(row.referrer || "")}">${escapeHtml(cleanReferrer(row.referrer))}</small>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderSceneReliability(rows = []) {
  if (!rows.length) {
    return renderEmpty("No scene reliability data yet.");
  }

  return `
    <div class="analytics-dashboard__bars">
      ${rows.map((row) => {
        const loads = toNumber(row.loads);
        const failures = toNumber(row.failures);
        const total = Math.max(1, loads + failures);
        const success = Math.round((loads / total) * 100);
        return `
          <div class="analytics-dashboard__bar-row" title="${escapeHtml(`${row.scene_id}: ${success}% success (${loads} loads, ${failures} failures)`)}">
            <span class="analytics-dashboard__bar-label">${escapeHtml(row.scene_id || "Unknown")}</span>
            <span class="analytics-dashboard__bar-track">
              <span class="analytics-dashboard__bar-fill" style="width:${success}%"></span>
            </span>
            <strong class="analytics-dashboard__bar-value">${success}%</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function closeDashboardModal(root) {
  root.querySelector(".analytics-dashboard__modal")?.remove();
}

function showLabelModal(root, visitorId, label = "", notes = "") {
  closeDashboardModal(root);
  const modal = document.createElement("div");
  modal.className = "analytics-dashboard__modal";
  modal.innerHTML = `
    <form class="analytics-dashboard__modal-card" data-label-form>
      <div class="analytics-dashboard__modal-head">
        <div>
          <p class="analytics-dashboard__eyebrow">Private admin label</p>
          <h2>${escapeHtml(shortVisitorId(visitorId))}</h2>
          <p class="analytics-dashboard__muted">${escapeHtml(visitorId)}</p>
        </div>
        <button class="analytics-dashboard__icon-button" type="button" data-modal-close>Close</button>
      </div>
      <p class="analytics-dashboard__muted">Labels and notes are stored in D1 and only shown in the admin dashboard.</p>
      <label>
        Label
        <input name="label" maxlength="80" value="${escapeHtml(label)}" placeholder="Petros desktop" />
      </label>
      <label>
        Notes
        <input name="notes" maxlength="500" value="${escapeHtml(notes)}" placeholder="Optional private note" />
      </label>
      <div class="analytics-dashboard__actions" style="justify-content:flex-start;margin-top:14px">
        <button type="submit">Save label</button>
        <button type="button" data-delete-label>Remove label</button>
      </div>
      <p class="analytics-dashboard__error" data-label-error></p>
    </form>
  `;
  root.appendChild(modal);

  modal.querySelector("[data-modal-close]")?.addEventListener("click", () => closeDashboardModal(root));
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeDashboardModal(root);
  });
  modal.querySelector("[data-label-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorNode = form.querySelector("[data-label-error]");
    errorNode.textContent = "";
    try {
      const data = new FormData(form);
      await saveVisitorLabel(visitorId, data.get("label") || "", data.get("notes") || "");
      closeDashboardModal(root);
      await loadDashboard(root);
    } catch (_error) {
      errorNode.textContent = "Could not save label.";
    }
  });
  modal.querySelector("[data-delete-label]")?.addEventListener("click", async () => {
    const errorNode = modal.querySelector("[data-label-error]");
    errorNode.textContent = "";
    try {
      await deleteVisitorLabel(visitorId);
      closeDashboardModal(root);
      await loadDashboard(root);
    } catch (_error) {
      errorNode.textContent = "Could not remove label.";
    }
  });
}

function renderDetailCell(label, value) {
  return `
    <div class="analytics-dashboard__detail-cell">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Unknown")}</strong>
    </div>
  `;
}

async function showVisitorDetailModal(root, visitorId) {
  closeDashboardModal(root);
  const modal = document.createElement("div");
  modal.className = "analytics-dashboard__modal";
  modal.innerHTML = `
    <div class="analytics-dashboard__modal-card">
      <div class="analytics-dashboard__modal-head">
        <div>
          <p class="analytics-dashboard__eyebrow">Visitor detail</p>
          <h2>${escapeHtml(shortVisitorId(visitorId))}</h2>
          <p class="analytics-dashboard__muted">${escapeHtml(visitorId)}</p>
        </div>
        <button class="analytics-dashboard__icon-button" type="button" data-modal-close>Close</button>
      </div>
      ${renderEmpty("Loading visitor details...")}
    </div>
  `;
  root.appendChild(modal);
  modal.querySelector("[data-modal-close]")?.addEventListener("click", () => closeDashboardModal(root));
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeDashboardModal(root);
  });

  try {
    const detail = await fetchVisitorDetail(visitorId);
    const visitor = detail.visitor || {};
    const card = modal.querySelector(".analytics-dashboard__modal-card");
    card.innerHTML = `
      <div class="analytics-dashboard__modal-head">
        <div>
          <p class="analytics-dashboard__eyebrow">Visitor detail</p>
          <h2>${escapeHtml(visitor.label || shortVisitorId(visitor.visitor_id))}</h2>
          <p class="analytics-dashboard__muted">${escapeHtml(visitor.visitor_id)}</p>
        </div>
        <button class="analytics-dashboard__icon-button" type="button" data-modal-close>Close</button>
      </div>
      <div class="analytics-dashboard__visitor-tools">
        <button class="analytics-dashboard__icon-button" type="button" data-copy-visitor="${escapeHtml(visitor.visitor_id)}">Copy visitor ID</button>
        <button class="analytics-dashboard__icon-button" type="button" data-label-visitor="${escapeHtml(visitor.visitor_id)}" data-label="${escapeHtml(visitor.label || "")}" data-notes="${escapeHtml(visitor.notes || "")}">${visitor.label ? "Edit label" : "Add label"}</button>
      </div>
      <div class="analytics-dashboard__modal-grid">
        ${renderDetailCell("First seen", formatDateTime(visitor.first_seen_at))}
        ${renderDetailCell("Last seen", formatDateTime(visitor.last_seen_at))}
        ${renderDetailCell("Device", visitor.device_category)}
        ${renderDetailCell("Country", visitor.last_country || visitor.first_country)}
        ${renderDetailCell("Sessions", formatNumber(visitor.sessions))}
        ${renderDetailCell("Events", formatNumber(visitor.events))}
        ${renderDetailCell("Page views", formatNumber(visitor.page_views))}
        ${renderDetailCell("Errors", formatNumber(visitor.errors))}
      </div>
      ${visitor.notes ? `<p class="analytics-dashboard__muted"><strong>Private notes:</strong> ${escapeHtml(visitor.notes)}</p>` : ""}
      ${renderRows(detail.sessions || [], [
        { key: "started_at", label: "Started", format: formatDateTime },
        { key: "session_id", label: "Session", format: shortSessionId },
        { key: "current_scene", label: "Scene", format: (value) => value || "Unknown" },
        { key: "duration_seconds", label: "Duration", format: formatDuration },
        { key: "referrer", label: "Referrer", format: cleanReferrer },
      ])}
      <div style="height:14px"></div>
      ${renderRows(detail.events || [], [
        { key: "event_name", label: "Event" },
        { key: "events", label: "Count", format: formatNumber },
      ])}
    `;
    card.querySelector("[data-modal-close]")?.addEventListener("click", () => closeDashboardModal(root));
    bindVisitorActions(root);
  } catch (_error) {
    const card = modal.querySelector(".analytics-dashboard__modal-card");
    card.insertAdjacentHTML("beforeend", `<p class="analytics-dashboard__error">Could not load visitor details.</p>`);
  }
}

function bindVisitorActions(root) {
  for (const button of root.querySelectorAll("[data-copy-visitor]")) {
    if (button.dataset.bound === "1") continue;
    button.dataset.bound = "1";
    button.addEventListener("click", async () => {
      const ok = await copyText(button.dataset.copyVisitor || "");
      button.textContent = ok ? "Copied" : "Copy failed";
      setTimeout(() => {
        button.textContent = button.dataset.copyVisitorLabel || "Copy";
      }, 1200);
    });
  }

  for (const button of root.querySelectorAll("[data-label-visitor]")) {
    if (button.dataset.bound === "1") continue;
    button.dataset.bound = "1";
    button.addEventListener("click", () => {
      showLabelModal(root, button.dataset.labelVisitor, button.dataset.label || "", button.dataset.notes || "");
    });
  }

  for (const button of root.querySelectorAll("[data-detail-visitor]")) {
    if (button.dataset.bound === "1") continue;
    button.dataset.bound = "1";
    button.addEventListener("click", () => {
      showVisitorDetailModal(root, button.dataset.detailVisitor);
    });
  }
}

function renderBarList(rows = [], config = {}) {
  const valueKey = config.valueKey || "value";
  const labelKey = config.labelKey || "label";
  const max = Math.max(...rows.map((row) => toNumber(row[valueKey])), 0);
  if (!rows.length || max <= 0) {
    return renderEmpty(config.empty || "No distribution data yet.");
  }

  return `
    <div class="analytics-dashboard__bars">
      ${rows.map((row) => {
        const label = config.labelFormat ? config.labelFormat(row[labelKey], row) : row[labelKey];
        const value = toNumber(row[valueKey]);
        const width = Math.max(3, Math.round((value / max) * 100));
        const detail = config.detail ? config.detail(row) : `${label}: ${formatNumber(value)}`;
        const displayValue = config.valueFormat ? config.valueFormat(value, row) : formatNumber(value);
        return `
          <div class="analytics-dashboard__bar-row" title="${escapeHtml(detail)}">
            <span class="analytics-dashboard__bar-label">${escapeHtml(label || "Unknown")}</span>
            <span class="analytics-dashboard__bar-track"><span class="analytics-dashboard__bar-fill" style="width:${width}%"></span></span>
            <strong class="analytics-dashboard__bar-value">${escapeHtml(displayValue)}</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderLineChart(rows = [], series = []) {
  if (!rows.length || !series.length || rows.every((row) => series.every((item) => toNumber(row[item.key]) === 0))) {
    return renderEmpty("Not enough trend data yet.");
  }

  const width = 720;
  const height = 230;
  const pad = { top: 18, right: 24, bottom: 36, left: 42 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const maxValue = Math.max(1, ...rows.flatMap((row) => series.map((item) => toNumber(row[item.key]))));
  const x = (index) => pad.left + (rows.length === 1 ? plotWidth / 2 : (index / (rows.length - 1)) * plotWidth);
  const y = (value) => pad.top + plotHeight - (toNumber(value) / maxValue) * plotHeight;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  const paths = series.map((item) => {
    const points = rows.map((row, index) => `${x(index).toFixed(2)},${y(row[item.key]).toFixed(2)}`);
    return `
      <polyline
        points="${points.join(" ")}"
        fill="none"
        stroke="${item.color}"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      ${rows.map((row, index) => `
        <circle cx="${x(index).toFixed(2)}" cy="${y(row[item.key]).toFixed(2)}" r="4" fill="${item.color}">
          <title>${escapeHtml(`${item.label} on ${formatBucket(row.bucket)}: ${formatNumber(row[item.key])}`)}</title>
        </circle>
      `).join("")}
    `;
  }).join("");

  const labels = rows
    .filter((_row, index) => index === 0 || index === rows.length - 1 || index === Math.floor(rows.length / 2))
    .map((row, index, selected) => {
      const originalIndex = rows.indexOf(row);
      const anchor = index === 0 ? "start" : index === selected.length - 1 ? "end" : "middle";
      return `<text class="analytics-dashboard__axis" x="${x(originalIndex)}" y="${height - 10}" text-anchor="${anchor}" fill="currentColor">${escapeHtml(formatBucket(row.bucket))}</text>`;
    })
    .join("");

  return `
    <div class="analytics-dashboard__chart">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Traffic trend chart">
        <defs>
          <linearGradient id="trafficGlow" x1="0" x2="1">
            <stop offset="0" stop-color="#1a8dff" stop-opacity="0.22" />
            <stop offset="1" stop-color="#35f2ff" stop-opacity="0.08" />
          </linearGradient>
        </defs>
        ${gridLines.map((line) => {
          const gridY = pad.top + plotHeight - line * plotHeight;
          const label = Math.round(maxValue * line);
          return `
            <line x1="${pad.left}" x2="${width - pad.right}" y1="${gridY}" y2="${gridY}" stroke="rgba(133, 188, 224, 0.13)" />
            <text class="analytics-dashboard__axis" x="10" y="${gridY + 4}" fill="currentColor">${label}</text>
          `;
        }).join("")}
        <rect x="${pad.left}" y="${pad.top}" width="${plotWidth}" height="${plotHeight}" fill="url(#trafficGlow)" opacity="0.5" />
        ${paths}
        ${labels}
      </svg>
      <div class="analytics-dashboard__actions" style="justify-content:flex-start;margin-top:8px">
        ${series.map((item) => `<span class="analytics-dashboard__status"><span class="analytics-dashboard__status-dot" style="background:${item.color};box-shadow:0 0 14px ${item.color}"></span>${escapeHtml(item.label)}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderDonut(rows = [], config = {}) {
  const valueKey = config.valueKey || "sessions";
  const labelKey = config.labelKey || "device_category";
  const total = rows.reduce((sum, row) => sum + toNumber(row[valueKey]), 0);
  if (!rows.length || total <= 0) {
    return renderEmpty(config.empty || "No split data yet.");
  }

  const colors = ["#35f2ff", "#1a8dff", "#8a7cff", "#25f6a5", "#f4bf4f", "#ff7aa2"];
  const radius = 72;
  const circumference = Math.PI * 2 * radius;
  let offset = 0;
  const segments = rows.map((row, index) => {
    const value = toNumber(row[valueKey]);
    const length = (value / total) * circumference;
    const dash = `${length} ${circumference - length}`;
    const strokeDashoffset = -offset;
    offset += length;
    const label = config.labelFormat ? config.labelFormat(row[labelKey], row) : row[labelKey];
    return `
      <circle
        cx="105"
        cy="105"
        r="${radius}"
        fill="none"
        stroke="${colors[index % colors.length]}"
        stroke-width="22"
        stroke-dasharray="${dash}"
        stroke-dashoffset="${strokeDashoffset}"
        transform="rotate(-90 105 105)"
      >
        <title>${escapeHtml(`${label}: ${formatNumber(value)} (${Math.round((value / total) * 100)}%)`)}</title>
      </circle>
    `;
  }).join("");

  return `
    <div class="analytics-dashboard__split">
      <svg viewBox="0 0 210 210" role="img" aria-label="${escapeHtml(config.title || "Distribution chart")}">
        <circle cx="105" cy="105" r="${radius}" fill="none" stroke="rgba(122, 213, 255, 0.12)" stroke-width="22" />
        ${segments}
        <text class="analytics-dashboard__donut-center" x="105" y="102">${formatNumber(total)}</text>
        <text class="analytics-dashboard__donut-label" x="105" y="123">${escapeHtml(config.centerLabel || "sessions")}</text>
      </svg>
      ${renderBarList(rows, {
        labelKey,
        valueKey,
        labelFormat: config.labelFormat,
        detail: (row) => {
          const label = config.labelFormat ? config.labelFormat(row[labelKey], row) : row[labelKey];
          return `${label}: ${formatNumber(row[valueKey])} of ${formatNumber(total)}`;
        },
      })}
    </div>
  `;
}

function getSceneHealth(stats) {
  const totals = (stats.top_scenes || []).reduce((acc, row) => {
    acc.opens += toNumber(row.opens);
    acc.loads += toNumber(row.loads);
    acc.failures += toNumber(row.failures);
    return acc;
  }, { opens: 0, loads: 0, failures: 0 });
  const attempts = totals.loads + totals.failures;
  const successRate = attempts > 0 ? Math.round((totals.loads / attempts) * 100) : null;
  return { ...totals, attempts, successRate };
}

function renderStats(root, stats, sessions, errors) {
  const summary = stats.summary || {};
  const performance = stats.performance_summary || {};
  const health = getSceneHealth(stats);
  const lastRefresh = new Date();
  const recentErrors = errors.errors || [];
  const recentSessions = sessions.sessions || [];
  const activeSessionsList = sessions.active_sessions_list || [];
  const liveRows = activeSessionsList.length ? activeSessionsList : recentSessions.slice(0, 12);
  const currentVisitorId = getCurrentAnalyticsVisitorId();

  root.innerHTML = `
    <div class="analytics-dashboard__shell">
      <header class="analytics-dashboard__top">
        <div>
          <p class="analytics-dashboard__eyebrow">3DHUA Control Panel</p>
          <h1>Campus Analytics</h1>
          <p class="analytics-dashboard__subtitle">
            Anonymous visitor, session, scene, performance, and reliability signals for the HUA 3D Showcase.
          </p>
        </div>
        <div class="analytics-dashboard__actions">
          <span class="analytics-dashboard__status"><span class="analytics-dashboard__status-dot"></span>Worker online</span>
          <span class="analytics-dashboard__status">Last refresh ${escapeHtml(formatDateTime(lastRefresh.toISOString()))}</span>
          <button type="button" data-refresh>Refresh</button>
        </div>
      </header>

      <div class="analytics-dashboard__grid">
        ${renderMetricCard("Live sessions", formatNumber(sessions.active_sessions || 0), "Heartbeat seen in the last 90 seconds")}
        ${renderMetricCard("Visitors today", formatNumber(summary.visitors_today || 0), `${formatNumber(summary.visitors_7d || 0)} visitors in 7 days`)}
        ${renderMetricCard("Sessions today", formatNumber(summary.sessions_today || 0), `${formatNumber(summary.sessions_30d || 0)} sessions in 30 days`)}
        ${renderMetricCard("Page views", formatNumber(summary.page_views_30d || 0), "Total page views in the last 30 days")}
        ${renderMetricCard("Avg session", formatDuration(summary.avg_session_duration || 0), "Based on heartbeat and session end events")}
        ${renderMetricCard("Returning visitors", formatNumber(summary.returning_visitors_30d || 0), "Anonymous visitors with more than one session in 30 days")}
        ${renderMetricCard("Scene success", health.successRate === null ? "n/a" : `${health.successRate}%`, `${formatNumber(health.loads)} loaded / ${formatNumber(health.failures)} failed`)}
        ${renderMetricCard("Performance", performance.samples ? `${formatNumber(performance.avg_fps)} fps` : "n/a", performance.samples ? `${formatNumber(performance.samples)} samples, min ${formatNumber(performance.min_fps)} fps` : "No samples yet")}
        ${renderMetricCard("Recent errors", formatNumber(recentErrors.length), "Latest captured viewer and load errors")}

        ${renderPanel(
          "This browser visitor ID",
          "Use this to label your own browser in the private dashboard. This value is the anonymous localStorage visitor ID, not a public identity.",
          `
            <span class="analytics-dashboard__visitor-badge" title="${escapeHtml(currentVisitorId)}">${escapeHtml(shortVisitorId(currentVisitorId))}</span>
            <div class="analytics-dashboard__visitor-tools">
              <button class="analytics-dashboard__icon-button" type="button" data-copy-visitor="${escapeHtml(currentVisitorId)}">Copy full ID</button>
              <button class="analytics-dashboard__icon-button" type="button" data-label-visitor="${escapeHtml(currentVisitorId)}">Label this browser</button>
              <button class="analytics-dashboard__icon-button" type="button" data-detail-visitor="${escapeHtml(currentVisitorId)}">Details</button>
            </div>
          `,
          { className: "narrow compact", pill: "Private admin use" }
        )}

        ${renderPanel(
          "Traffic overview",
          "Sessions and page views over the last 30 days.",
          renderLineChart(stats.traffic_by_day || [], [
            { key: "sessions", label: "Sessions", color: "#35f2ff" },
            { key: "page_views", label: "Page views", color: "#8a7cff" },
          ]),
          { className: "wide", pill: "30 days" }
        )}

        ${renderPanel(
          "Live activity",
          activeSessionsList.length ? "Active sessions seen in the last 90 seconds." : "No active sessions right now; showing recent sessions instead.",
          renderSessionCards(liveRows),
          { className: "full", pill: `${formatNumber(sessions.active_sessions || 0)} live` }
        )}

        ${renderPanel(
          "Scene engagement",
          "Most-used spaces, with loads and failures included.",
          renderBarList(stats.top_scenes || [], {
            labelKey: "scene_id",
            valueKey: "sessions",
            empty: "No scene engagement yet.",
            detail: (row) => `${row.scene_id}: ${formatNumber(row.sessions)} sessions, ${formatNumber(row.loads)} loads, ${formatNumber(row.failures)} failures`,
          }) + `
            <div class="analytics-dashboard__health">
              <div class="analytics-dashboard__health-item"><strong>${formatNumber(health.opens)}</strong><span>Opens</span></div>
              <div class="analytics-dashboard__health-item"><strong>${formatNumber(health.loads)}</strong><span>Loads</span></div>
              <div class="analytics-dashboard__health-item"><strong>${formatNumber(health.failures)}</strong><span>Failures</span></div>
            </div>
          `,
          { className: "wide", pill: "Top scenes" }
        )}

        ${renderPanel(
          "Device mix",
          "Device category distribution for sessions.",
          renderDonut(stats.top_devices || [], {
            valueKey: "sessions",
            labelKey: "device_category",
            centerLabel: "sessions",
            title: "Device distribution",
          }),
          { className: "narrow", pill: "30 days" }
        )}

        ${renderPanel(
          "Browser and OS",
          "Runtime environment captured anonymously by the frontend.",
          `<div class="analytics-dashboard__stack">
            <div>${renderBarList(stats.top_browsers || [], { labelKey: "browser", valueKey: "sessions", empty: "No browser data yet." })}</div>
            <div>${renderBarList(stats.top_os || [], { labelKey: "os", valueKey: "sessions", empty: "No OS data yet." })}</div>
          </div>`,
          { className: "narrow", pill: "Compatibility" }
        )}

        ${renderPanel(
          "Geography",
          "Approximate Cloudflare country/city metadata only. No IP addresses are stored.",
          renderBarList(stats.top_locations || [], {
            labelKey: "country",
            valueKey: "sessions",
            empty: "No geography data yet.",
            labelFormat: (value, row) => [value || "Unknown", row.city].filter(Boolean).join(" / "),
          }),
          { className: "narrow", pill: "Privacy-safe" }
        )}

        ${renderPanel(
          "Referrers",
          "Where sessions are coming from.",
          renderBarList(stats.top_referrers || [], {
            labelKey: "referrer",
            valueKey: "sessions",
            empty: "No referrer data yet.",
            labelFormat: cleanReferrer,
            detail: (row) => `${cleanReferrer(row.referrer)}: ${formatNumber(row.sessions)} sessions`,
          }),
          { className: "narrow", pill: "Acquisition" }
        )}

        ${renderPanel(
          "Performance by device",
          "Average FPS and DPR grouped by anonymous device category.",
          renderBarList(stats.fps_by_device || [], {
            labelKey: "device_category",
            valueKey: "avg_fps",
            empty: "No FPS samples by device yet.",
            detail: (row) => `${row.device_category}: ${formatNumber(row.avg_fps)} avg FPS, ${formatNumber(row.min_fps)} min FPS, ${formatNumber(row.avg_dpr)} avg DPR from ${formatNumber(row.samples)} samples`,
          }),
          { className: "narrow", pill: "FPS" }
        )}

        ${renderPanel(
          "Performance by browser",
          "Average FPS grouped by browser to spot runtime differences.",
          renderBarList(stats.fps_by_browser || [], {
            labelKey: "browser",
            valueKey: "avg_fps",
            empty: "No FPS samples by browser yet.",
            detail: (row) => `${row.browser}: ${formatNumber(row.avg_fps)} avg FPS, ${formatNumber(row.min_fps)} min FPS, ${formatNumber(row.avg_dpr)} avg DPR from ${formatNumber(row.samples)} samples`,
          }),
          { className: "narrow", pill: "Runtime" }
        )}

        ${renderPanel(
          "Session duration by device",
          "Average session length by device category.",
          renderBarList(stats.duration_by_device || [], {
            labelKey: "device_category",
            valueKey: "avg_duration_seconds",
            empty: "No duration data by device yet.",
            detail: (row) => `${row.device_category}: ${formatDuration(row.avg_duration_seconds)} average across ${formatNumber(row.sessions)} sessions`,
            valueFormat: formatDuration,
          }),
          { className: "narrow", pill: "Engagement" }
        )}

        ${renderPanel(
          "Scene reliability",
          "Load success rate by scene.",
          renderSceneReliability(stats.scene_success_rates || []),
          { className: "narrow", pill: "Success rate" }
        )}

        ${renderPanel(
          "Performance and loading",
          "Frame samples and load failure trend from the last 30 days.",
          renderLineChart((stats.failures_by_day || []).map((row) => ({ ...row, page_views: row.failures, sessions: 0 })), [
            { key: "page_views", label: "Load failures", color: "#ff7aa2" },
          ]) + `
            <div class="analytics-dashboard__health">
              <div class="analytics-dashboard__health-item"><strong>${performance.samples ? formatNumber(performance.samples) : "0"}</strong><span>FPS samples</span></div>
              <div class="analytics-dashboard__health-item"><strong>${performance.avg_fps ? formatNumber(performance.avg_fps) : "n/a"}</strong><span>Avg FPS</span></div>
              <div class="analytics-dashboard__health-item"><strong>${performance.avg_dpr ? formatNumber(performance.avg_dpr) : "n/a"}</strong><span>Avg DPR</span></div>
            </div>
          `,
          { className: "wide", pill: "Reliability" }
        )}

        ${renderPanel(
          "Error concentration",
          "Where errors are clustering by scene and device category.",
          `<div class="analytics-dashboard__stack">
            <div>${renderBarList(stats.errors_by_scene || [], { labelKey: "scene_id", valueKey: "errors", empty: "No errors by scene yet." })}</div>
            <div>${renderBarList(stats.errors_by_device || [], { labelKey: "device_category", valueKey: "errors", empty: "No errors by device yet." })}</div>
          </div>`,
          { className: "narrow", pill: "Debugging" }
        )}

        ${renderPanel(
          "Errors and failures",
          "Recent viewer errors and scene load failures.",
          renderRows(recentErrors, [
            { key: "timestamp", label: "Time", format: formatDateTime },
            { key: "visitor_id", label: "Visitor", html: true, format: (_value, row) => renderVisitorBadge(row) },
            { key: "scene_id", label: "Scene", format: (value) => value || "Unknown" },
            { key: "error_type", label: "Type", format: (value) => value || "Error" },
            { key: "message", label: "Message", format: (value) => value || "No message" },
          ]),
          { className: "full", pill: `${formatNumber(recentErrors.length)} recent` }
        )}
      </div>
    </div>
  `;

  root.querySelector("[data-refresh]")?.addEventListener("click", () => loadDashboard(root));
  bindVisitorActions(root);
}

async function loadDashboard(root) {
  root.innerHTML = `
    <div class="analytics-dashboard__login">
      <p class="analytics-dashboard__eyebrow">Connecting</p>
      <h1>Loading analytics</h1>
      <p class="analytics-dashboard__subtitle">Fetching private dashboard data from the Cloudflare Worker.</p>
    </div>
  `;
  try {
    const [stats, sessions, errors] = await Promise.all([
      adminFetch("/admin/stats"),
      adminFetch("/admin/sessions"),
      adminFetch("/admin/errors"),
    ]);
    renderStats(root, stats, sessions, errors);
  } catch (_error) {
    sessionStorage.removeItem(TOKEN_KEY);
    renderLogin(root, "Session expired or analytics Worker unavailable.");
  }
}

function renderLogin(root, message = "") {
  root.innerHTML = `
    <form class="analytics-dashboard__login" data-login-form>
      <p class="analytics-dashboard__eyebrow">Private cockpit</p>
      <h1>Analytics Login</h1>
      <p class="analytics-dashboard__subtitle">Admin authentication is handled by the Cloudflare Worker. No password is stored in the frontend.</p>
      <label>
        Password
        <input type="password" name="password" autocomplete="current-password" required />
      </label>
      <button type="submit">Sign in</button>
      <p class="analytics-dashboard__error" data-login-error>${escapeHtml(message)}</p>
    </form>
  `;

  root.querySelector("[data-login-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const errorNode = form.querySelector("[data-login-error]");
    const password = new FormData(form).get("password");
    errorNode.textContent = "";

    try {
      const response = await fetch(adminUrl("/admin/login"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      sessionStorage.setItem(TOKEN_KEY, data.token);
      await loadDashboard(root);
    } catch (_error) {
      errorNode.textContent = "Login failed.";
    }
  });
}

function initAnalyticsDashboard() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("analytics") !== "1") {
    return false;
  }

  injectStyles();
  const root = document.createElement("aside");
  root.className = "analytics-dashboard";
  root.setAttribute("aria-label", "Private analytics dashboard");
  document.body.appendChild(root);

  if (sessionStorage.getItem(TOKEN_KEY)) {
    loadDashboard(root);
  } else {
    renderLogin(root);
  }

  return true;
}

export { initAnalyticsDashboard };

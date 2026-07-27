# Lightweight gallery mode — plan

Status: **partially exists already**. This document clarifies what's already in place, what's missing for a true no-3D fallback, and a scoped plan to close the gap.

## What already exists today

The scene-selection screen (`#sceneCardGrid`, built by `renderSceneCards()` / `getSceneCardEntries()` in `main.js`) is, functionally, already a lightweight gallery:

- It renders before any 3D asset loads — the `<model-viewer>` element and PlayCanvas splat viewer only activate once a card is clicked (`selectSceneCard` → `enterViewerMode`).
- Each card shows a static thumbnail image (`assets/thumbnails/*.webp`/`.png`), a title, a short description, and available formats — no WebGL required to browse it.
- Thumbnails use `loading="lazy"`.

So a user who never clicks into a scene is, today, already in a "gallery-only" experience. What's missing is a way to stay there deliberately and get more out of it, for people who know upfront that 3D won't load smoothly for them (low-end device, metered/slow connection, or a prior failed load).

## Gaps

1. **No explicit opt-in.** There's no visible "Gallery mode" / "Low-bandwidth mode" toggle — a user only ends up gallery-only by never clicking a card, which isn't discoverable as an intentional mode.
2. **One photo per scene.** `assets/thumbnails/` has exactly one image per scene. A real gallery fallback (letting someone "see" a space without loading it) would benefit from 2–4 stills per scene (e.g. an entry view + one or two interior angles). No such assets currently exist; this is a content gap, not a code gap.
3. **No persistence.** Even if a user backs out of a failed/slow scene load (`#statusBack`, already implemented), the app doesn't remember "prefer gallery mode" for next time — every visit starts by trying to load 3D again once a card is clicked.
4. **No low-bandwidth signal used automatically.** The browser exposes `navigator.connection.saveData` / `navigator.connection.effectiveType` in supporting browsers, which the app doesn't currently read anywhere (checked `main.js`, `viewer/*` — no `navigator.connection` usage). This could pre-select gallery mode instead of the full 3D flow.

## Proposed shape

1. **Add an explicit "Gallery mode" toggle** near the scene-selection header (`.scene-selection` in `index.html`), persisted the same way as `hua3d.debugLogs` (`localStorage`). When on, `selectSceneCard()` shows an expanded card detail (larger image, full description, credits once surfaced — see `docs/credits` in `assets/manifest.json`) instead of calling into `enterViewerMode()`/loading any GLB or SOG asset. This is a pure UI branch at the single existing entry point (`selectSceneCard`), so it doesn't touch loading/streaming internals.
2. **Respect `navigator.connection.saveData`/`effectiveType`** (where available) to default the toggle on, same spirit as the existing device-based quality selection in `viewer/sceneExperience.js` (`performance.mobileQuality` / `desktopQuality`).
3. **Content follow-up (not code):** capture 2–3 additional stills per space during future scans, so gallery mode has more than a single thumbnail to show. This can piggyback on whatever capture pass eventually fills in `dateScanned` in the new `credits` metadata (`assets/manifest.json`).

## Non-goals for this pass

Do not rework `enterViewerMode`, the streamed/LOD loading pipeline, or `viewer/playCanvasSogViewer.js` to build this — the existing card grid already provides the "doesn't require 3D" property; the work here is making that an explicit, sticky choice rather than an implicit one.

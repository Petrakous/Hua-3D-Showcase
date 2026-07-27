# 3DHUA — Harokopio University 3D Showcase

An interactive, browser-based 3D showcase of the Harokopio University campus, built by the [HUA Computer Vision Group](https://gr.linkedin.com/company/hua-computer-vision-group). Visitors can explore the outdoor campus (day/dusk/night) and step inside key buildings and labs, rendered from real capture data as both classic meshes (GLB) and Gaussian splats (SOG).

Live site: https://petrakous.github.io/Hua-3D-Showcase/

## Features

- **Outdoor campus cycle** — day, dusk, and night lighting stages of the main campus.
- **Indoor spaces** — Main Hall, classrooms, labs, kitchen, amphitheater, fitness center, and more.
- **Dual rendering paths** — a classic textured mesh (GLB, via `<model-viewer>`) and a Gaussian splat renderer (SOG, via PlayCanvas), with automatic quality/format fallbacks.
- **Level-of-detail (LOD) and streamed splat loading** — large scenes progressively load detail instead of blocking on one huge payload.
- **Walk / fly / orbit navigation** with first-person collision in supported scenes.
- **Cancelable scene loading** with retry and "back to all spaces" recovery if a scene fails or times out.
- **Anonymous usage analytics** via a Cloudflare Worker (see [`analytics-worker/`](analytics-worker/)).

## Quick start

This is a static site — no build step is required to run it locally.

```bash
python -m http.server 8767
# then open http://localhost:8767
```

(`run.bat` does the same thing on Windows.) Any static file server works; the app is plain HTML/CSS/JS loaded via `<script type="module">`.

By default, `localhost`/`file://` serves 3D assets from the local `dist-r2-assets/` folder (see [Asset pipeline](#asset-pipeline) below). To preview against the production CDN instead, append `?assets=remote` to the URL. Conversely, `?assets=local` forces local assets even when deployed.

## Project structure

```
index.html            Page shell: hero viewer, scene-selection grid, loading/status overlay
main.js                App logic: scene switching, loading states, controls, analytics wiring
styles.css              All styling (no CSS framework)
viewer/
  sceneCatalog.js       Per-scene asset wiring (GLB/SOG sources, camera presets, collision boxes)
  sceneExperience.js     Per-scene UI content (titles, descriptions, navigation capabilities, loading copy)
  playCanvasSogViewer.js  Gaussian splat (SOG) renderer, built on PlayCanvas
  fpNavigation.js / fpCollision.js   First-person walk/fly movement and collision
  autoCutaway.js          Interior "cutaway box" culling for indoor splat scenes
  cinematicMode.js         Camera path recording/playback (internal authoring tool)
  sceneCalibrations.js     Saved per-scene calibration data (manual boxes, camera presets)
  logger.js               Lightweight debug logger (enable with `localStorage.hua3d.debugLogs = "1"`)
assets/
  manifest.json          Source of truth for which scenes are active and where their assets live (local vs. R2/CDN)
  thumbnails/             Scene-card preview images
analytics/
  client.js / dashboard.js  Frontend analytics event sender + admin dashboard
analytics-worker/       Cloudflare Worker + D1 backend for analytics (see its own README)
scripts/                 Node/Python tooling for the asset pipeline (see below)
docs/                    Planning and architecture notes (accessibility, gallery mode, i18n, guided tour, avatars, known issues)
```

## How a scene is defined

Each space is described in two places that are kept in sync by scene ID:

- **`viewer/sceneCatalog.js`** — the *technical* definition: which GLB/SOG files to load, camera orbit limits, collision geometry, LOD/streaming sources.
- **`viewer/sceneExperience.js`** — the *content* definition: title, subtitle, description, category, which navigation modes are available, and loading-screen copy.
- **`assets/manifest.json`** — the *asset resolution* layer: maps a scene ID to its actual files, both for local dev (`dist-r2-assets/`) and the production CDN, plus per-scene credits metadata (capture method, contributors, scan date, model formats — see [Credits metadata](#credits-metadata)).

To add or edit a space's blurb, see [Improving space descriptions](#improving-space-descriptions) below.

## Credits metadata

Every scene entry in [`assets/manifest.json`](assets/manifest.json) carries a `credits` object:

```json
"credits": {
  "captureMethod": "3D Gaussian Splatting capture (SOG), paired with a photogrammetry-derived mesh (GLB) for collision/LOD",
  "contributors": ["Harokopio University Computer Vision Group"],
  "dateScanned": null,
  "modelFormat": ["glb", "sog"]
}
```

`dateScanned` is intentionally `null` where the exact capture date isn't recorded yet — fill it in (`"YYYY-MM-DD"` or a `"YYYY-MM"` if only the month is known) as scan dates are confirmed. `contributors` accepts a list, so per-scene capture teams or individual credits can be added without changing the schema. This is metadata only for now; nothing in the app renders it yet — see [`docs/gallery-mode-plan.md`](docs/gallery-mode-plan.md) and future work for where a "Credits" UI surface could consume it.

## Asset pipeline

3D assets (GLB meshes, SOG splats, LOD tiers, collision meshes) are too large to keep in the git repo and are hosted on Cloudflare R2. `assets/manifest.json` is the source of truth for what's active and where each file lives:

- `npm`-free Node scripts in [`scripts/`](scripts/) (run with `node scripts/<name>.mjs`):
  - `validate_manifest.mjs` — checks that every asset referenced in the manifest actually exists locally; reports missing files/roles.
  - `audit_active_assets.mjs` — summarizes size/status of all assets currently marked active.
  - `stage_r2_assets.mjs` — copies local source files into the `dist-r2-assets/` staging layout the manifest expects.
  - `upload_r2_assets.mjs` / `upload_staged_r2_prefix.mjs` — pushes staged assets to the R2 bucket.
- `scripts/make_collision.py` — builds a lightweight, decimated collision mesh (no textures) from a GLB or a folder of GLB tiles, for first-person walk-mode collision.

Run any script with no arguments to see its expected flags (they use a shared `parseArgs` helper in `asset_manifest_lib.mjs`).

## Deployment

Pushing to `main` triggers [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml), which publishes the repository root directly to GitHub Pages — no build step. This means anything committed under the site root is public once merged to `main`.

## Analytics

Anonymous, IP-free usage analytics (visits, scenes explored, device/location aggregates) are collected via a Cloudflare Worker + D1 database. See [`analytics-worker/README.md`](analytics-worker/README.md) for setup, endpoints, and local development.

## Planning and architecture notes

Ongoing design work that hasn't shipped yet lives in [`docs/`](docs/):

- [`docs/accessibility-plan.md`](docs/accessibility-plan.md) — reduced motion, simplified controls, high-contrast labels, keyboard-first navigation.
- [`docs/gallery-mode-plan.md`](docs/gallery-mode-plan.md) — a lightweight, no-3D fallback experience for low-bandwidth/low-power visitors.
- [`docs/multilingual-plan.md`](docs/multilingual-plan.md) — i18n approach for a currently English-only, hardcoded-string codebase.
- [`docs/guided-tour-architecture.md`](docs/guided-tour-architecture.md) — how a scripted, multi-scene guided tour could build on the existing `future.tour` stub.
- [`docs/avatar-feature-architecture.md`](docs/avatar-feature-architecture.md) — feasibility notes for a visible character/avatar in walk mode.
- [`docs/known-issues.md`](docs/known-issues.md) — investigation notes on the "model disappears completely" reports and a Streamed-Engine outdoor-scene direction inconsistency, with suspected cause, affected files, and recommended next steps (not yet fixed).

## Contributing

Keep changes small and scoped — this is a small-team project without a formal CI test suite, so reviewability matters more than cleverness. When touching scene data, run `node scripts/validate_manifest.mjs` before committing. When touching the SOG/GLB viewers, manually verify in a real browser (dev tools alone won't catch splat orientation/culling issues).

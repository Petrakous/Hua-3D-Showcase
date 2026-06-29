# HUA 3D Showcase - Current Handoff

Updated: after Phase 1, Phase 2 runtime, Phase 2B validation, Phase 2C deployment hardening, and Scene Experience migration.

## Project purpose

HUA 3D Showcase is a browser-based, multi-scene 3D presentation for Harokopio University. It presents outdoor campus spaces, indoor rooms/labs, and DIT content through GLB and SOG assets.

The project is not an early prototype anymore. It is a mature interactive viewer with:

* scene selection cards
* GLB viewing
* SOG LOD viewing
* SOG Streamed viewing
* mobile touch controls
* D-pad movement
* tap-to-move
* desktop pointer-lock / WASD navigation
* walk/fly first-person modes
* collision support
* calibration defaults
* local/remote manifest-driven asset resolution
* Cloudflare R2/CDN-style deployment support
* centered loading/status/error overlay
* Retry flow for failed loads
* hardened validation and deployment scripts

## Active scenes

The current active showcase includes 13 scenes:

Outdoor:

* Campus Day
* Campus Dusk
* Campus Night

Indoor:

* Main Hall
* Metabolism
* Systasis
* Fitness
* Classroom 5
* Biology Lab
* Amphitheater
* Geo 3.3
* Kitchen

DIT:

* DIT

## Core files and source-of-truth roles

Main UI/runtime:

* `index.html`: application shell, viewer controls, loading/error overlay.
* `styles.css`: responsive layout, cards, overlay, mobile controls.
* `main.js`: scene selection, viewer orchestration, GLB/SOG switching, loading lifecycle, runtime/default selection, calibration UI, and integration with scene experience metadata.

Viewer/runtime modules:

* `viewer/sceneCatalog.js`: scene/content capability source of truth. Defines scenes, available formats, runtimes, collision sources, sources/presets, and grouping.
* `viewer/sceneExperience.js`: new scene experience layer. Defines how each scene should be presented and experienced.
* `viewer/sceneCalibrations.js`: committed calibration defaults.
* `viewer/playCanvasSogViewer.js`: PlayCanvas SOG rendering, streamed behavior, lifecycle, orbit/first-person setup, performance behavior.
* `viewer/fpNavigation.js`: desktop pointer-lock/WASD, walk/fly, touch look, D-pad, tap-to-move.
* `viewer/fpCollision.js`: collision extraction/querying, spawn resolution, collision cache.

Asset/deployment:

* `assets/manifest.json`: asset/deployment source of truth. Do not edit casually.
* `scripts/validate_manifest.mjs`: local manifest and cross-source validation.
* `scripts/asset_manifest_lib.mjs`: shared manifest parsing/validation helpers.
* `scripts/stage_r2_assets.mjs`: staging active assets into `dist-r2-assets`.
* `scripts/upload_r2_assets.mjs`: R2/CDN upload flow.
* `scripts/audit_active_assets.mjs`: active asset audit.

Large source assets live under `GLBs/` and `PLYs/`. Staged deployment content lives under `dist-r2-assets/`. Do not move, rename, regenerate, delete, or upload large assets as part of ordinary UI/runtime work.

## Current architecture after recent phases

### Manifest vs catalog vs experience

The architecture now intentionally separates responsibilities:

* `assets/manifest.json` answers: **where are the assets locally/remotely and how are they deployed?**
* `viewer/sceneCatalog.js` answers: **what scenes exist and what formats/runtimes/capabilities do they support?**
* `viewer/sceneExperience.js` answers: **how should each scene be presented to the user?**

The scene experience layer is now the intended place for:

* scene title/subtitle/description
* category/group/card metadata
* preferred format/runtime defaults
* navigation capabilities
* loading copy
* performance/weight metadata
* fallback strategy
* future hooks for hotspots, guided tours, and portals

Do not re-scatter scene presentation metadata back into `main.js`.

## Completed work before current UI phase

### UI and navigation foundation

Already completed:

* Replaced older side-panel-first selection flow with scene card selection and viewer Back flow.
* Added centered loading/status overlay.
* Added mobile Streamed SOG touch-drag look.
* Added mobile D-pad movement.
* Added tap-to-move for streamed first-person scenes.
* Preserved desktop pointer-lock/WASD behavior.
* Preserved GLB, SOG LOD, SOG Streamed, walk/fly, calibration, manifest/R2 flow, and scene switching.

### Phase 1 robustness

Implemented:

1. Pinned CDN dependencies:

   * PlayCanvas `2.20.1`
   * model-viewer `4.3.1`
2. Added internal load-generation/disposed guard inside `PlayCanvasSogViewer`.
3. Added debug-gated first-person and collision logs.
4. Added pointer-lock error/rejection recovery.
5. Added deterministic four-entry LRU collision cache.
6. Added Retry action to the existing loading/error overlay.

### Phase 2 runtime robustness

Implemented:

1. Streamed SOG first-valid-frame readiness:

   * Streamed scene readiness waits for PlayCanvas render/frame signal instead of only asset promise completion.
   * A fallback prevents indefinite loading if a non-critical render event does not fire.
2. Canvas pixel budget:

   * Internal render resolution is bounded on high-DPR devices.
   * Mobile/tablet and desktop budgets are separate and tunable.
3. Render-aware performance sampling:

   * Performance monitor prefers PlayCanvas/render-loop timing where available.
   * RAF fallback remains available.
4. DPR/resolution hold-time spike filtering:

   * Avoids immediate quality changes from short temporary spikes.

### Phase 2B local validation robustness

Implemented in validation scripts:

* top-level manifest schema checks
* required asset property checks
* duplicate scene ID detection
* duplicate asset ID detection
* duplicate R2/remote key detection
* unsafe path detection
* catalog vs manifest active scene cross-checks
* calibration key cross-checks
* scene experience validation
* clear error/warning classification

Current manifest validation should pass with no errors/warnings unless new data has been introduced.

### Phase 2C deployment robustness

Implemented in upload/deployment scripts:

* safer dry-run behavior by default
* file count and total byte summaries
* explicit Content-Type policy
* explicit Cache-Control policy
* SHA-256 checksum generation
* local `upload_report.json` generation
* `upload_report.json` added to `.gitignore`
* optional `--verify` behavior using HEAD-style remote checks when available
* no real upload unless explicitly requested through the upload script’s execution path

### Scene Experience migration

Implemented:

* Added `viewer/sceneExperience.js`.
* Added explicit experience metadata for all 13 active scenes.
* `main.js` now consumes the experience layer for:

  * scene card metadata
  * category/title/description metadata
  * preferred format logic
  * loading copy/status text
  * navigation availability for walk/fly controls where safe
* Validation now checks experience metadata consistency.
* Future hooks exist for:

  * hotspots
  * guided tours
  * portals

Guided tours, hotspots, and portals are intentionally future work. Do not implement them yet unless explicitly requested.

## Current user-verified status

The user has manually checked the site after the Scene Experience migration and reports that the site works normally.

Do not spend credits redoing old broad verification unless a new change directly requires it.

## Current next phase: UI polish by Codex only

The next intended phase is UI/product polish, handled by Codex for consistency.

Primary goal:
Improve the first impression and mobile/desktop UI experience without touching runtime engine logic.

Likely UI areas:

* scene selection cards
* card grouping/categories
* card title/subtitle/description usage from `sceneExperience.js`
* mobile layout clarity
* viewer Back button placement
* reset / 360 / utility control placement
* loading overlay visual polish
* cleaner product-like look

Important:
This phase should use the new `sceneExperience.js` metadata rather than hardcoding labels/descriptions in `main.js`.

## UI phase constraints

For the UI phase:

Allowed files, if needed:

* `index.html`
* `styles.css`
* `main.js`
* `viewer/sceneExperience.js` only for metadata/UI-copy adjustments
* `viewer/sceneCatalog.js` only if metadata compatibility truly requires it

Avoid touching:

* `viewer/playCanvasSogViewer.js`
* `viewer/fpNavigation.js`
* `viewer/fpCollision.js`
* `assets/manifest.json`
* `scripts/upload_r2_assets.mjs`
* `scripts/stage_r2_assets.mjs`
* `scripts/asset_manifest_lib.mjs`
* `scripts/validate_manifest.mjs`
* asset folders such as `GLBs/`, `PLYs/`, `dist-r2-assets/`

Do not change:

* GLB/SOG loading logic
* Streamed readiness logic
* first-person navigation logic
* tap-to-move logic
* collision logic
* R2 upload/deployment behavior
* manifest structure
* asset paths
* calibration defaults

Do not move, rename, regenerate, upload, delete, or create large assets.

## Recommended minimal checks after UI work

Do not run huge automation unless necessary.

Cheap checks:

* `node --check main.js`
* `node --check viewer/sceneExperience.js`
* `git diff --check`
* `node scripts/validate_manifest.mjs`

Manual smoke check:

* open app
* scene cards render
* select one outdoor scene
* select one indoor scene
* select DIT scene
* Back returns to card screen
* loading overlay still appears
* one GLB works
* one SOG or Streamed scene works
* mobile viewport around 390px still usable
* no obvious browser console errors

## Important product direction

The app should feel like an official university 3D showcase, not a debug viewer.

Design direction:

* clean
* modern
* minimal
* responsive
* presentation-ready
* not overloaded with controls
* user-friendly language
* clear scene selection
* viewer mode should prioritize the 3D content

Keep advanced/debug controls hidden or visually secondary unless they are essential for normal use.

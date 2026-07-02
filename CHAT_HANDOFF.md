# HUA 3D Showcase - Current Handoff

Updated: after Phase 1, Phase 2 runtime, Phase 2B validation, Phase 2C deployment hardening, Scene Experience migration, and developer cinematic capture/authoring mode.

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
* developer-only cinematic capture and camera-path authoring

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
* `viewer/cinematicMode.js`: developer-only cinematic paths, smooth playback, keyboard controls, authoring bookmarks, preview, export, and per-scene draft persistence.
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

### Developer cinematic capture mode

Implemented a removable, query-param-gated cinematic system for PlayCanvas SOG and Streamed SOG scenes only.

Activation:

* `?cinematic=1` enables playback-only trailer capture mode.
* Cinematic code is dynamically imported only when that query parameter is enabled.
* Normal site startup and the `<model-viewer>` GLB camera are unchanged.

Playback behavior:

* Uses the real PlayCanvas camera, so splat LOD and streaming remain camera-driven.
* Position and look target use eased Catmull-Rom interpolation; optional FOV is interpolated too.
* Normal orbit/first-person camera writes pause while cinematic ownership is active.
* Cutaway updates, rendering, adaptive performance, LOD, and splat streaming continue normally.
* `Escape` releases cinematic ownership and returns to a controller-consistent camera pose.

Playback controls:

* `1`: Exterior Day - Entrance Push
* `2`: Exterior Dusk - Matching Angle
* `3`: Main Hall Walkthrough
* `4`: Amphitheater Reveal
* `5`: Exterior Night - Montage Placeholder
* `Space`: pause/resume
* `R`: restart
* `H`: hide/show cinematic overlay
* `Escape`: stop and return camera control

The numbered paths switch to the required existing SOG scene through the normal scene-loading flow before playback. Their coordinates are rough placeholders and should be replaced with authored paths after visual review.

In playback-only mode, scoped CSS hides the header, navigation, status/calibration panels, labels, viewer buttons, decorative layers, orbit indicator, mobile controls, and performance toast without hiding the canvas.

### Cinematic camera authoring/bookmark mode

Implemented `?cinematic=1&author=1` for building paths directly in the browser.

Author mode intentionally keeps the normal scene-selection and viewer controls visible so a developer can load a SOG scene and position the camera normally. It adds a compact overlay showing:

* active scene ID/name
* keyframe count and selected index
* authored path duration
* live scene-local camera position, target, and FOV
* control reminder and copy/export status

Author controls:

* `K`: append the current camera pose as a keyframe
* `Shift+K`: replace the selected keyframe with the current pose
* `[` / `]`: select previous/next keyframe
* `Delete` / `Backspace`: remove selected keyframe
* `P`: preview the authored path with the production cinematic interpolation
* `Space`: pause/resume preview
* `R`: restart preview
* `C`: copy clean path JSON to the clipboard
* `L`: log path JSON to the browser console
* `H`: hide/show overlay
* `Escape`: release cinematic camera control

Captured poses are converted from PlayCanvas world coordinates back into the active splat entity's local coordinate space. Orbit targets are used where available; otherwise a look target is derived from camera forward direction. Exports use the existing array vector convention and include path ID/name, scene ID, duration, keyframe time, position, target, FOV, and easing.

Draft persistence:

* One authored draft is stored per active scene.
* Storage key: `hua3d.cinematic.authoring.<sceneId>`
* Drafts auto-save after add, update, and remove operations.
* Drafts auto-load when author mode observes a new active SOG scene.

Current authoring limitations:

* One path per scene; no multi-scene timeline or automatic edit/cut authoring.
* No 3D keyframe gizmos or spline visualization.
* Segment spacing defaults to three seconds; exported times can be edited manually.
* Authoring targets PlayCanvas SOG cameras only, not `<model-viewer>` GLB scenes.

Files changed for cinematic work:

* `main.js`
* `styles.css`
* `viewer/playCanvasSogViewer.js`
* new `viewer/cinematicMode.js`

Validation performed:

* JavaScript syntax checks pass for `main.js`, `viewer/playCanvasSogViewer.js`, and `viewer/cinematicMode.js`.
* `git diff --check` passes (line-ending warnings may still reflect the repository's Windows checkout settings).
* Playback-only cinematic mode was browser-smoke-tested earlier for scene switching, active canvas playback, pause/resume, restart, overlay toggle, and absence of console errors.

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

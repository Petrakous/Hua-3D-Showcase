# HUA 3D Showcase - Current Handoff

Updated: 2026-06-29

## Project purpose and current state

HUA 3D Showcase is a browser-based, multi-scene 3D presentation for Harokopio University. It supports outdoor campus views, indoor spaces and DIT content through GLB and SOG assets. The application is mature and operational: scene cards, centered loading UI, GLB viewing, SOG LOD, SOG Streamed, calibration, manifest/R2 resolution and responsive controls are all present.

The current catalog covers Campus Day/Dusk/Night, Main Hall, Metabolism, Systasis, Fitness, Classroom 5, Biology Lab, Amphitheater, Geo 3.3, Kitchen and DIT.

## Architecture and sources of truth

- `index.html`: application shell, viewer controls and loading/error overlay.
- `styles.css`: responsive shell, cards, overlay and mobile controls.
- `main.js`: scene selection, GLB/SOG orchestration, runtime/mode switching, loading lifecycle and calibration UI.
- `viewer/sceneCatalog.js`: scene definitions and supported formats/runtimes.
- `viewer/playCanvasSogViewer.js`: PlayCanvas SOG rendering, streaming, lifecycle, orbit/FP setup and collision preview.
- `viewer/fpNavigation.js`: desktop pointer-lock/WASD navigation, walk/fly controllers, mobile touch look, D-pad and tap-to-move.
- `viewer/fpCollision.js`: GLB collision extraction, collision queries, spawn resolution and collision cache.
- `viewer/sceneCalibrations.js`: committed calibration defaults.
- `assets/manifest.json`: asset/deployment source of truth. Do not edit casually.
- `scripts/validate_manifest.mjs`, `stage_r2_assets.mjs`, `upload_r2_assets.mjs`, `audit_active_assets.mjs`: manifest/R2 pipeline.

Large source assets live under `GLBs/` and `PLYs/`; staged deployment content lives in `dist-r2-assets/`; deployed assets resolve through Cloudflare R2. Do not move, rename, regenerate or upload assets as part of ordinary UI/runtime work.

## Work already completed before this Phase 1 patch

- Replaced the previous selection flow with scene selection cards and a viewer Back flow.
- Added a centered loading/status overlay and polished responsive UI.
- Stabilized Streamed SOG mobile input with touch-drag look and an on-screen forward/back/left/right D-pad.
- Kept mobile input independent of pointer lock while preserving desktop pointer-lock/WASD behavior.
- Added mobile tap-to-move for streamed first-person scenes. A short touch tap is distinguished from drag, resolved against collision/scene geometry, and drives the existing collision-aware movement controller toward the target. Movement is straight-line rather than pathfinding; the D-pad remains the fallback.
- Preserved GLB, SOG LOD, SOG Streamed, walk/fly semantics, scene switching and calibration behavior.
- Manifest/R2 asset flow remains unchanged.

## Phase 1 robustness patch implemented in this working tree

All six requested audit items were implemented as a small hardening patch:

1. CDN dependencies are pinned exactly:
   - PlayCanvas: `playcanvas@2.20.1` via jsDelivr ESM.
   - model-viewer: `@google/model-viewer@4.3.1` via jsDelivr.
2. `PlayCanvasSogViewer` now owns a monotonically increasing `loadGeneration` plus `disposed` state. Every load and dispose invalidates older work. Checks after dynamic import, collision preparation, SOG asset loading and collision-preview loading prevent stale async work from mutating a replaced/disposed viewer. `main.js` still retains its separate `activeAssetSwapId` guard.
3. First-person and collision diagnostics now use `DEBUG_FP_NAVIGATION` and `DEBUG_COLLISION`, both defaulting to `false`. Warnings/errors remain available.
4. Pointer-lock failure is handled through both `pointerlockerror` and rejected `requestPointerLock()` promises. Desktop dragging, key and mouse-delta state resets cleanly; touch controls are unaffected.
5. The global collision cache is now a deterministic four-entry LRU. Cache hits are promoted and insertion evicts the least recently used URL, bounding memory while retaining common scene-switch reuse.
6. Failed GLB/SOG loads expose a Retry button in the existing error overlay. Retry calls `applyActiveAssetSelection({ forceReload: true })`, which uses the normal teardown/load path and current scene/format/runtime selection without reloading the page or duplicating listeners/viewers.

Files changed by the Phase 1 patch:

- `index.html`
- `main.js`
- `styles.css`
- `viewer/playCanvasSogViewer.js`
- `viewer/fpNavigation.js`
- `viewer/fpCollision.js`
- `CHAT_HANDOFF.md`

No catalog, manifest, calibration, asset or deployment files were changed.

## Validation completed

- `node --check main.js`
- `node --check viewer/playCanvasSogViewer.js`
- `node --check viewer/fpNavigation.js`
- `node --check viewer/fpCollision.js`
- `git diff --check`
- `node scripts/validate_manifest.mjs`: passed for 13 scenes and 2,096 files.
- `node scripts/audit_active_assets.mjs`: completed successfully; declared staged sources exist.

Automated browser testing of localhost was blocked by the configured browser security policy, so interactive runtime checks were not claimed.

## Manual smoke test still required

1. Desktop: load one GLB, one SOG LOD and one SOG Streamed scene; verify pointer lock, mouse look and WASD.
2. Mobile emulation at 390 px, 430 px and landscape: verify touch look, D-pad, tap-to-move and tappable UI.
3. Lifecycle stress: Streamed -> LOD -> Streamed, Streamed -> GLB -> Streamed, Back -> another scene, plus fast repeated switches.
4. Force one failed GLB or SOG request and confirm Retry re-attempts the same selection without duplicate controls or overlays.
5. If available, repeat Streamed navigation on a real phone.

## Known limitations and next considerations

- Tap-to-move is collision-aware straight-line travel, not navmesh/pathfinding. It may stop when an obstacle blocks the direct route.
- The collision LRU bounds retained cache entries but does not cancel an already-started load after eviction.
- Pointer-lock recovery is intentionally silent; no extra toast was added because state recovery is sufficient and keeps the patch non-intrusive.
- This working tree contains the Phase 1 changes and handoff update but they have not been committed in this chat.

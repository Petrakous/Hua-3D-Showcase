# HUA 3D Showcase Current Context

## Project Summary

The project is a browser-based 3D showcase for Harokopio University. It presents campus and indoor spaces through an interactive viewer that supports both `GLB` and `SOG` scene formats.

The current application is not a single-scene prototype. It is a multi-scene presentation system with:

- outdoor campus scenes
- indoor room and lab scenes
- DIT scene support
- time-of-day switching
- quality switching
- format switching between `GLB` and `SOG`
- runtime switching for `SOG`
- first-person navigation where applicable
- manifest-driven local/remote asset resolution

## Main Purpose

The main purpose of the project is to provide a polished and flexible 3D presentation layer for university spaces, with support for:

- visual presentation of the campus at different times of day
- exploration of interior spaces
- runtime selection depending on fidelity and performance needs
- local development with large source assets
- remote delivery through staged and uploaded asset bundles

## Core Runtime Files

Main entry points:

- `index.html`
- `main.js`
- `styles.css`

Viewer/runtime modules:

- `viewer/sceneCatalog.js`
- `viewer/playCanvasSogViewer.js`
- `viewer/fpNavigation.js`
- `viewer/fpCollision.js`
- `viewer/sceneCalibrations.js`
- `viewer/autoCutaway.js`
- `viewer/clipShader.js`
- `viewer/fpNavigation.js`

## Current Architecture

### UI Layer

`index.html` defines the main showcase shell and controls:

- header actions
- quality toggle
- fullscreen toggle
- calibration toggle
- time-of-day controls
- navigation groups
- format controls
- SOG engine controls
- first-person mode controls
- LOD controls
- viewer status area

### Application Orchestration

`main.js` is the orchestration layer. It:

- loads the location and scene catalog
- switches active scenes and scene formats
- manages viewer mode transitions
- wires UI controls to the live runtime
- resolves assets through the manifest
- handles local vs remote asset modes
- manages calibration UI state and persistence
- applies device-aware performance defaults

### Scene Catalog

`viewer/sceneCatalog.js` is the source of truth for scene definitions. It currently groups content into:

- `outdoors`
- `indoors`
- `dit`

The catalog defines scene ids, labels, available formats, runtime sources, streaming sources, collision sources, and view presets.

### SOG Runtime

`viewer/playCanvasSogViewer.js` is the main SOG rendering/runtime layer. It is responsible for:

- PlayCanvas-based SOG rendering
- orbit behavior where supported
- streamed viewing behavior
- cutaway and clipping behavior
- performance-aware runtime adjustments
- runtime attachment of first-person navigation and collision systems

### First-Person Navigation

`viewer/fpNavigation.js` provides the first-person controller behavior, including:

- walk mode
- fly mode
- pointer-lock look input
- keyboard movement
- gravity and jump behavior
- collision-aware movement

### Collision Support

`viewer/fpCollision.js` provides collision extraction and mesh-based collision support from GLB assets, especially for streamed interior navigation scenarios.

## Scene Coverage

Based on the current manifest and catalog, the active showcase includes:

Outdoor:

- Campus Day
- Campus Dusk
- Campus Night

Indoor:

- Main Hall
- Metabolism
- Systasis
- Fitness
- Classroom 5
- Biology Lab
- Amphitheater
- Geo 3.3
- Kitchen

DIT:

- DIT

## Formats and Modes

The project currently supports:

- `GLB` scenes for conventional model presentation
- `SOG` scenes for advanced runtime viewing

For `SOG`, the current codebase supports runtime distinctions such as:

- `LOD`
- `Streamed`

For eligible streamed indoor scenes, the runtime also supports:

- `Walk`
- `Fly`

## Asset System

The asset system is manifest-driven through:

- `assets/manifest.json`

This manifest defines:

- active scenes
- pilot scenes
- local source paths
- staged output paths
- remote R2 keys
- asset base URLs for local and remote modes

The application resolves assets dynamically depending on environment:

- `local` mode for local/file/localhost usage
- `remote` mode for deployed usage

## Asset Pipeline

Key asset pipeline scripts:

- `scripts/validate_manifest.mjs`
- `scripts/stage_r2_assets.mjs`
- `scripts/upload_r2_assets.mjs`
- `scripts/audit_active_assets.mjs`
- `scripts/asset_manifest_lib.mjs`

These scripts support:

- validation of manifest entries against local source files
- staging of active assets into `dist-r2-assets`
- upload preparation for Cloudflare R2
- auditing of the active asset set

## Current Asset Status

The current manifest is valid against the local asset set.

Validation result observed in the current workspace:

- manifest validation passed
- active asset coverage includes 13 active scenes
- total validated files: `2096`

This indicates that the currently declared active scenes and their asset references are present locally and consistent with the manifest structure.

## Deployment Model

The repo keeps large source assets out of normal git tracking patterns and uses:

- local source folders such as `GLBs/` and `PLYs/`
- staged distribution output in `dist-r2-assets/`
- remote hosting via Cloudflare R2

This allows the app to work both:

- locally with source assets
- remotely with staged CDN-style asset delivery

## Current Project Position

The project should currently be understood as a working and fairly mature 3D showcase platform, not as an early prototype.

The codebase already demonstrates:

- structured multi-scene support
- multiple runtime paths
- device/performance-aware behavior
- a dedicated asset manifest model
- runtime controls for scene exploration
- support for both presentation and interactive navigation

## Maintenance Notes

When updating the project, treat the following as primary sources of truth:

- `main.js`
- `viewer/sceneCatalog.js`
- `viewer/playCanvasSogViewer.js`
- `assets/manifest.json`

Treat this file as a high-level current-state overview only. If this file and runtime behavior disagree, prefer the code.

## Git/Workspace Notes

At the time this context was rewritten, the workspace was not fully clean. Existing local changes should be reviewed carefully before resets or destructive git actions.

Do not assume historical notes or old handoff items in previous versions of this file are still accurate.

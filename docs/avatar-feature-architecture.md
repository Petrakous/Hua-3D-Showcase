# Character / avatar feature — architecture investigation

Status: **not implemented, and a meaningfully larger lift than the other planned features.** This document scopes what a visible avatar would require and why.

## Current model: camera *is* the player

`viewer/fpNavigation.js` implements walk/fly navigation as pure camera movement — there is no player entity, mesh, or rig anywhere in the codebase. Confirmed by inspection:

- Movement constants (`DEFAULT_WALK_SPEED`, `DEFAULT_EYE_HEIGHT`, `DEFAULT_JUMP_SPEED`, `DEFAULT_COLLISION_RADIUS`, `DEFAULT_STEP_HEIGHT`, `DEFAULT_HEAD_OFFSET`) all describe camera behavior directly — an eye height offset, not a body height; a collision radius applied to the camera itself, not a character capsule with a separate camera mount.
- `viewer/fpCollision.js` raycasts/sweeps from the camera position (see the collision-preview overlay logic in `viewer/playCanvasSogViewer.js`, which seeds itself from `getSceneTransform()`/camera-relative transforms, not a character entity).
- There is no "third-person" camera mode anywhere in `main.js` or the viewer modules — orbit mode orbits a target point, walk/fly mode moves the camera directly. There's no concept of a camera trailing behind a visible character.

This is a completely standard and reasonable architecture for a first-person walkthrough tool, but it means an avatar isn't "add a model and show it" — it's a new navigation mode.

## What a visible avatar would require

1. **A character entity**, separate from the camera, with its own position/rotation driven by the same input `fpNavigation.js` already parses (WASD/touch joystick) — the navigation *input handling* is reusable, but the *output* currently writes straight to camera transform and would need to instead drive a character entity that the camera follows/mounts to.
2. **A third-person camera rig** (offset + smoothing behind the character) as a new mode alongside today's orbit/walk/fly, or a way to toggle between first-person (current behavior, camera = eyes) and third-person (new behavior, camera trails a visible body).
3. **A character model + animation**: idle/walk/run cycles at minimum, likely a run-turn blend for direction changes. No character asset exists in the repo today (`assets/`, `logos/`, thumbnails are all environment/branding art, no rigged character GLB). This is a content/asset-pipeline dependency, not just code.
4. **Collision changes**: `fpCollision.js` currently treats the camera as the collidable point. A character-based model would want collision against a capsule around the character's feet/body instead, which changes how `DEFAULT_COLLISION_RADIUS`/`DEFAULT_STEP_HEIGHT` interact with the existing per-scene collision meshes (`fpCollisionSource`/`fpCollisionStrategy` in `viewer/sceneCatalog.js`) — likely fine since those are just triangle meshes being swept against, but needs verification per scene, especially the tight indoor `manualBox` cutaway volumes.
5. **Multiplayer/social question**: is the avatar just a visible representation of the single local user (a "you are here" body, useful mainly for third-person screenshots/orientation), or is this scoping toward multiple visitors seeing each other's avatars? The latter is an entirely different project (needs a realtime backend; the existing `analytics-worker/` Cloudflare Worker + D1 setup is analytics-only, not a realtime multiplayer channel) and should be explicitly ruled in or out before any implementation starts.

## Recommendation

Given no character asset exists and no third-person camera mode exists, this is the largest of the investigated features. If pursued, scope it as **single-user, third-person-optional avatar** first (item 5's simpler branch) as a standalone navigation mode, built by:

1. Introducing a character entity + third-person rig as a new, opt-in navigation mode (additive — first-person mode stays default and unchanged).
2. Sourcing/rigging one placeholder humanoid model to validate the pipeline before committing to a final asset.
3. Reusing `fpNavigation.js`'s input parsing but redirecting its output to the character entity instead of the camera, with the camera becoming a follower.

None of this should touch `viewer/sceneCatalog.js`'s scene/asset wiring or the streamed/LOD splat loading — it's purely additive to the navigation layer. Do not start implementation without first confirming whether multiplayer is in scope, since that decision changes the entire backend/architecture picture.

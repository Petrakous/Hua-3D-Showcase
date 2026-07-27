# Known issues — investigation notes

Status: **investigation only, no code changes made here.** Per project safety rules, these are documented with suspected cause, affected files, and recommended next steps rather than fixed directly — both because reproducing them reliably needs the real (large, not-checked-out-locally) splat/mesh assets, and because engine-level fixes here carry real regression risk to a system that's already been patched multiple times for closely related symptoms (see commit history below).

## 1. "Model disappears completely"

No single commit or code comment names this exact symptom, but three related, already-patched bugs point at the most likely mechanisms, in rough order of likelihood:

### a) Auto-cutaway box collapsing to zero volume

`viewer/autoCutaway.js` (`computeAutoCutaway` / `createClipBoxCutaway` / `insetManualBox`) recomputes a clip/cutaway box every frame based on camera position relative to the scene bounds, for every indoor splat scene with a `manualBox` (all indoor scenes in `viewer/sceneCatalog.js`). It's already been patched once for a closely related symptom: commit `9847248` — "Adjust box culling fade thresholds to prevent indoor walls and floors from disappearing." The underlying mechanism (face-based inset cutting into a box) is exactly the kind of code where a malformed input — a `NaN` camera position, a degenerate `sceneBounds.size` (zero on an axis), or an edge case in `selectActiveFaces`'s weighting — could inset a face past the opposite face and produce a zero-or-negative-volume box, which would cull the entire model rather than just one wall. This class of bug tends to be camera-position- and scene-specific (only reproduces from certain angles/distances), which matches "disappears" reports being intermittent rather than constant.

- **Affected files:** `viewer/autoCutaway.js` (the math), `viewer/playCanvasSogViewer.js` (~line 2108, where `computeAutoCutaway` is called with live camera position each frame).
- **Recommended next step:** add temporary logging (not a fix) around `insetManualBox`'s returned `scale` to catch any near-zero or negative component in production/QA, correlated with camera position at the moment it happens. Do not adjust the fade thresholds or cut ratios blind — the previous fix (`9847248`) already tuned these once, and further blind tuning risks reintroducing the walls/floors-disappearing regression that fix addressed.

### b) WebGL context loss not fully recovering the active model

`main.js` (~line 4059–4091, `bindContextLoss`) listens for `webglcontextlost` on the canvas and shows a "Graphics context was restored" toast (`showPerformanceNotice`) when the context comes back, but the toast text itself is a hint that recovery isn't guaranteed to be complete ("Retry the space if it does not resume" — i.e., the code already anticipates that context restoration alone may not bring the model back). If a context loss happens (common on mobile GPUs under memory pressure, which fits a "model disappears completely" report from a phone user), the visual result would be exactly a blank/disappeared scene, with the only user-facing recovery being them noticing the toast and manually retrying.

- **Affected files:** `main.js` (~4059–4091).
- **Recommended next step:** this is more of a UX gap than a bug — consider auto-retriggering the active scene's reload once context is restored (reusing the existing `reloadSogAsset`/scene-activation path already used for manual retry) instead of relying on the user to read the toast and act. This is a plausible "small and obvious" fix for a future pass, but wasn't made here since it touches scene-loading flow, which is explicitly out of scope for this session.

### c) GLB load hangs (partially mitigated already)

Commit `5a897f2` ("Add cancelable scene loading and GLB load timeout", 2026-07-09 — the most recent commit before this session) added a `GLB_LOAD_TIMEOUT_MS` timeout and cancel/retry UI specifically because GLB loads could previously hang indefinitely with no feedback — which, to an end user, looks identical to "the model never appeared" / "disappeared." This is the most recently and most directly addressed of the three candidates. If disappearance reports predate 2026-07-09, this fix may have already resolved them; if reports are more recent, it's worth checking whether the timeout/cancel path itself has a gap (e.g., does canceling correctly tear down a partially-instantiated model, or could a slow-but-eventually-successful load race with a timeout-triggered cleanup and leave the scene in a half-loaded state?).

- **Affected files:** `main.js` (search `GLB_LOAD_TIMEOUT_MS` and the surrounding cancel/retry logic added in `5a897f2`).
- **Recommended next step:** if disappearance reports continue after this commit, get the exact scene + device + timestamp and check `main.js` analytics tracking (`trackSceneLoadFailed` and friends) for a matching failure event before assuming (a) or (b) instead.

## 2. Streamed Engine outdoor-scene direction

**Suspected cause found and fairly clear.** `main.js`, function `selectStreamingSogAsset` (~line 953–972):

```js
rotation: asset.streamingRotation || asset.rotation,
```

The Streamed engine can use a different baked rotation than the regular LOD/SOG path — this is explicitly acknowledged in the surrounding code comment: *"Manual boxes are calibrated in the regular SOG (LOD) coordinate frame. Keep that frame so the viewer can rebase the box when Streamed uses a different baked rotation."* The mechanism for supplying that different rotation is the `streamingRotation` field on each SOG asset, set in `viewer/sceneCatalog.js`.

Checking every scene definition in `viewer/sceneCatalog.js`:

- **`metabolism`** explicitly sets `streamingRotation: [0, 0, 0, 1]` (identity) — i.e., someone already discovered and fixed this exact class of issue for this one indoor scene.
- **`campus-day`, `campus-dusk`, `campus-night`** (all three outdoor stages, `OUTDOOR_SOG_OPTIONS` in `viewer/sceneCatalog.js`) — **no `streamingRotation` is set.** They fall back to `asset.rotation`, which resolves to `DEFAULT_SOG_ROTATION` (a 180° X-axis rotation, from `DEFAULT_SOG_ROTATION_DEGREES = [180, 0, 0]` at the top of `sceneCatalog.js`), i.e. the same rotation used for the non-streamed LOD/GLB path.
- Every other indoor scene (`systasis`, `fitness`, `classroom-5`, `biology-lab`, `amphitheater`, `geo3-3`, `kitchen`, `main-hall`) also has no `streamingRotation` override, so they're in the same situation as the outdoor scenes — but the bug report specifically calls out outdoor scenes, and outdoor scenes are also the ones with `maxOrbitDistance`/large-scale streaming (`OUTDOOR_SOG_OPTIONS`), which is where a baked-rotation mismatch would be most visually obvious (a large campus facing the wrong way is much more noticeable than a small room a few degrees off).

This strongly suggests the same rotation-mismatch class of bug that was already fixed once for `metabolism`, just not yet applied to the outdoor scenes (or the rest of the indoor scenes).

- **Affected files:** `viewer/sceneCatalog.js` (`OUTDOOR_SOG_OPTIONS`, and the `sog.web`/`sog.hd` asset definitions under `LOCATION_CATALOG.outdoors.stages.{day,dusk,night}`), `main.js` (`selectStreamingSogAsset`, ~line 953–972).
- **Why this wasn't fixed directly in this session:** the correct `streamingRotation` value for the outdoor scenes is a **data value that depends on how the actual streamed `lod-meta.json` payload for each outdoor scene was baked** (see `createManifestSogStreamingSource` / `output_lod/lod-meta.json` in `viewer/sceneCatalog.js`) — those files aren't present in this local checkout (see the pre-existing `source-missing` warnings from `node scripts/validate_manifest.mjs`), so there's no way to determine or verify the correct correction quaternion from this environment. Guessing a value (e.g. blindly copying `metabolism`'s identity rotation) risks being wrong for outdoor scenes specifically, since `metabolism`'s correction was presumably derived by comparing its own streamed output against its own LOD output — not something that necessarily generalizes to a different capture.
- **Recommended next step:** with access to the actual outdoor streamed assets (or a deployed environment where `?assets=remote` resolves them), load an outdoor scene with the Streamed engine enabled, compare its facing direction against the same scene in LOD/GLB mode, and derive the correct `streamingRotation` quaternion the same way it was presumably done for `metabolism` — then add `streamingRotation` to `OUTDOOR_SOG_OPTIONS` (or per-stage, if day/dusk/night were captured/baked independently and need different corrections) in `viewer/sceneCatalog.js`. This is a one-line-per-scene data fix once the correct value is known; the risk is entirely in *guessing* that value without being able to visually verify it, not in the size of the change itself.

# Guided tour mode — architecture investigation

Status: **not implemented**, but closer than it looks — the codebase already has most of the low-level machinery a guided tour needs, just wired up for an internal trailer-recording tool instead of an end-user feature.

## Existing building blocks

1. **`SCENE_EXPERIENCE_DEFAULTS.future.tour`** in `viewer/sceneExperience.js` is an explicit stub (`tour: null`), already merged into every normalized scene experience object via `normalizeExperience()`. This was clearly left as a deliberate extension point.
2. **`viewer/cinematicMode.js`** already implements camera-path keyframing: a `CINEMATIC_PATHS` array of named paths, each with `{ time, position, target, fov }` keyframes, cubic ease-in-out interpolation (`easeInOutCubic`), and per-property timed interpolation (`interpolateTimedScalar`). This is loaded only behind a `?cinematic=1` URL flag (`main.js` line 152) and is explicitly commented as "Developer-only trailer paths" — it's an authoring/QA tool, not user-facing, and further gated by `?author=1` for edit controls.
3. Each cinematic path is already scoped to a scene selector (`scene: { kind: "outdoor", stage: "day" }` or `scene: { kind: "indoor", sceneId: "main-hall" }`), which is effectively "which scene does this camera path play in" — exactly the selector a tour step needs.
4. Scene switching itself (`selectSceneCard`, `enterViewerMode`, `reloadSogAsset`/asset activation in `main.js`) is already a clean, callable, promise-based flow — a tour driver doesn't need new scene-loading logic, just to call the same functions a user's click would.

## What a user-facing guided tour would add

A guided tour is essentially: **a scripted sequence of (scene, camera path, optional narration/caption) steps, auto-advancing or user-paced, layered on top of existing navigation** — not a new rendering mode.

Proposed shape:

```js
// viewer/tourCatalog.js (new)
const TOURS = {
  "campus-overview": {
    id: "campus-overview",
    title: "Campus Overview",
    steps: [
      { sceneId: "campus-day", cinematicPathId: "exterior_day_push_to_entrance", caption: "Welcome to Harokopio University." },
      { sceneId: "main-hall", cinematicPathId: "main_hall_walkthrough", caption: "The main lobby." },
      { sceneId: "amphitheater", cinematicPathId: "amphitheater_reveal", caption: "Our central lecture theater." },
    ],
  },
};
```

A `TourController` (new module, e.g. `viewer/guidedTour.js`) would:

1. Load a tour definition, drive scene transitions via the existing `selectSceneCard`/scene-activation path (reusing loading/cancel/retry UI already in `index.html`, not duplicating it).
2. Once a scene is loaded, hand off to `cinematicMode.js`'s existing keyframe player for the camera move — the promotion path here is to **generalize the currently-hardcoded `CINEMATIC_PATHS` array** into per-scene data (already close: `scene.kind`/`scene.sceneId` selectors exist) so tour steps and the developer trailer tool share one path library instead of the tour needing its own.
3. Show a caption/step overlay and Next/Prev/Exit controls — new UI, but structurally similar to the existing `#viewerStatus` overlay in `index.html`.
4. On "Exit tour," fall back to normal free navigation in the current scene (no state to unwind since it's just reusing the standard scene-activation calls).

## Open questions before implementation

- **Authoring workflow**: `CINEMATIC_PATHS` keyframes today are hand-tuned by trial and error (per the file's own comment: "coordinates are intentionally rough placeholders... tune position/target values here after reviewing test captures"). A real tour needs either a lot more of these hand-tuned paths, or an in-app path recorder exposed to non-developers (the `?author=1` mode hints this exists in some form already and could potentially be generalized).
- **Mobile**: cinematic playback performance on mobile hasn't been evaluated; combined with a full scene load per tour step, a multi-scene tour could be slow on low-end devices — this likely wants to gate on the same `performance.weight`/device-quality signals already in `viewer/sceneExperience.js`.
- **Narration**: captions are the cheap option; voiceover would need new asset pipeline work (out of scope here).

## Recommendation

Do not build this now. First, promote `CINEMATIC_PATHS` out of `cinematicMode.js` and into scene-scoped data (small, low-risk refactor, reusable by both the existing trailer tool and a future tour), then build `guidedTour.js` as a thin sequencer on top. This investigation found no reason a guided tour would require touching `viewer/sceneCatalog.js`, `viewer/playCanvasSogViewer.js`, or the streamed/LOD loading internals.

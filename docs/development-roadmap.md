# Development roadmap

This backlog consolidates the useful project notes that were previously kept in a local-only developer file. It intentionally excludes credentials and machine-specific information.

## Viewer reliability

- Investigate the remaining case where a model can disappear after unusual walk/fly interactions.
- Add clearer per-scene loading and empty states.
- Keep reset behavior correct for every scene, renderer, and navigation mode.
- Continue improving touch navigation and streamed-scene behavior on mobile.
- Add stronger recovery guidance when scene or asset fetches fail.

## Exploration and navigation

- Add department and context links to hotspots.
- Support animated transitions from outdoor scenes into interior spaces.
- Add a guided-tour mode.
- Add a mini-map or floor-map overlay.
- Add viewer breadcrumbs and make the active scene name more prominent.
- Expand saved camera views.
- Add related-space links and richer descriptions.

## Inclusive and lightweight access

- Implement the accessibility work described in `accessibility-plan.md`.
- Add multilingual content using the approach in `multilingual-plan.md`.
- Add the lightweight non-3D experience described in `gallery-mode-plan.md`.

## Sharing and attribution

- Add screenshot and share-link support.
- Surface capture method, contributors, scan date, and model-format credits from the asset manifest.
- Continue the character/avatar investigation described in `avatar-feature-architecture.md`.

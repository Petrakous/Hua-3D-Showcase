# Accessibility mode — plan

Status: **not implemented**. This document scopes an "Accessibility mode" toggle covering reduced motion, simplified controls, high-contrast labels, and keyboard-first scene navigation, and inventories what already exists versus what's missing.

## What already exists today

- `styles.css` already has a `@media (prefers-reduced-motion: reduce)` block (around line 2802) that zeroes out CSS transition/animation durations site-wide.
- Buttons and links already get a visible `:focus-visible` outline (`styles.css` line 57).
- The status/loading overlay is a real DOM element with `role="status"`/`aria-live="polite"` (`index.html`), and scene cards render as a live region (`#sceneCardGrid[aria-live="polite"]`).
- Loading has a "Cancel loading" and "Back to all spaces" recovery path already (`index.html` `#statusCancel` / `#statusBack`), which is itself an accessibility/robustness win for anyone on a slow connection or with motor/cognitive load concerns.

## Gaps

1. **Reduced motion doesn't reach the 3D viewer itself.** The CSS block only affects CSS-driven motion. The `<model-viewer>` auto-rotate (`auto-rotate` attribute, toggled via `modelViewer.autoRotate`) and the PlayCanvas splat viewer's own turntable rotation are untouched by `prefers-reduced-motion`. `turntableEnabled` in `main.js` is set/reset in at least 5 places (lines ~1035, 3351, 3412, 3441/3443, 4298), which is why this wasn't done as a "small and obvious" fix during this pass — each call site needs to preserve explicit user intent (the manual toggle button) while still defaulting off for `prefers-reduced-motion` users. Recommended approach: read `window.matchMedia("(prefers-reduced-motion: reduce)").matches` once at startup, use it only to set the *initial* value of `turntableEnabled` (line 1035) and the resets that mean "back to default" (3412, 3443), and leave the explicit manual-toggle codepath (3351) and the "force off while loading" codepath (3441, 4298) untouched. This keeps the change small and additive rather than restructuring the toggle state machine.
2. **No "simplified controls" mode.** The hero UI always shows the full control surface (time dial, format/quality/engine/LOD pickers, calibration button when unlocked, mobile dock). There's no way to collapse to just "orbit + explore" for a user who finds the full control rail overwhelming.
3. **No high-contrast mode.** All text/label colors are fixed in `styles.css`; there's no alternate palette or `prefers-contrast: more` handling.
4. **No keyboard-first scene navigation.** Keyboard support today (`main.js` ~line 4098–4120) only covers an author-only cinematic-reset shortcut and closing mobile panels with Escape. There's no keyboard equivalent for: switching between scene cards, orbiting/panning the camera, or triggering walk/fly navigation. `viewer/fpNavigation.js` does have WASD-style movement, but only once first-person walk mode is already active via a pointer/touch-driven UI control — there's no keyboard-only path to reach it from the scene-selection screen.

## Proposed shape

An "Accessibility mode" would be a single persisted preference (e.g. `localStorage.hua3d.a11yMode`, mirroring the existing `hua3d.debugLogs` pattern in `viewer/logger.js`) that, when on:

- Forces `turntableEnabled` off by default (see #1) and hides/disables the rotate toggle rather than just defaulting it off, so there's no motion to opt back into by accident.
- Switches the control rail to a reduced set: Explore (orbit) + a single "Enter/Exit walk mode" button, hiding format/quality/engine/LOD pickers behind a single "Advanced" disclosure.
- Applies a high-contrast stylesheet variant (a `data-a11y-contrast` attribute on `<body>` swapping a handful of CSS custom properties already centralized at the top of `styles.css`, rather than a full parallel stylesheet).
- Adds a keyboard navigation layer: arrow keys / Tab to move focus between scene cards (mostly free — they're real `<button>`/`<article>` elements already, just needs `tabindex` + roving-focus wiring), and a documented key (e.g. `Enter`) to activate walk mode once a scene is loaded, with WASD reusing the existing `fpNavigation.js` movement code.

## Suggested implementation order

1. Reduced-motion → turntable default (low risk, isolated to `main.js` startup + 2 reset sites).
2. Keyboard focus/activation for the scene-card grid (pure UI, no engine coupling).
3. Simplified-controls toggle (UI-only, hides existing elements — no new capability, just fewer visible knobs).
4. High-contrast variant (CSS-only, additive).

Each step above is independently shippable and reviewable; none require touching `viewer/sceneCatalog.js`, `viewer/playCanvasSogViewer.js`, or the streamed/LOD loading paths.

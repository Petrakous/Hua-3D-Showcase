# Multilingual support — plan

Status: **not implemented**. The codebase is currently 100% hardcoded English strings, spread across `index.html` (markup + `aria-label`s), `main.js` (dynamically generated card/status/control markup), and `viewer/sceneExperience.js` (titles, descriptions, loading copy).

## Why this isn't a "small change"

A clean pass found user-facing strings in at least these places:

- `index.html`: button `aria-label`/`title` attributes, static headings, the `<meta>` description tags used for SEO/social sharing.
- `main.js`: template-literal-generated markup for scene cards (`renderSceneCards`), the status/loading copy (`setStatus`), format/quality labels (`FORMAT_LABELS`), and section headings ("Explore from the outside", "Step inside", "Visit our laboratories").
- `viewer/sceneExperience.js`: every `title`/`subtitle`/`description`/`loading.*` field for all 12 scenes, plus `getCategoryLabel()`.

There is currently **no separation between content and presentation logic** for strings — most are inline in template literals next to markup generation. Retrofitting i18n cleanly (rather than sprinkling `if (lang === "el")` branches everywhere) requires first extracting all of these into a lookup layer, which touches nearly every user-facing file. That's a real project, not a same-session addition — hence "plan," not "implement," for this pass.

## Recommended approach

1. **Introduce a strings module**, e.g. `viewer/i18n.js`, exporting a flat dictionary keyed by string ID and locale:
   ```js
   export const STRINGS = {
     en: { "scene.campus-day.description": "...", "control.fullscreen": "Fullscreen", ... },
     el: { "scene.campus-day.description": "...", ... },
   };
   ```
   Scene-specific strings (`title`/`subtitle`/`description`/`loading.*`) can key off the existing scene IDs already used in `viewer/sceneExperience.js` (`SCENE_EXPERIENCES`), so the dictionary structure mirrors data that already exists rather than inventing a new taxonomy.
2. **Add a `t(key, locale)` helper** with an English fallback (never render a blank string if a translation is missing — fall back to `en`).
3. **Migrate `sceneExperience.js` first** — it's the most self-contained (pure data, no DOM manipulation), and covers the highest-value content (space descriptions, which this pass already improved in English). Replace inline `description:` strings with string-ID references resolved through `t()`.
4. **Migrate `main.js` template strings second** — section headings, status copy, control labels. These are more invasive since they're interleaved with `escapeHtml()` calls and dynamic values (e.g. `${sectionCards.length} spaces`), which need ICU-style pluralization handling, not just key lookup.
5. **`index.html` static strings last** — lowest value (mostly `aria-label`s and SEO meta tags) and easiest to hardcode a second `index.el.html` variant for if a full JS-driven i18n layer is deemed overkill for just the `<head>` metadata.

## Locale detection & switching

- Detect via `navigator.language`, override via a `?lang=` query param (mirroring the existing `?assets=local|remote` override pattern already in `viewer/sceneCatalog.js`), and persist the explicit choice in `localStorage` alongside the other preferences (`hua3d.debugLogs`, scene selection).
- Add a visible language switcher near the existing header controls (`.header-actions` in `index.html`), not just an invisible auto-detect — university visitors may want to override their browser's default language.

## Suggested first slice (if greenlit)

Ship steps 1–3 only: the strings module + `t()` helper + migrated scene descriptions, with Greek (`el`) as the second locale (matching the university's home language) and a manual `?lang=el` override. This is scoped, reviewable, and doesn't touch `main.js`'s more complex templating — a natural place to stop and evaluate before doing the larger `main.js` migration.

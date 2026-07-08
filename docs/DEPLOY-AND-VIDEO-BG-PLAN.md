# SavePoint — Deploy, Video Backgrounds & 3D Drawer Plan

Covers five work items, in build order:

1. New GitHub repo + push + go live on GitHub Pages
2. Browser-tab favicon = SavePoint gold diamond
3. Fix the flickery transition into the last (outro) slide
4. Background videos become the focal point of every game slide; 3D model
   column removed
5. 3D models move into a right-to-left collapsible overlay drawer

**Current state (verified)**

- Not a git repo yet; no `.gitignore`, no `.github/`.
- Generated game videos live at `public/assets/hero/*.mp4` (~93 MB, 10 files,
  inconsistent names: `GoW.mp4`, `Mafia 1.mp4`, `cyberpunk2077.mp4`, …).
- Models at `public/assets/models/*.glb` (~134 MB, largest ~17 MB — all under
  GitHub's 100 MB per-file limit).
- `vite.config.js` already uses `base: './'` (relative URLs → works on
  project Pages without changes).
- `index.html` has no favicon link; the diamond exists only as CSS
  (`.diamond` in `timeline.css`), not as an asset.
- Outro slide ("GAME SAVED") implemented in `main.js` (`buildOutroSlide`),
  themes array includes `outro.theme`.

---

## Phase 1 — GitHub repo + GitHub Pages

### 1.1 Repo hygiene first

- Create `.gitignore`:
  ```
  node_modules/
  dist/
  .env
  .DS_Store
  npm-debug.log*
  ```
- Note on size: committing `public/assets` adds ~230 MB of binaries. All files
  are < 100 MB so plain git works (no LFS — **avoid LFS**: GitHub Pages does
  not serve LFS content). Accept the heavy repo for now; Phase 5 makes models
  lazy-loaded, and a future trim (Draco-compressed .glb) can shrink it.

### 1.2 Create repo and push

```bash
git init
git add -A
git commit -m "Initial commit: SavePoint top-10 countdown site"
gh repo create SavePoint --public --source . --push
```

- Must be **public** for GitHub Pages on a free account.

### 1.3 Deploy via GitHub Actions (build-from-source, no committed dist)

- New file `.github/workflows/deploy.yml`:
  - Trigger: `push` to `main` + `workflow_dispatch`.
  - Job 1 (build): checkout → `actions/setup-node@v4` (node 22, npm cache) →
    `npm ci` → `npm run build` → `actions/upload-pages-artifact@v3` with
    `path: dist`.
  - Job 2 (deploy): `actions/deploy-pages@v4`, environment `github-pages`,
    permissions `pages: write`, `id-token: write`.
- Enable Pages: repo Settings → Pages → Source = "GitHub Actions"
  (or `gh api repos/{owner}/SavePoint/pages -X POST -f build_type=workflow`).
- Site URL: `https://<user>.github.io/SavePoint/`. `base: './'` keeps all
  asset URLs relative, so no config change needed — but **verify** the
  absolute paths in `games.js` (`/assets/logos/...`) — these are
  root-absolute and **will break** under `/SavePoint/`.
  Fix as part of this phase: either
  - (a) switch `vite.config.js` to `base: '/SavePoint/'` and prefix runtime
    asset strings with `import.meta.env.BASE_URL`, or
  - (b) keep `base: './'` and make all `games.js` asset paths relative
    (`assets/logos/...`) — simplest since the app is a single page at the
    root. **Chosen: (b)** + a tiny `asset()` helper in `games.js` so paths
    stay one-touch editable.
- Post-deploy check: hero video is remote (CloudFront) — confirm it loads over
  HTTPS from the Pages origin (it should; it's a plain https mp4).

**Files:** `.gitignore`, `.github/workflows/deploy.yml`, `vite.config.js` or
`src/data/games.js` path style. Effort: S.

---

## Phase 2 — Favicon: SavePoint diamond

- Create `public/favicon.svg`: the gold diamond from the rail
  (rotated 45° square, `#e8c464` fill, subtle `#ffe9a3` inner highlight, on
  transparent background so it works in light & dark tabs).
- Optional raster fallback `public/favicon-32.png` for older browsers +
  `apple-touch-icon.png` (180×180, ink `#0a0a0c` background behind the gold
  diamond).
- `index.html` head additions:
  ```html
  <link rel="icon" type="image/svg+xml" href="favicon.svg" />
  <link rel="icon" type="image/png" sizes="32x32" href="favicon-32.png" />
  <link rel="apple-touch-icon" href="apple-touch-icon.png" />
  ```
  (relative hrefs — consistent with Phase 1 decision b).
- Bonus while in `<head>`: `<meta name="theme-color" content="#0a0a0c">` and
  basic OG tags (`og:title`, `og:description`) for link sharing.

**Files:** `public/favicon.svg` (+ optional PNGs), `index.html`. Effort: S.

---

## Phase 3 — Fix flicker on the transition into the last slide

Diagnose first, then apply the matching fixes. Likely causes (in probability
order) — the outro is the **final** step of the pinned ScrollTrigger, which is
a special position:

1. **Pin release boundary.** At exactly `end`, GSAP swaps the stage from
   `position: fixed` back to absolute/static. Scrubbing near 100% progress
   oscillates across that boundary → flicker. Fix: give the page a small
   scroll "runway" after the pin (e.g. `end: () => '+=' + (steps *
   innerHeight + innerHeight * 0.25)` with the timeline mapped to finish at
   the old distance, or a spacer element after `#stage`), so the last wipe
   completes *before* the release point and snap never parks the user on the
   boundary.
2. **macOS rubber-band overscroll** at document bottom fights the snap.
   Fix: `overscroll-behavior-y: none` on `html/body`; ensure the snap's last
   point isn't the literal document end (covered by the runway above).
3. **Outro's animated content repainting during the wipe** (pulsing glyph,
   credits roll, reveals). Fix: gate all outro animations behind
   `.is-active` (start them in `onActive`, not on load), and add
   `will-change: transform` / compositing hints to the credits roller.
4. **`will-change: clip-path, transform` on all 12 slides** can exhaust
   compositor memory and cause flashes late in the timeline. Fix: apply
   `will-change` only to the incoming/outgoing pair (toggle in `onUpdate`),
   or at minimum remove it from slides that are fully open/closed.
5. **Snap overshoot at progress 1.0**: `snapTo: 1/steps` with
   `inertia: false` can jitter at the extremes. Fix: use
   `snapTo: 'labelsDirectional'` with timeline labels per slide, or clamp
   (`gsap.utils.clamp(0, 1)`) in the snap function.

Verification: scrub slowly from Nº 1 → outro and back ×10, then fling-scroll
to the bottom; test Safari + Chrome (Safari shows pin-boundary flicker worst);
check with DevTools "Paint flashing" that nothing repaints full-screen during
the wipe.

**Files:** `src/lib/transitions.js`, `src/styles/sections.css` (outro rules),
`src/main.js` (outro animation gating). Effort: M.

---

## Phase 4 — Background videos as the focal point of game slides

### 4.1 Asset move + naming

- Move & rename `public/assets/hero/*.mp4` → `public/assets/videos/<slug>.mp4`
  so files match `games.js` slugs:

  | Current (`assets/hero/`) | New (`assets/videos/`) |
  | --- | --- |
  | `GoW.mp4` | `gow2018.mp4` |
  | `Mafia 1.mp4` | `mafia.mp4` |
  | `DBH.mp4` | `detroit.mp4` |
  | `GoT.mp4` | `tsushima.mp4` |
  | `uncharted3.mp4` | `uncharted3.mp4` |
  | `LastofUs.mp4` | `tlou.mp4` |
  | `ME-LE.mp4` | `mele.mp4` |
  | `TheWitcher3.mp4` | `witcher3.mp4` |
  | `cyberpunk2077.mp4` | `cp2077.mp4` |
  | `rdr2.mp4` | `rdr2.mp4` |

- `assets/hero/` remains for an eventual local hero video only (or delete the
  folder and put `hero.mp4` in `videos/` too — **chosen**: one folder,
  `assets/videos/`, hero included when it goes local).
- Delete/replace the stale `videos/README.txt` note (it documented the old
  trailer-override purpose; trailers keep using `trailer.local` unchanged).

### 4.2 Data model (`src/data/games.js`)

- New per-game field, same editing ergonomics as everything else:
  ```js
  background: 'assets/videos/gow2018.mp4',  // full-bleed looping slide video
  ```
  (relative path per Phase 1 decision; `null` = fall back to current gradient
  look, so the site never breaks if a video is missing.)

### 4.3 Slide layout rework (`main.js` + `sections.css`)

- `buildGameSlide()` gains a background layer, structured exactly like the
  hero: `<video class="slide-video">` (muted, loop, playsInline,
  `preload="none"`) + `<div class="slide-scrim">` under `.slide-inner`.
- Scrim: reuse the hero recipe (bottom-up + left gradient) but tinted with the
  slide's `--bg` so each game keeps its color identity and text stays
  readable over motion.
- **Remove the model column from the grid**: `.game-body` goes from a 2-column
  grid to a single column; `.media-col` (trailer + facts + review) narrows to
  a comfortable reading measure (~`minmax(0, 720px)`) anchored left, letting
  the video breathe on the right — mirroring the hero's text-left /
  subject-right composition (the generated videos put the character on the
  right for this reason).
- The trailer pane stays but can shrink slightly (`max-height: 42vh`) now that
  the video is the star. Watermark numeral stays on top of the video
  (raise its z-index above the scrim).

### 4.4 Playback + bandwidth management (93 MB of video)

- Extend the existing activate/deactivate pattern (`onActive` in `main.js`):
  - Active slide: set `video.src` if unset (lazy), `play()`.
  - Neighbor slides (index ±1): warm up with `preload="metadata"`.
  - All others: `pause()`; keep `src` once loaded (session cache).
- Pause everything on `document.hidden`.
- Reduced-motion / save-data (`navigator.connection?.saveData`): don't attach
  videos at all — gradient fallback.
- Optional (recommended before Pages launch): re-encode passes
  (`ffmpeg -crf 28 -preset slow -vf scale=1920:-2 -an`) to roughly halve the
  93 MB; keep sources out of the repo if re-generated later.

**Files:** `src/data/games.js`, `src/main.js`, `src/styles/sections.css`,
asset moves. Effort: M.

---

## Phase 5 — Collapsible 3D model drawer (right → left overlay)

### 5.1 Behavior spec

- Each game slide gets a slim vertical tab button on the right edge
  ("3D MODEL" rotated text + chevron, tinted `--primary`).
- Clicking it opens a **fixed overlay drawer**: slides in from the right edge
  (`transform: translateX(100%) → 0`, ~450ms `power3.out`), width
  `min(520px, 92vw)`, full height, sits **on top of the page**
  (`position: fixed; z-index` above slides & rail, below the custom cursor).
  The page behind does not shift, shrink, or reflow.
- A dimmed backdrop (`rgba(0,0,0,.45)`, fades in with the drawer) covers the
  rest of the viewport.
- Close triggers: chevron/collapse icon in the drawer header, click anywhere
  on the backdrop (i.e. outside the pane), and `Escape`. Also auto-close on
  slide change (scrolling away) so a GoW model never floats over Mafia.
- Content: reuse `createModelPane` from `src/lib/viewer.js` — the drawer hosts
  the `model-viewer` (auto-rotate, drag) + caption + the existing
  "drop a .glb" empty state. Slide theme vars applied to the drawer so it
  matches the game's palette.

### 5.2 Implementation shape

- New module `src/lib/drawer.js` — a single shared drawer instance:
  - `openFor(game)` — applies theme, mounts (or reveals cached) model pane,
    animates in; lazily creates each game's `model-viewer` on first open only
    (models no longer load on page load at all → big win for the 134 MB).
  - `close()` — animates out, keeps DOM cached per game.
  - Focus management: focus moves into the drawer on open, returns to the tab
    button on close; `role="dialog"`, `aria-modal="true"`,
    `aria-expanded` on the tab.
  - While open: suppress the stage's scroll-driven wipes from stealing input
    — simplest robust option is to prevent page scroll (`overflow: hidden` on
    body) while the drawer is open; restore on close.
- `main.js`: remove `createModelPane` from the slide grid; add the tab button
  per game slide; wire `onActive` → `drawer.close()`.
- `viewer.js`: unchanged API, now consumed by the drawer; the
  `import('@google/model-viewer')` dynamic import moves from page-load to
  first drawer open.
- `games.js`: `model` field unchanged (still the single editable source).

**Files:** new `src/lib/drawer.js`, `src/main.js`, `src/lib/viewer.js`
(lazy-load shift), `src/styles/sections.css` (tab + drawer styles).
Effort: M–L.

---

## Build order & verification

| Step | Work | Gate before moving on |
| --- | --- | --- |
| 1 | Phase 1 repo + Pages (incl. relative-path fix) | Live URL renders identically to local `npm run preview` |
| 2 | Phase 2 favicon/meta | Diamond shows in tab, dark & light mode |
| 3 | Phase 3 flicker fix | 10× scrub Nº 1 ↔ outro, Safari + Chrome, no flash |
| 4 | Phase 4 video backgrounds + layout | All 10 slides play their loop; scroll up/down keeps secret-logo + rank behavior intact; mobile layout OK |
| 5 | Phase 5 drawer | Open/close via tab, outside click, Esc; slide change closes it; models load only on demand |
| 6 | Re-deploy + full pass on Pages URL | Video weight acceptable on throttled "Fast 3G"; `npm run build` clean |

Regression checklist (every step): hero intro choreography, preloader,
parallax wipes, rank ticker, rail secret reveals both directions, trailer
facades, reduced-motion mode, `npm run build`.

# SavePoint — Visual Polish Plan

Implementation plan for ten fixes/additions, ordered so each phase builds on the
last. File references point at the current codebase.

**Current architecture recap**

- `src/main.js` — builds hero + game slides, wires rail, scroll, trailers, models.
- `src/lib/transitions.js` — one pinned GSAP timeline; each slide wipes up via
  `clip-path`, previous slide scales to 1.07 and dims. `onActive(i)` fires at the
  halfway point of a wipe; `onProgress(p)` streams raw 0..1 progress.
- `src/lib/timeline.js` + `src/lib/artifact.js` — left rail, secret-logo reveals.
- `src/styles/base.css`, `timeline.css`, `sections.css` — all styling.
- Slide theming via CSS vars: `--primary`, `--accent`, `--bg`, `--text`.

**Global constraints (apply to every item)**

- Respect `prefers-reduced-motion` (base.css already zeroes transitions; JS
  effects must check `matchMedia('(prefers-reduced-motion: reduce)')`).
- No new dependencies — GSAP + ScrollTrigger already cover everything.
- Keep 60fps: only animate `transform`, `opacity`, `clip-path`, `filter`.

---

## Phase 1 — Cinematic base layer

### 1. Film-grain + vignette overlay

**Goal:** subtle animated grain + vignette over the whole stage; hides banding
in dark gradients.

- New fixed overlay appended once in `index.html` (or created in `main.js`):
  `<div class="grain" aria-hidden="true"></div>` after `#stage`.
- CSS in `base.css`:
  - `position: fixed; inset: -50%; width/height: 200%; pointer-events: none;
    z-index: 200;` (above slides, below nothing interactive — rail is z 100, so
    use `z-index: 90` OR keep 200 with `pointer-events:none`; grain over the
    rail is fine and consistent).
  - Background: inline SVG `feTurbulence` noise data-URI, `opacity: ~0.05`,
    `mix-blend-mode: overlay`.
  - Animate with an 8-step `steps()` keyframe jiggling `transform: translate(...)`
    to fake re-randomized grain (cheap, no repaint of the noise itself).
- Vignette: second fixed div or a `::after` on `body` with
  `background: radial-gradient(120% 120% at 50% 45%, transparent 60%, rgba(0,0,0,.35))`.
- Reduced motion: keyframe already killed by the global rule; grain stays static.

**Files:** `index.html`, `src/styles/base.css`. Effort: S.

### 2. Parallax inside slides

**Goal:** watermark, title block, and trailer move at different rates during the
wipe so slides have depth.

- In `transitions.js`, inside the per-slide loop that builds the master
  timeline, add tweens for the *incoming* slide `i` over the same `[i-1, i]`
  window (ease `'none'`, scrubbed):
  - `.watermark`: `fromTo(y: '18vh' → '0vh')` (slowest layer).
  - `.game-head`: `fromTo(y: '9vh' → 0)`.
  - `.trailer` (or the whole `.media-col`): `fromTo(y: '5vh' → 0)`.
  - Also give the *outgoing* slide's `.watermark` a small `y: 0 → '-8vh'` drift
    alongside its existing scale-up, so both sides of the wipe have motion.
- Guard: `slide.querySelector(...)` may be null on the hero — skip missing nodes.
- Watch interaction with the `.reveal` CSS transition (translateY on the same
  elements). To avoid double-transform fights, parallax the *parent* wrappers
  (`.slide-inner` children) rather than `.reveal` nodes themselves, or move the
  reveal transform to an inner span. Simplest: parallax `.watermark` (not a
  `.reveal`) + `.slide-inner` (single tween) and keep per-element reveals as-is.
- Reduced motion: skip adding these tweens when the media query matches.

**Files:** `src/lib/transitions.js`. Effort: S–M.

### 3. Animated rank counter

**Goal:** watermark numeral ticks/scrambles in when its slide activates.

- New helper `src/lib/rankTicker.js`: `animateRank(el, finalString)`.
  - Slot-machine scramble: ~700ms of random digits swapping at `steps(12)`
    cadence per character, locking left-to-right onto the real digits
    (`0`→`08`), then a final gold flash (`text-stroke` color pop via a CSS class
    `.watermark.is-lit` that fades out).
  - Store the true value in `data-rank`; never lose it to the scramble.
- Hook: in `main.js` `onActive`, when a game slide becomes active call
  `ctrl.rank?.play()`; on deactivate, reset (`el.textContent = data-rank`) so it
  replays on revisit. Return the controller from `buildGameSlide` alongside
  `trailer`/`model`.
- Reduced motion: set final text immediately.

**Files:** new `src/lib/rankTicker.js`, `src/main.js`, small CSS in
`sections.css`. Effort: M.

### 4. Hero title treatment

**Goal:** "SAVEPOINT" letters stagger in + recurring gold shimmer sweep.

- In `buildHeroSlide()` (`main.js`), split `hero.title` into
  `<span class="ht-letter">` per character (keep `aria-label` on the `<h1>` and
  `aria-hidden` on the spans for accessibility).
- Entrance: GSAP `gsap.from('.ht-letter', { yPercent: 110, opacity: 0,
  stagger: 0.045, ease: 'power3.out', duration: 0.9, delay: 0.3 })` with the
  `<h1>` given `overflow: hidden` line wrapper (`.ht-mask`).
- Shimmer: CSS-only on `.hero-title` — `background: linear-gradient(100deg,
  var(--text) 40%, var(--gold-hot) 50%, var(--text) 60%)`,
  `background-clip: text; color: transparent;`, `background-size: 250% 100%`,
  keyframe sweeping `background-position` every ~7s with a long pause.
- Kicker/sub/cue keep the existing `.reveal` pattern (hero slides may need the
  `is-active` class on load — it already gets it from the initial `onActive`).
- Reduced motion: skip the GSAP split animation (render static), shimmer killed
  by global rule.

**Files:** `src/main.js`, `src/styles/sections.css`. Effort: S–M.

---

## Phase 2 — Polish layer

### 5. Custom cursor / hover glow

**Goal:** small dot cursor that scales over interactive elements, tinted with
the active slide's `--primary`.

- New `src/lib/cursor.js`: creates `.cursor-dot` (6px) + `.cursor-halo` (36px
  ring), `position: fixed; z-index: 300; pointer-events: none;
  mix-blend-mode: difference` (dot) — halo tinted
  `color-mix(in srgb, var(--cursor-color) 60%, transparent)`.
- Movement: `gsap.quickTo` for x/y (halo with ~0.18s lag for the trailing feel).
- Hover scale: delegate `pointerover`/`pointerout` on
  `'button, a, model-viewer, .yt-facade'` → toggle `.is-hover` (halo scales 1.6,
  dot shrinks).
- Tint: in `main.js` `onActive`, set
  `document.documentElement.style.setProperty('--cursor-color', theme.primary)`.
- Only enable on fine pointers: `matchMedia('(pointer: fine)')`; never hide the
  native cursor completely (keep `cursor: none` off — overlay only) OR hide it
  but restore on `visibilitychange`/leave. Decision: overlay-only first pass.

**Files:** new `src/lib/cursor.js`, `src/main.js`, CSS in `base.css`.
Effort: M.

### 6. Slide-colored progress feedback

**Goal:** rail active glow tints with the current game's primary instead of
always gold.

- Add `--rail-accent` (default `var(--gold)`) consumed by `timeline.css` in:
  `.rail-node.is-active` border/box-shadow, `.rail-node.is-active::after`
  conic shine, `.rail-pulse` gradient/drop-shadows, `.rail-line-fill` bottom
  stop, and `artifact.js` particle colors (read via
  `getComputedStyle(document.documentElement).getPropertyValue(...)` at run
  start).
- In `main.js` `onActive`: set `--rail-accent` on `#rail` from the active
  game's `theme.primary` (hero → gold). Transition color changes with
  `transition: border-color .4s, box-shadow .4s` (mostly already present).
- Keep the *gold* identity for the artifact reveal (it reads as "unlock") —
  only tint node ring, pulse, and fill. Decision noted so implementation
  doesn't over-tint.
- Watch contrast: Cyberpunk's `#fcee0a` and Detroit's `#29b6d8` are fine;
  Witcher's `#b8352c` on dark is acceptable. Fallback: mix 20% white via
  `color-mix` for luminance floor.

**Files:** `src/main.js`, `src/styles/timeline.css`. Effort: S.

### 7. Trailer frame flourish

**Goal:** HUD/viewfinder corner brackets on the trailer pane that animate in
with the reveal.

- Markup: in `createTrailerPane` (`src/lib/trailer.js`) append four
  `<i class="tf-corner tf-tl|tr|bl|br">` spans (or do it purely with
  `::before/::after` on `.trailer` + a wrapper for the other two corners —
  four spans is simpler).
- CSS: each corner is a 18×18px `L` built from 2px borders in `--primary`,
  offset outside the frame (`inset: -5px` corners), replacing/softening the
  current full 1px border (keep a fainter full border at 20% alpha).
- Animate: corners start translated outward (`±8px, ±8px`) + `opacity: 0`;
  on `.slide.is-active` they slide into place with staggered
  `transition-delay`s (pure CSS, follows the existing `.reveal` pattern).
  Optional 1.2s idle "breathe" (corners drift ±1px) via keyframe.
- Bonus: a `REC`-style pulsing dot top-left of the pane next to the
  `trailer-source` label — tiny, optional, same primary tint.

**Files:** `src/lib/trailer.js`, `src/styles/sections.css`. Effort: S.

### 8. Ambient particles on hero

**Goal:** ~30 sparse dust/ember particles floating over the hero video.

- New `src/lib/dust.js`: one `<canvas class="hero-dust">` absolutely
  positioned in the hero slide between `.hero-scrim` and `.hero-content`.
- Particles: 28–32, each `{x, y, r: .5–1.6px, vy: -4..-10px/s, drift, phase}`;
  warm palette sampled from hero theme (`#e8c464` at 15–45% alpha, occasional
  `#c11334` ember). Sinusoidal horizontal drift; wrap at edges.
- rAF loop gated by activity: start on hero `is-active`, stop when it
  deactivates (hook into the existing `onActive` in `main.js` via the slide
  ctrl object: give hero ctrl `{activate, deactivate}` like trailers).
  Also pause on `document.hidden`.
- DPR-aware sizing on `resize`.
- Reduced motion: don't start the loop (render nothing).

**Files:** new `src/lib/dust.js`, `src/main.js`, small CSS in `sections.css`.
Effort: M.

### 9. Preloader

**Goal:** "LOADING SAVE…" boot screen with progress bar; kills FOUC.

- Inline in `index.html` (so it paints before JS): `<div id="boot">` with
  diamond glyph, "LOADING SAVE…" label (Archivo, gold letter-spacing style),
  and a 220px progress track. Critical CSS inlined in a `<style>` tag in
  `<head>` — must not depend on the bundled CSS.
- Progress model (honest-ish, not fake-slow):
  - 0→60%: `document.fonts.ready` + hero video `canplay` (race with a 2.5s
    timeout so a slow CDN never traps the user).
  - 60→90%: rail logo images `decode()` promises settled.
  - 90→100%: next frame after `main.js` finishes building slides.
  - Drive the bar width via a single `requestAnimationFrame` lerp toward the
    current target so it always moves smoothly.
- Exit: fade + wipe up (`clip-path` inset to match the site's wipe language),
  then `#boot.remove()`; dispatch a custom event `savepoint:booted` that
  `main.js` uses to start the hero title stagger (item 4) so the intro
  choreography chains: boot exit → letters → kicker/sub/cue.
- Block scroll while booting (`overflow: hidden` on body, released on exit).
- Reduced motion: bar still fills; exit is a simple fade.

**Files:** `index.html`, small module `src/lib/boot.js`, `src/main.js`.
Effort: M.

### 10. Finale moment — "GAME SAVED"

**Goal:** an outro slide after Nº 1 with a credits-style roll of all 10 logos.

- Data: add `outro` export to `src/data/games.js`
  (`{ title: 'GAME SAVED', subtitle, cue }`).
- Build: `buildOutroSlide()` in `main.js`, appended after game slides; it
  participates in the same wipe timeline automatically (transitions.js is
  index-agnostic). Theme: ink black + gold (`--primary: var(--gold)`).
- Layout:
  - Center: big "GAME SAVED" in the hero-title style, with a save-icon diamond
    that pulses (mirrors a console save indicator).
  - Below: credits rail — all 10 logos in rank order 10→1 with titles,
    auto-scrolling upward in a masked container (CSS keyframe translateY loop,
    ~30s, pause on hover), each row `logo + Nº + title + year`.
  - Footer line: "Thanks for scrolling — [year]" + a "Back to top" button that
    calls `scrollCtrl.scrollToIndex(0)`.
- Rail integration: add an outro node to the rail item list (diamond glyph like
  the hero node, label "Game saved" — **not** secret; no logo spoiler issues
  since it shows all logos only once reached... decision: the credits roll
  spoils nothing by then, all games already revealed).
- ScrollTrigger `end` distance updates automatically (`steps` derives from
  slide count) — verify snap points still land correctly (steps = 11).
- Reduced motion: credits list static (no auto-scroll), scrollable via
  overflow.

**Files:** `src/data/games.js`, `src/main.js`, `src/styles/sections.css`,
`src/lib/timeline.js` (rail item), Effort: M–L.

---

## Suggested build order & verification

| Step | Items | Why this order |
| --- | --- | --- |
| 1 | 1 grain, 6 rail tint, 7 trailer corners | Pure CSS-ish, zero risk, instant payoff |
| 2 | 2 parallax, 3 rank ticker | Both live in the scroll/activation path — do together, test wipes hard |
| 3 | 4 hero title, 8 hero dust | Hero intro choreography as one unit |
| 4 | 9 preloader | Wraps the intro; chains into item 4's stagger |
| 5 | 10 finale | Structural (new slide + rail node) — do last, retest snap/rail |
| 6 | 5 custom cursor | Cosmetic top layer; easiest to tune/remove at the end |

Verification checklist per step:

- [ ] `npm run dev` — scroll full run down *and* back up (secret-logo re-hide
  must still work), click rail nodes to jump.
- [ ] Snap still lands each slide exactly (watch for parallax offsets bleeding
  into resting state — all parallax tweens must end at identity).
- [ ] Mobile viewport (≤960px): grain cost, cursor disabled, outro credits fit.
- [ ] `prefers-reduced-motion: reduce` — every new effect degrades to static.
- [ ] `npm run build` passes; no new deps in `package.json`.

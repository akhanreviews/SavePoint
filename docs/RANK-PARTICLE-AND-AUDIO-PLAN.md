# Plan: Scroll-Driven Rank Number Particle Animation + Per-Game Audio System

Status: **Implemented — July 8, 2026.**

This plan covers two features:

1. **Feature A — Rank number particle transit:** the rank watermark travels through the viewport as you scroll (bottom→top on scroll down, top→bottom on scroll up), scaling small → large (at center) → small, assembling from gold pixel artifacts on entry and disassembling/dissolving past the midpoint — matching the existing rail artifact aesthetic.
2. **Feature B — Per-game audio with scroll-linked crossfade:** each game plays its own music track, with volume tied to slide position, a 5-second resume window, a universal per-game-themed mute button, and trailer-audio ducking.

---

## Current Architecture (relevant facts)

| Piece | Where | Notes |
| --- | --- | --- |
| Scroll engine | `src/lib/transitions.js` → `initStageScroll()` | GSAP ScrollTrigger, pinned `#stage`, `scrub: 0.6`, snaps every `1/steps`. Emits `onProgress(p)` (continuous 0..1) and `onActive(index)` (fires at segment midpoint). |
| Slide order | `src/data/games.js` | index 0 = hero, 1–10 = games (rank 10 → 1), 11 = outro. `steps = 11`. |
| Rank number | `.watermark` span built in `src/main.js:169`, animated by `src/lib/rankTicker.js` | 46vh stroked digits, slot-machine scramble + `is-lit` gold flash. Also y-tweened ±vh by the master timeline in `transitions.js:44–65`. |
| Gold artifact FX | `src/lib/artifact.js` | Canvas particle sweep (reveal/hide) used on the rail logos. Colors `#e8c464` / `#ffe9a3`, 0.7–2.2px squares, easeInOut sweep. **This is the visual reference for the number assembly/dissolve.** |
| Trailer video | `src/lib/trailer.js` | `<video controls muted>` local files; Steam HLS; YouTube facade. User can unmute via native controls. |
| Audio assets | `public/assets/audio/` | `GoW.ogg`, `mafia-1.flac`, `dbh.flac`, `ghost-of-tsushima.flac`, `uncharted.flac`, `The Last of Us.flac`, `ME-LE.flac`, `the-witcher3.flac`, `cp2077.flac`, `rdr2.flac` |
| Theming | per-slide CSS vars `--primary/--accent/--bg/--text` set in `main.js` | Used for the mute button per-game coloring. |

Key primitive both features share: **per-segment progress**. From the global `p` (0..1):

```
seg      = p * steps            // 0..11 continuous
segIndex = floor(seg)           // which wipe is in flight
segT     = seg - segIndex       // 0..1 progress through that wipe
```

For any slide `i`, a signed "distance from centered" value can be derived: `d = seg - i`, where `d = 0` means slide `i` is fully centered, `|d| >= 1` means fully off. This single value drives number position/scale, particle assembly phase, and audio gain.

---

## Feature A — Rank Number Particle Transit

### A1. Desired behavior (spec)

Scrolling **down** into game slide `i` (segT of wipe `i-1→i` going 0→1):

| Phase (slide-centering `d` for slide i, from `+1` → `0` → `-1`) | Position | Scale | Particles |
| --- | --- | --- | --- |
| Entering (`d: 1 → 0`) | number rises from below viewport toward vertical center | small → largest | gold pixels converge and **assemble** the digits; digits become solid as `d→0` |
| Centered (`d = 0`) | vertical center (of its slot) | max | fully formed, gold glow, `is-lit` moment |
| Leaving (`d: 0 → -1`) | continues rising toward/off the top | largest → small | digits **disassemble**: gold pixels break off and dissolve upward (like the rail hide sweep) |

Scrolling **up** is the exact mirror: number enters from the **top**, descends, assembles/grows to center, then shrinks and disassembles at the **bottom**. Because everything is a pure function of scroll progress and direction, reversing scroll mid-transition naturally reverses the animation (scrub-driven, no fire-and-forget tweens).

The existing gold aesthetic (stroke color, `#e8c464`/`#ffe9a3` palette, glow) is preserved; the slot-machine scramble in `rankTicker.js` is superseded by the assembly effect (keep the module for reduced-motion fallback — see A6).

### A2. Approach: canvas particle layer + scroll-scrubbed transform

Two cooperating layers per game slide:

1. **The `.watermark` element itself** — remains the source of truth for digit shape, glow, and accessibility. Its `translateY` and `scale` become fully scroll-driven (replacing the current fixed `y: 18vh → 0` tween in `transitions.js`). Its opacity ramps 0→1 during assembly and 1→0 during dissolve so the canvas particles "hand off" to the real element around the fully-assembled window.
2. **A new `rank-fx` canvas** (new module `src/lib/rankFx.js`, modeled on `artifact.js`) positioned over the watermark region, drawing the gold pixel artifacts.

#### Digit sampling (how particles know the number's shape)

- At init (and on resize / font load), render the rank digits offscreen: draw the same font/weight/size onto an offscreen canvas, `getImageData()`, and sample opaque pixels on a grid (e.g., every 6–10 device px) to produce N target points (~300–800 per number; cap for perf).
- Each particle gets: `target {x,y}` (its pixel in the digit), a `scatter {x,y}` origin/destination (random offset 40–160px away, biased along the travel direction), size 0.7–2.2px squares, color 75% `#e8c464` / 25% `#ffe9a3`, per-particle stagger `delay ∈ [0, 0.25]` so assembly feels organic (pixels "arrive" over a window, not all at once).
- Re-sample lazily per slide (only when a slide first approaches, `|d| < 1.2`) to avoid 10 upfront rasterizations.

#### Phase mapping (scrub-driven, reversible)

Everything keys off `d = seg - i` (signed; sign also encodes travel direction):

```
|d| >= 1        → hidden, canvas idle (rAF loop not running)
travelY(d)      → lerp from +offscreenY (d=+1) to -offscreenY (d=-1)   // sign flips for scroll-up automatically
scale(d)        → minScale + (1 - minScale) * (1 - |d|) eased          // e.g. 0.45 → 1.0 → 0.45, sine ease
assembly(d)     → for d in (0.15..1):  particle lerp scatter→target as d shrinks (with per-particle stagger)
solid window    → |d| <= ~0.15: watermark opacity 1, particles fade out (handoff), is-lit style glow at d≈0
dissolve(d)     → for d in (-1..-0.15): particles lerp target→scatter, alpha decays, slight upward drift — mirroring artifact.js hide mode
```

Because `assembly` and `dissolve` are pure functions of `d`, scrolling backward replays them in reverse for free. Particle scatter positions are seeded deterministically (per particle index) so reversing looks coherent rather than re-randomized.

#### Rendering loop

- One shared rAF loop in `rankFx.js` that only runs while any slide has `|d| < 1` (started/stopped from the progress handler), same visibility/`prefers-reduced-motion` guards as `dust.js:63–80`.
- At most 2 slides can be in transit simultaneously (the wiping pair) → at most 2 canvases active. Reuse a single full-viewport canvas OR per-slide canvases; **recommendation: per-slide canvas** clipped to the watermark region (smaller clears, matches `artifact.js` pattern, plays nicely with the slide clip-path wipes).

### A3. Changes to existing code

| File | Change |
| --- | --- |
| `src/lib/transitions.js` | Remove/skip the watermark `y` tweens from the master timeline (lines ~44–65) for game slides; watermark motion moves to the new progress-driven controller. Expose `steps` or pass raw `seg` through `onProgress`. |
| `src/main.js` | In `buildGameSlide()`: add the `rank-fx` canvas next to `.watermark`; instantiate `createRankFx(slide, rank)`. In `initStageScroll` callbacks: fan `onProgress(p)` out to `rankFx.update(seg)`. Keep `onActive` for the `is-lit` flash trigger. |
| `src/lib/rankTicker.js` | Kept as reduced-motion fallback only (or retired — decide during implementation). |
| `src/styles/sections.css` | `.watermark`: add `will-change: transform, opacity` only while wiping (reuse `.is-wiping` gating from `transitions.js:28–37`); add `.rank-fx` canvas styles (absolute, pointer-events none, z-order just above `.watermark`). Glow: add a soft `filter: drop-shadow` / text-shadow gold bloom near `d≈0`. |

### A4. Edge cases

- **Hero → game 1 and game 10 → outro:** hero and outro have no watermark; the number simply assembles on entry / dissolves on exit with no counterpart — handled naturally since each slide's FX is independent.
- **Fast scrolling / snap:** scrub + snap means `d` can sweep quickly; per-particle stagger must be progress-based (not time-based) so fast sweeps still render correct intermediate states.
- **Resize / orientation change:** re-sample digit pixels (debounced), recompute offsets — same pattern as `artifact.js:36–41`.
- **Reduced motion:** skip particles entirely; keep the current simple fade/`rankTicker` behavior.

### A5. Performance notes

- Cap particles per number (~600) and skip sampling below `|d| < 1.2`.
- DPR-aware but cap DPR at 2 for the FX canvas.
- No shadows/blur per particle (use pre-multiplied alpha squares like `artifact.js`); glow comes from the DOM element's CSS, not canvas.

---

## Feature B — Per-Game Audio System

### B1. Asset mapping & preparation

Map in `src/data/games.js` (add `audio` field per game):

| slug | file |
| --- | --- |
| gow2018 | `GoW.ogg` |
| mafia | `mafia-1.flac` |
| detroit | `dbh.flac` |
| tsushima | `ghost-of-tsushima.flac` |
| uncharted3 | `uncharted.flac` |
| tlou | `The Last of Us.flac` |
| mele | `ME-LE.flac` |
| witcher3 | `the-witcher3.flac` |
| cp2077 | `cp2077.flac` |
| rdr2 | `rdr2.flac` |

**Recommended prep step:** transcode FLACs to web-friendly compressed audio (`.m4a` AAC ~160kbps or `.ogg` Vorbis q5) via ffmpeg, and rename to slug-based, space-free filenames (`tlou.m4a`, etc.). FLAC works in modern browsers but files are huge (multi-MB each × 10) and spaces in URLs are fragile. Keep originals; ship transcodes.

### B2. New module: `src/lib/audioDirector.js`

One singleton managing all 10 tracks. Public surface:

```
createAudioDirector(games) → {
  update(seg),          // called from onProgress — computes gains
  notePlaybackGesture(),// unlock hook (first user gesture)
  setMuted(bool) / toggleMuted(),
  duck() / unduck(),    // trailer integration
}
```

Implementation choice: **Web Audio API** (`AudioContext` + one `MediaElementAudioSourceNode`/`GainNode` per track, or `HTMLAudio` elements routed through gain nodes). Web Audio is preferred over raw `audio.volume` because:
- sample-accurate, click-free gain ramps (`gain.linearRampToValueAtTime`),
- a single **master gain** for mute and for trailer ducking,
- iOS Safari ignores `audio.volume` writes; gain nodes work.

Lazy element creation: create the `<audio preload="none" loop>` for game `i` only when the user first gets within one segment of it; call `load()` when within range so it's ready before it's audible.

### B3. Volume model (scroll-linked fade)

Volume for game `i` is a pure function of `d = seg - slideIndex(i)`:

```
gain(d) = PEAK * clamp(1 - |d|, 0, 1)        // linear tent, eased with equal-power curve
equal-power: g = PEAK * cos(|d| * π/2)        // smoother crossfade, constant perceived loudness
PEAK ≈ 0.5–0.6  ("reasonable volume"; tune by ear)
```

Behavior this produces automatically, matching the spec:

- On the game page (`d=0`) → full volume.
- Scrolling away → volume decreases continuously with position.
- **At the segment midpoint (`|d| = 0.5`, i.e., exactly when the incoming rank number is centered)**: enforce a hard cutoff for the *outgoing* track — when `|d|` crosses 0.5 moving away, stop (pause) the outgoing audio entirely rather than letting the tail linger. The incoming track has already begun fading in from `|d| < 1`... but to match the spec precisely ("previous audio fully stops when the next number centers"), use a **windowed curve**:

```
outgoing:  audible for |d| in [0, 0.5), silent & paused at |d| >= 0.5
incoming:  begins at |d| < 1 at gain 0... practical: start trickling in once |d| < ~0.9, reach PEAK at d = 0
```

- Scrolling up mirrors this for free (symmetric in `d`).
- Hero (index 0) and outro (index 11) have no track → silence naturally fades in/out at the ends.
- `update(seg)` runs in `onProgress`; gains are set with short ramps (~60ms) to the computed target to avoid zipper noise. Snap animations also emit `onUpdate`, so settling is smooth.

### B4. Pause / resume with 5-second timeout

Per-track state machine:

```
PLAYING   — |d| < 0.5 (audible zone)
PAUSED    — |d| >= 0.5: pause element, record pausedAt = now, start 5s timer
RESUMABLE — within 5s of pausedAt: if |d| drops below the fade-in threshold again,
            cancel timer, resume from currentTime (continue where it left off)
RESET     — 5s elapsed while out of range: seek currentTime = 0; next play starts from beginning
```

Spec nuance handled: "if at any time the user is at a position where the audio can start to fade back in, the timeout is reset and the audio continues" → entering the fade-in zone (`|d|` below threshold) both cancels the pending reset **and** restarts the 5s clock when the user later leaves again.

### B5. Autoplay policy (required plumbing)

Browsers block audio before a user gesture. Plan:

- Create/resume the `AudioContext` on the **first user interaction** (wheel/touchstart/keydown/click — the same gestures that drive scrolling, so in practice audio starts the moment the user first scrolls).
- Until unlocked, `update(seg)` computes state but doesn't call `play()`; on unlock, immediately apply the current state so audio fades in at the correct level for wherever the user is.
- Optional: a subtle "sound on" hint near the mute button on first load.

### B6. Mute/unmute button

- **One global mute state**, rendered as a small button **per game slide in an identical position** (recommendation: bottom-left corner, mirroring the watermark's bottom-right, clear of the rail and the model tab; final position to be validated visually).
- Minimal iconography: small speaker / speaker-slash SVG, thin stroke, ~40px hit target, low idle opacity (~0.55) that rises on hover — "present but unobtrusive."
- **Per-game theming:** color via `currentColor` bound to the slide's `--primary` (with a gold hover/active accent), so it inherits each game's aesthetic automatically from the existing `applyTheme` vars.
- Behavior: toggling mute sets the **master gain** to 0 (or back) with a short ramp. **It does not pause playback** — tracks keep playing/fading silently, per spec. State is universal (one flag; all buttons reflect it, updated via a shared class on `<html>` or a tiny pub/sub). Persist in `localStorage` so a returning user keeps their preference.
- Accessibility: `aria-pressed`, `aria-label="Mute soundtrack"/"Unmute soundtrack"`.

### B7. Trailer audio integration (ducking)

Trailers are `<video controls muted>` (`trailer.js:48`); users can unmute via native controls.

- Listen on each trailer video for `volumechange` + `play`/`pause`/`ended`.
- **When trailer audio becomes audible** (playing AND `!video.muted` AND `volume > 0`): call `audioDirector.duck()` → ramp master music gain to 0 over ~300ms and **pause** the page track, remembering its `currentTime` (spec: "music should pause").
- **When the user scrolls again** (first `onProgress` delta beyond a small threshold while ducked): mute the trailer video (`video.muted = true`), `unduck()`, and resume the page track **from where it left off**, immediately re-entering the normal fade rules. Also unduck on trailer `pause`/`ended`/re-mute.
- The 5s reset timer does **not** run during trailer ducking (the user is still on the page); ducking pause is a separate state from out-of-range pause.

### B8. Wiring into `main.js`

```
onProgress(p):
  rail.update(p)
  rankFx.update(p * steps)        // Feature A
  audioDirector.update(p * steps) // Feature B

onActive(index):
  (existing slide activation)      // unchanged
```

Plus: mute buttons added in `buildGameSlide()`, trailer event hooks added where `createTrailerPane` mounts videos (expose an `onAudioStateChange` callback from `trailer.js` rather than reaching into its internals).

---

## Implementation Order

1. **B1 asset prep** — transcode/rename audio, add `audio` field to `games.js`.
2. **Shared progress plumbing** — expose `seg` cleanly from `initStageScroll` to multiple consumers.
3. **Feature A** — `rankFx.js`: digit sampling → transform/scale scrub → assembly/dissolve particles → handoff/glow polish → remove old watermark tweens → reduced-motion fallback.
4. **Feature B core** — `audioDirector.js`: unlock, lazy loading, gain curves, midpoint cutoff, 5s resume logic.
5. **Feature B UI** — mute button component + per-game theming + persistence.
6. **Feature B trailer ducking** — `trailer.js` event surface + duck/unduck.
7. **Tuning pass** — PEAK volume by ear, fade thresholds, particle counts, glow intensity.
8. **Verification** — `npm run dev` manual pass (fast scroll, reverse mid-wipe, snap, trailer unmute→scroll, 5s reset, mute persistence, mobile touch, reduced motion, tab-hidden pause); `npm run build` clean.

## Risks / open questions

- **FLAC size**: 10 lossless tracks could be 50–200MB total — transcoding (B1) is strongly recommended before shipping.
- **iOS Safari**: Web Audio unlock quirks and background-tab behavior need on-device testing; pause all audio on `visibilitychange: hidden`.
- **Particle count vs. low-end GPUs**: budget guard (reduce sample density if frame time spikes).
- **Exact mute button placement**: bottom-left proposed; confirm against the drawer/model-tab layout on narrow viewports.
- **Loop vs. one-shot tracks**: plan assumes `loop = true` for each game track; confirm preference.

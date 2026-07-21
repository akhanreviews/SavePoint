# SavePoint Performance Fix Plan

## Diagnosis (root causes)

The three symptoms map to three root causes found in the code:

1. **Glitching in the last few sections** — compositor/GPU memory exhaustion. All 12 slides (hero + 10 games + outro) are mounted at once (`src/main.js:341-342`), each game slide has a `<video>` element permanently in the DOM (10 decoders reserved), plus per-slide canvases (`rankFx`), a scrubbed `clip-path` wipe on every slide (`src/lib/transitions.js:44-61`), and 30vh+ watermark text layers. By the time you reach slides 9-11 the compositor is saturated; scrolling back releases layers and it "recovers" — the classic signature of layer/VRAM pressure.

2. **Mobile Safari reload/crash on fast scroll** — memory limit exceeded. Safari kills the page (~500MB–1GB budget) when: 10 video elements + rapid activate/deactivate cycles during fast scroll churn decoders, `clip-path` scrub animations thrash the compositor, and unthrottled `onUpdate` work (rail pulse, rankFx, audioDirector gain) runs every frame.

3. **Laggy transitions on mobile** — `clip-path` wipes + simultaneous `scale`, `opacity`, and `y` tweens per transition, scrubbed at 60fps, plus synchronous `getImageData()` glyph sampling in rankFx (`src/lib/rankFx.js:218`) and competing rAF loops (dust, artifact, rankFx).

## Fix Plan (ordered by impact)

### Phase 1 — Video element virtualization (biggest win, fixes crashes)

**Files: `src/main.js`**

- Stop keeping 10 `<video>` elements in the DOM. Change `buildBackgroundVideo` so the `<video>` element is **created on `activate()`/`preload()` and fully removed from the DOM on `deactivate()`**, leaving only a lightweight placeholder div (optionally with a poster image background so there's no black flash).
- Keep the existing active/±1-neighbor windowing logic, but the window now controls DOM existence, not just `src`.
- Debounce activation during fast scroll: only call `activate()` after the slide has been the active one for ~150–250ms (a small `setTimeout` cleared on change). Fast flings then skip intermediate loads entirely instead of churning 8 decoders.
- Add `playsinline` + `disableRemotePlayback` and keep `muted`; verify `webkit-playsinline` behavior on iOS.

### Phase 2 — Cheaper transition animation (fixes lag + compositor pressure)

**Files: `src/lib/transitions.js`, `src/styles/sections.css`**

- Replace the `clip-path: inset()` wipe with a **transform-based wipe**: wrap each slide's content in a full-size inner container and animate the slide via `transform: translateY()` (or `x`) with the inner counter-translated to preserve the "reveal" look. Transforms are composited; `clip-path` forces expensive re-rasterization each scrub frame on WebKit.
  - If the wipe aesthetic must stay pixel-identical, fallback option: keep `clip-path` on desktop and use the transform variant behind a `matchMedia('(pointer: coarse)')` / width check for mobile.
- Mobile-only simplification (`ScrollTrigger.matchMedia` or a capability check):
  - Drop the outgoing-slide `scale: 1 → 1.07` tween (forces a big texture re-raster).
  - Keep only wipe + dim opacity.
- Ensure non-adjacent slides get `visibility: hidden` (in addition to the existing `is-wiping` gating) so the compositor can fully drop their layers — this directly addresses the "last few sections glitch" since late slides sit atop 9 stacked layers.

### Phase 3 — Throttle per-frame scroll work

**Files: `src/lib/transitions.js`, `src/main.js`**

- In `onUpdate` (`transitions.js:77-84`), batch the `onProgress` side effects (rail pulse, rankFx distance updates, audioDirector gains) through a single rAF-gated dispatcher and skip if progress delta < ~0.001.
- rankFx (`src/lib/rankFx.js`): cache glyph particle sampling per rank/size (it re-runs `getImageData()` on measure); on mobile cut particle cap from 600 to ~150, or disable rankFx entirely on coarse pointers.
- Merge dust/artifact/rankFx rAF loops is optional — lower priority; only if lag persists.

### Phase 4 — model-viewer memory hygiene

**Files: `src/lib/drawer.js`, `src/lib/viewer.js`**

- Don't cache every opened `<model-viewer>` forever. Keep at most the current pane: on drawer close (or when switching games), remove the previous `<model-viewer>` element and clear its `src` so Three.js resources are released. Re-opening re-fetches from HTTP cache (models are same-origin, cacheable).
- Pause `auto-rotate` when drawer is closed (it may keep the render loop alive).

### Phase 5 — Mobile-specific guards

**Files: `src/main.js`, `src/styles/base.css`, `src/styles/sections.css`**

- Extend `skipVideoBg` logic: also skip background videos when `matchMedia('(max-width: 960px)')` + optionally `navigator.deviceMemory <= 4` — or at minimum reduce the preload window to active-only (no ±1 neighbors) on mobile.
- Pause the infinite grain-shift animation (`base.css:83`) on mobile or when the tab reports low power (cheap win, mostly battery).
- Reduce the 30vh watermark shadow/blur effects on mobile if any filters are applied (check `sections.css`).

### Phase 6 — Verification

- Desktop: `npm run dev`, scroll full page end-to-end, confirm no flicker on slides 9–11 and wipes look correct; check DevTools Performance + Layers panel (layer count should stay bounded).
- Confirm `document.querySelectorAll('video').length` stays ≤ 3–4 at all times while scrolling.
- Mobile: test on the iPhone via local network (`vite --host`), fast-fling the whole page repeatedly; confirm no reload. Use Safari Web Inspector timeline/memory if available.
- Run `npm run build` and `npm test` to confirm nothing broke.

## Out of scope (noted, not planned)

- Asset optimization: .glb files are 11–16MB each and `gow2018.m4a` is 39MB — worth compressing (Draco/meshopt for GLB, re-encode audio) but separate from the runtime fixes.
- Full slide virtualization (mount/unmount whole slide DOM) — Phase 1+2 should be sufficient; revisit only if crashes persist.

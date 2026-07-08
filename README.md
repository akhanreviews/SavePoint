# SavePoint

A one-page, scroll-driven countdown of my top 10 games. Hero video intro, then
ten full-screen sections wiping from **Nº 10 (God of War)** down to
**Nº 1 (Red Dead Redemption 2)**, each themed in its game's colors, with a
Steam trailer, favorite character & mission, a one-line review, and a
mouse-draggable auto-rotating 3D character.

## Run it

```bash
npm install
npm run dev       # local dev server
npm run build     # production build → dist/
npm run trailers  # refresh Steam trailer URLs + logos (re-run if streams go stale)
```

## Run it with Docker Compose

```bash
cp .env.example .env
docker compose up --build -d
```

The site will be available at `http://localhost:8080` by default. Because the
Compose port binding defaults to `0.0.0.0`, it is also reachable at
`http://<tailscale-ip>:8080` from devices on your Tailnet.

To bind only to the Tailscale interface, set `TAILSCALE_BIND` in `.env`:

```bash
APP_PORT=8080
TAILSCALE_BIND=100.x.y.z
```

## Swap in your own content

Everything lives in **`src/data/games.js`** — one entry per game.

| What | How |
|---|---|
| Text (character / mission / review) | Edit the strings in `games.js`. The shipped copy is placeholder. |
| Trailer — local file | Drop `public/assets/videos/<slug>.mp4`, set `trailer.local: '/assets/videos/<slug>.mp4'`. Local always wins. |
| Trailer — Steam (default) | Comes from `trailer.steamAppId`, resolved via `src/data/trailers.json`. Run `npm run trailers` to refresh. |
| Trailer — YouTube | Set `trailer.youtubeId` (used when there's no Steam appId, e.g. Uncharted 3). |
| 3D model | Replace `public/assets/models/<slug>.glb`. The pane picks it up automatically — no code change. |
| Logo | Replace `public/assets/logos/<slug>.png` (the fetch script never overwrites existing files). |
| Colors | Edit the `theme` object per game (`primary`, `accent`, `bg`, `text`). |
| Hero video | Change `hero.videoUrl` in `games.js` — a URL or `/assets/hero/hero.mp4`. |
| Order / games | Reorder or replace entries in the `games` array; the timeline, wipes, and nav all rebuild from it. |

## How it works

- **Wipe transitions** — all 11 slides are stacked in one pinned viewport;
  a single GSAP ScrollTrigger-scrubbed timeline animates `clip-path` wipes
  ([src/lib/transitions.js](src/lib/transitions.js)).
- **Timeline rail** — logo nodes with a gold ring + recurring shine on the
  active game; a gold pulse travels through the connector gaps as you scroll;
  click any node to glide there ([src/lib/timeline.js](src/lib/timeline.js)).
- **Trailers** — Steam serves HLS streams (CORS-open), played via hls.js,
  loaded lazily and paused when a section is inactive
  ([src/lib/trailer.js](src/lib/trailer.js)).
- **3D panes** — `<model-viewer>` with `auto-rotate` + `camera-controls`
  ([src/lib/viewer.js](src/lib/viewer.js)). The 3D characters were generated
  with Higgsfield (image → Meshy 3D) as placeholders.

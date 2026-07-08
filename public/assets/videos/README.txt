Local video files for the top-10 site, named by slug (<slug>.mp4):

- background: the full-bleed looping video behind each game slide.
  Set `background` in src/data/games.js — a missing file falls back
  to the gradient look, so the site never breaks.
- trailer.local: to force a specific game's Steam/YouTube trailer to
  use a local file instead, set `trailer.local` in games.js.
- hero.mp4 here (optional) plus hero.videoUrl set to it swaps the
  hero slide's remote CDN video for a local one.

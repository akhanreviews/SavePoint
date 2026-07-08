/**
 * Resolves Steam trailer streams + logos for every game in src/data/games.js.
 *
 *   npm run trailers
 *
 * Writes src/data/trailers.json  (appId → { name, hls, dash, poster })
 * Downloads public/assets/logos/<slug>.png (Steam library logo, falls back
 * to the store header image). Skips logos that already exist so your own
 * replacements are never clobbered.
 *
 * Steam's appdetails API has no CORS, so this must run in Node, not the
 * browser. The resulting HLS URLs are on video.akamai.steamstatic.com,
 * which IS CORS-open, so the browser can stream them directly.
 */
import { writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { games } from '../src/data/games.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logosDir = path.join(root, 'public/assets/logos');
const outFile = path.join(root, 'src/data/trailers.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exists = (p) => access(p).then(() => true, () => false);

async function fetchMovies(appId) {
  const url = `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=movies&cc=us&l=english`;
  const res = await fetch(url, { headers: { 'User-Agent': 'savepoint-trailer-fetch' } });
  if (!res.ok) throw new Error(`appdetails ${appId} → HTTP ${res.status}`);
  const body = await res.json();
  const entry = body?.[appId];
  if (!entry?.success || !entry.data?.movies?.length) return null;
  const movies = entry.data.movies;
  // Steam lists localized variants of the same trailer; prefer English ones.
  const english = (m) => /\((?:US|EN)[^)]*\)|ESRB|english/i.test(m.name);
  const foreign = (m) => /\((?:DE|FR|IT|ES|BR|RU|PL|JP|KR|ZH|LATAM)[^)]*\)/i.test(m.name);
  const pool = movies.filter((m) => m.highlight).concat(movies);
  return pool.find(english) ?? pool.find((m) => !foreign(m)) ?? pool[0];
}

async function downloadLogo(appId, slug) {
  const dest = path.join(logosDir, `${slug}.png`);
  if (await exists(dest)) {
    console.log(`  logo ${slug}.png already present — skipping`);
    return;
  }
  const candidates = [
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/logo.png`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
  ];
  for (const url of candidates) {
    const res = await fetch(url);
    if (res.ok) {
      await writeFile(dest, Buffer.from(await res.arrayBuffer()));
      console.log(`  logo ${slug}.png ← ${url.split('/').pop()}`);
      return;
    }
  }
  console.warn(`  ⚠ no logo found for ${slug} (${appId})`);
}

await mkdir(logosDir, { recursive: true });
const trailers = {};

for (const game of games) {
  const appId = game.trailer?.steamAppId;
  if (!appId) {
    console.log(`${game.title}: no Steam appId — using its youtubeId/local fallback`);
    continue;
  }
  console.log(`${game.title} (${appId})`);
  try {
    const movie = await fetchMovies(appId);
    if (movie) {
      trailers[appId] = {
        name: movie.name,
        hls: movie.hls_h264 ?? null,
        dash: movie.dash_h264 ?? null,
        poster: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
      };
      console.log(`  trailer: ${movie.name}`);
    } else {
      console.warn(`  ⚠ no movies returned`);
    }
    await downloadLogo(appId, game.slug);
  } catch (err) {
    console.warn(`  ⚠ ${err.message}`);
  }
  await sleep(1200); // be polite to the storefront API
}

await writeFile(outFile, JSON.stringify(trailers, null, 2) + '\n');
console.log(`\nWrote ${Object.keys(trailers).length} trailer entries → ${path.relative(root, outFile)}`);

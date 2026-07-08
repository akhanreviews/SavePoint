/**
 * ═══════════════════════════════════════════════════════════════════
 *  SAVEPOINT — EDIT THIS FILE TO SWAP CONTENT
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Everything on the page is driven by this config.
 *
 *  TRAILERS — source priority per game:
 *    1. `trailer.local`     — set to 'assets/videos/<slug>.mp4' to use your own file
 *    2. `trailer.steamAppId`— default; resolved via src/data/trailers.json
 *                             (refresh URLs any time with `npm run trailers`)
 *    3. `trailer.youtubeId` — used when the game isn't on Steam (or force it
 *                             by clearing steamAppId)
 *
 *  3D MODELS — drop a .glb at public/assets/models/<slug>.glb and it appears.
 *  LOGOS     — replace public/assets/logos/<slug>.png with your own art.
 *  TEXT      — character / mission / review strings below are placeholders;
 *              rewrite them in your own words.
 *
 *  Asset paths below are deploy-relative (no leading slash) so the site
 *  works whether it's served from a domain root or a GitHub Pages project
 *  subpath — see the `asset()` helper.
 */

/** Resolves a path under public/assets relative to the page's own location. */
const asset = (path) => `assets/${path}`;

export const hero = {
  kicker: 'A personal countdown',
  title: 'SavePoint',
  subtitle: 'My ten favorite games, replayed one more time.',
  cue: 'Scroll — the countdown starts at Nº 10',
  // Swap for asset('videos/hero.mp4') to use a local file instead.
  videoUrl:
    'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260606_154941_df1a96e1-a06f-450c-bd02-d863414cc1a0.mp4',
  // Sampled from the hero video itself: deep crimson over near-black,
  // with warm parchment highlights.
  theme: { primary: '#c11334', accent: '#e9dcc3', bg: '#170a0c', text: '#f6efe2' },
};

/** Page order: last entry is #1 and closes the show. */
export const games = [
  {
    slug: 'gow2018',
    rank: 10,
    title: 'God of War',
    year: 2018,
    theme: { primary: '#b93c2b', accent: '#8fc7c0', bg: '#0d1114', text: '#e8e4da' },
    logo: asset('logos/gow2018.png'),
    trailer: { steamAppId: 1593500, youtubeId: null, local: null },
    character: {
      name: 'Kratos',
      blurb: 'Placeholder — swap in why this character is your favorite.',
    },
    mission: {
      name: 'The Sickness',
      blurb: 'Placeholder — swap in why this mission stayed with you.',
    },
    review: 'A god learns to be a father, and a franchise learns to be quiet.',
    model: asset('models/gow2018.glb'),
  },
  {
    slug: 'mafia',
    rank: 9,
    title: 'Mafia: Definitive Edition',
    year: 2020,
    theme: { primary: '#a33b2e', accent: '#d9b380', bg: '#14100d', text: '#efe6d8' },
    logo: asset('logos/mafia.png'),
    trailer: { steamAppId: 1030840, youtubeId: null, local: null },
    character: {
      name: 'Tommy Angelo',
      blurb: 'Placeholder — swap in why this character is your favorite.',
    },
    mission: {
      name: 'A Trip to the Country',
      blurb: 'Placeholder — swap in why this mission stayed with you.',
    },
    review: 'A cab driver takes one fare too many and pays for it for the rest of his life.',
    model: asset('models/mafia.glb'),
  },
  {
    slug: 'detroit',
    rank: 8,
    title: 'Detroit: Become Human',
    year: 2018,
    theme: { primary: '#29b6d8', accent: '#e9f5f8', bg: '#0a1216', text: '#dff2f7' },
    logo: asset('logos/detroit.png'),
    trailer: { steamAppId: 1222140, youtubeId: null, local: null },
    character: {
      name: 'Connor',
      blurb: 'Placeholder — swap in why this character is your favorite.',
    },
    mission: {
      name: 'Crossroads',
      blurb: 'Placeholder — swap in why this mission stayed with you.',
    },
    review: 'Every choice is a fingerprint; no two playthroughs confess the same story.',
    model: asset('models/detroit.glb'),
  },
  {
    slug: 'tsushima',
    rank: 7,
    title: 'Ghost of Tsushima',
    year: 2020,
    theme: { primary: '#c73e3a', accent: '#e3c469', bg: '#150d0c', text: '#f3ead9' },
    logo: asset('logos/tsushima.png'),
    trailer: { steamAppId: 2215430, youtubeId: null, local: null },
    character: {
      name: 'Jin Sakai',
      blurb: 'Placeholder — swap in why this character is your favorite.',
    },
    mission: {
      name: 'The Tale of Lord Shimura',
      blurb: 'Placeholder — swap in why this mission stayed with you.',
    },
    review: 'A samurai film you can walk through, one gust of wind at a time.',
    model: asset('models/tsushima.glb'),
  },
  {
    slug: 'uncharted3',
    rank: 6,
    title: "Uncharted 3: Drake's Deception",
    year: 2011,
    theme: { primary: '#d98e32', accent: '#79b6c9', bg: '#17100a', text: '#f5ead2' },
    logo: asset('logos/uncharted3.svg'),
    // Not on Steam — official launch trailer on YouTube is the default here.
    trailer: { steamAppId: null, youtubeId: 'zN3rj6YemkI', local: null },
    character: {
      name: 'Nathan Drake',
      blurb: 'Placeholder — swap in why this character is your favorite.',
    },
    mission: {
      name: "The Rub' al Khali",
      blurb: 'Placeholder — swap in why this mission stayed with you.',
    },
    review: 'Greatness from small beginnings — and the desert has never looked so cruel.',
    model: asset('models/uncharted3.glb'),
  },
  {
    slug: 'tlou',
    rank: 5,
    title: 'The Last of Us',
    year: 2013,
    subtitle: 'The series',
    theme: { primary: '#7a9a6d', accent: '#d8c8a2', bg: '#0e120c', text: '#e6e8dd' },
    logo: asset('logos/tlou.png'),
    // Part I trailer is the default. Part II Remastered appid: 2531310.
    trailer: { steamAppId: 1888930, youtubeId: null, local: null },
    character: {
      name: 'Ellie',
      blurb: 'Placeholder — swap in why this character is your favorite.',
    },
    mission: {
      name: 'The Bus Depot',
      blurb: 'Placeholder — swap in why this mission stayed with you.',
    },
    review: 'Two games about what love makes people do, and what it costs everyone else.',
    model: asset('models/tlou.glb'),
  },
  {
    slug: 'mele',
    rank: 4,
    title: 'Mass Effect Legendary Edition',
    year: 2021,
    theme: { primary: '#e03a3e', accent: '#9fb4c7', bg: '#0b0e13', text: '#e4eaf2' },
    logo: asset('logos/mele.png'),
    trailer: { steamAppId: 1328670, youtubeId: null, local: null },
    character: {
      name: 'Commander Shepard',
      blurb: 'Placeholder — swap in why this character is your favorite.',
    },
    mission: {
      name: 'The Suicide Mission',
      blurb: 'Placeholder — swap in why this mission stayed with you.',
    },
    review: 'Three games, one Shepard, and a galaxy that remembers everything you did.',
    model: asset('models/mele.glb'),
  },
  {
    slug: 'witcher3',
    rank: 3,
    title: 'The Witcher 3: Wild Hunt',
    year: 2015,
    theme: { primary: '#b8352c', accent: '#cfd2d6', bg: '#101013', text: '#ececec' },
    logo: asset('logos/witcher3.png'),
    trailer: { steamAppId: 292030, youtubeId: null, local: null },
    character: {
      name: 'Geralt of Rivia',
      blurb: 'Placeholder — swap in why this character is your favorite.',
    },
    mission: {
      name: 'Family Matters',
      blurb: 'Placeholder — swap in why this mission stayed with you.',
    },
    review: 'The side quests other games apologize for are the main event here.',
    model: asset('models/witcher3.glb'),
  },
  {
    slug: 'cp2077',
    rank: 2,
    title: 'Cyberpunk 2077',
    year: 2020,
    theme: { primary: '#fcee0a', accent: '#00f0ff', bg: '#0d0d0f', text: '#f4f4ea' },
    logo: asset('logos/cp2077.png'),
    trailer: { steamAppId: 1091500, youtubeId: null, local: null },
    character: {
      name: 'V',
      blurb: 'Placeholder — swap in why this character is your favorite.',
    },
    mission: {
      name: 'The Heist',
      blurb: 'Placeholder — swap in why this mission stayed with you.',
    },
    review: 'Night City always wins — but it puts on one hell of a show first.',
    model: asset('models/cp2077.glb'),
  },
  {
    slug: 'rdr2',
    rank: 1,
    title: 'Red Dead Redemption 2',
    year: 2018,
    theme: { primary: '#cc2b26', accent: '#e8d5a3', bg: '#120c0a', text: '#f4ede0' },
    logo: asset('logos/rdr2.png'),
    trailer: { steamAppId: 1174180, youtubeId: null, local: null },
    character: {
      name: 'Arthur Morgan',
      blurb: 'Placeholder — swap in why this character is your favorite.',
    },
    mission: {
      name: 'American Venom',
      blurb: 'Placeholder — swap in why this mission stayed with you.',
    },
    review: 'A eulogy for the American outlaw, told one sunrise at a time.',
    model: asset('models/rdr2.glb'),
  },
];

/** Closing slide, shown after Nº 1. */
export const outro = {
  kicker: 'Countdown complete',
  title: 'Game Saved',
  subtitle: 'Ten games, replayed one more time — thanks for scrolling.',
  theme: { primary: 'var(--gold)', accent: '#e9dcc3', bg: '#0a0a0c', text: '#f3ecd8' },
};

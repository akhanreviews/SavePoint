import './styles/base.css';
import './styles/timeline.css';
import './styles/sections.css';

import gsap from 'gsap';
import { hero, games, outro } from './data/games.js';
import trailers from './data/trailers.json';
import { initStageScroll } from './lib/transitions.js';
import { createRail } from './lib/timeline.js';
import { createTrailerPane } from './lib/trailer.js';
import { createRankTicker } from './lib/rankTicker.js';
import { createRankFx } from './lib/rankFx.js';
import { createAudioDirector } from './lib/audioDirector.js';
import { createHeroDust } from './lib/dust.js';
import { initBoot } from './lib/boot.js';
import { initCursor } from './lib/cursor.js';
import { createDrawer } from './lib/drawer.js';

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

const applyTheme = (node, theme) => {
  node.style.setProperty('--primary', theme.primary);
  node.style.setProperty('--accent', theme.accent);
  node.style.setProperty('--bg', theme.bg);
  node.style.setProperty('--text', theme.text);
};

const prefersReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

const isMobileViewport = () => window.matchMedia?.('(max-width: 960px)').matches ?? false;
const isLowMemoryDevice = () =>
  navigator.deviceMemory != null && navigator.deviceMemory <= 4;

const skipVideoBg =
  prefersReducedMotion() ||
  Boolean(navigator.connection?.saveData) ||
  isMobileViewport() ||
  isLowMemoryDevice();

/** On mobile / low-memory devices only the active slide gets a video element. */
const narrowVideoWindow = isMobileViewport() || isLowMemoryDevice();

const BG_ACTIVATE_DELAY = 200;
let bgActivateTimer = 0;

/**
 * Full-bleed looping background video for a game slide. The <video> element
 * is created on activate/preload and removed from the DOM on deactivate so
 * decoders aren't reserved for all ten slides at once.
 */
function buildBackgroundVideo(src) {
  if (!src || skipVideoBg) return { placeholder: null, activate() {}, preload() {}, deactivate() {} };

  const placeholder = document.createElement('div');
  placeholder.className = 'slide-video-placeholder';

  let video = null;

  const mount = (preload = 'auto') => {
    if (video) {
      video.preload = preload;
      return;
    }
    video = document.createElement('video');
    video.className = 'slide-video';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.disableRemotePlayback = true;
    video.preload = preload;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    video.src = src;
    placeholder.appendChild(video);
    video.load();
  };

  const unmount = () => {
    if (!video) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
    video = null;
  };

  return {
    placeholder,
    activate() {
      mount('auto');
      video.play().catch(() => {});
    },
    preload() {
      mount('metadata');
      video.pause();
    },
    deactivate() {
      unmount();
    },
  };
}

/* ── Hero slide ─────────────────────────────────────────────────── */

function buildHeroSlide() {
  const slide = el('section', 'slide hero');
  slide.id = 'hero';
  applyTheme(slide, hero.theme);

  const video = document.createElement('video');
  video.className = 'hero-video';
  video.src = hero.videoUrl;
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('aria-hidden', 'true');

  const title = document.createElement('h1');
  title.className = 'hero-title';
  title.setAttribute('aria-label', hero.title);
  const mask = el('span', 'ht-mask');
  [...hero.title].forEach((ch) => {
    const letter = document.createElement('span');
    letter.className = 'ht-letter';
    letter.textContent = ch === ' ' ? ' ' : ch;
    letter.setAttribute('aria-hidden', 'true');
    mask.appendChild(letter);
  });
  title.appendChild(mask);

  const content = el('div', 'hero-content');
  content.append(
    el('p', 'hero-kicker reveal', hero.kicker),
    title,
    el('p', 'hero-sub reveal', hero.subtitle),
    el('p', 'hero-cue reveal', hero.cue)
  );

  const dust = createHeroDust();
  const soundButton = buildSoundButton(hero);
  soundButton.classList.add('sound-toggle--hero');

  slide.append(video, el('div', 'hero-scrim'), dust.el, content, soundButton, el('div', 'slide-dim'));

  function playIntro() {
    const letters = mask.querySelectorAll('.ht-letter');
    if (prefersReducedMotion()) {
      gsap.set(letters, { yPercent: 0, opacity: 1 });
      return;
    }
    gsap.from(letters, {
      yPercent: 110,
      opacity: 0,
      stagger: 0.045,
      ease: 'power3.out',
      duration: 0.9,
      delay: 0.3,
    });
  }

  return { el: slide, trailer: null, model: null, playIntro, dust, video };
}

/* ── Game slides ────────────────────────────────────────────────── */

function buildFact(label, fact) {
  const item = el('div', 'fact');
  const dt = el('dt', null, label);
  const dd = document.createElement('dd');
  dd.append(el('span', 'fact-name', fact.name), el('span', 'fact-blurb', fact.blurb));
  item.append(dt, dd);
  return item;
}

function buildSoundButton(game) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sound-toggle';
  button.style.setProperty('--sound-color', game.theme.primary);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');

  const speaker = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  speaker.setAttribute('d', 'M4 9v6h4l5 4V5L8 9H4Z');

  const wave = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  wave.classList.add('sound-wave');
  wave.setAttribute('d', 'M16 8.2a5 5 0 0 1 0 7.6M18.6 5.7a8.4 8.4 0 0 1 0 12.6');

  const slash = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  slash.classList.add('sound-slash');
  slash.setAttribute('d', 'M4 4l16 16');
  svg.append(speaker, wave, slash);
  const label = el('span', 'sound-toggle-label');
  button.append(svg, label);

  audioDirector.subscribe(({ muted, unlocked }) => {
    button.classList.toggle('needs-unlock', !unlocked);
    button.classList.toggle('is-muted', muted);
    const action = !unlocked ? 'Enable soundtrack' : muted ? 'Unmute soundtrack' : 'Mute soundtrack';
    button.setAttribute('aria-pressed', String(unlocked && muted));
    button.setAttribute('aria-label', action);
    button.title = action;
    label.textContent = !unlocked ? 'Enable soundtrack' : '';
  });

  let unlockIntent = false;
  button.addEventListener('pointerdown', () => {
    unlockIntent = !audioDirector.isUnlocked();
  });
  button.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      unlockIntent = !audioDirector.isUnlocked();
    }
  });
  button.addEventListener('click', () => {
    if (unlockIntent || !audioDirector.isUnlocked()) {
      unlockIntent = false;
      audioDirector.notePlaybackGesture();
      return;
    }
    audioDirector.toggleMuted();
  });

  return button;
}

function buildGameSlide(game, gameIndex) {
  const slide = el('section', 'slide game');
  slide.id = `game-${game.slug}`;
  applyTheme(slide, game.theme);

  const bg = buildBackgroundVideo(game.background);

  const rank = String(game.rank).padStart(2, '0');
  const watermark = el('span', 'watermark', rank);
  const rankTicker = prefersReducedMotion() ? createRankTicker(watermark) : null;
  const rankFx = createRankFx(slide, watermark, gameIndex + 1);

  const head = el('header', 'game-head reveal');
  head.append(
    el('span', 'rank-tag', `Nº ${rank}`),
    el('h2', 'game-title', game.title),
    el('span', 'game-year', game.subtitle ? `${game.subtitle} · ${game.year}` : String(game.year))
  );

  const trailer = createTrailerPane(game, trailers, {
    onAudioStateChange({ audible, control }) {
      if (audible) audioDirector.duck(control);
      else audioDirector.unduck();
    },
  });
  const facts = el('dl', 'facts reveal');
  facts.append(buildFact('Favorite character', game.character), buildFact('Favorite mission', game.mission));

  const media = el('div', 'media-col');
  media.append(trailer.el, facts, el('p', 'review reveal', game.review));

  const modelTab = document.createElement('button');
  modelTab.type = 'button';
  modelTab.className = 'model-tab';
  modelTab.setAttribute('aria-haspopup', 'dialog');
  modelTab.setAttribute('aria-expanded', 'false');
  modelTab.setAttribute('aria-label', `View ${game.character.name} in 3D`);
  modelTab.append(el('span', 'model-tab-label', '3D Model'), el('span', 'model-tab-chevron'));
  modelTab.addEventListener('click', () => drawer.openFor(game, modelTab));

  const body = el('div', 'game-body');
  body.append(media, modelTab);

  const inner = el('div', 'slide-inner');
  inner.append(head, body);
  const soundButton = buildSoundButton(game);

  if (bg.placeholder) slide.append(bg.placeholder, el('div', 'slide-scrim'));
  slide.append(watermark, rankFx.el, inner, soundButton, el('div', 'slide-dim'));

  slide.querySelectorAll('.reveal').forEach((node, i) => {
    node.style.setProperty('--d', `${0.15 + i * 0.09}s`);
  });

  return { el: slide, trailer, rank: rankTicker, rankFx, bg };
}

/* ── Outro slide ────────────────────────────────────────────────── */

function buildCreditRow(game) {
  const row = el('div', 'credit-row');
  const img = document.createElement('img');
  img.src = game.logo;
  img.alt = '';
  row.append(
    img,
    el('span', 'credit-rank', `Nº ${String(game.rank).padStart(2, '0')}`),
    el('span', 'credit-title', game.title),
    el('span', 'credit-year', String(game.year))
  );
  return row;
}

function buildOutroSlide() {
  const slide = el('section', 'slide outro');
  slide.id = 'outro';
  applyTheme(slide, outro.theme);

  const glyph = el('span', 'outro-glyph');
  const center = el('div', 'outro-center reveal');
  center.append(
    glyph,
    el('p', 'outro-kicker', outro.kicker),
    el('h2', 'outro-title', outro.title),
    el('p', 'outro-subtitle', outro.subtitle)
  );

  const track = el('div', 'credits-track');
  games.forEach((g) => track.appendChild(buildCreditRow(g)));
  games.forEach((g) => track.appendChild(buildCreditRow(g)));
  const credits = el('div', 'credits reveal');
  credits.appendChild(track);

  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'outro-back';
  backBtn.textContent = 'Back to top';
  backBtn.addEventListener('click', () => scrollCtrl?.scrollToIndex(0));

  const footer = el('div', 'outro-footer reveal');
  footer.append(el('p', 'outro-thanks', `Thanks for scrolling — ${new Date().getFullYear()}`), backBtn);

  const inner = el('div', 'outro-inner');
  inner.append(center, credits, footer);
  slide.append(inner, el('div', 'slide-dim'));

  slide.querySelectorAll('.reveal').forEach((node, i) => {
    node.style.setProperty('--d', `${0.15 + i * 0.09}s`);
  });

  return { el: slide, trailer: null, model: null };
}

/* ── Assemble ───────────────────────────────────────────────────── */

const stage = document.getElementById('stage');
const railEl = document.getElementById('rail');
const themes = [hero.theme, ...games.map((g) => g.theme), outro.theme];
const drawer = createDrawer();
const audioDirector = createAudioDirector(games);

const slideCtrls = [buildHeroSlide(), ...games.map(buildGameSlide), buildOutroSlide()];
slideCtrls.forEach((c) => stage.appendChild(c.el));

let scrollCtrl = null;
let heroRevealed = false;
let currentIndex = 0;

const rail = createRail(
  railEl,
  [
    { label: 'Intro' },
    ...games.map((g) => ({
      label: `Nº ${g.rank} — ${g.title}`,
      hiddenLabel: `Nº ${g.rank} — ???`,
      logo: g.logo,
    })),
    { label: 'Game saved' },
  ],
  (index) => scrollCtrl?.scrollToIndex(index)
);

scrollCtrl = initStageScroll(
  stage,
  slideCtrls.map((c) => c.el),
  {
    onProgress: (p) => {
      const seg = p * (slideCtrls.length - 1);
      rail.update(p);
      slideCtrls.forEach((ctrl) => ctrl.rankFx?.update(seg));
      audioDirector.update(seg);
    },
    onActive: (index) => {
      currentIndex = index;
      drawer.close();
      rail.setActive(index);
      const accent = themes[index]?.primary ?? 'var(--gold)';
      railEl.style.setProperty('--rail-accent', accent);
      document.documentElement.style.setProperty('--cursor-color', accent);
      slideCtrls.forEach((ctrl, i) => {
        const applyActive = i === index && (i !== 0 || heroRevealed);
        ctrl.el.classList.toggle('is-active', applyActive);
        if (i === index) {
          ctrl.trailer?.activate();
          ctrl.rank?.play();
          ctrl.dust?.activate();
        } else {
          ctrl.trailer?.deactivate();
          ctrl.rank?.reset();
          ctrl.dust?.deactivate();
        }
      });

      clearTimeout(bgActivateTimer);
      slideCtrls.forEach((ctrl, i) => {
        const isNeighbor = i === index - 1 || i === index + 1;
        if (i !== index && !(isNeighbor && !narrowVideoWindow)) {
          ctrl.bg?.deactivate();
        }
      });
      if (!narrowVideoWindow) {
        [index - 1, index + 1].forEach((i) => {
          if (i >= 0 && i < slideCtrls.length) slideCtrls[i]?.bg?.preload();
        });
      }
      bgActivateTimer = window.setTimeout(() => {
        if (currentIndex === index) slideCtrls[index]?.bg?.activate();
      }, BG_ACTIVATE_DELAY);
    },
  }
);

// Fonts shift node positions once loaded; re-measure the rail.
document.fonts?.ready.then(() => {
  rail.measure();
  slideCtrls.forEach((ctrl) => ctrl.rankFx?.measure());
});

// Bandwidth/battery: stop every background video (and the hero loop) while
// the tab isn't visible; resume only whichever slide is actually active.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    slideCtrls.forEach((ctrl) => ctrl.bg?.deactivate());
    slideCtrls[0].video?.pause();
  } else {
    slideCtrls[currentIndex]?.bg?.activate();
    if (currentIndex === 0) slideCtrls[0].video?.play().catch(() => {});
  }
});

document.addEventListener(
  'savepoint:booted',
  () => {
    heroRevealed = true;
    if (currentIndex === 0) slideCtrls[0].el.classList.add('is-active');
    slideCtrls[0].playIntro?.();
  },
  { once: true }
);

const boot = initBoot({ heroVideo: slideCtrls[0].video, logoUrls: games.map((g) => g.logo) });
boot.finish();

initCursor();

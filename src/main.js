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

const skipVideoBg = prefersReducedMotion() || Boolean(navigator.connection?.saveData);

/**
 * Full-bleed looping background video for a game slide. Lazy: the
 * activate/preload/deactivate trio (wired from onActive below) means only
 * the active slide and its immediate neighbors ever touch the network.
 */
function buildBackgroundVideo(src) {
  if (!src || skipVideoBg) return { el: null, activate() {}, preload() {}, deactivate() {} };

  const video = document.createElement('video');
  video.className = 'slide-video';
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  video.setAttribute('aria-hidden', 'true');

  let attached = false;
  const attach = (preload = 'auto') => {
    video.preload = preload;
    if (attached) return;
    attached = true;
    video.src = src;
    video.load();
  };

  const unload = () => {
    if (!attached) return;
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.preload = 'none';
    attached = false;
  };

  return {
    el: video,
    activate() {
      attach('auto');
      video.play().catch(() => {});
    },
    preload() {
      if (!attached) {
        attach('metadata');
      } else {
        video.preload = 'metadata';
      }
      video.pause();
    },
    deactivate() {
      unload();
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

  slide.append(video, el('div', 'hero-scrim'), dust.el, content, el('div', 'slide-dim'));

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

function buildGameSlide(game) {
  const slide = el('section', 'slide game');
  slide.id = `game-${game.slug}`;
  applyTheme(slide, game.theme);

  const bg = buildBackgroundVideo(game.background);

  const rank = String(game.rank).padStart(2, '0');
  const watermark = el('span', 'watermark', rank);
  const rankTicker = createRankTicker(watermark);

  const head = el('header', 'game-head reveal');
  head.append(
    el('span', 'rank-tag', `Nº ${rank}`),
    el('h2', 'game-title', game.title),
    el('span', 'game-year', game.subtitle ? `${game.subtitle} · ${game.year}` : String(game.year))
  );

  const trailer = createTrailerPane(game, trailers);
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

  if (bg.el) slide.append(bg.el, el('div', 'slide-scrim'));
  slide.append(watermark, inner, el('div', 'slide-dim'));

  slide.querySelectorAll('.reveal').forEach((node, i) => {
    node.style.setProperty('--d', `${0.15 + i * 0.09}s`);
  });

  return { el: slide, trailer, rank: rankTicker, bg };
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
    onProgress: (p) => rail.update(p),
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
          ctrl.bg?.activate();
        } else if (i === index - 1 || i === index + 1) {
          ctrl.trailer?.deactivate();
          ctrl.rank?.reset();
          ctrl.dust?.deactivate();
          ctrl.bg?.preload();
        } else {
          ctrl.trailer?.deactivate();
          ctrl.rank?.reset();
          ctrl.dust?.deactivate();
          ctrl.bg?.deactivate();
        }
      });
    },
  }
);

// Fonts shift node positions once loaded; re-measure the rail.
document.fonts?.ready.then(() => rail.measure());

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

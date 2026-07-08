import './styles/base.css';
import './styles/timeline.css';
import './styles/sections.css';

import gsap from 'gsap';
import { hero, games, outro } from './data/games.js';
import trailers from './data/trailers.json';
import { initStageScroll } from './lib/transitions.js';
import { createRail } from './lib/timeline.js';
import { createTrailerPane } from './lib/trailer.js';
import { createModelPane } from './lib/viewer.js';
import { createRankTicker } from './lib/rankTicker.js';
import { createHeroDust } from './lib/dust.js';
import { initBoot } from './lib/boot.js';
import { initCursor } from './lib/cursor.js';

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

  const rank = String(game.rank).padStart(2, '0');
  const watermark = el('span', 'watermark', rank);
  slide.appendChild(watermark);
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

  const model = createModelPane(game);

  const body = el('div', 'game-body');
  body.append(media, model.el);

  const inner = el('div', 'slide-inner');
  inner.append(head, body);
  slide.append(inner, el('div', 'slide-dim'));

  slide.querySelectorAll('.reveal').forEach((node, i) => {
    node.style.setProperty('--d', `${0.15 + i * 0.09}s`);
  });

  return { el: slide, trailer, model, rank: rankTicker };
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

const slideCtrls = [buildHeroSlide(), ...games.map(buildGameSlide), buildOutroSlide()];
slideCtrls.forEach((c) => stage.appendChild(c.el));

let scrollCtrl = null;
let heroRevealed = false;

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
      rail.setActive(index);
      const accent = themes[index]?.primary ?? 'var(--gold)';
      railEl.style.setProperty('--rail-accent', accent);
      document.documentElement.style.setProperty('--cursor-color', accent);
      slideCtrls.forEach((ctrl, i) => {
        const applyActive = i === index && (i !== 0 || heroRevealed);
        ctrl.el.classList.toggle('is-active', applyActive);
        if (i === index) {
          ctrl.trailer?.activate();
          ctrl.model?.activate();
          ctrl.rank?.play();
          ctrl.dust?.activate();
        } else {
          ctrl.trailer?.deactivate();
          ctrl.rank?.reset();
          ctrl.dust?.deactivate();
        }
      });
    },
  }
);

// Fonts shift node positions once loaded; re-measure the rail.
document.fonts?.ready.then(() => rail.measure());

document.addEventListener(
  'savepoint:booted',
  () => {
    heroRevealed = true;
    slideCtrls[0].el.classList.add('is-active');
    slideCtrls[0].playIntro?.();
  },
  { once: true }
);

const boot = initBoot({ heroVideo: slideCtrls[0].video, logoUrls: games.map((g) => g.logo) });
boot.finish();

initCursor();

// model-viewer (three.js) is heavy; load it after the page is interactive.
// Custom elements upgrade in place whenever it finishes.
import('@google/model-viewer');

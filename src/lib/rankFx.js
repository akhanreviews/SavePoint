const GOLD = '#e8c464';
const GOLD_HOT = '#ffe9a3';
const DESKTOP_MAX_PARTICLES = 1450;
const MOBILE_MAX_PARTICLES = 360;
const SETTLED_DISTANCE = 0.045;
const ACTIVE_DISTANCE = 0.995;
const glyphCache = new Map();

let resizeTimer = 0;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (from, to, amount) => from + (to - from) * amount;
const easeInOut = (value) =>
  value < 0.5 ? 2 * value * value : 1 - Math.pow(-2 * value + 2, 2) / 2;
const easeOut = (value) => 1 - Math.pow(1 - value, 3);
const prefersReduced = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const isCoarsePointer = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

function maxParticles() {
  return isCoarsePointer() ? MOBILE_MAX_PARTICLES : DESKTOP_MAX_PARTICLES;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function sampleGlyphPoints(rank, style) {
  const key = `${rank}|${style.fontWeight}|${style.fontSize}|${style.fontFamily}`;
  if (glyphCache.has(key)) return glyphCache.get(key);

  const fontSize = Number.parseFloat(style.fontSize);
  const sampleCanvas = document.createElement('canvas');
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
  sampleContext.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  const metrics = sampleContext.measureText(rank);
  const glyphWidth = Math.ceil(metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight);
  const glyphHeight = Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
  const padding = 6;

  sampleCanvas.width = glyphWidth + padding * 2;
  sampleCanvas.height = glyphHeight + padding * 2;
  sampleContext.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
  sampleContext.fillStyle = '#fff';
  sampleContext.textBaseline = 'alphabetic';
  sampleContext.fillText(
    rank,
    padding + metrics.actualBoundingBoxLeft,
    padding + metrics.actualBoundingBoxAscent
  );

  const { data } = sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height);
  const cap = maxParticles();
  const area = sampleCanvas.width * sampleCanvas.height;
  const stride = Math.max(isCoarsePointer() ? 6 : 4, Math.round(Math.sqrt(area / cap) * 0.54));
  const points = [];

  for (let y = 0; y < sampleCanvas.height; y += stride) {
    for (let x = 0; x < sampleCanvas.width; x += stride) {
      if (data[(y * sampleCanvas.width + x) * 4 + 3] > 36) points.push({ x, y });
    }
  }

  const sampled = { points, width: sampleCanvas.width, height: sampleCanvas.height };
  glyphCache.set(key, sampled);
  return sampled;
}

export function createRankFx(stage, items) {
  const layer = document.createElement('div');
  layer.className = 'rank-transition-layer';
  layer.setAttribute('aria-hidden', 'true');

  const canvas = document.createElement('canvas');
  canvas.className = 'rank-transition-canvas';
  const context = canvas.getContext('2d');

  const scrim = document.createElement('div');
  scrim.className = 'rank-transition-scrim';

  const numeral = document.createElement('span');
  numeral.className = 'rank-transition-number watermark';
  layer.append(scrim, canvas, numeral);

  const reduced = prefersReduced();
  const coarse = isCoarsePointer();
  const records = items.map((item) => ({
    ...item,
    rank: item.watermark.dataset.rank ?? item.watermark.textContent,
    rect: null,
    style: null,
    particles: [],
    ready: false,
  }));

  let stageRect = null;
  let width = 0;
  let height = 0;
  let activeRecord = null;
  let activeDistance = 2;
  let activePhase = 0;
  let activeMode = 'enter';
  let activeRect = null;
  let raf = 0;

  function measure() {
    stageRect = stage.getBoundingClientRect();
    width = stage.clientWidth;
    height = stage.clientHeight;

    const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.35 : 1.75);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    records.forEach((record) => {
      const rect = record.watermark.getBoundingClientRect();
      record.rect = {
        left: rect.left - stageRect.left,
        top: rect.top - stageRect.top,
        width: rect.width,
        height: rect.height,
      };
      record.style = getComputedStyle(record.watermark);
      record.particles = [];
      record.ready = false;
    });
  }

  function setRestingVisibility(seg) {
    records.forEach((record) => {
      const distance = Math.abs(record.slideIndex - seg);
      const settled = distance <= SETTLED_DISTANCE;
      record.watermark.style.opacity = settled ? '1' : '0';
      record.watermark.style.transform = '';
      record.watermark.classList.toggle('is-lit', settled);
    });
  }

  function getRecord(index) {
    return records.find((record) => record.slideIndex === index) ?? null;
  }

  function getActive(seg) {
    const segment = Math.min(Math.max(Math.floor(seg), 0), items.length);
    const t = clamp(seg - segment);
    const incoming = getRecord(segment + 1);
    if (incoming) {
      return { record: incoming, distance: 1 - t, phase: t, mode: 'enter' };
    }

    const outgoing = getRecord(segment);
    if (outgoing) {
      return { record: outgoing, distance: -t, phase: t, mode: 'exit' };
    }

    return null;
  }

  function focalRect(record, phase, mode) {
    const rest = record.rect;
    const eased = easeOut(clamp(phase));
    const restCenterX = rest.left + rest.width / 2;
    const restCenterY = rest.top + rest.height / 2;
    const focalCenterX = lerp(width * 0.5, Math.min(width * 0.66, width - rest.width * 0.42), coarse ? 0.2 : 0.35);
    const focalCenterY = height * (coarse ? 0.47 : 0.48);

    if (mode === 'exit') {
      const leave = easeInOut(phase);
      const centerY = lerp(restCenterY, -rest.height * 0.45, leave);
      const centerX = lerp(restCenterX, focalCenterX, Math.sin(phase * Math.PI));
      const scale = lerp(1, 0.48, leave);
      return {
        left: centerX - (rest.width * scale) / 2,
        top: centerY - (rest.height * scale) / 2,
        width: rest.width,
        height: rest.height,
        scale,
        progress: 1 - phase,
      };
    }

    const assembleEnd = 0.38;
    const holdEnd = 0.72;
    const startCenterY = height + rest.height * 0.58;
    const settling = phase > holdEnd ? easeInOut((phase - holdEnd) / (1 - holdEnd)) : 0;
    const centerY = phase < assembleEnd
      ? lerp(startCenterY, focalCenterY, easeOut(phase / assembleEnd))
      : lerp(focalCenterY, restCenterY, settling);
    const centerX = phase < holdEnd
      ? focalCenterX
      : lerp(focalCenterX, restCenterX, settling);
    const assembleScale = lerp(0.48, 1.12, Math.sin(clamp(phase / assembleEnd) * Math.PI / 2));
    const holdPulse = phase > assembleEnd && phase < holdEnd
      ? Math.sin(((phase - assembleEnd) / (holdEnd - assembleEnd)) * Math.PI) * 0.035
      : 0;
    const scale = lerp(assembleScale + holdPulse, 1, settling);

    return {
      left: centerX - (rest.width * scale) / 2,
      top: centerY - (rest.height * scale) / 2,
      width: rest.width,
      height: rest.height,
      scale,
      progress: eased,
    };
  }

  function applyOverlay(record, rect, phase, mode) {
    if (numeral.textContent !== record.rank) numeral.textContent = record.rank;
    numeral.dataset.rank = record.rank;
    numeral.style.left = `${rect.left}px`;
    numeral.style.top = `${rect.top}px`;
    numeral.style.width = `${rect.width}px`;
    numeral.style.height = `${rect.height}px`;
    numeral.style.font = `${record.style.fontWeight} ${record.style.fontSize} ${record.style.fontFamily}`;
    numeral.style.transform = `scale(${rect.scale})`;
    numeral.style.opacity = String(mode === 'enter' ? clamp((phase + 0.12) / 0.34) : clamp((1 - phase) / 0.68));
    numeral.style.setProperty('--primary', record.style.getPropertyValue('--primary'));
    numeral.classList.toggle('is-lit', mode === 'enter' && phase > 0.34 && phase < 0.9);
    const scrimStrength = mode === 'enter'
      ? Math.sin(clamp(phase / 0.94) * Math.PI)
      : Math.sin(clamp(1 - phase) * Math.PI);
    layer.style.setProperty('--rank-scrim-opacity', String(0.12 + clamp(scrimStrength) * 0.58));
  }

  function ensureParticles(record) {
    if (record.ready || reduced || !width || !height) return;

    const { points, width: sampleWidth, height: sampleHeight } = sampleGlyphPoints(record.rank, record.style);
    const cap = maxParticles();
    const random = seededRandom(record.slideIndex * 7919 + 37);
    const shuffled = points.slice().sort(() => random() - 0.5);

    record.particles = shuffled.slice(0, cap).map((point) => {
      const lateral = (random() - 0.5) * (coarse ? 220 : 320);
      const entryDistance = 95 + random() * (coarse ? 190 : 300);
      const exitDistance = 105 + random() * (coarse ? 210 : 320);

      return {
        x: point.x - sampleWidth / 2,
        y: point.y - sampleHeight / 2,
        entryOffset: { x: lateral, y: entryDistance },
        exitOffset: { x: -lateral * 0.7, y: -exitDistance },
        delay: random() * 0.18,
        size: (coarse ? 1.45 : 1.25) + random() * (coarse ? 2.45 : 3.2),
        alpha: 0.9 + random() * 0.1,
        color: random() < 0.42 ? GOLD_HOT : GOLD,
      };
    });

    record.ready = true;
  }

  function render() {
    raf = 0;
    context.clearRect(0, 0, width, height);

    if (!activeRecord || !activeRect || reduced || activePhase <= 0 || activePhase >= 1) return;

    const particlePhase = activeMode === 'enter'
      ? clamp(activePhase / 0.42)
      : clamp(activePhase);
    const centerX = activeRect.left + (activeRect.width * activeRect.scale) / 2;
    const centerY = activeRect.top + (activeRect.height * activeRect.scale) / 2;

    for (const particle of activeRecord.particles) {
      const localPhase = clamp((particlePhase - particle.delay) / (1 - particle.delay));
      if (localPhase <= 0 || localPhase >= 1) continue;

      const eased = easeInOut(localPhase);
      const target = {
        x: centerX + particle.x * activeRect.scale,
        y: centerY + particle.y * activeRect.scale,
      };
      const entry = {
        x: target.x + particle.entryOffset.x,
        y: target.y + particle.entryOffset.y,
      };
      const exit = {
        x: target.x + particle.exitOffset.x,
        y: target.y + particle.exitOffset.y,
      };
      const from = activeMode === 'enter' ? entry : target;
      const to = activeMode === 'enter' ? target : exit;
      const x = lerp(from.x, to.x, eased);
      const y = lerp(from.y, to.y, eased);
      const fade = activeMode === 'enter'
        ? Math.sin(localPhase * Math.PI)
        : Math.sin((1 - localPhase * 0.18) * Math.PI);

      context.globalAlpha = clamp(fade) * particle.alpha;
      context.fillStyle = particle.color;
      context.fillRect(x, y, particle.size, particle.size);
    }

    context.globalAlpha = 1;
  }

  function scheduleRender() {
    if (!raf && !document.hidden) raf = requestAnimationFrame(render);
  }

  function deactivate() {
    activeRecord = null;
    activeDistance = 2;
    activePhase = 0;
    activeMode = 'enter';
    activeRect = null;
    layer.classList.remove('is-active');
    numeral.style.opacity = '0';
    numeral.classList.remove('is-lit');
    context.clearRect(0, 0, width, height);
  }

  const controller = {
    el: layer,
    measure,
    update(seg) {
      if (!width || !height || !stageRect) measure();

      setRestingVisibility(seg);

      if (reduced) {
        deactivate();
        return;
      }

      const active = getActive(seg);
      if (!active || Math.abs(active.distance) >= ACTIVE_DISTANCE) {
        deactivate();
        return;
      }

      activeRecord = active.record;
      activeDistance = active.distance;
      activePhase = active.phase;
      activeMode = active.mode;

      const handoffDistance = Math.abs(activeDistance);
      if (
        (activeMode === 'enter' && handoffDistance <= SETTLED_DISTANCE) ||
        (activeMode === 'exit' && activePhase <= SETTLED_DISTANCE)
      ) {
        deactivate();
        return;
      }

      const rect = focalRect(activeRecord, activePhase, activeMode);
      activeRect = rect;
      layer.classList.add('is-active');
      applyOverlay(activeRecord, rect, activePhase, activeMode);
      ensureParticles(activeRecord);
      scheduleRender();
    },
  };

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      measure();
      scheduleRender();
    }, 120);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else {
      scheduleRender();
    }
  });

  measure();
  return controller;
}

const GOLD = '#e8c464';
const GOLD_HOT = '#ffe9a3';
const MAX_PARTICLES = 600;
const ACTIVE_DISTANCE = 0.995;
const controllers = new Set();

let resizeTimer = 0;
let sharedFrame = 0;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const lerp = (from, to, amount) => from + (to - from) * amount;
const prefersReduced = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function renderControllers() {
  sharedFrame = 0;
  controllers.forEach((controller) => controller.render());
}

function scheduleRender() {
  if (!sharedFrame && !document.hidden) {
    sharedFrame = requestAnimationFrame(renderControllers);
  }
}

window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    controllers.forEach((controller) => controller.measure());
    scheduleRender();
  }, 120);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(sharedFrame);
    sharedFrame = 0;
  } else {
    scheduleRender();
  }
});

/**
 * Scroll-scrubbed rank numeral and particle handoff.
 * `slideIndex - seg` is positive below the viewport and negative above it,
 * so reversing the scroll naturally reverses the exact same particle paths.
 */
export function createRankFx(slide, watermark, slideIndex) {
  const canvas = document.createElement('canvas');
  canvas.className = 'rank-fx';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = 0;
  canvas.height = 0;
  const context = canvas.getContext('2d');
  const reduced = prefersReduced();

  let width = 0;
  let height = 0;
  let rankWidth = 0;
  let rankHeight = 0;
  let baseCenterY = 0;
  let distance = 2;
  let particles = [];
  let ready = false;
  let needsClear = false;

  const controller = {
    el: canvas,

    measure() {
      if (Math.abs(distance) >= ACTIVE_DISTANCE) {
        release();
        return;
      }

      width = slide.clientWidth;
      height = slide.clientHeight;
      if (!width || !height) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      rankWidth = watermark.offsetWidth;
      rankHeight = watermark.offsetHeight;
      baseCenterY = watermark.offsetTop + rankHeight / 2;
      particles = [];
      ready = false;

      if (!reduced && Math.abs(distance) < 1.2) sampleDigits();
    },

    update(seg) {
      distance = slideIndex - seg;
      const absoluteDistance = Math.abs(distance);
      const visibleProgress = clamp((1 - absoluteDistance) / 0.85);

      if (absoluteDistance >= ACTIVE_DISTANCE) {
        watermark.style.opacity = '0';
        watermark.classList.remove('is-lit');
        release();
        return;
      }

      if (!width || !height) controller.measure();

      if (reduced) {
        watermark.style.transform = '';
        watermark.style.opacity = String(visibleProgress);
        return;
      }

      if (!ready && absoluteDistance < 1.2) sampleDigits();

      const closeness = clamp(1 - absoluteDistance);
      const easedCloseness = Math.sin((closeness * Math.PI) / 2);
      const scale = 0.45 + easedCloseness * 0.55;
      const travel = height / 2 + rankHeight * 0.65;
      const desiredCenterY = height / 2 + distance * travel;
      const translateY = desiredCenterY - baseCenterY;

      watermark.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale})`;
      watermark.style.opacity = String(visibleProgress);
      watermark.classList.toggle('is-lit', absoluteDistance <= 0.15);

      if (absoluteDistance > 0.15 && absoluteDistance < 1 && particles.length) {
        needsClear = true;
        scheduleRender();
      } else if (needsClear) {
        scheduleRender();
      }
    },

    render() {
      if (!width || !height) return;
      context.clearRect(0, 0, width, height);
      needsClear = false;

      const absoluteDistance = Math.abs(distance);
      if (absoluteDistance <= 0.15 || absoluteDistance >= 1 || !particles.length) return;

      const enteringFromBelow = distance >= 0;
      const phase = enteringFromBelow
        ? clamp((1 - absoluteDistance) / 0.85)
        : clamp((absoluteDistance - 0.15) / 0.85);

      for (const particle of particles) {
        const localPhase = clamp((phase - particle.delay) / (1 - particle.delay));
        if (localPhase <= 0 || localPhase >= 1) continue;

        const from = enteringFromBelow ? particle.entry : particle.target;
        const to = enteringFromBelow ? particle.target : particle.exit;
        const eased = localPhase < 0.5
          ? 2 * localPhase * localPhase
          : 1 - Math.pow(-2 * localPhase + 2, 2) / 2;

        const x = lerp(from.x, to.x, eased);
        const y = lerp(from.y, to.y, eased);
        context.globalAlpha = Math.sin(localPhase * Math.PI) * particle.alpha;
        context.fillStyle = particle.color;
        context.fillRect(x, y, particle.size, particle.size);
      }

      context.globalAlpha = 1;
    },
  };

  function release() {
    if (!width && !height && !canvas.width && !canvas.height) return;
    canvas.width = 0;
    canvas.height = 0;
    width = 0;
    height = 0;
    rankWidth = 0;
    rankHeight = 0;
    baseCenterY = 0;
    particles = [];
    ready = false;
    needsClear = false;
  }

  function sampleDigits() {
    if (!width || !height || !rankWidth || !rankHeight) return;

    const style = getComputedStyle(watermark);
    const fontSize = Number.parseFloat(style.fontSize);
    const sampleCanvas = document.createElement('canvas');
    const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
    sampleContext.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
    const rank = watermark.dataset.rank ?? watermark.textContent;
    const metrics = sampleContext.measureText(rank);
    const glyphWidth = Math.ceil(metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight);
    const glyphHeight = Math.ceil(metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
    const padding = 4;

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
    const area = sampleCanvas.width * sampleCanvas.height;
    const stride = Math.max(6, Math.round(Math.sqrt(area / MAX_PARTICLES) * 0.72));
    const points = [];

    for (let y = 0; y < sampleCanvas.height; y += stride) {
      for (let x = 0; x < sampleCanvas.width; x += stride) {
        if (data[(y * sampleCanvas.width + x) * 4 + 3] > 40) points.push({ x, y });
      }
    }

    const random = seededRandom(slideIndex * 7919 + 17);
    points.sort(() => random() - 0.5);
    const centerX = watermark.offsetLeft + rankWidth / 2;
    const centerY = height / 2;

    particles = points.slice(0, MAX_PARTICLES).map((point) => {
      const target = {
        x: centerX + point.x - sampleCanvas.width / 2,
        y: centerY + point.y - sampleCanvas.height / 2,
      };
      const lateral = (random() - 0.5) * 150;
      const entryDistance = 40 + random() * 120;
      const exitDistance = 40 + random() * 120;

      return {
        target,
        entry: { x: target.x + lateral, y: target.y + entryDistance },
        exit: { x: target.x - lateral * 0.65, y: target.y - exitDistance },
        delay: random() * 0.25,
        size: 0.7 + random() * 1.5,
        alpha: 0.65 + random() * 0.35,
        color: random() < 0.25 ? GOLD_HOT : GOLD,
      };
    });

    ready = true;
  }

  controllers.add(controller);
  controller.measure();
  return controller;
}

const COUNT = 30;
const PALETTE = ['#e8c464', '#e8c464', '#e8c464', '#c11334'];

const prefersReduced = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Sparse warm dust/ember particles drifting up over the hero video.
 * The rAF loop only runs while the hero slide is active and the tab
 * is visible; `activate`/`deactivate` mirror the trailer/model panes.
 */
export function createHeroDust() {
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-dust';
  const ctx = canvas.getContext('2d');

  let w = 0;
  let h = 0;
  let particles = [];
  let raf = 0;
  let wantsToRun = false;

  function spawn(y) {
    return {
      x: Math.random() * w,
      y: y ?? Math.random() * h,
      r: 0.5 + Math.random() * 1.1,
      vy: -(4 + Math.random() * 6) / 60,
      drift: Math.random() * Math.PI * 2,
      driftSpeed: 0.006 + Math.random() * 0.012,
      alpha: 0.15 + Math.random() * 0.3,
      color: PALETTE[(Math.random() * PALETTE.length) | 0],
    };
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (const p of particles) {
      p.y += p.vy;
      p.drift += p.driftSpeed;
      p.x += Math.sin(p.drift) * 0.15;
      if (p.y < -10) Object.assign(p, spawn(h + 10));
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (raf || !wantsToRun || document.hidden || prefersReduced()) return;
    resize();
    if (!particles.length) particles = Array.from({ length: COUNT }, () => spawn());
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  window.addEventListener('resize', () => {
    if (raf) resize();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else start();
  });

  return {
    el: canvas,
    activate() {
      wantsToRun = true;
      start();
    },
    deactivate() {
      wantsToRun = false;
      stop();
    },
  };
}

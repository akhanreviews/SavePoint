const DURATION = 1100;
const GOLD = '#e8c464';
const GOLD_HOT = '#ffe9a3';

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const prefersReduced = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Gold "artifact" reveal/conceal for a rail logo.
 * Reveal: a glowing gold line sweeps bottom → top, uncovering the logo;
 * tiny gold artifacts break off the sweep line and dissolve upward.
 * Hide: the sweep runs top → bottom, re-covering the logo while artifacts
 * fly back in and reconnect at the line.
 */
export function createArtifactFx(btn, img) {
  const canvas = document.createElement('canvas');
  canvas.className = 'artifact-canvas';
  const glow = document.createElement('div');
  glow.className = 'artifact-glow';
  btn.append(canvas, glow);
  const ctx = canvas.getContext('2d');

  let raf = 0;
  let particles = [];

  img.style.clipPath = 'inset(100% 0 0 0)';

  function setup() {
    const pad = 12;
    const w = btn.offsetWidth + pad * 2;
    const h = btn.offsetHeight + pad * 2;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h, pad };
  }

  function finish(mode, onDone) {
    img.style.clipPath = mode === 'reveal' ? 'inset(0 0 0 0)' : 'inset(100% 0 0 0)';
    glow.style.opacity = 0;
    canvas.style.opacity = 0;
    onDone?.();
  }

  function run(mode, onDone) {
    cancelAnimationFrame(raf);
    particles = [];

    if (prefersReduced()) {
      finish(mode, onDone);
      return;
    }

    const { w, h, pad } = setup();
    const start = performance.now();
    canvas.style.opacity = 1;
    glow.style.opacity = 1;

    const frame = (now) => {
      const t = Math.min((now - start) / DURATION, 1);
      const e = easeInOut(t);
      const yFrac = mode === 'reveal' ? 1 - e : e;

      img.style.clipPath = `inset(${(mode === 'reveal' ? 1 - e : e) * 100}% 0 0 0)`;
      glow.style.top = `${yFrac * 100}%`;
      if (t >= 1) glow.style.opacity = 0;

      const lineY = pad + yFrac * (h - pad * 2);

      if (t < 1) {
        for (let i = 0; i < 3; i++) {
          const x = pad + Math.random() * (w - pad * 2);
          const size = 0.7 + Math.random() * 1.5;
          if (mode === 'reveal') {
            particles.push({
              x,
              y: lineY,
              vx: (Math.random() - 0.5) * 0.6,
              vy: -(0.4 + Math.random() * 1),
              life: 1,
              size,
            });
          } else {
            const dist = 8 + Math.random() * 16;
            const ang = Math.random() * Math.PI * 2;
            particles.push({
              x: x + Math.cos(ang) * dist,
              y: lineY + Math.sin(ang) * dist,
              tx: x,
              ty: lineY,
              life: 1,
              size,
              homing: true,
            });
          }
        }
      }

      ctx.clearRect(0, 0, w, h);
      particles = particles.filter((p) => p.life > 0);
      for (const p of particles) {
        if (p.homing) {
          p.x += (p.tx - p.x) * 0.16;
          p.y += (p.ty - p.y) * 0.16;
          p.life -= 0.045;
        } else {
          p.x += p.vx;
          p.y += p.vy;
          p.vy *= 0.985;
          p.life -= 0.022;
        }
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = Math.random() < 0.25 ? GOLD_HOT : GOLD;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      if (t < 1 || particles.length) {
        raf = requestAnimationFrame(frame);
      } else {
        finish(mode, onDone);
      }
    };

    raf = requestAnimationFrame(frame);
  }

  return {
    reveal({ instant = false, onDone } = {}) {
      if (instant) {
        cancelAnimationFrame(raf);
        finish('reveal', onDone);
      } else {
        run('reveal', onDone);
      }
    },
    hide({ instant = false, onDone } = {}) {
      if (instant) {
        cancelAnimationFrame(raf);
        finish('hide', onDone);
      } else {
        run('hide', onDone);
      }
    },
  };
}

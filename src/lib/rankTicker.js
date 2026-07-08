const DURATION = 700;
const STEPS = 12;
const CHARS = '0123456789';

const prefersReduced = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Slot-machine scramble for the watermark numeral: random digits swap in,
 * locking left-to-right onto the real rank, then a brief gold flash.
 */
export function createRankTicker(el) {
  const final = el.dataset.rank ?? el.textContent;
  el.dataset.rank = final;
  const chars = final.split('');
  const stepMs = DURATION / STEPS;

  let raf = 0;
  let flashTimer = 0;

  function play() {
    cancelAnimationFrame(raf);
    clearTimeout(flashTimer);
    el.classList.remove('is-lit');

    if (prefersReduced()) {
      el.textContent = final;
      return;
    }

    const start = performance.now();
    let lastStep = -1;

    const frame = (now) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / DURATION, 1);
      const lockedCount = Math.floor(t * chars.length);
      const step = Math.floor(elapsed / stepMs);

      if (step !== lastStep) {
        lastStep = step;
        el.textContent = chars
          .map((c, i) => (i < lockedCount ? c : CHARS[(Math.random() * CHARS.length) | 0]))
          .join('');
      }

      if (t < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        el.textContent = final;
        el.classList.add('is-lit');
        flashTimer = setTimeout(() => el.classList.remove('is-lit'), 550);
      }
    };

    raf = requestAnimationFrame(frame);
  }

  function reset() {
    cancelAnimationFrame(raf);
    clearTimeout(flashTimer);
    el.classList.remove('is-lit');
    el.textContent = final;
  }

  return { play, reset };
}

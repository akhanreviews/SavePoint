const TIMEOUT_MS = 2500;

const prefersReduced = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Drives the inline #boot progress bar toward honest load milestones
 * (fonts + hero video, then rail logo decodes, then page assembly) and
 * wipes the boot screen away on `finish()`, dispatching `savepoint:booted`
 * so the hero intro (letter stagger + content reveal) can chain off it.
 */
export function initBoot({ heroVideo, logoUrls = [] }) {
  const boot = document.getElementById('boot');
  if (!boot) return { finish() {} };

  const bar = boot.querySelector('.boot-bar');
  document.body.style.overflow = 'hidden';

  let target = 0;
  let current = 0;
  let raf = 0;

  function tick() {
    current += (target - current) * 0.12;
    if (Math.abs(target - current) < 0.05) current = target;
    if (bar) bar.style.width = `${Math.min(current, 100)}%`;
    raf = current < target ? requestAnimationFrame(tick) : 0;
  }

  function setTarget(pct) {
    target = Math.max(target, pct);
    if (!raf) raf = requestAnimationFrame(tick);
  }

  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  const videoReady = heroVideo
    ? new Promise((resolve) => {
        if (heroVideo.readyState >= 3) resolve();
        else heroVideo.addEventListener('canplay', resolve, { once: true });
      })
    : Promise.resolve();
  const timeout = new Promise((resolve) => setTimeout(resolve, TIMEOUT_MS));

  Promise.race([Promise.all([fontsReady, videoReady]), timeout]).then(() => {
    setTarget(60);

    const decodes = logoUrls.map((src) => {
      const img = new Image();
      img.src = src;
      return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    });
    Promise.all(decodes).then(() => setTarget(90));
  });

  function exit() {
    boot.classList.add('is-exiting');

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      boot.remove();
      document.body.style.overflow = '';
      document.dispatchEvent(new CustomEvent('savepoint:booted'));
    };

    boot.addEventListener('transitionend', cleanup, { once: true });
    setTimeout(cleanup, 900);
  }

  return {
    finish() {
      setTarget(100);

      const waitForFill = () => {
        if (current >= 99 || prefersReduced()) exit();
        else requestAnimationFrame(waitForFill);
      };
      requestAnimationFrame(waitForFill);
    },
  };
}

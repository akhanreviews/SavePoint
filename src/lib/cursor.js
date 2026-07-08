import gsap from 'gsap';

const HOVER_SELECTOR = 'button, a, model-viewer, .yt-facade';

const prefersReduced = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Overlay dot + trailing halo that follows the pointer and scales up over
 * interactive elements. Fine-pointer only; the native cursor is never hidden.
 */
export function initCursor() {
  if (!window.matchMedia?.('(pointer: fine)').matches) return;

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  const halo = document.createElement('div');
  halo.className = 'cursor-halo';
  document.body.append(halo, dot);

  gsap.set([dot, halo], { xPercent: -50, yPercent: -50 });

  const reduced = prefersReduced();
  const dotDuration = reduced ? 0 : 0.08;
  const haloDuration = reduced ? 0 : 0.18;

  const setDotX = gsap.quickTo(dot, 'x', { duration: dotDuration, ease: 'power3.out' });
  const setDotY = gsap.quickTo(dot, 'y', { duration: dotDuration, ease: 'power3.out' });
  const setHaloX = gsap.quickTo(halo, 'x', { duration: haloDuration, ease: 'power3.out' });
  const setHaloY = gsap.quickTo(halo, 'y', { duration: haloDuration, ease: 'power3.out' });

  let visible = false;

  window.addEventListener('pointermove', (e) => {
    if (!visible) {
      visible = true;
      dot.style.opacity = 1;
      halo.style.opacity = 1;
    }
    setDotX(e.clientX);
    setDotY(e.clientY);
    setHaloX(e.clientX);
    setHaloY(e.clientY);
  });

  document.addEventListener('pointerover', (e) => {
    if (e.target.closest?.(HOVER_SELECTOR)) {
      dot.classList.add('is-hover');
      halo.classList.add('is-hover');
    }
  });

  document.addEventListener('pointerout', (e) => {
    if (e.target.closest?.(HOVER_SELECTOR)) {
      dot.classList.remove('is-hover');
      halo.classList.remove('is-hover');
    }
  });

  document.addEventListener('mouseleave', () => {
    visible = false;
    dot.style.opacity = 0;
    halo.style.opacity = 0;
  });
}

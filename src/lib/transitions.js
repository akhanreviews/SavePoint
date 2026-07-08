import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

// Mobile browsers resize the viewport when the URL bar hides; a full
// ScrollTrigger refresh mid-scroll causes visible jumps. Skip those.
ScrollTrigger.config({ ignoreMobileResize: true });

const CLOSED = 'inset(100% 0% 0% 0%)';
const OPEN = 'inset(0% 0% 0% 0%)';

/**
 * Pins the stage and scrubs one master timeline: each slide wipes up
 * over the previous one. `onProgress` gets the raw 0..1 progress (drives
 * the rail shine); `onActive` fires when the halfway point of a wipe is
 * crossed (drives node ignition, trailer playback, content reveals).
 */
export function initStageScroll(stage, slides, { onProgress, onActive }) {
  const steps = slides.length - 1;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let active = -1;
  let wipingSegment = -1;

  // Compositor promotion is expensive; only the pair of slides actually
  // being wiped between needs it, not all twelve slides at once.
  function setWipingSegment(seg) {
    if (seg === wipingSegment) return;
    if (wipingSegment >= 0) {
      slides[wipingSegment].classList.remove('is-wiping');
      slides[wipingSegment + 1].classList.remove('is-wiping');
    }
    wipingSegment = seg;
    slides[seg].classList.add('is-wiping');
    slides[seg + 1].classList.add('is-wiping');
  }

  slides.forEach((slide, i) => {
    slide.style.zIndex = i + 1;
    if (i > 0) gsap.set(slide, { clipPath: CLOSED });
  });

  const tl = gsap.timeline({ paused: false });
  slides.forEach((slide, i) => {
    if (i === 0) return;
    const prev = slides[i - 1];
    tl.fromTo(slide, { clipPath: CLOSED }, { clipPath: OPEN, duration: 1, ease: 'none' }, i - 1)
      .fromTo(prev, { scale: 1 }, { scale: 1.07, duration: 1, ease: 'none' }, i - 1)
      .fromTo(
        prev.querySelector('.slide-dim'),
        { opacity: 0 },
        { opacity: 0.65, duration: 1, ease: 'none' },
        i - 1
      );

    if (!reduced) {
      const watermark = slide.querySelector('.watermark');
      const inner = slide.querySelector('.slide-inner');
      const prevWatermark = prev.querySelector('.watermark');
      if (watermark) tl.fromTo(watermark, { y: '18vh' }, { y: '0vh', duration: 1, ease: 'none' }, i - 1);
      if (inner) tl.fromTo(inner, { y: '9vh' }, { y: '0vh', duration: 1, ease: 'none' }, i - 1);
      if (prevWatermark) tl.fromTo(prevWatermark, { y: '0vh' }, { y: '-8vh', duration: 1, ease: 'none' }, i - 1);
    }
  });

  const trigger = ScrollTrigger.create({
    trigger: stage,
    start: 'top top',
    end: () => `+=${steps * window.innerHeight}`,
    pin: true,
    scrub: 0.6,
    animation: tl,
    snap: {
      snapTo: 1 / steps,
      duration: { min: 0.25, max: 0.7 },
      ease: 'power1.inOut',
      delay: 0.08,
      inertia: false,
    },
    onUpdate(self) {
      onProgress?.(self.progress);
      setWipingSegment(Math.min(Math.floor(self.progress * steps), steps - 1));
      const next = Math.round(self.progress * steps);
      if (next !== active) {
        active = next;
        onActive?.(next);
      }
    },
  });

  // Fire the initial state (hero active) once layout has settled.
  requestAnimationFrame(() => {
    onProgress?.(trigger.progress);
    setWipingSegment(Math.min(Math.floor(trigger.progress * steps), steps - 1));
    onActive?.(Math.round(trigger.progress * steps));
    active = Math.round(trigger.progress * steps);
  });

  return {
    scrollToIndex(index) {
      const y = trigger.start + (trigger.end - trigger.start) * (index / steps);
      gsap.to(window, { duration: 1.2, ease: 'power2.inOut', scrollTo: y, overwrite: 'auto' });
    },
  };
}

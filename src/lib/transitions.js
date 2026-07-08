import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

// Mobile browsers resize the viewport when the URL bar hides; a full
// ScrollTrigger refresh mid-scroll causes visible jumps. Skip those.
ScrollTrigger.config({ ignoreMobileResize: true });

const PROGRESS_EPSILON = 0.001;
const SCROLL_DISTANCE_MULTIPLIER = 1.65;

/**
 * Pins the stage and scrubs one master timeline: each slide wipes up
 * over the previous one. `onProgress` gets the raw 0..1 progress (drives
 * scrubbed effects); `onActive` fires when the halfway point of a wipe is
 * crossed (drives node ignition, trailer playback, content reveals).
 */
export function initStageScroll(stage, slides, { onProgress, onActive }) {
  const steps = slides.length - 1;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const mobileTransition =
    window.matchMedia?.('(max-width: 960px), (pointer: coarse)').matches ?? false;
  let active = -1;
  let wipingSegment = -1;
  let lastDispatchedProgress = -1;
  let progressFrame = 0;
  let pendingProgress = 0;

  function dispatchProgress(progress) {
    if (Math.abs(progress - lastDispatchedProgress) < PROGRESS_EPSILON) return;
    lastDispatchedProgress = progress;
    onProgress?.(progress);
  }

  function scheduleProgress(progress) {
    pendingProgress = progress;
    if (progressFrame) return;
    progressFrame = requestAnimationFrame(() => {
      progressFrame = 0;
      dispatchProgress(pendingProgress);
    });
  }

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
    updateSlideVisibility(seg);
  }

  function updateSlideVisibility(seg) {
    slides.forEach((slide, i) => {
      slide.style.visibility = i === seg || i === seg + 1 ? 'visible' : 'hidden';
    });
  }

  slides.forEach((slide, i) => {
    slide.style.zIndex = i + 1;
    if (i > 0) gsap.set(slide, { y: '100%' });
  });

  const tl = gsap.timeline({ paused: false });
  slides.forEach((slide, i) => {
    if (i === 0) return;
    const prev = slides[i - 1];
    tl.fromTo(slide, { y: '100%' }, { y: '0%', duration: 1, ease: 'none' }, i - 1);

    if (!mobileTransition) {
      tl.fromTo(prev, { scale: 1 }, { scale: 1.07, duration: 1, ease: 'none' }, i - 1);
    }

    tl.fromTo(
      prev.querySelector('.slide-dim'),
      { opacity: 0 },
      { opacity: 0.78, duration: 1, ease: 'none' },
      i - 1
    );

    if (!reduced) {
      const inner = slide.querySelector('.slide-inner');
      if (inner) tl.fromTo(inner, { y: '9vh' }, { y: '0vh', duration: 1, ease: 'none' }, i - 1);
    }
  });

  const trigger = ScrollTrigger.create({
    trigger: stage,
    start: 'top top',
    end: () => `+=${steps * window.innerHeight * SCROLL_DISTANCE_MULTIPLIER}`,
    pin: true,
    scrub: 0.9,
    animation: tl,
    snap: {
      snapTo: 1 / steps,
      duration: { min: 0.35, max: 0.95 },
      ease: 'power1.inOut',
      delay: 0.16,
      inertia: false,
    },
    onUpdate(self) {
      scheduleProgress(self.progress);
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
    dispatchProgress(trigger.progress);
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

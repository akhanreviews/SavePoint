const PEAK_GAIN = 0.55;
const FADE_IN_DISTANCE = 0.9;
const CUTOFF_DISTANCE = 0.5;
const RESET_DELAY = 5000;
const STORAGE_KEY = 'savepoint:soundtrack-muted';

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function readMutedPreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Owns the soundtrack elements and routes them through one Web Audio master.
 * Tracks approach over a broad fade window, then fade to a hard midpoint
 * cutoff while departing. That preserves overlap without leaving audio tails.
 */
export function createAudioDirector(games) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const subscribers = new Set();
  const tracks = games.map((game, index) => ({
    game,
    slideIndex: index + 1,
    audio: null,
    source: null,
    gain: null,
    distance: Infinity,
    departing: false,
    outOfRange: false,
    resetTimer: 0,
    starting: false,
    currentGain: 0,
    resumeTime: 0,
    lastError: null,
  }));

  let context = null;
  let master = null;
  let lastSeg = 0;
  let muted = readMutedPreference();
  let unlocked = false;
  let hidden = document.hidden;
  let ducked = false;
  let duckControl = null;
  let duckPauseTimer = 0;

  function ensureContext() {
    if (context || !AudioContextClass) return;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(context.destination);
    tracks.forEach(connectTrack);
  }

  function connectTrack(track) {
    if (!context || !master || !track.audio || track.source) return;
    track.source = context.createMediaElementSource(track.audio);
    track.gain = context.createGain();
    track.gain.gain.value = 0;
    track.source.connect(track.gain).connect(master);
  }

  function ensureTrack(track, preload = 'none') {
    if (!track.game.audio) return null;
    if (!track.audio) {
      track.audio = new Audio();
      track.audio.loop = true;
      track.audio.preload = 'none';
      connectTrack(track);
    }

    if (preload !== 'none' && !track.audio.getAttribute('src')) {
      track.audio.preload = preload;
      track.audio.src = track.game.audio;
      track.audio.load();
    } else if (preload === 'auto' && track.audio.preload !== 'auto') {
      track.audio.preload = 'auto';
    }

    return track.audio;
  }

  function releaseMedia(track) {
    const audio = track.audio;
    if (!audio?.getAttribute('src')) return;
    if (!audio.paused) track.resumeTime = audio.currentTime;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    audio.preload = 'none';
  }

  function setTrackGain(track, value, duration = 0.06) {
    const target = clamp(value);
    track.currentGain = target;
    if (track.gain && context) {
      const now = context.currentTime;
      track.gain.gain.cancelScheduledValues(now);
      track.gain.gain.setValueAtTime(track.gain.gain.value, now);
      track.gain.gain.linearRampToValueAtTime(target, now + duration);
    } else if (track.audio) {
      track.audio.volume = target * (muted || ducked ? 0 : 1);
    }
  }

  function setMasterGain(value, duration = 0.08) {
    if (master && context) {
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(value, now + duration);
    } else {
      tracks.forEach((track) => {
        if (track.audio) track.audio.volume = track.currentGain * clamp(value);
      });
    }
  }

  async function playTrack(track) {
    const audio = ensureTrack(track, 'auto');
    if (!audio || !unlocked || hidden || ducked || !audio.paused || track.starting) return;
    track.starting = true;
    try {
      if (track.resumeTime > 0) {
        if (audio.readyState < HTMLMediaElement.HAVE_METADATA) {
          await new Promise((resolve) => {
            const finish = () => {
              audio.removeEventListener('loadedmetadata', finish);
              audio.removeEventListener('error', finish);
              resolve();
            };
            audio.addEventListener('loadedmetadata', finish, { once: true });
            audio.addEventListener('error', finish, { once: true });
          });
        }
        if (!track.outOfRange && Number.isFinite(audio.duration)) {
          audio.currentTime = Math.min(track.resumeTime, Math.max(audio.duration - 0.05, 0));
        }
      }
      await audio.play();
      track.lastError = null;
    } catch (error) {
      track.lastError = error;
      if (error?.name === 'NotAllowedError') {
        unlocked = false;
        notify();
      }
    } finally {
      track.starting = false;
    }
  }

  function clearReset(track) {
    clearTimeout(track.resetTimer);
    track.resetTimer = 0;
    track.outOfRange = false;
  }

  function startReset(track) {
    clearTimeout(track.resetTimer);
    track.resetTimer = window.setTimeout(() => {
      track.resetTimer = 0;
      if (!track.outOfRange || ducked) return;
      track.resumeTime = 0;
      try {
        if (track.audio?.getAttribute('src')) track.audio.currentTime = 0;
      } catch {
        // Metadata may not be available yet; a fresh element still starts at 0.
      }
    }, RESET_DELAY);
  }

  function pauseOutOfRange(track) {
    if (!track.outOfRange) {
      track.outOfRange = true;
      if (track.audio && !track.audio.paused) {
        track.resumeTime = track.audio.currentTime;
        track.audio.pause();
      }
      if (!ducked) startReset(track);
    }
  }

  function targetGain(track, distance) {
    if (track.departing) {
      if (distance >= CUTOFF_DISTANCE) return 0;
      return PEAK_GAIN * Math.cos((distance / CUTOFF_DISTANCE) * (Math.PI / 2));
    }
    if (distance >= FADE_IN_DISTANCE) return 0;
    return PEAK_GAIN * Math.cos((distance / FADE_IN_DISTANCE) * (Math.PI / 2));
  }

  function update(seg, force = false) {
    const delta = seg - lastSeg;
    if (ducked && !force && Math.abs(delta) > 0.002) {
      duckControl?.mute?.();
      unduck();
    }

    for (const track of tracks) {
      const distance = Math.abs(seg - track.slideIndex);
      const distanceDelta = distance - track.distance;
      if (distanceDelta > 0.001) track.departing = true;
      else if (distanceDelta < -0.001) track.departing = false;

      const gain = targetGain(track, distance);
      const mayPlay =
        distance < CUTOFF_DISTANCE ||
        (!track.departing && distance < FADE_IN_DISTANCE);

      setTrackGain(track, gain);
      if (mayPlay) {
        if (track.outOfRange) clearReset(track);
        if (unlocked && gain > 0.001) {
          ensureTrack(track, 'metadata');
          playTrack(track);
        }
      } else if (track.audio) {
        pauseOutOfRange(track);
      }

      if (distance >= 1) releaseMedia(track);
      track.distance = distance;
    }

    lastSeg = seg;
  }

  async function notePlaybackGesture() {
    ensureContext();
    if (!context) {
      unlocked = true;
      removeUnlockListeners();
      notify();
      update(lastSeg, true);
      return;
    }
    try {
      await context.resume();
      unlocked = context.state === 'running';
    } catch {
      unlocked = false;
    }
    if (unlocked) {
      removeUnlockListeners();
      notify();
      update(lastSeg, true);
    }
  }

  function notify() {
    const state = { muted, unlocked };
    subscribers.forEach((listener) => listener(state));
  }

  function setMuted(nextMuted) {
    muted = Boolean(nextMuted);
    try {
      localStorage.setItem(STORAGE_KEY, String(muted));
    } catch {
      // Storage can be unavailable in private/embedded contexts.
    }
    setMasterGain(muted || ducked ? 0 : 1);
    notify();
  }

  function duck(control) {
    duckControl = control ?? null;
    if (ducked) return;
    ducked = true;
    tracks.forEach((track) => {
      clearTimeout(track.resetTimer);
      track.resetTimer = 0;
    });
    setMasterGain(0, 0.3);
    clearTimeout(duckPauseTimer);
    duckPauseTimer = window.setTimeout(() => {
      tracks.forEach((track) => track.audio?.pause());
    }, 320);
  }

  function unduck() {
    if (!ducked) return;
    ducked = false;
    duckControl = null;
    clearTimeout(duckPauseTimer);
    tracks.forEach((track) => {
      if (track.outOfRange) startReset(track);
    });
    setMasterGain(muted ? 0 : 1, 0.18);
    update(lastSeg, true);
  }

  const unlockEvents = ['pointerdown', 'touchstart', 'keydown', 'wheel'];
  function removeUnlockListeners() {
    unlockEvents.forEach((type) => {
      window.removeEventListener(type, notePlaybackGesture, { capture: true });
    });
  }

  unlockEvents.forEach((type) => {
    window.addEventListener(type, notePlaybackGesture, { capture: true, passive: true });
  });

  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    if (hidden) {
      clearTimeout(duckPauseTimer);
      tracks.forEach((track) => track.audio?.pause());
      context?.suspend().catch(() => {});
    } else if (unlocked) {
      context?.resume().then(() => update(lastSeg, true)).catch(() => {});
    }
  });

  return {
    update,
    notePlaybackGesture,
    setMuted,
    toggleMuted() {
      setMuted(!muted);
    },
    isMuted() {
      return muted;
    },
    isUnlocked() {
      return unlocked;
    },
    subscribe(listener) {
      subscribers.add(listener);
      listener({ muted, unlocked });
      return () => subscribers.delete(listener);
    },
    getDebugState() {
      return {
        context: context?.state ?? 'unavailable',
        unlocked,
        muted,
        ducked,
        seg: lastSeg,
        tracks: tracks.map((track) => ({
          slug: track.game.slug,
          distance: track.distance,
          departing: track.departing,
          outOfRange: track.outOfRange,
          gain: track.currentGain,
          created: Boolean(track.audio),
          loaded: Boolean(track.audio?.getAttribute('src')),
          paused: track.audio?.paused ?? true,
          currentTime: track.audio?.currentTime ?? 0,
          resumeTime: track.resumeTime,
          readyState: track.audio?.readyState ?? 0,
          networkState: track.audio?.networkState ?? 0,
          error: track.audio?.error?.code ?? track.lastError?.name ?? null,
          preload: track.audio?.preload ?? 'none',
        })),
      };
    },
    duck,
    unduck,
  };
}

import assert from 'node:assert/strict';

const audioInstances = [];
const timers = new Map();
let timerId = 0;

class FakeAudio {
  constructor() {
    this.attributes = new Map();
    this.currentTime = 0;
    this.duration = 120;
    this.error = null;
    this.loop = false;
    this.networkState = 0;
    this.paused = true;
    this.preload = 'none';
    this.readyState = 0;
    this.volume = 1;
    audioInstances.push(this);
  }

  set src(value) {
    this.attributes.set('src', value);
    this.readyState = 4;
    this.networkState = 1;
  }

  get src() {
    return this.attributes.get('src') ?? '';
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener() {}
  removeEventListener() {}

  load() {
    this.readyState = this.attributes.has('src') ? 4 : 0;
    this.networkState = this.attributes.has('src') ? 1 : 0;
  }

  async play() {
    this.paused = false;
  }

  pause() {
    this.paused = true;
  }
}

class FakeAudioParam {
  constructor() {
    this.value = 0;
  }

  cancelScheduledValues() {}

  setValueAtTime(value) {
    this.value = value;
  }

  linearRampToValueAtTime(value) {
    this.value = value;
  }
}

class FakeNode {
  constructor() {
    this.gain = new FakeAudioParam();
  }

  connect(destination) {
    return destination;
  }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.destination = new FakeNode();
    this.state = 'suspended';
  }

  createGain() {
    return new FakeNode();
  }

  createMediaElementSource() {
    return new FakeNode();
  }

  async resume() {
    this.state = 'running';
  }

  async suspend() {
    this.state = 'suspended';
  }
}

globalThis.Audio = FakeAudio;
globalThis.HTMLMediaElement = { HAVE_METADATA: 1 };
globalThis.localStorage = {
  getItem() {
    return null;
  },
  setItem() {},
};
globalThis.document = {
  hidden: false,
  addEventListener() {},
};
globalThis.window = {
  AudioContext: FakeAudioContext,
  addEventListener() {},
  removeEventListener() {},
  setTimeout(callback) {
    const id = ++timerId;
    timers.set(id, callback);
    return id;
  },
};

const { createAudioDirector } = await import('../src/lib/audioDirector.js');
const games = Array.from({ length: 10 }, (_, index) => ({
  slug: index === 0 ? 'gow2018' : index === 9 ? 'rdr2' : `game-${index + 1}`,
  audio: `audio/game-${index + 1}.m4a`,
}));
const director = createAudioDirector(games);

director.update(0);
assert.equal(audioInstances.length, 0, 'locked audio must not allocate media decoders');

await director.notePlaybackGesture();
assert.equal(director.isUnlocked(), true, 'a valid gesture unlocks the director');

director.update(0.2);
await Promise.resolve();
let state = director.getDebugState();
assert.equal(state.tracks[0].loaded, true, 'God of War loads while approaching');
assert.equal(state.tracks[0].paused, false, 'God of War starts after unlock');

audioInstances[0].currentTime = 12;
director.update(1);
await Promise.resolve();
director.update(1.6);
await Promise.resolve();
state = director.getDebugState();
assert.equal(state.tracks[0].paused, true, 'the departing track pauses at the cutoff');
assert.equal(state.tracks[0].resumeTime, 12, 'the departing track records its resume point');

director.update(2.3);
state = director.getDebugState();
assert.equal(state.tracks[0].loaded, false, 'distant media releases its network buffer');

director.update(1.4);
await Promise.resolve();
state = director.getDebugState();
assert.equal(state.tracks[0].currentTime, 12, 'returning within the window restores playback position');
assert.equal(state.tracks[0].paused, false, 'the restored track resumes playback');

director.update(1);
await Promise.resolve();
audioInstances[0].currentTime = 20;
director.update(1.6);
const latestTimer = timers.get(Math.max(...timers.keys()));
latestTimer();
state = director.getDebugState();
assert.equal(state.tracks[0].resumeTime, 0, 'the five-second timeout clears the resume point');

for (let seg = 1.7; seg <= 10; seg += 0.1) {
  director.update(seg);
  await Promise.resolve();
  const loaded = director.getDebugState().tracks.filter((track) => track.loaded);
  assert.ok(loaded.length <= 2, `media decoder count exceeded its bound at segment ${seg}`);
}

state = director.getDebugState();
assert.equal(state.tracks[9].loaded, true, 'Red Dead Redemption loads at the final game');
assert.equal(state.tracks[9].paused, false, 'Red Dead Redemption plays at the final game');

console.log('audio director lifecycle tests passed');

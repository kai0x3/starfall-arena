// audio.js — every sound in Starfall Arena is synthesized here with WebAudio; the
// game ships no audio files. One-shot effects are little oscillator and noise
// envelopes, and the music is a step sequencer that schedules a bass line, a soft
// pad and a sparse arpeggio a few notes ahead of the clock. The context is created
// lazily on the first user gesture, as browsers require, and M mutes the master.

const NOTE = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// A-minor loop, one bar of bass per array: root, fifth and neighbours. The pad
// holds the chord under it and the arpeggio picks notes from the same chord.
const BASS_LINE = [33, 0, 33, 0, 36, 0, 33, 0, 31, 0, 31, 0, 38, 0, 36, 0];
const PAD_CHORDS = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]];
const ARP_NOTES = [69, 72, 76, 72, 65, 69, 72, 69, 67, 71, 74, 71, 64, 67, 71, 67];
const STEP_SECONDS = 60 / 112 / 2; // 112 BPM, eighth notes

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
    this.muted = false;
    this.lastShootAt = 0;
    this.step = 0;
    this.nextStepAt = 0;
    this.musicOn = false;
    this.intensity = 0; // 0 calm, 1 late waves, 2 the Dreadnought is out
  }

  // The game loop reports how hot the arena is; the sequencer answers with
  // hats and a busier arpeggio rather than a new song.
  setIntensity(level) {
    this.intensity = level;
  }

  // Create the context the first time the player does something; safe to call
  // every frame afterwards.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.ctx = new AudioCtor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);
    // One shared noise buffer, reused by every explosion and hit.
    const length = this.ctx.sampleRate * 0.5;
    this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    this.nextStepAt = this.ctx.currentTime + 0.06;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.6;
  }

  toggleMuted() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  startMusic() {
    this.musicOn = true;
  }

  stopMusic() {
    this.musicOn = false;
  }

  // A single oscillator blip with a pitch glide and a quick fade.
  #tone({ freq, freqEnd, type = 'square', seconds = 0.1, gain = 0.08, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + seconds);
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(amp).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  // Filtered noise, for explosions and impacts: the filter sweeps down as the
  // burst dies, which reads as a thump rather than a hiss.
  #noise({ seconds = 0.25, gain = 0.16, from = 3200, to = 220, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(to, t0 + seconds);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    src.connect(filter).connect(amp).connect(this.master);
    src.start(t0, Math.random() * 0.3);
    src.stop(t0 + seconds + 0.02);
  }

  shoot() {
    if (!this.ctx) return;
    const now = performance.now();
    if (now - this.lastShootAt < 45) return; // a held trigger stays one clean stream
    this.lastShootAt = now;
    this.#tone({ freq: 840 + Math.random() * 120, freqEnd: 420, type: 'square', seconds: 0.07, gain: 0.045 });
  }

  enemyHit() {
    this.#tone({ freq: 210, freqEnd: 140, type: 'triangle', seconds: 0.045, gain: 0.05 });
  }

  explosion(big) {
    this.#noise({ seconds: big ? 0.42 : 0.24, gain: big ? 0.24 : 0.15, from: big ? 2600 : 3400, to: 160 });
    this.#tone({ freq: big ? 120 : 160, freqEnd: 42, type: 'sine', seconds: big ? 0.36 : 0.2, gain: 0.16 });
  }

  pickup() {
    this.#tone({ freq: 660, freqEnd: 990, type: 'sine', seconds: 0.08, gain: 0.06 });
  }

  // The dash: a breath of filtered noise swept upward, gone in a blink.
  dash() {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(500, t0);
    filter.frequency.exponentialRampToValueAtTime(3400, t0 + 0.16);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.14, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    src.connect(filter).connect(amp).connect(this.master);
    src.start(t0, Math.random() * 0.3);
    src.stop(t0 + 0.2);
  }

  // A critical hit: a bright little ping above the gunfire.
  crit() {
    this.#tone({ freq: 1560, freqEnd: 1180, type: 'square', seconds: 0.06, gain: 0.05 });
  }

  // The boss warning: two low alarm tones, impossible to mistake.
  bossWarn() {
    this.#tone({ freq: 98, type: 'sawtooth', seconds: 0.34, gain: 0.13 });
    this.#tone({ freq: 98, type: 'sawtooth', seconds: 0.34, gain: 0.13, delay: 0.42 });
    this.#tone({ freq: 147, type: 'sawtooth', seconds: 0.4, gain: 0.1, delay: 0.84 });
  }

  // The Dreadnought firing: a deep thump under its rings and volleys.
  bossShot() {
    this.#tone({ freq: 82, freqEnd: 46, type: 'sine', seconds: 0.22, gain: 0.15 });
  }

  hurt() {
    this.#tone({ freq: 170, freqEnd: 55, type: 'sawtooth', seconds: 0.22, gain: 0.14 });
    this.#noise({ seconds: 0.16, gain: 0.1, from: 1800, to: 300 });
  }

  levelUp() {
    [523, 659, 784, 1047].forEach((freq, i) => {
      this.#tone({ freq, type: 'triangle', seconds: 0.16, gain: 0.09, delay: i * 0.07 });
    });
  }

  uiClick() {
    this.#tone({ freq: 1180, freqEnd: 900, type: 'sine', seconds: 0.05, gain: 0.05 });
  }

  gameOver() {
    [392, 330, 262, 196].forEach((freq, i) => {
      this.#tone({ freq, type: 'triangle', seconds: 0.3, gain: 0.1, delay: i * 0.17 });
    });
    this.#noise({ seconds: 0.7, gain: 0.12, from: 2000, to: 120 });
  }

  // Called every frame by the game loop: keep the sequencer a couple of steps
  // ahead of the audio clock while music is on.
  update() {
    if (!this.ctx || !this.musicOn || this.ctx.state !== 'running') return;
    while (this.nextStepAt < this.ctx.currentTime + 0.14) {
      this.#scheduleStep(this.step, this.nextStepAt);
      this.step = (this.step + 1) % 64;
      this.nextStepAt += STEP_SECONDS;
    }
  }

  #scheduleStep(step, t0) {
    const delay = Math.max(0, t0 - this.ctx.currentTime);
    const bar = Math.floor(step / 16) % 4;
    const inBar = step % 16;
    const bass = BASS_LINE[inBar];
    if (bass) {
      this.#tone({ freq: NOTE(bass), type: 'triangle', seconds: 0.21, gain: 0.085, delay });
      // At full heat the bass doubles an octave up on its off hits.
      if (this.intensity >= 2 && inBar % 4 === 2) {
        this.#tone({ freq: NOTE(bass + 12), type: 'triangle', seconds: 0.14, gain: 0.04, delay });
      }
    }
    if (inBar === 0) {
      for (const midi of PAD_CHORDS[bar]) {
        this.#tone({ freq: NOTE(midi), type: 'sine', seconds: STEP_SECONDS * 15, gain: 0.016, delay });
      }
    }
    // Hats arrive with the late waves: a tick of high noise on the off steps.
    if (this.intensity >= 1 && step % 2 === 1) {
      this.#hat(delay);
    }
    if (step % 2 === 0 && Math.random() < 0.8) {
      const arp = ARP_NOTES[(step / 2) % 16];
      this.#tone({ freq: NOTE(arp), type: 'sine', seconds: 0.14, gain: 0.028, delay });
    }
    // The boss doubles the arpeggio's pace: a note on every single step.
    if (this.intensity >= 2 && step % 2 === 1) {
      const arp = ARP_NOTES[(step + 8) % 16];
      this.#tone({ freq: NOTE(arp), type: 'sine', seconds: 0.11, gain: 0.02, delay });
    }
  }

  // A hat is the noise buffer through a high shelf, cut very short.
  #hat(delay) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.035, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    src.connect(filter).connect(amp).connect(this.master);
    src.start(t0, Math.random() * 0.3);
    src.stop(t0 + 0.07);
  }
}

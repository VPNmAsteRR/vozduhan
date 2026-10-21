(function (root) {
  "use strict";
  function AudioEngine() {
    this.context = null;
    this.muted = false;
    this.volume = 0.4;
    this.babbleTimer = 0;
    this.ambientSource = null;
    this.ambientGain = null;
  }
  AudioEngine.prototype.unlock = function () {
    if (!this.context) {
      const Context = root.AudioContext || root.webkitAudioContext;
      if (Context) this.context = new Context();
    }
    if (this.context && this.context.state === "suspended") this.context.resume();
  };
  AudioEngine.prototype.tone = function (frequency, duration, type, gain, endFrequency) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const amp = this.context.createGain();
    oscillator.type = type || "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, (gain || 0.12) * this.volume), now + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(amp).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  };
  AudioEngine.prototype.play = function (name) {
    this.unlock();
    if (!this.context || this.muted) return;
    if (name === "success") { this.tone(660, 0.12, "sine", 0.22); this.tone(880, 0.2, "sine", 0.18); }
    else if (name === "error") this.tone(170, 0.2, "sawtooth", 0.18, 90);
    else if (name === "inhale") this.tone(460, 0.3, "sine", 0.08, 240);
    else if (name === "win") { [523, 659, 784, 1046].forEach((note, index) => setTimeout(() => this.tone(note, 0.35, "triangle", 0.18), index * 130)); }
    else if (name === "lose") { this.tone(260, 0.5, "sawtooth", 0.16, 190); setTimeout(() => this.tone(180, 0.65, "sawtooth", 0.14, 120), 400); }
    else if (name === "babble") this.tone(180 + Math.random() * 260, 0.065, "triangle", 0.045);
    else if (name === "item") this.tone(520, 0.12, "sine", 0.14, 740);
  };
  AudioEngine.prototype.update = function (dt, talking) {
    this.babbleTimer -= dt;
    if (talking && this.babbleTimer <= 0) {
      this.play("babble");
      this.babbleTimer = 0.2 + Math.random() * 0.13;
    }
  };
  AudioEngine.prototype.setMuted = function (muted) {
    this.muted = muted;
    if (this.ambientGain && this.context) this.ambientGain.gain.value = muted ? 0 : 0.035 * this.volume;
  };
  AudioEngine.prototype.setAmbient = function (enabled) {
    this.unlock();
    if (!this.context) return;
    if (!enabled) {
      if (this.ambientSource) {
        this.ambientSource.stop();
        this.ambientSource.disconnect();
        this.ambientGain.disconnect();
        this.ambientSource = null;
        this.ambientGain = null;
      }
      return;
    }
    if (this.ambientSource) return;
    const length = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) samples[index] = (Math.random() * 2 - 1) * 0.15;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = 520;
    gain.gain.value = this.muted ? 0 : 0.035 * this.volume;
    source.connect(filter).connect(gain).connect(this.context.destination);
    source.start();
    this.ambientSource = source;
    this.ambientGain = gain;
  };
  root.VZ.AudioEngine = AudioEngine;
})(window);

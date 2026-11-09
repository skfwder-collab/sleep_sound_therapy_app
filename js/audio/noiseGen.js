/**
 * Procedural Color Noise Generator
 * Synthesizes Pink Noise (1/f decay), Brown Noise (1/f^2 deep rumble), and White Noise
 * directly in memory without any external audio files.
 */
export class NoiseGenerator {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.bufferSource = null;
    this.gainNode = null;
    this.filterNode = null;
    this.isPlaying = false;
    this.noiseType = 'pink'; // 'pink' | 'brown' | 'white'
    this.volume = 0.55;
    this.cachedBuffers = {};
  }

  generateBuffer(type) {
    if (this.cachedBuffers[type]) return this.cachedBuffers[type];

    const ctx = this.audioEngine.ctx;
    const bufferSize = ctx.sampleRate * 5; // 5-second seamless looping buffer
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const output = buffer.getChannelData(channel);

      if (type === 'white') {
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
      } else if (type === 'pink') {
        // Paul Kellet's refined 1/f filter simulation
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
      } else if (type === 'brown') {
        // Integrated white noise for deep restorative sleep rumble
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5; // Compensate gain
        }
      }
    }

    this.cachedBuffers[type] = buffer;
    return buffer;
  }

  start(type = this.noiseType) {
    if (this.isPlaying) this.stop();
    this.noiseType = type;
    const ctx = this.audioEngine.ctx;
    const now = ctx.currentTime;

    const buffer = this.generateBuffer(type);
    this.bufferSource = ctx.createBufferSource();
    this.bufferSource.buffer = buffer;
    this.bufferSource.loop = true;

    // Soft low-pass filter to prevent ear fatigue during nighttime
    this.filterNode = ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.setValueAtTime(type === 'brown' ? 450 : 850, now);

    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(0.001, now);
    this.gainNode.gain.linearRampToValueAtTime(this.volume, now + 1.2);

    this.bufferSource.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);
    this.gainNode.connect(this.audioEngine.masterGain);

    this.bufferSource.start(now);
    this.isPlaying = true;
  }

  stop() {
    if (!this.isPlaying) return;
    const ctx = this.audioEngine.ctx;
    const now = ctx.currentTime;

    if (this.gainNode) {
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.6);
    }

    setTimeout(() => {
      try {
        if (this.bufferSource) this.bufferSource.stop();
        if (this.bufferSource) this.bufferSource.disconnect();
      } catch (e) {}
      this.isPlaying = false;
    }, 650);
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.gainNode && this.audioEngine.ctx) {
      const now = this.audioEngine.ctx.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.linearRampToValueAtTime(this.volume, now + 0.05);
    }
  }

  // Used by the ambient noise masker to dynamically swell masking sound during loud room disturbances
  boostMasking(temporaryGainRatio, rampTime = 0.4) {
    if (!this.gainNode || !this.isPlaying) return;
    const ctx = this.audioEngine.ctx;
    const now = ctx.currentTime;
    const target = Math.min(1.0, this.volume * temporaryGainRatio);
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.linearRampToValueAtTime(target, now + rampTime);
  }

  resetMasking(rampTime = 1.8) {
    if (!this.gainNode || !this.isPlaying) return;
    const ctx = this.audioEngine.ctx;
    const now = ctx.currentTime;
    this.gainNode.gain.cancelScheduledValues(now);
    this.gainNode.gain.linearRampToValueAtTime(this.volume, now + rampTime);
  }
}

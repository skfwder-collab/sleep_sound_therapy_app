/**
 * Isochronic Tones Generator
 * Distinct rhythmic acoustic pulses that guide the brain into targeted sleep frequencies.
 */
export class IsochronicGenerator {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.carrierFreq = 180;  // Gentle resonant tone
    this.pulseRate = 3.0;    // Pulses per second (Delta: 1-4Hz, Theta: 4-8Hz)
    this.oscillator = null;
    this.pulseGain = null;
    this.mainGain = null;
    this.isPlaying = false;
    this.volume = 0.5;
    this.pulseTimer = null;
  }

  start() {
    if (this.isPlaying) return;
    const ctx = this.audioEngine.ctx;
    const now = ctx.currentTime;

    this.mainGain = ctx.createGain();
    this.mainGain.gain.setValueAtTime(0.001, now);
    this.mainGain.gain.linearRampToValueAtTime(this.volume, now + 1.0);
    this.mainGain.connect(this.audioEngine.masterGain);

    this.pulseGain = ctx.createGain();
    this.pulseGain.gain.setValueAtTime(0, now);
    this.pulseGain.connect(this.mainGain);

    this.oscillator = ctx.createOscillator();
    this.oscillator.type = 'sine';
    this.oscillator.frequency.setValueAtTime(this.carrierFreq, now);
    this.oscillator.connect(this.pulseGain);

    this.oscillator.start(now);
    this.isPlaying = true;

    // Start pulsing envelope schedule
    this.schedulePulses();
  }

  schedulePulses() {
    if (!this.isPlaying) return;
    const ctx = this.audioEngine.ctx;
    const now = ctx.currentTime;
    const interval = 1.0 / this.pulseRate;
    const pulseWidth = interval * 0.45; // 45% duty cycle

    // Schedule 8 pulses ahead for jitter-free rhythmic delivery
    for (let i = 0; i < 8; i++) {
      const pulseStart = now + (i * interval);
      this.pulseGain.gain.setValueAtTime(0.001, pulseStart);
      this.pulseGain.gain.linearRampToValueAtTime(1.0, pulseStart + 0.04);
      this.pulseGain.gain.setValueAtTime(1.0, pulseStart + pulseWidth);
      this.pulseGain.gain.linearRampToValueAtTime(0.001, pulseStart + pulseWidth + 0.04);
    }

    this.pulseTimer = setTimeout(() => {
      if (this.isPlaying) this.schedulePulses();
    }, (7 * interval) * 1000);
  }

  setPulseRate(rate, carrier = this.carrierFreq) {
    this.pulseRate = rate;
    this.carrierFreq = carrier;
    if (this.oscillator && this.isPlaying) {
      this.oscillator.frequency.setTargetAtTime(this.carrierFreq, this.audioEngine.ctx.currentTime, 0.2);
    }
  }

  stop() {
    if (!this.isPlaying) return;
    clearTimeout(this.pulseTimer);
    const ctx = this.audioEngine.ctx;
    const now = ctx.currentTime;

    if (this.mainGain) {
      this.mainGain.gain.cancelScheduledValues(now);
      this.mainGain.gain.linearRampToValueAtTime(0.0001, now + 0.6);
    }

    setTimeout(() => {
      try {
        if (this.oscillator) this.oscillator.stop();
        if (this.oscillator) this.oscillator.disconnect();
      } catch (e) {}
      this.isPlaying = false;
    }, 650);
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.mainGain && this.audioEngine.ctx) {
      const now = this.audioEngine.ctx.currentTime;
      this.mainGain.gain.cancelScheduledValues(now);
      this.mainGain.gain.linearRampToValueAtTime(this.volume, now + 0.05);
    }
  }
}

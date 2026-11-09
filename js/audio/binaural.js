/**
 * Binaural Beats Generator
 * Produces frequency differences between left and right ears to induce Delta/Theta brainwaves.
 */
export class BinauralGenerator {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.carrierFreq = 144; // Soothing carrier pitch (Hz)
    this.beatFreq = 2.5;    // Delta sleep default (Hz)
    this.gainNode = null;
    this.oscLeft = null;
    this.oscRight = null;
    this.pannerLeft = null;
    this.pannerRight = null;
    this.isPlaying = false;
    this.volume = 0.7;
  }

  start() {
    if (this.isPlaying) return;
    const ctx = this.audioEngine.ctx;
    const now = ctx.currentTime;

    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(0.001, now);
    this.gainNode.gain.linearRampToValueAtTime(this.volume, now + 1.5);
    this.gainNode.connect(this.audioEngine.masterGain);

    // Left Ear
    this.oscLeft = ctx.createOscillator();
    this.oscLeft.type = 'sine';
    this.oscLeft.frequency.setValueAtTime(this.carrierFreq - (this.beatFreq / 2), now);

    this.pannerLeft = ctx.createStereoPanner();
    this.pannerLeft.pan.setValueAtTime(-1, now); // 100% Left

    this.oscLeft.connect(this.pannerLeft);
    this.pannerLeft.connect(this.gainNode);

    // Right Ear
    this.oscRight = ctx.createOscillator();
    this.oscRight.type = 'sine';
    this.oscRight.frequency.setValueAtTime(this.carrierFreq + (this.beatFreq / 2), now);

    this.pannerRight = ctx.createStereoPanner();
    this.pannerRight.pan.setValueAtTime(1, now); // 100% Right

    this.oscRight.connect(this.pannerRight);
    this.pannerRight.connect(this.gainNode);

    this.oscLeft.start(now);
    this.oscRight.start(now);
    this.isPlaying = true;
  }

  stop() {
    if (!this.isPlaying) return;
    const ctx = this.audioEngine.ctx;
    const now = ctx.currentTime;

    if (this.gainNode) {
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.8);
    }

    setTimeout(() => {
      try {
        if (this.oscLeft) this.oscLeft.stop();
        if (this.oscRight) this.oscRight.stop();
        if (this.oscLeft) this.oscLeft.disconnect();
        if (this.oscRight) this.oscRight.disconnect();
      } catch (e) {}
      this.isPlaying = false;
    }, 850);
  }

  setBeatFrequency(freq, carrier = this.carrierFreq) {
    this.beatFreq = freq;
    this.carrierFreq = carrier;
    if (this.isPlaying && this.oscLeft && this.oscRight) {
      const now = this.audioEngine.ctx.currentTime;
      this.oscLeft.frequency.setTargetAtTime(this.carrierFreq - (this.beatFreq / 2), now, 0.2);
      this.oscRight.frequency.setTargetAtTime(this.carrierFreq + (this.beatFreq / 2), now, 0.2);
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.gainNode && this.audioEngine.ctx) {
      const now = this.audioEngine.ctx.currentTime;
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.linearRampToValueAtTime(this.volume, now + 0.05);
    }
  }
}

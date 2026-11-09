/**
 * SomnaWave Web Audio Core Engine
 * Manages the Web Audio context, master gain, analyser node, and master fade operations.
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    this.dynamicsCompressor = null;
    this.isInitialized = false;
    this.isPlaying = false;
    this.masterVolume = 0.75;
  }

  async init() {
    if (this.isInitialized) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Dynamics compressor to guarantee acoustic smoothness & prevent clipping
    this.dynamicsCompressor = this.ctx.createDynamicsCompressor();
    this.dynamicsCompressor.threshold.setValueAtTime(-18, this.ctx.currentTime);
    this.dynamicsCompressor.knee.setValueAtTime(30, this.ctx.currentTime);
    this.dynamicsCompressor.ratio.setValueAtTime(8, this.ctx.currentTime);
    this.dynamicsCompressor.attack.setValueAtTime(0.01, this.ctx.currentTime);
    this.dynamicsCompressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    // Analyser node for real-time 60fps dynamic waveform visualizer
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.85;

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);

    // Connect graph: nodes -> masterGain -> dynamicsCompressor -> analyser -> destination
    this.masterGain.connect(this.dynamicsCompressor);
    this.dynamicsCompressor.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.isInitialized = true;
  }

  async resume() {
    if (!this.ctx) await this.init();
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  setMasterVolume(val, smoothDuration = 0.05) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    if (this.isPlaying && this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(this.masterVolume, now + smoothDuration);
    }
  }

  fadeIn(targetVolume = this.masterVolume, durationSeconds = 2.5) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0.001, now);
    this.masterGain.gain.exponentialRampToValueAtTime(Math.max(0.001, targetVolume), now + durationSeconds);
    this.isPlaying = true;
  }

  fadeOut(durationSeconds = 2.0, onComplete = null) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const currentGain = this.masterGain.gain.value;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(Math.max(0.001, currentGain), now);
    this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);
    
    setTimeout(() => {
      if (this.masterGain) {
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
      this.isPlaying = false;
      if (onComplete) onComplete();
    }, durationSeconds * 1000);
  }

  getWaveformData() {
    if (!this.analyser) return new Uint8Array(512);
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  getFrequencyData() {
    if (!this.analyser) return new Uint8Array(256);
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }
}

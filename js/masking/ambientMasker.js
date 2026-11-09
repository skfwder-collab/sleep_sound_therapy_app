/**
 * Ambient Noise Masking Service
 * Monitors room noise decibel levels via microphone and dynamically synthesizes
 * adaptive noise masking (pink/brown noise swells) to neutralize sleep-disturbing spikes.
 */
export class AmbientMasker {
  constructor(audioEngine, noiseGen) {
    this.audioEngine = audioEngine;
    this.noiseGen = noiseGen;
    this.isEnabled = false;
    this.isListening = false;
    this.thresholdDb = 45; // Decibel sensitivity threshold (30 - 75 dB)
    this.stream = null;
    this.micContext = null;
    this.micAnalyser = null;
    this.currentDb = 28;
    this.rafId = null;
    this.isMaskingActive = false;
    this.disruptionCount = 0;
    this.listeners = new Set();
    this.simulationTimer = null;
  }

  async startListening() {
    this.isEnabled = true;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        });
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.micContext = new AudioContextClass();
        const micSource = this.micContext.createMediaStreamSource(this.stream);
        this.micAnalyser = this.micContext.createAnalyser();
        this.micAnalyser.fftSize = 512;
        micSource.connect(this.micAnalyser);

        this.isListening = true;
        this._analyzeLoop();
        this.notify({ type: 'status', listening: true, mode: 'live_mic' });
        return true;
      } else {
        throw new Error('getUserMedia not supported');
      }
    } catch (err) {
      console.warn('Microphone access unavailable or denied. Starting fallback simulation mode.', err);
      this._startSimulatedMonitoring();
      return false;
    }
  }

  stopListening() {
    this.isEnabled = false;
    this.isListening = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.simulationTimer) clearInterval(this.simulationTimer);

    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.micContext && this.micContext.state !== 'closed') {
      this.micContext.close();
    }
    this.notify({ type: 'status', listening: false });
  }

  setSensitivityThreshold(db) {
    this.thresholdDb = Math.max(25, Math.min(80, db));
    this.notify({ type: 'threshold_change', threshold: this.thresholdDb });
  }

  _analyzeLoop() {
    if (!this.isListening || !this.micAnalyser) return;

    const data = new Uint8Array(this.micAnalyser.frequencyBinCount);
    this.micAnalyser.getByteTimeDomainData(data);

    // Compute RMS amplitude
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const val = (data[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / data.length);
    // Convert RMS to estimated ambient dBSPL (calibrated scale 20dB - 90dB)
    const rawDb = 20 * Math.log10(Math.max(0.0001, rms)) + 85;
    this.currentDb = Math.round(Math.max(20, Math.min(95, rawDb)));

    this._checkThresholdAndReact();
    this.notify({ type: 'level', db: this.currentDb });

    this.rafId = requestAnimationFrame(() => this._analyzeLoop());
  }

  _startSimulatedMonitoring() {
    this.isListening = true;
    this.notify({ type: 'status', listening: true, mode: 'simulated' });

    this.simulationTimer = setInterval(() => {
      // Ambient room baseline ~28-34 dB, with random intermittent spikes
      const spikeChance = Math.random();
      if (spikeChance < 0.08) {
        // Sudden noise spike (e.g. passing car, slamming door)
        this.currentDb = Math.round(52 + Math.random() * 20);
      } else {
        this.currentDb = Math.round(28 + Math.random() * 6);
      }

      this._checkThresholdAndReact();
      this.notify({ type: 'level', db: this.currentDb });
    }, 400);
  }

  _checkThresholdAndReact() {
    if (this.currentDb > this.thresholdDb) {
      if (!this.isMaskingActive) {
        this.isMaskingActive = true;
        this.disruptionCount++;
        // Boost pink/brown noise to veil and mask the acoustic disturbance
        if (this.noiseGen && this.noiseGen.isPlaying) {
          this.noiseGen.boostMasking(1.45, 0.25);
        }
        this.notify({
          type: 'spike_detected',
          db: this.currentDb,
          threshold: this.thresholdDb,
          count: this.disruptionCount
        });
      }
    } else {
      if (this.isMaskingActive) {
        this.isMaskingActive = false;
        if (this.noiseGen && this.noiseGen.isPlaying) {
          this.noiseGen.resetMasking(2.0);
        }
        this.notify({ type: 'spike_resolved' });
      }
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(data) {
    for (const listener of this.listeners) {
      listener(data);
    }
  }
}

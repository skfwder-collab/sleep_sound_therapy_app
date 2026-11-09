/**
 * Real-Time Biometric & Audio Dynamic Waveform Visualizer
 * Renders smooth fluid organic waveforms modulated by audio frequency and live heart rate pulses.
 */
export class WaveformVisualizer {
  constructor(canvas, audioEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audioEngine = audioEngine;
    this.rafId = null;
    this.phase = 0;
    this.pulsePhase = 0;
    this.currentBpm = 64;
    this.sleepStage = 'Light';
    this.dpr = window.devicePixelRatio || 1;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
    this.width = rect.width;
    this.height = rect.height;
  }

  setBiometrics(bpm, stage) {
    this.currentBpm = bpm || 64;
    this.sleepStage = stage || 'Light';
  }

  start() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    const loop = () => {
      this.draw();
      this.rafId = requestAnimationFrame(loop);
    };
    loop();
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const midY = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Increment heart rate pulse phase
    const pulseSpeed = (this.currentBpm / 60) * 0.045;
    this.pulsePhase += pulseSpeed;
    this.phase += 0.025;

    // Heartbeat expansion factor
    const heartPulse = Math.sin(this.pulsePhase * Math.PI * 2);
    const pulseFactor = heartPulse > 0.4 ? 1 + (heartPulse - 0.4) * 0.35 : 1.0;

    // Retrieve audio time-domain data if playing
    const audioData = this.audioEngine && this.audioEngine.isPlaying 
      ? this.audioEngine.getWaveformData() 
      : null;

    // Stage-specific wave colors
    let strokeColor1 = '#6366f1';
    let strokeColor2 = '#8b5cf6';
    let strokeColor3 = '#06b6d4';

    if (this.sleepStage === 'Deep') {
      strokeColor1 = '#312e81';
      strokeColor2 = '#4338ca';
      strokeColor3 = '#6366f1';
    } else if (this.sleepStage === 'REM') {
      strokeColor1 = '#8b5cf6';
      strokeColor2 = '#a855f7';
      strokeColor3 = '#ec4899';
    }

    // Draw glowing multi-layer waves
    this._renderWave(ctx, w, midY, 38 * pulseFactor, 0.014, this.phase, strokeColor1, 2.5, 0.4, audioData);
    this._renderWave(ctx, w, midY, 26 * pulseFactor, 0.022, this.phase * 1.3 + 1, strokeColor2, 3.5, 0.75, audioData);
    this._renderWave(ctx, w, midY, 18 * pulseFactor, 0.030, this.phase * 0.8 + 2.5, strokeColor3, 2.0, 0.9, audioData);

    // Center subtle biometric pulse ring
    if (heartPulse > 0.6) {
      const ringRadius = 24 + (heartPulse - 0.6) * 45;
      const ringAlpha = (1 - (heartPulse - 0.6) / 0.4) * 0.25;
      ctx.beginPath();
      ctx.arc(w / 2, midY, ringRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(6, 182, 212, ${ringAlpha})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  _renderWave(ctx, w, midY, amplitude, frequency, phaseOffset, strokeColor, lineWidth, opacity, audioData) {
    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = opacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const step = 4;
    for (let x = 0; x <= w; x += step) {
      // Audio modulation factor
      let audioOffset = 0;
      if (audioData && audioData.length > 0) {
        const dataIdx = Math.floor((x / w) * audioData.length);
        const rawAudio = (audioData[dataIdx] - 128) / 128; // -1 to 1
        audioOffset = rawAudio * 24;
      }

      // Taper off wave at edges
      const edgeWeight = Math.sin((x / w) * Math.PI);
      const y = midY + Math.sin(x * frequency + phaseOffset) * amplitude * edgeWeight + (audioOffset * edgeWeight);

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
    ctx.globalAlpha = 1.0;
  }
}

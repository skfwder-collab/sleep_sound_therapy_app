/**
 * Procedural Nature Acoustics Engine
 * Synthesizes organic environmental soundscapes:
 * - Gentle Night Rain
 * - Deep Ocean Swell
 * - Twilight Crickets
 * - Forest Night Wind
 */
export class NatureAudioEngine {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.activeTracks = new Map();
  }

  startTrack(name, volume = 0.5) {
    if (this.activeTracks.has(name)) return;
    const ctx = this.audioEngine.ctx;

    switch (name) {
      case 'rain':
        this.activeTracks.set(name, this._createRain(ctx, volume));
        break;
      case 'ocean':
        this.activeTracks.set(name, this._createOcean(ctx, volume));
        break;
      case 'crickets':
        this.activeTracks.set(name, this._createCrickets(ctx, volume));
        break;
      case 'wind':
        this.activeTracks.set(name, this._createWind(ctx, volume));
        break;
    }
  }

  stopTrack(name) {
    const track = this.activeTracks.get(name);
    if (!track) return;
    const now = this.audioEngine.ctx.currentTime;
    if (track.gainNode) {
      track.gainNode.gain.cancelScheduledValues(now);
      track.gainNode.gain.linearRampToValueAtTime(0.001, now + 0.6);
    }
    setTimeout(() => {
      if (track.cleanup) track.cleanup();
      this.activeTracks.delete(name);
    }, 650);
  }

  setTrackVolume(name, volume) {
    const track = this.activeTracks.get(name);
    if (!track || !track.gainNode) return;
    const now = this.audioEngine.ctx.currentTime;
    track.gainNode.gain.cancelScheduledValues(now);
    track.gainNode.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), now + 0.05);
  }

  stopAll() {
    for (const name of Array.from(this.activeTracks.keys())) {
      this.stopTrack(name);
    }
  }

  // --- Rain Generator: Filtered noise with slight modulation ---
  _createRain(ctx, volume) {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, ctx.currentTime);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.0);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioEngine.masterGain);
    source.start();

    return {
      gainNode,
      cleanup: () => {
        try { source.stop(); source.disconnect(); } catch (e) {}
      }
    };
  }

  // --- Ocean Waves Generator: LFO-modulated lowpass filtered pinkish buffer ---
  _createOcean(ctx, volume) {
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + (0.04 * white)) / 1.04;
      data[i] = last * 2.8;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, ctx.currentTime);

    // LFO to simulate rolling tidal swells
    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.12, ctx.currentTime); // ~8 second wave cycle
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(220, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.2);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioEngine.masterGain);

    source.start();
    lfo.start();

    return {
      gainNode,
      cleanup: () => {
        try {
          source.stop(); source.disconnect();
          lfo.stop(); lfo.disconnect();
        } catch (e) {}
      }
    };
  }

  // --- Night Crickets: Pulsed high-frequency bandpass chirps ---
  _createCrickets(ctx, volume) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(4500, ctx.currentTime);

    const pulseGain = ctx.createGain();
    pulseGain.gain.setValueAtTime(0, ctx.currentTime);

    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(14, ctx.currentTime); // Quick chirp flutter
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(0.5, ctx.currentTime);

    lfo.connect(lfoGain);
    lfoGain.connect(pulseGain.gain);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume * 0.4, ctx.currentTime + 1.0);

    osc.connect(pulseGain);
    pulseGain.connect(gainNode);
    gainNode.connect(this.audioEngine.masterGain);

    osc.start();
    lfo.start();

    return {
      gainNode,
      cleanup: () => {
        try {
          osc.stop(); osc.disconnect();
          lfo.stop(); lfo.disconnect();
        } catch (e) {}
      }
    };
  }

  // --- Night Wind: Low resonant frequency swept bandpass ---
  _createWind(ctx, volume) {
    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      last = (last + (0.02 * (Math.random() * 2 - 1))) / 1.02;
      data[i] = last * 3.5;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(2.5, ctx.currentTime);
    filter.frequency.setValueAtTime(280, ctx.currentTime);

    const lfo = ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.08, ctx.currentTime); // Slow drifting gust
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(180, ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.2);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.audioEngine.masterGain);

    source.start();
    lfo.start();

    return {
      gainNode,
      cleanup: () => {
        try {
          source.stop(); source.disconnect();
          lfo.stop(); lfo.disconnect();
        } catch (e) {}
      }
    };
  }
}

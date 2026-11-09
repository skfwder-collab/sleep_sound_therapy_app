/**
 * Multi-Track Mixer Service
 * Manages layer routing, individual track faders, mute/solo states, and soundscape presets.
 */
export class MixerService {
  constructor(audioEngine, binauralGen, noiseGen, natureGen, isochronicGen) {
    this.audioEngine = audioEngine;
    this.binauralGen = binauralGen;
    this.noiseGen = noiseGen;
    this.natureGen = natureGen;
    this.isochronicGen = isochronicGen;

    this.tracks = {
      binaural: { name: 'Binaural Delta', type: 'binaural', volume: 0.65, muted: false, active: true },
      noise:    { name: 'Pink Noise',     type: 'noise',    volume: 0.50, muted: false, active: true },
      nature:   { name: 'Night Rain',     type: 'nature',   volume: 0.40, muted: false, active: true, subtype: 'rain' },
      isochronic: { name: 'Isochronic Pulses', type: 'isochronic', volume: 0.20, muted: true, active: false }
    };

    this.presets = {
      'deep-delta': {
        name: 'Deep Delta Sleep',
        desc: '2.5Hz Binaural + Pink Noise + Gentle Rain',
        binaural: { active: true, freq: 2.5, vol: 0.7 },
        noise: { active: true, type: 'pink', vol: 0.5 },
        nature: { active: true, type: 'rain', vol: 0.45 },
        isochronic: { active: false, vol: 0 }
      },
      'ocean-theta': {
        name: 'Theta Dream Waves',
        desc: '5.5Hz Theta Waves + Ocean Swells',
        binaural: { active: true, freq: 5.5, vol: 0.65 },
        noise: { active: false, vol: 0 },
        nature: { active: true, type: 'ocean', vol: 0.6 },
        isochronic: { active: false, vol: 0 }
      },
      'brown-masking': {
        name: 'Acoustic Fort Masking',
        desc: 'Deep Brown Noise + Forest Wind',
        binaural: { active: false, vol: 0 },
        noise: { active: true, type: 'brown', vol: 0.75 },
        nature: { active: true, type: 'wind', vol: 0.35 },
        isochronic: { active: false, vol: 0 }
      },
      'restorative-pulse': {
        name: 'Isochronic Cellular Reset',
        desc: '3.0Hz Isochronic Tone + Night Crickets',
        binaural: { active: false, vol: 0 },
        noise: { active: true, type: 'pink', vol: 0.3 },
        nature: { active: true, type: 'crickets', vol: 0.4 },
        isochronic: { active: true, rate: 3.0, vol: 0.55 }
      }
    };

    this.currentPresetKey = 'deep-delta';
  }

  applyPreset(key) {
    const p = this.presets[key];
    if (!p) return;
    this.currentPresetKey = key;

    // Apply Binaural
    if (p.binaural && p.binaural.active) {
      this.tracks.binaural.active = true;
      this.tracks.binaural.volume = p.binaural.vol;
      this.tracks.binaural.muted = false;
      this.binauralGen.setBeatFrequency(p.binaural.freq);
      this.binauralGen.setVolume(p.binaural.vol);
      if (this.audioEngine.isPlaying) this.binauralGen.start();
    } else {
      this.tracks.binaural.active = false;
      this.binauralGen.stop();
    }

    // Apply Noise
    if (p.noise && p.noise.active) {
      this.tracks.noise.active = true;
      this.tracks.noise.volume = p.noise.vol;
      this.tracks.noise.muted = false;
      this.noiseGen.setVolume(p.noise.vol);
      if (this.audioEngine.isPlaying) this.noiseGen.start(p.noise.type);
    } else {
      this.tracks.noise.active = false;
      this.noiseGen.stop();
    }

    // Apply Nature
    this.natureGen.stopAll();
    if (p.nature && p.nature.active) {
      this.tracks.nature.active = true;
      this.tracks.nature.volume = p.nature.vol;
      this.tracks.nature.subtype = p.nature.type;
      this.tracks.nature.muted = false;
      if (this.audioEngine.isPlaying) {
        this.natureGen.startTrack(p.nature.type, p.nature.vol);
      }
    } else {
      this.tracks.nature.active = false;
    }

    // Apply Isochronic
    if (p.isochronic && p.isochronic.active) {
      this.tracks.isochronic.active = true;
      this.tracks.isochronic.volume = p.isochronic.vol;
      this.tracks.isochronic.muted = false;
      this.isochronicGen.setPulseRate(p.isochronic.rate || 3.0);
      this.isochronicGen.setVolume(p.isochronic.vol);
      if (this.audioEngine.isPlaying) this.isochronicGen.start();
    } else {
      this.tracks.isochronic.active = false;
      this.isochronicGen.stop();
    }
  }

  startAllActiveTracks() {
    if (this.tracks.binaural.active && !this.tracks.binaural.muted) {
      this.binauralGen.start();
    }
    if (this.tracks.noise.active && !this.tracks.noise.muted) {
      this.noiseGen.start();
    }
    if (this.tracks.nature.active && !this.tracks.nature.muted && this.tracks.nature.subtype) {
      this.natureGen.startTrack(this.tracks.nature.subtype, this.tracks.nature.volume);
    }
    if (this.tracks.isochronic.active && !this.tracks.isochronic.muted) {
      this.isochronicGen.start();
    }
  }

  stopAllTracks() {
    this.binauralGen.stop();
    this.noiseGen.stop();
    this.natureGen.stopAll();
    this.isochronicGen.stop();
  }

  setTrackVolume(trackKey, volume) {
    if (!this.tracks[trackKey]) return;
    this.tracks[trackKey].volume = volume;
    if (this.tracks[trackKey].muted) return;

    switch (trackKey) {
      case 'binaural':
        this.binauralGen.setVolume(volume);
        break;
      case 'noise':
        this.noiseGen.setVolume(volume);
        break;
      case 'nature':
        if (this.tracks.nature.subtype) {
          this.natureGen.setTrackVolume(this.tracks.nature.subtype, volume);
        }
        break;
      case 'isochronic':
        this.isochronicGen.setVolume(volume);
        break;
    }
  }

  toggleTrackMute(trackKey) {
    if (!this.tracks[trackKey]) return false;
    const track = this.tracks[trackKey];
    track.muted = !track.muted;
    const effectiveVol = track.muted ? 0 : track.volume;

    switch (trackKey) {
      case 'binaural':
        this.binauralGen.setVolume(effectiveVol);
        break;
      case 'noise':
        this.noiseGen.setVolume(effectiveVol);
        break;
      case 'nature':
        if (track.subtype) this.natureGen.setTrackVolume(track.subtype, effectiveVol);
        break;
      case 'isochronic':
        this.isochronicGen.setVolume(effectiveVol);
        break;
    }

    return track.muted;
  }
}

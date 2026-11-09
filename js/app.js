/**
 * SomnaWave Application Controller
 * Coordinates audio synthesis, biometric streams, ambient masking, visualizers, and UI state.
 */
import { AudioEngine } from './audio/audioEngine.js';
import { BinauralGenerator } from './audio/binaural.js';
import { NoiseGenerator } from './audio/noiseGen.js';
import { IsochronicGenerator } from './audio/isochronic.js';
import { NatureAudioEngine } from './audio/nature.js';
import { WearableService } from './biometrics/wearableService.js';
import { BiometricSimulator } from './biometrics/bioSimulator.js';
import { AmbientMasker } from './masking/ambientMasker.js';
import { WaveformVisualizer } from './visualizers/waveform.js';
import { AnalyticsCharts } from './visualizers/analyticsCharts.js';
import { SleepEngine } from './analytics/sleepEngine.js';
import { MixerService } from './mixer/mixerService.js';

class SomnaWaveApp {
  constructor() {
    // 1. Audio Engines
    this.audioEngine = new AudioEngine();
    this.binauralGen = new BinauralGenerator(this.audioEngine);
    this.noiseGen = new NoiseGenerator(this.audioEngine);
    this.isochronicGen = new IsochronicGenerator(this.audioEngine);
    this.natureGen = new NatureAudioEngine(this.audioEngine);

    // 2. Multi-Track Mixer & Presets
    this.mixer = new MixerService(
      this.audioEngine,
      this.binauralGen,
      this.noiseGen,
      this.natureGen,
      this.isochronicGen
    );

    // 3. Biometrics & Wearable
    this.wearableService = new WearableService();
    this.bioSimulator = new BiometricSimulator();

    // 4. Ambient Masker
    this.ambientMasker = new AmbientMasker(this.audioEngine, this.noiseGen);

    // 5. Analytics & Charts
    this.sleepEngine = new SleepEngine();
    this.analyticsCharts = new AnalyticsCharts();

    // 6. Timer State
    this.sleepTimerMode = 'auto'; // 'auto' | 15 | 30 | 45
    this.sleepTimerInterval = null;
    this.timerSecondsRemaining = 0;

    // 7. Visualizer
    this.waveformVisualizer = null;
  }

  async init() {
    this._bindNavigation();
    this._bindPlaybackControls();
    this._bindSoundscapeSelector();
    this._bindTimerControls();
    this._bindMixerControls();
    this._bindSettingsAndWearable();
    this._bindAmbientMasking();

    // Initialize Waveform Canvas
    const canvas = document.getElementById('waveformCanvas');
    if (canvas) {
      this.waveformVisualizer = new WaveformVisualizer(canvas, this.audioEngine);
      this.waveformVisualizer.start();
    }

    // Subscribe to Biometric Simulator
    this.bioSimulator.subscribe((event) => this.handleBiometricEvent(event));
    this.bioSimulator.start();

    // Subscribe to Ambient Masker events
    this.ambientMasker.subscribe((event) => this.handleAmbientMaskerEvent(event));

    // Render Initial Analytics
    this.renderAnalyticsDashboard();

    // Register Service Worker
    this._registerServiceWorker();

    // Apply default preset
    this.mixer.applyPreset('deep-delta');
  }

  // --- TAB NAVIGATION ---
  _bindNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    const screens = document.querySelectorAll('.screen');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-target');
        tabs.forEach((t) => t.classList.remove('active'));
        screens.forEach((s) => s.classList.remove('active'));

        tab.classList.add('active');
        const activeScreen = document.getElementById(targetId);
        if (activeScreen) {
          activeScreen.classList.add('active');
          if (targetId === 'screenAnalytics') {
            this.renderAnalyticsDashboard();
          }
          if (targetId === 'screenPlayer' && this.waveformVisualizer) {
            this.waveformVisualizer.resize();
          }
        }
      });
    });
  }

  // --- PLAYBACK CONTROLS ---
  _bindPlaybackControls() {
    const mainPlayBtn = document.getElementById('mainPlayBtn');
    const volumeSlider = document.getElementById('masterVolumeSlider');
    const volumeVal = document.getElementById('masterVolumeVal');

    mainPlayBtn.addEventListener('click', async () => {
      await this.audioEngine.resume();

      if (this.audioEngine.isPlaying) {
        this.audioEngine.fadeOut(1.5, () => {
          this.mixer.stopAllTracks();
          this._updatePlayButtonUI(false);
        });
      } else {
        this.mixer.startAllActiveTracks();
        this.audioEngine.fadeIn(this.audioEngine.masterVolume, 2.0);
        this._updatePlayButtonUI(true);

        // Start ambient noise masking if enabled
        const maskToggle = document.getElementById('ambientMaskingToggle');
        if (maskToggle && maskToggle.checked && !this.ambientMasker.isListening) {
          this.ambientMasker.startListening();
        }
      }
    });

    volumeSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      volumeVal.textContent = `${val}%`;
      this.audioEngine.setMasterVolume(val / 100);
    });
  }

  _updatePlayButtonUI(isPlaying) {
    const mainPlayBtn = document.getElementById('mainPlayBtn');
    const playIconSvg = document.getElementById('playIconSvg');

    if (isPlaying) {
      mainPlayBtn.classList.add('playing');
      playIconSvg.innerHTML = `
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      `;
    } else {
      mainPlayBtn.classList.remove('playing');
      playIconSvg.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"></polygon>`;
    }
  }

  // --- SOUNDSCAPE SELECTOR CHIPS ---
  _bindSoundscapeSelector() {
    const chips = document.querySelectorAll('.preset-chip');
    const badgeText = document.getElementById('waveformModeText');

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const presetKey = chip.getAttribute('data-preset');
        this.mixer.applyPreset(presetKey);

        const descriptions = {
          'deep-delta': 'Delta 2.5 Hz (Deep Sleep)',
          'ocean-theta': 'Theta 5.5 Hz (Dream Flow)',
          'brown-masking': 'Acoustic Fort Masking (Brown Noise)',
          'restorative-pulse': 'Isochronic 3.0 Hz (Cellular Reset)'
        };
        badgeText.textContent = descriptions[presetKey] || 'Custom Soundscape';
        this._syncMixerUIFromState();
      });
    });
  }

  // --- TIMER CONTROLS ---
  _bindTimerControls() {
    const pills = document.querySelectorAll('.timer-pill');
    const timerDisplay = document.getElementById('timerDisplay');

    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        pills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');

        const mode = pill.getAttribute('data-timer');
        this.sleepTimerMode = mode;

        if (this.sleepTimerInterval) {
          clearInterval(this.sleepTimerInterval);
          this.sleepTimerInterval = null;
        }

        if (mode === 'auto') {
          timerDisplay.textContent = 'Auto (Deep Sleep)';
        } else {
          const minutes = parseInt(mode, 10);
          this.timerSecondsRemaining = minutes * 60;
          timerDisplay.textContent = `${minutes}:00`;

          this.sleepTimerInterval = setInterval(() => {
            this.timerSecondsRemaining--;
            if (this.timerSecondsRemaining <= 0) {
              clearInterval(this.sleepTimerInterval);
              this.sleepTimerInterval = null;
              timerDisplay.textContent = 'Finished';
              this._triggerAutoFadeOut('Timer finished');
            } else {
              const m = Math.floor(this.timerSecondsRemaining / 60);
              const s = this.timerSecondsRemaining % 60;
              timerDisplay.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
            }
          }, 1000);
        }
      });
    });
  }

  _triggerAutoFadeOut(reason) {
    if (this.audioEngine.isPlaying) {
      console.log(`Auto-Off activated: ${reason}`);
      this.audioEngine.fadeOut(3.5, () => {
        this.mixer.stopAllTracks();
        this._updatePlayButtonUI(false);
      });
    }
  }

  // --- MULTI-TRACK MIXER CONTROLS ---
  _bindMixerControls() {
    // Sliders
    const layers = ['binaural', 'noise', 'nature', 'isochronic'];
    layers.forEach((layer) => {
      const slider = document.getElementById(`vol${layer.charAt(0).toUpperCase() + layer.slice(1)}Slider`);
      const valText = document.getElementById(`vol${layer.charAt(0).toUpperCase() + layer.slice(1)}Val`);
      const muteBtn = document.getElementById(`mute${layer.charAt(0).toUpperCase() + layer.slice(1)}Btn`);

      if (slider) {
        slider.addEventListener('input', (e) => {
          const val = parseInt(e.target.value, 10);
          valText.textContent = `${val}%`;
          this.mixer.setTrackVolume(layer, val / 100);
        });
      }

      if (muteBtn) {
        muteBtn.addEventListener('click', () => {
          const isMuted = this.mixer.toggleTrackMute(layer);
          muteBtn.classList.toggle('muted', isMuted);
          muteBtn.textContent = isMuted ? 'MUTED' : 'MUTE';
        });
      }
    });

    // Category filter tabs
    const catBtns = document.querySelectorAll('.cat-btn');
    const tracks = document.querySelectorAll('.mixer-track');

    catBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        catBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const cat = btn.getAttribute('data-cat');

        tracks.forEach((track) => {
          const layerType = track.getAttribute('data-layer');
          if (cat === 'all' || cat === layerType) {
            track.style.display = 'flex';
          } else {
            track.style.display = 'none';
          }
        });
      });
    });
  }

  _syncMixerUIFromState() {
    const layers = ['binaural', 'noise', 'nature', 'isochronic'];
    layers.forEach((layer) => {
      const track = this.mixer.tracks[layer];
      const slider = document.getElementById(`vol${layer.charAt(0).toUpperCase() + layer.slice(1)}Slider`);
      const valText = document.getElementById(`vol${layer.charAt(0).toUpperCase() + layer.slice(1)}Val`);
      const muteBtn = document.getElementById(`mute${layer.charAt(0).toUpperCase() + layer.slice(1)}Btn`);
      const trackElem = document.querySelector(`.mixer-track[data-layer="${layer}"]`);

      if (slider && track) {
        const pct = Math.round(track.volume * 100);
        slider.value = pct;
        valText.textContent = `${pct}%`;
      }
      if (muteBtn && track) {
        muteBtn.classList.toggle('muted', track.muted);
        muteBtn.textContent = track.muted ? 'MUTED' : 'MUTE';
      }
      if (trackElem && track) {
        trackElem.classList.toggle('active-track', track.active);
      }
    });
  }

  // --- SETTINGS, WEARABLE & BLE ---
  _bindSettingsAndWearable() {
    // BLE Connect
    const btnScanBle = document.getElementById('btnScanBle');
    btnScanBle.addEventListener('click', async () => {
      try {
        btnScanBle.textContent = 'Scanning...';
        const info = await this.wearableService.connect();
        btnScanBle.textContent = 'Connected';
        document.getElementById('wearableSyncBadge').textContent = 'BLE Connected';
        document.getElementById('playerDeviceName').textContent = info.name;
        this.bioSimulator.stop(); // Pause simulator when real hardware connects
      } catch (err) {
        btnScanBle.textContent = 'Scan BLE';
        alert('Web Bluetooth pairing: ' + (err.message || 'No device chosen or Bluetooth unsupported'));
      }
    });

    // Device Picker Cards
    const deviceCards = document.querySelectorAll('.device-card');
    deviceCards.forEach((card) => {
      card.addEventListener('click', () => {
        deviceCards.forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        const device = card.getAttribute('data-device');
        this.bioSimulator.setDevice(device);
        document.getElementById('playerDeviceName').textContent = this.bioSimulator.getDeviceDetails().name;
      });
    });

    // Stage simulation shortcuts
    document.getElementById('btnSimulateDeepSleep').addEventListener('click', () => {
      this.bioSimulator.forceSleepStage('Deep');
    });

    document.getElementById('btnSimulateAwake').addEventListener('click', () => {
      this.bioSimulator.forceSleepStage('Awake');
    });

    // Export Data JSON
    document.getElementById('btnExportData').addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.sleepEngine.currentSession, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `somnawave_sleep_log_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });

    // Circadian OLED Pure Black Toggle
    const pureBlackToggle = document.getElementById('pureBlackToggle');
    pureBlackToggle.addEventListener('change', (e) => {
      document.documentElement.style.setProperty('--bg-void', e.target.checked ? '#05050A' : '#0B0F19');
    });
  }

  // --- AMBIENT NOISE MASKING ---
  _bindAmbientMasking() {
    const toggle = document.getElementById('ambientMaskingToggle');
    const sensitivitySlider = document.getElementById('ambientSensitivitySlider');
    const thresholdMarker = document.getElementById('thresholdMarker');
    const thresholdDbText = document.getElementById('thresholdDbText');

    toggle.addEventListener('change', async (e) => {
      if (e.target.checked) {
        if (this.audioEngine.isPlaying) {
          await this.ambientMasker.startListening();
        }
      } else {
        this.ambientMasker.stopListening();
      }
    });

    sensitivitySlider.addEventListener('input', (e) => {
      const db = parseInt(e.target.value, 10);
      thresholdDbText.textContent = `${db} dB`;
      this.ambientMasker.setSensitivityThreshold(db);
      // Map 20-90 dB to percentage position
      const pct = Math.max(0, Math.min(100, ((db - 20) / 70) * 100));
      thresholdMarker.style.left = `${pct}%`;
    });
  }

  handleAmbientMaskerEvent(event) {
    if (event.type === 'level') {
      const bar = document.getElementById('decibelLevelBar');
      const text = document.getElementById('currentDbText');
      if (bar) {
        const pct = Math.max(0, Math.min(100, ((event.db - 20) / 70) * 100));
        bar.style.width = `${pct}%`;
      }
      if (text) {
        text.textContent = `${event.db} dB`;
      }
    } else if (event.type === 'spike_detected') {
      const alertBadge = document.getElementById('waveformAmbientAlert');
      if (alertBadge) {
        alertBadge.style.display = 'block';
        alertBadge.textContent = `🛡️ Noise Spike (${event.db} dB) Masked`;
      }
    } else if (event.type === 'spike_resolved') {
      const alertBadge = document.getElementById('waveformAmbientAlert');
      if (alertBadge) {
        setTimeout(() => {
          alertBadge.style.display = 'none';
        }, 1200);
      }
    }
  }

  // --- BIOMETRIC STREAM DISPATCHER ---
  handleBiometricEvent(event) {
    if (event.type === 'biometrics') {
      const bpm = event.heartRate;
      const hrv = event.hrv;
      const stage = event.sleepStage;

      // Update Header Pill
      document.getElementById('headerBpmText').textContent = `${bpm} BPM`;
      const stageBadge = document.getElementById('headerStageBadge');
      stageBadge.textContent = stage;
      stageBadge.className = `badge badge-${stage.toLowerCase()}`;

      // Update Screen 1 Player HUD
      document.getElementById('playerBpmVal').innerHTML = `${bpm} <small>BPM</small>`;
      document.getElementById('playerHrvVal').innerHTML = `${hrv} <small>ms</small>`;
      document.getElementById('playerStageVal').textContent = stage;

      // Update Waveform Visualizer
      if (this.waveformVisualizer) {
        this.waveformVisualizer.setBiometrics(bpm, stage);
      }
    } else if (event.type === 'deep_sleep_detected') {
      // Trigger auto-off timer if set to "Auto"
      if (this.sleepTimerMode === 'auto' && this.audioEngine.isPlaying) {
        const timerDisplay = document.getElementById('timerDisplay');
        timerDisplay.textContent = 'Auto-Off (Deep Sleep)';
        this._triggerAutoFadeOut('Deep Sleep State Confirmed');
      }
    }
  }

  // --- RENDER ANALYTICS DASHBOARD ---
  renderAnalyticsDashboard() {
    const session = this.sleepEngine.currentSession;
    const scoreCanvas = document.getElementById('sleepScoreCanvas');
    const hypnogramCanvas = document.getElementById('hypnogramCanvas');
    const hrvChartCanvas = document.getElementById('hrvChartCanvas');

    // Update Scores & Metrics
    document.getElementById('analyticsScoreNumber').textContent = session.score;
    document.getElementById('analyticsScoreLabel').textContent = session.score >= 85 ? 'Optimal Rest' : 'Fair Recovery';
    document.getElementById('analyticsTotalDuration').textContent = `${Math.floor(session.totalMinutes / 60)}h ${session.totalMinutes % 60}m`;
    document.getElementById('analyticsDeepDuration').textContent = `${Math.floor(session.deepMinutes / 60)}h ${session.deepMinutes % 60}m (${Math.round((session.deepMinutes / session.totalMinutes) * 100)}%)`;
    document.getElementById('analyticsHrvValue').textContent = `${session.averageHrv} ms`;

    // Render Canvas Visualizations
    this.analyticsCharts.renderScoreGauge(scoreCanvas, session.score);
    this.analyticsCharts.renderHypnogram(hypnogramCanvas);
    this.analyticsCharts.renderHrvTrend(hrvChartCanvas);

    // Populate Personalized Hygiene Insights
    const container = document.getElementById('insightsContainer');
    if (container) {
      container.innerHTML = '';
      const insights = this.sleepEngine.getHygieneInsights(session);
      insights.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'insight-card';
        div.innerHTML = `
          <div class="insight-icon ${item.type}">
            ${item.icon}
          </div>
          <div class="insight-content">
            <h4>${item.title}</h4>
            <p>${item.description}</p>
          </div>
        `;
        container.appendChild(div);
      });
    }
  }

  _registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
          console.log('SW registration note:', err.message);
        });
      });
    }
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new SomnaWaveApp();
  app.init();
  window.somnaWave = app; // Expose for testing & inspection
});

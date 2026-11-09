/**
 * Smart Biometric Simulator
 * Simulates high-fidelity biometric streams from Apple Watch, Garmin, or Fitbit.
 * Models circadian relaxation: Heart rate drops, HRV increases, and transitions into Deep Sleep.
 */
export class BiometricSimulator {
  constructor() {
    this.deviceType = 'apple-watch'; // 'apple-watch' | 'garmin' | 'fitbit'
    this.isActive = true;
    this.timer = null;
    this.listeners = new Set();

    // Physiological state
    this.state = {
      heartRate: 68,
      hrv: 48,          // rMSSD in ms
      stressLevel: 38,  // 0-100
      motionIndex: 12,  // Accelerometer/gyro (0-100)
      sleepStage: 'Awake', // Awake, Light, Deep, REM
      deepSleepSeconds: 0,
      timestamp: Date.now()
    };
  }

  setDevice(type) {
    this.deviceType = type;
    this.notify({ type: 'device_change', device: this.getDeviceDetails() });
  }

  getDeviceDetails() {
    switch (this.deviceType) {
      case 'garmin':
        return { name: 'Garmin Forerunner 965', brand: 'Garmin', icon: '⌚' };
      case 'fitbit':
        return { name: 'Fitbit Sense 2', brand: 'Fitbit', icon: '🔋' };
      case 'apple-watch':
      default:
        return { name: 'Apple Watch Ultra', brand: 'Apple', icon: '' };
    }
  }

  start() {
    if (this.timer) clearInterval(this.timer);
    this.isActive = true;

    // Tick every 1.5 seconds with physiological state evolution
    this.timer = setInterval(() => {
      this.stepBiometrics();
    }, 1500);
  }

  stop() {
    this.isActive = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  stepBiometrics() {
    // Gradually simulate falling asleep:
    // If Awake for some time, transition to Light NREM -> Deep NREM -> REM
    const rand = Math.random();

    if (this.state.sleepStage === 'Awake') {
      if (rand < 0.15) {
        this.state.sleepStage = 'Light';
      }
      this.state.heartRate = Math.max(62, Math.min(76, this.state.heartRate + (Math.random() * 4 - 2.2)));
      this.state.hrv = Math.max(38, Math.min(52, this.state.hrv + (Math.random() * 4 - 1.8)));
      this.state.stressLevel = Math.max(25, Math.min(55, this.state.stressLevel - 0.5));
      this.state.motionIndex = Math.max(5, Math.min(25, this.state.motionIndex + (Math.random() * 6 - 3)));

    } else if (this.state.sleepStage === 'Light') {
      if (rand < 0.12) {
        this.state.sleepStage = 'Deep';
      }
      this.state.heartRate = Math.max(54, Math.min(65, this.state.heartRate - 0.4));
      this.state.hrv = Math.max(48, Math.min(68, this.state.hrv + 0.6));
      this.state.stressLevel = Math.max(15, Math.min(30, this.state.stressLevel - 0.6));
      this.state.motionIndex = Math.max(2, Math.min(10, this.state.motionIndex - 0.3));

    } else if (this.state.sleepStage === 'Deep') {
      this.state.deepSleepSeconds += 1.5;
      this.state.heartRate = Math.max(46, Math.min(56, this.state.heartRate + (Math.random() * 2 - 1)));
      this.state.hrv = Math.max(65, Math.min(92, this.state.hrv + (Math.random() * 3 - 1.2)));
      this.state.stressLevel = Math.max(8, Math.min(18, this.state.stressLevel - 0.2));
      this.state.motionIndex = Math.max(0, Math.min(3, Math.random() * 2));

      // Trigger auto-sleep timer cutoff event when deep sleep is firmly established (after ~6 seconds in simulation)
      if (this.state.deepSleepSeconds >= 6) {
        this.notify({ type: 'deep_sleep_detected', message: 'Deep sleep state detected by wearable' });
      }

      if (rand < 0.05 && this.state.deepSleepSeconds > 15) {
        this.state.sleepStage = 'REM';
      }

    } else if (this.state.sleepStage === 'REM') {
      this.state.heartRate = Math.max(56, Math.min(68, this.state.heartRate + (Math.random() * 4 - 2)));
      this.state.hrv = Math.max(50, Math.min(75, this.state.hrv + (Math.random() * 3 - 1.5)));
      this.state.stressLevel = Math.max(18, Math.min(28, this.state.stressLevel + 0.1));
      this.state.motionIndex = Math.max(1, Math.min(6, Math.random() * 4));

      if (rand < 0.08) {
        this.state.sleepStage = 'Deep';
      }
    }

    this.state.heartRate = Math.round(this.state.heartRate);
    this.state.hrv = Math.round(this.state.hrv);
    this.state.stressLevel = Math.round(this.state.stressLevel);
    this.state.motionIndex = Math.round(this.state.motionIndex);
    this.state.timestamp = Date.now();

    this.notify({
      type: 'biometrics',
      ...this.state,
      device: this.getDeviceDetails(),
      source: 'simulator'
    });
  }

  // Force trigger a specific sleep stage for testing
  forceSleepStage(stage) {
    this.state.sleepStage = stage;
    if (stage === 'Deep') {
      this.state.heartRate = 50;
      this.state.hrv = 82;
      this.state.stressLevel = 10;
      this.state.deepSleepSeconds = 0;
    }
    this.stepBiometrics();
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

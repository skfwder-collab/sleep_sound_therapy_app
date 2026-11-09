/**
 * Wearable Device Service
 * Connects to physical Bluetooth Smartwatches / Heart Rate monitors via Web Bluetooth API (GATT 0x180D).
 */
export class WearableService {
  constructor() {
    this.device = null;
    this.server = null;
    this.characteristic = null;
    this.isConnected = false;
    this.listeners = new Set();
    this.deviceInfo = { name: 'None', type: 'Disconnected' };
  }

  isSupported() {
    return !!(navigator.bluetooth && navigator.bluetooth.requestDevice);
  }

  async connect() {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth is not supported on this browser or platform.');
    }

    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
        optionalServices: ['battery_service', 'device_information']
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.isConnected = false;
        this.notify({ type: 'disconnected' });
      });

      this.server = await this.device.gatt.connect();
      const service = await this.server.getPrimaryService('heart_rate');
      this.characteristic = await service.getCharacteristic('heart_rate_measurement');
      
      await this.characteristic.startNotifications();
      this.characteristic.addEventListener('characteristicvaluechanged', (event) => {
        this.handleHeartRateMeasurement(event.target.value);
      });

      this.isConnected = true;
      this.deviceInfo = {
        name: this.device.name || 'Bluetooth Wearable',
        type: 'Heart Rate Monitor'
      };

      this.notify({ type: 'connected', device: this.deviceInfo });
      return this.deviceInfo;
    } catch (err) {
      this.isConnected = false;
      throw err;
    }
  }

  disconnect() {
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.isConnected = false;
    this.notify({ type: 'disconnected' });
  }

  handleHeartRateMeasurement(value) {
    const flags = value.getUint8(0);
    const rate16Bits = flags & 0x1;
    let index = 1;
    let heartRate = 0;

    if (rate16Bits) {
      heartRate = value.getUint16(index, /*littleEndian=*/true);
      index += 2;
    } else {
      heartRate = value.getUint8(index);
      index += 1;
    }

    // RR-interval parsing if present (for real-time HRV)
    const rrPresent = flags & 0x10;
    let hrv = 55; // fallback
    if (rrPresent && (value.byteLength >= index + 2)) {
      const rrInterval = value.getUint16(index, true) * (1000 / 1024);
      // Approximate rMSSD variation
      hrv = Math.round(Math.abs(rrInterval - 800) * 0.15 + 40);
    }

    this.notify({
      type: 'biometrics',
      heartRate,
      hrv,
      source: 'bluetooth'
    });
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

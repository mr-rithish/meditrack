/**
 * WebSerial API utility for connecting to Arduino-based barcode scanners
 * Works exclusively in Google Chrome (or Chromium-based browsers)
 */

class WebSerialScanner {
  constructor() {
    this.port = null;
    this.reader = null;
    this.isConnected = false;
    this.onScan = null;       // Callback when scan data arrives
    this.onStatus = null;     // Callback for connection status changes
    this.buffer = '';
  }

  /**
   * Check if WebSerial API is supported
   */
  static isSupported() {
    return 'serial' in navigator;
  }

  /**
   * Open the serial port chooser and connect to the Arduino
   */
  async connect() {
    if (!WebSerialScanner.isSupported()) {
      throw new Error('WebSerial API not supported. Please use Google Chrome.');
    }

    try {
      // Prompt user to select the serial port
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 9600 });

      this.isConnected = true;
      this.onStatus?.('connected');

      // Start reading
      this._readLoop();
      return true;
    } catch (err) {
      console.error('WebSerial connect error:', err);
      this.onStatus?.('error');
      return false;
    }
  }

  /**
   * Disconnect from the scanner
   */
  async disconnect() {
    this.isConnected = false;
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader = null;
      }
      if (this.port) {
        await this.port.close();
        this.port = null;
      }
    } catch (err) {
      console.error('Disconnect error:', err);
    }
    this.onStatus?.('disconnected');
  }

  /**
   * Send a command to the Arduino (e.g. "GREEN" or "RED")
   */
  async sendCommand(command) {
    if (!this.port || !this.isConnected) return;

    try {
      const writer = this.port.writable.getWriter();
      const encoder = new TextEncoder();
      await writer.write(encoder.encode(command + '\n'));
      writer.releaseLock();
    } catch (err) {
      console.error('Send command error:', err);
    }
  }

  /**
   * Internal: continuously read from the serial port
   */
  async _readLoop() {
    const decoder = new TextDecoder();

    while (this.port?.readable && this.isConnected) {
      try {
        this.reader = this.port.readable.getReader();

        while (true) {
          const { value, done } = await this.reader.read();
          if (done) break;

          // Accumulate text
          this.buffer += decoder.decode(value);

          // Process complete lines
          let newlineIdx;
          while ((newlineIdx = this.buffer.indexOf('\n')) !== -1) {
            const line = this.buffer.slice(0, newlineIdx).trim();
            this.buffer = this.buffer.slice(newlineIdx + 1);

            if (line.length > 0) {
              this._processLine(line);
            }
          }
        }
      } catch (err) {
        if (this.isConnected) {
          console.error('Read error:', err);
        }
      } finally {
        this.reader?.releaseLock();
        this.reader = null;
      }
    }
  }

  /**
   * Process a line of data from the Arduino
   */
  _processLine(line) {
    try {
      const data = JSON.parse(line);
      if (data.type === 'scan' && data.data) {
        this.onScan?.(data.data);
      } else if (data.type === 'ready') {
        this.onStatus?.('ready');
      } else if (data.type === 'pong') {
        this.onStatus?.('alive');
      }
    } catch {
      // Not JSON — treat as raw scan data
      if (line.length > 3) {
        this.onScan?.(line);
      }
    }
  }
}

export default WebSerialScanner;

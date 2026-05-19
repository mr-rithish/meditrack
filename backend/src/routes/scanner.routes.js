const express = require('express');
const router = express.Router();
const verificationService = require('../services/verificationService');
const qrcodeService = require('../services/qrcodeService');
const { Jimp } = require('jimp');
const jsQR = require('jsqr');

// In-memory store for recent scan results (for pharmacy live feed)
const recentScans = [];
const MAX_RECENT_SCANS = 50;

/**
 * POST /api/scanner/scan — Receive scan from IoT hardware scanner
 * This endpoint accepts data from ESP32/Arduino barcode scanners
 * No auth required (scanner authenticates via device_id)
 */
router.post('/scan', async (req, res, next) => {
  try {
    const { scannedData, deviceId, actorId, actionType } = req.body;

    if (!scannedData) {
      return res.status(400).json({ success: false, message: 'Scanned data is required.' });
    }

    // Parse the scanned data
    const parsed = qrcodeService.parseGS1(scannedData);

    // If it's a box QR
    if (parsed.type === 'BOX') {
      const scanResult = {
        id: Date.now(),
        type: 'BOX',
        boxId: parsed.boxId,
        count: parsed.count,
        deviceId,
        timestamp: new Date(),
        valid: true,
        message: `Box detected: ${parsed.boxId} with ${parsed.count} medicines.`
      };
      recentScans.unshift(scanResult);
      if (recentScans.length > MAX_RECENT_SCANS) recentScans.pop();

      return res.json({
        success: true,
        data: {
          type: 'BOX',
          boxId: parsed.boxId,
          count: parsed.count,
          message: scanResult.message
        }
      });
    }

    // Individual medicine verification
    const serialNumber = parsed.serialNumber || scannedData;
    const result = await verificationService.verifyMedicine(
      serialNumber,
      actorId || null,
      actionType || 'verify',
      'scanner',
      deviceId
    );

    // Store result for live feed
    const scanResult = {
      id: Date.now(),
      type: 'MEDICINE',
      serialNumber,
      deviceId,
      timestamp: new Date(),
      valid: result.valid,
      message: result.message,
      medicine: result.medicine || null,
      signal: result.valid ? 'GREEN' : 'RED'
    };
    recentScans.unshift(scanResult);
    if (recentScans.length > MAX_RECENT_SCANS) recentScans.pop();

    // Return simplified response for hardware scanner (LED/buzzer friendly)
    res.json({
      success: true,
      data: {
        ...result,
        scannerSignal: result.valid ? 'GREEN' : 'RED',
        buzzer: result.valid ? 'SHORT' : 'LONG'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/scanner/recent — Get recent scan results (for pharmacy live feed)
 * Query params: since (timestamp) — only return scans after this time
 */
router.get('/recent', (req, res) => {
  const since = req.query.since ? new Date(parseInt(req.query.since)) : null;
  const scans = since
    ? recentScans.filter(s => new Date(s.timestamp) > since)
    : recentScans.slice(0, 10);

  res.json({ success: true, data: scans });
});

/**
 * POST /api/scanner/register — Register a scanner device
 */
router.post('/register', async (req, res, next) => {
  try {
    const { deviceId, actorId, deviceName } = req.body;

    res.json({
      success: true,
      message: `Scanner ${deviceId} registered for ${actorId}.`,
      data: { deviceId, actorId, deviceName, registeredAt: new Date() }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/scanner/scan-image — Receive JPEG image from ESP32-CAM
 * ESP32 sends raw JPEG bytes, backend decodes QR and verifies
 */
router.post('/scan-image', express.raw({ type: 'image/jpeg', limit: '1mb' }), async (req, res) => {
  try {
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ success: false, message: 'No image data received' });
    }

    const deviceId = req.query.deviceId || 'SCANNER-001';
    console.log(`[Scanner] Received image: ${req.body.length} bytes from ${deviceId}`);

    // Decode JPEG to raw pixels using Jimp
    const image = await Jimp.read(req.body);
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    // Convert to grayscale RGBA data for jsQR
    const imageData = new Uint8ClampedArray(image.bitmap.data);

    // Decode QR code
    const qrResult = jsQR(imageData, width, height);

    if (!qrResult) {
      return res.json({
        success: true,
        data: { found: false, scannerSignal: 'NONE', message: 'No QR code found in image' }
      });
    }

    const scannedData = qrResult.data;
    console.log(`[Scanner] QR decoded: ${scannedData}`);

    // Parse and verify (same logic as /scan endpoint)
    const parsed = qrcodeService.parseGS1(scannedData);
    const serialNumber = parsed.serialNumber || scannedData;

    const result = await verificationService.verifyMedicine(
      serialNumber, null, 'verify', 'scanner', deviceId
    );

    // Store for live feed
    const scanResult = {
      id: Date.now(),
      type: 'MEDICINE',
      serialNumber,
      deviceId,
      timestamp: new Date(),
      valid: result.valid,
      message: result.message,
      medicine: result.medicine || null,
      signal: result.valid ? 'GREEN' : 'RED'
    };
    recentScans.unshift(scanResult);
    if (recentScans.length > MAX_RECENT_SCANS) recentScans.pop();

    res.json({
      success: true,
      data: {
        found: true,
        qrData: scannedData,
        ...result,
        scannerSignal: result.valid ? 'GREEN' : 'RED',
        buzzer: result.valid ? 'SHORT' : 'LONG'
      }
    });
  } catch (error) {
    console.error('[Scanner] Image processing error:', error.message);
    res.status(500).json({ success: false, message: 'Image processing failed' });
  }
});

module.exports = router;

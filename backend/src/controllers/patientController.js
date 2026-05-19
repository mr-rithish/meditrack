const verificationService = require('../services/verificationService');
const qrcodeService = require('../services/qrcodeService');

/**
 * Verify medicine (public endpoint — no auth required)
 */
const verifyMedicine = async (req, res, next) => {
  try {
    const { serialNumber, scannedData } = req.body;

    let serial = serialNumber;
    if (scannedData) {
      const parsed = qrcodeService.parseGS1(scannedData);
      serial = parsed.serialNumber || scannedData;
    }

    if (!serial) {
      return res.status(400).json({ success: false, message: 'Serial number or scanned data required.' });
    }

    const result = await verificationService.verifyMedicine(serial, null, 'verify', 'patient');

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

module.exports = { verifyMedicine };

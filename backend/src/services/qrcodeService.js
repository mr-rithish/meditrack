const QRCode = require('qrcode');

class QRCodeService {

  /**
   * Generate GS1-compliant Data Matrix barcode
   */
  async generateDataMatrix(gtin, serialNumber, expiryDate, batchNumber) {
    // GS1 Application Identifiers
    const gs1Data = `(01)${gtin}(21)${serialNumber}(17)${expiryDate}(10)${batchNumber}`;

    const qrCodeImage = await QRCode.toDataURL(gs1Data, {
      type: 'image/png',
      errorCorrectionLevel: 'H',
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' }
    });

    return { gs1Data, qrCodeImage, serialNumber };
  }

  /**
   * Generate box-level QR code
   */
  async generateBoxQR(boxId, serialNumbers) {
    const boxData = {
      type: 'BOX',
      boxId: boxId,
      count: serialNumbers.length
    };

    const qrCodeImage = await QRCode.toDataURL(JSON.stringify(boxData), {
      errorCorrectionLevel: 'H',
      width: 250
    });

    return { boxId, qrCodeImage, containsSerials: serialNumbers };
  }

  /**
   * Generate QR code as buffer (for PDF)
   */
  async generateQRBuffer(data) {
    return QRCode.toBuffer(data, {
      type: 'png',
      errorCorrectionLevel: 'H',
      width: 200,
      margin: 1
    });
  }

  /**
   * Parse GS1 barcode data from scan
   */
  parseGS1(scannedData) {
    const parsed = {};

    // Try standard GS1 format first
    const gtinMatch = scannedData.match(/\(01\)(\d{14})/);
    if (gtinMatch) parsed.gtin = gtinMatch[1];

    const serialMatch = scannedData.match(/\(21\)([^\(]+)/);
    if (serialMatch) parsed.serialNumber = serialMatch[1].trim();

    const expiryMatch = scannedData.match(/\(17\)(\d{6})/);
    if (expiryMatch) {
      const exp = expiryMatch[1];
      parsed.expiryDate = `20${exp.substring(0,2)}-${exp.substring(2,4)}-${exp.substring(4,6)}`;
    }

    const batchMatch = scannedData.match(/\(10\)([^\(]+)/);
    if (batchMatch) parsed.batchNumber = batchMatch[1].trim();

    // If no GS1 format, try as direct serial number
    if (!parsed.serialNumber && !parsed.gtin) {
      // Check if it looks like a box QR
      try {
        const jsonData = JSON.parse(scannedData);
        if (jsonData.type === 'BOX') {
          return { type: 'BOX', boxId: jsonData.boxId, count: jsonData.count };
        }
      } catch (e) {
        // Not JSON, treat as raw serial number
        parsed.serialNumber = scannedData.trim();
      }
    }

    return parsed;
  }

  /**
   * Format expiry date to YYMMDD for GS1
   */
  formatExpiryForGS1(expiryDate) {
    const d = new Date(expiryDate);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
  }
}

module.exports = new QRCodeService();

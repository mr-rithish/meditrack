const { SerialNumber, Product, Box, BoxContent } = require('../models');
const sequelize = require('../config/database');

class SerializationService {

  /**
   * Generate unique serial numbers for a batch
   */
  async generateSerialNumbers(productId, quantity, batchNumber, manufacturerCode, productCode, manufacturingDate, expiryDate) {
    const serialNumbers = [];
    const year = new Date().getFullYear();

    // Get the last sequence number for this product
    const lastSerial = await this.getLastSequence(productId, year);
    let sequence = lastSerial + 1;

    for (let i = 0; i < quantity; i++) {
      const serialNumber = `${year}-${manufacturerCode}-${productCode}-${String(sequence).padStart(7, '0')}`;

      serialNumbers.push({
        serial_number: serialNumber,
        product_id: productId,
        batch_number: batchNumber,
        manufacturing_date: manufacturingDate,
        expiry_date: expiryDate,
        status: 'manufactured'
      });

      sequence++;
    }

    return serialNumbers;
  }

  /**
   * Generate boxes and map serials to boxes
   */
  async generateBoxes(serialNumbers, batchNumber, productId, manufacturingDate, expiryDate, boxSize = 100) {
    const numBoxes = Math.ceil(serialNumbers.length / boxSize);
    const year = new Date().getFullYear();
    const lastBoxNum = await this.getLastBoxNumber(year);
    let boxNum = lastBoxNum + 1;

    const boxes = [];
    const boxContents = [];

    for (let i = 0; i < numBoxes; i++) {
      const boxId = `BOX-${year}-${String(boxNum).padStart(4, '0')}`;
      const boxQRCode = `BOX-QR-${year}-${String(boxNum).padStart(4, '0')}`;

      boxes.push({
        box_id: boxId,
        product_id: productId,
        batch_number: batchNumber,
        box_qr_code: boxQRCode,
        total_medicines: Math.min(boxSize, serialNumbers.length - (i * boxSize)),
        manufacturing_date: manufacturingDate,
        expiry_date: expiryDate,
        status: 'manufactured',
        seal_code: `SEAL-${boxId}-${Date.now()}`
      });

      // Map serials to this box
      const startIdx = i * boxSize;
      const endIdx = Math.min(startIdx + boxSize, serialNumbers.length);
      for (let j = startIdx; j < endIdx; j++) {
        serialNumbers[j].box_id = boxId;
        boxContents.push({
          box_id: boxId,
          serial_number: serialNumbers[j].serial_number,
          position: j - startIdx + 1
        });
      }

      boxNum++;
    }

    return { boxes, boxContents };
  }

  /**
   * Get last used sequence number
   */
  async getLastSequence(productId, year) {
    const result = await SerialNumber.findOne({
      where: {
        product_id: productId
      },
      order: [['serial_number', 'DESC']]
    });

    if (!result) return 0;

    const parts = result.serial_number.split('-');
    return parseInt(parts[3], 10) || 0;
  }

  /**
   * Get last box number
   */
  async getLastBoxNumber(year) {
    const result = await Box.findOne({
      where: sequelize.where(
        sequelize.fn('substring', sequelize.col('box_id'), 5, 4),
        String(year)
      ),
      order: [['box_id', 'DESC']]
    });

    if (!result) return 0;

    const parts = result.box_id.split('-');
    return parseInt(parts[2], 10) || 0;
  }
}

module.exports = new SerializationService();

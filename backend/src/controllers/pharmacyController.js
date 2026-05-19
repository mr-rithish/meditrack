const { SerialNumber, Box, BoxContent, Transaction, SupplyChainActor, Product, Manufacturer } = require('../models');
const verificationService = require('../services/verificationService');
const qrcodeService = require('../services/qrcodeService');
const sequelize = require('../config/database');

/**
 * Receive a box of medicines (scan box QR)
 */
const receiveBox = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const { boxQRCode, scannedData } = req.body;
    const actorId = req.user.actorId;

    // Parse scanned data
    let boxId;
    if (scannedData) {
      const parsed = qrcodeService.parseGS1(scannedData);
      if (parsed.type === 'BOX') {
        boxId = parsed.boxId;
      }
    }
    boxId = boxId || boxQRCode;

    // Find box
    const box = await Box.findOne({
      where: { box_id: boxId },
      include: [{ model: Product, as: 'product' }]
    });

    if (!box) {
      return res.status(404).json({ success: false, message: 'Box not found.' });
    }

    if (box.status === 'at_pharmacy') {
      return res.status(400).json({ success: false, message: 'Box already received at a pharmacy.' });
    }

    // Update box status
    await box.update({ status: 'at_pharmacy' }, { transaction: t });

    // Update all serials in this box
    await SerialNumber.update(
      { status: 'at_pharmacy', current_location: actorId },
      { where: { box_id: boxId }, transaction: t }
    );

    // Log transaction
    await Transaction.create({
      box_id: boxId,
      transaction_type: 'receive',
      to_actor_id: actorId,
      scanned_by: req.user.userId
    }, { transaction: t });

    await t.commit();

    // Get count of medicines
    const count = await SerialNumber.count({ where: { box_id: boxId } });

    res.json({
      success: true,
      message: `✅ Received ${count} medicines from ${boxId}`,
      data: {
        boxId,
        productName: box.product?.product_name,
        batchNumber: box.batch_number,
        totalMedicines: count,
        expiryDate: box.expiry_date
      }
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * Verify a medicine (scan individual QR)
 */
const verifyMedicine = async (req, res, next) => {
  try {
    const { serialNumber, scannedData } = req.body;
    const actorId = req.user.actorId;

    let serial = serialNumber;
    if (scannedData) {
      const parsed = qrcodeService.parseGS1(scannedData);
      serial = parsed.serialNumber || scannedData;
    }

    const result = await verificationService.verifyMedicine(serial, actorId, 'verify', 'pharmacy');

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Dispense a medicine
 */
const dispenseMedicine = async (req, res, next) => {
  try {
    const { serialNumber, scannedData } = req.body;
    const actorId = req.user.actorId;

    let serial = serialNumber;
    if (scannedData) {
      const parsed = qrcodeService.parseGS1(scannedData);
      serial = parsed.serialNumber || scannedData;
    }

    const result = await verificationService.verifyMedicine(serial, actorId, 'dispense', 'pharmacy');

    if (!result.valid) {
      return res.status(400).json({ success: false, data: result });
    }

    res.json({
      success: true,
      message: `✅ Medicine ${serial} dispensed successfully.`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get pharmacy inventory
 */
const getInventory = async (req, res, next) => {
  try {
    const actorId = req.user.actorId;

    const medicines = await SerialNumber.findAll({
      where: { current_location: actorId, status: 'at_pharmacy' },
      include: [{
        model: Product, as: 'product',
        include: [{ model: Manufacturer, as: 'manufacturer', attributes: ['company_name'] }]
      }],
      order: [['expiry_date', 'ASC']]
    });

    // Group by product
    const grouped = {};
    medicines.forEach(m => {
      const pName = m.product?.product_name || 'Unknown';
      if (!grouped[pName]) {
        grouped[pName] = {
          productName: pName,
          manufacturer: m.product?.manufacturer?.company_name,
          strength: m.product?.strength,
          count: 0,
          nearestExpiry: m.expiry_date,
          batchNumbers: new Set()
        };
      }
      grouped[pName].count++;
      grouped[pName].batchNumbers.add(m.batch_number);
    });

    const inventory = Object.values(grouped).map(g => ({
      ...g,
      batchNumbers: [...g.batchNumbers]
    }));

    res.json({
      success: true,
      data: {
        totalMedicines: medicines.length,
        inventory
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { receiveBox, verifyMedicine, dispenseMedicine, getInventory };

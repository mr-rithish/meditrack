const { SerialNumber, Box, BoxContent, Transaction, SupplyChainActor, Alert, Verification, Product, Manufacturer } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Receive a box — middleman scans box QR at checkpoint
 * Updates location of all medicines in the box
 */
const receiveBox = async (req, res, next) => {
  try {
    const { boxQRCode, latitude, longitude } = req.body;
    const actorId = req.user.actorId;

    const box = await Box.findByPk(boxQRCode);
    if (!box) {
      return res.status(404).json({ success: false, message: 'Box not found. Check the box ID and try again.' });
    }

    // Validate box status
    if (box.status === `at_${actorId}`) {
      return res.status(400).json({ success: false, message: 'This box is already at your location.' });
    }
    if (box.status === 'flagged') {
      return res.status(400).json({ success: false, message: '⚠️ This box has been flagged as suspicious. Do NOT accept. Contact the regulator.' });
    }

    // Update box status
    await box.update({ status: `at_${actorId}` });

    // Update all serial numbers in this box
    await SerialNumber.update(
      { current_location: actorId, status: `at_middleman` },
      { where: { box_id: boxQRCode } }
    );

    // Log the transaction with location
    await Transaction.create({
      box_id: boxQRCode,
      transaction_type: 'receive',
      to_actor_id: actorId,
      location_lat: latitude || null,
      location_lon: longitude || null,
      scanned_by: req.user.userId,
      device_id: req.body.deviceId || 'WEB',
      notes: `Received by ${actorId}`
    });

    // Get box details for response
    const medicineCount = await SerialNumber.count({ where: { box_id: boxQRCode } });
    const actor = await SupplyChainActor.findByPk(actorId);

    res.json({
      success: true,
      message: `Box ${boxQRCode} received successfully at ${actor?.company_name || actorId}`,
      data: {
        boxId: boxQRCode,
        medicineCount,
        receivedAt: new Date(),
        location: actor?.city || 'Unknown'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Ship a box — middleman scans box to mark it as sent out
 * No destination needed; next actor scans to receive it
 * Records timestamp so regulators can track hold duration
 */
const shipBox = async (req, res, next) => {
  try {
    const { boxId, latitude, longitude } = req.body;
    const fromActorId = req.user.actorId;

    // Parse box ID from scanned QR (could be JSON box QR)
    let resolvedBoxId = boxId;
    try {
      const parsed = JSON.parse(boxId);
      if (parsed.type === 'BOX' && parsed.boxId) resolvedBoxId = parsed.boxId;
    } catch {}

    const box = await Box.findByPk(resolvedBoxId);
    if (!box) {
      return res.status(404).json({ success: false, message: 'Box not found. Check the box ID and try again.' });
    }

    // Verify box is at this middleman
    if (box.status !== `at_${fromActorId}`) {
      return res.status(400).json({ success: false, message: 'This box is not at your location. You can only send boxes you have received.' });
    }

    // Calculate hold duration from the last receive transaction
    const receiveTransaction = await Transaction.findOne({
      where: { box_id: resolvedBoxId, to_actor_id: fromActorId, transaction_type: 'receive' },
      order: [['transaction_date', 'DESC']]
    });
    const receivedAt = receiveTransaction?.transaction_date || receiveTransaction?.createdAt;
    const holdDurationMs = receivedAt ? Date.now() - new Date(receivedAt).getTime() : null;
    const holdDurationHours = holdDurationMs ? Math.round(holdDurationMs / (1000 * 60 * 60)) : null;

    // Update box status
    await box.update({ status: 'in_transit' });

    // Update serials
    await SerialNumber.update(
      { status: 'in_transit', current_location: null },
      { where: { box_id: resolvedBoxId } }
    );

    // Log shipping transaction
    await Transaction.create({
      box_id: resolvedBoxId,
      transaction_type: 'ship',
      from_actor_id: fromActorId,
      location_lat: latitude || null,
      location_lon: longitude || null,
      scanned_by: req.user.userId,
      notes: `Shipped by ${fromActorId}${holdDurationHours !== null ? ` (held for ${holdDurationHours}h)` : ''}`
    });

    const actor = await SupplyChainActor.findByPk(fromActorId);
    const medicineCount = await SerialNumber.count({ where: { box_id: resolvedBoxId } });

    res.json({
      success: true,
      message: `Box ${resolvedBoxId} marked as shipped from ${actor?.company_name || fromActorId}`,
      data: {
        boxId: resolvedBoxId,
        from: actor?.company_name || fromActorId,
        shippedAt: new Date(),
        medicineCount,
        holdDuration: holdDurationHours !== null ? `${holdDurationHours} hours` : 'Unknown'
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Report a suspicious/fake box — creates alert for regulator
 */
const reportFake = async (req, res, next) => {
  try {
    const { boxId, serialNumber, description, severity } = req.body;
    const actorId = req.user.actorId;

    const alertId = `ALERT-${Date.now()}`;

    const alert = await Alert.create({
      alert_id: alertId,
      alert_type: 'middleman_report',
      serial_number: serialNumber || null,
      box_id: boxId || null,
      actor_id: actorId,
      severity: severity || 'high',
      description: description || 'Suspicious medicine reported by middleman',
      status: 'new'
    });

    // If box reported, mark it as flagged
    if (boxId) {
      await Box.update({ status: 'flagged' }, { where: { box_id: boxId } });
      await SerialNumber.update(
        { status: 'flagged' },
        { where: { box_id: boxId } }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Report submitted to regulatory authority.',
      data: { alertId, reportedBy: actorId, status: 'new' }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get boxes currently held by this middleman
 */
const getInventory = async (req, res, next) => {
  try {
    const actorId = req.user.actorId;

    // Find boxes where serials have current_location = this actor
    const serials = await SerialNumber.findAll({
      where: { current_location: actorId },
      include: [
        { model: Product, as: 'product', include: [{ model: Manufacturer, as: 'manufacturer' }] }
      ],
      attributes: ['serial_number', 'box_id', 'batch_number', 'status', 'manufacturing_date', 'expiry_date']
    });

    // Group by box
    const boxMap = {};
    serials.forEach(s => {
      const bid = s.box_id || 'loose';
      if (!boxMap[bid]) {
        boxMap[bid] = {
          boxId: bid,
          productName: s.product?.product_name,
          manufacturer: s.product?.manufacturer?.company_name,
          batchNumber: s.batch_number,
          count: 0,
          expiryDate: s.expiry_date
        };
      }
      boxMap[bid].count++;
    });

    res.json({
      success: true,
      data: {
        totalBoxes: Object.keys(boxMap).length,
        totalMedicines: serials.length,
        boxes: Object.values(boxMap)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get past transactions for this middleman
 */
const getHistory = async (req, res, next) => {
  try {
    const actorId = req.user.actorId;
    const transactions = await Transaction.findAll({
      where: {
        [Op.or]: [{ from_actor_id: actorId }, { to_actor_id: actorId }]
      },
      order: [['transaction_date', 'DESC']],
      limit: 50
    });

    res.json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
};

/**
 * Get list of actors to ship to (pharmacies and other middlemen)
 */
const getShipTargets = async (req, res, next) => {
  try {
    const actors = await SupplyChainActor.findAll({
      where: {
        status: 'active',
        actor_id: { [Op.ne]: req.user.actorId }
      },
      attributes: ['actor_id', 'actor_type', 'company_name', 'city', 'state']
    });
    res.json({ success: true, data: actors });
  } catch (error) {
    next(error);
  }
};

module.exports = { receiveBox, shipBox, reportFake, getInventory, getHistory, getShipTargets };

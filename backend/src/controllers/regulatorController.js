const { SerialNumber, Verification, Alert, Recall, Product, SupplyChainActor, Transaction, User, Manufacturer, Box } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcrypt');

/**
 * Get dashboard statistics
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalMedicines,
      totalVerificationsToday,
      totalSuccessToday,
      totalFailuresToday,
      activeAlerts,
      totalPharmacies,
      dispensedToday,
      activeRecalls
    ] = await Promise.all([
      SerialNumber.count(),
      Verification.count({ where: { request_timestamp: { [Op.gte]: today } } }),
      Verification.count({ where: { verification_result: 'valid', request_timestamp: { [Op.gte]: today } } }),
      Verification.count({ where: { verification_result: { [Op.ne]: 'valid' }, request_timestamp: { [Op.gte]: today } } }),
      Alert.count({ where: { status: { [Op.in]: ['new', 'investigating'] } } }),
      SupplyChainActor.count({ where: { actor_type: 'pharmacy', status: 'active' } }),
      SerialNumber.count({ where: { status: 'dispensed', dispensed_at: { [Op.gte]: today } } }),
      Recall.count({ where: { status: 'active' } })
    ]);

    res.json({
      success: true,
      data: {
        totalMedicinesTracked: totalMedicines,
        verificationsToday: totalVerificationsToday,
        successRate: totalVerificationsToday > 0
          ? ((totalSuccessToday / totalVerificationsToday) * 100).toFixed(1) + '%'
          : '0%',
        failuresToday: totalFailuresToday,
        activeAlerts,
        activePharmacies: totalPharmacies,
        dispensedToday,
        activeRecalls
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get alerts
 */
const getAlerts = async (req, res, next) => {
  try {
    const { status, severity, type, limit = 50, offset = 0 } = req.query;

    const where = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;
    if (type) where.alert_type = type;

    const alerts = await Alert.findAndCountAll({
      where,
      include: [{ model: SupplyChainActor, as: 'actor', attributes: ['company_name', 'actor_type', 'city'] }],
      order: [['alert_timestamp', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        total: alerts.count,
        alerts: alerts.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update alert status
 */
const updateAlert = async (req, res, next) => {
  try {
    const { alertId } = req.params;
    const { status, assignedTo, resolutionNotes } = req.body;

    const alert = await Alert.findByPk(alertId);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found.' });
    }

    const updates = {};
    if (status) updates.status = status;
    if (assignedTo) updates.assigned_to = assignedTo;
    if (resolutionNotes) updates.resolution_notes = resolutionNotes;
    if (status === 'resolved') updates.resolved_at = new Date();

    await alert.update(updates);

    res.json({ success: true, message: 'Alert updated.', data: alert });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a recall
 */
const createRecall = async (req, res, next) => {
  try {
    const { productId, batchNumbers, recallReason, recallType, severity } = req.body;

    const recallId = `RECALL-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    // Count affected medicines
    const affectedCount = await SerialNumber.count({
      where: {
        product_id: productId,
        batch_number: { [Op.in]: batchNumbers }
      }
    });

    const recall = await Recall.create({
      recall_id: recallId,
      product_id: productId,
      batch_numbers: batchNumbers,
      recall_reason: recallReason,
      recall_date: new Date(),
      recall_type: recallType || 'mandatory',
      severity: severity || 'class_1',
      affected_count: affectedCount
    });

    // Mark all affected serials as recalled
    await SerialNumber.update(
      { status: 'recalled' },
      {
        where: {
          product_id: productId,
          batch_number: { [Op.in]: batchNumbers },
          status: { [Op.notIn]: ['dispensed', 'destroyed'] }
        }
      }
    );

    res.status(201).json({
      success: true,
      message: `Recall created. ${affectedCount} medicines affected.`,
      data: recall
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get recall status
 */
const getRecalls = async (req, res, next) => {
  try {
    const recalls = await Recall.findAll({
      include: [{ model: Product, as: 'product', attributes: ['product_name', 'gtin'] }],
      order: [['created_at', 'DESC']]
    });

    res.json({ success: true, data: recalls });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboardStats, getAlerts, updateAlert, createRecall, getRecalls,
  registerActor, getActors, updateActorStatus, blockBatch, getNotifications, markNotificationRead };

// =============================================
// ACTOR MANAGEMENT — Central Authority
// =============================================

/**
 * Register a new actor (manufacturer, middleman, pharmacy) + auto-create user
 */
async function registerActor(req, res, next) {
  try {
    const { actorType, companyName, licenseNumber, address, city, state, country,
      contactPerson, contactEmail, contactPhone, latitude, longitude,
      username, password } = req.body;

    // Generate IDs
    const prefix = actorType === 'manufacturer' ? 'MFR' : actorType === 'pharmacy' ? 'PHARM' : 'MID';
    const cityCode = (city || 'X').substring(0, 3).toUpperCase();
    const actorId = `${prefix}-${cityCode}-${String(Date.now()).slice(-4)}`;
    const userId = `USER-${prefix}-${String(Date.now()).slice(-6)}`;

    // For manufacturers, create in both Manufacturer and SupplyChainActor tables
    if (actorType === 'manufacturer') {
      await Manufacturer.create({
        manufacturer_id: actorId,
        company_name: companyName,
        license_number: licenseNumber,
        address, city, state, country: country || 'India',
        contact_email: contactEmail,
        contact_phone: contactPhone,
        status: 'active'
      });
    }

    // Create supply chain actor (for all types including manufacturers)
    if (actorType !== 'manufacturer') {
      await SupplyChainActor.create({
        actor_id: actorId,
        actor_type: actorType === 'middleman' ? 'wholesaler' : actorType,
        company_name: companyName,
        license_number: licenseNumber,
        address, city, state, country: country || 'India',
        contact_person: contactPerson,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        latitude: latitude || null,
        longitude: longitude || null,
        status: 'active'
      });
    }

    // Auto-create user account
    const passwordHash = await bcrypt.hash(password || 'password123', 10);
    const role = actorType === 'middleman' ? 'middleman' : actorType;

    await User.create({
      user_id: userId,
      username: username || contactEmail.split('@')[0],
      email: contactEmail,
      password_hash: passwordHash,
      role,
      actor_id: actorType !== 'manufacturer' ? actorId : null,
      manufacturer_id: actorType === 'manufacturer' ? actorId : null,
      full_name: contactPerson || companyName,
      phone: contactPhone
    });

    res.status(201).json({
      success: true,
      message: `${actorType} "${companyName}" registered. Login: ${contactEmail}`,
      data: { actorId, userId, email: contactEmail, role }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List actors by type
 */
async function getActors(req, res, next) {
  try {
    const { type } = req.query;

    if (type === 'manufacturer') {
      const manufacturers = await Manufacturer.findAll({ order: [['created_at', 'DESC']] });
      return res.json({ success: true, data: manufacturers });
    }

    const where = {};
    if (type) {
      // Map 'middleman' query to actual types in DB
      if (type === 'middleman') {
        where.actor_type = { [Op.in]: ['wholesaler', 'distributor', 'middleman'] };
      } else {
        where.actor_type = type;
      }
    }

    const actors = await SupplyChainActor.findAll({ where, order: [['created_at', 'DESC']] });
    res.json({ success: true, data: actors });
  } catch (error) {
    next(error);
  }
}

/**
 * Update actor status (activate/suspend)
 */
async function updateActorStatus(req, res, next) {
  try {
    const { actorId } = req.params;
    const { status } = req.body; // 'active' or 'suspended'

    // Try supply chain actor first
    let actor = await SupplyChainActor.findByPk(actorId);
    if (actor) {
      await actor.update({ status });
    } else {
      // Try manufacturer
      actor = await Manufacturer.findByPk(actorId);
      if (actor) await actor.update({ status });
    }

    if (!actor) {
      return res.status(404).json({ success: false, message: 'Actor not found.' });
    }

    // Also update user status
    await User.update(
      { status },
      { where: { [Op.or]: [{ actor_id: actorId }, { manufacturer_id: actorId }] } }
    );

    res.json({ success: true, message: `Actor ${actorId} status updated to ${status}.` });
  } catch (error) {
    next(error);
  }
}

/**
 * Block/quarantine an entire batch
 */
async function blockBatch(req, res, next) {
  try {
    const { productId, batchNumber, reason } = req.body;

    // Block all serials in this batch
    const [affectedCount] = await SerialNumber.update(
      { status: 'blocked' },
      { where: { product_id: productId, batch_number: batchNumber } }
    );

    // Block associated boxes
    await Box.update(
      { status: 'blocked' },
      { where: { product_id: productId, batch_number: batchNumber } }
    );

    // Create alert
    await Alert.create({
      alert_id: `ALERT-BLOCK-${Date.now()}`,
      alert_type: 'batch_blocked',
      severity: 'critical',
      description: `Batch ${batchNumber} of product ${productId} blocked. Reason: ${reason}. ${affectedCount} medicines quarantined.`,
      status: 'new'
    });

    res.json({
      success: true,
      message: `Batch ${batchNumber} blocked. ${affectedCount} medicines quarantined.`,
      data: { productId, batchNumber, affectedCount }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get notifications (complaints from middlemen + critical alerts)
 */
async function getNotifications(req, res, next) {
  try {
    const notifications = await Alert.findAll({
      where: {
        [Op.or]: [
          { alert_type: 'middleman_report' },
          { severity: 'critical' },
          { alert_type: 'batch_blocked' }
        ]
      },
      include: [{ model: SupplyChainActor, as: 'actor', attributes: ['company_name', 'city'] }],
      order: [['alert_timestamp', 'DESC']],
      limit: 30
    });

    const unreadCount = await Alert.count({
      where: {
        status: 'new',
        [Op.or]: [
          { alert_type: 'middleman_report' },
          { severity: 'critical' },
          { alert_type: 'batch_blocked' }
        ]
      }
    });

    res.json({
      success: true,
      data: { notifications, unreadCount }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark notification as read
 */
async function markNotificationRead(req, res, next) {
  try {
    const { alertId } = req.params;
    await Alert.update({ status: 'investigating' }, { where: { alert_id: alertId, status: 'new' } });
    res.json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    next(error);
  }
}

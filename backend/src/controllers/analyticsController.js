const { Verification, Alert, SerialNumber, Transaction, SupplyChainActor } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Verification trend — daily counts for last N days
 */
const getVerificationTrend = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await Verification.findAll({
      attributes: [
        [sequelize.fn('DATE', sequelize.col('request_timestamp')), 'date'],
        [sequelize.fn('COUNT', '*'), 'total'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN verification_result = 'valid' THEN 1 ELSE 0 END")), 'genuine'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN verification_result != 'valid' THEN 1 ELSE 0 END")), 'flagged']
      ],
      where: { request_timestamp: { [Op.gte]: startDate } },
      group: [sequelize.fn('DATE', sequelize.col('request_timestamp'))],
      order: [[sequelize.fn('DATE', sequelize.col('request_timestamp')), 'ASC']],
      raw: true
    });

    // Fill in missing days
    const data = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = results.find(r => r.date === dateStr);
      data.push({
        date: dateStr,
        label: d.toLocaleDateString('en', { weekday: 'short' }),
        total: parseInt(found?.total) || 0,
        genuine: parseInt(found?.genuine) || 0,
        flagged: parseInt(found?.flagged) || 0
      });
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * Alert breakdown by type
 */
const getAlertsByType = async (req, res, next) => {
  try {
    const results = await Alert.findAll({
      attributes: [
        'alert_type',
        [sequelize.fn('COUNT', '*'), 'count']
      ],
      group: ['alert_type'],
      raw: true
    });
    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
};

/**
 * Supply chain flow — how many boxes at each stage
 */
const getSupplyChainFlow = async (req, res, next) => {
  try {
    const statusCounts = await SerialNumber.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', '*'), 'count']
      ],
      group: ['status'],
      raw: true
    });

    res.json({ success: true, data: statusCounts });
  } catch (error) {
    next(error);
  }
};

module.exports = { getVerificationTrend, getAlertsByType, getSupplyChainFlow };

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Alert = sequelize.define('Alert', {
  alert_id: {
    type: DataTypes.STRING(50),
    primaryKey: true
  },
  alert_type: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  serial_number: DataTypes.STRING(100),
  box_id: DataTypes.STRING(50),
  actor_id: DataTypes.STRING(50),
  severity: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  alert_timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('new', 'investigating', 'resolved', 'false_positive'),
    defaultValue: 'new'
  },
  assigned_to: DataTypes.STRING(100),
  resolved_at: DataTypes.DATE,
  resolution_notes: DataTypes.TEXT
}, {
  tableName: 'alerts',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['alert_type'] },
    { fields: ['status'] },
    { fields: ['severity'] },
    { fields: ['alert_timestamp'] }
  ]
});

module.exports = Alert;

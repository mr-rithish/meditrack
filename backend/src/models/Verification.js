const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Verification = sequelize.define('Verification', {
  verification_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  serial_number: DataTypes.STRING(100),
  requested_by: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  verification_result: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  failure_reason: DataTypes.STRING(255),
  request_timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  ip_address: DataTypes.STRING(45),
  device_info: DataTypes.TEXT,
  location_lat: DataTypes.DECIMAL(10, 8),
  location_lon: DataTypes.DECIMAL(11, 8)
}, {
  tableName: 'verifications',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['serial_number'] },
    { fields: ['verification_result'] },
    { fields: ['request_timestamp'] }
  ]
});

module.exports = Verification;

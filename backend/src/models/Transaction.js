const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  transaction_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  serial_number: DataTypes.STRING(100),
  box_id: DataTypes.STRING(50),
  transaction_type: {
    type: DataTypes.ENUM('manufacture', 'ship', 'receive', 'transfer', 'dispense', 'return', 'destroy'),
    allowNull: false
  },
  from_actor_id: DataTypes.STRING(50),
  to_actor_id: DataTypes.STRING(50),
  transaction_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false
  },
  location_lat: DataTypes.DECIMAL(10, 8),
  location_lon: DataTypes.DECIMAL(11, 8),
  scanned_by: DataTypes.STRING(100),
  device_id: DataTypes.STRING(100),
  notes: DataTypes.TEXT
}, {
  tableName: 'transactions',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['serial_number'] },
    { fields: ['box_id'] },
    { fields: ['transaction_type'] },
    { fields: ['transaction_date'] },
    { fields: ['from_actor_id'] },
    { fields: ['to_actor_id'] }
  ]
});

module.exports = Transaction;

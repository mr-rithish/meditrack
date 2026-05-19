const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SerialNumber = sequelize.define('SerialNumber', {
  serial_number: {
    type: DataTypes.STRING(100),
    primaryKey: true
  },
  product_id: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  box_id: DataTypes.STRING(50),
  batch_number: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  manufacturing_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  expiry_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  gs1_data: DataTypes.TEXT,
  qr_code_url: DataTypes.TEXT,
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'manufactured'
  },
  current_location: DataTypes.STRING(100),
  dispensed_at: DataTypes.DATE,
  dispensed_by: DataTypes.STRING(100)
}, {
  tableName: 'serial_numbers',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['product_id'] },
    { fields: ['box_id'] },
    { fields: ['batch_number'] },
    { fields: ['status'] },
    { fields: ['expiry_date'] },
    { fields: ['current_location'] }
  ]
});

module.exports = SerialNumber;

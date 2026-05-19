const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Box = sequelize.define('Box', {
  box_id: {
    type: DataTypes.STRING(50),
    primaryKey: true
  },
  product_id: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  batch_number: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  box_qr_code: {
    type: DataTypes.STRING(200),
    unique: true,
    allowNull: false
  },
  total_medicines: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  manufacturing_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  expiry_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(50),
    defaultValue: 'manufactured'
  },
  seal_code: DataTypes.STRING(100)
}, {
  tableName: 'boxes',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['batch_number'] },
    { fields: ['box_qr_code'] },
    { fields: ['status'] }
  ]
});

module.exports = Box;

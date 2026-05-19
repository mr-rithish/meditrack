const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Manufacturer = sequelize.define('Manufacturer', {
  manufacturer_id: {
    type: DataTypes.STRING(50),
    primaryKey: true
  },
  company_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  license_number: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: false
  },
  address: DataTypes.TEXT,
  city: DataTypes.STRING(100),
  state: DataTypes.STRING(100),
  country: {
    type: DataTypes.STRING(100),
    defaultValue: 'India'
  },
  contact_email: DataTypes.STRING(255),
  contact_phone: DataTypes.STRING(50),
  status: {
    type: DataTypes.ENUM('active', 'suspended', 'inactive'),
    defaultValue: 'active'
  }
}, {
  tableName: 'manufacturers',
  timestamps: true,
  underscored: true
});

module.exports = Manufacturer;

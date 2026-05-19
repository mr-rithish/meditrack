const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  product_id: {
    type: DataTypes.STRING(50),
    primaryKey: true
  },
  manufacturer_id: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  product_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  generic_name: DataTypes.STRING(255),
  gtin: {
    type: DataTypes.STRING(14),
    unique: true,
    allowNull: false
  },
  strength: DataTypes.STRING(50),
  dosage_form: DataTypes.STRING(100),
  packaging: DataTypes.STRING(100),
  registration_number: DataTypes.STRING(100),
  approved_by: DataTypes.STRING(100)
}, {
  tableName: 'products',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['manufacturer_id'] },
    { fields: ['gtin'] },
    { fields: ['product_name'] }
  ]
});

module.exports = Product;

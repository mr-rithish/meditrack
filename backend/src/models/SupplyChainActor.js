const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SupplyChainActor = sequelize.define('SupplyChainActor', {
  actor_id: {
    type: DataTypes.STRING(50),
    primaryKey: true
  },
  actor_type: {
    type: DataTypes.ENUM('manufacturer', 'wholesaler', 'distributor', 'pharmacy', 'hospital'),
    allowNull: false
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
  gln: DataTypes.STRING(13),
  contact_person: DataTypes.STRING(255),
  contact_email: DataTypes.STRING(255),
  contact_phone: DataTypes.STRING(50),
  latitude: DataTypes.DECIMAL(10, 8),
  longitude: DataTypes.DECIMAL(11, 8),
  status: {
    type: DataTypes.ENUM('active', 'suspended', 'inactive'),
    defaultValue: 'active'
  }
}, {
  tableName: 'supply_chain_actors',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['actor_type'] },
    { fields: ['city'] },
    { fields: ['status'] }
  ]
});

module.exports = SupplyChainActor;

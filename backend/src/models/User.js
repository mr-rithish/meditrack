const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  user_id: {
    type: DataTypes.STRING(50),
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('manufacturer', 'pharmacy', 'wholesaler', 'middleman', 'regulator', 'admin'),
    allowNull: false
  },
  actor_id: DataTypes.STRING(50),
  manufacturer_id: DataTypes.STRING(50),
  full_name: DataTypes.STRING(255),
  phone: DataTypes.STRING(50),
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended'),
    defaultValue: 'active'
  },
  last_login: DataTypes.DATE
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['email'] },
    { fields: ['role'] },
    { fields: ['status'] }
  ]
});

module.exports = User;

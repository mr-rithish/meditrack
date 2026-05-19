const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BoxContent = sequelize.define('BoxContent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  box_id: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  serial_number: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  position: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 100 }
  }
}, {
  tableName: 'box_contents',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['box_id'] },
    { fields: ['serial_number'] },
    { unique: true, fields: ['box_id', 'serial_number'] },
    { unique: true, fields: ['box_id', 'position'] }
  ]
});

module.exports = BoxContent;

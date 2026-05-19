const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Recall = sequelize.define('Recall', {
  recall_id: {
    type: DataTypes.STRING(50),
    primaryKey: true
  },
  product_id: DataTypes.STRING(50),
  batch_numbers: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    allowNull: false
  },
  recall_reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  recall_date: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  recall_type: {
    type: DataTypes.ENUM('voluntary', 'mandatory')
  },
  severity: {
    type: DataTypes.ENUM('class_1', 'class_2', 'class_3')
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'cancelled'),
    defaultValue: 'active'
  },
  affected_count: DataTypes.INTEGER,
  returned_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  completed_at: DataTypes.DATE
}, {
  tableName: 'recalls',
  timestamps: true,
  underscored: true,
  indexes: [
    { fields: ['product_id'] },
    { fields: ['status'] }
  ]
});

module.exports = Recall;

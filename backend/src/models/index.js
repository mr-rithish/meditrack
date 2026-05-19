const sequelize = require('../config/database');

// Import all models
const Manufacturer = require('./Manufacturer');
const Product = require('./Product');
const Box = require('./Box');
const SerialNumber = require('./SerialNumber');
const BoxContent = require('./BoxContent');
const SupplyChainActor = require('./SupplyChainActor');
const Transaction = require('./Transaction');
const Verification = require('./Verification');
const Alert = require('./Alert');
const Recall = require('./Recall');
const User = require('./User');

// ============================================
// ASSOCIATIONS
// ============================================

// Manufacturer → Products (1:N)
Manufacturer.hasMany(Product, { foreignKey: 'manufacturer_id', as: 'products' });
Product.belongsTo(Manufacturer, { foreignKey: 'manufacturer_id', as: 'manufacturer' });

// Product → Boxes (1:N)
Product.hasMany(Box, { foreignKey: 'product_id', as: 'boxes' });
Box.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Product → SerialNumbers (1:N)
Product.hasMany(SerialNumber, { foreignKey: 'product_id', as: 'serialNumbers' });
SerialNumber.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// Box → SerialNumbers (1:N)
Box.hasMany(SerialNumber, { foreignKey: 'box_id', as: 'serialNumbers' });
SerialNumber.belongsTo(Box, { foreignKey: 'box_id', as: 'box' });

// Box ↔ SerialNumber via BoxContent (N:N)
Box.hasMany(BoxContent, { foreignKey: 'box_id', as: 'contents' });
BoxContent.belongsTo(Box, { foreignKey: 'box_id', as: 'box' });
SerialNumber.hasMany(BoxContent, { foreignKey: 'serial_number', sourceKey: 'serial_number', as: 'boxContents' });
BoxContent.belongsTo(SerialNumber, { foreignKey: 'serial_number', targetKey: 'serial_number', as: 'serialNumber' });

// SerialNumber → Transactions (1:N) — constraints:false because serial_number is a string FK
SerialNumber.hasMany(Transaction, { foreignKey: 'serial_number', sourceKey: 'serial_number', as: 'transactions', constraints: false });
Transaction.belongsTo(SerialNumber, { foreignKey: 'serial_number', targetKey: 'serial_number', as: 'serialNumber', constraints: false });

// Box → Transactions (1:N) — constraints:false because box_id may be null
Box.hasMany(Transaction, { foreignKey: 'box_id', as: 'transactions', constraints: false });
Transaction.belongsTo(Box, { foreignKey: 'box_id', as: 'box', constraints: false });

// SupplyChainActor → Transactions (as from/to)
// constraints:false because from/to can be manufacturer IDs or special values like 'PATIENT'
SupplyChainActor.hasMany(Transaction, { foreignKey: 'from_actor_id', as: 'outgoingTransactions', constraints: false });
SupplyChainActor.hasMany(Transaction, { foreignKey: 'to_actor_id', as: 'incomingTransactions', constraints: false });
Transaction.belongsTo(SupplyChainActor, { foreignKey: 'from_actor_id', as: 'fromActor', constraints: false });
Transaction.belongsTo(SupplyChainActor, { foreignKey: 'to_actor_id', as: 'toActor', constraints: false });

// SupplyChainActor → Alerts — constraints:false because actor_id may be null
SupplyChainActor.hasMany(Alert, { foreignKey: 'actor_id', as: 'alerts', constraints: false });
Alert.belongsTo(SupplyChainActor, { foreignKey: 'actor_id', as: 'actor', constraints: false });

// Product → Recalls (1:N)
Product.hasMany(Recall, { foreignKey: 'product_id', as: 'recalls' });
Recall.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// User → Manufacturer
User.belongsTo(Manufacturer, { foreignKey: 'manufacturer_id', as: 'manufacturer' });
Manufacturer.hasMany(User, { foreignKey: 'manufacturer_id', as: 'users' });

// User → SupplyChainActor
User.belongsTo(SupplyChainActor, { foreignKey: 'actor_id', as: 'actor' });
SupplyChainActor.hasMany(User, { foreignKey: 'actor_id', as: 'users' });

module.exports = {
  sequelize,
  Manufacturer,
  Product,
  Box,
  SerialNumber,
  BoxContent,
  SupplyChainActor,
  Transaction,
  Verification,
  Alert,
  Recall,
  User
};

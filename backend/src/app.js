require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth.routes');
const manufacturerRoutes = require('./routes/manufacturer.routes');
const pharmacyRoutes = require('./routes/pharmacy.routes');
const patientRoutes = require('./routes/patient.routes');
const regulatorRoutes = require('./routes/regulator.routes');
const middlemanRoutes = require('./routes/middleman.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const scannerRoutes = require('./routes/scanner.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// ============================================
// ROUTES
// ============================================
app.use('/api/auth', authRoutes);
app.use('/api/manufacturer', manufacturerRoutes);
app.use('/api/pharmacy', pharmacyRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/regulator', regulatorRoutes);
app.use('/api/middleman', middlemanRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/scanner', scannerRoutes);
app.use('/api/registerner', scannerRoutes);  // Alias for old firmware with typo

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'MediTrack API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API documentation summary
app.get('/api', (req, res) => {
  res.json({
    name: 'MediTrack API',
    version: '1.0.0',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register a new user',
        'POST /api/auth/login': 'Login',
        'GET /api/auth/profile': 'Get current user profile'
      },
      manufacturer: {
        'POST /api/manufacturer/products': 'Register product',
        'GET /api/manufacturer/products': 'List products',
        'POST /api/manufacturer/generate': 'Generate serials + QR codes',
        'GET /api/manufacturer/batches/:productId': 'List batches',
        'GET /api/manufacturer/qrcodes/:batchNumber': 'Get QR codes'
      },
      pharmacy: {
        'POST /api/pharmacy/receive': 'Receive a box',
        'POST /api/pharmacy/verify': 'Verify a medicine',
        'POST /api/pharmacy/dispense': 'Dispense a medicine',
        'GET /api/pharmacy/inventory': 'Get inventory'
      },
      patient: {
        'POST /api/patient/verify': 'Verify medicine (public)'
      },
      regulator: {
        'GET /api/regulator/dashboard': 'Dashboard stats',
        'GET /api/regulator/alerts': 'List alerts',
        'PUT /api/regulator/alerts/:alertId': 'Update alert',
        'POST /api/regulator/recalls': 'Create recall',
        'GET /api/regulator/recalls': 'List recalls'
      },
      scanner: {
        'POST /api/scanner/scan': 'IoT scanner scan endpoint',
        'POST /api/scanner/register': 'Register scanner device'
      }
    }
  });
});

// ============================================
// ERROR HANDLER
// ============================================
app.use(errorHandler);

// ============================================
// START SERVER
// ============================================
const startServer = async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established.');

    // Sync all models (create tables)
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('✅ Database tables synced.');

    app.listen(PORT, () => {
      console.log(`\n🚀 MediTrack API Server running on http://localhost:${PORT}`);
      console.log(`📋 API docs: http://localhost:${PORT}/api`);
      console.log(`💊 Health check: http://localhost:${PORT}/api/health\n`);
    });
  } catch (error) {
    console.error('❌ Unable to start server:', error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;

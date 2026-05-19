const express = require('express');
const router = express.Router();
const {
  getDashboardStats, getAlerts, updateAlert, createRecall, getRecalls,
  registerActor, getActors, updateActorStatus, blockBatch, getNotifications, markNotificationRead
} = require('../controllers/regulatorController');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// All routes require regulator or admin role
router.use(authenticate, authorize('regulator', 'admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Alerts
router.get('/alerts', getAlerts);
router.put('/alerts/:alertId', updateAlert);

// Recalls
router.post('/recalls', createRecall);
router.get('/recalls', getRecalls);

// Actor Management — Central Authority
router.post('/actors', registerActor);
router.get('/actors', getActors);
router.put('/actors/:actorId/status', updateActorStatus);

// Batch Blocking / Quarantine
router.post('/batch/block', blockBatch);

// Notifications (complaints from middlemen + critical alerts)
router.get('/notifications', getNotifications);
router.put('/notifications/:alertId/read', markNotificationRead);

module.exports = router;

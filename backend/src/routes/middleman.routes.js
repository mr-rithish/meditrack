const express = require('express');
const router = express.Router();
const { receiveBox, shipBox, reportFake, getInventory, getHistory, getShipTargets } = require('../controllers/middlemanController');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// All routes require middleman role
router.use(authenticate, authorize('middleman', 'admin'));

// POST /api/middleman/receive — Receive a box (scan at checkpoint)
router.post('/receive', receiveBox);

// POST /api/middleman/ship — Ship box to next actor
router.post('/ship', shipBox);

// POST /api/middleman/report — Report fake/suspicious box
router.post('/report', reportFake);

// GET /api/middleman/inventory — Boxes currently held
router.get('/inventory', getInventory);

// GET /api/middleman/history — Past transactions
router.get('/history', getHistory);

// GET /api/middleman/targets — Actors available to ship to
router.get('/targets', getShipTargets);

module.exports = router;

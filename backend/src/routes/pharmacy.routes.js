const express = require('express');
const router = express.Router();
const { receiveBox, verifyMedicine, dispenseMedicine, getInventory } = require('../controllers/pharmacyController');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// All routes require pharmacy role
router.use(authenticate, authorize('pharmacy', 'admin'));

// POST /api/pharmacy/receive — Receive a box
router.post('/receive', receiveBox);

// POST /api/pharmacy/verify — Verify a medicine
router.post('/verify', verifyMedicine);

// POST /api/pharmacy/dispense — Dispense a medicine
router.post('/dispense', dispenseMedicine);

// GET /api/pharmacy/inventory — Get current inventory
router.get('/inventory', getInventory);

module.exports = router;

const express = require('express');
const router = express.Router();
const { verifyMedicine } = require('../controllers/patientController');

// POST /api/patient/verify — Public verification (no auth)
router.post('/verify', verifyMedicine);

module.exports = router;

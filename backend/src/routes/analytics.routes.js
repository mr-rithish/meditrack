const express = require('express');
const router = express.Router();
const { getVerificationTrend, getAlertsByType, getSupplyChainFlow } = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/verifications', getVerificationTrend);
router.get('/alerts-by-type', getAlertsByType);
router.get('/supply-chain-flow', getSupplyChainFlow);

module.exports = router;

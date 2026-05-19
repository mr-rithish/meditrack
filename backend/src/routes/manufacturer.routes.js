const express = require('express');
const router = express.Router();
const { registerProduct, generateSerials, getProducts, getBatches, getQRCodes } = require('../controllers/manufacturerController');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// All routes require manufacturer role
router.use(authenticate, authorize('manufacturer', 'admin'));

// POST /api/manufacturer/products — Register a new product
router.post('/products', registerProduct);

// GET /api/manufacturer/products — Get all products
router.get('/products', getProducts);

// POST /api/manufacturer/generate — Generate serials + QR codes
router.post('/generate', generateSerials);

// GET /api/manufacturer/batches/:productId — Get batches for a product
router.get('/batches/:productId', getBatches);

// GET /api/manufacturer/qrcodes/:batchNumber — Get QR codes for a batch
router.get('/qrcodes/:batchNumber', getQRCodes);

// GET /api/manufacturer/qrcodes/:batchNumber/pdf — Download QR codes as printable PDF
router.get('/qrcodes/:batchNumber/pdf', async (req, res, next) => {
  try {
    const { SerialNumber, Product } = require('../models');
    const pdfService = require('../services/pdfService');
    const { batchNumber } = req.params;

    const serials = await SerialNumber.findAll({
      where: { batch_number: batchNumber },
      include: [{ model: Product, as: 'product' }]
    });

    if (serials.length === 0) {
      return res.status(404).json({ success: false, message: 'No serials found for this batch.' });
    }

    const product = serials[0].product;
    const pdfBuffer = await pdfService.generateQRCodeSheet(serials, {
      productName: product?.product_name || 'Unknown',
      strength: product?.strength || '',
      batchNumber,
      expiryDate: serials[0].expiry_date
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=MediTrack-QR-${batchNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

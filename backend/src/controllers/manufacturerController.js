const { v4: uuidv4 } = require('uuid');
const { Product, SerialNumber, Box, BoxContent, Transaction, Manufacturer } = require('../models');
const serializationService = require('../services/serializationService');
const qrcodeService = require('../services/qrcodeService');
const sequelize = require('../config/database');

/**
 * Register a new product
 */
const registerProduct = async (req, res, next) => {
  try {
    const { productName, genericName, gtin, strength, dosageForm, packaging, registrationNumber, approvedBy } = req.body;
    const manufacturerId = req.user.manufacturerId;

    if (!manufacturerId) {
      return res.status(403).json({ success: false, message: 'User is not associated with a manufacturer.' });
    }

    const productId = `PROD-${productName.substring(0, 3).toUpperCase()}-${strength || ''}`.replace(/\s/g, '');

    const product = await Product.create({
      product_id: productId,
      manufacturer_id: manufacturerId,
      product_name: productName,
      generic_name: genericName,
      gtin,
      strength,
      dosage_form: dosageForm,
      packaging,
      registration_number: registrationNumber,
      approved_by: approvedBy
    });

    res.status(201).json({
      success: true,
      message: 'Product registered successfully.',
      data: product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate serial numbers + boxes + QR codes
 */
const generateSerials = async (req, res, next) => {
  const t = await sequelize.transaction();

  try {
    const { productId, batchNumber, quantity, manufacturingDate, expiryDate, boxSize } = req.body;
    const manufacturerId = req.user.manufacturerId;

    // Verify product belongs to this manufacturer
    const product = await Product.findOne({
      where: { product_id: productId, manufacturer_id: manufacturerId },
      include: [{ model: Manufacturer, as: 'manufacturer' }]
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found or not owned by you.' });
    }

    // Derive codes from manufacturer and product
    const mfrCode = product.manufacturer.company_name.substring(0, 3).toUpperCase();
    const prodCode = product.product_name.substring(0, 3).toUpperCase();

    // Generate serial numbers
    const serialNumbers = await serializationService.generateSerialNumbers(
      productId, quantity, batchNumber, mfrCode, prodCode, manufacturingDate, expiryDate
    );

    // Generate boxes
    const { boxes, boxContents } = await serializationService.generateBoxes(
      serialNumbers, batchNumber, productId, manufacturingDate, expiryDate, boxSize || 100
    );

    // Generate QR codes for each serial
    const expiryForGS1 = qrcodeService.formatExpiryForGS1(expiryDate);
    for (let sn of serialNumbers) {
      const qr = await qrcodeService.generateDataMatrix(product.gtin, sn.serial_number, expiryForGS1, batchNumber);
      sn.gs1_data = qr.gs1Data;
      sn.qr_code_url = qr.qrCodeImage;
    }

    // Generate box QR code images
    for (let box of boxes) {
      const serials = serialNumbers.filter(sn => sn.box_id === box.box_id).map(sn => sn.serial_number);
      const boxQR = await qrcodeService.generateBoxQR(box.box_id, serials);
      box.box_qr_image = boxQR.qrCodeImage;
    }

    // Save everything in a transaction
    await Box.bulkCreate(boxes, { transaction: t });
    await SerialNumber.bulkCreate(serialNumbers, { transaction: t });
    await BoxContent.bulkCreate(boxContents, { transaction: t });

    // Log manufacture transactions
    const transactions = serialNumbers.map(sn => ({
      serial_number: sn.serial_number,
      transaction_type: 'manufacture',
      from_actor_id: manufacturerId,
      scanned_by: req.user.userId
    }));
    await Transaction.bulkCreate(transactions, { transaction: t });

    await t.commit();

    res.status(201).json({
      success: true,
      message: `Generated ${serialNumbers.length} serial numbers in ${boxes.length} boxes.`,
      data: {
        totalSerials: serialNumbers.length,
        totalBoxes: boxes.length,
        batchNumber,
        boxes: boxes.map(b => ({
          boxId: b.box_id,
          boxQRCode: b.box_qr_code,
          boxQRImage: b.box_qr_image,
          totalMedicines: b.total_medicines
        })),
        sampleSerials: serialNumbers.slice(0, 5).map(sn => ({
          serialNumber: sn.serial_number,
          gs1Data: sn.gs1_data,
          qrCodeUrl: sn.qr_code_url
        }))
      }
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * Get all products for this manufacturer
 */
const getProducts = async (req, res, next) => {
  try {
    const manufacturerId = req.user.manufacturerId;
    const products = await Product.findAll({
      where: { manufacturer_id: manufacturerId },
      include: [
        { model: SerialNumber, as: 'serialNumbers', attributes: ['serial_number', 'status', 'batch_number'] }
      ]
    });

    const productsWithStats = products.map(p => ({
      ...p.toJSON(),
      totalSerials: p.serialNumbers?.length || 0,
      serialNumbers: undefined
    }));

    res.json({ success: true, data: productsWithStats });
  } catch (error) {
    next(error);
  }
};

/**
 * Get batches for a product
 */
const getBatches = async (req, res, next) => {
  try {
    const { productId } = req.params;

    const boxes = await Box.findAll({
      where: { product_id: productId },
      attributes: ['box_id', 'batch_number', 'total_medicines', 'status', 'manufacturing_date', 'expiry_date'],
      order: [['created_at', 'DESC']]
    });

    res.json({ success: true, data: boxes });
  } catch (error) {
    next(error);
  }
};

/**
 * Get QR codes for a batch
 */
const getQRCodes = async (req, res, next) => {
  try {
    const { batchNumber } = req.params;

    const serials = await SerialNumber.findAll({
      where: { batch_number: batchNumber },
      attributes: ['serial_number', 'gs1_data', 'qr_code_url', 'status'],
      include: [{ model: Product, as: 'product', attributes: ['product_name', 'gtin'] }]
    });

    res.json({ success: true, data: serials });
  } catch (error) {
    next(error);
  }
};

module.exports = { registerProduct, generateSerials, getProducts, getBatches, getQRCodes };

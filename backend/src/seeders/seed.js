require('dotenv').config();
const bcrypt = require('bcrypt');
const { sequelize, Manufacturer, Product, SupplyChainActor, User, SerialNumber, Box, BoxContent, Transaction, Alert, Verification, Recall } = require('../models');
const serializationService = require('../services/serializationService');
const qrcodeService = require('../services/qrcodeService');

async function seed() {
  try {
    console.log('🌱 Starting database seed...\n');
    await sequelize.sync({ force: true });
    console.log('✅ Database tables created.\n');

    // ============================================
    // 1. Manufacturers
    // ============================================
    await Manufacturer.create({
      manufacturer_id: 'MFR-PFZ-001', company_name: 'Pfizer India Limited',
      license_number: 'LIC-PFZ-2024-001', address: 'Pfizer Complex, Village Thokarpur',
      city: 'Mumbai', state: 'Maharashtra', country: 'India',
      contact_email: 'contact@pfizerindia.com', contact_phone: '+91-22-6693-4444', status: 'active'
    });
    await Manufacturer.create({
      manufacturer_id: 'MFR-CIP-001', company_name: 'Cipla Limited',
      license_number: 'LIC-CIP-2024-001', address: 'Cipla House, Peninsula Business Park',
      city: 'Mumbai', state: 'Maharashtra', country: 'India',
      contact_email: 'contact@cipla.com', contact_phone: '+91-22-2482-6000', status: 'active'
    });
    console.log('✅ 2 Manufacturers created');

    // ============================================
    // 2. Products
    // ============================================
    await Product.create({
      product_id: 'PROD-ASP-500', manufacturer_id: 'MFR-PFZ-001',
      product_name: 'Aspirin', generic_name: 'Acetylsalicylic Acid',
      gtin: '05412345678900', strength: '500mg', dosage_form: 'Tablet',
      packaging: '10 tablets per strip', registration_number: 'REG-IND-2024-001', approved_by: 'CDSCO'
    });
    await Product.create({
      product_id: 'PROD-AMX-250', manufacturer_id: 'MFR-CIP-001',
      product_name: 'Amoxicillin', generic_name: 'Amoxicillin Trihydrate',
      gtin: '05412345678917', strength: '250mg', dosage_form: 'Capsule',
      packaging: '10 capsules per strip', registration_number: 'REG-IND-2024-002', approved_by: 'CDSCO'
    });
    console.log('✅ 2 Products created');

    // ============================================
    // 3. Supply Chain Actors (Middlemen + Pharmacies)
    // ============================================
    await SupplyChainActor.create({
      actor_id: 'WHSL-DEL-001', actor_type: 'wholesaler',
      company_name: 'MedSupply Wholesale Delhi', license_number: 'LIC-WHSL-DEL-2024-001',
      address: 'Plot 45, Kirti Nagar Industrial Area', city: 'New Delhi', state: 'Delhi', country: 'India',
      contact_person: 'Amit Sharma', contact_email: 'amit@medsupply.in', contact_phone: '+91-11-2345-6789',
      latitude: 28.6567, longitude: 77.1456
    });
    await SupplyChainActor.create({
      actor_id: 'DIST-BLR-001', actor_type: 'distributor',
      company_name: 'FastTrack Distributors', license_number: 'LIC-DIST-BLR-2024-001',
      address: 'Unit 7, Electronic City Phase 2', city: 'Bangalore', state: 'Karnataka', country: 'India',
      contact_person: 'Vikram Nair', contact_email: 'vikram@fasttrack.in', contact_phone: '+91-80-2345-6789',
      latitude: 12.8399, longitude: 77.6770
    });
    await SupplyChainActor.create({
      actor_id: 'PHARM-DEL-001', actor_type: 'pharmacy',
      company_name: 'Apollo Pharmacy - Connaught Place', license_number: 'LIC-PHARM-DEL-2024-001',
      address: 'N-19, Connaught Place', city: 'New Delhi', state: 'Delhi', country: 'India',
      contact_person: 'Rajesh Kumar', contact_email: 'rajesh@apollopharmacy.in', contact_phone: '+91-11-2334-5678',
      latitude: 28.6328, longitude: 77.2197
    });
    await SupplyChainActor.create({
      actor_id: 'PHARM-MUM-001', actor_type: 'pharmacy',
      company_name: 'MedPlus Pharmacy - Bandra', license_number: 'LIC-PHARM-MUM-2024-001',
      address: 'Shop 12, Hill Road, Bandra West', city: 'Mumbai', state: 'Maharashtra', country: 'India',
      contact_person: 'Priya Desai', contact_email: 'priya@medplus.in', contact_phone: '+91-22-2640-1234',
      latitude: 19.0544, longitude: 72.8363
    });
    console.log('✅ 4 Supply Chain Actors (2 middlemen + 2 pharmacies)');

    // ============================================
    // 4. Users (all password: password123)
    // ============================================
    const passwordHash = await bcrypt.hash('password123', 10);

    const users = [
      { user_id: 'USER-MFR-001', username: 'pfizer_admin', email: 'admin@pfizer.com', role: 'manufacturer', manufacturer_id: 'MFR-PFZ-001', full_name: 'John Doe', phone: '+91-22-1234-5678' },
      { user_id: 'USER-MFR-002', username: 'cipla_admin', email: 'admin@cipla.com', role: 'manufacturer', manufacturer_id: 'MFR-CIP-001', full_name: 'Jane Smith', phone: '+91-22-2482-6001' },
      { user_id: 'USER-MID-001', username: 'wholesaler_delhi', email: 'amit@medsupply.in', role: 'middleman', actor_id: 'WHSL-DEL-001', full_name: 'Amit Sharma', phone: '+91-11-2345-6789' },
      { user_id: 'USER-MID-002', username: 'distributor_blr', email: 'vikram@fasttrack.in', role: 'middleman', actor_id: 'DIST-BLR-001', full_name: 'Vikram Nair', phone: '+91-80-2345-6789' },
      { user_id: 'USER-PHR-001', username: 'pharmacy_delhi', email: 'rajesh@apollopharmacy.in', role: 'pharmacy', actor_id: 'PHARM-DEL-001', full_name: 'Rajesh Kumar', phone: '+91-11-2334-5678' },
      { user_id: 'USER-PHR-002', username: 'pharmacy_mumbai', email: 'priya@medplus.in', role: 'pharmacy', actor_id: 'PHARM-MUM-001', full_name: 'Priya Desai', phone: '+91-22-2640-1234' },
      { user_id: 'USER-REG-001', username: 'regulator_admin', email: 'admin@cdsco.gov.in', role: 'regulator', full_name: 'Dr. Regulatory Officer', phone: '+91-11-2345-0000' },
      { user_id: 'USER-ADM-001', username: 'super_admin', email: 'admin@meditrack.in', role: 'admin', full_name: 'System Admin', phone: '+91-00-0000-0000' }
    ];

    for (const u of users) {
      await User.create({ ...u, password_hash: passwordHash });
    }
    console.log('✅ 8 Users created (2 mfr, 2 middlemen, 2 pharmacy, 1 regulator, 1 admin)');

    // ============================================
    // 5. Serial Numbers + Boxes
    // ============================================
    console.log('\n📦 Generating serial numbers...');

    const serialNumbers = await serializationService.generateSerialNumbers(
      'PROD-ASP-500', 200, 'BATCH-2026-001', 'PFZ', 'ASP', '2026-01-01', '2028-06-01'
    );
    const { boxes, boxContents } = await serializationService.generateBoxes(
      serialNumbers, 'BATCH-2026-001', 'PROD-ASP-500', '2026-01-01', '2028-06-01'
    );

    for (const sn of serialNumbers) {
      const qr = await qrcodeService.generateDataMatrix('05412345678900', sn.serial_number, '280601', 'BATCH-2026-001');
      sn.gs1_data = qr.gs1Data;
      sn.qr_code_url = qr.qrCodeImage;
    }

    await Box.bulkCreate(boxes);
    await SerialNumber.bulkCreate(serialNumbers);
    await BoxContent.bulkCreate(boxContents);
    console.log(`✅ ${serialNumbers.length} serial numbers in ${boxes.length} boxes`);

    // ============================================
    // 6. FULL SUPPLY CHAIN FLOW
    // ============================================
    console.log('\n🚛 Building supply chain transactions...');
    const oneDay = 86400000;
    const box1 = boxes[0];
    const box2 = boxes[1];

    // All serials manufactured
    await Transaction.bulkCreate(serialNumbers.map(sn => ({
      serial_number: sn.serial_number, transaction_type: 'manufacture',
      from_actor_id: 'MFR-PFZ-001', scanned_by: 'SYSTEM'
    })));

    // --- Box1: COMPLETE CHAIN (Mfr → Wholesaler → Distributor → Pharmacy) ---
    // Manufacturer ships
    await Transaction.create({ box_id: box1.box_id, transaction_type: 'ship', from_actor_id: 'MFR-PFZ-001', to_actor_id: 'WHSL-DEL-001', scanned_by: 'SYSTEM', transaction_date: new Date(Date.now() - 5 * oneDay), location_lat: 19.076, location_lon: 72.877 });
    // Wholesaler receives
    await Transaction.create({ box_id: box1.box_id, transaction_type: 'receive', to_actor_id: 'WHSL-DEL-001', scanned_by: 'USER-MID-001', transaction_date: new Date(Date.now() - 4 * oneDay), location_lat: 28.656, location_lon: 77.145 });
    // Wholesaler ships to Distributor
    await Transaction.create({ box_id: box1.box_id, transaction_type: 'ship', from_actor_id: 'WHSL-DEL-001', to_actor_id: 'DIST-BLR-001', scanned_by: 'USER-MID-001', transaction_date: new Date(Date.now() - 3 * oneDay), location_lat: 28.656, location_lon: 77.145 });
    // Distributor receives
    await Transaction.create({ box_id: box1.box_id, transaction_type: 'receive', to_actor_id: 'DIST-BLR-001', scanned_by: 'USER-MID-002', transaction_date: new Date(Date.now() - 2 * oneDay), location_lat: 12.839, location_lon: 77.677 });
    // Distributor ships to Pharmacy
    await Transaction.create({ box_id: box1.box_id, transaction_type: 'ship', from_actor_id: 'DIST-BLR-001', to_actor_id: 'PHARM-DEL-001', scanned_by: 'USER-MID-002', transaction_date: new Date(Date.now() - 1 * oneDay), location_lat: 12.839, location_lon: 77.677 });
    // Pharmacy receives
    await Transaction.create({ box_id: box1.box_id, transaction_type: 'receive', to_actor_id: 'PHARM-DEL-001', scanned_by: 'USER-PHR-001', transaction_date: new Date(Date.now() - 0.5 * oneDay), location_lat: 28.632, location_lon: 77.219 });

    // Update serial statuses
    await Box.update({ status: 'at_pharmacy' }, { where: { box_id: box1.box_id } });
    await SerialNumber.update({ status: 'at_pharmacy', current_location: 'PHARM-DEL-001' }, { where: { box_id: box1.box_id } });
    console.log('  ✅ Box1: Manufacturer → Wholesaler → Distributor → Pharmacy (COMPLETE)');

    // --- Box2: PARTIAL CHAIN (at Wholesaler stage) ---
    await Transaction.create({ box_id: box2.box_id, transaction_type: 'ship', from_actor_id: 'MFR-PFZ-001', to_actor_id: 'WHSL-DEL-001', scanned_by: 'SYSTEM', transaction_date: new Date(Date.now() - 2 * oneDay) });
    await Transaction.create({ box_id: box2.box_id, transaction_type: 'receive', to_actor_id: 'WHSL-DEL-001', scanned_by: 'USER-MID-001', transaction_date: new Date(Date.now() - 1 * oneDay) });
    await Box.update({ status: 'at_middleman' }, { where: { box_id: box2.box_id } });
    await SerialNumber.update({ status: 'at_middleman', current_location: 'WHSL-DEL-001' }, { where: { box_id: box2.box_id } });
    console.log('  ✅ Box2: Manufacturer → Wholesaler (IN PROGRESS)');

    // ============================================
    // 7. Alerts & Complaints
    // ============================================
    await Alert.bulkCreate([
      { alert_id: 'ALERT-001', alert_type: 'middleman_report', actor_id: 'WHSL-DEL-001', severity: 'high', description: 'Suspicious box detected — seal appears tampered. Box labels look reprinted.', status: 'new' },
      { alert_id: 'ALERT-002', alert_type: 'duplicate_scan', serial_number: '2026-PFZ-ASP-0000005', severity: 'critical', description: 'Serial scanned from two locations within 10 minutes — possible clone detected.', status: 'new' },
      { alert_id: 'ALERT-003', alert_type: 'geographic_anomaly', serial_number: '2026-PFZ-ASP-0000010', actor_id: 'PHARM-MUM-001', severity: 'medium', description: 'Medicine routed Delhi→Bangalore but arrived in Mumbai — unexpected diversion.', status: 'investigating' },
      { alert_id: 'ALERT-004', alert_type: 'middleman_report', actor_id: 'DIST-BLR-001', severity: 'high', description: 'Batch contents may not match outer packaging. Labels appear misaligned.', status: 'new' },
      { alert_id: 'ALERT-005', alert_type: 'velocity_attack', severity: 'critical', description: 'Same serial scanned at 3 pharmacies in 24 hours — clone attack suspected.', status: 'new' }
    ]);
    console.log('✅ 5 alerts created');

    // ============================================
    // 8. Verifications (for analytics charts)
    // ============================================
    const verifications = [];
    for (let d = 6; d >= 0; d--) {
      const date = new Date(Date.now() - d * oneDay);
      const count = 5 + Math.floor(Math.random() * 15);
      for (let i = 0; i < count; i++) {
        const snIdx = Math.floor(Math.random() * 100);
        verifications.push({
          serial_number: serialNumbers[snIdx]?.serial_number || '2026-PFZ-ASP-0000001',
          requested_by: 'PATIENT', verification_result: Math.random() > 0.15 ? 'valid' : 'invalid',
          failure_reason: Math.random() > 0.15 ? null : 'duplicate_scan',
          request_timestamp: date, ip_address: '192.168.1.' + Math.floor(Math.random() * 255),
          location_lat: 28.6 + Math.random() * 0.1, location_lon: 77.2 + Math.random() * 0.1
        });
      }
    }
    await Verification.bulkCreate(verifications);
    console.log(`✅ ${verifications.length} verifications created`);

    // ============================================
    // 9. Recall
    // ============================================
    await Recall.create({
      recall_id: 'RECALL-2026-001', product_id: 'PROD-AMX-250',
      batch_numbers: ['BATCH-AMX-2026-001'], recall_reason: 'Potential contamination detected during quality testing.',
      recall_date: new Date(Date.now() - 3 * oneDay), recall_type: 'mandatory',
      severity: 'class_1', affected_count: 0, status: 'active'
    });
    console.log('✅ 1 recall created');

    // ============================================
    // SUMMARY
    // ============================================
    console.log('\n========================================');
    console.log('🎉 SEED COMPLETE!');
    console.log('========================================');
    console.log('\nAccounts (password: password123):');
    console.log('  Manufacturer: admin@pfizer.com / admin@cipla.com');
    console.log('  Middleman:    amit@medsupply.in / vikram@fasttrack.in');
    console.log('  Pharmacy:     rajesh@apollopharmacy.in / priya@medplus.in');
    console.log('  Regulator:    admin@cdsco.gov.in');
    console.log('  Admin:        admin@meditrack.in');
    console.log(`\n  ${serialNumbers.length} serials, ${boxes.length} boxes`);
    console.log('  Full chain: Mfr → Wholesaler → Distributor → Pharmacy');
    console.log('  5 alerts, 1 recall, ' + verifications.length + ' verifications');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();

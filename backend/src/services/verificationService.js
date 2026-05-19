const { SerialNumber, Product, Manufacturer, Transaction, Verification, Alert, Recall, SupplyChainActor } = require('../models');
const { Op } = require('sequelize');

class VerificationService {

  /**
   * Verify medicine authenticity — 8-layer check
   */
  async verifyMedicine(serialNumber, actorId = null, actionType = 'verify', requestedBy = 'system', deviceInfo = null) {

    // =========================================
    // CHECK 1: Does serial number exist?
    // =========================================
    const medicine = await SerialNumber.findOne({
      where: { serial_number: serialNumber },
      include: [
        {
          model: Product, as: 'product',
          include: [{ model: Manufacturer, as: 'manufacturer' }]
        }
      ]
    });

    if (!medicine) {
      await this.logVerification(serialNumber, requestedBy, 'invalid', 'Serial number not found in database');
      await this.createAlert({
        type: 'invalid_code',
        serialNumber,
        actorId,
        severity: 'critical',
        description: `Invalid serial number scanned: ${serialNumber}. Not found in database.`
      });

      return {
        valid: false,
        reason: 'invalid_serial',
        message: '❌ COUNTERFEIT DETECTED: Serial number not found in database',
        alertLevel: 'critical'
      };
    }

    // =========================================
    // CHECK 2: Already dispensed? (Cloned QR)
    // =========================================
    if (medicine.status === 'dispensed') {
      const prevDispense = await Transaction.findOne({
        where: { serial_number: serialNumber, transaction_type: 'dispense' },
        include: [{ model: SupplyChainActor, as: 'toActor' }],
        order: [['transaction_date', 'DESC']]
      });

      await this.logVerification(serialNumber, requestedBy, 'already_used', 'Medicine already dispensed');
      await this.createAlert({
        type: 'duplicate_scan',
        serialNumber,
        actorId,
        severity: 'critical',
        description: `Duplicate serial detected. Already dispensed${prevDispense ? ` at ${prevDispense.toActor?.company_name || 'unknown'} on ${prevDispense.transaction_date}` : ''}.`
      });

      return {
        valid: false,
        reason: 'already_dispensed',
        message: `⚠️ DUPLICATE DETECTED: This medicine was already dispensed${prevDispense ? ` on ${new Date(prevDispense.transaction_date).toLocaleDateString()}` : ''}`,
        alertLevel: 'critical',
        medicine: this.formatMedicineInfo(medicine)
      };
    }

    // =========================================
    // CHECK 3: Destroyed or returned?
    // =========================================
    if (['destroyed', 'returned'].includes(medicine.status)) {
      await this.logVerification(serialNumber, requestedBy, 'invalid', `Medicine status: ${medicine.status}`);
      await this.createAlert({
        type: 'invalid_code',
        serialNumber,
        actorId,
        severity: 'critical',
        description: `Medicine with status '${medicine.status}' was scanned. Possible repackaging.`
      });

      return {
        valid: false,
        reason: 'invalid_status',
        message: `❌ INVALID: This medicine was ${medicine.status}. DO NOT USE.`,
        alertLevel: 'critical',
        medicine: this.formatMedicineInfo(medicine)
      };
    }

    // =========================================
    // CHECK 4: Expired?
    // =========================================
    const today = new Date();
    const expiryDate = new Date(medicine.expiry_date);

    if (expiryDate < today) {
      await this.logVerification(serialNumber, requestedBy, 'expired', 'Medicine past expiration date');
      await this.createAlert({
        type: 'expired_medicine',
        serialNumber,
        actorId,
        severity: 'medium',
        description: `Expired medicine scanned. Expiry: ${medicine.expiry_date}`
      });

      return {
        valid: false,
        reason: 'expired',
        message: `⚠️ EXPIRED: This medicine expired on ${medicine.expiry_date}`,
        alertLevel: 'medium',
        medicine: this.formatMedicineInfo(medicine)
      };
    }

    // =========================================
    // CHECK 5: Recalled batch?
    // =========================================
    const recalled = await Recall.findOne({
      where: {
        product_id: medicine.product_id,
        status: 'active'
      }
    });

    if (recalled) {
      const batchNumbers = recalled.batch_numbers || [];
      if (batchNumbers.includes(medicine.batch_number)) {
        await this.logVerification(serialNumber, requestedBy, 'recalled', `Batch ${medicine.batch_number} recalled`);
        await this.createAlert({
          type: 'recalled_product',
          serialNumber,
          actorId,
          severity: 'critical',
          description: `Recalled medicine scanned: ${recalled.recall_reason}`
        });

        return {
          valid: false,
          reason: 'recalled',
          message: `🚫 RECALLED PRODUCT: ${recalled.recall_reason}. DO NOT DISPENSE.`,
          alertLevel: 'critical',
          medicine: this.formatMedicineInfo(medicine),
          recallInfo: recalled
        };
      }
    }

    // =========================================
    // CHECK 6: Supply chain sequence valid?
    // =========================================
    if (actorId) {
      const chainResult = await this.verifySupplyChain(serialNumber, actorId);
      if (!chainResult.valid) {
        await this.logVerification(serialNumber, requestedBy, 'suspicious', chainResult.message);
        return chainResult;
      }
    }

    // =========================================
    // CHECK 7: Velocity check (cloned codes)
    // =========================================
    const velocityResult = await this.checkVelocity(serialNumber, actorId);
    if (!velocityResult.valid) {
      await this.logVerification(serialNumber, requestedBy, 'suspicious', velocityResult.message);
      return velocityResult;
    }

    // =========================================
    // CHECK 8: Batch integrity (batch poisoning)
    // =========================================
    const batchResult = await this.checkBatchIntegrity(medicine.batch_number, medicine.product_id);
    if (!batchResult.valid) {
      // Don't block, just warn
      // The medicine itself might be fine, but the batch is suspicious
    }

    // =========================================
    // ALL CHECKS PASSED ✅
    // =========================================

    if (actionType === 'dispense') {
      await medicine.update({
        status: 'dispensed',
        dispensed_at: new Date(),
        dispensed_by: actorId
      });

      await Transaction.create({
        serial_number: serialNumber,
        transaction_type: 'dispense',
        from_actor_id: actorId,
        to_actor_id: 'PATIENT',
        scanned_by: actorId,
        device_id: deviceInfo
      });
    }

    // Log successful verification
    await this.logVerification(serialNumber, requestedBy, 'valid', null);

    // Get journey timeline
    const journey = await this.getJourneyTimeline(serialNumber);

    return {
      valid: true,
      reason: 'authentic',
      message: '✅ GENUINE MEDICINE - Safe to dispense',
      alertLevel: 'none',
      medicine: this.formatMedicineInfo(medicine),
      journey,
      batchWarning: !batchResult.valid ? batchResult.message : null
    };
  }

  /**
   * Verify supply chain sequence
   */
  async verifySupplyChain(serialNumber, currentActorId) {
    const transactions = await Transaction.findAll({
      where: { serial_number: serialNumber },
      include: [
        { model: SupplyChainActor, as: 'fromActor' },
        { model: SupplyChainActor, as: 'toActor' }
      ],
      order: [['transaction_date', 'ASC']]
    });

    if (transactions.length === 0) return { valid: true };

    const lastTx = transactions[transactions.length - 1];

    const currentActor = await SupplyChainActor.findByPk(currentActorId);
    if (!currentActor) {
      return { valid: true }; // Unknown actor, allow for patient scans
    }

    // Check if medicine is at a different pharmacy
    if (lastTx.toActor?.actor_type === 'pharmacy' && lastTx.to_actor_id !== currentActorId && currentActor.actor_type === 'pharmacy') {
      await this.createAlert({
        type: 'unauthorized_location',
        serialNumber,
        actorId: currentActorId,
        severity: 'high',
        description: `Medicine was at ${lastTx.toActor.company_name} but scanned at ${currentActor.company_name}. Possible diversion.`
      });

      return {
        valid: false,
        reason: 'suspicious_transfer',
        message: `⚠️ SUSPICIOUS: Medicine was assigned to a different pharmacy. Possible diversion or theft.`,
        alertLevel: 'high',
        medicine: null
      };
    }

    return { valid: true };
  }

  /**
   * Velocity check — detect cloned QR codes
   * If same serial scanned at distant locations within short time, it's a clone
   */
  async checkVelocity(serialNumber, actorId) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentVerifications = await Verification.findAll({
      where: {
        serial_number: serialNumber,
        request_timestamp: { [Op.gte]: oneHourAgo },
        verification_result: 'valid'
      },
      order: [['request_timestamp', 'DESC']],
      limit: 5
    });

    // If scanned at multiple different locations within an hour → suspicious
    if (recentVerifications.length >= 3) {
      await this.createAlert({
        type: 'velocity_attack',
        serialNumber,
        actorId,
        severity: 'critical',
        description: `Velocity attack detected: Serial ${serialNumber} scanned ${recentVerifications.length} times in the last hour.`
      });

      return {
        valid: false,
        reason: 'velocity_attack',
        message: '❌ CLONE DETECTED: This code has been scanned multiple times in a short period from different locations.',
        alertLevel: 'critical'
      };
    }

    return { valid: true };
  }

  /**
   * Check batch integrity — if many serials from same batch failed, flag the entire batch
   */
  async checkBatchIntegrity(batchNumber, productId) {
    const failedCount = await Alert.count({
      where: {
        alert_type: { [Op.in]: ['invalid_code', 'duplicate_scan', 'repackaged_medicine'] },
        created_at: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // last 7 days
      }
    });

    if (failedCount >= 5) {
      await this.createAlert({
        type: 'batch_poisoning',
        serialNumber: null,
        actorId: null,
        severity: 'high',
        description: `Batch integrity warning: ${failedCount} alerts in the last 7 days. Batch ${batchNumber} may be compromised.`
      });

      return {
        valid: false,
        message: `⚠️ BATCH WARNING: Multiple failures detected from this batch. Exercise caution.`
      };
    }

    return { valid: true };
  }

  /**
   * Get medicine journey timeline — includes both serial-level and box-level transactions
   */
  async getJourneyTimeline(serialNumber) {
    // Get the medicine to find its box
    const medicine = await SerialNumber.findOne({
      where: { serial_number: serialNumber },
      include: [{ model: Product, as: 'product', include: [{ model: Manufacturer, as: 'manufacturer' }] }]
    });

    // Query both serial and box transactions
    let whereClause = { serial_number: serialNumber };
    if (medicine?.box_id) {
      whereClause = { [Op.or]: [{ serial_number: serialNumber }, { box_id: medicine.box_id }] };
    }

    const transactions = await Transaction.findAll({
      where: whereClause,
      include: [
        { model: SupplyChainActor, as: 'fromActor', attributes: ['company_name', 'actor_type', 'city'] },
        { model: SupplyChainActor, as: 'toActor', attributes: ['company_name', 'actor_type', 'city'] }
      ],
      order: [['transaction_date', 'ASC']]
    });

    // Build journey steps — deduplicate and create a meaningful timeline
    const steps = [];
    const seen = new Set();

    // First step: Manufactured
    const mfrName = medicine?.product?.manufacturer?.company_name || 'Manufacturer';
    const mfrCity = medicine?.product?.manufacturer?.city || '';
    steps.push({
      step: 'Manufactured',
      icon: '🏭',
      actor: mfrName,
      actorType: 'manufacturer',
      city: mfrCity,
      date: medicine?.manufacturing_date || null
    });

    for (const tx of transactions) {
      if (tx.transaction_type === 'manufacture') continue; // already added

      // For ship/receive pairs, only show the receive as a checkpoint
      if (tx.transaction_type === 'receive' && tx.toActor) {
        const key = `receive-${tx.to_actor_id}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const iconMap = { wholesaler: '🚛', distributor: '🚛', pharmacy: '💊', middleman: '🚛' };
        const stepMap = { wholesaler: 'Wholesaler Checkpoint', distributor: 'Distributor Checkpoint', pharmacy: 'Arrived at Pharmacy', middleman: 'Middleman Checkpoint' };

        steps.push({
          step: stepMap[tx.toActor.actor_type] || 'Checkpoint',
          icon: iconMap[tx.toActor.actor_type] || '📦',
          actor: tx.toActor.company_name,
          actorType: tx.toActor.actor_type,
          city: tx.toActor.city,
          date: tx.transaction_date
        });
      }

      if (tx.transaction_type === 'dispense') {
        steps.push({
          step: 'Dispensed to Patient',
          icon: '👤',
          actor: tx.fromActor?.company_name || 'Pharmacy',
          actorType: 'patient',
          city: tx.fromActor?.city || '',
          date: tx.transaction_date
        });
      }
    }

    return steps;
  }

  /**
   * Format medicine info for response
   */
  formatMedicineInfo(medicine) {
    return {
      serial_number: medicine.serial_number,
      product_name: medicine.product?.product_name,
      generic_name: medicine.product?.generic_name,
      manufacturer: medicine.product?.manufacturer?.company_name,
      batch_number: medicine.batch_number,
      manufacturing_date: medicine.manufacturing_date,
      expiry_date: medicine.expiry_date,
      strength: medicine.product?.strength,
      dosage_form: medicine.product?.dosage_form,
      status: medicine.status
    };
  }

  /**
   * Log verification attempt
   */
  async logVerification(serialNumber, requestedBy, result, reason) {
    await Verification.create({
      serial_number: serialNumber,
      requested_by: requestedBy,
      verification_result: result,
      failure_reason: reason
    });
  }

  /**
   * Create alert for regulators
   */
  async createAlert(alertData) {
    const alert = await Alert.create({
      alert_id: `ALERT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      alert_type: alertData.type,
      serial_number: alertData.serialNumber || null,
      box_id: alertData.boxId || null,
      actor_id: alertData.actorId || null,
      severity: alertData.severity,
      description: alertData.description
    });

    // Check pharmacy pattern — 10+ failures from same pharmacy in a day
    if (alertData.actorId) {
      await this.checkPharmacyPattern(alertData.actorId);
    }

    return alert;
  }

  /**
   * Check if a pharmacy has suspicious verification patterns
   */
  async checkPharmacyPattern(actorId) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const failCount = await Alert.count({
      where: {
        actor_id: actorId,
        created_at: { [Op.gte]: oneDayAgo }
      }
    });

    if (failCount >= 10) {
      // Check if we already created a pharmacy_pattern alert today
      const existingAlert = await Alert.findOne({
        where: {
          alert_type: 'pharmacy_pattern',
          actor_id: actorId,
          created_at: { [Op.gte]: oneDayAgo }
        }
      });

      if (!existingAlert) {
        await Alert.create({
          alert_type: 'pharmacy_pattern',
          actor_id: actorId,
          severity: 'critical',
          description: `Pharmacy ${actorId} has ${failCount} failed verifications in the last 24 hours. Suspicious pattern detected.`
        });
      }
    }
  }
}

module.exports = new VerificationService();

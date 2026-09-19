const mongoose = require('mongoose');
const Fpo = require('../models/Fpo');
const User = require('../models/User');
const Farmer = require('../models/Farmer');
const Batch = require('../models/Batch');
const Inventory = require('../models/Inventory');
const Payout = require('../models/Payout');
const StockMovement = require('../models/StockMovement');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const csv = require('csv-parser');
const QRCode = require('qrcode');
const { notify } = require('../utils/notify');
const GradePriceConfig = require('../models/GradePriceConfig');
const FpoOrder = require('../models/FpoOrder');
const Listing = require('../models/Listing');

// Helper function to resolve FPO ID for logged-in user
const getFpoIdForUser = async (userId) => {
  if (!userId) return null;
  const fpo = await Fpo.findOne({
    $or: [{ adminUser: userId }, { staff: userId }],
  });
  return fpo ? fpo._id : null;
};

// 1. Register a new FPO Profile
exports.registerFpo = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { name, registrationNumber, contactDetails } = req.body;

    // FIX: prevent an admin from ending up with more than one FPO profile.
    const existingForAdmin = await Fpo.findOne({ adminUser: userId });
    if (existingForAdmin) {
      return res.status(400).json({ message: 'You already have an FPO profile registered.' });
    }

    const existingFpo = await Fpo.findOne({ registrationNumber });
    if (existingFpo) {
      return res.status(400).json({ message: 'FPO with this registration number already exists.' });
    }

    const fpo = await Fpo.create({
      name,
      registrationNumber,
      contactDetails,
      adminUser: userId,
    });

    res.status(201).json({ message: 'FPO registered successfully', fpo });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 2. Get Logged-in FPO Profile
exports.getFpoProfile = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpo = await Fpo.findOne({
      $or: [{ adminUser: userId }, { staff: userId }],
    }).populate('adminUser staff', 'name email role location');

    if (!fpo) {
      return res.status(200).json(null);
    }

    res.json(fpo);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 3. Upload KYC Documents
exports.uploadKyc = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpo = await Fpo.findOne({ adminUser: userId });

    if (!fpo) {
      return res.status(404).json({ message: 'FPO profile not found.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No documents uploaded.' });
    }

    const documentPaths = req.files.map((file) => file.path);
    fpo.kycDocuments.push(...documentPaths);
    fpo.kycStatus = 'Pending';
    await fpo.save();

    res.json({ message: 'KYC documents uploaded successfully', fpo });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 4. Add Staff Member to FPO
exports.addStaff = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { name, email, password, location } = req.body;

    const fpo = await Fpo.findOne({ adminUser: userId });
    if (!fpo) {
      return res.status(404).json({ message: 'FPO not found or unauthorized.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const staffUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'fpo_staff',
      location,
    });

    fpo.staff.push(staffUser._id);
    await fpo.save();

    res.status(201).json({ message: 'Staff user created and added to FPO successfully', staffUser });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 5. Add / Register Single Farmer
exports.addFarmer = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) {
      return res.status(400).json({ message: 'Associated FPO profile not found. Please register FPO profile first.' });
    }

    const { name, phone, aadhaarNumber, address, bankDetails } = req.body;

    const farmer = await Farmer.create({
      fpo: fpoId,
      name,
      phone,
      aadhaarNumber,
      address,
      bankDetails,
    });

    await notify(fpoId, 'NewFarmer', `New farmer registered: ${farmer.name}.`, { farmerId: farmer._id });

    res.status(201).json({ message: 'Farmer registered successfully', farmer });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// NEW: Toggle Farmer Verification (separate from active/inactive status)
exports.toggleFarmerVerification = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) {
      return res.status(400).json({ message: 'Associated FPO profile not found.' });
    }

    const { farmerId } = req.params;
    const farmer = await Farmer.findOne({ _id: farmerId, fpo: fpoId });
    if (!farmer) {
      return res.status(404).json({ message: 'Farmer not found.' });
    }

    farmer.isVerified = !farmer.isVerified;
    await farmer.save();

    res.json({ message: `Farmer ${farmer.isVerified ? 'verified' : 'unverified'}`, farmer });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// NEW: Farmer profile + history (produce batches + payouts).
// NOTE: once produce is graded it merges into pooled Inventory by
// produceType+grade, so exact per-farmer "sales" can't be attributed after
// that point — this returns the farmer's batch and payout history instead,
// which is what's actually traceable in the current data model.
exports.getFarmerDetail = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) {
      return res.status(400).json({ message: 'Associated FPO profile not found.' });
    }

    const { farmerId } = req.params;
    const farmer = await Farmer.findOne({ _id: farmerId, fpo: fpoId });
    if (!farmer) {
      return res.status(404).json({ message: 'Farmer not found.' });
    }

    const batches = await Batch.find({ fpo: fpoId, farmer: farmerId }).sort({ createdAt: -1 });
    const payouts = await Payout.find({ fpo: fpoId, farmer: farmerId }).populate('batch', 'batchId').sort({ createdAt: -1 });

    const totalIntakeKg = batches.reduce((sum, b) => sum + b.rawQuantityKg, 0);
    const totalPaid = payouts.filter((p) => p.status === 'Completed').reduce((sum, p) => sum + p.amount, 0);

    res.json({ farmer, batches, payouts, totalIntakeKg, totalPaid });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 6. Get All Farmers Assigned to FPO
exports.getFarmers = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) {
      return res.json([]); // Return empty array if no FPO profile exists yet
    }

    const farmers = await Farmer.find({ fpo: fpoId });
    res.json(farmers);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 7. Toggle Farmer Active / Inactive Status
exports.toggleFarmerStatus = async (req, res) => {
  try {
    // FIX (IDOR): scope the lookup to the caller's own FPO instead of a bare
    // findById, so one FPO's admin/staff can't toggle another FPO's farmer.
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) {
      return res.status(400).json({ message: 'Associated FPO profile not found.' });
    }

    const { farmerId } = req.params;
    const farmer = await Farmer.findOne({ _id: farmerId, fpo: fpoId });

    if (!farmer) {
      return res.status(404).json({ message: 'Farmer not found.' });
    }

    farmer.isActive = !farmer.isActive;
    await farmer.save();

    res.json({ message: `Farmer status updated to ${farmer.isActive ? 'Active' : 'Inactive'}`, farmer });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 8. Bulk Import Farmers from CSV File
exports.importFarmersCsv = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) {
      return res.status(400).json({ message: 'Associated FPO profile not found.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a CSV file.' });
    }

    const farmersToInsert = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row) => {
        if (row.name && row.phone) {
          farmersToInsert.push({
            fpo: fpoId,
            name: row.name,
            phone: row.phone,
            aadhaarNumber: row.aadhaarNumber || '',
            address: row.address || '',
            bankDetails: {
              accountNumber: row.accountNumber || '',
              ifscCode: row.ifscCode || '',
              bankName: row.bankName || '',
            },
          });
        }
      })
      .on('end', async () => {
        // FIX: this async callback now has its own try/catch. Previously,
        // any insertMany failure here became an unhandled promise rejection
        // that left the request hanging (or could crash the process),
        // because the outer try/catch had already returned control once the
        // stream was registered.
        try {
          if (farmersToInsert.length === 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'No valid rows found in CSV (need at least "name" and "phone" columns).' });
          }

          const createdFarmers = await Farmer.insertMany(farmersToInsert, { ordered: false });
          fs.unlinkSync(req.file.path);
          res.status(201).json({
            message: `${createdFarmers.length} farmers imported successfully.`,
            farmers: createdFarmers,
          });
        } catch (insertErr) {
          try { fs.unlinkSync(req.file.path); } catch (_) { /* file may already be gone */ }
          res.status(500).json({ message: 'Failed to import farmers from CSV.', error: insertErr.message });
        }
      })
      .on('error', (streamErr) => {
        // FIX: also handle a broken/corrupt CSV stream itself.
        try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
        res.status(400).json({ message: 'Failed to read CSV file.', error: streamErr.message });
      });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 9. Produce Intake & Batch Creation
exports.createBatchIntake = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) {
      return res.status(400).json({ message: 'Associated FPO profile not found.' });
    }

    const { farmerId, produceType, rawQuantityKg, harvestDate } = req.body;

    // FIX: make sure the farmer being credited actually belongs to this FPO.
    const farmer = await Farmer.findOne({ _id: farmerId, fpo: fpoId });
    if (!farmer) {
      return res.status(404).json({ message: 'Farmer not found for this FPO.' });
    }

    const generatedBatchId = `BATCH-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const qrData = await QRCode.toDataURL(`${frontendBase.replace(/\/$/, '')}/trace/${generatedBatchId}`);

    const batch = await Batch.create({
      batchId: generatedBatchId,
      fpo: fpoId,
      farmer: farmerId,
      produceType,
      rawQuantityKg,
      harvestDate,
      qrCodeUrl: qrData,
    });

    await notify(fpoId, 'NewIntake', `New intake recorded: ${rawQuantityKg}kg of ${produceType} from ${farmer.name}.`, { batchId: batch._id });
    await notify(fpoId, 'GradingPending', `Batch ${generatedBatchId} is awaiting grading.`, { batchId: batch._id });

    res.status(201).json({ message: 'Produce intake batch recorded', batch });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 10. Grade Produce & Update Inventory
exports.gradeBatch = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const batch = await Batch.findOne({ _id: req.params.batchId, fpo: fpoId });
    if (!batch) return res.status(404).json({ message: 'Batch not found.' });

    const a = Number(req.body.gradeA_Kg) || 0;
    const b = Number(req.body.gradeB_Kg) || 0;
    const c = Number(req.body.gradeC_Kg) || 0;
    const score = Number(req.body.qualityScore);
    const status = req.body.status || 'Approved';
    if ([a,b,c].some(v => v < 0)) return res.status(400).json({ message: 'Grade quantities cannot be negative.' });
    if (a + b + c > batch.rawQuantityKg) return res.status(400).json({ message: 'Graded quantity cannot exceed raw intake quantity.' });
    if (!['Pending','Approved','Rejected'].includes(status)) return res.status(400).json({ message: 'Invalid grading status.' });
    if (!Number.isNaN(score) && (score < 0 || score > 100)) return res.status(400).json({ message: 'Quality score must be between 0 and 100.' });

    const old = batch.grading || { gradeA_Kg:0, gradeB_Kg:0, gradeC_Kg:0 };
    let config = null;
    if (status === 'Approved') {
      config = await GradePriceConfig.findOne({ fpo:fpoId, cropName:batch.produceType, isActive:true, effectiveFrom:{$lte:new Date()} }).sort({ effectiveFrom:-1 });
      if (!config) return res.status(400).json({ message:`No active grade pricing configured for ${batch.produceType}. Create a Grade Price Config before approving this batch.` });
    }
    const qualityImages = req.files?.length ? req.files.map(file => file.path) : (old.qualityImages || []);
    const entry = { gradeA_Kg:a, gradeB_Kg:b, gradeC_Kg:c, qualityScore: Number.isNaN(score) ? old.qualityScore : score, qualityImages, status, gradedBy:userId, gradedAt:new Date() };

    // Idempotent inventory sync: remove the previous approved allocation before applying the new one.
    if (old.status === 'Approved') {
      for (const [grade, qty] of [['A',old.gradeA_Kg],['B',old.gradeB_Kg],['C',old.gradeC_Kg]]) {
        if (qty > 0) {
          const inv = await Inventory.findOne({ fpo:fpoId, produceType:batch.produceType, grade });
          if (inv) { inv.totalQuantity = Math.max(0, inv.totalQuantity - qty); await inv.save(); }
          await StockMovement.create({ fpo:fpoId, produceType:batch.produceType, grade, type:'Adjustment', quantityKg:-qty, batch:batch._id, note:'Regrading replaced previous approved allocation' });
        }
      }
    }

    batch.grading = entry;
    batch.gradingHistory.push(entry);

    if (status === 'Approved') {
      batch.pricingSnapshot = { gradeAPricePerKg:config.gradeAPricePerKg, gradeBPricePerKg:config.gradeBPricePerKg, gradeCPricePerKg:config.gradeCPricePerKg, referenceMarketPrice:config.referenceMarketPrice, effectiveFrom:config.effectiveFrom };
      batch.amountOwedToFarmer = a*config.gradeAPricePerKg + b*config.gradeBPricePerKg + c*config.gradeCPricePerKg;
      batch.payoutStatus = batch.payoutStatus === 'PAID' ? 'PAID' : 'PENDING';
    }
    await batch.save();

    if (status === 'Approved') {
      for (const item of [{grade:'A',qty:a},{grade:'B',qty:b},{grade:'C',qty:c}]) {
        if (!item.qty) continue;
        const inv = await Inventory.findOneAndUpdate({fpo:fpoId,produceType:batch.produceType,grade:item.grade},{$inc:{totalQuantity:item.qty}},{upsert:true,new:true});
        await StockMovement.create({ fpo:fpoId,produceType:batch.produceType,grade:item.grade,type:'Intake',quantityKg:item.qty,batch:batch._id,note:'Approved grading allocation' });
        const freeStock = inv.totalQuantity-inv.reservedQuantity-inv.soldQuantity;
        if (freeStock <= inv.minAlertThreshold) await notify(fpoId,'LowInventory',`Low stock: ${batch.produceType} Grade ${item.grade} is at ${freeStock}kg.`,{produceType:batch.produceType,grade:item.grade});
      }
    }
    await notify(fpoId,'GradingUpdate',`Batch ${batch.batchId} graded as A:${a}kg B:${b}kg C:${c}kg. Farmer payout owed: ₹${batch.amountOwedToFarmer||0}.`,{batchId:batch._id});
    res.json({ message:'Batch grading updated, pricing snapshot calculated and inventory synchronized.', batch });
  } catch (error) { res.status(500).json({ message:'Server Error', error:error.message }); }
};

// 11. Get All Batches
exports.getBatches = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) {
      return res.json([]); // Return empty array if no FPO profile exists yet
    }

    const batches = await Batch.find({ fpo: fpoId }).populate('farmer', 'name phone address');
    res.json(batches);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 12. Get Inventory
exports.getInventory = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) {
      return res.json([]); // Return empty array if no FPO profile exists yet
    }

    const inventory = await Inventory.find({ fpo: fpoId });
    res.json(inventory);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// NEW: Stock movement history (Intake / Reserved / Released / Sold / Cancelled / Adjustment)
exports.getStockMovements = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.json([]);

    const movements = await StockMovement.find({ fpo: fpoId }).sort({ createdAt: -1 }).limit(200);
    res.json(movements);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// NEW: Items currently at or below their low-stock threshold
exports.getLowStockAlerts = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.json([]);

    const inventory = await Inventory.find({ fpo: fpoId });
    const low = inventory
      .map((i) => ({
        ...i.toObject(),
        freeStock: i.totalQuantity - i.reservedQuantity - i.soldQuantity,
      }))
      .filter((i) => i.freeStock <= i.minAlertThreshold);

    res.json(low);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// NEW: Preview the grade-based payout owed for a graded batch (no writes)
exports.calculateBatchPayout = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const batch = await Batch.findOne({ _id: req.params.batchId, fpo: fpoId }).populate('farmer', 'name phone address');
    if (!batch) return res.status(404).json({ message: 'Batch not found.' });

    if (!batch.grading || batch.grading.status !== 'Approved') {
      return res.status(400).json({ message: 'Batch must be graded and approved before a payout can be calculated.' });
    }
    if (!batch.pricingSnapshot || batch.pricingSnapshot.gradeAPricePerKg == null) {
      return res.status(400).json({ message: 'No pricing snapshot found on this batch. Re-grade the batch to capture current pricing.' });
    }

    const { gradeA_Kg = 0, gradeB_Kg = 0, gradeC_Kg = 0 } = batch.grading;
    const { gradeAPricePerKg = 0, gradeBPricePerKg = 0, gradeCPricePerKg = 0 } = batch.pricingSnapshot;

    const breakdown = {
      gradeA: { qtyKg: gradeA_Kg, pricePerKg: gradeAPricePerKg, subtotal: gradeA_Kg * gradeAPricePerKg },
      gradeB: { qtyKg: gradeB_Kg, pricePerKg: gradeBPricePerKg, subtotal: gradeB_Kg * gradeBPricePerKg },
      gradeC: { qtyKg: gradeC_Kg, pricePerKg: gradeCPricePerKg, subtotal: gradeC_Kg * gradeCPricePerKg },
    };
    const computedAmount = breakdown.gradeA.subtotal + breakdown.gradeB.subtotal + breakdown.gradeC.subtotal;

    res.json({
      batchId: batch._id,
      batchCode: batch.batchId,
      farmer: batch.farmer,
      produceType: batch.produceType,
      payoutStatus: batch.payoutStatus,
      alreadyPaid: batch.payoutStatus === 'PAID',
      breakdown,
      amountOwedToFarmer: computedAmount,
      pricingSnapshot: batch.pricingSnapshot,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// NEW: Create the payout for a batch directly from its grade-based pricing snapshot
exports.createAutoPayout = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const batch = await Batch.findOne({ _id: req.params.batchId, fpo: fpoId });
    if (!batch) return res.status(404).json({ message: 'Batch not found.' });
    if (!batch.grading || batch.grading.status !== 'Approved') {
      return res.status(400).json({ message: 'Batch must be graded and approved before it can be paid out.' });
    }
    if (batch.payoutStatus === 'PAID') {
      return res.status(400).json({ message: 'This batch has already been paid.' });
    }

    const farmer = await Farmer.findOne({ _id: batch.farmer, fpo: fpoId });
    if (!farmer) return res.status(404).json({ message: 'Farmer not found for this FPO.' });

    const finalAmount = Number(batch.amountOwedToFarmer || 0);
    if (!(finalAmount > 0)) {
      return res.status(400).json({ message: 'Computed payout amount is zero. Check the batch grading and pricing snapshot.' });
    }

    const { paymentMethod = 'BANK_TRANSFER', fundedFrom = 'FPO_CASH', transactionId } = req.body || {};

    const payout = await Payout.create({
      fpo: fpoId,
      farmer: farmer._id,
      batch: batch._id,
      produceIntakeIds: [batch._id],
      amount: finalAmount,
      totalAmount: finalAmount,
      paymentMethod,
      fundedFrom,
      transactionId,
      status: transactionId ? 'Completed' : 'Pending',
      paymentDate: transactionId ? new Date() : undefined,
      paidAt: transactionId ? new Date() : undefined,
    });

    if (payout.status === 'Completed') {
      batch.payoutStatus = 'PAID';
      batch.paidAt = new Date();
      await batch.save();
      await Farmer.findByIdAndUpdate(farmer._id, { $inc: { totalEarnedLifetime: finalAmount } }).catch(() => {});
    }

    await notify(fpoId, 'PayoutUpdate', `Auto-payout of ₹${finalAmount} created for ${farmer.name} from batch ${batch.batchId} (${payout.status}).`, { payoutId: payout._id, batchId: batch._id });

    res.status(201).json({ message: 'Auto payout created from batch grading snapshot.', payout, batch });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 13. Create Farmer Payout
exports.createPayout = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message:'Associated FPO profile not found.' });
    const { farmerId, batchId, amount, transactionId, paymentMethod='BANK_TRANSFER', fundedFrom='FPO_CASH' } = req.body;
    if (!farmerId && !batchId) return res.status(400).json({ message:'batchId is required for automatic grade-based payout calculation.' });
    let batch = null;
    if (batchId) {
      batch = await Batch.findOne({ _id:batchId, fpo:fpoId });
      if (!batch) return res.status(404).json({ message:'Batch not found for this FPO.' });
    }
    const farmer = await Farmer.findOne({ _id:batch?.farmer || farmerId, fpo:fpoId });
    if (!farmer) return res.status(404).json({ message:'Farmer not found for this FPO.' });
    const finalAmount = batch ? Number(batch.amountOwedToFarmer || 0) : Number(amount);
    if (!(finalAmount >= 0)) return res.status(400).json({ message:'A valid payout amount is required.' });
    if (batch && batch.payoutStatus === 'PAID') return res.status(400).json({ message:'This batch has already been paid.' });
    const payout = await Payout.create({ fpo:fpoId, farmer:farmer._id, batch:batch?._id, produceIntakeIds:batch?[batch._id]:[], amount:finalAmount, totalAmount:finalAmount, paymentMethod, fundedFrom, transactionId, status:transactionId?'Completed':'Pending', paymentDate:transactionId?new Date():undefined, paidAt:transactionId?new Date():undefined });
    if (batch && payout.status === 'Completed') { batch.payoutStatus='PAID'; batch.paidAt=new Date(); await batch.save(); await Farmer.findByIdAndUpdate(farmer._id,{$inc:{totalEarnedLifetime:finalAmount}}).catch(()=>{}); }
    await notify(fpoId,'PayoutUpdate',`Payout of ₹${finalAmount} recorded for ${farmer.name} (${payout.status}).`,{payoutId:payout._id});
    res.status(201).json({ message:'Payout recorded using grade-based pricing.', payout });
  } catch(error) { res.status(500).json({ message:'Server Error', error:error.message }); }
};

// 14. Get Payouts
exports.getPayouts = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) {
      return res.json([]); // Return empty array if no FPO profile exists yet
    }

    const payouts = await Payout.find({ fpo: fpoId }).populate('farmer batch');
    res.json(payouts);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 15. Analytics Overview
exports.getAnalytics = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) {
      // Return zeroed metrics with 200 OK so UI loads smoothly
      return res.json({
        totalFarmers: 0,
        totalBatches: 0,
        totalStockKg: 0,
        totalPayoutsDistributed: 0,
      });
    }

    const totalFarmers = await Farmer.countDocuments({ fpo: fpoId });
    const totalBatches = await Batch.countDocuments({ fpo: fpoId });
    const inventoryItems = await Inventory.find({ fpo: fpoId });
    const payouts = await Payout.find({ fpo: fpoId, status: 'Completed' });

    const totalStock = inventoryItems.reduce((acc, item) => acc + (item.totalQuantity || 0), 0);
    const totalPayoutAmount = payouts.reduce((acc, item) => acc + (item.amount || 0), 0);

    res.json({
      totalFarmers,
      totalBatches,
      totalStockKg: totalStock,
      totalPayoutsDistributed: totalPayoutAmount,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 16. Public Digital Produce Passport (Traceability)
// 16. Public Digital Produce Passport (Traceability)
// Accepts both human-readable batchId (BATCH-xxx) and MongoDB _id
exports.getBatchTraceability = async (req, res) => {
  try {
    const { batchId } = req.params;

    // Try human-readable batchId first
    let batch = await Batch.findOne({ batchId })
      .populate('farmer', 'name address village phone')
      .populate('fpo', 'name contactDetails registrationNumber');

    // Fallback: try MongoDB _id if it is a valid ObjectId
    if (!batch && mongoose.Types.ObjectId.isValid(batchId)) {
      batch = await Batch.findById(batchId)
        .populate('farmer', 'name address village phone')
        .populate('fpo', 'name contactDetails registrationNumber');
    }

    if (!batch) {
      return res.status(404).json({ message: 'Traceability passport not found for this Batch ID.' });
    }

    const listings = await Listing.find({
      $or: [{ sourceBatch: batch._id }, { sourceIntakeId: batch._id }],
    }).select('_id produceType grade pricePerKg availableQuantityKg status createdAt');

    const listingIds = listings.map((l) => l._id);
    const orders = listingIds.length
      ? await FpoOrder.find({ listing: { $in: listingIds } })
          .select('_id quantityKg totalPrice status createdAt')
          .sort({ createdAt: -1 })
      : [];

    res.json({
      title: 'Digital Produce Passport',
      batchId: batch.batchId,
      produceType: batch.produceType,
      farmer: {
        name: batch.farmer ? batch.farmer.name : 'N/A',
        region: batch.farmer
          ? batch.farmer.village || batch.farmer.address || 'N/A'
          : 'N/A',
        phone: batch.farmer?.phone || null,
      },
      fpo: {
        name: batch.fpo ? batch.fpo.name : 'N/A',
        contact: batch.fpo?.contactDetails || {},
        registrationNumber: batch.fpo?.registrationNumber || null,
      },
      intake: {
        rawQuantityKg: batch.rawQuantityKg,
        harvestDate: batch.harvestDate,
        collectionDate: batch.collectionDate || batch.createdAt,
      },
      qualityAndGrading: batch.grading || null,
      pricing: batch.pricingSnapshot || null,
      farmerPayout: {
        amountOwedToFarmer: batch.amountOwedToFarmer || 0,
        payoutStatus: batch.payoutStatus,
        paidAt: batch.paidAt || null,
      },
      marketplace: { listings, orders },
      qrCodeUrl: batch.qrCodeUrl || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};


// Complete missing FPO management operations.
exports.updateProfile = async (req,res)=>{ try { const uid=req.user._id||req.user.id; const f=await Fpo.findOne({adminUser:uid}); if(!f)return res.status(404).json({message:'FPO profile not found.'}); const {name,registrationNumber,cbboName,managerName,managerContact,creditLineAvailable,contactDetails}=req.body; if(registrationNumber&&registrationNumber!==f.registrationNumber&&await Fpo.exists({registrationNumber,_id:{$ne:f._id}}))return res.status(400).json({message:'Registration number already exists.'}); Object.assign(f,{name:name??f.name,registrationNumber:registrationNumber??f.registrationNumber,cbboName:cbboName??f.cbboName,managerName:managerName??f.managerName,managerContact:managerContact??f.managerContact,creditLineAvailable:creditLineAvailable??f.creditLineAvailable}); if(contactDetails) f.contactDetails={...f.contactDetails.toObject(),...contactDetails}; await f.save(); res.json(await Fpo.findById(f._id).populate('adminUser staff','name email role location')); } catch(e){res.status(400).json({message:e.message});} };
exports.updateStaff = async(req,res)=>{try{const f=await Fpo.findOne({adminUser:req.user._id||req.user.id});if(!f||!f.staff.some(x=>x.toString()===req.params.staffId))return res.status(404).json({message:'Staff member not found.'});const u=await User.findById(req.params.staffId);if(!u)return res.status(404).json({message:'User not found.'});if(req.body.name!==undefined)u.name=req.body.name;if(req.body.location!==undefined)u.location=req.body.location;if(req.body.password)u.password=await bcrypt.hash(req.body.password,10);await u.save();res.json(u);}catch(e){res.status(400).json({message:e.message});}};
exports.removeStaff = async(req,res)=>{try{const f=await Fpo.findOne({adminUser:req.user._id||req.user.id});if(!f)return res.status(404).json({message:'FPO not found.'});const id=req.params.staffId;if(!f.staff.some(x=>x.toString()===id))return res.status(404).json({message:'Staff member not found.'});f.staff=f.staff.filter(x=>x.toString()!==id);await f.save();await User.findOneAndUpdate({_id:id,role:'fpo_staff'},{$set:{role:'consumer'}});res.json({message:'Staff deactivated and removed from FPO.'});}catch(e){res.status(500).json({message:e.message});}};
exports.verifyKyc = async(req,res)=>{try{if(req.user.role!=='admin')return res.status(403).json({message:'Only authority admin can verify KYC.'});const {status,reason}=req.body;if(!['Pending','Verified','Rejected'].includes(status))return res.status(400).json({message:'Invalid KYC status.'});const f=await Fpo.findByIdAndUpdate(req.params.fpoId,{kycStatus:status,kycRejectionReason:status==='Rejected'?(reason||''):''},{new:true});if(!f)return res.status(404).json({message:'FPO not found.'});res.json(f);}catch(e){res.status(500).json({message:e.message});}};
exports.importFarmersExcel = async(req,res)=>{try{const fpoId=await getFpoIdForUser(req.user._id||req.user.id);if(!fpoId)return res.status(400).json({message:'Associated FPO profile not found.'});if(!req.file)return res.status(400).json({message:'Please upload an Excel file.'});const XLSX=require('xlsx');const wb=XLSX.readFile(req.file.path);const sheet=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(sheet);const docs=rows.filter(r=>r.name&&r.phone).map(r=>({fpo:fpoId,name:String(r.name),phone:String(r.phone),aadhaarNumber:r.aadhaarNumber||'',address:r.address||'',bankDetails:{accountNumber:r.accountNumber||'',ifscCode:r.ifscCode||'',bankName:r.bankName||''}}));if(!docs.length)return res.status(400).json({message:'No valid rows found. name and phone are required.'});const created=await Farmer.insertMany(docs,{ordered:false});try{fs.unlinkSync(req.file.path)}catch(_){}res.status(201).json({message:`${created.length} farmers imported successfully.`,farmers:created});}catch(e){try{if(req.file?.path)fs.unlinkSync(req.file.path)}catch(_){}res.status(500).json({message:'Excel import failed.',error:e.message});}};
exports.getWeeklyReport = async(req,res)=>{try{const fpoId=await getFpoIdForUser(req.user._id||req.user.id);if(!fpoId)return res.json([]);const days=Number(req.query.days)||56;const start=new Date(Date.now()-days*86400000);const batches=await Batch.find({fpo:fpoId,createdAt:{$gte:start}});const orders=await FpoOrder.find({fpo:fpoId,createdAt:{$gte:start},status:{$nin:['Cancelled','Rejected']}});const key=d=>{const x=new Date(d);x.setHours(0,0,0,0);const day=x.getDay();const diff=x.getDate()-day+(day===0?-6:1);x.setDate(diff);return x.toISOString().slice(0,10)};const m={};for(const b of batches){const k=key(b.createdAt);m[k]??={week:k,intakeKg:0,revenue:0};m[k].intakeKg+=b.rawQuantityKg}for(const o of orders){const k=key(o.createdAt);m[k]??={week:k,intakeKg:0,revenue:0};m[k].revenue+=o.totalPrice}res.json(Object.values(m).sort((a,b)=>a.week.localeCompare(b.week)));}catch(e){res.status(500).json({message:e.message});}};
exports.getFarmerSales = async(req,res)=>{try{const fpoId=await getFpoIdForUser(req.user._id||req.user.id);const farmer=await Farmer.findOne({_id:req.params.farmerId,fpo:fpoId});if(!farmer)return res.status(404).json({message:'Farmer not found.'});const batches=await Batch.find({fpo:fpoId,farmer:farmer._id});const batchIds=batches.map(b=>b._id);const listings=await Listing.find({fpo:fpoId,sourceBatch:{$in:batchIds}});const listingIds=listings.map(l=>l._id);const orders=await FpoOrder.find({fpo:fpoId,listing:{$in:listingIds},status:{$nin:['Cancelled','Rejected']}}).populate('listing','produceType grade pricePerKg');res.json({farmer,batches,listings,orders,totalSoldKg:orders.reduce((s,o)=>s+o.quantityKg,0),salesRevenue:orders.reduce((s,o)=>s+o.totalPrice,0)});}catch(e){res.status(500).json({message:e.message});}};
exports.completePayout = async(req,res)=>{try{const fpoId=await getFpoIdForUser(req.user._id||req.user.id);const payout=await Payout.findOne({_id:req.params.payoutId,fpo:fpoId});if(!payout)return res.status(404).json({message:'Payout not found.'});if(payout.status==='Completed')return res.status(400).json({message:'Payout already completed.'});payout.status='Completed';payout.transactionId=req.body.transactionId||payout.transactionId||`TXN-${Date.now()}`;payout.paymentDate=new Date();payout.paidAt=new Date();await payout.save();if(payout.batch){const b=await Batch.findOne({_id:payout.batch,fpo:fpoId});if(b){b.payoutStatus='PAID';b.paidAt=new Date();await b.save();}}await Farmer.findByIdAndUpdate(payout.farmer,{$inc:{totalEarnedLifetime:payout.amount}}).catch(()=>{});res.json({message:'Payout completed.',payout});}catch(e){res.status(500).json({message:e.message});}};
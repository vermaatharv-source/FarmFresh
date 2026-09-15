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
    const qrData = await QRCode.toDataURL(generatedBatchId);

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
    // FIX (IDOR): scope to the caller's own FPO instead of a bare findById.
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) {
      return res.status(400).json({ message: 'Associated FPO profile not found.' });
    }

    const { batchId } = req.params;
    const { gradeA_Kg, gradeB_Kg, gradeC_Kg, qualityScore, status } = req.body;

    const batch = await Batch.findOne({ _id: batchId, fpo: fpoId });
    if (!batch) {
      return res.status(404).json({ message: 'Batch not found.' });
    }

    // FIX: guard against negative values and graded totals exceeding what was intaken.
    const a = Number(gradeA_Kg) || 0;
    const b = Number(gradeB_Kg) || 0;
    const c = Number(gradeC_Kg) || 0;
    if (a < 0 || b < 0 || c < 0) {
      return res.status(400).json({ message: 'Grade quantities cannot be negative.' });
    }
    if (a + b + c > batch.rawQuantityKg) {
      return res.status(400).json({ message: 'Graded quantity cannot exceed the raw intake quantity.' });
    }

    const qualityImages = req.files ? req.files.map((file) => file.path) : [];
    const gradingEntry = {
      gradeA_Kg: a,
      gradeB_Kg: b,
      gradeC_Kg: c,
      qualityScore,
      qualityImages,
      status: status || 'Approved',
      gradedAt: new Date(),
    };

    // Keep the latest grading snapshot on `grading` (for backward compatibility
    // with existing UI), but also append to `gradingHistory` so nothing is lost.
    batch.grading = gradingEntry;
    batch.gradingHistory.push(gradingEntry);

    await batch.save();

    // Auto-sync graded items into Inventory + log each as a StockMovement +
    // check the low-stock threshold on the way in (rare on intake, but cheap to check).
    const updates = [
      { grade: 'A', qty: a },
      { grade: 'B', qty: b },
      { grade: 'C', qty: c },
    ];

    for (const item of updates) {
      if (item.qty > 0) {
        const updatedInventory = await Inventory.findOneAndUpdate(
          { fpo: batch.fpo, produceType: batch.produceType, grade: item.grade },
          { $inc: { totalQuantity: item.qty } },
          { upsert: true, new: true }
        );

        await StockMovement.create({
          fpo: batch.fpo, produceType: batch.produceType, grade: item.grade,
          type: 'Intake', quantityKg: item.qty, batch: batch._id,
        });

        const freeStock = updatedInventory.totalQuantity - updatedInventory.reservedQuantity - updatedInventory.soldQuantity;
        if (freeStock <= updatedInventory.minAlertThreshold) {
          await notify(
            batch.fpo,
            'LowInventory',
            `Low stock: ${batch.produceType} Grade ${item.grade} is at ${freeStock}kg (threshold ${updatedInventory.minAlertThreshold}kg).`,
            { produceType: batch.produceType, grade: item.grade }
          );
        }
      }
    }

    res.json({ message: 'Batch grading updated and stock reflected in inventory', batch });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
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

// 13. Create Farmer Payout
exports.createPayout = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) {
      return res.status(400).json({ message: 'Associated FPO profile not found.' });
    }

    const { farmerId, batchId, amount, transactionId } = req.body;

    // FIX: verify the farmer (and batch, if given) belong to this FPO before paying out.
    const farmer = await Farmer.findOne({ _id: farmerId, fpo: fpoId });
    if (!farmer) {
      return res.status(404).json({ message: 'Farmer not found for this FPO.' });
    }
    if (batchId) {
      const batch = await Batch.findOne({ _id: batchId, fpo: fpoId });
      if (!batch) {
        return res.status(404).json({ message: 'Batch not found for this FPO.' });
      }
    }

    const payout = await Payout.create({
      fpo: fpoId,
      farmer: farmerId,
      batch: batchId,
      amount,
      transactionId,
      status: transactionId ? 'Completed' : 'Pending',
      paymentDate: transactionId ? new Date() : null,
    });

    await notify(fpoId, 'PayoutUpdate', `Payout of ₹${amount} recorded for ${farmer.name} (${payout.status}).`, { payoutId: payout._id });

    res.status(201).json({ message: 'Payout recorded', payout });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
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
exports.getBatchTraceability = async (req, res) => {
  try {
    const { batchId } = req.params;

    const batch = await Batch.findOne({ batchId })
      .populate('farmer', 'name address region')
      .populate('fpo', 'name contactDetails email phone');

    if (!batch) {
      return res.status(404).json({ message: 'Traceability passport not found for this Batch ID.' });
    }

    res.json({
      title: 'Digital Produce Passport',
      batchId: batch.batchId,
      produceType: batch.produceType,
      farmer: {
        name: batch.farmer ? batch.farmer.name : 'N/A',
        region: batch.farmer ? (batch.farmer.region || batch.farmer.address) : 'N/A',
      },
      fpo: {
        name: batch.fpo ? batch.fpo.name : 'N/A',
        contact: batch.fpo ? (batch.fpo.contactDetails || { phone: batch.fpo.phone, email: batch.fpo.email }) : {},
      },
      intake: {
        rawQuantityKg: batch.rawQuantityKg,
        harvestDate: batch.harvestDate,
        collectionDate: batch.createdAt || batch.collectionDate,
      },
      qualityAndGrading: batch.grading || null,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

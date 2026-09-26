/**
 * Drop-in farmer handlers for fpoController.js
 * Copy these exports into fpoController OR require them.
 *
 * Usage in fpoController.js:
 *   const farmerHandlers = require('./farmerHandlers');
 *   exports.addFarmer = farmerHandlers.addFarmer;
 *   exports.getFarmers = farmerHandlers.getFarmers;
 *   ... etc
 */
const Farmer = require('../models/Farmer');
const Fpo = require('../models/Fpo');
const { logActivity } = require('../utils/activityLogger');
const { maskAccountNumber, looksMasked } = require('../utils/privacy');
const fs = require('fs');
const path = require('path');
const csvParser = require('csv-parser');
const { hasSignature } = require('../middleware/upload');
const { toEnglish, sourceLangFromReq } = require('../utils/canonicalText');

const getFpoIdForUser = async (userId) => {
  if (!userId) return null;
  const fpo = await Fpo.findOne({
    $or: [{ adminUser: userId }, { staff: userId }],
  });
  return fpo ? fpo._id : null;
};

/** Strip/mask bank fields for non-admin roles */
const sanitizeFarmerForRole = (farmer, role) => {
  const obj = farmer.toObject ? farmer.toObject({ getters: true }) : { ...farmer };
  if (role !== 'fpo_admin' && role !== 'admin') {
    if (obj.bankDetails) {
      obj.bankDetails = {
        ...obj.bankDetails,
        accountNumber: maskAccountNumber(obj.bankDetails.accountNumber),
      };
    }
  }
  return obj;
};

const parseCrops = (v) => {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  return String(v)
    .split(/[,;|/]/)
    .map((s) => s.trim())
    .filter(Boolean);
};

exports.addFarmer = async (req, res) => {
  try {
    const fpoId = await getFpoIdForUser(req.user._id || req.user.id);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const {
      name,
      phone,
      aadhaarNumber,
      address,
      village,
      block,
      district,
      state,
      landHoldingAcres,
      cropsGrown,
      gender,
      category,
      memberId,
      joiningDate,
      isShareholder,
      bankDetails,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: 'Name and phone are required.' });
    }

    // Canonical-English for crop names only — never translate person names.
    const sourceLang = sourceLangFromReq(req);
    const cropsList = parseCrops(cropsGrown);
    const cropsEn = cropsList.length
      ? await toEnglish(cropsList, sourceLang)
      : cropsList;
    if (cropsList.length) {
      console.log(`[farmer] cropsGrown ${JSON.stringify(cropsList)} → ${JSON.stringify(cropsEn)} (source=${sourceLang})`);
    }

    const farmer = await Farmer.create({
      fpo: fpoId,
      name,
      phone,
      aadhaarNumber,
      address,
      village,
      block,
      district,
      state,
      landHoldingAcres: Number(landHoldingAcres) || 0,
      cropsGrown: Array.isArray(cropsEn) ? cropsEn : parseCrops(cropsGrown),
      gender: gender || '',
      category: category || '',
      memberId: memberId || '',
      joiningDate: joiningDate ? new Date(joiningDate) : undefined,
      isShareholder: isShareholder !== false,
      bankDetails: bankDetails || {},
    });

    await logActivity({
      req,
      fpoId,
      action: 'FARMER_CREATE',
      entityType: 'Farmer',
      entityId: farmer._id,
      summary: `Added farmer ${name} (${phone})`,
    });

    res.status(201).json(sanitizeFarmerForRole(farmer, req.user.role));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.getFarmers = async (req, res) => {
  try {
    const fpoId = await getFpoIdForUser(req.user._id || req.user.id);
    if (!fpoId) return res.json([]);
    const farmers = await Farmer.find({ fpo: fpoId }).sort({ createdAt: -1 });
    res.json(farmers.map((f) => sanitizeFarmerForRole(f, req.user.role)));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.getFarmerDetail = async (req, res) => {
  try {
    const fpoId = await getFpoIdForUser(req.user._id || req.user.id);
    const farmer = await Farmer.findOne({ _id: req.params.farmerId, fpo: fpoId });
    if (!farmer) return res.status(404).json({ message: 'Farmer not found.' });
    res.json(sanitizeFarmerForRole(farmer, req.user.role));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.updateFarmer = async (req, res) => {
  try {
    const fpoId = await getFpoIdForUser(req.user._id || req.user.id);
    const farmer = await Farmer.findOne({ _id: req.params.farmerId, fpo: fpoId });
    if (!farmer) return res.status(404).json({ message: 'Farmer not found.' });

    // Only admin can change bank details
    if (req.user.role !== 'fpo_admin' && req.body.bankDetails) {
      delete req.body.bankDetails;
    }

    const fields = [
      'name',
      'phone',
      'aadhaarNumber',
      'address',
      'village',
      'block',
      'district',
      'state',
      'landHoldingAcres',
      'gender',
      'category',
      'memberId',
      'joiningDate',
      'isShareholder',
      'isActive',
      'isVerified',
    ];
    fields.forEach((k) => {
      if (req.body[k] !== undefined) farmer[k] = req.body[k];
    });
    if (req.body.cropsGrown !== undefined) {
      // Canonical-English for crop names on update as well.
      const sourceLang = sourceLangFromReq(req);
      const cropsList = parseCrops(req.body.cropsGrown);
      farmer.cropsGrown = cropsList.length
        ? await toEnglish(cropsList, sourceLang)
        : cropsList;
    }
    if (req.body.bankDetails && req.user.role === 'fpo_admin') {
      const incoming = req.body.bankDetails;
      if (incoming.ifscCode !== undefined) farmer.set('bankDetails.ifscCode', incoming.ifscCode);
      if (incoming.bankName !== undefined) farmer.set('bankDetails.bankName', incoming.bankName);
      // Ignore a masked echo ("XXXXXX1234"); only a real new number replaces the stored one.
      if (incoming.accountNumber && !looksMasked(incoming.accountNumber)) {
        farmer.set('bankDetails.accountNumber', incoming.accountNumber);
      }
    }

    await farmer.save();

    await logActivity({
      req,
      fpoId,
      action: 'FARMER_UPDATE',
      entityType: 'Farmer',
      entityId: farmer._id,
      summary: `Updated farmer ${farmer.name}`,
    });

    res.json(sanitizeFarmerForRole(farmer, req.user.role));
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

const MAX_IMPORT_ROWS = 5000;

// Reads an uploaded .xlsx (or .csv) into an array of { header: value } rows.
// Uses read-excel-file, which has no known vulnerabilities, instead of the
// unmaintained xlsx package.
async function readImportRows(file) {
  const ext = path.extname(file.originalname || file.path).toLowerCase();

  if (ext === '.csv') {
    return new Promise((resolve, reject) => {
      const out = [];
      fs.createReadStream(file.path)
        .pipe(csvParser())
        .on('data', (row) => out.push(row))
        .on('end', () => resolve(out))
        .on('error', reject);
    });
  }

  if (!hasSignature(file.path, ['xlsx'])) {
    throw new Error('The file is not a valid .xlsx workbook.');
  }
  const { default: readXlsxFile } = await import('read-excel-file/node');
  const sheets = await readXlsxFile(file.path);
  const table = (sheets[0] && sheets[0].data) || [];
  if (table.length < 2) return [];
  const header = table[0].map((h) => String(h || '').trim());
  return table.slice(1).map((cells) => {
    const row = {};
    header.forEach((h, i) => {
      if (h && cells[i] !== null && cells[i] !== undefined) row[h] = cells[i];
    });
    return row;
  });
}

exports.importFarmersExcel = async (req, res) => {
  try {
    const fpoId = await getFpoIdForUser(req.user._id || req.user.id);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });
    if (!req.file) return res.status(400).json({ message: 'Please upload an Excel/CSV file.' });

    const rows = await readImportRows(req.file);
    if (rows.length > MAX_IMPORT_ROWS) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
      return res.status(400).json({ message: `A file can contain at most ${MAX_IMPORT_ROWS} rows. Please split it.` });
    }

    const docs = rows
      .filter((r) => r.name && r.phone)
      .map((r) => ({
        fpo: fpoId,
        name: String(r.name).trim(),
        phone: String(r.phone).trim(),
        aadhaarNumber: r.aadhaarNumber || r.aadhaar || '',
        address: r.address || '',
        village: r.village || '',
        block: r.block || '',
        district: r.district || '',
        state: r.state || '',
        landHoldingAcres: Number(r.landHoldingAcres || r.land_acres || 0) || 0,
        cropsGrown: parseCrops(r.cropsGrown || r.crops || ''),
        gender: r.gender || '',
        category: r.category || '',
        memberId: r.memberId || r.member_id || '',
        joiningDate: r.joiningDate || r.joining_date ? new Date(r.joiningDate || r.joining_date) : undefined,
        isShareholder: String(r.isShareholder || r.shareholder || 'true').toLowerCase() !== 'false',
        bankDetails: {
          accountNumber: r.accountNumber || r.account_number || '',
          ifscCode: r.ifscCode || r.ifsc || '',
          bankName: r.bankName || r.bank_name || '',
        },
      }));

    if (!docs.length) {
      return res.status(400).json({
        message:
          'No valid rows. Required columns: name, phone. Optional: village, block, district, state, landHoldingAcres, crops, gender, category, memberId, joiningDate, accountNumber, ifscCode, bankName, aadhaarNumber',
      });
    }

    const created = await Farmer.insertMany(docs, { ordered: false });
    try {
      fs.unlinkSync(req.file.path);
    } catch (_) {}

    await logActivity({
      req,
      fpoId,
      action: 'FARMER_IMPORT',
      summary: `Imported ${created.length} farmers via Excel/CSV`,
      meta: { count: created.length },
    });

    res.status(201).json({
      message: `${created.length} farmers imported successfully.`,
      farmers: created.map((f) => sanitizeFarmerForRole(f, req.user.role)),
    });
  } catch (e) {
    try {
      if (req.file?.path) fs.unlinkSync(req.file.path);
    } catch (_) {}
    const badFile = /not a valid|xlsx/i.test(e.message || '');
    res.status(badFile ? 400 : 500).json({
      message: badFile ? 'The file could not be read. Please upload a valid .xlsx or .csv file.' : 'Import failed.',
      error: e.message,
    });
  }
};

// GET /api/fpo/farmers/:farmerId/bank-details  (FPO admin only, always audited)
exports.revealBankDetails = async (req, res) => {
  try {
    const fpoId = await getFpoIdForUser(req.user._id || req.user.id);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });
    const farmer = await Farmer.findOne({ _id: req.params.farmerId, fpo: fpoId });
    if (!farmer) return res.status(404).json({ message: 'Farmer not found.' });

    await logActivity({
      req,
      fpoId,
      action: 'BANK_DETAILS_VIEW',
      entityType: 'Farmer',
      entityId: farmer._id,
      summary: `Viewed full bank details of ${farmer.name}`,
    });

    res.json({
      accountNumber: farmer.getBankAccountNumber(),
      ifscCode: (farmer.bankDetails && farmer.bankDetails.ifscCode) || '',
      bankName: (farmer.bankDetails && farmer.bankDetails.bankName) || '',
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.getActivityLogs = async (req, res) => {
  try {
    const fpoId = await getFpoIdForUser(req.user._id || req.user.id);
    if (!fpoId) return res.json([]);
    const ActivityLog = require('../models/ActivityLog');
    const logs = await ActivityLog.find({ fpo: fpoId })
      .sort({ createdAt: -1 })
      .limit(Number(req.query.limit) || 100);
    res.json(logs);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
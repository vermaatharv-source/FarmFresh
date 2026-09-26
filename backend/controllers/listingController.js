const Fpo = require('../models/Fpo');
const Listing = require('../models/Listing');
const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');
const Batch = require('../models/Batch');

const getFpoId = async (userId) => {
  const f = await Fpo.findOne({ $or: [{ adminUser: userId }, { staff: userId }] });
  return f ? f._id : null;
};

// Create listing (FPO staff)
exports.createListing = async (req, res) => {
  try {
    const f = await getFpoId(req.user._id || req.user.id);
    if (!f) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const { produceType, grade, pricePerKg, availableQuantityKg, minOrderQtyKg, description, sourceBatch } = req.body;
    const qty = Number(availableQuantityKg);

    if (!(qty > 0) || !(Number(pricePerKg) >= 0)) {
      return res.status(400).json({ message: 'Valid quantity and price are required.' });
    }

    const inv = await Inventory.findOne({ fpo: f, produceType, grade });
    const free = inv ? inv.totalQuantity - inv.reservedQuantity - inv.soldQuantity : 0;
    if (!inv || free < qty) {
      return res.status(400).json({ message: `Not enough free stock. Available: ${free}kg.` });
    }

    if (sourceBatch) {
      const b = await Batch.findOne({ _id: sourceBatch, fpo: f });
      if (!b) return res.status(400).json({ message: 'Invalid source batch.' });
    }

    const images = req.files?.map((x) => x.path) || [];

    const listing = await Listing.create({
      fpo: f,
      produceType,
      grade,
      pricePerKg: Number(pricePerKg),
      availableQuantityKg: qty,
      minOrderQtyKg: Number(minOrderQtyKg) || 1,
      description: description || '',
      images,
      sourceBatch: sourceBatch || undefined,
      sourceIntakeId: sourceBatch || undefined,
      status: 'Draft',
    });

    inv.reservedQuantity += qty;
    await inv.save();

    if (sourceBatch) {
      await Batch.findByIdAndUpdate(sourceBatch, { $addToSet: { listedAsProductIds: listing._id } });
    }

    await StockMovement.create({
      fpo: f,
      produceType,
      grade,
      type: 'Reserved',
      quantityKg: qty,
      listing: listing._id,
      batch: sourceBatch || undefined,
      note: 'Reserved for listing',
    });

    res.status(201).json({ message: 'Listing created', listing });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// FPO's own listings
exports.getMyListings = async (req, res) => {
  try {
    const f = await getFpoId(req.user._id || req.user.id);
    if (!f) return res.json([]);
    const rows = await Listing.find({ fpo: f })
      .populate('sourceBatch', 'batchId produceType rawQuantityKg grading')
      .sort({ createdAt: -1 });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// PUBLIC listings with filters (+ KYC for Verified badge)
exports.getPublicListings = async (req, res) => {
  try {
    const filter = { status: 'Published', availableQuantityKg: { $gt: 0 } };

    if (req.query.grade) filter.grade = req.query.grade.toUpperCase();
    if (req.query.produceType) {
      filter.produceType = { $regex: req.query.produceType, $options: 'i' };
    }
    if (req.query.search) {
      filter.$or = [
        { produceType: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
      ];
    }
    if (req.query.minPrice) filter.pricePerKg = { ...filter.pricePerKg, $gte: Number(req.query.minPrice) };
    if (req.query.maxPrice) filter.pricePerKg = { ...filter.pricePerKg, $lte: Number(req.query.maxPrice) };

    let query = Listing.find(filter).populate(
      'fpo',
      'name contactDetails registrationNumber kycStatus registrationType'
    );

    const sortBy = req.query.sort || 'newest';
    if (sortBy === 'price_asc') query = query.sort({ pricePerKg: 1 });
    else if (sortBy === 'price_desc') query = query.sort({ pricePerKg: -1 });
    else if (sortBy === 'qty_desc') query = query.sort({ availableQuantityKg: -1 });
    else query = query.sort({ createdAt: -1 });

    const rows = await query.lean();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// GET single public listing with full details (+ KYC for Verified badge)
exports.getPublicListingById = async (req, res) => {
  try {
    const listing = await Listing.findOne({
      _id: req.params.id,
      status: 'Published',
    })
      .populate(
        'fpo',
        'name contactDetails registrationNumber registrationType kycStatus district state'
      )
      .populate({
        path: 'sourceBatch',
        select:
          'batchId produceType rawQuantityKg harvestDate collectionDate grading pricingSnapshot qrCodeUrl',
        populate: { path: 'farmer', select: 'name village district state' },
      });

    if (!listing) {
      return res.status(404).json({ message: 'Listing not found or not published.' });
    }

    res.json(listing);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.setListingStatus = async (req, res) => {
  try {
    const f = await getFpoId(req.user._id || req.user.id);
    const listing = await Listing.findOne({ _id: req.params.id, fpo: f });
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });

    const { status } = req.body;
    if (!['Draft', 'Published', 'Paused'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }
    listing.status = status;
    await listing.save();
    res.json(listing);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Update listing. FIX: availableQuantityKg used to be changed on the Listing
// document with no corresponding change to Inventory.reservedQuantity, so the
// two drifted out of sync (over time this lets total reservations exceed real
// stock, i.e. overselling). Any change in quantity is now mirrored onto the
// Inventory row for the same fpo/produceType/grade, guarded so it can never
// reserve more than is actually free, and logged as a StockMovement so the
// change is auditable.
exports.updateListing = async (req, res) => {
  try {
    const f = await getFpoId(req.user._id || req.user.id);
    const listing = await Listing.findOne({ _id: req.params.id, fpo: f });
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });

    const { pricePerKg, availableQuantityKg, minOrderQtyKg, description } = req.body;

    if (availableQuantityKg !== undefined) {
      const newQty = Number(availableQuantityKg);
      if (!(newQty >= 0)) {
        return res.status(400).json({ message: 'availableQuantityKg must be a non-negative number.' });
      }

      const oldQty = listing.availableQuantityKg;
      const delta = newQty - oldQty; // positive = reserving more, negative = releasing some

      if (delta !== 0) {
        const inv = await Inventory.findOne({ fpo: f, produceType: listing.produceType, grade: listing.grade });
        if (!inv) {
          return res.status(400).json({ message: 'No matching inventory record found for this listing.' });
        }

        if (delta > 0) {
          const free = inv.totalQuantity - inv.reservedQuantity - inv.soldQuantity;
          if (free < delta) {
            return res.status(400).json({ message: `Not enough free stock to increase by ${delta}kg. Available: ${free}kg.` });
          }
          inv.reservedQuantity += delta;
        } else {
          // Releasing stock back: never let reservedQuantity go negative even
          // if data was already inconsistent before this fix.
          inv.reservedQuantity = Math.max(0, inv.reservedQuantity + delta);
        }
        await inv.save();

        await StockMovement.create({
          fpo: f,
          produceType: listing.produceType,
          grade: listing.grade,
          type: delta > 0 ? 'Reserved' : 'Released',
          quantityKg: delta,
          listing: listing._id,
          note: `Listing quantity updated from ${oldQty}kg to ${newQty}kg`,
        });
      }

      listing.availableQuantityKg = newQty;
    }

    if (pricePerKg !== undefined) listing.pricePerKg = Number(pricePerKg);
    if (minOrderQtyKg !== undefined) listing.minOrderQtyKg = Number(minOrderQtyKg);
    if (description !== undefined) listing.description = description;

    if (req.files?.length) {
      listing.images = req.files.map((x) => x.path);
    }

    await listing.save();
    res.json(listing);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Delete listing. FIX: used to just delete the document, permanently stranding
// its reservedQuantity on the Inventory row (stock stuck as "reserved"
// forever, unavailable for new listings). Now releases the reservation back
// to Inventory and records a StockMovement before removing the listing.
exports.deleteListing = async (req, res) => {
  try {
    const f = await getFpoId(req.user._id || req.user.id);
    const listing = await Listing.findOne({ _id: req.params.id, fpo: f });
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });

    const releaseQty = listing.availableQuantityKg;

    if (releaseQty > 0) {
      const inv = await Inventory.findOne({ fpo: f, produceType: listing.produceType, grade: listing.grade });
      if (inv) {
        inv.reservedQuantity = Math.max(0, inv.reservedQuantity - releaseQty);
        await inv.save();

        await StockMovement.create({
          fpo: f,
          produceType: listing.produceType,
          grade: listing.grade,
          type: 'Released',
          quantityKg: -releaseQty,
          listing: listing._id,
          note: 'Listing deleted — reservation released',
        });
      }
    }

    await Listing.deleteOne({ _id: listing._id });
    res.json({ message: 'Listing deleted' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

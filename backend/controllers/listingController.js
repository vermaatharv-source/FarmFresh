const Fpo = require('../models/Fpo');
const Listing = require('../models/Listing');
const Inventory = require('../models/Inventory');
const StockMovement = require('../models/StockMovement');

const getFpoIdForUser = async (userId) => {
  if (!userId) return null;
  const fpo = await Fpo.findOne({ $or: [{ adminUser: userId }, { staff: userId }] });
  return fpo ? fpo._id : null;
};

// 1. Create a listing — reserves the quantity out of Inventory so it can't
// be double-counted as "available" elsewhere.
exports.createListing = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const { produceType, grade, pricePerKg, availableQuantityKg, minOrderQtyKg, description } = req.body;
    const qty = Number(availableQuantityKg);

    const inventory = await Inventory.findOne({ fpo: fpoId, produceType, grade });
    const freeStock = inventory ? inventory.totalQuantity - inventory.reservedQuantity - inventory.soldQuantity : 0;
    if (!inventory || freeStock < qty) {
      return res.status(400).json({ message: `Not enough free stock. Available: ${freeStock}kg, requested: ${qty}kg.` });
    }

    const images = req.files ? req.files.map((f) => f.path) : [];

    const listing = await Listing.create({
      fpo: fpoId,
      produceType,
      grade,
      pricePerKg,
      availableQuantityKg: qty,
      minOrderQtyKg: minOrderQtyKg || 1,
      description: description || '',
      images,
      status: 'Draft',
    });

    inventory.reservedQuantity += qty;
    await inventory.save();

    await StockMovement.create({
      fpo: fpoId, produceType, grade, type: 'Reserved', quantityKg: qty, listing: listing._id,
      note: 'Reserved for new listing',
    });

    res.status(201).json({ message: 'Listing created', listing });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 2. Get this FPO's own listings (all statuses)
exports.getMyListings = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.json([]);

    const listings = await Listing.find({ fpo: fpoId }).sort({ createdAt: -1 });
    res.json(listings);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 3. Public: browse all Published listings (consumer-facing marketplace)
exports.getPublicListings = async (req, res) => {
  try {
    const { produceType } = req.query;
    const filter = { status: 'Published', availableQuantityKg: { $gt: 0 } };
    if (produceType) filter.produceType = produceType;

    const listings = await Listing.find(filter).populate('fpo', 'name contactDetails');
    res.json(listings);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 4. Publish / Pause a listing
exports.setListingStatus = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const { status } = req.body; // 'Published' | 'Paused' | 'Draft'
    if (!['Published', 'Paused', 'Draft'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status.' });
    }

    const listing = await Listing.findOne({ _id: req.params.id, fpo: fpoId });
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });

    listing.status = status;
    await listing.save();
    res.json({ message: `Listing set to ${status}`, listing });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 5. Edit price / quantity / description on a listing
exports.updateListing = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const listing = await Listing.findOne({ _id: req.params.id, fpo: fpoId });
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });

    const { pricePerKg, minOrderQtyKg, description } = req.body;
    if (pricePerKg !== undefined) listing.pricePerKg = pricePerKg;
    if (minOrderQtyKg !== undefined) listing.minOrderQtyKg = minOrderQtyKg;
    if (description !== undefined) listing.description = description;

    await listing.save();
    res.json({ message: 'Listing updated', listing });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

// 6. Delete a listing — releases the reserved stock back to Inventory
exports.deleteListing = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const fpoId = await getFpoIdForUser(userId);
    if (!fpoId) return res.status(400).json({ message: 'Associated FPO profile not found.' });

    const listing = await Listing.findOne({ _id: req.params.id, fpo: fpoId });
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });

    const inventory = await Inventory.findOne({ fpo: fpoId, produceType: listing.produceType, grade: listing.grade });
    if (inventory) {
      inventory.reservedQuantity = Math.max(0, inventory.reservedQuantity - listing.availableQuantityKg);
      await inventory.save();
      await StockMovement.create({
        fpo: fpoId, produceType: listing.produceType, grade: listing.grade,
        type: 'Released', quantityKg: listing.availableQuantityKg, listing: listing._id,
        note: 'Listing deleted, stock released',
      });
    }

    await Listing.findByIdAndDelete(listing._id);
    res.json({ message: 'Listing deleted and stock released back to inventory.' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
};

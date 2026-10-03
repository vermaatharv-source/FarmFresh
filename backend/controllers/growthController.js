const growthService = require('../services/growthService');
const geoService = require('../services/geoService');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const Referral = require('../models/Referral');
const WalletTransaction = require('../models/WalletTransaction');
const Listing = require('../models/Listing');
const FpoOrder = require('../models/FpoOrder');
const Fpo = require('../models/Fpo');

// ---------- Referral ----------
exports.getMyReferralCode = async (req, res) => {
  try {
    const code = await growthService.ensureUserHasReferralCode(req.user.id);
    const stats = await Referral.aggregate([
      { $match: { referrer: req.user._id || req.user.id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);
    const totalEarned = await WalletTransaction.aggregate([
      {
        $match: {
          user: req.user._id || req.user.id,
          type: 'REFERRAL_REWARD',
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    res.json({
      success: true,
      data: {
        referralCode: code,
        shareLink: `${process.env.FRONTEND_URL || 'https://farmfresh.app'}/register?ref=${code}`,
        stats: stats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
        totalEarned: totalEarned[0]?.total || 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------- Wallet ----------
exports.getWallet = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('walletBalance name');
    const transactions = await WalletTransaction.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    res.json({
      success: true,
      data: {
        balance: user.walletBalance || 0,
        transactions,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------- Coupon ----------
exports.validateCoupon = async (req, res) => {
  try {
    const { code, orderValue, produceTypes, city } = req.body;
    if (!code || orderValue == null) {
      return res.status(400).json({ success: false, message: 'code and orderValue required' });
    }

    const result = await growthService.validateAndApplyCoupon(
      code,
      req.user.id,
      Number(orderValue),
      produceTypes || [],
      city
    );

    res.json({ success: result.valid, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAvailableCoupons = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const coupons = await Coupon.find({
      isActive: true,
      $or: [
        { firstOrderOnly: false },
        { firstOrderOnly: true, ...(user.hasCompletedFirstOrder ? { _id: null } : {}) },
      ],
      expiresAt: { $gt: new Date() },
    })
      .select('code type discountType discountValue maxDiscountAmount minOrderValue description expiresAt')
      .limit(10)
      .lean();

    res.json({ success: true, data: coupons });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------- Geo Discovery ----------
exports.getNearbyListings = async (req, res) => {
  try {
    const { lng, lat, produceType, grade, sort, limit } = req.query;
    const nLng = parseFloat(lng);
    const nLat = parseFloat(lat);

    // Always returns ALL published listings. Distance is attached when location is known.
    const listings = await geoService.findListingsNear(nLng, nLat, null, {
      produceType,
      grade,
      sort,
      limit: Number(limit) || 0,
    });

    res.json({
      success: true,
      data: listings,
      mode: Number.isFinite(nLng) && Number.isFinite(nLat) ? 'geo' : 'all',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------- Demand Signals (for FPO dashboard) ----------
exports.getDemandSignals = async (req, res) => {
  try {
    // Simple aggregation of recent orders by produceType
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const signals = await FpoOrder.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
          status: { $nin: ['Cancelled', 'Rejected'] },
        },
      },
      {
        $lookup: {
          from: 'listings',
          localField: 'listing',
          foreignField: '_id',
          as: 'listingData',
        },
      },
      { $unwind: '$listingData' },
      {
        $group: {
          _id: '$listingData.produceType',
          orderCount: { $sum: 1 },
          totalQtyKg: { $sum: '$quantityKg' },
          avgPrice: { $avg: { $divide: ['$totalPrice', '$quantityKg'] } },
        },
      },
      { $sort: { orderCount: -1 } },
      { $limit: 15 },
    ]);

    res.json({
      success: true,
      data: signals.map((s) => ({
        produceType: s._id,
        orderCount: s.orderCount,
        totalQtyKg: Math.round(s.totalQtyKg),
        avgPrice: Math.round(s.avgPrice),
        signal: s.orderCount >= 10 ? 'HIGH' : s.orderCount >= 4 ? 'MEDIUM' : 'LOW',
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------- Shareable link helper ----------
exports.getShareableListing = async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate('fpo', 'name logo shortBio contactDetails')
      .lean();

    if (!listing || listing.status !== 'Published') {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    const shareUrl = `${process.env.FRONTEND_URL || 'https://farmfresh.app'}/listing/${listing._id}`;
    const whatsappText = encodeURIComponent(
      `Fresh ${listing.produceType} (Grade ${listing.grade}) from ${listing.fpo?.name || 'FarmFresh'} – ₹${listing.pricePerKg}/kg\nOrder now: ${shareUrl}`
    );

    res.json({
      success: true,
      data: {
        listing,
        shareUrl,
        whatsappLink: `https://wa.me/?text=${whatsappText}`,
        twitterLink: `https://twitter.com/intent/tweet?text=${whatsappText}`,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------- Update user location ----------
exports.updateMyLocation = async (req, res) => {
  try {
    const { lng, lat, city, state, pincode } = req.body;
    if (lng == null || lat == null) {
      return res.status(400).json({ success: false, message: 'lng and lat required' });
    }

    const update = {
      geoLocation: {
        type: 'Point',
        coordinates: [Number(lng), Number(lat)],
      },
    };
    if (city) update.location = `${city}${state ? ', ' + state : ''}`;

    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select(
      '-password'
    );

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------- FPO: Buyers & Demand (aggregated, no personal buyer data) ----------
exports.getFpoBuyersDemand = async (req, res) => {
  try {
    const fpo = await Fpo.findOne({ $or: [{ adminUser: req.user.id }, { staff: req.user.id }] }).select('_id');
    if (!fpo) return res.status(404).json({ success: false, message: 'FPO profile not found' });

    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const valid = { $nin: ['Cancelled', 'Rejected', 'Refunded'] };

    const orders = await FpoOrder.find({
      fpo: fpo._id,
      status: valid,
      createdAt: { $gte: new Date(now - 180 * DAY) },
    })
      .select('consumer listing quantityKg totalPrice fpoAmount buyerType createdAt')
      .populate('listing', 'produceType')
      .lean();

    const since30 = now - 30 * DAY;
    const amountOf = (o) => Number(o.fpoAmount) || Number(o.totalPrice) || 0;

    // first order / order count per buyer (last 180 days)
    const perBuyer = new Map();
    orders.forEach((o) => {
      const k = String(o.consumer);
      const t = new Date(o.createdAt).getTime();
      const e = perBuyer.get(k) || { count: 0, first: t };
      e.count += 1;
      e.first = Math.min(e.first, t);
      perBuyer.set(k, e);
    });

    const recent = orders.filter((o) => new Date(o.createdAt).getTime() >= since30);
    const buyerIds = [...new Set(recent.map((o) => String(o.consumer)))];
    const newBuyers = buyerIds.filter((id) => perBuyer.get(id).first >= since30).length;
    const repeatBuyers = buyerIds.filter((id) => perBuyer.get(id).count >= 2).length;
    const referredBuyers = buyerIds.length
      ? await User.countDocuments({ _id: { $in: buyerIds }, referredBy: { $exists: true, $ne: null } })
      : 0;

    // by buyer type (30d)
    const typeMap = {};
    recent.forEach((o) => {
      const t = o.buyerType || 'INDIVIDUAL';
      const e = (typeMap[t] = typeMap[t] || { type: t, orders: 0, qtyKg: 0, revenue: 0, buyers: new Set() });
      e.orders += 1;
      e.qtyKg += Number(o.quantityKg) || 0;
      e.revenue += amountOf(o);
      e.buyers.add(String(o.consumer));
    });
    const byBuyerType = Object.values(typeMap)
      .map((e) => ({ type: e.type, orders: e.orders, qtyKg: Math.round(e.qtyKg), revenue: Math.round(e.revenue), buyers: e.buyers.size }))
      .sort((a, b) => b.orders - a.orders);

    // top produce (30d) + 7d vs previous 7d trend
    const prodMap = {};
    orders.forEach((o) => {
      const name = o.listing?.produceType;
      if (!name) return;
      const t = new Date(o.createdAt).getTime();
      const key = name.toLowerCase();
      const e = (prodMap[key] = prodMap[key] || { produceType: name, orders30: 0, qtyKg30: 0, revenue30: 0, last7: 0, prev7: 0 });
      if (t >= since30) {
        e.orders30 += 1;
        e.qtyKg30 += Number(o.quantityKg) || 0;
        e.revenue30 += amountOf(o);
      }
      if (t >= now - 7 * DAY) e.last7 += 1;
      else if (t >= now - 14 * DAY) e.prev7 += 1;
    });
    const topProduce = Object.values(prodMap)
      .filter((e) => e.orders30 > 0)
      .map((e) => ({
        produceType: e.produceType,
        orders: e.orders30,
        qtyKg: Math.round(e.qtyKg30),
        revenue: Math.round(e.revenue30),
        trend: e.last7 > e.prev7 ? 'UP' : e.last7 < e.prev7 ? 'DOWN' : 'FLAT',
        signal: e.last7 >= 10 ? 'HIGH' : e.last7 >= 4 ? 'MEDIUM' : 'LOW',
      }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 8);

    // weekly trend, last 8 weeks (oldest first)
    const weekly = Array.from({ length: 8 }, (_, i) => ({ week: i, orders: 0, revenue: 0 }));
    orders.forEach((o) => {
      const ago = Math.floor((now - new Date(o.createdAt).getTime()) / (7 * DAY));
      if (ago >= 0 && ago < 8) {
        const w = weekly[7 - ago];
        w.orders += 1;
        w.revenue += amountOf(o);
      }
    });
    weekly.forEach((w) => (w.revenue = Math.round(w.revenue)));

    // platform-wide demand (7d) for produce this FPO is not currently listing
    const platform = await FpoOrder.aggregate([
      { $match: { createdAt: { $gte: new Date(now - 7 * DAY) }, status: valid } },
      { $lookup: { from: 'listings', localField: 'listing', foreignField: '_id', as: 'l' } },
      { $unwind: '$l' },
      { $group: { _id: { $toLower: '$l.produceType' }, name: { $first: '$l.produceType' }, orders: { $sum: 1 }, qtyKg: { $sum: '$quantityKg' } } },
      { $sort: { orders: -1 } },
      { $limit: 20 },
    ]);
    const listed = (await Listing.find({ fpo: fpo._id, status: 'Published' }).distinct('produceType')).map((p) => String(p).toLowerCase());
    const notListed = platform
      .filter((p) => !listed.includes(p._id))
      .slice(0, 5)
      .map((p) => ({ produceType: p.name, orders: p.orders, qtyKg: Math.round(p.qtyKg) }));

    res.json({
      success: true,
      data: {
        summary: {
          orders30: recent.length,
          revenue30: Math.round(recent.reduce((s, o) => s + amountOf(o), 0)),
          buyers30: buyerIds.length,
          newBuyers,
          repeatBuyers,
          repeatRate: buyerIds.length ? Math.round((repeatBuyers / buyerIds.length) * 100) : 0,
          referredBuyers,
        },
        byBuyerType,
        topProduce,
        weekly,
        notListed,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------- FPO: set own location + delivery radius ----------
exports.updateFpoLocation = async (req, res) => {
  try {
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    const radius = Number(req.body.deliveryRadiusKm);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ success: false, message: 'Valid lat and lng are required' });
    }
    const fpo = await Fpo.findOne({ adminUser: req.user.id });
    if (!fpo) return res.status(404).json({ success: false, message: 'FPO profile not found' });

    fpo.geoLocation = { type: 'Point', coordinates: [lng, lat] };
    if (Number.isFinite(radius) && radius >= 1 && radius <= 200) fpo.defaultDeliveryRadiusKm = radius;
    await fpo.save();

    const listingsUpdated = await geoService.syncAllListingsForFpo(fpo);
    res.json({
      success: true,
      data: {
        geoLocation: fpo.geoLocation,
        defaultDeliveryRadiusKm: fpo.defaultDeliveryRadiusKm,
        listingsUpdated,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ---------- Checkout: soft delivery-area warning (never blocks an order) ----------
exports.deliveryCheck = async (req, res) => {
  try {
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    const ids = Array.isArray(req.body.listingIds) ? req.body.listingIds.slice(0, 50) : [];
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !ids.length) {
      return res.json({ success: true, data: [] });
    }
    const rows = await Listing.find({ _id: { $in: ids } })
      .select('produceType originLocation deliveryRadiusKm fpo')
      .populate('fpo', 'name geoLocation defaultDeliveryRadiusKm')
      .lean();

    const data = rows
      .map((l) => {
        const c = l.originLocation?.coordinates?.length === 2
          ? l.originLocation.coordinates
          : l.fpo?.geoLocation?.coordinates?.length === 2
            ? l.fpo.geoLocation.coordinates
            : null;
        if (!c) return null;
        const km = geoService.haversineKm(lat, lng, c[1], c[0]);
        const radiusKm = geoService.radiusFor(l);
        return {
          listingId: String(l._id),
          produceType: l.produceType,
          fpoName: l.fpo?.name,
          distanceKm: Math.round(km * 10) / 10,
          radiusKm,
          outside: km > radiusKm,
        };
      })
      .filter(Boolean);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

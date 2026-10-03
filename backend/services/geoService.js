/**
 * Geo Service – Location based discovery & delivery radius
 */
const Listing = require('../models/Listing');
const Fpo = require('../models/Fpo');

/**
 * List published listings and attach distance from the user (km).
 * NEVER hides a listing because it is far away - distance is info only.
 * Listings without coordinates (own or FPO's) are still returned, with distanceKm = null.
 */
async function findListingsNear(lng, lat, _radiusKm, filters = {}) {
  const query = { status: 'Published', availableQuantityKg: { $gt: 0 } };

  if (filters.produceType) {
    const safe = String(filters.produceType).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.produceType = new RegExp(safe, 'i');
  }
  if (filters.grade && filters.grade !== 'ALL') query.grade = String(filters.grade).toUpperCase();
  if (filters.minPrice != null) query.pricePerKg = { ...query.pricePerKg, $gte: Number(filters.minPrice) };
  if (filters.maxPrice != null) query.pricePerKg = { ...query.pricePerKg, $lte: Number(filters.maxPrice) };
  if (filters.trendingOnly) query.isTrending = true;

  const sortMap = {
    price_asc: { pricePerKg: 1 },
    price_desc: { pricePerKg: -1 },
    qty_desc: { availableQuantityKg: -1 },
  };

  const rows = await Listing.find(query)
    .populate('fpo', 'name contactDetails registrationNumber kycStatus registrationType logo shortBio averageRating geoLocation defaultDeliveryRadiusKm')
    .sort(sortMap[filters.sort] || { createdAt: -1 })
    .lean();

  const hasUser = Number.isFinite(lat) && Number.isFinite(lng);

  const withDistance = rows.map((l) => {
    const c = l.originLocation?.coordinates?.length === 2
      ? l.originLocation.coordinates
      : l.fpo?.geoLocation?.coordinates?.length === 2
        ? l.fpo.geoLocation.coordinates
        : null;
    if (hasUser && c && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
      const km = haversineKm(lat, lng, c[1], c[0]);
      return {
        ...l,
        distanceKm: Math.round(km * 10) / 10,
        deliveryRadiusKm: radiusFor(l),
        outsideDeliveryArea: km > radiusFor(l),
      };
    }
    return { ...l, distanceKm: null, outsideDeliveryArea: false };
  });

  if (filters.sort === 'nearest') {
    withDistance.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }
  return filters.limit ? withDistance.slice(0, filters.limit) : withDistance;
}

/**
 * Delivery radius for a listing (listing -> FPO default -> 25 km)
 */
function radiusFor(listing) {
  return Number(listing.deliveryRadiusKm) || Number(listing.fpo?.defaultDeliveryRadiusKm) || 25;
}

/**
 * Check if a point is within listing's delivery radius.
 * Returns true when we cannot tell (no coordinates) so we never wrongly warn.
 */
function isWithinDeliveryRadius(listing, consumerLat, consumerLng) {
  const c = listing.originLocation?.coordinates?.length === 2
    ? listing.originLocation.coordinates
    : listing.fpo?.geoLocation?.coordinates?.length === 2
      ? listing.fpo.geoLocation.coordinates
      : null;
  if (!c) return true;
  return haversineKm(consumerLat, consumerLng, c[1], c[0]) <= radiusFor(listing);
}

/**
 * Haversine distance in km
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Copy the FPO's location onto a listing document (does NOT save).
 * Returns true if the listing was changed.
 */
function applyFpoOrigin(listing, fpo) {
  if (!fpo?.geoLocation?.coordinates || fpo.geoLocation.coordinates.length !== 2) return false;
  listing.originLocation = { type: 'Point', coordinates: [...fpo.geoLocation.coordinates] };
  listing.deliveryRadiusKm = fpo.defaultDeliveryRadiusKm || 30;
  return true;
}

/**
 * Update listing origin from FPO geo (helper when publishing)
 */
async function syncListingOriginFromFpo(listingId) {
  const listing = await Listing.findById(listingId);
  if (!listing) return null;
  const fpo = await Fpo.findById(listing.fpo);
  if (applyFpoOrigin(listing, fpo)) await listing.save();
  return listing;
}

/**
 * After an FPO changes its location/radius, update all of its listings.
 */
async function syncAllListingsForFpo(fpo) {
  if (!fpo?.geoLocation?.coordinates || fpo.geoLocation.coordinates.length !== 2) return 0;
  const r = await Listing.updateMany(
    { fpo: fpo._id },
    {
      $set: {
        originLocation: { type: 'Point', coordinates: [...fpo.geoLocation.coordinates] },
        deliveryRadiusKm: fpo.defaultDeliveryRadiusKm || 30,
      },
    }
  );
  return r.modifiedCount || 0;
}

module.exports = {
  findListingsNear,
  isWithinDeliveryRadius,
  haversineKm,
  radiusFor,
  applyFpoOrigin,
  syncListingOriginFromFpo,
  syncAllListingsForFpo,
};

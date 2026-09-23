const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');
const { appendAuditBlock } = require('../services/blockchainAuditService');

/**
 * Best-effort audit write — never throws into the business flow.
 */
async function logActivity({
  req,
  fpoId,
  action,
  summary,
  entityType = '',
  entityId = null,
  meta = {},
}) {
  try {
    const actor = req?.user;
    if (!actor) return;

    // The JWT only carries { id, role }, so look the display name up.
    let actorName = actor.name || '';
    if (!actorName) {
      const u = await User.findById(actor._id || actor.id).select('name');
      actorName = u ? u.name : '';
    }

    const actorId = actor._id || actor.id;

    await ActivityLog.create({
      fpo: fpoId || undefined,
      actor: actorId,
      actorRole: actor.role || '',
      actorName,
      action,
      entityType,
      entityId: entityId || undefined,
      summary,
      meta,
      ip: req.headers?.['x-forwarded-for'] || req.ip || '',
    });

    await appendAuditBlock({
      actor: actorId,
      actorRole: actor.role || '',
      fpo: fpoId,
      action,
      entityType,
      entityId,
      summary,
      meta: { ...meta, ip: req.headers?.['x-forwarded-for'] || req.ip || '' },
    });
  } catch (err) {
    console.error('ActivityLog write failed:', err.message);
  }
}

module.exports = { logActivity };

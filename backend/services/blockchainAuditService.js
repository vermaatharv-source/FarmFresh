const crypto = require('crypto');
const AuditBlock = require('../models/AuditBlock');

const GENESIS_HASH = crypto
  .createHash('sha256')
  .update('FARMFRESH-AUDIT-GENESIS-V1')
  .digest('hex');

function canonical(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(canonical(value)).digest('hex');
}

/**
 * Appends a block. Best-effort by design: audit integrity must never break a
 * business transaction if Mongo is temporarily unavailable.
 */
async function appendAuditBlock(event) {
  try {
    const payload = {
      actor: String(event.actor || ''),
      actorRole: event.actorRole || '',
      fpo: event.fpo ? String(event.fpo) : '',
      action: event.action,
      entityType: event.entityType || '',
      entityId: event.entityId ? String(event.entityId) : '',
      summary: event.summary || '',
      meta: event.meta || {},
      timestamp: new Date(event.timestamp || Date.now()).toISOString(),
    };

    const previous = await AuditBlock.findOne().sort({ sequence: -1 }).select('sequence hash').lean();
    const sequence = previous ? previous.sequence + 1 : 1;
    const previousHash = previous ? previous.hash : GENESIS_HASH;
    const payloadHash = sha256(payload);
    const hash = sha256({ sequence, previousHash, payloadHash });

    await AuditBlock.create({
      sequence,
      previousHash,
      timestamp: new Date(payload.timestamp),
      actor: event.actor,
      actorRole: event.actorRole || '',
      fpo: event.fpo || undefined,
      action: event.action,
      entityType: event.entityType || '',
      entityId: event.entityId || undefined,
      payloadHash,
      hash,
    });

    return { sequence, hash };
  } catch (err) {
    // Duplicate sequence can occur only if two writes race. The next audit
    // event will recover the chain by reading the latest committed block.
    console.error('[blockchain-audit] append failed:', err.message);
    return null;
  }
}

async function verifyAuditChain() {
  const blocks = await AuditBlock.find().sort({ sequence: 1 }).lean();
  let previousHash = GENESIS_HASH;
  let expectedSequence = 1;

  for (const block of blocks) {
    if (block.sequence !== expectedSequence || block.previousHash !== previousHash) {
      return { valid: false, checked: expectedSequence - 1, reason: 'Broken sequence or previousHash link.' };
    }

    const expectedHash = sha256({
      sequence: block.sequence,
      previousHash: block.previousHash,
      payloadHash: block.payloadHash,
    });

    if (expectedHash !== block.hash) {
      return { valid: false, checked: expectedSequence - 1, reason: `Hash mismatch at block ${block.sequence}.` };
    }

    previousHash = block.hash;
    expectedSequence += 1;
  }

  return { valid: true, checked: blocks.length };
}

module.exports = { appendAuditBlock, verifyAuditChain, GENESIS_HASH };

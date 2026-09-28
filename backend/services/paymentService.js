const PaymentTransaction = require('../models/PaymentTransaction');
const { generateTransactionId } = require('../utils/idGenerator');
const { calculateSplit } = require('../config/platformFee');

/**
 * Records a consumer payment and splits it between the FPO and the platform.
 * Call it INSIDE the same Mongo session as the order creation so the order and
 * its payment record are saved (or rolled back) together.
 *
 * NOTE: money movement is recorded in the ledger here. To move real money, plug
 * your gateway's split/route call (Razorpay Route, Cashfree Easy Split, etc.) in
 * the marked spot below, using the FPO's linked account for the FPO share.
 */
async function recordOrderPayment({ order, session }) {
  const split = calculateSplit(order.totalPrice);
  const transactionId = generateTransactionId('TXN');

  // >>> Gateway hook: create the payment + route `split.fpoAmount` to the FPO's
  // >>> linked account and `split.platformFee` to the platform account here.

  const [txn] = await PaymentTransaction.create([{
    transactionId,
    order: order._id,
    fpo: order.fpo,
    consumer: order.consumer,
    paymentMethod: order.paymentMethod,
    orderAmount: split.orderAmount,
    platformFeePercent: split.percent,
    platformFee: split.platformFee,
    fpoAmount: split.fpoAmount,
    totalCharged: split.totalCharged,
    status: 'Success',
    splits: [
      { beneficiary: 'FPO', fpo: order.fpo, amount: split.fpoAmount },
      { beneficiary: 'PLATFORM', amount: split.platformFee },
    ],
  }], { session });

  order.platformFee = split.platformFee;
  order.platformFeePercent = split.percent;
  order.fpoAmount = split.fpoAmount;
  order.totalCharged = split.totalCharged;
  order.paymentTransactionId = transactionId;
  order.paymentStatus = 'Paid';
  await order.save({ session });

  return txn;
}

/** Marks the payment refunded and reverses both splits. */
async function recordRefund({ order, refundTransactionId, session }) {
  const opts = session ? { session } : {};
  const txn = await PaymentTransaction.findOne({ order: order._id }, null, opts);
  if (!txn) return null;
  txn.status = 'Refunded';
  txn.refundTransactionId = refundTransactionId;
  txn.refundedAt = new Date();
  txn.splits.forEach((s) => { s.status = 'Reversed'; });
  await txn.save(opts);
  return txn;
}

module.exports = { recordOrderPayment, recordRefund };

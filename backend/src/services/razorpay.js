const Razorpay = require("razorpay");
const crypto = require("crypto");
const config = require("../utils/config");

const razorpay = new Razorpay({
  key_id: config.razorpay.keyId,
  key_secret: config.razorpay.keySecret,
});

/**
 * Calculate surcharge based on payment method
 */
function calculateSurcharge(baseAmount, paymentMethod) {
  const rate = config.payment.surcharges[paymentMethod] || 0;
  const surchargePercent = rate / 100;
  const surchargeAmount = Math.round(baseAmount * surchargePercent * 100) / 100;

  let gstOnSurcharge = 0;
  if (config.gst.enabled && surchargeAmount > 0) {
    gstOnSurcharge = Math.round(surchargeAmount * (config.gst.rate / 100) * 100) / 100;
  }

  return {
    surchargeRate: surchargePercent,
    surchargeAmount,
    gstOnSurcharge,
    totalAmount: Math.round((baseAmount + surchargeAmount + gstOnSurcharge) * 100) / 100,
  };
}

/**
 * Create a Razorpay order
 */
async function createOrder({ totalAmount, transactionId, userId, paymentType }) {
  const options = {
    amount: Math.round(totalAmount * 100), // Razorpay expects paise
    currency: config.payment.currency,
    receipt: transactionId,
    notes: {
      society: config.society.shortName,
      userId,
      paymentType,
      transactionId,
    },
  };

  const order = await razorpay.orders.create(options);
  return order;
}

/**
 * Verify Razorpay payment signature (for client-side verification)
 */
function verifyPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const body = razorpayOrderId + "|" + razorpayPaymentId;
  const expectedSignature = crypto
    .createHmac("sha256", config.razorpay.keySecret)
    .update(body)
    .digest("hex");

  return expectedSignature === razorpaySignature;
}

/**
 * Verify Razorpay webhook signature
 */
function verifyWebhookSignature(rawBody, signature) {
  const expectedSignature = crypto
    .createHmac("sha256", config.razorpay.webhookSecret)
    .update(rawBody)
    .digest("hex");

  return expectedSignature === signature;
}

/**
 * Fetch payment details from Razorpay
 */
async function fetchPayment(paymentId) {
  return razorpay.payments.fetch(paymentId);
}

/**
 * Process refund
 */
async function createRefund(paymentId, amount) {
  return razorpay.payments.refund(paymentId, {
    amount: amount ? Math.round(amount * 100) : undefined, // undefined = full refund
  });
}

module.exports = {
  razorpay,
  calculateSurcharge,
  createOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  fetchPayment,
  createRefund,
};

/**
 * Frontend configuration utilities
 * 
 * The frontend fetches all config from the backend's /api/config/public endpoint.
 * This ensures the frontend is always in sync with the backend config (.env).
 * 
 * No sensitive data (secret keys, DB URLs) is ever sent to the frontend.
 */

export function formatCurrency(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date, options = {}) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(d);
}

/**
 * Calculate surcharge for a given amount and payment method
 * @param {number} baseAmount
 * @param {string} paymentMethod
 * @param {Object} surcharges - surcharge rates from config (in %)
 * @param {Object} gstConfig - { enabled, rate }
 * @returns {Object} { surchargeRate, surchargeAmount, gstOnSurcharge, totalAmount }
 */
export function calculateSurcharge(baseAmount, paymentMethod, surcharges = {}, gstConfig = {}) {
  const ratePercent = surcharges[paymentMethod] || 0;
  const surchargeRate = ratePercent / 100;
  const surchargeAmount = Math.round(baseAmount * surchargeRate * 100) / 100;

  let gstOnSurcharge = 0;
  if (gstConfig.enabled && surchargeAmount > 0) {
    gstOnSurcharge = Math.round(surchargeAmount * (gstConfig.rate / 100) * 100) / 100;
  }

  return {
    surchargeRate,
    surchargeAmount,
    gstOnSurcharge,
    totalAmount: Math.round((baseAmount + surchargeAmount + gstOnSurcharge) * 100) / 100,
  };
}

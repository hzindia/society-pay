const express = require("express");
const config = require("../utils/config");

const router = express.Router();

/**
 * Public config endpoint — returns non-sensitive society settings
 * that the frontend needs for display and payment calculations.
 */
router.get("/public", (req, res) => {
  res.json({
    society: {
      name: config.society.name,
      shortName: config.society.shortName,
      address: config.society.address,
      email: config.society.email,
      phone: config.society.phone,
      regNo: config.society.regNo,
      logoUrl: config.society.logoUrl,
    },
    payment: {
      currency: config.payment.currency,
      surcharges: config.payment.surcharges,
      types: config.payment.types,
    },
    gst: {
      enabled: config.gst.enabled,
      rate: config.gst.rate,
    },
    razorpayKeyId: config.razorpay.keyId, // Public key only
  });
});

module.exports = router;

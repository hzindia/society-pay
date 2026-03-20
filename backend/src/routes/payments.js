const express = require("express");
const { body, query, validationResult } = require("express-validator");
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const config = require("../utils/config");
const { authenticate } = require("../middleware/auth");
const razorpayService = require("../services/razorpay");
const emailService = require("../services/email");

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Generate human-readable transaction ID
 */
function generateTransactionId() {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `SOC-${y}${m}-${rand}`;
}

// ── Calculate Surcharge (public, no auth needed) ────────────────────────────
router.post("/calculate", [
  body("baseAmount").isFloat({ min: 1 }),
  body("paymentMethod").isIn(["credit_card", "debit_card", "upi", "net_banking", "wallet"]),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { baseAmount, paymentMethod } = req.body;
  const breakdown = razorpayService.calculateSurcharge(baseAmount, paymentMethod);

  res.json({
    baseAmount,
    paymentMethod,
    ...breakdown,
    currency: config.payment.currency,
    gstEnabled: config.gst.enabled,
  });
});

// ── Create Payment Order ────────────────────────────────────────────────────
router.post(
  "/create-order",
  authenticate,
  [
    body("baseAmount").isFloat({ min: 1 }),
    body("paymentMethod").isIn(["credit_card", "debit_card", "upi", "net_banking", "wallet"]),
    body("paymentType").trim().notEmpty(),
    body("description").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { baseAmount, paymentMethod, paymentType, description } = req.body;

      // Validate payment type
      if (!config.payment.types.includes(paymentType)) {
        return res.status(400).json({ error: "Invalid payment type" });
      }

      // Calculate surcharge
      const { surchargeRate, surchargeAmount, gstOnSurcharge, totalAmount } =
        razorpayService.calculateSurcharge(baseAmount, paymentMethod);

      // Generate transaction ID
      const transactionId = generateTransactionId();

      // Create Razorpay order
      const razorpayOrder = await razorpayService.createOrder({
        totalAmount,
        transactionId,
        userId: req.user.id,
        paymentType,
      });

      // Save payment in DB
      const payment = await prisma.payment.create({
        data: {
          transactionId,
          userId: req.user.id,
          paymentType,
          description,
          baseAmount,
          paymentMethod,
          surchargeRate,
          surchargeAmount,
          gstOnSurcharge,
          totalAmount,
          razorpayOrderId: razorpayOrder.id,
          status: "CREATED",
        },
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: "payment.created",
          entityType: "payment",
          entityId: payment.id,
          metadata: { transactionId, totalAmount, paymentMethod },
          ipAddress: req.ip,
        },
      });

      res.status(201).json({
        payment: {
          id: payment.id,
          transactionId: payment.transactionId,
          baseAmount,
          surchargeRate,
          surchargeAmount,
          gstOnSurcharge,
          totalAmount,
          paymentMethod,
          paymentType,
        },
        razorpay: {
          orderId: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
          keyId: config.razorpay.keyId, // Public key for frontend checkout
        },
        society: {
          name: config.society.name,
          email: config.society.email,
        },
      });
    } catch (err) {
      console.error("Create order error:", err);
      res.status(500).json({ error: "Failed to create payment order" });
    }
  }
);

// ── Verify Payment (client-side callback) ───────────────────────────────────
router.post(
  "/verify",
  authenticate,
  [
    body("razorpayOrderId").notEmpty(),
    body("razorpayPaymentId").notEmpty(),
    body("razorpaySignature").notEmpty(),
  ],
  async (req, res) => {
    try {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

      // Verify signature
      const isValid = razorpayService.verifyPaymentSignature({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });

      if (!isValid) {
        // Mark as failed
        await prisma.payment.updateMany({
          where: { razorpayOrderId },
          data: { status: "FAILED", failureReason: "Signature verification failed" },
        });
        return res.status(400).json({ error: "Payment verification failed — invalid signature" });
      }

      // Update payment record
      const payment = await prisma.payment.update({
        where: { razorpayOrderId },
        data: {
          razorpayPaymentId,
          razorpaySignature,
          status: "CAPTURED",
          paidAt: new Date(),
        },
        include: { user: true },
      });

      // Send email receipt
      const emailSent = await emailService.sendPaymentConfirmation(payment, payment.user);
      if (emailSent) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: { emailSent: true },
        });
      }

      // Audit log
      await prisma.auditLog.create({
        data: {
          userId: payment.userId,
          action: "payment.captured",
          entityType: "payment",
          entityId: payment.id,
          metadata: { razorpayPaymentId, totalAmount: payment.totalAmount },
          ipAddress: req.ip,
        },
      });

      res.json({
        success: true,
        payment: {
          id: payment.id,
          transactionId: payment.transactionId,
          baseAmount: payment.baseAmount,
          surchargeRate: payment.surchargeRate,
          surchargeAmount: payment.surchargeAmount,
          gstOnSurcharge: payment.gstOnSurcharge,
          totalAmount: payment.totalAmount,
          paymentType: payment.paymentType,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          paidAt: payment.paidAt,
          razorpayPaymentId: payment.razorpayPaymentId,
        },
      });
    } catch (err) {
      console.error("Verify error:", err);
      res.status(500).json({ error: "Payment verification failed" });
    }
  }
);

// ── Razorpay Webhook ────────────────────────────────────────────────────────
router.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      return res.status(400).json({ error: "Missing signature" });
    }

    const rawBody = typeof req.body === "string" ? req.body : req.body.toString("utf8");

    // Verify webhook signature
    const isValid = razorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn("⚠️  Invalid webhook signature received");
      return res.status(400).json({ error: "Invalid signature" });
    }

    const event = JSON.parse(rawBody);
    const { event: eventType, payload } = event;

    console.log(`📥 Webhook: ${eventType}`);

    if (eventType === "payment.captured") {
      const rpPayment = payload.payment.entity;
      const orderId = rpPayment.order_id;

      await prisma.payment.updateMany({
        where: { razorpayOrderId: orderId, status: { not: "CAPTURED" } },
        data: {
          razorpayPaymentId: rpPayment.id,
          status: "CAPTURED",
          paidAt: new Date(rpPayment.created_at * 1000),
        },
      });
    } else if (eventType === "payment.failed") {
      const rpPayment = payload.payment.entity;
      const orderId = rpPayment.order_id;

      await prisma.payment.updateMany({
        where: { razorpayOrderId: orderId },
        data: {
          status: "FAILED",
          failureReason: rpPayment.error_description || "Payment failed",
        },
      });
    }

    // Always respond 200 to acknowledge webhook
    res.json({ status: "ok" });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// ── Payment History (for logged-in resident) ────────────────────────────────
router.get("/history", authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          transactionId: true,
          paymentType: true,
          baseAmount: true,
          surchargeAmount: true,
          gstOnSurcharge: true,
          totalAmount: true,
          paymentMethod: true,
          status: true,
          paidAt: true,
          createdAt: true,
        },
      }),
      prisma.payment.count({ where: { userId: req.user.id } }),
    ]);

    res.json({
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("History error:", err);
    res.status(500).json({ error: "Failed to fetch payment history" });
  }
});

// ── Get Single Payment Receipt ──────────────────────────────────────────────
router.get("/receipt/:transactionId", authenticate, async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { transactionId: req.params.transactionId },
      include: { user: { select: { name: true, flatNumber: true, wing: true, email: true } } },
    });

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // Only allow own payments or admin
    if (payment.userId !== req.user.id && req.user.role === "RESIDENT") {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({
      receipt: {
        ...payment,
        society: config.society,
        gstEnabled: config.gst.enabled,
        gstin: config.gst.gstin,
      },
    });
  } catch (err) {
    console.error("Receipt error:", err);
    res.status(500).json({ error: "Failed to fetch receipt" });
  }
});

// ── Download Receipt as PDF ──────────────────────────────────────────────────
router.get("/receipt/:transactionId/pdf", authenticate, async (req, res) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { transactionId: req.params.transactionId },
      include: { user: { select: { name: true, flatNumber: true, wing: true, email: true } } },
    });

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    if (payment.userId !== req.user.id && req.user.role === "RESIDENT") {
      return res.status(403).json({ error: "Access denied" });
    }

    if (payment.status !== "CAPTURED") {
      return res.status(400).json({ error: "Receipt available only for successful payments" });
    }

    // Try to generate PDF (pdfkit is optional dependency)
    try {
      const receiptService = require("../services/receipt");
      const pdfBuffer = await receiptService.generateReceipt(payment);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=receipt-${payment.transactionId}.pdf`
      );
      res.send(pdfBuffer);
    } catch (pdfErr) {
      // If pdfkit not installed, return JSON receipt instead
      console.warn("PDF generation failed (pdfkit may not be installed):", pdfErr.message);
      res.json({
        receipt: {
          ...payment,
          society: config.society,
        },
        note: "PDF generation requires pdfkit. Install with: npm install pdfkit",
      });
    }
  } catch (err) {
    console.error("PDF receipt error:", err);
    res.status(500).json({ error: "Failed to generate receipt" });
  }
});

module.exports = router;

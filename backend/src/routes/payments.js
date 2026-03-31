const express = require("express");
const { body, validationResult } = require("express-validator");
const crypto = require("crypto");
const config = require("../utils/config");
const { authenticate } = require("../middleware/auth");
const razorpayService = require("../services/razorpay");
const emailService = require("../services/email");
const prisma = require("../utils/prisma");

const router = express.Router();

// Razorpay orders expire after 15 minutes by default (we use 30 to be safe)
const ORDER_EXPIRY_MS = 30 * 60 * 1000;

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

/**
 * Log a payment state transition to the PaymentEvent table.
 * Uses the provided Prisma client (tx inside a transaction, or prisma directly).
 */
async function logPaymentEvent(client, { paymentId, fromStatus, toStatus, source, metadata }) {
  return client.paymentEvent.create({
    data: { paymentId, fromStatus: fromStatus || null, toStatus, source, metadata: metadata || null },
  });
}

/**
 * Fire-and-forget email with attempt tracking.
 * Never throws — all errors are logged.
 */
function sendEmailAsync(payment, user) {
  if (payment.emailSent) return;
  emailService.sendPaymentConfirmation(payment, user)
    .then((sent) => {
      prisma.payment.update({
        where: { id: payment.id },
        data: { emailSent: sent, emailAttempts: { increment: 1 } },
      }).catch((err) => console.error("Email attempt tracking failed:", err));
    })
    .catch((err) => {
      console.error("Email send error:", err.message);
      prisma.payment.update({
        where: { id: payment.id },
        data: { emailAttempts: { increment: 1 } },
      }).catch(() => {});
    });
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
// Accepts an optional `idempotencyKey` from the client (UUID generated per
// payment attempt). If the same key is presented again — network retry, double
// click, tab refresh — we return the already-created order instead of making
// a duplicate Razorpay order.
router.post(
  "/create-order",
  authenticate,
  [
    body("baseAmount").isFloat({ min: 1 }),
    body("paymentMethod").isIn(["credit_card", "debit_card", "upi", "net_banking", "wallet"]),
    body("paymentType").trim().notEmpty(),
    body("description").optional().trim(),
    body("idempotencyKey").optional().trim().isLength({ max: 64 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { baseAmount, paymentMethod, paymentType, description, idempotencyKey } = req.body;

      if (!config.payment.types.includes(paymentType)) {
        return res.status(400).json({ error: "Invalid payment type" });
      }

      // ── Idempotency: return existing order if key was seen before ────────
      if (idempotencyKey) {
        const existing = await prisma.payment.findFirst({
          where: { idempotencyKey, userId: req.user.id },
        });
        if (existing && existing.razorpayOrderId) {
          return res.status(201).json({
            payment: {
              id: existing.id,
              transactionId: existing.transactionId,
              baseAmount: existing.baseAmount,
              surchargeRate: existing.surchargeRate,
              surchargeAmount: existing.surchargeAmount,
              gstOnSurcharge: existing.gstOnSurcharge,
              totalAmount: existing.totalAmount,
              paymentMethod: existing.paymentMethod,
              paymentType: existing.paymentType,
            },
            razorpay: {
              orderId: existing.razorpayOrderId,
              amount: Math.round(existing.totalAmount * 100),
              currency: config.payment.currency,
              keyId: config.razorpay.keyId,
            },
            society: { name: config.society.name, email: config.society.email },
          });
        }
      }

      // ── Calculate surcharge ───────────────────────────────────────────────
      const { surchargeRate, surchargeAmount, gstOnSurcharge, totalAmount } =
        razorpayService.calculateSurcharge(baseAmount, paymentMethod);

      const transactionId = generateTransactionId();

      // ── Create Razorpay order ─────────────────────────────────────────────
      const razorpayOrder = await razorpayService.createOrder({
        totalAmount,
        transactionId,
        userId: req.user.id,
        paymentType,
      });

      // ── Persist payment + first event atomically ──────────────────────────
      const payment = await prisma.$transaction(async (tx) => {
        const p = await tx.payment.create({
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
            idempotencyKey: idempotencyKey || null,
            expiresAt: new Date(Date.now() + ORDER_EXPIRY_MS),
            status: "CREATED",
          },
        });

        await logPaymentEvent(tx, {
          paymentId: p.id,
          fromStatus: null,
          toStatus: "CREATED",
          source: "client_create",
          metadata: { transactionId, totalAmount, paymentMethod, ipAddress: req.ip },
        });

        await tx.auditLog.create({
          data: {
            userId: req.user.id,
            action: "payment.created",
            entityType: "payment",
            entityId: p.id,
            metadata: { transactionId, totalAmount, paymentMethod },
            ipAddress: req.ip,
          },
        });

        return p;
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
          keyId: config.razorpay.keyId,
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
// This is called immediately after the Razorpay modal closes with success.
// The webhook may arrive concurrently — both paths are idempotent.
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

      // ── Find payment with ownership check ─────────────────────────────────
      const existing = await prisma.payment.findFirst({
        where: { razorpayOrderId, userId: req.user.id },
        include: { user: true },
      });

      if (!existing) {
        return res.status(404).json({ error: "Payment not found" });
      }

      // ── Idempotent success: webhook may have beaten the client callback ───
      if (existing.status === "CAPTURED") {
        return res.json({
          success: true,
          payment: {
            id: existing.id,
            transactionId: existing.transactionId,
            baseAmount: existing.baseAmount,
            surchargeRate: existing.surchargeRate,
            surchargeAmount: existing.surchargeAmount,
            gstOnSurcharge: existing.gstOnSurcharge,
            totalAmount: existing.totalAmount,
            paymentType: existing.paymentType,
            paymentMethod: existing.paymentMethod,
            status: existing.status,
            paidAt: existing.paidAt,
            razorpayPaymentId: existing.razorpayPaymentId,
          },
        });
      }

      // ── Signature verification ────────────────────────────────────────────
      const isValid = razorpayService.verifyPaymentSignature({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });

      if (!isValid) {
        // Log the bad attempt but do NOT auto-fail the payment: the webhook
        // may still arrive and legitimately capture it.
        await logPaymentEvent(prisma, {
          paymentId: existing.id,
          fromStatus: existing.status,
          toStatus: existing.status,
          source: "client_verify",
          metadata: { error: "invalid_signature", razorpayPaymentId, ipAddress: req.ip },
        });
        return res.status(400).json({ error: "Payment verification failed — invalid signature" });
      }

      // ── Atomic conditional update (race-safe) ─────────────────────────────
      // updateMany returns { count } — if count === 0 the webhook captured it
      // first, which is fine. We fetch the current record either way.
      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.payment.updateMany({
          where: {
            razorpayOrderId,
            userId: req.user.id,
            status: { in: ["CREATED", "AUTHORIZED"] },
          },
          data: {
            razorpayPaymentId,
            razorpaySignature,
            status: "CAPTURED",
            paidAt: new Date(),
          },
        });

        if (result.count === 0) {
          // Webhook was faster — return null, caller fetches fresh record below
          return null;
        }

        const p = await tx.payment.findFirst({
          where: { razorpayOrderId },
          include: { user: true },
        });

        await logPaymentEvent(tx, {
          paymentId: p.id,
          fromStatus: existing.status,
          toStatus: "CAPTURED",
          source: "client_verify",
          metadata: { razorpayPaymentId, totalAmount: p.totalAmount },
        });

        await tx.auditLog.create({
          data: {
            userId: p.userId,
            action: "payment.captured",
            entityType: "payment",
            entityId: p.id,
            metadata: { razorpayPaymentId, source: "client_verify", totalAmount: p.totalAmount },
            ipAddress: req.ip,
          },
        });

        return p;
      });

      const payment = updated || await prisma.payment.findFirst({
        where: { razorpayOrderId },
        include: { user: true },
      });

      // ── Email receipt (async, non-blocking) ───────────────────────────────
      sendEmailAsync(payment, payment.user);

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

// ── Check Payment Status (client recovery) ──────────────────────────────────
// Called by the frontend when /verify fails or the browser was interrupted.
// For expired CREATED payments, queries Razorpay to reconcile the real state.
router.get("/status/:orderId", authenticate, async (req, res) => {
  try {
    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: req.params.orderId, userId: req.user.id },
      include: { user: true },
    });

    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // If already resolved, just return current state
    if (payment.status !== "CREATED" && payment.status !== "AUTHORIZED") {
      return res.json({
        status: payment.status,
        transactionId: payment.transactionId,
        totalAmount: payment.totalAmount,
        paidAt: payment.paidAt,
      });
    }

    // ── Reconcile with Razorpay if the order has expired ─────────────────
    const isExpired = payment.expiresAt && payment.expiresAt < new Date();
    if (isExpired) {
      try {
        const rpPayments = await razorpayService.razorpay.orders.fetchPayments(req.params.orderId);
        const captured = rpPayments.items?.find((p) => p.status === "captured");

        if (captured) {
          // Money was taken — mark CAPTURED and send email
          await prisma.$transaction(async (tx) => {
            await tx.payment.update({
              where: { id: payment.id },
              data: {
                status: "CAPTURED",
                paidAt: new Date(captured.created_at * 1000),
                razorpayPaymentId: captured.id,
              },
            });
            await logPaymentEvent(tx, {
              paymentId: payment.id,
              fromStatus: payment.status,
              toStatus: "CAPTURED",
              source: "reconcile",
              metadata: { razorpayPaymentId: captured.id, trigger: "status_check" },
            });
          });

          const refreshed = await prisma.payment.findUnique({
            where: { id: payment.id },
            include: { user: true },
          });
          sendEmailAsync(refreshed, refreshed.user);

          return res.json({
            status: "CAPTURED",
            transactionId: payment.transactionId,
            totalAmount: payment.totalAmount,
            paidAt: new Date(captured.created_at * 1000),
            recovered: true,
          });
        }

        // No captured payment found — expire it
        await prisma.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: "FAILED", failureReason: "Order expired — no payment received" },
          });
          await logPaymentEvent(tx, {
            paymentId: payment.id,
            fromStatus: payment.status,
            toStatus: "FAILED",
            source: "reconcile",
            metadata: { reason: "expired", trigger: "status_check" },
          });
        });

        return res.json({ status: "FAILED", message: "Payment order expired" });
      } catch (rpErr) {
        // Razorpay API unreachable — don't change state, report current status
        console.error("Razorpay reconcile failed:", rpErr.message);
      }
    }

    res.json({
      status: payment.status,
      transactionId: payment.transactionId,
      totalAmount: payment.totalAmount,
      paidAt: payment.paidAt,
      expiresAt: payment.expiresAt,
    });
  } catch (err) {
    console.error("Status check error:", err);
    res.status(500).json({ error: "Failed to check payment status" });
  }
});

// ── Razorpay Webhook ────────────────────────────────────────────────────────
router.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      return res.status(400).json({ error: "Missing signature" });
    }

    const rawBody = typeof req.body === "string" ? req.body : req.body.toString("utf8");

    const isValid = razorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn("Invalid webhook signature received");
      return res.status(400).json({ error: "Invalid signature" });
    }

    const event = JSON.parse(rawBody);
    const { event: eventType, payload } = event;
    const razorpayEventId = event.id || null;

    console.log(`Webhook: ${eventType}${razorpayEventId ? ` (${razorpayEventId})` : ""}`);

    // ── Deduplication: skip events we've already processed ────────────────
    if (razorpayEventId) {
      const seen = await prisma.webhookEvent.findUnique({
        where: { razorpayEventId },
      });
      if (seen?.processed) {
        console.log(`Skipping duplicate webhook event: ${razorpayEventId}`);
        return res.json({ status: "ok" });
      }
    }

    // ── Record the webhook event (upsert handles rare duplicate arrival) ──
    const orderId = payload.payment?.entity?.order_id || null;
    const webhookRecord = await prisma.webhookEvent.upsert({
      where: { razorpayEventId: razorpayEventId ?? `no-id-${Date.now()}-${Math.random()}` },
      create: {
        razorpayEventId,
        eventType,
        orderId,
        processed: false,
        payload: event,
      },
      update: {},
    });

    // ── Process event inside a DB transaction ─────────────────────────────
    try {
      await processWebhookEvent(eventType, payload, webhookRecord.id);

      await prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: { processed: true, processedAt: new Date() },
      });
    } catch (processErr) {
      await prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: { error: processErr.message },
      }).catch(() => {});
      throw processErr;
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error("Webhook error:", err);
    // Always 200 to stop Razorpay retrying malformed/auth-failed events.
    // Genuine processing failures return 500 so Razorpay will retry.
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

async function processWebhookEvent(eventType, payload, webhookRecordId) {
  const rpPayment = payload.payment?.entity;
  if (!rpPayment) return;

  const orderId = rpPayment.order_id;

  if (eventType === "payment.authorized") {
    // Some methods (net banking) send authorized before captured.
    await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findFirst({ where: { razorpayOrderId: orderId } });
      if (!existing || existing.status !== "CREATED") return;

      await tx.payment.update({
        where: { id: existing.id },
        data: { razorpayPaymentId: rpPayment.id, status: "AUTHORIZED" },
      });

      await logPaymentEvent(tx, {
        paymentId: existing.id,
        fromStatus: "CREATED",
        toStatus: "AUTHORIZED",
        source: "webhook",
        metadata: { razorpayPaymentId: rpPayment.id, webhookRecordId },
      });
    });

  } else if (eventType === "payment.captured") {
    const existing = await prisma.payment.findFirst({
      where: { razorpayOrderId: orderId },
      include: { user: true },
    });

    if (!existing || existing.status === "CAPTURED") return;

    await prisma.$transaction(async (tx) => {
      const result = await tx.payment.updateMany({
        where: {
          razorpayOrderId: orderId,
          status: { in: ["CREATED", "AUTHORIZED"] },
        },
        data: {
          razorpayPaymentId: rpPayment.id,
          status: "CAPTURED",
          paidAt: new Date(rpPayment.created_at * 1000),
        },
      });

      if (result.count === 0) return; // Client verify was faster

      await logPaymentEvent(tx, {
        paymentId: existing.id,
        fromStatus: existing.status,
        toStatus: "CAPTURED",
        source: "webhook",
        metadata: { razorpayPaymentId: rpPayment.id, webhookRecordId },
      });

      await tx.auditLog.create({
        data: {
          userId: existing.userId,
          action: "payment.captured",
          entityType: "payment",
          entityId: existing.id,
          metadata: { razorpayPaymentId: rpPayment.id, source: "webhook", totalAmount: existing.totalAmount },
        },
      });
    });

    // Email (if not already sent by /verify)
    const refreshed = await prisma.payment.findUnique({ where: { id: existing.id } });
    sendEmailAsync({ ...existing, ...refreshed }, existing.user);

  } else if (eventType === "payment.failed") {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findFirst({ where: { razorpayOrderId: orderId } });
      if (!existing) return;

      // NEVER downgrade a CAPTURED payment to FAILED (edge case: out-of-order events)
      if (existing.status === "CAPTURED") {
        console.warn(`Ignoring payment.failed for already-CAPTURED order ${orderId}`);
        return;
      }

      await tx.payment.update({
        where: { id: existing.id },
        data: {
          status: "FAILED",
          failureReason: rpPayment.error_description || "Payment failed",
        },
      });

      await logPaymentEvent(tx, {
        paymentId: existing.id,
        fromStatus: existing.status,
        toStatus: "FAILED",
        source: "webhook",
        metadata: {
          error: rpPayment.error_description,
          errorCode: rpPayment.error_code,
          razorpayPaymentId: rpPayment.id,
          webhookRecordId,
        },
      });
    });
  }
}

// ── Payment History (for logged-in resident) ────────────────────────────────
router.get("/history", authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 100);
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
      console.warn("PDF generation failed (pdfkit may not be installed):", pdfErr.message);
      res.json({
        receipt: { ...payment, society: config.society },
        note: "PDF generation requires pdfkit. Install with: npm install pdfkit",
      });
    }
  } catch (err) {
    console.error("PDF receipt error:", err);
    res.status(500).json({ error: "Failed to generate receipt" });
  }
});

module.exports = router;

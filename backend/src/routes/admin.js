const express = require("express");
const { authenticate, requireAdmin } = require("../middleware/auth");
const config = require("../utils/config");
const prisma = require("../utils/prisma");

const router = express.Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ── Dashboard Stats ─────────────────────────────────────────────────────────
router.get("/dashboard", async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      totalResidents,
      totalPayments,
      monthlyPayments,
      lastMonthPayments,
      recentPayments,
      paymentsByType,
      paymentsByMethod,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "RESIDENT", isActive: true } }),
      prisma.payment.aggregate({
        where: { status: "CAPTURED" },
        _sum: { totalAmount: true, surchargeAmount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { status: "CAPTURED", paidAt: { gte: startOfMonth } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { status: "CAPTURED", paidAt: { gte: startOfLastMonth, lt: startOfMonth } },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.payment.findMany({
        where: { status: "CAPTURED" },
        orderBy: { paidAt: "desc" },
        take: 10,
        include: { user: { select: { name: true, flatNumber: true, wing: true } } },
      }),
      prisma.payment.groupBy({
        by: ["paymentType"],
        where: { status: "CAPTURED" },
        _sum: { totalAmount: true },
        _count: true,
      }),
      prisma.payment.groupBy({
        by: ["paymentMethod"],
        where: { status: "CAPTURED" },
        _sum: { totalAmount: true, surchargeAmount: true },
        _count: true,
      }),
    ]);

    res.json({
      stats: {
        totalResidents,
        totalCollected: totalPayments._sum.totalAmount || 0,
        totalSurcharges: totalPayments._sum.surchargeAmount || 0,
        totalTransactions: totalPayments._count,
        monthlyCollected: monthlyPayments._sum.totalAmount || 0,
        monthlyTransactions: monthlyPayments._count,
        lastMonthCollected: lastMonthPayments._sum.totalAmount || 0,
      },
      recentPayments: recentPayments.map((p) => ({
        transactionId: p.transactionId,
        resident: `${p.user.wing ? p.user.wing + "-" : ""}${p.user.flatNumber} (${p.user.name})`,
        paymentType: p.paymentType,
        totalAmount: p.totalAmount,
        paymentMethod: p.paymentMethod,
        paidAt: p.paidAt,
      })),
      breakdowns: {
        byType: paymentsByType.map((g) => ({
          type: g.paymentType,
          total: g._sum.totalAmount,
          count: g._count,
        })),
        byMethod: paymentsByMethod.map((g) => ({
          method: g.paymentMethod,
          total: g._sum.totalAmount,
          surcharges: g._sum.surchargeAmount,
          count: g._count,
        })),
      },
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

// ── All Payments (with filters) ─────────────────────────────────────────────
router.get("/payments", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 50), 200);
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.paymentType) where.paymentType = req.query.paymentType;
    if (req.query.paymentMethod) where.paymentMethod = req.query.paymentMethod;
    if (req.query.from || req.query.to) {
      where.createdAt = {};
      if (req.query.from) {
        const d = new Date(req.query.from);
        if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid 'from' date" });
        where.createdAt.gte = d;
      }
      if (req.query.to) {
        const d = new Date(req.query.to);
        if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid 'to' date" });
        where.createdAt.lte = d;
      }
    }
    if (req.query.search) {
      where.OR = [
        { transactionId: { contains: req.query.search, mode: "insensitive" } },
        { user: { name: { contains: req.query.search, mode: "insensitive" } } },
        { user: { flatNumber: { contains: req.query.search, mode: "insensitive" } } },
      ];
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: { user: { select: { name: true, flatNumber: true, wing: true, email: true } } },
      }),
      prisma.payment.count({ where }),
    ]);

    res.json({
      payments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("Admin payments error:", err);
    res.status(500).json({ error: "Failed to fetch payments" });
  }
});

// ── Export Payments as CSV ──────────────────────────────────────────────────
router.get("/export/csv", async (req, res) => {
  try {
    const where = {};
    if (req.query.from || req.query.to) {
      where.paidAt = {};
      if (req.query.from) {
        const d = new Date(req.query.from);
        if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid 'from' date" });
        where.paidAt.gte = d;
      }
      if (req.query.to) {
        const d = new Date(req.query.to);
        if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid 'to' date" });
        where.paidAt.lte = d;
      }
    }
    if (req.query.status) where.status = req.query.status;

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { name: true, flatNumber: true, wing: true, email: true } } },
    });

    const headers = [
      "Transaction ID", "Date", "Flat No", "Wing", "Member Name", "Email",
      "Payment Type", "Method", "Base Amount", "Surcharge Rate",
      "Surcharge Amount", "GST on Surcharge", "Total Amount", "Status",
      "Razorpay Payment ID",
    ];

    const rows = payments.map((p) => [
      p.transactionId,
      p.paidAt ? p.paidAt.toISOString() : "",
      p.user.flatNumber,
      p.user.wing || "",
      p.user.name,
      p.user.email,
      p.paymentType,
      p.paymentMethod,
      p.baseAmount,
      (p.surchargeRate * 100).toFixed(1) + "%",
      p.surchargeAmount,
      p.gstOnSurcharge,
      p.totalAmount,
      p.status,
      p.razorpayPaymentId || "",
    ]);

    const escapeCell = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCell).join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=payments-${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

module.exports = router;

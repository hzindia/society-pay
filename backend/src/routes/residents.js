const express = require("express");
const bcrypt = require("bcrypt");
const { body, validationResult } = require("express-validator");
const config = require("../utils/config");
const { authenticate, requireAdmin } = require("../middleware/auth");
const prisma = require("../utils/prisma");

const router = express.Router();

// ── List Residents (admin) ──────────────────────────────────────────────────
router.get("/", authenticate, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 50), 200);
    const skip = (page - 1) * limit;

    const where = { role: "RESIDENT" };
    if (req.query.search) {
      where.OR = [
        { name: { contains: req.query.search, mode: "insensitive" } },
        { flatNumber: { contains: req.query.search, mode: "insensitive" } },
        { email: { contains: req.query.search, mode: "insensitive" } },
      ];
    }
    if (req.query.active === "true") where.isActive = true;
    if (req.query.active === "false") where.isActive = false;

    const [residents, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { flatNumber: "asc" },
        skip,
        take: limit,
        select: {
          id: true, email: true, name: true, flatNumber: true,
          wing: true, phone: true, role: true, isActive: true, createdAt: true,
          _count: { select: { payments: { where: { status: "CAPTURED" } } } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      residents,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("List residents error:", err);
    res.status(500).json({ error: "Failed to fetch residents" });
  }
});

// ── Add Resident (admin) ────────────────────────────────────────────────────
router.post(
  "/",
  authenticate,
  requireAdmin,
  [
    body("email").isEmail().normalizeEmail(),
    body("name").trim().notEmpty(),
    body("flatNumber").trim().notEmpty(),
    body("phone").optional().trim(),
    body("wing").optional().trim(),
    body("password").isLength({ min: 8 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { email, name, flatNumber, phone, wing, password } = req.body;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return res.status(409).json({ error: "Email already exists" });

      const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);

      const user = await prisma.user.create({
        data: { email, passwordHash, name, flatNumber, phone, wing },
        select: { id: true, email: true, name: true, flatNumber: true, wing: true, role: true },
      });

      res.status(201).json({ resident: user });
    } catch (err) {
      console.error("Add resident error:", err);
      res.status(500).json({ error: "Failed to add resident" });
    }
  }
);

// ── Update Resident (admin) ─────────────────────────────────────────────────
router.put("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, flatNumber, wing, phone, isActive, role } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (flatNumber !== undefined) updateData.flatNumber = flatNumber;
    if (wing !== undefined) updateData.wing = wing;
    if (phone !== undefined) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (role !== undefined && ["RESIDENT", "ADMIN", "TREASURER"].includes(role)) {
      updateData.role = role;
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: { id: true, email: true, name: true, flatNumber: true, wing: true, role: true, isActive: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "resident.updated",
        entityType: "user",
        entityId: user.id,
        metadata: { changes: updateData },
        ipAddress: req.ip,
      },
    });

    res.json({ resident: user });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Resident not found" });
    }
    console.error("Update resident error:", err);
    res.status(500).json({ error: "Failed to update resident" });
  }
});

// ── Deactivate Resident ─────────────────────────────────────────────────────
router.delete("/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "resident.deactivated",
        entityType: "user",
        entityId: req.params.id,
        ipAddress: req.ip,
      },
    });

    res.json({ message: "Resident deactivated" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Resident not found" });
    }
    console.error("Deactivate error:", err);
    res.status(500).json({ error: "Failed to deactivate resident" });
  }
});

module.exports = router;

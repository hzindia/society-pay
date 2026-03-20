const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const config = require("../utils/config");
const { authenticate } = require("../middleware/auth");
const prisma = require("../utils/prisma");

const router = express.Router();

// ── Register ────────────────────────────────────────────────────────────────
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("name").trim().notEmpty(),
    body("flatNumber").trim().notEmpty(),
    body("phone").optional().trim(),
    body("wing").optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { email, password, name, flatNumber, phone, wing } = req.body;

      // Check duplicate
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: "Email already registered" });
      }

      const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);

      const user = await prisma.user.create({
        data: { email, passwordHash, name, flatNumber, phone, wing },
        select: { id: true, email: true, name: true, flatNumber: true, wing: true, role: true },
      });

      // Log
      await prisma.auditLog.create({
        data: { userId: user.id, action: "user.registered", entityType: "user", entityId: user.id },
      });

      const token = jwt.sign({ userId: user.id }, config.auth.jwtSecret, {
        expiresIn: config.auth.jwtExpiry,
      });

      res.status(201).json({ user, token });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ error: "Registration failed" });
    }
  }
);

// ── Login ───────────────────────────────────────────────────────────────────
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: "Invalid email or password" });
      }

      const { email, password } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.isActive) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "user.login",
          ipAddress: req.ip,
        },
      });

      const token = jwt.sign({ userId: user.id }, config.auth.jwtSecret, {
        expiresIn: config.auth.jwtExpiry,
      });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          flatNumber: user.flatNumber,
          wing: user.wing,
          role: user.role,
        },
        token,
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Login failed" });
    }
  }
);

// ── Get Profile ─────────────────────────────────────────────────────────────
router.get("/me", authenticate, async (req, res) => {
  res.json({ user: req.user });
});

// ── Change Password ─────────────────────────────────────────────────────────
router.put(
  "/password",
  authenticate,
  [
    body("currentPassword").notEmpty(),
    body("newPassword").isLength({ min: 8 }),
  ],
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      const passwordHash = await bcrypt.hash(newPassword, config.auth.bcryptRounds);
      await prisma.user.update({
        where: { id: req.user.id },
        data: { passwordHash },
      });

      res.json({ message: "Password updated successfully" });
    } catch (err) {
      console.error("Password change error:", err);
      res.status(500).json({ error: "Failed to change password" });
    }
  }
);

module.exports = router;

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const config = require("./utils/config");

const authRoutes = require("./routes/auth");
const paymentRoutes = require("./routes/payments");
const residentRoutes = require("./routes/residents");
const adminRoutes = require("./routes/admin");
const configRoutes = require("./routes/config");

const app = express();

// ── Security ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

// ── Razorpay webhook needs raw body for signature verification ──────────────
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

// ── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ─────────────────────────────────────────────────────────────────
if (config.env !== "test") {
  app.use(morgan(config.env === "production" ? "combined" : "dev"));
}

// ── Rate Limiting ───────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  message: { error: "Too many login attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", generalLimiter);
app.use("/api/auth/login", authLimiter);

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/residents", residentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/config", configRoutes);

// ── Health check ────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", society: config.society.shortName, timestamp: new Date().toISOString() });
});

// ── Error handler ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  const status = err.statusCode || 500;
  res.status(status).json({
    error: config.env === "production" ? "Internal server error" : err.message,
  });
});

// ── Start ───────────────────────────────────────────────────────────────────
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`\n🏘️  SocietyPay Backend`);
  console.log(`   Society:  ${config.society.name}`);
  console.log(`   Port:     ${PORT}`);
  console.log(`   Env:      ${config.env}`);
  console.log(`   Ready!\n`);
});

module.exports = app;

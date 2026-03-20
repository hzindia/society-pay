const dotenv = require("dotenv");
const path = require("path");

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

function requiredEnv(key) {
  const val = process.env[key];
  if (!val || val.includes("CHANGE_ME") || val.includes("xxxx")) {
    console.error(`❌ Missing or unconfigured env variable: ${key}`);
    console.error(`   Please update your .env file.`);
    process.exit(1);
  }
  return val;
}

function optionalEnv(key, defaultVal = "") {
  return process.env[key] || defaultVal;
}

function numEnv(key, defaultVal = 0) {
  const val = process.env[key];
  if (val === undefined) return defaultVal;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? defaultVal : parsed;
}

function boolEnv(key, defaultVal = false) {
  const val = process.env[key];
  if (!val) return defaultVal;
  return val === "true" || val === "1";
}

const config = {
  // Society
  society: {
    name: optionalEnv("SOCIETY_NAME", "My Housing Society"),
    shortName: optionalEnv("SOCIETY_SHORT_NAME", "My Society"),
    address: optionalEnv("SOCIETY_ADDRESS", ""),
    email: optionalEnv("SOCIETY_EMAIL", ""),
    phone: optionalEnv("SOCIETY_PHONE", ""),
    regNo: optionalEnv("SOCIETY_REG_NO", ""),
    logoUrl: optionalEnv("SOCIETY_LOGO_URL", ""),
  },

  // Database
  databaseUrl: requiredEnv("DATABASE_URL"),

  // Auth
  auth: {
    jwtSecret: requiredEnv("JWT_SECRET"),
    jwtExpiry: optionalEnv("JWT_EXPIRY", "7d"),
    bcryptRounds: numEnv("BCRYPT_ROUNDS", 12),
  },

  // Razorpay
  razorpay: {
    keyId: requiredEnv("RAZORPAY_KEY_ID"),
    keySecret: requiredEnv("RAZORPAY_KEY_SECRET"),
    webhookSecret: requiredEnv("RAZORPAY_WEBHOOK_SECRET"),
  },

  // Payments
  payment: {
    currency: optionalEnv("CURRENCY", "INR"),
    surcharges: {
      credit_card: numEnv("SURCHARGE_CREDIT_CARD", 2.0),
      debit_card: numEnv("SURCHARGE_DEBIT_CARD", 0),
      upi: numEnv("SURCHARGE_UPI", 0),
      net_banking: numEnv("SURCHARGE_NET_BANKING", 0.5),
      wallet: numEnv("SURCHARGE_WALLET", 1.0),
    },
    types: optionalEnv("PAYMENT_TYPES", "Monthly Maintenance,Parking,Water,Sinking Fund,Penalty,Other")
      .split(",")
      .map((t) => t.trim()),
  },

  // Email
  email: {
    host: optionalEnv("SMTP_HOST", "smtp.gmail.com"),
    port: numEnv("SMTP_PORT", 587),
    secure: boolEnv("SMTP_SECURE", false),
    user: optionalEnv("SMTP_USER", ""),
    pass: optionalEnv("SMTP_PASS", ""),
    fromName: optionalEnv("EMAIL_FROM_NAME", "Society Admin"),
    fromAddress: optionalEnv("EMAIL_FROM_ADDRESS", ""),
  },

  // Server
  env: optionalEnv("NODE_ENV", "development"),
  port: numEnv("PORT", 4000),
  frontendUrl: optionalEnv("FRONTEND_URL", "http://localhost:3000"),
  backendUrl: optionalEnv("BACKEND_URL", "http://localhost:4000"),

  // Rate limiting
  rateLimit: {
    windowMs: numEnv("RATE_LIMIT_WINDOW_MS", 900000),
    max: numEnv("RATE_LIMIT_MAX_REQUESTS", 100),
    authMax: numEnv("AUTH_RATE_LIMIT_MAX", 10),
  },

  // GST
  gst: {
    enabled: boolEnv("GST_ENABLED", false),
    rate: numEnv("GST_RATE", 18),
    gstin: optionalEnv("SOCIETY_GSTIN", ""),
  },
};

module.exports = config;

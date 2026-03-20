const jwt = require("jsonwebtoken");
const config = require("../utils/config");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// Verify JWT and attach user to request
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, config.auth.jwtSecret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        flatNumber: true,
        wing: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Account not found or deactivated" });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired, please login again" });
    }
    return res.status(401).json({ error: "Invalid token" });
  }
}

// Require admin or treasurer role
function requireAdmin(req, res, next) {
  if (!req.user || (req.user.role !== "ADMIN" && req.user.role !== "TREASURER")) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// Require specific role
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

module.exports = { authenticate, requireAdmin, requireRole };

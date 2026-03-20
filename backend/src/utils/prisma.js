const { PrismaClient } = require("@prisma/client");

// Shared singleton to avoid connection pool exhaustion from multiple instances
const prisma = new PrismaClient();

module.exports = prisma;

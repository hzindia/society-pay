/**
 * Create the first admin user for SocietyPay.
 * 
 * Usage:
 *   node scripts/create-admin.js
 * 
 * Or via Docker:
 *   docker compose exec backend node scripts/create-admin.js
 */

const readline = require("readline");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const config = require("../src/utils/config");

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log("\n🏘️  SocietyPay — Create Admin Account\n");

  const name = await ask("Admin Name: ");
  const email = await ask("Email: ");
  const flatNumber = await ask("Flat Number: ");
  const wing = await ask("Wing (optional, press Enter to skip): ");
  const password = await ask("Password (min 8 chars): ");

  if (!name || !email || !flatNumber || password.length < 8) {
    console.error("\n❌ All fields are required and password must be at least 8 characters.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error("\n❌ A user with this email already exists.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);

  const admin = await prisma.user.create({
    data: {
      name,
      email,
      flatNumber,
      wing: wing || null,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`\n✅ Admin account created!`);
  console.log(`   Name:  ${admin.name}`);
  console.log(`   Email: ${admin.email}`);
  console.log(`   Role:  ADMIN`);
  console.log(`\n   You can now login at ${config.frontendUrl}\n`);

  rl.close();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

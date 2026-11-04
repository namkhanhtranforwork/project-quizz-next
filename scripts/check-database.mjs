import "dotenv/config";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL. Configure .env using docs/database/supabase-setup.md.");
  process.exit(1);
}

const prisma = new PrismaClient({ log: [] });
try {
  await prisma.$queryRaw`SELECT 1 AS connected`;
  console.log("Prisma database connection: OK");
} catch {
  // Do not print connection strings, credentials or database error details.
  console.error("Database connection failed. Check DATABASE_URL, password, SSL and network access.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

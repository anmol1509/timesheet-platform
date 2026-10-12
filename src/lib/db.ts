import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// node-postgres's own sslmode=require parsing from the connection string is
// unreliable (long-standing pg issue) and can throw a cold-connect error
// against Supabase's pooler instead of just encrypting without verifying the
// chain, which is what sslmode=require is supposed to mean. Configuring ssl
// explicitly here is the documented workaround for Supabase + node-postgres
// from a serverless runtime (Vercel functions don't carry Supabase's CA in
// their default trust store).
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase.com")
    ? { rejectUnauthorized: false }
    : undefined,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

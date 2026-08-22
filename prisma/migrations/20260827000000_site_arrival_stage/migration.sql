-- Adds the site-arrival stage between mobilisation and active.
--
-- Mobilising a worker was previously assumed to put them on site; nothing
-- recorded whether they actually got there. The new value is only added here —
-- Postgres will not let a value be added and used in the same transaction, and
-- Prisma runs each migration as one.

-- AlterEnum
ALTER TYPE "EmployeeStatus" ADD VALUE 'ON_SITE' AFTER 'UNDER_MOBILISATION';

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "siteArrivalDate" TIMESTAMP(3);

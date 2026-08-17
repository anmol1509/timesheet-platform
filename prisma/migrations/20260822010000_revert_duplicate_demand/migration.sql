-- Reverts 20260822000000_demand_module.
--
-- Those tables duplicated the DemandRequest / DemandRequestTrade /
-- DemandRequestAllocation models that already model this workflow. They were
-- created empty and never written to, so dropping them loses nothing; the
-- demand work extends the existing models instead.
DROP TABLE IF EXISTS "DemandAssignment";
DROP TABLE IF EXISTS "DemandLine";
DROP TABLE IF EXISTS "Demand";
DROP TYPE IF EXISTS "DemandStatus";
DROP TYPE IF EXISTS "ShiftType";

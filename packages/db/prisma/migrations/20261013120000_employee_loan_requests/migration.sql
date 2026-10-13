-- Allow employee loan applications to remain pending until HR approval.
BEGIN;
ALTER TABLE "EmployeeLoan" ALTER COLUMN "approvedBy" DROP NOT NULL;
COMMIT;

-- =============================================================================
-- Migration: 20261012170000_enterprise_hr_payroll
-- Description: Production-grade Enterprise HR & Payroll Module Migration
-- Wrapped in an atomic transaction
-- =============================================================================

BEGIN;

-- 1. Extend PayrollPeriod
ALTER TABLE "PayrollPeriod"
  ADD COLUMN IF NOT EXISTS "snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "exceptions" JSONB,
  ADD COLUMN IF NOT EXISTS "approvalTrail" JSONB,
  ADD COLUMN IF NOT EXISTS "paymentBatchRef" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT DEFAULT 'UNPAID',
  ADD COLUMN IF NOT EXISTS "reversalOfId" TEXT,
  ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;

-- 2. EmployeeProfile
CREATE TABLE IF NOT EXISTS "EmployeeProfile" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "staffId" UUID UNIQUE NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "nin" TEXT,
  "tin" TEXT,
  "bvn" TEXT,
  "dateOfBirth" DATE,
  "gender" TEXT,
  "maritalStatus" TEXT,
  "nationality" TEXT DEFAULT 'Nigerian',
  "stateOfOrigin" TEXT,
  "lgaOfOrigin" TEXT,
  "residentialAddress" TEXT,
  "employmentType" TEXT NOT NULL DEFAULT 'PERMANENT',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "confirmationDate" DATE,
  "contractStartDate" DATE,
  "contractEndDate" DATE,
  "probationEndDate" DATE,
  "emergencyContacts" JSONB,
  "nextOfKin" JSONB,
  "qualifications" JSONB,
  "certifications" JSONB,
  "reportingManagerId" UUID,
  "positionId" UUID,
  "sectionId" UUID,
  "exitDate" DATE,
  "exitReason" TEXT,
  "exitInterviewNotes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_employeeprofile_type_status" ON "EmployeeProfile"("employmentType", "status");

-- 3. DepartmentSection
CREATE TABLE IF NOT EXISTS "DepartmentSection" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "departmentId" UUID NOT NULL REFERENCES "Department"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "uq_dept_section_name" UNIQUE ("departmentId", "name")
);

-- 4. JobPosition
CREATE TABLE IF NOT EXISTS "JobPosition" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "departmentId" UUID NOT NULL REFERENCES "Department"("id") ON DELETE RESTRICT,
  "sectionId" UUID REFERENCES "DepartmentSection"("id") ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "grade" TEXT,
  "headcountBudget" INTEGER NOT NULL DEFAULT 1,
  "minSalary" NUMERIC(18, 4),
  "maxSalary" NUMERIC(18, 4),
  "description" TEXT,
  "requirements" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "uq_position_property_code" UNIQUE ("propertyId", "code")
);

CREATE INDEX IF NOT EXISTS "idx_jobposition_property_dept" ON "JobPosition"("propertyId", "departmentId");

-- 5. EmployeeMovement
CREATE TABLE IF NOT EXISTS "EmployeeMovement" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "effectiveDate" DATE NOT NULL,
  "type" TEXT NOT NULL,
  "reason" TEXT,
  "fromDetails" JSONB NOT NULL,
  "toDetails" JSONB NOT NULL,
  "approvedBy" UUID NOT NULL,
  "approvedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_employeemovement_staff_date" ON "EmployeeMovement"("staffId", "effectiveDate");

-- 6. WorkShift
CREATE TABLE IF NOT EXISTS "WorkShift" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "departmentId" UUID,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "isOvernight" BOOLEAN NOT NULL DEFAULT false,
  "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 15,
  "breakDurationMinutes" INTEGER NOT NULL DEFAULT 60,
  "colorCode" TEXT NOT NULL DEFAULT '#3b82f6',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "uq_workshift_property_code" UNIQUE ("propertyId", "code")
);

CREATE INDEX IF NOT EXISTS "idx_workshift_property" ON "WorkShift"("propertyId");

-- 7. ShiftRoster
CREATE TABLE IF NOT EXISTS "ShiftRoster" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "departmentId" UUID,
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "shiftId" UUID NOT NULL REFERENCES "WorkShift"("id") ON DELETE RESTRICT,
  "date" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "uq_shiftroster_staff_date" UNIQUE ("staffId", "date")
);

CREATE INDEX IF NOT EXISTS "idx_shiftroster_prop_date" ON "ShiftRoster"("propertyId", "date");
CREATE INDEX IF NOT EXISTS "idx_shiftroster_dept_date" ON "ShiftRoster"("departmentId", "date");

-- 8. ShiftSwapRequest
CREATE TABLE IF NOT EXISTS "ShiftSwapRequest" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "requesterStaffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE RESTRICT,
  "targetStaffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE RESTRICT,
  "requesterDate" DATE NOT NULL,
  "targetDate" DATE NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_PEER',
  "peerApprovedAt" TIMESTAMPTZ,
  "supervisorApprovedAt" TIMESTAMPTZ,
  "supervisorUserId" UUID,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_shiftswap_property_status" ON "ShiftSwapRequest"("propertyId", "status");

-- 9. AttendanceRecord
CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "date" DATE NOT NULL,
  "clockIn" TIMESTAMPTZ,
  "clockOut" TIMESTAMPTZ,
  "lateMinutes" INTEGER NOT NULL DEFAULT 0,
  "earlyDepartureMinutes" INTEGER NOT NULL DEFAULT 0,
  "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
  "nightHours" NUMERIC(5, 2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PRESENT',
  "punchSource" TEXT NOT NULL DEFAULT 'WEB',
  "supervisorVerified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedByUserId" UUID,
  "verifiedAt" TIMESTAMPTZ,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "uq_attendance_staff_date" UNIQUE ("staffId", "date")
);

CREATE INDEX IF NOT EXISTS "idx_attendance_prop_date" ON "AttendanceRecord"("propertyId", "date");
CREATE INDEX IF NOT EXISTS "idx_attendance_prop_status" ON "AttendanceRecord"("propertyId", "status");

-- 10. MissedPunchRequest
CREATE TABLE IF NOT EXISTS "MissedPunchRequest" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "date" DATE NOT NULL,
  "requestedIn" TIMESTAMPTZ,
  "requestedOut" TIMESTAMPTZ,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedByUserId" UUID,
  "reviewedAt" TIMESTAMPTZ,
  "reviewerNotes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_missedpunch_prop_status" ON "MissedPunchRequest"("propertyId", "status");

-- 11. LeaveType
CREATE TABLE IF NOT EXISTS "LeaveType" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "defaultDays" INTEGER NOT NULL DEFAULT 20,
  "isPaid" BOOLEAN NOT NULL DEFAULT true,
  "requiresProof" BOOLEAN NOT NULL DEFAULT false,
  "carryOverMaxDays" INTEGER NOT NULL DEFAULT 5,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "uq_leavetype_property_code" UNIQUE ("propertyId", "code")
);

-- 12. LeaveAllocation
CREATE TABLE IF NOT EXISTS "LeaveAllocation" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "leaveTypeId" UUID NOT NULL REFERENCES "LeaveType"("id") ON DELETE RESTRICT,
  "year" INTEGER NOT NULL,
  "entitledDays" INTEGER NOT NULL,
  "carriedOverDays" INTEGER NOT NULL DEFAULT 0,
  "usedDays" INTEGER NOT NULL DEFAULT 0,
  "pendingDays" INTEGER NOT NULL DEFAULT 0,
  "balanceDays" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "uq_leavealloc_staff_type_year" UNIQUE ("staffId", "leaveTypeId", "year")
);

CREATE INDEX IF NOT EXISTS "idx_leavealloc_prop_year" ON "LeaveAllocation"("propertyId", "year");

-- 13. LeaveApplication
CREATE TABLE IF NOT EXISTS "LeaveApplication" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "leaveTypeId" UUID NOT NULL REFERENCES "LeaveType"("id") ON DELETE RESTRICT,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "totalDays" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "attachmentUrl" TEXT,
  "handoverStaffId" UUID,
  "status" TEXT NOT NULL DEFAULT 'PENDING_HOD',
  "hodApprovedAt" TIMESTAMPTZ,
  "hodUserId" UUID,
  "hrApprovedAt" TIMESTAMPTZ,
  "hrUserId" UUID,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_leaveapp_prop_status" ON "LeaveApplication"("propertyId", "status");
CREATE INDEX IF NOT EXISTS "idx_leaveapp_staff_start" ON "LeaveApplication"("staffId", "startDate");

-- 14. JobRequisition
CREATE TABLE IF NOT EXISTS "JobRequisition" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "departmentId" UUID NOT NULL,
  "positionId" UUID NOT NULL REFERENCES "JobPosition"("id") ON DELETE RESTRICT,
  "openings" INTEGER NOT NULL DEFAULT 1,
  "employmentType" TEXT NOT NULL DEFAULT 'PERMANENT',
  "justification" TEXT NOT NULL,
  "salaryMin" NUMERIC(18, 4),
  "salaryMax" NUMERIC(18, 4),
  "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  "approvedBy" UUID,
  "approvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_jobreq_prop_status" ON "JobRequisition"("propertyId", "status");

-- 15. JobVacancy
CREATE TABLE IF NOT EXISTS "JobVacancy" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "requisitionId" UUID NOT NULL REFERENCES "JobRequisition"("id") ON DELETE RESTRICT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "requirements" TEXT NOT NULL,
  "closingDate" DATE,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_jobvacancy_status" ON "JobVacancy"("status");

-- 16. JobApplicant
CREATE TABLE IF NOT EXISTS "JobApplicant" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "vacancyId" UUID NOT NULL REFERENCES "JobVacancy"("id") ON DELETE CASCADE,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "resumeUrl" TEXT,
  "coverLetter" TEXT,
  "stage" TEXT NOT NULL DEFAULT 'APPLIED',
  "rating" INTEGER DEFAULT 0,
  "interviewDate" TIMESTAMPTZ,
  "interviewNotes" TEXT,
  "offerDetails" JSONB,
  "convertedStaffId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_jobapplicant_vac_stage" ON "JobApplicant"("vacancyId", "stage");

-- 17. OnboardingTask
CREATE TABLE IF NOT EXISTS "OnboardingTask" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueDate" DATE,
  "isCompleted" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMPTZ,
  "verifiedBy" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_onboarding_staff_completed" ON "OnboardingTask"("staffId", "isCompleted");

-- 18. StatutoryConfiguration
CREATE TABLE IF NOT EXISTS "StatutoryConfiguration" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "versionTag" TEXT NOT NULL DEFAULT 'PITA_2020_CURRENT',
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "craPercentGross" NUMERIC(5, 4) NOT NULL DEFAULT 0.20,
  "craBaseAmount" NUMERIC(18, 4) NOT NULL DEFAULT 200000,
  "craHigherPercent" NUMERIC(5, 4) NOT NULL DEFAULT 0.01,
  "taxBands" JSONB NOT NULL,
  "pensionEmployeeRate" NUMERIC(5, 4) NOT NULL DEFAULT 0.08,
  "pensionEmployerRate" NUMERIC(5, 4) NOT NULL DEFAULT 0.10,
  "nhfRate" NUMERIC(5, 4) NOT NULL DEFAULT 0.025,
  "nsitfRate" NUMERIC(5, 4) NOT NULL DEFAULT 0.01,
  "itfRate" NUMERIC(5, 4) NOT NULL DEFAULT 0.01,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "uq_statutory_org_version" UNIQUE ("organizationId", "versionTag")
);

-- 19. EmployeeLoan
CREATE TABLE IF NOT EXISTS "EmployeeLoan" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "loanNumber" TEXT UNIQUE NOT NULL,
  "principalAmount" NUMERIC(18, 4) NOT NULL,
  "interestRate" NUMERIC(5, 2) NOT NULL DEFAULT 0,
  "termMonths" INTEGER NOT NULL DEFAULT 12,
  "monthlyDeduction" NUMERIC(18, 4) NOT NULL,
  "remainingBalance" NUMERIC(18, 4) NOT NULL,
  "disbursementDate" DATE NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "approvedBy" UUID NOT NULL,
  "approvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_employeeloan_prop_status" ON "EmployeeLoan"("propertyId", "status");
CREATE INDEX IF NOT EXISTS "idx_employeeloan_staff" ON "EmployeeLoan"("staffId");

-- 20. SalaryAdvance
CREATE TABLE IF NOT EXISTS "SalaryAdvance" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "amount" NUMERIC(18, 4) NOT NULL,
  "reason" TEXT NOT NULL,
  "targetPayrollPeriodId" UUID,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approvedBy" UUID,
  "approvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_salaryadvance_prop_status" ON "SalaryAdvance"("propertyId", "status");

-- 21. ExpenseClaim
CREATE TABLE IF NOT EXISTS "ExpenseClaim" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "claimNumber" TEXT UNIQUE NOT NULL,
  "category" TEXT NOT NULL,
  "amount" NUMERIC(18, 4) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "receiptUrl" TEXT,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "approvedBy" UUID,
  "approvedAt" TIMESTAMPTZ,
  "reimbursedInPeriodId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_expenseclaim_prop_status" ON "ExpenseClaim"("propertyId", "status");

-- 22. PerformanceAppraisal
CREATE TABLE IF NOT EXISTS "PerformanceAppraisal" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "reviewerId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE RESTRICT,
  "cycleName" TEXT NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "kpis" JSONB NOT NULL,
  "selfScore" NUMERIC(3, 1),
  "managerScore" NUMERIC(3, 1),
  "finalRating" TEXT,
  "developmentPlan" TEXT,
  "promotionReady" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_appraisal_prop_cycle" ON "PerformanceAppraisal"("propertyId", "cycleName");
CREATE INDEX IF NOT EXISTS "idx_appraisal_staff" ON "PerformanceAppraisal"("staffId");

-- 23. TrainingRecord
CREATE TABLE IF NOT EXISTS "TrainingRecord" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "courseTitle" TEXT NOT NULL,
  "provider" TEXT,
  "completedAt" DATE NOT NULL,
  "expiresAt" DATE,
  "certificateUrl" TEXT,
  "score" NUMERIC(5, 2),
  "isMandatory" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_training_prop_course" ON "TrainingRecord"("propertyId", "courseTitle");
CREATE INDEX IF NOT EXISTS "idx_training_staff" ON "TrainingRecord"("staffId");

-- 24. DisciplinaryRecord
CREATE TABLE IF NOT EXISTS "DisciplinaryRecord" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "incidentDate" DATE NOT NULL,
  "type" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "actionTaken" TEXT NOT NULL,
  "isConfidential" BOOLEAN NOT NULL DEFAULT true,
  "issuedByUserId" UUID NOT NULL,
  "documentUrl" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_disciplinary_prop_type" ON "DisciplinaryRecord"("propertyId", "type");
CREATE INDEX IF NOT EXISTS "idx_disciplinary_staff" ON "DisciplinaryRecord"("staffId");

-- 25. EmployeeDocument
CREATE TABLE IF NOT EXISTS "EmployeeDocument" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "expiresAt" DATE,
  "isConfidential" BOOLEAN NOT NULL DEFAULT false,
  "uploadedBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_empdoc_staff_cat" ON "EmployeeDocument"("staffId", "category");

-- 26. CompanyPolicy
CREATE TABLE IF NOT EXISTS "CompanyPolicy" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT '1.0',
  "category" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "effectiveDate" DATE NOT NULL,
  "requiresAcknowledgement" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_policy_org_active" ON "CompanyPolicy"("organizationId", "isActive");

-- 27. HrServiceDeskTicket
CREATE TABLE IF NOT EXISTS "HrServiceDeskTicket" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "propertyId" UUID NOT NULL REFERENCES "Property"("id") ON DELETE RESTRICT,
  "staffId" UUID NOT NULL REFERENCES "Staff"("id") ON DELETE CASCADE,
  "ticketNumber" TEXT UNIQUE NOT NULL,
  "category" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "assignedToUser" UUID,
  "resolutionNotes" TEXT,
  "resolvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_servicedesk_prop_status" ON "HrServiceDeskTicket"("propertyId", "status");
CREATE INDEX IF NOT EXISTS "idx_servicedesk_staff" ON "HrServiceDeskTicket"("staffId");

COMMIT;

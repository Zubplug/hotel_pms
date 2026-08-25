CREATE TYPE "RefundRequestStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED', 'CANCELLED', 'EXPIRED');

ALTER TABLE "Refund" ADD COLUMN "refundRequestId" UUID;
CREATE UNIQUE INDEX "Refund_refundRequestId_key" ON "Refund"("refundRequestId");

CREATE TABLE "RefundRequest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "reservationId" UUID,
    "folioId" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "guestId" UUID,
    "requestedAmount" DECIMAL(18,4) NOT NULL,
    "approvedAmount" DECIMAL(18,4),
    "currency" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "supportingNotes" TEXT,
    "status" "RefundRequestStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "requestedById" UUID NOT NULL,
    "currentApproverId" UUID,
    "approvalRoleId" UUID,
    "idempotencyKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RefundRequest_idempotencyKey_key" ON "RefundRequest"("idempotencyKey");
CREATE INDEX "RefundRequest_propertyId_status_idx" ON "RefundRequest"("propertyId", "status");
CREATE INDEX "RefundRequest_paymentId_status_idx" ON "RefundRequest"("paymentId", "status");
CREATE INDEX "RefundRequest_currentApproverId_status_idx" ON "RefundRequest"("currentApproverId", "status");

CREATE TABLE "RefundApproval" (
    "id" UUID NOT NULL,
    "refundRequestId" UUID NOT NULL,
    "approverId" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "comments" TEXT,
    "decidedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefundApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RefundApproval_refundRequestId_decidedAt_idx" ON "RefundApproval"("refundRequestId", "decidedAt");

ALTER TABLE "Refund" ADD CONSTRAINT "Refund_refundRequestId_fkey" FOREIGN KEY ("refundRequestId") REFERENCES "RefundRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_currentApproverId_fkey" FOREIGN KEY ("currentApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_approvalRoleId_fkey" FOREIGN KEY ("approvalRoleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefundApproval" ADD CONSTRAINT "RefundApproval_refundRequestId_fkey" FOREIGN KEY ("refundRequestId") REFERENCES "RefundRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefundApproval" ADD CONSTRAINT "RefundApproval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

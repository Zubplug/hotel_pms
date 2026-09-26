ALTER TABLE "EventInvoiceItem"
  ADD COLUMN "category" TEXT NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "requestedDiscount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "discountReason" TEXT,
  ADD COLUMN "discountApprovedBy" UUID,
  ADD COLUMN "discountApprovedAt" TIMESTAMPTZ,
  ADD COLUMN "discountStatus" TEXT NOT NULL DEFAULT 'PENDING';

-- Existing line discounts were already the approved invoice snapshot.
UPDATE "EventInvoiceItem"
SET "requestedDiscount" = "discountAmount",
    "discountStatus" = CASE WHEN "discountAmount" > 0 THEN 'APPROVED' ELSE 'PENDING' END;

CREATE INDEX "EventInvoiceItem_category_idx" ON "EventInvoiceItem"("category");
CREATE INDEX "EventInvoiceItem_discountStatus_idx" ON "EventInvoiceItem"("discountStatus");

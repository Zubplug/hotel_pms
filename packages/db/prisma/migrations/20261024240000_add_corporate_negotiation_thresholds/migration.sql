ALTER TABLE "CorporateContract"
  ADD COLUMN "negotiationEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "negotiationMinRooms" INTEGER,
  ADD COLUMN "negotiationMinNights" INTEGER;

ALTER TABLE "CorporateContract"
  ADD CONSTRAINT "CorporateContract_negotiationMinNights_ck"
  CHECK ("negotiationMinNights" IS NULL OR "negotiationMinNights" > 0);

ALTER TABLE "CorporateContract"
  ADD CONSTRAINT "CorporateContract_negotiationMinRooms_ck"
  CHECK ("negotiationMinRooms" IS NULL OR "negotiationMinRooms" > 0);

ALTER TABLE "CorporateRateNegotiationRequest"
  ADD COLUMN "quoteId" UUID,
  ADD COLUMN "approvedQuoteId" UUID;

CREATE INDEX "CorporateRateNegotiationRequest_quoteId_idx"
  ON "CorporateRateNegotiationRequest"("quoteId");

CREATE INDEX "CorporateRateNegotiationRequest_approvedQuoteId_idx"
  ON "CorporateRateNegotiationRequest"("approvedQuoteId");

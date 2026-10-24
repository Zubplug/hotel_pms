CREATE TABLE "CorporatePaymentGroup" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "corporateAccountId" UUID NOT NULL,
    "requiredAmount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CorporatePaymentGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CorporatePaymentGroupReservation" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "amountRequired" DECIMAL(18,4) NOT NULL,
    CONSTRAINT "CorporatePaymentGroupReservation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BookingPaymentTransaction" ADD COLUMN "corporatePaymentGroupId" UUID;

CREATE UNIQUE INDEX "CorporatePaymentGroupReservation_reservationId_key" ON "CorporatePaymentGroupReservation"("reservationId");
CREATE UNIQUE INDEX "CorporatePaymentGroupReservation_groupId_reservationId_key" ON "CorporatePaymentGroupReservation"("groupId", "reservationId");
CREATE INDEX "CorporatePaymentGroup_propertyId_status_createdAt_idx" ON "CorporatePaymentGroup"("propertyId", "status", "createdAt");
CREATE INDEX "CorporatePaymentGroup_corporateAccountId_status_idx" ON "CorporatePaymentGroup"("corporateAccountId", "status");
CREATE INDEX "BookingPaymentTransaction_corporatePaymentGroupId_status_idx" ON "BookingPaymentTransaction"("corporatePaymentGroupId", "status");

ALTER TABLE "CorporatePaymentGroup" ADD CONSTRAINT "CorporatePaymentGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorporatePaymentGroup" ADD CONSTRAINT "CorporatePaymentGroup_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON UPDATE CASCADE;
ALTER TABLE "CorporatePaymentGroup" ADD CONSTRAINT "CorporatePaymentGroup_corporateAccountId_fkey" FOREIGN KEY ("corporateAccountId") REFERENCES "CorporateAccount"("id") ON UPDATE CASCADE;
ALTER TABLE "CorporatePaymentGroupReservation" ADD CONSTRAINT "CorporatePaymentGroupReservation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CorporatePaymentGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorporatePaymentGroupReservation" ADD CONSTRAINT "CorporatePaymentGroupReservation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingPaymentTransaction" ADD CONSTRAINT "BookingPaymentTransaction_corporatePaymentGroupId_fkey" FOREIGN KEY ("corporatePaymentGroupId") REFERENCES "CorporatePaymentGroup"("id") ON UPDATE CASCADE;

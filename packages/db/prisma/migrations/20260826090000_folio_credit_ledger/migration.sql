CREATE TABLE "FolioCredit" (
    "id" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "reservationId" UUID,
    "propertyId" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "remainingAmount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "reference" TEXT,
    "notes" TEXT,
    "receivedBy" UUID NOT NULL,
    "deviceId" TEXT,
    "operationId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "FolioCredit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FolioCreditApplication" (
    "id" UUID NOT NULL,
    "creditId" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "appliedBy" UUID NOT NULL,
    "deviceId" TEXT,
    "businessDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FolioCreditApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FolioCredit_idempotencyKey_key" ON "FolioCredit"("idempotencyKey");
CREATE UNIQUE INDEX "FolioCreditApplication_idempotencyKey_key" ON "FolioCreditApplication"("idempotencyKey");

ALTER TABLE "FolioCredit" ADD CONSTRAINT "FolioCredit_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FolioCredit" ADD CONSTRAINT "FolioCredit_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FolioCredit" ADD CONSTRAINT "FolioCredit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FolioCreditApplication" ADD CONSTRAINT "FolioCreditApplication_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "FolioCredit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FolioCreditApplication" ADD CONSTRAINT "FolioCreditApplication_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

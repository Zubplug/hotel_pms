CREATE TABLE "PosSessionAlias" (
    "localSessionId" UUID NOT NULL,
    "canonicalSessionId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "terminalId" UUID,
    "operatorId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PosSessionAlias_pkey" PRIMARY KEY ("localSessionId")
);

CREATE INDEX "PosSessionAlias_canonicalSessionId_idx" ON "PosSessionAlias"("canonicalSessionId");
CREATE INDEX "PosSessionAlias_propertyId_operatorId_idx" ON "PosSessionAlias"("propertyId", "operatorId");

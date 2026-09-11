-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ,
    "processedAt" TIMESTAMPTZ,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelConnection" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "externalPropertyId" TEXT NOT NULL,
    "credentialsRef" TEXT NOT NULL,
    "lastSuccessfulSync" TIMESTAMPTZ,
    "lastInboundSync" TIMESTAMPTZ,
    "lastOutboundSync" TIMESTAMPTZ,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelRoomMapping" (
    "id" UUID NOT NULL,
    "channelConnectionId" UUID NOT NULL,
    "lodgecoreRoomTypeId" UUID NOT NULL,
    "externalRoomTypeId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'MAPPED',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ChannelRoomMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelRatePlanMapping" (
    "id" UUID NOT NULL,
    "channelConnectionId" UUID NOT NULL,
    "lodgecoreRatePlanId" UUID NOT NULL,
    "externalRatePlanId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'MAPPED',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ChannelRatePlanMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelReservation" (
    "id" UUID NOT NULL,
    "channelConnectionId" UUID NOT NULL,
    "externalReservationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "lodgecoreReservationId" UUID,
    "externalStatus" TEXT NOT NULL,
    "rawPayloadReference" TEXT,
    "importedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modifiedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelSyncEvent" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityId" TEXT,
    "payload" JSONB,
    "status" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChannelSyncEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OutboxEvent_propertyId_status_nextAttemptAt_idx" ON "OutboxEvent"("propertyId", "status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConnection_propertyId_provider_key" ON "ChannelConnection"("propertyId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelRoomMapping_channelConnectionId_lodgecoreRoomTypeId_key" ON "ChannelRoomMapping"("channelConnectionId", "lodgecoreRoomTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelRoomMapping_channelConnectionId_externalRoomTypeId_key" ON "ChannelRoomMapping"("channelConnectionId", "externalRoomTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelRatePlanMapping_channelConnectionId_lodgecoreRatePla_key" ON "ChannelRatePlanMapping"("channelConnectionId", "lodgecoreRatePlanId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelRatePlanMapping_channelConnectionId_externalRatePlan_key" ON "ChannelRatePlanMapping"("channelConnectionId", "externalRatePlanId");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelReservation_channelConnectionId_externalReservationI_key" ON "ChannelReservation"("channelConnectionId", "externalReservationId");

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelRoomMapping" ADD CONSTRAINT "ChannelRoomMapping_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "ChannelConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelRatePlanMapping" ADD CONSTRAINT "ChannelRatePlanMapping_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "ChannelConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelReservation" ADD CONSTRAINT "ChannelReservation_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "ChannelConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelSyncEvent" ADD CONSTRAINT "ChannelSyncEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelSyncEvent" ADD CONSTRAINT "ChannelSyncEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


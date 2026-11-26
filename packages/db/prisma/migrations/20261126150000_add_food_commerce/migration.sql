-- Food Commerce foundation.
-- This migration is intentionally safe to run manually against production.
-- It creates only the Commerce tables represented by schema.prisma; it does
-- not seed stores, menus, products, or any operational data.

CREATE TABLE IF NOT EXISTS "CommerceStore" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID,
    "targetOutletId" UUID,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "faviconUrl" TEXT,
    "theme" TEXT NOT NULL DEFAULT 'MODERN_RESTAURANT',
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "fontFamily" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "operatingHours" JSONB,
    "minimumOrderAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deliveryFeeMode" TEXT NOT NULL DEFAULT 'FLAT',
    "deliveryFee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "freeDeliveryAbove" DECIMAL(18,4),
    "allowOnlinePayment" BOOLEAN NOT NULL DEFAULT true,
    "allowPayOnDelivery" BOOLEAN NOT NULL DEFAULT true,
    "allowPayOnPickup" BOOLEAN NOT NULL DEFAULT true,
    "paystackPublicKey" TEXT,
    "paystackSecretKey" TEXT,
    "flutterwavePublicKey" TEXT,
    "flutterwaveSecretKey" TEXT,
    "preferredGateway" TEXT NOT NULL DEFAULT 'PAYSTACK',
    "notifySmsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyWhatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
    "termiiSenderName" TEXT,
    "notificationEvents" JSONB,
    "announcementBanner" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "networkOptedIn" BOOLEAN NOT NULL DEFAULT false,
    "networkOptedInAt" TIMESTAMPTZ,
    "networkTermsVersion" TEXT,
    "websiteProjectId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommerceStore_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceMenu" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "availableFrom" TEXT,
    "availableTo" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommerceMenu_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceCategory" (
    "id" UUID NOT NULL,
    "menuId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "availableFrom" TEXT,
    "availableTo" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommerceCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceProduct" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "posProductId" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "imageIsAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "price" DECIMAL(18,4) NOT NULL,
    "compareAtPrice" DECIMAL(18,4),
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isChefSpecial" BOOLEAN NOT NULL DEFAULT false,
    "availableQuantity" INTEGER,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "prepTimeMinutes" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommerceProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceModifierGroup" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommerceModifierGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceModifierOption" (
    "id" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "priceAdjustment" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommerceModifierOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceCustomer" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "deliveryAddress" JSONB,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "totalSpend" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "consentToPersonalisation" BOOLEAN NOT NULL DEFAULT false,
    "consentToWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "consentRecordedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommerceCustomer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceOrder" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "customerId" UUID,
    "orderRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "orderType" TEXT NOT NULL,
    "fulfillmentType" TEXT NOT NULL DEFAULT 'NOW',
    "scheduledFor" TIMESTAMPTZ,
    "deliveryAddress" JSONB,
    "deliveryNotes" TEXT,
    "subtotal" DECIMAL(18,4) NOT NULL,
    "deliveryFee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "paymentMethod" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "specialInstructions" TEXT,
    "trackingToken" TEXT NOT NULL,
    "groupOrderSessionId" UUID,
    "promotionId" UUID,
    "mealPassRedemptionId" UUID,
    "posSyncStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "posSyncAttempts" INTEGER NOT NULL DEFAULT 0,
    "posSyncLastAttemptAt" TIMESTAMPTZ,
    "posAcknowledgedAt" TIMESTAMPTZ,
    "posRejectionReason" TEXT,
    "reportedPosOrderId" TEXT,
    "customerNotifiedAt" TIMESTAMPTZ,
    "preparingNotifiedAt" TIMESTAMPTZ,
    "readyNotifiedAt" TIMESTAMPTZ,
    "dispatchedNotifiedAt" TIMESTAMPTZ,
    "deliveredNotifiedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommerceOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceOrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "productName" TEXT NOT NULL,
    "productImageUrl" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "totalPrice" DECIMAL(18,4) NOT NULL,
    "selectedModifiers" JSONB NOT NULL,
    "specialNote" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommerceOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommercePayment" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMPTZ,
    "refundedAt" TIMESTAMPTZ,
    "refundRef" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommercePayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceSyncEvent" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "targetOutletId" UUID NOT NULL,
    "targetPropertyId" UUID,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "payloadVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMPTZ,
    "deliveredAt" TIMESTAMPTZ,
    "acknowledgedAt" TIMESTAMPTZ,
    "rejectedAt" TIMESTAMPTZ,
    "failureReason" TEXT,
    "reportedPosOrderId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommerceSyncEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceDelivery" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "driverId" UUID,
    "status" TEXT NOT NULL DEFAULT 'PENDING_ASSIGNMENT',
    "estimatedDeliveryMinutes" INTEGER,
    "actualPickupAt" TIMESTAMPTZ,
    "actualDeliveryAt" TIMESTAMPTZ,
    "deliveryNotes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommerceDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceDriver" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "vehicleType" TEXT,
    "vehiclePlate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentStatus" TEXT NOT NULL DEFAULT 'OFFLINE',
    "currentLocationLat" DECIMAL(10,7),
    "currentLocationLng" DECIMAL(10,7),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommerceDriver_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceDeliveryZone" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "deliveryFee" DECIMAL(18,4) NOT NULL,
    "radiusKm" DECIMAL(8,2),
    "polygonCoords" JSONB,
    "estimatedMinutes" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommerceDeliveryZone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommercePromotion" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "minimumOrderAmount" DECIMAL(18,4),
    "maxUsesTotal" INTEGER,
    "maxUsesPerCustomer" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMPTZ NOT NULL,
    "validTo" TIMESTAMPTZ NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "applicableProductIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommercePromotion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceMealPass" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "totalMeals" INTEGER NOT NULL,
    "remainingMeals" INTEGER NOT NULL,
    "purchasePrice" DECIMAL(18,4) NOT NULL,
    "validFrom" TIMESTAMPTZ NOT NULL,
    "validTo" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommerceMealPass_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceMealPassRedemption" (
    "id" UUID NOT NULL,
    "mealPassId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "redeemedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommerceMealPassRedemption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceGroupOrderSession" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "hostCustomerId" TEXT,
    "shareToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "lockedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommerceGroupOrderSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceNotificationLog" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "providerRef" TEXT,
    "providerStatus" TEXT,
    "failureReason" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMPTZ,
    "deliveredAt" TIMESTAMPTZ,
    "fallbackChannel" TEXT,
    "fallbackLogId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommerceNotificationLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CommerceNetworkEnrollment" (
    "id" UUID NOT NULL,
    "storeId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "termsVersion" TEXT NOT NULL,
    "acceptedAt" TIMESTAMPTZ,
    "withdrawnAt" TIMESTAMPTZ,
    "withdrawnBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CommerceNetworkEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommerceStore_slug_key" ON "CommerceStore"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "CommerceOrder_orderRef_key" ON "CommerceOrder"("orderRef");
CREATE UNIQUE INDEX IF NOT EXISTS "CommerceOrder_trackingToken_key" ON "CommerceOrder"("trackingToken");
CREATE UNIQUE INDEX IF NOT EXISTS "CommercePayment_orderId_key" ON "CommercePayment"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "CommerceSyncEvent_orderId_key" ON "CommerceSyncEvent"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "CommerceSyncEvent_idempotencyKey_key" ON "CommerceSyncEvent"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CommerceDelivery_orderId_key" ON "CommerceDelivery"("orderId");
CREATE UNIQUE INDEX IF NOT EXISTS "CommercePromotion_code_key" ON "CommercePromotion"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "CommerceGroupOrderSession_shareToken_key" ON "CommerceGroupOrderSession"("shareToken");
CREATE UNIQUE INDEX IF NOT EXISTS "CommerceNetworkEnrollment_storeId_key" ON "CommerceNetworkEnrollment"("storeId");
CREATE UNIQUE INDEX IF NOT EXISTS "CommerceCustomer_storeId_phone_key" ON "CommerceCustomer"("storeId", "phone");

CREATE INDEX IF NOT EXISTS "CommerceStore_organizationId_status_idx" ON "CommerceStore"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "CommerceStore_propertyId_idx" ON "CommerceStore"("propertyId");
CREATE INDEX IF NOT EXISTS "CommerceStore_slug_idx" ON "CommerceStore"("slug");
CREATE INDEX IF NOT EXISTS "CommerceMenu_storeId_isActive_idx" ON "CommerceMenu"("storeId", "isActive");
CREATE INDEX IF NOT EXISTS "CommerceCategory_menuId_isActive_sortOrder_idx" ON "CommerceCategory"("menuId", "isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "CommerceProduct_storeId_isActive_sortOrder_idx" ON "CommerceProduct"("storeId", "isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "CommerceProduct_categoryId_idx" ON "CommerceProduct"("categoryId");
CREATE INDEX IF NOT EXISTS "CommerceProduct_storeId_isFeatured_idx" ON "CommerceProduct"("storeId", "isFeatured");
CREATE INDEX IF NOT EXISTS "CommerceModifierGroup_productId_idx" ON "CommerceModifierGroup"("productId");
CREATE INDEX IF NOT EXISTS "CommerceModifierOption_groupId_isActive_idx" ON "CommerceModifierOption"("groupId", "isActive");
CREATE INDEX IF NOT EXISTS "CommerceCustomer_storeId_phone_idx" ON "CommerceCustomer"("storeId", "phone");
CREATE INDEX IF NOT EXISTS "CommerceOrder_storeId_status_idx" ON "CommerceOrder"("storeId", "status");
CREATE INDEX IF NOT EXISTS "CommerceOrder_trackingToken_idx" ON "CommerceOrder"("trackingToken");
CREATE INDEX IF NOT EXISTS "CommerceOrder_orderRef_idx" ON "CommerceOrder"("orderRef");
CREATE INDEX IF NOT EXISTS "CommerceOrder_storeId_createdAt_idx" ON "CommerceOrder"("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "CommerceOrder_storeId_posSyncStatus_idx" ON "CommerceOrder"("storeId", "posSyncStatus");
CREATE INDEX IF NOT EXISTS "CommerceOrderItem_orderId_idx" ON "CommerceOrderItem"("orderId");
CREATE INDEX IF NOT EXISTS "CommercePayment_storeId_status_idx" ON "CommercePayment"("storeId", "status");
CREATE INDEX IF NOT EXISTS "CommercePayment_providerReference_idx" ON "CommercePayment"("providerReference");
CREATE INDEX IF NOT EXISTS "CommerceSyncEvent_storeId_status_idx" ON "CommerceSyncEvent"("storeId", "status");
CREATE INDEX IF NOT EXISTS "CommerceSyncEvent_targetOutletId_status_idx" ON "CommerceSyncEvent"("targetOutletId", "status");
CREATE INDEX IF NOT EXISTS "CommerceSyncEvent_idempotencyKey_idx" ON "CommerceSyncEvent"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CommerceDriver_storeId_currentStatus_idx" ON "CommerceDriver"("storeId", "currentStatus");
CREATE INDEX IF NOT EXISTS "CommerceDeliveryZone_storeId_isActive_idx" ON "CommerceDeliveryZone"("storeId", "isActive");
CREATE INDEX IF NOT EXISTS "CommercePromotion_storeId_isActive_idx" ON "CommercePromotion"("storeId", "isActive");
CREATE INDEX IF NOT EXISTS "CommercePromotion_code_idx" ON "CommercePromotion"("code");
CREATE INDEX IF NOT EXISTS "CommerceMealPass_storeId_customerId_idx" ON "CommerceMealPass"("storeId", "customerId");
CREATE INDEX IF NOT EXISTS "CommerceMealPassRedemption_mealPassId_idx" ON "CommerceMealPassRedemption"("mealPassId");
CREATE INDEX IF NOT EXISTS "CommerceGroupOrderSession_storeId_status_idx" ON "CommerceGroupOrderSession"("storeId", "status");
CREATE INDEX IF NOT EXISTS "CommerceGroupOrderSession_shareToken_idx" ON "CommerceGroupOrderSession"("shareToken");
CREATE INDEX IF NOT EXISTS "CommerceNotificationLog_orderId_channel_idx" ON "CommerceNotificationLog"("orderId", "channel");
CREATE INDEX IF NOT EXISTS "CommerceNotificationLog_storeId_status_createdAt_idx" ON "CommerceNotificationLog"("storeId", "status", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceStore_organizationId_fkey') THEN
    ALTER TABLE "CommerceStore" ADD CONSTRAINT "CommerceStore_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceStore_propertyId_fkey') THEN
    ALTER TABLE "CommerceStore" ADD CONSTRAINT "CommerceStore_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceMenu_storeId_fkey') THEN
    ALTER TABLE "CommerceMenu" ADD CONSTRAINT "CommerceMenu_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "CommerceStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceCategory_menuId_fkey') THEN
    ALTER TABLE "CommerceCategory" ADD CONSTRAINT "CommerceCategory_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "CommerceMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceProduct_storeId_fkey') THEN
    ALTER TABLE "CommerceProduct" ADD CONSTRAINT "CommerceProduct_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "CommerceStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceProduct_categoryId_fkey') THEN
    ALTER TABLE "CommerceProduct" ADD CONSTRAINT "CommerceProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CommerceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceModifierGroup_productId_fkey') THEN
    ALTER TABLE "CommerceModifierGroup" ADD CONSTRAINT "CommerceModifierGroup_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceModifierOption_groupId_fkey') THEN
    ALTER TABLE "CommerceModifierOption" ADD CONSTRAINT "CommerceModifierOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "CommerceModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceCustomer_storeId_fkey') THEN
    ALTER TABLE "CommerceCustomer" ADD CONSTRAINT "CommerceCustomer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "CommerceStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceOrder_storeId_fkey') THEN
    ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "CommerceStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceOrder_customerId_fkey') THEN
    ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CommerceCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceOrderItem_orderId_fkey') THEN
    ALTER TABLE "CommerceOrderItem" ADD CONSTRAINT "CommerceOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceOrderItem_productId_fkey') THEN
    ALTER TABLE "CommerceOrderItem" ADD CONSTRAINT "CommerceOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommercePayment_orderId_fkey') THEN
    ALTER TABLE "CommercePayment" ADD CONSTRAINT "CommercePayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceSyncEvent_storeId_fkey') THEN
    ALTER TABLE "CommerceSyncEvent" ADD CONSTRAINT "CommerceSyncEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "CommerceStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceSyncEvent_orderId_fkey') THEN
    ALTER TABLE "CommerceSyncEvent" ADD CONSTRAINT "CommerceSyncEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceDelivery_orderId_fkey') THEN
    ALTER TABLE "CommerceDelivery" ADD CONSTRAINT "CommerceDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceDelivery_driverId_fkey') THEN
    ALTER TABLE "CommerceDelivery" ADD CONSTRAINT "CommerceDelivery_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "CommerceDriver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceDriver_storeId_fkey') THEN
    ALTER TABLE "CommerceDriver" ADD CONSTRAINT "CommerceDriver_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "CommerceStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceDeliveryZone_storeId_fkey') THEN
    ALTER TABLE "CommerceDeliveryZone" ADD CONSTRAINT "CommerceDeliveryZone_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "CommerceStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommercePromotion_storeId_fkey') THEN
    ALTER TABLE "CommercePromotion" ADD CONSTRAINT "CommercePromotion_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "CommerceStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceOrder_groupOrderSessionId_fkey') THEN
    ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_groupOrderSessionId_fkey" FOREIGN KEY ("groupOrderSessionId") REFERENCES "CommerceGroupOrderSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceOrder_promotionId_fkey') THEN
    ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "CommercePromotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceMealPass_storeId_fkey') THEN
    ALTER TABLE "CommerceMealPass" ADD CONSTRAINT "CommerceMealPass_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "CommerceStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceMealPass_customerId_fkey') THEN
    ALTER TABLE "CommerceMealPass" ADD CONSTRAINT "CommerceMealPass_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CommerceCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceMealPassRedemption_mealPassId_fkey') THEN
    ALTER TABLE "CommerceMealPassRedemption" ADD CONSTRAINT "CommerceMealPassRedemption_mealPassId_fkey" FOREIGN KEY ("mealPassId") REFERENCES "CommerceMealPass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceGroupOrderSession_storeId_fkey') THEN
    ALTER TABLE "CommerceGroupOrderSession" ADD CONSTRAINT "CommerceGroupOrderSession_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "CommerceStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceNotificationLog_storeId_fkey') THEN
    ALTER TABLE "CommerceNotificationLog" ADD CONSTRAINT "CommerceNotificationLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "CommerceStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceNotificationLog_orderId_fkey') THEN
    ALTER TABLE "CommerceNotificationLog" ADD CONSTRAINT "CommerceNotificationLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CommerceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommerceNetworkEnrollment_storeId_fkey') THEN
    ALTER TABLE "CommerceNetworkEnrollment" ADD CONSTRAINT "CommerceNetworkEnrollment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "CommerceStore"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

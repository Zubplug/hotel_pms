-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED', 'OUT_OF_ORDER', 'OUT_OF_SERVICE', 'MAINTENANCE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "HousekeepingStatus" AS ENUM ('DIRTY', 'CLEANING', 'CLEAN', 'INSPECTED', 'OUT_OF_ORDER');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('MAINTENANCE', 'HOUSE_USE', 'COMPLIMENTARY', 'OWNER_USE', 'INVENTORY', 'DEEP_CLEAN');

-- CreateEnum
CREATE TYPE "RatePlanType" AS ENUM ('STANDARD', 'CORPORATE', 'GROUP', 'PROMOTIONAL', 'SEASONAL', 'GOVERNMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReservationSource" AS ENUM ('WALK_IN', 'PHONE', 'EMAIL', 'WEBSITE', 'OTA', 'CORPORATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('INQUIRY', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW', 'EXPIRED');

-- CreateEnum
CREATE TYPE "FolioItemSource" AS ENUM ('ROOM_CHARGE', 'MANUAL', 'POS', 'RESTAURANT', 'BAR', 'SPA', 'LAUNDRY', 'TRANSPORT', 'TELEPHONE', 'INTERNET', 'MINIBAR', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'POS', 'CARD', 'PAYMENT_GATEWAY', 'MOBILE_PAYMENT', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'RESOLVED', 'CLOSED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'NGN',
    "defaultTimezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "defaultLocale" TEXT NOT NULL DEFAULT 'en-NG',
    "settings" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "starRating" INTEGER,
    "checkInTime" TEXT NOT NULL DEFAULT '14:00',
    "checkOutTime" TEXT NOT NULL DEFAULT '12:00',
    "baseCurrency" TEXT NOT NULL DEFAULT 'NGN',
    "supportedCurrencies" TEXT[],
    "businessDate" DATE,
    "lastAuditAt" TIMESTAMPTZ,
    "auditStatus" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "locale" TEXT NOT NULL DEFAULT 'en-NG',
    "settings" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "floors" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" UUID NOT NULL,
    "buildingId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomType" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "maxOccupancy" INTEGER NOT NULL,
    "defaultBedConfig" TEXT NOT NULL,
    "amenities" TEXT[],
    "photos" TEXT[],
    "baseRate" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "buildingId" UUID NOT NULL,
    "floorId" UUID NOT NULL,
    "roomTypeId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT,
    "maxOccupancy" INTEGER NOT NULL,
    "bedConfiguration" TEXT NOT NULL,
    "squareMeters" DECIMAL(8,2),
    "view" TEXT,
    "amenities" TEXT[],
    "photos" TEXT[],
    "description" TEXT,
    "status" "RoomStatus" NOT NULL,
    "housekeepingStatus" "HousekeepingStatus" NOT NULL,
    "isAccessible" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Amenity" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Amenity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomBlock" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "type" "BlockType" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "authorizedBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "RoomBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatePlan" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" "RatePlanType" NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minStay" INTEGER NOT NULL DEFAULT 1,
    "maxStay" INTEGER,
    "advanceBookingDays" INTEGER,
    "blackoutDates" DATE[],
    "cancellationPolicyId" UUID,
    "depositPolicyId" UUID,
    "noShowPolicyId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "RatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rate" (
    "id" UUID NOT NULL,
    "ratePlanId" UUID NOT NULL,
    "roomTypeId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "dayOfWeek" INTEGER[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonalRate" (
    "id" UUID NOT NULL,
    "ratePlanId" UUID NOT NULL,
    "roomTypeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SeasonalRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationPolicy" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "hoursBeforeCheckIn" INTEGER NOT NULL,
    "penaltyType" TEXT NOT NULL,
    "penaltyValue" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "CancellationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositPolicy" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "dueAtBooking" BOOLEAN NOT NULL,

    CONSTRAINT "DepositPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoShowPolicy" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "chargeType" TEXT NOT NULL,
    "chargeValue" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "NoShowPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "dateOfBirth" DATE,
    "gender" TEXT,
    "nationality" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "idType" TEXT,
    "idNumberEncrypted" TEXT,
    "idNumberHint" TEXT,
    "companyName" TEXT,
    "companyId" UUID,
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "vipLevel" TEXT,
    "preferences" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestDocument" (
    "id" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ,

    CONSTRAINT "GuestDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "confirmationNumber" TEXT NOT NULL,
    "primaryGuestId" UUID NOT NULL,
    "companyId" UUID,
    "source" "ReservationSource" NOT NULL,
    "channelRef" TEXT,
    "status" "ReservationStatus" NOT NULL,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL,
    "ratePlanId" UUID NOT NULL,
    "ratePlanSnapshot" JSONB NOT NULL,
    "cancellationPolicyId" UUID,
    "depositPolicyId" UUID,
    "noShowPolicyId" UUID,
    "depositRequired" DECIMAL(18,4),
    "depositPaid" DECIMAL(18,4),
    "currency" TEXT NOT NULL,
    "specialRequests" TEXT,
    "internalNotes" TEXT,
    "earlyCheckIn" BOOLEAN NOT NULL DEFAULT false,
    "lateCheckOut" BOOLEAN NOT NULL DEFAULT false,
    "earlyCheckInCharge" DECIMAL(18,4),
    "lateCheckOutCharge" DECIMAL(18,4),
    "cancelledAt" TIMESTAMPTZ,
    "cancelledBy" UUID,
    "cancellationReason" TEXT,
    "noShowAt" TIMESTAMPTZ,
    "noShowBy" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationGuest" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationRoom" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "roomTypeId" UUID NOT NULL,
    "roomId" UUID,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL,
    "ratePlanId" UUID NOT NULL,
    "rateAmount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ReservationRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folio" (
    "id" UUID NOT NULL,
    "reservationId" UUID,
    "propertyId" UUID NOT NULL,
    "guestId" UUID,
    "folioNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "totalCharges" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalPayments" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "closedAt" TIMESTAMPTZ,
    "closedBy" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Folio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioItem" (
    "id" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "businessDate" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "source" "FolioItemSource" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "unitAmount" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "baseAmount" DECIMAL(18,4) NOT NULL,
    "exchangeRate" DECIMAL(18,8),
    "taxId" UUID,
    "discountId" UUID,
    "posTransactionId" TEXT,
    "voidedAt" TIMESTAMPTZ,
    "voidedBy" UUID,
    "voidReason" TEXT,
    "postedBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "reservationId" UUID,
    "propertyId" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "provider" TEXT,
    "providerTransactionId" TEXT,
    "providerRef" TEXT,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "baseAmount" DECIMAL(18,4) NOT NULL,
    "exchangeRate" DECIMAL(18,8),
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "receivedBy" UUID NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "folioId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "authorizedBy" UUID NOT NULL,
    "providerRefundId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tax" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rate" DECIMAL(8,4) NOT NULL,
    "appliesTo" TEXT[],
    "isInclusive" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Tax_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(18,4) NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMPTZ NOT NULL,
    "validTo" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "processedAt" TIMESTAMPTZ,
    "error" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NightAudit" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "businessDate" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "runBy" UUID,
    "roomChargesPosted" INTEGER NOT NULL DEFAULT 0,
    "totalRoomRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "occupancy" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "adr" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "revpar" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "exceptions" JSONB,
    "notes" TEXT,

    CONSTRAINT "NightAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupancySnapshot" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "businessDate" DATE NOT NULL,
    "totalRooms" INTEGER NOT NULL,
    "occupiedRooms" INTEGER NOT NULL,
    "availableRooms" INTEGER NOT NULL,
    "outOfOrderRooms" INTEGER NOT NULL,
    "blockedRooms" INTEGER NOT NULL,
    "occupancyPct" DECIMAL(5,2) NOT NULL,
    "adr" DECIMAL(18,4) NOT NULL,
    "revpar" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,

    CONSTRAINT "OccupancySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HousekeepingTask" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" "HousekeepingStatus" NOT NULL,
    "assignedTo" UUID,
    "businessDate" DATE NOT NULL,
    "startedAt" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "inspectedAt" TIMESTAMPTZ,
    "inspectedBy" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "HousekeepingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HousekeepingShift" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "tasksAssigned" INTEGER NOT NULL DEFAULT 0,
    "tasksCompleted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "HousekeepingShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceTicket" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID,
    "location" TEXT,
    "categoryId" UUID NOT NULL,
    "priority" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reportedBy" UUID NOT NULL,
    "assignedTo" UUID,
    "estimatedCost" DECIMAL(18,4),
    "actualCost" DECIMAL(18,4),
    "photos" TEXT[],
    "scheduledAt" TIMESTAMPTZ,
    "startedAt" TIMESTAMPTZ,
    "resolvedAt" TIMESTAMPTZ,
    "closedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MaintenanceTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceCategory" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MaintenanceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestServiceRequest" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledFor" TIMESTAMPTZ,
    "completedAt" TIMESTAMPTZ,
    "details" JSONB,
    "assignedTo" UUID,
    "charge" DECIMAL(18,4),
    "currency" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GuestServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID,
    "employeeId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "department" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "propertyAccess" UUID[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hiredAt" DATE,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "staffId" UUID,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMPTZ,
    "lastLoginIp" TEXT,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoorLock" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "roomId" UUID,
    "externalLockId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "batteryLevel" INTEGER,
    "lastBatteryCheck" TIMESTAMPTZ,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DoorLock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LockCredential" (
    "id" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "lockId" UUID NOT NULL,
    "externalCredentialId" TEXT NOT NULL,
    "credentialType" TEXT NOT NULL,
    "validFrom" TIMESTAMPTZ NOT NULL,
    "validUntil" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "revokedReason" TEXT,
    "providerMeta" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LockCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LockEvent" (
    "id" UUID NOT NULL,
    "lockId" UUID NOT NULL,
    "credentialId" UUID,
    "eventType" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LockEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConfig" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "configEncrypted" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "lastHealthCheck" TIMESTAMPTZ,
    "healthStatus" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "IntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernmentSubmission" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "response" JSONB,
    "submittedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GovernmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID,
    "recipientType" TEXT NOT NULL,
    "recipientId" UUID,
    "recipientEmail" TEXT,
    "recipientPhone" TEXT,
    "channel" TEXT NOT NULL,
    "templateId" UUID,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sentAt" TIMESTAMPTZ,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "channels" TEXT[],
    "subject" TEXT,
    "bodyHtml" TEXT,
    "bodySms" TEXT,
    "variables" TEXT[],
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID,
    "userId" UUID,
    "userEmail" TEXT,
    "userRole" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Property_code_key" ON "Property"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_confirmationNumber_key" ON "Reservation"("confirmationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Folio_folioNumber_key" ON "Folio"("folioNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_eventId_key" ON "WebhookEvent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Amenity" ADD CONSTRAINT "Amenity_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomBlock" ADD CONSTRAINT "RoomBlock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_cancellationPolicyId_fkey" FOREIGN KEY ("cancellationPolicyId") REFERENCES "CancellationPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_depositPolicyId_fkey" FOREIGN KEY ("depositPolicyId") REFERENCES "DepositPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_noShowPolicyId_fkey" FOREIGN KEY ("noShowPolicyId") REFERENCES "NoShowPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rate" ADD CONSTRAINT "Rate_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rate" ADD CONSTRAINT "Rate_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonalRate" ADD CONSTRAINT "SeasonalRate_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonalRate" ADD CONSTRAINT "SeasonalRate_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationPolicy" ADD CONSTRAINT "CancellationPolicy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositPolicy" ADD CONSTRAINT "DepositPolicy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoShowPolicy" ADD CONSTRAINT "NoShowPolicy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestDocument" ADD CONSTRAINT "GuestDocument_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_primaryGuestId_fkey" FOREIGN KEY ("primaryGuestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_cancellationPolicyId_fkey" FOREIGN KEY ("cancellationPolicyId") REFERENCES "CancellationPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_depositPolicyId_fkey" FOREIGN KEY ("depositPolicyId") REFERENCES "DepositPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_noShowPolicyId_fkey" FOREIGN KEY ("noShowPolicyId") REFERENCES "NoShowPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationGuest" ADD CONSTRAINT "ReservationGuest_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationRoom" ADD CONSTRAINT "ReservationRoom_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationRoom" ADD CONSTRAINT "ReservationRoom_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioItem" ADD CONSTRAINT "FolioItem_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tax" ADD CONSTRAINT "Tax_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightAudit" ADD CONSTRAINT "NightAudit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupancySnapshot" ADD CONSTRAINT "OccupancySnapshot_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingShift" ADD CONSTRAINT "HousekeepingShift_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceTicket" ADD CONSTRAINT "MaintenanceTicket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MaintenanceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceCategory" ADD CONSTRAINT "MaintenanceCategory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestServiceRequest" ADD CONSTRAINT "GuestServiceRequest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestServiceRequest" ADD CONSTRAINT "GuestServiceRequest_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestServiceRequest" ADD CONSTRAINT "GuestServiceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoorLock" ADD CONSTRAINT "DoorLock_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoorLock" ADD CONSTRAINT "DoorLock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationConfig" ADD CONSTRAINT "IntegrationConfig_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernmentSubmission" ADD CONSTRAINT "GovernmentSubmission_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add Custom Exclusion Constraints for Reservations and Blocks
ALTER TABLE "ReservationRoom"
ADD CONSTRAINT "ReservationRoom_no_overlap"
EXCLUDE USING gist (
  "roomId" WITH =,
  daterange("checkIn", "checkOut", '[)') WITH &&
)
WHERE ("status" NOT IN ('CANCELLED', 'NO_SHOW'));

ALTER TABLE "RoomBlock"
ADD CONSTRAINT "RoomBlock_no_overlap"
EXCLUDE USING gist (
  "roomId" WITH =,
  daterange("startDate", "endDate", '[)') WITH &&
);

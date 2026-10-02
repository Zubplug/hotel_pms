-- =============================================================================
-- BOOKING ENGINE — Manual Migration
-- Run this in your Neon SQL editor.
-- Safe to run on a live DB: all new tables, all additive changes.
-- The only destructive change is DROP NOT NULL on Reservation.createdBy.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. New ENUM: ReservationCreatedByType
-- -----------------------------------------------------------------------------
CREATE TYPE "ReservationCreatedByType" AS ENUM ('STAFF', 'GUEST', 'SYSTEM', 'OTA');


-- -----------------------------------------------------------------------------
-- 2. Modify Reservation table
--    a) Drop NOT NULL on createdBy  (allows GUEST / SYSTEM bookings)
--    b) Add createdByType           (defaults to STAFF — zero-impact on existing rows)
--    c) Add bookingChannelRef       (nullable — BookingHold.id at creation time)
--    d) Add guestConfirmationTokenHash  (SHA-256 hash, NOT the raw token)
--    e) Add guestCancellationTokenHash  (SHA-256 hash, NOT the raw token)
-- -----------------------------------------------------------------------------
ALTER TABLE "Reservation"
    ALTER COLUMN "createdBy" DROP NOT NULL;

ALTER TABLE "Reservation"
    ADD COLUMN "createdByType"               "ReservationCreatedByType" NOT NULL DEFAULT 'STAFF',
    ADD COLUMN "bookingChannelRef"            TEXT,
    ADD COLUMN "guestConfirmationTokenHash"   TEXT,
    ADD COLUMN "guestCancellationTokenHash"   TEXT;

-- Unique constraints on the token hashes (prevents token reuse across reservations)
CREATE UNIQUE INDEX "Reservation_guestConfirmationTokenHash_key"
    ON "Reservation"("guestConfirmationTokenHash")
    WHERE "guestConfirmationTokenHash" IS NOT NULL;

CREATE UNIQUE INDEX "Reservation_guestCancellationTokenHash_key"
    ON "Reservation"("guestCancellationTokenHash")
    WHERE "guestCancellationTokenHash" IS NOT NULL;

-- Backfill existing rows: any row with a non-null createdBy is implicitly STAFF.
-- Rows from OTA source are re-typed to OTA.
UPDATE "Reservation"
    SET "createdByType" = 'OTA'
    WHERE "source" = 'OTA';


-- -----------------------------------------------------------------------------
-- 3. CustomDomainRequest
--    HQ-controlled request, approval, payment, and activation lifecycle.
-- -----------------------------------------------------------------------------
CREATE TABLE "CustomDomainRequest" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "organizationId"  UUID         NOT NULL,
    "propertyId"      UUID         NOT NULL,
    "domain"          TEXT         NOT NULL,
    "status"          TEXT         NOT NULL DEFAULT 'REQUESTED',
    "currency"        TEXT         NOT NULL DEFAULT 'NGN',
    "amount"          INTEGER      NOT NULL DEFAULT 0,
    "billingPriceId"  UUID,
    "checkoutRef"     TEXT,
    "requestedByEmail" TEXT,
    "reviewedBy"      TEXT,
    "reviewedAt"      TIMESTAMPTZ,
    "paidAt"          TIMESTAMPTZ,
    "activatedAt"     TIMESTAMPTZ,
    "notes"           TEXT,
    "metadata"        JSONB,
    "createdAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT "CustomDomainRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomDomainRequest_property_domain_key" UNIQUE ("propertyId", "domain"),
    CONSTRAINT "CustomDomainRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
    CONSTRAINT "CustomDomainRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE
);
CREATE INDEX "CustomDomainRequest_org_status_idx" ON "CustomDomainRequest"("organizationId", "status", "createdAt");
CREATE INDEX "CustomDomainRequest_property_status_idx" ON "CustomDomainRequest"("propertyId", "status");

-- 3b. CustomWebsiteRequest
--     One-time HQ-managed custom website design service request.
CREATE TABLE "CustomWebsiteRequest" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "amount" INTEGER NOT NULL DEFAULT 0,
    "billingPriceId" UUID,
    "checkoutRef" TEXT,
    "requestedByEmail" TEXT,
    "brief" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "paidAt" TIMESTAMPTZ,
    "activatedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "CustomWebsiteRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomWebsiteRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
    CONSTRAINT "CustomWebsiteRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE
);
CREATE INDEX "CustomWebsiteRequest_org_status_idx" ON "CustomWebsiteRequest"("organizationId", "status", "createdAt");
CREATE INDEX "CustomWebsiteRequest_property_status_idx" ON "CustomWebsiteRequest"("propertyId", "status");

-- 4. BookingEngineConfig
--    One record per property. Controls whether the engine is enabled,
--    which rate plans are exposed, and payment mode.
-- -----------------------------------------------------------------------------
CREATE TABLE "BookingEngineConfig" (
    "id"                   UUID         NOT NULL DEFAULT gen_random_uuid(),
    "organizationId"       UUID         NOT NULL,
    "propertyId"           UUID         NOT NULL,

    "enabled"              BOOLEAN      NOT NULL DEFAULT false,
    "publicSlug"           TEXT         NOT NULL,
    "bookingLeadTimeHours" INTEGER      NOT NULL DEFAULT 0,
    "maxAdvanceDays"       INTEGER,
    -- Empty array = all public rate plans are exposed
    "allowedRatePlanIds"   TEXT[]       NOT NULL DEFAULT '{}',
    -- FULL | DEPOSIT | PAY_LATER
    "paymentMode"          TEXT         NOT NULL DEFAULT 'PAY_LATER',
    "minStay"              INTEGER      NOT NULL DEFAULT 1,
    "maxStay"              INTEGER,
    "settings"             JSONB,

    "createdAt"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "BookingEngineConfig_pkey"       PRIMARY KEY ("id"),
    CONSTRAINT "BookingEngineConfig_propertyId_key" UNIQUE ("propertyId"),
    CONSTRAINT "BookingEngineConfig_publicSlug_key" UNIQUE ("publicSlug"),
    CONSTRAINT "BookingEngineConfig_propertyId_fkey"
        FOREIGN KEY ("propertyId")      REFERENCES "Property"("id"),
    CONSTRAINT "BookingEngineConfig_organizationId_fkey"
        FOREIGN KEY ("organizationId")  REFERENCES "Organization"("id")
);

CREATE INDEX "BookingEngineConfig_publicSlug_idx" ON "BookingEngineConfig"("publicSlug");


-- -----------------------------------------------------------------------------
-- 5. BookingSite
--    White-label booking website settings (theme, domain, content).
-- -----------------------------------------------------------------------------
CREATE TABLE "BookingSite" (
    "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
    "organizationId"    UUID         NOT NULL,
    "propertyId"        UUID         NOT NULL,

    "publicSlug"        TEXT         NOT NULL,
    "siteName"          TEXT         NOT NULL,
    -- DRAFT | PUBLISHED | SUSPENDED
    "status"            TEXT         NOT NULL DEFAULT 'DRAFT',

    -- CLASSIC_HOTEL | MODERN_BOUTIQUE | RESORT | BUSINESS_HOTEL
    "templateKey"       TEXT         NOT NULL DEFAULT 'CLASSIC_HOTEL',
    "logoUrl"           TEXT,
    "primaryColor"      TEXT,
    "secondaryColor"    TEXT,
    "theme"             JSONB,
    "content"           JSONB,

    "customDomain"      TEXT,
    -- PENDING | VERIFYING | VERIFIED | ACTIVE | FAILED | SUSPENDED
    "domainStatus"      TEXT,
    "verificationToken" TEXT,
    "verifiedAt"        TIMESTAMPTZ,
    "publishedAt"       TIMESTAMPTZ,

    "createdAt"         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "BookingSite_pkey"             PRIMARY KEY ("id"),
    CONSTRAINT "BookingSite_propertyId_key"   UNIQUE ("propertyId"),
    CONSTRAINT "BookingSite_publicSlug_key"   UNIQUE ("publicSlug"),
    CONSTRAINT "BookingSite_customDomain_key" UNIQUE ("customDomain"),
    CONSTRAINT "BookingSite_propertyId_fkey"
        FOREIGN KEY ("propertyId")     REFERENCES "Property"("id"),
    CONSTRAINT "BookingSite_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
);

CREATE INDEX "BookingSite_publicSlug_idx"    ON "BookingSite"("publicSlug");
CREATE INDEX "BookingSite_customDomain_idx"  ON "BookingSite"("customDomain");


-- -----------------------------------------------------------------------------
-- 5. BookingHold
--    Short-lived inventory hold (12-min TTL) placed during the checkout flow.
--    Prevents overbooking at the room-type level while the guest pays.
--
--    NOTE: The existing ReservationRoom_no_overlap exclusion constraint only
--    covers roomId (physical rooms). Room-type overbooking is prevented by
--    the application layer via a serialized SELECT + INSERT inside a transaction.
-- -----------------------------------------------------------------------------
CREATE TABLE "BookingHold" (
    "id"             UUID         NOT NULL DEFAULT gen_random_uuid(),
    "organizationId" UUID         NOT NULL,
    "propertyId"     UUID         NOT NULL,
    "roomTypeId"     UUID         NOT NULL,

    "checkIn"        DATE         NOT NULL,
    "checkOut"       DATE         NOT NULL,
    "quantity"       INTEGER      NOT NULL DEFAULT 1,

    -- SHA-256(rawToken). The raw token is returned to the guest and never stored.
    "tokenHash"      TEXT         NOT NULL,
    -- ACTIVE | CONVERTED | EXPIRED | CANCELLED
    "status"         TEXT         NOT NULL DEFAULT 'ACTIVE',
    "expiresAt"      TIMESTAMPTZ  NOT NULL,

    -- Immutable price snapshot at hold creation time. Used to detect rate drift.
    "quoteSnapshot"  JSONB        NOT NULL,

    "createdAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "BookingHold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BookingHold_inventory_idx"
    ON "BookingHold"("propertyId", "roomTypeId", "checkIn", "checkOut", "status");
CREATE INDEX "BookingHold_tokenHash_idx"  ON "BookingHold"("tokenHash");
-- For the expiry cron job
CREATE INDEX "BookingHold_expiry_idx"     ON "BookingHold"("status", "expiresAt");


-- -----------------------------------------------------------------------------
-- 6. BookingPaymentTransaction
--    Gateway-level record for every Paystack payment attempt from the engine.
--    On success, drives creation of a native Payment record in the existing
--    Folio/accounting pipeline. NOT a parallel accounting system.
-- -----------------------------------------------------------------------------
CREATE TABLE "BookingPaymentTransaction" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "organizationId"  UUID         NOT NULL,
    "propertyId"      UUID         NOT NULL,
    "reservationId"   UUID,
    "holdId"          UUID,

    -- PAYSTACK | FLUTTERWAVE
    "provider"        TEXT         NOT NULL,
    -- Provider's reference string (e.g. Paystack reference)
    "providerRef"     TEXT,
    -- Provider's transaction ID returned after verification
    "providerTxId"    TEXT,

    "amount"          DECIMAL(18,4) NOT NULL,
    "currency"        TEXT          NOT NULL,

    -- PENDING | SUCCESS | FAILED | REFUNDED
    "status"          TEXT          NOT NULL DEFAULT 'PENDING',

    -- Server-generated idempotency key — prevents double-processing webhook replays
    "idempotencyKey"  TEXT          NOT NULL,
    "webhookVerified" BOOLEAN       NOT NULL DEFAULT false,
    "webhookPayload"  JSONB,

    -- Set after success: the ID of the Payment record created in the folio
    "paymentId"       UUID,

    "metadata"        JSONB,

    "createdAt"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    "updatedAt"       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT "BookingPaymentTransaction_pkey"
        PRIMARY KEY ("id"),
    CONSTRAINT "BookingPaymentTransaction_providerRef_key"
        UNIQUE ("providerRef"),
    CONSTRAINT "BookingPaymentTransaction_idempotencyKey_key"
        UNIQUE ("idempotencyKey")
);

CREATE INDEX "BookingPaymentTransaction_providerRef_idx"
    ON "BookingPaymentTransaction"("providerRef");
CREATE INDEX "BookingPaymentTransaction_reservationId_idx"
    ON "BookingPaymentTransaction"("reservationId");
CREATE INDEX "BookingPaymentTransaction_idempotencyKey_idx"
    ON "BookingPaymentTransaction"("idempotencyKey");


-- -----------------------------------------------------------------------------
-- 7. BookingRequest
--    Idempotency guard for the reservation creation step.
--    Prevents duplicate reservations from browser retries, network replays,
--    or double-clicks. Keyed by a client-generated UUID per booking attempt.
-- -----------------------------------------------------------------------------
CREATE TABLE "BookingRequest" (
    -- Client-generated UUID, one per booking attempt
    "idempotencyKey"  TEXT         NOT NULL,
    "propertyId"      UUID         NOT NULL,

    -- PROCESSING | COMPLETED | FAILED
    "status"          TEXT         NOT NULL DEFAULT 'PROCESSING',
    "reservationId"   UUID,
    "errorMessage"    TEXT,

    "createdAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("idempotencyKey")
);

CREATE INDEX "BookingRequest_property_created_idx"
    ON "BookingRequest"("propertyId", "createdAt");


-- -----------------------------------------------------------------------------
-- 8. BookingPaymentAccount
--    Payment provider credentials per org/property.
--    Secret keys are NEVER stored here — only the env-var name that holds them.
-- -----------------------------------------------------------------------------
CREATE TABLE "BookingPaymentAccount" (
    "id"              UUID        NOT NULL DEFAULT gen_random_uuid(),
    "organizationId"  UUID        NOT NULL,
    -- NULL = org-level account; set = property-specific override
    "propertyId"      UUID,

    -- PAYSTACK | FLUTTERWAVE
    "provider"        TEXT        NOT NULL,
    -- PLATFORM (LodgeCore account) | CUSTOMER (hotel's own merchant account)
    "mode"            TEXT        NOT NULL DEFAULT 'PLATFORM',

    "publicKey"       TEXT,
    -- Name of the env var holding the secret key (never the raw key)
    "secretRef"       TEXT,
    -- Name of the env var holding the webhook secret
    "webhookSecretRef" TEXT,

    "currency"        TEXT        NOT NULL,
    "isActive"        BOOLEAN     NOT NULL DEFAULT false,

    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "BookingPaymentAccount_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BookingPaymentAccount_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ,CONSTRAINT "BookingPaymentAccount_propertyId_fkey"
        FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
);

CREATE INDEX "BookingPaymentAccount_org_provider_idx"
    ON "BookingPaymentAccount"("organizationId", "provider", "isActive");

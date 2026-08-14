-- Phase 3: Property & Room Management
-- Migration: phase3_property_room_management

-- Add isActive to Building
ALTER TABLE "Building" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Add code and isActive to Floor; add unique constraint on (buildingId, number)
ALTER TABLE "Floor" ADD COLUMN "code" TEXT;
ALTER TABLE "Floor" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_buildingId_number_key" UNIQUE ("buildingId", "number");

-- Add maxAdults, maxChildren, isActive to RoomType
ALTER TABLE "RoomType" ADD COLUMN "maxAdults" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "RoomType" ADD COLUMN "maxChildren" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RoomType" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Add new enums for Room
CREATE TYPE "RoomMaintenanceStatus" AS ENUM ('NONE', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "RoomStatusSource" AS ENUM ('MANUAL', 'CHECK_IN', 'CHECK_OUT', 'HOUSEKEEPING', 'MAINTENANCE', 'RESERVATION', 'SYSTEM');

-- Add new fields to Room
ALTER TABLE "Room" ADD COLUMN "code" TEXT UNIQUE;
ALTER TABLE "Room" ADD COLUMN "displayName" TEXT;
ALTER TABLE "Room" ADD COLUMN "maxAdults" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Room" ADD COLUMN "maxChildren" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Room" ADD COLUMN "floorPosition" INTEGER;
ALTER TABLE "Room" ADD COLUMN "maintenanceStatus" "RoomMaintenanceStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Room" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Room" ADD CONSTRAINT "Room_propertyId_number_key" UNIQUE ("propertyId", "number");

-- Extend BlockType enum (rename INVENTORY → INVENTORY_BLOCK, add OUT_OF_ORDER, OUT_OF_SERVICE, OTHER)
-- PostgreSQL does not support removing enum values easily, so we add the new ones and rename
-- First add new values
ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'OUT_OF_ORDER';
ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'OUT_OF_SERVICE';
ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'INVENTORY_BLOCK';
ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'OTHER';
-- Note: INVENTORY cannot be removed in PostgreSQL without recreating. 
-- The application layer will treat INVENTORY as legacy; new code uses INVENTORY_BLOCK.

-- Add status column to RoomBlock
ALTER TABLE "RoomBlock" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- Create RoomStatusHistory table
CREATE TABLE "RoomStatusHistory" (
    "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
    "roomId"         UUID NOT NULL,
    "propertyId"     UUID NOT NULL,
    "previousStatus" "RoomStatus" NOT NULL,
    "newStatus"      "RoomStatus" NOT NULL,
    "source"         "RoomStatusSource" NOT NULL,
    "referenceId"    TEXT,
    "changedBy"      UUID,
    "reason"         TEXT,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "RoomStatusHistory_pkey" PRIMARY KEY ("id")
);

-- Add foreign key for RoomStatusHistory.roomId → Room.id
ALTER TABLE "RoomStatusHistory" ADD CONSTRAINT "RoomStatusHistory_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

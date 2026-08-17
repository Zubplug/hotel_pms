-- Phase 1.5 Migration: Add sessionVersion to User model

ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "BreakfastRedemption"
    ADD COLUMN IF NOT EXISTS "menuItemId" UUID,
    ADD COLUMN IF NOT EXISTS "menuItemName" TEXT;

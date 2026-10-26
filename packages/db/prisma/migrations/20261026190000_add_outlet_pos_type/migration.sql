ALTER TYPE "PosTerminalType" ADD VALUE IF NOT EXISTS 'CLUB_POS';

ALTER TABLE "PosOutlet"
ADD COLUMN "posType" "PosTerminalType" NOT NULL DEFAULT 'RESTAURANT_POS';

UPDATE "PosOutlet"
SET "posType" = CASE
  WHEN "type" = 'BAR' THEN 'BAR_POS'::"PosTerminalType"
  WHEN "type" = 'FRONT_DESK' THEN 'FRONT_DESK'::"PosTerminalType"
  ELSE 'RESTAURANT_POS'::"PosTerminalType"
END;

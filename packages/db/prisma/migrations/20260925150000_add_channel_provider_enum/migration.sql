CREATE TYPE "ChannelProvider" AS ENUM ('BEDS24', 'CHANNEX', 'BOOKING_COM', 'EXPEDIA');

ALTER TABLE "ChannelConnection"
  ALTER COLUMN "provider" TYPE "ChannelProvider"
  USING "provider"::"ChannelProvider";

ALTER TABLE "ChannelReservation"
  ALTER COLUMN "provider" TYPE "ChannelProvider"
  USING "provider"::"ChannelProvider";

ALTER TABLE "ChannelSyncEvent"
  ALTER COLUMN "provider" TYPE "ChannelProvider"
  USING "provider"::"ChannelProvider";

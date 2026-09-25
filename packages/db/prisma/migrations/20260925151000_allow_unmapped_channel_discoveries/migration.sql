ALTER TABLE "ChannelRoomMapping"
  ALTER COLUMN "lodgecoreRoomTypeId" DROP NOT NULL;
DROP INDEX IF EXISTS "ChannelRoomMapping_channelConnectionId_lodgecoreRoomTypeId_key";

ALTER TABLE "ChannelRatePlanMapping"
  ALTER COLUMN "lodgecoreRatePlanId" DROP NOT NULL;
DROP INDEX IF EXISTS "ChannelRatePlanMapping_channelConnectionId_lodgecoreRatePlanId_key";

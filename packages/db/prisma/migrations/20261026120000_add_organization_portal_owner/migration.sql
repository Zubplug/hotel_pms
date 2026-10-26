ALTER TABLE "Organization" ADD COLUMN "portalOwnerUserId" UUID;

CREATE INDEX "Organization_portalOwnerUserId_idx" ON "Organization"("portalOwnerUserId");

ALTER TABLE "Organization"
ADD CONSTRAINT "Organization_portalOwnerUserId_fkey"
FOREIGN KEY ("portalOwnerUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

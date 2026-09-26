ALTER TABLE "FolioItem" ADD COLUMN "revenueClass" TEXT;

CREATE INDEX "FolioItem_revenueClass_idx" ON "FolioItem"("revenueClass");

-- CreateEnum
CREATE TYPE "LaundryCustomerType" AS ENUM ('IN_HOUSE', 'WALK_IN');

-- AlterTable
ALTER TABLE "LaundryOrder" ADD COLUMN "customerType" "LaundryCustomerType" NOT NULL DEFAULT 'IN_HOUSE';
ALTER TABLE "LaundryOrder" ALTER COLUMN "reservationId" DROP NOT NULL;

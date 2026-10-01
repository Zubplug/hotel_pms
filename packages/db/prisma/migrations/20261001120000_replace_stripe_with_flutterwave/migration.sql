-- Replace Stripe-specific billing identifiers with provider-neutral Flutterwave identifiers.
-- Existing identifiers are preserved during the rename so historical records remain auditable.
ALTER TABLE "BillingProduct" RENAME COLUMN "stripeProductId" TO "flutterwaveProductId";
ALTER TABLE "BillingPrice" RENAME COLUMN "stripePriceId" TO "flutterwavePriceId";
ALTER TABLE "BillingCustomer" RENAME COLUMN "stripeCustomerId" TO "flutterwaveCustomerId";
ALTER TABLE "Subscription" RENAME COLUMN "stripeSubscriptionId" TO "flutterwaveSubscriptionId";
ALTER TABLE "BillingEvent" RENAME COLUMN "stripeEventId" TO "flutterwaveEventId";
ALTER TABLE "BillingInvoice" RENAME COLUMN "stripeInvoiceId" TO "flutterwaveInvoiceId";
ALTER TABLE "BillingInvoice" RENAME COLUMN "stripeCustomerId" TO "flutterwaveCustomerId";
ALTER TABLE "BillingInvoice" RENAME COLUMN "stripeSubscriptionId" TO "flutterwaveSubscriptionId";

ALTER TABLE "BillingPrice" ALTER COLUMN "flutterwavePriceId" DROP NOT NULL;
ALTER TABLE "BillingCustomer" ALTER COLUMN "flutterwaveCustomerId" DROP NOT NULL;

ALTER INDEX IF EXISTS "BillingProduct_stripeProductId_key" RENAME TO "BillingProduct_flutterwaveProductId_key";
ALTER INDEX IF EXISTS "BillingPrice_stripePriceId_key" RENAME TO "BillingPrice_flutterwavePriceId_key";
ALTER INDEX IF EXISTS "BillingCustomer_stripeCustomerId_key" RENAME TO "BillingCustomer_flutterwaveCustomerId_key";
ALTER INDEX IF EXISTS "Subscription_stripeSubscriptionId_key" RENAME TO "Subscription_flutterwaveSubscriptionId_key";
ALTER INDEX IF EXISTS "BillingEvent_stripeEventId_key" RENAME TO "BillingEvent_flutterwaveEventId_key";
ALTER INDEX IF EXISTS "BillingInvoice_stripeInvoiceId_key" RENAME TO "BillingInvoice_flutterwaveInvoiceId_key";

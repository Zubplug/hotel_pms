import prisma from "@hotel-pms/db";
import { getFlutterwaveBanks, resolveFlutterwaveBankAccount } from "@hotel-pms/db";
import { decryptPaymentCredential } from "@/lib/payment-providers/credentials";
import { resolveSecretRef } from "@/lib/payment-providers/booking-account";
import { getPartnerEligibleProperties } from "@/lib/partner-reach";

async function propertyAccount(partner: { id: string; organizationId: string | null }, propertyId: string) {
  if (!partner.organizationId) throw new Error("Partner is not linked to an organization");
  const eligible = await getPartnerEligibleProperties(partner.organizationId);
  if (!eligible.some((property) => property.id === propertyId)) throw new Error("This property is not available for your partner account");
  const partnerHasProperty = await prisma.referralCampaign.findFirst({ where: { partnerId: partner.id, propertyId }, select: { id: true } });
  if (!partnerHasProperty) throw new Error("This property is not assigned to your partner account");
  const account = await prisma.bookingPaymentAccount.findFirst({
    where: { organizationId: partner.organizationId, propertyId, provider: "FLUTTERWAVE", mode: "CUSTOMER", isActive: true },
    select: { secretCiphertext: true, secretRef: true },
  });
  if (!account) throw new Error("This property has not configured an active Flutterwave account");
  const secretKey = account.secretCiphertext ? decryptPaymentCredential(account.secretCiphertext) : resolveSecretRef(account.secretRef, "FLW_SECRET_KEY");
  return secretKey;
}

export async function listPartnerFlutterwaveBanks(partner: { id: string; organizationId: string | null }, propertyId: string) {
  return getFlutterwaveBanks(await propertyAccount(partner, propertyId));
}

export async function verifyPartnerFlutterwaveAccount(input: { partner: { id: string; organizationId: string | null }; propertyId: string; bankCode: string; accountNumber: string }) {
  if (!/^\d{10}$/.test(input.accountNumber)) throw new Error("Enter a valid 10-digit account number");
  if (!input.bankCode) throw new Error("Select a bank");
  return resolveFlutterwaveBankAccount({ secretKey: await propertyAccount(input.partner, input.propertyId), accountNumber: input.accountNumber, bankCode: input.bankCode });
}

import prisma from "@hotel-pms/db";
import { PartnerShell } from "@/components/partner-shell";
import { getPartnerProperties, getPartnerWalletBalance, requirePartnerPortal } from "@/lib/partner-portal";
import { PartnerWalletWorkspace } from "./PartnerWalletWorkspace";

export default async function PartnerWalletPage() {
  const partner = await requirePartnerPortal();
  const [{ properties }, wallet] = await Promise.all([getPartnerProperties(partner.id, partner.organizationId), getPartnerWalletBalance(partner.id)]);
  const minimumPayout = properties.reduce((value, property) => Math.max(value, Number(property.referralProgram?.minimumPayout || 0)), 0);
  return <PartnerShell partner={partner} availableBalance={Number(wallet?.availableBalance || 0)} currency={wallet?.currency || "NGN"}><div className="reach-page-head"><div><span className="reach-eyebrow">Earnings</span><h1>Wallet & payouts</h1><p>Manage your payable partner balance and payout requests.</p></div><a className="reach-button secondary" href="/partner/settings/payouts">Payout settings →</a></div><PartnerWalletWorkspace initialBalance={Number(wallet?.availableBalance || 0)} currency={wallet?.currency || "NGN"} minimumPayout={minimumPayout} propertyId={properties[0]?.id} /><div className="reach-note" style={{ marginTop: 18 }}>Payouts use the verified bank details on your partner profile and remain subject to Reach approval and settlement processing.</div></PartnerShell>;
}

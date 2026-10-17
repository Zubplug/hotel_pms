import prisma from "@hotel-pms/db";
import { PartnerShell } from "@/components/partner-shell";
import { getPartnerWalletBalance, requirePartnerPortal } from "@/lib/partner-portal";
import { getPartnerPropertyWallets } from "@/lib/partner-property-wallet";
import { PartnerWalletWorkspace } from "./PartnerWalletWorkspace";

export default async function PartnerWalletPage() {
  const partner = await requirePartnerPortal();
  const [wallet, propertyWallets] = await Promise.all([getPartnerWalletBalance(partner.id), getPartnerPropertyWallets(partner.id)]);
  return <PartnerShell partner={partner} availableBalance={Number(wallet?.availableBalance || 0)} currency={wallet?.currency || "NGN"}><div className="reach-page-head"><div><span className="reach-eyebrow">Earnings</span><h1>Wallet & payouts</h1><p>Balances and withdrawals are separated by property so each payout uses the correct property account.</p></div><a className="reach-button secondary" href="/partner/settings/payouts">Payout settings →</a></div><PartnerWalletWorkspace wallets={propertyWallets.map((item) => ({ id: item.id, propertyId: item.propertyId, propertyName: item.property.name, currency: item.currency, availableBalance: Number(item.availableBalance), minimumPayout: Number(item.property.referralProgram?.minimumPayout || 0) }))} /><div className="reach-note" style={{ marginTop: 18 }}>Withdrawals are sent through the selected property's configured Flutterwave account to the verified bank details for that property.</div></PartnerShell>;
}

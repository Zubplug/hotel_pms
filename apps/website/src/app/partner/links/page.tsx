import Link from "next/link";
import prisma from "@hotel-pms/db";
import { PartnerShell } from "@/components/partner-shell";
import { getPartnerProperties, getPartnerWalletBalance, requirePartnerPortal } from "@/lib/partner-portal";
import { PartnerCopyButton } from "@/components/partner-copy-button";
import { reachShareUrl } from "@/lib/reach-links";

export default async function PartnerLinksPage() {
  const partner = await requirePartnerPortal();
  const [{ properties, scope }, wallet] = await Promise.all([getPartnerProperties(partner.id, partner.organizationId), getPartnerWalletBalance(partner.id)]);
  const campaigns = await prisma.referralCampaign.findMany({ where: scope, include: { property: { select: { name: true, city: true } }, _count: { select: { clicks: true, bookings: true } } }, orderBy: { createdAt: "desc" } });
  return <PartnerShell partner={partner} availableBalance={Number(wallet?.availableBalance || 0)} currency={wallet?.currency || "NGN"}><div className="reach-page-head"><div><span className="reach-eyebrow">Marketing studio</span><h1>My referral links</h1><p>Every link is tied to your partner account and an eligible property campaign.</p></div><Link href="/partner/campaigns" className="reach-button primary">New campaign <span>+</span></Link></div>{campaigns.length ? <div className="reach-link-list">{campaigns.map((campaign) => { const shareUrl = reachShareUrl(campaign.code); return <article className="reach-card reach-link-card" key={campaign.id}><div className="reach-link-card-head"><div><span className="reach-pill success">{campaign.category}</span><h2>{campaign.name}</h2><p>{campaign.property.name} · {campaign.property.city}</p></div><span className={`reach-pill ${campaign.isActive ? "success" : "pending"}`}>{campaign.isActive ? "ACTIVE" : "PAUSED"}</span></div><div className="reach-link-row"><code>{shareUrl}</code><PartnerCopyButton value={shareUrl} /></div><div className="reach-link-stats"><span>{campaign._count.clicks} clicks</span><span>{campaign._count.bookings} attributed bookings</span><span>Code {campaign.code}</span></div></article>; })}</div> : <div className="reach-card reach-empty"><strong>No referral links yet</strong><p>Create a campaign after choosing one of {properties.length} eligible properties.</p><Link href="/partner/campaigns" className="reach-button primary">Create your first campaign</Link></div>}</PartnerShell>;
}

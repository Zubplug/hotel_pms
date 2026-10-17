import prisma from "@hotel-pms/db";
import { PartnerShell } from "@/components/partner-shell";
import { PartnerCopyButton } from "@/components/partner-copy-button";
import { getPartnerEligibleProperties } from "@/lib/partner-reach";
import { getPartnerWalletBalance, requirePartnerPortal } from "@/lib/partner-portal";
import { reachShareUrl } from "@/lib/reach-links";
import { CreativeGenerationPanel } from "./CreativeGenerationPanel";

export default async function PartnerMarketingPage() {
  const partner = await requirePartnerPortal();
  const [properties, wallet] = await Promise.all([getPartnerEligibleProperties(partner.organizationId), getPartnerWalletBalance(partner.id)]);
  const propertyIds = properties.map((property) => property.id);
  const now = new Date();
  const [campaigns, creatives] = await Promise.all([
    prisma.referralCampaign.findMany({ where: { partnerId: partner.id, propertyId: { in: propertyIds } }, orderBy: { createdAt: "desc" }, take: 50, include: { property: { select: { name: true } } } }),
    prisma.reachCreativeAsset.findMany({ where: { propertyId: { in: propertyIds }, status: "APPROVED", OR: [{ validFrom: null }, { validFrom: { lte: now } }], AND: [{ OR: [{ validUntil: null }, { validUntil: { gte: now } }] }, { OR: [{ usageNotes: null }, { usageNotes: { not: { startsWith: "Deterministically rendered from approved LodgeCore data" } } }] }] }, orderBy: { createdAt: "desc" }, take: 100, include: { property: { select: { name: true } }, campaign: { select: { name: true } } } }),
  ]);
  const rooms = properties.flatMap((property) => property.roomTypes.flatMap((room) => [...room.photos, ...room.reachMedia.map((media) => media.url)].map((photo, index) => ({ photo, index, roomName: room.name, propertyName: property.name }))));
  return <PartnerShell partner={partner} availableBalance={Number(wallet?.availableBalance || 0)} currency={wallet?.currency || "NGN"}>
    <div className="reach-page-head"><div><span className="reach-eyebrow">Marketing studio</span><h1>Banners & creatives</h1><p>Use approved property media and supported referral destinations.</p></div></div>
    <div className="reach-note">Assets are restricted to approved records for eligible properties and active validity windows.</div>
    <CreativeGenerationPanel campaigns={campaigns.map((campaign) => ({ id: campaign.id, name: campaign.name, propertyName: campaign.property.name }))} />
    <div className="reach-card" style={{ marginTop: 18 }}><div className="reach-card-head"><div><h2>Approved creative library</h2><p>Published by LodgeCore or participating property teams.</p></div></div>{creatives.length ? <div className="reach-asset-grid">{creatives.map((asset) => <article className="reach-asset-card" key={asset.id}><img src={asset.thumbnailUrl || asset.url} alt={asset.title} /><div><strong>{asset.title}</strong><small>{asset.property.name} · {asset.assetType}{asset.campaign ? ` · ${asset.campaign.name}` : ""}</small>{asset.usageNotes && <small>{asset.usageNotes}</small>}<a className="reach-button secondary small" href={asset.url} target="_blank" rel="noreferrer" download>Download asset</a></div></article>)}</div> : <div className="reach-empty compact"><strong>No approved creatives published</strong><p>Property teams can publish banners, social assets and templates here.</p></div>}</div>
    <div className="reach-card" style={{ marginTop: 18 }}><div className="reach-card-head"><div><h2>Approved room photography</h2><p>Existing room images can be opened for campaign preparation.</p></div></div>{rooms.length ? <div className="reach-asset-grid">{rooms.map((asset) => <article className="reach-asset-card" key={`${asset.photo}-${asset.index}`}><img src={asset.photo} alt={`${asset.roomName} at ${asset.propertyName}`} /><div><strong>{asset.roomName}</strong><small>{asset.propertyName}</small><a className="reach-button secondary small" href={asset.photo} target="_blank" rel="noreferrer" download>Open image</a></div></article>)}</div> : <div className="reach-empty compact"><strong>No approved room photography available</strong></div>}</div>
    <div className="reach-card" style={{ marginTop: 18 }}><div className="reach-card-head"><div><h2>Campaign-ready links</h2><p>Use existing supported campaign destinations.</p></div></div><div className="reach-link-list">{campaigns.map((campaign) => { const shareUrl = reachShareUrl(campaign.code); return <div className="reach-link-card" key={campaign.id}><div className="reach-link-card-head"><h2>{campaign.name}</h2><span className={`reach-pill ${campaign.isActive ? "success" : "pending"}`}>{campaign.isActive ? "ACTIVE" : "PAUSED"}</span></div><p className="reach-property-description">{campaign.property.name} · {campaign.category}</p><div className="reach-link-row"><code>{shareUrl}</code><PartnerCopyButton value={shareUrl} /></div></div>; })}{!campaigns.length && <div className="reach-empty compact"><strong>No campaigns available</strong></div>}</div></div>
  </PartnerShell>;
}

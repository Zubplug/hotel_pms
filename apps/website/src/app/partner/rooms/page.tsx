import Link from "next/link";
import { PartnerShell } from "@/components/partner-shell";
import { getPartnerWalletBalance, requirePartnerPortal } from "@/lib/partner-portal";
import { getPartnerEligibleProperties } from "@/lib/partner-reach";
import { PartnerRoomGallery } from "@/components/partner-room-gallery";

export default async function PartnerRoomsPage() {
  const partner = await requirePartnerPortal();
  const [properties, wallet] = await Promise.all([getPartnerEligibleProperties(partner.organizationId), getPartnerWalletBalance(partner.id)]);
  const rooms = properties.flatMap((property) => property.roomTypes.map((room) => ({ ...room, property })));
  return <PartnerShell partner={partner} availableBalance={Number(wallet?.availableBalance || 0)} currency={wallet?.currency || "NGN"}><div className="reach-page-head"><div><span className="reach-eyebrow">Discover</span><h1>Room types & offers</h1><p>Professional room-category information from active participating properties.</p></div></div>{rooms.length ? <div className="reach-room-grid reach-room-grid-large">{rooms.map((room) => <article className="reach-room-card" key={room.id}><PartnerRoomGallery photos={room.photos} roomName={room.name} propertyName={room.property.name} /><div className="reach-room-body"><span className="reach-room-property">{room.property.name} · {room.property.city}</span><h3>{room.name}</h3><p>{room.description || "The property has not published a room description yet."}</p><div className="reach-room-tags">{room.amenities.slice(0, 4).map((amenity) => <span key={amenity}>{amenity}</span>)}</div><div className="reach-room-meta"><span>{room.bedConfiguration}</span><span>Up to {room.maxOccupancy}</span><span>{room.rooms.length} live rooms</span></div><div className="reach-room-footer"><strong>{new Intl.NumberFormat("en-NG", { style: "currency", currency: room.currency || room.property.baseCurrency, maximumFractionDigits: 0 }).format(Number(room.baseRate))}<small> starting rate</small></strong><Link href={`/partner/links?propertyId=${room.property.id}`} className="reach-button primary small">Refer this property</Link></div></div></article>)}</div> : <div className="reach-card reach-empty"><strong>No room inventory is currently published</strong><p>Published room categories from eligible properties will appear here.</p></div>}</PartnerShell>;
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { corporateApi } from '@/lib/corporate-portal';
import GuestDetailsForm from '../GuestDetailsForm';

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
}

function guestName(guest: any) {
  const name = `${guest?.firstName || ''} ${guest?.lastName || ''}`.trim();
  return name || 'Guest details pending';
}

export default async function CorporateReservationDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await corporateApi<any>('/api/v1/corporate/reservations');
  if (!result.ok) return <section className="portal-empty-state portal-page-error"><strong>Reservation details are unavailable</strong><p>{result.error}</p><Link href="/corporate/reservations" className="portal-text-link">Back to reservations →</Link></section>;
  const reservation = (result.data.reservations || []).find((row: any) => row.id === id);
  if (!reservation) notFound();
  const snapshot = reservation.ratePlanSnapshot || {};
  const nights = nightsBetween(reservation.checkIn, reservation.checkOut);
  const roomCount = reservation.reservationRooms?.length || 0;
  const total = Number(snapshot.total || 0);
  const paymentMode = String(snapshot.paymentMode || snapshot.request?.paymentMode || 'Corporate terms').replaceAll('_', ' ');
  const editableGuest = ['PENDING', 'CONFIRMED'].includes(reservation.status);

  return <>
    <div className="reservation-detail-breadcrumb"><Link href="/corporate/reservations">← Reservations</Link><span>/</span><strong>{reservation.confirmationNumber}</strong></div>
    <section className="reservation-detail-hero"><div><span className="portal-section-kicker">Reservation details</span><div className="reservation-detail-title"><h2>{guestName(reservation.primaryGuest)}</h2><span className={`portal-status-pill ${reservation.status.toLowerCase()}`}>{reservation.status.replaceAll('_', ' ')}</span></div><p>{reservation.confirmationNumber} · Created for your corporate account</p></div><Link href="/corporate/book" className="portal-secondary-action">＋ New reservation</Link></section>
    <div className="reservation-detail-layout"><aside className="reservation-detail-rail"><div className="reservation-rail-card"><span className="reservation-rail-label">Stay summary</span><div className="reservation-rail-dates"><div><small>Check-in</small><strong>{dateLabel(reservation.checkIn)}</strong></div><span>→</span><div><small>Check-out</small><strong>{dateLabel(reservation.checkOut)}</strong></div></div><div className="reservation-rail-stat"><span>Length</span><strong>{nights} night{nights === 1 ? '' : 's'}</strong></div><div className="reservation-rail-stat"><span>Guests</span><strong>{reservation.adults || 0} adults{reservation.children ? ` · ${reservation.children} children` : ''}</strong></div><div className="reservation-rail-stat"><span>Rooms</span><strong>{roomCount || 'Pending assignment'}</strong></div></div><div className="reservation-rail-card reservation-rail-total"><span className="reservation-rail-label">Reservation value</span><small>{reservation.currency}</small><strong>{total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong><span className="reservation-rail-payment">Payment arrangement · {paymentMode}</span></div><div className="reservation-rail-note"><span>✓</span><p><strong>Corporate rate protected</strong>Your negotiated rate remains linked to this reservation and your company account.</p></div></aside><main className="reservation-detail-content"><section className="reservation-detail-card"><div className="reservation-detail-card-heading"><div><span className="portal-section-kicker">Accommodation</span><h3>Room arrangement</h3></div><span>{roomCount} room{roomCount === 1 ? '' : 's'}</span></div><div className="reservation-room-detail-list">{reservation.reservationRooms?.length ? reservation.reservationRooms.map((room: any, index: number) => <div className="reservation-room-detail" key={`${room.roomTypeId || 'room'}-${index}`}><span className="reservation-room-number">{room.room?.number || '—'}</span><div><strong>{room.room?.roomType?.name || 'Reserved room'}</strong><p>{room.room?.number ? `Room ${room.room.number}` : 'Room assignment will be confirmed by the resort.'}</p></div><span className="reservation-room-rate">{room.currency} {Number(room.rateAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}<small>room rate</small></span></div>) : <p className="reservation-detail-muted">Room assignment is being prepared.</p>}</div></section><section className="reservation-detail-card"><div className="reservation-detail-card-heading"><div><span className="portal-section-kicker">Primary guest</span><h3>Guest information</h3></div><span>{editableGuest ? 'Editable before arrival' : 'Managed by front desk'}</span></div><p className="reservation-detail-copy">Keep the primary guest details current so the resort team can prepare the stay correctly.</p><GuestDetailsForm reservationId={reservation.id} guest={reservation.primaryGuest} editable={editableGuest} /></section><section className="reservation-detail-card reservation-detail-support"><span className="portal-section-kicker">Need assistance?</span><h3>Our reservations team is here to help.</h3><p>Contact the corporate team if you need to update stay details or arrange support for your guests.</p><a href="mailto:info@stanzelgrandresort.org" className="portal-text-link">Contact support →</a></section></main></div>
  </>;
}

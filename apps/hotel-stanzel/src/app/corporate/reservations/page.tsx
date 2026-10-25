import Link from 'next/link';
import { corporateApi } from '@/lib/corporate-portal';

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

function nightsBetween(checkIn: string, checkOut: string) {
  return Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
}

function statusClass(status: string) {
  return String(status).toLowerCase().replaceAll('_', '-');
}

function guestName(row: any) {
  const name = `${row.primaryGuest?.firstName || ''} ${row.primaryGuest?.lastName || ''}`.trim();
  return name || 'Guest details pending';
}

export default async function CorporateReservationsPage() {
  const result = await corporateApi<any>('/api/v1/corporate/reservations');
  if (!result.ok) return <section className="portal-empty-state portal-page-error"><strong>Reservations are unavailable</strong><p>{result.error}</p></section>;
  const rows = result.data.reservations || [];
  const confirmed = rows.filter((row: any) => row.status === 'CONFIRMED').length;
  const pending = rows.filter((row: any) => row.status === 'PENDING').length;
  const upcoming = rows.filter((row: any) => new Date(row.checkIn) >= new Date()).length;

  return <>
    <section className="reservations-intro"><div><span className="portal-section-kicker">Corporate stays</span><h2>Reservations, at a glance.</h2><p>Keep every company stay organised, review guest information, and open a complete reservation record when you need more detail.</p></div><Link href="/corporate/book" className="portal-primary-action">＋ Arrange a new stay</Link></section>
    <div className="reservations-metrics"><div><span>All reservations</span><strong>{rows.length}</strong><small>Linked to your account</small></div><div><span>Upcoming stays</span><strong>{upcoming}</strong><small>Arrivals from today</small></div><div><span>Confirmed</span><strong>{confirmed}</strong><small>Ready for arrival</small></div><div><span>Awaiting confirmation</span><strong>{pending}</strong><small>Payment or review required</small></div></div>
    <section className="portal-panel reservations-list-panel"><div className="portal-panel-heading reservations-list-heading"><div><span className="portal-section-kicker">Stay register</span><h3>Your reservations</h3><p>Latest corporate bookings are shown first.</p></div><span className="reservations-list-count">{rows.length} record{rows.length === 1 ? '' : 's'}</span></div>{rows.length ? <div className="reservations-list">{rows.map((row: any) => { const roomCount = row.reservationRooms?.length || 0; const roomNames = row.reservationRooms?.map((room: any) => room.room?.number || 'Room assigned').join(', ') || 'Room assignment pending'; const total = Number(row.ratePlanSnapshot?.total || 0); return <article className="reservation-list-card" key={row.id}><div className="reservation-list-date"><strong>{new Date(row.checkIn).toLocaleDateString('en-NG', { day: '2-digit' })}</strong><span>{new Date(row.checkIn).toLocaleDateString('en-NG', { month: 'short' })}</span><small>{new Date(row.checkIn).getFullYear()}</small></div><div className="reservation-list-main"><div className="reservation-list-title"><div><span className="reservation-kicker">{row.confirmationNumber || 'Reservation record'}</span><h4>{guestName(row)}</h4></div><span className={`portal-status-pill ${statusClass(row.status)}`}>{String(row.status).replaceAll('_', ' ')}</span></div><div className="reservation-list-facts"><span><b>Stay</b>{dateLabel(row.checkIn)} – {dateLabel(row.checkOut)}</span><span><b>Rooms</b>{roomCount || '—'} · {roomNames}</span><span><b>Guests</b>{row.adults || 0} adults{row.children ? ` · ${row.children} children` : ''}</span></div></div><div className="reservation-list-value"><span>Total value</span><strong>{row.currency} {total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong><Link href={`/corporate/reservations/${row.id}`} className="reservation-details-link">View details <span aria-hidden="true">→</span></Link></div></article>; })}</div> : <div className="portal-empty-state"><span className="portal-empty-icon">✦</span><strong>No reservations yet</strong><p>Your next corporate stay will appear here.</p><Link href="/corporate/book" className="portal-text-link">Arrange your first stay <span aria-hidden="true">→</span></Link></div>}</section>
  </>;
}

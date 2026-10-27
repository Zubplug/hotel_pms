import Link from 'next/link';
import { corporateApi, getStanzelPropertyId } from '@/lib/corporate-portal';
import CorporateEventRequest from '@/components/corporate/CorporateEventRequest';

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
}

function statusClass(status: string) {
  return String(status).toLowerCase().replaceAll('_', '-');
}

function money(value: unknown, currency = 'NGN') {
  return `${currency} ${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
}

export default async function CorporateEventsPage() {
  const result = await corporateApi<any>('/api/v1/corporate/events');
  if (!result.ok) return <section className="portal-empty-state portal-page-error"><strong>Hall and event information is unavailable</strong><p>{result.error}</p></section>;

  const events = result.data.events || [];
  const leases = result.data.leases || [];
  const halls = result.data.halls || [];
  const upcomingEvents = events.filter((event: any) => new Date(event.startDate) >= new Date()).length;
  const activeLeases = leases.length;
  const propertyId = await getStanzelPropertyId();

  return <>
    <section className="corporate-events-intro"><div><span className="portal-section-kicker">Venue services</span><h2>Plan your next company event.</h2><p>Review your upcoming functions, recurring hall leases, and the event spaces available to your corporate account.</p></div>{propertyId && <CorporateEventRequest propertyId={propertyId} />}</section>

    <div className="corporate-events-metrics"><div><span>Upcoming events</span><strong>{upcomingEvents}</strong><small>Confirmed or planned functions</small></div><div><span>Active leases</span><strong>{activeLeases}</strong><small>Recurring venue agreements</small></div><div><span>Available halls</span><strong>{halls.length}</strong><small>Spaces at Stanzel Grand Resort</small></div></div>

    <section className="portal-panel corporate-events-panel"><div className="portal-panel-heading"><div><span className="portal-section-kicker">Your event calendar</span><h3>Upcoming events and hall bookings</h3><p>Event dates and function spaces linked to your company account.</p></div><span className="reservations-list-count">{events.length} record{events.length === 1 ? '' : 's'}</span></div>{events.length ? <div className="corporate-event-list">{events.map((event: any) => <article className="corporate-event-card" key={event.id}><div className="corporate-event-date"><strong>{new Date(event.startDate).toLocaleDateString('en-NG', { day: '2-digit' })}</strong><span>{new Date(event.startDate).toLocaleDateString('en-NG', { month: 'short' })}</span><small>{new Date(event.startDate).getFullYear()}</small></div><div className="corporate-event-main"><div className="corporate-event-title"><div><span className="reservation-kicker">{event.expectedGuests.toLocaleString()} expected guests</span><h4>{event.name}</h4></div><span className={`portal-status-pill ${statusClass(event.status)}`}>{String(event.status).replaceAll('_', ' ')}</span></div><div className="corporate-event-facts"><span><b>Schedule</b>{dateLabel(event.startDate)} – {dateLabel(event.endDate)}</span><span><b>Spaces</b>{event.bookings?.length ? event.bookings.map((booking: any) => `${booking.hall.name} · ${timeLabel(booking.startTime)}–${timeLabel(booking.endTime)}`).join(', ') : 'Hall assignment pending'}</span></div></div><div className="corporate-event-value"><span>Financial status</span><strong>{String(event.financialStatus || 'QUOTE').replaceAll('_', ' ')}</strong><small>{event.invoices?.length ? `${event.invoices.length} invoice${event.invoices.length === 1 ? '' : 's'}` : 'No invoice issued yet'}</small></div></article>)}</div> : <div className="portal-empty-state"><span className="portal-empty-icon">✦</span><strong>No upcoming events</strong><p>Your corporate hall bookings and events will appear here.</p>{propertyId && <CorporateEventRequest propertyId={propertyId} />}</div>}</section>

    <div className="corporate-events-lower-grid"><section className="portal-panel corporate-events-panel"><div className="portal-panel-heading"><div><span className="portal-section-kicker">Recurring venue use</span><h3>Hall leases</h3><p>Active lease and rental arrangements for your company.</p></div></div>{leases.length ? <div className="corporate-lease-list">{leases.map((lease: any) => <article className="corporate-lease-card" key={lease.id}><div className="corporate-lease-icon">⌂</div><div><h4>{lease.hall.name}</h4><p>{lease.hall.code} · {lease.usageFrequency.replaceAll('_', ' ').toLowerCase()} use · {lease.billingFrequency.replaceAll('_', ' ').toLowerCase()} billing</p><small>{dateLabel(lease.startDate)} – {dateLabel(lease.endDate)}{lease.startTime && lease.endTime ? ` · ${lease.startTime}–${lease.endTime}` : ''}</small></div><strong>{money(lease.rate, lease.currency)}</strong></article>)}</div> : <div className="corporate-events-empty">No active hall leases are linked to this account.</div>}</section><section className="portal-panel corporate-events-panel"><div className="portal-panel-heading"><div><span className="portal-section-kicker">Venue catalogue</span><h3>Available halls</h3><p>Tell our events team which space you would like to reserve.</p></div></div><div className="corporate-hall-list">{halls.map((hall: any) => <article className="corporate-hall-card" key={hall.id}><div><h4>{hall.name}</h4><p>{hall.code} · Capacity {hall.capacity.toLocaleString()}</p>{hall.amenities?.length > 0 && <small>{hall.amenities.slice(0, 3).join(' · ')}</small>}</div>{hall.rate != null && <strong>{money(hall.rate)}</strong>}</article>)}</div></section></div>
  </>;
}

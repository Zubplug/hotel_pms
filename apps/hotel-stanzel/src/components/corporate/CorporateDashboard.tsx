import Link from 'next/link';

function Arrow() {
  return <span aria-hidden="true" style={{ fontSize: 17 }}>↗</span>;
}

function MetricIcon({ type }: { type: 'account' | 'ledger' | 'stays' }) {
  const paths = type === 'account' ? <><circle cx="12" cy="8" r="3" /><path d="M5 20c.8-3.2 3.2-5 7-5s6.2 1.8 7 5" /></> : type === 'ledger' ? <><path d="M4 7.5h16v11H4z" /><path d="M4 11h16M8 15h3" /><path d="M7 7.5V5h10v2.5" /></> : <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6" /></>;
  return <span className="portal-metric-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths}</svg></span>;
}

export function CorporateDashboard({
  account,
  invoices,
  reservations,
}: {
  account: any;
  invoices: any[];
  reservations: any[];
}) {
  const outstanding = invoices.reduce((sum, row) => sum + Number(row.outstandingAmount || 0), 0);
  const recentReservations = [...reservations].slice(0, 4);

  return <>
    <section className="portal-welcome-banner"><div><span className="portal-welcome-kicker">Welcome back</span><h2>{account.name}</h2><p>Everything your team needs to arrange stays and keep corporate travel moving.</p></div><div className="portal-account-reference"><span>Account reference</span><strong>{account.code}</strong></div></section>
    <div className="portal-metrics-grid">
      <section className="portal-metric-card"><MetricIcon type="account" /><div><span>Account contact</span><strong>{account.contactEmail || 'Not recorded'}</strong><small>Primary company contact</small></div></section>
      <section className="portal-metric-card"><MetricIcon type="ledger" /><div><span>Outstanding balance</span><strong>{account.cityLedgerAccount?.currency || 'NGN'} {outstanding.toLocaleString()}</strong><small>{invoices.length} invoice{invoices.length === 1 ? '' : 's'} on City Ledger</small></div></section>
      <section className="portal-metric-card"><MetricIcon type="stays" /><div><span>Active reservations</span><strong>{reservations.length}</strong><small>Stays linked to your account</small></div></section>
    </div>
    <div className="portal-dashboard-grid">
      <section className="portal-panel portal-activity-panel"><div className="portal-panel-heading"><div><span className="portal-section-kicker">Your activity</span><h3>Recent reservations</h3></div><Link href="/corporate/reservations" className="portal-text-link">View all <Arrow /></Link></div>{recentReservations.length ? <div className="portal-reservation-list">{recentReservations.map((row: any) => <Link href="/corporate/reservations" className="portal-reservation-row" key={row.id}><span className="portal-reservation-date"><strong>{String(row.checkIn).slice(8, 10)}</strong><small>{new Date(row.checkIn).toLocaleString('en', { month: 'short' })}</small></span><span className="portal-reservation-info"><strong>{row.confirmationNumber || 'Corporate reservation'}</strong><small>{String(row.checkIn).slice(0, 10)} — {String(row.checkOut).slice(0, 10)}</small></span><span className={`portal-status-pill ${String(row.status).toLowerCase()}`}>{row.status}</span><Arrow /></Link>)}</div> : <div className="portal-empty-state"><span className="portal-empty-icon">✦</span><strong>No reservations yet</strong><p>Your next corporate stay will appear here.</p><Link href="/corporate/book" className="portal-text-link">Create a booking <Arrow /></Link></div>}</section>
      <section className="portal-panel portal-actions-panel"><div className="portal-panel-heading"><div><span className="portal-section-kicker">Shortcuts</span><h3>Move quickly</h3></div></div><div className="portal-quick-actions"><Link href="/corporate/book"><span className="portal-quick-icon gold">＋</span><span><strong>Arrange a new stay</strong><small>Check availability and reserve rooms</small></span><Arrow /></Link><Link href="/corporate/invoices"><span className="portal-quick-icon green">₦</span><span><strong>Review City Ledger</strong><small>View invoices and account balance</small></span><Arrow /></Link><Link href="/corporate/rates"><span className="portal-quick-icon cream">✦</span><span><strong>Request a rate</strong><small>Speak with our commercial team</small></span><Arrow /></Link></div></section>
    </div>
    <section className="portal-info-strip"><span className="portal-info-mark">i</span><div><strong>Connected to Stanzel Grand Resort</strong><p>Reservations, negotiated rates and City Ledger activity stay aligned with the PMS records used by our Front Desk team.</p></div><Link href="/corporate/rates" className="portal-text-link">Get in touch <Arrow /></Link></section>
  </>;
}

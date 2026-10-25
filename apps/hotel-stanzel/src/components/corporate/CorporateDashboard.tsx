import Link from 'next/link';

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

  return <>
    <p style={{ color: 'var(--text-muted)', maxWidth: 680 }}>Manage corporate stays, approved contract rates and City Ledger receivables through the same LodgeCore PMS records used by Stanzel front desk.</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginTop: 28 }}>
      <section className="card"><p className="eyebrow">Account</p><h2 style={{ margin: '8px 0' }}>{account.name}</h2><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{account.code} · {account.contactEmail || 'No contact email recorded'}</p></section>
      <section className="card"><p className="eyebrow">Ledger balance</p><h2 style={{ margin: '8px 0' }}>{account.cityLedgerAccount?.currency || 'NGN'} {outstanding.toLocaleString()}</h2><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{invoices.length} invoice(s)</p></section>
      <section className="card"><p className="eyebrow">Reservations</p><h2 style={{ margin: '8px 0' }}>{reservations.length}</h2><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>New stays reuse this account.</p></section>
    </div>
    <section className="card" style={{ marginTop: 18 }}><h2>Corporate controls</h2><p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>Room availability and negotiated pricing are resolved by the Corporate API. Financial posting remains in the PMS City Ledger and front-desk settlement workflow.</p><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}><Link href="/corporate/book" className="btn btn-primary">New booking</Link><Link href="/corporate/reservations" className="btn btn-outline-dark">View reservations</Link><Link href="/corporate/invoices" className="btn btn-outline-dark">View City Ledger</Link><Link href="/corporate/rates" className="btn btn-outline-dark">Request a rate</Link></div></section>
  </>;
}

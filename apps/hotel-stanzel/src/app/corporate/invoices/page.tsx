import Link from 'next/link';
import { corporateApi } from '@/lib/corporate-portal';

function dateLabel(value: string) { return new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }); }
function statusClass(status: string) { return String(status).toLowerCase().replaceAll('_', '-'); }

export default async function CorporateInvoicesPage() {
  const result = await corporateApi<any>('/api/v1/corporate/invoices');
  if (!result.ok) return <section className="portal-empty-state portal-page-error"><strong>Invoices are unavailable</strong><p>{result.error}</p></section>;
  const rows = result.data.invoices || [];
  const total = rows.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0);
  const outstanding = rows.reduce((sum: number, row: any) => sum + Number(row.outstandingAmount || 0), 0);
  const paid = rows.reduce((sum: number, row: any) => sum + Number(row.paidAmount || 0), 0);
  const currency = rows[0]?.currency || 'NGN';

  return <>
    <section className="invoice-workspace-intro"><div><span className="portal-section-kicker">Financial workspace</span><h2>Invoices, clearly organised.</h2><p>Review statements issued to your company, see what has been settled, and open a complete invoice record for your finance team.</p></div><Link href="/corporate/dashboard" className="portal-secondary-action">← Back to overview</Link></section>
    <div className="invoice-metrics"><div><span>Total invoiced</span><strong>{currency} {total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong><small>{rows.length} invoice{rows.length === 1 ? '' : 's'} issued</small></div><div><span>Outstanding</span><strong className="outstanding-balance">{currency} {outstanding.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong><small>Requires wallet credit</small></div><div><span>Paid to date</span><strong>{currency} {paid.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong><small>Receipts posted to City Ledger</small></div></div>
    <section className="portal-panel invoice-register"><div className="portal-panel-heading invoice-register-heading"><div><span className="portal-section-kicker">Invoice register</span><h3>Company invoices</h3><p>Open an invoice to view its full financial record and print a copy.</p></div><span className="reservations-list-count">{rows.length} record{rows.length === 1 ? '' : 's'}</span></div>{rows.length ? <div className="invoice-list">{rows.map((row: any) => <article className="invoice-list-card" key={row.id}><div className="invoice-list-icon">▤</div><div className="invoice-list-main"><div className="invoice-list-title"><div><span className="reservation-kicker">{row.invoiceNumber}</span><h4>{row.displayTitle || 'Corporate accommodation stay'}</h4><p className="invoice-list-context">{row.displayContext || 'Corporate account charge'}{row.description && !row.description.includes(row.displayContext || '___') ? ` · ${row.description.startsWith('Corporate folio') ? 'Accommodation charges' : row.description}` : ''}</p></div><span className={`invoice-status-pill ${statusClass(row.status)}`}>{String(row.status).replaceAll('_', ' ')}</span></div><div className="invoice-list-facts"><span><b>Issued</b>{dateLabel(row.issueDate)}</span><span><b>Due</b>{dateLabel(row.dueDate)}</span><span><b>Paid</b>{row.currency} {Number(row.paidAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span></div></div><div className="invoice-list-balance"><span>Balance due</span><strong>{row.currency} {Number(row.outstandingAmount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong><Link href={`/corporate/invoices/${row.id}`} className="invoice-details-link">View invoice <span aria-hidden="true">→</span></Link></div></article>)}</div> : <div className="portal-empty-state"><span className="portal-empty-icon">▤</span><strong>No invoices yet</strong><p>Corporate invoices issued by the resort will appear here.</p></div>}</section>
  </>;
}

'use client';

import { FormEvent, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

const label = (value: string) => value.replaceAll('_', ' ');
const money = (value: number, currency = 'NGN') => `${currency} ${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
const date = (value: string) => value ? new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function statusMessage(status: string) {
  if (status === 'COMPLETED') return 'Your refund has been completed by the payment provider.';
  if (status === 'PROCESSING') return 'Your refund has been submitted to the payment provider and is being processed.';
  if (status === 'APPROVED') return 'Your refund has been approved and is awaiting settlement.';
  if (status === 'REJECTED') return 'This refund request was declined. Please contact the property for assistance.';
  if (status === 'FAILED') return 'The payment provider could not complete this refund. Please contact the property.';
  if (status === 'CANCELLED') return 'This refund request was cancelled and is no longer active.';
  return 'Your refund is waiting for the required property approvals.';
}

function statusColor(status: string) {
  return status === 'COMPLETED' ? '#176b4d' : ['FAILED', 'REJECTED', 'CANCELLED'].includes(status) ? '#b42318' : '#9a6700';
}

export default function RefundStatusPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const response = await fetch(`/api/refund-status?query=${encodeURIComponent(query.trim())}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'No refund record was found.');
      setResult(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not check refund status.'); }
    finally { setLoading(false); }
  }

  return <><Header /><main id="main-content" style={{ paddingTop: 'calc(var(--nav-height) + var(--space-16))', minHeight: '75vh', background: 'var(--color-ivory-dark)' }}><div className="container" style={{ maxWidth: 980, paddingBlock: 'var(--space-12)' }}>
    <p className="eyebrow">Guest services</p><h1 style={{ margin: '8px 0 10px' }}>Track your refund</h1><p style={{ color: 'var(--text-muted)', maxWidth: 650 }}>Check the approval and payment-provider status of a reservation refund securely online.</p><span className="gold-divider" />
    <form onSubmit={search} style={{ marginTop: 32, background: 'var(--color-white)', border: '1px solid var(--border)', borderRadius: 18, padding: 28, maxWidth: 650 }}><h2 style={{ fontSize: 22, marginBottom: 8 }}>Find your refund</h2><p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 22 }}>Enter your reservation number or the guest email used for the booking.</p><div className="field"><label htmlFor="refund-query" className="field-label">Reservation number or email</label><input id="refund-query" className="field-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="RES-123456 or guest@email.com" autoComplete="email" required /></div>{error && <p style={{ color: '#b42318', fontSize: 14, marginTop: 16 }}>{error}</p>}<button className="btn btn-secondary btn-lg" disabled={loading} style={{ width: '100%', marginTop: 22 }}>{loading ? 'Checking securely…' : 'Check refund status'}</button></form>
    {result?.reservations?.map((reservation: any) => <section key={reservation.confirmationNumber} style={{ marginTop: 24, background: 'var(--color-white)', border: '1px solid var(--border)', borderRadius: 18, padding: 26 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'start' }}><div><p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 5 }}>Booking reference</p><h2 style={{ margin: 0 }}>{reservation.confirmationNumber}</h2><p style={{ color: 'var(--text-muted)', marginTop: 7 }}>{reservation.primaryGuest?.firstName} {reservation.primaryGuest?.lastName}</p></div><span style={{ borderRadius: 999, padding: '8px 14px', background: `${statusColor(reservation.status)}18`, color: statusColor(reservation.status), fontWeight: 700, fontSize: 13 }}>{label(reservation.status)}</span></div><div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>{reservation.refundRequests.map((refund: any) => <article key={refund.id} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'start' }}><strong>{money(refund.approvedAmount ?? refund.requestedAmount, refund.currency || reservation.currency)}</strong><span style={{ borderRadius: 999, padding: '5px 9px', background: `${statusColor(refund.status)}18`, color: statusColor(refund.status), fontSize: 11, fontWeight: 700 }}>{label(refund.status)}</span></div><p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '12px 0 4px' }}>{statusMessage(refund.status)}</p><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Method: {label(refund.approvedMethod || refund.requestedMethod || 'ORIGINAL_PAYMENT')}</p><p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Requested {date(refund.createdAt)}</p><div style={{ borderTop: '1px solid var(--border)', marginTop: 14, paddingTop: 14 }}><p style={{ fontSize: 12, fontWeight: 700, marginBottom: 9 }}>Refund timeline</p><div style={{ display: 'grid', gap: 7 }}>{refund.approvals.map((approval: any) => <div key={`${approval.stepOrder}-${approval.decidedAt}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}><span>{approval.stepOrder === 1 ? 'General Cashier' : approval.stepOrder === 2 ? 'Accountant' : 'General Management'} · {label(approval.decision)}</span><span style={{ color: 'var(--text-muted)' }}>{date(approval.decidedAt)}</span></div>)}{refund.status === 'PENDING_APPROVAL' && <div style={{ fontSize: 12, color: '#9a6700' }}>Next: property approval</div>}{['PROCESSING', 'COMPLETED'].includes(refund.status) && <div style={{ fontSize: 12, color: refund.status === 'COMPLETED' ? '#176b4d' : '#9a6700' }}>Payment provider · {label(refund.refund?.status || refund.status)}</div>}</div></div></article>)}</div></section>)}
  </div></main><Footer /><style>{`@media(max-width:700px){main section > div[style*="repeat(3, 1fr)"]{grid-template-columns:1fr!important}}`}</style></>;
}

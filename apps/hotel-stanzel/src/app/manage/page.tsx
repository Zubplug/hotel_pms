'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

type Reservation = any;

function ManagePageContent() {
  const params = useSearchParams();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [reference, setReference] = useState('');
  const [email, setEmail] = useState('');
  const [reservation, setReservation] = useState<Reservation>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancelled, setCancelled] = useState(false);

  async function loadReservation(event?: FormEvent) {
    event?.preventDefault(); setLoading(true); setError('');
    const query = new URLSearchParams(token.trim() ? { token: token.trim() } : { confirmationNumber: reference.trim(), email: email.trim() });
    try {
      const response = await fetch(`/api/manage?${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? 'Reservation could not be found.');
      setReservation(data); setCancelled(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load reservation.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (token) loadReservation(); }, []);

  async function cancelReservation() {
    setLoading(true); setError('');
    try {
      const body = token.trim() ? { cancelToken: token.trim(), reason: cancelReason.trim() || undefined } : { confirmationNumber: reference.trim(), guestEmail: email.trim(), reason: cancelReason.trim() || undefined };
      const response = await fetch('/api/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? 'Could not cancel this reservation.');
      setCancelled(true); setShowCancel(false); setReservation((current: any) => ({ ...current, status: 'CANCELLED', ...data }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not cancel reservation.'); }
    finally { setLoading(false); }
  }

  const money = (value: number) => `${reservation?.currency ?? 'NGN'} ${Number(value ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  const date = (value: string) => value ? new Date(value).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : '—';
  const statusColor = reservation?.status === 'CONFIRMED' ? '#176b4d' : reservation?.status === 'CANCELLED' ? '#b42318' : '#9a6700';

  return <><Header /><main id="main-content" style={{ paddingTop: 'calc(var(--nav-height) + var(--space-16))', minHeight: '75vh', background: 'var(--color-ivory-dark)' }}><div className="container" style={{ maxWidth: 1050, paddingBlock: 'var(--space-12)' }}>
    <p className="eyebrow">Guest services</p><h1 style={{ margin: '8px 0 10px' }}>Manage your stay</h1><p style={{ color: 'var(--text-muted)', maxWidth: 650 }}>View your reservation, check payment status, manage cancellation, request room assistance, and contact our team from one secure dashboard.</p><span className="gold-divider" />

    {!reservation && <form onSubmit={loadReservation} style={{ marginTop: 32, background: 'var(--color-white)', border: '1px solid var(--border)', borderRadius: 18, padding: 28, maxWidth: 650 }}><h2 style={{ fontSize: 22, marginBottom: 8 }}>Find your reservation</h2><p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 22 }}>Use the secure link from your email, or enter your booking reference and guest email.</p><div className="field"><label className="field-label">Cancellation token</label><input className="field-input" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste token from your booking email" /></div><div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: '14px 0', fontSize: 13 }}>or</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}><div className="field"><label className="field-label">Booking reference</label><input className="field-input" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. LC-123456" /></div><div className="field"><label className="field-label">Guest email</label><input className="field-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div></div>{error && <p style={{ color: '#b42318', fontSize: 14, marginTop: 16 }}>{error}</p>}<button className="btn btn-secondary btn-lg" disabled={loading} style={{ width: '100%', marginTop: 22 }}>{loading ? 'Securely checking…' : 'Open reservation dashboard'}</button></form>}

    {reservation && <><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 20, marginTop: 30, flexWrap: 'wrap' }}><div><p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 5 }}>Booking reference</p><h2 style={{ margin: 0 }}>{reservation.confirmationNumber}</h2></div><span style={{ borderRadius: 999, padding: '8px 14px', background: `${statusColor}18`, color: statusColor, fontWeight: 700, fontSize: 13 }}>{reservation.status}</span></div><div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginTop: 22 }}><section style={{ background: 'var(--color-white)', border: '1px solid var(--border)', borderRadius: 18, padding: 26 }}><h3 style={{ marginBottom: 18 }}>Stay overview</h3><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>{[['Guest', `${reservation.guest?.firstName ?? ''} ${reservation.guest?.lastName ?? ''}`], ['Room type', reservation.roomType ?? 'To be assigned'], ['Check-in', date(reservation.checkIn)], ['Check-out', date(reservation.checkOut)], ['Guests', `${reservation.adults} adult${reservation.adults === 1 ? '' : 's'}${reservation.children ? `, ${reservation.children} child${reservation.children === 1 ? '' : 'ren'}` : ''}`], ['Room number', reservation.roomNumber ? String(reservation.roomNumber).split('.').pop() : 'To be assigned']].map(([label, value]) => <div key={label}><p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>{label}</p><strong>{value}</strong></div>)}</div></section><section style={{ background: 'var(--color-green)', color: 'var(--color-ivory)', borderRadius: 18, padding: 26 }}><h3 style={{ color: 'var(--color-gold)', marginBottom: 18 }}>Payment</h3><p style={{ color: 'rgba(250,248,244,.65)', fontSize: 13 }}>Total reservation</p><h2 style={{ color: 'var(--color-gold)', margin: '4px 0 18px' }}>{money(reservation.total)}</h2><p style={{ fontSize: 14 }}>Paid: <strong>{money(reservation.paidAmount)}</strong></p><p style={{ fontSize: 14 }}>Balance: <strong>{money(reservation.balance)}</strong></p><p style={{ marginTop: 18, fontSize: 12, color: 'rgba(250,248,244,.7)' }}>{reservation.paymentStatus}</p></section></div>
    <section style={{ marginTop: 18, background: 'var(--color-white)', border: '1px solid var(--border)', borderRadius: 18, padding: 26 }}><h3 style={{ marginBottom: 8 }}>Guest services</h3><p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>Need help before arrival? Choose an action below.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}><div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}><strong>{reservation.roomNumber ? 'Room assigned' : 'Room assignment'}</strong><p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '8px 0 14px' }}>{reservation.roomNumber ? `Your room is ${String(reservation.roomNumber).split('.').pop()}.` : 'The property will assign your room before check-in.'}</p><a className="btn btn-outline-dark" href="mailto:info@stanzelgrandresort.org?subject=Room%20assignment%20request">Contact property</a></div><div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}><strong>Extend your stay</strong><p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '8px 0 14px' }}>Request additional nights and receive a payment quote.</p><a className="btn btn-outline-dark" href={`mailto:info@stanzelgrandresort.org?subject=Extend%20booking%20${reservation.confirmationNumber}`}>Request extension</a></div><div style={{ border: '1px solid rgba(180,35,24,.2)', borderRadius: 12, padding: 16 }}><strong>Cancel reservation</strong><p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '8px 0 14px' }}>Cancellation policy and refund rules apply.</p><button className="btn btn-outline-dark" onClick={() => setShowCancel(true)} disabled={!reservation.canCancel || cancelled}>{cancelled ? 'Cancelled' : reservation.canCancel ? 'Start cancellation' : 'Not available'}</button></div></div></section>
    {showCancel && <div style={{ marginTop: 18, background: '#fff8ed', border: '1px solid #ead7b2', borderRadius: 16, padding: 22 }}><h3>Confirm cancellation</h3><p style={{ color: 'var(--text-muted)', fontSize: 14 }}>A cancellation charge may apply. Any eligible refund will follow the property policy.</p><textarea className="field-input" rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Reason for cancellation (optional)" style={{ margin: '14px 0' }} /><button className="btn btn-primary" onClick={cancelReservation} disabled={loading} style={{ background: '#b42318', borderColor: '#b42318' }}>{loading ? 'Processing…' : 'Confirm cancellation'}</button> <button className="btn btn-outline-dark" onClick={() => setShowCancel(false)}>Keep reservation</button></div>}
    {error && <p style={{ color: '#b42318', marginTop: 18 }}>{error}</p>}<div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}><button className="btn btn-outline-dark" onClick={() => setReservation(null)}>Use different booking</button><Link href="/contact" className="btn btn-secondary">Contact guest services</Link></div></>}
  </div></main><Footer /><style>{`@media(max-width:700px){form > div[style*="grid-template-columns: 1fr 1fr"],main section > div[style*="grid-template-columns: 2fr 1fr"],main section > div[style*="repeat(3, 1fr)"]{grid-template-columns:1fr!important}}`}</style></>;
}

export default function ManagePage() { return <Suspense fallback={<div style={{ padding: 80, textAlign: 'center' }}>Loading reservation portal…</div>}><ManagePageContent /></Suspense>; }

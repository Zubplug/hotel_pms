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
  const [accessDetails, setAccessDetails] = useState('');
  const [reservation, setReservation] = useState<Reservation>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancel, setShowCancel] = useState(false);
  const [cancellationQuote, setCancellationQuote] = useState<any>(null);
  const [cancellationLoading, setCancellationLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [extensionDate, setExtensionDate] = useState('');
  const [extensionLoading, setExtensionLoading] = useState(false);
  const [extensionError, setExtensionError] = useState('');

  async function loadReservation(event?: FormEvent) {
    event?.preventDefault(); setLoading(true); setError('');
    const value = (token || accessDetails).trim();
    const query = new URLSearchParams();
    if (token) query.set('token', value);
    else if (value.includes('|') || value.includes(',')) setError('Enter one reservation number or one guest email, not both.');
    else if (value.includes('@')) query.set('email', value);
    else query.set('confirmationNumber', value);
    if (!query.toString()) { setLoading(false); return; }
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
      const value = (token || accessDetails).trim();
      const body = token
        ? { cancelToken: value }
        : value.includes('@')
        ? { guestEmail: value, reason: cancelReason.trim() || undefined }
        : { confirmationNumber: value, reason: cancelReason.trim() || undefined };
      const response = await fetch('/api/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? 'Could not cancel this reservation.');
      setCancelled(true); setShowCancel(false); setReservation((current: any) => ({ ...current, status: 'CANCELLED', ...data }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not cancel reservation.'); }
    finally { setLoading(false); }
  }

  async function openCancellation() {
    setCancellationLoading(true); setError('');
    try {
      const value = (token || accessDetails).trim();
      const body = token ? { cancelToken: value } : value.includes('@') ? { guestEmail: value } : { confirmationNumber: value };
      const response = await fetch('/api/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, preview: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? 'Cancellation quote is unavailable.');
      setCancellationQuote(data); setShowCancel(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Cancellation quote is unavailable.'); }
    finally { setCancellationLoading(false); }
  }

  async function startExtension() {
    if (!extensionDate || !reservation?.confirmationNumber || !reservation?.guest?.email) return;
    setExtensionLoading(true); setExtensionError('');
    try {
      const response = await fetch('/api/extend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmationNumber: reservation.confirmationNumber, guestEmail: reservation.guest.email, newCheckOut: extensionDate }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? 'Could not calculate extension payment.');
      window.location.href = data.authorizationUrl;
    } catch (e) { setExtensionError(e instanceof Error ? e.message : 'Could not start extension payment.'); setExtensionLoading(false); }
  }

  const money = (value: number) => `${reservation?.currency ?? 'NGN'} ${Number(value ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  const date = (value: string) => value ? new Date(value).toLocaleDateString('en-NG', { dateStyle: 'medium' }) : '—';
  const statusColor = reservation?.status === 'CONFIRMED' ? '#176b4d' : reservation?.status === 'CANCELLED' ? '#b42318' : '#9a6700';

  return <><Header /><main id="main-content" style={{ paddingTop: 'calc(var(--nav-height) + var(--space-16))', minHeight: '75vh', background: 'var(--color-ivory-dark)' }}><div className="container" style={{ maxWidth: 1050, paddingBlock: 'var(--space-12)' }}>
    <p className="eyebrow">Guest services</p><h1 style={{ margin: '8px 0 10px' }}>Manage your stay</h1><p style={{ color: 'var(--text-muted)', maxWidth: 650 }}>View your reservation, check payment status, manage cancellation, request room assistance, and contact our team from one secure dashboard.</p><span className="gold-divider" />

    {!reservation && <form onSubmit={loadReservation} style={{ marginTop: 32, background: 'var(--color-white)', border: '1px solid var(--border)', borderRadius: 18, padding: 28, maxWidth: 650 }}><h2 style={{ fontSize: 22, marginBottom: 8 }}>Find your reservation</h2><p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 22 }}>Enter either your reservation number or the guest email used for the booking.</p><div className="field"><label htmlFor="reservation-access" className="field-label">Reservation number or email</label><input id="reservation-access" className="field-input" value={token || accessDetails} onChange={e => { setToken(''); setAccessDetails(e.target.value); }} placeholder="LC-123456 or guest@email.com" autoComplete="email" required /></div>{error && <p style={{ color: '#b42318', fontSize: 14, marginTop: 16 }}>{error}</p>}<button className="btn btn-secondary btn-lg" disabled={loading} style={{ width: '100%', marginTop: 22 }}>{loading ? 'Securely checking…' : 'Open reservation dashboard'}</button></form>}

    {reservation && <><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 20, marginTop: 30, flexWrap: 'wrap' }}><div><p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 5 }}>Booking reference</p><h2 style={{ margin: 0 }}>{reservation.confirmationNumber}</h2></div><span style={{ borderRadius: 999, padding: '8px 14px', background: `${statusColor}18`, color: statusColor, fontWeight: 700, fontSize: 13 }}>{reservation.status}</span></div><div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginTop: 22 }}><section style={{ background: 'var(--color-white)', border: '1px solid var(--border)', borderRadius: 18, padding: 26 }}><h3 style={{ marginBottom: 18 }}>Stay overview</h3><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>{[['Guest', `${reservation.guest?.firstName ?? ''} ${reservation.guest?.lastName ?? ''}`], ['Room type', reservation.roomType ?? 'To be assigned'], ['Check-in', date(reservation.checkIn)], ['Check-out', date(reservation.checkOut)], ['Guests', `${reservation.adults} adult${reservation.adults === 1 ? '' : 's'}${reservation.children ? `, ${reservation.children} child${reservation.children === 1 ? '' : 'ren'}` : ''}`], ['Room number', reservation.roomNumber ? String(reservation.roomNumber).split('.').pop() : 'To be assigned']].map(([label, value]) => <div key={label}><p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>{label}</p><strong>{value}</strong></div>)}</div></section><section style={{ background: 'var(--color-green)', color: 'var(--color-ivory)', borderRadius: 18, padding: 26 }}><h3 style={{ color: 'var(--color-gold)', marginBottom: 18 }}>Payment</h3><p style={{ color: 'rgba(250,248,244,.65)', fontSize: 13 }}>Total reservation</p><h2 style={{ color: 'var(--color-gold)', margin: '4px 0 18px' }}>{money(reservation.total)}</h2><p style={{ fontSize: 14 }}>Paid: <strong>{money(reservation.paidAmount)}</strong></p><p style={{ fontSize: 14 }}>Balance: <strong>{money(reservation.balance)}</strong></p><p style={{ marginTop: 18, fontSize: 12, color: 'rgba(250,248,244,.7)' }}>{reservation.paymentStatus}</p></section></div>
    <section style={{ marginTop: 18, background: 'var(--color-white)', border: '1px solid var(--border)', borderRadius: 18, padding: 26 }}><h3 style={{ marginBottom: 8 }}>Guest services</h3><p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>Need help before arrival? Choose an action below.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}><div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}><strong>{reservation.roomNumber ? 'Room assigned' : 'Room assignment'}</strong><p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '8px 0 14px' }}>{reservation.roomNumber ? `Your room is ${String(reservation.roomNumber).split('.').pop()}.` : 'The property will assign your room before check-in.'}</p><a className="btn btn-outline-dark" href="mailto:info@stanzelgrandresort.org?subject=Room%20assignment%20request">Contact property</a></div><div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}><strong>Extend your stay</strong><p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '8px 0 14px' }}>Choose a new check-out date and pay securely online.</p><input type="date" className="field-input" value={extensionDate} min={reservation.checkOut?.slice(0, 10)} onChange={e => setExtensionDate(e.target.value)} style={{ marginBottom: 10 }} /><button className="btn btn-outline-dark" onClick={startExtension} disabled={!extensionDate || extensionLoading}>{extensionLoading ? 'Opening payment…' : 'Pay for extension'}</button>{extensionError && <p style={{ color: '#b42318', fontSize: 12, marginTop: 8 }}>{extensionError}</p>}</div><div style={{ border: '1px solid rgba(180,35,24,.2)', borderRadius: 12, padding: 16 }}><strong>Cancel reservation</strong><p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '8px 0 14px' }}>Cancellation policy and refund rules apply.</p><button className="btn btn-outline-dark" onClick={openCancellation} disabled={!reservation.canCancel || cancelled || cancellationLoading}>{cancellationLoading ? 'Calculating…' : cancelled ? 'Cancelled' : reservation.canCancel ? 'Start cancellation' : 'Not available'}</button></div></div></section>
    {showCancel && <div style={{ marginTop: 18, background: '#fff8ed', border: '1px solid #ead7b2', borderRadius: 16, padding: 22 }}><h3>Confirm cancellation</h3><p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Review the policy result before cancelling. This action cannot be undone.</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, margin: '14px 0', fontSize: 14 }}><div>Reservation total<br /><strong>{money(cancellationQuote?.reservationAmount)}</strong></div><div>Cancellation fee<br /><strong>{money(cancellationQuote?.penaltyAmount)}</strong></div><div>Expected refund<br /><strong>{money(cancellationQuote?.refundableAmount)}</strong></div><div>Refund method<br /><strong>{cancellationQuote?.refundMethod?.replaceAll('_', ' ')}</strong></div></div><p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{cancellationQuote?.penaltyDescription}. {cancellationQuote?.estimatedProcessingTime}</p><textarea className="field-input" rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Reason for cancellation (optional)" style={{ margin: '14px 0' }} /><button className="btn btn-primary" onClick={cancelReservation} disabled={loading} style={{ background: '#b42318', borderColor: '#b42318' }}>{loading ? 'Processing…' : 'Confirm cancellation'}</button> <button className="btn btn-outline-dark" onClick={() => setShowCancel(false)}>Keep reservation</button></div>}
    {error && <p style={{ color: '#b42318', marginTop: 18 }}>{error}</p>}<div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}><button className="btn btn-outline-dark" onClick={() => setReservation(null)}>Use different booking</button><Link href="/contact" className="btn btn-secondary">Contact guest services</Link></div></>}
  </div></main><Footer /><style>{`@media(max-width:700px){form > div[style*="grid-template-columns: 1fr 1fr"],main section > div[style*="grid-template-columns: 2fr 1fr"],main section > div[style*="repeat(3, 1fr)"]{grid-template-columns:1fr!important}}`}</style></>;
}

export default function ManagePage() { return <Suspense fallback={<div style={{ padding: 80, textAlign: 'center' }}>Loading reservation portal…</div>}><ManagePageContent /></Suspense>; }

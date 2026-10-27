'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type PaymentState = 'loading' | 'pending' | 'confirmed' | 'failed' | 'expired' | 'missing' | 'error';

export default function CorporatePaymentReturnClient() {
  const searchParams = useSearchParams();
  const reservationId = searchParams.get('reservationId');
  const eventId = searchParams.get('eventId');
  const reference = searchParams.get('reference');
  const [state, setState] = useState<PaymentState>(reservationId || eventId ? 'loading' : 'missing');
  const [confirmationNumber, setConfirmationNumber] = useState('');
  const [message, setMessage] = useState('Checking your reservation and payment confirmation…');

  const statusLabel = useMemo(() => ({
    loading: 'Checking payment',
    pending: 'Payment processing',
    confirmed: 'Payment confirmed',
    failed: 'Payment not completed',
    expired: 'Payment window expired',
    missing: 'Payment return incomplete',
    error: 'Unable to verify payment',
  }[state]), [state]);

  useEffect(() => {
    if (!reservationId && !eventId) return;
    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      try {
        const response = await fetch(eventId ? `/api/corporate/events/${encodeURIComponent(eventId)}` : `/api/corporate/booking/${encodeURIComponent(reservationId!)}`, { cache: 'no-store' });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'The reservation could not be found.');
        if (!active) return;
        const status = String(body.status || '').toUpperCase();
        setConfirmationNumber(body.confirmationNumber || '');
        if (status === 'CONFIRMED') {
          setState('confirmed');
          setMessage(eventId ? 'Your payment has been verified and your corporate hall booking is confirmed.' : 'Your payment has been verified and your corporate reservation is confirmed.');
          return;
        }
        if (['CANCELLED', 'EXPIRED'].includes(status)) {
          setState('expired');
          setMessage('This reservation payment window is no longer active. Please start a new booking if you still need these rooms.');
          return;
        }
        if ((eventId ? ['TENTATIVE', 'INQUIRY', 'PENDING'] : ['PENDING', 'PROCESSING']).includes(status) && attempts < 15) {
          attempts += 1;
          setState('pending');
          setMessage('Your payment is being verified. This usually takes only a few seconds.');
          timer = setTimeout(check, 2000);
          return;
        }
        setState(status === 'PENDING' ? 'pending' : 'failed');
        setMessage((eventId ? ['TENTATIVE', 'INQUIRY', 'PENDING'] : ['PENDING']).includes(status) ? 'Payment is still being verified. You can check Hall & Events shortly.' : 'The booking was not confirmed. Please check your payment or try again.');
      } catch (error) {
        if (!active) return;
        setState('error');
        setMessage(error instanceof Error ? error.message : 'The payment status could not be verified.');
      }
    };

    void check();
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [reservationId, eventId, reference]);

  const isSuccess = state === 'confirmed';
  const isPending = state === 'loading' || state === 'pending';

  return <main className="corporate-payment-return"><section className={`corporate-payment-card is-${state}`}>
    <div className="corporate-payment-mark" aria-hidden="true">{isSuccess ? '✓' : isPending ? '…' : '!'}</div>
    <span className="booking-section-kicker">{eventId ? 'Corporate hall & event' : 'Corporate reservation'}</span>
    <h1>{statusLabel}</h1>
    <p>{message}</p>
    {confirmationNumber && <div className="corporate-payment-reference"><span>Confirmation number</span><strong>{confirmationNumber}</strong></div>}
    {reference && <small className="corporate-payment-provider-reference">Payment reference: {reference}</small>}
    <div className="corporate-payment-actions"><Link className="booking-primary-button" href="/corporate/reservations">View reservations</Link>{!isSuccess && <Link className="booking-secondary-button" href="/corporate/book">Return to booking</Link>}</div>
  </section></main>;
}

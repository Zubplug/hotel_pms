import { Suspense } from 'react';
import CorporatePaymentReturnClient from './CorporatePaymentReturnClient';

export default function CorporatePaymentReturnPage() {
  return <Suspense fallback={<main className="corporate-payment-return"><section className="corporate-payment-card is-loading"><div className="corporate-payment-mark" aria-hidden="true">…</div><span className="booking-section-kicker">Corporate reservation</span><h1>Checking payment</h1><p>Checking your reservation and payment confirmation…</p></section></main>}><CorporatePaymentReturnClient /></Suspense>;
}

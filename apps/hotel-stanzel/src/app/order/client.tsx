'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/lib/cart-context';
import { placeOrder, initiatePayment, validatePromo, COMMERCE_SLUG } from '@/lib/commerce';

function fmt(amount: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 0 }).format(Number(amount) || 0);
}

function generateKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type Step = 'details' | 'review' | 'payment';

export function CheckoutClient() {
  const router = useRouter();
  const { state, updateQty, removeItem, setPromo, clearCart, subtotal, itemCount } = useCart();
  const isOutdoor = state.serviceMode === 'OUTDOOR';

  const [step, setStep] = useState<Step>('details');
  const [form, setForm] = useState({
    name: '', phone: '', email: '',
    orderType: state.orderType as string,
    deliveryAddress: '', serviceArea: '', notes: '',
  });
  const [promoInput, setPromoInput] = useState('');
  const [promoMsg, setPromoMsg] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOutdoor) setForm(current => ({ ...current, orderType: 'DELIVERY' }));
  }, [isOutdoor]);

  const deliveryFee = form.orderType === 'DELIVERY' ? 1500 : 0;
  const finalTotal = subtotal + deliveryFee - promoDiscount;

  // ── Empty cart guard ──
  if (itemCount === 0) {
    return (
      <div className="checkout-empty">
        <div className="empty-icon">🛒</div>
        <h2>Your order is empty</h2>
        <p>Browse our menu and add something delicious.</p>
        <Link href={isOutdoor ? '/outdoor-service' : '/dining'} className="btn btn-primary">View Menu</Link>
      </div>
    );
  }

  async function applyPromo() {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoMsg('');
    try {
      const result = await validatePromo({ code: promoInput.trim(), orderSubtotal: subtotal });
      if (result.valid) {
        setPromoDiscount(result.discountAmount);
        setPromo(promoInput.trim(), result.discountAmount);
        setPromoMsg(`✓ ${result.discountType === 'PERCENTAGE' ? `${result.discountValue}% off` : `${fmt(result.discountAmount)} off`} applied!`);
      } else {
        setPromoMsg(result.message ?? 'Invalid promo code.');
        setPromoDiscount(0);
      }
    } catch { setPromoMsg('Could not validate promo code.'); }
    finally { setPromoLoading(false); }
  }

  async function handlePlaceOrder() {
    setLoading(true);
    setError('');
    try {
      const effectiveOrderType = isOutdoor ? 'DELIVERY' : form.orderType;
      const order = await placeOrder({
        customer: { name: form.name, phone: form.phone, email: form.email || undefined },
        orderType: effectiveOrderType as 'PICKUP' | 'DELIVERY',
        deliveryAddress: effectiveOrderType === 'DELIVERY' ? { street: form.deliveryAddress, city: 'Abuja', notes: form.serviceArea || undefined } : undefined,
        deliveryNotes: effectiveOrderType === 'DELIVERY' ? form.notes || undefined : undefined,
        specialInstructions: form.notes || undefined,
        promotionCode: state.promoCode || undefined,
        idempotencyKey: generateKey(),
        items: state.items.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          modifierOptionIds: i.modifierOptionIds,
          specialNote: i.notes,
        })),
      });

      // Store tracking info in sessionStorage for the payment callback
      sessionStorage.setItem('stanzel-order-ref', order.orderRef);
      sessionStorage.setItem('stanzel-order-token', order.trackingToken);

      // Initiate payment
      const callbackUrl = `${window.location.origin}/order/${order.orderRef}?token=${order.trackingToken}`;
      const payment = await initiatePayment({
        orderRef: order.orderRef,
        trackingToken: order.trackingToken,
        callbackUrl,
      });

      clearCart();
      // Redirect to Paystack
      window.location.href = payment.checkoutUrl;
    } catch (err: any) {
      setError(err.message ?? 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="checkout-page">
      <div className="checkout-hero">
        <div className="container checkout-hero__inner">
          <div>
            <p className="checkout-hero__eyebrow">Stanzel Grand Resort · {isOutdoor ? 'Outdoor Service' : 'Food & Beverage'}</p>
            <h1>Complete your order</h1>
            <p>Review your selections, share where to serve you, and continue securely.</p>
          </div>
          <span className="checkout-hero__count">{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="checkout-progress">
        <div className="container checkout-progress__inner">
          {(['details', 'review', 'payment'] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              <div className={`progress-step${step === s ? ' active' : ''} ${
                (step === 'review' && i === 0) || step === 'payment' ? 'done' : ''
              }`}>
                <span className="progress-step__num">{i + 1}</span>
                <span className="progress-step__label">{s.charAt(0).toUpperCase() + s.slice(1)}</span>
              </div>
              {i < 2 && <div className="progress-line" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="container checkout-grid">
        {/* ── Left: form steps ── */}
        <div className="checkout-form-col">
          {step === 'details' && (
            <div className="checkout-card">
              <h2 className="checkout-card__title">Your Details</h2>

              {isOutdoor ? (
                <div className="outdoor-checkout-notice">
                  <span className="outdoor-checkout-notice__icon" aria-hidden>✦</span>
                  <div>
                    <strong>Outdoor service delivery</strong>
                    <p>Your order will be prepared by the team and delivered to the service address below.</p>
                  </div>
                </div>
              ) : (
                <div className="order-type-tabs">
                  {['PICKUP', 'DELIVERY'].map(t => (
                    <button
                      key={t}
                      className={`order-type-tab${form.orderType === t ? ' active' : ''}`}
                      onClick={() => setForm(f => ({ ...f, orderType: t }))}
                    >
                      {t === 'PICKUP' ? '🏃 Pickup' : '🚗 Delivery'}
                    </button>
                  ))}
                </div>
              )}

              <div className="form-grid">
                <label className="form-label">
                  Full Name *
                  <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Adeyemi Femi" />
                </label>
                <label className="form-label">
                  Phone Number *
                  <input className="form-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+234 801 234 5678" type="tel" />
                </label>
                <label className="form-label" style={{ gridColumn: '1 / -1' }}>
                  Email (optional — for receipt)
                  <input className="form-input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" type="email" />
                </label>
                {form.orderType === 'DELIVERY' && (
                  <>
                    <label className="form-label" style={{ gridColumn: '1 / -1' }}>
                      {isOutdoor ? 'Poolside / outdoor service address *' : 'Delivery Address *'}
                      <input className="form-input" value={form.deliveryAddress} onChange={e => setForm(f => ({ ...f, deliveryAddress: e.target.value }))} placeholder={isOutdoor ? 'Pool deck, cabana 2, or your exact service point' : 'Room 203, Stanzel Grand Resort or street address'} />
                    </label>
                    {isOutdoor && (
                      <label className="form-label" style={{ gridColumn: '1 / -1' }}>
                        Area details (optional)
                        <input className="form-input" value={form.serviceArea} onChange={e => setForm(f => ({ ...f, serviceArea: e.target.value }))} placeholder="Poolside, terrace, cabana, table or lounger" />
                      </label>
                    )}
                  </>
                )}
                <label className="form-label" style={{ gridColumn: '1 / -1' }}>
                  {isOutdoor ? 'Delivery instructions (optional)' : 'Order Notes (optional)'}
                  <textarea className="form-input form-textarea" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Allergies, delivery instructions…" rows={2} />
                </label>
              </div>

              <button
                className="btn-checkout-next"
                disabled={!form.name || !form.phone || (form.orderType === 'DELIVERY' && !form.deliveryAddress)}
                onClick={() => setStep('review')}
              >
                Review Order →
              </button>
            </div>
          )}

          {step === 'review' && (
            <div className="checkout-card">
              <button className="back-btn" onClick={() => setStep('details')}>← Back</button>
              <h2 className="checkout-card__title">Review &amp; Confirm</h2>

              {/* Cart items */}
              <div className="review-items">
                {state.items.map(item => (
                  <div key={item.id} className="review-item">
                    <div className="review-item__image">
                      {item.imageUrl ? (
                        <Image src={item.imageUrl} alt="" width={64} height={64} sizes="64px" style={{ objectFit: 'contain' }} />
                      ) : <span aria-hidden>🍽</span>}
                    </div>
                    <div className="review-item__info">
                      <p className="review-item__name">{item.productName}</p>
                      {item.modifierLabels.length > 0 && (
                        <p className="review-item__mods">{item.modifierLabels.join(', ')}</p>
                      )}
                    </div>
                    <div className="review-item__controls">
                      <button className="qty-btn-sm" onClick={() => updateQty(item.id, item.quantity - 1)}>−</button>
                      <span className="review-item__qty">{item.quantity}</span>
                      <button className="qty-btn-sm" onClick={() => updateQty(item.id, item.quantity + 1)}>+</button>
                    </div>
                    <span className="review-item__price">{fmt(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>

              {/* Promo code */}
              <div className="promo-row">
                <input
                  className="form-input promo-input"
                  placeholder="Promo code"
                  value={promoInput}
                  onChange={e => setPromoInput(e.target.value)}
                />
                <button className="promo-btn" onClick={applyPromo} disabled={promoLoading}>
                  {promoLoading ? '…' : 'Apply'}
                </button>
              </div>
              {promoMsg && <p className={`promo-msg${promoDiscount > 0 ? ' promo-msg--success' : ' promo-msg--error'}`}>{promoMsg}</p>}

              <div className="order-summary">
                <div className="summary-row"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                {deliveryFee > 0 && <div className="summary-row"><span>Delivery</span><span>{fmt(deliveryFee)}</span></div>}
                {promoDiscount > 0 && <div className="summary-row summary-row--discount"><span>Discount</span><span>−{fmt(promoDiscount)}</span></div>}
                <div className="summary-row summary-row--total"><span>Total</span><span>{fmt(finalTotal)}</span></div>
              </div>

              {error && <p className="checkout-error">{error}</p>}

              <button
                className="btn-checkout-next"
                onClick={handlePlaceOrder}
                disabled={loading}
              >
                {loading ? 'Processing…' : `Pay ${fmt(finalTotal)} →`}
              </button>
            </div>
          )}
        </div>

        {/* ── Right: order summary sidebar ── */}
        <aside className="checkout-summary">
          <div className="checkout-card">
            <h3 className="summary-title">Your Order</h3>
            <p className="summary-type">{isOutdoor ? '✦ Outdoor service' : form.orderType === 'DELIVERY' ? '🚗 Delivery' : '🏃 Pickup'}</p>
            {state.items.map(i => (
              <div key={i.id} className="summary-item">
                <span className="summary-item__qty">{i.quantity}×</span>
                <span className="summary-item__name">{i.productName}</span>
                <span className="summary-item__price">{fmt(i.unitPrice * i.quantity)}</span>
              </div>
            ))}
            <div className="summary-divider" />
            <div className="summary-row summary-row--total">
              <span>Total</span>
              <span>{fmt(finalTotal)}</span>
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        .checkout-page {
          background: #0d2b22;
          color: var(--color-ivory);
          min-height: 100vh;
          padding-top: var(--nav-height, 70px);
          padding-bottom: var(--space-20);
        }

        .checkout-hero {
          border-bottom: 1px solid rgba(201,169,110,0.16);
          background: radial-gradient(circle at 80% 0%, rgba(201,169,110,0.14), transparent 36%), #0d2b22;
        }
        .checkout-hero__inner {
          display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-6);
          padding-top: var(--space-12); padding-bottom: var(--space-8);
        }
        .checkout-hero__eyebrow {
          color: var(--color-gold); font-size: 0.68rem; font-weight: 800;
          letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: var(--space-3);
        }
        .checkout-hero h1 {
          color: var(--color-ivory); font-family: var(--font-serif);
          font-size: clamp(2rem, 4vw, 3.2rem); font-weight: 400; line-height: 1.05;
        }
        .checkout-hero p:not(.checkout-hero__eyebrow) { color: rgba(250,248,244,0.58); margin-top: var(--space-3); font-size: var(--text-sm); }
        .checkout-hero__count {
          border: 1px solid rgba(201,169,110,0.35); border-radius: 999px;
          color: var(--color-gold); padding: 9px 15px; font-size: var(--text-sm); font-weight: 700; white-space: nowrap;
        }
        @media (max-width: 600px) { .checkout-hero__inner { align-items: flex-start; flex-direction: column; padding-top: var(--space-8); } }

        .checkout-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: var(--space-4); text-align: center; color: var(--color-ivory); }
        .empty-icon { font-size: 4rem; }

        .checkout-progress { background: rgba(7,24,19,0.78); border-bottom: 1px solid rgba(201,169,110,0.12); padding: var(--space-5) 0; }
        .checkout-progress__inner { display: flex; align-items: center; justify-content: center; gap: var(--space-4); }
        .progress-step { display: flex; align-items: center; gap: var(--space-2); }
        .progress-step__num { width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.08); color: rgba(250,248,244,0.55); display: flex; align-items: center; justify-content: center; font-size: var(--text-xs); font-weight: 700; }
        .progress-step.active .progress-step__num { background: var(--color-green); color: white; }
        .progress-step.done .progress-step__num { background: var(--color-gold); color: var(--color-green); }
        .progress-step__label { font-size: var(--text-sm); font-weight: 500; color: rgba(250,248,244,0.45); }
        .progress-step.active .progress-step__label { color: var(--color-gold); font-weight: 700; }
        .progress-line { flex: 1; max-width: 60px; height: 1px; background: rgba(201,169,110,0.22); }

        .checkout-grid { display: grid; grid-template-columns: 1fr 360px; gap: var(--space-8); padding-top: var(--space-10); }
        @media (max-width: 900px) { .checkout-grid { grid-template-columns: 1fr; } .checkout-summary { order: -1; } }

        .checkout-card { background: rgba(255,255,255,0.045); border: 1px solid rgba(201,169,110,0.16); border-radius: var(--radius-2xl); padding: var(--space-8); box-shadow: 0 18px 60px rgba(0,0,0,0.18); }
        .checkout-card__title { font-family: var(--font-serif); font-size: var(--text-2xl); color: var(--color-ivory); margin-bottom: var(--space-6); }

        .order-type-tabs { display: flex; gap: var(--space-3); margin-bottom: var(--space-6); }
        .order-type-tab { flex: 1; padding: var(--space-3); border: 1.5px solid rgba(255,255,255,0.12); border-radius: var(--radius-lg); background: rgba(255,255,255,0.04); color: rgba(250,248,244,0.72); cursor: pointer; font-weight: 600; font-size: var(--text-sm); transition: all 0.18s; }
        .order-type-tab.active { border-color: var(--color-green); background: var(--color-green); color: var(--color-ivory); }
        .outdoor-checkout-notice { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-4); margin-bottom: var(--space-6); border: 1px solid rgba(201,169,110,0.45); border-radius: var(--radius-lg); background: rgba(201,169,110,0.1); color: var(--color-green); }
        .outdoor-checkout-notice__icon { display: grid; place-items: center; width: 28px; height: 28px; flex: 0 0 28px; border-radius: 50%; background: var(--color-green); color: var(--color-gold); }
        .outdoor-checkout-notice strong { display: block; margin-bottom: 3px; }
        .outdoor-checkout-notice p { color: var(--color-muted); font-size: var(--text-sm); margin: 0; line-height: 1.5; }

        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-6); }
        @media (max-width: 540px) { .form-grid { grid-template-columns: 1fr; } }
        .form-label { display: flex; flex-direction: column; gap: var(--space-1); font-size: var(--text-sm); font-weight: 600; color: rgba(250,248,244,0.78); }
        .form-input { border: 1.5px solid rgba(255,255,255,0.12); border-radius: var(--radius-lg); padding: 10px 14px; background: rgba(255,255,255,0.055); color: var(--color-ivory); font-size: var(--text-base); font-family: var(--font-sans); outline: none; transition: border-color 0.18s, background 0.18s; }
        .form-input::placeholder { color: rgba(250,248,244,0.3); }
        .form-input:focus { border-color: var(--color-gold); background: rgba(255,255,255,0.08); }
        .form-textarea { resize: vertical; }

        .btn-checkout-next { width: 100%; padding: var(--space-4); background: var(--color-green); color: var(--color-ivory); border: none; border-radius: var(--radius-lg); font-weight: 700; font-size: var(--text-base); cursor: pointer; transition: background 0.18s; }
        .btn-checkout-next:hover:not(:disabled) { background: var(--color-green-dark); }
        .btn-checkout-next:disabled { opacity: 0.5; cursor: default; }

        .back-btn { background: none; border: none; color: var(--color-gold); font-size: var(--text-sm); cursor: pointer; margin-bottom: var(--space-4); padding: 0; font-weight: 600; }

        .review-items { display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-6); }
        .review-item { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) 0; border-bottom: 1px solid rgba(255,255,255,0.09); }
        .review-item__image { width: 64px; height: 64px; flex: 0 0 64px; display: grid; place-items: center; overflow: hidden; border-radius: var(--radius-lg); background: rgba(250,248,244,0.96); color: #0d2b22; font-size: 1.35rem; }
        .review-item__image img { width: 100%; height: 100%; }
        .review-item__info { flex: 1; }
        .review-item__name { font-weight: 600; font-size: var(--text-sm); }
        .review-item__mods { font-size: var(--text-xs); color: var(--color-muted); }
        .review-item__controls { display: flex; align-items: center; gap: var(--space-2); }
        .qty-btn-sm { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid rgba(201,169,110,0.35); background: rgba(201,169,110,0.08); color: var(--color-gold); cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; }
        .review-item__qty { font-weight: 700; min-width: 20px; text-align: center; }
        .review-item__price { font-weight: 700; font-size: var(--text-sm); color: var(--color-green); white-space: nowrap; }

        .promo-row { display: flex; gap: var(--space-3); margin-bottom: var(--space-2); }
        .promo-input { flex: 1; }
        .promo-btn { background: var(--color-green); color: white; border: none; border-radius: var(--radius-lg); padding: 10px 18px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .promo-msg { font-size: var(--text-sm); margin-bottom: var(--space-4); }
        .promo-msg--success { color: #059669; }
        .promo-msg--error { color: #dc2626; }

        .order-summary { border-top: 1px solid rgba(255,255,255,0.1); padding-top: var(--space-4); margin: var(--space-4) 0; display: flex; flex-direction: column; gap: var(--space-2); }
        .summary-row { display: flex; justify-content: space-between; font-size: var(--text-sm); color: rgba(250,248,244,0.58); }
        .summary-row--discount { color: #059669; }
        .summary-row--total { font-size: var(--text-lg); font-weight: 800; color: var(--color-gold); border-top: 1px solid rgba(201,169,110,0.2); padding-top: var(--space-3); margin-top: var(--space-2); }

        .checkout-error { color: #dc2626; font-size: var(--text-sm); margin-bottom: var(--space-4); padding: var(--space-3); background: #fef2f2; border-radius: var(--radius-lg); }

        /* Right sidebar */
        .summary-title { font-family: var(--font-serif); font-size: var(--text-xl); color: var(--color-ivory); margin-bottom: var(--space-2); }
        .summary-type { font-size: var(--text-sm); color: rgba(250,248,244,0.55); margin-bottom: var(--space-4); }
        .summary-item { display: flex; align-items: baseline; gap: var(--space-2); padding: var(--space-2) 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .summary-item:last-of-type { border-bottom: none; }
        .summary-item__qty { font-weight: 700; color: var(--color-green); font-size: var(--text-sm); min-width: 24px; }
        .summary-item__name { flex: 1; font-size: var(--text-sm); color: rgba(250,248,244,0.78); }
        .summary-item__price { font-size: var(--text-sm); font-weight: 600; color: var(--color-gold); white-space: nowrap; }
        .summary-divider { border-top: 1px solid rgba(201,169,110,0.18); margin: var(--space-4) 0; }
      `}</style>
    </div>
  );
}

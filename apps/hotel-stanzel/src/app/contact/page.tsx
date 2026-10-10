'use client';

import { useState } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

const ENQUIRY_TYPES = [
  { value: 'general', label: 'General Enquiry' },
  { value: 'booking', label: 'Booking Assistance' },
  { value: 'dining', label: 'Dining & Restaurant' },
  { value: 'pool', label: 'Pool & Leisure' },
  { value: 'event', label: 'Events & Functions' },
  { value: 'other', label: 'Other' },
];

export default function ContactPage() {
  const [form, setForm] = useState({ type: 'general', name: '', email: '', phone: '', message: '', honeypot: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'A valid email is required';
    if (!form.message.trim() || form.message.trim().length < 10) e.message = 'Please write at least 10 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setStatus('sending'); setErrorMsg('');
    try {
      const res = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setErrorMsg(data.error ?? 'Could not send your enquiry.'); setStatus('error'); return; }
      setStatus('sent');
    } catch { setErrorMsg('Network error. Please try again or email us directly.'); setStatus('error'); }
  }

  function F(id: keyof typeof form, label: string, type?: string, required?: boolean) {
    return (
      <div className="field">
        <label htmlFor={`contact-${id}`} className="field-label">
          {label}{required && <span style={{ color: 'var(--color-gold)' }}> *</span>}
        </label>
        {id === 'message' ? (
          <textarea id={`contact-${id}`} value={form[id]} rows={5}
            onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
            className={`field-input ${errors[id] ? 'error' : ''}`}
            placeholder="How can we help you?" style={{ resize: 'vertical' }} required={required} />
        ) : (
          <input id={`contact-${id}`} type={type ?? 'text'} value={form[id]}
            onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
            className={`field-input ${errors[id] ? 'error' : ''}`}
            required={required} />
        )}
        {errors[id] && <p className="field-error">{errors[id]}</p>}
      </div>
    );
  }

  return (
    <>
      <Header />
      <main id="main-content">
        <section style={{ paddingTop: 'calc(var(--nav-height) + var(--space-16))', paddingBottom: 'var(--space-20)' }}>
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-16)' }}>
              {/* Info column */}
              <div>
                <p className="eyebrow">Get in Touch</p>
                <h1 style={{ marginBottom: 'var(--space-4)' }}>Contact Us</h1>
                <span className="gold-divider" />
                <p style={{ marginBottom: 'var(--space-10)' }}>
                  Our team is available to assist with bookings, dining reservations, event enquiries and any questions you may have about your stay at Stanzel Grand Resort.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', marginBottom: 'var(--space-10)' }}>
                  {[
                    { icon: '📍', label: 'Address', value: 'Plot C103, A Close, off 1st Avenue\nGwarinpa Estate, Abuja, FCT\nNigeria' },
                    { icon: '📧', label: 'Email', value: 'info@stanzelgrandresort.com' },
                  ].map(({ icon, label, value }) => (
                    <div key={label} style={{ display: 'flex', gap: 'var(--space-4)' }}>
                      <span style={{ fontSize: '1.3rem', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                      <div>
                        <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
                        <p style={{ fontWeight: 500, whiteSpace: 'pre-line', fontSize: 'var(--text-sm)' }}>{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ position: 'relative', height: '220px', borderRadius: 'var(--radius-xl)', overflow: 'hidden' }}>
                  <Image src="/images/lobby.jpg" alt="Stanzel Grand Resort lobby" fill style={{ objectFit: 'cover', objectPosition: 'center 20%' }} sizes="(max-width: 768px) 100vw, 400px" />
                </div>
              </div>

              {/* Form column */}
              <div style={{ background: 'var(--color-white)', borderRadius: 'var(--radius-2xl)', padding: 'var(--space-10)', border: '1px solid var(--border)' }}>
                {status === 'sent' ? (
                  <div style={{ textAlign: 'center', padding: 'var(--space-12) 0' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgb(26 60 52 / 0.1)', border: '3px solid var(--color-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-6)' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-green)" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <h2 style={{ marginBottom: 'var(--space-3)' }}>Enquiry Sent!</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Thank you for getting in touch. We'll respond to you at {form.email} within one business day.</p>
                  </div>
                ) : (
                  <form id="contact-form" onSubmit={handleSubmit} noValidate>
                    <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-6)' }}>Send a Message</h2>

                    {/* Enquiry type */}
                    <div className="field" style={{ marginBottom: 'var(--space-5)' }}>
                      <label htmlFor="contact-type" className="field-label">Enquiry Type <span style={{ color: 'var(--color-gold)' }}>*</span></label>
                      <select id="contact-type" className="field-input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                        {ENQUIRY_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', marginBottom: 'var(--space-5)' }}>
                      {F('name', 'Full Name', 'text', true)}
                      {F('email', 'Email Address', 'email', true)}
                    </div>
                    <div style={{ marginBottom: 'var(--space-5)' }}>{F('phone', 'Phone (optional)', 'tel')}</div>
                    <div style={{ marginBottom: 'var(--space-6)' }}>{F('message', 'Your Message', undefined, true)}</div>

                    {/* Honeypot — hidden from humans, filled by bots */}
                    <input type="text" name="website" tabIndex={-1} aria-hidden="true"
                      value={form.honeypot} onChange={e => setForm(f => ({ ...f, honeypot: e.target.value }))}
                      style={{ position: 'absolute', left: '-9999px', width: 0, height: 0, overflow: 'hidden' }} />

                    {status === 'error' && (
                      <div style={{ padding: 'var(--space-4)', background: 'rgb(192 57 43 / 0.08)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(192,57,43,0.2)', marginBottom: 'var(--space-5)' }}>
                        <p style={{ color: '#c0392b', fontSize: 'var(--text-sm)' }}>{errorMsg}</p>
                      </div>
                    )}

                    <button id="send-enquiry-btn" type="submit" disabled={status === 'sending'} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
                      {status === 'sending' ? 'Sending…' : 'Send Enquiry'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

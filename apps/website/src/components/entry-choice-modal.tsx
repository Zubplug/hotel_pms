'use client';

import Link from 'next/link';

export function EntryChoiceModal({ open, onClose }: { open: boolean; onClose: () => void }) {

  const close = () => {
    onClose();
  };

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="entry-choice-title" onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18, background: 'rgba(2,7,19,.82)', backdropFilter: 'blur(12px)' }}>
      <div onClick={event => event.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 760, overflow: 'hidden', border: '1px solid rgba(255,255,255,.12)', borderRadius: 22, background: 'linear-gradient(145deg, rgba(18,28,48,.98), rgba(8,14,28,.98))', boxShadow: '0 28px 90px rgba(0,0,0,.55)' }}>
        <button type="button" aria-label="Close workspace chooser" onClick={close} style={{ position: 'absolute', top: 18, right: 20, zIndex: 1, color: 'var(--text-muted)', fontSize: 26, lineHeight: 1 }}>×</button>
        <div style={{ padding: '42px 30px 28px', textAlign: 'center' }}>
          <div className="section-kicker">Welcome to LodgeCore</div>
          <h2 id="entry-choice-title" style={{ margin: '10px 0 10px', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontSize: 'clamp(25px, 4vw, 36px)', letterSpacing: '-.03em' }}>Where would you like to go?</h2>
          <p style={{ maxWidth: 540, margin: '0 auto', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>Choose the LodgeCore workspace that matches what you are trying to do.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14, padding: '0 22px 24px' }}>
          <div style={{ padding: 22, border: '1px solid rgba(0,212,232,.28)', borderRadius: 16, background: 'linear-gradient(145deg, rgba(0,212,232,.1), rgba(0,212,232,.025))' }}>
            <div style={{ fontSize: 28, marginBottom: 13 }}>🏨</div>
            <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>I manage a property</div>
            <p style={{ minHeight: 50, margin: '8px 0 18px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.65 }}>Access your PMS workspace, manage properties, or start a 7-day trial.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><Link href="/portal/login" className="btn btn-primary btn-sm" onClick={close}>Customer sign in →</Link><Link href="/portal/register" className="btn btn-outline btn-sm" onClick={close}>Start 7-day trial</Link><Link href="/book-demo" style={{ width: '100%', marginTop: 4, color: 'var(--accent)', fontSize: 12 }} onClick={close}>Request a demo or quote</Link></div>
          </div>
          <div style={{ padding: 22, border: '1px solid rgba(167,139,250,.3)', borderRadius: 16, background: 'linear-gradient(145deg, rgba(167,139,250,.11), rgba(167,139,250,.025))' }}>
            <div style={{ fontSize: 28, marginBottom: 13 }}>✦</div>
            <div style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>I am a LodgeCore partner</div>
            <p style={{ minHeight: 50, margin: '8px 0 18px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.65 }}>Use LodgeCore Reach to share properties, refer bookings, and manage your partner earnings.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><Link href="/partner/login" className="btn btn-primary btn-sm" style={{ background: 'linear-gradient(135deg,#a78bfa,#7557d6)', border: 0 }} onClick={close}>Partner sign in →</Link><Link href="/partners" className="btn btn-outline btn-sm" onClick={close}>Become a partner</Link></div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', padding: '14px 22px', textAlign: 'center' }}><button type="button" onClick={close} style={{ color: 'var(--text-muted)', fontSize: 12 }}>Continue browsing the website</button></div>
      </div>
    </div>
  );
}

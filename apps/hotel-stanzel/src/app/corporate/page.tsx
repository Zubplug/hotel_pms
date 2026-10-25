import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Corporate Stays & Business Travel',
  description: 'Corporate accommodation, negotiated rates and simple City Ledger management at Stanzel Grand Resort.',
};

const publicCardStyle = {
  background: 'var(--color-white)',
  border: '1px solid var(--border)',
  borderRadius: 18,
  padding: 'clamp(22px, 4vw, 34px)',
};

function PublicCorporatePage() {
  return (
    <div>
      <section style={{
        background: 'linear-gradient(135deg, var(--color-green-dark), var(--color-green))',
        borderRadius: 22,
        padding: 'clamp(32px, 7vw, 72px) clamp(24px, 6vw, 72px)',
        color: 'var(--color-ivory)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 720 }}>
          <p className="eyebrow" style={{ color: 'var(--color-gold-light)' }}>Stanzel Grand Resort · Corporate</p>
          <h2 style={{ color: 'var(--color-ivory)', fontSize: 'clamp(2.2rem, 5vw, 4.2rem)', lineHeight: 1.05, marginTop: 12 }}>
            Business travel, made beautifully simple.
          </h2>
          <p style={{ color: 'rgba(250,248,244,0.78)', fontSize: 'clamp(1rem, 2vw, 1.2rem)', lineHeight: 1.75, maxWidth: 620, marginTop: 22 }}>
            A more considered way to arrange stays for your team, clients and guests. Enjoy dependable accommodation, approved corporate rates and one clear relationship with Stanzel.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 30 }}>
            <Link href="/corporate/apply" className="btn btn-primary">Apply for corporate booking</Link>
            <Link href="/corporate/login" className="btn btn-outline-light">Corporate portal</Link>
          </div>
        </div>
        <div aria-hidden="true" style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(201,169,110,0.25)', right: -80, bottom: -140 }} />
        <div aria-hidden="true" style={{ position: 'absolute', width: 190, height: 190, borderRadius: '50%', border: '1px solid rgba(201,169,110,0.18)', right: 40, bottom: -85 }} />
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginTop: 22 }}>
        {[
          ['Preferred stays', 'Comfortable rooms and thoughtful service for every business visit.'],
          ['One connected record', 'Bookings, guest details and financial activity stay aligned with the Stanzel PMS.'],
          ['Flexible arrangements', 'Choose approved contract rates, pay-as-you-go stays or City Ledger billing where available.'],
        ].map(([title, description]) => (
          <article key={title} style={publicCardStyle}>
            <p className="eyebrow">{title}</p>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 10 }}>{description}</p>
          </article>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, marginTop: 36, alignItems: 'stretch' }}>
        <div style={publicCardStyle}>
          <p className="eyebrow">New to Stanzel corporate services?</p>
          <h3 style={{ marginTop: 8 }}>Start an application</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 10 }}>
            Tell us about your organisation and your stay. We will guide you through availability, rate options and the right payment arrangement.
          </p>
          <Link href="/corporate/apply" className="btn btn-primary" style={{ marginTop: 20 }}>Start corporate application</Link>
        </div>
        <div style={{ ...publicCardStyle, background: 'var(--color-ivory-dark)' }}>
          <p className="eyebrow">Already approved?</p>
          <h3 style={{ marginTop: 8 }}>Access your workspace</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 10 }}>
            Sign in securely to create reservations, review stays, request rates and manage your corporate City Ledger wallet.
          </p>
          <Link href="/corporate/login" className="btn btn-outline-dark" style={{ marginTop: 20 }}>Open corporate portal</Link>
        </div>
      </section>

      <section style={{ marginTop: 42, padding: '26px 0 8px', borderTop: '1px solid var(--border)' }}>
        <p className="eyebrow">How it works</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 22, marginTop: 20 }}>
          {[
            ['01', 'Apply', 'Share your company and booking requirements.'],
            ['02', 'Review', 'We confirm availability and the best commercial arrangement.'],
            ['03', 'Stay', 'Your team arrives with every reservation ready for Front Desk.'],
          ].map(([number, title, description]) => (
            <div key={number}>
              <span style={{ color: 'var(--color-gold-dark)', fontFamily: 'var(--font-serif)', fontSize: 28 }}>{number}</span>
              <h3 style={{ marginTop: 4 }}>{title}</h3>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.65, marginTop: 6, fontSize: 14 }}>{description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function CorporatePage() {
  return <PublicCorporatePage />;
}

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Discover the story behind Stanzel Grand Resort — luxury hospitality rooted in Abuja, Nigeria, with a commitment to genuine warmth, exceptional service and memorable stays.',
};

export default function AboutPage() {
  return (
    <>
      <Header />
      <main id="main-content">
        {/* Hero */}
        <section style={{ position: 'relative', height: '500px', display: 'flex', alignItems: 'flex-end' }}>
          <Image src="/images/lobby.jpg" alt="Stanzel Grand Resort lobby" fill priority style={{ objectFit: 'cover', objectPosition: 'center 30%' }} sizes="100vw" />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(16,38,32,0.9) 0%, rgba(16,38,32,0.2) 55%)' }} />
          <div className="container" style={{ position: 'relative', zIndex: 2, paddingBottom: 'var(--space-16)' }}>
            <p className="eyebrow" style={{ color: 'var(--color-gold)', marginBottom: 'var(--space-3)' }}>Our Story</p>
            <h1 style={{ color: 'var(--color-ivory)', maxWidth: 600 }}>About Stanzel Grand Resort</h1>
          </div>
        </section>

        {/* Main story */}
        <section className="section">
          <div className="container">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-16)', alignItems: 'center' }}>
              <div>
                <p className="eyebrow">Gwarinpa, Abuja</p>
                <h2>A Landmark of Luxury in the Heart of Abuja</h2>
                <span className="gold-divider" />
                <p style={{ marginBottom: 'var(--space-5)' }}>
                  Stanzel Grand Resort is a premier destination nestled in the prestigious Gwarinpa Estate of Abuja, Nigeria's Federal Capital Territory. From the moment guests arrive through our grand entrance, they are welcomed into a world of refined hospitality — where every detail has been considered and every guest is treated as a distinguished visitor.
                </p>
                <p style={{ marginBottom: 'var(--space-5)' }}>
                  Our resort blends international standards of luxury with the distinctive warmth, colour and character that defines Nigerian hospitality at its finest. We believe that a great stay is more than comfortable rooms and good food — it is an experience that stays with you long after you leave.
                </p>
                <p>
                  Stanzel Grand Resort is committed to providing every guest with a level of service that is attentive, personalised and genuinely welcoming — whether you are staying for a night on business or celebrating a milestone with family.
                </p>
              </div>
              <div style={{ position: 'relative', height: '480px', borderRadius: 'var(--radius-2xl)', overflow: 'hidden' }}>
                <Image src="/images/aerial.jpg" alt="Stanzel Grand Resort grounds" fill style={{ objectFit: 'cover' }} sizes="(max-width: 768px) 100vw, 50vw" />
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="section" style={{ background: 'var(--color-green)' }}>
          <div className="container">
            <div className="section-header center" style={{ marginBottom: 'var(--space-16)' }}>
              <p className="eyebrow" style={{ color: 'var(--color-gold)' }}>Our Commitment</p>
              <h2 style={{ color: 'var(--color-ivory)' }}>What We Stand For</h2>
              <span className="gold-divider gold-divider-center" style={{ opacity: 0.4 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-6)' }}>
              {[
                { icon: '🤝', title: 'Genuine Warmth', desc: 'Nigerian hospitality is world-renowned. We embody it in every interaction — from arrival to farewell.' },
                { icon: '✨', title: 'Excellence', desc: 'We hold ourselves to the highest standards of service, comfort and culinary quality.' },
                { icon: '🌿', title: 'Care', desc: 'We care about our guests, our team and the community we are proud to be part of in Abuja.' },
                { icon: '🔒', title: 'Trust', desc: 'Every reservation is handled with discretion, security and a commitment to delivering exactly what we promise.' },
              ].map(({ icon, title, desc }) => (
                <div key={title} style={{
                  padding: 'var(--space-8)',
                  background: 'rgba(250,248,244,0.05)',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid rgba(250,248,244,0.1)',
                  textAlign: 'center',
                }}>
                  <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 'var(--space-4)' }}>{icon}</span>
                  <h3 style={{ color: 'var(--color-gold)', fontSize: 'var(--text-xl)', marginBottom: 'var(--space-3)' }}>{title}</h3>
                  <p style={{ color: 'rgba(250,248,244,0.65)', fontSize: 'var(--text-sm)', lineHeight: 1.7 }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: 'var(--space-16) 0' }}>
          <div className="container" style={{ textAlign: 'center' }}>
            <h2 style={{ marginBottom: 'var(--space-4)' }}>Experience It For Yourself</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto var(--space-8)' }}>
              The best way to know Stanzel Grand Resort is to stay with us. We look forward to welcoming you.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/booking" className="btn btn-primary btn-lg">Book a Stay</Link>
              <Link href="/contact" className="btn btn-outline-dark btn-lg">Get in Touch</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

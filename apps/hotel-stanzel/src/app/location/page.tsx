import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Location & Directions',
  description: 'Stanzel Grand Resort is located at Plot C103, A Close, 1st Avenue, Gwarinpa Estate, Abuja, Nigeria. Easily accessible from the FCT and major Abuja roads.',
};

export default function LocationPage() {
  // Verified address from web audit: Plot C103 (some listings C112), A Close, off 1st Avenue, Gwarinpa Estate, Abuja
  const address = 'Plot C103, A Close, off 1st Avenue, Gwarinpa Estate, Abuja, FCT, Nigeria';
  const gmapsUrl = 'https://www.google.com/maps/search/?api=1&query=Stanzel+Grand+Resort+Gwarinpa+Abuja';

  return (
    <>
      <Header />
      <main id="main-content">
        <section style={{ paddingTop: 'calc(var(--nav-height) + var(--space-16))', paddingBottom: 'var(--space-20)' }}>
          <div className="container">
            <div className="section-header" style={{ marginBottom: 'var(--space-12)' }}>
              <p className="eyebrow">Find Us</p>
              <h1>Location &amp; Directions</h1>
              <span className="gold-divider" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 'var(--space-12)' }}>
              {/* Details */}
              <div>
                <div style={{ marginBottom: 'var(--space-8)' }}>
                  <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-4)' }}>Address</h2>
                  <address style={{ fontStyle: 'normal' }}>
                    <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-xl)', color: 'var(--color-green)', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
                      Stanzel Grand Resort<br />
                      Plot C103, A Close<br />
                      Off 1st Avenue, Gwarinpa Estate<br />
                      Abuja, FCT, Nigeria
                    </p>
                  </address>
                  <a href={gmapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                    Open in Google Maps ↗
                  </a>
                </div>

                <div style={{ marginBottom: 'var(--space-8)' }}>
                  <h2 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-5)' }}>Getting Here</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                    {[
                      { icon: '✈️', title: 'From the Airport', desc: 'Nnamdi Azikiwe International Airport is approximately 30–40 minutes by road depending on traffic. Taxis, ride-hailing services (Bolt, Uber) and hotel transfers are available.' },
                      { icon: '🚗', title: 'By Car', desc: 'From Central Abuja, take the Nnamdi Azikiwe Expressway towards Gwarinpa Estate. Turn onto 1st Avenue and follow signs to A Close. The resort is behind Fidelity Bank.' },
                      { icon: '📞', title: 'Need Assistance?', desc: 'Contact our front desk for detailed directions or to arrange a pickup service.' },
                    ].map(({ icon, title, desc }) => (
                      <div key={title} style={{ display: 'flex', gap: 'var(--space-4)' }}>
                        <span style={{ fontSize: '1.5rem', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                        <div>
                          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>{title}</h3>
                          <p style={{ fontSize: 'var(--text-sm)' }}>{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Link href="/contact" className="btn btn-outline-dark">Contact Front Desk</Link>
              </div>

              {/* Map embed */}
              <div>
                <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', border: '1px solid var(--border)', height: '480px', background: 'var(--color-ivory-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 'var(--space-4)' }}>
                  <Image src="/images/aerial.jpg" alt="Resort aerial view — map placeholder" fill={false} width={600} height={480}
                    style={{ objectFit: 'cover', width: '100%', height: '100%', borderRadius: 'var(--radius-xl)' }} />
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-3)', textAlign: 'center' }}>
                  Gwarinpa Estate, Abuja, FCT · Nigeria
                </p>
                <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
                  <a href={gmapsUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-green)', fontWeight: 600, fontSize: 'var(--text-sm)', textDecoration: 'underline' }}>
                    View on Google Maps ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

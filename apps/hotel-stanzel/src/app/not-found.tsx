import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function NotFound() {
  return (
    <>
      <Header />
      <main
        style={{
          paddingTop: 'var(--nav-height)',
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-ivory-dark)',
        }}
      >
        <div style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
          <p style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(5rem, 15vw, 10rem)',
            color: 'var(--color-green)',
            opacity: 0.12,
            lineHeight: 1,
            marginBottom: 'var(--space-4)',
            userSelect: 'none',
          }}>
            404
          </p>
          <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>Page Not Found</p>
          <h1 style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-4)' }}>
            This Page Does Not Exist
          </h1>
          <span className="gold-divider gold-divider-center" />
          <p style={{
            color: 'var(--text-muted)',
            maxWidth: '400px',
            margin: '0 auto var(--space-10)',
            fontSize: 'var(--text-lg)',
          }}>
            The page you are looking for may have moved or does not exist. Let us help you find your way.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/" className="btn btn-primary btn-lg">Back to Home</Link>
            <Link href="/booking" className="btn btn-outline-dark btn-lg">Book a Room</Link>
            <Link href="/contact" className="btn btn-outline-dark btn-lg">Contact Us</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

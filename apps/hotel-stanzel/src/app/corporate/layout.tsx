import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function CorporateLayout({ children }: { children: React.ReactNode }) {
  return <><Header /><main style={{ paddingTop: 'var(--nav-height)', minHeight: '72vh', background: 'var(--color-ivory-dark)' }}><div className="container" style={{ maxWidth: 1180, paddingBlock: 'var(--space-12)' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 30 }}><div><p className="eyebrow">Stanzel corporate services</p><h1 style={{ margin: '6px 0 0' }}>Corporate workspace</h1></div><nav style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13 }}><Link href="/corporate">Overview</Link><Link href="/corporate/book">New booking</Link><Link href="/corporate/reservations">Reservations</Link><Link href="/corporate/invoices">City Ledger</Link><Link href="/corporate/rates">Rate requests</Link></nav></div>{children}</div></main><Footer /></>;
}

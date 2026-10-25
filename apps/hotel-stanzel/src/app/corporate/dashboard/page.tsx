import { CorporateDashboard } from '@/components/corporate/CorporateDashboard';
import { corporateApi } from '@/lib/corporate-portal';

export default async function CorporateDashboardPage() {
  const [account, invoices, reservations] = await Promise.all([
    corporateApi<any>('/api/v1/corporate/account'),
    corporateApi<any>('/api/v1/corporate/invoices'),
    corporateApi<any>('/api/v1/corporate/reservations'),
  ]);

  if (!account.ok) return <p>{account.error} Please sign in again.</p>;

  return <CorporateDashboard
    account={account.data.account}
    invoices={invoices.ok ? invoices.data.invoices || [] : []}
    reservations={reservations.ok ? reservations.data.reservations || [] : []}
  />;
}

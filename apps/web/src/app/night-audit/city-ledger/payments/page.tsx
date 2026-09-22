import CityLedgerPaymentsPage from '@/app/(dashboard)/accountant/city-ledger/payments/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function NightAuditCityLedgerPaymentsPage() {
  return <CityLedgerPaymentsPage />;
}

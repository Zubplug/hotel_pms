import CityLedgerAccountsPage from '@/app/(dashboard)/accountant/city-ledger/accounts/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function NightAuditCityLedgerAccountsPage() {
  return <CityLedgerAccountsPage />;
}

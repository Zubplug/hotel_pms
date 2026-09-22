import CityLedgerCreditsPage from '@/app/(dashboard)/accountant/city-ledger/credits/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function NightAuditCityLedgerCreditsPage() {
  return <CityLedgerCreditsPage />;
}

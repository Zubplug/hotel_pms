import CityLedgerPage from '@/app/(dashboard)/accountant/city-ledger/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function NightAuditCityLedgerPage() {
  return <CityLedgerPage allowNightAudit />;
}

import CityLedgerDetailPage from '@/app/(dashboard)/accountant/city-ledger/[id]/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NightAuditCityLedgerDetailPage(props: { params: Promise<{ id: string }> }) {
  return <CityLedgerDetailPage params={props.params} allowNightAudit />;
}

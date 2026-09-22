import OpenInvoicesPage from '@/app/(dashboard)/accountant/city-ledger/invoices/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function NightAuditCityLedgerInvoicesPage() {
  return <OpenInvoicesPage />;
}

import ReceivablesReportPage from '@/app/(dashboard)/reports/receivables/page';
import { GeneralManagerCashManagementShell } from '@/components/cash-management/GeneralManagerCashManagementShell';

export default function GeneralManagerReceivablesPage() {
  return <GeneralManagerCashManagementShell section="Receivables oversight"><ReceivablesReportPage readOnly /></GeneralManagerCashManagementShell>;
}

import FrontdeskReconciliationPage from '@/app/(dashboard)/reports/frontdesk/page';
import { GeneralManagerCashManagementShell } from '@/components/cash-management/GeneralManagerCashManagementShell';

export default function GeneralManagerFrontdeskSettlementPage() {
  return <GeneralManagerCashManagementShell section="Front desk settlement"><FrontdeskReconciliationPage /></GeneralManagerCashManagementShell>;
}

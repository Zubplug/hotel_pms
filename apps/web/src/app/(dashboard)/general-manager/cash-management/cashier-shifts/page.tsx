import ShiftReportPage from '@/app/(dashboard)/reports/shift/page';
import { GeneralManagerCashManagementShell } from '@/components/cash-management/GeneralManagerCashManagementShell';

export default function GeneralManagerCashierShiftsPage() {
  return <GeneralManagerCashManagementShell section="Cashier shifts"><ShiftReportPage readOnly managementBasePath="/general-manager/cash-management/cashier-shifts" /></GeneralManagerCashManagementShell>;
}

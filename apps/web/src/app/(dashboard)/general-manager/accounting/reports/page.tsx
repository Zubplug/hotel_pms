import GeneralManagerAccountingReports from '@/components/accounting/GeneralManagerAccountingReports';
import { GeneralManagerAccountingShell } from '@/components/accounting/GeneralManagerAccountingShell';

export default function GeneralManagerAccountingReportsPage() {
  return <GeneralManagerAccountingShell section="Reports"><GeneralManagerAccountingReports /></GeneralManagerAccountingShell>;
}

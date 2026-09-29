import GeneralManagerAccounting from '@/components/accounting/GeneralManagerAccounting';
import { GeneralManagerAccountingShell } from '@/components/accounting/GeneralManagerAccountingShell';

export default function GeneralManagerAccountingPage() {
  return <GeneralManagerAccountingShell section="Overview"><GeneralManagerAccounting /></GeneralManagerAccountingShell>;
}

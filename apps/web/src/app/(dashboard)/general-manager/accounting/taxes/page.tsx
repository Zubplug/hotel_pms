import GeneralManagerAccountingDomain from '@/components/accounting/GeneralManagerAccountingDomain';
import { GeneralManagerAccountingShell } from '@/components/accounting/GeneralManagerAccountingShell';

export default function GeneralManagerTaxesPage() {
  return <GeneralManagerAccountingShell section="Taxes"><GeneralManagerAccountingDomain domain="taxes" /></GeneralManagerAccountingShell>;
}

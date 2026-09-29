import GeneralManagerAccountingDomain from '@/components/accounting/GeneralManagerAccountingDomain';
import { GeneralManagerAccountingShell } from '@/components/accounting/GeneralManagerAccountingShell';

export default function GeneralManagerCityLedgerPage() {
  return <GeneralManagerAccountingShell section="City ledger"><GeneralManagerAccountingDomain domain="city-ledger" /></GeneralManagerAccountingShell>;
}

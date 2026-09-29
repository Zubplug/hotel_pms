import GeneralManagerAccountingDomain from '@/components/accounting/GeneralManagerAccountingDomain';
import { GeneralManagerAccountingShell } from '@/components/accounting/GeneralManagerAccountingShell';
export default function GeneralManagerPayablesPage() { return <GeneralManagerAccountingShell section="Payables"><GeneralManagerAccountingDomain domain="payables" /></GeneralManagerAccountingShell>; }

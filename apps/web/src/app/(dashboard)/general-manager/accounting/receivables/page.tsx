import GeneralManagerAccountingDomain from '@/components/accounting/GeneralManagerAccountingDomain';
import { GeneralManagerAccountingShell } from '@/components/accounting/GeneralManagerAccountingShell';
export default function GeneralManagerReceivablesPage() { return <GeneralManagerAccountingShell section="Receivables"><GeneralManagerAccountingDomain domain="receivables" /></GeneralManagerAccountingShell>; }

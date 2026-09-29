import GeneralManagerAccountingDomain from '@/components/accounting/GeneralManagerAccountingDomain';
import { GeneralManagerAccountingShell } from '@/components/accounting/GeneralManagerAccountingShell';
export default function GeneralManagerGLPage() { return <GeneralManagerAccountingShell section="GL integrity"><GeneralManagerAccountingDomain domain="gl" /></GeneralManagerAccountingShell>; }

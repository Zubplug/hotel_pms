import { ApprovalControlCenter } from '@/components/approvals/ApprovalControlCenter';

export const dynamic = 'force-dynamic';

export default function CashierApprovalCenterPage() {
  return <ApprovalControlCenter audience="CASHIER" />;
}

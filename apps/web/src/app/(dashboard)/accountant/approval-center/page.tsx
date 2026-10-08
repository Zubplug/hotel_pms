import { ApprovalControlCenter } from '@/components/approvals/ApprovalControlCenter';
import { GeneralManagerExpenseApprovalQueue } from '@/components/approvals/GeneralManagerExpenseApprovalQueue';

export const dynamic = 'force-dynamic';

export default function AccountantApprovalCenterPage() {
  return <><ApprovalControlCenter audience="ACCOUNTING" /><GeneralManagerExpenseApprovalQueue stage="ACCOUNTANT" title="Expense invoices awaiting Accountant approval" /></>;
}

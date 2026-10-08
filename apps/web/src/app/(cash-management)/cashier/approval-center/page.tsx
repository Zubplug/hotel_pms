import { ApprovalControlCenter } from '@/components/approvals/ApprovalControlCenter';
import { GeneralManagerExpenseApprovalQueue } from '@/components/approvals/GeneralManagerExpenseApprovalQueue';

export const dynamic = 'force-dynamic';

export default function CashierApprovalCenterPage() {
  return <><ApprovalControlCenter audience="CASHIER" /><GeneralManagerExpenseApprovalQueue stage="GENERAL_CASHIER" title="Expense invoices awaiting General Cashier approval" /></>;
}

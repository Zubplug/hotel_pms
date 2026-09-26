import { ApprovalControlCenter } from '@/components/approvals/ApprovalControlCenter';

export const dynamic = 'force-dynamic';

export default function AccountantApprovalCenterPage() {
  return <ApprovalControlCenter audience="ACCOUNTING" />;
}

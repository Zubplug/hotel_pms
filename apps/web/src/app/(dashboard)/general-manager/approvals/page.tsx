import { ApprovalControlCenter } from '@/components/approvals/ApprovalControlCenter';

export const dynamic = 'force-dynamic';

export default function GeneralManagerApprovalsPage() {
  return <ApprovalControlCenter audience="MANAGEMENT" />;
}

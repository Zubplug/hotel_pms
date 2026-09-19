import RefundsPage from '../../refunds/page';

/**
 * Accountant-scoped entry point for the refund control workflow.
 * The dashboard layout automatically mounts /accountant/* routes inside
 * AccountantLayout, while the shared client page preserves the existing
 * approval, assignment, and settlement actions.
 */
export default function AccountantRefundsPage() {
  return <RefundsPage />;
}

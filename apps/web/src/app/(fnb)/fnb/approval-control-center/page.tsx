import RequisitionsClient from '../requisitions/client';

export default function ApprovalControlCenterPage() {
  return (
    <RequisitionsClient
      title="Approval Control Center"
      description="Track every outlet stock request from submission through approval, dispatch, and completion. New requests are supplied by the main warehouse and remain visible here throughout their lifecycle."
    />
  );
}

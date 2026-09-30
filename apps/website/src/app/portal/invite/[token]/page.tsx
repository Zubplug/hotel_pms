import { InviteForm } from './InviteForm';

export default async function CustomerInvitePage({ params }: { params: Promise<{ token: string }> }) {
  return <InviteForm token={(await params).token} />;
}

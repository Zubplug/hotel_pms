import GuestCreditsPage from '@/app/(dashboard)/accountant/guest-credits/page';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function NightAuditGuestCreditsPage() {
  return <GuestCreditsPage allowNightAudit />;
}

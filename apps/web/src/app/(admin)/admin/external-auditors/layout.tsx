import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default async function ExternalAuditorAdminLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

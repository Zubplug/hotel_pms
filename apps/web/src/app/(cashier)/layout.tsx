import { CashierLayout } from '@/components/layout/CashierLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CashierLayout>{children}</CashierLayout>;
}

import { FrontDeskLayout } from '@/components/layout/FrontDeskLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <FrontDeskLayout>{children}</FrontDeskLayout>;
}

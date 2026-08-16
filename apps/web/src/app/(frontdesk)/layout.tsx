import { FrontDeskLayout } from '@/components/layout/FrontDeskLayout';
import { DataProviderWrapper } from '@/lib/desktop/DataProviderContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <DataProviderWrapper>
      <FrontDeskLayout>{children}</FrontDeskLayout>
    </DataProviderWrapper>
  );
}

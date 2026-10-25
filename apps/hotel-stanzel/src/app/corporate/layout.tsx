import CorporatePortalFrame from '@/components/corporate/CorporatePortalFrame';

export default function CorporateLayout({ children }: { children: React.ReactNode }) {
  return <CorporatePortalFrame>{children}</CorporatePortalFrame>;
}

import FolioDetailClient from './FolioDetailClient';

// Folio IDs are created at runtime. Desktop navigation uses the query-string
// shell at /frontdesk/folios, so no unknown IDs should be pre-rendered here.
export function generateStaticParams() {
  return process.env.NEXT_PUBLIC_IS_DESKTOP === 'true'
    ? [{ folioId: '__desktop__' }]
    : [];
}

export default function FrontDeskFolioPage() {
  return <FolioDetailClient />;
}

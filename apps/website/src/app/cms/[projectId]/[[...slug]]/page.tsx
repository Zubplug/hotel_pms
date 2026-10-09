import { notFound } from 'next/navigation';
import { prisma } from '@hotel-pms/db';
import { verifyPreviewToken } from '@/lib/cms/preview-token';

interface CmsPageProps {
  params: {
    projectId: string;
    slug?: string[];
  };
  searchParams: {
    previewToken?: string;
  };
}

export default async function CmsPage({ params, searchParams }: CmsPageProps) {
  const { projectId } = params;
  const rawSlug = params.slug ? `/${params.slug.join('/')}` : '/';
  const isPreview = Boolean(searchParams.previewToken);

  const project = await prisma.websiteProject.findUnique({
    where: { id: projectId },
    include: {
      activeRevision: true,
      previewRevision: true,
    }
  });

  if (!project) {
    notFound();
  }

  const revisionId = isPreview && project.previewRevisionId && verifyPreviewToken(searchParams.previewToken!, project.id, project.previewRevisionId)
    ? project.previewRevisionId
    : project.activeRevisionId;

  if (!revisionId) {
    // Project exists but has no active/preview revision yet
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <h1 className="text-2xl font-semibold text-gray-700">Website is currently under construction.</h1>
      </div>
    );
  }

  const page = await prisma.websitePage.findUnique({
    where: {
      revisionId_slug: {
        revisionId,
        slug: rawSlug
      }
    },
    include: {
      sections: {
        orderBy: { sortOrder: 'asc' }
      }
    }
  });

  if (!page || page.status !== 'PUBLISHED') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans" style={{ '--primary-color': project.primaryColor || '#000000', '--secondary-color': project.secondaryColor || '#ffffff' } as any}>
      {page.sections.map((section) => (
        <SectionRenderer key={section.id} section={section} />
      ))}
    </div>
  );
}

// A simple dynamic renderer based on the section type
function SectionRenderer({ section }: { section: any }) {
  const content = section.content as any;

  switch (section.type) {
    case 'HERO':
      return (
        <section className="relative w-full h-[600px] flex items-center justify-center bg-gray-900 text-white">
          {content.backgroundImageUrl && (
            <div className="absolute inset-0 opacity-50 bg-cover bg-center" style={{ backgroundImage: `url(${content.backgroundImageUrl})` }} />
          )}
          <div className="relative z-10 text-center px-4">
            <h1 className="text-5xl md:text-7xl font-bold mb-4 tracking-tight" style={{ color: 'var(--primary-color)' }}>{content.title}</h1>
            {content.subtitle && <p className="text-xl md:text-2xl mb-8 font-light">{content.subtitle}</p>}
            {content.callToAction && (
              <a href={content.callToAction.link} className="inline-block px-8 py-4 bg-white text-gray-900 font-semibold uppercase tracking-wider hover:bg-gray-200 transition-colors">
                {content.callToAction.label}
              </a>
            )}
          </div>
        </section>
      );
    case 'TEXT_IMAGE':
      return (
        <section className="py-20 px-6 md:px-12 max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-12">
          {content.imageAlignment === 'LEFT' && (
            <div className="flex-1">
              <img src={content.imageUrl} alt="" className="w-full h-auto object-cover rounded-xl shadow-2xl" />
            </div>
          )}
          <div className="flex-1 space-y-6">
            {content.title && <h2 className="text-4xl font-bold" style={{ color: 'var(--primary-color)' }}>{content.title}</h2>}
            <p className="text-lg text-gray-700 leading-relaxed whitespace-pre-wrap">{content.text}</p>
          </div>
          {content.imageAlignment === 'RIGHT' && (
            <div className="flex-1">
              <img src={content.imageUrl} alt="" className="w-full h-auto object-cover rounded-xl shadow-2xl" />
            </div>
          )}
        </section>
      );
    case 'GALLERY':
      return <section className="py-16 px-6 max-w-7xl mx-auto"><h2 className="text-3xl font-bold mb-8" style={{ color: 'var(--primary-color)' }}>{content.title}</h2><div className="grid grid-cols-1 md:grid-cols-3 gap-4">{(content.images ?? []).map((image: any) => <figure key={image.url}><img src={image.url} alt={image.altText ?? ''} className="w-full aspect-[4/3] object-cover rounded-lg" />{image.caption && <figcaption className="mt-2 text-sm text-gray-600">{image.caption}</figcaption>}</figure>)}</div></section>;
    case 'ROOM_LIST':
      return <section className="py-16 px-6 max-w-7xl mx-auto"><h2 className="text-3xl font-bold mb-4" style={{ color: 'var(--primary-color)' }}>{content.title ?? 'Our rooms'}</h2><p className="mb-8 text-gray-600">{content.description}</p><a href="/rooms" className="inline-block px-6 py-3 rounded bg-[var(--primary-color)] text-white">View rooms</a></section>;
    case 'AMENITIES':
      return <section className="py-16 px-6 max-w-5xl mx-auto"><h2 className="text-3xl font-bold mb-6" style={{ color: 'var(--primary-color)' }}>{content.title ?? 'Amenities'}</h2><ul className="grid md:grid-cols-2 gap-3">{(content.amenities ?? []).map((amenity: string) => <li key={amenity} className="p-4 rounded bg-gray-50">{amenity}</li>)}</ul></section>;
    case 'CONTACT':
      return <section className="py-16 px-6 text-center"><h2 className="text-3xl font-bold mb-6" style={{ color: 'var(--primary-color)' }}>{content.title ?? 'Contact us'}</h2>{content.showForm && <a href="/contact" className="underline">Get in touch</a>}</section>;
    case 'HTML':
      return <section className="py-12 px-6 max-w-5xl mx-auto whitespace-pre-wrap">{content.html}</section>;
    default:
      return (
        <div className="p-8 border border-dashed border-gray-300 text-gray-500 text-center m-8">
          Unsupported section type: {section.type}
        </div>
      );
  }
}

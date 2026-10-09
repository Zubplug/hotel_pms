import { z } from 'zod';

export const SectionTypeSchema = z.enum([
  'HERO',
  'GALLERY',
  'TEXT_IMAGE',
  'ROOM_LIST',
  'AMENITIES',
  'CONTACT',
  'HTML'
]);

export const HeroSectionContentSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  backgroundImageUrl: z.string().url().optional(),
  callToAction: z.object({
    label: z.string(),
    link: z.string(),
  }).optional(),
});

export const GallerySectionContentSchema = z.object({
  title: z.string().optional(),
  images: z.array(z.object({
    url: z.string().url(),
    altText: z.string().optional(),
    caption: z.string().optional(),
  })),
  layout: z.enum(['GRID', 'SLIDER']).default('GRID'),
});

export const TextImageSectionContentSchema = z.object({
  title: z.string().optional(),
  text: z.string(),
  imageUrl: z.string().url(),
  imageAlignment: z.enum(['LEFT', 'RIGHT']).default('LEFT'),
});

export const RoomListSectionContentSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  layout: z.enum(['GRID', 'LIST']).default('GRID'),
  limit: z.number().int().min(1).optional(),
});

export const AmenitiesSectionContentSchema = z.object({
  title: z.string().optional(),
  amenities: z.array(z.string()),
});

export const ContactSectionContentSchema = z.object({
  title: z.string().optional(),
  showMap: z.boolean().default(false),
  showForm: z.boolean().default(true),
});

export const HtmlSectionContentSchema = z.object({
  html: z.string(),
});

export const AnySectionContentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('HERO'), content: HeroSectionContentSchema }),
  z.object({ type: z.literal('GALLERY'), content: GallerySectionContentSchema }),
  z.object({ type: z.literal('TEXT_IMAGE'), content: TextImageSectionContentSchema }),
  z.object({ type: z.literal('ROOM_LIST'), content: RoomListSectionContentSchema }),
  z.object({ type: z.literal('AMENITIES'), content: AmenitiesSectionContentSchema }),
  z.object({ type: z.literal('CONTACT'), content: ContactSectionContentSchema }),
  z.object({ type: z.literal('HTML'), content: HtmlSectionContentSchema }),
]);

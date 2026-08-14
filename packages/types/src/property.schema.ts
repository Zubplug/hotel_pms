import { z } from 'zod';

export const createPropertySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(2).max(100),
  code: z.string().min(2).max(20).toUpperCase(),
  address: z.string().min(5).max(200),
  city: z.string().min(2).max(100),
  state: z.string().max(100).optional(),
  country: z.string().min(2).max(100),
  phone: z.string().min(7).max(20),
  email: z.string().email(),
  website: z.string().url().optional().or(z.literal('')),
  timezone: z.string().min(2),
  baseCurrency: z.string().length(3).toUpperCase(),
  supportedCurrencies: z.array(z.string().length(3)).default([]),
  starRating: z.number().int().min(1).max(5).optional(),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/).default('14:00'),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).default('12:00'),
  locale: z.string().default('en-NG'),
  settings: z.record(z.unknown()).optional(),
});

export const updatePropertySchema = createPropertySchema.partial().omit({
  organizationId: true,
});

export const propertyQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type PropertyQuery = z.infer<typeof propertyQuerySchema>;

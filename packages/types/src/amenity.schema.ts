import { z } from 'zod';

export const createAmenitySchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().min(2).max(100),
  category: z.enum([
    'CONNECTIVITY',
    'CLIMATE',
    'ENTERTAINMENT',
    'BATHROOM',
    'BEDROOM',
    'WORKSPACE',
    'FOOD_DRINK',
    'SAFETY',
    'ACCESSIBILITY',
    'OTHER',
  ]),
  icon: z.string().max(100).optional(),
});

export const updateAmenitySchema = createAmenitySchema.partial().omit({
  propertyId: true,
});

export type CreateAmenityInput = z.infer<typeof createAmenitySchema>;
export type UpdateAmenityInput = z.infer<typeof updateAmenitySchema>;

import { z } from 'zod';

export const createFloorSchema = z.object({
  buildingId: z.string().uuid(),
  propertyId: z.string().uuid(),
  number: z.number().int().min(0),
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});

export const updateFloorSchema = createFloorSchema.partial().omit({
  buildingId: true,
  propertyId: true,
});

export type CreateFloorInput = z.infer<typeof createFloorSchema>;
export type UpdateFloorInput = z.infer<typeof updateFloorSchema>;

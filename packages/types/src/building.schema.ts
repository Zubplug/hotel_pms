import { z } from 'zod';

export const createBuildingSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().min(2).max(100),
  code: z.string().min(1).max(20),
  description: z.string().max(500).optional(),
  floorsCount: z.number().int().positive().default(1),
  isActive: z.boolean().default(true),
});

export const updateBuildingSchema = createBuildingSchema.partial().omit({
  propertyId: true,
});

export type CreateBuildingInput = z.infer<typeof createBuildingSchema>;
export type UpdateBuildingInput = z.infer<typeof updateBuildingSchema>;

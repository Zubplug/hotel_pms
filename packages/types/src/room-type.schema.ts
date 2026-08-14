import { z } from 'zod';

export const createRoomTypeSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().min(2).max(100),
  code: z.string().min(1).max(20),
  description: z.string().max(1000).optional(),
  maxOccupancy: z.number().int().positive(),
  maxAdults: z.number().int().positive().default(2),
  maxChildren: z.number().int().min(0).default(0),
  defaultBedConfig: z.string().min(1),
  amenities: z.array(z.string()).default([]),
  photos: z.array(z.string().url()).default([]),
  baseRate: z.number().positive(),
  currency: z.string().length(3).toUpperCase(),
  isActive: z.boolean().default(true),
});

export const updateRoomTypeSchema = createRoomTypeSchema.partial().omit({
  propertyId: true,
});

export type CreateRoomTypeInput = z.infer<typeof createRoomTypeSchema>;
export type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeSchema>;

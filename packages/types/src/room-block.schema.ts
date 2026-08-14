import { z } from 'zod';

export const BlockTypeEnum = z.enum([
  'MAINTENANCE',
  'OUT_OF_ORDER',
  'OUT_OF_SERVICE',
  'HOUSE_USE',
  'OWNER_USE',
  'COMPLIMENTARY',
  'INVENTORY_BLOCK',
  'DEEP_CLEAN',
  'OTHER',
]);

export const createRoomBlockSchema = z.object({
  roomId: z.string().uuid(),
  propertyId: z.string().uuid(),
  type: BlockTypeEnum,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  reason: z.string().min(3).max(500),
  notes: z.string().max(1000).optional(),
}).refine(
  (data) => data.startDate <= data.endDate,
  { message: 'End date must be on or after start date', path: ['endDate'] }
);

export type CreateRoomBlockInput = z.infer<typeof createRoomBlockSchema>;

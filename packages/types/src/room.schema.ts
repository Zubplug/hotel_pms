import { z } from 'zod';

export const RoomStatusEnum = z.enum([
  'AVAILABLE',
  'RESERVED',
  'OCCUPIED',
  'DIRTY',
  'CLEANING',
  'CLEAN',
  'INSPECTED',
  'OUT_OF_ORDER',
  'OUT_OF_SERVICE',
  'MAINTENANCE',
  'BLOCKED',
]);

export const HousekeepingStatusEnum = z.enum([
  'DIRTY',
  'CLEANING',
  'CLEAN',
  'INSPECTED',
  'OUT_OF_ORDER',
]);

export const RoomMaintenanceStatusEnum = z.enum([
  'NONE',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
]);

export const createRoomSchema = z.object({
  propertyId: z.string().uuid(),
  buildingId: z.string().uuid(),
  floorId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  number: z.string().min(1).max(20),
  code: z.string().max(30).optional(),
  displayName: z.string().max(100).optional(),
  name: z.string().max(100).optional(),
  maxOccupancy: z.number().int().positive(),
  maxAdults: z.number().int().positive().default(2),
  maxChildren: z.number().int().min(0).default(0),
  floorPosition: z.number().int().min(0).optional(),
  bedConfiguration: z.string().min(1),
  squareMeters: z.number().positive().optional(),
  view: z.string().max(100).optional(),
  amenities: z.array(z.string()).default([]),
  photos: z.array(z.string().url()).default([]),
  description: z.string().max(2000).optional(),
  status: RoomStatusEnum.default('AVAILABLE'),
  housekeepingStatus: HousekeepingStatusEnum.default('CLEAN'),
  maintenanceStatus: RoomMaintenanceStatusEnum.default('NONE'),
  isAccessible: z.boolean().default(false),
  isActive: z.boolean().default(true),
  notes: z.string().max(2000).optional(),
});

export const updateRoomSchema = createRoomSchema
  .partial()
  .omit({ propertyId: true, status: true }); // status changes must use /status endpoint

export const roomStatusTransitionSchema = z.object({
  newStatus: RoomStatusEnum,
  reason: z.string().max(500).optional(),
  source: z
    .enum(['MANUAL', 'CHECK_IN', 'CHECK_OUT', 'HOUSEKEEPING', 'MAINTENANCE', 'RESERVATION', 'SYSTEM'])
    .default('MANUAL'),
  referenceId: z.string().optional(),
});

export const roomQuerySchema = z.object({
  propertyId: z.string().uuid().optional(),
  buildingId: z.string().uuid().optional(),
  floorId: z.string().uuid().optional(),
  roomTypeId: z.string().uuid().optional(),
  status: RoomStatusEnum.optional(),
  housekeepingStatus: HousekeepingStatusEnum.optional(),
  isActive: z.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
  sortBy: z.enum(['number', 'status', 'roomType', 'floor', 'createdAt']).default('number'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type RoomStatusTransitionInput = z.infer<typeof roomStatusTransitionSchema>;
export type RoomQuery = z.infer<typeof roomQuerySchema>;

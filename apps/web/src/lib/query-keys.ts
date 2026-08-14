// TanStack Query key factory for the Hotel PMS
export const queryKeys = {
  properties: {
    all: ['properties'] as const,
    list: (params?: Record<string, unknown>) => ['properties', 'list', params] as const,
    detail: (id: string) => ['properties', 'detail', id] as const,
  },
  buildings: {
    all: ['buildings'] as const,
    byProperty: (propertyId: string) => ['buildings', 'property', propertyId] as const,
    detail: (id: string) => ['buildings', 'detail', id] as const,
  },
  floors: {
    all: ['floors'] as const,
    byBuilding: (buildingId: string) => ['floors', 'building', buildingId] as const,
    detail: (id: string) => ['floors', 'detail', id] as const,
  },
  rooms: {
    all: ['rooms'] as const,
    list: (params?: Record<string, unknown>) => ['rooms', 'list', params] as const,
    detail: (id: string) => ['rooms', 'detail', id] as const,
    statusHistory: (id: string) => ['rooms', 'statusHistory', id] as const,
    blocks: (id: string) => ['rooms', 'blocks', id] as const,
  },
  roomTypes: {
    all: ['roomTypes'] as const,
    byProperty: (propertyId: string) => ['roomTypes', 'property', propertyId] as const,
    detail: (id: string) => ['roomTypes', 'detail', id] as const,
  },
  amenities: {
    all: ['amenities'] as const,
    byProperty: (propertyId: string) => ['amenities', 'property', propertyId] as const,
  },
};

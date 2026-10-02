'use client';

import { useQuery } from '@tanstack/react-query';
import type { NavigationModule } from './navigation-entitlements';

export function useNavigationModules(propertyId?: string | null) {
  return useQuery<NavigationModule[]>({
    queryKey: ['navigation-modules', propertyId ?? 'default'],
    queryFn: async () => {
      const query = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : '';
      const response = await fetch(`/api/v1/navigation/modules${query}`);
      if (!response.ok) throw new Error('Unable to resolve module access');
      return (await response.json()).modules as NavigationModule[];
    },
    staleTime: 60_000,
  });
}

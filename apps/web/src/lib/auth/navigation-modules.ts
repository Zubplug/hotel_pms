export const NAVIGATION_MODULES = ['MODULE_PMS', 'MODULE_OPERATIONS', 'MODULE_ENTERPRISE'] as const;
export type NavigationModule = (typeof NAVIGATION_MODULES)[number];

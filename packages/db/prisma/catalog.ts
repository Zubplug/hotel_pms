export const CATALOG_VERSION = 1;

export type CatalogProduct = {
  code: string;
  name: string;
  type: 'BASE' | 'ADDON';
  active: boolean;
  metadata: Record<string, unknown>;
};

export type CatalogPlan = {
  code: string;
  name: string;
  description: string;
  displayOrder: number;
  metadata: Record<string, unknown>;
  products: Array<{ code: string; quantity: number | null; required: boolean }>;
};

export const catalogProducts: CatalogProduct[] = [
  { code: 'PLAN_STARTER', name: 'Starter subscription', type: 'BASE', active: true, metadata: { family: 'PLAN', version: CATALOG_VERSION } },
  { code: 'PLAN_PROFESSIONAL', name: 'Professional subscription', type: 'BASE', active: true, metadata: { family: 'PLAN', version: CATALOG_VERSION } },
  { code: 'PLAN_BUSINESS', name: 'Business subscription', type: 'BASE', active: true, metadata: { family: 'PLAN', version: CATALOG_VERSION } },
  { code: 'PLAN_ENTERPRISE', name: 'Enterprise subscription', type: 'BASE', active: true, metadata: { family: 'PLAN', version: CATALOG_VERSION } },
  { code: 'PLAN_ENTERPRISE_PLUS', name: 'Enterprise Plus subscription', type: 'BASE', active: true, metadata: { family: 'PLAN', version: CATALOG_VERSION, customPricing: true } },
  { code: 'MODULE_PMS', name: 'Property Management System', type: 'BASE', active: true, metadata: { family: 'MODULE', version: CATALOG_VERSION, offlineCapable: true } },
  { code: 'MODULE_OPERATIONS', name: 'Professional Operations', type: 'BASE', active: true, metadata: { family: 'MODULE', version: CATALOG_VERSION, offlineCapable: true } },
  { code: 'MODULE_ENTERPRISE', name: 'Enterprise Platform', type: 'BASE', active: true, metadata: { family: 'MODULE', version: CATALOG_VERSION, offlineCapable: true } },
  { code: 'ADDON_BEDS24', name: 'Beds24 Channel Integration', type: 'ADDON', active: true, metadata: { family: 'CONNECTIVITY', provider: 'BEDS24', unit: 'PROPERTY', sellable: true, offlineCapable: false, version: CATALOG_VERSION } },
  { code: 'ADDON_CHANNEL_MANAGER', name: 'Channel Manager', type: 'ADDON', active: false, metadata: { family: 'CONNECTIVITY', unit: 'PROPERTY', sellable: false, offlineCapable: false, version: CATALOG_VERSION } },
  { code: 'ADDON_BOOKING_ENGINE', name: 'Booking Engine', type: 'ADDON', active: true, metadata: { family: 'CONNECTIVITY', unit: 'PROPERTY', sellable: true, offlineCapable: false, version: CATALOG_VERSION } },
  { code: 'ADDON_CUSTOM_DOMAIN', name: 'Custom Booking Domain', type: 'ADDON', active: true, metadata: { family: 'CONNECTIVITY', unit: 'PROPERTY', sellable: true, offlineCapable: false, requiresApproval: true, version: CATALOG_VERSION } },
  { code: 'ADDON_CUSTOM_WEBSITE_DESIGN', name: 'Custom Website Design Service (legacy)', type: 'ADDON', active: false, metadata: { family: 'SERVICES', unit: 'PROJECT', sellable: false, offlineCapable: false, oneTime: true, retired: true, version: CATALOG_VERSION } },
  { code: 'ADDON_CUSTOM_WEBSITE_API', name: 'Standalone API Website Development', type: 'ADDON', active: true, metadata: { family: 'SERVICES', mode: 'STANDALONE_API', unit: 'PROJECT', sellable: true, offlineCapable: false, requiresApproval: true, oneTime: true, version: CATALOG_VERSION } },
  { code: 'ADDON_CUSTOM_WEBSITE_PMS', name: 'PMS-Connected Website Development', type: 'ADDON', active: true, metadata: { family: 'SERVICES', mode: 'PMS_CONNECTED', unit: 'PROJECT', sellable: true, offlineCapable: false, requiresApproval: true, oneTime: true, version: CATALOG_VERSION } },
  { code: 'ADDON_WHATSAPP', name: 'WhatsApp Guest Messaging', type: 'ADDON', active: false, metadata: { family: 'CONNECTIVITY', unit: 'USAGE', sellable: false, offlineCapable: false, version: CATALOG_VERSION } },
  { code: 'ADDON_SMS', name: 'SMS Notifications', type: 'ADDON', active: false, metadata: { family: 'CONNECTIVITY', unit: 'USAGE', sellable: false, offlineCapable: false, version: CATALOG_VERSION } },
  { code: 'ADDON_API', name: 'API and Integrations', type: 'ADDON', active: false, metadata: { family: 'CONNECTIVITY', unit: 'FLAT', sellable: false, offlineCapable: false, version: CATALOG_VERSION } },
  { code: 'ADDON_EXTRA_PROPERTY', name: 'Additional Property', type: 'ADDON', active: false, metadata: { family: 'SCALE', unit: 'PROPERTY', capacityKey: 'maxProperties', capacityAmount: 1, sellable: false, offlineCapable: true, version: CATALOG_VERSION } },
  { code: 'ADDON_EXTRA_TERMINAL', name: 'Additional POS Terminal', type: 'ADDON', active: false, metadata: { family: 'SCALE', unit: 'TERMINAL', capacityKey: 'maxTerminals', capacityAmount: 1, sellable: false, offlineCapable: true, version: CATALOG_VERSION } },
  { code: 'ADDON_EXTRA_USER_PACK', name: 'Additional User Pack', type: 'ADDON', active: false, metadata: { family: 'SCALE', unit: 'USER_PACK', capacityKey: 'maxUsers', capacityAmount: 5, sellable: false, offlineCapable: true, version: CATALOG_VERSION } },
  { code: 'ADDON_PREMIUM_SUPPORT', name: 'Premium Support', type: 'ADDON', active: false, metadata: { family: 'SERVICES', unit: 'FLAT', sellable: false, offlineCapable: false, version: CATALOG_VERSION } },
  { code: 'ADDON_DEDICATED_SLA', name: 'Dedicated Support and SLA', type: 'ADDON', active: false, metadata: { family: 'SERVICES', unit: 'FLAT', sellable: false, offlineCapable: false, version: CATALOG_VERSION } },
];

export const planPrices = [
  { code: 'PLAN_STARTER', month: 3500000, year: 35000000 },
  { code: 'PLAN_PROFESSIONAL', month: 6500000, year: 65000000 },
  { code: 'PLAN_BUSINESS', month: 12000000, year: 120000000 },
  { code: 'PLAN_ENTERPRISE', month: 20000000, year: 200000000 },
] as const;

// One-time professional services are kept separate from recurring plan prices.
export const oneTimePrices = [
  { code: 'ADDON_CUSTOM_WEBSITE_API', amount: 120000000, currency: 'ngn' }, // ₦1,200,000
  { code: 'ADDON_CUSTOM_WEBSITE_PMS', amount: 250000000, currency: 'ngn' }, // ₦2,500,000
] as const;

export const addOnPrices = [
  { code: 'ADDON_BEDS24', month: 2500000, year: 25000000, currency: 'ngn' }, // ₦25,000/month or ₦250,000/year per property
] as const;

export const catalogPlans: CatalogPlan[] = [
  { code: 'ESSENTIAL', name: 'Starter', description: 'Essential hotel operations for independent properties with 1–20 rooms.', displayOrder: 1, metadata: { maxProperties: 1, maxRooms: 20, maxUsers: 10, maxOutlets: 1, maxIntegrations: 0, maxTerminals: 1, version: CATALOG_VERSION }, products: [{ code: 'PLAN_STARTER', quantity: 20, required: true }, { code: 'MODULE_PMS', quantity: 20, required: true }] },
  { code: 'PROFESSIONAL', name: 'Professional', description: 'PMS, operations, commerce and finance for growing properties.', displayOrder: 2, metadata: { maxProperties: 1, maxRooms: 50, maxUsers: 30, maxOutlets: 5, maxIntegrations: 3, maxTerminals: 3, version: CATALOG_VERSION }, products: [{ code: 'PLAN_PROFESSIONAL', quantity: 50, required: true }, { code: 'MODULE_PMS', quantity: 50, required: true }, { code: 'MODULE_OPERATIONS', quantity: 5, required: true }] },
  { code: 'BUSINESS', name: 'Business', description: 'Advanced operations, finance and connectivity for 51–100 room properties.', displayOrder: 3, metadata: { maxProperties: 3, maxRooms: 100, maxUsers: 60, maxOutlets: null, maxIntegrations: 10, maxTerminals: null, version: CATALOG_VERSION }, products: [{ code: 'PLAN_BUSINESS', quantity: 100, required: true }, { code: 'MODULE_PMS', quantity: 100, required: true }, { code: 'MODULE_OPERATIONS', quantity: null, required: true }, { code: 'MODULE_ENTERPRISE', quantity: 10, required: true }] },
  { code: 'ENTERPRISE', name: 'Enterprise', description: 'Central control, reporting and governance for property groups.', displayOrder: 4, metadata: { maxProperties: null, maxRooms: null, maxUsers: null, maxOutlets: null, maxIntegrations: null, maxTerminals: null, version: CATALOG_VERSION }, products: [{ code: 'PLAN_ENTERPRISE', quantity: null, required: true }, { code: 'MODULE_PMS', quantity: null, required: true }, { code: 'MODULE_OPERATIONS', quantity: null, required: true }, { code: 'MODULE_ENTERPRISE', quantity: null, required: true }] },
  { code: 'ENTERPRISE_PLUS', name: 'Enterprise Plus', description: 'Custom operating model for 250+ room groups and complex portfolios.', displayOrder: 5, metadata: { maxProperties: null, maxRooms: null, maxUsers: null, maxOutlets: null, maxIntegrations: null, maxTerminals: null, customPricing: true, version: CATALOG_VERSION }, products: [{ code: 'PLAN_ENTERPRISE_PLUS', quantity: null, required: true }, { code: 'MODULE_PMS', quantity: null, required: true }, { code: 'MODULE_OPERATIONS', quantity: null, required: true }, { code: 'MODULE_ENTERPRISE', quantity: null, required: true }] },
];

export const legacyProductCodes = ['CORE_PMS', 'PROFESSIONAL_OPERATIONS', 'ENTERPRISE_PLATFORM'] as const;
export const legacyToCanonical = { CORE_PMS: 'MODULE_PMS', PROFESSIONAL_OPERATIONS: 'MODULE_OPERATIONS', ENTERPRISE_PLATFORM: 'MODULE_ENTERPRISE' } as const;

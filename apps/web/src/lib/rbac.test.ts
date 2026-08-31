import { expect, test, vi } from 'vitest';
import { hasPermission } from './rbac';

// Mock the prisma client
vi.mock('@hotel-pms/db', () => {
  return {
    default: {
      user: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === 'superadmin') {
            return Promise.resolve({ isSuperAdmin: true });
          }
          if (where.id === 'normaluser') {
            return Promise.resolve({ isSuperAdmin: false });
          }
          return Promise.resolve(null);
        }),
      },
      userRole: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          if (where.userId === 'normaluser') {
            return Promise.resolve([
              {
                role: {
                  permissions: [
                    {
                      permission: { resource: 'reservation', action: 'create' },
                    },
                  ],
                },
              },
            ]);
          }
          return Promise.resolve([]);
        }),
      },
    },
  };
});

test('Super admin requires a property-scoped organization context', async () => {
  const result = await hasPermission('superadmin', 'anything', 'anyaction');
  expect(result).toBe(false);
});

test('Normal user with specific permission', async () => {
  const result = await hasPermission('normaluser', 'reservation', 'create');
  expect(result).toBe(true);
});

test('Normal user without specific permission', async () => {
  const result = await hasPermission('normaluser', 'reservation', 'delete');
  expect(result).toBe(false);
});

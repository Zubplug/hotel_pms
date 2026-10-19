import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activateTrial,
  expireTrial,
  hasOperationalSubscription,
  markTrialConverted,
  subscriptionAccessEndsAt,
  trialEndsAt,
  TrialAlreadyUsedError,
  TrialIdempotencyConflictError,
} from '../src/trials';

const start = new Date('2026-10-20T09:00:00.000Z');

test('trial expiry is exactly 168 hours after activation', () => {
  assert.equal(trialEndsAt(start).toISOString(), '2026-10-27T09:00:00.000Z');
});

test('trial access uses trialEndsAt and rejects expired trials independently of cron', () => {
  const subscription = {
    status: 'TRIALING',
    trialEndsAt: new Date('2026-10-27T09:00:00.000Z'),
    currentPeriodEnd: new Date('2026-11-20T09:00:00.000Z'),
  };
  assert.equal(subscriptionAccessEndsAt(subscription).toISOString(), '2026-10-27T09:00:00.000Z');
  assert.equal(hasOperationalSubscription(subscription, new Date('2026-10-27T08:59:59.999Z')), true);
  assert.equal(hasOperationalSubscription(subscription, new Date('2026-10-27T09:00:00.000Z')), false);
});

function fakeDb() {
  let history: any = null;
  let subscriptionCount = 0;
  const plan = {
    id: 'plan-essential',
    code: 'ESSENTIAL',
    active: true,
    items: [{ product: { prices: [{ id: 'price-starter-month', interval: 'month' }] } }],
  };
  const tx: any = {
    trialHistory: {
      findUnique: async () => history ? { ...history, subscription: history.subscription } : null,
      create: async ({ data }: any) => {
        if (history) throw { code: 'P2002' };
        history = { ...data, metadata: data.metadata ?? null, subscription: createdSubscription };
        return history;
      },
    },
    billingPlan: { findUnique: async () => plan },
    subscription: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        subscriptionCount += 1;
        createdSubscription = { id: `subscription-${subscriptionCount}`, ...data };
        return createdSubscription;
      },
    },
  };
  let createdSubscription: any = null;
  return {
    tx,
    db: { $transaction: async (callback: (transaction: any) => Promise<unknown>) => callback(tx) } as any,
    get history() { return history; },
    get subscriptionCount() { return subscriptionCount; },
  };
}

test('activation is idempotent for the same request key', async () => {
  const fake = fakeDb();
  const first: any = await activateTrial(fake.db, { organizationId: 'org-1', idempotencyKey: 'request-1', now: start });
  const second: any = await activateTrial(fake.db, { organizationId: 'org-1', idempotencyKey: 'request-1', now: start });
  assert.equal(first.id, second.id);
  assert.equal(fake.subscriptionCount, 1);
});

test('activation rejects a second trial for the same organization', async () => {
  const fake = fakeDb();
  await activateTrial(fake.db, { organizationId: 'org-1', idempotencyKey: 'request-1', now: start });
  await assert.rejects(
    activateTrial(fake.db, { organizationId: 'org-1', idempotencyKey: 'request-2', now: start }),
    TrialAlreadyUsedError,
  );
  assert.equal(fake.subscriptionCount, 1);
});

test('reusing an idempotency key for another plan is rejected', async () => {
  const fake = fakeDb();
  await activateTrial(fake.db, { organizationId: 'org-1', planCode: 'ESSENTIAL', idempotencyKey: 'request-1', now: start });
  await assert.rejects(
    activateTrial(fake.db, { organizationId: 'org-1', planCode: 'PROFESSIONAL', idempotencyKey: 'request-1', now: start }),
    TrialIdempotencyConflictError,
  );
});

test('expiration transition is conditional and idempotent', async () => {
  let status = 'TRIALING';
  let historyStatus = 'STARTED';
  const db: any = {
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
      subscription: {
        updateMany: async ({ where }: any) => {
          if (status !== where.status || where.trialEndsAt.lte > new Date('2026-10-27T09:00:00.000Z')) return { count: 0 };
          status = 'EXPIRED';
          return { count: 1 };
        },
      },
      trialHistory: {
        updateMany: async () => { historyStatus = 'EXPIRED'; return { count: 1 }; },
      },
    }),
    trialHistory: {
      updateMany: async ({ data }: any) => {
        if (historyStatus !== 'STARTED') return { count: 0 };
        historyStatus = data.status;
        return { count: 1 };
      },
    },
  };
  assert.equal(await expireTrial(db, { subscriptionId: 'subscription-1', now: new Date('2026-10-27T09:00:00.000Z') }), true);
  assert.equal(await expireTrial(db, { subscriptionId: 'subscription-1', now: new Date('2026-10-27T09:00:01.000Z') }), false);
});

test('conversion closes trial history once', async () => {
  let status = 'STARTED';
  const db: any = { trialHistory: { updateMany: async ({ data }: any) => status === 'STARTED' ? (status = data.status, { count: 1 }) : { count: 0 } } };
  assert.equal(await markTrialConverted(db, { subscriptionId: 'subscription-1', now: start }), true);
  assert.equal(await markTrialConverted(db, { subscriptionId: 'subscription-1', now: start }), false);
});

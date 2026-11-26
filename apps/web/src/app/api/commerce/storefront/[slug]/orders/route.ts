/**
 * POST /api/commerce/storefront/[slug]/orders
 *
 * Public, unauthenticated — places a new food order.
 *
 * Idempotency: Pass X-Idempotency-Key header. Duplicate requests with the
 * same key within 24h return the existing order rather than creating a new one.
 *
 * Flow:
 *   1. Validate store is ACTIVE and has either Food Commerce package.
 *   2. Resolve/create CommerceCustomer by phone number.
 *   3. Build order with price snapshot from current product prices.
 *   4. Create CommerceOrder (status: PENDING_PAYMENT) + CommercePayment.
 *   5. For PAY_ON_DELIVERY/PICKUP: immediately move to AWAITING_RESTAURANT
 *      and enqueue CommerceSyncEvent for POS.
 *   6. For ONLINE: return Paystack/Flutterwave payment initiation URL.
 */

import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { Prisma } from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { z } from 'zod';
import { generateOrderRef, generateTrackingToken } from '@/lib/commerce/order-utils';
import { enqueueCommerceSyncEvent } from '@/lib/commerce/sync';
import { sendOrderNotification } from '@/lib/commerce/notifications';
import { hasPublicCommerceAccess } from '@/lib/commerce/public-access';

type Params = { params: Promise<{ slug: string }> };

const orderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(50),
  selectedModifiers: z
    .array(
      z.object({
        groupName: z.string(),
        optionName: z.string(),
      }),
    )
    .default([]),
  modifierOptionIds: z.array(z.string().uuid()).default([]),
  specialNote: z.string().max(500).optional(),
});

const placeOrderSchema = z.object({
  customer: z.object({
    name: z.string().min(1).max(100),
    phone: z.string().min(7).max(20),
    email: z.string().email().optional(),
    consentToWhatsapp: z.boolean().optional().default(false),
  }),
  orderType: z.enum(['DELIVERY', 'PICKUP']),
  fulfillmentType: z.enum(['NOW', 'SCHEDULED']).default('NOW'),
  scheduledFor: z.string().datetime().optional(),
  deliveryAddress: z
    .object({
      street: z.string(),
      city: z.string(),
      state: z.string().optional(),
      notes: z.string().optional(),
    })
    .optional(),
  deliveryNotes: z.string().max(500).optional(),
  items: z.array(orderItemSchema).min(1).max(50),
  paymentMethod: z.enum(['ONLINE', 'PAY_ON_DELIVERY', 'PAY_ON_PICKUP']),
  promotionCode: z.string().optional(),
  specialInstructions: z.string().max(1000).optional(),
  groupOrderSessionId: z.string().uuid().optional(),
  mealPassId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;

    // Idempotency
    const idempotencyKey = req.headers.get('x-idempotency-key');
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 200) {
      return errorResponse('IDEMPOTENCY_KEY_REQUIRED', 'A stable checkout idempotency key is required.', 422);
    }

    // Fetch store
    const store = await prisma.commerceStore.findUnique({
      where: { slug },
      select: {
        id: true,
        organizationId: true,
        targetOutletId: true,
        propertyId: true,
        status: true,
        currency: true,
        deliveryEnabled: true,
        pickupEnabled: true,
        deliveryFee: true,
        deliveryFeeMode: true,
        freeDeliveryAbove: true,
        minimumOrderAmount: true,
        allowOnlinePayment: true,
        allowPayOnDelivery: true,
        allowPayOnPickup: true,
        preferredGateway: true,
        paystackPublicKey: true,
        flutterwavePublicKey: true,
        notifySmsEnabled: true,
        notifyEmailEnabled: true,
      },
    });

    if (!store) return errorResponse('NOT_FOUND', 'Store not found', 404);
    if (!(await hasPublicCommerceAccess(store.organizationId, store.propertyId))) {
      return errorResponse('STORE_UNAVAILABLE', 'Online ordering is temporarily unavailable.', 503);
    }
    if (store.status !== 'ACTIVE') {
      return errorResponse('STORE_UNAVAILABLE', 'This store is not currently accepting orders.', 503);
    }

    // Check the checkout idempotency boundary before any customer/order writes.
    const existingOrder = await prisma.commerceOrder.findFirst({
      where: { storeId: store.id, clientIdempotencyKey: idempotencyKey },
      select: { orderRef: true, status: true, totalAmount: true, trackingToken: true, paymentStatus: true },
    });
    if (existingOrder) {
      return successResponse({ duplicate: true, ...existingOrder }, 200);
    }

    // Parse and validate body
    const body = await req.json();
    const data = placeOrderSchema.parse(body);

    // Validate fulfillment type compatibility
    if (data.orderType === 'DELIVERY' && !store.deliveryEnabled) {
      return errorResponse('DELIVERY_UNAVAILABLE', 'Delivery is not available for this store.', 422);
    }
    if (data.orderType === 'PICKUP' && !store.pickupEnabled) {
      return errorResponse('PICKUP_UNAVAILABLE', 'Pickup is not available for this store.', 422);
    }
    if (data.paymentMethod === 'ONLINE' && !store.allowOnlinePayment) {
      return errorResponse('PAYMENT_METHOD_UNAVAILABLE', 'Online payment is not available for this store.', 422);
    }
    if (data.paymentMethod === 'PAY_ON_DELIVERY' && !store.allowPayOnDelivery) {
      return errorResponse('PAYMENT_METHOD_UNAVAILABLE', 'Pay on delivery is not available for this store.', 422);
    }
    if (data.paymentMethod === 'PAY_ON_PICKUP' && !store.allowPayOnPickup) {
      return errorResponse('PAYMENT_METHOD_UNAVAILABLE', 'Pay on pickup is not available for this store.', 422);
    }
    if (data.orderType === 'DELIVERY' && !data.deliveryAddress) {
      return errorResponse('MISSING_DELIVERY_ADDRESS', 'A delivery address is required for delivery orders.', 422);
    }

    // Resolve products + validate they belong to this store
    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.commerceProduct.findMany({
      where: { id: { in: productIds }, storeId: store.id, isActive: true },
      include: {
        modifierGroups: {
          where: { options: { some: { isActive: true } } },
          include: { options: { where: { isActive: true } } },
        },
      },
    });

    if (products.length !== productIds.length) {
      return errorResponse('INVALID_ITEMS', 'One or more products are unavailable or not found.', 422);
    }

    // Check Chef's Special stock
    for (const product of products) {
      if (product.availableQuantity !== null && product.availableQuantity <= 0) {
        return errorResponse(
          'OUT_OF_STOCK',
          `"${product.name}" is sold out. Please remove it from your order.`,
          422,
        );
      }
    }

    // Build order items + calculate totals
    const productMap = new Map(products.map((p) => [p.id, p]));
    let subtotal = 0;

    const builtItems = data.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const groupsByName = new Map(product.modifierGroups.map((group) => [group.name, group]));
      const requestedModifiers = item.selectedModifiers.length > 0
        ? item.selectedModifiers.map((selected) => ({ groupName: selected.groupName, optionName: selected.optionName }))
        : item.modifierOptionIds.map((optionId) => {
            const match = product.modifierGroups
              .flatMap((group) => group.options.map((option) => ({ group, option })))
              .find(({ option }) => option.id === optionId);
            return match
              ? { groupName: match.group.name, optionName: match.option.name }
              : { groupName: '', optionName: '' };
          });
      const selectedModifiers = requestedModifiers.map((selected) => {
        const group = groupsByName.get(selected.groupName);
        const option = group?.options.find((candidate) => candidate.name === selected.optionName);
        if (!group || !option) {
          throw new Error(`INVALID_MODIFIER:${product.name}`);
        }
        return {
          groupName: group.name,
          optionName: option.name,
          priceAdjustment: Number(option.priceAdjustment),
        };
      });

      for (const group of product.modifierGroups) {
        const selectedCount = selectedModifiers.filter((selected) => selected.groupName === group.name).length;
        const minimum = group.isRequired ? Math.max(1, group.minSelect) : group.minSelect;
        if (selectedCount < minimum || (group.maxSelect !== null && selectedCount > group.maxSelect)) {
          throw new Error(`INVALID_MODIFIER_SELECTION:${product.name}`);
        }
      }

      const modifierTotal = selectedModifiers.reduce((sum, modifier) => sum + modifier.priceAdjustment, 0);
      const unitPrice = Number(product.price) + modifierTotal;
      const totalPrice = unitPrice * item.quantity;
      subtotal += totalPrice;

      return {
        productId: item.productId,
        productName: product.name,
        productImageUrl: product.imageUrl,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        selectedModifiers,
        specialNote: item.specialNote,
      };
    });

    // Apply promotion if provided
    let discountAmount = 0;
    let promotionId: string | undefined;
    if (data.promotionCode) {
      const promo = await prisma.commercePromotion.findFirst({
        where: {
          storeId: store.id,
          code: data.promotionCode.toUpperCase(),
          isActive: true,
          validFrom: { lte: new Date() },
          validTo: { gte: new Date() },
        },
      });

      if (promo) {
        const meetsMinimum =
          !promo.minimumOrderAmount ||
          subtotal >= Number(promo.minimumOrderAmount);

        if (meetsMinimum && (!promo.maxUsesTotal || promo.usedCount < promo.maxUsesTotal)) {
          promotionId = promo.id;
          if (promo.type === 'PERCENTAGE') {
            discountAmount = subtotal * (Number(promo.value) / 100);
          } else if (promo.type === 'FLAT') {
            discountAmount = Math.min(Number(promo.value), subtotal);
          } else if (promo.type === 'FREE_DELIVERY') {
            // Applied to deliveryFee below
          }
        }
      }
    }

    // Check minimum order
    if (subtotal - discountAmount < Number(store.minimumOrderAmount)) {
      return errorResponse(
        'BELOW_MINIMUM',
        `Minimum order amount is ${store.currency} ${Number(store.minimumOrderAmount).toLocaleString()}.`,
        422,
      );
    }

    // Calculate delivery fee
    let deliveryFee = 0;
    if (data.orderType === 'DELIVERY') {
      deliveryFee = Number(store.deliveryFee);
      if (store.freeDeliveryAbove && subtotal >= Number(store.freeDeliveryAbove)) {
        deliveryFee = 0;
      }
      // Check if promo is FREE_DELIVERY
      if (promotionId) {
        const promo = await prisma.commercePromotion.findUnique({ where: { id: promotionId } });
        if (promo?.type === 'FREE_DELIVERY') deliveryFee = 0;
      }
    }

    const totalAmount = subtotal - discountAmount + deliveryFee;
    const orderRef = await generateOrderRef();
    const trackingToken = generateTrackingToken();

    // Resolve or create customer
    const customer = await prisma.commerceCustomer.upsert({
      where: { storeId_phone: { storeId: store.id, phone: data.customer.phone } },
      update: {
        name: data.customer.name,
        email: data.customer.email ?? undefined,
        ...(data.customer.email ? { email: data.customer.email } : {}),
        ...(data.customer.consentToWhatsapp !== undefined
          ? { consentToWhatsapp: data.customer.consentToWhatsapp, consentRecordedAt: new Date() }
          : {}),
      },
      create: {
        storeId: store.id,
        name: data.customer.name,
        phone: data.customer.phone,
        email: data.customer.email,
        consentToWhatsapp: data.customer.consentToWhatsapp ?? false,
        consentRecordedAt: new Date(),
      },
    });

    const isPayLater =
      data.paymentMethod === 'PAY_ON_DELIVERY' ||
      data.paymentMethod === 'PAY_ON_PICKUP';

    // Create order in a transaction
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.commerceOrder.create({
        data: {
          storeId: store.id,
          customerId: customer.id,
          orderRef,
          clientIdempotencyKey: idempotencyKey,
          trackingToken,
          status: isPayLater ? 'AWAITING_RESTAURANT' : 'PENDING_PAYMENT',
          orderType: data.orderType,
          fulfillmentType: data.fulfillmentType,
          scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
          deliveryAddress: data.deliveryAddress ?? Prisma.JsonNull,
          deliveryNotes: data.deliveryNotes,
          subtotal,
          deliveryFee,
          discountAmount,
          taxAmount: 0,
          totalAmount,
          currency: store.currency,
          paymentMethod: data.paymentMethod,
          paymentStatus: isPayLater ? 'PENDING' : 'PENDING',
          specialInstructions: data.specialInstructions,
          promotionId: promotionId ?? null,
          groupOrderSessionId: data.groupOrderSessionId ?? null,
          posSyncStatus: 'PENDING',
          items: {
            create: builtItems,
          },
          payment: {
            create: {
              storeId: store.id,
              provider: isPayLater ? data.paymentMethod : store.preferredGateway,
              amount: totalAmount,
              currency: store.currency,
              status: 'PENDING',
            },
          },
        },
        include: {
          items: true,
          payment: true,
        },
      });

      // Decrement Chef's Special stock
      for (const item of data.items) {
        const product = productMap.get(item.productId)!;
        if (product.isChefSpecial && product.availableQuantity !== null) {
          await tx.commerceProduct.update({
            where: { id: item.productId },
            data: {
              availableQuantity: { decrement: item.quantity },
              soldCount: { increment: item.quantity },
            },
          });
        }
      }

      // Update promotion usedCount
      if (promotionId) {
        await tx.commercePromotion.update({
          where: { id: promotionId },
          data: { usedCount: { increment: 1 } },
        });
      }

      // Update customer order stats
      await tx.commerceCustomer.update({
        where: { id: customer.id },
        data: {
          orderCount: { increment: 1 },
          totalSpend: { increment: isPayLater ? totalAmount : 0 },
          deliveryAddress: data.deliveryAddress ?? undefined,
        },
      });

      return newOrder;
    });

    // For pay-later orders: enqueue CommerceSyncEvent immediately
    if (isPayLater && store.targetOutletId) {
      await enqueueCommerceSyncEvent({
        order,
        store,
        idempotencyKey: idempotencyKey ?? `order-${order.id}`,
      });

      // Notify customer
      await sendOrderNotification({
        orderId: order.id,
        storeId: store.id,
        event: 'ORDER_PLACED',
        customer: { name: customer.name, phone: customer.phone, email: customer.email ?? undefined },
        store: { notifySmsEnabled: store.notifySmsEnabled, notifyEmailEnabled: store.notifyEmailEnabled },
      });
    }

    const responsePayload = {
      orderRef: order.orderRef,
      trackingToken: order.trackingToken,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: order.currency,
      paymentMethod: order.paymentMethod,
      // For online payments, the payment initiation URL is fetched separately
      // via POST /payment/initiate after this response
      nextStep: isPayLater ? 'ORDER_CONFIRMED' : 'INITIATE_PAYMENT',
    };

    return successResponse(responsePayload, 201);
  } catch (err) {
    if (err instanceof Error && err.name === 'ZodError') {
      return errorResponse('VALIDATION_ERROR', 'Invalid request data', 422, err);
    }
    if (err instanceof Error && (err.message.startsWith('INVALID_MODIFIER') || err.message.startsWith('INVALID_MODIFIER_SELECTION'))) {
      return errorResponse('INVALID_MODIFIERS', 'One or more selected modifiers are unavailable or invalid.', 422);
    }
    console.error('[commerce/storefront/orders POST]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}

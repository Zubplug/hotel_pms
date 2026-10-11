import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

// GET /api/v1/room-service/menu?propertyId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return errorResponse('BAD_REQUEST', 'propertyId is required', 400);
    }

    // Find active outlets for this property
    const outlets = await prisma.posOutlet.findMany({
      where: {
        propertyId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        type: true,
      },
    });

    if (outlets.length === 0) {
      return successResponse({
        outlets: [],
        categories: [],
        amenities: [],
      });
    }

    // Determine target outlets: prefer ROOM_SERVICE outlet, otherwise include RESTAURANT / BAR / CAFE
    const roomServiceOutlet = outlets.find(o => o.type === 'ROOM_SERVICE');
    const targetOutletIds = roomServiceOutlet
      ? [roomServiceOutlet.id]
      : outlets.map(o => o.id);

    // Fetch categories and products
    const categories = await prisma.productCategory.findMany({
      where: {
        outletId: { in: targetOutletIds },
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          where: { isActive: true },
          include: {
            modifiers: {
              where: { isActive: true },
            },
          },
        },
      },
    });

    // Format products for clean mobile consumption
    const formattedCategories = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      outletId: cat.outletId,
      productionStation: cat.productionStation,
      products: cat.products.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: Number(p.price),
        taxRate: Number(p.taxRate || 0),
        image: p.image || null,
        productionStation: p.productionStation || cat.productionStation,
        hasModifiers: p.modifiers.length > 0,
        modifiers: p.modifiers.map(m => ({
          id: m.id,
          name: m.name,
          price: Number(m.price),
          groupName: m.groupName || 'Options',
          groupRequired: m.groupRequired,
          groupMaxSelect: m.groupMaxSelect,
        })),
      })),
    })).filter(c => c.products.length > 0);

    // Standard complimentary & requestable room amenities
    const standardAmenities = [
      {
        id: 'amenity_towels',
        name: 'Fresh Towel Set',
        category: 'Housekeeping',
        description: 'Set of fresh bath sheets, hand towels, and bath mat.',
        price: 0,
        type: 'AMENITY',
        serviceType: 'EXTRA_BED', // or SPECIAL_REQUEST
        icon: 'bath',
      },
      {
        id: 'amenity_pillows',
        name: 'Extra Feather Pillows',
        category: 'Housekeeping',
        description: 'Two hypoallergenic soft feather pillows with fresh cases.',
        price: 0,
        type: 'AMENITY',
        serviceType: 'SPECIAL_REQUEST',
        icon: 'bed',
      },
      {
        id: 'amenity_dental',
        name: 'Dental & Shaving Kit',
        category: 'Toiletries',
        description: 'Eco-friendly bamboo toothbrush, paste, and shaving cream kit.',
        price: 0,
        type: 'AMENITY',
        serviceType: 'SPECIAL_REQUEST',
        icon: 'sparkles',
      },
      {
        id: 'amenity_water',
        name: 'Complimentary Bottled Water',
        category: 'In-Room Refreshments',
        description: '2 bottles of premium spring water.',
        price: 0,
        type: 'AMENITY',
        serviceType: 'SPECIAL_REQUEST',
        icon: 'cup',
      },
      {
        id: 'amenity_laundry_bag',
        name: 'Express Laundry Pickup',
        category: 'Valet & Laundry',
        description: 'Valet collection of garments for same-day wash and press.',
        price: 0,
        type: 'SERVICE',
        serviceType: 'LAUNDRY',
        icon: 'shirt',
      },
      {
        id: 'amenity_wakeup',
        name: 'Morning Wake-Up Call',
        category: 'Front Desk',
        description: 'Scheduled front desk personalized morning call.',
        price: 0,
        type: 'SERVICE',
        serviceType: 'WAKE_UP_CALL',
        icon: 'alarm',
      },
    ];

    return successResponse({
      outlets: outlets.map(o => ({ id: o.id, name: o.name, type: o.type })),
      preferredOutletId: roomServiceOutlet ? roomServiceOutlet.id : outlets[0]?.id,
      categories: formattedCategories,
      amenities: standardAmenities,
    });
  } catch (err: any) {
    console.error('[GET /api/v1/room-service/menu]', err);
    return errorResponse('INTERNAL_ERROR', err?.message || 'Failed to fetch room service menu', 500);
  }
}

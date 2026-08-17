import { PrismaClient, UnitOfMeasure } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding POS Production Data...');

  // 1. Get the primary property
  const property = await prisma.property.findFirst();
  if (!property) {
    throw new Error('No property found in production. Cannot seed POS data.');
  }

  // 2. Setup Warehouse for POS Stock
  let warehouse = await prisma.warehouse.findFirst({
    where: { propertyId: property.id, name: 'Main Kitchen Store' }
  });

  if (!warehouse) {
    warehouse = await prisma.warehouse.create({
      data: {
        propertyId: property.id,
        name: 'Main Kitchen Store',
        location: 'Ground Floor Kitchen',
        isActive: true,
      }
    });
    console.log('Created Main Kitchen Store warehouse.');
  }

  // 3. Create Stock Items (Ingredients)
  const ingredients = [
    { name: 'Beef Patty', sku: 'ING-BEEF', baseUnit: UnitOfMeasure.PIECE, costPrice: 800 },
    { name: 'Burger Bun', sku: 'ING-BUN', baseUnit: UnitOfMeasure.PIECE, costPrice: 200 },
    { name: 'Lettuce', sku: 'ING-LET', baseUnit: UnitOfMeasure.KG, costPrice: 1500 },
    { name: 'Coca Cola 50cl', sku: 'ING-COKE', baseUnit: UnitOfMeasure.BOTTLE, costPrice: 300 },
    { name: 'Premium Steak', sku: 'ING-STEAK', baseUnit: UnitOfMeasure.KG, costPrice: 15000 },
    { name: 'Fries', sku: 'ING-FRIES', baseUnit: UnitOfMeasure.KG, costPrice: 2000 },
  ];

  const stockItemMap = new Map();

  for (const ing of ingredients) {
    let stockItem = await prisma.stockItem.findFirst({
      where: { propertyId: property.id, sku: ing.sku }
    });

    if (!stockItem) {
      stockItem = await prisma.stockItem.create({
        data: {
          propertyId: property.id,
          warehouseId: warehouse.id,
          name: ing.name,
          sku: ing.sku,
          baseUnit: ing.baseUnit,
          costPrice: ing.costPrice,
          quantityOnHand: 100, // Initial stock
          isActive: true
        }
      });
      console.log(`Created Stock Item: ${ing.name}`);
    }
    stockItemMap.set(ing.sku, stockItem.id);
  }

  // 4. Create POS Outlet
  let outlet = await prisma.posOutlet.findFirst({
    where: { propertyId: property.id, name: 'LodgeCore Main Restaurant' }
  });

  if (!outlet) {
    outlet = await prisma.posOutlet.create({
      data: {
        propertyId: property.id,
        name: 'LodgeCore Main Restaurant',
        type: 'RESTAURANT',
        isActive: true
      }
    });
    console.log('Created LodgeCore Main Restaurant outlet.');
  }

  // 5. Create Floor Plan & Tables
  let floorPlan = await prisma.posFloorPlan.findFirst({
    where: { outletId: outlet.id, name: 'Main Dining Room' }
  });

  if (!floorPlan) {
    floorPlan = await prisma.posFloorPlan.create({
      data: {
        outletId: outlet.id,
        name: 'Main Dining Room',
        isActive: true
      }
    });

    // Create some tables
    await prisma.posTable.createMany({
      data: [
        { floorPlanId: floorPlan.id, name: 'T1', capacity: 2, positionX: 100, positionY: 100 },
        { floorPlanId: floorPlan.id, name: 'T2', capacity: 2, positionX: 250, positionY: 100 },
        { floorPlanId: floorPlan.id, name: 'T3', capacity: 4, positionX: 100, positionY: 250 },
        { floorPlanId: floorPlan.id, name: 'T4', capacity: 4, positionX: 250, positionY: 250 },
        { floorPlanId: floorPlan.id, name: 'T5', capacity: 6, positionX: 400, positionY: 150 },
      ]
    });
    console.log('Created Floor Plan and 5 Tables.');
  }

  // 6. Create Categories
  const categoriesData = [
    { name: 'Starters', sortOrder: 1 },
    { name: 'Mains', sortOrder: 2 },
    { name: 'Desserts', sortOrder: 3 },
    { name: 'Beverages', sortOrder: 4 },
  ];

  const categoryMap = new Map();

  for (const cat of categoriesData) {
    let category = await prisma.productCategory.findFirst({
      where: { outletId: outlet.id, name: cat.name }
    });

    if (!category) {
      category = await prisma.productCategory.create({
        data: {
          outletId: outlet.id,
          name: cat.name,
          sortOrder: cat.sortOrder,
          isActive: true
        }
      });
      console.log(`Created Category: ${cat.name}`);
    }
    categoryMap.set(cat.name, category.id);
  }

  // 7. Create Products & Recipes
  const productsData = [
    {
      name: 'Classic Cheeseburger',
      category: 'Mains',
      price: 5500,
      taxRate: 7.5,
      ingredients: [
        { sku: 'ING-BEEF', qty: 1, uom: UnitOfMeasure.PIECE },
        { sku: 'ING-BUN', qty: 1, uom: UnitOfMeasure.PIECE },
        { sku: 'ING-LET', qty: 0.05, uom: UnitOfMeasure.KG },
      ]
    },
    {
      name: 'Premium Ribeye Steak',
      category: 'Mains',
      price: 25000,
      taxRate: 7.5,
      ingredients: [
        { sku: 'ING-STEAK', qty: 0.3, uom: UnitOfMeasure.KG },
        { sku: 'ING-FRIES', qty: 0.2, uom: UnitOfMeasure.KG },
      ]
    },
    {
      name: 'Chilled Coca-Cola',
      category: 'Beverages',
      price: 1000,
      taxRate: 7.5,
      ingredients: [
        { sku: 'ING-COKE', qty: 1, uom: UnitOfMeasure.BOTTLE }
      ]
    },
    {
      name: 'French Fries Side',
      category: 'Starters',
      price: 2500,
      taxRate: 7.5,
      ingredients: [
        { sku: 'ING-FRIES', qty: 0.25, uom: UnitOfMeasure.KG }
      ]
    }
  ];

  for (const prod of productsData) {
    let product = await prisma.posProduct.findFirst({
      where: { propertyId: property.id, name: prod.name }
    });

    if (!product) {
      product = await prisma.posProduct.create({
        data: {
          propertyId: property.id,
          categoryId: categoryMap.get(prod.category),
          name: prod.name,
          price: prod.price,
          taxRate: prod.taxRate,
          isActive: true
        }
      });
      console.log(`Created Product: ${prod.name}`);

      // Add Recipe Ingredients
      for (const ing of prod.ingredients) {
        await prisma.recipeIngredient.create({
          data: {
            productId: product.id,
            stockItemId: stockItemMap.get(ing.sku),
            quantity: ing.qty,
            unitOfMeasure: ing.uom
          }
        });
      }
    }
  }

  console.log('\n✅ POS Production Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

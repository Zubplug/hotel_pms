import { PrismaClient, FnbClass, ProductionStation } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORY_NAME = 'Guest Complementary Food';
const PRICE = 3000;

const MENU_ITEMS = [
  {
    name: 'Spaghetti, Boiled Egg & Tea',
    description: 'Spaghetti served with boiled egg and tea.',
  },
  {
    name: 'Akara & Pap',
    description: 'Fresh akara served with pap.',
  },
  {
    name: 'Bread & Omelette & Tea',
    description: 'Bread and freshly prepared omelette served with tea.',
  },
  {
    name: 'Custard & Moi Moi',
    description: 'Custard served with moi moi.',
  },
  {
    name: 'Boiled Yam & Egg Sauce & Tea',
    description: 'Boiled yam and egg sauce served with tea.',
  },
] as const;

const LEGACY_NAMES: Record<string, string> = {
  'Bread & Omelette & Tea': 'Bread & Omelette',
  'Boiled Yam & Egg Sauce & Tea': 'Boiled Yam & Egg Sauce',
};

const TARGET_OUTLET_NAME = 'STANZELN GRAND RESORT - RESTAURANT & BAR';

const RECIPES: Record<string, Array<{ name: string; aliases?: string[]; quantity: number; unitOfMeasure: string }>> = {
  'Spaghetti, Boiled Egg & Tea': [
    { name: 'Raw Spaghetti', quantity: 0.15, unitOfMeasure: 'KG' },
    { name: 'Raw Egg', quantity: 1, unitOfMeasure: 'PIECE' },
    { name: 'Tea Bag', aliases: ['Lipton', 'Tea/ Coffee'], quantity: 1, unitOfMeasure: 'PIECE' },
  ],
  'Akara & Pap': [
    { name: 'Raw Beans', quantity: 0.12, unitOfMeasure: 'KG' },
    { name: 'Corn Flour', quantity: 0.1, unitOfMeasure: 'KG' },
  ],
  'Bread & Omelette & Tea': [
    { name: 'Bread (pain or toasted)', aliases: ['Bread Loaf', 'Tea/Coffee bread (plain or toasted)'], quantity: 2, unitOfMeasure: 'PIECE' },
    { name: 'Raw Egg', quantity: 2, unitOfMeasure: 'PIECE' },
    { name: 'Tea Bag', aliases: ['Lipton', 'Tea/ Coffee'], quantity: 1, unitOfMeasure: 'PIECE' },
  ],
  'Custard & Moi Moi': [
    { name: 'Custard Powder', quantity: 0.1, unitOfMeasure: 'KG' },
    { name: 'Raw Beans', quantity: 0.12, unitOfMeasure: 'KG' },
  ],
  'Boiled Yam & Egg Sauce & Tea': [
    { name: 'Raw Yam', quantity: 0.25, unitOfMeasure: 'KG' },
    { name: 'Raw Egg', quantity: 2, unitOfMeasure: 'PIECE' },
    { name: 'Tomato Paste', quantity: 0.03, unitOfMeasure: 'KG' },
    { name: 'Vegetable Oil', quantity: 0.02, unitOfMeasure: 'LITRE' },
    { name: 'Tea Bag', aliases: ['Lipton', 'Tea/ Coffee'], quantity: 1, unitOfMeasure: 'PIECE' },
  ],
};

async function findOrCreateKitchenStockItem(
  propertyId: string,
  warehouseId: string,
  definition: { name: string; aliases?: string[] },
  unitOfMeasure: string,
) {
  const names = [definition.name, ...(definition.aliases || [])];
  let stockItem = await prisma.stockItem.findFirst({
    where: {
      propertyId,
      warehouseId,
      isActive: true,
      name: { in: names },
    },
    select: { id: true, name: true, baseUnit: true },
  });

  if (!stockItem) {
    stockItem = await prisma.stockItem.create({
      data: {
        propertyId,
        warehouseId,
        name: definition.name,
        sku: `GCF-ING-${definition.name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
        baseUnit: unitOfMeasure as any,
        costPrice: 0,
        quantityOnHand: 0,
        isActive: true,
      },
      select: { id: true, name: true, baseUnit: true },
    });
    console.log(`Created missing kitchen stock item: ${definition.name} (${unitOfMeasure}).`);
  }

  if (stockItem.baseUnit !== unitOfMeasure) {
    throw new Error(`Recipe unit ${unitOfMeasure} does not match ${stockItem.name} base unit ${stockItem.baseUnit}.`);
  }

  return stockItem;
}

async function configureRecipe(propertyId: string, productId: string, productName: string, kitchenWarehouseId: string) {
  const recipeIngredients = RECIPES[productName];
  if (!recipeIngredients) return;

  const recipe = await prisma.recipe.upsert({
    where: { posProductId: productId },
    update: { propertyId, isActive: true, targetMargin: 70 },
    create: { propertyId, posProductId: productId, isActive: true, targetMargin: 70 },
  });
  const version = await prisma.recipeVersion.findFirst({
    where: { recipeId: recipe.id, versionName: 'Guest Complementary Food v1' },
    select: { id: true },
  });
  const activeVersion = version
    ? await prisma.recipeVersion.update({ where: { id: version.id }, data: { isActive: true } })
    : await prisma.recipeVersion.create({ data: { recipeId: recipe.id, versionName: 'Guest Complementary Food v1', isActive: true } });

  await prisma.recipeVersion.updateMany({
    where: { recipeId: recipe.id, id: { not: activeVersion.id } },
    data: { isActive: false },
  });
  await prisma.recipeIngredient.deleteMany({ where: { recipeVersionId: activeVersion.id } });

  const ingredients = [];
  for (const ingredient of recipeIngredients) {
    const stockItem = await findOrCreateKitchenStockItem(propertyId, kitchenWarehouseId, ingredient, ingredient.unitOfMeasure);
    ingredients.push({
      recipeVersionId: activeVersion.id,
      stockItemId: stockItem.id,
      quantity: ingredient.quantity,
      unitOfMeasure: ingredient.unitOfMeasure as any,
    });
  }
  await prisma.recipeIngredient.createMany({ data: ingredients });
}

async function main() {
  const propertyId = process.env.PROPERTY_ID?.trim();
  const outlets = await prisma.posOutlet.findMany({
    where: {
      isActive: true,
      type: { in: ['RESTAURANT', 'BAR'] },
      name: TARGET_OUTLET_NAME,
      ...(propertyId ? { propertyId } : {}),
    },
    select: { id: true, name: true, propertyId: true },
    orderBy: [{ propertyId: 'asc' }, { type: 'asc' }, { name: 'asc' }],
  });

  if (!outlets.length) {
    throw new Error(propertyId
      ? `No active ${TARGET_OUTLET_NAME} outlet found for property ${propertyId}.`
      : `No active ${TARGET_OUTLET_NAME} outlet found.`);
  }

  // Earlier runs could have created this category in other outlets. Keep those
  // records for auditability, but hide them so complementary food is available
  // only from the Stanzeln Grand Resort Restaurant & Bar outlet.
  const otherOutlets = await prisma.posOutlet.findMany({
    where: {
      isActive: true,
      type: { in: ['RESTAURANT', 'BAR'] },
      name: { not: TARGET_OUTLET_NAME },
      ...(propertyId ? { propertyId } : {}),
    },
    select: { id: true },
  });
  for (const otherOutlet of otherOutlets) {
    const otherCategory = await prisma.productCategory.findFirst({
      where: { outletId: otherOutlet.id, name: CATEGORY_NAME },
      select: { id: true },
    });
    if (!otherCategory) continue;
    await prisma.posProduct.updateMany({
      where: { categoryId: otherCategory.id, name: { in: MENU_ITEMS.map((item) => item.name) } },
      data: { isActive: false },
    });
    await prisma.productCategory.update({ where: { id: otherCategory.id }, data: { isActive: false } });
  }

  for (const outlet of outlets) {
    const existingCategory = await prisma.productCategory.findFirst({
      where: { outletId: outlet.id, name: CATEGORY_NAME },
      select: { id: true },
    });
    const category = existingCategory
      ? await prisma.productCategory.update({
          where: { id: existingCategory.id },
          data: {
            isActive: true,
            productionStation: ProductionStation.KITCHEN,
            fnbClass: FnbClass.FOOD,
          },
        })
      : await prisma.productCategory.create({
          data: {
            outletId: outlet.id,
            name: CATEGORY_NAME,
            isActive: true,
            sortOrder: 0,
            productionStation: ProductionStation.KITCHEN,
            fnbClass: FnbClass.FOOD,
          },
        });

    const shouldConfigureRecipes = outlet.name.trim().toUpperCase() === TARGET_OUTLET_NAME;
    const outletWarehouse = shouldConfigureRecipes
      ? await prisma.warehouse.findUnique({
          where: { posOutletId: outlet.id },
          select: { id: true, parentWarehouseId: true },
        })
      : null;
    const kitchenWarehouse = shouldConfigureRecipes
      ? await prisma.warehouse.findFirst({
          where: { propertyId: outlet.propertyId, name: 'Stanzel Main Kitchen Store', isActive: true },
          select: { id: true, parentWarehouseId: true },
        })
      : null;
    if (shouldConfigureRecipes && (!outletWarehouse || !outletWarehouse.parentWarehouseId)) {
      throw new Error(`${outlet.name} must be linked to an active parent warehouse before recipes are configured.`);
    }
    if (shouldConfigureRecipes && (!kitchenWarehouse || kitchenWarehouse.parentWarehouseId !== outletWarehouse?.parentWarehouseId)) {
      throw new Error('Stanzel Main Kitchen Store must be linked to the same main warehouse as the Restaurant & Bar outlet.');
    }

    for (const [index, item] of MENU_ITEMS.entries()) {
      let existing = await prisma.posProduct.findFirst({
        where: { categoryId: category.id, name: item.name },
        select: { id: true },
      });
      if (!existing && LEGACY_NAMES[item.name]) {
        existing = await prisma.posProduct.findFirst({
          where: { categoryId: category.id, name: LEGACY_NAMES[item.name] },
          select: { id: true },
        });
      }
      const itemCode = `GCF-${outlet.id.slice(0, 8).toUpperCase()}-${String(index + 1).padStart(2, '0')}`;
      const data = {
        name: item.name,
        description: item.description,
        price: PRICE,
        taxRate: 0,
        isActive: true,
        inventoryMode: shouldConfigureRecipes ? 'STOCK' : 'NON_STOCK',
        productionStation: ProductionStation.KITCHEN,
        itemCode,
      };

      let productId: string;
      if (existing) {
        const product = await prisma.posProduct.update({ where: { id: existing.id }, data, select: { id: true } });
        productId = product.id;
      } else {
        const product = await prisma.posProduct.create({
          data: { ...data, propertyId: outlet.propertyId, categoryId: category.id },
          select: { id: true },
        });
        productId = product.id;
      }

      if (shouldConfigureRecipes) {
        await configureRecipe(outlet.propertyId, productId, item.name, kitchenWarehouse!.id);
      }
    }

    console.log(`Configured ${CATEGORY_NAME} for ${outlet.name}: ${MENU_ITEMS.length} items at NGN ${PRICE.toLocaleString()}.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Replacing Dummy POS Data with STANZELN GRAND RESORT Menu...');

  const property = await prisma.property.findFirst();
  if (!property) {
    throw new Error('No property found in production.');
  }

  // 1. Delete previous dummy products and categories
  console.log('Cleaning up old POS products...');
  await prisma.recipeIngredient.deleteMany({});
  await prisma.posProduct.deleteMany({
    where: { propertyId: property.id }
  });
  
  let outlet = await prisma.posOutlet.findFirst({
    where: { propertyId: property.id }
  });

  if (!outlet) {
    outlet = await prisma.posOutlet.create({
      data: {
        propertyId: property.id,
        name: 'STANZELN GRAND RESORT - RESTAURANT & BAR',
        type: 'RESTAURANT',
        isActive: true
      }
    });
  } else {
    // Rename existing outlet to match the resort
    outlet = await prisma.posOutlet.update({
      where: { id: outlet.id },
      data: { name: 'STANZELN GRAND RESORT - RESTAURANT & BAR' }
    });
  }

  await prisma.productCategory.deleteMany({
    where: { outletId: outlet.id }
  });

  // 2. Define STANZELN Menu
  const menuCategories = [
    {
      name: 'Dessert / Snacks',
      sortOrder: 1,
      items: [
        { name: 'Fresh fruit Juice', price: 3000 },
        { name: 'Fruit Salad', price: 3000 },
        { name: 'Meat/Chicken pie/Fish roll', price: 1000 },
        { name: 'Tea/Coffee bread (plain or toasted)', price: 1800 },
        { name: 'Tea/ Coffee', price: 1200 },
        { name: 'Hot chocolate', price: 1500 },
        { name: 'Bread (pain or toasted)', price: 600 },
        { name: 'Cereal (cornflakes/Rice Krispies/ Oatmeal)', price: 2000 },
        { name: 'Eggs (poached/scrambled/boiled/omelette/sauce)', price: 1300 },
        { name: 'English breakfast (Tea/coffee,bread,eggs,sausages and baked beans)', price: 5500 },
        { name: 'Continental Breakfast (fruit juice, coffee/tea, fruit cereal & bread)', price: 7000 },
      ]
    },
    {
      name: 'Nigerian',
      sortOrder: 2,
      items: [
        { name: 'Akara with pap', price: 4000 },
        { name: 'Yam/plantain/potato: boiled/fried', price: 3000 },
        { name: 'Chicken Sauce', price: 4000 },
        { name: 'Kidney Sauce', price: 3500 },
        { name: 'EXTRAS: beef/chicken sausage, baked beans, pancake', price: 2500 },
        { name: 'Noodles', price: 3000 },
        { name: 'Spaghetti', price: 3000 },
      ]
    },
    {
      name: 'Salad',
      sortOrder: 3,
      items: [
        { name: 'Vegetables Salad', price: 5000 },
        { name: 'Chefs Salad', price: 6000 },
        { name: 'Mixed Vegetable salad', price: 6000 },
        { name: 'Main sized steak (served with fries)', price: 7000 },
        { name: 'Beef kebab (served with fries)', price: 7000 },
        { name: 'Chicken curry (served with basmati rice)', price: 8500 },
        { name: 'Grilled chicken breast (served with fried)', price: 8000 },
        { name: 'Fish (Grilled croaker served with fried & coleslaw)', price: 9000 },
        { name: 'Club sandwich (served with fried)', price: 17000 },
      ]
    },
    {
      name: 'Pasta & Rice Options',
      sortOrder: 4,
      items: [
        { name: 'Spaghetti Carbonara', price: 8000 },
        { name: 'Spaghetti Bolognaise', price: 8000 },
        { name: 'Chinese fried rice with chicken', price: 8500 },
        { name: 'Basmati rice', price: 6000 },
      ]
    },
    {
      name: 'Nigerian Hot Starter',
      sortOrder: 5,
      items: [
        { name: 'Goat meat pepper soup', price: 4000 },
        { name: 'Chicken pepper soup', price: 4000 },
        { name: 'Dry fish pepper soup', price: 4000 },
        { name: 'Catfish pepper soup', price: 5500 },
        { name: 'Croaker fish pepper soup', price: 5500 },
        { name: 'Snail pepper soup', price: 7000 },
        { name: 'Pepper Gizzard', price: 5500 },
        { name: 'Turkey pepper soup', price: 6500 },
      ]
    },
    {
      name: 'Nigerian Main Course',
      sortOrder: 6,
      items: [
        { name: 'Egusi+Semo/Garri with Goat Meat/Chicken/Beef', price: 8500 },
        { name: 'Ogbono+Semo/Garri with Goat Meat/Chicken/Beef', price: 8500 },
        { name: 'Vegetable Semo/Garri with Goat Meat/Chicken/Beef', price: 9000 },
        { name: 'Bitterleaf+Semo/Pando/wheat/Garri with Meat/Catfish', price: 9500 },
        { name: 'Egusi+Pando/Wheat with Goat Meat/Chicken/Beef/Catfish', price: 9500 },
        { name: 'Vegetable Pando/Wheat with Goat Meat/Chicken/Beef/Catfish', price: 9500 },
        { name: 'Ogbono+Pando/Wheat with Goat Meat/Chicken/Beef/Catfish', price: 9500 },
        { name: 'Rice (Fried, Jollof and White) with Goat meat/Catfish', price: 8500 },
        { name: 'Rice (Fried, Jollof and White) with Chicken', price: 7500 },
        { name: 'Rice (Fried, Jollof and White) with Beef', price: 8000 },
        { name: 'Indomie with Chicken', price: 6500 },
        { name: 'Indomie with Egg', price: 4500 },
        { name: 'Spaghetti with chicken', price: 6500 },
        { name: 'Spaghetti with Egg', price: 4500 },
      ]
    },
    {
      name: 'Nigerian Extra',
      sortOrder: 7,
      items: [
        { name: 'Soup', price: 3000 },
        { name: 'Stew', price: 3000 },
        { name: 'Swallow', price: 3000 },
        { name: 'Chicken/Beef/Goat meat (peppered/fried/etc)', price: 4000 },
        { name: 'Catfish/Gizzard/Cow leg', price: 5500 },
        { name: 'Croaker fish', price: 6000 },
        { name: 'Snail or Turkey', price: 6500 },
        { name: 'Fried, Jollof or white rice', price: 3000 },
        { name: 'Basmati rice', price: 4500 },
      ]
    },
    {
      name: 'Wines',
      sortOrder: 8,
      items: [
        { name: 'Rosso Nobile', price: 12000 },
        { name: 'Escudo Rojo', price: 12000 },
        { name: 'Drostdy-Hof (Large)', price: 16000 },
        { name: 'Carlo Rossi (white)', price: 15000 },
        { name: 'Le Filou', price: 12000 },
        { name: 'Two Oceans (White)', price: 12000 },
        { name: 'Nederburg', price: 12000 },
        { name: 'Gucci', price: 15000 },
        { name: 'Dorado', price: 15000 },
        { name: 'Don Felder', price: 12000 },
        { name: 'Louis Montfort', price: 12000 },
        { name: 'Merlot', price: 16000 },
        { name: 'Kagor', price: 16000 },
        { name: 'Chianti', price: 12000 },
        { name: 'Toma Toma', price: 12000 },
        { name: 'Frontera', price: 12000 },
        { name: 'Lombroso', price: 12000 },
        { name: 'Castillo', price: 12000 },
        { name: 'Bree Merlot', price: 15000 },
        { name: 'Mouton Cadet', price: 15000 },
        { name: '4th Street', price: 12000 },
        { name: 'Bacadolobo', price: 6500 },
      ]
    },
    {
      name: 'Sparkling Wines & Champagnes',
      sortOrder: 9,
      items: [
        { name: 'Veleta', price: 6000 },
        { name: 'Toma Classic', price: 5500 },
        { name: 'J & W', price: 5500 },
        { name: 'Light', price: 7000 },
        { name: 'Andre Rose', price: 22000 },
        { name: 'Mateus Rose', price: 12000 },
        { name: 'Pure Heaven', price: 5000 },
        { name: 'Eva', price: 6500 },
        { name: 'Chamdor', price: 10000 },
        { name: 'Moet', price: 120000 },
        { name: 'Vauve Clicquot', price: 115000 },
        { name: 'Bellair Rose', price: 50000 },
        { name: 'Eternity', price: 12000 },
      ]
    },
    {
      name: 'Spirit',
      sortOrder: 10,
      items: [
        { name: 'Origin Bitters (Pet)', price: 2500 },
        { name: 'Origin Bitters (large)', price: 12000 },
        { name: 'Odogwu Biters', price: 2500 },
        { name: 'Seagram (small)', price: 4000 },
        { name: 'Seagram (larger)', price: 12000 },
        { name: 'Smirnoff XI (small)', price: 4000 },
        { name: 'Smirnoff XI (Lager)', price: 12000 },
      ]
    },
    {
      name: 'Rum',
      sortOrder: 11,
      items: [
        { name: 'Barcardi Superior', price: 35000 },
        { name: 'Barcardi Gold', price: 35000 },
        { name: 'Barcardi Carta Oro', price: 30000 },
      ]
    },
    {
      name: 'Soft Drinks',
      sortOrder: 12,
      items: [
        { name: 'Soda (Pet)', price: 800 },
        { name: 'Guinness malt', price: 1000 },
        { name: 'Amstel Malt', price: 1000 },
        { name: 'Maltina', price: 1000 },
        { name: 'Fayrouz', price: 800 },
        { name: 'Juice', price: 2500 },
        { name: 'Hollandia', price: 2500 },
        { name: '5 Alive pulpy', price: 2500 },
        { name: 'Bottle water', price: 500 },
      ]
    },
    {
      name: 'Energy Drinks',
      sortOrder: 13,
      items: [
        { name: 'Red Bull', price: 2500 },
        { name: 'Power Horse', price: 2500 },
        { name: 'Black Bullet', price: 2500 },
        { name: 'Climax', price: 2500 },
        { name: 'Monster Furry', price: 2500 },
        { name: 'Vita Milk', price: 3000 },
        { name: 'Fearless', price: 1000 },
      ]
    },
    {
      name: 'Lager',
      sortOrder: 14,
      items: [
        { name: 'Star', price: 1800 },
        { name: 'Harp', price: 1800 },
        { name: 'Origin beer', price: 2000 },
        { name: 'Star reddle', price: 1800 },
        { name: 'Smirnoff ice (small)', price: 1800 },
        { name: 'Smirnoff (D/Black)', price: 2000 },
        { name: 'Stout (small)', price: 1500 },
        { name: 'Stout (medium)', price: 2000 },
        { name: 'Stout (big)', price: 2300 },
        { name: 'African special', price: 2500 },
        { name: 'Heineken', price: 2300 },
        { name: 'Legend', price: 2000 },
        { name: 'Extra Smooth', price: 2000 },
        { name: 'Budweiser', price: 2300 },
        { name: 'Hero beer', price: 1800 },
        { name: 'Life beer', price: 1800 },
        { name: '33 beer', price: 1800 },
        { name: 'Trophy beer', price: 1800 },
        { name: 'Trophy stout', price: 2000 },
        { name: 'Tiger', price: 1800 },
        { name: 'Gulder', price: 1800 },
        { name: 'Castle lite', price: 1800 },
        { name: 'Desperado', price: 2000 },
      ]
    },
    {
      name: 'Whiskey & Brandy',
      sortOrder: 15,
      items: [
        { name: 'Red label', price: 42000 },
        { name: 'Black label', price: 60000 },
        { name: 'Jack Daniels', price: 48000 },
        { name: 'Jameson', price: 40000 },
        { name: 'Jameson Black Barrel', price: 60000 },
        { name: 'Hennessy VS', price: 110000 },
        { name: 'Hennessy VSOP', price: 130000 },
        { name: 'Remy Martin VS', price: 130000 },
        { name: 'Remy Martin VSOP', price: 150000 },
        { name: 'Monkey Shoulder', price: 50000 },
        { name: 'Statement', price: 25000 },
        { name: 'Grants', price: 25000 },
        { name: 'Blue Island', price: 10000 },
      ]
    },
    {
      name: 'Gin / Vodka',
      sortOrder: 16,
      items: [
        { name: 'Gordon Gin (small)', price: 4000 },
        { name: 'Gordon Gin', price: 11000 },
        { name: 'Magic moment', price: 20000 },
        { name: 'Smirnoff Vodka', price: 25000 },
        { name: 'Absolute Vodka', price: 30000 },
        { name: 'Maya Vodka', price: 25000 },
        { name: 'Ak 47', price: 20000 },
        { name: 'Grand Dutch', price: 20000 },
      ]
    },
    {
      name: 'Liquors',
      sortOrder: 17,
      items: [
        { name: 'Baileys (Large)', price: 25000 },
        { name: 'Baileys (Medium)', price: 15000 },
        { name: 'Baileys (small)', price: 10000 },
        { name: 'Baileys Delight', price: 20000 },
        { name: 'Malibu', price: 20000 },
        { name: 'Tripple', price: 12000 },
        { name: 'Tia Maria', price: 15000 },
        { name: 'Kahlua', price: 25000 },
        { name: 'Night Train', price: 12000 },
        { name: 'Campari (large)', price: 35000 },
        { name: 'Campari (small)', price: 11000 },
        { name: 'Martini Dry', price: 10000 },
        { name: 'Marini Bianco', price: 10000 },
        { name: 'Best Cream', price: 10000 },
        { name: 'America Honey', price: 25000 },
      ]
    }
  ];

  // 3. Insert new items
  let totalItems = 0;
  for (const catData of menuCategories) {
    const category = await prisma.productCategory.create({
      data: {
        outletId: outlet.id,
        name: catData.name,
        sortOrder: catData.sortOrder,
        isActive: true
      }
    });

    console.log(`Created category: ${catData.name} (${catData.items.length} items)`);

    for (const item of catData.items) {
      await prisma.posProduct.create({
        data: {
          propertyId: property.id,
          categoryId: category.id,
          name: item.name,
          price: item.price,
          taxRate: 7.5, // Standard Nigerian VAT, can be adjusted
          isActive: true
        }
      });
      totalItems++;
    }
  }

  console.log(`\n✅ Successfully seeded STANZELN menu! Created ${menuCategories.length} categories and ${totalItems} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

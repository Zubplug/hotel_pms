import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const products = await prisma.posProduct.findMany({
        where: {
            inventoryMode: 'STOCK'
        },
        include: {
            recipe: {
                include: {
                    activeVersion: {
                        include: {
                            ingredients: true
                        }
                    }
                }
            }
        }
    });

    console.log("Found POS Products with STOCK mode:");
    for (const p of products) {
        console.log(`- ${p.id} | ${p.name} (Property: ${p.propertyId})`);
        if (p.recipe?.activeVersion?.ingredients.length > 0) {
            console.log(`  Recipe ingredients: ${p.recipe.activeVersion.ingredients.length}`);
        } else {
            console.log(`  NO RECIPE INGREDIENTS`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());

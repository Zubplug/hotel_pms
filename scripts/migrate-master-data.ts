import { PrismaClient } from '@prisma/client';

const stagingUrl = "postgresql://postgres.assronuqrbnqdrcqfhkr:RestoreHope2026%40@aws-1-eu-west-1.pooler.supabase.com:5432/postgres";
const prodUrl = "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";

const prismaStaging = new PrismaClient({ datasourceUrl: stagingUrl });
const prismaProd = new PrismaClient({ datasourceUrl: prodUrl });

async function migrateData() {
  console.log('Starting Master Data Migration...');

  try {
    const models = [
      'organization',
      'property',
      'role',
      'staff',
      'building',
      'floor',
      'roomType',
      'amenity',
      'room',
      'cancellationPolicy',
      'depositPolicy',
      'noShowPolicy',
      'ratePlan',
      'rate',
      'seasonalRate',
      'posOutlet',
      'posDevice',
      'posProduct',
      'unitOfMeasureConversion',
      'laundryItem'
    ];

    for (const modelName of models) {
      console.log(`Migrating ${modelName}...`);
      // @ts-ignore
      const records = await prismaStaging[modelName].findMany();
      console.log(`Found ${records.length} records for ${modelName}.`);

      if (records.length > 0) {
        // @ts-ignore
        await prismaProd[modelName].createMany({
          data: records,
          skipDuplicates: true,
        });
        console.log(`Successfully migrated ${modelName}.`);
      }
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prismaStaging.$disconnect();
    await prismaProd.$disconnect();
  }
}

migrateData();

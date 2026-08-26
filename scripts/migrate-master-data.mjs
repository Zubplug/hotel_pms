// migrate-master-data.mjs
// Plain Node.js ESM script - no TypeScript/Prisma dependency needed
// Uses pg directly to connect to both databases

import pg from 'pg';
const { Client } = pg;

const STAGING_URL = "postgresql://postgres.assronuqrbnqdrcqfhkr:RestoreHope2026%40@aws-1-eu-west-1.pooler.supabase.com:5432/postgres";
const PROD_URL    = "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";

// Tables to migrate IN ORDER (dependencies first)
const TABLES = [
  'Organization',
  'Property',
  'Role',
  'RolePermission',
  'Staff',
  'UserRole',
  'StaffPosOutletAccess',
  'Building',
  'Floor',
  'RoomType',
  'Amenity',
  'Room',
  'CancellationPolicy',
  'DepositPolicy',
  'NoShowPolicy',
  'RatePlan',
  'Rate',
  'SeasonalRate',
  'ExchangeRate',
  'PosOutlet',
  'PosDevice',
  'PosProduct',
  'UnitOfMeasureConversion',
  'LaundryItem',
  'MaintenanceCategory',
  'Supplier',
  'Warehouse',
  'StockItem',
];

async function migrate() {
  const staging = new Client({ connectionString: STAGING_URL });
  const prod    = new Client({ connectionString: PROD_URL });

  console.log('Connecting to Staging (Supabase)...');
  await staging.connect();
  console.log('Connecting to Production (Neon)...');
  await prod.connect();
  console.log('✅ Both connections established.\n');

  let totalMigrated = 0;

  for (const table of TABLES) {
    try {
      // Prisma uses PascalCase model names but PostgreSQL snake_case table names
      // Neon/Supabase Prisma creates tables with quoted PascalCase names
      const res = await staging.query(`SELECT * FROM "${table}"`);
      const rows = res.rows;

      if (rows.length === 0) {
        console.log(`  ⚪ ${table}: no records found, skipping.`);
        continue;
      }

      console.log(`  🔄 ${table}: found ${rows.length} records, inserting...`);

      // Build INSERT statement dynamically from column names
      const columns = Object.keys(rows[0]);
      const colList = columns.map(c => `"${c}"`).join(', ');

      let inserted = 0;
      for (const row of rows) {
        const values = columns.map((_, i) => `$${i + 1}`).join(', ');
        const vals   = columns.map(c => row[c]);
        try {
          await prod.query(
            `INSERT INTO "${table}" (${colList}) VALUES (${values}) ON CONFLICT DO NOTHING`,
            vals
          );
          inserted++;
        } catch (err) {
          console.warn(`    ⚠️  Skipped a row in ${table}: ${err.message}`);
        }
      }

      console.log(`  ✅ ${table}: ${inserted}/${rows.length} rows migrated.`);
      totalMigrated += inserted;

    } catch (err) {
      console.error(`  ❌ ${table}: FAILED - ${err.message}`);
    }
  }

  console.log(`\n🎉 Migration complete! Total records migrated: ${totalMigrated}`);
  await staging.end();
  await prod.end();
}

migrate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

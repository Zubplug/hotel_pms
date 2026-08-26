// migrate-master-data.mjs - v2 (correct dependency order)
import pg from 'pg';
const { Client } = pg;

const STAGING_URL = "postgresql://postgres.assronuqrbnqdrcqfhkr:RestoreHope2026%40@aws-1-eu-west-1.pooler.supabase.com:5432/postgres";
const PROD_URL    = "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";

// Tables in strict dependency order (parents before children)
const TABLES = [
  // 1. Top-level
  'Organization',

  // 2. Property (depends on Organization)
  'Property',

  // 3. Auth / Permissions
  'Permission',         // must come before RolePermission
  'Role',               // depends on Organization
  'RolePermission',     // depends on Role + Permission
  'Staff',              // depends on Organization + Property
  'UserRole',           // depends on Staff + Role
  'StaffPosOutletAccess',

  // 4. Property structure
  'Building',           // depends on Property
  'Floor',              // depends on Building
  'RoomType',           // depends on Property
  'Amenity',            // depends on Property
  'Room',               // depends on Property + Building + Floor + RoomType

  // 5. Policies & Rates
  'CancellationPolicy', // depends on Property
  'DepositPolicy',      // depends on Property
  'NoShowPolicy',       // depends on Property
  'RatePlan',           // depends on Property + policies
  'Rate',               // depends on RatePlan + RoomType
  'SeasonalRate',       // depends on RatePlan + RoomType
  'ExchangeRate',       // depends on Property

  // 6. POS Configuration
  'PosOutlet',          // depends on Property
  'PosFloorPlan',       // depends on PosOutlet
  'PosTable',           // depends on PosOutlet + PosFloorPlan
  'PosDevice',          // depends on Property + PosOutlet
  'PosTerminal',        // depends on PosOutlet
  'ProductCategory',    // depends on Property (parent of PosProduct)
  'PosProduct',         // depends on Property + ProductCategory
  'PosProductModifier', // depends on PosProduct

  // 7. Inventory / Procurement
  'UnitOfMeasureConversion', // depends on Property
  'Supplier',           // depends on Property
  'Warehouse',          // depends on Property
  'StockItem',          // depends on Property + Warehouse

  // 8. Laundry
  'LaundryItem',        // depends on Property

  // 9. Maintenance
  'MaintenanceCategory',// depends on Property

  // 10. Tax & Discount config
  'Tax',                // depends on Property
  'Discount',           // depends on Property

  // 11. Hardware config
  'DoorLock',           // depends on Property + Room
  'HardwareAgent',      // depends on Property

  // 12. Cash Accounts
  'CashAccount',        // depends on Property
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
  let totalSkipped  = 0;
  const summary = [];

  for (const table of TABLES) {
    try {
      const res  = await staging.query(`SELECT * FROM "${table}"`);
      const rows = res.rows;

      if (rows.length === 0) {
        console.log(`  ⚪ ${table}: 0 records — skipping.`);
        summary.push({ table, migrated: 0, skipped: 0, status: 'EMPTY' });
        continue;
      }

      console.log(`  🔄 ${table}: ${rows.length} records found — inserting...`);

      const columns = Object.keys(rows[0]);
      const colList = columns.map(c => `"${c}"`).join(', ');

      let inserted = 0;
      let skipped  = 0;

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
          skipped++;
          // Only log first few to avoid log spam
          if (skipped <= 3) {
            console.warn(`    ⚠️  Skipped a row in ${table}: ${err.message.split('\n')[0]}`);
          }
        }
      }

      console.log(`  ✅ ${table}: ${inserted} migrated, ${skipped} skipped.`);
      summary.push({ table, migrated: inserted, skipped, status: skipped === rows.length ? 'ALL_SKIPPED' : 'OK' });
      totalMigrated += inserted;
      totalSkipped  += skipped;

    } catch (err) {
      console.error(`  ❌ ${table}: FAILED — ${err.message.split('\n')[0]}`);
      summary.push({ table, migrated: 0, skipped: 0, status: 'ERROR', error: err.message.split('\n')[0] });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(60));
  for (const s of summary) {
    const icon = s.status === 'OK' ? '✅' : s.status === 'EMPTY' ? '⚪' : s.status === 'ALL_SKIPPED' ? '⚠️ ' : '❌';
    console.log(`${icon} ${s.table.padEnd(30)} migrated: ${s.migrated}, skipped: ${s.skipped}`);
  }
  console.log('='.repeat(60));
  console.log(`🎉 Done! Total migrated: ${totalMigrated}, Total skipped: ${totalSkipped}`);

  await staging.end();
  await prod.end();
}

migrate().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

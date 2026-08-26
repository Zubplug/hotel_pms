// migrate-remaining.mjs - migrates tables that come after Room
// Safe to re-run - uses ON CONFLICT DO NOTHING
import pg from 'pg';
const { Client } = pg;

const STAGING_URL = "postgresql://postgres.assronuqrbnqdrcqfhkr:RestoreHope2026%40@aws-1-eu-west-1.pooler.supabase.com:5432/postgres";
const PROD_URL    = "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";

// Only tables NOT yet migrated (after Room)
// Note: RatePlan ↔ Policy circular FKs handled by migrating policies first,
// then RatePlan with nullable FK fields, then rates
const TABLES = [
  // Policies (no FK to RatePlan yet)
  'CancellationPolicy',
  'DepositPolicy',
  'NoShowPolicy',

  // Rate plans + rates
  'RatePlan',
  'Rate',
  'SeasonalRate',
  'ExchangeRate',

  // POS config — ProductCategory FIRST then PosProduct
  'PosOutlet',
  'PosFloorPlan',
  'PosTable',
  'PosDevice',
  'PosTerminal',
  'ProductCategory',
  'PosProduct',
  'PosProductModifier',

  // Inventory
  'UnitOfMeasureConversion',
  'Supplier',
  'Warehouse',
  'StockItem',

  // Other config
  'LaundryItem',
  'MaintenanceCategory',
  'Tax',
  'Discount',
  'DoorLock',
  'CashAccount',
  'AgentEnrollmentToken',
];

async function migrate() {
  const staging = new Client({ connectionString: STAGING_URL });
  const prod    = new Client({ connectionString: PROD_URL });

  console.log('Connecting to databases...');
  await staging.connect();
  await prod.connect();
  console.log('✅ Connected.\n');

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

      console.log(`  🔄 ${table}: ${rows.length} records — inserting...`);

      const columns = Object.keys(rows[0]);
      const colList = columns.map(c => `"${c}"`).join(', ');

      let inserted = 0;
      let skipped  = 0;

      for (const row of rows) {
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        const vals = columns.map(c => row[c]);
        try {
          await prod.query(
            `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
            vals
          );
          inserted++;
        } catch (err) {
          skipped++;
          if (skipped <= 2) {
            console.warn(`    ⚠️  Skipped row: ${err.message.split('\n')[0]}`);
          }
        }
      }

      const icon = skipped === rows.length ? '⚠️ ' : '✅';
      console.log(`  ${icon} ${table}: ${inserted} migrated, ${skipped} skipped.`);
      summary.push({ table, migrated: inserted, skipped, status: skipped === rows.length ? 'ALL_SKIPPED' : 'OK' });
      totalMigrated += inserted;
      totalSkipped  += skipped;

    } catch (err) {
      console.error(`  ❌ ${table}: FAILED — ${err.message.split('\n')[0]}`);
      summary.push({ table, migrated: 0, skipped: 0, status: 'ERROR' });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(60));
  for (const s of summary) {
    const icon = s.status === 'OK' ? '✅' : s.status === 'EMPTY' ? '⚪' : s.status === 'ALL_SKIPPED' ? '⚠️ ' : '❌';
    console.log(`${icon}  ${s.table.padEnd(30)} migrated: ${String(s.migrated).padStart(4)}, skipped: ${s.skipped}`);
  }
  console.log('='.repeat(60));
  console.log(`🎉 Done! Migrated: ${totalMigrated}, Skipped: ${totalSkipped}`);

  await staging.end();
  await prod.end();
}

migrate().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

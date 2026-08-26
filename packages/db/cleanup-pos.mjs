import pg from 'pg';
const { Client } = pg;

const PROD_URL = "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
const prod = new Client({ connectionString: PROD_URL });
await prod.connect();

// Delete in child-first order to respect FK constraints

// 1. POS Devices
const devices = await prod.query(`DELETE FROM "PosDevice" RETURNING name`);
console.log(`✅ Deleted ${devices.rowCount} PosDevice(s): ${devices.rows.map(r => r.name).join(', ')}`);

// 2. POS Tables
const tables = await prod.query(`DELETE FROM "PosTable" RETURNING name`);
console.log(`✅ Deleted ${tables.rowCount} PosTable(s): ${tables.rows.map(r => r.name).join(', ')}`);

// 3. POS Floor Plans
const floorPlans = await prod.query(`DELETE FROM "PosFloorPlan" RETURNING name`);
console.log(`✅ Deleted ${floorPlans.rowCount} PosFloorPlan(s): ${floorPlans.rows.map(r => r.name).join(', ')}`);

// 4. Staff POS Outlet Access (FK child of PosOutlet)
const access = await prod.query(`DELETE FROM "StaffPosOutletAccess" RETURNING id`);
console.log(`✅ Deleted ${access.rowCount} StaffPosOutletAccess record(s)`);

// 4b. Null ProductCategory.outletId FK before deleting outlets
const catUpdate = await prod.query(`UPDATE "ProductCategory" SET "outletId" = NULL WHERE "outletId" IS NOT NULL RETURNING name`);
console.log(`✅ Unlinked ${catUpdate.rowCount} ProductCategory outlet references`);

// 5. POS Outlets
const outlets = await prod.query(`DELETE FROM "PosOutlet" RETURNING name`);
console.log(`✅ Deleted ${outlets.rowCount} PosOutlet(s): ${outlets.rows.map(r => r.name).join(', ')}`);

// Final verification
const checks = [
  ['PosOutlet', 'SELECT COUNT(*) FROM "PosOutlet"'],
  ['PosFloorPlan', 'SELECT COUNT(*) FROM "PosFloorPlan"'],
  ['PosTable', 'SELECT COUNT(*) FROM "PosTable"'],
  ['PosDevice', 'SELECT COUNT(*) FROM "PosDevice"'],
];

console.log('\n--- Final Verification ---');
for (const [label, sql] of checks) {
  const r = await prod.query(sql);
  console.log(`  ${label}: ${r.rows[0].count} records remaining`);
}

console.log('\n✅ All staging POS data removed. Admin can now create fresh outlets via the web dashboard.');
await prod.end();

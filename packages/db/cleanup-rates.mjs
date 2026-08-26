import pg from 'pg';
const { Client } = pg;

const PROD_URL = "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
const prod = new Client({ connectionString: PROD_URL });
await prod.connect();

// Ghost RoomType IDs (0 rooms, test data)
const ghostRoomTypeIds = [
  '71651943-af94-487c-a976-c0ec30319af7', // Standard Room
  'db583d22-3af9-48bf-b3f6-4fbce968e1ac', // Deluxe Room
];

// Step 1: Delete the Rate records (children first)
const rates = await prod.query(
  `DELETE FROM "Rate" WHERE "roomTypeId" = ANY($1::uuid[]) RETURNING id, amount, currency`,
  [ghostRoomTypeIds]
);
console.log(`✅ Deleted ${rates.rowCount} Rate records:`);
rates.rows.forEach(r => console.log(`   - ₦${r.amount} ${r.currency}`));

// Step 2: Delete SeasonalRate records just in case
const seasonal = await prod.query(
  `DELETE FROM "SeasonalRate" WHERE "roomTypeId" = ANY($1::uuid[]) RETURNING id`,
  [ghostRoomTypeIds]
);
console.log(`✅ Deleted ${seasonal.rowCount} SeasonalRate records`);

// Step 3: Delete the ghost RoomType records
const roomTypes = await prod.query(
  `DELETE FROM "RoomType" WHERE id = ANY($1::uuid[]) RETURNING name, code`,
  [ghostRoomTypeIds]
);
console.log(`✅ Deleted ${roomTypes.rowCount} ghost RoomType records:`);
roomTypes.rows.forEach(r => console.log(`   - ${r.name} (${r.code})`));

// Also delete the ghost RatePlans (STD plan linked to nothing now)
const plans = await prod.query(
  `DELETE FROM "RatePlan" WHERE id NOT IN (SELECT DISTINCT "ratePlanId" FROM "Rate") RETURNING name, code`
);
console.log(`✅ Deleted ${plans.rowCount} orphaned RatePlan records:`);
plans.rows.forEach(r => console.log(`   - ${r.name} (${r.code})`));

// Final verification
console.log('\n--- Final State ---');
const remainingRT = await prod.query(`SELECT name, code, "baseRate", currency FROM "RoomType" ORDER BY "baseRate"`);
console.log('\n✅ Remaining RoomTypes:');
console.table(remainingRT.rows);

const remainingRP = await prod.query(`SELECT name, code, type FROM "RatePlan"`);
console.log('\n✅ Remaining RatePlans:');
console.table(remainingRP.rows);

const remainingR = await prod.query(`SELECT count(*) as count FROM "Rate"`);
console.log(`\n✅ Remaining Rates: ${remainingR.rows[0].count}`);

await prod.end();

import pg from 'pg';
const { Client } = pg;

const PROD_URL = "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
const prod = new Client({ connectionString: PROD_URL });
await prod.connect();

const KEEP_EMAIL = 'admin@lodgecore.com';

// Get IDs to delete
const toDelete = await prod.query(`SELECT id, email FROM "Staff" WHERE email != $1`, [KEEP_EMAIL]);
console.log(`\nDeleting ${toDelete.rows.length} staff (keeping admin@lodgecore.com):`);
console.table(toDelete.rows);

const idsToDelete = toDelete.rows.map(r => r.id);

if (idsToDelete.length === 0) {
  console.log('Nothing to delete.');
  await prod.end();
  process.exit(0);
}

// Delete related StaffPosOutletAccess first (FK child)
const access = await prod.query(
  `DELETE FROM "StaffPosOutletAccess" WHERE "staffId" = ANY($1::uuid[]) RETURNING id`,
  [idsToDelete]
);
console.log(`\n✅ Deleted ${access.rowCount} StaffPosOutletAccess rows`);

// Now delete the staff
const deleted = await prod.query(
  `DELETE FROM "Staff" WHERE id = ANY($1::uuid[]) RETURNING email`,
  [idsToDelete]
);
console.log(`\n✅ Deleted ${deleted.rowCount} staff members:`);
deleted.rows.forEach(r => console.log(`   - ${r.email}`));

// Confirm remaining
const remaining = await prod.query(`SELECT id, "firstName", "lastName", email, department, position FROM "Staff"`);
console.log('\n✅ Remaining staff in production:');
console.table(remaining.rows);

await prod.end();

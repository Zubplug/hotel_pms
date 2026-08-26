import pg from 'pg';
const { Client } = pg;

const PROD_URL = "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
const prod = new Client({ connectionString: PROD_URL });
await prod.connect();

const access = await prod.query(`
  SELECT a.id, s.email as "staffEmail", o.name as "outletName"
  FROM "StaffPosOutletAccess" a
  JOIN "Staff" s ON s.id = a."staffId"
  JOIN "PosOutlet" o ON o.id = a."outletId"
`);

console.log('\n🔐 Staff POS Outlet Access:');
console.table(access.rows);

await prod.end();

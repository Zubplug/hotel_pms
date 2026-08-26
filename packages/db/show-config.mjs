import pg from 'pg';
const { Client } = pg;

const PROD_URL = "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
const prod = new Client({ connectionString: PROD_URL });
await prod.connect();

const ratePlans = await prod.query(`SELECT id, name, code, type, "isActive", "isPublic" FROM "RatePlan" ORDER BY "createdAt"`);
console.log('\n📋 RATE PLANS (2):');
console.table(ratePlans.rows);

const rates = await prod.query(`
  SELECT r.id, rp.name as "ratePlan", r.amount, r.currency, r."effectiveFrom", r."effectiveTo"
  FROM "Rate" r
  JOIN "RatePlan" rp ON rp.id = r."ratePlanId"
  ORDER BY r."createdAt"
`);
console.log('\n💰 RATES (2):');
console.table(rates.rows);

const outlets = await prod.query(`SELECT id, name, type, "isActive", description FROM "PosOutlet" ORDER BY "createdAt"`);
console.log('\n🏪 POS OUTLETS (3):');
console.table(outlets.rows);

await prod.end();

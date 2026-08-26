import pg from 'pg';
const { Client } = pg;

const PROD_URL = "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
const prod = new Client({ connectionString: PROD_URL });
await prod.connect();

const outlets = await prod.query(`SELECT id, name, type, "isActive" FROM "PosOutlet" ORDER BY "createdAt"`);
console.log('\n🏪 POS OUTLETS:'); console.table(outlets.rows);

const floorPlans = await prod.query(`SELECT id, name, "outletId" FROM "PosFloorPlan" ORDER BY "createdAt"`);
console.log('\n🗺️ POS FLOOR PLANS:'); console.table(floorPlans.rows);

const tables = await prod.query(`
  SELECT t.id, t.name, t.capacity, t.status, fp.name as "floorPlan"
  FROM "PosTable" t LEFT JOIN "PosFloorPlan" fp ON fp.id = t."floorPlanId"
  ORDER BY t."createdAt"
`);
console.log('\n🪑 POS TABLES:'); console.table(tables.rows);

const devices = await prod.query(`
  SELECT d.id, d.name, d.type, d."isActive", o.name as "outlet"
  FROM "PosDevice" d LEFT JOIN "PosOutlet" o ON o.id = d."outletId"
  ORDER BY d."createdAt"
`);
console.log('\n📱 POS DEVICES:'); console.table(devices.rows);

await prod.end();

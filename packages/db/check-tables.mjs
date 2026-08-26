import pg from 'pg';
const { Client } = pg;

const PROD_URL = "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
const prod = new Client({ connectionString: PROD_URL });
await prod.connect();

const queries = [
  { label: '📦 WAREHOUSES (1)', sql: 'SELECT id, name FROM "Warehouse"' },
  { label: '🥫 STOCK ITEMS (6)', sql: 'SELECT * FROM "StockItem" LIMIT 6' },
  { label: '🛠️ MAINTENANCE CATEGORY (1)', sql: 'SELECT id, name FROM "MaintenanceCategory"' },
  { label: '🚪 DOOR LOCKS (15)', sql: 'SELECT * FROM "DoorLock" LIMIT 5' },
  { label: '💵 CASH ACCOUNTS (3)', sql: 'SELECT * FROM "CashAccount"' },
  { label: '🎟️ AGENT ENROLLMENT TOKENS (12)', sql: 'SELECT * FROM "AgentEnrollmentToken" LIMIT 5' }
];

for (const q of queries) {
  try {
    const res = await prod.query(q.sql);
    console.log(`\n${q.label}:`);
    console.table(res.rows);
  } catch (err) {
    console.error(`\nFailed to query ${q.label}: ${err.message}`);
  }
}

await prod.end();

import pg from 'pg';
const { Client } = pg;

const PROD_URL = "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
const prod = new Client({ connectionString: PROD_URL });
await prod.connect();

// 1. Check for StockTransfer and StockTransferItem tables
const tables = await prod.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name IN ('StockTransfer', 'StockTransferItem', 'StockTransaction')
`);
console.log('\n📊 TABLES FOUND:');
console.table(tables.rows);

// 2. Check for specific columns on StockTransaction
const columns = await prod.query(`
  SELECT table_name, column_name 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'StockTransaction'
    AND column_name IN ('currency', 'grnId', 'quantityAfter', 'quantityBefore', 'totalValue', 'transferId', 'warehouseId')
`);
console.log('\n🔍 COLUMNS FOUND IN StockTransaction:');
console.table(columns.rows);

await prod.end();

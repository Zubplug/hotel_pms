const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  try {
    const res = await pool.query("SELECT id, name, type FROM \"Outlet\" WHERE name ILIKE '%pool%'");
    console.log("Pool Outlets found:", res.rows);
  } finally {
    pool.end();
  }
}
main();

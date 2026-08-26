import pg from 'pg';
const { Client } = pg;

const PROD_URL = "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
const prod = new Client({ connectionString: PROD_URL });
await prod.connect();

const tokens = await prod.query(`DELETE FROM "AgentEnrollmentToken"`);
console.log(`✅ Deleted ${tokens.rowCount} expired AgentEnrollmentTokens`);

await prod.end();

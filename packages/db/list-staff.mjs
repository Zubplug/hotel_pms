import pg from 'pg';
const { Client } = pg;

const PROD_URL = "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
const prod = new Client({ connectionString: PROD_URL });
await prod.connect();

// Show all staff
const res = await prod.query(`
  SELECT s.id, s."firstName", s."lastName", s.email, s.department, s.position, s."isActive",
         r.name as "roleName"
  FROM "Staff" s
  LEFT JOIN "UserRole" ur ON ur."userId" = s."userId"
  LEFT JOIN "Role" r ON r.id = ur."roleId"
  ORDER BY s."createdAt"
`);
console.log('\nAll staff in production:');
console.table(res.rows);

// Keep only ADMIN role staff — delete the rest
// First identify admin staff IDs
const adminRes = await prod.query(`
  SELECT DISTINCT s.id, s.email
  FROM "Staff" s
  INNER JOIN "UserRole" ur ON ur."userId" = s."userId"
  INNER JOIN "Role" r ON r.id = ur."roleId"
  WHERE UPPER(r.name) LIKE '%ADMIN%'
     OR UPPER(s.department) LIKE '%ADMIN%'
     OR UPPER(s.position) LIKE '%ADMIN%'
`);

console.log('\nAdmin staff to KEEP:');
console.table(adminRes.rows);

// Also identify by email pattern if the above is empty
const emailRes = await prod.query(`SELECT id, email, department, position FROM "Staff"`);
console.log('\nAll emails (for your reference to confirm which to keep):');
console.table(emailRes.rows);

await prod.end();

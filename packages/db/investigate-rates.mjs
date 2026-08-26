import pg from 'pg';
const { Client } = pg;

const PROD_URL = "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
const prod = new Client({ connectionString: PROD_URL });
await prod.connect();

// Show all room types and their base rates
const roomTypes = await prod.query(`
  SELECT rt.id, rt.name, rt.code, rt."baseRate", rt.currency, rt."isActive",
         COUNT(r.id) as "roomCount"
  FROM "RoomType" rt
  LEFT JOIN "Room" r ON r."roomTypeId" = rt.id
  GROUP BY rt.id, rt.name, rt.code, rt."baseRate", rt.currency, rt."isActive"
  ORDER BY rt."baseRate"
`);
console.log('\n🏠 ROOM TYPES with baseRate:');
console.table(roomTypes.rows);

// Show rates linked to room types
const rates = await prod.query(`
  SELECT
    rp.name as "ratePlan", rp.code as "planCode",
    rt.name as "roomType", rt.code as "roomTypeCode",
    r.amount, r.currency, r."effectiveFrom", r."effectiveTo"
  FROM "Rate" r
  JOIN "RatePlan" rp ON rp.id = r."ratePlanId"
  JOIN "RoomType" rt ON rt.id = r."roomTypeId"
  ORDER BY rp.name, r.amount
`);
console.log('\n💰 RATES linked to RoomTypes:');
console.table(rates.rows);

// Check if room types have no rates at all
const unrated = await prod.query(`
  SELECT rt.name, rt.code, rt."baseRate"
  FROM "RoomType" rt
  LEFT JOIN "Rate" r ON r."roomTypeId" = rt.id
  WHERE r.id IS NULL
`);
console.log('\n⚠️  Room Types with NO Rate records (only using baseRate):');
console.table(unrated.rows);

await prod.end();

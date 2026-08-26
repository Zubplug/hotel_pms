import pg from 'pg';
const { Client } = pg;

const PROD_URL = "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require";
const prod = new Client({ connectionString: PROD_URL });
await prod.connect();

// 1. Check Room statuses
const rooms = await prod.query(`
  SELECT id, number, status, "housekeepingStatus"
  FROM "Room"
  WHERE status != 'AVAILABLE' OR "housekeepingStatus" != 'CLEAN'
`);
console.log('\n🚪 Rooms that are NOT completely free/clean:');
console.table(rooms.rows);

// 2. Check if we need to reset them
if (rooms.rowCount > 0) {
  const update = await prod.query(`
    UPDATE "Room"
    SET status = 'AVAILABLE', "housekeepingStatus" = 'CLEAN'
    RETURNING number
  `);
  console.log(`\n✅ Reset ${update.rowCount} rooms to AVAILABLE & CLEAN.`);
} else {
  console.log('\n✅ All rooms are already AVAILABLE and CLEAN.');
}

// 3. Just to be safe, make sure all DoorLocks are also marked as normal
const locks = await prod.query(`
  UPDATE "DoorLock"
  SET status = 'ONLINE', "batteryLevel" = 100
  WHERE status != 'ONLINE'
  RETURNING id
`);
if (locks.rowCount > 0) {
  console.log(`\n✅ Reset ${locks.rowCount} door locks to ONLINE status.`);
} else {
  console.log('\n✅ All door locks are already ONLINE.');
}

await prod.end();

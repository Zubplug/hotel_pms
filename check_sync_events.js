const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('/Users/mac/Library/Application Support/LodgeCoreOffline.db', sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error("Error opening db:", err.message);
        // try local app data on mac
        const db2 = new sqlite3.Database('/Users/mac/.local/share/LodgeCoreOffline.db', sqlite3.OPEN_READONLY, (err2) => {
            if (err2) console.error("Error opening db2:", err2.message);
            else queryDb(db2);
        });
    } else {
        queryDb(db);
    }
});

function queryDb(database) {
    console.log("Database opened.");
    database.all("SELECT * FROM SyncEvents WHERE Status IN ('PENDING', 'FAILED', 'PROCESSING', 'CONFLICT', 'DEAD_LETTER')", [], (err, rows) => {
        if (err) {
            console.error("Error querying:", err.message);
        } else {
            console.log(`Found ${rows.length} blocked events:`);
            rows.forEach(row => console.log(JSON.stringify(row, null, 2)));
        }
        database.close();
    });
}

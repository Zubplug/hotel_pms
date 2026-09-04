const fs = require('fs');
const path = 'apps/desktop/LodgeCore.Desktop/Services/SyncEngine.cs';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /await dbContext.SaveChangesAsync\(stoppingToken\);/g,
  `try { await dbContext.SaveChangesAsync(stoppingToken); } catch (Microsoft.EntityFrameworkCore.DbUpdateException ex) { throw new Exception("DB ERROR: " + (ex.InnerException?.Message ?? ex.Message) + " | " + ex.StackTrace, ex); }`
);

fs.writeFileSync(path, content);

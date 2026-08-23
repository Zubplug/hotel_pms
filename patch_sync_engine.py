import re
import sys

def main():
    file_path = "/Users/mac/hotel_pms/apps/desktop/LodgeCore.Desktop/Services/SyncEngine.cs"
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # We need to replace the entire PullUpdatesAsync method
    # It starts at: private async Task PullUpdatesAsync(CancellationToken stoppingToken)
    # It ends before: private async Task PushFrontDeskOutboxAsync(CancellationToken stoppingToken)
    
    start_str = "    private async Task PullUpdatesAsync(CancellationToken stoppingToken)\n    {"
    end_str = "    private async Task PushFrontDeskOutboxAsync(CancellationToken stoppingToken)"
    
    start_idx = content.find(start_str)
    end_idx = content.find(end_str)
    
    if start_idx == -1 or end_idx == -1:
        print("Could not find the method boundaries.")
        sys.exit(1)
        
    old_method = content[start_idx:end_idx]
    
    # Let's modify the old_method to add pagination, transactions, and remove stale sweeps on incremental sync
    
    # 1. Add loop and pagination
    new_method = """    private async Task PullUpdatesAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        var terminal = await dbContext.PosTerminals.FirstOrDefaultAsync(stoppingToken);
        if (terminal == null) throw new Exception("Terminal not provisioned (missing in local DB).");

        var session = await _authManager.GetSessionAsync();
        var propertyId = session?.PropertyId ?? terminal.PropertyId;
        if (string.IsNullOrEmpty(propertyId)) throw new Exception("Property ID not found.");

        var token = _credentialStorage.LoadCredential("deviceCredential");
        if (string.IsNullOrEmpty(token))
        {
            token = await _authManager.GetAuthTokenAsync();
            if (string.IsNullOrEmpty(token)) throw new Exception("No auth token available; skipping pull.");
        }

        _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        bool hasMore = true;
        int pageCount = 0;

        while (hasMore && !stoppingToken.IsCancellationRequested)
        {
            var lastPullStr = Preferences.Get($"LastPull_{propertyId}", "");
            var isIncremental = !string.IsNullOrEmpty(lastPullStr);
            var cursorParam = isIncremental ? $"&cursor={Uri.EscapeDataString(lastPullStr)}" : "";

            var response = await _httpClient.GetAsync(
                $"sync/pull?propertyId={Uri.EscapeDataString(propertyId)}{cursorParam}&limit=500",
                stoppingToken);

            if (!response.IsSuccessStatusCode)
            {
                if ((int)response.StatusCode == 401 || (int)response.StatusCode == 403)
                {
                    if (await TryRefreshDeviceTokenAsync(stoppingToken))
                    {
                        throw new Exception("Refreshed device token. Will retry pull in next cycle.");
                    }
                    BroadcastHealth(SyncState.ERROR, null, "AUTH_ERROR", 0, 1, $"Auth failed: {response.StatusCode}. Please re-authenticate.");
                }
                throw new Exception($"Sync pull returned {(int)response.StatusCode}");
            }

            var json = await response.Content.ReadAsStringAsync(stoppingToken);
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            var root = doc.RootElement;

            pageCount++;
            hasMore = root.TryGetProperty("hasMore", out var hm) && hm.GetBoolean();
            var nextCursor = root.TryGetProperty("syncedAt", out var sa) ? sa.GetString() : null;

            using var transaction = await dbContext.Database.BeginTransactionAsync(stoppingToken);
            try
            {
"""
    
    # 2. Extract everything inside the old try/catch or parsing logic.
    # The parsing logic starts after the JSON parse in old_method:
    parse_start_str = "            // ---- Apply property config ------------------------------------"
    parse_end_str = "            await dbContext.SaveChangesAsync(stoppingToken);\n            await dbContext.SaveChangesAsync(stoppingToken);\n    }\n"
    
    p_start = old_method.find(parse_start_str)
    p_end = old_method.find(parse_end_str)
    
    if p_start == -1 or p_end == -1:
        print("Could not find parsing logic boundaries.")
        sys.exit(1)
        
    parsing_logic = old_method[p_start:p_end]
    
    # 3. Disable stale removal on incremental syncs.
    # Replace all occurrences of stale sweeps to check for !isIncremental
    sweeps = [
        "if (obsoleteStaff.Any())",
        "if (stale.Any()) dbContext.PosOutlets.RemoveRange(stale);",
        "if (stale.Any()) dbContext.ProductCategories.RemoveRange(stale);",
        "if (stale.Any()) dbContext.PosProducts.RemoveRange(stale);",
        "if (stale.Any()) dbContext.PosFloorPlans.RemoveRange(stale);",
        "if (stale.Any()) dbContext.PosTables.RemoveRange(stale);",
        "if (stale.Any()) dbContext.HousekeepingTasks.RemoveRange(stale);",
        "if (stale.Any()) dbContext.MaintenanceTickets.RemoveRange(stale);",
        "if (staleRes.Any())",
        "if (staleFolios.Any())",
        "if (staleCreds.Any()) dbContext.LockCredentials.RemoveRange(staleCreds);",
        "if (staleOps.Any()) dbContext.LockOperations.RemoveRange(staleOps);",
        "if (staleMods.Any()) dbContext.PosProductModifiers.RemoveRange(staleMods);"
    ]
    
    for sweep in sweeps:
        if "Any()" in sweep:
            parsing_logic = parsing_logic.replace(sweep, sweep.replace("Any()", "Any() && !isIncremental"))

    # Also handle the deletedAt logic for Guests in PullUpdates (if any) or inactive logic
    
    # Wrap parsing_logic in transaction block with proper indentation
    new_method += parsing_logic
    
    new_method += """
                await dbContext.SaveChangesAsync(stoppingToken);
                await transaction.CommitAsync(stoppingToken);

                if (!string.IsNullOrEmpty(nextCursor))
                {
                    Preferences.Set($"LastPull_{propertyId}", nextCursor);
                }
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(stoppingToken);
                throw new Exception($"Failed to apply sync page {pageCount}: {ex.Message}", ex);
            }
        }
        
        // Clean up stale reservations locally (that fell out of the active window)
        var threeDaysAgo = DateTime.UtcNow.AddDays(-3);
        var oldReservations = await dbContext.Reservations
            .Where(r => !r.IsDirty && (r.CheckOutDate < threeDaysAgo || r.DeletedAt != null))
            .ToListAsync(stoppingToken);
        if (oldReservations.Any())
        {
            dbContext.Reservations.RemoveRange(oldReservations);
            await dbContext.SaveChangesAsync(stoppingToken);
        }
    }
"""

    new_content = content[:start_idx] + new_method + "\n" + content[end_idx:]
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
        
    print("Successfully patched SyncEngine.cs")

if __name__ == "__main__":
    main()

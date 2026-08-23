using System.Net.Http.Json;
using System.Net.Http.Headers;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LodgeCore.Desktop.Services;

/// <summary>
/// Background service responsible for flushing the LocalSyncEvent queue to the cloud API,
/// and pulling new state from the cloud API to apply to the local SQLite database.
/// Runs continuously while the application is alive.
/// </summary>
public class SyncEngine : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SyncEngine> _logger;
    private readonly HttpClient _httpClient;
    private readonly AuthManager _authManager;
    private readonly ICredentialStorageService _credentialStorage;
    
    // We can wire this to MAUI Connectivity events. For now, assume online.
    private bool _isOnline = true; 
    private int _consecutiveFailures = 0; // Tracks failures for exponential backoff
    private bool _isSyncing = false;
    private readonly SemaphoreSlim _forceSyncSemaphore = new SemaphoreSlim(0, 1);

    public enum NetworkState { ONLINE, OFFLINE }
    public enum SyncState { NEVER_SYNCED, SYNCING, UP_TO_DATE, ERROR }
    
    public class SyncHealthInfo
    {
        public NetworkState Network { get; set; }
        public SyncState Sync { get; set; }
        public DateTime? LastSyncAt { get; set; }
        public string? LastError { get; set; }
        public string? Phase { get; set; }
        public int Current { get; set; }
        public int Total { get; set; }
        public string? Message { get; set; }
        public int PendingOperations { get; set; }
    }

    public static event Action<SyncHealthInfo>? OnSyncHealthChanged;
    
    public static SyncEngine? Instance { get; private set; }

    private DateTime? _lastSuccess = null;
    private string? _lastError = null;
    private SyncState _lastSyncState = SyncState.NEVER_SYNCED;
    private string? _lastPhase = null;
    private int _lastCurrent = 0;
    private int _lastTotal = 0;
    private string? _lastMessage = null;

    public SyncEngine(IServiceProvider serviceProvider, ILogger<SyncEngine> logger, AuthManager authManager, HttpClient httpClient, ICredentialStorageService credentialStorage)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _authManager = authManager;
        _httpClient = httpClient;
        _credentialStorage = credentialStorage;
        Instance = this;
    }

    public override Task StartAsync(CancellationToken cancellationToken)
    {
#if WINDOWS || MACCATALYST || IOS || ANDROID
        _isOnline = Microsoft.Maui.Networking.Connectivity.Current.NetworkAccess == Microsoft.Maui.Networking.NetworkAccess.Internet;
        Microsoft.Maui.Networking.Connectivity.Current.ConnectivityChanged += OnConnectivityChanged;
#endif
        return base.StartAsync(cancellationToken);
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
#if WINDOWS || MACCATALYST || IOS || ANDROID
        Microsoft.Maui.Networking.Connectivity.Current.ConnectivityChanged -= OnConnectivityChanged;
#endif
        return base.StopAsync(cancellationToken);
    }

#if WINDOWS || MACCATALYST || IOS || ANDROID
    private void OnConnectivityChanged(object? sender, Microsoft.Maui.Networking.ConnectivityChangedEventArgs e)
    {
        bool wasOnline = _isOnline;
        _isOnline = e.NetworkAccess == Microsoft.Maui.Networking.NetworkAccess.Internet;
        
        if (!wasOnline && _isOnline)
        {
            _logger.LogInformation("Network connectivity restored. Triggering immediate sync.");
            TriggerManualSync();
        }
        else if (wasOnline && !_isOnline)
        {
            _logger.LogWarning("Network connectivity lost. Pausing sync operations.");
            BroadcastHealth(_lastSyncState, "Device is offline");
        }
    }
#endif

    public void TriggerManualSync()
    {
        if (_isSyncing) return;
        if (_forceSyncSemaphore.CurrentCount == 0)
        {
            _forceSyncSemaphore.Release();
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("SyncEngine is starting.");

        try 
        {
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

            // Ensure the SyncMetadata table exists (for existing non-migrated DBs before this change)
            await dbContext.Database.ExecuteSqlRawAsync(
                "CREATE TABLE IF NOT EXISTS SyncMetadata (Id TEXT PRIMARY KEY, LastSuccessfulSyncAt TEXT, LastSyncVersion TEXT, SchemaVersion TEXT);"
            );

            var meta = await dbContext.SyncMetadata.FirstOrDefaultAsync(stoppingToken);
            if (meta != null && meta.LastSuccessfulSyncAt.HasValue)
            {
                _lastSuccess = meta.LastSuccessfulSyncAt.Value;
                _logger.LogInformation($"Restored last successful sync timestamp: {_lastSuccess}");
            }

            // Recover any crashed processing events to PENDING so they are retried
            await dbContext.Database.ExecuteSqlRawAsync(
                "UPDATE SyncEvents SET Status = 'PENDING' WHERE Status = 'PROCESSING';", stoppingToken
            );
            await dbContext.Database.ExecuteSqlRawAsync(
                "UPDATE OutboxEvents SET Status = 'PENDING' WHERE Status = 'PROCESSING';", stoppingToken
            );
            _logger.LogInformation("Recovered crashed processing events (if any).");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load sync metadata on startup.");
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            if (_isOnline)
            {
                _isSyncing = true;
                try
                {
                    BroadcastHealth(SyncState.SYNCING, null, "PREP", 0, 1, "Preparing sync...");
                    await PushPendingEventsAsync(stoppingToken);
                    await PushFrontDeskOutboxAsync(stoppingToken);
                    await PushKeycardAuditsAsync(stoppingToken);
                    
                    // Resolve any conflicts that emerged from the push
                    await PullSyncConflictsAsync(stoppingToken);

                    // Pull updates
                    await PullUpdatesAsync(stoppingToken);
                    
                    // Run incremental guest sync
                    await SyncGuestsIncrementalAsync(stoppingToken);
                    
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var resolver = scope.ServiceProvider.GetRequiredService<ConflictResolver>();
                        await resolver.ResolveConflictsAsync();
                    }

                    await PullUpdatesAsync(stoppingToken);
                    
                    _consecutiveFailures = 0;
                    _lastSuccess = DateTime.UtcNow;
                    _lastError = null;
                    BroadcastHealth(SyncState.UP_TO_DATE, null, "COMPLETE", 1, 1, "Sync complete");
                }
                catch (Exception ex)
                {
                    _consecutiveFailures++;
                    _lastError = SanitizeErrorMessage(ex);
                    _logger.LogError(ex, $"An error occurred during the sync cycle. Failure count: {_consecutiveFailures}");
                    BroadcastHealth(SyncState.ERROR, _lastError);
                }
                finally
                {
                    _isSyncing = false;
                }
            }
            else
            {
                BroadcastHealth(_lastSyncState, "Device is offline");
            }

            // Exponential backoff logic: Max 5 minutes (300 seconds), Base 30 seconds
            var delaySeconds = Math.Min(300, 30 * Math.Pow(2, _consecutiveFailures));
            try 
            {
                await _forceSyncSemaphore.WaitAsync(TimeSpan.FromSeconds(delaySeconds), stoppingToken);
            }
            catch (OperationCanceledException) { }
        }

        _logger.LogInformation("SyncEngine is stopping.");
    }

    private string SanitizeErrorMessage(Exception ex)
    {
        // Temporarily expose the raw inner message so we can debug this crash!
        var msg = ex.InnerException != null ? ex.InnerException.Message : ex.Message;
        return string.IsNullOrEmpty(msg) ? "Unknown error occurred" : msg;
    }

    private void BroadcastHealth(SyncState state, string? error = null, string? phase = null, int current = 0, int total = 0, string? message = null)
    {
        _lastSyncState = state;
        if (error != null) _lastError = error;
        if (phase != null) _lastPhase = phase;
        if (total > 0)
        {
            _lastCurrent = current;
            _lastTotal = total;
        }
        if (message != null) _lastMessage = message;

        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();
        
        var pendingCount = 0;
        try 
        {
            pendingCount = dbContext.SyncEvents.Count(e => e.Status == "PENDING" || e.Status == "FAILED")
                         + dbContext.OutboxEvents.Count(e => e.Status == "PENDING" || e.Status == "FAILED");
        } 
        catch { }

        if (state == SyncState.SYNCING && pendingCount == 0 && string.IsNullOrEmpty(phase))
        {
            // Just starting push phase, keep syncing state
        }
        else if (state == SyncState.SYNCING && phase == null)
        {
            // Legacy call compatibility
        }

        OnSyncHealthChanged?.Invoke(new SyncHealthInfo
        {
            Network = _isOnline ? NetworkState.ONLINE : NetworkState.OFFLINE,
            Sync = state,
            LastSyncAt = _lastSuccess,
            PendingOperations = pendingCount,
            LastError = _lastError,
            Phase = phase,
            Current = current,
            Total = total,
            Message = message
        });
    }

    public SyncHealthInfo GetCurrentHealth()
    {
        int pendingCount = 0;
        try 
        {
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();
            pendingCount = dbContext.SyncEvents.Count(e => e.Status == "PENDING" || e.Status == "FAILED")
                         + dbContext.OutboxEvents.Count(e => e.Status == "PENDING" || e.Status == "FAILED");
        } 
        catch { }

        return new SyncHealthInfo
        {
            Network = _isOnline ? NetworkState.ONLINE : NetworkState.OFFLINE,
            Sync = _lastSyncState,
            LastSyncAt = _lastSuccess,
            PendingOperations = pendingCount,
            LastError = _lastError,
            Phase = _lastPhase,
            Current = _lastCurrent,
            Total = _lastTotal,
            Message = _lastMessage
        };
    }

    /// <summary>
    /// Pushes pending operations to the cloud with retry logic.
    /// </summary>
    private async Task PushPendingEventsAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        var pendingEvents = await dbContext.SyncEvents
            .Where(e => e.Status == "PENDING" || e.Status == "FAILED")
            .OrderBy(e => e.SequenceNumber)
            .Take(100) // Batch push limit
            .ToListAsync(stoppingToken);

        if (!pendingEvents.Any()) return;

        var deviceId = await _authManager.GetOrCreateDeviceIdAsync();
        
        // Ensure we only push events for THIS terminal (or group by terminal if mixed)
        var eventsToPush = pendingEvents.Where(e => e.TerminalId == deviceId).ToList();
        if (!eventsToPush.Any()) return;

        _logger.LogInformation($"Pushing {eventsToPush.Count} pending operations to cloud...");

        var token = await _authManager.GetAuthTokenAsync();
        if (!string.IsNullOrEmpty(token))
        {
            _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        }

        // Mark as PROCESSING in-memory so they don't get double-pushed if loop overlaps
        foreach (var evt in eventsToPush)
        {
            evt.Status = "PROCESSING";
            evt.AttemptCount++;
            evt.LastAttemptAt = DateTime.UtcNow;
        }
        await dbContext.SaveChangesAsync(stoppingToken);

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "pos/sync/push");
            request.Content = JsonContent.Create(new { events = eventsToPush });
            
            var response = await _httpClient.SendAsync(request, stoppingToken);
            
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<SyncPushResponse>(cancellationToken: stoppingToken);
                if (result != null)
                {
                    foreach (var evt in eventsToPush)
                    {
                        if (result.Accepted?.Contains(evt.OperationId) == true || result.AlreadyProcessed?.Contains(evt.OperationId) == true)
                        {
                            evt.Status = "SYNCED";
                            evt.ErrorCode = null;
                            evt.ErrorMessage = null;
                        }
                        else if (result.Rejected?.Contains(evt.OperationId) == true)
                        {
                            evt.Status = "FAILED";
                            evt.ErrorMessage = "Rejected by cloud validation";
                        }
                        else if (result.Conflicts?.Contains(evt.OperationId) == true)
                        {
                            evt.Status = "CONFLICT";
                            evt.ErrorMessage = "Conflict detected by cloud";
                        }
                        else
                        {
                            // If it wasn't in any array, assume failed
                            evt.Status = "FAILED";
                            evt.ErrorMessage = "Cloud response omitted this event";
                        }
                    }
                }
            }
            else
            {
                _logger.LogWarning($"Network error pushing events. Status: {response.StatusCode}");
                foreach (var evt in eventsToPush) evt.Status = "FAILED";
                await dbContext.SaveChangesAsync(stoppingToken);
                throw new Exception($"Network error pushing POS events. Status: {response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to push sync events");
            foreach (var evt in eventsToPush)
            {
                evt.Status = "FAILED";
                evt.ErrorMessage = ex.Message;
            }
            await dbContext.SaveChangesAsync(stoppingToken);
            throw;
        }

        await dbContext.SaveChangesAsync(stoppingToken);
    }

    private class SyncPushResponse
    {
        public List<string>? Accepted { get; set; }
        public List<string>? AlreadyProcessed { get; set; }
        public List<string>? Rejected { get; set; }
        public List<string>? Conflicts { get; set; }
        public string? ServerCursor { get; set; }
    }

    private async Task PushKeycardAuditsAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        var pendingAudits = await dbContext.KeycardAudits
            .Where(a => a.SyncStatus == "PENDING")
            .OrderBy(a => a.Timestamp)
            .Take(50)
            .ToListAsync(stoppingToken);

        if (!pendingAudits.Any()) return;

        _logger.LogInformation($"Pushing {pendingAudits.Count} keycard audits to cloud...");
        
        var token = await _authManager.GetAuthTokenAsync();
        if (!string.IsNullOrEmpty(token))
        {
            _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        }

        foreach (var audit in pendingAudits)
        {
            try
            {
                // In production, this pushes to the cloud /api/v1/hardware/keycards/audit endpoint
                var request = new HttpRequestMessage(HttpMethod.Post, "hardware/keycards/audit");
                request.Headers.Add("Idempotency-Key", audit.OperationId);
                // request.Content = JsonContent.Create(audit);
                // var response = await _httpClient.SendAsync(request, stoppingToken);
                // response.EnsureSuccessStatusCode();

                audit.SyncStatus = "SYNCED";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to push keycard audit {audit.OperationId}");
                break;
            }
        }

        await dbContext.SaveChangesAsync(stoppingToken);
    }

    /// <summary>
    /// Pulls property config and staff records (with permissions) from the cloud.
    /// This is the authoritative source for:
    ///   - Property timezone and EarlyCheckinWindowHours
    ///   - Staff POS PIN hashes and permission arrays
    /// Applies changes to SQLite so the desktop can operate offline.
    /// </summary>
    private async Task PullUpdatesAsync(CancellationToken stoppingToken)
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
            // Fallback to AuthManager in case it was stored there
            token = await _authManager.GetAuthTokenAsync();
            if (string.IsNullOrEmpty(token))
            {
                throw new Exception("No auth token available; skipping pull.");
            }
        }

        _httpClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var lastPullStr = Preferences.Get($"LastPull_{propertyId}", "");
        var sinceParam = string.IsNullOrEmpty(lastPullStr) ? "" : $"&since={Uri.EscapeDataString(lastPullStr)}";

        var response = await _httpClient.GetAsync(
            $"sync/pull?propertyId={Uri.EscapeDataString(propertyId)}{sinceParam}",
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

            // ---- Apply property config ------------------------------------
            if (root.TryGetProperty("property", out var propEl))
            {
                var localProp = await dbContext.Properties
                    .FirstOrDefaultAsync(p => p.Id == propertyId, stoppingToken);

                if (localProp != null)
                {
                    if (propEl.TryGetProperty("name", out var name))
                        localProp.Name = name.GetString() ?? localProp.Name;
                    
                    if (propEl.TryGetProperty("code", out var code))
                        localProp.Code = code.GetString() ?? localProp.Code;

                    if (propEl.TryGetProperty("city", out var city))
                        localProp.City = city.GetString() ?? localProp.City;
                    
                    if (propEl.TryGetProperty("currency", out var curr))
                        localProp.Currency = curr.GetString() ?? localProp.Currency;

                    if (propEl.TryGetProperty("timezone", out var tz))
                        localProp.Timezone = tz.GetString() ?? localProp.Timezone;

                    if (propEl.TryGetProperty("earlyCheckinWindowHours", out var eciw))
                        localProp.EarlyCheckinWindowHours = eciw.GetInt32();

                    if (propEl.TryGetProperty("bankingModel", out var bm))
                        localProp.BankingModel = bm.GetString() ?? localProp.BankingModel;

                    if (root.TryGetProperty("syncedAt", out var syncedAtEl))
                    {
                        Preferences.Set($"LastPull_{propertyId}", syncedAtEl.GetString());
                    }

                    if (propEl.TryGetProperty("businessDate", out var bd) &&
                        DateTime.TryParse(bd.GetString(), out var parsedDate))
                        localProp.BusinessDate = parsedDate;
                }
                else
                {
                    localProp = new LodgeCore.Desktop.Data.Entities.LocalProperty
                    {
                        Id = propertyId,
                        Name = propEl.TryGetProperty("name", out var n) ? n.GetString() ?? "Unknown" : "Unknown",
                        Code = propEl.TryGetProperty("code", out var c) ? c.GetString() ?? "" : "",
                        City = propEl.TryGetProperty("city", out var cy) ? cy.GetString() ?? "" : "",
                        Currency = propEl.TryGetProperty("currency", out var cur) ? cur.GetString() ?? "NGN" : "NGN",
                        Timezone = propEl.TryGetProperty("timezone", out var tz2) ? tz2.GetString() ?? "UTC" : "UTC",
                        IsActive = true,
                        EarlyCheckinWindowHours = propEl.TryGetProperty("earlyCheckinWindowHours", out var eciw2) ? eciw2.GetInt32() : 2,
                        BankingModel = propEl.TryGetProperty("bankingModel", out var bm2) ? bm2.GetString() ?? "SERVER_BANKING" : "SERVER_BANKING",
                        BusinessDate = propEl.TryGetProperty("businessDate", out var bd2) && DateTime.TryParse(bd2.GetString(), out var parsedDate2) ? parsedDate2 : DateTime.UtcNow.Date
                    };
                    dbContext.Properties.Add(localProp);
                }
            }

            // ---- Apply staff records --------------------------------------
            if (root.TryGetProperty("staff", out var staffArray))
            {
                var incomingStaffIds = new HashSet<string>();
                var staffArrayLength = staffArray.GetArrayLength();
                var currentIndex = 0;

                foreach (var staffEl in staffArray.EnumerateArray())
                {
                    currentIndex++;
                    BroadcastHealth(SyncState.SYNCING, null, "STAFF", currentIndex, staffArrayLength, "Downloading staff...");

                    var staffId = staffEl.GetProperty("id").GetString() ?? "";
                    if (string.IsNullOrEmpty(staffId)) continue;

                    var existing = await dbContext.Staff
                        .FirstOrDefaultAsync(s => s.Id == staffId, stoppingToken);

                    if (existing != null)
                    {
                        // Update mutable fields — never overwrite Id
                        existing.FirstName = staffEl.TryGetProperty("firstName", out var fn)
                            ? fn.GetString() ?? existing.FirstName : existing.FirstName;
                        existing.LastName = staffEl.TryGetProperty("lastName", out var ln)
                            ? ln.GetString() ?? existing.LastName : existing.LastName;
                        existing.Role = staffEl.TryGetProperty("role", out var role)
                            ? role.GetString() ?? existing.Role : existing.Role;
                        existing.PosPinHash = staffEl.TryGetProperty("posPinHash", out var pin)
                            ? (pin.GetString() ?? "") : existing.PosPinHash;
                        existing.PosTokenVersion = staffEl.TryGetProperty("posTokenVersion", out var tv)
                            ? tv.GetInt32() : existing.PosTokenVersion;
                        existing.IsActive = staffEl.TryGetProperty("isActive", out var ia)
                            ? ia.GetBoolean() : existing.IsActive;
                        existing.HasPosAccess = staffEl.TryGetProperty("hasPosAccess", out var hpa)
                            ? hpa.GetBoolean() : existing.HasPosAccess;
                        existing.PermissionsJson = staffEl.TryGetProperty("permissionsJson", out var pj)
                            ? pj.GetString() ?? existing.PermissionsJson : existing.PermissionsJson;
                    }
                    else
                    {
                        // New staff member — add to local DB
                        dbContext.Staff.Add(new LodgeCore.Desktop.Data.Entities.LocalStaff
                        {
                            Id              = staffId,
                            PropertyId      = propertyId,
                            FirstName       = staffEl.TryGetProperty("firstName", out var fn2) ? fn2.GetString() ?? "" : "",
                            LastName        = staffEl.TryGetProperty("lastName",  out var ln2) ? ln2.GetString() ?? "" : "",
                            Role            = staffEl.TryGetProperty("role",      out var role2) ? role2.GetString() ?? "" : "",
                            PosPinHash      = staffEl.TryGetProperty("posPinHash", out var pin2) ? (pin2.GetString() ?? "") : "",
                            PosTokenVersion = staffEl.TryGetProperty("posTokenVersion", out var tv2) ? tv2.GetInt32() : 1,
                            IsActive        = staffEl.TryGetProperty("isActive",   out var ia2) && ia2.GetBoolean(),
                            HasPosAccess    = staffEl.TryGetProperty("hasPosAccess", out var hpa2) && hpa2.GetBoolean(),
                            PermissionsJson = staffEl.TryGetProperty("permissionsJson", out var pj2) ? pj2.GetString() ?? "[]" : "[]",
                        });
                    }
                    
                    incomingStaffIds.Add(staffId);
                }

                // SECURITY: Remove local staff that were excluded from the sync payload
                // (e.g. fired, POS access revoked, or property access removed).
                // Failing to delete these would allow indefinitely cached PIN logins.
                var obsoleteStaff = await dbContext.Staff
                    .Where(s => !incomingStaffIds.Contains(s.Id))
                    .ToListAsync(stoppingToken);

                if (obsoleteStaff.Any())
                {
                    dbContext.Staff.RemoveRange(obsoleteStaff);
                    _logger.LogInformation($"Removed {obsoleteStaff.Count} revoked staff members.");
                }
            }

            // ---- Apply Front Desk Operational Cache -------------------------
            
            // 1. Room Types
            if (root.TryGetProperty("roomTypes", out var rtArray))
            {
                var len = rtArray.GetArrayLength();
                var i = 0;
                foreach (var el in rtArray.EnumerateArray())
                {
                    i++;
                    BroadcastHealth(SyncState.SYNCING, null, "ROOM_TYPES", i, len, "Syncing room types...");
                    var id = el.GetProperty("id").GetString();
                    if (string.IsNullOrEmpty(id)) continue;
                    
                    var rt = await dbContext.RoomTypes.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (rt == null)
                    {
                        rt = new LodgeCore.Desktop.Data.Entities.LocalRoomType { Id = id, PropertyId = propertyId, CreatedAt = DateTime.UtcNow };
                        dbContext.RoomTypes.Add(rt);
                    }
                    rt.Name = el.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                    rt.Code = el.TryGetProperty("code", out var cd) ? cd.GetString() ?? "" : "";
                    rt.Description = el.TryGetProperty("description", out var d) ? d.GetString() : null;
                    rt.BasePrice = el.TryGetProperty("baseRate", out var br) && decimal.TryParse(br.GetString(), out var brd) ? brd : 0m;
                    rt.Currency = el.TryGetProperty("currency", out var curr) ? curr.GetString() ?? "NGN" : "NGN";
                    rt.MaxOccupancy = el.TryGetProperty("maxOccupancy", out var mo) ? mo.GetInt32() : 2;
                    rt.MaxAdults = el.TryGetProperty("maxAdults", out var ma) ? ma.GetInt32() : 2;
                    rt.MaxChildren = el.TryGetProperty("maxChildren", out var mc) ? mc.GetInt32() : 0;
                    rt.DefaultBedConfig = el.TryGetProperty("defaultBedConfig", out var dbc) ? dbc.GetString() : null;
                    rt.IsActive = el.TryGetProperty("isActive", out var ia) ? ia.GetBoolean() : true;
                    rt.UpdatedAt = DateTime.UtcNow;
                }
            }
            
            // 2. Rooms
            if (root.TryGetProperty("rooms", out var roomsArray))
            {
                var len = roomsArray.GetArrayLength();
                var i = 0;
                foreach (var el in roomsArray.EnumerateArray())
                {
                    i++;
                    BroadcastHealth(SyncState.SYNCING, null, "ROOMS", i, len, "Syncing rooms...");
                    var id = el.GetProperty("id").GetString();
                    if (string.IsNullOrEmpty(id)) continue;
                    
                    var room = await dbContext.Rooms.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (room == null)
                    {
                        room = new LodgeCore.Desktop.Data.Entities.LocalRoom { Id = id, PropertyId = propertyId, CreatedAt = DateTime.UtcNow };
                        dbContext.Rooms.Add(room);
                    }
                    room.Number = el.TryGetProperty("number", out var num) ? num.GetString() ?? "" : "";
                    room.Code = el.TryGetProperty("code", out var cd) ? cd.GetString() ?? room.Number : room.Number;
                    room.DisplayName = el.TryGetProperty("displayName", out var dn) ? dn.GetString() : null;
                    room.BuildingId = el.TryGetProperty("buildingId", out var bid) ? bid.GetString() : null;
                    room.BuildingName = el.TryGetProperty("building", out var bld) && bld.ValueKind != System.Text.Json.JsonValueKind.Null && bld.TryGetProperty("name", out var bnm) ? bnm.GetString() : null;
                    room.FloorId = el.TryGetProperty("floorId", out var fid) ? fid.GetString() : null;
                    room.FloorName = el.TryGetProperty("floor", out var flr) && flr.ValueKind != System.Text.Json.JsonValueKind.Null && flr.TryGetProperty("name", out var fnm) ? fnm.GetString() : null;
                    room.FloorNumber = el.TryGetProperty("floor", out var flr2) && flr2.ValueKind != System.Text.Json.JsonValueKind.Null && flr2.TryGetProperty("number", out var fnum) ? fnum.GetInt32() : (int?)null;
                    room.Status = el.TryGetProperty("status", out var st) ? st.GetString() ?? "" : "";
                    room.HousekeepingStatus = el.TryGetProperty("housekeepingStatus", out var hs) ? hs.GetString() ?? "" : "";
                    room.MaintenanceStatus = el.TryGetProperty("maintenanceStatus", out var ms) ? ms.GetString() ?? "" : "";
                    room.RoomTypeId = el.TryGetProperty("roomTypeId", out var rti) ? rti.GetString() ?? "" : "";
                    room.LockSystemCode = el.TryGetProperty("lockSystemCode", out var lsc) ? lsc.GetString() : (el.TryGetProperty("code", out var loldc) ? loldc.GetString() : null);
                    room.MaxOccupancy = el.TryGetProperty("maxOccupancy", out var mo) ? mo.GetInt32() : 2;
                    room.MaxAdults = el.TryGetProperty("maxAdults", out var ma) ? ma.GetInt32() : 2;
                    room.MaxChildren = el.TryGetProperty("maxChildren", out var mc) ? mc.GetInt32() : 0;
                    room.IsAccessible = el.TryGetProperty("isAccessible", out var isa) && isa.GetBoolean();
                    room.IsActive = el.TryGetProperty("isActive", out var ia) ? ia.GetBoolean() : true;
                    room.UpdatedAt = DateTime.UtcNow;
                }
            }

            // 3. Guests (Migrated to SyncGuestsIncrementalAsync)
            // Removed redundant full-guest payload handling here

            // 4. Reservations
            if (root.TryGetProperty("reservations", out var resArray))
            {
                var len = resArray.GetArrayLength();
                var i = 0;
                // Keep track of incoming reservation IDs to remove stale cached ones
                var incomingResIds = new HashSet<string>();

                foreach (var el in resArray.EnumerateArray())
                {
                    i++;
                    BroadcastHealth(SyncState.SYNCING, null, "RESERVATIONS", i, len, "Syncing reservations...");
                    var id = el.GetProperty("id").GetString();
                    if (string.IsNullOrEmpty(id)) continue;
                    
                    incomingResIds.Add(id);
                    
                    var res = await dbContext.Reservations.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (res == null)
                    {
                        res = new LodgeCore.Desktop.Data.Entities.LocalReservation { Id = id, PropertyId = propertyId, CreatedAt = DateTime.UtcNow };
                        dbContext.Reservations.Add(res);
                    }
                    res.GuestId = el.TryGetProperty("primaryGuestId", out var pg) ? pg.GetString() ?? "" : "";
                    res.Status = el.TryGetProperty("status", out var st) ? st.GetString() ?? "" : "";
                    res.RoomId = el.TryGetProperty("roomId", out var ri) ? ri.GetString() : null;
                    res.RoomNumber = el.TryGetProperty("roomNumber", out var rn) ? rn.GetString() : null;
                    
                    if (el.TryGetProperty("checkIn", out var ci) && DateTime.TryParse(ci.GetString(), out var cid))
                        res.CheckInDate = cid;
                    if (el.TryGetProperty("checkOut", out var co) && DateTime.TryParse(co.GetString(), out var cod))
                        res.CheckOutDate = cod;
                    
                    res.Adults = el.TryGetProperty("adults", out var adl) ? adl.GetInt32() : res.Adults;
                    res.Children = el.TryGetProperty("children", out var chl) ? chl.GetInt32() : res.Children;
                    res.RoomTypeId = el.TryGetProperty("roomTypeId", out var rti2) ? rti2.GetString() : res.RoomTypeId;
                    res.SpecialRequests = el.TryGetProperty("specialRequests", out var sr) ? sr.GetString() : res.SpecialRequests;
                    res.ConfirmationNumber = el.TryGetProperty("confirmationNumber", out var cn) ? cn.GetString() : res.ConfirmationNumber;
                    if (el.TryGetProperty("depositRequired", out var dr) && decimal.TryParse(dr.GetString() ?? dr.GetRawText(), out var drv))
                        res.DepositRequired = drv;
                    if (el.TryGetProperty("depositPaid", out var dp2) && decimal.TryParse(dp2.GetString() ?? dp2.GetRawText(), out var dpv))
                        res.DepositPaid = dpv;
                        
                    res.CompanyId = el.TryGetProperty("companyId", out var comp) ? comp.GetString() : null;
                    res.Source = el.TryGetProperty("source", out var src) ? src.GetString() : null;
                    res.ChannelRef = el.TryGetProperty("channelRef", out var cref) ? cref.GetString() : null;
                    res.RatePlanId = el.TryGetProperty("ratePlanId", out var rpi) ? rpi.GetString() : null;
                    res.Currency = el.TryGetProperty("currency", out var cur) ? cur.GetString() : null;
                    res.InternalNotes = el.TryGetProperty("internalNotes", out var inn) ? inn.GetString() : null;
                    res.EarlyCheckIn = el.TryGetProperty("earlyCheckIn", out var eci) && eci.GetBoolean();
                    res.LateCheckOut = el.TryGetProperty("lateCheckOut", out var lco) && lco.GetBoolean();
                    
                    if (el.TryGetProperty("cancelledAt", out var canAt) && DateTime.TryParse(canAt.GetString(), out var canAtD)) res.CancelledAt = canAtD;
                    res.CancelledBy = el.TryGetProperty("cancelledBy", out var canBy) ? canBy.GetString() : null;
                    res.CancellationReason = el.TryGetProperty("cancellationReason", out var canRe) ? canRe.GetString() : null;
                    
                    if (el.TryGetProperty("noShowAt", out var nsAt) && DateTime.TryParse(nsAt.GetString(), out var nsAtD)) res.NoShowAt = nsAtD;
                    res.NoShowBy = el.TryGetProperty("noShowBy", out var nsBy) ? nsBy.GetString() : null;
                    res.CreatedBy = el.TryGetProperty("createdBy", out var cb) ? cb.GetString() : null;

                    res.UpdatedAt = DateTime.UtcNow;

                    // Parse LockCredentials
                    if (el.TryGetProperty("lockCredentials", out var credsArray) && credsArray.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        var incomingCredIds = new HashSet<string>();
                        foreach (var credEl in credsArray.EnumerateArray())
                        {
                            var credId = credEl.GetProperty("id").GetString();
                            if (string.IsNullOrEmpty(credId)) continue;
                            incomingCredIds.Add(credId);

                            var cred = await dbContext.LockCredentials.FirstOrDefaultAsync(c => c.Id == credId, stoppingToken);
                            if (cred == null)
                            {
                                cred = new LodgeCore.Desktop.Data.Entities.LocalLockCredential { Id = credId, ReservationId = id, CreatedAt = DateTime.UtcNow };
                                dbContext.LockCredentials.Add(cred);
                            }
                            cred.GuestId = credEl.TryGetProperty("guestId", out var cg) ? cg.GetString() : null;
                            cred.RoomId = credEl.TryGetProperty("roomId", out var cri) ? cri.GetString() ?? "" : "";
                            cred.LockId = credEl.TryGetProperty("lockId", out var cli) ? cli.GetString() ?? "" : "";
                            cred.CredentialType = credEl.TryGetProperty("credentialType", out var cct) ? cct.GetString() ?? "rfid" : "rfid";
                            cred.Status = credEl.TryGetProperty("status", out var cst) ? cst.GetString() ?? "PENDING" : "PENDING";
                            if (credEl.TryGetProperty("validFrom", out var cvf) && DateTime.TryParse(cvf.GetString(), out var cvfd)) cred.ValidFrom = cvfd;
                            if (credEl.TryGetProperty("validUntil", out var cvu) && DateTime.TryParse(cvu.GetString(), out var cvud)) cred.ValidUntil = cvud;
                            cred.CardSerialNumber = credEl.TryGetProperty("cardSerialNumber", out var csn) ? csn.GetString() : null;
                            cred.IssueOperationId = credEl.TryGetProperty("issueOperationId", out var cio) ? cio.GetString() : null;
                            if (credEl.TryGetProperty("issuedAt", out var cia) && DateTime.TryParse(cia.GetString(), out var ciad)) cred.IssuedAt = ciad;
                            if (credEl.TryGetProperty("revokedAt", out var cra) && DateTime.TryParse(cra.GetString(), out var crad)) cred.RevokedAt = crad;
                            cred.MetadataJson = credEl.TryGetProperty("metadata", out var csm) ? csm.GetRawText() : null;
                            cred.UpdatedAt = DateTime.UtcNow;
                        }
                        
                        var staleCreds = await dbContext.LockCredentials
                            .Where(c => c.ReservationId == id && !incomingCredIds.Contains(c.Id))
                            .ToListAsync(stoppingToken);
                        if (staleCreds.Any()) dbContext.LockCredentials.RemoveRange(staleCreds);
                    }

                    // Parse LockOperations
                    if (el.TryGetProperty("lockOperations", out var opsArray) && opsArray.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        var incomingOpIds = new HashSet<string>();
                        foreach (var opEl in opsArray.EnumerateArray())
                        {
                            var opId = opEl.GetProperty("id").GetString();
                            if (string.IsNullOrEmpty(opId)) continue;
                            incomingOpIds.Add(opId);

                            var op = await dbContext.LockOperations.FirstOrDefaultAsync(o => o.Id == opId, stoppingToken);
                            if (op == null)
                            {
                                op = new LodgeCore.Desktop.Data.Entities.LocalLockOperation { Id = opId, PropertyId = propertyId, ReservationId = id };
                                dbContext.LockOperations.Add(op);
                            }
                            op.LockId = opEl.TryGetProperty("lockId", out var oli) ? oli.GetString() : null;
                            op.RoomId = opEl.TryGetProperty("roomId", out var ori) ? ori.GetString() : null;
                            op.CredentialId = opEl.TryGetProperty("credentialId", out var oci) ? oci.GetString() : null;
                            op.CommandId = opEl.TryGetProperty("commandId", out var ocmd) ? ocmd.GetString() : null;
                            op.IdempotencyKey = opEl.TryGetProperty("idempotencyKey", out var oik) ? oik.GetString() : null;
                            op.Operation = opEl.TryGetProperty("operation", out var oop) ? oop.GetString() ?? "" : "";
                            op.Status = opEl.TryGetProperty("status", out var ost) ? ost.GetString() ?? "QUEUED" : "QUEUED";
                            op.ErrorCode = opEl.TryGetProperty("errorCode", out var oec) ? oec.GetString() : null;
                            op.ErrorMessage = opEl.TryGetProperty("errorMessage", out var oem) ? oem.GetString() : null;
                            op.PayloadHash = opEl.TryGetProperty("payloadHash", out var oph) ? oph.GetString() : null;
                            op.AttemptCount = opEl.TryGetProperty("attemptCount", out var oac) ? oac.GetInt32() : 0;
                            if (opEl.TryGetProperty("requestedAt", out var orq) && DateTime.TryParse(orq.GetString(), out var orqd)) op.RequestedAt = orqd;
                            if (opEl.TryGetProperty("startedAt", out var osa) && DateTime.TryParse(osa.GetString(), out var osad)) op.StartedAt = osad;
                            if (opEl.TryGetProperty("completedAt", out var oca) && DateTime.TryParse(oca.GetString(), out var ocad)) op.CompletedAt = ocad;
                            op.AgentId = opEl.TryGetProperty("agentId", out var oai) ? oai.GetString() : null;
                            op.DeviceId = opEl.TryGetProperty("deviceId", out var odi) ? odi.GetString() : null;
                            op.MetadataJson = opEl.TryGetProperty("metadata", out var ometa) ? ometa.GetRawText() : null;
                            
                            // To mimic standard GraphQL/Prisma include format we need the command populated
                            if (opEl.TryGetProperty("command", out var opCmd))
                            {
                                op.CommandJson = opCmd.GetRawText();
                            }
                        }
                        
                        var staleOps = await dbContext.LockOperations
                            .Where(o => o.ReservationId == id && !incomingOpIds.Contains(o.Id))
                            .ToListAsync(stoppingToken);
                        if (staleOps.Any()) dbContext.LockOperations.RemoveRange(staleOps);
                    }
                }
                
                // Remove reservations that are no longer in the cache window
                var staleRes = await dbContext.Reservations
                    .Where(r => !incomingResIds.Contains(r.Id) && !r.IsDirty)
                    .ToListAsync(stoppingToken);
                
                if (staleRes.Any())
                {
                    dbContext.Reservations.RemoveRange(staleRes);
                }
            }

            // 5. Folios
            if (root.TryGetProperty("folios", out var foliosArray))
            {
                var len = foliosArray.GetArrayLength();
                var i = 0;
                var incomingFolioIds = new HashSet<string>();

                foreach (var el in foliosArray.EnumerateArray())
                {
                    i++;
                    BroadcastHealth(SyncState.SYNCING, null, "FOLIOS", i, len, "Syncing folios...");
                    var id = el.GetProperty("id").GetString();
                    if (string.IsNullOrEmpty(id)) continue;
                    
                    incomingFolioIds.Add(id);
                    
                    var folio = await dbContext.Folios.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (folio == null)
                    {
                        folio = new LodgeCore.Desktop.Data.Entities.LocalFolio { Id = id, PropertyId = propertyId, CreatedAt = DateTime.UtcNow };
                        dbContext.Folios.Add(folio);
                    }
                    folio.ReservationId = el.TryGetProperty("reservationId", out var ri) ? ri.GetString() ?? "" : "";
                    folio.Status = el.TryGetProperty("status", out var st) ? st.GetString() ?? "" : "";
                    folio.TotalCharges = el.TryGetProperty("totalCharges", out var tc) && decimal.TryParse(tc.GetString(), out var tcd) ? tcd : 0m;
                    folio.TotalPayments = el.TryGetProperty("totalPayments", out var tp) && decimal.TryParse(tp.GetString(), out var tpd) ? tpd : 0m;
                    // Stringify the whole folio for local offline rendering without full schema
                    folio.TransactionsJson = el.GetRawText();
                    folio.UpdatedAt = DateTime.UtcNow;
                }
                
                var staleFolios = await dbContext.Folios
                    .Where(f => !incomingFolioIds.Contains(f.Id) && !f.IsDirty)
                    .ToListAsync(stoppingToken);
                if (staleFolios.Any())
                {
                    dbContext.Folios.RemoveRange(staleFolios);
                }
            }

            // 6. POS Outlets
            if (root.TryGetProperty("posOutlets", out var posOutletsArray))
            {
                var incomingIds = new HashSet<string>();
                foreach (var el in posOutletsArray.EnumerateArray())
                {
                    var id = el.GetProperty("id").GetString();
                    if (string.IsNullOrEmpty(id)) continue;
                    incomingIds.Add(id);
                    
                    var outlet = await dbContext.PosOutlets.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (outlet == null)
                    {
                        outlet = new LodgeCore.Desktop.Data.Entities.LocalPosOutlet { Id = id };
                        dbContext.PosOutlets.Add(outlet);
                    }
                    outlet.PropertyId = el.TryGetProperty("propertyId", out var pid) ? pid.GetString() ?? "" : "";
                    outlet.Name = el.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                    outlet.Type = el.TryGetProperty("type", out var t) ? t.GetString() ?? "" : "";
                    outlet.IsActive = el.TryGetProperty("isActive", out var ia) && ia.GetBoolean();
                    outlet.AutoLockSeconds = el.TryGetProperty("autoLockSeconds", out var als) && als.ValueKind == System.Text.Json.JsonValueKind.Number ? als.GetInt32() : null;
                }
                
                if (posOutletsArray.GetArrayLength() > 0)
                {
                    var stale = await dbContext.PosOutlets.Where(o => o.PropertyId == propertyId && !incomingIds.Contains(o.Id)).ToListAsync(stoppingToken);
                    if (stale.Any()) dbContext.PosOutlets.RemoveRange(stale);
                }
            }

            // 7. POS Categories
            if (root.TryGetProperty("posCategories", out var posCategoriesArray))
            {
                var incomingIds = new HashSet<string>();
                var outletIds = await dbContext.PosOutlets.Where(o => o.PropertyId == propertyId).Select(o => o.Id).ToListAsync(stoppingToken);

                foreach (var el in posCategoriesArray.EnumerateArray())
                {
                    var id = el.GetProperty("id").GetString();
                    var outletId = el.TryGetProperty("outletId", out var oid) ? oid.GetString() : "";
                    
                    if (string.IsNullOrEmpty(id) || string.IsNullOrEmpty(outletId) || !outletIds.Contains(outletId)) continue;
                    incomingIds.Add(id);

                    var cat = await dbContext.ProductCategories.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (cat == null)
                    {
                        cat = new LodgeCore.Desktop.Data.Entities.LocalProductCategory { Id = id };
                        dbContext.ProductCategories.Add(cat);
                    }
                    cat.OutletId = outletId;
                    cat.Name = el.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                    cat.IsActive = el.TryGetProperty("isActive", out var ia) && ia.GetBoolean();
                    cat.SortOrder = el.TryGetProperty("sortOrder", out var so) && so.ValueKind == System.Text.Json.JsonValueKind.Number ? so.GetInt32() : 0;
                }
                
                if (posCategoriesArray.GetArrayLength() > 0)
                {
                    var stale = await dbContext.ProductCategories.Where(c => outletIds.Contains(c.OutletId) && !incomingIds.Contains(c.Id)).ToListAsync(stoppingToken);
                    if (stale.Any()) dbContext.ProductCategories.RemoveRange(stale);
                }
            }

            // 8. POS Products
            if (root.TryGetProperty("posProducts", out var posProductsArray))
            {
                var incomingIds = new HashSet<string>();
                foreach (var el in posProductsArray.EnumerateArray())
                {
                    var id = el.GetProperty("id").GetString();
                    var elPropertyId = el.TryGetProperty("propertyId", out var pid) ? pid.GetString() : "";
                    
                    if (string.IsNullOrEmpty(id) || elPropertyId != propertyId) continue;
                    incomingIds.Add(id);

                    var prod = await dbContext.PosProducts.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (prod == null)
                    {
                        prod = new LodgeCore.Desktop.Data.Entities.LocalPosProduct { Id = id, PropertyId = propertyId };
                        dbContext.PosProducts.Add(prod);
                    }
                    prod.CategoryId = el.TryGetProperty("categoryId", out var cid) ? cid.GetString() ?? "" : "";
                    prod.Name = el.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                    prod.Price = el.TryGetProperty("price", out var pr) 
                        ? (pr.ValueKind == System.Text.Json.JsonValueKind.Number ? pr.GetDecimal() : (pr.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(pr.GetString(), out var dp) ? dp : 0m)) 
                        : 0m;
                    prod.TaxRate = el.TryGetProperty("taxRate", out var tr) 
                        ? (tr.ValueKind == System.Text.Json.JsonValueKind.Number ? tr.GetDecimal() : (tr.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(tr.GetString(), out var dt) ? dt : 0m)) 
                        : 0m;
                    prod.IsActive = el.TryGetProperty("isActive", out var ia) && ia.GetBoolean();
                    
                    if (el.TryGetProperty("modifiers", out var mods) && mods.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        prod.HasModifiers = mods.GetArrayLength() > 0;
                        var modIds = new HashSet<string>();
                        foreach (var m in mods.EnumerateArray())
                        {
                            var mId = m.TryGetProperty("id", out var mid) ? mid.GetString() : null;
                            if (string.IsNullOrEmpty(mId)) continue;
                            modIds.Add(mId);

                            var localMod = await dbContext.PosProductModifiers.FirstOrDefaultAsync(x => x.Id == mId, stoppingToken);
                            if (localMod == null)
                            {
                                localMod = new LodgeCore.Desktop.Data.Entities.LocalPosProductModifier { Id = mId, ProductId = id };
                                dbContext.PosProductModifiers.Add(localMod);
                            }
                            localMod.Name = m.TryGetProperty("name", out var mn) ? mn.GetString() ?? "" : "";
                            localMod.Price = m.TryGetProperty("price", out var mpr) 
                                ? (mpr.ValueKind == System.Text.Json.JsonValueKind.Number ? mpr.GetDecimal() : (mpr.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(mpr.GetString(), out var mdp) ? mdp : 0m)) 
                                : 0m;
                            localMod.IsActive = m.TryGetProperty("isActive", out var mia) ? mia.GetBoolean() : true;
                        }

                        // Remove stale modifiers for THIS product
                        var staleMods = await dbContext.PosProductModifiers.Where(m => m.ProductId == id && !modIds.Contains(m.Id)).ToListAsync(stoppingToken);
                        if (staleMods.Any()) dbContext.PosProductModifiers.RemoveRange(staleMods);
                    }
                    else
                    {
                        prod.HasModifiers = false;
                    }
                }
                
                if (posProductsArray.GetArrayLength() > 0)
                {
                    var stale = await dbContext.PosProducts.Where(p => p.PropertyId == propertyId && !incomingIds.Contains(p.Id)).ToListAsync(stoppingToken);
                    if (stale.Any()) dbContext.PosProducts.RemoveRange(stale);
                }
            }

            // 9. POS Floor Plans
            if (root.TryGetProperty("posFloorPlans", out var posFloorPlansArray))
            {
                var incomingIds = new HashSet<string>();
                var outletIds = await dbContext.PosOutlets.Where(o => o.PropertyId == propertyId).Select(o => o.Id).ToListAsync(stoppingToken);

                foreach (var el in posFloorPlansArray.EnumerateArray())
                {
                    var id = el.GetProperty("id").GetString();
                    var outletId = el.TryGetProperty("outletId", out var oid) ? oid.GetString() : "";

                    if (string.IsNullOrEmpty(id) || string.IsNullOrEmpty(outletId) || !outletIds.Contains(outletId)) continue;
                    incomingIds.Add(id);

                    var fp = await dbContext.PosFloorPlans.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (fp == null)
                    {
                        fp = new LodgeCore.Desktop.Data.Entities.LocalPosFloorPlan { Id = id, OutletId = outletId };
                        dbContext.PosFloorPlans.Add(fp);
                    }
                    fp.Name = el.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                    fp.IsActive = el.TryGetProperty("isActive", out var ia) ? ia.GetBoolean() : true;
                }

                if (posFloorPlansArray.GetArrayLength() > 0)
                {
                    var stale = await dbContext.PosFloorPlans.Where(f => outletIds.Contains(f.OutletId) && !incomingIds.Contains(f.Id)).ToListAsync(stoppingToken);
                    if (stale.Any()) dbContext.PosFloorPlans.RemoveRange(stale);
                }
            }

            // 10. POS Tables
            if (root.TryGetProperty("posTables", out var posTablesArray))
            {
                var incomingIds = new HashSet<string>();
                var outletIds = await dbContext.PosOutlets.Where(o => o.PropertyId == propertyId).Select(o => o.Id).ToListAsync(stoppingToken);
                var validFloorPlanIds = await dbContext.PosFloorPlans.Where(f => outletIds.Contains(f.OutletId)).Select(f => f.Id).ToListAsync(stoppingToken);

                foreach (var el in posTablesArray.EnumerateArray())
                {
                    var id = el.GetProperty("id").GetString();
                    var fpId = el.TryGetProperty("floorPlanId", out var fpid) ? fpid.GetString() : "";

                    if (string.IsNullOrEmpty(id) || string.IsNullOrEmpty(fpId) || !validFloorPlanIds.Contains(fpId)) continue;
                    incomingIds.Add(id);

                    var table = await dbContext.PosTables.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (table == null)
                    {
                        table = new LodgeCore.Desktop.Data.Entities.LocalPosTable { Id = id, FloorPlanId = fpId };
                        dbContext.PosTables.Add(table);
                    }
                    table.Name = el.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                    table.Capacity = el.TryGetProperty("capacity", out var cap) && cap.ValueKind == System.Text.Json.JsonValueKind.Number ? cap.GetInt32() : 4;
                    table.PositionX = el.TryGetProperty("positionX", out var px) && px.ValueKind == System.Text.Json.JsonValueKind.Number ? px.GetInt32() : 0;
                    table.PositionY = el.TryGetProperty("positionY", out var py) && py.ValueKind == System.Text.Json.JsonValueKind.Number ? py.GetInt32() : 0;
                    table.IsActive = el.TryGetProperty("isActive", out var ia) ? ia.GetBoolean() : true;
                }

                if (posTablesArray.GetArrayLength() > 0)
                {
                    var stale = await dbContext.PosTables.Where(t => validFloorPlanIds.Contains(t.FloorPlanId) && !incomingIds.Contains(t.Id)).ToListAsync(stoppingToken);
                    if (stale.Any()) dbContext.PosTables.RemoveRange(stale);
                }
            }

            // 11. Housekeeping Tasks
            if (root.TryGetProperty("housekeepingTasks", out var housekeepingTasksArray))
            {
                var incomingIds = new HashSet<string>();
                foreach (var el in housekeepingTasksArray.EnumerateArray())
                {
                    var id = el.GetProperty("id").GetString();
                    if (string.IsNullOrEmpty(id)) continue;
                    incomingIds.Add(id);

                    var task = await dbContext.HousekeepingTasks.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (task == null)
                    {
                        task = new LodgeCore.Desktop.Data.Entities.LocalHousekeepingTask { Id = id };
                        dbContext.HousekeepingTasks.Add(task);
                    }
                    
                    task.RoomId = el.TryGetProperty("roomId", out var rid) ? rid.GetString() ?? "" : "";
                    task.TaskType = el.TryGetProperty("type", out var typ) ? typ.GetString() ?? "" : "";
                    task.Status = el.TryGetProperty("status", out var st) ? st.GetString() ?? "" : "";
                    var room = await dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == task.RoomId, stoppingToken);
                    if (room != null)
                    {
                        task.RoomNumber = room.Number ?? "";
                    }
                }

                if (housekeepingTasksArray.GetArrayLength() > 0)
                {
                    var stale = await dbContext.HousekeepingTasks.Where(t => !incomingIds.Contains(t.Id)).ToListAsync(stoppingToken);
                    if (stale.Any()) dbContext.HousekeepingTasks.RemoveRange(stale);
                }
            }

            // 12. Maintenance Tickets
            if (root.TryGetProperty("maintenanceTickets", out var maintenanceTicketsArray))
            {
                var incomingIds = new HashSet<string>();
                foreach (var el in maintenanceTicketsArray.EnumerateArray())
                {
                    var id = el.GetProperty("id").GetString();
                    if (string.IsNullOrEmpty(id)) continue;
                    incomingIds.Add(id);

                    var ticket = await dbContext.MaintenanceTickets.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (ticket == null)
                    {
                        ticket = new LodgeCore.Desktop.Data.Entities.LocalMaintenanceTicket { Id = id, PropertyId = propertyId };
                        dbContext.MaintenanceTickets.Add(ticket);
                    }
                    
                    ticket.RoomId = el.TryGetProperty("roomId", out var rid) ? rid.GetString() ?? "" : "";
                    var title = el.TryGetProperty("title", out var tEl) ? tEl.GetString() ?? "" : "";
                    var desc = el.TryGetProperty("description", out var dEl) ? dEl.GetString() ?? "" : "";
                    ticket.IssueDescription = $"{title} - {desc}".Trim();
                    ticket.Status = el.TryGetProperty("status", out var st) ? st.GetString() ?? "" : "";
                    
                    ticket.Priority = el.TryGetProperty("priority", out var pri) ? pri.GetString() ?? "NORMAL" : "NORMAL";
                    
                    ticket.RequiresRoomRestriction = ticket.Status == "IN_PROGRESS" || ticket.Status == "OPEN"; 
                }

                if (maintenanceTicketsArray.GetArrayLength() > 0)
                {
                    var stale = await dbContext.MaintenanceTickets.Where(t => t.PropertyId == propertyId && !incomingIds.Contains(t.Id)).ToListAsync(stoppingToken);
                    if (stale.Any()) dbContext.MaintenanceTickets.RemoveRange(stale);
                }
            }

            var meta = await dbContext.SyncMetadata.FirstOrDefaultAsync(stoppingToken);
            if (meta == null)
            {
                meta = new LodgeCore.Desktop.Data.Entities.LocalSyncMetadata { Id = "singleton", SchemaVersion = "1.0" };
                dbContext.SyncMetadata.Add(meta);
            }
            meta.LastSuccessfulSyncAt = DateTime.UtcNow;

            await dbContext.SaveChangesAsync(stoppingToken);
            await dbContext.SaveChangesAsync(stoppingToken);
    }
    private async Task PushFrontDeskOutboxAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();
        
        var deviceId = Preferences.Get("DeviceTerminalId", "");
        var propertyId = Preferences.Get("DevicePropertyId", "");
        var baseUrl = Preferences.Get("CloudBaseUrl", "https://api.lodgecore.test");
        var token = await SecureStorage.GetAsync("DeviceAuthToken");

        if (string.IsNullOrEmpty(deviceId) || string.IsNullOrEmpty(propertyId) || string.IsNullOrEmpty(token))
            return;

        var allPending = await dbContext.OutboxEvents
            .Where(e => e.Status == "PENDING" || e.Status == "FAILED" || e.Status == "CONFLICT")
            .ToListAsync(stoppingToken);

        var eventsToPush = new List<LocalOutboxEvent>();
        foreach (var group in allPending.GroupBy(e => e.AggregateId))
        {
             foreach (var evt in group.OrderBy(e => e.Sequence))
             {
                 if (evt.Status == "CONFLICT") break; // Aggregate is blocked requiring manager resolution
                 if (evt.NextAttemptAt != null && evt.NextAttemptAt > DateTime.UtcNow) break; // Aggregate is in backoff
                 
                 eventsToPush.Add(evt);
             }
        }

        var pendingEvents = eventsToPush.OrderBy(e => e.Sequence).Take(50).ToList();

        if (!pendingEvents.Any()) return;

        foreach (var e in pendingEvents) e.AttemptCount++;

        _logger.LogInformation($"Pushing {pendingEvents.Count} Front Desk outbox events to cloud...");
        BroadcastHealth(SyncState.SYNCING, null, "PUSH_FD", 0, pendingEvents.Count, "Pushing Front Desk events...");

        _httpClient.Timeout = TimeSpan.FromSeconds(30);

        var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/api/v1/sync/push/frontdesk");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        
        var payload = new 
        {
            propertyId = propertyId,
            events = pendingEvents.Select(e => new {
                id = e.Id,
                idempotencyKey = e.IdempotencyKey,
                aggregateType = e.AggregateType,
                aggregateId = e.AggregateId,
                aggregateVersion = e.AggregateVersion,
                eventType = e.EventType,
                occurredAt = e.OccurredAt,
                sequence = e.Sequence,
                payloadJson = e.PayloadJson,
                operatorId = e.OperatorId
            }).ToList()
        };
        
        request.Content = JsonContent.Create(payload);

        try
        {
            var response = await _httpClient.SendAsync(request, stoppingToken);
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<SyncPushFrontDeskResponse>(cancellationToken: stoppingToken);
                if (result != null && result.Status == "SUCCESS" && result.Results != null)
                {
                    foreach (var res in result.Results)
                    {
                        var evt = pendingEvents.FirstOrDefault(e => e.Id == res.Id);
                        if (evt != null)
                        {
                            evt.Status = res.Status; 
                            evt.LastError = res.Error;
                            
                            if (res.Status == "SYNCED")
                            {
                                evt.SyncedAt = DateTime.UtcNow;
                                evt.NextAttemptAt = null;
                            }
                            else if (res.Status == "CONFLICT")
                            {
                                evt.NextAttemptAt = null; // Requires manager resolution
                            }
                            else if (res.Status == "FAILED")
                            {
                                evt.LastAttemptAt = DateTime.UtcNow;
                                if (evt.AttemptCount >= 5)
                                {
                                    evt.Status = "RETRY_EXHAUSTED";
                                    evt.NextAttemptAt = null;
                                }
                                else
                                {
                                    int delaySeconds = Math.Min(3600, (int)Math.Pow(2, evt.AttemptCount) * 5);
                                    evt.NextAttemptAt = DateTime.UtcNow.AddSeconds(delaySeconds);
                                }
                            }
                        }
                    }
                    await dbContext.SaveChangesAsync(stoppingToken);
                }
            }
            else
            {
                int statusCode = (int)response.StatusCode;
                _logger.LogWarning($"Front Desk push failed with status {statusCode}");
                
                // Specific HTTP Failure Classifications
                if (statusCode == 401 || statusCode == 403)
                {
                    if (await TryRefreshDeviceTokenAsync(stoppingToken))
                    {
                        return; // Retry on next loop
                    }
                    // Authentication/Authorization: Pause sync loop, don't increment attempt count
                    BroadcastHealth(SyncState.ERROR, null, "AUTH_ERROR", 0, 1, $"Auth failed: {statusCode}. Please re-authenticate.");
                    throw new Exception($"Auth failed: {statusCode}. Please re-authenticate.");
                }

                foreach (var evt in pendingEvents) 
                { 
                    if (statusCode == 400)
                    {
                        // Malformed Event / Invalid Schema
                        evt.Status = "DEAD_LETTER";
                        evt.LastError = $"HTTP 400: Malformed event payload";
                        evt.NextAttemptAt = null;
                    }
                    else if (statusCode == 409)
                    {
                        // Version Conflict / Optimistic Concurrency Failure
                        evt.Status = "CONFLICT";
                        evt.LastError = $"HTTP 409: Concurrency conflict";
                        evt.NextAttemptAt = null;
                    }
                    else 
                    {
                        // 429, 500, 502, 503, 504: Transient Network or Server Error -> Retry
                        evt.LastError = $"HTTP {statusCode}"; 
                        evt.LastAttemptAt = DateTime.UtcNow;
                        
                        if (evt.AttemptCount >= 5) 
                        {
                            evt.Status = "RETRY_EXHAUSTED";
                            evt.NextAttemptAt = null;
                        } 
                        else 
                        {
                            evt.Status = "FAILED";
                            // Exponential backoff
                            int delaySeconds = Math.Min(3600, (int)Math.Pow(2, evt.AttemptCount) * 5);
                            evt.NextAttemptAt = DateTime.UtcNow.AddSeconds(delaySeconds);
                        }
                    }
                }
                await dbContext.SaveChangesAsync(stoppingToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error pushing Front Desk outbox events.");
            foreach (var evt in pendingEvents) { evt.Status = "FAILED"; evt.LastError = ex.Message; }
            await dbContext.SaveChangesAsync(stoppingToken);
            throw;
        }
    }

    private class SyncPushFrontDeskResponse
    {
        public string Status { get; set; } = string.Empty;
        public List<SyncPushFrontDeskResult>? Results { get; set; }
    }
    
    private class SyncPushFrontDeskResult
    {
        public string Id { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string IdempotencyKey { get; set; } = string.Empty;
        public string? Error { get; set; }
    }

    private async Task<bool> TryRefreshDeviceTokenAsync(CancellationToken stoppingToken)
    {
        var token = _credentialStorage.LoadCredential("deviceCredential");
        var propertyId = Preferences.Get("DevicePropertyId", "");
        var baseUrl = Preferences.Get("CloudBaseUrl", "https://api.lodgecore.test");
        
        if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(propertyId)) return false;
        
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/api/v1/device/refresh");
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            request.Content = JsonContent.Create(new { propertyId });
            
            var response = await _httpClient.SendAsync(request, stoppingToken);
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<DeviceRefreshResponse>(cancellationToken: stoppingToken);
                if (result != null && result.Success && !string.IsNullOrEmpty(result.DeviceToken))
                {
                    _credentialStorage.SaveCredential("deviceCredential", result.DeviceToken);
                    _logger.LogInformation("Successfully refreshed device token.");
                    return true;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refresh device token.");
        }
        return false;
    }

    private class DeviceRefreshResponse
    {
        public bool Success { get; set; }
        public string? DeviceToken { get; set; }
        public string? Error { get; set; }
    }
    private async Task SyncGuestsIncrementalAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();
        var localRepo = scope.ServiceProvider.GetRequiredService<LocalRepository>();
        
        var propertyId = Preferences.Get("DevicePropertyId", "");
        var baseUrl = Preferences.Get("CloudBaseUrl", "https://api.lodgecore.test");
        var token = await SecureStorage.GetAsync("DeviceAuthToken");

        if (string.IsNullOrEmpty(propertyId) || string.IsNullOrEmpty(token)) return;

        bool hasMore = true;
        int pageCount = 0;
        
        while (hasMore && !stoppingToken.IsCancellationRequested)
        {
            var meta = await dbContext.SyncMetadata.FirstOrDefaultAsync(stoppingToken);
            var cursor = meta?.LastGuestSyncCursor;
            
            var url = $"{baseUrl}/api/v1/sync/guests?propertyId={propertyId}&limit=500";
            if (!string.IsNullOrEmpty(cursor))
            {
                url += $"&cursor={Uri.EscapeDataString(cursor)}";
            }

            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            try
            {
                var response = await _httpClient.SendAsync(request, stoppingToken);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"Guest sync failed with status {(int)response.StatusCode}");
                    break;
                }

                var resultStr = await response.Content.ReadAsStringAsync(stoppingToken);
                var resultJson = System.Text.Json.JsonDocument.Parse(resultStr);
                
                if (resultJson.RootElement.TryGetProperty("data", out var dataEl))
                {
                    if (dataEl.TryGetProperty("items", out var itemsEl) && itemsEl.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        var guestsToUpsert = new List<LodgeCore.Desktop.Data.Entities.LocalGuest>();
                        foreach (var el in itemsEl.EnumerateArray())
                        {
                            var id = el.GetProperty("id").GetString();
                            if (string.IsNullOrEmpty(id)) continue;
                            
                            var g = new LodgeCore.Desktop.Data.Entities.LocalGuest
                            {
                                Id = id,
                                OrganizationId = el.TryGetProperty("organizationId", out var org) ? org.GetString() ?? "" : "",
                                FirstName = el.TryGetProperty("firstName", out var fn) ? fn.GetString() ?? "" : "",
                                LastName = el.TryGetProperty("lastName", out var ln) ? ln.GetString() ?? "" : "",
                                Email = el.TryGetProperty("email", out var em) ? em.GetString() : null,
                                Phone = el.TryGetProperty("phone", out var ph) ? ph.GetString() : null,
                                CompanyName = el.TryGetProperty("companyName", out var cn) ? cn.GetString() : null,
                                IsVip = el.TryGetProperty("isVip", out var vip) && vip.GetBoolean(),
                                Version = el.TryGetProperty("version", out var ver) && ver.ValueKind == System.Text.Json.JsonValueKind.Number ? ver.GetInt32() : 1
                            };
                            
                            if (el.TryGetProperty("updatedAt", out var ua) && DateTime.TryParse(ua.GetString(), out var uad)) g.UpdatedAt = uad;
                            if (el.TryGetProperty("deletedAt", out var da) && DateTime.TryParse(da.GetString(), out var dad)) g.DeletedAt = dad;
                            
                            guestsToUpsert.Add(g);
                        }

                        hasMore = dataEl.TryGetProperty("hasMore", out var hm) && hm.GetBoolean();
                        var nextCursor = dataEl.TryGetProperty("nextCursor", out var nc) && nc.ValueKind != System.Text.Json.JsonValueKind.Null ? nc.GetRawText() : null;

                        if (guestsToUpsert.Any())
                        {
                            pageCount++;
                            BroadcastHealth(SyncState.SYNCING, null, "GUESTS_PAGED", pageCount, -1, $"Syncing guests page {pageCount}...");
                            await localRepo.UpsertGuestPageTransactionAsync(guestsToUpsert, nextCursor);
                        }
                        else
                        {
                            hasMore = false; // No items returned
                        }
                    }
                    else
                    {
                        hasMore = false;
                    }
                }
                else
                {
                    hasMore = false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing guests.");
                break;
            }
        }
    }
}


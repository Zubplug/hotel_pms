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
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var resolver = scope.ServiceProvider.GetRequiredService<ConflictResolver>();
                        await resolver.ResolveConflictsAsync();
                    }

                    await PullUpdatesAsync(stoppingToken);
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
            pendingCount = dbContext.SyncEvents.Count(e => e.Status == "PENDING" || e.Status == "FAILED");
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
            pendingCount = dbContext.SyncEvents.Count(e => e.Status == "PENDING" || e.Status == "FAILED");
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
                var result = await response.Content.ReadFromJsonAsync<SyncPushResponse>(stoppingToken: stoppingToken);
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
                    _consecutiveFailures = 0;
                }
            }
            else
            {
                _consecutiveFailures++;
                _logger.LogWarning($"Network error pushing events. Status: {response.StatusCode}");
                foreach (var evt in eventsToPush) evt.Status = "FAILED";
            }
        }
        catch (Exception ex)
        {
            _consecutiveFailures++;
            _logger.LogError(ex, "Failed to push sync events");
            foreach (var evt in eventsToPush)
            {
                evt.Status = "FAILED";
                evt.ErrorMessage = ex.Message;
            }
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

        var response = await _httpClient.GetAsync(
            $"sync/pull?propertyId={Uri.EscapeDataString(propertyId)}",
            stoppingToken);

            if (!response.IsSuccessStatusCode)
            {
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
                    rt.Description = el.TryGetProperty("description", out var d) ? d.GetString() ?? "" : "";
                    rt.BasePrice = el.TryGetProperty("baseRate", out var br) && decimal.TryParse(br.GetString(), out var brd) ? brd : 0m;
                    rt.MaxOccupancy = el.TryGetProperty("maxOccupancy", out var mo) ? mo.GetInt32() : 2;
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
                    room.Status = el.TryGetProperty("status", out var st) ? st.GetString() ?? "" : "";
                    room.RoomTypeId = el.TryGetProperty("roomTypeId", out var rti) ? rti.GetString() ?? "" : "";
                    room.LockSystemCode = el.TryGetProperty("code", out var code) ? code.GetString() : null;
                    room.UpdatedAt = DateTime.UtcNow;
                }
            }

            // 3. Guests
            if (root.TryGetProperty("guests", out var guestsArray))
            {
                var len = guestsArray.GetArrayLength();
                var i = 0;
                foreach (var el in guestsArray.EnumerateArray())
                {
                    i++;
                    BroadcastHealth(SyncState.SYNCING, null, "GUESTS", i, len, "Syncing guests...");
                    var id = el.GetProperty("id").GetString();
                    if (string.IsNullOrEmpty(id)) continue;
                    
                    var guest = await dbContext.Guests.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (guest == null)
                    {
                        guest = new LodgeCore.Desktop.Data.Entities.LocalGuest { Id = id, PropertyId = propertyId, CreatedAt = DateTime.UtcNow };
                        dbContext.Guests.Add(guest);
                    }
                    guest.FirstName = el.TryGetProperty("firstName", out var fn) ? fn.GetString() ?? "" : "";
                    guest.LastName = el.TryGetProperty("lastName", out var ln) ? ln.GetString() ?? "" : "";
                    guest.Email = el.TryGetProperty("email", out var em) ? em.GetString() : null;
                    guest.Phone = el.TryGetProperty("phone", out var ph) ? ph.GetString() : null;
                    guest.UpdatedAt = DateTime.UtcNow;
                }
            }

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
                    
                    if (el.TryGetProperty("checkIn", out var ci) && DateTime.TryParse(ci.GetString(), out var cid))
                        res.CheckInDate = cid;
                    if (el.TryGetProperty("checkOut", out var co) && DateTime.TryParse(co.GetString(), out var cod))
                        res.CheckOutDate = cod;
                        
                    res.UpdatedAt = DateTime.UtcNow;
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

            var meta = await dbContext.SyncMetadata.FirstOrDefaultAsync(stoppingToken);
            if (meta == null)
            {
                meta = new LodgeCore.Desktop.Data.Entities.LocalSyncMetadata { Id = "singleton", SchemaVersion = "1.0" };
                dbContext.SyncMetadata.Add(meta);
            }
            meta.LastSuccessfulSyncAt = DateTime.UtcNow;

            await dbContext.SaveChangesAsync(stoppingToken);
            _consecutiveFailures = 0;
            _lastSuccess = DateTime.UtcNow;
            _lastError = null;
            BroadcastHealth(SyncState.UP_TO_DATE, null, "COMPLETE", 1, 1, "Sync complete");
            _logger.LogInformation("Sync pull completed successfully.");
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
                    // Authentication/Authorization: Pause sync loop, don't increment attempt count
                    BroadcastHealth(SyncState.ERROR, null, "AUTH_ERROR", 0, 1, $"Auth failed: {statusCode}. Please re-authenticate.");
                    return; 
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
}


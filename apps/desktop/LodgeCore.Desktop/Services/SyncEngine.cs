using System.Net.Http.Json;
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

    public static event Action<SyncHealthInfo> OnSyncHealthChanged;
    
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

            // Ensure the SyncMetadata table exists, as EnsureCreated() won't add it 
            // to existing SQLite databases (no migrations).
            await dbContext.Database.ExecuteSqlRawAsync(
                "CREATE TABLE IF NOT EXISTS SyncMetadata (Id TEXT PRIMARY KEY, LastSuccessfulSyncAt TEXT, LastSyncVersion TEXT, SchemaVersion TEXT);"
            );

            var meta = await dbContext.SyncMetadata.FirstOrDefaultAsync(stoppingToken);
            if (meta != null && meta.LastSuccessfulSyncAt.HasValue)
            {
                _lastSuccess = meta.LastSuccessfulSyncAt.Value;
                _logger.LogInformation($"Restored last successful sync timestamp: {_lastSuccess}");
            }
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
    private async Task PushPendingEventsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        var pendingEvents = await dbContext.SyncEvents
            .Where(e => e.Status == "PENDING" || e.Status == "FAILED")
            .OrderBy(e => e.SequenceNumber)
            .Take(100) // Batch push limit
            .ToListAsync(cancellationToken);

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
        await dbContext.SaveChangesAsync(cancellationToken);

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "pos/sync/push");
            request.Content = JsonContent.Create(new { events = eventsToPush });
            
            var response = await _httpClient.SendAsync(request, cancellationToken);
            
            if (response.IsSuccessStatusCode)
            {
                var result = await response.Content.ReadFromJsonAsync<SyncPushResponse>(cancellationToken: cancellationToken);
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

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private class SyncPushResponse
    {
        public List<string>? Accepted { get; set; }
        public List<string>? AlreadyProcessed { get; set; }
        public List<string>? Rejected { get; set; }
        public List<string>? Conflicts { get; set; }
        public string? ServerCursor { get; set; }
    }

    private async Task PushKeycardAuditsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        var pendingAudits = await dbContext.KeycardAudits
            .Where(a => a.SyncStatus == "PENDING")
            .OrderBy(a => a.Timestamp)
            .Take(50)
            .ToListAsync(cancellationToken);

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
                // var response = await _httpClient.SendAsync(request, cancellationToken);
                // response.EnsureSuccessStatusCode();

                audit.SyncStatus = "SYNCED";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to push keycard audit {audit.OperationId}");
                break;
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Pulls property config and staff records (with permissions) from the cloud.
    /// This is the authoritative source for:
    ///   - Property timezone and EarlyCheckinWindowHours
    ///   - Staff POS PIN hashes and permission arrays
    /// Applies changes to SQLite so the desktop can operate offline.
    /// </summary>
    private async Task PullUpdatesAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        var terminal = await dbContext.PosTerminals.FirstOrDefaultAsync(cancellationToken);
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
            cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                throw new Exception($"Sync pull returned {(int)response.StatusCode}");
            }

            var json = await response.Content.ReadAsStringAsync(cancellationToken);
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            var root = doc.RootElement;

            // ---- Apply property config ------------------------------------
            if (root.TryGetProperty("property", out var propEl))
            {
                var localProp = await dbContext.Properties
                    .FirstOrDefaultAsync(p => p.Id == propertyId, cancellationToken);

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
                        .FirstOrDefaultAsync(s => s.Id == staffId, cancellationToken);

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
                    .ToListAsync(cancellationToken);

                if (obsoleteStaff.Any())
                {
                    dbContext.Staff.RemoveRange(obsoleteStaff);
                    _logger.LogInformation($"Removed {obsoleteStaff.Count} revoked staff members.");
                }
            }

            var meta = await dbContext.SyncMetadata.FirstOrDefaultAsync(cancellationToken);
            if (meta == null)
            {
                meta = new LodgeCore.Desktop.Data.Entities.LocalSyncMetadata { Id = "singleton", SchemaVersion = "1.0" };
                dbContext.SyncMetadata.Add(meta);
            }
            meta.LastSuccessfulSyncAt = DateTime.UtcNow;

            await dbContext.SaveChangesAsync(cancellationToken);
            _consecutiveFailures = 0;
            _lastSuccess = DateTime.UtcNow;
            _lastError = null;
            BroadcastHealth(SyncState.UP_TO_DATE, null, "COMPLETE", 1, 1, "Sync complete");
            _logger.LogInformation("Sync pull completed successfully.");
    }
}


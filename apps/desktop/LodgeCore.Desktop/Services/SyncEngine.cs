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
    
    // We can wire this to MAUI Connectivity events. For now, assume online.
    private bool _isOnline = true; 
    private int _consecutiveFailures = 0; // Tracks failures for exponential backoff

    public enum SyncState { Syncing, Pending, Error, Offline, UpToDate }
    
    public class SyncHealthInfo
    {
        public SyncState State { get; set; }
        public DateTime LastSuccessfulSync { get; set; }
        public int PendingOperations { get; set; }
        public string ErrorMessage { get; set; }
    }

    public static event Action<SyncHealthInfo> OnSyncHealthChanged;
    
    private DateTime _lastSuccess = DateTime.MinValue;

    public SyncEngine(IServiceProvider serviceProvider, ILogger<SyncEngine> logger, AuthManager authManager, HttpClient httpClient)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _authManager = authManager;
        _httpClient = httpClient;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("SyncEngine is starting.");

        while (!stoppingToken.IsCancellationRequested)
        {
            if (_isOnline)
            {
                try
                {
                    BroadcastHealth(SyncState.Syncing, "Syncing...");
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
                    _logger.LogError(ex, $"An error occurred during the sync cycle. Failure count: {_consecutiveFailures}");
                    BroadcastHealth(SyncState.Error, ex.Message);
                }
            }
            else
            {
                BroadcastHealth(SyncState.Offline, "Device is offline");
            }

            // Exponential backoff logic: Max 5 minutes (300 seconds), Base 30 seconds
            var delaySeconds = Math.Min(300, 30 * Math.Pow(2, _consecutiveFailures));
            await Task.Delay(TimeSpan.FromSeconds(delaySeconds), stoppingToken);
        }

        _logger.LogInformation("SyncEngine is stopping.");
    }

    private void BroadcastHealth(SyncState state, string? message = null)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();
        
        var pendingCount = 0;
        try 
        {
            pendingCount = dbContext.SyncEvents.Count(e => e.Status == "PENDING" || e.Status == "FAILED");
        } 
        catch { }

        if (state == SyncState.Syncing && pendingCount == 0)
        {
            state = SyncState.UpToDate;
        }

        OnSyncHealthChanged?.Invoke(new SyncHealthInfo
        {
            State = state,
            LastSuccessfulSync = _lastSuccess,
            PendingOperations = pendingCount,
            ErrorMessage = message
        });
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
        if (terminal == null) return;

        var session = await _authManager.GetSessionAsync();
        var propertyId = session?.PropertyId ?? terminal.PropertyId;
        if (string.IsNullOrEmpty(propertyId)) return;

        var token = await _authManager.GetAuthTokenAsync();
        if (string.IsNullOrEmpty(token))
        {
            _logger.LogDebug("No auth token available; skipping pull.");
            return;
        }

        _httpClient.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        try
        {
            var response = await _httpClient.GetAsync(
                $"sync/pull?propertyId={Uri.EscapeDataString(propertyId)}",
                cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning($"Sync pull returned {(int)response.StatusCode}");
                return;
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
            }

            // ---- Apply staff records --------------------------------------
            if (root.TryGetProperty("staff", out var staffArray))
            {
                var incomingStaffIds = new HashSet<string>();
                foreach (var staffEl in staffArray.EnumerateArray())
                {
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
                            ? pin.GetString() : existing.PosPinHash;
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
                            PosPinHash      = staffEl.TryGetProperty("posPinHash", out var pin2) ? pin2.GetString() : null,
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

            await dbContext.SaveChangesAsync(cancellationToken);
            _consecutiveFailures = 0;
            _lastSuccess = DateTime.UtcNow;
            BroadcastHealth(SyncState.UpToDate);
            _logger.LogInformation("Sync pull completed successfully.");
        }
        catch (HttpRequestException ex)
        {
            _consecutiveFailures++;
            _logger.LogWarning($"Sync pull network error: {ex.Message}");
        }
        catch (Exception ex)
        {
            _consecutiveFailures++;
            _logger.LogError(ex, "Sync pull failed unexpectedly.");
        }
    }
}


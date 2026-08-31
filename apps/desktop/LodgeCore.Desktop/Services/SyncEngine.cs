using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Text.Json;
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
        public DateTime? LastPushAttemptAt { get; set; }
        public string? LastPushEndpoint { get; set; }
        public int LastPushBatchSize { get; set; }
        public int? LastPushHttpStatus { get; set; }
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
    private DateTime? _lastPushAttemptAt = null;
    private string? _lastPushEndpoint = null;
    private int _lastPushBatchSize = 0;
    private int? _lastPushHttpStatus = null;

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
        // Do not drop a wake-up while a cycle is running. An event may have
        // been written after PushPendingEventsAsync queried the queue; keeping
        // the semaphore signalled guarantees an immediate follow-up cycle.
        if (_forceSyncSemaphore.CurrentCount == 0)
        {
            _forceSyncSemaphore.Release();
        }
    }

    public async Task<bool> RetryDeadLetterEventAsync(string eventId)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LodgeCore.Desktop.Data.LocalDbContext>();
        
        var evt = await db.OutboxEvents.FindAsync(eventId);
        if (evt == null || (evt.Status != "DEAD_LETTER" && evt.Status != "RETRY_EXHAUSTED")) return false;
        
        evt.Status = "PENDING";
        evt.AttemptCount = 0;
        evt.NextAttemptAt = DateTime.UtcNow;
        evt.LastError = null;
        
        await db.SaveChangesAsync();
        TriggerManualSync();
        return true;
    }

    private record SyncIdentity(string DeviceId, string PropertyId, string? TerminalId);

    private async Task<SyncIdentity?> GetSyncIdentityAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();
        
        var deviceId = await _authManager.GetOrCreateDeviceIdAsync();

        var terminal = await dbContext.PosTerminals.FirstOrDefaultAsync(stoppingToken);
        var session = await _authManager.GetSessionAsync();
        var propertyId = session?.PropertyId ?? terminal?.PropertyId;
        
        if (string.IsNullOrEmpty(propertyId)) 
        {
            _logger.LogWarning("GetSyncIdentityAsync: PropertyId is missing. Cannot proceed with sync.");
            return null;
        }

        return new SyncIdentity(deviceId, propertyId, terminal?.Id);
    }
    
    private async Task<string?> GetActiveTokenAsync()
    {
        var token = _credentialStorage.LoadCredential("deviceCredential");
        if (string.IsNullOrEmpty(token))
        {
            token = await _authManager.GetAuthTokenAsync();
        }
        return token;
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
                    _logger.LogInformation("[SYNC-CYCLE] Starting sync cycle. Online={Online}", _isOnline);
                    BroadcastHealth(SyncState.SYNCING, null, "PREP", 0, 1, "Preparing sync...");
                    // ── Sync guests FIRST so GuestId FK is satisfied when
                    //    reservations are saved in PullUpdatesAsync below.
                    await SyncGuestsIncrementalAsync(stoppingToken);

                    // Pull control state before pushing queued offline events.
                    // This refreshes AuditStatus/businessDate so reconnecting
                    // terminals do not blindly submit old-date work during
                    // an active cloud Night Audit.
                    await PullUpdatesAsync(stoppingToken);

                    try { await PushPendingEventsAsync(stoppingToken); } catch (Exception ex) { _logger.LogError(ex, "Failed to push POS events"); }
                    try { await PushFrontDeskOutboxAsync(stoppingToken); } catch (Exception ex) { _logger.LogError(ex, "Failed to push Front Desk events"); }
                    try { await PushKeycardAuditsAsync(stoppingToken); } catch (Exception ex) { _logger.LogError(ex, "Failed to push Keycard events"); }

                    try { await SyncRefundStatusesAsync(stoppingToken); } catch (Exception ex) { _logger.LogWarning(ex, "Failed to sync refund statuses"); }

                    // Resolve any conflicts that emerged from the push/pull
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var resolver = scope.ServiceProvider.GetRequiredService<ConflictResolver>();
                        await resolver.ResolveConflictsAsync();
                    }
                    
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
                    await LogSyncDiagnosticSummary(stoppingToken);
                    _isSyncing = false;
                }
            }
            else
            {
                _logger.LogWarning("[SYNC-CYCLE] Skipped sync cycle because the desktop reports offline connectivity.");
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

    private async Task LogSyncDiagnosticSummary(CancellationToken stoppingToken)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();
            var identity = await GetSyncIdentityAsync(stoppingToken);
            
            var connectionState = _isOnline ? "ONLINE" : "OFFLINE";
            var deviceId = identity?.DeviceId ?? "UNKNOWN";
            var propertyId = identity?.PropertyId ?? "UNKNOWN";

            var lastPull = Preferences.Get($"LastPull_{propertyId}", "Never");
            var lastPush = _lastSuccess.HasValue ? _lastSuccess.Value.ToString("o") : "Never";

            var pendingOutbox = await dbContext.OutboxEvents.CountAsync(e => e.Status == "PENDING" || e.Status == "FAILED" || e.Status == "CONFLICT", stoppingToken);
            var processing = await dbContext.OutboxEvents.CountAsync(e => e.Status == "PROCESSING", stoppingToken) + await dbContext.SyncEvents.CountAsync(e => e.Status == "PROCESSING", stoppingToken);
            var failedRetryableOutbox = await dbContext.OutboxEvents.CountAsync(e => e.Status == "FAILED", stoppingToken);
            var deadLetterOutbox = await dbContext.OutboxEvents.CountAsync(e => e.Status == "DEAD_LETTER", stoppingToken);

            var posPending = await dbContext.SyncEvents.CountAsync(e => e.Status == "PENDING" || e.Status == "FAILED", stoppingToken);
            var keycardsPending = await dbContext.KeycardAudits.CountAsync(a => a.SyncStatus == "PENDING", stoppingToken);

            var errorStr = string.IsNullOrEmpty(_lastError) ? "None" : _lastError;

            var summary = $@"
=== SYNC STATUS ===
Connection:       {connectionState}
Device:           {deviceId}
Property:         {propertyId}

Last Pull:        {lastPull}
Last Push:        {lastPush}

Pending Outbox:   {pendingOutbox}
Processing:       {processing}
Failed Retryable: {failedRetryableOutbox}
Dead Letter:      {deadLetterOutbox}

POS Pending:      {posPending}
FrontDesk:        {pendingOutbox}
Keycards:         {keycardsPending}

Last Error:       {errorStr}
Last Push Attempt: {_lastPushAttemptAt?.ToString("o") ?? "Never"}
Push Endpoint:     {_lastPushEndpoint ?? "Never"}
Push Batch:        {_lastPushBatchSize}
Push HTTP Status:  {_lastPushHttpStatus?.ToString() ?? "Never"}
===================";
            
            _logger.LogInformation(summary);
        }
        catch (Exception ex)
        {
            _logger.LogWarning($"Failed to write sync diagnostic summary: {ex.Message}");
        }
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
            pendingCount = dbContext.SyncEvents.Count(e => e.Status == "PENDING" || e.Status == "PROCESSING" || e.Status == "FAILED")
                         + dbContext.OutboxEvents.Count(e => e.Status == "PENDING" || e.Status == "PROCESSING" || e.Status == "FAILED");
        } 
        catch (Exception ex) { _logger.LogWarning($"Failed to count pending events: {ex.Message}"); }

        if (state == SyncState.SYNCING && pendingCount == 0 && string.IsNullOrEmpty(phase))
        {
            // Just starting push phase, keep syncing state
        }
        else if (state == SyncState.SYNCING && phase == null)
        {
            // Legacy call compatibility
        }

        try 
        {
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
                Message = message,
                LastPushAttemptAt = _lastPushAttemptAt,
                LastPushEndpoint = _lastPushEndpoint,
                LastPushBatchSize = _lastPushBatchSize,
                LastPushHttpStatus = _lastPushHttpStatus
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning($"BroadcastHealth invocation failed: {ex.Message}");
        }
    }

    public SyncHealthInfo GetCurrentHealth()
    {
        int pendingCount = 0;
        try 
        {
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();
            pendingCount = dbContext.SyncEvents.Count(e => e.Status == "PENDING" || e.Status == "PROCESSING" || e.Status == "FAILED")
                         + dbContext.OutboxEvents.Count(e => e.Status == "PENDING" || e.Status == "PROCESSING" || e.Status == "FAILED");
        } 
        catch (Exception ex) { _logger.LogWarning($"Failed to count pending events: {ex.Message}"); }

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
            Message = _lastMessage,
            LastPushAttemptAt = _lastPushAttemptAt,
            LastPushEndpoint = _lastPushEndpoint,
            LastPushBatchSize = _lastPushBatchSize,
            LastPushHttpStatus = _lastPushHttpStatus
        };
    }

    /// <summary>
    /// Pushes pending operations to the cloud with retry logic.
    /// </summary>
    private async Task PushPendingEventsAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        var deadEvents = await dbContext.SyncEvents
            .Where(e => (e.Status == "PENDING" || e.Status == "FAILED") && e.AttemptCount >= 5
                && (e.ErrorMessage == null || !e.ErrorMessage.StartsWith("TRANSIENT:")))
            .ToListAsync(stoppingToken);
        if (deadEvents.Any())
        {
            foreach (var evt in deadEvents) evt.Status = "DEAD_LETTER";
            await dbContext.SaveChangesAsync(stoppingToken);
        }

        var pendingEvents = await dbContext.SyncEvents
            .Where(e => e.Status == "PENDING" || e.Status == "FAILED")
            .OrderBy(e => e.SequenceNumber)
            .Take(100) // Batch push limit
            .ToListAsync(stoppingToken);

        if (!pendingEvents.Any()) return;

        // Apply exponential backoff in memory
        var now = DateTime.UtcNow;
        var backoffEvents = pendingEvents.Where(e => e.LastAttemptAt != null && e.LastAttemptAt.Value.AddSeconds(Math.Min(3600, Math.Pow(2, e.AttemptCount) * 5)) > now).ToList();
        var eligibleEvents = pendingEvents.Except(backoffEvents).ToList();

        if (!eligibleEvents.Any()) return;

        var identity = await GetSyncIdentityAsync(stoppingToken);
        if (identity == null) return;

        // Older desktop builds wrote POS events with UNKNOWN_DEVICE because
        // operator authentication read a different SecureStorage key. Rebind
        // those still-pending local events to this terminal once, so they are
        // not stranded by the terminal ownership filter below.
        var legacyDeviceEvents = eligibleEvents
            .Where(e => string.IsNullOrWhiteSpace(e.TerminalId)
                || e.TerminalId.Equals("UNKNOWN_DEVICE", StringComparison.OrdinalIgnoreCase))
            .ToList();
        foreach (var evt in legacyDeviceEvents)
        {
            evt.TerminalId = identity.DeviceId;
        }
        if (legacyDeviceEvents.Any())
        {
            await dbContext.SaveChangesAsync(stoppingToken);
            _logger.LogInformation("[PUSH-POS] Rebound {EventCount} legacy POS event(s) from UNKNOWN_DEVICE to {DeviceId}.",
                legacyDeviceEvents.Count, identity.DeviceId);
        }

        if (string.IsNullOrEmpty(identity.TerminalId))
        {
            _logger.LogWarning("[PUSH-POS] Skipping push: no registered terminal UUID is available. DeviceId={DeviceId} PropertyId={PropertyId}", identity.DeviceId, identity.PropertyId);
            return;
        }
        
        // Ensure we only push events for THIS terminal/device
        var eventsToPush = eligibleEvents.Where(e => e.TerminalId == identity.DeviceId || e.TerminalId == identity.TerminalId).ToList();
        if (!eventsToPush.Any()) return;

        _logger.LogInformation("[PUSH-POS] Preparing {EventCount} events. PropertyId={PropertyId} TerminalId={TerminalId} DeviceId={DeviceId}", eventsToPush.Count, identity.PropertyId, identity.TerminalId, identity.DeviceId);
        _lastPushAttemptAt = DateTime.UtcNow;
        _lastPushEndpoint = $"{_httpClient.BaseAddress}pos/sync/push";
        _lastPushBatchSize = eventsToPush.Count;
        _lastPushHttpStatus = null;

        var token = await GetActiveTokenAsync();
        if (string.IsNullOrEmpty(token))
        {
            _logger.LogWarning("[PUSH-POS] Skipping push: no device credential token is available. TerminalId={TerminalId}", identity.TerminalId);
            foreach (var evt in eventsToPush)
            {
                evt.Status = "FAILED";
                evt.ErrorMessage = "No device credential token available";
            }
            await dbContext.SaveChangesAsync(stoppingToken);
            return;
        }
        _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

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
            request.Content = JsonContent.Create(new
            {
                propertyId = identity.PropertyId,
                events = eventsToPush.Select(evt => new
                {
                    operationId = evt.OperationId,
                    sequenceNumber = evt.SequenceNumber,
                    terminalId = identity.TerminalId,
                    outletId = evt.OutletId,
                    sessionId = evt.SessionId,
                    operatorId = evt.OperatorId,
                    entityType = evt.EntityType,
                    entityId = evt.EntityId,
                    operationType = evt.OperationType,
                    payloadJson = evt.PayloadJson,
                    createdAt = evt.CreatedAt
                }).ToList()
            });
            _logger.LogInformation("[PUSH-POS] Sending POST to {BaseAddress}pos/sync/push. EventIds={EventIds}", _httpClient.BaseAddress, string.Join(",", eventsToPush.Select(evt => evt.OperationId)));
            
            var response = await _httpClient.SendAsync(request, stoppingToken);
            _lastPushHttpStatus = (int)response.StatusCode;
            var responseBody = await response.Content.ReadAsStringAsync(stoppingToken);
            _logger.LogInformation("[PUSH-POS] Server response HTTP {StatusCode}. Body={ResponseBody}", (int)response.StatusCode, responseBody.Length > 1000 ? responseBody[..1000] : responseBody);
            
            if (response.IsSuccessStatusCode)
            {
                var result = System.Text.Json.JsonSerializer.Deserialize<SyncPushResponse>(responseBody, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
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
                            var rejectionError = result.Results?.FirstOrDefault(r => r.Id == evt.OperationId)?.Error
                                ?? "Rejected by cloud validation";
                            evt.ErrorMessage = rejectionError.StartsWith("RETRYABLE_", StringComparison.OrdinalIgnoreCase)
                                ? $"TRANSIENT: {rejectionError}"
                                : rejectionError;
                        }
                        else if (result.Results?.FirstOrDefault(r => r.Id == evt.OperationId)?.Status == "RETRY")
                        {
                            evt.Status = "FAILED";
                            evt.ErrorMessage = $"TRANSIENT: {result.Results.First(r => r.Id == evt.OperationId).Error ?? "Cloud requested a retry"}";
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
                _logger.LogWarning("[PUSH-POS] Push failed. HTTP {StatusCode} Body={ResponseBody}", (int)response.StatusCode, responseBody);
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
                evt.ErrorMessage = $"TRANSIENT: {ex.Message}";
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
        public List<SyncPushResult>? Results { get; set; }
        public string? ServerCursor { get; set; }
    }

    private class SyncPushResult
    {
        public string? Id { get; set; }
        public string? Status { get; set; }
        public string? Error { get; set; }
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

        var identity = await GetSyncIdentityAsync(stoppingToken);
        if (identity == null) return;

        _logger.LogInformation($"Pushing {pendingAudits.Count} keycard audits to cloud...");
        
        var token = await GetActiveTokenAsync();
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
                request.Content = JsonContent.Create(new { propertyId = identity.PropertyId, audit = audit });
                
                var response = await _httpClient.SendAsync(request, stoppingToken);
                
                if (response.IsSuccessStatusCode)
                {
                    audit.SyncStatus = "SYNCED";
                }
                else
                {
                    _logger.LogWarning($"Failed to push keycard audit {audit.OperationId}. HTTP Status: {response.StatusCode}");
                    // Do not mark SYNCED. Leaves it in PENDING to retry on next cycle.
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to push keycard audit {audit.OperationId}");
                break; // Stop loop to retry later
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

        var identity = await GetSyncIdentityAsync(stoppingToken);
        if (identity == null) throw new Exception("Terminal identity not provisioned or property ID missing.");
        
        var propertyId = identity.PropertyId;

        // Financial POS records are event-sourced locally. A pull must never
        // replace a record while any local event for that aggregate/session is
        // still pending, failed, processing, or conflicted.
        async Task<bool> HasPendingPosEventAsync(string aggregateId)
        {
            return await dbContext.SyncEvents.AnyAsync(e =>
                (e.EntityId == aggregateId || e.SessionId == aggregateId) &&
                (e.Status == "PENDING" || e.Status == "FAILED" ||
                 e.Status == "PROCESSING" || e.Status == "CONFLICT" ||
                 e.Status == "DEAD_LETTER"), stoppingToken);
        }
        
        var token = await GetActiveTokenAsync();
        if (string.IsNullOrEmpty(token)) throw new Exception("No auth token available; skipping pull.");

        _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        bool hasMore = true;
        int pageCount = 0;

        while (hasMore && !stoppingToken.IsCancellationRequested)
        {
            var lastPullStr = Preferences.Get($"LastPull_{identity.PropertyId}", "");
            var isIncremental = !string.IsNullOrEmpty(lastPullStr);
            var cursorParam = isIncremental ? $"&cursor={Uri.EscapeDataString(lastPullStr)}" : "";

            var response = await _httpClient.GetAsync(
                $"sync/pull?propertyId={Uri.EscapeDataString(identity.PropertyId)}{cursorParam}&limit=500",
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
            var nextCursor = root.TryGetProperty("syncedAt", out var sa) && sa.ValueKind != System.Text.Json.JsonValueKind.Null ? sa.GetString() : null;

            try
            {
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

                    if (propEl.TryGetProperty("depositApprovalThreshold", out var dat) && dat.TryGetDecimal(out var depositThreshold))
                        localProp.DepositApprovalThreshold = depositThreshold;
                    if (propEl.TryGetProperty("creditAdjustmentApprovalThreshold", out var caat) && caat.TryGetDecimal(out var creditThreshold))
                        localProp.CreditAdjustmentApprovalThreshold = creditThreshold;
                    if (propEl.TryGetProperty("refundApprovalThreshold", out var rat) && rat.TryGetDecimal(out var refundThreshold))
                        localProp.RefundApprovalThreshold = refundThreshold;
                    if (propEl.TryGetProperty("offlineHighValueDepositPolicy", out var ohp))
                        localProp.OfflineHighValueDepositPolicy = ohp.GetString() ?? localProp.OfflineHighValueDepositPolicy;
                    if (propEl.TryGetProperty("noShowCutoffTime", out var nsc))
                        localProp.NoShowCutoffTime = nsc.GetString() ?? localProp.NoShowCutoffTime;
                    if (propEl.TryGetProperty("noShowGracePeriodMinutes", out var nsg) && nsg.TryGetInt32(out var graceMinutes))
                        localProp.NoShowGracePeriodMinutes = Math.Max(0, graceMinutes);
                    if (propEl.TryGetProperty("noShowChargeType", out var nsct))
                        localProp.NoShowChargeType = nsct.GetString() ?? localProp.NoShowChargeType;
                    if (propEl.TryGetProperty("noShowChargeValue", out var nscv) && nscv.TryGetDecimal(out var chargeValue))
                        localProp.NoShowChargeValue = Math.Max(0, chargeValue);
                    if (propEl.TryGetProperty("noShowRefundableUnusedNights", out var nsr))
                        localProp.NoShowRefundableUnusedNights = nsr.ValueKind == System.Text.Json.JsonValueKind.True;
                    if (propEl.TryGetProperty("noShowAllowReinstatement", out var nsa))
                        localProp.NoShowAllowReinstatement = nsa.ValueKind == System.Text.Json.JsonValueKind.True;
                    if (propEl.TryGetProperty("noShowReinstatementRequiresApproval", out var nsra))
                        localProp.NoShowReinstatementRequiresApproval = nsra.ValueKind == System.Text.Json.JsonValueKind.True;

                    if (root.TryGetProperty("syncedAt", out var syncedAtEl))
                    {
                        // Removed inline LastPull setting to rely on nextCursor at the end of the batch
                    }

                    if (propEl.TryGetProperty("businessDate", out var bd) &&
                        bd.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(bd.GetString(), out var parsedDate))
                        localProp.BusinessDate = parsedDate;
                    if (propEl.TryGetProperty("auditStatus", out var auditStatus) && auditStatus.ValueKind != System.Text.Json.JsonValueKind.Null)
                        localProp.AuditStatus = auditStatus.GetString() ?? localProp.AuditStatus;
                }
                else
                {
                    localProp = new LodgeCore.Desktop.Data.Entities.LocalProperty
                    {
                        Id = propertyId,
                        Name = propEl.TryGetProperty("name", out var n) && n.ValueKind != System.Text.Json.JsonValueKind.Null ? n.GetString() ?? "Unknown" : "Unknown",
                        Code = propEl.TryGetProperty("code", out var c) && c.ValueKind != System.Text.Json.JsonValueKind.Null ? c.GetString() ?? "" : "",
                        City = propEl.TryGetProperty("city", out var cy) && cy.ValueKind != System.Text.Json.JsonValueKind.Null ? cy.GetString() ?? "" : "",
                        Currency = propEl.TryGetProperty("currency", out var cur) && cur.ValueKind != System.Text.Json.JsonValueKind.Null ? cur.GetString() ?? "NGN" : "NGN",
                        Timezone = propEl.TryGetProperty("timezone", out var tz2) && tz2.ValueKind != System.Text.Json.JsonValueKind.Null ? tz2.GetString() ?? "UTC" : "UTC",
                        IsActive = true,
                        EarlyCheckinWindowHours = propEl.TryGetProperty("earlyCheckinWindowHours", out var eciw2) ? eciw2.GetInt32() : 2,
                        BankingModel = propEl.TryGetProperty("bankingModel", out var bm2) && bm2.ValueKind != System.Text.Json.JsonValueKind.Null ? bm2.GetString() ?? "SERVER_BANKING" : "SERVER_BANKING",
                        DepositApprovalThreshold = propEl.TryGetProperty("depositApprovalThreshold", out var dat2) && dat2.TryGetDecimal(out var depositThreshold2) ? depositThreshold2 : 250000m,
                        CreditAdjustmentApprovalThreshold = propEl.TryGetProperty("creditAdjustmentApprovalThreshold", out var caat2) && caat2.TryGetDecimal(out var creditThreshold2) ? creditThreshold2 : 1m,
                        RefundApprovalThreshold = propEl.TryGetProperty("refundApprovalThreshold", out var rat2) && rat2.TryGetDecimal(out var refundThreshold2) ? refundThreshold2 : 1m,
                        OfflineHighValueDepositPolicy = propEl.TryGetProperty("offlineHighValueDepositPolicy", out var ohp2) && ohp2.ValueKind != System.Text.Json.JsonValueKind.Null ? ohp2.GetString() ?? "BLOCK" : "BLOCK",
                        NoShowCutoffTime = propEl.TryGetProperty("noShowCutoffTime", out var nsc2) && nsc2.ValueKind != System.Text.Json.JsonValueKind.Null ? nsc2.GetString() ?? "02:00" : "02:00",
                        NoShowGracePeriodMinutes = propEl.TryGetProperty("noShowGracePeriodMinutes", out var nsg2) && nsg2.TryGetInt32(out var graceMinutes2) ? Math.Max(0, graceMinutes2) : 0,
                        NoShowChargeType = propEl.TryGetProperty("noShowChargeType", out var nsct2) && nsct2.ValueKind != System.Text.Json.JsonValueKind.Null ? nsct2.GetString() ?? "FIRST_NIGHT" : "FIRST_NIGHT",
                        NoShowChargeValue = propEl.TryGetProperty("noShowChargeValue", out var nscv2) && nscv2.TryGetDecimal(out var chargeValue2) ? Math.Max(0, chargeValue2) : 0,
                        NoShowRefundableUnusedNights = !propEl.TryGetProperty("noShowRefundableUnusedNights", out var nsr2) || nsr2.ValueKind == System.Text.Json.JsonValueKind.True,
                        NoShowAllowReinstatement = !propEl.TryGetProperty("noShowAllowReinstatement", out var nsa2) || nsa2.ValueKind == System.Text.Json.JsonValueKind.True,
                        NoShowReinstatementRequiresApproval = !propEl.TryGetProperty("noShowReinstatementRequiresApproval", out var nsra2) || nsra2.ValueKind == System.Text.Json.JsonValueKind.True,
                        AuditStatus = propEl.TryGetProperty("auditStatus", out var auditStatus2) && auditStatus2.ValueKind != System.Text.Json.JsonValueKind.Null ? auditStatus2.GetString() ?? "OPEN" : "OPEN",
                        BusinessDate = propEl.TryGetProperty("businessDate", out var bd2) && bd2.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(bd2.GetString(), out var parsedDate2) ? parsedDate2 : DateTime.UtcNow.Date
                    };
                    dbContext.Properties.Add(localProp);
                }
            }

            if (root.TryGetProperty("cashAccounts", out var cashAccountsArray) && cashAccountsArray.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                var cashAccountIndex = 0;
                var cashAccountCount = cashAccountsArray.GetArrayLength();
                foreach (var accountEl in cashAccountsArray.EnumerateArray())
                {
                    cashAccountIndex++;
                    BroadcastHealth(SyncState.SYNCING, null, "CASH_ACCOUNTS", cashAccountIndex, cashAccountCount, "Syncing cash accounts...");
                    var accountId = accountEl.TryGetProperty("id", out var accountIdEl) ? accountIdEl.GetString() : null;
                    if (string.IsNullOrWhiteSpace(accountId)) continue;

                    var account = await dbContext.CashAccounts.FirstOrDefaultAsync(a => a.Id == accountId, stoppingToken);
                    if (account == null)
                    {
                        account = new LodgeCore.Desktop.Data.Entities.LocalCashAccount { Id = accountId, PropertyId = propertyId };
                        dbContext.CashAccounts.Add(account);
                    }

                    account.PropertyId = propertyId;
                    account.OutletId = accountEl.TryGetProperty("outletId", out var outletIdEl) && outletIdEl.ValueKind != System.Text.Json.JsonValueKind.Null ? outletIdEl.GetString() : null;
                    account.Name = accountEl.TryGetProperty("name", out var accountNameEl) ? accountNameEl.GetString() ?? account.Name : account.Name;
                    account.Type = accountEl.TryGetProperty("type", out var accountTypeEl) ? accountTypeEl.GetString() ?? account.Type : account.Type;
                    account.OwnerId = accountEl.TryGetProperty("ownerId", out var ownerIdEl) && ownerIdEl.ValueKind != System.Text.Json.JsonValueKind.Null ? ownerIdEl.GetString() : null;
                    account.Balance = accountEl.TryGetProperty("balance", out var balanceEl)
                        ? balanceEl.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(balanceEl.GetString(), out var balanceFromString)
                            ? balanceFromString
                            : balanceEl.ValueKind == System.Text.Json.JsonValueKind.Number && balanceEl.TryGetDecimal(out var balanceFromNumber)
                                ? balanceFromNumber
                                : account.Balance
                        : account.Balance;
                    account.IsActive = !accountEl.TryGetProperty("isActive", out var activeEl) || activeEl.ValueKind == System.Text.Json.JsonValueKind.True;
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
                        existing.FirstName = staffEl.TryGetProperty("firstName", out var fn) && fn.ValueKind != System.Text.Json.JsonValueKind.Null ? fn.GetString() ?? existing.FirstName : existing.FirstName;
                        existing.LastName = staffEl.TryGetProperty("lastName", out var ln) && ln.ValueKind != System.Text.Json.JsonValueKind.Null ? ln.GetString() ?? existing.LastName : existing.LastName;
                        existing.Role = staffEl.TryGetProperty("role", out var role) && role.ValueKind != System.Text.Json.JsonValueKind.Null ? role.GetString() ?? existing.Role : existing.Role;
                        existing.PosPinHash = staffEl.TryGetProperty("posPinHash", out var pin)
                            ? (pin.GetString() ?? "") : existing.PosPinHash;
                        existing.PosTokenVersion = staffEl.TryGetProperty("posTokenVersion", out var tv)
                            ? tv.GetInt32() : existing.PosTokenVersion;
                        existing.IsActive = staffEl.TryGetProperty("isActive", out var ia)
                            ? ia.GetBoolean() : existing.IsActive;
                        existing.HasPosAccess = staffEl.TryGetProperty("hasPosAccess", out var hpa)
                            ? hpa.GetBoolean() : existing.HasPosAccess;
                        existing.PermissionsJson = staffEl.TryGetProperty("permissionsJson", out var pj) && pj.ValueKind != System.Text.Json.JsonValueKind.Null ? pj.GetString() ?? existing.PermissionsJson : existing.PermissionsJson;
                    }
                    else
                    {
                        // New staff member — add to local DB
                        dbContext.Staff.Add(new LodgeCore.Desktop.Data.Entities.LocalStaff
                        {
                            Id              = staffId,
                            PropertyId      = propertyId,
                            FirstName       = staffEl.TryGetProperty("firstName", out var fn2) && fn2.ValueKind != System.Text.Json.JsonValueKind.Null ? fn2.GetString() ?? "" : "",
                            LastName        = staffEl.TryGetProperty("lastName",  out var ln2) ? ln2.GetString() ?? "" : "",
                            Role            = staffEl.TryGetProperty("role",      out var role2) ? role2.GetString() ?? "" : "",
                            PosPinHash      = staffEl.TryGetProperty("posPinHash", out var pin2) ? (pin2.GetString() ?? "") : "",
                            PosTokenVersion = staffEl.TryGetProperty("posTokenVersion", out var tv2) ? tv2.GetInt32() : 1,
                            IsActive        = staffEl.TryGetProperty("isActive",   out var ia2) && ia2.GetBoolean(),
                            HasPosAccess    = staffEl.TryGetProperty("hasPosAccess", out var hpa2) && hpa2.GetBoolean(),
                            PermissionsJson = staffEl.TryGetProperty("permissionsJson", out var pj2) && pj2.ValueKind != System.Text.Json.JsonValueKind.Null ? pj2.GetString() ?? "[]" : "[]",
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

                if (obsoleteStaff.Any() && !isIncremental)
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
                    rt.Name = el.TryGetProperty("name", out var n) && n.ValueKind != System.Text.Json.JsonValueKind.Null ? n.GetString() ?? "" : "";
                    rt.Code = el.TryGetProperty("code", out var cd) && cd.ValueKind != System.Text.Json.JsonValueKind.Null ? cd.GetString() ?? "" : "";
                    rt.Description = el.TryGetProperty("description", out var d) && d.ValueKind != System.Text.Json.JsonValueKind.Null ? d.GetString() : null;
                    rt.BasePrice = el.TryGetProperty("baseRate", out var br) && br.ValueKind != System.Text.Json.JsonValueKind.Null && decimal.TryParse(br.GetString(), out var brd) ? brd : 0m;
                    rt.Currency = el.TryGetProperty("currency", out var curr) && curr.ValueKind != System.Text.Json.JsonValueKind.Null ? curr.GetString() ?? "NGN" : "NGN";
                    rt.MaxOccupancy = el.TryGetProperty("maxOccupancy", out var mo) ? mo.GetInt32() : 2;
                    rt.MaxAdults = el.TryGetProperty("maxAdults", out var ma) ? ma.GetInt32() : 2;
                    rt.MaxChildren = el.TryGetProperty("maxChildren", out var mc) ? mc.GetInt32() : 0;
                    rt.DefaultBedConfig = el.TryGetProperty("defaultBedConfig", out var dbc) && dbc.ValueKind != System.Text.Json.JsonValueKind.Null ? dbc.GetString() : null;
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
                    room.Number = el.TryGetProperty("number", out var num) && num.ValueKind != System.Text.Json.JsonValueKind.Null ? num.GetString() ?? "" : "";
                    room.Code = el.TryGetProperty("code", out var cd) && cd.ValueKind != System.Text.Json.JsonValueKind.Null ? cd.GetString() ?? room.Number : room.Number;
                    room.DisplayName = el.TryGetProperty("displayName", out var dn) && dn.ValueKind != System.Text.Json.JsonValueKind.Null ? dn.GetString() : null;
                    room.BuildingId = el.TryGetProperty("buildingId", out var bid) && bid.ValueKind != System.Text.Json.JsonValueKind.Null ? bid.GetString() : null;
                    room.BuildingName = el.TryGetProperty("building", out var bld) && bld.ValueKind != System.Text.Json.JsonValueKind.Null && bld.TryGetProperty("name", out var bnm) && bnm.ValueKind != System.Text.Json.JsonValueKind.Null ? bnm.GetString() : null;
                    room.FloorId = el.TryGetProperty("floorId", out var fid) && fid.ValueKind != System.Text.Json.JsonValueKind.Null ? fid.GetString() : null;
                    room.FloorName = el.TryGetProperty("floor", out var flr) && flr.ValueKind != System.Text.Json.JsonValueKind.Null && flr.TryGetProperty("name", out var fnm) && fnm.ValueKind != System.Text.Json.JsonValueKind.Null ? fnm.GetString() : null;
                    room.FloorNumber = el.TryGetProperty("floor", out var flr2) && flr2.ValueKind != System.Text.Json.JsonValueKind.Null && flr2.TryGetProperty("number", out var fnum) ? fnum.GetInt32() : (int?)null;
                    var incomingRoomStatus = el.TryGetProperty("status", out var st) && st.ValueKind != System.Text.Json.JsonValueKind.Null
                        ? st.GetString() ?? ""
                        : "";
                    var hasOpenCleaningTask = await dbContext.HousekeepingTasks.AnyAsync(
                        task => task.RoomId == id
                            && task.TaskType == "CLEANING"
                            && task.Status != "INSPECTED"
                            && task.Status != "CANCELLED",
                        stoppingToken);
                    var hasCheckedOutReservation = await dbContext.Reservations
                        .AnyAsync(reservation => reservation.Status == "CHECKED_OUT"
                            && reservation.Rooms.Any(reservationRoom => reservationRoom.RoomId == id), stoppingToken);

                    var preserveDirtyState = incomingRoomStatus == "OCCUPIED"
                        && (hasOpenCleaningTask || hasCheckedOutReservation);
                    if (!preserveDirtyState)
                    {
                        room.Status = incomingRoomStatus;
                        room.HousekeepingStatus = el.TryGetProperty("housekeepingStatus", out var hs) && hs.ValueKind != System.Text.Json.JsonValueKind.Null
                            ? hs.GetString() ?? ""
                            : "";
                    }
                    else
                    {
                        room.Status = "DIRTY";
                        room.HousekeepingStatus = "CLEANING";
                    }
                    room.IsOccupied = room.Status == "OCCUPIED";
                    room.MaintenanceStatus = el.TryGetProperty("maintenanceStatus", out var ms) && ms.ValueKind != System.Text.Json.JsonValueKind.Null ? ms.GetString() ?? "" : "";
                    room.RoomTypeId = el.TryGetProperty("roomTypeId", out var rti) && rti.ValueKind != System.Text.Json.JsonValueKind.Null ? rti.GetString() ?? "" : "";
                    room.LockSystemCode = el.TryGetProperty("lockSystemCode", out var lsc) && lsc.ValueKind != System.Text.Json.JsonValueKind.Null ? lsc.GetString() : (el.TryGetProperty("code", out var loldc) && loldc.ValueKind != System.Text.Json.JsonValueKind.Null ? loldc.GetString() : null);
                    room.MaxOccupancy = el.TryGetProperty("maxOccupancy", out var mo) ? mo.GetInt32() : 2;
                    room.MaxAdults = el.TryGetProperty("maxAdults", out var ma) ? ma.GetInt32() : 2;
                    room.MaxChildren = el.TryGetProperty("maxChildren", out var mc) ? mc.GetInt32() : 0;
                    room.IsAccessible = el.TryGetProperty("isAccessible", out var isa) && isa.GetBoolean();
                    room.IsActive = el.TryGetProperty("isActive", out var ia) ? ia.GetBoolean() : true;
                    room.UpdatedAt = DateTime.UtcNow;
                }
            }

            // 3. Guests (from pull payload to ensure FKs)
            if (root.TryGetProperty("guests", out var pullGuests) && pullGuests.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var el in pullGuests.EnumerateArray())
                {
                    var id = el.GetProperty("id").GetString();
                    if (string.IsNullOrEmpty(id)) continue;
                    
                    var existing = await dbContext.Guests.FirstOrDefaultAsync(g => g.Id == id, stoppingToken);
                    if (existing != null && existing.IsDirty) continue;

                    var g = existing ?? new LodgeCore.Desktop.Data.Entities.LocalGuest { Id = id };
                    g.OrganizationId = el.TryGetProperty("organizationId", out var org) && org.ValueKind != System.Text.Json.JsonValueKind.Null ? org.GetString() ?? "" : "";
                    g.FirstName = el.TryGetProperty("firstName", out var fn) && fn.ValueKind != System.Text.Json.JsonValueKind.Null ? fn.GetString() ?? "" : "";
                    g.LastName = el.TryGetProperty("lastName", out var ln) && ln.ValueKind != System.Text.Json.JsonValueKind.Null ? ln.GetString() ?? "" : "";
                    g.Email = el.TryGetProperty("email", out var em) && em.ValueKind != System.Text.Json.JsonValueKind.Null ? em.GetString() : null;
                    g.Phone = el.TryGetProperty("phone", out var ph) && ph.ValueKind != System.Text.Json.JsonValueKind.Null ? ph.GetString() : null;
                    g.CompanyName = el.TryGetProperty("companyName", out var cn) && cn.ValueKind != System.Text.Json.JsonValueKind.Null ? cn.GetString() : null;
                    g.IsVip = el.TryGetProperty("isVip", out var vip) && vip.ValueKind != System.Text.Json.JsonValueKind.Null && vip.GetBoolean();
                    g.Version = el.TryGetProperty("version", out var ver) && ver.ValueKind == System.Text.Json.JsonValueKind.Number ? ver.GetInt32() : 1;
                    
                    if (el.TryGetProperty("updatedAt", out var ua) && ua.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(ua.GetString(), out var uad)) g.UpdatedAt = uad;
                    if (el.TryGetProperty("deletedAt", out var da) && da.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(da.GetString(), out var dad)) g.DeletedAt = dad;

                    if (existing == null)
                    {
                        dbContext.Guests.Add(g);
                    }
                }
            }

            // ---- Recover active Front Desk sessions ----------------------
            // The pull endpoint always includes OPEN sessions so a clean
            // reinstall can restore the receptionist's till and its cash
            // movements. Upsert by immutable IDs to remain idempotent.
            if (root.TryGetProperty("frontdeskSessions", out var frontdeskSessions) && frontdeskSessions.ValueKind == JsonValueKind.Array)
            {
                foreach (var sessionEl in frontdeskSessions.EnumerateArray())
                {
                    var sessionId = sessionEl.TryGetProperty("id", out var sid) ? sid.GetString() : null;
                    var sessionPropertyId = sessionEl.TryGetProperty("propertyId", out var spid) ? spid.GetString() : propertyId;
                    if (string.IsNullOrWhiteSpace(sessionId) || sessionPropertyId != propertyId) continue;

                    var localSession = await dbContext.FrontdeskSessions.FirstOrDefaultAsync(s => s.Id == sessionId, stoppingToken);
                    if (localSession == null)
                    {
                        localSession = new LodgeCore.Desktop.Data.Entities.LocalFrontdeskSession { Id = sessionId };
                        dbContext.FrontdeskSessions.Add(localSession);
                    }

                    localSession.PropertyId = propertyId;
                    localSession.StaffId = sessionEl.TryGetProperty("staffId", out var staffId) ? staffId.GetString() ?? "" : localSession.StaffId;
                    localSession.CashAccountId = sessionEl.TryGetProperty("cashAccountId", out var cashAccountId) ? cashAccountId.GetString() ?? "" : localSession.CashAccountId;
                    localSession.ShiftReference = sessionEl.TryGetProperty("shiftReference", out var shiftReference) ? shiftReference.GetString() ?? "" : localSession.ShiftReference;
                    localSession.Status = sessionEl.TryGetProperty("status", out var sessionStatus) ? sessionStatus.GetString() ?? "OPEN" : "OPEN";
                    localSession.ControlStatus = sessionEl.TryGetProperty("controlStatus", out var controlStatus) && controlStatus.ValueKind != JsonValueKind.Null
                        ? controlStatus.GetString() ?? localSession.ControlStatus
                        : localSession.Status switch
                        {
                            "RECONCILED" => "RECONCILED",
                            "UNDER_REVIEW" => "UNDER_REVIEW",
                            "CLOSED" or "CLOSING" => "SUBMITTED",
                            _ => localSession.ControlStatus
                        };
                    localSession.VarianceStatus = sessionEl.TryGetProperty("varianceStatus", out var varianceStatus) && varianceStatus.ValueKind != JsonValueKind.Null
                        ? varianceStatus.GetString() : localSession.VarianceStatus;

                    if (sessionEl.TryGetProperty("businessDate", out var businessDate) && DateTime.TryParse(businessDate.GetString(), out var parsedBusinessDate)) localSession.BusinessDate = parsedBusinessDate;
                    if (sessionEl.TryGetProperty("openingFloat", out var openingFloat) && decimal.TryParse(openingFloat.ToString(), out var parsedOpeningFloat)) localSession.OpeningFloat = parsedOpeningFloat;
                    if (sessionEl.TryGetProperty("systemExpectedCash", out var expectedCash) && decimal.TryParse(expectedCash.ToString(), out var parsedExpectedCash)) localSession.SystemExpectedCash = parsedExpectedCash;
                    if (sessionEl.TryGetProperty("declaredCash", out var declaredCash) && declaredCash.ValueKind != System.Text.Json.JsonValueKind.Null && decimal.TryParse(declaredCash.ToString(), out var parsedDeclaredCash)) localSession.DeclaredCash = parsedDeclaredCash;
                    if (sessionEl.TryGetProperty("variance", out var variance) && variance.ValueKind != System.Text.Json.JsonValueKind.Null && decimal.TryParse(variance.ToString(), out var parsedVariance)) localSession.Variance = parsedVariance;
                    if (sessionEl.TryGetProperty("openedAt", out var openedAt) && DateTime.TryParse(openedAt.GetString(), out var parsedOpenedAt)) localSession.OpenedAt = parsedOpenedAt;
                    if (sessionEl.TryGetProperty("closingAt", out var closingAt) && closingAt.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(closingAt.GetString(), out var parsedClosingAt)) localSession.ClosingAt = parsedClosingAt;
                    if (sessionEl.TryGetProperty("closedAt", out var closedAt) && closedAt.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(closedAt.GetString(), out var parsedClosedAt)) localSession.ClosedAt = parsedClosedAt;
                    if (sessionEl.TryGetProperty("reconciledAt", out var reconciledAt) && reconciledAt.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(reconciledAt.GetString(), out var parsedReconciledAt)) localSession.ReconciledAt = parsedReconciledAt;
                    localSession.ReconciledBy = sessionEl.TryGetProperty("reconciledBy", out var reconciledBy) && reconciledBy.ValueKind != System.Text.Json.JsonValueKind.Null ? reconciledBy.GetString() : localSession.ReconciledBy;
                    localSession.ReconciliationDecision = sessionEl.TryGetProperty("reconciliationDecision", out var reconciliationDecision) && reconciliationDecision.ValueKind != System.Text.Json.JsonValueKind.Null ? reconciliationDecision.GetString() : localSession.ReconciliationDecision;
                    localSession.ReconciliationNotes = sessionEl.TryGetProperty("reconciliationNotes", out var reconciliationNotes) && reconciliationNotes.ValueKind != System.Text.Json.JsonValueKind.Null ? reconciliationNotes.GetString() : localSession.ReconciliationNotes;
                    localSession.SubmittedBy = sessionEl.TryGetProperty("submittedBy", out var submittedBy) && submittedBy.ValueKind != System.Text.Json.JsonValueKind.Null ? submittedBy.GetString() : localSession.SubmittedBy;
                    localSession.ReviewStartedBy = sessionEl.TryGetProperty("reviewStartedBy", out var reviewStartedBy) && reviewStartedBy.ValueKind != System.Text.Json.JsonValueKind.Null ? reviewStartedBy.GetString() : localSession.ReviewStartedBy;
                    localSession.ApprovalDecision = sessionEl.TryGetProperty("approvalDecision", out var approvalDecision) && approvalDecision.ValueKind != System.Text.Json.JsonValueKind.Null ? approvalDecision.GetString() : localSession.ApprovalDecision;
                    localSession.ApprovalNotes = sessionEl.TryGetProperty("approvalNotes", out var approvalNotes) && approvalNotes.ValueKind != System.Text.Json.JsonValueKind.Null ? approvalNotes.GetString() : localSession.ApprovalNotes;
                    if (sessionEl.TryGetProperty("submittedAt", out var submittedAt) && submittedAt.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(submittedAt.GetString(), out var parsedSubmittedAt)) localSession.SubmittedAt = parsedSubmittedAt;
                    if (sessionEl.TryGetProperty("reviewStartedAt", out var reviewStartedAt) && reviewStartedAt.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(reviewStartedAt.GetString(), out var parsedReviewStartedAt)) localSession.ReviewStartedAt = parsedReviewStartedAt;
                    if (sessionEl.TryGetProperty("handoverAt", out var handoverAt) && handoverAt.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(handoverAt.GetString(), out var parsedHandoverAt)) localSession.HandoverAt = parsedHandoverAt;
                    if (sessionEl.TryGetProperty("depositedAt", out var depositedAt) && depositedAt.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(depositedAt.GetString(), out var parsedDepositedAt)) localSession.DepositedAt = parsedDepositedAt;
                    localSession.CreatedAt = sessionEl.TryGetProperty("createdAt", out var createdAt) && DateTime.TryParse(createdAt.GetString(), out var parsedCreatedAt) ? parsedCreatedAt : localSession.CreatedAt;
                    localSession.UpdatedAt = sessionEl.TryGetProperty("updatedAt", out var updatedAt) && DateTime.TryParse(updatedAt.GetString(), out var parsedUpdatedAt) ? parsedUpdatedAt : DateTime.UtcNow;

                    if (sessionEl.TryGetProperty("cashMovements", out var movements) && movements.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        foreach (var movementEl in movements.EnumerateArray())
                        {
                            var movementId = movementEl.TryGetProperty("id", out var mid) ? mid.GetString() : null;
                            if (string.IsNullOrWhiteSpace(movementId)) continue;
                            var movement = await dbContext.PosCashMovements.FirstOrDefaultAsync(m => m.Id == movementId, stoppingToken);
                            if (movement == null)
                            {
                                movement = new LodgeCore.Desktop.Data.Entities.LocalPosCashMovement { Id = movementId };
                                dbContext.PosCashMovements.Add(movement);
                            }
                            movement.PropertyId = propertyId;
                            movement.DeviceId = movementEl.TryGetProperty("deviceId", out var movementDevice) ? movementDevice.GetString() ?? "" : movement.DeviceId;
                            movement.FrontdeskSessionId = sessionId;
                            movement.PosSessionId = movementEl.TryGetProperty("posSessionId", out var posSessionId) && posSessionId.ValueKind != System.Text.Json.JsonValueKind.Null ? posSessionId.GetString() : movement.PosSessionId;
                            movement.UserId = movementEl.TryGetProperty("userId", out var movementUser) ? movementUser.GetString() ?? "" : movement.UserId;
                            movement.Amount = movementEl.TryGetProperty("amount", out var movementAmount) && decimal.TryParse(movementAmount.ToString(), out var parsedAmount) ? parsedAmount : movement.Amount;
                            movement.Currency = movementEl.TryGetProperty("currency", out var movementCurrency) ? movementCurrency.GetString() ?? "NGN" : movement.Currency;
                            movement.Type = movementEl.TryGetProperty("type", out var movementType) ? movementType.ToString() : movement.Type;
                            movement.SourceAccountId = movementEl.TryGetProperty("sourceAccountId", out var sourceAccount) ? sourceAccount.GetString() ?? "" : movement.SourceAccountId;
                            movement.DestinationAccountId = movementEl.TryGetProperty("destinationAccountId", out var destinationAccount) ? destinationAccount.GetString() ?? "" : movement.DestinationAccountId;
                            movement.ReasonCode = movementEl.TryGetProperty("reasonCode", out var reasonCode) ? reasonCode.GetString() ?? "" : movement.ReasonCode;
                            movement.Notes = movementEl.TryGetProperty("notes", out var movementNotes) && movementNotes.ValueKind != System.Text.Json.JsonValueKind.Null ? movementNotes.GetString() : movement.Notes;
                            movement.ReceiptReference = movementEl.TryGetProperty("receiptReference", out var receiptReference) && receiptReference.ValueKind != System.Text.Json.JsonValueKind.Null ? receiptReference.GetString() : movement.ReceiptReference;
                            movement.OperationId = movementEl.TryGetProperty("operationId", out var operationId) ? operationId.GetString() ?? "" : movement.OperationId;
                            movement.BusinessDate = movementEl.TryGetProperty("businessDate", out var movementDate) && movementDate.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(movementDate.GetString(), out var parsedMovementDate) ? parsedMovementDate : movement.BusinessDate;
                            movement.AuthorizedBy = movementEl.TryGetProperty("authorizedBy", out var authorizedBy) && authorizedBy.ValueKind != System.Text.Json.JsonValueKind.Null ? authorizedBy.GetString() : movement.AuthorizedBy;
                            movement.CreatedAt = movementEl.TryGetProperty("createdAt", out var movementCreatedAt) && DateTime.TryParse(movementCreatedAt.GetString(), out var parsedMovementCreatedAt) ? parsedMovementCreatedAt : movement.CreatedAt;
                        }
                    }
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
                    if (res != null && res.IsDirty) continue;

                    if (res == null)
                    {
                        res = new LodgeCore.Desktop.Data.Entities.LocalReservation { Id = id, PropertyId = propertyId, CreatedAt = DateTime.UtcNow };
                        dbContext.Reservations.Add(res);
                    }
                    res.GuestId = el.TryGetProperty("primaryGuestId", out var pg) && pg.ValueKind != System.Text.Json.JsonValueKind.Null ? pg.GetString() : null;
                    
                    if (!string.IsNullOrEmpty(res.GuestId))
                    {
                        // Removed stub guest logic per user request to allow SQLite constraint to fail
                    }

                    res.Status = el.TryGetProperty("status", out var st) && st.ValueKind != System.Text.Json.JsonValueKind.Null ? st.GetString() ?? "" : "";
                    
                    var existingRooms = await dbContext.ReservationRooms.Where(rr => rr.ReservationId == id).ToListAsync(stoppingToken);
                    if (existingRooms.Any()) dbContext.ReservationRooms.RemoveRange(existingRooms);

                    var flattenedRoomId = el.TryGetProperty("roomId", out var rid) && rid.ValueKind != System.Text.Json.JsonValueKind.Null ? rid.GetString() : null;
                    if (!string.IsNullOrEmpty(flattenedRoomId))
                    {
                        var rr = new LodgeCore.Desktop.Data.Entities.LocalReservationRoom
                        {
                            Id = Guid.NewGuid().ToString(),
                            ReservationId = id,
                            RoomId = flattenedRoomId,
                            RoomTypeId = el.TryGetProperty("roomTypeId", out var rtid) && rtid.ValueKind != System.Text.Json.JsonValueKind.Null ? rtid.GetString() ?? "" : "",
                            Status = "PENDING"
                        };
                        
                        if (el.TryGetProperty("checkIn", out var rci) && rci.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(rci.GetString(), out var rcid)) rr.CheckInDate = rcid;
                        if (el.TryGetProperty("checkOut", out var rco) && rco.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(rco.GetString(), out var rcod)) rr.CheckOutDate = rcod;
                        rr.Adults = el.TryGetProperty("adults", out var radl) ? radl.GetInt32() : 1;
                        rr.Children = el.TryGetProperty("children", out var rchl) ? rchl.GetInt32() : 0;
                        rr.DiscountType = el.TryGetProperty("discountType", out var dt) && dt.ValueKind != System.Text.Json.JsonValueKind.Null ? dt.GetString() : null;
                        if (el.TryGetProperty("discountAmount", out var da) && da.ValueKind != System.Text.Json.JsonValueKind.Null && decimal.TryParse(da.GetString() ?? da.GetRawText(), out var dav)) rr.DiscountAmount = dav;
                        if (el.TryGetProperty("discountPercent", out var dp) && dp.ValueKind != System.Text.Json.JsonValueKind.Null && decimal.TryParse(dp.GetString() ?? dp.GetRawText(), out var dpv)) rr.DiscountPercent = dpv;
                        rr.DiscountReason = el.TryGetProperty("discountReason", out var drea) && drea.ValueKind != System.Text.Json.JsonValueKind.Null ? drea.GetString() : null;
                        rr.DiscountApprovalId = el.TryGetProperty("discountApprovalId", out var dai) && dai.ValueKind != System.Text.Json.JsonValueKind.Null ? dai.GetString() : null;
                        
                        dbContext.ReservationRooms.Add(rr);
                    }
                    
                    if (el.TryGetProperty("checkIn", out var ci) && ci.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(ci.GetString(), out var cid))
                        res.CheckInDate = cid;
                    if (el.TryGetProperty("checkOut", out var co) && co.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(co.GetString(), out var cod))
                        res.CheckOutDate = cod;

                    if (string.IsNullOrWhiteSpace(res.RoomTypeId))
                    {
                        res.RoomTypeId = res.Rooms.FirstOrDefault()?.RoomTypeId;
                    }
                    
                    res.Adults = el.TryGetProperty("adults", out var adl) ? adl.GetInt32() : res.Adults;
                    res.Children = el.TryGetProperty("children", out var chl) ? chl.GetInt32() : res.Children;
                    res.SpecialRequests = el.TryGetProperty("specialRequests", out var sr) && sr.ValueKind != System.Text.Json.JsonValueKind.Null ? sr.GetString() : res.SpecialRequests;
                    res.ConfirmationNumber = el.TryGetProperty("confirmationNumber", out var cn) && cn.ValueKind != System.Text.Json.JsonValueKind.Null ? cn.GetString() : res.ConfirmationNumber;
                    if (el.TryGetProperty("depositRequired", out var dr) && dr.ValueKind != System.Text.Json.JsonValueKind.Null && decimal.TryParse(dr.GetString() ?? dr.GetRawText(), out var drv))
                        res.DepositRequired = drv;
                    if (el.TryGetProperty("depositPaid", out var dp2) && dp2.ValueKind != System.Text.Json.JsonValueKind.Null && decimal.TryParse(dp2.GetString() ?? dp2.GetRawText(), out var dpaid))
                        res.DepositPaid = dpaid;
                        
                    res.CompanyId = el.TryGetProperty("companyId", out var comp) && comp.ValueKind != System.Text.Json.JsonValueKind.Null ? comp.GetString() : null;
                    res.Source = el.TryGetProperty("source", out var src) && src.ValueKind != System.Text.Json.JsonValueKind.Null ? src.GetString() : null;
                    res.ChannelRef = el.TryGetProperty("channelRef", out var cref) && cref.ValueKind != System.Text.Json.JsonValueKind.Null ? cref.GetString() : null;
                    res.RatePlanId = el.TryGetProperty("ratePlanId", out var rpi) && rpi.ValueKind != System.Text.Json.JsonValueKind.Null ? rpi.GetString() : null;
                    res.RatePlanSnapshotJson = el.TryGetProperty("ratePlanSnapshot", out var rps) && rps.ValueKind == System.Text.Json.JsonValueKind.Object ? rps.GetRawText() : null;
                    res.Currency = el.TryGetProperty("currency", out var cur) && cur.ValueKind != System.Text.Json.JsonValueKind.Null ? cur.GetString() : null;
                    res.InternalNotes = el.TryGetProperty("internalNotes", out var inn) && inn.ValueKind != System.Text.Json.JsonValueKind.Null ? inn.GetString() : null;
                    res.EarlyCheckIn = el.TryGetProperty("earlyCheckIn", out var eci) && eci.GetBoolean();
                    res.LateCheckOut = el.TryGetProperty("lateCheckOut", out var lco) && lco.GetBoolean();
                    
                    if (el.TryGetProperty("cancelledAt", out var canAt) && canAt.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(canAt.GetString(), out var canAtD)) res.CancelledAt = canAtD;
                    res.CancelledBy = el.TryGetProperty("cancelledBy", out var canBy) && canBy.ValueKind != System.Text.Json.JsonValueKind.Null ? canBy.GetString() : null;
                    res.CancellationReason = el.TryGetProperty("cancellationReason", out var canRe) && canRe.ValueKind != System.Text.Json.JsonValueKind.Null ? canRe.GetString() : null;
                    
                    if (el.TryGetProperty("noShowAt", out var nsAt) && nsAt.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(nsAt.GetString(), out var nsAtD)) res.NoShowAt = nsAtD;
                    res.NoShowBy = el.TryGetProperty("noShowBy", out var nsBy) && nsBy.ValueKind != System.Text.Json.JsonValueKind.Null ? nsBy.GetString() : null;
                    res.LateArrivalExpected = el.TryGetProperty("lateArrivalExpected", out var lae) && lae.ValueKind == System.Text.Json.JsonValueKind.True;
                    res.LateArrivalNotes = el.TryGetProperty("lateArrivalNotes", out var lan) && lan.ValueKind != System.Text.Json.JsonValueKind.Null ? lan.GetString() : null;
                    if (el.TryGetProperty("lateArrivalAt", out var laat) && laat.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(laat.GetString(), out var laatD)) res.LateArrivalAt = laatD;
                    res.LateArrivalBy = el.TryGetProperty("lateArrivalBy", out var lab) && lab.ValueKind != System.Text.Json.JsonValueKind.Null ? lab.GetString() : null;
                    if (el.TryGetProperty("noShowAssessedAt", out var nsa) && nsa.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(nsa.GetString(), out var nsaD)) res.NoShowAssessedAt = nsaD;
                    if (el.TryGetProperty("noShowChargeAmount", out var nsc) && nsc.ValueKind != System.Text.Json.JsonValueKind.Null && decimal.TryParse(nsc.GetString() ?? nsc.GetRawText(), out var nscD)) res.NoShowChargeAmount = nscD;
                    if (el.TryGetProperty("noShowRefundableAmount", out var nsr) && nsr.ValueKind != System.Text.Json.JsonValueKind.Null && decimal.TryParse(nsr.GetString() ?? nsr.GetRawText(), out var nsrD)) res.NoShowRefundableAmount = nsrD;
                    if (el.TryGetProperty("reinstatedAt", out var ria) && ria.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(ria.GetString(), out var riaD)) res.ReinstatedAt = riaD;
                    res.ReinstatedBy = el.TryGetProperty("reinstatedBy", out var rib) && rib.ValueKind != System.Text.Json.JsonValueKind.Null ? rib.GetString() : null;
                    res.ReinstatementReason = el.TryGetProperty("reinstatementReason", out var rir) && rir.ValueKind != System.Text.Json.JsonValueKind.Null ? rir.GetString() : null;
                    res.CreatedBy = el.TryGetProperty("createdBy", out var cb) && cb.ValueKind != System.Text.Json.JsonValueKind.Null ? cb.GetString() : null;

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
                            cred.GuestId = credEl.TryGetProperty("guestId", out var cg) && cg.ValueKind != System.Text.Json.JsonValueKind.Null ? cg.GetString() : null;
                            cred.RoomId = credEl.TryGetProperty("roomId", out var cri) && cri.ValueKind != System.Text.Json.JsonValueKind.Null ? cri.GetString() ?? "" : "";
                            cred.LockId = credEl.TryGetProperty("lockId", out var cli) && cli.ValueKind != System.Text.Json.JsonValueKind.Null ? cli.GetString() ?? "" : "";
                            cred.CredentialType = credEl.TryGetProperty("credentialType", out var cct) && cct.ValueKind != System.Text.Json.JsonValueKind.Null ? cct.GetString() ?? "rfid" : "rfid";
                            cred.Status = credEl.TryGetProperty("status", out var cst) && cst.ValueKind != System.Text.Json.JsonValueKind.Null ? cst.GetString() ?? "PENDING" : "PENDING";
                            if (credEl.TryGetProperty("validFrom", out var cvf) && cvf.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(cvf.GetString(), out var cvfd)) cred.ValidFrom = cvfd;
                            if (credEl.TryGetProperty("validUntil", out var cvu) && cvu.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(cvu.GetString(), out var cvud)) cred.ValidUntil = cvud;
                            cred.CardSerialNumber = credEl.TryGetProperty("cardSerialNumber", out var csn) && csn.ValueKind != System.Text.Json.JsonValueKind.Null ? csn.GetString() : null;
                            cred.IssueOperationId = credEl.TryGetProperty("issueOperationId", out var cio) && cio.ValueKind != System.Text.Json.JsonValueKind.Null ? cio.GetString() : null;
                            if (credEl.TryGetProperty("issuedAt", out var cia) && cia.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(cia.GetString(), out var ciad)) cred.IssuedAt = ciad;
                            if (credEl.TryGetProperty("revokedAt", out var cra) && cra.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(cra.GetString(), out var crad)) cred.RevokedAt = crad;
                            cred.MetadataJson = credEl.TryGetProperty("metadata", out var csm) ? csm.GetRawText() : null;
                            cred.UpdatedAt = DateTime.UtcNow;
                        }
                        
                        var staleCreds = await dbContext.LockCredentials
                            .Where(c => c.ReservationId == id && !incomingCredIds.Contains(c.Id))
                            .ToListAsync(stoppingToken);
                        if (staleCreds.Any() && !isIncremental) dbContext.LockCredentials.RemoveRange(staleCreds);
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
                            op.LockId = opEl.TryGetProperty("lockId", out var oli) && oli.ValueKind != System.Text.Json.JsonValueKind.Null ? oli.GetString() : null;
                            op.RoomId = opEl.TryGetProperty("roomId", out var ori) && ori.ValueKind != System.Text.Json.JsonValueKind.Null ? ori.GetString() : null;
                            op.CredentialId = opEl.TryGetProperty("credentialId", out var oci) && oci.ValueKind != System.Text.Json.JsonValueKind.Null ? oci.GetString() : null;
                            op.CommandId = opEl.TryGetProperty("commandId", out var ocmd) && ocmd.ValueKind != System.Text.Json.JsonValueKind.Null ? ocmd.GetString() : null;
                            op.IdempotencyKey = opEl.TryGetProperty("idempotencyKey", out var oik) && oik.ValueKind != System.Text.Json.JsonValueKind.Null ? oik.GetString() : null;
                            op.Operation = opEl.TryGetProperty("operation", out var oop) && oop.ValueKind != System.Text.Json.JsonValueKind.Null ? oop.GetString() ?? "" : "";
                            op.Status = opEl.TryGetProperty("status", out var ost) && ost.ValueKind != System.Text.Json.JsonValueKind.Null ? ost.GetString() ?? "QUEUED" : "QUEUED";
                            op.ErrorCode = opEl.TryGetProperty("errorCode", out var oec) && oec.ValueKind != System.Text.Json.JsonValueKind.Null ? oec.GetString() : null;
                            op.ErrorMessage = opEl.TryGetProperty("errorMessage", out var oem) && oem.ValueKind != System.Text.Json.JsonValueKind.Null ? oem.GetString() : null;
                            op.PayloadHash = opEl.TryGetProperty("payloadHash", out var oph) && oph.ValueKind != System.Text.Json.JsonValueKind.Null ? oph.GetString() : null;
                            op.AttemptCount = opEl.TryGetProperty("attemptCount", out var oac) ? oac.GetInt32() : 0;
                            if (opEl.TryGetProperty("requestedAt", out var orq) && orq.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(orq.GetString(), out var orqd)) op.RequestedAt = orqd;
                            if (opEl.TryGetProperty("startedAt", out var osa) && osa.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(osa.GetString(), out var osad)) op.StartedAt = osad;
                            if (opEl.TryGetProperty("completedAt", out var oca) && oca.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(oca.GetString(), out var ocad)) op.CompletedAt = ocad;
                            op.AgentId = opEl.TryGetProperty("agentId", out var oai) && oai.ValueKind != System.Text.Json.JsonValueKind.Null ? oai.GetString() : null;
                            op.DeviceId = opEl.TryGetProperty("deviceId", out var odi) && odi.ValueKind != System.Text.Json.JsonValueKind.Null ? odi.GetString() : null;
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
                        if (staleOps.Any() && !isIncremental) dbContext.LockOperations.RemoveRange(staleOps);
                    }
                }
                
                // Remove reservations that are no longer in the cache window
                var staleRes = await dbContext.Reservations
                    .Where(r => !incomingResIds.Contains(r.Id) && !r.IsDirty)
                    .ToListAsync(stoppingToken);
                
                if (staleRes.Any() && !isIncremental)
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
                    if (folio != null && folio.IsDirty) continue;

                    if (folio == null)
                    {
                        folio = new LodgeCore.Desktop.Data.Entities.LocalFolio { Id = id, PropertyId = propertyId, CreatedAt = DateTime.UtcNow };
                        dbContext.Folios.Add(folio);
                    }
                    folio.ReservationId = el.TryGetProperty("reservationId", out var ri) && ri.ValueKind != System.Text.Json.JsonValueKind.Null ? ri.GetString() ?? "" : "";
                    folio.Status = el.TryGetProperty("status", out var st) && st.ValueKind != System.Text.Json.JsonValueKind.Null ? st.GetString() ?? "" : "";
                    folio.TotalCharges = el.TryGetProperty("totalCharges", out var tc) && tc.ValueKind != System.Text.Json.JsonValueKind.Null && decimal.TryParse(tc.GetString(), out var tcd) ? tcd : 0m;
                    folio.TotalPayments = el.TryGetProperty("totalPayments", out var tp) && tp.ValueKind != System.Text.Json.JsonValueKind.Null && decimal.TryParse(tp.GetString(), out var tpd) ? tpd : 0m;
                    folio.Version = el.TryGetProperty("version", out var folioVersion) && folioVersion.TryGetInt32(out var serverFolioVersion)
                        ? serverFolioVersion
                        : folio.Version;
                    folio.AvailableCredit = el.TryGetProperty("availableCredit", out var ac) && ac.ValueKind != System.Text.Json.JsonValueKind.Null && decimal.TryParse(ac.GetString(), out var acd)
                        ? acd
                        : el.TryGetProperty("credits", out var credits) && credits.ValueKind == System.Text.Json.JsonValueKind.Array
                            ? credits.EnumerateArray().Sum(credit => credit.TryGetProperty("remainingAmount", out var remaining) && decimal.TryParse(remaining.GetString(), out var remainingAmount) ? remainingAmount : 0m)
                            : 0m;
                    // Stringify the whole folio for local offline rendering without full schema
                    folio.TransactionsJson = el.GetRawText();
                    folio.UpdatedAt = DateTime.UtcNow;
                }
                
                var staleFolios = await dbContext.Folios
                    .Where(f => !incomingFolioIds.Contains(f.Id) && !f.IsDirty)
                    .ToListAsync(stoppingToken);
                if (staleFolios.Any() && !isIncremental)
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
                    outlet.PropertyId = el.TryGetProperty("propertyId", out var pid) && pid.ValueKind != System.Text.Json.JsonValueKind.Null ? pid.GetString() ?? "" : "";
                    outlet.Name = el.TryGetProperty("name", out var n) && n.ValueKind != System.Text.Json.JsonValueKind.Null ? n.GetString() ?? "" : "";
                    outlet.Type = el.TryGetProperty("type", out var t) && t.ValueKind != System.Text.Json.JsonValueKind.Null ? t.GetString() ?? "" : "";
                    outlet.IsActive = el.TryGetProperty("isActive", out var ia) && ia.GetBoolean();
                    outlet.AutoLockSeconds = el.TryGetProperty("autoLockSeconds", out var als) && als.ValueKind == System.Text.Json.JsonValueKind.Number ? als.GetInt32() : null;
                }
                
                if (posOutletsArray.GetArrayLength() > 0)
                {
                    var stale = await dbContext.PosOutlets.Where(o => o.PropertyId == propertyId && !incomingIds.Contains(o.Id)).ToListAsync(stoppingToken);
                    if (stale.Any() && !isIncremental) dbContext.PosOutlets.RemoveRange(stale);
                }

                await dbContext.SaveChangesAsync(stoppingToken);
            }

            // 7. POS Categories
            if (root.TryGetProperty("posCategories", out var posCategoriesArray))
            {
                var incomingIds = new HashSet<string>();
                var outletIds = await dbContext.PosOutlets.Where(o => o.PropertyId == propertyId).Select(o => o.Id).ToListAsync(stoppingToken);

                foreach (var el in posCategoriesArray.EnumerateArray())
                {
                    var id = el.GetProperty("id").GetString();
                    var outletId = el.TryGetProperty("outletId", out var oid) && oid.ValueKind != System.Text.Json.JsonValueKind.Null ? oid.GetString() : "";
                    
                    if (string.IsNullOrEmpty(id) || string.IsNullOrEmpty(outletId) || !outletIds.Contains(outletId)) continue;
                    incomingIds.Add(id);

                    var cat = await dbContext.ProductCategories.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (cat == null)
                    {
                        cat = new LodgeCore.Desktop.Data.Entities.LocalProductCategory { Id = id };
                        dbContext.ProductCategories.Add(cat);
                    }
                    cat.OutletId = outletId;
                    cat.Name = el.TryGetProperty("name", out var n) && n.ValueKind != System.Text.Json.JsonValueKind.Null ? n.GetString() ?? "" : "";
                    cat.IsActive = el.TryGetProperty("isActive", out var ia) && ia.GetBoolean();
                    cat.SortOrder = el.TryGetProperty("sortOrder", out var so) && so.ValueKind == System.Text.Json.JsonValueKind.Number ? so.GetInt32() : 0;
                    // KOT routing — default KITCHEN if cloud field is missing (rolling deployment safety)
                    cat.ProductionStation = el.TryGetProperty("productionStation", out var ps) && ps.ValueKind != System.Text.Json.JsonValueKind.Null
                        ? ps.GetString() ?? "KITCHEN" : "KITCHEN";
                }
                
                if (posCategoriesArray.GetArrayLength() > 0)
                {
                    var stale = await dbContext.ProductCategories.Where(c => outletIds.Contains(c.OutletId) && !incomingIds.Contains(c.Id)).ToListAsync(stoppingToken);
                    if (stale.Any() && !isIncremental) dbContext.ProductCategories.RemoveRange(stale);
                }
            }

            // 8. POS Products
            if (root.TryGetProperty("posProducts", out var posProductsArray))
            {
                var incomingIds = new HashSet<string>();
                foreach (var el in posProductsArray.EnumerateArray())
                {
                    var id = el.GetProperty("id").GetString();
                    var elPropertyId = el.TryGetProperty("propertyId", out var pid) && pid.ValueKind != System.Text.Json.JsonValueKind.Null ? pid.GetString() : "";
                    
                    if (string.IsNullOrEmpty(id) || elPropertyId != propertyId) continue;
                    incomingIds.Add(id);

                    var prod = await dbContext.PosProducts.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (prod == null)
                    {
                        prod = new LodgeCore.Desktop.Data.Entities.LocalPosProduct { Id = id, PropertyId = propertyId };
                        dbContext.PosProducts.Add(prod);
                    }
                    prod.CategoryId = el.TryGetProperty("categoryId", out var cid) && cid.ValueKind != System.Text.Json.JsonValueKind.Null ? cid.GetString() ?? "" : "";
                    prod.Name = el.TryGetProperty("name", out var n) && n.ValueKind != System.Text.Json.JsonValueKind.Null ? n.GetString() ?? "" : "";
                    prod.Description = el.TryGetProperty("description", out var desc) && desc.ValueKind != System.Text.Json.JsonValueKind.Null
                        ? desc.GetString() : null;
                    prod.Image = el.TryGetProperty("image", out var img) && img.ValueKind != System.Text.Json.JsonValueKind.Null
                        ? img.GetString() : null;
                    prod.Price = el.TryGetProperty("price", out var pr) 
                        ? (pr.ValueKind == System.Text.Json.JsonValueKind.Number ? pr.GetDecimal() : (pr.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(pr.GetString(), out var dp) ? dp : 0m)) 
                        : 0m;
                    prod.TaxRate = el.TryGetProperty("taxRate", out var tr) 
                        ? (tr.ValueKind == System.Text.Json.JsonValueKind.Number ? tr.GetDecimal() : (tr.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(tr.GetString(), out var dt) ? dt : 0m)) 
                        : 0m;
                    prod.IsActive = el.TryGetProperty("isActive", out var ia) && ia.GetBoolean();
                    prod.InventoryMode = el.TryGetProperty("inventoryMode", out var im) && im.ValueKind != System.Text.Json.JsonValueKind.Null
                        ? im.GetString() ?? "NON_STOCK" : "NON_STOCK";
                    // Product-level station override (null = inherit from category)
                    prod.ProductionStation = el.TryGetProperty("productionStation", out var pps) && pps.ValueKind != System.Text.Json.JsonValueKind.Null
                        ? pps.GetString() : null;
                    
                    if (el.TryGetProperty("modifiers", out var mods) && mods.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        prod.HasModifiers = mods.GetArrayLength() > 0;
                        var modIds = new HashSet<string>();
                        foreach (var m in mods.EnumerateArray())
                        {
                            var mId = m.TryGetProperty("id", out var mid) && mid.ValueKind != System.Text.Json.JsonValueKind.Null ? mid.GetString() : null;
                            if (string.IsNullOrEmpty(mId)) continue;
                            modIds.Add(mId);

                            var localMod = await dbContext.PosProductModifiers.FirstOrDefaultAsync(x => x.Id == mId, stoppingToken);
                            if (localMod == null)
                            {
                                localMod = new LodgeCore.Desktop.Data.Entities.LocalPosProductModifier { Id = mId, ProductId = id };
                                dbContext.PosProductModifiers.Add(localMod);
                            }
                            localMod.Name = m.TryGetProperty("name", out var mn) && mn.ValueKind != System.Text.Json.JsonValueKind.Null ? mn.GetString() ?? "" : "";
                            localMod.Price = m.TryGetProperty("price", out var mpr) 
                                ? (mpr.ValueKind == System.Text.Json.JsonValueKind.Number ? mpr.GetDecimal() : (mpr.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(mpr.GetString(), out var mdp) ? mdp : 0m)) 
                                : 0m;
                            localMod.IsActive = m.TryGetProperty("isActive", out var mia) ? mia.GetBoolean() : true;
                            localMod.StockItemId = m.TryGetProperty("stockItemId", out var msi) && msi.ValueKind != System.Text.Json.JsonValueKind.Null ? msi.GetString() : null;
                            localMod.Quantity = m.TryGetProperty("quantity", out var mq) ? ReadDecimal(m, "quantity") : 1m;
                            localMod.UnitOfMeasure = m.TryGetProperty("unitOfMeasure", out var mu) && mu.ValueKind != System.Text.Json.JsonValueKind.Null ? mu.GetString() : null;
                        }

                        // Remove stale modifiers for THIS product
                        var staleMods = await dbContext.PosProductModifiers.Where(m => m.ProductId == id && !modIds.Contains(m.Id)).ToListAsync(stoppingToken);
                        if (staleMods.Any() && !isIncremental) dbContext.PosProductModifiers.RemoveRange(staleMods);
                    }
                    else
                    {
                        prod.HasModifiers = false;
                    }
                }
                
                if (posProductsArray.GetArrayLength() > 0)
                {
                    var stale = await dbContext.PosProducts.Where(p => p.PropertyId == propertyId && !incomingIds.Contains(p.Id)).ToListAsync(stoppingToken);
                    if (stale.Any() && !isIncremental) dbContext.PosProducts.RemoveRange(stale);
                }
            }

            // 8b. Laundry Items
            // 8a. Inventory quantities and active recipe versions used by the
            // offline POS. These are deliberately applied before the menu is
            // consumed so stock availability is calculated from one snapshot.
            if (root.TryGetProperty("stockItems", out var stockItemsArray) && stockItemsArray.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in stockItemsArray.EnumerateArray())
                {
                    var id = el.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                    var itemPropertyId = el.TryGetProperty("propertyId", out var propertyEl) ? propertyEl.GetString() : null;
                    if (string.IsNullOrWhiteSpace(id) || itemPropertyId != propertyId) continue;

                    var item = await dbContext.StockItems.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (item == null)
                    {
                        item = new LocalStockItem { Id = id, PropertyId = propertyId };
                        dbContext.StockItems.Add(item);
                    }
                    item.Name = el.TryGetProperty("name", out var nameEl) ? nameEl.GetString() ?? "" : "";
                    item.BaseUnit = el.TryGetProperty("baseUnit", out var unitEl) ? unitEl.GetString() ?? "" : "";
                    item.CostPrice = ReadDecimal(el, "costPrice");
                    item.QuantityOnHand = ReadDecimal(el, "quantityOnHand");
                    item.ReorderLevel = el.TryGetProperty("reorderLevel", out var reorderEl) && reorderEl.ValueKind != JsonValueKind.Null ? ReadDecimal(reorderEl) : null;
                    item.IsActive = !el.TryGetProperty("isActive", out var activeEl) || activeEl.ValueKind == JsonValueKind.True;
                    item.PosProductId = el.TryGetProperty("posProductId", out var ppi) && ppi.ValueKind != JsonValueKind.Null ? ppi.GetString() : null;
                    item.UpdatedAt = el.TryGetProperty("updatedAt", out var updatedEl) && DateTime.TryParse(updatedEl.GetString(), out var updatedAt) ? updatedAt : DateTime.UtcNow;
                }
            }

            if (root.TryGetProperty("recipes", out var recipesArray) && recipesArray.ValueKind == JsonValueKind.Array)
            {
                var incomingIngredientIds = new HashSet<string>();
                foreach (var recipe in recipesArray.EnumerateArray())
                {
                    var productId = recipe.TryGetProperty("posProductId", out var productEl) ? productEl.GetString() : null;
                    if (string.IsNullOrWhiteSpace(productId)) continue;
                    if (!recipe.TryGetProperty("versions", out var versions) || versions.ValueKind != JsonValueKind.Array) continue;
                    foreach (var version in versions.EnumerateArray())
                    {
                        var versionId = version.TryGetProperty("id", out var versionIdEl) ? versionIdEl.GetString() : null;
                        if (string.IsNullOrWhiteSpace(versionId) || !version.TryGetProperty("ingredients", out var ingredients) || ingredients.ValueKind != JsonValueKind.Array) continue;
                        foreach (var ingredient in ingredients.EnumerateArray())
                        {
                            var ingredientId = ingredient.TryGetProperty("id", out var ingredientIdEl) ? ingredientIdEl.GetString() : null;
                            var stockItemId = ingredient.TryGetProperty("stockItemId", out var stockIdEl) ? stockIdEl.GetString() : null;
                            if (string.IsNullOrWhiteSpace(ingredientId) || string.IsNullOrWhiteSpace(stockItemId)) continue;
                            incomingIngredientIds.Add(ingredientId);
                            var local = await dbContext.RecipeIngredients.FirstOrDefaultAsync(x => x.Id == ingredientId, stoppingToken);
                            if (local == null)
                            {
                                local = new LocalRecipeIngredient { Id = ingredientId };
                                dbContext.RecipeIngredients.Add(local);
                            }
                            local.ProductId = productId;
                            local.RecipeVersionId = versionId;
                            local.StockItemId = stockItemId;
                            local.Quantity = ReadDecimal(ingredient, "quantity");
                            local.UnitOfMeasure = ingredient.TryGetProperty("unitOfMeasure", out var measureEl) ? measureEl.GetString() ?? "" : "";
                        }
                    }
                }
                if (!isIncremental && incomingIngredientIds.Count > 0)
                {
                    var staleIngredients = await dbContext.RecipeIngredients.Where(i => !incomingIngredientIds.Contains(i.Id)).ToListAsync(stoppingToken);
                    if (staleIngredients.Count > 0) dbContext.RecipeIngredients.RemoveRange(staleIngredients);
                }
            }

            // 8b. Laundry Items
            if (root.TryGetProperty("laundryItems", out var laundryItemsArray))
            {
                var incomingIds = new HashSet<string>();
                foreach (var el in laundryItemsArray.EnumerateArray())
                {
                    var id = el.GetProperty("id").GetString();
                    var elPropertyId = el.TryGetProperty("propertyId", out var pid) && pid.ValueKind != System.Text.Json.JsonValueKind.Null ? pid.GetString() : "";
                    
                    if (string.IsNullOrEmpty(id) || elPropertyId != propertyId) continue;
                    incomingIds.Add(id);

                    var prod = await dbContext.LaundryItems.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (prod == null)
                    {
                        prod = new LodgeCore.Desktop.Data.Entities.LocalLaundryItem { Id = id, PropertyId = propertyId };
                        dbContext.LaundryItems.Add(prod);
                    }
                    prod.Name = el.TryGetProperty("name", out var n) && n.ValueKind != System.Text.Json.JsonValueKind.Null ? n.GetString() ?? "" : "";
                    prod.Category = el.TryGetProperty("category", out var cid) && cid.ValueKind != System.Text.Json.JsonValueKind.Null ? cid.GetString() ?? "" : "";
                    prod.Description = el.TryGetProperty("description", out var desc) && desc.ValueKind != System.Text.Json.JsonValueKind.Null ? desc.GetString() ?? "" : "";
                    
                    prod.BasePrice = el.TryGetProperty("basePrice", out var pr) 
                        ? (pr.ValueKind == System.Text.Json.JsonValueKind.Number ? pr.GetDecimal() : (pr.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(pr.GetString(), out var dp) ? dp : 0m)) 
                        : 0m;
                        
                    prod.Currency = el.TryGetProperty("currency", out var curr) && curr.ValueKind != System.Text.Json.JsonValueKind.Null ? curr.GetString() ?? "NGN" : "NGN";
                    prod.IsActive = !el.TryGetProperty("isActive", out var ia) || ia.GetBoolean();
                    
                    if (el.TryGetProperty("servicePricingRules", out var rules) && rules.ValueKind != System.Text.Json.JsonValueKind.Null)
                    {
                        prod.ServicePricingRules = rules.GetRawText();
                    }
                    if (el.TryGetProperty("createdAt", out var crt) && crt.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(crt.GetString(), out var crtd)) prod.CreatedAt = crtd;
                    if (el.TryGetProperty("updatedAt", out var upd) && upd.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(upd.GetString(), out var updd)) prod.UpdatedAt = updd;
                }
                
                if (laundryItemsArray.GetArrayLength() > 0)
                {
                    var stale = await dbContext.LaundryItems.Where(p => p.PropertyId == propertyId && !incomingIds.Contains(p.Id)).ToListAsync(stoppingToken);
                    if (stale.Any() && !isIncremental) dbContext.LaundryItems.RemoveRange(stale);
                }
            }

            // 8c. Laundry Orders
            if (root.TryGetProperty("laundryOrders", out var laundryOrdersArray))
            {
                var incomingIds = new HashSet<string>();
                foreach (var el in laundryOrdersArray.EnumerateArray())
                {
                    var id = el.GetProperty("id").GetString();
                    var elPropertyId = el.TryGetProperty("propertyId", out var pid) && pid.ValueKind != System.Text.Json.JsonValueKind.Null ? pid.GetString() : "";
                    
                    if (string.IsNullOrEmpty(id) || elPropertyId != propertyId) continue;
                    incomingIds.Add(id);

                    var order = await dbContext.LaundryOrders.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (order == null)
                    {
                        order = new LodgeCore.Desktop.Data.Entities.LocalLaundryOrder { Id = id, PropertyId = propertyId };
                        dbContext.LaundryOrders.Add(order);
                    }
                    order.CustomerType = el.TryGetProperty("customerType", out var ct) && ct.ValueKind != System.Text.Json.JsonValueKind.Null ? ct.GetString() ?? "IN_HOUSE" : "IN_HOUSE";
                    order.ReservationId = el.TryGetProperty("reservationId", out var rid) && rid.ValueKind != System.Text.Json.JsonValueKind.Null ? rid.GetString() : null;
                    order.RoomId = el.TryGetProperty("roomId", out var rmId) && rmId.ValueKind != System.Text.Json.JsonValueKind.Null ? rmId.GetString() : null;
                    order.GuestId = el.TryGetProperty("guestId", out var gid) && gid.ValueKind != System.Text.Json.JsonValueKind.Null ? gid.GetString() ?? "" : "";
                    order.FolioItemId = el.TryGetProperty("folioItemId", out var fid) && fid.ValueKind != System.Text.Json.JsonValueKind.Null ? fid.GetString() ?? "" : "";
                    order.Status = el.TryGetProperty("status", out var st) && st.ValueKind != System.Text.Json.JsonValueKind.Null ? st.GetString() ?? "PENDING" : "PENDING";
                    order.ServiceType = el.TryGetProperty("serviceType", out var svt) && svt.ValueKind != System.Text.Json.JsonValueKind.Null ? svt.GetString() ?? "STANDARD" : "STANDARD";
                    order.TotalAmount = el.TryGetProperty("totalAmount", out var ta) ? (ta.ValueKind == System.Text.Json.JsonValueKind.Number ? ta.GetDecimal() : (ta.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(ta.GetString(), out var dta) ? dta : 0m)) : 0m;
                    order.Currency = el.TryGetProperty("currency", out var curr) && curr.ValueKind != System.Text.Json.JsonValueKind.Null ? curr.GetString() ?? "NGN" : "NGN";
                    order.SpecialNotes = el.TryGetProperty("specialNotes", out var sn) && sn.ValueKind != System.Text.Json.JsonValueKind.Null ? sn.GetString() ?? "" : "";
                    
                    if (el.TryGetProperty("requestedAt", out var ra) && ra.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(ra.GetString(), out var rad)) order.RequestedAt = rad;
                    if (el.TryGetProperty("expectedReadyAt", out var era) && era.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(era.GetString(), out var erad)) order.ExpectedReadyAt = erad;
                    if (el.TryGetProperty("collectedAt", out var ca) && ca.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(ca.GetString(), out var cad)) order.CollectedAt = cad;
                    order.CollectedBy = el.TryGetProperty("collectedBy", out var cb) && cb.ValueKind != System.Text.Json.JsonValueKind.Null ? cb.GetString() ?? "" : "";
                    if (el.TryGetProperty("readyAt", out var rda) && rda.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(rda.GetString(), out var rdad)) order.ReadyAt = rdad;
                    if (el.TryGetProperty("deliveredAt", out var dla) && dla.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(dla.GetString(), out var dlad)) order.DeliveredAt = dlad;
                    order.DeliveredBy = el.TryGetProperty("deliveredBy", out var db) && db.ValueKind != System.Text.Json.JsonValueKind.Null ? db.GetString() ?? "" : "";
                    
                    order.Version = el.TryGetProperty("version", out var ver) && ver.ValueKind == System.Text.Json.JsonValueKind.Number ? ver.GetInt32() : 1;
                    if (el.TryGetProperty("createdAt", out var crt) && crt.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(crt.GetString(), out var crtd)) order.CreatedAt = crtd;
                    if (el.TryGetProperty("updatedAt", out var upd) && upd.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(upd.GetString(), out var updd)) order.UpdatedAt = updd;

                    if (el.TryGetProperty("items", out var itemsArray) && itemsArray.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        var itemIds = new HashSet<string>();
                        foreach (var itemEl in itemsArray.EnumerateArray())
                        {
                            var itemId = itemEl.GetProperty("id").GetString();
                            if (string.IsNullOrEmpty(itemId)) continue;
                            itemIds.Add(itemId);

                            var localItem = await dbContext.LaundryOrderItems.FirstOrDefaultAsync(x => x.Id == itemId, stoppingToken);
                            if (localItem == null)
                            {
                                localItem = new LodgeCore.Desktop.Data.Entities.LocalLaundryOrderItem { Id = itemId, LaundryOrderId = id };
                                dbContext.LaundryOrderItems.Add(localItem);
                            }
                            localItem.ItemId = itemEl.TryGetProperty("itemId", out var lIid) && lIid.ValueKind != System.Text.Json.JsonValueKind.Null ? lIid.GetString() ?? "" : "";
                            localItem.Quantity = itemEl.TryGetProperty("quantity", out var qty) ? qty.GetInt32() : 0;
                            localItem.UnitPrice = itemEl.TryGetProperty("unitPrice", out var upr) ? (upr.ValueKind == System.Text.Json.JsonValueKind.Number ? upr.GetDecimal() : (upr.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(upr.GetString(), out var dupr) ? dupr : 0m)) : 0m;
                            localItem.TotalPrice = itemEl.TryGetProperty("totalPrice", out var tpr) ? (tpr.ValueKind == System.Text.Json.JsonValueKind.Number ? tpr.GetDecimal() : (tpr.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(tpr.GetString(), out var dtpr) ? dtpr : 0m)) : 0m;
                        }
                        
                        var staleItems = await dbContext.LaundryOrderItems.Where(i => i.LaundryOrderId == id && !itemIds.Contains(i.Id)).ToListAsync(stoppingToken);
                        if (staleItems.Any() && !isIncremental) dbContext.LaundryOrderItems.RemoveRange(staleItems);
                    }

                    if (el.TryGetProperty("statusHistory", out var historyArray) && historyArray.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        foreach (var histEl in historyArray.EnumerateArray())
                        {
                            var histId = histEl.GetProperty("id").GetString();
                            if (string.IsNullOrEmpty(histId)) continue;
                            
                            var localHist = await dbContext.LaundryOrderStatusHistory.FirstOrDefaultAsync(x => x.Id == histId, stoppingToken);
                            if (localHist == null)
                            {
                                localHist = new LodgeCore.Desktop.Data.Entities.LocalLaundryOrderStatusHistory { Id = histId, LaundryOrderId = id };
                                dbContext.LaundryOrderStatusHistory.Add(localHist);
                                
                                localHist.PreviousStatus = histEl.TryGetProperty("previousStatus", out var phst) && phst.ValueKind != System.Text.Json.JsonValueKind.Null ? phst.GetString() ?? "" : "";
                                localHist.NewStatus = histEl.TryGetProperty("newStatus", out var nhst) && nhst.ValueKind != System.Text.Json.JsonValueKind.Null ? nhst.GetString() ?? "" : "";
                                localHist.ChangedBy = histEl.TryGetProperty("changedBy", out var opid) && opid.ValueKind != System.Text.Json.JsonValueKind.Null ? opid.GetString() ?? "" : "";
                                localHist.DeviceId = histEl.TryGetProperty("deviceId", out var did) && did.ValueKind != System.Text.Json.JsonValueKind.Null ? did.GetString() ?? "" : "";
                                localHist.Notes = histEl.TryGetProperty("notes", out var hn) && hn.ValueKind != System.Text.Json.JsonValueKind.Null ? hn.GetString() ?? "" : "";
                                if (histEl.TryGetProperty("changedAt", out var hcrt) && hcrt.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(hcrt.GetString(), out var hcrtd)) localHist.ChangedAt = hcrtd;
                            }
                        }
                    }
                }
                
                if (laundryOrdersArray.GetArrayLength() > 0)
                {
                    var stale = await dbContext.LaundryOrders.Where(o => o.PropertyId == propertyId && !incomingIds.Contains(o.Id)).ToListAsync(stoppingToken);
                    if (stale.Any() && !isIncremental) dbContext.LaundryOrders.RemoveRange(stale);
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
                    var outletId = el.TryGetProperty("outletId", out var oid) && oid.ValueKind != System.Text.Json.JsonValueKind.Null ? oid.GetString() : "";

                    if (string.IsNullOrEmpty(id) || string.IsNullOrEmpty(outletId) || !outletIds.Contains(outletId)) continue;
                    incomingIds.Add(id);

                    var fp = await dbContext.PosFloorPlans.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (fp == null)
                    {
                        fp = new LodgeCore.Desktop.Data.Entities.LocalPosFloorPlan { Id = id, OutletId = outletId };
                        dbContext.PosFloorPlans.Add(fp);
                    }
                    fp.Name = el.TryGetProperty("name", out var n) && n.ValueKind != System.Text.Json.JsonValueKind.Null ? n.GetString() ?? "" : "";
                    fp.IsActive = el.TryGetProperty("isActive", out var ia) ? ia.GetBoolean() : true;
                }

                if (posFloorPlansArray.GetArrayLength() > 0)
                {
                    var stale = await dbContext.PosFloorPlans.Where(f => outletIds.Contains(f.OutletId) && !incomingIds.Contains(f.Id)).ToListAsync(stoppingToken);
                    if (stale.Any() && !isIncremental) dbContext.PosFloorPlans.RemoveRange(stale);
                }

                await dbContext.SaveChangesAsync(stoppingToken);
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
                    var fpId = el.TryGetProperty("floorPlanId", out var fpid) && fpid.ValueKind != System.Text.Json.JsonValueKind.Null ? fpid.GetString() : "";

                    if (string.IsNullOrEmpty(id) || string.IsNullOrEmpty(fpId) || !validFloorPlanIds.Contains(fpId)) continue;
                    incomingIds.Add(id);

                    var table = await dbContext.PosTables.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    if (table == null)
                    {
                        table = new LodgeCore.Desktop.Data.Entities.LocalPosTable { Id = id, FloorPlanId = fpId };
                        dbContext.PosTables.Add(table);
                    }
                    table.Name = el.TryGetProperty("name", out var n) && n.ValueKind != System.Text.Json.JsonValueKind.Null ? n.GetString() ?? "" : "";
                    table.Capacity = el.TryGetProperty("capacity", out var cap) && cap.ValueKind == System.Text.Json.JsonValueKind.Number ? cap.GetInt32() : 4;
                    table.PositionX = el.TryGetProperty("positionX", out var px) && px.ValueKind == System.Text.Json.JsonValueKind.Number ? px.GetInt32() : 0;
                    table.PositionY = el.TryGetProperty("positionY", out var py) && py.ValueKind == System.Text.Json.JsonValueKind.Number ? py.GetInt32() : 0;
                    table.CurrentOrderId = el.TryGetProperty("currentOrderId", out var currentOrder)
                        && currentOrder.ValueKind != System.Text.Json.JsonValueKind.Null
                        ? currentOrder.GetString()
                        : null;
                    table.IsActive = el.TryGetProperty("isActive", out var ia) ? ia.GetBoolean() : true;
                }

                if (posTablesArray.GetArrayLength() > 0)
                {
                    var stale = await dbContext.PosTables.Where(t => validFloorPlanIds.Contains(t.FloorPlanId) && !incomingIds.Contains(t.Id)).ToListAsync(stoppingToken);
                    if (stale.Any() && !isIncremental) dbContext.PosTables.RemoveRange(stale);
                }
            }

            
            // 10.5 POS Sessions
            if (root.TryGetProperty("posSessions", out var posSessionsArray))
            {
                var incomingIds = new HashSet<string>();
                foreach (var el in posSessionsArray.EnumerateArray())
                {
                    var id = el.GetProperty("id").GetString();
                    if (string.IsNullOrEmpty(id)) continue;
                    incomingIds.Add(id);

                    var posSession = await dbContext.PosSessions.FirstOrDefaultAsync(x => x.Id == id, stoppingToken);
                    
                    var incomingUpdatedAt = el.TryGetProperty("updatedAt", out var u) ? u.GetDateTime() : DateTime.MinValue;
                    if (posSession != null && (posSession.UpdatedAt >= incomingUpdatedAt || await HasPendingPosEventAsync(id))) continue;

                    if (posSession == null)
                    {
                        posSession = new LodgeCore.Desktop.Data.Entities.LocalPosSession { Id = id };
                        dbContext.PosSessions.Add(posSession);
                    }
                    posSession.PropertyId = propertyId;
                    posSession.OutletId = el.TryGetProperty("outletId", out var oid) && oid.ValueKind != System.Text.Json.JsonValueKind.Null ? oid.GetString() ?? "" : "";
                    posSession.DeviceId = el.TryGetProperty("deviceId", out var did) && did.ValueKind != System.Text.Json.JsonValueKind.Null ? did.GetString() : null;
                    posSession.UserId = el.TryGetProperty("userId", out var uid) && uid.ValueKind != System.Text.Json.JsonValueKind.Null ? uid.GetString() ?? "" : "";
                    posSession.Status = el.TryGetProperty("status", out var st) && st.ValueKind != System.Text.Json.JsonValueKind.Null ? st.GetString() ?? "" : "";
                    posSession.ControlStatus = el.TryGetProperty("controlStatus", out var csStatus) && csStatus.ValueKind != System.Text.Json.JsonValueKind.Null
                        ? csStatus.GetString() ?? posSession.ControlStatus
                        : posSession.Status switch
                        {
                            "RECONCILED" => "RECONCILED",
                            "RECONCILIATION_REQUIRED" or "CLOSED" => "SUBMITTED",
                            _ => posSession.ControlStatus
                        };
                    posSession.VarianceStatus = el.TryGetProperty("varianceStatus", out var vsStatus) && vsStatus.ValueKind != System.Text.Json.JsonValueKind.Null ? vsStatus.GetString() : posSession.VarianceStatus;
                    posSession.BankingModel = el.TryGetProperty("bankingModel", out var bm) && bm.ValueKind != System.Text.Json.JsonValueKind.Null ? bm.GetString() ?? "CENTRAL_CASHIER" : "CENTRAL_CASHIER";
                    posSession.BankType = el.TryGetProperty("bankType", out var bt) && bt.ValueKind != System.Text.Json.JsonValueKind.Null ? bt.GetString() ?? "CENTRAL" : "CENTRAL";
                    posSession.PrimaryOperatorId = el.TryGetProperty("primaryOperatorId", out var poi) && poi.ValueKind != System.Text.Json.JsonValueKind.Null ? poi.GetString() : null;
                    posSession.AuthorizedBy = el.TryGetProperty("authorizedBy", out var auth) && auth.ValueKind != System.Text.Json.JsonValueKind.Null ? auth.GetString() : null;
                    posSession.Reason = el.TryGetProperty("reason", out var rs) && rs.ValueKind != System.Text.Json.JsonValueKind.Null ? rs.GetString() : null;
                    
                    if (el.TryGetProperty("openedAt", out var oa) && oa.ValueKind != System.Text.Json.JsonValueKind.Null) posSession.OpenedAt = oa.GetDateTime();
                    if (el.TryGetProperty("closedAt", out var ca) && ca.ValueKind != System.Text.Json.JsonValueKind.Null) posSession.ClosedAt = ca.GetDateTime();
                    
                    posSession.OpeningCash = el.TryGetProperty("openingCash", out var oc) ? (oc.ValueKind == System.Text.Json.JsonValueKind.Number ? oc.GetDecimal() : 0m) : 0m;
                    posSession.CashSales = el.TryGetProperty("cashSales", out var cs) ? (cs.ValueKind == System.Text.Json.JsonValueKind.Number ? cs.GetDecimal() : 0m) : 0m;
                    posSession.CashRefunds = el.TryGetProperty("cashRefunds", out var cr) ? (cr.ValueKind == System.Text.Json.JsonValueKind.Number ? cr.GetDecimal() : 0m) : 0m;
                    posSession.CashIn = el.TryGetProperty("cashIn", out var ci) ? (ci.ValueKind == System.Text.Json.JsonValueKind.Number ? ci.GetDecimal() : 0m) : 0m;
                    posSession.CashOut = el.TryGetProperty("cashOut", out var co) ? (co.ValueKind == System.Text.Json.JsonValueKind.Number ? co.GetDecimal() : 0m) : 0m;
                    posSession.ExpectedCash = el.TryGetProperty("expectedCash", out var ec) ? (ec.ValueKind == System.Text.Json.JsonValueKind.Number ? ec.GetDecimal() : 0m) : 0m;
                    if (el.TryGetProperty("actualCash", out var ac) && ac.ValueKind == System.Text.Json.JsonValueKind.Number) posSession.ActualCash = ac.GetDecimal();
                    if (el.TryGetProperty("variance", out var va) && va.ValueKind == System.Text.Json.JsonValueKind.Number) posSession.Variance = va.GetDecimal();
                    
                    posSession.ApprovedBy = el.TryGetProperty("approvedBy", out var ap) && ap.ValueKind != System.Text.Json.JsonValueKind.Null ? ap.GetString() : null;
                    if (el.TryGetProperty("approvedAt", out var apa) && apa.ValueKind != System.Text.Json.JsonValueKind.Null) posSession.ApprovedAt = apa.GetDateTime();
                    posSession.SubmittedBy = el.TryGetProperty("submittedBy", out var submittedByPos) && submittedByPos.ValueKind != System.Text.Json.JsonValueKind.Null ? submittedByPos.GetString() : posSession.SubmittedBy;
                    posSession.ReviewStartedBy = el.TryGetProperty("reviewStartedBy", out var reviewStartedByPos) && reviewStartedByPos.ValueKind != System.Text.Json.JsonValueKind.Null ? reviewStartedByPos.GetString() : posSession.ReviewStartedBy;
                    posSession.ApprovalDecision = el.TryGetProperty("approvalDecision", out var approvalDecisionPos) && approvalDecisionPos.ValueKind != System.Text.Json.JsonValueKind.Null ? approvalDecisionPos.GetString() : posSession.ApprovalDecision;
                    posSession.ApprovalNotes = el.TryGetProperty("approvalNotes", out var approvalNotesPos) && approvalNotesPos.ValueKind != System.Text.Json.JsonValueKind.Null ? approvalNotesPos.GetString() : posSession.ApprovalNotes;
                    if (el.TryGetProperty("submittedAt", out var submittedAtPos) && submittedAtPos.ValueKind != System.Text.Json.JsonValueKind.Null) posSession.SubmittedAt = submittedAtPos.GetDateTime();
                    if (el.TryGetProperty("reviewStartedAt", out var reviewStartedAtPos) && reviewStartedAtPos.ValueKind != System.Text.Json.JsonValueKind.Null) posSession.ReviewStartedAt = reviewStartedAtPos.GetDateTime();
                    if (el.TryGetProperty("handoverAt", out var handoverAtPos) && handoverAtPos.ValueKind != System.Text.Json.JsonValueKind.Null) posSession.HandoverAt = handoverAtPos.GetDateTime();
                    if (el.TryGetProperty("depositedAt", out var depositedAtPos) && depositedAtPos.ValueKind != System.Text.Json.JsonValueKind.Null) posSession.DepositedAt = depositedAtPos.GetDateTime();
                    
                    if (el.TryGetProperty("businessDate", out var bd) && bd.ValueKind != System.Text.Json.JsonValueKind.Null) posSession.BusinessDate = bd.GetDateTime();
                    posSession.OpenedBy = el.TryGetProperty("openedBy", out var ob) && ob.ValueKind != System.Text.Json.JsonValueKind.Null ? ob.GetString() : null;
                    posSession.ClosedBy = el.TryGetProperty("closedBy", out var cb) && cb.ValueKind != System.Text.Json.JsonValueKind.Null ? cb.GetString() : null;
                    
                    posSession.Version = el.TryGetProperty("version", out var v) && v.ValueKind == System.Text.Json.JsonValueKind.Number ? v.GetInt32() : 1;
                    if (el.TryGetProperty("createdAt", out var crt) && crt.ValueKind != System.Text.Json.JsonValueKind.Null) posSession.CreatedAt = crt.GetDateTime();
                    posSession.UpdatedAt = incomingUpdatedAt;
                }
            }

            // 10.6 POS Orders
            if (root.TryGetProperty("posOrders", out var posOrdersArray))
            {
                foreach (var el in posOrdersArray.EnumerateArray())
                {
                    var id = el.GetProperty("id").GetString();
                    if (string.IsNullOrEmpty(id)) continue;

                    var order = await dbContext.PosOrders
                        .Include(o => o.Items).ThenInclude(i => i.Modifiers)
                        .Include(o => o.Payments)
                        .Include(o => o.Checks)
                        .Include(o => o.Kots)
                        .FirstOrDefaultAsync(x => x.Id == id, stoppingToken);

                    var incomingUpdatedAt = el.TryGetProperty("updatedAt", out var u) && u.ValueKind != System.Text.Json.JsonValueKind.Null ? u.GetDateTime() : DateTime.MinValue;
                    
                    // Dirty protection! Check if local has been updated more recently or has changes pending sync
                    // Wait, we don't have IsDirty on PosOrders yet? LocalPosOrder does not have IsDirty.
                    // But if it was updated locally, its UpdatedAt might be > incomingUpdatedAt
                    if (order != null && (order.UpdatedAt >= incomingUpdatedAt || await HasPendingPosEventAsync(id))) continue;

                    if (order == null)
                    {
                        order = new LodgeCore.Desktop.Data.Entities.LocalPosOrder { Id = id };
                        dbContext.PosOrders.Add(order);
                    }
                    order.PropertyId = propertyId;
                    order.OutletId = el.TryGetProperty("outletId", out var oid) && oid.ValueKind != System.Text.Json.JsonValueKind.Null ? oid.GetString() ?? "" : "";
                    order.SessionId = el.TryGetProperty("sessionId", out var sid) && sid.ValueKind != System.Text.Json.JsonValueKind.Null ? sid.GetString() : null;
                    order.FolioId = el.TryGetProperty("folioId", out var fid) && fid.ValueKind != System.Text.Json.JsonValueKind.Null ? fid.GetString() : null;
                    order.OrderNumber = el.TryGetProperty("orderNumber", out var on) && on.ValueKind != System.Text.Json.JsonValueKind.Null ? on.GetString() ?? "" : "";
                    order.Status = el.TryGetProperty("status", out var st) && st.ValueKind != System.Text.Json.JsonValueKind.Null ? st.GetString() ?? "" : "";
                    if (el.TryGetProperty("businessDate", out var bd) && bd.ValueKind != System.Text.Json.JsonValueKind.Null) order.BusinessDate = bd.GetDateTime();
                    order.Subtotal = el.TryGetProperty("subtotal", out var sub) && sub.ValueKind == System.Text.Json.JsonValueKind.Number ? sub.GetDecimal() : 0m;
                    order.TaxAmount = el.TryGetProperty("taxAmount", out var tax) && tax.ValueKind == System.Text.Json.JsonValueKind.Number ? tax.GetDecimal() : 0m;
                    order.Total = el.TryGetProperty("total", out var tot) && tot.ValueKind == System.Text.Json.JsonValueKind.Number ? tot.GetDecimal() : 0m;
                    order.Notes = el.TryGetProperty("notes", out var no) && no.ValueKind != System.Text.Json.JsonValueKind.Null ? no.GetString() : null;
                    order.TableNumber = el.TryGetProperty("tableNumber", out var tn) && tn.ValueKind != System.Text.Json.JsonValueKind.Null ? tn.GetString() : null;
                    order.TableId = el.TryGetProperty("tableId", out var ti) && ti.ValueKind != System.Text.Json.JsonValueKind.Null ? ti.GetString() : null;
                    order.GuestCount = el.TryGetProperty("guestCount", out var gc) && gc.ValueKind == System.Text.Json.JsonValueKind.Number ? gc.GetInt32() : 1;
                    order.ServiceCharge = el.TryGetProperty("serviceCharge", out var sc) && sc.ValueKind == System.Text.Json.JsonValueKind.Number ? sc.GetDecimal() : 0m;
                    order.TipAmount = el.TryGetProperty("tipAmount", out var tip) && tip.ValueKind == System.Text.Json.JsonValueKind.Number ? tip.GetDecimal() : 0m;
                    order.ServerStaffId = el.TryGetProperty("serverStaffId", out var ssi) && ssi.ValueKind != System.Text.Json.JsonValueKind.Null ? ssi.GetString() : null;
                    order.Version = el.TryGetProperty("version", out var v) && v.ValueKind == System.Text.Json.JsonValueKind.Number ? v.GetInt32() : 1;
                    order.OrderType = el.TryGetProperty("orderType", out var ot) && ot.ValueKind != System.Text.Json.JsonValueKind.Null ? ot.GetString() ?? "TABLE" : "TABLE";
                    order.PaymentStatus = el.TryGetProperty("paymentStatus", out var ps) && ps.ValueKind != System.Text.Json.JsonValueKind.Null ? ps.GetString() ?? "UNPAID" : "UNPAID";
                    order.Discount = el.TryGetProperty("discount", out var dis) && dis.ValueKind == System.Text.Json.JsonValueKind.Number ? dis.GetDecimal() : 0m;
                    order.DisplayName = el.TryGetProperty("displayName", out var dn) && dn.ValueKind != System.Text.Json.JsonValueKind.Null ? dn.GetString() ?? "" : "";
                    if (el.TryGetProperty("closedAt", out var ca) && ca.ValueKind != System.Text.Json.JsonValueKind.Null) order.ClosedAt = ca.GetDateTime();
                    if (el.TryGetProperty("createdAt", out var crt) && crt.ValueKind != System.Text.Json.JsonValueKind.Null) order.CreatedAt = crt.GetDateTime();
                    order.UpdatedAt = incomingUpdatedAt;

                    // Items
                    if (el.TryGetProperty("items", out var items) && items.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        var incomingItemIds = new HashSet<string>();
                        foreach (var itemEl in items.EnumerateArray())
                        {
                            var itemId = itemEl.GetProperty("id").GetString();
                            if (string.IsNullOrEmpty(itemId)) continue;
                            incomingItemIds.Add(itemId);
                            
                            var item = order.Items.FirstOrDefault(i => i.Id == itemId);
                            if (item == null)
                            {
                                item = new LodgeCore.Desktop.Data.Entities.LocalPosOrderItem { Id = itemId, OrderId = id };
                                order.Items.Add(item);
                            }
                            item.ProductId = itemEl.TryGetProperty("productId", out var pid) && pid.ValueKind != System.Text.Json.JsonValueKind.Null ? pid.GetString() : null;
                            item.ProductName = itemEl.TryGetProperty("productName", out var pn) && pn.ValueKind != System.Text.Json.JsonValueKind.Null ? pn.GetString() ?? "" : "";
                            item.Quantity = itemEl.TryGetProperty("quantity", out var iq) && iq.ValueKind == System.Text.Json.JsonValueKind.Number ? iq.GetDecimal() : 1m;
                            item.UnitPrice = itemEl.TryGetProperty("unitPrice", out var up) && up.ValueKind == System.Text.Json.JsonValueKind.Number ? up.GetDecimal() : 0m;
                            item.TaxRate = itemEl.TryGetProperty("taxRate", out var itr) && itr.ValueKind == System.Text.Json.JsonValueKind.Number ? itr.GetDecimal() : 0m;
                            item.TaxAmount = itemEl.TryGetProperty("taxAmount", out var ita) && ita.ValueKind == System.Text.Json.JsonValueKind.Number ? ita.GetDecimal() : 0m;
                            item.Total = itemEl.TryGetProperty("total", out var itot) && itot.ValueKind == System.Text.Json.JsonValueKind.Number ? itot.GetDecimal() : 0m;
                            item.Subtotal = itemEl.TryGetProperty("subtotal", out var isub) && isub.ValueKind == System.Text.Json.JsonValueKind.Number ? isub.GetDecimal() : 0m;
                            item.Discount = itemEl.TryGetProperty("discount", out var idis) && idis.ValueKind == System.Text.Json.JsonValueKind.Number ? idis.GetDecimal() : 0m;
                            item.Course = itemEl.TryGetProperty("course", out var ico) && ico.ValueKind == System.Text.Json.JsonValueKind.Number ? ico.GetInt32() : null;
                            item.KitchenStatus = itemEl.TryGetProperty("kitchenStatus", out var iks) && iks.ValueKind != System.Text.Json.JsonValueKind.Null ? iks.GetString() : null;
                            if (itemEl.TryGetProperty("sentToKitchenAt", out var iska) && iska.ValueKind != System.Text.Json.JsonValueKind.Null) item.SentToKitchenAt = iska.GetDateTime();
                            item.VoidReason = itemEl.TryGetProperty("voidReason", out var ivr) && ivr.ValueKind != System.Text.Json.JsonValueKind.Null ? ivr.GetString() : null;
                            item.CheckId = itemEl.TryGetProperty("checkId", out var icid) && icid.ValueKind != System.Text.Json.JsonValueKind.Null ? icid.GetString() : null;
                            item.KotId = itemEl.TryGetProperty("kotId", out var ikot) && ikot.ValueKind != System.Text.Json.JsonValueKind.Null ? ikot.GetString() : null;
                            if (itemEl.TryGetProperty("createdAt", out var icrt) && icrt.ValueKind != System.Text.Json.JsonValueKind.Null) item.CreatedAt = icrt.GetDateTime();

                            if (itemEl.TryGetProperty("modifiers", out var mods) && mods.ValueKind == System.Text.Json.JsonValueKind.Array)
                            {
                                var incomingModIds = new HashSet<string>();
                                foreach (var mEl in mods.EnumerateArray())
                                {
                                    var mId = mEl.GetProperty("id").GetString();
                                    if (string.IsNullOrEmpty(mId)) continue;
                                    incomingModIds.Add(mId);

                                    var mod = item.Modifiers.FirstOrDefault(m => m.Id == mId);
                                    if (mod == null)
                                    {
                                        mod = new LodgeCore.Desktop.Data.Entities.LocalPosOrderItemModifier { Id = mId, OrderItemId = itemId };
                                        item.Modifiers.Add(mod);
                                    }
                                    mod.Name = mEl.TryGetProperty("name", out var mmn) && mmn.ValueKind != System.Text.Json.JsonValueKind.Null ? mmn.GetString() ?? "" : "";
                                    mod.Price = mEl.TryGetProperty("price", out var mmpr) && mmpr.ValueKind == System.Text.Json.JsonValueKind.Number ? mmpr.GetDecimal() : 0m;
                                    mod.StockItemId = mEl.TryGetProperty("stockItemId", out var msi) && msi.ValueKind != System.Text.Json.JsonValueKind.Null ? msi.GetString() : null;
                                    mod.Quantity = mEl.TryGetProperty("quantity", out var mq) ? ReadDecimal(mEl, "quantity") : 0m;
                                    mod.UnitOfMeasure = mEl.TryGetProperty("unitOfMeasure", out var mu) && mu.ValueKind != System.Text.Json.JsonValueKind.Null ? mu.GetString() : null;
                                }
                                var modsToRemove = item.Modifiers.Where(m => !incomingModIds.Contains(m.Id)).ToList();
                                foreach (var m in modsToRemove) item.Modifiers.Remove(m);
                            }
                        }
                        var itemsToRemove = order.Items.Where(i => !incomingItemIds.Contains(i.Id)).ToList();
                        foreach(var i in itemsToRemove) order.Items.Remove(i);
                    }

                    // Checks
                    if (el.TryGetProperty("checks", out var checks) && checks.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        var incomingCheckIds = new HashSet<string>();
                        foreach (var checkEl in checks.EnumerateArray())
                        {
                            var checkId = checkEl.GetProperty("id").GetString();
                            if (string.IsNullOrEmpty(checkId)) continue;
                            incomingCheckIds.Add(checkId);

                            var check = order.Checks.FirstOrDefault(c => c.Id == checkId);
                            if (check == null)
                            {
                                check = new LodgeCore.Desktop.Data.Entities.LocalPosCheck { Id = checkId, OrderId = id };
                                order.Checks.Add(check);
                            }
                            check.CheckNumber = checkEl.TryGetProperty("checkNumber", out var cn) && cn.ValueKind != System.Text.Json.JsonValueKind.Null ? cn.GetString() ?? "" : "";
                            check.Total = checkEl.TryGetProperty("total", out var ct) && ct.ValueKind == System.Text.Json.JsonValueKind.Number ? ct.GetDecimal() : 0m;
                            check.Status = checkEl.TryGetProperty("status", out var cs) && cs.ValueKind != System.Text.Json.JsonValueKind.Null ? cs.GetString() ?? "OPEN" : "OPEN";
                            if (checkEl.TryGetProperty("businessDate", out var cbd) && cbd.ValueKind != System.Text.Json.JsonValueKind.Null) check.BusinessDate = cbd.GetDateTime();
                            if (checkEl.TryGetProperty("createdAt", out var ccrt) && ccrt.ValueKind != System.Text.Json.JsonValueKind.Null) check.CreatedAt = ccrt.GetDateTime();
                            if (checkEl.TryGetProperty("updatedAt", out var cupd) && cupd.ValueKind != System.Text.Json.JsonValueKind.Null) check.UpdatedAt = cupd.GetDateTime();
                        }
                        var checksToRemove = order.Checks.Where(c => !incomingCheckIds.Contains(c.Id)).ToList();
                        foreach(var c in checksToRemove) order.Checks.Remove(c);
                    }

                    // Payments nested under checks are supported for older
                    // payloads. Do not clear the local payment collection when
                    // the current server shape returns root-level payments.
                    if (el.TryGetProperty("checks", out var checksPayments) && checksPayments.ValueKind == System.Text.Json.JsonValueKind.Array &&
                        checksPayments.EnumerateArray().Any(c => c.TryGetProperty("payments", out var p) && p.ValueKind == System.Text.Json.JsonValueKind.Array))
                    {
                        var incomingPaymentIds = new HashSet<string>();
                        foreach (var checkEl in checksPayments.EnumerateArray())
                        {
                            if (checkEl.TryGetProperty("payments", out var payments) && payments.ValueKind == System.Text.Json.JsonValueKind.Array)
                            {
                                foreach (var payEl in payments.EnumerateArray())
                                {
                                    var payId = payEl.GetProperty("id").GetString();
                                    if (string.IsNullOrEmpty(payId)) continue;
                                    incomingPaymentIds.Add(payId);

                                    var payment = order.Payments.FirstOrDefault(p => p.Id == payId);
                                    if (payment == null)
                                    {
                                        payment = new LodgeCore.Desktop.Data.Entities.LocalPosPayment { Id = payId, OrderId = id };
                                        order.Payments.Add(payment);
                                    }
                                    payment.Method = payEl.TryGetProperty("method", out var pm) && pm.ValueKind != System.Text.Json.JsonValueKind.Null ? pm.GetString() ?? "" : "";
                                    payment.Status = payEl.TryGetProperty("status", out var pst) && pst.ValueKind != System.Text.Json.JsonValueKind.Null ? pst.GetString() ?? "" : "";
                                    payment.Amount = payEl.TryGetProperty("amount", out var pa) && pa.ValueKind == System.Text.Json.JsonValueKind.Number ? pa.GetDecimal() : 0m;
                                    payment.Currency = payEl.TryGetProperty("currency", out var pcu) && pcu.ValueKind != System.Text.Json.JsonValueKind.Null ? pcu.GetString() ?? "NGN" : "NGN";
                                    payment.CheckId = payEl.TryGetProperty("checkId", out var pci) && pci.ValueKind != System.Text.Json.JsonValueKind.Null ? pci.GetString() : null;
                                    payment.SessionId = payEl.TryGetProperty("sessionId", out var psi) && psi.ValueKind != System.Text.Json.JsonValueKind.Null ? psi.GetString() : null;
                                    if (payEl.TryGetProperty("businessDate", out var pbd) && pbd.ValueKind != System.Text.Json.JsonValueKind.Null) payment.BusinessDate = pbd.GetDateTime();
                                    if (payEl.TryGetProperty("createdAt", out var pcrt) && pcrt.ValueKind != System.Text.Json.JsonValueKind.Null) payment.CreatedAt = pcrt.GetDateTime();
                                    if (payEl.TryGetProperty("updatedAt", out var pupd) && pupd.ValueKind != System.Text.Json.JsonValueKind.Null) payment.UpdatedAt = pupd.GetDateTime();
                                }
                            }
                        }
                        var paysToRemove = order.Payments.Where(p => !incomingPaymentIds.Contains(p.Id)).ToList();
                        foreach (var p in paysToRemove) order.Payments.Remove(p);
                    }

                    // Current API shape returns payments directly on PosOrder.
                    if (el.TryGetProperty("payments", out var rootPayments) && rootPayments.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        foreach (var payEl in rootPayments.EnumerateArray())
                        {
                            var payId = payEl.TryGetProperty("id", out var pid) ? pid.GetString() : null;
                            if (string.IsNullOrWhiteSpace(payId)) continue;
                            var payment = order.Payments.FirstOrDefault(p => p.Id == payId);
                            if (payment == null)
                            {
                                payment = new LodgeCore.Desktop.Data.Entities.LocalPosPayment { Id = payId, OrderId = id };
                                order.Payments.Add(payment);
                            }
                            payment.Method = payEl.TryGetProperty("method", out var pm) && pm.ValueKind != JsonValueKind.Null ? pm.GetString() ?? "" : payment.Method;
                            payment.Status = payEl.TryGetProperty("status", out var pst) && pst.ValueKind != JsonValueKind.Null ? pst.GetString() ?? "" : payment.Status;
                            if (payEl.TryGetProperty("amount", out var pa) && pa.ValueKind == JsonValueKind.Number) payment.Amount = pa.GetDecimal();
                            payment.Currency = payEl.TryGetProperty("currency", out var pcu) && pcu.ValueKind != JsonValueKind.Null ? pcu.GetString() ?? "NGN" : payment.Currency;
                            payment.CheckId = payEl.TryGetProperty("checkId", out var pci) && pci.ValueKind != JsonValueKind.Null ? pci.GetString() : payment.CheckId;
                            payment.SessionId = payEl.TryGetProperty("sessionId", out var psi) && psi.ValueKind != JsonValueKind.Null ? psi.GetString() : payment.SessionId;
                            if (payEl.TryGetProperty("businessDate", out var pbd) && pbd.ValueKind != JsonValueKind.Null) payment.BusinessDate = pbd.GetDateTime();
                            if (payEl.TryGetProperty("createdAt", out var pcrt) && pcrt.ValueKind != JsonValueKind.Null) payment.CreatedAt = pcrt.GetDateTime();
                            if (payEl.TryGetProperty("updatedAt", out var pupd) && pupd.ValueKind != JsonValueKind.Null) payment.UpdatedAt = pupd.GetDateTime();
                        }
                    }

                    // Kots
                    if (el.TryGetProperty("kots", out var kots) && kots.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        var incomingKotIds = new HashSet<string>();
                        foreach (var kotEl in kots.EnumerateArray())
                        {
                            var kotId = kotEl.GetProperty("id").GetString();
                            if (string.IsNullOrEmpty(kotId)) continue;
                            incomingKotIds.Add(kotId);

                            var kot = order.Kots.FirstOrDefault(k => k.Id == kotId);
                            if (kot == null)
                            {
                                kot = new LodgeCore.Desktop.Data.Entities.LocalPosKot { Id = kotId, OrderId = id };
                                order.Kots.Add(kot);
                            }
                            kot.OutletId = kotEl.TryGetProperty("outletId", out var koid) && koid.ValueKind != System.Text.Json.JsonValueKind.Null ? koid.GetString() ?? "" : "";
                            kot.CreatedBy = kotEl.TryGetProperty("createdBy", out var kcb) && kcb.ValueKind != System.Text.Json.JsonValueKind.Null ? kcb.GetString() ?? "" : "";
                            kot.KotNumber = kotEl.TryGetProperty("kotNumber", out var kkn) && kkn.ValueKind != System.Text.Json.JsonValueKind.Null ? kkn.GetString() ?? "" : "";
                            kot.Status = kotEl.TryGetProperty("status", out var ks) && ks.ValueKind != System.Text.Json.JsonValueKind.Null ? ks.GetString() ?? "PENDING" : "PENDING";
                            kot.PrintStatus = kotEl.TryGetProperty("printStatus", out var kps) && kps.ValueKind != System.Text.Json.JsonValueKind.Null ? kps.GetString() ?? "QUEUED" : "QUEUED";
                            if (kotEl.TryGetProperty("businessDate", out var kbd) && kbd.ValueKind != System.Text.Json.JsonValueKind.Null) kot.BusinessDate = kbd.GetDateTime();
                            if (kotEl.TryGetProperty("createdAt", out var kcrt) && kcrt.ValueKind != System.Text.Json.JsonValueKind.Null) kot.CreatedAt = kcrt.GetDateTime();
                            
                            // Prevent duplicate prints for KOTs that sync down by forcing print status to completed
                            // if they are already printed on the server, unless they were just fired
                            if (kot.PrintStatus == "QUEUED" && kot.Status != "PENDING") {
                                kot.PrintStatus = "COMPLETED";
                            }
                        }
                        var kotsToRemove = order.Kots.Where(k => !incomingKotIds.Contains(k.Id)).ToList();
                        foreach(var k in kotsToRemove) order.Kots.Remove(k);
                    }
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
                    if (task != null && task.IsDirty) continue;

                    if (task == null)
                    {
                        task = new LodgeCore.Desktop.Data.Entities.LocalHousekeepingTask { Id = id, PropertyId = propertyId };
                        dbContext.HousekeepingTasks.Add(task);
                    }
                    task.PropertyId = propertyId;
                    task.RoomId = el.TryGetProperty("roomId", out var rid) && rid.ValueKind != System.Text.Json.JsonValueKind.Null ? rid.GetString() ?? "" : "";
                    task.TaskType = el.TryGetProperty("type", out var typ) && typ.ValueKind != System.Text.Json.JsonValueKind.Null ? typ.GetString() ?? "" : (el.TryGetProperty("taskType", out var taskType) ? taskType.GetString() ?? "" : "");
                    task.Status = el.TryGetProperty("status", out var st) && st.ValueKind != System.Text.Json.JsonValueKind.Null ? st.GetString() ?? "" : "";
                    if (task.Status is "PENDING" or "ASSIGNED" or "CLEAN") task.Status = "CLEANING";
                    var room = await dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == task.RoomId, stoppingToken);
                    if (room != null)
                    {
                        task.RoomNumber = room.Number ?? "";
                    }
                }

                if (housekeepingTasksArray.GetArrayLength() > 0)
                {
                    var stale = await dbContext.HousekeepingTasks.Where(t => !incomingIds.Contains(t.Id)).ToListAsync(stoppingToken);
                    if (stale.Any() && !isIncremental) dbContext.HousekeepingTasks.RemoveRange(stale);
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
                    if (ticket != null && ticket.IsDirty) continue;

                    if (ticket == null)
                    {
                        ticket = new LodgeCore.Desktop.Data.Entities.LocalMaintenanceTicket { Id = id, PropertyId = propertyId };
                        dbContext.MaintenanceTickets.Add(ticket);
                    }
                    ticket.PropertyId = propertyId;
                    ticket.RoomId = el.TryGetProperty("roomId", out var rid) && rid.ValueKind != System.Text.Json.JsonValueKind.Null ? rid.GetString() ?? "" : "";
                    ticket.RoomNumber = el.TryGetProperty("roomNumber", out var roomNumber) && roomNumber.ValueKind != System.Text.Json.JsonValueKind.Null
                        ? roomNumber.GetString() ?? ""
                        : el.TryGetProperty("location", out var location) && location.ValueKind != System.Text.Json.JsonValueKind.Null
                            ? location.GetString() ?? ""
                            : "";
                    if (string.IsNullOrWhiteSpace(ticket.RoomNumber) && !string.IsNullOrWhiteSpace(ticket.RoomId))
                    {
                        ticket.RoomNumber = await dbContext.Rooms
                            .Where(room => room.Id == ticket.RoomId)
                            .Select(room => room.Number)
                            .FirstOrDefaultAsync(stoppingToken) ?? "";
                    }
                    var title = el.TryGetProperty("title", out var tEl) && tEl.ValueKind != System.Text.Json.JsonValueKind.Null ? tEl.GetString() ?? "" : "";
                    var desc = el.TryGetProperty("description", out var dEl) && dEl.ValueKind != System.Text.Json.JsonValueKind.Null ? dEl.GetString() ?? "" : "";
                    ticket.IssueDescription = $"{title} - {desc}".Trim();
                    ticket.Status = el.TryGetProperty("status", out var st) && st.ValueKind != System.Text.Json.JsonValueKind.Null ? st.GetString() ?? "" : "";
                    
                    ticket.Priority = el.TryGetProperty("priority", out var pri) && pri.ValueKind != System.Text.Json.JsonValueKind.Null ? pri.GetString() ?? "NORMAL" : "NORMAL";
                    
                    ticket.RequiresRoomRestriction = ticket.Status == "IN_PROGRESS" || ticket.Status == "OPEN"; 
                }

                if (maintenanceTicketsArray.GetArrayLength() > 0)
                {
                    var stale = await dbContext.MaintenanceTickets.Where(t => t.PropertyId == propertyId && !incomingIds.Contains(t.Id)).ToListAsync(stoppingToken);
                    if (stale.Any() && !isIncremental) dbContext.MaintenanceTickets.RemoveRange(stale);
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

                if (!string.IsNullOrEmpty(nextCursor))
                {
                    Preferences.Set($"LastPull_{propertyId}", nextCursor);
                }
            }
            catch (Exception ex)
            {
                throw new Exception($"Failed to apply sync page {pageCount}: {ex.Message}", ex);
            }
        }
        
        // Clean up stale reservations locally (that fell out of the active window)
        var threeDaysAgo = DateTime.UtcNow.AddDays(-3);
        var oldReservations = await dbContext.Reservations
            .Where(r => !r.IsDirty && (r.CheckOutDate < threeDaysAgo || r.Status == "CANCELLED" || r.Status == "NO_SHOW"))
            .ToListAsync(stoppingToken);
        if (oldReservations.Any())
        {
            dbContext.Reservations.RemoveRange(oldReservations);
            await dbContext.SaveChangesAsync(stoppingToken);
        }
    }

    private async Task SyncRefundStatusesAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();
        var identity = await GetSyncIdentityAsync(stoppingToken);
        if (identity == null) return;
        var token = await GetActiveTokenAsync();
        if (string.IsNullOrEmpty(token)) return;
        _httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        var response = await _httpClient.GetAsync($"refund-requests?propertyId={Uri.EscapeDataString(identity.PropertyId)}", stoppingToken);
        if (!response.IsSuccessStatusCode) return;
        using var document = System.Text.Json.JsonDocument.Parse(await response.Content.ReadAsStringAsync(stoppingToken));
        if (!document.RootElement.TryGetProperty("data", out var data) || data.ValueKind != System.Text.Json.JsonValueKind.Array) return;
        var statuses = new List<LocalRefundRequest>();
        foreach (var item in data.EnumerateArray())
        {
            decimal.TryParse(item.GetProperty("requestedAmount").ToString(), out var requestedAmount);
            decimal? approvedAmountValue = null;
            if (item.TryGetProperty("approvedAmount", out var approvedAmountElement) && approvedAmountElement.ValueKind != System.Text.Json.JsonValueKind.Null && decimal.TryParse(approvedAmountElement.ToString(), out var parsedApprovedAmount)) approvedAmountValue = parsedApprovedAmount;
            statuses.Add(new LocalRefundRequest
            {
                Id = item.GetProperty("id").GetString() ?? string.Empty,
                PropertyId = item.GetProperty("propertyId").GetString() ?? identity.PropertyId,
                ReservationId = item.TryGetProperty("reservationId", out var reservationId) && reservationId.ValueKind != System.Text.Json.JsonValueKind.Null ? reservationId.GetString() ?? string.Empty : string.Empty,
                FolioId = item.GetProperty("folioId").GetString() ?? string.Empty,
                PaymentId = item.GetProperty("paymentId").GetString() ?? string.Empty,
                RequestedAmount = requestedAmount,
                ApprovedAmount = approvedAmountValue,
                Currency = item.GetProperty("currency").GetString() ?? "NGN",
                RequestedMethod = item.TryGetProperty("requestedMethod", out var requestedMethod) ? requestedMethod.GetString() ?? "ORIGINAL_PAYMENT" : "ORIGINAL_PAYMENT",
                ApprovedMethod = item.TryGetProperty("approvedMethod", out var approvedMethod) && approvedMethod.ValueKind != System.Text.Json.JsonValueKind.Null ? approvedMethod.GetString() : null,
                Category = item.GetProperty("category").GetString() ?? string.Empty,
                Reason = item.GetProperty("reason").GetString() ?? string.Empty,
                Status = item.GetProperty("status").GetString() ?? "PENDING_APPROVAL",
                CurrentApprovalStep = item.TryGetProperty("currentApprovalStep", out var step) ? step.GetInt32() : 1,
                CreatedAt = item.TryGetProperty("createdAt", out var created) && DateTime.TryParse(created.GetString(), out var createdAt) ? createdAt : DateTime.UtcNow,
                UpdatedAt = item.TryGetProperty("updatedAt", out var updated) && DateTime.TryParse(updated.GetString(), out var updatedAt) ? updatedAt : DateTime.UtcNow
            });
            var incomingRequest = statuses[^1];
            if (item.TryGetProperty("idempotencyKey", out var incomingKey)) incomingRequest.IdempotencyKey = incomingKey.GetString() ?? incomingRequest.Id;
        }
        await new LocalRepository(dbContext).UpsertRefundRequestsAsync(statuses, identity.PropertyId);
    }

    private async Task PushFrontDeskOutboxAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

        var staleProcessingCutoff = DateTime.UtcNow.AddMinutes(-2);
        var staleProcessing = await dbContext.OutboxEvents
            .Where(e => e.Status == "PROCESSING" && (e.LastAttemptAt == null || e.LastAttemptAt < staleProcessingCutoff))
            .ToListAsync(stoppingToken);
        if (staleProcessing.Any())
        {
            foreach (var evt in staleProcessing)
            {
                evt.Status = "FAILED";
                evt.LastError = "Recovered a stale processing attempt; retry scheduled.";
                evt.NextAttemptAt = DateTime.UtcNow;
            }
            await dbContext.SaveChangesAsync(stoppingToken);
            _logger.LogWarning("[PUSH-FD] Recovered {StaleCount} stale PROCESSING event(s).", staleProcessing.Count);
        }

        var allPending = await dbContext.OutboxEvents
            .Where(e => e.Status == "PENDING" || e.Status == "FAILED" || e.Status == "RETRY_EXHAUSTED" || e.Status == "CONFLICT")
            .ToListAsync(stoppingToken);

        _logger.LogInformation("[PUSH-FD] Queue inspection found {PendingCount} pending/failed/conflict event(s).", allPending.Count);
        if (!allPending.Any()) return;
        
        var identity = await GetSyncIdentityAsync(stoppingToken);
        if (identity == null) 
        {
            _logger.LogWarning("[PUSH-FD] Skipping push: identity is null (no propertyId or session).");
            await MarkFrontDeskEventsRetryableAsync(dbContext, allPending, "Desktop identity is not ready; sign in or provision the terminal.", stoppingToken);
            return;
        }
        _logger.LogInformation($"[PUSH-FD] Identity resolved. PropertyId={identity.PropertyId} DeviceId={identity.DeviceId} TerminalId={identity.TerminalId}");
        
        var token = await GetActiveTokenAsync();
        if (string.IsNullOrEmpty(token)) 
        {
            _logger.LogWarning("[PUSH-FD] Skipping push: no device credential token found. Device may need to be re-provisioned.");
            await MarkFrontDeskEventsRetryableAsync(dbContext, allPending, "No device credential token available; re-provision the terminal.", stoppingToken);
            return;
        }
        _logger.LogInformation($"[PUSH-FD] Token acquired. Length={token.Length}, Prefix={token.Substring(0, Math.Min(8, token.Length))}...");

        var eventsToPush = new List<LocalOutboxEvent>();
        await RefreshResolvedFrontDeskConflictsAsync(dbContext, identity, token, allPending, stoppingToken);
        allPending.RemoveAll(e => e.Status == "RESOLVED");
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

        if (!pendingEvents.Any()) 
        {
            _logger.LogInformation("[PUSH-FD] No eligible outbox events to push. QueueCount={QueueCount}", allPending.Count);
            return;
        }
        
        _logger.LogInformation($"[PUSH-FD] {pendingEvents.Count} events ready to push. Types: {string.Join(", ", pendingEvents.Select(e => $"{e.AggregateType}/{e.EventType}").Distinct())}");
        foreach (var e in pendingEvents)
        {
            _logger.LogDebug($"[PUSH-FD-EVENT] id={e.Id} idempotencyKey={e.IdempotencyKey} type={e.AggregateType}/{e.EventType} aggregateId={e.AggregateId} attempts={e.AttemptCount} status={e.Status} lastError={e.LastError}");
        }

        _lastPushAttemptAt = DateTime.UtcNow;
        _lastPushEndpoint = $"{_httpClient.BaseAddress}sync/push/frontdesk";
        _lastPushBatchSize = pendingEvents.Count;
        _lastPushHttpStatus = null;
        foreach (var e in pendingEvents)
        {
            e.Status = "PROCESSING";
            e.AttemptCount++;
            e.LastAttemptAt = _lastPushAttemptAt;
            e.LastError = null;
        }
        // Persist before network I/O so a crash or timeout cannot appear as Attempts: 0.
        await dbContext.SaveChangesAsync(stoppingToken);

        _logger.LogInformation($"Pushing {pendingEvents.Count} Front Desk outbox events to cloud...");
        BroadcastHealth(SyncState.SYNCING, null, "PUSH_FD", 0, pendingEvents.Count, "Pushing Front Desk events...");

        try
        {
            var requestUrl = "sync/push/frontdesk";
            using var request = new HttpRequestMessage(HttpMethod.Post, requestUrl);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            request.Headers.Add("Idempotency-Key", $"batch_{Guid.NewGuid()}");

            _logger.LogInformation($"[PUSH-FD] Sending POST to {_httpClient.BaseAddress}{requestUrl} with {pendingEvents.Count} events");

            var payload = new
            {
                propertyId = identity.PropertyId,
                deviceId = identity.DeviceId,
                events = pendingEvents.Select(e => new
                {
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
            using var requestTimeout = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            requestTimeout.CancelAfter(TimeSpan.FromSeconds(30));
            var response = await _httpClient.SendAsync(request, requestTimeout.Token);
            _lastPushHttpStatus = (int)response.StatusCode;
            _logger.LogInformation($"[PUSH-FD] Server responded: HTTP {(int)response.StatusCode} {response.StatusCode}");
            
            if (response.IsSuccessStatusCode)
            {
                var rawBody = await response.Content.ReadAsStringAsync(stoppingToken);
                _logger.LogDebug($"[PUSH-FD] Success response body: {rawBody}");
                SyncPushFrontDeskResponse? result = null;
                try { result = System.Text.Json.JsonSerializer.Deserialize<SyncPushFrontDeskResponse>(rawBody, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }); }
                catch (Exception parseEx) { _logger.LogError(parseEx, "[PUSH-FD] Failed to parse server response JSON."); }
                if (result != null && result.Status == "SUCCESS" && result.Results != null)
                {
                    _logger.LogInformation($"[PUSH-FD] Server accepted batch. Processing {result.Results.Count} result(s).");
                    var resultIds = result.Results.Select(res => res.Id).ToHashSet();
                    foreach (var res in result.Results)
                    {
                        var evt = pendingEvents.FirstOrDefault(e => e.Id == res.Id);
                        if (evt != null)
                        {
                            _logger.LogInformation($"[PUSH-FD-RESULT] event={evt.AggregateType}/{evt.EventType} id={evt.Id} → status={res.Status} error={res.Error}");
                            evt.Status = res.Status; 
                            evt.LastError = res.Error;
                            
                            if (res.Status == "SYNCED" || res.Status == "PENDING_APPROVAL")
                            {
                                if (res.Status == "SYNCED") evt.SyncedAt = DateTime.UtcNow;
                                evt.NextAttemptAt = null;
                                ClearIsDirtyIfSafe(dbContext, evt);
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
                    foreach (var evt in pendingEvents.Where(evt => !resultIds.Contains(evt.Id)))
                    {
                        evt.Status = "FAILED";
                        evt.LastError = "Cloud accepted the request but did not return a result for this event.";
                        evt.LastAttemptAt = DateTime.UtcNow;
                        evt.NextAttemptAt = DateTime.UtcNow.AddSeconds(30);
                        _logger.LogWarning("[PUSH-FD] Response omitted result for event {EventId}.", evt.Id);
                    }
                    await dbContext.SaveChangesAsync(stoppingToken);
                }
                else
                {
                    var responseSummary = FormatPushError(rawBody);
                    _logger.LogWarning($"[PUSH-FD] Server returned success but response had unexpected shape: Status={result?.Status} ResultCount={result?.Results?.Count ?? -1}. Raw: {responseSummary}");
                    foreach (var evt in pendingEvents)
                    {
                        evt.Status = "FAILED";
                        evt.LastError = $"Cloud returned an unexpected push response: {responseSummary}";
                        evt.LastAttemptAt = DateTime.UtcNow;
                        evt.NextAttemptAt = DateTime.UtcNow.AddSeconds(30);
                    }
                    await dbContext.SaveChangesAsync(stoppingToken);
                }
            }
            else
            {
                var errorBody = await response.Content.ReadAsStringAsync(stoppingToken);
                int statusCode = (int)response.StatusCode;
                _logger.LogWarning($"[PUSH-FD] Push FAILED. HTTP {statusCode}. Response body: {errorBody}");
                
                // Specific HTTP Failure Classifications
                if (statusCode == 401 || statusCode == 403)
                {
                    if (await TryRefreshDeviceTokenAsync(stoppingToken))
                    {
                        foreach (var evt in pendingEvents)
                        {
                            evt.Status = "FAILED";
                            evt.LastError = $"HTTP {statusCode}: device token refreshed; retry scheduled. {FormatPushError(errorBody)}";
                            evt.LastAttemptAt = DateTime.UtcNow;
                            evt.NextAttemptAt = DateTime.UtcNow.AddSeconds(30);
                        }
                        await dbContext.SaveChangesAsync(stoppingToken);
                        return; // Retry on next loop
                    }
                    // Authentication/Authorization: Pause sync loop, don't increment attempt count
                    BroadcastHealth(SyncState.ERROR, null, "AUTH_ERROR", 0, 1, $"Auth failed: {statusCode}. Please re-authenticate.");
                    throw new Exception($"Auth failed: {statusCode}. Please re-authenticate. {FormatPushError(errorBody)}");
                }

                foreach (var evt in pendingEvents) 
                { 
                    if (statusCode == 400 || statusCode == 422)
                    {
                        // Malformed Event / Invalid Schema
                        evt.Status = "DEAD_LETTER";
                        evt.LastError = $"HTTP {statusCode}: Malformed or invalid event payload. {FormatPushError(errorBody)}";
                        evt.NextAttemptAt = null;
                    }
                    else if (statusCode == 409)
                    {
                        // Version Conflict / Optimistic Concurrency Failure
                        evt.Status = "CONFLICT";
                        evt.LastError = $"HTTP 409: Concurrency conflict. {FormatPushError(errorBody)}";
                        evt.NextAttemptAt = null;
                    }
                    else 
                    {
                        // 429, 500, 502, 503, 504: Transient Network or Server Error -> Retry
                        evt.LastError = $"HTTP {statusCode}: {FormatPushError(errorBody)}";
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
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error pushing Front Desk outbox events.");
            var error = FormatPushError(ex.ToString());
            foreach (var evt in pendingEvents) 
            { 
                evt.Status = "FAILED"; 
                evt.LastError = error;
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
            await dbContext.SaveChangesAsync(stoppingToken);
            throw;
        }
    }

    private async Task RefreshResolvedFrontDeskConflictsAsync(
        LocalDbContext dbContext,
        SyncIdentity identity,
        string token,
        List<LocalOutboxEvent> events,
        CancellationToken stoppingToken)
    {
        var conflictedEvents = events.Where(e => e.Status == "CONFLICT").ToList();
        if (!conflictedEvents.Any()) return;

        var eventIds = string.Join(",", conflictedEvents.Select(e => Uri.EscapeDataString(e.Id)));
        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            $"sync/conflicts/status?propertyId={Uri.EscapeDataString(identity.PropertyId)}&eventIds={eventIds}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await _httpClient.SendAsync(request, stoppingToken);
        if (!response.IsSuccessStatusCode) return;

        var body = await response.Content.ReadAsStringAsync(stoppingToken);
        using var document = JsonDocument.Parse(body);
        if (!document.RootElement.TryGetProperty("resolutions", out var resolutions)) return;

        foreach (var resolution in resolutions.EnumerateArray())
        {
            var eventId = resolution.GetProperty("eventId").GetString();
            var evt = conflictedEvents.FirstOrDefault(e => e.Id == eventId);
            if (evt == null) continue;

            evt.Status = "RESOLVED";
            evt.NextAttemptAt = null;
            evt.SyncedAt = DateTime.UtcNow;
            evt.LastError = $"Resolved on server: {resolution.GetProperty("resolution").GetString() ?? "MANAGER_REVIEW"}";
            ClearIsDirtyIfSafe(dbContext, evt);
        }
    }

    private async Task MarkFrontDeskEventsRetryableAsync(
        LocalDbContext dbContext,
        IEnumerable<LocalOutboxEvent> events,
        string reason,
        CancellationToken stoppingToken)
    {
        var now = DateTime.UtcNow;
        foreach (var evt in events.Where(e => e.Status != "CONFLICT"))
        {
            evt.Status = "FAILED";
            evt.AttemptCount++;
            evt.LastAttemptAt = now;
            evt.NextAttemptAt = now.AddSeconds(30);
            evt.LastError = reason;
        }

        await dbContext.SaveChangesAsync(stoppingToken);
        BroadcastHealth(SyncState.ERROR, reason, "PUSH_FD", 0, events.Count(), reason);
    }

    private static string FormatPushError(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return "No additional error details returned.";

        var normalized = value.Replace("\r", " ").Replace("\n", " ").Trim();
        return normalized.Length <= 1000 ? normalized : normalized[..1000] + "...";
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
        var identity = await GetSyncIdentityAsync(stoppingToken);
        if (identity == null) return false;
        
        var token = _credentialStorage.LoadCredential("deviceCredential");
        if (string.IsNullOrEmpty(token)) return false;

        try
        {
            var request = new HttpRequestMessage(HttpMethod.Post, "device/refresh");
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            request.Content = JsonContent.Create(new { propertyId = identity.PropertyId });
            
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
        
        var identity = await GetSyncIdentityAsync(stoppingToken);
        if (identity == null) return;
        
        var token = await GetActiveTokenAsync();
        if (string.IsNullOrEmpty(token)) return;

        bool hasMore = true;
        int pageCount = 0;
        
        while (hasMore && !stoppingToken.IsCancellationRequested)
        {
            var meta = await dbContext.SyncMetadata.FirstOrDefaultAsync(stoppingToken);
            var cursor = meta?.LastGuestSyncCursor;
            
            var url = $"sync/guests?propertyId={identity.PropertyId}&limit=500";
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
                                OrganizationId = el.TryGetProperty("organizationId", out var org) && org.ValueKind != System.Text.Json.JsonValueKind.Null ? org.GetString() ?? "" : "",
                                FirstName = el.TryGetProperty("firstName", out var fn) && fn.ValueKind != System.Text.Json.JsonValueKind.Null ? fn.GetString() ?? "" : "",
                                LastName = el.TryGetProperty("lastName", out var ln) && ln.ValueKind != System.Text.Json.JsonValueKind.Null ? ln.GetString() ?? "" : "",
                                Email = el.TryGetProperty("email", out var em) && em.ValueKind != System.Text.Json.JsonValueKind.Null ? em.GetString() : null,
                                Phone = el.TryGetProperty("phone", out var ph) && ph.ValueKind != System.Text.Json.JsonValueKind.Null ? ph.GetString() : null,
                                CompanyName = el.TryGetProperty("companyName", out var cn) && cn.ValueKind != System.Text.Json.JsonValueKind.Null ? cn.GetString() : null,
                                IsVip = el.TryGetProperty("isVip", out var vip) && vip.ValueKind != System.Text.Json.JsonValueKind.Null && vip.GetBoolean(),
                                Version = el.TryGetProperty("version", out var ver) && ver.ValueKind == System.Text.Json.JsonValueKind.Number ? ver.GetInt32() : 1
                            };
                            
                            if (el.TryGetProperty("updatedAt", out var ua) && ua.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(ua.GetString(), out var uad)) g.UpdatedAt = uad;
                            if (el.TryGetProperty("deletedAt", out var da) && da.ValueKind != System.Text.Json.JsonValueKind.Null && DateTime.TryParse(da.GetString(), out var dad)) g.DeletedAt = dad;
                            
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

    private static decimal ReadDecimal(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var value) ? ReadDecimal(value) : 0m;
    }

    private static decimal ReadDecimal(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var number)) return number;
        return value.ValueKind == JsonValueKind.String && decimal.TryParse(value.GetString(), out var parsed) ? parsed : 0m;
    }

    private void ClearIsDirtyIfSafe(LocalDbContext dbContext, LodgeCore.Desktop.Data.Entities.LocalOutboxEvent evt)
    {
        if (evt.AggregateType == "RESERVATION")
        {
            var res = dbContext.Reservations.Local.FirstOrDefault(x => x.Id == evt.AggregateId)
                      ?? dbContext.Reservations.FirstOrDefault(x => x.Id == evt.AggregateId);
            if (res != null && res.LocalSequence == evt.Sequence) res.IsDirty = false;
        }
        else if (evt.AggregateType == "FOLIO")
        {
            var folio = dbContext.Folios.Local.FirstOrDefault(x => x.Id == evt.AggregateId)
                        ?? dbContext.Folios.FirstOrDefault(x => x.Id == evt.AggregateId);
            if (folio != null && folio.LocalSequence == evt.Sequence) folio.IsDirty = false;
        }
        else if (evt.AggregateType == "HOUSEKEEPING_TASK")
        {
            var task = dbContext.HousekeepingTasks.Local.FirstOrDefault(x => x.Id == evt.AggregateId)
                       ?? dbContext.HousekeepingTasks.FirstOrDefault(x => x.Id == evt.AggregateId);
            if (task != null && task.Version == evt.Sequence) task.IsDirty = false;
        }
        else if (evt.AggregateType == "MAINTENANCE_TICKET")
        {
            var ticket = dbContext.MaintenanceTickets.Local.FirstOrDefault(x => x.Id == evt.AggregateId)
                         ?? dbContext.MaintenanceTickets.FirstOrDefault(x => x.Id == evt.AggregateId);
            if (ticket != null && ticket.Version == evt.Sequence) ticket.IsDirty = false;
        }
        else if (evt.AggregateType == "GUEST")
        {
            var guest = dbContext.Guests.Local.FirstOrDefault(x => x.Id == evt.AggregateId)
                        ?? dbContext.Guests.FirstOrDefault(x => x.Id == evt.AggregateId);
            if (guest != null && guest.Version == evt.Sequence) guest.IsDirty = false;
        }
    }
}

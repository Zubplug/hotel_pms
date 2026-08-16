using LodgeCore.LockAgent.Auth;
using LodgeCore.LockAgent.Commands;
using LodgeCore.LockAgent.Hardware;
using LodgeCore.LockAgent.Health;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LodgeCore.LockAgent;

/// <summary>
/// Main orchestrator BackgroundService.
/// 
/// Startup sequence:
///   1. Load config + credentials
///   2. Initialize LockSDK
///   3. Start USB hardware monitor
///   4. Start heartbeat service
///   5. Enter poll loop (every PollIntervalMs)
/// 
/// The service does NOT stop if the USB encoder is unplugged.
/// It reports hardwareStatus = DEGRADED and waits for reconnect.
/// </summary>
public sealed class Worker : BackgroundService
{
    private readonly AgentConfig _config;
    private readonly AgentAuthenticator _auth;
    private readonly ILockProvider _lockProvider;
    private readonly CommandWorker _commandWorker;
    private readonly HeartbeatService _heartbeat;
    private readonly HardwareMonitor _hardwareMonitor;
    private readonly PmsClient _pms;
    private readonly ILogger<Worker> _logger;

    public Worker(
        AgentConfig config,
        AgentAuthenticator auth,
        ILockProvider lockProvider,
        CommandWorker commandWorker,
        HeartbeatService heartbeat,
        HardwareMonitor hardwareMonitor,
        PmsClient pms,
        ILogger<Worker> logger)
    {
        _config          = config;
        _auth            = auth;
        _lockProvider    = lockProvider;
        _commandWorker   = commandWorker;
        _heartbeat       = heartbeat;
        _hardwareMonitor = hardwareMonitor;
        _pms             = pms;
        _logger          = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _logger.LogInformation("LodgeCore Lock Agent starting...");

        // 1. Load credentials from Windows Credential Manager
        var cred = _auth.Load();
        if (cred is null)
        {
            _logger.LogCritical("No credentials found. Run --enroll first.");
            return;
        }
        _logger.LogInformation("Agent ID: {AgentId}", cred.AgentId);

        // 2. Initialize LockSDK
        _logger.LogInformation("Initializing LockSDK (type={Type}, port={Port})",
            _config.SdkLockType, _config.ComPort);

        var init = await _lockProvider.InitAsync(_config.SdkLockType, _config.ComPort);
        if (init.Success)
        {
            _heartbeat.SetReady();
            _logger.LogInformation("LockSDK ready");
        }
        else
        {
            _heartbeat.SetDegraded();
            _logger.LogWarning("LockSDK init failed: {Error} — hardware DEGRADED, polling continues", init.VendorMessage);
        }

        // 3. Wire up USB monitor
        _hardwareMonitor.HardwareStatusChanged += (_, status) =>
            _heartbeat.UpdateHardwareStatus(status);
        _hardwareMonitor.Start();

        // 4. Heartbeat runs as its own BackgroundService — no need to start manually

        _logger.LogInformation("Entering poll loop (interval {Ms}ms)", _config.PollIntervalMs);

        // 5. Command poll loop
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await _commandWorker.TickAsync(ct);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error in poll tick");
            }

            await Task.Delay(_config.PollIntervalMs, ct).ContinueWith(_ => { }, ct);
        }

        // Shutdown
        await _lockProvider.ShutdownAsync();
        _hardwareMonitor.Dispose();
        _logger.LogInformation("LodgeCore Lock Agent stopped");
    }
}

using LodgeCore.LockAgent.Commands;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace LodgeCore.LockAgent.Health;

/// <summary>
/// Sends a heartbeat to the PMS every HeartbeatIntervalMs (default 15s).
/// Reports the current hardware status (READY / DEGRADED / OFFLINE / UNKNOWN).
/// Runs independently of the command poll loop.
/// </summary>
public sealed class HeartbeatService : BackgroundService
{
    private readonly PmsClient _pms;
    private readonly AgentConfig _config;
    private readonly ILogger<HeartbeatService> _logger;

    private volatile string _hardwareStatus = "UNKNOWN";

    public HeartbeatService(PmsClient pms, AgentConfig config, ILogger<HeartbeatService> logger)
    {
        _pms    = pms;
        _config = config;
        _logger = logger;
    }

    /// <summary>Called by HardwareMonitor when USB events fire.</summary>
    public void UpdateHardwareStatus(string status)
    {
        _hardwareStatus = status;
        _logger.LogInformation("Hardware status updated → {Status}", status);
    }

    public void SetReady()    => UpdateHardwareStatus("READY");
    public void SetDegraded() => UpdateHardwareStatus("DEGRADED");

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        _logger.LogInformation("Heartbeat service started (interval {Ms}ms)", _config.HeartbeatIntervalMs);

        while (!ct.IsCancellationRequested)
        {
            await Task.Delay(_config.HeartbeatIntervalMs, ct);

            try
            {
                await _pms.HeartbeatAsync(_hardwareStatus, ct);
                _logger.LogDebug("Heartbeat sent — hardwareStatus={Status}", _hardwareStatus);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Heartbeat error");
            }
        }
    }
}

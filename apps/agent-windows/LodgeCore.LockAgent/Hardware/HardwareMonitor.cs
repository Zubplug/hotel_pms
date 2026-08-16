using System.Management;
using Microsoft.Extensions.Logging;

namespace LodgeCore.LockAgent.Hardware;

/// <summary>
/// Monitors USB device plug/unplug events via WMI.
/// When the encoder is disconnected, raises HardwareStatusChanged(DEGRADED).
/// When it reconnects, re-initialises the SDK and raises HardwareStatusChanged(READY).
/// 
/// The agent Windows Service itself never stops due to USB loss.
/// </summary>
public sealed class HardwareMonitor : IDisposable
{
    private readonly ILockProvider _lockProvider;
    private readonly AgentConfig _config;
    private readonly ILogger<HardwareMonitor> _logger;

    private ManagementEventWatcher? _connectWatcher;
    private ManagementEventWatcher? _disconnectWatcher;

    public event EventHandler<string>? HardwareStatusChanged; // "READY" | "DEGRADED"

    public HardwareMonitor(ILockProvider lockProvider, AgentConfig config, ILogger<HardwareMonitor> logger)
    {
        _lockProvider = lockProvider;
        _config       = config;
        _logger       = logger;
    }

    public void Start()
    {
        try
        {
            // Watch for USB device connections
            _connectWatcher = new ManagementEventWatcher(
                new WqlEventQuery("SELECT * FROM Win32_DeviceChangeEvent WHERE EventType = 2"));
            _connectWatcher.EventArrived += OnDeviceConnected;
            _connectWatcher.Start();

            // Watch for USB device disconnections
            _disconnectWatcher = new ManagementEventWatcher(
                new WqlEventQuery("SELECT * FROM Win32_DeviceChangeEvent WHERE EventType = 3"));
            _disconnectWatcher.EventArrived += OnDeviceDisconnected;
            _disconnectWatcher.Start();

            _logger.LogInformation("USB hardware monitor started");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not start USB WMI monitor — hardware plug/unplug events will not be detected");
        }
    }

    private async void OnDeviceConnected(object sender, EventArrivedEventArgs e)
    {
        _logger.LogInformation("USB device connected — attempting SDK re-initialization");
        await Task.Delay(1500); // brief settle time for driver load

        var init = await _lockProvider.InitAsync(_config.SdkLockType, _config.ComPort);
        if (init.Success)
        {
            _logger.LogInformation("SDK re-initialized after USB connect → READY");
            HardwareStatusChanged?.Invoke(this, "READY");
        }
        else
        {
            _logger.LogWarning("SDK re-initialization failed after USB connect: {Error}", init.VendorMessage);
        }
    }

    private void OnDeviceDisconnected(object sender, EventArrivedEventArgs e)
    {
        _logger.LogWarning("USB device disconnected → hardware DEGRADED");
        HardwareStatusChanged?.Invoke(this, "DEGRADED");
    }

    public void Dispose()
    {
        _connectWatcher?.Stop();
        _connectWatcher?.Dispose();
        _disconnectWatcher?.Stop();
        _disconnectWatcher?.Dispose();
    }
}

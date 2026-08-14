using LodgeCore.LockAgent;
using LodgeCore.LockAgent.Auth;
using LodgeCore.LockAgent.Commands;
using LodgeCore.LockAgent.Hardware;
using LodgeCore.LockAgent.Health;
using LodgeCore.LockAgent.Setup;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.EventLog;

// ── Enrollment mode ───────────────────────────────────────────────────────────
if (args.Contains("--enroll"))
{
    await EnrollmentWizard.RunAsync();
    return;
}

// ── Service mode ──────────────────────────────────────────────────────────────
AgentConfig config;
try
{
    config = AgentConfig.Load();
}
catch (FileNotFoundException ex)
{
    Console.Error.WriteLine($"ERROR: {ex.Message}");
    Console.Error.WriteLine("Run 'LodgeCore.LockAgent.exe --enroll' to configure the agent.");
    Environment.Exit(1);
    return;
}

var builder = Host.CreateApplicationBuilder(args);

// Windows Service support
builder.Services.AddWindowsService(options =>
    options.ServiceName = "LodgeCoreLockAgent");

// Windows Event Log
builder.Logging.AddEventLog(new EventLogSettings
{
    SourceName = "LodgeCore Lock Agent",
});

// Register config as singleton
builder.Services.AddSingleton(config);

// HTTP client
builder.Services.AddHttpClient<PmsClient>(client =>
{
    client.BaseAddress = new Uri(config.PmsUrl);
    client.Timeout     = TimeSpan.FromSeconds(30);
});

// Auth
builder.Services.AddSingleton<AgentAuthenticator>();

// Hardware
builder.Services.AddSingleton<ILockProvider, DelunsProvider>();
builder.Services.AddSingleton<HardwareMonitor>();

// Commands
builder.Services.AddSingleton<CommandWorker>();

// Health
builder.Services.AddSingleton<HeartbeatService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<HeartbeatService>());

// Main worker
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
await host.RunAsync();

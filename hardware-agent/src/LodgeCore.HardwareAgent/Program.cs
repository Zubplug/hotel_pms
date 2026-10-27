using LodgeCore.HardwareAgent;
using LodgeCore.HardwareAgent.Communication;
using LodgeCore.HardwareAgent.Commands;
using LodgeCore.HardwareAgent.Locks;
using LodgeCore.HardwareAgent.Security;
using LodgeCore.HardwareAgent.Hardware;
using Microsoft.Extensions.Options;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "LodgeCore Hardware Agent";
});

// Configure strongly typed settings
builder.Services.Configure<AgentSettings>(builder.Configuration.GetSection("AgentSettings"));

// Security & Storage
builder.Services.AddSingleton<CredentialStore>();

// Communication
builder.Services.AddSingleton<AgentAuthenticator>();
builder.Services.AddSingleton<WebSocketClient>();
builder.Services.AddHttpClient<LodgeCoreClient>();

// Commands
builder.Services.AddSingleton<CommandQueue>();
builder.Services.AddSingleton<CommandProcessor>();

// Locks & Hardware
builder.Services.AddSingleton<DelunsLockProvider>();
builder.Services.AddSingleton<HsLockProvider>();
builder.Services.AddSingleton<ProUsbLockProvider>();
// builder.Services.AddSingleton<HomeLockProvider>(); // if kept

builder.Services.AddSingleton<ILockProvider>(sp => 
{
    var settings = sp.GetRequiredService<IOptions<AgentSettings>>().Value;
    return settings.Provider?.ToUpperInvariant() switch
    {
        "PROUSB"     => sp.GetRequiredService<ProUsbLockProvider>(),
        "HSLOCK"     => sp.GetRequiredService<HsLockProvider>(),
        _            => sp.GetRequiredService<DelunsLockProvider>(),  // default / DELUNS
    };
});
builder.Services.AddSingleton<EncoderMonitor>();
builder.Services.AddSingleton<DeviceHealthMonitor>();

// Startup Diagnostics
builder.Services.AddHostedService<DiagnosticsWorker>();

// Main Background Service
builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();

using Microsoft.Extensions.Logging;
using LodgeCore.HardwareAgent.Locks;
using LodgeCore.Desktop.Data;
using Microsoft.EntityFrameworkCore;

namespace LodgeCore.Desktop;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
            });

        // Register Hardware Agent dependencies
        builder.Services.AddSingleton<ILockProvider>(sp =>
        {
            var loggerFactory = sp.GetRequiredService<ILoggerFactory>();
            // Retrieve configured provider, defaulting to Elock (Deluns)
            var providerType = Microsoft.Maui.Storage.Preferences.Default.Get("LockProviderType", "Elock");
            
            return providerType.ToLowerInvariant() switch
            {
                "hslock" => new HsLockProvider(loggerFactory.CreateLogger<HsLockProvider>()),
                _        => new DelunsLockProvider(loggerFactory.CreateLogger<DelunsLockProvider>()) // Elock is the default
            };
        });
        builder.Services.AddSingleton<HardwareInterop>();

        // Register Offline SQLite DB Context & Auto-Backup
        string dbPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LodgeCoreOffline.db");
        string backupPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LodgeCoreOffline_Backup.db");
        
        try 
        {
            if (File.Exists(dbPath))
            {
                File.Copy(dbPath, backupPath, overwrite: true);
            }
        }
        catch (Exception ex)
        {
            // Log backup failure but allow app to start
            System.Diagnostics.Debug.WriteLine($"DB Backup failed: {ex.Message}");
        }

        builder.Services.AddDbContext<LocalDbContext>(options => options.UseSqlite($"Data Source={dbPath}"));
        
        // Register Local Services & Sync Engine
        builder.Services.AddSingleton<LodgeCore.Desktop.Services.AuthManager>();
        builder.Services.AddTransient<LodgeCore.Desktop.Security.SessionManager>();
        builder.Services.AddTransient<LodgeCore.Desktop.Services.LocalRepository>();
        builder.Services.AddTransient<LodgeCore.Desktop.Services.ConflictResolver>();
        builder.Services.AddHostedService<LodgeCore.Desktop.Services.SyncEngine>();
        builder.Services.AddSingleton<LodgeCore.Desktop.Services.EscPosService>();
        builder.Services.AddHostedService<LodgeCore.Desktop.Services.KotPrintService>();
        builder.Services.AddSingleton<LodgeCore.Desktop.Services.DesktopServiceManager>();
        builder.Services.AddSingleton<OfflinePMSInterop>();
        builder.Services.AddSingleton(sp => 
        {
            var baseUrl = Environment.GetEnvironmentVariable("LODGECORE_API_URL") 
                          ?? Microsoft.Maui.Storage.Preferences.Default.Get("ApiBaseUrl", "https://hotel-pms-web-nine.vercel.app/api/v1/");

#if !DEBUG
            if (baseUrl.Contains("localhost") || baseUrl.Contains("127.0.0.1") || baseUrl.Contains("0.0.0.0"))
            {
                throw new Exception("Production builds cannot use development endpoints (localhost/127.0.0.1) for API URLs.");
            }
#endif

            // Ensure trailing slash for base address
            if (!baseUrl.EndsWith("/")) baseUrl += "/";

            return new HttpClient { BaseAddress = new Uri(baseUrl) };
        });
        builder.Services.AddSingleton<LodgeCore.Desktop.Services.ICredentialStorageService, LodgeCore.Desktop.Services.DpapiCredentialStorageService>();
        builder.Services.AddSingleton<LodgeCore.Desktop.Services.TerminalBootstrapService>();

#if DEBUG
        builder.Logging.AddDebug();
#endif

        var app = builder.Build();

        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<LocalDbContext>();
            db.Database.EnsureCreated();
        }

        return app;
    }
}

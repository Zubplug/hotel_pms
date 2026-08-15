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

        builder.Services.AddMauiBlazorWebView();

        // Register Hardware Agent dependencies
        builder.Services.AddSingleton<ILockProvider, DelunsLockProvider>(); // Assuming DelunsLockProvider is the implementation
        builder.Services.AddSingleton<HardwareInterop>();

        // Register Offline SQLite DB Context
        string dbPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LodgeCoreOffline.db");
        builder.Services.AddDbContext<LocalDbContext>(options => options.UseSqlite($"Data Source={dbPath}"));
        
        // Register Local Services & Sync Engine
        builder.Services.AddTransient<LodgeCore.Desktop.Services.LocalRepository>();
        builder.Services.AddHostedService<LodgeCore.Desktop.Services.SyncEngine>();
        builder.Services.AddSingleton<OfflinePMSInterop>();

#if DEBUG
        builder.Services.AddBlazorWebViewDeveloperTools();
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }
}

using Microsoft.Extensions.Logging;
using LodgeCore.HardwareAgent.Locks;

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

#if DEBUG
        builder.Services.AddBlazorWebViewDeveloperTools();
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }
}

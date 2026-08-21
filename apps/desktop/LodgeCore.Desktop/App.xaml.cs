using Microsoft.Extensions.DependencyInjection;

namespace LodgeCore.Desktop;

public partial class App : Application
{
    public App()
    {
        InitializeComponent();
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        var window = new Window(new SplashPage());

        try 
        {
            var serviceManager = activationState?.Context?.Services?.GetService<LodgeCore.Desktop.Services.DesktopServiceManager>();
            if (serviceManager != null)
            {
                // Start asynchronously without blocking window creation
                _ = serviceManager.StartAllAsync();

                // Hook shutdown lifecycle. LodgeCore currently enforces a single-window
                // application paradigm on Desktop, so Window.Destroying equates to App Exit.
                window.Destroying += (s, e) => 
                {
                    // Fire and forget the graceful shutdown sequence
                    _ = serviceManager.StopAllAsync();
                };
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to start DesktopServiceManager: {ex.Message}");
        }

        return window;
    }
}

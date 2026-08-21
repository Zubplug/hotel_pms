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

                // Hook shutdown lifecycle. 
                // NOTE: LodgeCore Desktop is currently a single-window application; 
                // the primary window's destruction represents full application shutdown.
                // If multi-window support is ever added, this lifecycle hook must be 
                // moved to an application-level event (e.g. Application.Current.Quit) 
                // to prevent closing one window from tearing down all background services.
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

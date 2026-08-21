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
            var hostedServices = activationState?.Context?.Services?.GetServices<Microsoft.Extensions.Hosting.IHostedService>();
            if (hostedServices != null)
            {
                foreach (var service in hostedServices)
                {
                    service.StartAsync(default);
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to start hosted services: {ex.Message}");
        }

        return window;
    }
}

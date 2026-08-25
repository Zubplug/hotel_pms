using Microsoft.Extensions.DependencyInjection;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace LodgeCore.Desktop;

public partial class App : Application
{
    public App()
    {
        InitializeComponent();
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        EnsureDesktopShortcut();
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

    private static void EnsureDesktopShortcut()
    {
        if (!OperatingSystem.IsWindows()) return;

        try
        {
            var desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            var shortcutPath = Path.Combine(desktopPath, "LodgeCore Front Desk.lnk");
            if (File.Exists(shortcutPath)) return;

            var executablePath = Process.GetCurrentProcess().MainModule?.FileName;
            if (string.IsNullOrWhiteSpace(executablePath)) return;

            var shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType == null) return;

            dynamic shell = Activator.CreateInstance(shellType)!;
            dynamic shortcut = shell.CreateShortcut(shortcutPath);
            shortcut.TargetPath = executablePath;
            shortcut.WorkingDirectory = Path.GetDirectoryName(executablePath);
            shortcut.Description = "LodgeCore Front Desk";
            shortcut.IconLocation = $"{executablePath},0";
            shortcut.Save();
            Marshal.FinalReleaseComObject(shortcut);
            Marshal.FinalReleaseComObject(shell);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"Could not create desktop shortcut: {ex.Message}");
        }
    }
}

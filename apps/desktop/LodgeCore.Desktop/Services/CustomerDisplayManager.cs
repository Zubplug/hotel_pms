using System.Runtime.InteropServices;
using Microsoft.Maui.Controls;

#if WINDOWS
using Microsoft.UI.Windowing;
using WinRT.Interop;
#endif

namespace LodgeCore.Desktop.Services;

public sealed class CustomerDisplayManager
{
    private readonly object _gate = new();
    private Window? _window;
    private CustomerDisplayProjection? _lastProjection;

    public bool IsEnabled => Microsoft.Maui.Storage.Preferences.Default.Get("CustomerDisplayEnabled", false);
    public bool IsOpen => _window != null;
    public bool HasSecondaryDisplay
    {
        get
        {
#if WINDOWS
            return Monitor.All().Count(monitor => !monitor.IsPrimary) > 0;
#else
            return false;
#endif
        }
    }

    public void SetEnabled(bool enabled)
    {
        Microsoft.Maui.Storage.Preferences.Default.Set("CustomerDisplayEnabled", enabled);
        if (!enabled) Close();
        else EnsureOpen();
    }

    public void Publish(CustomerDisplayProjection projection)
    {
        lock (_gate) _lastProjection = projection;
        if (!IsEnabled) return;
        EnsureOpen();
        if (_window?.Page is CustomerDisplayPage page) page.Apply(projection);
    }

    public void EnsureOpen()
    {
        if (!OperatingSystem.IsWindows() || !IsEnabled || !HasSecondaryDisplay || _window != null) return;
        MainThread.BeginInvokeOnMainThread(() =>
        {
            if (_window != null) return;
            var page = new CustomerDisplayPage();
            var window = new Window(page) { Title = "LodgeCore Customer Display" };
            window.Destroying += (_, _) => { lock (_gate) _window = null; };
            _window = window;
            Application.Current?.OpenWindow(window);
            window.Created += (_, _) => PositionOnSecondaryDisplay(window);
            if (_lastProjection != null) page.Apply(_lastProjection);
        });
    }

    public void Close()
    {
        var window = _window;
        if (window != null) Application.Current?.CloseWindow(window);
        _window = null;
    }

#if WINDOWS
    private static void PositionOnSecondaryDisplay(Window window)
    {
        try
        {
            if (window.Handler?.PlatformView is not Microsoft.UI.Xaml.Window nativeWindow) return;
            var hwnd = WindowNative.GetWindowHandle(nativeWindow);
            var appWindow = AppWindow.GetFromWindowId(Microsoft.UI.Win32Interop.GetWindowIdFromWindow(hwnd));
            var monitors = Monitor.All();
            var target = monitors.FirstOrDefault(m => !m.IsPrimary) ?? monitors.FirstOrDefault();
            if (target == null) return;
            appWindow.MoveAndResize(new Windows.Graphics.RectInt32(target.Left, target.Top, target.Width, target.Height));
            appWindow.SetPresenter(AppWindowPresenterKind.FullScreen);
        }
        catch { /* A missing/unavailable monitor falls back to a normal window. */ }
    }

    private sealed record Monitor(int Left, int Top, int Width, int Height, bool IsPrimary)
    {
        public static IEnumerable<Monitor> All()
        {
            var result = new List<Monitor>();
            EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr h, IntPtr deviceContext, ref RECT r, IntPtr data) =>
            {
                var info = new MONITORINFO { cbSize = Marshal.SizeOf<MONITORINFO>() };
                GetMonitorInfo(h, ref info);
                result.Add(new Monitor(r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top, (info.dwFlags & 1) != 0));
                return true;
            }, IntPtr.Zero);
            return result;
        }
        [DllImport("user32.dll")] private static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, MonitorEnum callback, IntPtr data);
        [DllImport("user32.dll")] private static extern bool GetMonitorInfo(IntPtr hMonitor, ref MONITORINFO lpmi);
        private delegate bool MonitorEnum(IntPtr h, IntPtr dc, ref RECT rect, IntPtr data);
        [StructLayout(LayoutKind.Sequential)] private struct RECT { public int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential)] private struct MONITORINFO { public int cbSize; public RECT rcMonitor, rcWork; public uint dwFlags; }
    }
#else
    private static void PositionOnSecondaryDisplay(Window window) { }
#endif
}

using Microsoft.Maui.ApplicationModel;

namespace LodgeCore.Desktop;

public partial class SplashPage : ContentPage
{
    public SplashPage()
    {
        InitializeComponent();
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        await RunSplashSequenceAsync();
    }

    private async Task RunSplashSequenceAsync()
    {
        // Step 1: Fade in main content
        await Task.WhenAll(
            ContentPanel.FadeToAsync(1, 500, Easing.CubicOut),
            ContentPanel.ScaleToAsync(1.0, 1, Easing.Default)
        );
        await Task.Delay(100);

        // Pulse the outer ring for a "breathing" effect
        _ = PulseRingAsync();

        // Step 2: Animate loading bar in stages with status text updates
        await AnimateLoadingAsync("Checking license...", 0, 60, 400);
        await AnimateLoadingAsync("Starting sync engine...", 60, 85, 500);
        await AnimateLoadingAsync("Loading modules...", 85, 100, 350);

        // Step 3: Fade in version footer
        await VersionPanel.FadeToAsync(1, 300, Easing.CubicOut);

        // Step 4: Brief hold at 100%
        await Task.Delay(600);

        // Step 5: Fade out gracefully and navigate
        await Task.WhenAll(
            ContentPanel.FadeToAsync(0, 400, Easing.CubicIn),
            VersionPanel.FadeToAsync(0, 400, Easing.CubicIn)
        );

        // Navigate to main page
        Application.Current!.Windows[0].Page = new NavigationPage(new MainPage())
        {
            BarBackgroundColor = Color.FromArgb("#0B1220"),
            BarTextColor = Colors.White
        };
    }

    private async Task AnimateLoadingAsync(string statusText, double fromPercent, double toPercent, uint durationMs)
    {
        StatusLabel.Text = statusText;

        const double maxWidth = 220.0;
        var fromWidth = maxWidth * fromPercent / 100.0;
        var toWidth = maxWidth * toPercent / 100.0;
        var steps = (int)(durationMs / 16); // ~60fps
        var stepMs = (int)(durationMs / steps);

        for (int i = 0; i <= steps; i++)
        {
            var t = (double)i / steps;
            // Ease-out cubic
            var eased = 1.0 - Math.Pow(1.0 - t, 3.0);
            var currentWidth = fromWidth + (toWidth - fromWidth) * eased;
            LoadingBar.WidthRequest = currentWidth;
            await Task.Delay(stepMs);
        }
    }

    private async Task PulseRingAsync()
    {
        while (true)
        {
            await OuterRing.ScaleToAsync(1.12, 1400, Easing.SinInOut);
            OuterRing.Opacity = 0.15;
            await OuterRing.ScaleToAsync(1.0, 1400, Easing.SinInOut);
            OuterRing.Opacity = 0.3;
        }
    }
}

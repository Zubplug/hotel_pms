using System.Text.Json;
using System.Text.Json.Nodes;

namespace LodgeCore.Desktop;

public partial class MainPage : ContentPage
{
    public MainPage()
    {
        InitializeComponent();

        // For now, load local dev server fallback
        // The build script will be updated to serve static assets locally
        MainWebView.Source = new UrlWebViewSource { Url = "http://localhost:3000/frontdesk" };
    }

    protected override void OnHandlerChanged()
    {
        base.OnHandlerChanged();
#if WINDOWS
        if (MainWebView.Handler?.PlatformView is Microsoft.UI.Xaml.Controls.WebView2 webView2)
        {
            InitializeWebView2(webView2);
        }
#endif
    }

#if WINDOWS
    private async void InitializeWebView2(Microsoft.UI.Xaml.Controls.WebView2 webView2)
    {
        await webView2.EnsureCoreWebView2Async();
        
        // Listen for postMessage JSON-RPC from the React frontend
        webView2.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;
    }

    private async void CoreWebView2_WebMessageReceived(Microsoft.UI.Xaml.Controls.WebView2 sender, Microsoft.Web.WebView2.Core.CoreWebView2WebMessageReceivedEventArgs args)
    {
        try
        {
            string messageStr = args.TryGetWebMessageAsString();
            if (string.IsNullOrEmpty(messageStr)) return;

            var request = JsonSerializer.Deserialize<JsonNode>(messageStr);
            if (request == null) return;

            string id = request["id"]?.ToString();
            string method = request["method"]?.ToString();
            var parameters = request["params"];

            if (string.IsNullOrEmpty(method) || string.IsNullOrEmpty(id)) return;

            // Lazy resolve interop services to ensure context is ready
            var pmsInterop = Application.Current?.MainPage?.Handler?.MauiContext?.Services.GetService<OfflinePMSInterop>();
            var hardwareInterop = Application.Current?.MainPage?.Handler?.MauiContext?.Services.GetService<HardwareInterop>();

            if (pmsInterop == null || hardwareInterop == null)
            {
                SendError(sender, id, "Interop services not ready.");
                return;
            }

            // Explicit Method Allowlist
            string responseData = null;

            switch (method)
            {
                case "hardware.readCard":
                    responseData = await hardwareInterop.ReadCardAsync();
                    break;
                case "hardware.encodeCard":
                    string lockCode = parameters?["lockCode"]?.ToString();
                    responseData = await hardwareInterop.EncodeCardAsync(lockCode);
                    break;
                case "hardware.cancelCard":
                    responseData = await hardwareInterop.CancelCardAsync();
                    break;
                case "reservations.get":
                    responseData = await pmsInterop.GetActiveReservationsAsync();
                    break;
                case "reservations.checkIn":
                    string resId = parameters?["reservationId"]?.ToString();
                    string userId = parameters?["userId"]?.ToString();
                    string deviceId = parameters?["deviceId"]?.ToString();
                    responseData = await pmsInterop.ProcessCheckInAsync(resId, userId, deviceId);
                    break;
                case "reservations.checkOut":
                    string outResId = parameters?["reservationId"]?.ToString();
                    string outUserId = parameters?["userId"]?.ToString();
                    string outDeviceId = parameters?["deviceId"]?.ToString();
                    responseData = await pmsInterop.ProcessCheckOutAsync(outResId, outUserId, outDeviceId);
                    break;
                case "dashboard.get":
                    responseData = await pmsInterop.GetDashboardAsync(parameters?["propertyId"]?.ToString());
                    break;
                case "guests.list":
                    responseData = await pmsInterop.GetGuestsAsync();
                    break;
                case "roomTypes.list":
                    responseData = await pmsInterop.GetRoomTypesAsync(parameters?["propertyId"]?.ToString());
                    break;
                case "reservations.lookupByRoom":
                    responseData = await pmsInterop.LookupReservationByRoomAsync(parameters?["roomNo"]?.ToString(), parameters?["propertyId"]?.ToString());
                    break;
                case "reservations.create":
                    responseData = await pmsInterop.CreateReservationAsync(parameters?["data"]?.ToString());
                    break;
                case "rooms.list":
                    responseData = await pmsInterop.GetRoomsAsync(parameters?["propertyId"]?.ToString());
                    break;
                case "rooms.getAvailable":
                    responseData = await pmsInterop.GetAvailableRoomsAsync(
                        parameters?["propertyId"]?.ToString(),
                        parameters?["roomTypeId"]?.ToString(),
                        parameters?["checkIn"]?.ToString(),
                        parameters?["checkOut"]?.ToString());
                    break;
                case "reservations.list":
                    responseData = await pmsInterop.GetActiveReservationsAsync();
                    break;
                case "reservations.extendStay":
                    responseData = await pmsInterop.ExtendStayAsync(
                        parameters?["reservationId"]?.ToString(),
                        parameters?["newCheckOutDate"]?.ToString());
                    break;
                case "folios.get":
                    responseData = await pmsInterop.GetFolioAsync(parameters?["id"]?.ToString());
                    break;
                case "folios.addPayment":
                    responseData = await pmsInterop.RecordPaymentAsync(
                        parameters?["folioId"]?.ToString(),
                        parameters?["payment"]?["amount"]?.GetValue<decimal>() ?? 0,
                        parameters?["payment"]?["method"]?.ToString(),
                        "System", "Device1");
                    break;
                case "folios.addCharge":
                    responseData = await pmsInterop.RecordChargeAsync(
                        parameters?["folioId"]?.ToString(),
                        parameters?["charge"]?["amount"]?.GetValue<decimal>() ?? 0,
                        parameters?["charge"]?["description"]?.ToString(),
                        "System", "Device1");
                    break;
                case "keycards.encode":
                    responseData = await hardwareInterop.EncodeCardAsync(parameters?["roomId"]?.ToString());
                    break;
                case "keycards.read":
                    responseData = await hardwareInterop.ReadCardAsync();
                    break;
                case "keycards.cancel":
                    responseData = await hardwareInterop.CancelCardAsync();
                    break;
                case "housekeeping.list":
                    responseData = await pmsInterop.GetHousekeepingTasksAsync(parameters?["propertyId"]?.ToString());
                    break;
                case "housekeeping.updateTask":
                    responseData = await pmsInterop.UpdateHousekeepingTaskStatusAsync(
                        parameters?["taskId"]?.ToString(),
                        parameters?["status"]?.ToString(),
                        "System", "Device1");
                    break;
                case "maintenance.list":
                    responseData = await pmsInterop.GetMaintenanceTicketsAsync(parameters?["propertyId"]?.ToString());
                    break;
                case "maintenance.createTicket":
                    responseData = await pmsInterop.CreateReservationAsync(parameters?["data"]?.ToString()); // Temporary stub mapped to creation logic structure
                    break;
                case "maintenance.resolveTicket":
                    responseData = await pmsInterop.ResolveMaintenanceTicketAsync(
                        parameters?["ticketId"]?.ToString(),
                        "System", "Device1");
                    break;
                case "receipts.generate":
                    responseData = await pmsInterop.GenerateReceiptAsync(parameters?["folioId"]?.ToString());
                    break;
                default:
                    SendError(sender, id, $"Method {method} not found in allowlist.");
                    return;
            }

            // Send success response back to React
            var responseJson = JsonSerializer.Serialize(new 
            { 
                id, 
                result = JsonNode.Parse(responseData) 
            });
            sender.CoreWebView2.PostWebMessageAsString(responseJson);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"IPC Error: {ex.Message}");
        }
    }

    private void SendError(Microsoft.UI.Xaml.Controls.WebView2 sender, string id, string errorMessage)
    {
        var errorJson = JsonSerializer.Serialize(new { id, error = errorMessage });
        sender.CoreWebView2.PostWebMessageAsString(errorJson);
    }
#endif
}

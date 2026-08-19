using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace LodgeCore.Desktop;

public partial class MainPage : ContentPage
{
    public MainPage()
    {
        InitializeComponent();

#if DEBUG
        // In debug mode, connect to the local Next.js development server
        // Always navigate to root — Next.js middleware will handle auth redirect to /login
        MainWebView.Source = new UrlWebViewSource { Url = "http://localhost:3000/" };
#endif
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

#if !DEBUG
        webView2.CoreWebView2.AddWebResourceRequestedFilter("http://lodgecore.local/*", Microsoft.Web.WebView2.Core.CoreWebView2WebResourceContext.All);
        webView2.CoreWebView2.WebResourceRequested += CoreWebView2_WebResourceRequested;
        // Always navigate to root — Next.js middleware redirects unauthenticated users to /login
        webView2.CoreWebView2.Navigate("http://lodgecore.local/");
#endif
    }

    private void CoreWebView2_WebResourceRequested(object sender, Microsoft.Web.WebView2.Core.CoreWebView2WebResourceRequestedEventArgs e)
    {
        var uri = new Uri(e.Request.Uri);
        if (uri.Host == "lodgecore.local")
        {
            string localPath = uri.LocalPath.TrimStart('/');
            if (string.IsNullOrEmpty(localPath)) localPath = "index.html";
            else if (!System.IO.Path.HasExtension(localPath)) localPath += ".html";
            
            string fullPath = System.IO.Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, "wwwroot", localPath);
            
            if (!System.IO.File.Exists(fullPath))
            {
                string fallback = System.IO.Path.Combine(System.AppDomain.CurrentDomain.BaseDirectory, "wwwroot", "404.html");
                if (System.IO.File.Exists(fallback)) fullPath = fallback;
            }

            if (System.IO.File.Exists(fullPath))
            {
                var stream = System.IO.File.OpenRead(fullPath);
                string contentType = "application/octet-stream";
                if (fullPath.EndsWith(".html")) contentType = "text/html";
                else if (fullPath.EndsWith(".js")) contentType = "application/javascript";
                else if (fullPath.EndsWith(".css")) contentType = "text/css";
                else if (fullPath.EndsWith(".json")) contentType = "application/json";
                else if (fullPath.EndsWith(".svg")) contentType = "image/svg+xml";
                else if (fullPath.EndsWith(".png")) contentType = "image/png";
                else if (fullPath.EndsWith(".jpg") || fullPath.EndsWith(".jpeg")) contentType = "image/jpeg";
                else if (fullPath.EndsWith(".woff2")) contentType = "font/woff2";

                e.Response = ((Microsoft.Web.WebView2.Core.CoreWebView2)sender).Environment.CreateWebResourceResponse(
                    stream.AsRandomAccessStream(), 200, "OK", $"Content-Type: {contentType}\nAccess-Control-Allow-Origin: *");
            }
        }
    }

    private async void CoreWebView2_WebMessageReceived(Microsoft.Web.WebView2.Core.CoreWebView2 sender, Microsoft.Web.WebView2.Core.CoreWebView2WebMessageReceivedEventArgs args)
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
            var pmsInterop = Application.Current?.Windows[0]?.Page?.Handler?.MauiContext?.Services.GetService<OfflinePMSInterop>();
            var hardwareInterop = Application.Current?.Windows[0]?.Page?.Handler?.MauiContext?.Services.GetService<HardwareInterop>();

            if (pmsInterop == null || hardwareInterop == null)
            {
                SendError(sender, id, "Interop services not ready.");
                return;
            }

            // Explicit Method Allowlist
            string responseData = null;

            switch (method)
            {
                case "auth.getSession":
                    responseData = await pmsInterop.GetSessionAsync();
                    break;
                case "auth.provisionDevice":
                    responseData = await pmsInterop.ProvisionDeviceAsync(
                        parameters?["deviceToken"]?.ToString()
                    );
                    break;
                case "auth.getActiveStaff":
                    responseData = await pmsInterop.GetActiveStaffAsync();
                    break;
                case "auth.login":
                    responseData = await pmsInterop.LoginAsync(
                        parameters?["staffId"]?.ToString(),
                        parameters?["pin"]?.ToString()
                    );
                    break;
                case "auth.clearSession":
                    responseData = await pmsInterop.ClearSessionAsync();
                    break;
                case "properties.list":
                    responseData = await pmsInterop.GetPropertiesAsync();
                    break;
                case "hardware.readCard":
                    responseData = await hardwareInterop.ReadCardAsync();
                    break;
                case "hardware.encodeCard": // Legacy route — kept for backward compat but uses same security path
                    responseData = await hardwareInterop.EncodeCardAsync(
                        parameters?["roomId"]?.ToString(),
                        parameters?["lockCode"]?.ToString(),
                        parameters?["reservationId"]?.ToString());
                    break;
                case "hardware.cancelCard":
                    responseData = await hardwareInterop.CancelCardAsync();
                    break;
                case "hardware.openCashDrawer":
                    responseData = await pmsInterop.OpenCashDrawerAsync();
                    break;
                case "hardware.printReceipt":
                    responseData = await pmsInterop.PrintReceiptAsync(
                        System.Text.Json.JsonSerializer.Serialize(parameters?["receipt"]));
                    break;
                case "hardware.printKitchenTicket":
                    responseData = await pmsInterop.PrintKitchenTicketAsync(
                        System.Text.Json.JsonSerializer.Serialize(parameters?["ticket"]));
                    break;
                case "hardware.sendToKds":
                    responseData = await pmsInterop.SendToKdsAsync(
                        System.Text.Json.JsonSerializer.Serialize(parameters?["order"]));
                    break;
                case "hardware.updateKdsStatus":
                    responseData = await pmsInterop.UpdateKdsStatusAsync(
                        parameters?["orderId"]?.ToString() ?? "",
                        parameters?["itemId"]?.ToString() ?? "",
                        parameters?["status"]?.ToString() ?? "");
                    break;
                case "reservations.get":
                    responseData = await pmsInterop.GetActiveReservationsAsync();
                    break;
                case "reservations.checkIn":
                    string resId = parameters?["reservationId"]?.ToString();
                    responseData = await pmsInterop.ProcessCheckInAsync(resId);
                    break;
                case "reservations.checkOut":
                    string outResId = parameters?["reservationId"]?.ToString();
                    responseData = await pmsInterop.ProcessCheckOutAsync(outResId);
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
                        parameters?["payment"]?["method"]?.ToString());
                    break;
                case "folios.addCharge":
                    responseData = await pmsInterop.RecordChargeAsync(
                        parameters?["folioId"]?.ToString(),
                        parameters?["charge"]?["amount"]?.GetValue<decimal>() ?? 0,
                        parameters?["charge"]?["description"]?.ToString());
                    break;
                case "keycards.encode":
                    responseData = await hardwareInterop.EncodeCardAsync(
                        parameters?["roomId"]?.ToString(),
                        parameters?["lockCode"]?.ToString(),
                        parameters?["reservationId"]?.ToString());
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
                        parameters?["status"]?.ToString());
                    break;
                case "maintenance.list":
                    responseData = await pmsInterop.GetMaintenanceTicketsAsync(parameters?["propertyId"]?.ToString());
                    break;
                case "maintenance.createTicket":
                    responseData = await pmsInterop.CreateReservationAsync(parameters?["data"]?.ToString()); // Temporary stub mapped to creation logic structure
                    break;
                case "maintenance.resolveTicket":
                    responseData = await pmsInterop.ResolveMaintenanceTicketAsync(
                        parameters?["ticketId"]?.ToString());
                    break;
                case "receipts.generate":
                    responseData = await pmsInterop.GenerateReceiptAsync(parameters?["folioId"]?.ToString());
                    break;
                case "pos.getProducts":
                    responseData = await pmsInterop.GetPosProductsAsync(parameters?["propertyId"]?.ToString());
                    break;
                case "pos.createOrder":
                    responseData = await pmsInterop.CreatePosOrderAsync(parameters?["data"]?.ToString());
                    break;
                case "pos.splitCheck":
                    var itemIdsNode = parameters?["itemIds"] as JsonArray;
                    var itemIdsList = itemIdsNode?.Select(x => x?.ToString() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList() ?? new List<string>();
                    responseData = await pmsInterop.SplitCheckAsync(
                        parameters?["orderId"]?.ToString(),
                        itemIdsList);
                    break;
                case "pos.updateOrderStatus":
                    responseData = await pmsInterop.UpdateOrderStatusAsync(
                        parameters?["orderId"]?.ToString(),
                        parameters?["status"]?.ToString(),
                        parameters?["reason"]?.ToString());
                    break;
                case "pos.payOrder":
                    responseData = await pmsInterop.PayOrderAsync(
                        parameters?["orderId"]?.ToString(),
                        parameters?["paymentData"]?.ToString());
                    break;
                case "pos.fireKot":
                    var kotItemIdsNode = parameters?["itemIds"] as System.Text.Json.Nodes.JsonArray;
                    var kotItemIdsList = kotItemIdsNode?.Select(x => x?.ToString() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList() ?? new List<string>();
                    responseData = await pmsInterop.FireKotAsync(
                        parameters?["orderId"]?.ToString(),
                        kotItemIdsList);
                    break;
                case "pos.getOrder":
                    responseData = await pmsInterop.GetOrderAsync(parameters?["orderId"]?.ToString());
                    break;
                case "pos.getReceipt":
                    responseData = await pmsInterop.GetReceiptAsync(parameters?["orderId"]?.ToString());
                    break;
                case "pos.getServerOrders":
                    responseData = await pmsInterop.GetServerOrdersAsync(
                        parameters?["range"]?.ToString() ?? "today",
                        parameters?["statusFilter"]?.ToString() ?? "all",
                        parameters?["sessionId"]?.ToString());
                    break;
                case "pos.getServerSales":
                    responseData = await pmsInterop.GetServerSalesAsync(
                        parameters?["range"]?.ToString() ?? "today",
                        parameters?["sessionId"]?.ToString());
                    break;
                case "pos.getCashMovements":
                    responseData = await pmsInterop.GetCashMovementsAsync(parameters?["sessionId"]?.ToString());
                    break;
                case "pos.createCashMovement":
                    responseData = await pmsInterop.CreateCashMovementAsync(
                        parameters?["propertyId"]?.ToString(),
                        parameters?["sessionId"]?.ToString(),
                        parameters?["amount"]?.GetValue<decimal>() ?? 0,
                        parameters?["type"]?.ToString(),
                        parameters?["reasonCode"]?.ToString(),
                        parameters?["notes"]?.ToString(),
                        parameters?["receiptReference"]?.ToString(),
                        parameters?["authorizerId"]?.ToString());
                    break;
                case "pos.getSessionSettlementDetails":
                    responseData = await pmsInterop.GetSessionSettlementDetailsAsync(parameters?["sessionId"]?.ToString());
                    break;
                case "pos.settleSession":
                    responseData = await pmsInterop.SettleSessionAsync(
                        parameters?["sessionId"]?.ToString(),
                        parameters?["actualCash"]?.GetValue<decimal>() ?? 0,
                        parameters?["operatorId"]?.ToString(),
                        parameters?["authorizerId"]?.ToString());
                    break;
                case "pos.startSession":
                    responseData = await pmsInterop.OpenPosSessionAsync(
                        parameters?["propertyId"]?.ToString(),
                        parameters?["openingBalance"]?.GetValue<decimal>() ?? 0);
                    break;
                case "pos.closeSession":
                    responseData = await pmsInterop.ClosePosSessionAsync(
                        parameters?["sessionId"]?.ToString(),
                        parameters?["actualCash"]?.GetValue<decimal>() ?? 0,
                        parameters?["cashPaidOut"]?.GetValue<decimal>() ?? 0);
                    break;
                case "pos.authorizeVoid":
                    responseData = await pmsInterop.AuthorizeVoidAsync(
                        parameters?["orderId"]?.ToString(),
                        parameters?["orderItemId"]?.ToString(),
                        parameters?["reason"]?.ToString(),
                        parameters?["supervisorPin"]?.ToString());
                    break;
                case "pos.recordRefund":
                    responseData = await pmsInterop.RecordRefundAsync(
                        parameters?["orderId"]?.ToString(),
                        parameters?["amount"]?.GetValue<decimal>() ?? 0,
                        parameters?["method"]?.ToString(),
                        parameters?["supervisorPin"]?.ToString());
                    break;
                case "pos.authorizeCashMovement":
                    responseData = await pmsInterop.AuthorizeCashMovementAsync(
                        parameters?["propertyId"]?.ToString(),
                        parameters?["sessionId"]?.ToString(),
                        parameters?["amount"]?.GetValue<decimal>() ?? 0,
                        parameters?["type"]?.ToString(),
                        parameters?["reasonCode"]?.ToString(),
                        parameters?["notes"]?.ToString(),
                        parameters?["supervisorPin"]?.ToString());
                    break;
                case "pos.logReceipt":
                    responseData = await pmsInterop.LogReceiptPrintAsync(
                        parameters?["propertyId"]?.ToString(),
                        parameters?["orderId"]?.ToString(),
                        parameters?["sessionId"]?.ToString(),
                        parameters?["type"]?.ToString(),
                        parameters?["reason"]?.ToString(),
                        parameters?["printCount"]?.GetValue<int>() ?? 1);
                    break;
                case "pos.authenticateOperator":
                    responseData = await pmsInterop.AuthenticateOperatorAsync(
                        parameters?["staffId"]?.ToString(),
                        parameters?["pin"]?.ToString(),
                        parameters?["propertyId"]?.ToString(),
                        parameters?["sessionId"]?.ToString());
                    break;
                case "pos.keepAlive":
                    responseData = await pmsInterop.KeepAliveAsync();
                    break;
                case "pos.validateSupervisorPin":
                    responseData = await pmsInterop.ValidateSupervisorPinAsync(
                        parameters?["pin"]?.ToString());
                    break;
                case "pos.getCurrentOperator":
                    responseData = await pmsInterop.GetCurrentOperatorAsync(parameters?["sessionId"]?.ToString());
                    break;
                case "pos.getActiveStaff":
                    responseData = await pmsInterop.GetActiveStaffAsync(parameters?["propertyId"]?.ToString());
                    break;
                case "pos.getCategories":
                    responseData = await pmsInterop.GetPosProductsAsync(parameters?["propertyId"]?.ToString());
                    break;
                case "pos.getFloorPlans":
                    responseData = await pmsInterop.GetFloorPlansAsync(parameters?["outletId"]?.ToString());
                    break;
                case "pos.getTables":
                    responseData = await pmsInterop.GetTablesAsync(parameters?["floorPlanId"]?.ToString());
                    break;
                case "pos.getProductModifiers":
                    responseData = await pmsInterop.GetProductModifiersAsync(parameters?["productId"]?.ToString());
                    break;
                case "pos.getSessionContext":
                    responseData = await pmsInterop.GetSessionContextAsync(parameters?["sessionId"]?.ToString());
                    break;
                case "pos.getAuthorizedOutlets":
                    responseData = await pmsInterop.GetAuthorizedOutletsAsync(
                        parameters?["propertyId"]?.ToString(),
                        parameters?["deviceId"]?.ToString());
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
            sender.PostWebMessageAsString(responseJson);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"IPC Error: {ex.Message}");
        }
    }

    private void SendError(Microsoft.Web.WebView2.Core.CoreWebView2 sender, string id, string errorMessage)
    {
        var errorJson = JsonSerializer.Serialize(new { id, error = errorMessage });
        sender.PostWebMessageAsString(errorJson);
    }
#endif
}

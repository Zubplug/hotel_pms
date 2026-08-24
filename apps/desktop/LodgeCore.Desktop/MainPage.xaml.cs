using System;
using Microsoft.Extensions.DependencyInjection;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using LodgeCore.Desktop.Services;

namespace LodgeCore.Desktop;

public partial class MainPage : ContentPage
{
    public MainPage()
    {
        InitializeComponent();

#if DEBUG
        // In debug mode, connect to the local Next.js development server
        MainWebView.Source = new UrlWebViewSource { Url = "http://localhost:3000/desktop" };
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
        webView2.CoreWebView2.WebMessageReceived -= CoreWebView2_WebMessageReceived;
        webView2.CoreWebView2.WebMessageReceived += CoreWebView2_WebMessageReceived;

#if !DEBUG
        webView2.CoreWebView2.AddWebResourceRequestedFilter("http://lodgecore.local/*", Microsoft.Web.WebView2.Core.CoreWebView2WebResourceContext.All);
        webView2.CoreWebView2.WebResourceRequested -= CoreWebView2_WebResourceRequested;
        webView2.CoreWebView2.WebResourceRequested += CoreWebView2_WebResourceRequested;
        
        // Navigate to the isolated Desktop route
        webView2.CoreWebView2.Navigate("http://lodgecore.local/desktop");
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

    private void CoreWebView2_WebMessageReceived(Microsoft.Web.WebView2.Core.CoreWebView2 sender, Microsoft.Web.WebView2.Core.CoreWebView2WebMessageReceivedEventArgs args)
    {
        try
        {
            string messageStr = args.TryGetWebMessageAsString();
            if (string.IsNullOrEmpty(messageStr)) return;

            var request = JsonSerializer.Deserialize<JsonNode>(messageStr);
            if (request == null) return;

            string? id = request["id"]?.ToString();
            string? method = request["method"]?.ToString();

            if (string.IsNullOrEmpty(method) || string.IsNullOrEmpty(id)) return;

            // Dispatch immediately to a background thread to prevent UI freezing
            Task.Run(async () =>
            {
                try
                {
                    // Create a dedicated service scope for this IPC request to ensure thread safety for DbContext
                    var services = Application.Current?.Windows[0]?.Page?.Handler?.MauiContext?.Services;
                    if (services == null)
                    {
                        MainThread.BeginInvokeOnMainThread(() => SendError(sender, id, "Services not ready."));
                        return;
                    }
                    using var scope = services.CreateScope();
                    var pmsInterop = scope.ServiceProvider.GetService<OfflinePMSInterop>();
                    var hardwareInterop = scope.ServiceProvider.GetService<HardwareInterop>();

                    if (pmsInterop == null || hardwareInterop == null)
                    {
                        MainThread.BeginInvokeOnMainThread(() => SendError(sender, id, "Interop services not ready."));
                        return;
                    }

                    // Re-parse params safely on background thread
                    var requestNode = JsonSerializer.Deserialize<JsonNode>(messageStr);
                    var parameters = requestNode?["params"];

                    // Explicit Method Allowlist
                    string? responseData = null;

                    switch (method)
                    {
                case "system.getTerminalStatus":
                    responseData = await pmsInterop.GetTerminalStatusAsync();
                    break;
                case "system.forceSync":
                    var dbContext = scope.ServiceProvider.GetRequiredService<LodgeCore.Desktop.Data.LocalDbContext>();
                    var meta = dbContext.SyncMetadata.FirstOrDefault();
                    if (meta != null)
                    {
                        meta.LastGuestSyncCursor = null;
                        dbContext.SaveChanges();
                    }
                    if (LodgeCore.Desktop.Services.SyncEngine.Instance != null)
                    {
                        LodgeCore.Desktop.Services.SyncEngine.Instance.TriggerManualSync();
                    }
                    responseData = System.Text.Json.JsonSerializer.Serialize(new { success = true }, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
                    break;
                case "system.getSyncHealth":
                    responseData = await pmsInterop.GetSyncHealthAsync();
                    break;
                case "system.getServiceHealth":
                    responseData = await pmsInterop.GetServiceHealthAsync();
                    break;
                case "system.provisionTerminal":
                    responseData = await pmsInterop.ProvisionTerminalAsync(
                        parameters?["email"]?.ToString() ?? "",
                        parameters?["password"]?.ToString() ?? "",
                        parameters?["propertyId"]?.ToString() ?? "",
                        parameters?["outletId"]?.ToString() ?? "",
                        parameters?["terminalName"]?.ToString() ?? "",
                        parameters?["terminalType"]?.ToString() ?? ""
                    );
                    break;
                case "auth.getSession":
                    responseData = await pmsInterop.GetSessionAsync();
                    break;
                case "auth.provisionDevice":
                    responseData = await pmsInterop.ProvisionDeviceAsync(
                        parameters?["deviceToken"]?.ToString() ?? ""
                    );
                    break;
                case "auth.getActiveStaff":
                    responseData = await pmsInterop.GetActiveStaffAsync();
                    break;
                case "auth.login":
                    responseData = await pmsInterop.LoginAsync(
                        parameters?["staffId"]?.ToString() ?? "",
                        parameters?["pin"]?.ToString() ?? "",
                        parameters?["bankingModel"]?.ToString() ?? ""
                    );
                    break;
                case "auth.clearSession":
                case "auth.logout":
                    responseData = await pmsInterop.ClearSessionAsync();
                    break;
                case "auth.lock":
                    responseData = await pmsInterop.LockSessionAsync();
                    break;
                case "properties.list":
                    responseData = await pmsInterop.GetPropertiesAsync();
                    break;
                case "hardware.readCard":
                    responseData = await hardwareInterop.ReadCardAsync();
                    break;
                case "hardware.encodeCard": // Legacy route — kept for backward compat but uses same security path
                    responseData = await hardwareInterop.EncodeCardAsync(
                        parameters?["roomId"]?.ToString() ?? "",
                        parameters?["lockCode"]?.ToString() ?? "",
                        parameters?["reservationId"]?.ToString() ?? "");
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
                case "hardware.printRegistrationCard":
                    responseData = await pmsInterop.PrintRegistrationCardAsync(
                        System.Text.Json.JsonSerializer.Serialize(parameters?["data"]));
                    break;
                case "hardware.printGuestFolio":
                    responseData = await pmsInterop.PrintGuestFolioAsync(
                        System.Text.Json.JsonSerializer.Serialize(parameters?["data"]));
                    break;
                case "hardware.printPaymentReceipt":
                    responseData = await pmsInterop.PrintPaymentReceiptAsync(
                        System.Text.Json.JsonSerializer.Serialize(parameters?["data"]));
                    break;
                case "hardware.printShiftReport":
                    responseData = await pmsInterop.PrintShiftReportAsync(
                        System.Text.Json.JsonSerializer.Serialize(parameters?["data"]));
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
                    responseData = await pmsInterop.GetReservationAsync(parameters?["id"]?.ToString() ?? "");
                    break;
                case "reservations.checkIn":
                    string resId = parameters?["id"]?.ToString() ?? "";
                    bool bypassKeycard = false;
                    if (parameters != null && parameters["bypassKeycard"] != null)
                    {
                        bool.TryParse(parameters["bypassKeycard"].ToString(), out bypassKeycard);
                    }
                    var encodedRoomId = parameters?["encodedRoomId"]?.ToString() ?? "";
                    var encodeData = parameters?["encodeData"]?.ToString();
                    responseData = await pmsInterop.ProcessCheckInAsync(resId, bypassKeycard, encodedRoomId, encodeData);
                    break;
                case "reservations.checkOut":
                    string outResId = parameters?["id"]?.ToString() ?? "";
                    responseData = await pmsInterop.ProcessCheckOutAsync(outResId);
                    break;
                case "dashboard.get":
                    responseData = await pmsInterop.GetDashboardAsync(parameters?["propertyId"]?.ToString() ?? "");
                    break;
                case "sync.retryDeadLetters":
                    responseData = await pmsInterop.RetryDeadLetterEventsAsync();
                    break;
                case "guests.list":
                    responseData = await pmsInterop.GetGuestsAsync();
                    break;
                case "guests.search":
                    responseData = await pmsInterop.SearchGuestsAsync(parameters?["query"]?.ToString() ?? "");
                    break;
                case "laundry.getItems":
                    responseData = await pmsInterop.GetLaundryItemsAsync(parameters?["propertyId"]?.ToString() ?? "");
                    break;
                case "laundry.getOrders":
                    responseData = await pmsInterop.GetLaundryOrdersAsync(
                        parameters?["propertyId"]?.ToString() ?? "",
                        parameters?["status"]?.ToString()
                    );
                    break;
                case "laundry.createOrder":
                    responseData = await pmsInterop.CreateLaundryOrderAsync(parameters?["data"]?.ToString() ?? "");
                    break;
                case "laundry.updateOrderStatus":
                    responseData = await pmsInterop.UpdateLaundryOrderStatusAsync(
                        parameters?["orderId"]?.ToString() ?? "",
                        parameters?["status"]?.ToString() ?? ""
                    );
                    break;
                case "laundry.deliverOrder":
                    responseData = await pmsInterop.DeliverLaundryOrderAsync(parameters?["orderId"]?.ToString() ?? "");
                    break;
                case "guests.update":
                    responseData = await pmsInterop.UpdateGuestAsync(
                        parameters?["guestId"]?.ToString() ?? "",
                        System.Text.Json.JsonSerializer.Serialize(parameters?["guestData"])
                    );
                    break;
                case "roomTypes.list":
                    responseData = await pmsInterop.GetRoomTypesAsync(parameters?["propertyId"]?.ToString() ?? "");
                    break;
                case "reservations.lookupByRoom":
                    responseData = await pmsInterop.LookupReservationByRoomAsync(parameters?["roomNo"]?.ToString() ?? "", parameters?["propertyId"]?.ToString() ?? "");
                    break;
                case "reservations.create":
                    responseData = await pmsInterop.CreateReservationAsync(parameters?["data"]?.ToString() ?? "");
                    break;
                case "rooms.list":
                    responseData = await pmsInterop.GetRoomsAsync(parameters?["propertyId"]?.ToString() ?? "");
                    break;
                case "rooms.getAvailable":
                    responseData = await pmsInterop.GetAvailableRoomsAsync(
                        parameters?["propertyId"]?.ToString() ?? "",
                        parameters?["roomTypeId"]?.ToString() ?? "",
                        parameters?["checkIn"]?.ToString() ?? "",
                        parameters?["checkOut"]?.ToString() ?? "");
                    break;
                case "rooms.getActiveReservation":
                    responseData = await pmsInterop.GetActiveReservationByRoomAsync(parameters?["roomId"]?.ToString() ?? "");
                    break;
                case "rooms.updateStatus":
                    responseData = await pmsInterop.UpdateRoomStatusAsync(
                        parameters?["roomId"]?.ToString() ?? "",
                        parameters?["newStatus"]?.ToString() ?? "",
                        parameters?["source"]?.ToString() ?? "");
                    break;
                case "reservations.list":
                    responseData = await pmsInterop.GetActiveReservationsAsync();
                    break;
                case "sync.outbox":
                    responseData = await pmsInterop.GetOutboxEventsAsync();
                    break;
                case "sync.events":
                    responseData = await pmsInterop.GetSyncEventsAsync();
                    break;
                case "reservations.extendStay":
                    responseData = await pmsInterop.ExtendStayAsync(
                        parameters?["reservationId"]?.ToString() ?? "",
                        parameters?["newCheckOutDate"]?.ToString() ?? "");
                    break;
                case "reservations.recordKeycardEncoding":
                    responseData = await pmsInterop.RecordKeycardEncodingAsync(
                        parameters?["reservationId"]?.ToString() ?? "",
                        parameters?["roomId"]?.ToString() ?? "",
                        parameters?["encodeData"]?.ToString());
                    break;
                case "reservations.previewExtendStay":
                    responseData = await pmsInterop.PreviewExtendStayAsync(
                        parameters?["reservationId"]?.ToString() ?? "",
                        parameters?["newCheckOutDate"]?.ToString() ?? "");
                    break;
                case "reservations.update":
                    responseData = await pmsInterop.EditReservationAsync(parameters?.ToString() ?? "{}");
                    break;
                case "reservations.cancel":
                    responseData = await pmsInterop.CancelReservationAsync(parameters?["id"]?.ToString() ?? "");
                    break;
                case "reservations.reassignRoom":
                    responseData = await pmsInterop.ReassignRoomAsync(parameters?.ToString() ?? "{}");
                    break;
                case "folios.get":
                    responseData = await pmsInterop.GetFolioAsync(parameters?["id"]?.ToString() ?? "");
                    break;
                case "folios.addPayment":
                    responseData = await pmsInterop.RecordPaymentAsync(
                        parameters?["folioId"]?.ToString() ?? "",
                        parameters?["payment"]?["amount"]?.GetValue<decimal>() ?? 0,
                        parameters?["payment"]?["method"]?.ToString() ?? "",
                        parameters?["idempotencyKey"]?.ToString());
                    break;
                case "folios.addCharge":
                    responseData = await pmsInterop.RecordChargeAsync(
                        parameters?["folioId"]?.ToString() ?? "",
                        parameters?["charge"]?["amount"]?.GetValue<decimal>() ?? 0,
                        parameters?["charge"]?["description"]?.ToString() ?? "",
                        parameters?["idempotencyKey"]?.ToString());
                    break;
                case "keycards.encode":
                    var hardwareResponse = await hardwareInterop.EncodeCardAsync(
                        parameters?["roomId"]?.ToString() ?? "",
                        parameters?["lockCode"]?.ToString() ?? "",
                        parameters?["reservationId"]?.ToString() ?? "");
                    var hardwareNode = JsonNode.Parse(hardwareResponse);
                    if (hardwareNode?["success"]?.GetValue<bool>() == true && !string.IsNullOrWhiteSpace(parameters?["reservationId"]?.ToString()))
                    {
                        var recordResponse = await pmsInterop.RecordKeycardEncodingAsync(
                            parameters?["reservationId"]?.ToString() ?? "",
                            parameters?["roomId"]?.ToString() ?? "",
                            hardwareNode["data"]?.ToJsonString());
                        var recordNode = JsonNode.Parse(recordResponse);
                        if (recordNode?["success"]?.GetValue<bool>() != true)
                        {
                            responseData = JsonSerializer.Serialize(new
                            {
                                success = false,
                                error = $"Card encoded, but local card record failed: {recordNode?["error"]?.ToString() ?? "Unknown local recording error."}",
                                data = hardwareNode["data"]
                            });
                            break;
                        }
                    }
                    responseData = hardwareResponse;
                    break;
                case "keycards.read":
                    responseData = await hardwareInterop.ReadCardAsync();
                    break;
                case "keycards.cancel":
                    responseData = await hardwareInterop.CancelCardAsync();
                    break;
                case "housekeeping.list":
                    responseData = await pmsInterop.GetHousekeepingTasksAsync(parameters?["propertyId"]?.ToString() ?? "");
                    break;
                case "housekeeping.updateTask":
                    responseData = await pmsInterop.UpdateHousekeepingTaskStatusAsync(
                        parameters?["taskId"]?.ToString() ?? "",
                        parameters?["status"]?.ToString() ?? "");
                    break;
                case "maintenance.list":
                    responseData = await pmsInterop.GetMaintenanceTicketsAsync(parameters?["propertyId"]?.ToString() ?? "");
                    break;
                case "maintenance.createTicket":
                    responseData = await pmsInterop.CreateMaintenanceTicketAsync(parameters?["data"]?.ToString() ?? "");
                    break;
                case "maintenance.resolveTicket":
                    responseData = await pmsInterop.ResolveMaintenanceTicketAsync(
                        parameters?["ticketId"]?.ToString() ?? "");
                    break;
                case "receipts.generate":
                    responseData = await pmsInterop.GenerateReceiptAsync(parameters?["folioId"]?.ToString() ?? "");
                    break;
                case "pos.getProducts":
                    responseData = await pmsInterop.GetPosProductsAsync(parameters?["propertyId"]?.ToString() ?? "");
                    break;
                case "pos.createOrder":
                    responseData = await pmsInterop.CreatePosOrderAsync(parameters?["data"]?.ToString() ?? "");
                    break;
                case "pos.splitCheck":
                    var itemIdsNode = parameters?["itemIds"] as JsonArray;
                    var itemIdsList = itemIdsNode?.Select(x => x?.ToString() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList() ?? new List<string>();
                    responseData = await pmsInterop.SplitCheckAsync(
                        parameters?["orderId"]?.ToString() ?? "",
                        itemIdsList);
                    break;
                case "pos.updateOrderStatus":
                    responseData = await pmsInterop.UpdateOrderStatusAsync(
                        parameters?["orderId"]?.ToString() ?? "",
                        parameters?["status"]?.ToString() ?? "",
                        parameters?["reason"]?.ToString() ?? "");
                    break;
                case "pos.payOrder":
                    responseData = await pmsInterop.PayOrderAsync(
                        parameters?["orderId"]?.ToString() ?? "",
                        parameters?["paymentData"]?.ToString() ?? "");
                    break;
                case "pos.getWaiterTickets":
                    responseData = await pmsInterop.GetWaiterTicketsAsync(
                        parameters?["outletId"]?.ToString() ?? "",
                        parameters?["operatorToken"]?.ToString() ?? "",
                        parameters?["sessionId"]?.ToString() ?? "");
                    break;
                case "pos.fireKot":
                    var kotItemIdsNode = parameters?["itemIds"] as System.Text.Json.Nodes.JsonArray;
                    var kotItemIdsList = kotItemIdsNode?.Select(x => x?.ToString() ?? "").Where(x => !string.IsNullOrEmpty(x)).ToList() ?? new List<string>();
                    responseData = await pmsInterop.FireKotAsync(
                        parameters?["orderId"]?.ToString() ?? "",
                        kotItemIdsList);
                    break;
                case "pos.fireItems":
                    responseData = await pmsInterop.FireItemsAsync(
                        parameters?["orderId"]?.ToString() ?? "",
                        parameters?["items"]?.ToString() ?? "");
                    break;
                case "pos.getActiveOrders":
                    responseData = await pmsInterop.GetActiveOrdersAsync(
                        parameters?["filter"]?.ToString() ?? "");
                    break;
                case "pos.getOrder":
                    responseData = await pmsInterop.GetOrderAsync(parameters?["orderId"]?.ToString() ?? "");
                    break;
                case "pos.getReceipt":
                    responseData = await pmsInterop.GetReceiptAsync(parameters?["orderId"]?.ToString() ?? "");
                    break;
                case "pos.getServerOrders":
                    responseData = await pmsInterop.GetServerOrdersAsync(
                        parameters?["range"]?.ToString() ?? "today",
                        parameters?["statusFilter"]?.ToString() ?? "all",
                        parameters?["sessionId"]?.ToString() ?? "");
                    break;
                case "pos.getServerSales":
                    responseData = await pmsInterop.GetServerSalesAsync(
                        parameters?["range"]?.ToString() ?? "today",
                        parameters?["sessionId"]?.ToString() ?? "");
                    break;
                case "pos.getCashMovements":
                    responseData = await pmsInterop.GetCashMovementsAsync(parameters?["sessionId"]?.ToString() ?? "");
                    break;
                case "pos.createCashMovement":
                    responseData = await pmsInterop.CreateCashMovementAsync(
                        parameters?["propertyId"]?.ToString() ?? "",
                        parameters?["sessionId"]?.ToString() ?? "",
                        parameters?["amount"]?.GetValue<decimal>() ?? 0,
                        parameters?["type"]?.ToString() ?? "",
                        parameters?["reasonCode"]?.ToString() ?? "",
                        parameters?["notes"]?.ToString() ?? "",
                        parameters?["receiptReference"]?.ToString() ?? "",
                        parameters?["authorizerId"]?.ToString() ?? "");
                    break;
                case "pos.getSessionSettlementDetails":
                    responseData = await pmsInterop.GetSessionSettlementDetailsAsync(parameters?["sessionId"]?.ToString() ?? "");
                    break;
                case "pos.settleSession":
                    responseData = await pmsInterop.SettleSessionAsync(
                        parameters?["sessionId"]?.ToString() ?? "",
                        parameters?["actualCash"]?.GetValue<decimal>() ?? 0,
                        parameters?["operatorId"]?.ToString() ?? "",
                        parameters?["authorizerId"]?.ToString() ?? "");
                    break;
                case "pos.startSession":
                    responseData = await pmsInterop.OpenPosSessionAsync(
                        parameters?["propertyId"]?.ToString() ?? "",
                        parameters?["outletId"]?.ToString() ?? "",
                        parameters?["bankType"]?.ToString() ?? "SERVER",
                        parameters?["bankingModel"]?.ToString() ?? "SERVER_BANKING",
                        parameters?["openingCash"]?.GetValue<decimal>() ?? 0);
                    break;
                case "pos.closeSession":
                    responseData = await pmsInterop.ClosePosSessionAsync(
                        parameters?["sessionId"]?.ToString() ?? "",
                        parameters?["actualCash"]?.GetValue<decimal>() ?? 0,
                        parameters?["cashPaidOut"]?.GetValue<decimal>() ?? 0);
                    break;
                case "pos.confirmHandover":
                    responseData = await pmsInterop.ConfirmHandoverAsync(
                        parameters?["sessionId"]?.ToString() ?? "",
                        parameters?["managerPin"]?.ToString() ?? ""
                    );
                    break;
                case "pos.getPendingHandovers":
                    responseData = await pmsInterop.GetPendingHandoversAsync(
                        parameters?["propertyId"]?.ToString() ?? ""
                    );
                    break;
                case "pos.getCashOfficeOverview":
                    responseData = await pmsInterop.GetCashOfficeOverviewAsync(
                        parameters?["propertyId"]?.ToString() ?? ""
                    );
                    break;
                case "pos.openSafe":
                    responseData = await pmsInterop.OpenSafeAsync(
                        parameters?["propertyId"]?.ToString() ?? "",
                        parameters?["amount"]?.GetValue<decimal>() ?? 0,
                        parameters?["managerPin"]?.ToString() ?? ""
                    );
                    break;
                case "pos.getSafeLedger":
                    responseData = await pmsInterop.GetSafeLedgerAsync(
                        parameters?["propertyId"]?.ToString() ?? ""
                    );
                    break;
                case "pos.recordBankDeposit":
                    responseData = await pmsInterop.RecordBankDepositAsync(
                        parameters?["propertyId"]?.ToString() ?? "",
                        parameters?["amount"]?.GetValue<decimal>() ?? 0,
                        parameters?["reference"]?.ToString() ?? "",
                        parameters?["managerPin"]?.ToString() ?? ""
                    );
                    break;
                case "pos.authorizeVoid":
                    responseData = await pmsInterop.AuthorizeVoidAsync(
                        parameters?["orderId"]?.ToString() ?? "",
                        parameters?["orderItemId"]?.ToString() ?? "",
                        parameters?["reason"]?.ToString() ?? "",
                        parameters?["supervisorPin"]?.ToString() ?? "");
                    break;
                case "pos.recordRefund":
                    responseData = await pmsInterop.RecordRefundAsync(
                        parameters?["orderId"]?.ToString() ?? "",
                        parameters?["amount"]?.GetValue<decimal>() ?? 0,
                        parameters?["method"]?.ToString() ?? "",
                        parameters?["supervisorPin"]?.ToString() ?? "");
                    break;
                case "pos.authorizeCashMovement":
                    responseData = await pmsInterop.AuthorizeCashMovementAsync(
                        parameters?["propertyId"]?.ToString() ?? "",
                        parameters?["sessionId"]?.ToString() ?? "",
                        parameters?["amount"]?.GetValue<decimal>() ?? 0,
                        parameters?["type"]?.ToString() ?? "",
                        parameters?["reasonCode"]?.ToString() ?? "",
                        parameters?["notes"]?.ToString() ?? "",
                        parameters?["supervisorPin"]?.ToString() ?? "");
                    break;
                case "pos.logReceipt":
                    responseData = await pmsInterop.LogReceiptPrintAsync(
                        parameters?["propertyId"]?.ToString() ?? "",
                        parameters?["orderId"]?.ToString() ?? "",
                        parameters?["sessionId"]?.ToString() ?? "",
                        parameters?["type"]?.ToString() ?? "",
                        parameters?["reason"]?.ToString() ?? "",
                        parameters?["printCount"]?.GetValue<int>() ?? 1);
                    break;
                case "pos.authenticateOperator":
                    responseData = await pmsInterop.AuthenticateOperatorAsync(
                        parameters?["staffId"]?.ToString() ?? "",
                        parameters?["pin"]?.ToString() ?? "",
                        parameters?["propertyId"]?.ToString() ?? "",
                        parameters?["sessionId"]?.ToString() ?? "",
                        parameters?["outletId"]?.ToString() ?? "",
                        parameters?["deviceId"]?.ToString() ?? "");
                    break;
                case "pos.startEmergencyBank":
                    responseData = await pmsInterop.StartEmergencyBankAsync(
                        parameters?["pin"]?.ToString() ?? "",
                        parameters?["reason"]?.ToString() ?? "",
                        parameters?["operatorToken"]?.ToString() ?? "");
                    break;
                case "pos.keepAlive":
                    responseData = await pmsInterop.KeepAliveAsync();
                    break;
                case "pos.validateSupervisorPin":
                    responseData = await pmsInterop.ValidateSupervisorPinAsync(
                        parameters?["pin"]?.ToString() ?? "");
                    break;
                case "pos.getCurrentOperator":
                    responseData = await pmsInterop.GetCurrentOperatorAsync(
                        parameters?["sessionId"]?.ToString() ?? "",
                        parameters?["operatorToken"]?.ToString() ?? "");
                    break;
                case "pos.getActiveStaff":
                    responseData = await pmsInterop.GetActiveStaffAsync(parameters?["propertyId"]?.ToString() ?? "");
                    break;
                case "pos.getCategories":
                    responseData = await pmsInterop.GetCategoriesAsync(parameters?["propertyId"]?.ToString() ?? "");
                    break;
                case "pos.getFloorPlans":
                    responseData = await pmsInterop.GetFloorPlansAsync(parameters?["outletId"]?.ToString() ?? "");
                    break;
                case "pos.getTables":
                    responseData = await pmsInterop.GetTablesAsync(parameters?["floorPlanId"]?.ToString() ?? "");
                    break;
                case "pos.getProductModifiers":
                    responseData = await pmsInterop.GetProductModifiersAsync(parameters?["productId"]?.ToString() ?? "");
                    break;
                case "pos.getProductionBatches":
                    responseData = await pmsInterop.GetProductionBatchesAsync(
                        parameters?["outletId"]?.ToString() ?? "",
                        parameters?["station"]?.ToString() ?? "KITCHEN");
                    break;
                case "pos.updateBatchStatus":
                    responseData = await pmsInterop.UpdateBatchStatusAsync(
                        parameters?["batchId"]?.ToString() ?? "",
                        parameters?["status"]?.ToString() ?? "");
                    break;
                case "pos.getSessionContext":
                    responseData = await pmsInterop.GetSessionContextAsync(parameters?["sessionId"]?.ToString() ?? "");
                    break;
                case "pos.getAuthorizedOutlets":
                    responseData = await pmsInterop.GetAuthorizedOutletsAsync(
                        parameters?["propertyId"]?.ToString() ?? "",
                        parameters?["deviceId"]?.ToString() ?? "");
                    break;

                // ── Printer Management ────────────────────────────────────────
                case "hardware.getPrinters":
                    responseData = await pmsInterop.GetPrintersAsync();
                    break;
                case "hardware.savePrinter":
                    responseData = await pmsInterop.SavePrinterAsync(
                        parameters?["config"]?.ToString() ?? "{}");
                    break;
                case "hardware.deletePrinter":
                    responseData = await pmsInterop.DeletePrinterAsync(
                        parameters?["id"]?.ToString() ?? "");
                    break;
                case "hardware.testPrinter":
                    responseData = await pmsInterop.TestPrinterAsync(
                        parameters?["config"]?.ToString() ?? "{}");
                    break;
                case "hardware.getAvailableHardwarePrinters":
                    responseData = await pmsInterop.GetAvailableHardwarePrintersAsync();
                    break;

                default:
                            MainThread.BeginInvokeOnMainThread(() => SendError(sender, id, $"Method {method} not found in allowlist."));
                            return;
                    }

                    // Send success response back to React
                    var responseJson = JsonSerializer.Serialize(new 
                    { 
                        id, 
                        result = responseData != null ? JsonNode.Parse(responseData) : null 
                    });
                    MainThread.BeginInvokeOnMainThread(() => 
                    {
                        try
                        {
                            sender.PostWebMessageAsString(responseJson);
                        }
                        catch (Exception innerEx)
                        {
                            System.Diagnostics.Debug.WriteLine($"Failed to post message: {innerEx.Message}");
                        }
                    });
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"IPC Task Error: {ex.Message}");
                    MainThread.BeginInvokeOnMainThread(() => SendError(sender, id, $"IPC Exception: {ex.Message}"));
                }
            });
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"IPC Error: {ex.Message}");
        }
    }

    private void SendError(Microsoft.Web.WebView2.Core.CoreWebView2 sender, string id, string errorMessage)
    {
        try
        {
            var errorJson = JsonSerializer.Serialize(new { id, error = errorMessage });
            sender.PostWebMessageAsString(errorJson);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to send error: {ex.Message}");
        }
    }
#endif
}

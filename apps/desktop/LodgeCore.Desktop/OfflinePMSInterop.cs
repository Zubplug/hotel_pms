using System.Text.Json;
using LodgeCore.Desktop.Services;
using LodgeCore.Desktop.Security;

namespace LodgeCore.Desktop;

public class OfflinePMSInterop
{
    private readonly LocalRepository _repo;
    private readonly AuthManager _authManager;
    private readonly SessionManager _sessionManager;

    public OfflinePMSInterop(LocalRepository repo, AuthManager authManager, SessionManager sessionManager)
    {
        _repo = repo;
        _authManager = authManager;
        _sessionManager = sessionManager;
    }

    public async Task<string> GetSessionAsync()
    {
        try
        {
            var session = await _authManager.GetSessionAsync();
            return JsonSerializer.Serialize(new { success = true, data = session });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> ProvisionDeviceAsync(string userId, string propertyId, string role, string deviceToken, string[] permissions = null, int sessionVersion = 1)
    {
        try
        {
            await _authManager.ProvisionDeviceAsync(userId, propertyId, role, deviceToken, permissions, sessionVersion);
            return JsonSerializer.Serialize(new { success = true });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> ClearSessionAsync()
    {
        try
        {
            _authManager.ClearAuthData();
            return JsonSerializer.Serialize(new { success = true });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> GetPropertiesAsync()
    {
        try
        {
            var data = await _repo.GetPropertiesAsync();
            return JsonSerializer.Serialize(new { success = true, data });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> GetActiveReservationsAsync()
    {
        try
        {
            var res = await _repo.GetActiveReservationsAsync();
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    private async Task<(string UserId, string DeviceId)> GetSecureContextAsync()
    {
        var session = await _authManager.GetSessionAsync();
        if (session == null) throw new UnauthorizedAccessException("No active desktop session.");
        return (session.UserId, session.DeviceId);
    }

    public async Task<string> AssignRoomAsync(string reservationId, string roomId, string roomNumber)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.AssignRoomAsync(reservationId, roomId, roomNumber, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> CancelReservationAsync(string reservationId)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.CancelReservationAsync(reservationId, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> CheckAvailabilityAsync(string roomNumber, DateTime checkIn, DateTime checkOut)
    {
        try
        {
            var isAvailable = await _repo.IsRoomAvailableAsync(roomNumber, checkIn, checkOut);
            return JsonSerializer.Serialize(new { success = true, isAvailable });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> RecordChargeAsync(string folioId, decimal amount, string description)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.RecordChargeAsync(folioId, amount, description, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> RecordPaymentAsync(string folioId, decimal amount, string method)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.RecordPaymentAsync(folioId, amount, method, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> ProcessCheckInAsync(string reservationId)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.ProcessCheckInAsync(reservationId, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> ProcessCheckOutAsync(string reservationId)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.ProcessCheckOutAsync(reservationId, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> UpdateHousekeepingTaskStatusAsync(string taskId, string status)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.UpdateHousekeepingTaskStatusAsync(taskId, status, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> ResolveMaintenanceTicketAsync(string ticketId)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.ResolveMaintenanceTicketAsync(ticketId, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> GetDashboardAsync(string propertyId)
    {
        try
        {
            var data = await _repo.GetDashboardAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> GetGuestsAsync()
    {
        try
        {
            var data = await _repo.GetGuestsAsync();
            return JsonSerializer.Serialize(new { success = true, data });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> GetRoomTypesAsync(string propertyId)
    {
        try
        {
            var data = await _repo.GetRoomTypesAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> LookupReservationByRoomAsync(string roomNo, string propertyId)
    {
        return JsonSerializer.Serialize(new { success = false, error = "Room lookup is not available in offline mode." });
    }
    public async Task<string> CreateReservationAsync(string dataJson)
    {
        try
        {
            var data = JsonSerializer.Deserialize<LodgeCore.Desktop.Data.Entities.LocalReservation>(dataJson);
            if (data == null) throw new Exception("Invalid reservation data");
            
            var res = await _repo.CreateReservationAsync(data, "System", "Device1");
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> GetRoomsAsync(string propertyId)
    {
        try
        {
            var data = await _repo.GetRoomsAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> GetAvailableRoomsAsync(string propertyId, string roomTypeId, string checkIn, string checkOut)
    {
        try
        {
            var ci = DateTime.Parse(checkIn);
            var co = DateTime.Parse(checkOut);
            var data = await _repo.GetAvailableRoomsAsync(propertyId, roomTypeId, ci, co);
            return JsonSerializer.Serialize(new { success = true, data });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> ExtendStayAsync(string reservationId, string newCheckOutDate)
    {
        return JsonSerializer.Serialize(new { success = true });
    }
    public async Task<string> GetFolioAsync(string folioId)
    {
        return JsonSerializer.Serialize(new { success = true, data = new { } });
    }
    public async Task<string> GetHousekeepingTasksAsync(string propertyId)
    {
        return JsonSerializer.Serialize(new { success = true, data = new object[] { } });
    }
    public async Task<string> GetMaintenanceTicketsAsync(string propertyId)
    {
        return JsonSerializer.Serialize(new { success = true, data = new object[] { } });
    }
    public async Task<string> GenerateReceiptAsync(string folioId)
    {
        return JsonSerializer.Serialize(new { success = true, data = new { } });
    }

    public async Task<string> GetPosProductsAsync(string propertyId)
    {
        try
        {
            var data = await _repo.GetPosProductsAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> CreatePosOrderAsync(string dataJson)
    {
        try
        {
            var order = JsonSerializer.Deserialize<LodgeCore.Desktop.Data.Entities.LocalPosOrder>(dataJson);
            if (order == null) throw new Exception("Invalid order data");
            
            var posCtx = await _sessionManager.GetActiveContextAsync();
            
            // Security: Enforce identity source of truth
            order.PropertyId = posCtx.PropertyId;
            order.OutletId = posCtx.OutletId;
            order.SessionId = posCtx.SessionId;
            order.ServerStaffId = posCtx.StaffId;
            order.CreatedBy = posCtx.StaffId;

            var res = await _repo.CreatePosOrderAsync(order, posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> SplitCheckAsync(string orderId, List<string> itemIds)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            var res = await _repo.SplitCheckAsync(orderId, itemIds, posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> FireKotAsync(string orderId, List<string> itemIds)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            var res = await _repo.FireKotAsync(orderId, itemIds, posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> UpdateOrderStatusAsync(string orderId, string status, string reason)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            var res = await _repo.UpdateOrderStatusAsync(orderId, status, reason, posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> PayOrderAsync(string orderId, string paymentDataJson)
    {
        try
        {
            var paymentData = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentDataJson);
            if (paymentData == null) throw new Exception("Invalid payment data");

            string method = paymentData.ContainsKey("method") ? paymentData["method"].ToString() : "CASH";
            decimal amount = paymentData.ContainsKey("amount") ? decimal.Parse(paymentData["amount"].ToString()) : 0;
            string currency = paymentData.ContainsKey("currency") ? paymentData["currency"].ToString() : "NGN";
            string checkId = paymentData.ContainsKey("checkId") ? paymentData["checkId"]?.ToString() : null;

            var posCtx = await _sessionManager.GetActiveContextAsync();
            var res = await _repo.PayOrderAsync(orderId, method, amount, currency, checkId, posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> GetOrderAsync(string orderId)
    {
        try
        {
            var res = await _repo.GetOrderAsync(orderId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> GetReceiptAsync(string orderId)
    {
        try
        {
            var res = await _repo.GetReceiptAsync(orderId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> GetServerOrdersAsync(string range, string statusFilter, string? sessionId)
    {
        try
        {
            var ctx = await _sessionManager.GetActiveContextAsync();
            var res = await _repo.GetServerOrdersAsync(ctx.StaffId, ctx.PropertyId, range, statusFilter, sessionId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> GetServerSalesAsync(string range, string? sessionId)
    {
        try
        {
            var ctx = await _sessionManager.GetActiveContextAsync();
            var res = await _repo.GetServerSalesAsync(ctx.StaffId, ctx.PropertyId, range, sessionId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> OpenPosSessionAsync(string propertyId, decimal openingBalance)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var res = await _repo.OpenPosSessionAsync(propertyId, openingBalance, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> ClosePosSessionAsync(string sessionId, decimal actualCash, decimal cashPaidOut)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var res = await _repo.ClosePosSessionAsync(sessionId, actualCash, cashPaidOut, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> AuthorizeVoidAsync(string orderId, string orderItemId, string reason, string supervisorPin)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            
            // SECURITY: C# handles authorization, bypassing any UI-level tampering
            var authorizer = await _repo.ValidateSupervisorPinAsync(supervisorPin, posCtx.PropertyId);
            if (authorizer == null)
            {
                return JsonSerializer.Serialize(new { success = false, error = "Invalid supervisor PIN or unauthorized." });
            }

            var res = await _repo.AuthorizeVoidAsync(orderId, orderItemId, reason, authorizer.Id, posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> RecordRefundAsync(string orderId, decimal amount, string method, string supervisorPin)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            
            // SECURITY: Refund authorization
            var authorizer = await _repo.ValidateSupervisorPinAsync(supervisorPin, posCtx.PropertyId);
            if (authorizer == null)
            {
                return JsonSerializer.Serialize(new { success = false, error = "Invalid supervisor PIN or unauthorized." });
            }

            var res = await _repo.RecordRefundAsync(orderId, amount, method, authorizer.Id, posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> AuthorizeCashMovementAsync(string propertyId, string sessionId, decimal amount, string type, string reasonCode, string? notes, string supervisorPin)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            
            // SECURITY: Cash movement authorization
            var authorizer = await _repo.ValidateSupervisorPinAsync(supervisorPin, ctx.PropertyId);
            if (authorizer == null)
            {
                // Log failed attempt if needed, but definitely block
                return JsonSerializer.Serialize(new { success = false, error = "Invalid supervisor PIN or unauthorized." });
            }

            // Create movement
            var res = await _repo.RecordCashMovementAsync(propertyId, sessionId, amount, type, reasonCode, notes, null, authorizer.Id, ctx.UserId, ctx.DeviceId);
            
            // Log authorization explicitly
            await _repo.LogAuthorizationAsync(propertyId, sessionId, ctx.UserId, authorizer.Id, type, reasonCode, res.OperationId, ctx.DeviceId);

            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> LogReceiptPrintAsync(string propertyId, string? orderId, string? sessionId, string type, string? reason, int printCount)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            
            var res = await _repo.RecordReceiptPrintAsync(propertyId, orderId, sessionId, type, reason, printCount, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    private static readonly Dictionary<string, (int Attempts, DateTime LockoutEnd)> _pinFailures = new();

    public async Task<string> AuthenticateOperatorAsync(string staffId, string pin, string propertyId, string sessionId)
    {
        try
        {
            // We ignore propertyId and sessionId from React to ensure security
            var ctx = await _sessionManager.AuthenticateOperatorAsync(staffId, pin);
            var staff = await _repo.GetStaffByIdAsync(staffId);
            
            // Return the OperatorTokenVersion as the secure token to React
            return JsonSerializer.Serialize(new { success = true, data = new { operatorToken = ctx.OperatorTokenVersion, staff } });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> GetActiveStaffAsync(string propertyId)
    {
        try
        {
            var res = await _repo.GetActiveStaffAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> GetFloorPlansAsync(string outletId)
    {
        try
        {
            var res = await _repo.GetFloorPlansAsync(outletId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> GetTablesAsync(string floorPlanId)
    {
        try
        {
            var res = await _repo.GetTablesAsync(floorPlanId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> GetProductModifiersAsync(string productId)
    {
        try
        {
            var res = await _repo.GetProductModifiersAsync(productId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> GetAuthorizedOutletsAsync(string propertyId, string deviceId)
    {
        try
        {
            var res = await _repo.GetAuthorizedOutletsAsync(propertyId, deviceId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> GetSessionContextAsync(string sessionId)
    {
        try
        {
            var session = await _repo.GetSessionContextAsync(sessionId);
            return JsonSerializer.Serialize(new { success = true, data = session });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> GetCurrentOperatorAsync(string sessionId)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var session = await _repo.GetCurrentOperatorSessionAsync(ctx.DeviceId, sessionId);
            return JsonSerializer.Serialize(new { success = true, data = session });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> GetCashMovementsAsync(string sessionId)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            // If they pass null/empty or it's for their own session, we use the active one
            string targetSession = string.IsNullOrEmpty(sessionId) ? posCtx.SessionId : sessionId;
            var movements = await _repo.GetCashMovementsAsync(targetSession);
            return JsonSerializer.Serialize(new { success = true, data = movements });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> GetSessionSettlementDetailsAsync(string sessionId)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            string targetSession = string.IsNullOrEmpty(sessionId) ? posCtx.SessionId : sessionId;
            var (expectedCash, variance) = await _repo.GetSessionSettlementDetailsAsync(targetSession);
            return JsonSerializer.Serialize(new { success = true, data = new { expectedCash, variance } });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> CreateCashMovementAsync(string propertyId, string sessionId, decimal amount, string type, string reasonCode, string? notes, string? receiptReference, string? authorizerId)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            // Enforce identity
            var movement = await _repo.RecordCashMovementAsync(posCtx.PropertyId, posCtx.SessionId, amount, type, reasonCode, notes, receiptReference, authorizerId, posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = movement });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> SettleSessionAsync(string sessionId, decimal actualCash, string operatorId, string? authorizerId)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            // Enforce identity
            var settlement = await _repo.SettleSessionAsync(posCtx.SessionId, actualCash, posCtx.StaffId, authorizerId, posCtx.DeviceId);
            
            // Log out the operator securely after settling
            await _sessionManager.ClearOperatorSessionAsync();
            
            return JsonSerializer.Serialize(new { success = true, data = settlement });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
}

using System.Text.Json;
using LodgeCore.Desktop.Services;

namespace LodgeCore.Desktop;

public class OfflinePMSInterop
{
    private readonly LocalRepository _repo;
    private readonly AuthManager _authManager;

    public OfflinePMSInterop(LocalRepository repo, AuthManager authManager)
    {
        _repo = repo;
        _authManager = authManager;
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
        // Simple placeholder for lookup for now
        return JsonSerializer.Serialize(new { success = true, data = (object)null });
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
            
            var ctx = await GetSecureContextAsync();
            var res = await _repo.CreatePosOrderAsync(order, ctx.UserId, ctx.DeviceId);
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
            var ctx = await GetSecureContextAsync();
            
            // SECURITY: C# handles authorization, bypassing any UI-level tampering
            var authorizer = await _authManager.ValidatePinAsync(supervisorPin);
            if (authorizer == null || authorizer.Role != "MANAGER")
            {
                return JsonSerializer.Serialize(new { success = false, error = "Invalid supervisor PIN or unauthorized." });
            }

            var res = await _repo.AuthorizeVoidAsync(orderId, orderItemId, reason, authorizer.UserId, ctx.UserId, ctx.DeviceId);
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
            var ctx = await GetSecureContextAsync();
            
            // SECURITY: Refund authorization
            var authorizer = await _authManager.ValidatePinAsync(supervisorPin);
            if (authorizer == null || authorizer.Role != "MANAGER")
            {
                return JsonSerializer.Serialize(new { success = false, error = "Invalid supervisor PIN or unauthorized." });
            }

            var res = await _repo.RecordRefundAsync(orderId, amount, method, authorizer.UserId, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    public async Task<string> AuthorizeCashMovementAsync(string propertyId, string sessionId, decimal amount, string type, string reasonCode, string? notes, string supervisorPin)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            
            // SECURITY: Cash movement authorization
            var authorizer = await _authManager.ValidatePinAsync(supervisorPin);
            if (authorizer == null || authorizer.Role != "MANAGER")
            {
                // Log failed attempt if needed, but definitely block
                return JsonSerializer.Serialize(new { success = false, error = "Invalid supervisor PIN or unauthorized." });
            }

            // Create movement
            var res = await _repo.RecordCashMovementAsync(propertyId, sessionId, amount, type, reasonCode, notes, null, authorizer.UserId, ctx.UserId, ctx.DeviceId);
            
            // Log authorization explicitly
            await _repo.LogAuthorizationAsync(propertyId, sessionId, ctx.UserId, authorizer.UserId, type, reasonCode, res.OperationId, ctx.DeviceId);

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
}

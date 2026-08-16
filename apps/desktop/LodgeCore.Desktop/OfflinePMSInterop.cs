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
}

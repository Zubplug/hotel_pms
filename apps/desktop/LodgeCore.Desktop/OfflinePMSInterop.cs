using System.Text.Json;
using LodgeCore.Desktop.Services;

namespace LodgeCore.Desktop;

public class OfflinePMSInterop
{
    private readonly LocalRepository _repo;

    public OfflinePMSInterop(LocalRepository repo)
    {
        _repo = repo;
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
    public async Task<string> AssignRoomAsync(string reservationId, string roomId, string roomNumber, string userId, string deviceId)
    {
        try
        {
            var success = await _repo.AssignRoomAsync(reservationId, roomId, roomNumber, userId, deviceId);
            return JsonSerializer.Serialize(new { success });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> CancelReservationAsync(string reservationId, string userId, string deviceId)
    {
        try
        {
            var success = await _repo.CancelReservationAsync(reservationId, userId, deviceId);
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
    public async Task<string> RecordChargeAsync(string folioId, decimal amount, string description, string userId, string deviceId)
    {
        try
        {
            var success = await _repo.RecordChargeAsync(folioId, amount, description, userId, deviceId);
            return JsonSerializer.Serialize(new { success });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> RecordPaymentAsync(string folioId, decimal amount, string method, string userId, string deviceId)
    {
        try
        {
            var success = await _repo.RecordPaymentAsync(folioId, amount, method, userId, deviceId);
            return JsonSerializer.Serialize(new { success });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> ProcessCheckInAsync(string reservationId, string userId, string deviceId)
    {
        try
        {
            var success = await _repo.ProcessCheckInAsync(reservationId, userId, deviceId);
            return JsonSerializer.Serialize(new { success });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> ProcessCheckOutAsync(string reservationId, string userId, string deviceId)
    {
        try
        {
            var success = await _repo.ProcessCheckOutAsync(reservationId, userId, deviceId);
            return JsonSerializer.Serialize(new { success });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> UpdateHousekeepingTaskStatusAsync(string taskId, string status, string userId, string deviceId)
    {
        try
        {
            var success = await _repo.UpdateHousekeepingTaskStatusAsync(taskId, status, userId, deviceId);
            return JsonSerializer.Serialize(new { success });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
    public async Task<string> ResolveMaintenanceTicketAsync(string ticketId, string userId, string deviceId)
    {
        try
        {
            var success = await _repo.ResolveMaintenanceTicketAsync(ticketId, userId, deviceId);
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

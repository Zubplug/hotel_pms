using System.Text.Json;
using LodgeCore.Desktop.Services;
using Microsoft.JSInterop;

namespace LodgeCore.Desktop;

public class OfflinePMSInterop
{
    private readonly LocalRepository _repo;

    public OfflinePMSInterop(LocalRepository repo)
    {
        _repo = repo;
    }

    [JSInvokable]
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

    [JSInvokable]
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

    [JSInvokable]
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

    [JSInvokable]
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

    [JSInvokable]
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

    [JSInvokable]
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

    [JSInvokable]
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

    [JSInvokable]
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

    [JSInvokable]
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
}

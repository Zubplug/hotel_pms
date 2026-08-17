using System.Text.Json;
using LodgeCore.HardwareAgent.Locks;
using Microsoft.Extensions.DependencyInjection;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using LodgeCore.Desktop.Services;

namespace LodgeCore.Desktop;

public class HardwareInterop
{
    private readonly ILockProvider _lockProvider;
    private readonly AuthManager _authManager;
    private readonly IServiceScopeFactory _scopeFactory;

    public HardwareInterop(ILockProvider lockProvider, AuthManager authManager, IServiceScopeFactory scopeFactory)
    {
        _lockProvider = lockProvider;
        _authManager = authManager;
        _scopeFactory = scopeFactory;
    }

    private async Task<(bool authorized, DesktopSession? session)> EnsureAuthorizedAsync(string requiredPermission)
    {
        var session = await _authManager.GetSessionAsync();
        if (session == null) return (false, null);

        if (session.Permissions.Contains(requiredPermission) || session.Role == "ADMIN")
            return (true, session);
            
        return (false, session);
    }

    private async Task WriteAuditAsync(DesktopSession session, string operation, string? roomId, string? reservationId, bool success, string reason, string? cardSnr = null)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

            var audit = new LocalKeycardAudit
            {
                Id = Guid.NewGuid().ToString(),
                StaffId = session?.UserId ?? "UNKNOWN",
                DeviceId = session?.DeviceId ?? "UNKNOWN",
                PropertyId = session?.PropertyId ?? "UNKNOWN",
                OperationType = operation,
                RoomId = roomId,
                ReservationId = reservationId,
                BusinessDate = DateTime.UtcNow.Date, // Fallback, could grab from LocalRepository
                Timestamp = DateTime.UtcNow,
                Success = success,
                StatusReason = reason,
                CardSnr = cardSnr,
                OperationId = Guid.NewGuid().ToString()
            };

            db.KeycardAudits.Add(audit);
            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            // Failsafe: if audit fails, log it to debug but don't crash the app if possible,
            // though in a strict environment we might want to fail the operation.
            System.Diagnostics.Debug.WriteLine($"Failed to write audit log: {ex.Message}");
        }
    }

    public async Task<string> ReadCardAsync()
    {
        DesktopSession? currentSession = null;
        try
        {
            var (authorized, session) = await EnsureAuthorizedAsync("ACCESS_KEYCARD_READ");
            currentSession = session;
            
            if (!authorized)
            {
                if (currentSession != null) await WriteAuditAsync(currentSession, "READ", null, null, false, "DENIED - Missing ACCESS_KEYCARD_READ");
                return JsonSerializer.Serialize(new { success = false, error = "Unauthorized: Insufficient permissions for reading keycards." });
            }

            var result = await _lockProvider.ReadCardAsync(CancellationToken.None);
            
            await WriteAuditAsync(currentSession, "READ", null, null, result.Success, result.Success ? "SUCCESS" : result.ErrorMessage, result.CardSnr);
            
            return JsonSerializer.Serialize(new { success = result.Success, data = result });
        }
        catch (Exception ex)
        {
            if (currentSession != null) await WriteAuditAsync(currentSession, "READ", null, null, false, $"ERROR - {ex.Message}");
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> EncodeCardAsync(string? roomId, string? providedLockCode, string? reservationId)
    {
        DesktopSession? currentSession = null;
        try
        {
            var (authorized, session) = await EnsureAuthorizedAsync("ACCESS_KEYCARD_ENCODING");
            currentSession = session;

            if (!authorized)
            {
                if (currentSession != null) await WriteAuditAsync(currentSession, "ENCODE", roomId, reservationId, false, "DENIED - Missing ACCESS_KEYCARD_ENCODING");
                return JsonSerializer.Serialize(new { success = false, error = "Unauthorized: Insufficient permissions for encoding keycards." });
            }

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

            // Validate Room
            var room = await db.Rooms.FindAsync(roomId);
            if (room == null || room.PropertyId != currentSession.PropertyId)
            {
                await WriteAuditAsync(currentSession, "ENCODE", roomId, reservationId, false, "DENIED - Room not found or wrong property");
                return JsonSerializer.Serialize(new { success = false, error = "Invalid room." });
            }

            // Determine authoritative lock code
            string authoritativeLockCode = room.LockSystemCode ?? providedLockCode ?? string.Empty;
            if (string.IsNullOrEmpty(authoritativeLockCode))
            {
                await WriteAuditAsync(currentSession, "ENCODE", roomId, reservationId, false, "DENIED - No lock code configured for room");
                return JsonSerializer.Serialize(new { success = false, error = "No lock code configured for this room." });
            }

            // Validate Reservation
            if (!string.IsNullOrEmpty(reservationId))
            {
                var reservation = await db.Reservations.FindAsync(reservationId);
                if (reservation == null || (reservation.Status != "IN_HOUSE" && reservation.Status != "CONFIRMED"))
                {
                    await WriteAuditAsync(currentSession, "ENCODE", roomId, reservationId, false, "DENIED - Reservation invalid or not eligible");
                    return JsonSerializer.Serialize(new { success = false, error = "Reservation is not eligible for a keycard." });
                }
            }
            else 
            {
                await WriteAuditAsync(currentSession, "ENCODE", roomId, reservationId, false, "DENIED - Missing reservation context");
                return JsonSerializer.Serialize(new { success = false, error = "Reservation context is required." });
            }

            // Encode
            var result = await _lockProvider.EncodeCardAsync(authoritativeLockCode, CancellationToken.None);
            
            await WriteAuditAsync(currentSession, "ENCODE", roomId, reservationId, result.Success, result.Success ? "SUCCESS" : result.ErrorMessage, result.CardSnr);

            return JsonSerializer.Serialize(new { success = result.Success, data = result });
        }
        catch (Exception ex)
        {
            if (currentSession != null) await WriteAuditAsync(currentSession, "ENCODE", roomId, reservationId, false, $"ERROR - {ex.Message}");
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> CancelCardAsync()
    {
        DesktopSession? currentSession = null;
        try
        {
            var (authorized, session) = await EnsureAuthorizedAsync("ACCESS_KEYCARD_CANCEL");
            currentSession = session;

            if (!authorized)
            {
                if (currentSession != null) await WriteAuditAsync(currentSession, "CANCEL", null, null, false, "DENIED - Missing ACCESS_KEYCARD_CANCEL");
                return JsonSerializer.Serialize(new { success = false, error = "Unauthorized: Insufficient permissions for cancelling keycards." });
            }

            var result = await _lockProvider.CancelCardAsync(CancellationToken.None);
            
            await WriteAuditAsync(currentSession, "CANCEL", null, null, result.Success, result.Success ? "SUCCESS" : result.ErrorMessage, result.CardSnr);

            return JsonSerializer.Serialize(new { success = result.Success, data = result });
        }
        catch (Exception ex)
        {
            if (currentSession != null) await WriteAuditAsync(currentSession, "CANCEL", null, null, false, $"ERROR - {ex.Message}");
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
}


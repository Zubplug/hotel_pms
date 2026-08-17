using System.Text.Json;
using LodgeCore.HardwareAgent.Locks;
using Microsoft.Extensions.DependencyInjection;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using LodgeCore.Desktop.Services;

namespace LodgeCore.Desktop;

/// <summary>
/// The hardware security boundary. React/IPC is untrusted.
/// All permission checks, reservation validation, and audit logging happen here.
/// </summary>
public class HardwareInterop
{
    private readonly ILockProvider _lockProvider;
    private readonly AuthManager _authManager;
    private readonly IServiceScopeFactory _scopeFactory;

    // Early check-in allowed this many hours before midnight of the check-in date.
    // e.g. 2 hours: a check-in for 2026-08-18 can be encoded from 22:00 on 2026-08-17.
    private const int EarlyCheckinWindowHours = 2;

    public HardwareInterop(ILockProvider lockProvider, AuthManager authManager, IServiceScopeFactory scopeFactory)
    {
        _lockProvider = lockProvider;
        _authManager = authManager;
        _scopeFactory = scopeFactory;
    }

    // -----------------------------------------------------------------------
    // Authorization helper — checks a specific permission, not a role name
    // -----------------------------------------------------------------------
    private async Task<(bool Authorized, DesktopSession? Session)> RequirePermissionAsync(string permission)
    {
        var session = await _authManager.GetSessionAsync();
        if (session == null) return (false, null);

        // ADMIN bypasses all permission checks
        if (session.Role == "ADMIN" || session.Permissions.Contains(permission))
            return (true, session);

        return (false, session);
    }

    // -----------------------------------------------------------------------
    // Immutable audit writer — MUST always succeed silently so the caller
    // doesn't swallow the real result.
    // -----------------------------------------------------------------------
    private async Task WriteAuditAsync(
        DesktopSession? session,
        string operation,
        bool success,
        string statusReason,
        string? roomId = null,
        string? reservationId = null,
        string? cardSnr = null)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

            db.KeycardAudits.Add(new LocalKeycardAudit
            {
                Id = Guid.NewGuid().ToString(),
                OperationId = Guid.NewGuid().ToString(),
                StaffId = session?.UserId ?? "UNKNOWN",
                DeviceId = session?.DeviceId ?? "UNKNOWN",
                PropertyId = session?.PropertyId ?? "UNKNOWN",
                OperationType = operation,
                RoomId = roomId,
                ReservationId = reservationId,
                BusinessDate = DateTime.UtcNow.Date,
                Timestamp = DateTime.UtcNow,
                Success = success,
                StatusReason = statusReason,
                CardSnr = cardSnr,
                SyncStatus = "PENDING"
            });

            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[HardwareInterop] AUDIT WRITE FAILED: {ex.Message}");
        }
    }

    // -----------------------------------------------------------------------
    // READ CARD — requires ACCESS_KEYCARD_READ
    // -----------------------------------------------------------------------
    public async Task<string> ReadCardAsync()
    {
        DesktopSession? session = null;
        try
        {
            (bool authorized, session) = await RequirePermissionAsync("ACCESS_KEYCARD_READ");

            if (!authorized)
            {
                await WriteAuditAsync(session, "READ", false, "DENIED - Missing ACCESS_KEYCARD_READ");
                return Fail("Insufficient permissions to read keycards.");
            }

            var result = await _lockProvider.ReadCardAsync(CancellationToken.None);

            await WriteAuditAsync(session, "READ", result.Success,
                result.Success ? "SUCCESS" : $"HARDWARE_ERROR - {result.ErrorMessage}",
                cardSnr: result.CardSnr);

            return JsonSerializer.Serialize(new { success = result.Success, data = result });
        }
        catch (Exception ex)
        {
            await WriteAuditAsync(session, "READ", false, $"EXCEPTION - {ex.Message}");
            return Fail(ex.Message);
        }
    }

    // -----------------------------------------------------------------------
    // ENCODE CARD — requires ACCESS_KEYCARD_ENCODING
    //
    // React sends:  roomId, lockCode (hint), reservationId
    // C# validates: session → property → room → reservation eligibility
    //               → business date within check-in window
    // C# determines the authoritative lock code independently.
    // -----------------------------------------------------------------------
    public async Task<string> EncodeCardAsync(string? roomId, string? providedLockCode, string? reservationId)
    {
        DesktopSession? session = null;
        try
        {
            (bool authorized, session) = await RequirePermissionAsync("ACCESS_KEYCARD_ENCODING");

            if (!authorized)
            {
                await WriteAuditAsync(session, "ENCODE", false,
                    "DENIED - Missing ACCESS_KEYCARD_ENCODING", roomId, reservationId);
                return Fail("Insufficient permissions to encode keycards.");
            }

            if (string.IsNullOrWhiteSpace(roomId))
            {
                await WriteAuditAsync(session, "ENCODE", false, "DENIED - roomId not provided", roomId, reservationId);
                return Fail("Room context is required.");
            }

            if (string.IsNullOrWhiteSpace(reservationId))
            {
                await WriteAuditAsync(session, "ENCODE", false, "DENIED - reservationId not provided", roomId, reservationId);
                return Fail("Reservation context is required.");
            }

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

            // ---- 1. Validate Room belongs to this session's property --------
            var room = await db.Rooms.FindAsync(roomId);
            if (room == null || room.PropertyId != session!.PropertyId)
            {
                await WriteAuditAsync(session, "ENCODE", false,
                    "DENIED - Room not found or belongs to different property", roomId, reservationId);
                return Fail("Invalid room.");
            }

            // ---- 2. Validate Reservation exists + belongs to this property --
            var reservation = await db.Reservations.FindAsync(reservationId);
            if (reservation == null || reservation.PropertyId != session.PropertyId)
            {
                await WriteAuditAsync(session, "ENCODE", false,
                    "DENIED - Reservation not found or belongs to different property", roomId, reservationId);
                return Fail("Reservation not found.");
            }

            // ---- 3. Validate Reservation is assigned to this room -----------
            if (reservation.RoomId != roomId)
            {
                await WriteAuditAsync(session, "ENCODE", false,
                    $"DENIED - Reservation {reservationId} is not assigned to room {roomId}", roomId, reservationId);
                return Fail("This reservation is not assigned to the requested room.");
            }

            // ---- 4. Validate Reservation status ----
            // Only allow CHECKED_IN (already in-house) or PENDING (arriving today within window).
            // CONFIRMED is intentionally NOT allowed — it covers future dates.
            var validStatuses = new[] { "CHECKED_IN", "PENDING" };
            if (!validStatuses.Contains(reservation.Status))
            {
                await WriteAuditAsync(session, "ENCODE", false,
                    $"DENIED - Reservation status '{reservation.Status}' is not eligible for keycard encoding",
                    roomId, reservationId);
                return Fail($"Reservation is not eligible for a keycard (status: {reservation.Status}).");
            }

            // ---- 5. Validate check-in date window ---------------------------
            // If the reservation is PENDING (not yet checked in), enforce that we are
            // within the early-check-in window on the actual check-in date.
            if (reservation.Status == "PENDING")
            {
                var now = DateTime.UtcNow;
                var windowStart = reservation.CheckInDate.Date.AddHours(-EarlyCheckinWindowHours);
                var windowEnd = reservation.CheckOutDate.Date; // midnight of checkout day = cannot encode on or after checkout

                if (now < windowStart)
                {
                    await WriteAuditAsync(session, "ENCODE", false,
                        $"DENIED - Too early for check-in window (CheckIn: {reservation.CheckInDate:yyyy-MM-dd}, Window opens: {windowStart:yyyy-MM-dd HH:mm} UTC)",
                        roomId, reservationId);
                    return Fail("It is too early to issue a room key for this reservation.");
                }

                if (now >= windowEnd)
                {
                    await WriteAuditAsync(session, "ENCODE", false,
                        $"DENIED - Check-out date has passed (CheckOut: {reservation.CheckOutDate:yyyy-MM-dd})",
                        roomId, reservationId);
                    return Fail("The check-out date has passed for this reservation.");
                }
            }

            // ---- 6. Determine authoritative lock code -----------------------
            // Priority:  1. room.LockSystemCode (vendor code synced from the cloud)
            //            2. providedLockCode     (UI hint — only trusted as a fallback)
            //            3. room.Number          (room number as raw hardware address)
            string authoritativeLockCode =
                !string.IsNullOrWhiteSpace(room.LockSystemCode) ? room.LockSystemCode :
                !string.IsNullOrWhiteSpace(providedLockCode)   ? providedLockCode :
                room.Number;

            if (string.IsNullOrWhiteSpace(authoritativeLockCode))
            {
                await WriteAuditAsync(session, "ENCODE", false,
                    "DENIED - Could not determine lock code for room", roomId, reservationId);
                return Fail("No lock code is configured for this room.");
            }

            // ---- 7. Encode --------------------------------------------------
            var result = await _lockProvider.EncodeCardAsync(authoritativeLockCode, CancellationToken.None);

            // LockResult does not carry a CardSnr — only ReadCardResult does.
            // To capture the SNR we would need a read-after-encode step from the vendor SDK.
            await WriteAuditAsync(session, "ENCODE", result.Success,
                result.Success ? "SUCCESS" : $"HARDWARE_ERROR - {result.ErrorMessage}",
                roomId, reservationId, cardSnr: null);

            return JsonSerializer.Serialize(new { success = result.Success, data = result });
        }
        catch (Exception ex)
        {
            await WriteAuditAsync(session, "ENCODE", false, $"EXCEPTION - {ex.Message}", roomId, reservationId);
            return Fail(ex.Message);
        }
    }

    // -----------------------------------------------------------------------
    // CANCEL CARD — requires ACCESS_KEYCARD_CANCEL
    // This is independently gated. Being able to encode does not imply cancel.
    // -----------------------------------------------------------------------
    public async Task<string> CancelCardAsync()
    {
        DesktopSession? session = null;
        try
        {
            (bool authorized, session) = await RequirePermissionAsync("ACCESS_KEYCARD_CANCEL");

            if (!authorized)
            {
                await WriteAuditAsync(session, "CANCEL", false, "DENIED - Missing ACCESS_KEYCARD_CANCEL");
                return Fail("Insufficient permissions to cancel keycards.");
            }

            var result = await _lockProvider.CancelCardAsync(CancellationToken.None);

            await WriteAuditAsync(session, "CANCEL", result.Success,
                result.Success ? "SUCCESS" : $"HARDWARE_ERROR - {result.ErrorMessage}");

            return JsonSerializer.Serialize(new { success = result.Success, data = result });
        }
        catch (Exception ex)
        {
            await WriteAuditAsync(session, "CANCEL", false, $"EXCEPTION - {ex.Message}");
            return Fail(ex.Message);
        }
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------
    private static string Fail(string message)
        => JsonSerializer.Serialize(new { success = false, error = message });
}

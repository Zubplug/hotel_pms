using System.Text.Json;
using LodgeCore.HardwareAgent.Locks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using LodgeCore.Desktop.Services;

namespace LodgeCore.Desktop;

/// <summary>
/// The hardware security boundary. React/IPC input is always treated as untrusted.
///
/// Every encode/read/cancel request must pass through this class.
/// No path to the USB encoder exists outside of this class.
///
/// Authorization pipeline for encoding:
///   1. Authenticated session exists
///   2. Staff has ACCESS_KEYCARD_ENCODING
///   3. Room belongs to this session's property
///   4. Reservation exists and belongs to this property
///   5. Reservation is assigned to the requested room
///   6. Reservation status is eligible (CHECKED_IN or PENDING within window)
///   7. If PENDING: current hotel-local time is within permitted check-in window
///      (window size and timezone come from the LocalProperty record, not hardcoded)
///   8. Lock code is resolved from the trusted room record
///   9. Physical encode is attempted
///  10. Immutable audit record is written regardless of outcome
/// </summary>
public class HardwareInterop
{
    private static readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private readonly ILockProvider _lockProvider;
    private readonly AuthManager _authManager;
    private readonly IServiceScopeFactory _scopeFactory;

    public HardwareInterop(
        ILockProvider lockProvider,
        AuthManager authManager,
        IServiceScopeFactory scopeFactory)
    {
        _lockProvider = lockProvider;
        _authManager = authManager;
        _scopeFactory = scopeFactory;
    }

    // -----------------------------------------------------------------------
    // Permission gate — role-independent, permission-name driven
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
    // Timezone helper
    //
    // MAUI on Windows uses Windows timezone IDs (e.g. "W. Central Africa Standard Time").
    // IANA IDs (e.g. "Africa/Lagos") are valid on Linux/macOS.
    // TimeZoneInfo.FindSystemTimeZoneById handles both on .NET 6+ when the
    // tzdata package is present, but to be safe we fall back to UTC on failure.
    // -----------------------------------------------------------------------
    private static TimeZoneInfo ResolveTimezone(string? ianaOrWindowsId)
    {
        if (string.IsNullOrWhiteSpace(ianaOrWindowsId))
            return TimeZoneInfo.Utc;

        try { return TimeZoneInfo.FindSystemTimeZoneById(ianaOrWindowsId); }
        catch { /* try IANA → Windows conversion for older runtimes */ }

        try
        {
            if (TimeZoneInfo.TryConvertIanaIdToWindowsId(ianaOrWindowsId, out var windowsId))
                return TimeZoneInfo.FindSystemTimeZoneById(windowsId);
        }
        catch { }

        System.Diagnostics.Debug.WriteLine(
            $"[HardwareInterop] Unknown timezone '{ianaOrWindowsId}', falling back to UTC.");

        return TimeZoneInfo.Utc;
    }

    // -----------------------------------------------------------------------
    // Property loader — resolves timezone and window size from the local DB
    // -----------------------------------------------------------------------
    private async Task<LocalProperty?> GetPropertyAsync(LocalDbContext db, string propertyId)
        => await db.Properties.FirstOrDefaultAsync(p => p.Id == propertyId);

    // -----------------------------------------------------------------------
    // Immutable audit — always succeeds silently so it never suppresses the
    // real operation result.
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
                Id          = Guid.NewGuid().ToString(),
                OperationId = Guid.NewGuid().ToString(),
                StaffId     = session?.UserId   ?? "UNKNOWN",
                DeviceId    = session?.DeviceId  ?? "UNKNOWN",
                PropertyId  = session?.PropertyId ?? "UNKNOWN",
                OperationType  = operation,
                RoomId         = roomId,
                ReservationId  = reservationId,
                BusinessDate   = DateTime.UtcNow.Date,
                Timestamp      = DateTime.UtcNow,
                Success        = success,
                StatusReason   = statusReason,
                CardSnr        = cardSnr,
                SyncStatus     = "PENDING"
            });

            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            // Audit failure is logged but must not propagate — the caller's
            // success/failure path is more important than a secondary write.
            System.Diagnostics.Debug.WriteLine(
                $"[HardwareInterop] AUDIT WRITE FAILED: {ex.Message}");
        }
    }

    // -----------------------------------------------------------------------
    // READ CARD — requires ACCESS_KEYCARD_READ
    // Independently gated; ENCODE permission does not imply READ.
    // -----------------------------------------------------------------------
    public async Task<string> ReadCardAsync()
    {
        DesktopSession? session = null;
        try
        {
            (bool authorized, session) = await RequirePermissionAsync("ACCESS_KEYCARD_READ");

            if (!authorized)
            {
                await WriteAuditAsync(session, "READ", false,
                    "DENIED - Missing ACCESS_KEYCARD_READ");
                return Fail("Insufficient permissions to read keycards.");
            }

            var result = await _lockProvider.ReadCardAsync(CancellationToken.None);

            // ReadCardResult carries a CardSnr; LockResult does not.
            await WriteAuditAsync(session, "READ", result.Success,
                result.Success
                    ? "SUCCESS"
                    : $"HARDWARE_ERROR - {result.ErrorMessage}",
                cardSnr: result.CardSnr);

            return JsonSerializer.Serialize(new { success = result.Success, data = result }, _jsonOptions);
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
    // React sends:  roomId, lockCode (untrusted hint), reservationId
    // C# validates: session → permission → property → room → reservation
    //               → room/reservation match → status eligibility
    //               → hotel-timezone-aware check-in window
    //               → authoritative lock code resolution
    // -----------------------------------------------------------------------
    public async Task<string> EncodeCardAsync(
        string? roomId,
        string? providedLockCode,
        string? reservationId)
    {
        DesktopSession? session = null;
        try
        {
            // ---- 0. Auth & permission -------------------------------------
            (bool authorized, session) = await RequirePermissionAsync("ACCESS_KEYCARD_ENCODING");

            if (!authorized)
            {
                await WriteAuditAsync(session, "ENCODE", false,
                    "DENIED - Missing ACCESS_KEYCARD_ENCODING", roomId, reservationId);
                return Fail("Insufficient permissions to encode keycards.");
            }

            // ---- Input presence guards ------------------------------------
            if (string.IsNullOrWhiteSpace(roomId))
            {
                await WriteAuditAsync(session, "ENCODE", false,
                    "DENIED - roomId not provided", roomId, reservationId);
                return Fail("Room context is required.");
            }

            if (string.IsNullOrWhiteSpace(reservationId))
            {
                await WriteAuditAsync(session, "ENCODE", false,
                    "DENIED - reservationId not provided", roomId, reservationId);
                return Fail("Reservation context is required.");
            }

            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<LocalDbContext>();

            // ---- 1. Load property (timezone + window config) ---------------
            var property = await GetPropertyAsync(db, session!.PropertyId);
            if (property == null)
            {
                await WriteAuditAsync(session, "ENCODE", false,
                    "DENIED - Property not found in local database", roomId, reservationId);
                return Fail("Property configuration not available.");
            }

            var hotelTz       = ResolveTimezone(property.Timezone);
            var earlyWindowHrs = property.EarlyCheckinWindowHours; // configurable per property

            // ---- 2. Validate Room ------------------------------------------
            var room = await db.Rooms.FindAsync(roomId);
            if (room == null || room.PropertyId != session.PropertyId)
            {
                await WriteAuditAsync(session, "ENCODE", false,
                    "DENIED - Room not found or belongs to a different property",
                    roomId, reservationId);
                return Fail("Invalid room.");
            }

            // ---- 3. Validate Reservation -----------------------------------
            var reservation = await db.Reservations.FindAsync(reservationId);
            if (reservation == null || reservation.PropertyId != session.PropertyId)
            {
                await WriteAuditAsync(session, "ENCODE", false,
                    "DENIED - Reservation not found or belongs to a different property",
                    roomId, reservationId);
                return Fail("Reservation not found.");
            }

            // ---- 4. Verify room/reservation assignment ---------------------
            if (reservation.RoomId != roomId)
            {
                await WriteAuditAsync(session, "ENCODE", false,
                    $"DENIED - Reservation {reservationId} is not assigned to room {roomId} " +
                    $"(assigned to: {reservation.RoomId ?? "none"})",
                    roomId, reservationId);
                return Fail("This reservation is not assigned to the requested room.");
            }

            // ---- 5. Status eligibility ------------------------------------
            //
            // CHECKED_IN → guest already in-house: always allowed
            // PENDING    → arriving guest:          allowed only within window (step 6)
            //
            // CONFIRMED (future), CANCELLED, CHECKED_OUT → explicitly denied.
            // We do NOT include CONFIRMED here. A reservation booked for next month
            // is CONFIRMED, and should never produce a room key.
            if (reservation.Status != "CHECKED_IN" && reservation.Status != "PENDING")
            {
                await WriteAuditAsync(session, "ENCODE", false,
                    $"DENIED - Reservation status '{reservation.Status}' is not eligible " +
                    $"(must be CHECKED_IN or PENDING within check-in window)",
                    roomId, reservationId);
                return Fail(
                    $"Reservation is not eligible for a keycard " +
                    $"(status: {reservation.Status}).");
            }

            // ---- 6. Hotel-timezone check-in window (PENDING only) ---------
            //
            // We compare the current moment in HOTEL LOCAL TIME against the
            // reservation's CheckInDate and CheckOutDate.
            //
            // Window:
            //   earliest = midnight of CheckInDate  -  earlyWindowHrs
            //   latest   = midnight of CheckOutDate  (exclusive)
            //
            // Example (hotel in Lagos, UTC+1, window = 2h):
            //   Reservation: 2026-08-18 → 2026-08-21
            //   earliest = 2026-08-17 22:00 Lagos local time
            //   latest   = 2026-08-21 00:00 Lagos local time
            //
            if (reservation.Status == "PENDING")
            {
                // CheckInDate and CheckOutDate are stored as dates without time-of-day.
                // We treat them as midnight of that date in hotel local time.
                var checkInMidnightLocal  = new DateTimeOffset(
                    reservation.CheckInDate.Date,
                    hotelTz.GetUtcOffset(reservation.CheckInDate.Date));

                var checkOutMidnightLocal = new DateTimeOffset(
                    reservation.CheckOutDate.Date,
                    hotelTz.GetUtcOffset(reservation.CheckOutDate.Date));

                var windowOpenLocal  = checkInMidnightLocal.AddHours(-earlyWindowHrs);
                var nowUtc           = DateTimeOffset.UtcNow;

                if (nowUtc < windowOpenLocal)
                {
                    var opensAt = TimeZoneInfo.ConvertTime(windowOpenLocal, hotelTz);
                    await WriteAuditAsync(session, "ENCODE", false,
                        $"DENIED - Too early for check-in window. " +
                        $"Window opens: {opensAt:yyyy-MM-dd HH:mm} {hotelTz.StandardName}",
                        roomId, reservationId);
                    return Fail(
                        $"It is too early to issue a room key. " +
                        $"Check-in window opens at {opensAt:HH:mm} on " +
                        $"{opensAt:yyyy-MM-dd} (hotel local time).");
                }

                if (nowUtc >= checkOutMidnightLocal)
                {
                    await WriteAuditAsync(session, "ENCODE", false,
                        $"DENIED - Check-out date has passed " +
                        $"(CheckOut: {reservation.CheckOutDate:yyyy-MM-dd})",
                        roomId, reservationId);
                    return Fail(
                        $"The check-out date ({reservation.CheckOutDate:yyyy-MM-dd}) " +
                        $"has already passed for this reservation.");
                }
            }

            // ---- 7. Authoritative lock code --------------------------------
            //
            // Priority:
            //   1. room.LockSystemCode   — vendor code synced from the cloud (most trusted)
            //   2. providedLockCode      — UI hint (accepted only if room has no vendor code)
            //   3. room.Number           — room number as hardware address of last resort
            //
            // We never blindly trust the UI value when a local authoritative value exists.
            string lockCode =
                !string.IsNullOrWhiteSpace(room.LockSystemCode) ? room.LockSystemCode  :
                !string.IsNullOrWhiteSpace(providedLockCode)    ? providedLockCode      :
                room.Number;

            if (string.IsNullOrWhiteSpace(lockCode))
            {
                await WriteAuditAsync(session, "ENCODE", false,
                    "DENIED - No lock code could be resolved for this room",
                    roomId, reservationId);
                return Fail("No lock code is configured for this room.");
            }

            // ---- 8. Calculate physical validity dates ----------------------
            // Check-in time is right now.
            var encodeNowUtc = DateTimeOffset.UtcNow;
            var nowLocal = TimeZoneInfo.ConvertTime(encodeNowUtc, hotelTz).DateTime;

            // Check-out time defaults to 12:00 PM on the check-out date in local time
            var checkOutLocal = new DateTime(
                reservation.CheckOutDate.Year,
                reservation.CheckOutDate.Month,
                reservation.CheckOutDate.Day,
                12, 0, 0);

            // ---- 9. Physical encode ----------------------------------------
            var encodeResult = await _lockProvider.EncodeCardAsync(lockCode, nowLocal, checkOutLocal, CancellationToken.None);

            // LockResult does not carry CardSnr — only ReadCardResult does.
            // CardSnr is captured on read, not on write, by the hardware SDK.
            await WriteAuditAsync(session, "ENCODE",
                encodeResult.Success,
                encodeResult.Success
                    ? $"SUCCESS - lock_code_source=" +
                      (!string.IsNullOrWhiteSpace(room.LockSystemCode) ? "ROOM_RECORD" :
                       !string.IsNullOrWhiteSpace(providedLockCode)    ? "UI_HINT"     :
                       "ROOM_NUMBER")
                    : $"HARDWARE_ERROR - {encodeResult.ErrorMessage}",
                roomId, reservationId);

            return JsonSerializer.Serialize(new { success = encodeResult.Success, data = encodeResult }, _jsonOptions);
        }
        catch (Exception ex)
        {
            await WriteAuditAsync(session, "ENCODE", false,
                $"EXCEPTION - {ex.Message}", roomId, reservationId);
            return Fail(ex.Message);
        }
    }

    // -----------------------------------------------------------------------
    // CANCEL CARD — requires ACCESS_KEYCARD_CANCEL
    // Independently gated; ENCODE permission does not imply CANCEL.
    // -----------------------------------------------------------------------
    public async Task<string> CancelCardAsync()
    {
        DesktopSession? session = null;
        try
        {
            (bool authorized, session) = await RequirePermissionAsync("ACCESS_KEYCARD_CANCEL");

            if (!authorized)
            {
                await WriteAuditAsync(session, "CANCEL", false,
                    "DENIED - Missing ACCESS_KEYCARD_CANCEL");
                return Fail("Insufficient permissions to cancel keycards.");
            }

            var result = await _lockProvider.CancelCardAsync(CancellationToken.None);

            // CancelCardAsync returns LockResult — no CardSnr available.
            await WriteAuditAsync(session, "CANCEL",
                result.Success,
                result.Success
                    ? "SUCCESS"
                    : $"HARDWARE_ERROR - {result.ErrorMessage}");

            return JsonSerializer.Serialize(new { success = result.Success, data = result }, _jsonOptions);
        }
        catch (Exception ex)
        {
            await WriteAuditAsync(session, "CANCEL", false, $"EXCEPTION - {ex.Message}");
            return Fail(ex.Message);
        }
    }

    // -----------------------------------------------------------------------
    private static string Fail(string message)
        => JsonSerializer.Serialize(new { success = false, error = message }, _jsonOptions);
}

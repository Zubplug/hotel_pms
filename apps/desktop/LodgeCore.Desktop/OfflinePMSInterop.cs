using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using LodgeCore.Desktop.Services;
using LodgeCore.Desktop.Security;
using Microsoft.EntityFrameworkCore;

namespace LodgeCore.Desktop;

public class OfflinePMSInterop
{
    private readonly LocalRepository _repo;
    private readonly AuthManager _authManager;
    private readonly SessionManager _sessionManager;
    private readonly TerminalBootstrapService _terminalBootstrap;
    private readonly EscPosService _escPos;
    private readonly DesktopServiceManager _serviceManager;

    public OfflinePMSInterop(LocalRepository repo, AuthManager authManager, SessionManager sessionManager, TerminalBootstrapService terminalBootstrap, EscPosService escPos, DesktopServiceManager serviceManager)
    {
        _repo = repo;
        _authManager = authManager;
        _sessionManager = sessionManager;
        _terminalBootstrap = terminalBootstrap;
        _escPos = escPos;
        _serviceManager = serviceManager;
    }

    private readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions 
    { 
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles
    };

    public async Task<string> GetTerminalStatusAsync()
    {
        try
        {
            var status = await _terminalBootstrap.GetTerminalStatusAsync();
            return JsonSerializer.Serialize(status, _jsonOptions); // We just return it directly since the wrapper expects this shape
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { registrationState = "UNKNOWN", error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> ProvisionTerminalAsync(string email, string password, string propertyId, string outletId, string terminalName, string terminalType)
    {
        try
        {
            var result = await _terminalBootstrap.ProvisionTerminalAsync(email, password, propertyId, outletId, terminalName, terminalType);
            return JsonSerializer.Serialize(result, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetSessionAsync()
    {
        try
        {
            var session = await _authManager.GetSessionAsync();
            if (session == null) return JsonSerializer.Serialize(new { success = true, data = (object?)null }, _jsonOptions);

            var staff = await _repo.GetStaffByIdAsync(session.UserId);
            var displayName = staff != null ? $"{staff.FirstName} {staff.LastName}".Trim() : session.UserId;
            var email = string.Empty;

            var enrichedSession = new
            {
                session.SessionId,
                session.UserId,
                session.DeviceId,
                session.PropertyId,
                session.Role,
                session.Permissions,
                session.ExpiresAt,
                session.CreatedAt,
                session.LastOnlineValidationAt,
                session.SessionVersion,
                DisplayName = displayName,
                Email = email
            };

            return JsonSerializer.Serialize(new { success = true, data = enrichedSession }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> ForceSyncAsync()
    {
        try
        {
            if (SyncEngine.Instance != null)
            {
                SyncEngine.Instance.TriggerManualSync();
                return JsonSerializer.Serialize(new { success = true }, _jsonOptions);
            }
            return JsonSerializer.Serialize(new { success = false, error = "SyncEngine not running" }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetServiceHealthAsync()
    {
        try
        {
            var health = _serviceManager.GetServiceHealth();
            
            // Map our ServiceState enum to strings matching frontend expectation
            var mappedHealth = new Dictionary<string, object>();
            foreach(var kvp in health)
            {
                mappedHealth[kvp.Key] = new {
                    state = kvp.Value.ToString(),
                    lastError = kvp.Value == ServiceState.Error ? "Service failed during startup or operation" : null
                };
            }

            return JsonSerializer.Serialize(new { success = true, services = mappedHealth }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetSyncHealthAsync()
    {
        try
        {
            if (SyncEngine.Instance != null)
            {
                var health = SyncEngine.Instance.GetCurrentHealth();
                // Ensure Enums are serialized as strings
                var options = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
                options.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
                return JsonSerializer.Serialize(new { success = true, data = health }, options);
            }
            return JsonSerializer.Serialize(new { success = false, error = "SyncEngine not running" }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> PrintShiftReportAsync(string dataJson)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            await _repo.LogHardwareEventAsync(ctx.UserId, ctx.DeviceId, "POS_SHIFT_REPORT_PRINT", dataJson);
            
            var report = JsonSerializer.Deserialize<ShiftReportData>(
                dataJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            );

            if (report == null)
                return JsonSerializer.Serialize(new { success = false, error = "Invalid shift report data" }, _jsonOptions);

            var (success, error) = await _escPos.PrintShiftReportAsync(report, ctx.OutletId);
            
            return JsonSerializer.Serialize(new { success, error }, _jsonOptions);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error printing shift report: {ex.Message}");
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> ProvisionDeviceAsync(string deviceToken)
    {
        try
        {
            await _authManager.StoreDeviceTokenAsync(deviceToken);
            return JsonSerializer.Serialize(new { success = true }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetActiveStaffAsync()
    {
        try
        {
            // Desktop usually operates for the property it was provisioned to.
            // If offline, returning all synced staff is usually fine.
            var session = await _authManager.GetSessionAsync();
            var propertyId = session?.PropertyId;
            
            System.Diagnostics.Debug.WriteLine($"[GetActiveStaffAsync] Called. Session propertyId: {propertyId}");
            
            if (string.IsNullOrEmpty(propertyId))
            {
                var termStatus = await _terminalBootstrap.GetTerminalStatusAsync() as dynamic;
                propertyId = termStatus?.propertyId;
                
                if (string.IsNullOrEmpty(propertyId))
                {
                    var properties = await _repo.GetPropertiesAsync();
                    propertyId = properties?.FirstOrDefault()?.Id ?? "";
                }
                
                System.Diagnostics.Debug.WriteLine($"[GetActiveStaffAsync] Fallback propertyId: {propertyId}");
            }
            
            var staff = await _repo.GetActiveStaffAsync(propertyId);
            System.Diagnostics.Debug.WriteLine($"[GetActiveStaffAsync] Retrieved {staff?.Count ?? 0} staff members from local database.");
            
            // SECURITY: Never expose PosPinHash or sensitive sync fields to the React UI
            var safeStaff = (staff ?? new List<LodgeCore.Desktop.Data.Entities.LocalStaff>()).Select(s => new
            {
                s.Id,
                s.FirstName,
                s.LastName,
                s.Role,
                s.IsActive,
                s.HasPosAccess
                // PermissionsJson is also intentionally omitted; React relies on DesktopSession role
            });

            return JsonSerializer.Serialize(new { success = true, data = safeStaff }, _jsonOptions);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[GetActiveStaffAsync] Exception: {ex}");
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> LoginAsync(string staffId, string pin, string? bankingModel = null)
    {
        try
        {
            var staff = await _repo.AuthenticateDesktopUserAsync(staffId, pin);
            if (staff == null)
            {
                return JsonSerializer.Serialize(new { success = false, error = "Invalid PIN" }, _jsonOptions);
            }

            var session = await _authManager.GetSessionAsync();
            var propertyId = session?.PropertyId ?? staff.PropertyId;

            string[] permissions = Array.Empty<string>();
            try
            {
                if (!string.IsNullOrEmpty(staff.PermissionsJson))
                {
                    permissions = JsonSerializer.Deserialize<string[]>(staff.PermissionsJson) ?? Array.Empty<string>();
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to parse permissions: {ex.Message}");
            }

            // Generate trusted session from the database
            await _authManager.CreateDesktopSessionAsync(
                staff.Id, 
                propertyId, 
                staff.Role, 
                permissions,
                staff.PosTokenVersion
            );
            if (staff.HasPosAccess)
            {
                await _sessionManager.EstablishOperatorContextAsync(staff.Id);
            }

            var property = await _repo.GetPropertyAsync(propertyId);
            var actualBankingModel = property?.BankingModel ?? "CENTRAL_CASHIER";

            string? posSessionId = null;
            bool requiresBank = false;
            string? bankOwner = null;

            var terminal = session != null ? await _repo.GetTerminalAsync(session.DeviceId) : await _repo.GetLocalTerminalAsync();

            if (terminal != null)
            {
                if (actualBankingModel == "SERVER_BANKING")
                {
                    var openSession = await _repo.GetActiveServerBankAsync(staff.Id, propertyId, terminal.OutletId);
                    if (openSession != null)
                    {
                        posSessionId = openSession.Id;
                    }
                }
                else
                {
                    var openSession = await _repo.GetActiveSessionForDeviceAsync(terminal.Id);
                    if (openSession != null)
                    {
                        posSessionId = openSession.Id;
                    }
                    else
                    {
                        requiresBank = true;
                        bankOwner = "MANAGER";
                    }
                }
            }


            return JsonSerializer.Serialize(new { 
                success = true, 
                posSessionId, 
                bankingModel = actualBankingModel,
                requiresBank,
                bankOwner
            }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> StartEmergencyBankAsync(string pin, string reason, string operatorToken)
    {
        try
        {
            var desktopSession = await _authManager.GetSessionAsync();
            if (desktopSession == null) throw new Exception("No active terminal session.");

            var property = await _repo.GetPropertyAsync(desktopSession.PropertyId);
            if (property == null) throw new Exception("Property not found.");
            
            // Validate property is in CENTRAL_CASHIER mode
            if (property.BankingModel != PosConstants.BankingModels.CentralCashier)
            {
                return JsonSerializer.Serialize(new { success = false, error = "Emergency override is only applicable in Station Banking (Central Cashier) mode." }, _jsonOptions);
            }

            // Authenticate the Manager PIN
            var managerRes = await _repo.ValidateSupervisorPinAsync(pin, desktopSession.PropertyId);
            if (managerRes == null)
            {
                return JsonSerializer.Serialize(new { success = false, error = "Invalid manager PIN." }, _jsonOptions);
            }

            // Validate reason
            if (string.IsNullOrWhiteSpace(reason) || reason.Length < 5)
            {
                return JsonSerializer.Serialize(new { success = false, error = "A descriptive reason is required." }, _jsonOptions);
            }

            // Get the primary operator's ID from operatorToken
            // In the desktop app, the primary operator session is managed by SessionManager.
            var posCtx = await _sessionManager.GetActiveContextAsync();
            
            string primaryOperatorId = posCtx.StaffId;
            if (string.IsNullOrEmpty(primaryOperatorId)) {
                return JsonSerializer.Serialize(new { success = false, error = "Invalid primary operator ID." }, _jsonOptions);
            }

            string posSessionId = await _repo.EnsureEmergencyBankAsync(
                managerId: managerRes.Id, 
                managerName: $"{managerRes.FirstName} {managerRes.LastName}",
                primaryOperatorId: primaryOperatorId, 
                deviceId: desktopSession.DeviceId, 
                outletId: posCtx.OutletId ?? "", 
                propertyId: property.Id, 
                reason: reason
            );

            return JsonSerializer.Serialize(new { success = true, posSessionId }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> ClearSessionAsync()
    {
        try
        {
            _authManager.ClearAuthData();
            return JsonSerializer.Serialize(new { success = true }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> LockSessionAsync()
    {
        // For the desktop POS, locking is identical to clearing the operator session
        // without unprovisioning the terminal.
        return await ClearSessionAsync();
    }

    public async Task<string> GetPropertiesAsync()
    {
        try
        {
            var data = await _repo.GetPropertiesAsync();
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetOutboxEventsAsync()
    {
        try
        {
            var res = await _repo.GetOutboxEventsAsync();
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetRefundRequestsAsync(string propertyId)
    {
        try
        {
            var data = await _repo.GetRefundRequestsAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> RequestRefundAsync(string payloadJson)
    {
        try
        {
            var payload = JsonNode.Parse(payloadJson)?.AsObject() ?? throw new Exception("Invalid refund request");
            var ctx = await GetSecureContextAsync();
            var request = await _repo.QueueRefundRequestAsync(payload["paymentId"]?.ToString() ?? "", payload["propertyId"]?.ToString() ?? "", payload["reservationId"]?.ToString() ?? "", payload["folioId"]?.ToString() ?? "", payload["amount"]?.GetValue<decimal>() ?? 0, payload["currency"]?.ToString() ?? "NGN", payload["category"]?.ToString() ?? "MANUAL_ADJUSTMENT", payload["reducedStayNights"]?.GetValue<int>() ?? 0, payload["reason"]?.ToString() ?? "", payload["refundMethod"]?.ToString() ?? "ORIGINAL_PAYMENT", payload["bankAccountName"]?.ToString(), payload["bankAccountNumber"]?.ToString(), payload["bankName"]?.ToString(), payload["bankCode"]?.ToString(), ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = request }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetSyncEventsAsync()
    {
        try
        {
            var res = await _repo.GetSyncEventsAsync();
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetActiveReservationsAsync()
    {
        try
        {
            var res = await _repo.GetActiveReservationsAsync();
            var roomTypes = (await _repo.GetRoomTypesAsync(string.Empty))
                .GroupBy(roomType => roomType.Id)
                .ToDictionary(group => group.Key, group => group.First().Name);
            var mapped = res.Select(r =>
            {
                var guestId = r.Guest?.Id ?? r.GuestId ?? "";
                var assignedRoom = r.Rooms?.FirstOrDefault(room => !string.IsNullOrWhiteSpace(room.RoomId));
                var roomId = r.RoomId ?? assignedRoom?.RoomId;
                var roomNumber = assignedRoom?.Room?.Number ?? r.RoomNumber;
                var roomTypeId = assignedRoom?.RoomTypeId ?? r.RoomTypeId;
                var roomTypeName = roomTypeId != null && roomTypes.TryGetValue(roomTypeId, out var name) ? name : "Unassigned";
                return new
                {
                    id = r.Id,
                    confirmationNumber = !string.IsNullOrEmpty(r.ConfirmationNumber) ? r.ConfirmationNumber : (r.Id.Length >= 8 ? r.Id.Substring(0, 8).ToUpper() : r.Id.ToUpper()),
                    status = r.Status,
                    propertyId = r.PropertyId,
                    primaryGuestId = guestId,
                    checkIn = r.CheckInDate,
                    checkOut = r.CheckOutDate,
                    primaryGuest = r.Guest != null 
                        ? new { id = r.Guest.Id, firstName = r.Guest.FirstName, lastName = r.Guest.LastName, phone = r.Guest.Phone } 
                        : new { id = "unknown", firstName = "Unknown", lastName = "Guest", phone = (string?)"" },
                    reservationRooms = new[] { new { roomId = roomId, room = new { id = roomId, number = roomNumber, status = assignedRoom?.Room?.Status ?? "AVAILABLE" }, roomType = new { name = roomTypeName }, checkIn = r.CheckInDate, checkOut = r.CheckOutDate } },
                    folio = new { balance = r.Folio?.NetBalance ?? 0, currency = r.Folio?.Currency ?? r.Currency ?? "NGN" },
                    isDirty = r.IsDirty
                };
            });
            return JsonSerializer.Serialize(new { success = true, data = mapped }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    private async Task<(string UserId, string DeviceId, string? OutletId)> GetSecureContextAsync(params string[] requiredPermissions)
    {
        var session = await _authManager.GetSessionAsync();
        if (session == null) throw new UnauthorizedAccessException("No active desktop session.");
        
        if (requiredPermissions != null && requiredPermissions.Length > 0 && session.Role != "ADMIN" && session.Role != "MANAGER")
        {
            bool hasPermission = false;
            foreach (var p in requiredPermissions)
            {
                if (session.Permissions != null && session.Permissions.Contains(p))
                {
                    hasPermission = true;
                    break;
                }
            }
            if (!hasPermission)
            {
                throw new UnauthorizedAccessException($"Missing required permission: {string.Join(" or ", requiredPermissions)}");
            }
        }

        var terminal = await _repo.GetTerminalAsync(session.DeviceId);
        
        return (session.UserId, session.DeviceId, terminal?.OutletId);
    }

    public async Task<string> AssignRoomAsync(string reservationId, string roomId, string roomNumber)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.AssignRoomAsync(reservationId, roomId, roomNumber, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> CancelReservationAsync(string reservationId)
    {
        try
        {
            var ctx = await GetSecureContextAsync("reservation:cancel", "frontdesk:all");
            var success = await _repo.CancelReservationAsync(reservationId, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> MarkLateArrivalAsync(string reservationId, string notes)
    {
        try { var ctx = await GetSecureContextAsync("reservation:update", "frontdesk:all"); var result = await _repo.MarkLateArrivalAsync(reservationId, notes, ctx.UserId, ctx.DeviceId); return JsonSerializer.Serialize(new { success = true, data = result }, _jsonOptions); }
        catch (Exception ex) { return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions); }
    }

    public async Task<string> AssessNoShowAsync(string reservationId)
    {
        try { var ctx = await GetSecureContextAsync("reservation:update", "frontdesk:all"); var result = await _repo.AssessNoShowAsync(reservationId, ctx.UserId, ctx.DeviceId); return JsonSerializer.Serialize(new { success = true, data = result }, _jsonOptions); }
        catch (Exception ex) { return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions); }
    }

    public async Task<string> ReinstateReservationAsync(string reservationId, string reason)
    {
        try { var ctx = await GetSecureContextAsync("refund:approve", "frontdesk:all"); var result = await _repo.ReinstateReservationAsync(reservationId, reason, ctx.UserId, ctx.DeviceId); return JsonSerializer.Serialize(new { success = true, data = result }, _jsonOptions); }
        catch (Exception ex) { return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions); }
    }
    public async Task<string> CheckAvailabilityAsync(string roomNumber, DateTime checkIn, DateTime checkOut)
    {
        try
        {
            var isAvailable = await _repo.IsRoomAvailableAsync(roomNumber, checkIn, checkOut);
            return JsonSerializer.Serialize(new { success = true, isAvailable }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> RecordChargeAsync(string folioId, decimal amount, string description, string? idempotencyKey = null)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.RecordChargeAsync(folioId, amount, description, ctx.UserId, ctx.DeviceId, idempotencyKey);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> RecordPaymentAsync(string folioId, decimal amount, string method, string? idempotencyKey = null)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.RecordPaymentAsync(folioId, amount, method, ctx.UserId, ctx.DeviceId, idempotencyKey);
            var paymentId = "off-" + Guid.NewGuid().ToString();
            return JsonSerializer.Serialize(new { 
                success, 
                data = new { payment = new { id = paymentId } }
            }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetFrontdeskSessionAsync(string propertyId)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var session = await _repo.GetActiveFrontdeskSessionAsync(propertyId, ctx.UserId);
            return JsonSerializer.Serialize(new { success = true, data = new { session } }, _jsonOptions);
        }
        catch (Exception ex) { return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions); }
    }

    public async Task<string> GetFrontdeskCashAccountsAsync(string propertyId)
    {
        try
        {
            await GetSecureContextAsync();
            var accounts = await _repo.GetCashAccountsAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data = accounts }, _jsonOptions);
        }
        catch (Exception ex) { return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions); }
    }

    public async Task<string> OpenFrontdeskSessionAsync(string propertyId, string cashAccountId, decimal openingFloat)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var session = await _repo.OpenFrontdeskSessionAsync(propertyId, ctx.UserId, cashAccountId, openingFloat, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = new { session } }, _jsonOptions);
        }
        catch (Exception ex) { return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions); }
    }

    public async Task<string> CloseFrontdeskSessionAsync(string sessionId, decimal declaredCash)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var session = await _repo.CloseFrontdeskSessionAsync(sessionId, declaredCash, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = new { session } }, _jsonOptions);
        }
        catch (Exception ex) { return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions); }
    }
    public async Task<string> RecordAdvanceDepositAsync(string folioId, decimal amount, string method, string? reference, string? notes, string? idempotencyKey = null)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.RecordAdvanceDepositAsync(folioId, amount, method, reference, notes, ctx.UserId, ctx.DeviceId, idempotencyKey);
            return JsonSerializer.Serialize(new { success, pendingSync = success }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> ProcessCheckInAsync(string reservationId, bool bypassKeycard = false, string encodedRoomId = "", string? encodeData = null)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var res = await _repo.GetReservationAsync(reservationId);
            if (res == null) throw new Exception("Reservation not found");
            var activeRoom = res.Rooms?.FirstOrDefault(room => room.Status == "ACTIVE");
            var roomId = activeRoom?.RoomId ?? res.RoomId;

            if (!bypassKeycard)
            {
                if (string.IsNullOrEmpty(encodedRoomId) || encodedRoomId != roomId)
                {
                    throw new Exception("HARDWARE_ENFORCEMENT: Keycard must be encoded before check-in can proceed.");
                }
            }
            else
            {
                // Create Security Audit Log for Bypass
                await _repo.RecordKeycardAuditAsync(new LodgeCore.Desktop.Data.Entities.LocalKeycardAudit
                {
                    Id = Guid.NewGuid().ToString(),
                    PropertyId = res.PropertyId,
                    OperationType = "CHECK_IN_BYPASS",
                    ReservationId = reservationId,
                    RoomId = roomId,
                    StatusReason = "Check-in hardware enforcement was bypassed by an authorized user.",
                    StaffId = ctx.UserId,
                    DeviceId = ctx.DeviceId,
                    Timestamp = DateTime.UtcNow,
                    BusinessDate = DateTime.UtcNow,
                    Success = true,
                    OperationId = Guid.NewGuid().ToString()
                });
            }

            var success = await _repo.ProcessCheckInAsync(reservationId, ctx.UserId, ctx.DeviceId, encodeData);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> ProcessCheckOutAsync(string reservationId)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.ProcessCheckOutAsync(reservationId, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> UpdateHousekeepingTaskStatusAsync(string taskId, string status)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.UpdateHousekeepingTaskStatusAsync(taskId, status, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> ResolveMaintenanceTicketAsync(string ticketId)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.ResolveMaintenanceTicketAsync(ticketId, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> RetryDeadLetterEventsAsync()
    {
        try
        {
            await GetSecureContextAsync(); // Ensure auth
            int count = await _repo.RetryDeadLetterEventsAsync();
            
            return JsonSerializer.Serialize(new { success = true, data = new { requeuedCount = count } }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetReservationAsync(string id)
    {
        try
        {
            var r = await _repo.GetReservationAsync(id);
            if (r == null) return JsonSerializer.Serialize(new { success = false, error = "Not found" }, _jsonOptions);

            var reservationRoomType = string.IsNullOrWhiteSpace(r.RoomTypeId)
                ? null
                : (await _repo.GetRoomTypesAsync(r.PropertyId)).FirstOrDefault(rt => rt.Id == r.RoomTypeId);

            var f = r.Folio;
            var folioJson = f != null && !string.IsNullOrEmpty(f.TransactionsJson) 
                ? JsonSerializer.Deserialize<System.Text.Json.JsonElement>(f.TransactionsJson, _jsonOptions)
                : default;

            var items = folioJson.ValueKind == System.Text.Json.JsonValueKind.Object && folioJson.TryGetProperty("items", out var itemsProp) && itemsProp.ValueKind == System.Text.Json.JsonValueKind.Array
                ? itemsProp.EnumerateArray().Select(i => new {
                    id = i.TryGetProperty("id", out var iid) ? iid.GetString() : null,
                    amount = i.TryGetProperty("amount", out var amt) ? 
                        (amt.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(amt.GetString(), out var d) ? d : 
                        (amt.ValueKind == System.Text.Json.JsonValueKind.Number ? amt.GetDecimal() : 0)) : 0m,
                    type = i.TryGetProperty("type", out var typ) && typ.ValueKind != System.Text.Json.JsonValueKind.Null ? typ.GetString() : "CHARGE",
                    description = i.TryGetProperty("description", out var desc) ? desc.GetString() : null,
                    createdAt = i.TryGetProperty("createdAt", out var ts) ? ts.GetDateTime() : DateTime.UtcNow
                }).ToArray<object>()
                : Array.Empty<object>();

            var payments = folioJson.ValueKind == System.Text.Json.JsonValueKind.Object && folioJson.TryGetProperty("payments", out var payProp) && payProp.ValueKind == System.Text.Json.JsonValueKind.Array
                ? payProp.EnumerateArray().Select(p => new {
                    id = p.TryGetProperty("id", out var pid) ? pid.GetString() : null,
                    amount = p.TryGetProperty("amount", out var pAmt) ? 
                        (pAmt.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(pAmt.GetString(), out var pd) ? pd : 
                        (pAmt.ValueKind == System.Text.Json.JsonValueKind.Number ? pAmt.GetDecimal() : 0)) : 0m,
                    status = p.TryGetProperty("status", out var st) ? st.GetString() : "COMPLETED",
                    method = p.TryGetProperty("method", out var meth) ? meth.GetString() : null,
                    createdAt = p.TryGetProperty("createdAt", out var ts) ? ts.GetDateTime() : DateTime.UtcNow
                }).ToArray<object>()
                : Array.Empty<object>();

            var credits = folioJson.ValueKind == System.Text.Json.JsonValueKind.Object && folioJson.TryGetProperty("credits", out var creditProp) && creditProp.ValueKind == System.Text.Json.JsonValueKind.Array
                ? creditProp.EnumerateArray().Select(c => new {
                    id = c.TryGetProperty("id", out var cid) ? cid.GetString() : null,
                    amount = c.TryGetProperty("amount", out var cAmt)
                        ? (cAmt.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(cAmt.GetString(), out var cd) ? cd : cAmt.ValueKind == System.Text.Json.JsonValueKind.Number ? cAmt.GetDecimal() : 0m)
                        : 0m,
                    remainingAmount = c.TryGetProperty("remainingAmount", out var remaining)
                        ? (remaining.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(remaining.GetString(), out var rd) ? rd : remaining.ValueKind == System.Text.Json.JsonValueKind.Number ? remaining.GetDecimal() : 0m)
                        : 0m,
                    type = c.TryGetProperty("type", out var cType) ? cType.GetString() : "ADVANCE_DEPOSIT",
                    method = c.TryGetProperty("method", out var cMethod) ? cMethod.GetString() : null,
                    reference = c.TryGetProperty("reference", out var cReference) ? cReference.GetString() : null,
                    description = c.TryGetProperty("notes", out var cNotes) ? cNotes.GetString() : null,
                    status = c.TryGetProperty("status", out var cStatus) ? cStatus.GetString() : "AVAILABLE",
                    createdAt = c.TryGetProperty("createdAt", out var cCreated) && cCreated.ValueKind == System.Text.Json.JsonValueKind.String && DateTime.TryParse(cCreated.GetString(), out var createdAt) ? createdAt : DateTime.UtcNow
                }).ToArray<object>()
                : Array.Empty<object>();

            var mapped = new
            {
                id = r.Id,
                confirmationNumber = r.Id.Length >= 8 ? r.Id.Substring(0, 8).ToUpper() : r.Id.ToUpper(),
                status = r.Status,
                propertyId = r.PropertyId,
                checkIn = r.CheckInDate,
                checkOut = r.CheckOutDate,
                createdAt = r.CreatedAt,
                updatedAt = r.UpdatedAt,
                primaryGuest = r.Guest != null ? new {
                    id = r.Guest.Id,
                    firstName = r.Guest.FirstName,
                    lastName = r.Guest.LastName,
                    email = r.Guest.Email,
                    phone = r.Guest.Phone
                } : null,
                reservationRooms = new[] {
                    new {
                        id = r.Id,
                        roomId = r.RoomId,
                        roomTypeId = r.RoomTypeId,
                        checkIn = r.CheckInDate,
                        checkOut = r.CheckOutDate,
                        rateAmount = reservationRoomType?.BasePrice ?? 0,
                        room = new {
                            number = r.RoomNumber ?? "Unassigned",
                            roomType = reservationRoomType == null
                                ? new { name = "Unknown", baseRate = 0m, currency = r.Currency ?? "NGN" }
                                : new { name = reservationRoomType.Name, baseRate = reservationRoomType.BasePrice, currency = reservationRoomType.Currency }
                        }
                    }
                },
                folios = new[] {
                    new {
                        id = f?.Id,
                        status = f?.Status ?? "OPEN",
                        balance = f?.NetBalance ?? 0,
                        totalCharges = f?.TotalCharges ?? 0,
                        totalPayments = f?.TotalPayments ?? 0,
                        availableCredit = f?.AvailableCredit ?? 0,
                        currency = f?.Currency ?? r.Currency ?? "NGN",
                        items = items,
                        payments = payments,
                        credits = credits
                    }
                },
                auditLogs = Array.Empty<object>(),
                lockCredentials = r.LockCredentials.Select(c => new {
                    id = c.Id,
                    reservationId = c.ReservationId,
                    guestId = c.GuestId,
                    roomId = c.RoomId,
                    lockId = c.LockId,
                    credentialType = c.CredentialType,
                    status = c.Status,
                    validFrom = c.ValidFrom,
                    validUntil = c.ValidUntil,
                    cardSerialNumber = c.CardSerialNumber,
                    issueOperationId = c.IssueOperationId,
                    issuedAt = c.IssuedAt,
                    revokedAt = c.RevokedAt,
                    metadata = !string.IsNullOrEmpty(c.MetadataJson) ? JsonSerializer.Deserialize<System.Text.Json.JsonElement>(c.MetadataJson, _jsonOptions) : default(System.Text.Json.JsonElement?)
                }).ToList(),
                lockOperations = r.LockOperations.OrderByDescending(o => o.RequestedAt).Select(o => new {
                    id = o.Id,
                    propertyId = o.PropertyId,
                    reservationId = o.ReservationId,
                    lockId = o.LockId,
                    roomId = o.RoomId,
                    credentialId = o.CredentialId,
                    commandId = o.CommandId,
                    idempotencyKey = o.IdempotencyKey,
                    operation = o.Operation,
                    status = o.Status,
                    errorCode = o.ErrorCode,
                    errorMessage = o.ErrorMessage,
                    payloadHash = o.PayloadHash,
                    attemptCount = o.AttemptCount,
                    requestedAt = o.RequestedAt,
                    startedAt = o.StartedAt,
                    completedAt = o.CompletedAt,
                    agentId = o.AgentId,
                    deviceId = o.DeviceId,
                    metadata = !string.IsNullOrEmpty(o.MetadataJson) ? JsonSerializer.Deserialize<System.Text.Json.JsonElement>(o.MetadataJson, _jsonOptions) : default(System.Text.Json.JsonElement?),
                    command = !string.IsNullOrEmpty(o.CommandJson) ? JsonSerializer.Deserialize<System.Text.Json.JsonElement>(o.CommandJson, _jsonOptions) : default(System.Text.Json.JsonElement?)
                }).ToList()
            };
            return JsonSerializer.Serialize(new { success = true, data = mapped }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetDashboardAsync(string propertyId)
    {
        try
        {
            var data = await _repo.GetDashboardAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> GetGuestsAsync()
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var data = await _repo.GetGuestsAsync();
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> SearchGuestsAsync(string query)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var data = await _repo.SearchGuestsAsync(query);
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> UpdateGuestAsync(string guestId, string guestDataJson)
    {
        try
        {
            var ctx = await GetSecureContextAsync("guest:edit", "frontdesk:all");
            using var doc = JsonDocument.Parse(guestDataJson);
            var root = doc.RootElement;
            var firstName = root.GetProperty("firstName").GetString() ?? "";
            var lastName = root.GetProperty("lastName").GetString() ?? "";
            var email = root.TryGetProperty("email", out var e) ? e.GetString() : null;
            var phone = root.TryGetProperty("phone", out var p) ? p.GetString() : null;

            var success = await _repo.UpdateGuestAsync(guestId, firstName, lastName, email, phone, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> GetRoomTypesAsync(string propertyId)
    {
        try
        {
            var data = (await _repo.GetRoomTypesAsync(propertyId)).Select(rt => new { id = rt.Id, name = rt.Name, description = rt.Description, baseRate = rt.BasePrice, maxOccupancy = rt.MaxOccupancy, totalRooms = rt.TotalRooms });
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> LookupReservationByRoomAsync(string roomNo, string propertyId)
    {
        try
        {
            var res = await _repo.GetReservationByRoomNumberAsync(roomNo);
            if (res == null || res.PropertyId != propertyId)
            {
                return JsonSerializer.Serialize(new { success = false, error = "No active reservation found for this room" }, _jsonOptions);
            }
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> CreateReservationAsync(string dataJson)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(dataJson);
            var root = doc.RootElement;
            
            var res = new LodgeCore.Desktop.Data.Entities.LocalReservation();
            res.Id = Guid.NewGuid().ToString();
            res.PropertyId = root.GetProperty("propertyId").GetString() ?? "";
            
            if (root.TryGetProperty("isNewGuest", out var isNewGuest) && isNewGuest.GetBoolean()) {
                var guestDetails = root.GetProperty("guestDetails");
                var newGuest = new LodgeCore.Desktop.Data.Entities.LocalGuest {
                    Id = Guid.NewGuid().ToString(),
                    OrganizationId = "",
                    FirstName = guestDetails.GetProperty("firstName").GetString() ?? "",
                    LastName = guestDetails.GetProperty("lastName").GetString() ?? "",
                    Email = guestDetails.TryGetProperty("email", out var email) ? email.GetString() : null,
                    Phone = guestDetails.TryGetProperty("phone", out var phone) ? phone.GetString() : null,
                };
                res.GuestId = newGuest.Id;
                res.Guest = newGuest;
            } else {
                res.GuestId = root.GetProperty("guestId").GetString() ?? "";
            }
            
            res.RoomId = root.TryGetProperty("roomId", out var rId) ? rId.GetString() : null;
            if (string.IsNullOrEmpty(res.RoomId)) res.RoomId = null;

            res.RoomNumber = root.TryGetProperty("roomNumber", out var rNum) ? rNum.GetString() : null;
            if (string.IsNullOrEmpty(res.RoomNumber)) res.RoomNumber = null;

            res.RoomTypeId = root.TryGetProperty("roomTypeId", out var rtId) ? rtId.GetString() : null;
            if (string.IsNullOrEmpty(res.RoomTypeId)) res.RoomTypeId = null;

            res.SpecialRequests = root.TryGetProperty("specialRequests", out var sr) ? sr.GetString() : null;
            
            res.CheckInDate = DateTime.Parse(root.GetProperty("checkIn").GetString() ?? DateTime.UtcNow.ToString("O"));
            res.CheckOutDate = DateTime.Parse(root.GetProperty("checkOut").GetString() ?? DateTime.UtcNow.AddDays(1).ToString("O"));
            
            if (root.TryGetProperty("adults", out var ad)) {
                if (ad.ValueKind == System.Text.Json.JsonValueKind.String && int.TryParse(ad.GetString(), out var adVal)) res.Adults = adVal;
                else if (ad.ValueKind == System.Text.Json.JsonValueKind.Number) res.Adults = ad.GetInt32();
            }

            if (root.TryGetProperty("children", out var ch)) {
                if (ch.ValueKind == System.Text.Json.JsonValueKind.String && int.TryParse(ch.GetString(), out var chVal)) res.Children = chVal;
                else if (ch.ValueKind == System.Text.Json.JsonValueKind.Number) res.Children = ch.GetInt32();
            }

            if (root.TryGetProperty("depositRequired", out var dr)) {
                if (dr.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(dr.GetString(), out var drVal)) res.DepositRequired = drVal;
                else if (dr.ValueKind == System.Text.Json.JsonValueKind.Number) res.DepositRequired = dr.GetDecimal();
            }

            if (root.TryGetProperty("depositPaid", out var dp)) {
                if (dp.ValueKind == System.Text.Json.JsonValueKind.String && decimal.TryParse(dp.GetString(), out var dpVal)) res.DepositPaid = dpVal;
                else if (dp.ValueKind == System.Text.Json.JsonValueKind.Number) res.DepositPaid = dp.GetDecimal();
            }

            var reqStatus = root.TryGetProperty("status", out var st) ? st.GetString() : "CONFIRMED";
            var validStatuses = new[] { "PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW" };
            res.Status = validStatuses.Contains(reqStatus) ? (reqStatus ?? "CONFIRMED") : "CONFIRMED";
            
            var created = await _repo.CreateReservationAsync(res, "System", "Device1");
            return JsonSerializer.Serialize(new { success = true, data = new { id = created.Id } }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> GetRoomsAsync(string propertyId)
    {
        try
        {
            var data = await _repo.GetRoomsAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data = data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetActiveReservationByRoomAsync(string roomId)
    {
        try
        {
            var data = await _repo.GetActiveReservationByRoomAsync(roomId);
            return JsonSerializer.Serialize(new { success = true, data = data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> UpdateRoomStatusAsync(string roomId, string newStatus, string source)
    {
        try
        {
            var data = await _repo.UpdateRoomStatusAsync(roomId, newStatus, source);
            return JsonSerializer.Serialize(new { success = true, data = data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetAvailableRoomsAsync(string propertyId, string roomTypeId, string checkIn, string checkOut)
    {
        try
        {
            var ci = DateTime.Parse(checkIn);
            var co = DateTime.Parse(checkOut);
            var data = await _repo.GetAvailableRoomsAsync(propertyId, roomTypeId, ci, co);
            var types = await _repo.GetRoomTypesAsync(propertyId);
            var mapped = data.Select(r => new {
                id = r.Id,
                propertyId = r.PropertyId,
                number = r.Number,
                status = r.Status,
                housekeepingStatus = r.Status,
                floor = new { number = r.FloorName },
                roomType = types.FirstOrDefault(rt => rt.Id == r.RoomTypeId) != null 
                           ? new { name = types.First(rt => rt.Id == r.RoomTypeId).Name, code = types.First(rt => rt.Id == r.RoomTypeId).Name, baseRate = types.First(rt => rt.Id == r.RoomTypeId).BasePrice, currency = types.First(rt => rt.Id == r.RoomTypeId).Currency }
                           : new { name = "Unknown", code = "UNK", baseRate = 0m, currency = "NGN" }
            });
            return JsonSerializer.Serialize(new { success = true, data = mapped }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> ExtendStayAsync(string reservationId, string newCheckOutDate)
    {
        try
        {
            if (!DateTime.TryParse(newCheckOutDate, out var newCheckOut))
                return JsonSerializer.Serialize(new { success = false, error = "Invalid date" }, _jsonOptions);

            var ctx = await GetSecureContextAsync();
            var success = await _repo.ExtendStayAsync(reservationId, newCheckOut, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> RecordKeycardEncodingAsync(string reservationId, string roomId, string? encodeData)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.RecordKeycardEncodingAsync(reservationId, roomId, ctx.UserId, ctx.DeviceId, encodeData);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> PreviewExtendStayAsync(string reservationId, string newCheckOutDate)
    {
        try
        {
            if (!DateTime.TryParse(newCheckOutDate, out var newCheckOut))
                return JsonSerializer.Serialize(new { success = false, error = "Invalid date" }, _jsonOptions);

            var data = await _repo.PreviewExtendStayAsync(reservationId, newCheckOut);
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> EditReservationAsync(string dataJson)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(dataJson);
            var root = doc.RootElement;

            var reservationId = root.GetProperty("reservationId").GetString() ?? throw new Exception("reservationId is required");

            var patch = new LodgeCore.Desktop.Data.Entities.LocalReservationPatch
            {
                GuestId        = root.TryGetProperty("guestId",        out var gId)  ? gId.GetString()  : null,
                CheckIn        = root.TryGetProperty("checkIn",        out var ci) && ci.GetString() != null  ? DateTime.Parse(ci.GetString()!) : (DateTime?)null,
                CheckOut       = root.TryGetProperty("checkOut",       out var co) && co.GetString() != null  ? DateTime.Parse(co.GetString()!) : (DateTime?)null,
                RoomId         = root.TryGetProperty("roomId",         out var rmId) ? rmId.GetString() : null,
                RoomTypeId     = root.TryGetProperty("roomTypeId",     out var rtId) ? rtId.GetString() : null,
                Adults         = root.TryGetProperty("adults",         out var ad)   ? ad.GetInt32()    : (int?)null,
                Children       = root.TryGetProperty("children",       out var ch)   ? ch.GetInt32()    : (int?)null,
                SpecialRequests = root.TryGetProperty("specialRequests", out var sp) ? sp.GetString()   : null,
            };

            var ctx = await GetSecureContextAsync();
            var success = await _repo.EditReservationAsync(reservationId, patch, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> ReassignRoomAsync(string dataJson)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(dataJson);
            var root = doc.RootElement;
            var reservationId = root.GetProperty("reservationId").GetString() ?? throw new Exception("reservationId is required");
            var roomId = root.GetProperty("roomId").GetString() ?? throw new Exception("roomId is required");
            var roomTypeId = root.TryGetProperty("roomTypeId", out var rtId) ? rtId.GetString() : null;

            var ctx = await GetSecureContextAsync();
            var success = await _repo.ReassignRoomAsync(reservationId, roomId, roomTypeId, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> GetFolioAsync(string folioId)
    {
        try
        {
            var data = await _repo.GetFolioAsync(folioId);
            if (data == null) 
                return JsonSerializer.Serialize(new { success = false, error = "Folio not found" }, _jsonOptions);

            var resultObj = new Dictionary<string, object>
            {
                { "id", data.Id },
                { "propertyId", data.PropertyId },
                { "reservationId", data.ReservationId },
                { "reservation", data.Reservation! },
                { "status", data.Status },
                { "totalCharges", data.TotalCharges },
                { "totalPayments", data.TotalPayments },
                { "balance", data.NetBalance },
                { "availableCredit", data.AvailableCredit },
                { "createdAt", data.CreatedAt },
                { "updatedAt", data.UpdatedAt },
                { "version", data.Version }
            };

            if (!string.IsNullOrEmpty(data.TransactionsJson))
            {
                try
                {
                    using var doc = JsonDocument.Parse(data.TransactionsJson);
                    if (doc.RootElement.ValueKind == JsonValueKind.Object)
                    {
                        if (doc.RootElement.TryGetProperty("items", out var items))
                            resultObj["items"] = items;
                        else
                            resultObj["items"] = new JsonArray();

                        if (doc.RootElement.TryGetProperty("payments", out var payments))
                            resultObj["payments"] = payments;
                        else
                            resultObj["payments"] = new JsonArray();
                    }
                    else if (doc.RootElement.ValueKind == JsonValueKind.Array)
                    {
                        resultObj["items"] = doc.RootElement;
                        resultObj["payments"] = new JsonArray();
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Failed to parse folio transactions: {ex.Message}");
                    resultObj["items"] = new JsonArray();
                    resultObj["payments"] = new JsonArray();
                }
            }
            else
            {
                resultObj["items"] = new JsonArray();
                resultObj["payments"] = new JsonArray();
            }

            return JsonSerializer.Serialize(new { success = true, data = resultObj }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> GetHousekeepingTasksAsync(string propertyId)
    {
        try
        {
            var data = await _repo.GetHousekeepingTasksAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> GetMaintenanceTicketsAsync(string propertyId)
    {
        try
        {
            var data = await _repo.GetMaintenanceTicketsAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> CreateMaintenanceTicketAsync(string dataJson)
    {
        try
        {
            var session = await _authManager.GetSessionAsync();
            if (session == null) throw new Exception("Unauthorized");
            var deviceId = await _authManager.GetOrCreateDeviceIdAsync();

            var data = JsonSerializer.Deserialize<LodgeCore.Desktop.Data.Entities.LocalMaintenanceTicket>(dataJson, _jsonOptions);
            if (data == null) throw new Exception("Invalid data");
            
            data.PropertyId = session.PropertyId;

            var result = await _repo.CreateMaintenanceTicketAsync(data, session.UserId, deviceId);
            return JsonSerializer.Serialize(new { success = true, data = result }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> GenerateReceiptAsync(string folioId)
    {
        try
        {
            var data = await _repo.GetFolioAsync(folioId);
            if (data == null) throw new Exception("Folio not found");
            
            // Optionally print receipt via EscPosService if needed
            // await _escPos.PrintReceiptAsync(data);
            
            return JsonSerializer.Serialize(new { success = true, data = data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetPosProductsAsync(string propertyId)
    {
        try
        {
            var data = await _repo.GetPosProductsAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetCategoriesAsync(string propertyId)
    {
        try
        {
            var data = await _repo.GetCategoriesAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetFloorPlansAsync(string outletId)
    {
        try
        {
            var data = await _repo.GetFloorPlansAsync(outletId);
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetTablesAsync(string floorPlanId)
    {
        try
        {
            var data = await _repo.GetTablesAsync(floorPlanId);
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> CreatePosOrderAsync(string dataJson)
    {
        try
        {
            var order = JsonSerializer.Deserialize<LodgeCore.Desktop.Data.Entities.LocalPosOrder>(dataJson, _jsonOptions);
            if (order == null) throw new Exception("Invalid order data");
            
            var posCtx = await _sessionManager.GetActiveContextAsync();
            
            // Security: Enforce identity source of truth
            order.PropertyId = posCtx.PropertyId;
            order.OutletId = posCtx.OutletId;
            order.SessionId = posCtx.SessionId;
            order.ServerStaffId = posCtx.StaffId;
            order.CreatedBy = posCtx.StaffId;

            var res = await _repo.CreatePosOrderAsync(order, posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> SplitCheckAsync(string orderId, List<string> itemIds)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            var res = await _repo.SplitCheckAsync(orderId, itemIds, posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetWaiterTicketsAsync(string outletId, string operatorToken, string sessionId)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            
            // Fetch tickets using context session ID and staff ID to ensure secure scoping
            var tickets = await _repo.GetWaiterTicketsAsync(outletId, posCtx.StaffId, posCtx.SessionId);
            return JsonSerializer.Serialize(new { success = true, data = tickets }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> FireKotAsync(string orderId, List<string> itemIds)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            var res = await _repo.FireKotAsync(orderId, itemIds, posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> FireItemsAsync(string orderId, string itemsJson)
    {
        try
        {
            var items = JsonSerializer.Deserialize<List<LodgeCore.Desktop.Data.Entities.LocalPosOrderItem>>(itemsJson);
            if (items == null || !items.Any()) throw new Exception("No items to fire");

            var posCtx = await _sessionManager.GetActiveContextAsync();
            var (order, kot) = await _repo.FireItemsAsync(orderId, items, posCtx.StaffId, posCtx.DeviceId);
            
            return JsonSerializer.Serialize(new { 
                success = true, 
                data = new {
                    order = order,
                    newBatches = new[] { kot }
                }
            }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetActiveOrdersAsync(string filter)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            var res = await _repo.GetActiveOrdersAsync(posCtx.SessionId, filter, posCtx.StaffId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> UpdateOrderStatusAsync(string orderId, string status, string reason)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            var res = await _repo.UpdateOrderStatusAsync(orderId, status, reason, posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> PayOrderAsync(string orderId, string paymentDataJson)
    {
        try
        {
            var paymentData = JsonSerializer.Deserialize<Dictionary<string, object>>(paymentDataJson);
            if (paymentData == null) throw new Exception("Invalid payment data");

            var posCtx = await _sessionManager.GetActiveContextAsync();
            var property = await _repo.GetPropertyAsync(posCtx.PropertyId);
            string fallbackCurrency = property?.Currency ?? "NGN";

            string method = paymentData.ContainsKey("method") ? paymentData["method"]?.ToString() ?? "CASH" : "CASH";
            decimal amount = paymentData.ContainsKey("amount") ? decimal.Parse(paymentData["amount"]?.ToString() ?? "0") : 0;
            string currency = paymentData.ContainsKey("currency") ? paymentData["currency"]?.ToString() ?? fallbackCurrency : fallbackCurrency;
            string? checkId = paymentData.ContainsKey("checkId") ? paymentData["checkId"]?.ToString() : null;
            
            // AUTHORIZATION CHECK
            if (string.IsNullOrEmpty(posCtx.SessionId))
            {
                if (property != null) 
                {
                    if (property.BankingModel == PosConstants.BankingModels.CentralCashier) {
                        return JsonSerializer.Serialize(new { success = false, error = "Waiters cannot process payments. Please direct the guest to the Cashier." }, _jsonOptions);
                    } else if (property.BankingModel == PosConstants.BankingModels.ServerBanking) {
                        return JsonSerializer.Serialize(new { success = false, error = "No personal bank found. Please start your personal shift bank." }, _jsonOptions);
                    }
                }
            }

            var res = await _repo.PayOrderAsync(orderId, method, amount, currency, checkId ?? "", posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetOrderAsync(string orderId)
    {
        try
        {
            var res = await _repo.GetOrderAsync(orderId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetReceiptAsync(string orderId)
    {
        try
        {
            var res = await _repo.GetReceiptAsync(orderId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetServerOrdersAsync(string range, string statusFilter, string? sessionId)
    {
        try
        {
            var ctx = await _sessionManager.GetActiveContextAsync();
            var res = await _repo.GetServerOrdersAsync(ctx.StaffId, ctx.PropertyId, range, statusFilter, sessionId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetServerSalesAsync(string range, string? sessionId)
    {
        try
        {
            var ctx = await _sessionManager.GetActiveContextAsync();
            var res = await _repo.GetServerSalesAsync(ctx.StaffId, ctx.PropertyId, range, sessionId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> OpenPosSessionAsync(string propertyId, string outletId, string bankType, string bankingModel, decimal openingBalance)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var res = await _repo.OpenPosSessionAsync(propertyId, outletId, bankType, bankingModel, openingBalance, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> ClosePosSessionAsync(string sessionId, decimal actualCash, decimal cashPaidOut)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var res = await _repo.SettleSessionAsync(sessionId, actualCash, ctx.UserId, null, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> ConfirmHandoverAsync(string sessionId, string managerPin)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var res = await _repo.ConfirmHandoverAsync(sessionId, managerPin, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
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
                return JsonSerializer.Serialize(new { success = false, error = "Invalid supervisor PIN or unauthorized." }, _jsonOptions);
            }

            var res = await _repo.AuthorizeVoidAsync(orderId, orderItemId, reason, authorizer.Id, posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
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
                return JsonSerializer.Serialize(new { success = false, error = "Invalid supervisor PIN or unauthorized." }, _jsonOptions);
            }

            var res = await _repo.RecordRefundAsync(orderId, amount, method, authorizer.Id, posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> AuthorizeCashMovementAsync(string propertyId, string sessionId, decimal amount, string type, string reasonCode, string? notes, string supervisorPin)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            
            // SECURITY: Cash movement authorization
            var authorizer = await _repo.ValidateSupervisorPinAsync(supervisorPin, propertyId);
            if (authorizer == null)
            {
                // Log failed attempt if needed, but definitely block
                return JsonSerializer.Serialize(new { success = false, error = "Invalid supervisor PIN or unauthorized." }, _jsonOptions);
            }

            // Create movement
            var res = await _repo.RecordCashMovementAsync(propertyId, sessionId, amount, type, reasonCode, notes, null, authorizer.Id, ctx.UserId, ctx.DeviceId);
            
            // Log authorization explicitly
            await _repo.LogAuthorizationAsync(propertyId, sessionId, ctx.UserId, authorizer.Id, type, reasonCode, res.OperationId, ctx.DeviceId);

            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> LogReceiptPrintAsync(string propertyId, string? orderId, string? sessionId, string type, string? reason, int printCount)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            
            var res = await _repo.RecordReceiptPrintAsync(propertyId, orderId, sessionId, type, reason, printCount, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> KeepAliveAsync()
    {
        try
        {
            await _sessionManager.KeepAliveAsync();
            return JsonSerializer.Serialize(new { success = true }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    private static readonly Dictionary<string, (int Attempts, DateTime LockoutEnd)> _pinFailures = new();

    public async Task<string> AuthenticateOperatorAsync(string staffId, string pin, string propertyId, string? sessionId, string? outletId, string? deviceId)
    {
        try
        {
            // We ignore propertyId and sessionId from React to ensure security
            var ctx = await _sessionManager.AuthenticateOperatorAsync(staffId, pin);
            var staff = await _repo.GetStaffByIdAsync(staffId);
            if (staff == null) throw new Exception("Staff not found");
            
            var property = await _repo.GetPropertyAsync(propertyId);
            var actualBankingModel = property?.BankingModel ?? "CENTRAL_CASHIER";

            string? posSessionId = null;
            bool requiresBank = false;
            string? bankOwner = null;

            if (string.IsNullOrEmpty(deviceId) || string.IsNullOrEmpty(outletId))
            {
                var terminal = await _repo.GetLocalTerminalAsync();
                if (terminal != null)
                {
                    deviceId = terminal.Id;
                    outletId = terminal.OutletId;
                }
            }

            if (!string.IsNullOrEmpty(deviceId) && !string.IsNullOrEmpty(outletId))
            {
                if (actualBankingModel == "SERVER_BANKING")
                {
                    var openSession = await _repo.GetActiveServerBankAsync(staff.Id, propertyId, outletId);
                    if (openSession != null)
                    {
                        posSessionId = openSession.Id;
                    }
                }
                else
                {
                    var openSession = await _repo.GetActiveSessionForDeviceAsync(deviceId);
                    if (openSession != null)
                    {
                        posSessionId = openSession.Id;
                    }
                    else
                    {
                        requiresBank = true;
                        bankOwner = "MANAGER";
                    }
                }
            }

            // Return the OperatorTokenVersion as the secure token to React
            return JsonSerializer.Serialize(new { 
                success = true, 
                data = new { 
                    operatorToken = ctx.OperatorTokenVersion, 
                    staff, 
                    permissions = new[] { staff.Role },
                    bankingModel = actualBankingModel,
                    posSessionId,
                    operatorSession = posSessionId != null ? new { id = posSessionId, status = "OPEN" } : null,
                    requiresBank,
                    bankOwner
                } 
            }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> ValidateSupervisorPinAsync(string pin)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            var supervisor = await _repo.ValidateSupervisorPinAsync(pin, posCtx.PropertyId);
            
            if (supervisor == null)
            {
                return JsonSerializer.Serialize(new { success = false, error = "Invalid supervisor PIN or unauthorized." }, _jsonOptions);
            }
            
            return JsonSerializer.Serialize(new { success = true, data = new { staffId = supervisor.Id, name = $"{supervisor.FirstName} {supervisor.LastName}" } }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetActiveStaffAsync(string propertyId)
    {
        try
        {
            var res = await _repo.GetActiveStaffAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }



    public async Task<string> GetProductModifiersAsync(string productId)
    {
        try
        {
            var res = await _repo.GetProductModifiersAsync(productId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    /// <summary>
    /// Returns pending/acknowledged KOT batches for a given outlet and station.
    /// Maps the local PosKots table (LocalPosKot) to match the cloud ProductionBatch shape.
    /// </summary>
    public async Task<string> GetProductionBatchesAsync(string outletId, string station)
    {
        try
        {
            var kots = await _repo.GetProductionBatchesAsync(outletId, station);
            return JsonSerializer.Serialize(new { success = true, data = kots }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    /// <summary>
    /// Updates the status of a local KOT batch (PENDING → ACKNOWLEDGED → COMPLETED).
    /// </summary>
    public async Task<string> UpdateBatchStatusAsync(string batchId, string status)
    {
        try
        {
            await _repo.UpdateBatchStatusAsync(batchId, status);
            return JsonSerializer.Serialize(new { success = true }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetAuthorizedOutletsAsync(string propertyId, string deviceId)
    {
        try
        {
            var res = await _repo.GetAuthorizedOutletsAsync(propertyId, deviceId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetSessionContextAsync(string sessionId)
    {
        try
        {
            var desktopSession = await _authManager.GetSessionAsync();
            if (desktopSession == null) throw new UnauthorizedAccessException("No active desktop session.");

            var property = await _repo.GetPropertyAsync(desktopSession.PropertyId);
            var staff = await _repo.GetStaffByIdAsync(desktopSession.UserId);
            var terminal = await _repo.GetTerminalAsync(desktopSession.DeviceId);
            var outlet = terminal != null ? await _repo.GetOutletAsync(terminal.OutletId) : null;
            var posSession = await _repo.GetSessionContextAsync(sessionId);

            if (posSession == null)
            {
                posSession = await _repo.GetActiveSessionForDeviceAsync(desktopSession.DeviceId);
            }
            
            // Fallback outlet to the session's outlet if terminal doesn't provide it
            if (outlet == null && posSession != null && !string.IsNullOrEmpty(posSession.OutletId))
            {
                outlet = await _repo.GetOutletAsync(posSession.OutletId);
            }

            var settlementDetails = await _repo.GetSessionSettlementDetailsAsync(posSession?.Id ?? sessionId);

            var jsonDict = new Dictionary<string, object?>
            {
                ["terminal"] = terminal,
                ["outlet"] = outlet,
                ["operator"] = staff,
                ["primaryOperator"] = staff, // Important for shift bank mapping
                ["permissions"] = desktopSession.Permissions,
                ["businessDate"] = property?.BusinessDate.ToString("yyyy-MM-dd") ?? DateTime.UtcNow.ToString("yyyy-MM-dd"),
                ["taxConfiguration"] = new { },
                ["currency"] = property?.Currency ?? "USD",
                
                // Settlement properties
                ["expectedCash"] = settlementDetails.ExpectedCash,
                ["variance"] = settlementDetails.Variance,
                ["openingBalance"] = settlementDetails.OpeningFloat,
                ["cashSales"] = settlementDetails.CashSales,
                ["cardSales"] = settlementDetails.CardSales,
                ["totalSales"] = settlementDetails.TotalSales,
                ["cashIn"] = settlementDetails.CashIn,
                ["cashDrops"] = settlementDetails.CashDrops,
                ["paidOuts"] = settlementDetails.PaidOuts,
                ["cashPaidOut"] = settlementDetails.CashDrops + settlementDetails.PaidOuts + settlementDetails.TransfersOut,
                ["cashRefunds"] = settlementDetails.CashRefunds
            };

            // Merge posSession properties into root of JSON dictionary
            if (posSession != null)
            {
                var sessionProps = typeof(LodgeCore.Desktop.Data.Entities.LocalPosSession).GetProperties();
                foreach (var prop in sessionProps)
                {
                    jsonDict[JsonNamingPolicy.CamelCase.ConvertName(prop.Name)] = prop.GetValue(posSession);
                }
            }

            return JsonSerializer.Serialize(new { success = true, data = jsonDict }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetCurrentOperatorAsync(string? sessionId, string? operatorToken = null)
    {
        try
        {
            var ctx = await _sessionManager.GetActiveContextAsync();
            
            if (!string.IsNullOrEmpty(operatorToken) && ctx.OperatorTokenVersion != operatorToken)
            {
                return JsonSerializer.Serialize(new { success = false, error = "Invalid operator token" }, _jsonOptions);
            }

            var staff = await _repo.GetStaffByIdAsync(ctx.StaffId);
            
            // To ensure compatibility with frontend's existing expectations if a session actually existed
            object? sessionData = null;
            if (!string.IsNullOrEmpty(sessionId)) 
            {
                sessionData = await _repo.GetCurrentOperatorSessionAsync(ctx.DeviceId, sessionId);
            }
            
            return JsonSerializer.Serialize(new { success = true, data = new { staff, operatorSession = sessionData } }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
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
            return JsonSerializer.Serialize(new { success = true, data = movements }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetSessionSettlementDetailsAsync(string sessionId)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            string targetSession = string.IsNullOrEmpty(sessionId) ? posCtx.SessionId : sessionId;
            var details = await _repo.GetSessionSettlementDetailsAsync(targetSession);
            return JsonSerializer.Serialize(new { 
                success = true, 
                data = new {
                    expectedCash = details.ExpectedCash,
                    variance = details.Variance,
                    openingBalance = details.OpeningFloat,
                    cashSales = details.CashSales,
                    cardSales = details.CardSales,
                    bankTransferSales = details.BankTransferSales,
                    roomChargeSales = details.RoomChargeSales,
                    otherSales = details.OtherSales,
                    totalSales = details.TotalSales,
                    cashIn = details.CashIn,
                    cashDrops = details.CashDrops,
                    paidOuts = details.PaidOuts,
                    transfersOut = details.TransfersOut,
                    cashRefunds = details.CashRefunds
                }
            }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> CreateCashMovementAsync(string propertyId, string sessionId, decimal amount, string type, string reasonCode, string? notes, string? receiptReference, string? authorizerId)
    {
        try
        {
            var posCtx = await _sessionManager.GetActiveContextAsync();
            // Enforce identity
            var movement = await _repo.RecordCashMovementAsync(posCtx.PropertyId, posCtx.SessionId, amount, type, reasonCode, notes, receiptReference, authorizerId, posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = movement }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
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
            
            return JsonSerializer.Serialize(new { success = true, data = settlement }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> GetPendingHandoversAsync(string propertyId)
    {
        try {
            var data = await _repo.GetPendingHandoversAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        } catch (Exception ex) { return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions); }
    }

    public async Task<string> GetCashOfficeOverviewAsync(string propertyId)
    {
        try {
            var data = await _repo.GetCashOfficeOverviewAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        } catch (Exception ex) { return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions); }
    }

    public async Task<string> OpenSafeAsync(string propertyId, decimal amount, string managerPin)
    {
        try {
            var ctx = await _sessionManager.GetActiveContextAsync();
            var data = await _repo.OpenSafeAsync(propertyId, amount, managerPin, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        } catch (Exception ex) { return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions); }
    }

    public async Task<string> GetSafeLedgerAsync(string propertyId)
    {
        try {
            var data = await _repo.GetSafeLedgerAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        } catch (Exception ex) { return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions); }
    }

    public async Task<string> RecordBankDepositAsync(string propertyId, decimal amount, string reference, string managerPin)
    {
        try {
            var ctx = await _sessionManager.GetActiveContextAsync();
            var data = await _repo.RecordBankDepositAsync(propertyId, amount, reference, managerPin, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        } catch (Exception ex) { return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions); }
    }

    public async Task<string> OpenCashDrawerAsync()
    {
        try
        {
            var ctx = await GetSecureContextAsync("pos:cashdrawer", "pos:all");
            await _repo.LogHardwareEventAsync(ctx.UserId, ctx.DeviceId, "CASH_DRAWER_OPEN", null);
            var (success, error) = await _escPos.OpenCashDrawerAsync(ctx.OutletId);
            return JsonSerializer.Serialize(new { success, error }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> PrintReceiptAsync(string receiptDataJson)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            await _repo.LogHardwareEventAsync(ctx.UserId, ctx.DeviceId, "RECEIPT_PRINT", receiptDataJson);

            var receipt = JsonSerializer.Deserialize<ReceiptData>(
                receiptDataJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            );

            if (receipt == null)
                return JsonSerializer.Serialize(new { success = false, error = "Invalid receipt data" }, _jsonOptions);

            var (success, error) = await _escPos.PrintReceiptAsync(receipt, ctx.OutletId);
            return JsonSerializer.Serialize(new { success, error }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> PrintRegistrationCardAsync(string dataJson)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            await _repo.LogHardwareEventAsync(ctx.UserId, ctx.DeviceId, "REGISTRATION_CARD_PRINT", dataJson);
            
            using var doc = JsonDocument.Parse(dataJson);
            var reservationId = doc.RootElement.TryGetProperty("reservationId", out var idProp) ? idProp.GetString() : null;
            if (string.IsNullOrEmpty(reservationId)) throw new Exception("reservationId required");

            var reservation = await _repo.GetReservationAsync(reservationId);
            if (reservation == null) throw new Exception("Reservation not found");
            var guest = reservation.Guest;
            if (guest == null) throw new Exception("Guest not found");

            var cardData = new RegistrationCardData(
                GuestName: $"{guest.FirstName} {guest.LastName}",
                Email: guest.Email,
                Phone: guest.Phone,
                ConfirmationNumber: reservation.Id.Substring(0, 8).ToUpper(),
                RoomNumber: reservation.RoomNumber,
                ArrivalDate: reservation.CheckInDate.ToLocalTime(),
                DepartureDate: reservation.CheckOutDate.ToLocalTime(),
                Adults: reservation.Adults,
                Children: reservation.Children,
                PropertyName: null,
                PropertyAddress: null
            );

            var (success, error) = await _escPos.PrintRegistrationCardAsync(cardData, ctx.OutletId);
            return JsonSerializer.Serialize(new { success, error }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> PrintGuestFolioAsync(string dataJson)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            await _repo.LogHardwareEventAsync(ctx.UserId, ctx.DeviceId, "GUEST_FOLIO_PRINT", dataJson);
            
            var folio = JsonSerializer.Deserialize<GuestFolioData>(
                dataJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            );

            if (folio == null)
                return JsonSerializer.Serialize(new { success = false, error = "Invalid folio data" }, _jsonOptions);

            var (success, error) = await _escPos.PrintGuestFolioAsync(folio, ctx.OutletId);
            return JsonSerializer.Serialize(new { success, error }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> PrintPaymentReceiptAsync(string dataJson)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            await _repo.LogHardwareEventAsync(ctx.UserId, ctx.DeviceId, "FRONTDESK_PAYMENT_RECEIPT_PRINT", dataJson);
            
            var payment = JsonSerializer.Deserialize<PaymentReceiptData>(
                dataJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            );

            if (payment == null)
                return JsonSerializer.Serialize(new { success = false, error = "Invalid payment data" }, _jsonOptions);

            var (success, error) = await _escPos.PrintPaymentReceiptAsync(payment, ctx.OutletId);
            return JsonSerializer.Serialize(new { success, error }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> PrintKitchenTicketAsync(string ticketDataJson)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            await _repo.LogHardwareEventAsync(ctx.UserId, ctx.DeviceId, "KITCHEN_TICKET_PRINT", ticketDataJson);

            var kot = JsonSerializer.Deserialize<KotData>(
                ticketDataJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            );

            if (kot == null)
                return JsonSerializer.Serialize(new { success = false, error = "Invalid KOT data" }, _jsonOptions);

            var (kSuccess, kError) = await _escPos.PrintKotAsync(kot, ctx.OutletId);
            
            // Print Waiter Copy to RECEIPT printer
            var (wSuccess, wError) = await _escPos.PrintWaiterSlipAsync(kot, ctx.OutletId);
            
            bool success = kSuccess || wSuccess;
            string error = string.Join(" | ", new[] { kError, wError }.Where(e => !string.IsNullOrEmpty(e)));

            return JsonSerializer.Serialize(new { success, error = string.IsNullOrEmpty(error) ? null : error }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    // ── Printer Configuration Management ──────────────────────────────────────

    public async Task<string> GetPrintersAsync()
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var printers = await _escPos.GetPrintersAsync(ctx.OutletId);
            return JsonSerializer.Serialize(new { success = true, data = printers }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> SavePrinterAsync(string printerConfigJson)
    {
        try
        {
            await GetSecureContextAsync();
            var config = JsonSerializer.Deserialize<LocalPrinterConfig>(
                printerConfigJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            );
            if (config == null)
                return JsonSerializer.Serialize(new { success = false, error = "Invalid printer config" }, _jsonOptions);

            if (string.IsNullOrEmpty(config.Id)) config.Id = Guid.NewGuid().ToString();
            var saved = await _escPos.SavePrinterAsync(config);
            return JsonSerializer.Serialize(new { success = true, data = saved }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> DeletePrinterAsync(string printerId)
    {
        try
        {
            await GetSecureContextAsync();
            await _escPos.DeletePrinterAsync(printerId);
            return JsonSerializer.Serialize(new { success = true }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> TestPrinterAsync(string printerConfigJson)
    {
        try
        {
            await GetSecureContextAsync();
            var printer = JsonSerializer.Deserialize<LocalPrinterConfig>(printerConfigJson, _jsonOptions);
            if (printer == null) throw new Exception("Invalid printer configuration.");

            var (success, message) = await _escPos.TestPrintAsync(printer);
            return JsonSerializer.Serialize(new { success, message }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetAvailableHardwarePrintersAsync()
    {
        try
        {
            await GetSecureContextAsync();
            var list = await _escPos.GetAvailablePrintersAsync();
            return JsonSerializer.Serialize(new { success = true, data = list }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> SendToKdsAsync(string orderDataJson)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            // TODO: Send via WebSocket or local network to KDS display
            await _repo.LogHardwareEventAsync(ctx.UserId, ctx.DeviceId, "KDS_ORDER_SENT", orderDataJson);
            return JsonSerializer.Serialize(new { success = true, message = "Order sent to KDS" }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> UpdateKdsStatusAsync(string orderId, string itemId, string status)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            await _repo.LogHardwareEventAsync(ctx.UserId, ctx.DeviceId, $"KDS_STATUS_{status}", $"order:{orderId} item:{itemId}");
            return JsonSerializer.Serialize(new { success = true }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    #region Laundry Module

    public async Task<string> GetLaundryItemsAsync(string propertyId)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var items = await _repo.GetLaundryItemsAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data = items }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetLaundryOrdersAsync(string propertyId, string? status = null)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var orders = await _repo.GetLaundryOrdersAsync(propertyId, status);
            return JsonSerializer.Serialize(new { success = true, data = orders }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> CreateLaundryOrderAsync(string dataJson)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var orderId = await _repo.CreateLaundryOrderAsync(dataJson, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = new { id = orderId } }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> UpdateLaundryOrderStatusAsync(string orderId, string status)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            await _repo.UpdateLaundryOrderStatusAsync(orderId, status, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success = true }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> DeliverLaundryOrderAsync(string orderId)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            await _repo.DeliverLaundryOrderAsync(orderId, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success = true }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    #endregion
}

using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
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

    private readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

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
            return JsonSerializer.Serialize(new { success = true, data = session }, _jsonOptions);
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
            var safeStaff = staff.Select(s => new
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
            catch { }

            // Generate trusted session from the database
            await _authManager.CreateDesktopSessionAsync(
                staff.Id, 
                propertyId, 
                staff.Role, 
                permissions,
                staff.PosTokenVersion
            );

            var property = await _repo.GetPropertyAsync(propertyId);
            var actualBankingModel = property?.BankingModel ?? "CENTRAL_CASHIER";

            string? posSessionId = null;
            bool requiresBank = false;
            string? bankOwner = null;

            if (session != null)
            {
                var terminal = await _repo.GetTerminalAsync(session.DeviceId);
                if (terminal != null)
                {
                    if (actualBankingModel == "SERVER_BANKING")
                    {
                        var openSession = await _repo.GetActiveServerBankAsync(staff.Id, propertyId, terminal.OutletId);
                        if (openSession != null)
                        {
                            posSessionId = openSession.Id;
                        }
                        else
                        {
                            posSessionId = await _repo.EnsureActiveServerBankAsync(staff.Id, propertyId, terminal.OutletId, session.DeviceId);
                        }
                    }
                    else
                    {
                        var openSession = await _repo.GetActiveSessionForDeviceAsync(session.DeviceId);
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

    public async Task<string> GetActiveReservationsAsync()
    {
        try
        {
            var res = await _repo.GetActiveReservationsAsync();
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    private async Task<(string UserId, string DeviceId, string? OutletId)> GetSecureContextAsync()
    {
        var session = await _authManager.GetSessionAsync();
        if (session == null) throw new UnauthorizedAccessException("No active desktop session.");
        
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
            var ctx = await GetSecureContextAsync();
            var success = await _repo.CancelReservationAsync(reservationId, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
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
    public async Task<string> RecordChargeAsync(string folioId, decimal amount, string description)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.RecordChargeAsync(folioId, amount, description, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> RecordPaymentAsync(string folioId, decimal amount, string method)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.RecordPaymentAsync(folioId, amount, method, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> ProcessCheckInAsync(string reservationId)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var success = await _repo.ProcessCheckInAsync(reservationId, ctx.UserId, ctx.DeviceId);
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
            var data = await _repo.GetGuestsAsync();
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
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
            var data = await _repo.GetRoomTypesAsync(propertyId);
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> LookupReservationByRoomAsync(string roomNo, string propertyId)
    {
        return JsonSerializer.Serialize(new { success = false, error = "Room lookup is not available in offline mode." }, _jsonOptions);
    }
    public async Task<string> CreateReservationAsync(string dataJson)
    {
        try
        {
            var data = JsonSerializer.Deserialize<LodgeCore.Desktop.Data.Entities.LocalReservation>(dataJson);
            if (data == null) throw new Exception("Invalid reservation data");
            
            var res = await _repo.CreateReservationAsync(data, "System", "Device1");
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
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
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
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
            return JsonSerializer.Serialize(new { success = true, data }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }
    public async Task<string> ExtendStayAsync(string reservationId, string newCheckOutDate)
    {
        return JsonSerializer.Serialize(new { success = true }, _jsonOptions);
    }
    public async Task<string> GetFolioAsync(string folioId)
    {
        return JsonSerializer.Serialize(new { success = true, data = new { } }, _jsonOptions);
    }
    public async Task<string> GetHousekeepingTasksAsync(string propertyId)
    {
        return JsonSerializer.Serialize(new { success = true, data = new object[] { } }, _jsonOptions);
    }
    public async Task<string> GetMaintenanceTicketsAsync(string propertyId)
    {
        return JsonSerializer.Serialize(new { success = true, data = new object[] { } }, _jsonOptions);
    }
    public async Task<string> GenerateReceiptAsync(string folioId)
    {
        return JsonSerializer.Serialize(new { success = true, data = new { } }, _jsonOptions);
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
            var res = await _repo.FireItemsAsync(orderId, items, posCtx.StaffId, posCtx.DeviceId);
            return JsonSerializer.Serialize(new { success = true, data = res }, _jsonOptions);
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

            string method = paymentData.ContainsKey("method") ? paymentData["method"].ToString() : "CASH";
            decimal amount = paymentData.ContainsKey("amount") ? decimal.Parse(paymentData["amount"].ToString()) : 0;
            string currency = paymentData.ContainsKey("currency") ? paymentData["currency"].ToString() : fallbackCurrency;
            string checkId = paymentData.ContainsKey("checkId") ? paymentData["checkId"]?.ToString() : null;
            
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

            var res = await _repo.PayOrderAsync(orderId, method, amount, currency, checkId, posCtx.StaffId, posCtx.DeviceId);
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

    public async Task<string> OpenPosSessionAsync(string propertyId, decimal openingBalance)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var res = await _repo.OpenPosSessionAsync(propertyId, openingBalance, ctx.UserId, ctx.DeviceId);
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

    public async Task<string> AuthenticateOperatorAsync(string staffId, string pin, string propertyId, string sessionId)
    {
        try
        {
            // We ignore propertyId and sessionId from React to ensure security
            var ctx = await _sessionManager.AuthenticateOperatorAsync(staffId, pin);
            var staff = await _repo.GetStaffByIdAsync(staffId);
            
            // Return the OperatorTokenVersion as the secure token to React
            return JsonSerializer.Serialize(new { success = true, data = new { operatorToken = ctx.OperatorTokenVersion, staff, permissions = new[] { staff.Role } } }, _jsonOptions);
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

            var context = new
            {
                terminal = terminal,
                outlet = outlet,
                operatorInfo = staff, // Avoid reserved word 'operator' in C# if needed, but in JSON it maps to operator
                permissions = desktopSession.Permissions,
                businessDate = property?.BusinessDate.ToString("yyyy-MM-dd") ?? DateTime.UtcNow.ToString("yyyy-MM-dd"),
                taxConfiguration = new { }, // Placeholder for now
                currency = property?.Currency ?? "USD",
                posSession = posSession
            };

            // Let's use a dictionary to ensure the exact JSON key 'operator' is used
            var jsonDict = new Dictionary<string, object>
            {
                ["terminal"] = terminal,
                ["outlet"] = outlet,
                ["operator"] = staff,
                ["permissions"] = desktopSession.Permissions,
                ["businessDate"] = property?.BusinessDate.ToString("yyyy-MM-dd") ?? DateTime.UtcNow.ToString("yyyy-MM-dd"),
                ["taxConfiguration"] = new { },
                ["currency"] = property?.Currency ?? "USD",
                ["posSession"] = posSession
            };

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
            var ctx = await GetSecureContextAsync();
            
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
            // TODO: Integrate with actual cash drawer hardware (e.g., ESC/POS serial port)
            // For now, log the event for audit trail
            var ctx = await GetSecureContextAsync();
            await _repo.LogHardwareEventAsync(ctx.UserId, ctx.DeviceId, "CASH_DRAWER_OPEN", null);
            return JsonSerializer.Serialize(new { success = true, message = "Cash drawer opened" }, _jsonOptions);
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

            var (success, error) = await _escPos.PrintKotAsync(kot, ctx.OutletId);
            return JsonSerializer.Serialize(new { success, error }, _jsonOptions);
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

    public async Task<string> TestPrinterAsync(string ip, int port = 9100)
    {
        try
        {
            await GetSecureContextAsync();
            var (success, message) = await _escPos.TestConnectionAsync(ip, port);
            return JsonSerializer.Serialize(new { success, message }, _jsonOptions);
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
}

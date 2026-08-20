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

    public OfflinePMSInterop(LocalRepository repo, AuthManager authManager, SessionManager sessionManager, TerminalBootstrapService terminalBootstrap, EscPosService escPos)
    {
        _repo = repo;
        _authManager = authManager;
        _sessionManager = sessionManager;
        _terminalBootstrap = terminalBootstrap;
        _escPos = escPos;
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

    public async Task<string> ProvisionTerminalAsync(string email, string password, string propertyId, string outletId, string terminalName)
    {
        try
        {
            var result = await _terminalBootstrap.ProvisionTerminalAsync(email, password, propertyId, outletId, terminalName);
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

    public async Task<string> ProvisionDeviceAsync(string deviceToken)
    {
        try
        {
            await _authManager.StoreDeviceTokenAsync(deviceToken);
            return JsonSerializer.Serialize(new { success = true });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> GetActiveStaffAsync()
    {
        try
        {
            // Desktop usually operates for the property it was provisioned to.
            // If offline, returning all synced staff is usually fine.
            var session = await _authManager.GetSessionAsync();
            var propertyId = session?.PropertyId ?? "";
            
            var staff = await _repo.GetActiveStaffAsync(propertyId);
            
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

            return JsonSerializer.Serialize(new { success = true, data = safeStaff });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> LoginAsync(string staffId, string pin)
    {
        try
        {
            var staff = await _repo.AuthenticateDesktopUserAsync(staffId, pin);
            if (staff == null)
            {
                return JsonSerializer.Serialize(new { success = false, error = "Invalid PIN" });
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
            var res = await _repo.SettleSessionAsync(sessionId, actualCash, ctx.UserId, null, ctx.DeviceId);
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
            var authorizer = await _repo.ValidateSupervisorPinAsync(supervisorPin, propertyId);
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

    public async Task<string> KeepAliveAsync()
    {
        try
        {
            await _sessionManager.KeepAliveAsync();
            return JsonSerializer.Serialize(new { success = true });
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
            return JsonSerializer.Serialize(new { success = true, data = new { operatorToken = ctx.OperatorTokenVersion, staff, permissions = new[] { staff.Role } } });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
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
                return JsonSerializer.Serialize(new { success = false, error = "Invalid supervisor PIN or unauthorized." });
            }
            
            return JsonSerializer.Serialize(new { success = true, data = new { staffId = supervisor.Id, name = $"{supervisor.FirstName} {supervisor.LastName}" } });
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
    public async Task<string> OpenCashDrawerAsync()
    {
        try
        {
            // TODO: Integrate with actual cash drawer hardware (e.g., ESC/POS serial port)
            // For now, log the event for audit trail
            var ctx = await GetSecureContextAsync();
            await _repo.LogHardwareEventAsync(ctx.UserId, ctx.DeviceId, "CASH_DRAWER_OPEN", null);
            return JsonSerializer.Serialize(new { success = true, message = "Cash drawer opened" });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
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
                return JsonSerializer.Serialize(new { success = false, error = "Invalid receipt data" });

            var (success, error) = await _escPos.PrintReceiptAsync(receipt, ctx.OutletId);
            return JsonSerializer.Serialize(new { success, error });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
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
                return JsonSerializer.Serialize(new { success = false, error = "Invalid KOT data" });

            var (success, error) = await _escPos.PrintKotAsync(kot, ctx.OutletId);
            return JsonSerializer.Serialize(new { success, error });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    // ── Printer Configuration Management ──────────────────────────────────────

    public async Task<string> GetPrintersAsync()
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            var printers = await _escPos.GetPrintersAsync(ctx.OutletId);
            return JsonSerializer.Serialize(new { success = true, data = printers });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
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
                return JsonSerializer.Serialize(new { success = false, error = "Invalid printer config" });

            if (string.IsNullOrEmpty(config.Id)) config.Id = Guid.NewGuid().ToString();
            var saved = await _escPos.SavePrinterAsync(config);
            return JsonSerializer.Serialize(new { success = true, data = saved });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> DeletePrinterAsync(string printerId)
    {
        try
        {
            await GetSecureContextAsync();
            await _escPos.DeletePrinterAsync(printerId);
            return JsonSerializer.Serialize(new { success = true });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> TestPrinterAsync(string ip, int port = 9100)
    {
        try
        {
            await GetSecureContextAsync();
            var (success, message) = await _escPos.TestConnectionAsync(ip, port);
            return JsonSerializer.Serialize(new { success, message });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> SendToKdsAsync(string orderDataJson)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            // TODO: Send via WebSocket or local network to KDS display
            await _repo.LogHardwareEventAsync(ctx.UserId, ctx.DeviceId, "KDS_ORDER_SENT", orderDataJson);
            return JsonSerializer.Serialize(new { success = true, message = "Order sent to KDS" });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }

    public async Task<string> UpdateKdsStatusAsync(string orderId, string itemId, string status)
    {
        try
        {
            var ctx = await GetSecureContextAsync();
            await _repo.LogHardwareEventAsync(ctx.UserId, ctx.DeviceId, $"KDS_STATUS_{status}", $"order:{orderId} item:{itemId}");
            return JsonSerializer.Serialize(new { success = true });
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message });
        }
    }
}

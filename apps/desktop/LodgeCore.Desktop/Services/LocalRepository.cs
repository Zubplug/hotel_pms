using System.Text.Json;
using LodgeCore.Desktop.Data;
using LodgeCore.Desktop.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace LodgeCore.Desktop.Services;

/// <summary>
/// Handles local database mutations and automatically records SyncEvents for cloud replication.
/// </summary>
public class LocalRepository
{
    private readonly LocalDbContext _dbContext;

    public LocalRepository(LocalDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<LocalReservation> CreateReservationAsync(LocalReservation reservation, string userId, string deviceId)
    {
        reservation.IsDirty = true;

        // Ensure a confirmation number exists
        if (string.IsNullOrEmpty(reservation.ConfirmationNumber))
        {
            reservation.ConfirmationNumber = "RES-" + DateTime.UtcNow.Ticks.ToString().Substring(10) + "-" + new Random().Next(100, 999);
        }

        // Calculate Pricing if RoomType is provided
        decimal baseRate = 0;
        string currency = "NGN";
        if (!string.IsNullOrEmpty(reservation.RoomTypeId))
        {
            var roomType = await _dbContext.RoomTypes.FirstOrDefaultAsync(rt => rt.Id == reservation.RoomTypeId);
            if (roomType != null)
            {
                baseRate = roomType.BasePrice;
                if (!string.IsNullOrEmpty(roomType.Currency)) currency = roomType.Currency;
            }
        }
        
        int nights = (int)Math.Max(1, Math.Ceiling((reservation.CheckOutDate - reservation.CheckInDate).TotalDays));
        decimal totalAmount = baseRate * nights;

        reservation.Currency = currency;
        
        _dbContext.Reservations.Add(reservation);

        // Create Folio
        var folioId = Guid.NewGuid().ToString();
        var folio = new LocalFolio
        {
            Id = folioId,
            PropertyId = reservation.PropertyId,
            ReservationId = reservation.Id,
            Reservation = reservation,
            Status = "OPEN",
            TotalCharges = totalAmount,
            TotalPayments = 0,
            Currency = currency,
            IsDirty = true, // Force sync down to grab real ID later, or cloud matches by reservation? Actually, cloud API creates the folio, so this local one will get overwritten/merged on next pull. We just need it for UI.
        };

        // Create Transactions JSON
        var transactions = new List<object>();
        DateTime currentDate = reservation.CheckInDate;
        for (int i = 0; i < nights; i++)
        {
            transactions.Add(new
            {
                id = Guid.NewGuid().ToString(),
                folioId = folio.Id,
                businessDate = currentDate,
                type = "CHARGE",
                source = "ROOM_CHARGE",
                description = $"Room Charge - Night {i + 1}",
                quantity = 1,
                unitAmount = baseRate,
                amount = baseRate,
                currency = currency,
                baseAmount = baseRate,
                postedBy = userId
            });
            currentDate = currentDate.AddDays(1);
        }
        folio.TransactionsJson = JsonSerializer.Serialize(new { items = transactions, payments = new List<object>() });
        
        _dbContext.Folios.Add(folio);
        reservation.Folio = folio;
        
        // Bundle the mutation with an immutable OutboxEvent
        var outboxEvent = new LocalOutboxEvent
        {
            PropertyId = reservation.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "RESERVATION",
            AggregateId = reservation.Id,
            AggregateVersion = reservation.Version,
            EventType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(new
            {
                PropertyId = reservation.PropertyId,
                GuestId = reservation.GuestId,
                Guest = reservation.Guest,
                RoomId = reservation.RoomId,
                RoomNumber = reservation.RoomNumber,
                RoomTypeId = reservation.RoomTypeId,
                CheckInDate = reservation.CheckInDate,
                CheckOutDate = reservation.CheckOutDate,
                Adults = reservation.Adults,
                Children = reservation.Children,
                SpecialRequests = reservation.SpecialRequests,
                Status = reservation.Status,
                Source = reservation.Source,
                DepositRequired = reservation.DepositRequired,
                DepositPaid = reservation.DepositPaid
            })
        };
        
        _dbContext.OutboxEvents.Add(outboxEvent);
        
        // If room is specified and status implies occupancy, update room status
        if (!string.IsNullOrEmpty(reservation.RoomId) && reservation.Status == "CHECKED_IN")
        {
            var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == reservation.RoomId);
            if (room != null && room.Status != "OCCUPIED")
            {
                room.Status = "OCCUPIED";
                room.UpdatedAt = DateTime.UtcNow;
            }
        }
        
        // This transaction ensures the local DB and the Sync Queue are atomically updated
        await _dbContext.SaveChangesAsync();
        
        return reservation;
    }

    public async Task<List<LocalOutboxEvent>> GetOutboxEventsAsync()
    {
        var events = await _dbContext.OutboxEvents
            .OrderByDescending(e => e.CreatedAt)
            .ToListAsync();
            
        // Strip sensitive payloads before sending to the UI
        foreach(var evt in events)
        {
            evt.PayloadJson = "{}";
        }
        
        return events;
    }
    
    public async Task<List<LocalReservation>> GetActiveReservationsAsync()
    {
        return await _dbContext.Reservations
            .Include(r => r.Guest)
            .Include(r => r.Folio)
            .Include(r => r.Rooms).ThenInclude(rr => rr.Room)
            .Where(r => r.Status != "CANCELLED")
            .ToListAsync();
    }

    public async Task<LocalReservation?> GetReservationAsync(string id)
    {
        return await _dbContext.Reservations
            .Include(r => r.Guest)
            .Include(r => r.Folio)
            .Include(r => r.LockCredentials)
            .Include(r => r.LockOperations)
            .Include(r => r.Rooms).ThenInclude(rr => rr.Room)
            .FirstOrDefaultAsync(r => r.Id == id);
    }
    
    public async Task<bool> AssignRoomAsync(string reservationId, string roomId, string roomNumber, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) return false;

        var oldRoomId = res.RoomId;
        res.RoomId = roomId;
        res.RoomNumber = roomNumber;
        res.UpdatedAt = DateTime.UtcNow;
        res.IsDirty = true;
        res.LocalSequence++;
        int eventVersion = res.Version;
        res.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = res.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "RESERVATION",
            AggregateId = reservationId,
            AggregateVersion = eventVersion,
            EventType = "REASSIGN_ROOM",
            Sequence = res.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new { newRoomId = roomId, newRoomNumber = roomNumber, oldRoomId })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> CancelReservationAsync(string reservationId, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.Include(r => r.Folio).FirstOrDefaultAsync(r => r.Id == reservationId);
        if (res == null) return false;

        // Guard: already cancelled is a no-op (idempotent)
        if (res.Status == "CANCELLED") return true;

        // Guard: cannot cancel a checked-out reservation
        if (res.Status == "CHECKED_OUT")
            throw new InvalidOperationException("Cannot cancel a reservation that has already been checked out.");

        // Guard: cannot cancel with an unsettled folio
        if (res.Folio != null && res.Folio.OutstandingBalance > 0)
            throw new InvalidOperationException("Cannot cancel reservation with an outstanding balance. Settle the folio first.");

        res.Status = "CANCELLED";
        res.UpdatedAt = DateTime.UtcNow;
        res.IsDirty = true;
        res.LocalSequence++;
        int eventVersion = res.Version;
        res.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = res.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "RESERVATION",
            AggregateId = reservationId,
            AggregateVersion = eventVersion,
            EventType = "CANCEL",
            Sequence = res.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new { status = "CANCELLED", roomId = res.RoomId })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ReassignRoomAsync(string reservationId, string roomId, string? roomTypeId, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) return false;

        var room = await _dbContext.Rooms.FindAsync(roomId);
        if (room == null) throw new InvalidOperationException("Target room not found locally.");

        res.RoomId = roomId;
        res.RoomNumber = room.Number;
        if (roomTypeId != null) res.RoomTypeId = roomTypeId;

        res.UpdatedAt = DateTime.UtcNow;
        res.IsDirty = true;
        res.LocalSequence++;
        int eventVersion = res.Version;
        res.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = res.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "RESERVATION",
            AggregateId = reservationId,
            AggregateVersion = eventVersion,
            EventType = "REASSIGN_ROOM",
            Sequence = res.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new
            {
                roomId = roomId,
                roomTypeId = roomTypeId ?? room.RoomTypeId
            })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> IsRoomAvailableAsync(string roomNumber, DateTime checkIn, DateTime checkOut)
    {
        // Simple overlap check
        var overlapping = await _dbContext.Reservations
            .Where(r => r.RoomNumber == roomNumber && r.Status != "CANCELLED")
            .Where(r => r.CheckInDate < checkOut && r.CheckOutDate > checkIn)
            .AnyAsync();

        return !overlapping;
    }

    public async Task<bool> ExtendStayAsync(string reservationId, DateTime newCheckOut, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) return false;

        if (res.Status != "CHECKED_IN" && res.Status != "PENDING" && res.Status != "CONFIRMED")
            throw new InvalidOperationException($"Cannot extend a reservation with status '{res.Status}'.");

        if (newCheckOut <= res.CheckInDate)
            throw new InvalidOperationException("New checkout date must be after the check-in date.");

        if (newCheckOut <= res.CheckOutDate)
            throw new InvalidOperationException("New checkout date must be after the current checkout date.");

        // Overlap check: is the room taken by another reservation during the extension window?
        if (!string.IsNullOrEmpty(res.RoomNumber))
        {
            var conflict = await _dbContext.Reservations
                .Where(r => r.Id != reservationId
                         && r.RoomNumber == res.RoomNumber
                         && r.Status != "CANCELLED"
                         && r.CheckInDate < newCheckOut
                         && r.CheckOutDate > res.CheckOutDate)
                .AnyAsync();

            if (conflict)
                throw new InvalidOperationException("The room is not available for the extended period.");
        }

        res.CheckOutDate = newCheckOut;
        res.UpdatedAt = DateTime.UtcNow;
        res.IsDirty = true;
        res.LocalSequence++;
        int eventVersion = res.Version;
        res.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = res.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "RESERVATION",
            AggregateId = reservationId,
            AggregateVersion = eventVersion,
            EventType = "EXTEND_STAY",
            Sequence = res.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new
            {
                newCheckOutDate = newCheckOut.ToString("o"),
                roomId = res.RoomId
            })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<object> PreviewExtendStayAsync(string reservationId, DateTime newCheckOut)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) throw new InvalidOperationException("Reservation not found");

        if (newCheckOut <= res.CheckOutDate)
            throw new InvalidOperationException("New checkout date must be after the current checkout date.");

        var additionalNights = (int)(newCheckOut.Date - res.CheckOutDate.Date).TotalDays;
        var ratePerNight = 15000m; // Default offline fallback rate

        return new
        {
            additionalNights,
            ratePerNight,
            additionalCharge = additionalNights * ratePerNight,
            currency = res.Currency ?? "NGN"
        };
    }

    public async Task<bool> EditReservationAsync(string reservationId, LocalReservationPatch patch, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) return false;

        if (res.Status == "CHECKED_OUT" || res.Status == "CANCELLED")
            throw new InvalidOperationException($"Cannot edit a {res.Status} reservation.");

        // Apply non-null patches
        if (patch.GuestId        != null) res.GuestId         = patch.GuestId;
        if (patch.CheckIn        != null) res.CheckInDate      = patch.CheckIn.Value;
        if (patch.CheckOut       != null) res.CheckOutDate     = patch.CheckOut.Value;
        if (patch.RoomId         != null) res.RoomId           = patch.RoomId;
        if (patch.RoomTypeId     != null) res.RoomTypeId       = patch.RoomTypeId;
        if (patch.Adults         != null) res.Adults           = patch.Adults.Value;
        if (patch.Children       != null) res.Children         = patch.Children.Value;
        if (patch.SpecialRequests != null) res.SpecialRequests = patch.SpecialRequests;

        if (res.CheckOutDate <= res.CheckInDate)
            throw new InvalidOperationException("Check-out must be after check-in.");

        res.UpdatedAt = DateTime.UtcNow;
        res.IsDirty = true;
        res.LocalSequence++;
        int eventVersion = res.Version;
        res.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = res.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "RESERVATION",
            AggregateId = reservationId,
            AggregateVersion = eventVersion,
            EventType = "EDIT",
            Sequence = res.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new
            {
                guestId         = patch.GuestId,
                checkIn         = patch.CheckIn?.ToString("o"),
                checkOut        = patch.CheckOut?.ToString("o"),
                roomId          = patch.RoomId,
                roomTypeId      = patch.RoomTypeId,
                adults          = patch.Adults,
                children        = patch.Children,
                specialRequests = patch.SpecialRequests
            })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RecordChargeAsync(string folioId, decimal amount, string description, string userId, string deviceId, string? idempotencyKey = null)
    {
        var folio = await _dbContext.Folios.FindAsync(folioId);
        if (folio == null) return false;

        if (!string.IsNullOrEmpty(idempotencyKey) && CheckFolioIdempotency(folio, idempotencyKey))
            return true;

        folio.TotalCharges += amount;
        folio.UpdatedAt = DateTime.UtcNow;
        folio.IsDirty = true;
        folio.LocalSequence++;
        int eventVersion = folio.Version;
        folio.Version++;

        var newItem = new
        {
            id = Guid.NewGuid().ToString(),
            amount = amount,
            description = description,
            type = "CHARGE",
            idempotencyKey = idempotencyKey,
            createdAt = DateTime.UtcNow
        };

        UpdateFolioTransactionsJson(folio, "items", newItem);

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = folio.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "FOLIO",
            AggregateId = folioId,
            AggregateVersion = eventVersion,
            EventType = "ROOM_CHARGE",
            Sequence = folio.LocalSequence,
            IdempotencyKey = idempotencyKey ?? Guid.NewGuid().ToString(),
            PayloadJson = JsonSerializer.Serialize(new { amount, description, currency = "NGN", businessDate = DateTime.UtcNow, originalBusinessDate = DateTime.UtcNow, idempotencyKey })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RecordPaymentAsync(string folioId, decimal amount, string method, string userId, string deviceId, string? idempotencyKey = null)
    {
        var folio = await _dbContext.Folios.FindAsync(folioId);
        if (folio == null) return false;

        if (!string.IsNullOrEmpty(idempotencyKey) && CheckFolioIdempotency(folio, idempotencyKey))
            return true;

        folio.TotalPayments += amount;
        folio.UpdatedAt = DateTime.UtcNow;
        folio.IsDirty = true;
        folio.LocalSequence++;
        int eventVersion = folio.Version;
        folio.Version++;

        var newPayment = new
        {
            id = Guid.NewGuid().ToString(),
            amount = amount,
            method = method,
            type = "PAYMENT",
            status = "COMPLETED",
            idempotencyKey = idempotencyKey,
            createdAt = DateTime.UtcNow
        };

        UpdateFolioTransactionsJson(folio, "payments", newPayment);

        var newItem = new
        {
            id = Guid.NewGuid().ToString(),
            amount = -amount,
            description = $"{method} payment",
            type = "PAYMENT",
            idempotencyKey = idempotencyKey,
            createdAt = DateTime.UtcNow
        };

        UpdateFolioTransactionsJson(folio, "items", newItem);

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = folio.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "FOLIO",
            AggregateId = folioId,
            AggregateVersion = eventVersion,
            EventType = "POST_PAYMENT",
            Sequence = folio.LocalSequence,
            IdempotencyKey = idempotencyKey ?? Guid.NewGuid().ToString(),
            PayloadJson = JsonSerializer.Serialize(new { amount, method, currency = "NGN", businessDate = DateTime.UtcNow, originalBusinessDate = DateTime.UtcNow, idempotencyKey })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    private bool CheckFolioIdempotency(LocalFolio folio, string idempotencyKey)
    {
        if (string.IsNullOrEmpty(folio.TransactionsJson) || string.IsNullOrEmpty(idempotencyKey)) return false;
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(folio.TransactionsJson);
            if (doc.RootElement.TryGetProperty("items", out var items) && items.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var item in items.EnumerateArray())
                {
                    if (item.TryGetProperty("idempotencyKey", out var keyProp) && keyProp.ValueKind == System.Text.Json.JsonValueKind.String && keyProp.GetString() == idempotencyKey)
                        return true;
                }
            }
            if (doc.RootElement.TryGetProperty("payments", out var payments) && payments.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var payment in payments.EnumerateArray())
                {
                    if (payment.TryGetProperty("idempotencyKey", out var keyProp) && keyProp.ValueKind == System.Text.Json.JsonValueKind.String && keyProp.GetString() == idempotencyKey)
                        return true;
                }
            }
        }
        catch { }
        return false;
    }

    private void UpdateFolioTransactionsJson(LocalFolio folio, string arrayName, object newItem)
    {
        System.Text.Json.Nodes.JsonObject rootObj;
        if (string.IsNullOrEmpty(folio.TransactionsJson))
        {
            rootObj = new System.Text.Json.Nodes.JsonObject();
        }
        else
        {
            try
            {
                var node = System.Text.Json.Nodes.JsonNode.Parse(folio.TransactionsJson);
                rootObj = node as System.Text.Json.Nodes.JsonObject ?? new System.Text.Json.Nodes.JsonObject();
            }
            catch
            {
                rootObj = new System.Text.Json.Nodes.JsonObject();
            }
        }

        if (!rootObj.TryGetPropertyValue(arrayName, out var arrayNode) || arrayNode is not System.Text.Json.Nodes.JsonArray array)
        {
            array = new System.Text.Json.Nodes.JsonArray();
            rootObj[arrayName] = array;
        }

        var serializedNewItem = JsonSerializer.SerializeToNode(newItem);
        if (serializedNewItem != null)
        {
            array.Add(serializedNewItem);
        }

        folio.TransactionsJson = rootObj.ToJsonString();
    }

    public async Task<bool> ProcessCheckInAsync(string reservationId, string userId, string deviceId, string? encodeData = null)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null || (res.Status != "PENDING" && res.Status != "CONFIRMED")) return false;

        res.Status = "CHECKED_IN";
        res.UpdatedAt = DateTime.UtcNow;
        res.IsDirty = true;
        res.LocalSequence++;
        int eventVersion = res.Version;
        res.Version++;

        if (!string.IsNullOrEmpty(encodeData))
        {
            var parsed = JsonSerializer.Deserialize<JsonElement>(encodeData);
            var cardSnr = parsed.ValueKind == JsonValueKind.Object && parsed.TryGetProperty("cardSnr", out var snrProp) ? snrProp.GetString() : null;
            var now = DateTime.UtcNow;

            var credential = new Data.Entities.LocalLockCredential
            {
                Id = Guid.NewGuid().ToString(),
                ReservationId = res.Id,
                RoomId = res.RoomId ?? string.Empty,
                LockId = $"ENCODER-{res.RoomId}",
                CredentialType = "RFID",
                Status = "ACTIVE",
                ValidFrom = res.CheckInDate,
                ValidUntil = res.CheckOutDate,
                CardSerialNumber = cardSnr,
                IssuedAt = now,
                MetadataJson = encodeData,
                CreatedAt = now,
                UpdatedAt = now
            };

            var op = new Data.Entities.LocalLockOperation
            {
                Id = Guid.NewGuid().ToString(),
                PropertyId = res.PropertyId,
                ReservationId = res.Id,
                LockId = credential.LockId,
                RoomId = credential.RoomId,
                CredentialId = credential.Id,
                Operation = "ENCODE_CARD",
                Status = "COMPLETED",
                RequestedAt = now,
                StartedAt = now,
                CompletedAt = now,
                AgentId = "DESKTOP",
                DeviceId = deviceId,
                MetadataJson = JsonSerializer.Serialize(new { initiatedBy = userId }),
                CommandJson = JsonSerializer.Serialize(new { responseData = parsed }),
                CreatedAt = now,
                UpdatedAt = now
            };

            _dbContext.LockCredentials.Add(credential);
            _dbContext.LockOperations.Add(op);
        }

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = res.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "RESERVATION",
            AggregateId = reservationId,
            AggregateVersion = eventVersion,
            EventType = "CHECK_IN",
            Sequence = res.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new 
            { 
                roomId = res.RoomId,
                encodeData = encodeData != null ? JsonSerializer.Deserialize<JsonElement>(encodeData) : (JsonElement?)null
            })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ProcessCheckOutAsync(string reservationId, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.Include(r => r.Folio).FirstOrDefaultAsync(r => r.Id == reservationId);
        if (res == null || res.Status != "CHECKED_IN") return false;

        if (res.Folio != null && res.Folio.OutstandingBalance > 0)
        {
            throw new InvalidOperationException("Cannot check out with an outstanding balance.");
        }

        res.Status = "CHECKED_OUT";
        res.UpdatedAt = DateTime.UtcNow;
        res.IsDirty = true;
        res.LocalSequence++;
        int eventVersion = res.Version;
        res.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = res.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "RESERVATION",
            AggregateId = reservationId,
            AggregateVersion = eventVersion,
            EventType = "CHECK_OUT",
            Sequence = res.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new { roomId = res.RoomId })
        });
        
        // Also auto-generate a cleaning task upon checkout
        var cleaningTask = new LocalHousekeepingTask
        {
            PropertyId = res.PropertyId,
            RoomId = res.RoomId ?? "",
            RoomNumber = res.RoomNumber ?? "",
            TaskType = "CLEANING",
            Status = "PENDING"
        };
        _dbContext.HousekeepingTasks.Add(cleaningTask);
        
        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = cleaningTask.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "HOUSEKEEPING_TASK",
            AggregateId = cleaningTask.Id,
            AggregateVersion = 1,
            EventType = "CREATE",
            Sequence = 1,
            PayloadJson = JsonSerializer.Serialize(cleaningTask)
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateHousekeepingTaskStatusAsync(string taskId, string status, string userId, string deviceId)
    {
        var task = await _dbContext.HousekeepingTasks.FindAsync(taskId);
        if (task == null) return false;

        task.Status = status;
        task.UpdatedAt = DateTime.UtcNow;
        task.IsDirty = true;
        int eventVersion = task.Version;
        task.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = task.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "HOUSEKEEPING_TASK",
            AggregateId = taskId,
            AggregateVersion = eventVersion,
            EventType = "UPDATE_STATUS",
            Sequence = task.Version,
            PayloadJson = JsonSerializer.Serialize(new { status })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<LocalMaintenanceTicket> CreateMaintenanceTicketAsync(LocalMaintenanceTicket ticket, string userId, string deviceId)
    {
        _dbContext.MaintenanceTickets.Add(ticket);
        
        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = ticket.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "MAINTENANCE_TICKET",
            AggregateId = ticket.Id,
            AggregateVersion = 1,
            EventType = "CREATE",
            Sequence = 1,
            PayloadJson = JsonSerializer.Serialize(ticket)
        });

        await _dbContext.SaveChangesAsync();
        return ticket;
    }

    public async Task<bool> ResolveMaintenanceTicketAsync(string ticketId, string userId, string deviceId)
    {
        var ticket = await _dbContext.MaintenanceTickets.FindAsync(ticketId);
        if (ticket == null) return false;

        ticket.Status = "RESOLVED";
        ticket.RequiresRoomRestriction = false;
        ticket.UpdatedAt = DateTime.UtcNow;
        ticket.IsDirty = true;
        int eventVersion = ticket.Version;
        ticket.Version++;

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = ticket.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "MAINTENANCE_TICKET",
            AggregateId = ticketId,
            AggregateVersion = eventVersion,
            EventType = "RESOLVE",
            Sequence = ticket.Version,
            PayloadJson = JsonSerializer.Serialize(new { status = "RESOLVED", requiresRoomRestriction = false })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<LocalFolio?> GetFolioAsync(string folioId)
    {
        return await _dbContext.Folios
            .Include(f => f.Reservation)
            .FirstOrDefaultAsync(f => f.Id == folioId);
    }

    public async Task<LocalReservation?> GetReservationByRoomNumberAsync(string roomNumber)
    {
        return await _dbContext.Reservations
            .Include(r => r.Guest)
            .Include(r => r.Folio)
            .Include(r => r.Rooms).ThenInclude(rr => rr.Room)
            .FirstOrDefaultAsync(r => r.Rooms.Any(rr => rr.Room != null && (rr.Room.Number == roomNumber || rr.Room.Code == roomNumber)) && (r.Status == "CHECKED_IN" || r.Status == "CONFIRMED"));
    }

    public async Task<List<LocalHousekeepingTask>> GetHousekeepingTasksAsync(string propertyId)
    {
        return await _dbContext.HousekeepingTasks
            .Where(t => t.PropertyId == propertyId || t.PropertyId == "") // Also include tasks without propertyId for fallback
            .ToListAsync();
    }

    public async Task<List<LocalMaintenanceTicket>> GetMaintenanceTicketsAsync(string propertyId)
    {
        return await _dbContext.MaintenanceTickets
            .Where(t => t.PropertyId == propertyId)
            .ToListAsync();
    }

    public async Task EnsureDatabaseCreatedAsync()
    {
        await _dbContext.ApplyMigrationsSafelyAsync();
        
        // Seed Stanzel Grand Resort for the pilot if it doesn't exist
        if (!await _dbContext.Properties.AnyAsync())
        {
            _dbContext.Properties.Add(new LocalProperty
            {
                Id = "prop_stanzel_001",
                Name = "Stanzel Grand Resort",
                Code = "SGR",
                City = "Los Angeles",
                Currency = "USD",
                Timezone = "America/Los_Angeles",
                BusinessDate = DateTime.UtcNow.Date,
                IsActive = true,
                EarlyCheckinWindowHours = 2, // Configurable; synced from cloud settings
                BankingModel = "SERVER_BANKING"
            });
            await _dbContext.SaveChangesAsync();
        }
    }

    public async Task<List<LocalProperty>> GetPropertiesAsync()
    {
        return await _dbContext.Properties.Where(p => p.IsActive).ToListAsync();
    }

    public async Task<List<LocalGuest>> GetGuestsAsync()
    {
        return await _dbContext.Guests.Where(g => g.DeletedAt == null).ToListAsync();
    }

    public async Task<List<LocalGuest>> SearchGuestsAsync(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return await _dbContext.Guests.Where(g => g.DeletedAt == null).Take(50).ToListAsync();
        }

        query = query.ToLower();
        return await _dbContext.Guests
            .Where(g => g.DeletedAt == null && 
                        (g.FirstName.ToLower().Contains(query) || 
                         g.LastName.ToLower().Contains(query) || 
                         (g.Email != null && g.Email.ToLower().Contains(query)) || 
                         (g.Phone != null && g.Phone.Contains(query))))
            .Take(50)
            .ToListAsync();
    }

    public async Task UpsertGuestPageTransactionAsync(List<LocalGuest> guests, string? nextCursor)
    {
        using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            foreach (var guest in guests)
            {
                var existing = await _dbContext.Guests.FirstOrDefaultAsync(g => g.Id == guest.Id);
                if (existing == null)
                {
                    _dbContext.Guests.Add(guest);
                }
                else
                {
                    if (existing.IsDirty) continue; // Race-safe: skip overwriting local dirty state

                    existing.FirstName = guest.FirstName;
                    existing.LastName = guest.LastName;
                    existing.Email = guest.Email;
                    existing.Phone = guest.Phone;
                    existing.CompanyName = guest.CompanyName;
                    existing.IsVip = guest.IsVip;
                    existing.UpdatedAt = guest.UpdatedAt;
                    existing.DeletedAt = guest.DeletedAt;
                    existing.Version = guest.Version;
                    _dbContext.Guests.Update(existing);
                }
            }

            var meta = await _dbContext.SyncMetadata.FirstOrDefaultAsync();
            if (meta == null)
            {
                meta = new LodgeCore.Desktop.Data.Entities.LocalSyncMetadata { Id = "1" };
                _dbContext.SyncMetadata.Add(meta);
            }
            
            meta.LastGuestSyncCursor = nextCursor;
            _dbContext.SyncMetadata.Update(meta);
            
            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            throw new Exception($"Failed to process guest page: {ex.Message}");
        }
    }

    public async Task<bool> UpdateGuestAsync(string guestId, string firstName, string lastName, string? email, string? phone, string operatorId, string deviceId)
    {
        var guest = await _dbContext.Guests.FindAsync(guestId);
        if (guest == null) return false;

        guest.FirstName = firstName;
        guest.LastName = lastName;
        guest.Email = email;
        guest.Phone = phone;
        guest.UpdatedAt = DateTime.UtcNow;
        guest.Version++;

        var payload = new 
        {
            guestId = guest.Id,
            firstName = guest.FirstName,
            lastName = guest.LastName,
            email = guest.Email,
            phone = guest.Phone
        };

        var evt = new LocalOutboxEvent
        {
            Id = Guid.NewGuid().ToString(),
            AggregateType = "GUEST",
            AggregateId = guest.Id,
            AggregateVersion = guest.Version,
            EventType = "EDIT_GUEST",
            PayloadJson = JsonSerializer.Serialize(payload),
            OperatorId = operatorId,
            DeviceId = deviceId
        };
        _dbContext.OutboxEvents.Add(evt);
        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<List<LocalRoomType>> GetRoomTypesAsync(string propertyId)
    {
        return await _dbContext.RoomTypes.Where(rt => rt.PropertyId == propertyId).ToListAsync();
    }

    public async Task<object> GetRoomsAsync(string propertyId)
    {
        var rooms = await _dbContext.Rooms.Where(r => r.PropertyId == propertyId).ToListAsync();
        var roomTypes = await _dbContext.RoomTypes.Where(rt => rt.PropertyId == propertyId).ToDictionaryAsync(rt => rt.Id);
        
        return rooms.Select(r => new {
            id = r.Id,
            propertyId = r.PropertyId,
            buildingId = r.BuildingId,
            floorId = r.FloorId,
            code = r.Code,
            number = r.Number,
            displayName = r.DisplayName,
            status = r.Status,
            housekeepingStatus = r.HousekeepingStatus,
            maintenanceStatus = r.MaintenanceStatus,
            roomTypeId = r.RoomTypeId,
            maxOccupancy = r.MaxOccupancy,
            maxAdults = r.MaxAdults,
            maxChildren = r.MaxChildren,
            isAccessible = r.IsAccessible,
            isActive = r.IsActive,
            isOccupied = r.IsOccupied,
            lockSystemCode = r.LockSystemCode,
            createdAt = r.CreatedAt,
            updatedAt = r.UpdatedAt,
            building = string.IsNullOrEmpty(r.BuildingName) ? null : new { name = r.BuildingName },
            floor = string.IsNullOrEmpty(r.FloorName) ? null : new { name = r.FloorName, number = r.FloorNumber ?? 0 },
            roomType = roomTypes.TryGetValue(r.RoomTypeId, out var rt) ? new { name = rt.Name, code = rt.Code } : null
        }).ToList();
    }

    public async Task<object?> GetActiveReservationByRoomAsync(string roomId)
    {
        var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == roomId);
        if (room == null) return null;

        var reservation = await _dbContext.Reservations
            .Include(r => r.Guest)
            .Include(r => r.Folio)
            .Where(r => r.RoomNumber == room.Number && r.Status == "CHECKED_IN")
            .FirstOrDefaultAsync();

        if (reservation == null) return null;

        return new
        {
            reservationId = reservation.Id,
            checkIn = reservation.CheckInDate,
            checkOut = reservation.CheckOutDate,
            folioBalance = reservation.Folio != null ? reservation.Folio.TotalCharges - reservation.Folio.TotalPayments : 0,
            currency = "NGN", // Hardcoded for now based on UI
            room = new { number = room.Number },
            guest = reservation.Guest != null ? new
            {
                firstName = reservation.Guest.FirstName,
                lastName = reservation.Guest.LastName,
                isVip = reservation.Guest.IsVip,
                email = reservation.Guest.Email,
                phone = reservation.Guest.Phone
            } : null,
            lockCredentials = (string[]?)null
        };
    }

    public async Task<object> UpdateRoomStatusAsync(string roomId, string newStatus, string source)
    {
        var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == roomId);
        if (room == null) throw new Exception("Room not found");

        room.Status = newStatus;
        // If it's CLEAN or DIRTY, also update HousekeepingStatus to match cloud behavior if necessary.
        if (newStatus == "CLEAN" || newStatus == "DIRTY") {
            room.HousekeepingStatus = newStatus;
        }
        
        room.UpdatedAt = DateTime.UtcNow;

        var payload = JsonSerializer.Serialize(new
        {
            roomId = room.Id,
            newStatus = newStatus,
            source = source,
            updatedAt = room.UpdatedAt
        });

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = room.PropertyId,
            DeviceId = "System", // Replace with real device ID if available
            OperatorId = "System", // Replace with real operator ID if available
            AggregateType = "ROOM",
            AggregateId = room.Id,
            AggregateVersion = 1,
            EventType = "ROOM_STATUS_UPDATE",
            Sequence = 1,
            PayloadJson = payload,
            CreatedAt = DateTime.UtcNow
        });

        await _dbContext.SaveChangesAsync();

        return room;
    }

    public async Task<object> GetDashboardAsync(string propertyId)
    {
        var today = DateTime.UtcNow.Date; // Ideally we use property timezone, falling back to UTC here

        var property = await _dbContext.Properties.FirstOrDefaultAsync(p => p.Id == propertyId);

        var reservations = await _dbContext.Reservations
            .Include(r => r.Guest)
            .Include(r => r.Folio)
            .Include(r => r.Rooms).ThenInclude(rr => rr.Room)
            .Where(r => r.PropertyId == propertyId && r.Status != "CANCELLED" && r.Status != "NO_SHOW")
            .ToListAsync();
            
        var rooms = await _dbContext.Rooms
            .Where(r => r.PropertyId == propertyId && r.IsActive)
            .ToListAsync();
            
        var roomTypes = await _dbContext.RoomTypes
            .Where(rt => rt.PropertyId == propertyId)
            .ToListAsync();

        var roomDict = rooms.ToDictionary(r => r.Id);
        var roomTypeDict = roomTypes.ToDictionary(rt => rt.Id);

        var arrivalsRaw = reservations.Where(r => r.CheckInDate.Date == today).ToList();
        var departuresRaw = reservations.Where(r => r.CheckOutDate.Date == today).ToList();
        var inHouseCount = reservations.Count(r => r.Status == "CHECKED_IN");
        var totalRooms = rooms.Count;
        var availableRooms = rooms.Count(r => r.Status == "AVAILABLE" || r.Status == "CLEAN");

        var arrivals = arrivalsRaw.Select(r => {
            var balance = r.Folio != null ? (decimal?)(r.Folio.TotalCharges - r.Folio.TotalPayments) : null;
            var room = r.RoomId != null && roomDict.ContainsKey(r.RoomId) ? roomDict[r.RoomId] : null;
            var roomType = room != null && room.RoomTypeId != null && roomTypeDict.ContainsKey(room.RoomTypeId) ? roomTypeDict[room.RoomTypeId] : null;
            var roomStatus = room?.Status ?? "UNKNOWN";
            
            string arrivalStatus = "Ready";
            string arrivalColor = "green";
            
            if (r.Status == "CHECKED_IN") {
                arrivalStatus = "Checked In";
                arrivalColor = "blue";
            } else if (balance != null && balance > 0) {
                arrivalStatus = "Payment Due";
                arrivalColor = "yellow";
            } else if (room == null) {
                arrivalStatus = "Unassigned";
                arrivalColor = "yellow";
            } else if (roomStatus == "OUT_OF_ORDER" || roomStatus == "MAINTENANCE") {
                arrivalStatus = "Room Issue";
                arrivalColor = "red";
            }

            return new {
                id = r.Id,
                guestName = r.Guest != null ? $"{r.Guest.FirstName} {r.Guest.LastName}" : "Unknown",
                confirmationNumber = r.ConfirmationNumber,
                roomName = room?.Number ?? "Unassigned",
                roomTypeName = roomType?.Name ?? "",
                arrivalTime = "14:00", // Fallback, would normally use property.checkInTime
                balance = balance,
                status = r.Status,
                arrivalState = new { label = arrivalStatus, color = arrivalColor },
                roomStatus = roomStatus
            };
        }).ToList();

        var departures = departuresRaw.Select(r => {
            var balance = r.Folio != null ? (decimal?)(r.Folio.TotalCharges - r.Folio.TotalPayments) : null;
            var room = r.RoomId != null && roomDict.ContainsKey(r.RoomId) ? roomDict[r.RoomId] : null;
            var roomType = room != null && room.RoomTypeId != null && roomTypeDict.ContainsKey(room.RoomTypeId) ? roomTypeDict[room.RoomTypeId] : null;
            
            return new {
                id = r.Id,
                guestName = r.Guest != null ? $"{r.Guest.FirstName} {r.Guest.LastName}" : "Unknown",
                confirmationNumber = r.ConfirmationNumber,
                roomName = room?.Number ?? "Unassigned",
                roomTypeName = roomType?.Name ?? "",
                balance = balance,
                status = r.Status,
                roomStatus = room?.Status ?? "UNKNOWN"
            };
        }).ToList();

        return new {
            property = property != null ? new { name = property.Name } : null,
            businessDate = today.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
            kpis = new {
                arrivals = arrivalsRaw.Count,
                departures = departuresRaw.Count,
                inHouse = inHouseCount,
                roomsAvailable = availableRooms,
                roomsTotal = totalRooms
            },
            hardware = new {
                status = "ONLINE",
                message = "Local Desktop Client",
                name = "Desktop Agent"
            },
            arrivals = arrivals,
            departures = departures
        };
    }

    public async Task<List<LocalRoom>> GetAvailableRoomsAsync(string propertyId, string roomTypeId, DateTime checkIn, DateTime checkOut)
    {
        var allRoomsQuery = _dbContext.Rooms
            .Where(r => r.PropertyId == propertyId && r.Status != "OUT_OF_ORDER" && r.Status != "MAINTENANCE");

        if (!string.IsNullOrEmpty(roomTypeId))
        {
            allRoomsQuery = allRoomsQuery.Where(r => r.RoomTypeId == roomTypeId);
        }

        var allRooms = await allRoomsQuery.ToListAsync();

        // Get IDs of rooms already booked in the overlap window via the join table
        var conflictingReservationIds = await _dbContext.Reservations
            .Where(r => r.PropertyId == propertyId
                && (r.Status == "CONFIRMED" || r.Status == "CHECKED_IN")
                && r.CheckInDate < checkOut
                && r.CheckOutDate > checkIn)
            .Select(r => r.Id)
            .ToListAsync();

        var conflictingRoomIds = await _dbContext.Set<LocalReservationRoom>()
            .Where(rr => conflictingReservationIds.Contains(rr.ReservationId) && rr.RoomId != null)
            .Select(rr => rr.RoomId)
            .ToListAsync();

        var outOfOrderRooms = await _dbContext.MaintenanceTickets
            .Where(m => m.PropertyId == propertyId && m.Status != "RESOLVED" && m.RequiresRoomRestriction)
            .Select(m => m.RoomId)
            .Where(id => id != null)
            .ToListAsync();

        var availableRooms = allRooms
            .Where(r => !conflictingRoomIds.Contains(r.Id))
            .Where(r => !outOfOrderRooms.Contains(r.Id))
            .ToList();

        return availableRooms;
    }

    public async Task<LocalPosOrder> CreatePosOrderAsync(LocalPosOrder order, string userId, string deviceId)
    {
        // 1. Generate Deterministic Operation ID
        string operationId = $"op_{deviceId}_{DateTime.UtcNow.Ticks}_{Guid.NewGuid().ToString("N").Substring(0, 8)}";
        order.Id = Guid.NewGuid().ToString();
        
        // Mark everything with the operation ID and device attribution
        foreach (var item in order.Items)
        {
            item.Id = Guid.NewGuid().ToString();
            item.OrderId = order.Id;
        }

        foreach (var payment in order.Payments)
        {
            payment.Id = Guid.NewGuid().ToString();
            payment.OrderId = order.Id;
            payment.Method = payment.Method == "CARD" ? "CARD_OFFLINE" : payment.Method;
            payment.Status = payment.Method == "CASH" ? "CONFIRMED" : "PENDING";
        }

        foreach (var kot in order.Kots)
        {
            kot.Id = Guid.NewGuid().ToString();
            kot.OrderId = order.Id;
            kot.OperationId = operationId;
            kot.BusinessDate = order.BusinessDate;
        }

        _dbContext.PosOrders.Add(order);
        
        AppendSyncEvent("POS_ORDER", order.Id, "ORDER_CREATED", order, deviceId, order.OutletId, order.SessionId, userId);

        if (!string.IsNullOrEmpty(order.TableId))
        {
            var table = await _dbContext.PosTables.FirstOrDefaultAsync(t => t.Id == order.TableId);
            if (table != null)
            {
                if (!string.IsNullOrEmpty(table.CurrentOrderId) && table.CurrentOrderId != order.Id)
                {
                    throw new Exception("Table is already occupied by another order");
                }
                table.CurrentOrderId = order.Id;
                table.UpdatedAt = DateTime.UtcNow;
                // Note: we don't need a separate sync event for table update since cloud ORDER_CREATED takes care of it
            }
        }

        
        if (!string.IsNullOrEmpty(order.FolioId))
        {
            var folioEventData = new { amount = order.Total, description = $"POS Order #{order.OrderNumber}" };
            AppendSyncEvent("FOLIO", order.FolioId, "ADD_ROOM_CHARGE", folioEventData, deviceId, order.OutletId, order.SessionId, userId);
            
            var folio = await _dbContext.Folios.FindAsync(order.FolioId);
            if (folio != null)
            {
                folio.TotalCharges += order.Total;
                folio.UpdatedAt = DateTime.UtcNow;
            }
        }
        
        await _dbContext.SaveChangesAsync();
        return order;
    }
    public async Task<LocalPosOrder> UpdateOrderStatusAsync(string orderId, string status, string reason, string userId, string deviceId)
    {
        var order = await _dbContext.PosOrders.FirstOrDefaultAsync(o => o.Id == orderId);
        if (order == null) throw new Exception("Order not found");

        order.Status = status;
        if (!string.IsNullOrEmpty(reason))
        {
            order.Notes = string.IsNullOrEmpty(order.Notes) ? $"Status Reason: {reason}" : $"{order.Notes}\nStatus Reason: {reason}";
        }
        order.UpdatedAt = DateTime.UtcNow;

        AppendSyncEvent("POS_ORDER", order.Id, status == "CLOSED" ? "ORDER_CLOSED" : "ORDER_UPDATED", new { status = order.Status, notes = order.Notes, updatedAt = order.UpdatedAt }, deviceId, order.OutletId, order.SessionId, userId);

        if (status == "CLOSED" || status == "CANCELLED" || status == "VOIDED")
        {
            var table = await _dbContext.PosTables.FirstOrDefaultAsync(t => t.CurrentOrderId == order.Id);
            if (table != null)
            {
                table.CurrentOrderId = null;
                table.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _dbContext.SaveChangesAsync();

        return order;
    }


    public async Task<LocalPosKot> FireKotAsync(string orderId, List<string> itemIds, string userId, string deviceId)
    {
        var order = await _dbContext.PosOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) throw new Exception("Order not found");

        var itemsToFire = order.Items.Where(i => itemIds.Contains(i.Id)).ToList();
        if (!itemsToFire.Any()) throw new Exception("No valid items selected for KOT");

        string operationId = $"op_kot_{deviceId}_{DateTime.UtcNow.Ticks}_{Guid.NewGuid().ToString("N").Substring(0, 8)}";
        
        var kot = new LocalPosKot
        {
            Id = Guid.NewGuid().ToString(),
            OrderId = orderId,
            OutletId = order.OutletId,
            DeviceId = deviceId,
            CreatedBy = userId,
            KotNumber = $"{order.OrderNumber}-{Guid.NewGuid().ToString("N").Substring(0, 4)}",
            Status = "PENDING",
            PrintStatus = "QUEUED",
            OperationId = operationId,
            BusinessDate = order.BusinessDate,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosKots.Add(kot);

        foreach (var item in itemsToFire)
        {
            item.KotId = kot.Id;
            item.KitchenStatus = "PENDING";
            item.SentToKitchenAt = DateTime.UtcNow;
        }

        AppendSyncEvent("POS_KOT", kot.Id, "KOT_CREATED", new { kot, itemIds }, deviceId, order.OutletId, order.SessionId, userId);
        await _dbContext.SaveChangesAsync();

        return kot;
    }

    public async Task<LocalPosCheck> SplitCheckAsync(string orderId, List<string> orderItemIds, string userId, string deviceId)
    {
        var order = await _dbContext.PosOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) throw new Exception("Order not found");

        var itemsToSplit = order.Items.Where(i => orderItemIds.Contains(i.Id)).ToList();
        if (!itemsToSplit.Any()) throw new Exception("No valid items selected for split");

        string operationId = $"op_split_{deviceId}_{DateTime.UtcNow.Ticks}";

        var newCheck = new LocalPosCheck
        {
            Id = Guid.NewGuid().ToString(),
            OrderId = orderId,
            CheckNumber = $"{order.OrderNumber}-{order.Checks.Count + 1}",
            Status = "OPEN",
            Total = itemsToSplit.Sum(i => i.Total),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _dbContext.PosChecks.Add(newCheck);

        foreach (var item in itemsToSplit)
        {
            item.CheckId = newCheck.Id;
        }

        AppendSyncEvent("POS_ORDER", order.Id, "ORDER_CHECK_SPLIT", order, deviceId, order.OutletId, order.SessionId, userId);

        await _dbContext.SaveChangesAsync();
        return newCheck;
    }

    public async Task<List<LocalPosProduct>> GetPosProductsAsync(string propertyId)
    {
        return await _dbContext.PosProducts.Where(p => p.PropertyId == propertyId && p.IsActive).ToListAsync();
    }

    public async Task<LocalPosSession> OpenPosSessionAsync(string propertyId, string outletId, string bankType, string bankingModel, decimal openingBalance, string userId, string deviceId)
    {
        // 1. Idempotency check: if there is already an active session for this specific context, return it.
        if (bankType == "SERVER")
        {
            var existingServerBank = await GetActiveServerBankAsync(userId, propertyId, outletId);
            if (existingServerBank != null) return existingServerBank;
        }
        else 
        {
            var existingDeviceBank = await GetActiveSessionForDeviceAsync(deviceId);
            if (existingDeviceBank != null) return existingDeviceBank;
        }

        var session = new LocalPosSession
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = propertyId,
            OutletId = outletId,
            DeviceId = deviceId,
            UserId = userId,
            PrimaryOperatorId = userId,
            BankType = bankType,
            BankingModel = bankingModel,
            Status = "OPEN",
            OpenedAt = DateTime.UtcNow,
            OpeningCash = openingBalance
        };

        _dbContext.PosSessions.Add(session);

        AppendSyncEvent("POS_SESSION", session.Id, "POS_SESSION_STARTED", session, deviceId, "", session.Id, userId);

        await _dbContext.SaveChangesAsync();
        return session;
    }

    public async Task<LocalPosOrder?> GetOrderAsync(string orderId)
    {
        var order = await _dbContext.PosOrders
            .Include(o => o.Items)
            .ThenInclude(i => i.Modifiers)
            .Include(o => o.Checks)
            .Include(o => o.Payments)
            .Include(o => o.Voids)
            .Include(o => o.Kots)
            .FirstOrDefaultAsync(o => o.Id == orderId);
            
        if (order != null && order.Checks != null)
        {
            foreach (var check in order.Checks)
            {
                check.Items = order.Items.Where(i => i.CheckId == check.Id).ToList();
            }
        }
        
        return order;
    }

    public async Task<List<object>> GetActiveOrdersAsync(string sessionId, string filter = "my_orders", string? staffId = null)
    {
        var query = _dbContext.PosOrders
            .Include(o => o.Items)
            .Include(o => o.Checks)
            .Where(o => o.SessionId == sessionId && o.Status != "CLOSED" && o.Status != "VOIDED");

        if (filter == "my_orders" && !string.IsNullOrEmpty(staffId))
        {
            query = query.Where(o => o.ServerStaffId == staffId);
        }

        var orders = await query.OrderByDescending(o => o.CreatedAt).ToListAsync();
        var staffIds = orders.Select(o => o.ServerStaffId).Distinct().ToList();
        var staffDict = await _dbContext.Staff.Where(s => staffIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, s => s.FirstName + " " + s.LastName);

        var result = new List<object>();
        foreach (var o in orders)
        {
            result.Add(new {
                id = o.Id,
                orderNumber = o.OrderNumber,
                orderType = o.OrderType,
                tableName = o.TableNumber,
                displayName = o.DisplayName,
                status = o.Status,
                paymentStatus = o.PaymentStatus,
                itemCount = o.Items?.Count ?? 0,
                total = o.Total,
                waiterName = !string.IsNullOrEmpty(o.ServerStaffId) && staffDict.ContainsKey(o.ServerStaffId) ? staffDict[o.ServerStaffId] : "Unknown",
                createdAt = o.CreatedAt
            });
        }
        
        return result;
    }

    public async Task<List<object>> GetWaiterTicketsAsync(string outletId, string staffId, string sessionId)
    {
        var session = await _dbContext.PosSessions.FindAsync(sessionId);
        var businessDate = session?.OpenedAt.Date ?? DateTime.UtcNow.Date;

        var kots = await _dbContext.PosKots
            .Where(k => k.OutletId == outletId && k.CreatedBy == staffId && k.BusinessDate.Date == businessDate)
            .OrderByDescending(k => k.CreatedAt)
            .ToListAsync();

        var result = new List<object>();
        foreach (var kot in kots)
        {
            var itemIds = System.Text.Json.JsonSerializer.Deserialize<List<string>>(kot.ItemIdsJson) ?? new List<string>();
            var items = await _dbContext.PosOrderItems
                .Include(i => i.Modifiers)
                .Where(i => itemIds.Contains(i.Id))
                .ToListAsync();

            result.Add(new {
                id = kot.Id,
                kotNumber = kot.KotNumber,
                status = kot.Status,
                createdAt = kot.CreatedAt,
                order = new {
                    tableNumber = kot.TableNumber,
                    orderNumber = kot.OrderNumber,
                    orderType = "DINE_IN"
                },
                items = items.Select(i => new {
                    id = i.Id,
                    productName = i.ProductName,
                    quantity = i.Quantity,
                    modifiers = i.Modifiers.Select(m => new { name = m.Name })
                })
            });
        }
        return result;
    }

    public async Task<(LocalPosOrder Order, LocalPosKot Kot)> FireItemsAsync(string orderId, List<LocalPosOrderItem> itemsToFire, string userId, string deviceId)
    {
        var order = await _dbContext.PosOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) throw new Exception("Order not found");

        var newItems = new List<LocalPosOrderItem>();

        foreach (var item in itemsToFire)
        {
            item.Id = Guid.NewGuid().ToString();
            item.OrderId = order.Id;
            item.CheckId = order.Checks?.FirstOrDefault(c => c.Status == "OPEN")?.Id;
            item.KitchenStatus = "PENDING";
            item.CreatedAt = DateTime.UtcNow;
            
            _dbContext.PosOrderItems.Add(item);
            newItems.Add(item);

            if (item.Modifiers != null)
            {
                foreach (var mod in item.Modifiers)
                {
                    mod.Id = Guid.NewGuid().ToString();
                    mod.OrderItemId = item.Id;
                    _dbContext.PosOrderItemModifiers.Add(mod);
                }
            }
        }

        order.Subtotal += newItems.Sum(i => i.UnitPrice * i.Quantity);
        order.TaxAmount += newItems.Sum(i => i.TaxAmount);
        order.Total += newItems.Sum(i => i.Total);
        order.UpdatedAt = DateTime.UtcNow;

        var kot = new LocalPosKot
        {
            Id = Guid.NewGuid().ToString(),
            OrderId = order.Id,
            OrderNumber = order.OrderNumber,
            KotNumber = $"{order.OrderNumber}-{order.Kots?.Count + 1 ?? 1}",
            TableNumber = order.TableNumber,
            ServerName = "Server", // Ideally fetch server name
            Status = "PENDING",
            FiredAt = DateTime.UtcNow,
            ItemIdsJson = JsonSerializer.Serialize(newItems.Select(i => i.Id))
        };
        _dbContext.PosKots.Add(kot);

        AppendSyncEvent("POS_ORDER", order.Id, "ORDER_ITEMS_ADDED", new { order, kot }, deviceId, order.OutletId, order.SessionId, userId);

        await _dbContext.SaveChangesAsync();
        return (order, kot);
    }

    /// <summary>
    /// Reconstructs the full receipt audit chain from SQLite — works 100% offline.
    /// Produces a rich receipt document with server identity, payment trail, KOT history, and
    /// a deterministic verification token that matches what the cloud would generate.
    /// </summary>
    public async Task<object> GetReceiptAsync(string orderId)
    {
        var order = await _dbContext.PosOrders
            .Include(o => o.Items)
            .ThenInclude(i => i.Modifiers)
            .Include(o => o.Payments)
            .Include(o => o.Voids)
            .Include(o => o.Kots)
            .Include(o => o.Checks)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) throw new Exception($"Order {orderId} not found in local database.");

        // Resolve staff names locally
        var serverStaff = await _dbContext.Staff.FirstOrDefaultAsync(s => s.Id == order.ServerStaffId);
        
        // Resolve outlet name
        var outlet = await _dbContext.PosOutlets.FirstOrDefaultAsync(o => o.Id == order.OutletId);
        
        // Resolve session ownership
        var session = await _dbContext.PosSessions.FirstOrDefaultAsync(s => s.Id == order.SessionId);
        var sessionOwner = session != null 
            ? await _dbContext.Staff.FirstOrDefaultAsync(s => s.Id == session.StaffId)
            : null;

        // Build the verification token deterministically from immutable order data
        // This must match the algorithm used by the cloud for cross-verification
        var rawToken = $"{order.Id}:{order.OrderNumber}:{order.Total}:{order.BusinessDate:yyyyMMdd}:{order.PropertyId}:{order.SessionId}";
        var tokenBytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(rawToken));
        var verificationToken = $"LOC-{BitConverter.ToString(tokenBytes).Replace("-", "")[..24]}";

        var receipt = new
        {
            orderId = order.Id,
            orderNumber = order.OrderNumber,
            status = order.Status,
            businessDate = order.BusinessDate,
            tableNumber = order.TableNumber,
            guestCount = order.GuestCount,
            notes = order.Notes,

            // Financials
            subtotal = order.Subtotal,
            taxAmount = order.TaxAmount,
            serviceCharge = order.ServiceCharge,
            tipAmount = order.TipAmount,
            total = order.Total,

            // Items with modifiers
            items = order.Items.Select(i => new
            {
                id = i.Id,
                productName = i.ProductName,
                quantity = i.Quantity,
                unitPrice = i.UnitPrice,
                taxAmount = i.TaxAmount,
                total = i.Total,
                kitchenStatus = i.KitchenStatus,
                course = i.Course,
                voidReason = i.VoidReason,
                checkId = i.CheckId,
                modifiers = i.Modifiers.Select(m => new { m.Name, m.Price })
            }),

            // Payments trail
            payments = order.Payments.Select(p => new
            {
                p.Id,
                p.Method,
                p.Amount,
                p.Currency,
                p.Status,
                p.BusinessDate,
                receiptNumber = $"RCP-{p.OperationId?.Split('_').LastOrDefault() ?? p.Id[..8].ToUpper()}"
            }),

            // Voids (audit trail)
            voids = order.Voids.Select(v => new
            {
                v.Id,
                v.OrderItemId,
                v.Reason,
                v.AuthorizerId,
                v.BusinessDate
            }),

            // KOT history
            kots = order.Kots.Select(k => new
            {
                k.KotNumber,
                k.Status,
                k.PrintStatus,
                k.PrintedAt,
                k.BusinessDate
            }),

            // Audit chain — the forensic trail
            auditChain = new
            {
                serverName = serverStaff != null ? $"{serverStaff.FirstName} {serverStaff.LastName}" : "Unknown",
                serverStaffId = order.ServerStaffId,
                sessionId = order.SessionId,
                sessionOwnerName = sessionOwner != null ? $"{sessionOwner.FirstName} {sessionOwner.LastName}" : "Unknown",
                outletName = outlet?.Name ?? "Unknown Outlet",
                deviceId = order.DeviceId,
                operationId = order.OperationId
            },

            // Verification
            verificationToken,
            verificationMode = "OFFLINE_LOCAL_SHA256",
            outlet = outlet == null ? null : new { outlet.Id, outlet.Name }
        };

        return receipt;
    }

    /// <summary>Returns a single staff member by Id.</summary>
    public async Task<LocalStaff?> GetStaffByIdAsync(string staffId)
    {
        return await _dbContext.Staff.FirstOrDefaultAsync(s => s.Id == staffId);
    }

    public async Task<LocalPosPayment> PayOrderAsync(string orderId, string method, decimal amount, string currency, string checkId, string userId, string deviceId)
    {
        var order = await _dbContext.PosOrders.FirstOrDefaultAsync(o => o.Id == orderId);
        if (order == null) throw new Exception("Order not found");

        var payment = new LocalPosPayment
        {
            Id = Guid.NewGuid().ToString(),
            OrderId = orderId,
            CheckId = checkId,
            SessionId = order.SessionId,
            Method = method,
            Amount = amount,
            Currency = currency,
            Status = "CONFIRMED",
            OperationId = $"op_pay_{deviceId}_{DateTime.UtcNow.Ticks}",
            BusinessDate = order.BusinessDate,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosPayments.Add(payment);

        AppendSyncEvent("POS_PAYMENT", payment.Id, "PAYMENT_RECORDED", payment, deviceId, order.OutletId, order.SessionId, userId);

        if (!string.IsNullOrEmpty(checkId))
        {
            var check = await _dbContext.PosChecks.FirstOrDefaultAsync(c => c.Id == checkId);
            if (check != null)
            {
                var checkPayments = await _dbContext.PosPayments.Where(p => p.CheckId == checkId).SumAsync(p => p.Amount);
                if (checkPayments + amount >= check.Total)
                {
                    check.Status = "PAID";
                    AppendSyncEvent("POS_CHECK", check.Id, "CHECK_PAID", new { status = "PAID" }, deviceId, order.OutletId, order.SessionId, userId);
                }
            }
        }

        var orderPayments = await _dbContext.PosPayments.Where(p => p.OrderId == orderId).SumAsync(p => p.Amount);
        if (orderPayments + amount >= order.Total)
        {
            order.Status = "COMPLETED";
            AppendSyncEvent("POS_ORDER", order.Id, "ORDER_COMPLETED", new { status = "COMPLETED" }, deviceId, order.OutletId, order.SessionId, userId);
        }

        await _dbContext.SaveChangesAsync();
        return payment;
    }

    public async Task<LocalPosSettlement> SettleSessionAsync(string sessionId, decimal actualCash, string operatorId, string? authorizerId, string deviceId)
    {
        var session = await _dbContext.PosSessions.FindAsync(sessionId);
        if (session == null) throw new Exception("Session not found");
        if (session.Status == "CLOSED" || session.Status == "SETTLED") throw new Exception("Session is already closed or settled");

        var details = await GetSessionSettlementDetailsAsync(sessionId);

        // Validation for override variance
        if (session.BankType != "SERVER" && details.Variance != 0 && string.IsNullOrEmpty(authorizerId))
        {
            throw new UnauthorizedAccessException("Variance requires supervisor approval.");
        }

        string operationId = $"op_settle_{deviceId}_{DateTime.UtcNow.Ticks}";

        var settlement = new LocalPosSettlement
        {
            Id = Guid.NewGuid().ToString(),
            SessionId = sessionId,
            PropertyId = session.PropertyId,
            DeviceId = deviceId,
            OperatorId = operatorId,
            SessionOwnerId = session.UserId,
            BusinessDate = session.OpenedAt.Date, // Binds business date to the session's exact open date for local audit accuracy
            ExpectedCash = details.ExpectedCash,
            ActualCash = actualCash,
            Variance = actualCash - details.ExpectedCash,
            AuthorizerId = authorizerId,
            SettledAt = DateTime.UtcNow,
            Status = session.BankType == "SERVER" ? "PENDING_HANDOVER" : "SETTLED",
            OperationId = operationId
        };

        _dbContext.PosSettlements.Add(settlement);

        // Record the actual settlement as a movement for immutable ledger
        var movement = new LocalPosCashMovement
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = session.PropertyId,
            PosSessionId = sessionId,
            DeviceId = deviceId,
            UserId = operatorId,
            Amount = actualCash,
            Type = "SETTLED_ACTUAL",
            ReasonCode = "SETTLEMENT",
            OperationId = $"op_cashmvt_settle_{deviceId}_{DateTime.UtcNow.Ticks}",
            AuthorizedBy = authorizerId,
            CreatedAt = DateTime.UtcNow
        };
        _dbContext.PosCashMovements.Add(movement);

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = movement.OperationId,
            EntityType = "POS_CASH_MOVEMENT",
            EntityId = movement.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(movement),
            UserId = operatorId,
            DeviceId = deviceId
        });

        if (settlement.Variance != 0)
        {
            var varMovement = new LocalPosCashMovement
            {
                Id = Guid.NewGuid().ToString(),
                PropertyId = session.PropertyId,
                PosSessionId = sessionId,
                DeviceId = deviceId,
                UserId = operatorId,
                Amount = settlement.Variance,
                Type = "VARIANCE",
                ReasonCode = "SETTLEMENT_VARIANCE",
                OperationId = $"op_cashmvt_var_{deviceId}_{DateTime.UtcNow.Ticks}",
                AuthorizedBy = authorizerId,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.PosCashMovements.Add(varMovement);

            _dbContext.SyncEvents.Add(new LocalSyncEvent
            {
                OperationId = varMovement.OperationId,
                EntityType = "POS_CASH_MOVEMENT",
                EntityId = varMovement.Id,
                OperationType = "CREATE",
                PayloadJson = JsonSerializer.Serialize(varMovement),
                UserId = operatorId,
                DeviceId = deviceId
            });
        }

        session.Status = session.BankType == "SERVER" ? "RECONCILIATION_REQUIRED" : "CLOSED";
        session.ClosedAt = DateTime.UtcNow;

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_SETTLEMENT",
            EntityId = settlement.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(settlement),
            UserId = operatorId,
            DeviceId = deviceId
        });

        // Also sync the session close
        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = $"op_session_close_{sessionId}_{DateTime.UtcNow.Ticks}",
            EntityType = "POS_SESSION",
            EntityId = session.Id,
            OperationType = "UPDATE",
            PayloadJson = JsonSerializer.Serialize(new { Status = session.Status, ClosedAt = session.ClosedAt }),
            UserId = operatorId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return settlement;
    }

    public async Task<LocalCashAccount> EnsureCashAccountAsync(string propertyId, string accountType, string name, string? referenceId = null)
    {
        string accountId = referenceId != null ? $"{accountType}_{referenceId}" : $"{accountType}_MAIN";
        var account = await _dbContext.CashAccounts.FindAsync(accountId);
        
        if (account == null)
        {
            account = new LocalCashAccount
            {
                Id = accountId,
                PropertyId = propertyId,
                Name = name,
                Type = accountType,
                OwnerId = referenceId,
                Balance = 0,
                IsActive = true
            };
            _dbContext.CashAccounts.Add(account);
            AppendSyncEvent(
                entityType: "CASH_ACCOUNT",
                entityId: accountId,
                operationType: "CREATE",
                payload: account,
                terminalId: null, // Global to property usually
                sessionId: null,
                outletId: null,
                operatorId: null
            );
            await _dbContext.SaveChangesAsync();
        }
        return account;
    }

    public async Task<LocalPosSettlement> ConfirmHandoverAsync(string sessionId, string managerPin, string deviceId)
    {
        using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            var session = await _dbContext.PosSessions.FindAsync(sessionId);
            if (session == null) throw new Exception("Session not found");
            if (session.Status != "PENDING_HANDOVER" && session.Status != "RECONCILIATION_REQUIRED") 
                throw new Exception("Session is not in a handover state.");

            var settlement = await _dbContext.PosSettlements.FirstOrDefaultAsync(s => s.SessionId == sessionId);
            if (settlement == null) throw new Exception("Settlement record not found.");
            if (settlement.Status == "CLOSED") throw new Exception("Settlement has already been confirmed.");

            // Idempotency: Check if a SERVER_HANDOVER movement already exists for this session
            bool handoverExists = await _dbContext.PosCashMovements.AnyAsync(m => m.PosSessionId == sessionId && m.Type == "SERVER_HANDOVER");
            if (handoverExists) throw new Exception("Handover movement already exists for this session.");

            // Authorize Manager
            var authorizer = await ValidateSupervisorPinAsync(managerPin, session.PropertyId);
            if (authorizer == null) throw new UnauthorizedAccessException("Invalid Manager PIN");

            // Separation of Duties check
            if (authorizer.Id == settlement.OperatorId || authorizer.Id == session.UserId)
                throw new UnauthorizedAccessException("The authorizing manager cannot be the same operator who declared the shift.");

            // Resolve correct source account based on BankType
            LodgeCore.Desktop.Data.Entities.LocalCashAccount sourceAccount;
            if (session.BankType == PosConstants.BankTypes.Emergency) {
                sourceAccount = await _dbContext.CashAccounts.FirstOrDefaultAsync(a => a.Type == PosConstants.CashAccountTypes.EmergencyBank && a.OwnerId == session.AuthorizedBy)
                                ?? throw new Exception("Emergency Bank account not found.");
            } else if (session.BankType == PosConstants.BankTypes.Central || session.BankingModel == PosConstants.BankingModels.CentralCashier) {
                sourceAccount = await EnsureCashAccountAsync(session.PropertyId, PosConstants.CashAccountTypes.StationBank, $"Station Bank - {session.UserId}", session.UserId);
            } else {
                sourceAccount = await EnsureCashAccountAsync(session.PropertyId, PosConstants.CashAccountTypes.ServerBank, $"Server Bank - {session.UserId}", session.UserId);
            }
            
            var safeAccount = await EnsureCashAccountAsync(session.PropertyId, PosConstants.CashAccountTypes.Safe, "Central Safe");

            string handoverType = session.BankType == PosConstants.BankTypes.Emergency ? PosConstants.HandoverTypes.EmergencyHandover : 
                                 (session.BankType == PosConstants.BankTypes.Central || session.BankingModel == PosConstants.BankingModels.CentralCashier ? PosConstants.HandoverTypes.StationHandover : PosConstants.HandoverTypes.ServerHandover);

            var prop = await _dbContext.Properties.FindAsync(session.PropertyId);
            string currency = prop?.Currency ?? "NGN";

            var handoverMovement = new LocalPosCashMovement
            {
                Id = Guid.NewGuid().ToString(),
                PropertyId = session.PropertyId,
                PosSessionId = sessionId,
                DeviceId = deviceId,
                UserId = authorizer.Id,
                Amount = settlement.ActualCash, // Actual Cash moved!
                Currency = currency,
                Type = handoverType,
                SourceAccountId = sourceAccount.Id,
                DestinationAccountId = safeAccount.Id,
                ReasonCode = "MANAGER_CONFIRMATION",
                OperationId = $"op_handover_mvt_{deviceId}_{DateTime.UtcNow.Ticks}",
                AuthorizedBy = authorizer.Id,
                CreatedAt = DateTime.UtcNow,
                BusinessDate = session.OpenedAt.Date
            };

            _dbContext.PosCashMovements.Add(handoverMovement);

            settlement.Status = "CLOSED";
            settlement.AuthorizerId = authorizer.Id;

            session.Status = "CLOSED";
            
            _dbContext.SyncEvents.Add(new LocalSyncEvent
            {
                OperationId = $"op_handover_conf_{deviceId}_{DateTime.UtcNow.Ticks}",
                EntityType = "POS_SESSION",
                EntityId = session.Id,
                OperationType = "UPDATE",
                PayloadJson = JsonSerializer.Serialize(new { Status = "CLOSED" }),
                UserId = authorizer.Id,
                DeviceId = deviceId
            });

            _dbContext.SyncEvents.Add(new LocalSyncEvent
            {
                OperationId = $"op_settlement_conf_{deviceId}_{DateTime.UtcNow.Ticks}",
                EntityType = "POS_SETTLEMENT",
                EntityId = settlement.Id,
                OperationType = "UPDATE",
                PayloadJson = JsonSerializer.Serialize(new { Status = "CLOSED", AuthorizerId = authorizer.Id }),
                UserId = authorizer.Id,
                DeviceId = deviceId
            });

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();
            return settlement;
        }
        catch (Exception)
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<(decimal ExpectedCash, decimal Variance, decimal OpeningFloat, decimal CashSales, decimal CardSales, decimal BankTransferSales, decimal RoomChargeSales, decimal OtherSales, decimal TotalSales, decimal CashIn, decimal CashDrops, decimal PaidOuts, decimal TransfersOut, decimal CashRefunds)> GetSessionSettlementDetailsAsync(string sessionId)
    {
        var session = await _dbContext.PosSessions.FindAsync(sessionId);
        if (session == null) throw new Exception("Session not found");

        var movements = await _dbContext.PosCashMovements
            .Where(m => m.PosSessionId == sessionId)
            .ToListAsync();

        var payments = await _dbContext.PosPayments
            .Include(p => p.OrderId)
            .Where(p => p.Status == "COMPLETED" && _dbContext.PosOrders.Any(o => o.Id == p.OrderId && o.SessionId == sessionId))
            .ToListAsync();

        decimal openingFloat = movements.Where(m => m.Type == "OPENING_FLOAT").Sum(m => m.Amount);
        
        // Sales breakdown
        decimal cashSales = payments.Where(p => p.Method == PosConstants.PaymentMethods.Cash).Sum(p => p.Amount);
        decimal cardSales = payments.Where(p => p.Method == PosConstants.PaymentMethods.Card).Sum(p => p.Amount);
        decimal bankTransferSales = payments.Where(p => p.Method == PosConstants.PaymentMethods.BankTransfer).Sum(p => p.Amount);
        decimal roomChargeSales = payments.Where(p => p.Method == PosConstants.PaymentMethods.RoomCharge).Sum(p => p.Amount);
        decimal otherSales = payments.Where(p => p.Method != PosConstants.PaymentMethods.Cash && p.Method != PosConstants.PaymentMethods.Card && p.Method != PosConstants.PaymentMethods.BankTransfer && p.Method != PosConstants.PaymentMethods.RoomCharge).Sum(p => p.Amount);
        decimal totalSales = payments.Sum(p => p.Amount);

        decimal cashIn = movements.Where(m => m.Type == "CASH_IN" || m.Type == "CASH_TRANSFER_IN").Sum(m => m.Amount);
        decimal cashDrops = movements.Where(m => m.Type == "CASH_DROP").Sum(m => m.Amount);
        decimal paidOuts = movements.Where(m => m.Type == "PAID_OUT").Sum(m => m.Amount);
        decimal transfersOut = movements.Where(m => m.Type == "CASH_TRANSFER_OUT").Sum(m => m.Amount);
        decimal refunds = movements.Where(m => m.Type == "REFUND_CASH").Sum(m => m.Amount);

        decimal expectedCash = openingFloat + cashSales + cashIn - cashDrops - paidOuts - transfersOut - refunds;

        return (
            expectedCash,
            0,
            openingFloat,
            cashSales,
            cardSales,
            bankTransferSales,
            roomChargeSales,
            otherSales,
            totalSales,
            cashIn,
            cashDrops,
            paidOuts,
            transfersOut,
            refunds
        );
    }

    public async Task<List<LocalPosCashMovement>> GetCashMovementsAsync(string sessionId)
    {
        return await _dbContext.PosCashMovements
            .Where(m => m.PosSessionId == sessionId)
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync();
    }

    public async Task<LocalPosVoid> AuthorizeVoidAsync(string orderId, string orderItemId, string reason, string authorizerId, string userId, string deviceId)
    {
        string operationId = $"op_void_{deviceId}_{DateTime.UtcNow.Ticks}";
        
        var posVoid = new LocalPosVoid
        {
            Id = Guid.NewGuid().ToString(),
            OrderId = orderId,
            OrderItemId = orderItemId,
            Reason = reason,
            AuthorizerId = authorizerId,
            OperationId = operationId,
            DeviceId = deviceId,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosVoids.Add(posVoid);

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_VOID",
            EntityId = posVoid.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(posVoid),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return posVoid;
    }

    public async Task<LocalPosPayment> RecordRefundAsync(string orderId, decimal amount, string method, string authorizerId, string userId, string deviceId)
    {
        string operationId = $"op_refund_{deviceId}_{DateTime.UtcNow.Ticks}";
        
        var payment = new LocalPosPayment
        {
            Id = Guid.NewGuid().ToString(),
            OrderId = orderId,
            Method = method,
            Status = method == "CASH" ? "CONFIRMED" : "PENDING_GATEWAY",
            Amount = -amount, // Negative for refund
            OperationId = operationId,
            DeviceId = deviceId,
            PaidAt = DateTime.UtcNow
        };

        _dbContext.PosPayments.Add(payment);

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_PAYMENT",
            EntityId = payment.Id,
            OperationType = "CREATE", // Might map to a REFUND type eventually, but for now treating as negative payment
            PayloadJson = JsonSerializer.Serialize(payment),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return payment;
    }

    public async Task<LocalPosCashMovement> RecordCashMovementAsync(string propertyId, string sessionId, decimal amount, string type, string reasonCode, string? notes, string? receiptReference, string? authorizedBy, string userId, string deviceId, string sourceAccountId = "", string destinationAccountId = "")
    {
        string operationId = $"op_cashmvt_{deviceId}_{DateTime.UtcNow.Ticks}";
        
        var prop = await _dbContext.Properties.FindAsync(propertyId);
        string currency = prop?.Currency ?? "NGN";

        var movement = new LocalPosCashMovement
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = propertyId,
            PosSessionId = sessionId,
            DeviceId = deviceId,
            UserId = userId,
            Amount = amount,
            Currency = currency,
            Type = type,
            SourceAccountId = sourceAccountId,
            DestinationAccountId = destinationAccountId,
            ReasonCode = reasonCode,
            Notes = notes,
            ReceiptReference = receiptReference,
            OperationId = operationId,
            AuthorizedBy = authorizedBy,
            BusinessDate = DateTime.UtcNow.Date,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosCashMovements.Add(movement);

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_CASH_MOVEMENT",
            EntityId = movement.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(movement),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return movement;
    }

    public async Task<List<object>> GetPendingHandoversAsync(string propertyId)
    {
        var pendingSessions = await _dbContext.PosSessions
            .Where(s => s.PropertyId == propertyId && (s.Status == "PENDING_HANDOVER" || s.Status == "RECONCILIATION_REQUIRED"))
            .ToListAsync();
            
        var settlements = await _dbContext.PosSettlements
            .Where(s => s.PropertyId == propertyId && pendingSessions.Select(p => p.Id).Contains(s.SessionId))
            .ToListAsync();

        return pendingSessions.Select(session => {
            var stl = settlements.FirstOrDefault(s => s.SessionId == session.Id);
            return (object)new {
                Session = session,
                Settlement = stl
            };
        }).ToList();
    }

    public async Task<object> GetCashOfficeOverviewAsync(string propertyId)
    {
        var safeAccount = await EnsureCashAccountAsync(propertyId, PosConstants.CashAccountTypes.Safe, "Central Safe");
        
        var pendingHandoversCount = await _dbContext.PosSessions
            .CountAsync(s => s.PropertyId == propertyId && (s.Status == "PENDING_HANDOVER" || s.Status == "RECONCILIATION_REQUIRED"));

        var pendingSessions = await _dbContext.PosSessions
            .Where(s => s.PropertyId == propertyId && (s.Status == "PENDING_HANDOVER" || s.Status == "RECONCILIATION_REQUIRED"))
            .Select(s => s.Id)
            .ToListAsync();
            
        var pendingCashAmount = await _dbContext.PosSettlements
            .Where(s => pendingSessions.Contains(s.SessionId))
            .SumAsync(s => s.ActualCash);

        var today = DateTime.UtcNow.Date;
        
        var safeMovements = await _dbContext.PosCashMovements
            .Where(m => m.PropertyId == propertyId && (m.SourceAccountId == safeAccount.Id || m.DestinationAccountId == safeAccount.Id))
            .ToListAsync();
            
        decimal safeBalance = safeMovements.Where(m => m.DestinationAccountId == safeAccount.Id).Sum(m => m.Amount)
                            - safeMovements.Where(m => m.SourceAccountId == safeAccount.Id).Sum(m => m.Amount);

        decimal todayDeposits = safeMovements
            .Where(m => m.SourceAccountId == safeAccount.Id && m.Type == PosConstants.CashMovementTypes.BankDeposit && m.CreatedAt >= today)
            .Sum(m => m.Amount);

        decimal todayVariances = await _dbContext.PosSettlements
            .Where(s => s.PropertyId == propertyId && s.SettledAt >= today)
            .SumAsync(s => s.Variance);

        return new {
            PendingHandoversCount = pendingHandoversCount,
            PendingCashAmount = pendingCashAmount,
            SafeBalance = safeBalance,
            TodayDeposits = todayDeposits,
            TodayVariances = todayVariances
        };
    }

    public async Task<LocalPosCashMovement> OpenSafeAsync(string propertyId, decimal amount, string managerPin, string deviceId)
    {
        var authorizer = await ValidateSupervisorPinAsync(managerPin, propertyId);
        if (authorizer == null) throw new UnauthorizedAccessException("Invalid Manager PIN");

        var safeAccount = await EnsureCashAccountAsync(propertyId, PosConstants.CashAccountTypes.Safe, "Central Safe");
        var externalAccount = await EnsureCashAccountAsync(propertyId, PosConstants.CashAccountTypes.External, "External Funds");

        // Check if already opened (idempotency check for opening float)
        var exists = await _dbContext.PosCashMovements.AnyAsync(m => m.DestinationAccountId == safeAccount.Id && m.Type == PosConstants.CashMovementTypes.SafeOpeningBalance);
        if (exists) throw new Exception("The safe has already been initialized with an opening balance.");

        var prop = await _dbContext.Properties.FindAsync(propertyId);
        string currency = prop?.Currency ?? "NGN";

        var movement = new LocalPosCashMovement
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = propertyId,
            DeviceId = deviceId,
            UserId = authorizer.Id,
            Amount = amount,
            Currency = currency,
            Type = PosConstants.CashMovementTypes.SafeOpeningBalance,
            SourceAccountId = externalAccount.Id,
            DestinationAccountId = safeAccount.Id,
            ReasonCode = "INITIALIZATION",
            Notes = "Initial safe float",
            OperationId = $"op_safe_open_{deviceId}_{DateTime.UtcNow.Ticks}",
            AuthorizedBy = authorizer.Id,
            BusinessDate = DateTime.UtcNow.Date,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosCashMovements.Add(movement);
        await _dbContext.SaveChangesAsync();
        return movement;
    }

    public async Task<List<LocalPosCashMovement>> GetSafeLedgerAsync(string propertyId)
    {
        var safeAccount = await EnsureCashAccountAsync(propertyId, PosConstants.CashAccountTypes.Safe, "Central Safe");
        return await _dbContext.PosCashMovements
            .Where(m => m.PropertyId == propertyId && (m.SourceAccountId == safeAccount.Id || m.DestinationAccountId == safeAccount.Id))
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync();
    }

    public async Task<LocalPosCashMovement> RecordBankDepositAsync(string propertyId, decimal amount, string reference, string managerPin, string deviceId)
    {
        var authorizer = await ValidateSupervisorPinAsync(managerPin, propertyId);
        if (authorizer == null) throw new UnauthorizedAccessException("Invalid Manager PIN");

        var safeAccount = await EnsureCashAccountAsync(propertyId, PosConstants.CashAccountTypes.Safe, "Central Safe");
        var bankAccount = await EnsureCashAccountAsync(propertyId, PosConstants.CashAccountTypes.BankAccount, "Main Bank Account");

        var safeMovements = await _dbContext.PosCashMovements
            .Where(m => m.PropertyId == propertyId && (m.SourceAccountId == safeAccount.Id || m.DestinationAccountId == safeAccount.Id))
            .ToListAsync();
            
        decimal currentBalance = safeMovements.Where(m => m.DestinationAccountId == safeAccount.Id).Sum(m => m.Amount)
                               - safeMovements.Where(m => m.SourceAccountId == safeAccount.Id).Sum(m => m.Amount);

        if (amount > currentBalance) throw new Exception("Insufficient funds in Central Safe.");

        var prop = await _dbContext.Properties.FindAsync(propertyId);
        string currency = prop?.Currency ?? "NGN";

        var movement = new LocalPosCashMovement
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = propertyId,
            DeviceId = deviceId,
            UserId = authorizer.Id,
            Amount = amount,
            Currency = currency,
            Type = PosConstants.CashMovementTypes.BankDeposit,
            SourceAccountId = safeAccount.Id,
            DestinationAccountId = bankAccount.Id,
            ReasonCode = PosConstants.CashMovementTypes.BankDeposit,
            ReceiptReference = reference,
            OperationId = $"op_bank_dep_{deviceId}_{DateTime.UtcNow.Ticks}",
            AuthorizedBy = authorizer.Id,
            BusinessDate = DateTime.UtcNow.Date,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosCashMovements.Add(movement);
        await _dbContext.SaveChangesAsync();
        return movement;
    }

    public async Task<LocalPosReceiptAudit> RecordReceiptPrintAsync(string propertyId, string? orderId, string? sessionId, string type, string? reason, int printCount, string userId, string deviceId)
    {
        string operationId = $"op_receipt_{deviceId}_{DateTime.UtcNow.Ticks}_{Guid.NewGuid().ToString("N").Substring(0, 8)}";
        
        var audit = new LocalPosReceiptAudit
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = propertyId,
            OrderId = orderId,
            DeviceId = deviceId,
            PosSessionId = sessionId,
            UserId = userId,
            Type = type,
            Reason = reason,
            PrintCount = printCount,
            OperationId = operationId,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosReceiptAudits.Add(audit);

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_RECEIPT_AUDIT",
            EntityId = audit.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(audit),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return audit;
    }

    public async Task<List<LocalStaff>> GetActiveStaffAsync(string propertyId)
    {
        return await _dbContext.Staff
            .Where(s => s.PropertyId == propertyId && s.IsActive && s.HasPosAccess)
            .ToListAsync();
    }

    public async Task<LocalStaff?> AuthenticateOperatorAsync(string staffId, string pin, string propertyId)
    {
        var staff = await _dbContext.Staff.FirstOrDefaultAsync(s => s.Id == staffId && s.PropertyId == propertyId);
        if (staff == null || !staff.IsActive || !staff.HasPosAccess || string.IsNullOrEmpty(staff.PosPinHash)) return null;

        // Verify PIN hash using BCrypt
        if (!BCrypt.Net.BCrypt.Verify(pin, staff.PosPinHash)) return null; 

        return staff;
    }

    public async Task<LocalStaff?> AuthenticateDesktopUserAsync(string staffId, string pin)
    {
        // 1. Find active staff with POS access regardless of property (since this is device-level login)
        var staff = await _dbContext.Staff.FirstOrDefaultAsync(s => s.Id == staffId);
        if (staff == null || !staff.IsActive || !staff.HasPosAccess) 
        {
            return null;
        }

        // 2. Enforce Rate Limiting
        var attempt = await _dbContext.LoginAttempts.FirstOrDefaultAsync(a => a.StaffId == staffId);
        if (attempt != null && attempt.LockedUntil.HasValue && attempt.LockedUntil.Value > DateTime.UtcNow)
        {
            throw new Exception($"Account locked due to too many failed attempts. Try again in {(int)(attempt.LockedUntil.Value - DateTime.UtcNow).TotalMinutes} minutes.");
        }

        // 3. Verify PIN Hash using BCrypt
        if (string.IsNullOrEmpty(staff.PosPinHash) || !BCrypt.Net.BCrypt.Verify(pin, staff.PosPinHash))
        {
            if (attempt == null)
            {
                attempt = new LocalLoginAttempt { StaffId = staffId, FailedAttempts = 1, LastAttemptAt = DateTime.UtcNow };
                _dbContext.LoginAttempts.Add(attempt);
            }
            else
            {
                attempt.FailedAttempts++;
                attempt.LastAttemptAt = DateTime.UtcNow;
                if (attempt.FailedAttempts >= 5) // Lock out after 5 failures
                {
                    attempt.LockedUntil = DateTime.UtcNow.AddMinutes(15); // Lock for 15 minutes
                }
            }
            await _dbContext.SaveChangesAsync();
            return null; // Invalid credentials
        }

        // 4. Success -> Clear failed attempts
        if (attempt != null)
        {
            _dbContext.LoginAttempts.Remove(attempt);
            await _dbContext.SaveChangesAsync();
        }

        return staff;
    }

    public async Task<LocalStaff?> ValidateSupervisorPinAsync(string pin, string propertyId)
    {
        // Locate an active supervisor matching this PIN in this property.
        // We have to iterate since we need to verify BCrypt hashes.
        // Get all active supervisors for the property first.
        var supervisors = await _dbContext.Staff
            .Where(s => s.PropertyId == propertyId && s.IsActive && s.Role == "MANAGER")
            .ToListAsync();

        foreach (var s in supervisors)
        {
            if (!string.IsNullOrEmpty(s.PosPinHash) && BCrypt.Net.BCrypt.Verify(pin, s.PosPinHash))
            {
                return s;
            }
        }

        return null;
    }

    public async Task<LocalPosOperatorSession> SwitchOperatorAsync(string deviceId, string posSessionId, string staffId, string operationId)
    {
        // End current operator session if any
        var currentSession = await _dbContext.PosOperatorSessions
            .Where(s => s.DeviceId == deviceId && s.PosSessionId == posSessionId && s.EndedAt == null)
            .FirstOrDefaultAsync();

        if (currentSession != null)
        {
            currentSession.EndedAt = DateTime.UtcNow;
            
            _dbContext.SyncEvents.Add(new LocalSyncEvent
            {
                EntityType = "OPERATOR_SESSION",
                EntityId = currentSession.Id,
                OperationType = "SWITCH_OUT",
                PayloadJson = JsonSerializer.Serialize(new { endedAt = currentSession.EndedAt }),
                UserId = currentSession.StaffId,
                DeviceId = deviceId
            });
        }

        var newSession = new LocalPosOperatorSession
        {
            Id = Guid.NewGuid().ToString(),
            DeviceId = deviceId,
            PosSessionId = posSessionId,
            StaffId = staffId,
            StartedAt = DateTime.UtcNow,
            LastActivityAt = DateTime.UtcNow,
            OperationId = operationId
        };

        _dbContext.PosOperatorSessions.Add(newSession);
        
        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            EntityType = "OPERATOR_SESSION",
            EntityId = newSession.Id,
            OperationType = "SWITCH_IN",
            PayloadJson = JsonSerializer.Serialize(newSession),
            UserId = staffId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return newSession;
    }

    public async Task<object?> GetCurrentOperatorSessionAsync(string deviceId, string posSessionId)
    {
        var currentSession = await _dbContext.PosOperatorSessions
            .Where(s => s.DeviceId == deviceId && s.PosSessionId == posSessionId && s.EndedAt == null)
            .FirstOrDefaultAsync();

        if (currentSession == null) return null;

        var staff = await _dbContext.Staff.FirstOrDefaultAsync(s => s.Id == currentSession.StaffId);
        if (staff == null) return null;

        return new { operatorSession = currentSession, staff };
    }

    public async Task<LocalPosAuthorizationAudit> LogAuthorizationAsync(string propertyId, string? sessionId, string requestedBy, string authorizedBy, string action, string? reason, string operationId, string deviceId)
    {
        var audit = new LocalPosAuthorizationAudit
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = propertyId,
            DeviceId = deviceId,
            SessionId = sessionId,
            RequestedBy = requestedBy,
            AuthorizedBy = authorizedBy,
            Action = action,
            Reason = reason,
            OperationId = operationId,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosAuthorizationAudits.Add(audit);

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_AUTH_AUDIT",
            EntityId = audit.Id,
            OperationType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(audit),
            UserId = requestedBy,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        return audit;
    }

    public async Task<List<LocalProductCategory>> GetCategoriesAsync(string propertyId)
    {
        return await _dbContext.ProductCategories
            .Where(c => c.IsActive && _dbContext.PosOutlets.Any(o => o.Id == c.OutletId && o.PropertyId == propertyId))
            .OrderBy(c => c.SortOrder)
            .ToListAsync();
    }

    public async Task<List<LocalPosOutlet>> GetAuthorizedOutletsAsync(string propertyId, string deviceId)
    {
        return await _dbContext.PosOutlets
            .Where(o => o.PropertyId == propertyId && o.IsActive)
            .ToListAsync();
    }

    public async Task<LocalProperty?> GetPropertyAsync(string propertyId)
    {
        return await _dbContext.Properties.FirstOrDefaultAsync(p => p.Id == propertyId);
    }

    public async Task<LocalPosTerminal?> GetTerminalAsync(string deviceId)
    {
        return await _dbContext.PosTerminals.FirstOrDefaultAsync(t => t.Id == deviceId);
    }

    public async Task<LocalPosTerminal?> GetLocalTerminalAsync()
    {
        return await _dbContext.PosTerminals.FirstOrDefaultAsync();
    }

    public async Task<LocalPosOutlet?> GetOutletAsync(string outletId)
    {
        return await _dbContext.PosOutlets.FirstOrDefaultAsync(o => o.Id == outletId);
    }

    public async Task<LocalPosSession?> GetSessionContextAsync(string sessionId)
    {
        return await _dbContext.PosSessions.FirstOrDefaultAsync(s => s.Id == sessionId);
    }

    public async Task<List<LocalPosFloorPlan>> GetFloorPlansAsync(string outletId)
    {
        return await _dbContext.PosFloorPlans
            .Where(fp => fp.OutletId == outletId)
            .OrderBy(fp => fp.SortOrder)
            .ToListAsync();
    }

    public async Task<List<object>> GetTablesAsync(string floorPlanId)
    {
        var tables = await _dbContext.PosTables
            .Where(t => t.FloorPlanId == floorPlanId)
            .ToListAsync();
            
        var orderIds = tables.Where(t => !string.IsNullOrEmpty(t.CurrentOrderId)).Select(t => t.CurrentOrderId).Distinct().ToList();
        var activeOrders = new List<LocalPosOrder>();
        
        if (orderIds.Any())
        {
            activeOrders = await _dbContext.PosOrders
                .Where(o => orderIds.Contains(o.Id))
                .ToListAsync();
        }

        var result = new List<object>();
        foreach (var t in tables)
        {
            var o = activeOrders.FirstOrDefault(ord => ord.Id == t.CurrentOrderId);
            result.Add(new
            {
                id = t.Id,
                floorPlanId = t.FloorPlanId,
                name = t.Name,
                capacity = t.Capacity,
                positionX = t.PositionX,
                positionY = t.PositionY,
                currentOrderId = t.CurrentOrderId,
                isActive = t.IsActive,
                currentOrder = o == null ? null : new
                {
                    id = o.Id,
                    orderNumber = o.OrderNumber,
                    status = o.Status,
                    total = o.Total,
                    guestCount = o.GuestCount,
                    serverStaff = new { firstName = "Offline", lastName = "Operator" } // Ideally join with Staff, but this matches UI expectations
                }
            });
        }
        return result;
    }

    public async Task<List<LocalPosProductModifier>> GetProductModifiersAsync(string productId)
    {
        return await _dbContext.PosProductModifiers
            .Where(m => m.ProductId == productId && m.IsActive)
            .ToListAsync();
    }

    /// <summary>
    /// Returns KOT records for a given outlet and station that are still PENDING or ACKNOWLEDGED.
    /// This matches the cloud PosProductionBatch shape consumed by the KDS screen.
    /// </summary>
    public async Task<List<object>> GetProductionBatchesAsync(string outletId, string station)
    {
        var kots = await _dbContext.PosKots
            .Where(k => k.OutletId == outletId && (k.Status == "PENDING" || k.Status == "ACKNOWLEDGED"))
            .OrderBy(k => k.FiredAt)
            .ToListAsync();

        // Parse ItemIdsJson for each KOT and build the response
        return kots.Select(k =>
        {
            List<string> itemIds;
            try { itemIds = System.Text.Json.JsonSerializer.Deserialize<List<string>>(k.ItemIdsJson) ?? new(); }
            catch { itemIds = new(); }

            return (object)new
            {
                id = k.Id,
                batchNumber = k.KotNumber,
                station = station,
                status = k.Status,
                firedAt = k.FiredAt,
                order = new
                {
                    id = k.OrderId,
                    orderNumber = k.OrderNumber,
                    tableNumber = k.TableNumber,
                    tableName = k.TableNumber,
                    guestCount = 0,
                },
                items = itemIds.Select(id => new { id, productName = (string?)null, quantity = 1 }).ToList()
            };
        }).ToList();
    }

    /// <summary>
    /// Updates KOT/batch status: PENDING → ACKNOWLEDGED → COMPLETED.
    /// </summary>
    public async Task UpdateBatchStatusAsync(string batchId, string status)
    {
        var kot = await _dbContext.PosKots.FirstOrDefaultAsync(k => k.Id == batchId);
        if (kot == null) throw new KeyNotFoundException($"KOT {batchId} not found.");
        kot.Status = status;
        await _dbContext.SaveChangesAsync();
    }

    public async Task<List<object>> GetServerOrdersAsync(string staffId, string propertyId, string range, string statusFilter, string? sessionId = null)
    {
        var query = _dbContext.PosOrders
            .Include(o => o.Items)
            .Where(o => o.PropertyId == propertyId && o.ServerStaffId == staffId);

        if (!string.IsNullOrEmpty(sessionId))
        {
            query = query.Where(o => o.SessionId == sessionId);
        }

        if (statusFilter != "all" && !string.IsNullOrEmpty(statusFilter))
        {
            query = query.Where(o => o.Status == statusFilter);
        }

        var now = DateTime.UtcNow;
        if (range == "today")
        {
            var start = now.Date;
            query = query.Where(o => o.BusinessDate >= start);
        }
        else if (range == "yesterday")
        {
            var start = now.Date.AddDays(-1);
            var end = now.Date;
            query = query.Where(o => o.BusinessDate >= start && o.BusinessDate < end);
        }
        else if (range == "this_week")
        {
            var diff = (7 + (now.DayOfWeek - DayOfWeek.Monday)) % 7;
            var start = now.AddDays(-1 * diff).Date;
            query = query.Where(o => o.BusinessDate >= start);
        }

        var orders = await query.OrderByDescending(o => o.BusinessDate).ToListAsync();
        
        var sessions = await _dbContext.PosSessions
            .Where(s => orders.Select(o => o.SessionId).Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.OpenedBy);
            
        var staffIds = orders.Select(o => o.ServerStaffId).Distinct().ToList();
        var staffDict = await _dbContext.Staff.Where(s => staffIds.Contains(s.Id)).ToDictionaryAsync(s => s.Id, s => s.FirstName + " " + s.LastName);

        var result = new List<object>();
        var random = new Random();
        foreach(var o in orders)
        {
            var sessionOwnerId = !string.IsNullOrEmpty(o.SessionId) && sessions.ContainsKey(o.SessionId) ? sessions[o.SessionId] : null;
            var sessionOwnerName = !string.IsNullOrEmpty(sessionOwnerId) && staffDict.ContainsKey(sessionOwnerId) ? staffDict[sessionOwnerId] : "Unknown";

            result.Add(new {
                id = o.Id,
                propertyId = o.PropertyId,
                outletId = o.OutletId,
                sessionId = o.SessionId,
                orderNumber = o.OrderNumber,
                orderType = o.OrderType,
                tableNumber = o.TableNumber,
                serverStaffId = o.ServerStaffId,
                status = o.Status,
                paymentStatus = o.PaymentStatus,
                displayName = o.DisplayName,
                total = o.Total,
                createdAt = o.CreatedAt,
                businessDate = o.BusinessDate,
                items = o.Items,
                sessionOwnerName = sessionOwnerName,
                verificationToken = $"{o.OrderNumber}-OFFLINE"
            });
        }
        
        return result;
    }

    public async Task<object> GetServerSalesAsync(string staffId, string propertyId, string range, string? sessionId = null)
    {
        var query = _dbContext.PosOrders
            .Where(o => o.PropertyId == propertyId && o.ServerStaffId == staffId);

        if (!string.IsNullOrEmpty(sessionId))
        {
            query = query.Where(o => o.SessionId == sessionId);
        }
        
        var now = DateTime.UtcNow;
        if (range == "today")
        {
            var start = now.Date;
            query = query.Where(o => o.BusinessDate >= start);
        }
        // ... (similar range logic)

        var orders = await query.ToListAsync();

        var payments = await _dbContext.PosPayments
            .Where(p => orders.Select(o => o.Id).Contains(p.OrderId) && p.Status == "CONFIRMED")
            .ToListAsync();

        var grossSales = orders.Where(o => o.Status != "VOIDED").Sum(o => o.Total);
        
        return new
        {
            grossSales = grossSales,
            netSales = grossSales, // Simplified for now
            ordersCount = orders.Count,
            cashSales = payments.Where(p => p.Method == "CASH").Sum(p => p.Amount),
            cardSales = payments.Where(p => p.Method == "CARD").Sum(p => p.Amount),
            roomChargeSales = payments.Where(p => p.Method == "ROOM_CHARGE").Sum(p => p.Amount),
            cityLedger = payments.Where(p => p.Method == "CITY_LEDGER").Sum(p => p.Amount)
        };
    }
    public async Task LogHardwareEventAsync(string userId, string deviceId, string eventType, string? payload)
    {
        _dbContext.HardwareAuditLogs.Add(new LodgeCore.Desktop.Data.Entities.LocalHardwareAuditLog
        {
            UserId    = userId,
            DeviceId  = deviceId,
            EventType = eventType,
            Payload   = payload,
            CreatedAt = DateTime.UtcNow
        });
        await _dbContext.SaveChangesAsync();
    }
    
    public async Task RecordKeycardAuditAsync(LodgeCore.Desktop.Data.Entities.LocalKeycardAudit audit)
    {
        _dbContext.KeycardAudits.Add(audit);
        
        var outboxEvent = new LocalOutboxEvent
        {
            PropertyId = audit.PropertyId,
            DeviceId = audit.DeviceId,
            OperatorId = audit.StaffId,
            AggregateType = "KEYCARD_AUDIT",
            AggregateId = audit.Id,
            AggregateVersion = 1,
            EventType = "CREATE",
            PayloadJson = JsonSerializer.Serialize(new
            {
                StaffId = audit.StaffId,
                DeviceId = audit.DeviceId,
                PropertyId = audit.PropertyId,
                OperationType = audit.OperationType,
                RoomId = audit.RoomId,
                ReservationId = audit.ReservationId,
                BusinessDate = audit.BusinessDate,
                Timestamp = audit.Timestamp,
                Success = audit.Success,
                StatusReason = audit.StatusReason,
                CardSnr = audit.CardSnr,
                OperationId = audit.OperationId
            })
        };
        
        _dbContext.OutboxEvents.Add(outboxEvent);
        await _dbContext.SaveChangesAsync();
    }

    public async Task<int> RetryDeadLetterEventsAsync()
    {
        var deadLetters = await _dbContext.OutboxEvents
            .Where(e => e.Status == "DEAD_LETTER")
            .ToListAsync();
            
        foreach (var evt in deadLetters)
        {
            evt.Status = "PENDING";
            evt.AttemptCount = 0;
            evt.NextAttemptAt = null;
            evt.LastError = null;
        }
        
        await _dbContext.SaveChangesAsync();
        return deadLetters.Count;
    }

    public void AppendSyncEvent(string entityType, string entityId, string operationType, object payload, string? terminalId, string? outletId, string? sessionId, string? operatorId)
    {
        var payloadJson = System.Text.Json.JsonSerializer.Serialize(payload);
        var hashBytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(payloadJson));
        var payloadHash = BitConverter.ToString(hashBytes).Replace("-", "").ToLowerInvariant();

        long maxDbSeq = _dbContext.SyncEvents.Where(e => e.TerminalId == terminalId).Max(e => (long?)e.SequenceNumber) ?? 0;
        long maxLocalSeq = _dbContext.SyncEvents.Local.Where(e => e.TerminalId == terminalId).Max(e => (long?)e.SequenceNumber) ?? 0;
        long seq = Math.Max(maxDbSeq, maxLocalSeq) + 1;

        var syncEvent = new LodgeCore.Desktop.Data.Entities.LocalSyncEvent
        {
            OperationId = $"op_{terminalId}_{DateTime.UtcNow.Ticks}_{Guid.NewGuid().ToString("N").Substring(0, 8)}",
            SequenceNumber = seq,
            TerminalId = terminalId ?? string.Empty,
            OutletId = outletId ?? string.Empty,
            SessionId = sessionId ?? string.Empty,
            OperatorId = operatorId ?? string.Empty,
            EntityType = entityType,
            EntityId = entityId ?? string.Empty,
            OperationType = operationType,
            PayloadJson = payloadJson,
            PayloadHash = payloadHash,
            Status = "PENDING",
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.SyncEvents.Add(syncEvent);
    }

    public async Task<LodgeCore.Desktop.Data.Entities.LocalPosSession?> GetActiveServerBankAsync(string staffId, string propertyId, string outletId)
    {
        return await _dbContext.PosSessions
            .FirstOrDefaultAsync(s => s.PrimaryOperatorId == staffId && s.OutletId == outletId && s.Status == "OPEN" && s.BankType == "SERVER");
    }

    public async Task<LodgeCore.Desktop.Data.Entities.LocalPosSession?> GetActiveSessionForDeviceAsync(string deviceId)
    {
        return await _dbContext.PosSessions
            .FirstOrDefaultAsync(s => s.DeviceId == deviceId && s.Status == "OPEN");
    }

    public async Task<string> EnsureActiveServerBankAsync(string staffId, string propertyId, string outletId, string deviceId, string bankingModel = "SERVER_BANKING", string bankType = "SERVER")
    {
        var activeSession = await GetActiveServerBankAsync(staffId, propertyId, outletId);
        if (activeSession != null)
        {
            return activeSession.Id;
        }

        var newSession = new LodgeCore.Desktop.Data.Entities.LocalPosSession
        {
            Id = Guid.NewGuid().ToString(),
            PropertyId = propertyId,
            OutletId = outletId,
            DeviceId = deviceId,
            UserId = staffId,
            Status = "OPEN",
            BankingModel = bankingModel,
            BankType = bankType,
            PrimaryOperatorId = staffId,
            OpenedAt = DateTime.UtcNow,
            OpeningCash = 0,
            ExpectedCash = 0,
            StaffId = staffId
        };

        _dbContext.PosSessions.Add(newSession);

        AppendSyncEvent(
            entityType: "POS_SESSION",
            entityId: newSession.Id,
            operationType: "CREATE",
            payload: newSession,
            terminalId: deviceId,
            outletId: outletId,
            sessionId: newSession.Id,
            operatorId: staffId
        );

        await _dbContext.SaveChangesAsync();
        return newSession.Id;
    }

    public async Task<string> EnsureEmergencyBankAsync(string managerId, string managerName, string primaryOperatorId, string deviceId, string outletId, string propertyId, string reason)
    {
        // 1. Concurrency Check: Verify no existing OPEN emergency bank for this terminal
        var existingSession = await _dbContext.PosSessions
            .FirstOrDefaultAsync(s => s.DeviceId == deviceId && s.Status == "OPEN" && s.BankingModel == "EMERGENCY_MANAGER");

        if (existingSession != null)
        {
            return existingSession.Id;
        }

        // 2. Create Emergency Session
        var sessionId = Guid.NewGuid().ToString();
        var newSession = new LodgeCore.Desktop.Data.Entities.LocalPosSession
        {
            Id = sessionId,
            PropertyId = propertyId,
            OutletId = outletId,
            DeviceId = deviceId,
            UserId = primaryOperatorId, // Maintains waiter's identity as operator
            Status = "OPEN",
            BankingModel = "EMERGENCY_MANAGER",
            BankType = "EMERGENCY",
            PrimaryOperatorId = primaryOperatorId, // Acting For
            AuthorizedBy = managerId, // Manager Identity
            Reason = reason,
            OpenedAt = DateTime.UtcNow,
            OpeningCash = 0,
            ExpectedCash = 0,
            StaffId = primaryOperatorId
        };

        _dbContext.PosSessions.Add(newSession);

        // 3. Create explicit LocalCashAccount for this Emergency Session
        var cashAccountId = Guid.NewGuid().ToString();
        var newAccount = new LodgeCore.Desktop.Data.Entities.LocalCashAccount
        {
            Id = cashAccountId,
            PropertyId = propertyId,
            OutletId = outletId,
            Type = PosConstants.CashAccountTypes.EmergencyBank,
            Name = $"Emergency Bank - {managerName} - {DateTime.UtcNow:HH:mm}",
            Balance = 0,
            OwnerId = managerId,
            IsActive = true
        };
        _dbContext.CashAccounts.Add(newAccount);

        AppendSyncEvent(
            entityType: "CASH_ACCOUNT",
            entityId: cashAccountId,
            operationType: "CREATE",
            payload: newAccount,
            terminalId: deviceId,
            sessionId: sessionId,
            outletId: outletId,
            operatorId: managerId
        );

        AppendSyncEvent(
            entityType: "POS_SESSION",
            entityId: sessionId,
            operationType: "CREATE",
            payload: newSession,
            terminalId: deviceId,
            outletId: outletId,
            sessionId: sessionId,
            operatorId: managerId
        );

        await _dbContext.SaveChangesAsync();
        return sessionId;
    }

    #region Laundry Module

    public async Task<List<LocalLaundryItem>> GetLaundryItemsAsync(string propertyId)
    {
        return await _dbContext.LaundryItems
            .Where(i => i.PropertyId == propertyId && i.IsActive)
            .ToListAsync();
    }

    public async Task<List<LocalLaundryOrder>> GetLaundryOrdersAsync(string propertyId, string? status = null)
    {
        var query = _dbContext.LaundryOrders
            .Include(o => o.Items)
            .Where(o => o.PropertyId == propertyId);

        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(o => o.Status == status);
        }

        return await query.OrderByDescending(o => o.CreatedAt).ToListAsync();
    }

    public async Task<string> CreateLaundryOrderAsync(string dataJson, string userId, string deviceId)
    {
        using var json = JsonDocument.Parse(dataJson);
        var root = json.RootElement;
        
        var orderId = Guid.NewGuid().ToString();
        var propertyId = root.GetProperty("propertyId").GetString() ?? "";
        var customerType = root.TryGetProperty("customerType", out var ctElem) && ctElem.ValueKind != JsonValueKind.Null ? ctElem.GetString() ?? "IN_HOUSE" : "IN_HOUSE";
        var reservationId = root.TryGetProperty("reservationId", out var rElem) && rElem.ValueKind != JsonValueKind.Null ? rElem.GetString() : null;
        var guestId = root.GetProperty("guestId").GetString() ?? "";
        var roomId = root.TryGetProperty("roomId", out var roomElem) && roomElem.ValueKind != JsonValueKind.Null ? roomElem.GetString() : null;
        var serviceType = root.TryGetProperty("serviceType", out var svcElem) ? svcElem.GetString() ?? "STANDARD" : "STANDARD";
        
        if (customerType == "IN_HOUSE" && string.IsNullOrEmpty(reservationId))
        {
            throw new Exception("IN_HOUSE laundry orders require a valid reservationId.");
        }
        
        decimal total = 0;
        var orderItems = new List<LocalLaundryOrderItem>();
        
        if (root.TryGetProperty("items", out var itemsElem) && itemsElem.ValueKind == JsonValueKind.Array)
        {
            var itemsList = await _dbContext.LaundryItems.Where(i => i.PropertyId == propertyId).ToListAsync();
            foreach (var item in itemsElem.EnumerateArray())
            {
                var itemId = item.GetProperty("itemId").GetString() ?? "";
                var qty = item.GetProperty("quantity").GetInt32();
                if (qty > 0)
                {
                    var catalogItem = itemsList.FirstOrDefault(i => i.Id == itemId);
                    if (catalogItem != null)
                    {
                        var price = catalogItem.BasePrice;
                        if (serviceType == "EXPRESS") price *= 1.5m;
                        else if (serviceType == "DRY_CLEAN") price *= 2.0m;
                        
                        var lineTotal = price * qty;
                        total += lineTotal;
                        
                        orderItems.Add(new LocalLaundryOrderItem
                        {
                            Id = Guid.NewGuid().ToString(),
                            LaundryOrderId = orderId,
                            ItemId = itemId,
                            Quantity = qty,
                            UnitPrice = price,
                            TotalPrice = lineTotal
                        });
                    }
                }
            }
        }
        
        var order = new LocalLaundryOrder
        {
            Id = orderId,
            PropertyId = propertyId,
            CustomerType = customerType,
            ReservationId = reservationId,
            GuestId = guestId,
            RoomId = roomId,
            ServiceType = serviceType,
            Status = "PENDING",
            TotalAmount = total,
            RequestedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            Version = 1,
            Items = orderItems
        };
        
        _dbContext.LaundryOrders.Add(order);
        
        var guest = await _dbContext.Guests.FindAsync(guestId);
        
        var payloadObj = new {
            propertyId = order.PropertyId,
            customerType = order.CustomerType,
            reservationId = order.ReservationId,
            guestId = order.GuestId,
            guest = guest,
            roomId = order.RoomId,
            serviceType = order.ServiceType,
            status = order.Status,
            totalAmount = order.TotalAmount,
            requestedAt = order.RequestedAt,
            items = orderItems.Select(i => new { itemId = i.ItemId, quantity = i.Quantity, unitPrice = i.UnitPrice, totalPrice = i.TotalPrice }).ToList()
        };
        
        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = order.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "LAUNDRY_ORDER",
            AggregateId = order.Id,
            AggregateVersion = 1,
            EventType = "LAUNDRY_ORDER_CREATED",
            Sequence = 1,
            IdempotencyKey = Guid.NewGuid().ToString(),
            PayloadJson = JsonSerializer.Serialize(payloadObj)
        });

        await _dbContext.SaveChangesAsync();
        return order.Id;
    }

    public async Task UpdateLaundryOrderStatusAsync(string orderId, string status, string userId, string deviceId)
    {
        var order = await _dbContext.LaundryOrders.FindAsync(orderId);
        if (order == null) throw new Exception("Laundry order not found");
        
        var previousStatus = order.Status;
        if (previousStatus == status) return;
        
        order.Status = status;
        order.UpdatedAt = DateTime.UtcNow;
        if (status == "COLLECTED") order.CollectedAt = DateTime.UtcNow;
        if (status == "READY") order.ReadyAt = DateTime.UtcNow;
        
        int eventVersion = order.Version;
        order.Version++;
        
        _dbContext.LaundryOrderStatusHistory.Add(new LocalLaundryOrderStatusHistory
        {
            Id = Guid.NewGuid().ToString(),
            LaundryOrderId = order.Id,
            PreviousStatus = previousStatus,
            NewStatus = status,
            ChangedBy = userId,
            ChangedAt = DateTime.UtcNow,
            DeviceId = deviceId
        });
        
        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = order.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "LAUNDRY_ORDER",
            AggregateId = order.Id,
            AggregateVersion = eventVersion,
            EventType = "LAUNDRY_STATUS_UPDATED",
            Sequence = order.Version,
            IdempotencyKey = Guid.NewGuid().ToString(),
            PayloadJson = JsonSerializer.Serialize(new { status = status })
        });
        
        await _dbContext.SaveChangesAsync();
    }

    public async Task DeliverLaundryOrderAsync(string orderId, string userId, string deviceId)
    {
        var order = await _dbContext.LaundryOrders.FindAsync(orderId);
        if (order == null) throw new Exception("Laundry order not found");
        
        if (order.Status == "DELIVERED") return;
        
        var previousStatus = order.Status;
        order.Status = "DELIVERED";
        order.DeliveredAt = DateTime.UtcNow;
        order.DeliveredBy = userId;
        order.UpdatedAt = DateTime.UtcNow;
        int eventVersion = order.Version;
        order.Version++;
        
        _dbContext.LaundryOrderStatusHistory.Add(new LocalLaundryOrderStatusHistory
        {
            Id = Guid.NewGuid().ToString(),
            LaundryOrderId = order.Id,
            PreviousStatus = previousStatus,
            NewStatus = "DELIVERED",
            ChangedBy = userId,
            ChangedAt = DateTime.UtcNow,
            DeviceId = deviceId
        });
        
        var idempotencyKey = $"{order.Id}_DELIVERY_FOLIO_CHARGE";
        
        // Find reservation folio
        var folio = await _dbContext.Folios.FirstOrDefaultAsync(f => f.ReservationId == order.ReservationId);
        if (folio != null && order.TotalAmount > 0)
        {
            if (!CheckFolioIdempotency(folio, idempotencyKey))
            {
                folio.TotalCharges += order.TotalAmount;
                folio.UpdatedAt = DateTime.UtcNow;
                folio.IsDirty = true;
                folio.LocalSequence++;
                int folioEventVersion = folio.Version;
                folio.Version++;

                var newItem = new
                {
                    id = Guid.NewGuid().ToString(),
                    amount = order.TotalAmount,
                    description = $"Laundry Service - {order.ServiceType}",
                    type = "CHARGE",
                    idempotencyKey = idempotencyKey,
                    createdAt = DateTime.UtcNow
                };

                UpdateFolioTransactionsJson(folio, "items", newItem);

                _dbContext.OutboxEvents.Add(new LocalOutboxEvent
                {
                    PropertyId = folio.PropertyId,
                    DeviceId = deviceId,
                    OperatorId = userId,
                    AggregateType = "FOLIO",
                    AggregateId = folio.Id,
                    AggregateVersion = folioEventVersion,
                    EventType = "ROOM_CHARGE",
                    Sequence = folio.LocalSequence,
                    IdempotencyKey = idempotencyKey,
                    PayloadJson = JsonSerializer.Serialize(new { 
                        amount = order.TotalAmount, 
                        description = $"Laundry Service - {order.ServiceType}", 
                        currency = "NGN", 
                        businessDate = DateTime.UtcNow, 
                        originalBusinessDate = DateTime.UtcNow, 
                        idempotencyKey = idempotencyKey 
                    })
                });
            }
        }
        
        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = order.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "LAUNDRY_ORDER",
            AggregateId = order.Id,
            AggregateVersion = eventVersion,
            EventType = "LAUNDRY_STATUS_UPDATED",
            Sequence = order.Version,
            IdempotencyKey = Guid.NewGuid().ToString(),
            PayloadJson = JsonSerializer.Serialize(new { status = "DELIVERED" })
        });
        
        await _dbContext.SaveChangesAsync();
    }

    #endregion
}

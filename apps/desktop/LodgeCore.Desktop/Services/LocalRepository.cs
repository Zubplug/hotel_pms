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

    private async Task AssertNightAuditAllowsAsync(string propertyId, DateTime? businessDate = null)
    {
        var property = await _dbContext.Properties.FindAsync(propertyId);
        if (property == null) throw new InvalidOperationException("Property is not available offline.");
        var status = (property.AuditStatus ?? "OPEN").Trim().ToUpperInvariant();
        var targetDate = (businessDate ?? property.BusinessDate).Date;
        var currentDate = property.BusinessDate.Date;
        if ((status == "IN_PROGRESS" && targetDate == currentDate) || (status == "POSTING" && targetDate < currentDate))
            throw new InvalidOperationException("NIGHT_AUDIT_IN_PROGRESS: This business date is temporarily locked while Night Audit is posting.");
    }

    public async Task<LocalReservation> CreateReservationAsync(LocalReservation reservation, string userId, string deviceId)
    {
        await AssertNightAuditAllowsAsync(reservation.PropertyId);
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
        
        if (reservation.CheckOutDate <= reservation.CheckInDate)
            throw new InvalidOperationException("Check-out must be after check-in.");

        if (!string.IsNullOrEmpty(reservation.RoomId))
        {
            var roomAlreadyReserved = await _dbContext.Reservations
                .Where(r => r.PropertyId == reservation.PropertyId && r.Id != reservation.Id && r.Status != "CANCELLED" && r.Status != "NO_SHOW")
                .AnyAsync(r => r.Rooms.Any(rr => rr.RoomId == reservation.RoomId &&
                    rr.CheckInDate < reservation.CheckOutDate &&
                    rr.CheckOutDate > reservation.CheckInDate));
            if (roomAlreadyReserved)
                throw new InvalidOperationException("The selected room is already reserved for the requested dates.");
        }

        int nights = (int)Math.Ceiling((reservation.CheckOutDate - reservation.CheckInDate).TotalDays);
        decimal totalAmount = baseRate * nights;

        reservation.Currency = currency;
        
        if (reservation.Guest != null && _dbContext.Entry(reservation.Guest).State == EntityState.Detached)
        {
            _dbContext.Guests.Add(reservation.Guest);
        }

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
            TotalCharges = 0,
            TotalPayments = 0,
            Currency = currency,
            IsDirty = true, // Force sync down to grab real ID later, or cloud matches by reservation? Actually, cloud API creates the folio, so this local one will get overwritten/merged on next pull. We just need it for UI.
        };

        // Initialize empty Transactions JSON since we no longer post upfront room charges
        folio.TransactionsJson = JsonSerializer.Serialize(new { items = new List<object>(), payments = new List<object>() });
        
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
                FolioId = folio.Id,
                GuestId = reservation.GuestId,
                Guest = reservation.Guest == null ? null : new
                {
                    reservation.Guest.Id,
                    reservation.Guest.OrganizationId,
                    reservation.Guest.FirstName,
                    reservation.Guest.LastName,
                    reservation.Guest.Email,
                    reservation.Guest.Phone
                },
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
        
        if (!string.IsNullOrEmpty(reservation.RoomId) && reservation.Status == "CONFIRMED")
        {
            var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == reservation.RoomId);
            if (room != null && room.Status is "AVAILABLE" or "CLEAN" or "INSPECTED")
            {
                room.Status = "RESERVED";
                room.UpdatedAt = DateTime.UtcNow;
            }
        }
        else if (!string.IsNullOrEmpty(reservation.RoomId) && reservation.Status == "CHECKED_IN")
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

    public async Task<List<LocalSyncEvent>> GetSyncEventsAsync()
    {
        return await _dbContext.SyncEvents
            .OrderByDescending(e => e.CreatedAt)
            .Take(500)
            .ToListAsync();
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
        await AssertNightAuditAllowsAsync(res.PropertyId);

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
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) return false;
        await AssertNightAuditAllowsAsync(res.PropertyId);

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

        foreach (var reservationRoom in await _dbContext.ReservationRooms
            .Where(rr => rr.ReservationId == reservationId && rr.Status == "ACTIVE")
            .ToListAsync())
        {
            reservationRoom.Status = "CANCELLED";
            var room = await _dbContext.Rooms.FindAsync(reservationRoom.RoomId);
            if (room != null && !await _dbContext.ReservationRooms.AnyAsync(rr =>
                rr.RoomId == room.Id && rr.ReservationId != reservationId && rr.Status == "ACTIVE" &&
                rr.CheckInDate < res.CheckOutDate && rr.CheckOutDate > res.CheckInDate))
            {
                room.Status = "AVAILABLE";
                room.UpdatedAt = DateTime.UtcNow;
            }
        }

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

    public async Task<object?> MarkLateArrivalAsync(string reservationId, string notes, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) throw new InvalidOperationException("Reservation not found");
        await AssertNightAuditAllowsAsync(res.PropertyId);
        var reservation = await _dbContext.Reservations.Include(r => r.Folio).FirstOrDefaultAsync(r => r.Id == reservationId);
        
        if (reservation.Status != "CONFIRMED") throw new InvalidOperationException("Late arrival can only be recorded for confirmed reservations.");
        reservation.LateArrivalExpected = true; reservation.LateArrivalNotes = notes; reservation.LateArrivalAt = DateTime.UtcNow; reservation.LateArrivalBy = userId; reservation.IsDirty = true; reservation.LocalSequence++;
        _dbContext.OutboxEvents.Add(new LocalOutboxEvent { PropertyId = reservation.PropertyId, DeviceId = deviceId, OperatorId = userId, AggregateType = "RESERVATION", AggregateId = reservation.Id, EventType = "LATE_ARRIVAL", Sequence = reservation.LocalSequence, PayloadJson = JsonSerializer.Serialize(new { reservationId = reservation.Id, notes, lateArrivalExpected = true }) });
        await _dbContext.SaveChangesAsync();
        return reservation;
    }

    public async Task<object?> AssessNoShowAsync(string reservationId, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) throw new InvalidOperationException("Reservation not found");
        await AssertNightAuditAllowsAsync(res.PropertyId);
        var reservation = await _dbContext.Reservations.Include(r => r.Folio).FirstOrDefaultAsync(r => r.Id == reservationId);
        
        if (reservation.Status != "CONFIRMED") throw new InvalidOperationException($"Cannot assess a {reservation.Status} reservation as no-show.");
        if (reservation.LateArrivalExpected) throw new InvalidOperationException("Late arrival is authorized for this reservation.");
        var property = await _dbContext.Properties.FindAsync(reservation.PropertyId);
        var cutoff = reservation.CheckInDate.Date.AddDays(1);
        if (TimeSpan.TryParse(property?.NoShowCutoffTime ?? "02:00", out var cutoffTime)) cutoff = cutoff.Add(cutoffTime);
        cutoff = cutoff.AddMinutes(property?.NoShowGracePeriodMinutes ?? 0);
        if (DateTime.UtcNow < cutoff) throw new InvalidOperationException($"No-show assessment is available after {cutoff:u}.");

        var totalNights = Math.Max(1, (reservation.CheckOutDate - reservation.CheckInDate).Days);
        var bookedValue = Math.Max(0, reservation.Folio?.TotalCharges ?? 0);
        var totalPaid = Math.Max(0, reservation.Folio?.TotalPayments ?? 0);
        var firstNight = bookedValue / totalNights;
        var chargeType = (property?.NoShowChargeType ?? "FIRST_NIGHT").ToUpperInvariant();
        var chargeValue = Math.Max(0, property?.NoShowChargeValue ?? 0);
        var noShowCharge = chargeType switch
        {
            "FULL_STAY" => bookedValue,
            "PERCENTAGE" => bookedValue * chargeValue / 100m,
            "FIRST_NIGHT" => firstNight,
            "FLAT" => chargeValue,
            _ => 0m
        };
        var refundableAmount = property?.NoShowRefundableUnusedNights == true
            ? Math.Max(0, Math.Min(totalPaid, bookedValue > 0 ? bookedValue : totalPaid) - noShowCharge)
            : 0m;

        reservation.Status = "NO_SHOW"; reservation.NoShowAt = DateTime.UtcNow; reservation.NoShowBy = userId; reservation.NoShowAssessedAt = DateTime.UtcNow; reservation.NoShowChargeAmount = noShowCharge; reservation.NoShowRefundableAmount = refundableAmount; reservation.IsDirty = true; reservation.LocalSequence++;
        _dbContext.OutboxEvents.Add(new LocalOutboxEvent { PropertyId = reservation.PropertyId, DeviceId = deviceId, OperatorId = userId, AggregateType = "RESERVATION", AggregateId = reservation.Id, EventType = "NO_SHOW", Sequence = reservation.LocalSequence, PayloadJson = JsonSerializer.Serialize(new { reservationId = reservation.Id }) });
        await _dbContext.SaveChangesAsync();
        return new { reservation = reservation, assessment = new { totalNights, bookedValue, noShowCharge, refundableAmount }, refundRequired = refundableAmount > 0 };
    }

    public async Task<object?> ReinstateReservationAsync(string reservationId, string reason, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) throw new InvalidOperationException("Reservation not found");
        await AssertNightAuditAllowsAsync(res.PropertyId);
        
        if (res.Status != "NO_SHOW") throw new InvalidOperationException("Only no-show reservations can be reinstated.");
        var property = await _dbContext.Properties.FindAsync(res.PropertyId);
        if (property?.NoShowAllowReinstatement == false) throw new InvalidOperationException("Reinstatement is disabled by property policy.");
        res.Status = "CONFIRMED"; res.ReinstatedAt = DateTime.UtcNow; res.ReinstatedBy = userId; res.ReinstatementReason = reason; res.IsDirty = true; res.LocalSequence++;
        foreach (var reservationRoom in await _dbContext.ReservationRooms.Where(rr => rr.ReservationId == reservationId && rr.Status == "NO_SHOW").ToListAsync())
        {
            reservationRoom.Status = "ACTIVE";
            if (!string.IsNullOrEmpty(reservationRoom.RoomId))
            {
                var room = await _dbContext.Rooms.FindAsync(reservationRoom.RoomId);
                if (room != null) room.Status = "RESERVED";
            }
        }
        _dbContext.OutboxEvents.Add(new LocalOutboxEvent { PropertyId = res.PropertyId, DeviceId = deviceId, OperatorId = userId, AggregateType = "RESERVATION", AggregateId = res.Id, EventType = "REINSTATE", Sequence = res.LocalSequence, PayloadJson = JsonSerializer.Serialize(new { reservationId = res.Id, reason }) });
        await _dbContext.SaveChangesAsync();
        return res;
    }

    public async Task<bool> ReassignRoomAsync(string reservationId, string roomId, string? roomTypeId, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) return false;
        await AssertNightAuditAllowsAsync(res.PropertyId);
        
        res = await _dbContext.Reservations
            .Include(r => r.Folio)
            .Include(r => r.Rooms)
            .FirstOrDefaultAsync(r => r.Id == reservationId);
        if (res == null) return false;

        var room = await _dbContext.Rooms.FindAsync(roomId);
        if (room == null) throw new InvalidOperationException("Target room not found locally.");

        var oldRoomId = res.RoomId;
        var oldRoomTypeId = res.RoomTypeId;
        var oldRoomType = string.IsNullOrWhiteSpace(oldRoomTypeId) ? null : await _dbContext.RoomTypes.FindAsync(oldRoomTypeId);
        var effectiveRoomTypeId = roomTypeId ?? room.RoomTypeId;
        var newRoomType = string.IsNullOrWhiteSpace(effectiveRoomTypeId) ? null : await _dbContext.RoomTypes.FindAsync(effectiveRoomTypeId);
        var pricingStart = res.Status == "CHECKED_IN"
            ? res.CheckInDate.Date > DateTime.UtcNow.Date ? res.CheckInDate.Date : DateTime.UtcNow.Date.AddDays(1)
            : res.CheckInDate.Date;
        var nights = Math.Max(0, (int)(res.CheckOutDate.Date - pricingStart).TotalDays);
        var rateDifference = oldRoomType != null && newRoomType != null
            ? (newRoomType.BasePrice - oldRoomType.BasePrice) * nights
            : 0;

        res.RoomId = roomId;
        res.RoomNumber = room.Number;
        res.RoomTypeId = effectiveRoomTypeId;

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
                newRoomId = roomId,
                oldRoomId,
                roomTypeId = effectiveRoomTypeId
            })
        });

        await _dbContext.SaveChangesAsync();

        if (rateDifference > 0 && res.Folio != null)
        {
            await RecordChargeAsync(
                res.Folio.Id,
                rateDifference,
                $"Room upgrade - {nights} night{(nights == 1 ? "" : "s")}",
                userId,
                deviceId,
                $"ROOM_UPGRADE:{reservationId}:{roomId}:{res.CheckOutDate:yyyy-MM-dd}");
        }
        else if (rateDifference < 0 && res.Folio != null)
        {
            await RecordCreditAsync(
                res.Folio.Id,
                Math.Abs(rateDifference),
                $"Room downgrade credit - {nights} night{(nights == 1 ? "" : "s")}",
                userId,
                deviceId,
                $"ROOM_DOWNGRADE:{reservationId}:{roomId}:{res.CheckOutDate:yyyy-MM-dd}");
        }
        return true;
    }

    public async Task<bool> IsRoomAvailableAsync(string roomNumber, DateTime checkIn, DateTime checkOut)
    {
        var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Number == roomNumber || r.Code == roomNumber);
        if (room == null) return false;

        var overlapping = await _dbContext.Reservations
            .Where(r => r.Rooms.Any(reservationRoom => reservationRoom.RoomId == room.Id) && r.Status != "CANCELLED")
            .Where(r => r.CheckInDate < checkOut && r.CheckOutDate > checkIn)
            .AnyAsync();

        return !overlapping;
    }

    public async Task<bool> ExtendStayAsync(string reservationId, DateTime newCheckOut, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) return false;
        await AssertNightAuditAllowsAsync(res.PropertyId);
        
        res = await _dbContext.Reservations
            .Include(r => r.Rooms).ThenInclude(rr => rr.Room)
            .Include(r => r.Folio)
            .FirstOrDefaultAsync(r => r.Id == reservationId);
        if (res == null) return false;

        if (res.Status != "CHECKED_IN" && res.Status != "PENDING" && res.Status != "CONFIRMED")
            throw new InvalidOperationException($"Cannot extend a reservation with status '{res.Status}'.");

        if (newCheckOut <= res.CheckInDate)
            throw new InvalidOperationException("New checkout date must be after the check-in date.");

        if (newCheckOut <= res.CheckOutDate)
            throw new InvalidOperationException("New checkout date must be after the current checkout date.");

        // Resolve room type ID from reservation, ReservationRoom, or the Room entity itself
        var firstResRoom = res.Rooms.FirstOrDefault();
        var roomTypeId = res.RoomTypeId
            ?? firstResRoom?.RoomTypeId
            ?? firstResRoom?.Room?.RoomTypeId;
        if (string.IsNullOrWhiteSpace(roomTypeId) && !string.IsNullOrWhiteSpace(firstResRoom?.RoomId))
        {
            roomTypeId = (await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == firstResRoom.RoomId))?.RoomTypeId;
        }
        var roomType = !string.IsNullOrEmpty(roomTypeId)
            ? await _dbContext.RoomTypes.FirstOrDefaultAsync(rt => rt.Id == roomTypeId)
            : null;
        // If room type is unavailable locally, proceed without charging — server will reconcile on sync

        var additionalNights = (int)(newCheckOut.Date - res.CheckOutDate.Date).TotalDays;
        var additionalCharge = (roomType?.BasePrice ?? 0m) * additionalNights;

        // Overlap check: is the room taken by another reservation during the extension window?
        var assignedRoomId = res.Rooms.FirstOrDefault()?.RoomId;
        if (!string.IsNullOrEmpty(assignedRoomId))
        {
            var conflict = await _dbContext.Reservations
                .Where(r => r.Id != reservationId
                         && r.Rooms.Any(reservationRoom => reservationRoom.RoomId == assignedRoomId)
                         && r.Status != "CANCELLED"
                         && r.CheckInDate < newCheckOut
                         && r.CheckOutDate > res.CheckOutDate)
                .AnyAsync();

            if (conflict)
                throw new InvalidOperationException("The room is not available for the extended period.");
        }

        res.CheckOutDate = newCheckOut;
        var reservationRoom = res.Rooms.FirstOrDefault();
        if (reservationRoom != null) reservationRoom.CheckOutDate = newCheckOut;
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

        if (res.Folio != null && additionalCharge > 0)
        {
            var idempotencyKey = $"EXTEND_STAY:{reservationId}:{newCheckOut.ToUniversalTime():O}";
            var charged = await RecordChargeAsync(
                res.Folio.Id,
                additionalCharge,
                $"Room Charge (Extension) - {additionalNights} night{(additionalNights == 1 ? "" : "s")}",
                userId,
                deviceId,
                idempotencyKey);
            if (!charged) throw new InvalidOperationException("Stay date was updated, but the extension charge could not be posted to the folio.");
        }

        return true;
    }

    public async Task<object> PreviewExtendStayAsync(string reservationId, DateTime newCheckOut)
    {
        var res = await _dbContext.Reservations
            .Include(r => r.Rooms).ThenInclude(rr => rr.Room)
            .FirstOrDefaultAsync(r => r.Id == reservationId);
        if (res == null) throw new InvalidOperationException("Reservation not found");

        if (newCheckOut <= res.CheckInDate)
            throw new InvalidOperationException("New checkout date must be after the check-in date.");

        if (newCheckOut <= res.CheckOutDate)
            throw new InvalidOperationException("New checkout date must be after the current checkout date.");

        var additionalNights = (int)(newCheckOut.Date - res.CheckOutDate.Date).TotalDays;

        // Resolve room type from all available sources
        var firstResRoom = res.Rooms.FirstOrDefault();
        var roomTypeId = res.RoomTypeId
            ?? firstResRoom?.RoomTypeId
            ?? firstResRoom?.Room?.RoomTypeId;
        if (string.IsNullOrWhiteSpace(roomTypeId) && !string.IsNullOrWhiteSpace(firstResRoom?.RoomId))
        {
            roomTypeId = (await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == firstResRoom.RoomId))?.RoomTypeId;
        }
        var roomType = !string.IsNullOrEmpty(roomTypeId)
            ? await _dbContext.RoomTypes.FirstOrDefaultAsync(rt => rt.Id == roomTypeId)
            : null;

        // If room type unavailable offline, return a zero-rate preview so the UI can still proceed
        var ratePerNight = roomType?.BasePrice ?? 0m;
        var currency = roomType?.Currency ?? res.Currency ?? "NGN";

        return new
        {
            additionalNights,
            ratePerNight,
            additionalCharge = additionalNights * ratePerNight,
            currency,
            rateUnavailableOffline = roomType == null
        };
    }

    public async Task<bool> RecordKeycardEncodingAsync(string reservationId, string roomId, string userId, string deviceId, string? encodeData)
    {
        var res = await _dbContext.Reservations
            .Include(r => r.Rooms)
            .FirstOrDefaultAsync(r => r.Id == reservationId);
        if (res == null) throw new InvalidOperationException("Reservation not found.");
        if (res.RoomId != roomId) throw new InvalidOperationException("The reservation is not assigned to this room.");

        JsonElement? parsedEncodeData = null;
        if (!string.IsNullOrWhiteSpace(encodeData))
        {
            parsedEncodeData = JsonSerializer.Deserialize<JsonElement>(encodeData);
        }

        var now = DateTime.UtcNow;
        var operationId = Guid.NewGuid().ToString();
        string? cardSerialNumber = null;
        if (parsedEncodeData.HasValue
            && parsedEncodeData.Value.ValueKind == JsonValueKind.Object
            && parsedEncodeData.Value.TryGetProperty("cardSnr", out var cardSnr))
        {
            cardSerialNumber = cardSnr.GetString();
        }

        var credential = new LocalLockCredential
        {
            Id = Guid.NewGuid().ToString(),
            ReservationId = res.Id,
            RoomId = roomId,
            LockId = $"ENCODER-{roomId}",
            CredentialType = "RFID",
            Status = "ACTIVE",
            ValidFrom = now,
            ValidUntil = res.CheckOutDate,
            CardSerialNumber = cardSerialNumber,
            IssueOperationId = operationId,
            IssuedAt = now,
            MetadataJson = encodeData,
            CreatedAt = now,
            UpdatedAt = now
        };

        var operation = new LocalLockOperation
        {
            Id = operationId,
            PropertyId = res.PropertyId,
            ReservationId = res.Id,
            LockId = credential.LockId,
            RoomId = roomId,
            CredentialId = credential.Id,
            Operation = "ENCODE_CARD",
            Status = "COMPLETED",
            RequestedAt = now,
            StartedAt = now,
            CompletedAt = now,
            AgentId = "DESKTOP",
            DeviceId = deviceId,
            MetadataJson = JsonSerializer.Serialize(new { initiatedBy = userId }),
            CommandJson = JsonSerializer.Serialize(new { responseData = parsedEncodeData })
        };

        res.IsDirty = true;
        res.UpdatedAt = now;
        res.LocalSequence++;
        var eventVersion = res.Version;
        res.Version++;

        _dbContext.LockCredentials.Add(credential);
        _dbContext.LockOperations.Add(operation);
        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = res.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "RESERVATION",
            AggregateId = res.Id,
            AggregateVersion = eventVersion,
            EventType = "KEYCARD_ENCODE",
            Sequence = res.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new
            {
                roomId,
                encodeData = parsedEncodeData,
                operationId,
                credentialId = credential.Id
            })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> EditReservationAsync(string reservationId, LocalReservationPatch patch, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations.FindAsync(reservationId);
        if (res == null) return false;
        await AssertNightAuditAllowsAsync(res.PropertyId);

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

    public async Task<bool> RecordChargeAsync(string folioId, decimal amount, string description, string userId, string deviceId, string? idempotencyKey = null, bool requireFrontdeskSession = true)
    {
        var folio = await _dbContext.Folios.FindAsync(folioId);
        if (folio == null) return false;
        await AssertNightAuditAllowsAsync(folio.PropertyId);

        if (!string.IsNullOrEmpty(idempotencyKey) && CheckFolioIdempotency(folio, idempotencyKey))
            return true;

        var frontdeskSession = requireFrontdeskSession
            ? await GetActiveFrontdeskSessionAsync(folio.PropertyId, userId)
            : null;
        if (requireFrontdeskSession && frontdeskSession == null)
            throw new InvalidOperationException("Open your front desk cashier session before posting a charge.");

        folio.TotalCharges += amount;
        var creditApplicationAmount = Math.Min(folio.AvailableCredit, amount);
        folio.AvailableCredit -= creditApplicationAmount;
        if (creditApplicationAmount > 0)
            ApplyCreditToTransactionsJson(folio, creditApplicationAmount);
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
            frontdeskSessionId = frontdeskSession?.Id,
            createdAt = DateTime.UtcNow
        };

        UpdateFolioTransactionsJson(folio, "items", newItem);
        if (creditApplicationAmount > 0)
        {
            UpdateFolioTransactionsJson(folio, "creditApplications", new
            {
                id = Guid.NewGuid().ToString(),
                amount = creditApplicationAmount,
                source = "CHARGE",
                description = $"Applied guest credit to {description}",
                status = "PENDING_SYNC",
                idempotencyKey = $"CREDIT_APPLICATION:{idempotencyKey ?? newItem.id}",
                createdAt = DateTime.UtcNow
            });
        }

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
            PayloadJson = JsonSerializer.Serialize(new
            {
                amount,
                description,
                currency = folio.Currency ?? "NGN",
                businessDate = frontdeskSession?.BusinessDate,
                originalBusinessDate = frontdeskSession?.BusinessDate,
                idempotencyKey,
                creditApplicationAmount,
                creditApplicationKey = creditApplicationAmount > 0 ? $"CREDIT_APPLICATION:{idempotencyKey ?? newItem.id}" : null,
                frontdeskSessionId = frontdeskSession?.Id,
                frontdeskTransaction = requireFrontdeskSession
            })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RecordCreditAsync(string folioId, decimal amount, string description, string userId, string deviceId, string? idempotencyKey = null)
    {
        var folio = await _dbContext.Folios.FindAsync(folioId);
        if (folio == null) return false;
        await AssertNightAuditAllowsAsync(folio.PropertyId);
        var creditSession = await GetActiveFrontdeskSessionAsync(folio.PropertyId, userId);
        if (creditSession == null)
            throw new InvalidOperationException("Open your front desk cashier session before posting a credit adjustment.");
        if (amount <= 0) throw new InvalidOperationException("Credit amount must be positive.");
        if (!string.IsNullOrEmpty(idempotencyKey) && CheckFolioIdempotency(folio, idempotencyKey)) return true;
        var property = await _dbContext.Properties.FindAsync(folio.PropertyId);
        if (property != null && amount >= property.CreditAdjustmentApprovalThreshold && property.OfflineHighValueDepositPolicy == "BLOCK")
            throw new InvalidOperationException("Credit adjustments are blocked while offline. Connect to the server for manager approval.");
        var requiresApproval = property != null && amount >= property.CreditAdjustmentApprovalThreshold && property.OfflineHighValueDepositPolicy == "ALLOW_WITH_APPROVAL";
        if (!requiresApproval) folio.AvailableCredit += amount;
        folio.UpdatedAt = DateTime.UtcNow;
        folio.IsDirty = true;
        folio.LocalSequence++;
        int eventVersion = folio.Version;
        folio.Version++;

        UpdateFolioTransactionsJson(folio, "credits", new
        {
            id = Guid.NewGuid().ToString(),
            amount,
            remainingAmount = amount,
            description,
            type = "CREDIT_ADJUSTMENT",
            source = "ROOM_DOWNGRADE_CREDIT",
            status = requiresApproval ? "PENDING_APPROVAL" : "PENDING_SYNC",
            idempotencyKey,
            frontdeskSessionId = creditSession.Id,
            createdAt = DateTime.UtcNow
        });

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = folio.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "FOLIO",
            AggregateId = folioId,
            AggregateVersion = eventVersion,
            EventType = requiresApproval ? "CREDIT_ADJUSTMENT_REQUEST" : "ROOM_CREDIT",
            Sequence = folio.LocalSequence,
            IdempotencyKey = idempotencyKey ?? Guid.NewGuid().ToString(),
            PayloadJson = JsonSerializer.Serialize(new { amount, description, currency = folio.Currency ?? "NGN", businessDate = creditSession?.BusinessDate, originalBusinessDate = creditSession?.BusinessDate, idempotencyKey, requiresApproval, frontdeskSessionId = creditSession?.Id })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<LocalFrontdeskSession?> GetActiveFrontdeskSessionAsync(string propertyId, string staffId)
    {
        return await _dbContext.FrontdeskSessions.FirstOrDefaultAsync(session => session.PropertyId == propertyId && session.StaffId == staffId && session.Status == "OPEN");
    }

    public async Task<LocalFrontdeskSession?> GetLatestFrontdeskSessionAsync(string propertyId, string staffId)
    {
        return await _dbContext.FrontdeskSessions
            .Where(session => session.PropertyId == propertyId && session.StaffId == staffId)
            .OrderByDescending(session => session.UpdatedAt)
            .ThenByDescending(session => session.CreatedAt)
            .FirstOrDefaultAsync();
    }

    public async Task<object> GetFrontdeskSessionSummaryAsync(string sessionId)
    {
        var session = await _dbContext.FrontdeskSessions.FirstOrDefaultAsync(item => item.Id == sessionId);
        if (session == null) throw new InvalidOperationException("Front desk session not found.");

        var staff = await _dbContext.Staff.FirstOrDefaultAsync(item => item.Id == session.StaffId);
        var account = await _dbContext.CashAccounts.FirstOrDefaultAsync(item => item.Id == session.CashAccountId);
        var movements = await _dbContext.PosCashMovements
            .Where(item => item.FrontdeskSessionId == sessionId || (item.FrontdeskSessionId == null && item.PropertyId == session.PropertyId && item.CreatedAt >= session.OpenedAt && item.CreatedAt <= (session.ClosedAt ?? DateTime.UtcNow)))
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync();

        var folios = await _dbContext.Folios.Where(item => item.PropertyId == session.PropertyId).ToListAsync();
        var rows = new List<Dictionary<string, object?>>();
        decimal cashPayments = 0m, cardPayments = 0m, bankTransfers = 0m, otherPayments = 0m;
        decimal roomCharges = 0m, laundryCharges = 0m, otherCharges = 0m;
        int paymentCount = 0, chargeCount = 0;

        foreach (var folio in folios)
        {
            if (string.IsNullOrWhiteSpace(folio.TransactionsJson)) continue;
            try
            {
                using var document = JsonDocument.Parse(folio.TransactionsJson);
                var root = document.RootElement;
                if (root.TryGetProperty("payments", out var payments) && payments.ValueKind == JsonValueKind.Array)
                {
                    foreach (var payment in payments.EnumerateArray())
                    {
                        if (!payment.TryGetProperty("frontdeskSessionId", out var paymentSession) || paymentSession.GetString() != sessionId) continue;
                        var amount = ReadDecimal(payment, "amount");
                        var method = payment.TryGetProperty("method", out var methodValue) ? methodValue.GetString() ?? "OTHER" : "OTHER";
                        var createdAt = payment.TryGetProperty("createdAt", out var dateValue) && DateTime.TryParse(dateValue.GetString(), out var parsedDate) ? parsedDate : folio.UpdatedAt;
                        paymentCount++;
                        if (method.Equals("CASH", StringComparison.OrdinalIgnoreCase)) cashPayments += amount;
                        else if (method.Contains("CARD", StringComparison.OrdinalIgnoreCase) || method.Equals("POS", StringComparison.OrdinalIgnoreCase)) cardPayments += amount;
                        else if (method.Contains("BANK", StringComparison.OrdinalIgnoreCase) || method.Contains("TRANSFER", StringComparison.OrdinalIgnoreCase)) bankTransfers += amount;
                        else otherPayments += amount;
                        rows.Add(new Dictionary<string, object?> { ["kind"] = "PAYMENT", ["date"] = createdAt, ["amount"] = amount, ["method"] = method, ["description"] = $"{method} payment", ["folioId"] = folio.Id });
                    }
                }

                if (root.TryGetProperty("items", out var items) && items.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in items.EnumerateArray())
                    {
                        if (!item.TryGetProperty("frontdeskSessionId", out var itemSession) || itemSession.GetString() != sessionId) continue;
                        var type = item.TryGetProperty("type", out var typeValue) ? typeValue.GetString() ?? "CHARGE" : "CHARGE";
                        if (!type.Equals("CHARGE", StringComparison.OrdinalIgnoreCase)) continue;
                        var amount = Math.Abs(ReadDecimal(item, "amount"));
                        var description = item.TryGetProperty("description", out var descriptionValue) ? descriptionValue.GetString() ?? "Front Desk charge" : "Front Desk charge";
                        var createdAt = item.TryGetProperty("createdAt", out var dateValue) && DateTime.TryParse(dateValue.GetString(), out var parsedDate) ? parsedDate : folio.UpdatedAt;
                        chargeCount++;
                        if (description.Contains("LAUNDRY", StringComparison.OrdinalIgnoreCase)) laundryCharges += amount;
                        else if (description.Contains("ROOM", StringComparison.OrdinalIgnoreCase)) roomCharges += amount;
                        else otherCharges += amount;
                        rows.Add(new Dictionary<string, object?> { ["kind"] = "CHARGE", ["date"] = createdAt, ["amount"] = amount, ["method"] = "FOLIO", ["description"] = description, ["folioId"] = folio.Id });
                    }
                }
            }
            catch (JsonException) { }
        }

        var cashRefunds = movements.Where(item => item.Type.Equals("REFUND", StringComparison.OrdinalIgnoreCase) || item.Type.Equals("REFUND_CASH", StringComparison.OrdinalIgnoreCase)).Sum(item => item.Amount);
        var cashIn = movements.Where(item => item.Type.Equals("CASH_IN", StringComparison.OrdinalIgnoreCase) || item.Type.Equals("CASH_TRANSFER_IN", StringComparison.OrdinalIgnoreCase)).Sum(item => item.Amount);
        var cashDrops = movements.Where(item => item.Type.Equals("CASH_DROP", StringComparison.OrdinalIgnoreCase)).Sum(item => item.Amount);
        var paidOuts = movements.Where(item => item.Type.Equals("PAID_OUT", StringComparison.OrdinalIgnoreCase)).Sum(item => item.Amount);
        var transfersOut = movements.Where(item => item.Type.Equals("CASH_TRANSFER_OUT", StringComparison.OrdinalIgnoreCase)).Sum(item => item.Amount);
        foreach (var movement in movements)
        {
            rows.Add(new Dictionary<string, object?> { ["kind"] = "CASH_MOVEMENT", ["date"] = movement.CreatedAt, ["amount"] = movement.Amount, ["method"] = "CASH", ["description"] = movement.Notes ?? movement.ReasonCode, ["type"] = movement.Type, ["folioId"] = null });
        }

        var totalPayments = cashPayments + cardPayments + bankTransfers + otherPayments;
        var totalCharges = roomCharges + laundryCharges + otherCharges;
        var expectedCash = session.OpeningFloat + cashPayments + cashIn - cashDrops - paidOuts - transfersOut - cashRefunds;
        return new
        {
            session = new { session.Id, session.ShiftReference, session.PropertyId, session.BusinessDate, session.Status, session.OpeningFloat, expectedCash, session.DeclaredCash, session.Variance, session.OpenedAt, session.ClosedAt, staffName = staff == null ? "Unknown cashier" : $"{staff.FirstName} {staff.LastName}".Trim(), till = account?.Name ?? "Assigned till" },
            payments = new { count = paymentCount, cash = cashPayments, card = cardPayments, bankTransfer = bankTransfers, other = otherPayments, total = totalPayments },
            charges = new { count = chargeCount, room = roomCharges, laundry = laundryCharges, other = otherCharges, total = totalCharges },
            cash = new { openingFloat = session.OpeningFloat, cashIn, cashDrops, paidOuts, transfersOut, refunds = cashRefunds, expected = expectedCash, declared = session.DeclaredCash, variance = session.Variance ?? (session.DeclaredCash.HasValue ? session.DeclaredCash.Value - expectedCash : (decimal?)null) },
            exceptions = new { pendingSync = await _dbContext.OutboxEvents.CountAsync(item => item.PropertyId == session.PropertyId && (item.Status == "PENDING" || item.Status == "FAILED" || item.Status == "CONFLICT") && item.CreatedAt >= session.OpenedAt), failedSync = await _dbContext.OutboxEvents.CountAsync(item => item.PropertyId == session.PropertyId && (item.Status == "FAILED" || item.Status == "CONFLICT") && item.CreatedAt >= session.OpenedAt) },
            rows = rows.OrderByDescending(item => item["date"]).ToList()
        };
    }

    public async Task<List<LocalCashAccount>> GetCashAccountsAsync(string propertyId)
    {
        return await _dbContext.CashAccounts.Where(account => account.PropertyId == propertyId && account.IsActive).OrderBy(account => account.Name).ToListAsync();
    }

    public async Task<object> GetFrontdeskReconciliationReportAsync(string propertyId, DateTime startDate, DateTime endDate)
    {
        var sessions = await _dbContext.FrontdeskSessions
            .Where(session => session.PropertyId == propertyId && session.BusinessDate >= startDate.Date && session.BusinessDate <= endDate.Date)
            .OrderByDescending(session => session.BusinessDate)
            .ThenByDescending(session => session.OpenedAt)
            .ToListAsync();

        var movements = await _dbContext.PosCashMovements
            .Where(movement => movement.PropertyId == propertyId && movement.CreatedAt >= startDate && movement.CreatedAt <= endDate)
            .OrderByDescending(movement => movement.CreatedAt)
            .ToListAsync();

        var folios = await _dbContext.Folios
            .Where(folio => folio.PropertyId == propertyId)
            .Include(folio => folio.Reservation)
            .ThenInclude(reservation => reservation!.Guest)
            .Include(folio => folio.Reservation)
            .ThenInclude(reservation => reservation!.Rooms)
            .ThenInclude(room => room.Room)
            .ToListAsync();

        var sessionById = sessions.ToDictionary(session => session.Id);
        var accountIds = sessions.Select(session => session.CashAccountId).Distinct().ToList();
        var accounts = await _dbContext.CashAccounts.Where(account => accountIds.Contains(account.Id)).ToDictionaryAsync(account => account.Id);
        var rows = new List<Dictionary<string, object?>>();

        foreach (var movement in movements)
        {
            var inflow = movement.Type is "OPENING_FLOAT" or "PAYMENT" or "CASH_TRANSFER_IN";
            var session = sessionById.Values.FirstOrDefault(item => item.CashAccountId == movement.SourceAccountId && item.BusinessDate == movement.BusinessDate);
            rows.Add(new Dictionary<string, object?>
            {
                ["id"] = movement.Id,
                ["kind"] = "CASH_MOVEMENT",
                ["date"] = movement.CreatedAt,
                ["direction"] = inflow ? "INFLOW" : "OUTFLOW",
                ["amount"] = movement.Amount,
                ["currency"] = movement.Currency,
                ["method"] = "CASH",
                ["type"] = movement.Type,
                ["description"] = movement.Notes ?? movement.ReasonCode,
                ["reference"] = movement.ReceiptReference ?? movement.OperationId,
                ["shiftReference"] = session?.ShiftReference ?? "",
                ["folioNumber"] = null,
                ["confirmationNumber"] = null,
                ["guest"] = null,
                ["rooms"] = Array.Empty<string>(),
            });
        }

        foreach (var folio in folios)
        {
            if (string.IsNullOrWhiteSpace(folio.TransactionsJson)) continue;
            try
            {
                using var document = JsonDocument.Parse(folio.TransactionsJson);
                if (!document.RootElement.TryGetProperty("items", out var items) || items.ValueKind != JsonValueKind.Array) continue;
                var reservation = folio.Reservation;
                var guestName = reservation?.Guest == null ? null : $"{reservation.Guest.FirstName} {reservation.Guest.LastName}".Trim();
                var rooms = reservation?.Rooms.Select(room => room.Room?.DisplayName ?? room.Room?.Number).Where(number => !string.IsNullOrWhiteSpace(number)).ToArray() ?? Array.Empty<string>();

                foreach (var item in items.EnumerateArray())
                {
                    var createdAt = item.TryGetProperty("createdAt", out var createdAtElement) && DateTime.TryParse(createdAtElement.GetString(), out var parsedCreatedAt) ? parsedCreatedAt : folio.UpdatedAt;
                    if (createdAt < startDate || createdAt > endDate) continue;
                    var amount = ReadDecimal(item, "amount");
                    rows.Add(new Dictionary<string, object?>
                    {
                        ["id"] = item.TryGetProperty("id", out var itemId) ? itemId.GetString() : Guid.NewGuid().ToString(),
                        ["kind"] = "FOLIO_ITEM",
                        ["date"] = createdAt,
                        ["direction"] = amount >= 0 ? "INFLOW" : "OUTFLOW",
                        ["amount"] = Math.Abs(amount),
                        ["currency"] = folio.Currency ?? "NGN",
                        ["method"] = "FOLIO",
                        ["type"] = item.TryGetProperty("type", out var itemType) ? itemType.GetString() : "CHARGE",
                        ["description"] = item.TryGetProperty("description", out var description) ? description.GetString() : "Folio transaction",
                        ["reference"] = item.TryGetProperty("idempotencyKey", out var key) ? key.GetString() : null,
                        ["shiftReference"] = "",
                        ["folioNumber"] = folio.Id,
                        ["confirmationNumber"] = reservation?.ConfirmationNumber,
                        ["guest"] = guestName,
                        ["rooms"] = rooms,
                    });
                }
            }
            catch (JsonException)
            {
            }
        }

        var inflows = movements.Where(movement => movement.Type is "OPENING_FLOAT" or "PAYMENT" or "CASH_TRANSFER_IN").Sum(movement => movement.Amount);
        var outflows = movements.Where(movement => movement.Type is not ("OPENING_FLOAT" or "PAYMENT" or "CASH_TRANSFER_IN")).Sum(movement => movement.Amount);

        return new
        {
            propertyId,
            startDate,
            endDate,
            sessions = sessions.Select(session => new
            {
                session.Id,
                session.ShiftReference,
                session.BusinessDate,
                session.Status,
                session.OpeningFloat,
                session.SystemExpectedCash,
                session.DeclaredCash,
                session.Variance,
                cashAccount = accounts.TryGetValue(session.CashAccountId, out var account) ? new { account.Id, account.Name, account.Type } : null,
            }),
            rows = rows.OrderByDescending(row => row["date"]).ToList(),
            totals = new { inflows, outflows, net = inflows - outflows, sessions = sessions.Count },
        };
    }

    private static decimal ReadDecimal(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var value)) return 0m;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var number)) return number;
        return value.ValueKind == JsonValueKind.String && decimal.TryParse(value.GetString(), out var text) ? text : 0m;
    }

    public async Task<LocalFrontdeskSession> OpenFrontdeskSessionAsync(string propertyId, string staffId, string cashAccountId, decimal openingFloat, string deviceId)
    {
        await AssertNightAuditAllowsAsync(propertyId);
        var existing = await GetActiveFrontdeskSessionAsync(propertyId, staffId);
        if (existing != null) throw new InvalidOperationException("Staff already has an open front desk session.");
        var tillInUse = await _dbContext.FrontdeskSessions.AnyAsync(session => session.PropertyId == propertyId && session.CashAccountId == cashAccountId && session.Status == "OPEN");
        if (tillInUse) throw new InvalidOperationException("Till is already in use by another open session.");
        var property = await _dbContext.Properties.FindAsync(propertyId);
        var now = DateTime.UtcNow;
        var session = new LocalFrontdeskSession
        {
            Id = Guid.NewGuid().ToString(), PropertyId = propertyId, StaffId = staffId, CashAccountId = cashAccountId,
            ShiftReference = $"FD-{now:yyyyMMdd}-{Guid.NewGuid().ToString()[..8].ToUpperInvariant()}",
            BusinessDate = property?.BusinessDate.Date ?? now.Date, OpeningFloat = openingFloat, SystemExpectedCash = openingFloat,
            OpenedAt = now, CreatedAt = now, UpdatedAt = now
        };
        _dbContext.FrontdeskSessions.Add(session);
        if (openingFloat > 0)
        {
            _dbContext.PosCashMovements.Add(new LocalPosCashMovement
            {
                Id = Guid.NewGuid().ToString(), PropertyId = propertyId, DeviceId = deviceId, FrontdeskSessionId = session.Id, UserId = staffId,
                Amount = openingFloat, Type = "OPENING_FLOAT", SourceAccountId = cashAccountId, DestinationAccountId = cashAccountId,
                ReasonCode = "OPEN_SHIFT", OperationId = $"FLOAT-{session.Id}", BusinessDate = session.BusinessDate, CreatedAt = now
            });
        }
        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            IdempotencyKey = $"frontdesk-open:{session.Id}", PropertyId = propertyId, DeviceId = deviceId, OperatorId = staffId,
            AggregateType = "FRONTDESK_SESSION", AggregateId = session.Id, EventType = "FRONTDESK_SESSION_OPENED", Sequence = 1,
            PayloadJson = JsonSerializer.Serialize(new { sessionId = session.Id, propertyId, staffId, cashAccountId, session.ShiftReference, session.BusinessDate, openingFloat })
        });
        await _dbContext.SaveChangesAsync();
        return session;
    }

    public async Task<LocalFrontdeskSession> CloseFrontdeskSessionAsync(string sessionId, decimal declaredCash, string staffId, string deviceId)
    {
        var session = await _dbContext.FrontdeskSessions.FirstOrDefaultAsync(item => item.Id == sessionId && item.StaffId == staffId);
        if (session == null) throw new InvalidOperationException("Front desk session not found.");
        await AssertNightAuditAllowsAsync(session.PropertyId, session.BusinessDate);
        if (session.Status != "OPEN") throw new InvalidOperationException($"Session is already {session.Status}.");
            var movements = await _dbContext.PosCashMovements.Where(item => item.FrontdeskSessionId == session.Id || (item.FrontdeskSessionId == null && item.PropertyId == session.PropertyId && item.CreatedAt >= session.OpenedAt && item.CreatedAt <= DateTime.UtcNow)).ToListAsync();
        var expected = session.OpeningFloat + movements.Where(item => item.Type is "PAYMENT" or "CASH_TRANSFER_IN").Sum(item => item.Amount) - movements.Where(item => item.Type is "REFUND" or "PAID_OUT" or "CASH_DROP" or "CASH_TRANSFER_OUT").Sum(item => item.Amount);
        session.Status = "CLOSED"; session.ControlStatus = "SUBMITTED"; session.VarianceStatus = Math.Abs(declaredCash - expected) > 0.01m ? "OPEN" : null;
        session.DeclaredCash = declaredCash; session.SystemExpectedCash = expected; session.Variance = declaredCash - expected; session.ClosingAt = DateTime.UtcNow; session.ClosedAt = DateTime.UtcNow;
        session.SubmittedAt = session.ClosingAt; session.SubmittedBy = staffId; session.UpdatedAt = DateTime.UtcNow;
        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            IdempotencyKey = $"frontdesk-close:{session.Id}", PropertyId = session.PropertyId, DeviceId = deviceId, OperatorId = staffId,
            AggregateType = "FRONTDESK_SESSION", AggregateId = session.Id, EventType = "FRONTDESK_SESSION_CLOSED", Sequence = 2,
            PayloadJson = JsonSerializer.Serialize(new { sessionId = session.Id, declaredCash, systemExpectedCash = expected, variance = session.Variance, businessDate = session.BusinessDate })
        });
        await _dbContext.SaveChangesAsync();
        return session;
    }

    public async Task<LocalFrontdeskSession> ReconcileFrontdeskSessionAsync(string sessionId, string decision, string? notes, string staffId, string deviceId)
    {
        if (decision is not ("APPROVED" or "APPROVED_WITH_VARIANCE" or "REJECTED"))
            throw new InvalidOperationException("Invalid reconciliation decision.");

        var session = await _dbContext.FrontdeskSessions.FirstOrDefaultAsync(item => item.Id == sessionId);
        if (session == null) throw new InvalidOperationException("Front desk session not found.");
        if (session.Status is not ("CLOSED" or "UNDER_REVIEW"))
            throw new InvalidOperationException($"Cannot reconcile session in status {session.Status}.");
        if (session.StaffId == staffId)
            throw new UnauthorizedAccessException("The operator cannot approve their own Front Desk shift.");
        if (decision == "APPROVED" && session.Variance.HasValue && Math.Abs(session.Variance.Value) > 0.01m)
            throw new InvalidOperationException("A session with a cash variance must be approved with variance or rejected.");
        if (decision == "APPROVED_WITH_VARIANCE" && session.Variance.HasValue && Math.Abs(session.Variance.Value) > 0.01m && string.IsNullOrWhiteSpace(notes))
            throw new InvalidOperationException("Reviewer notes are required when approving a cash variance.");

        // Approval is not reconciliation. Keep the local projection aligned
        // with the server control workflow until handover/deposit completes.
        var reviewedAt = DateTime.UtcNow;
        session.Status = decision == "REJECTED"
            ? "RETURNED"
            : decision == "APPROVED_WITH_VARIANCE" ? "APPROVED_WITH_VARIANCE" : "APPROVED";
        session.ReconciledAt = null;
        session.ReconciledBy = null;
        session.ReconciliationDecision = decision;
        session.ReconciliationNotes = notes;
        session.ControlStatus = decision == "REJECTED" ? "RETURNED" : decision;
        session.VarianceStatus = decision == "APPROVED_WITH_VARIANCE" ? "ACCEPTED" : null;
        session.ReviewStartedAt ??= reviewedAt;
        session.ReviewStartedBy ??= staffId;
        session.ApprovalDecision = decision;
        session.ApprovalNotes = notes;
        session.UpdatedAt = DateTime.UtcNow;
        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            IdempotencyKey = $"frontdesk-review:{session.Id}:{reviewedAt:O}",
            PropertyId = session.PropertyId, DeviceId = deviceId, OperatorId = staffId,
            AggregateType = "FRONTDESK_SESSION", AggregateId = session.Id, EventType = "FRONTDESK_SESSION_REVIEWED", Sequence = 3,
            PayloadJson = JsonSerializer.Serialize(new { sessionId, decision, notes, status = session.Status, controlStatus = session.ControlStatus, varianceStatus = session.VarianceStatus, reviewedAt, reviewerId = staffId })
        });
        await _dbContext.SaveChangesAsync();
        return session;
    }

    public async Task<bool> RecordPaymentAsync(string folioId, decimal amount, string method, string userId, string deviceId, string? idempotencyKey = null)
    {
        var folio = await _dbContext.Folios.FindAsync(folioId);
        if (folio == null) return false;
        await AssertNightAuditAllowsAsync(folio.PropertyId);

        var frontdeskSession = await GetActiveFrontdeskSessionAsync(folio.PropertyId, userId);
        if (frontdeskSession == null)
            throw new InvalidOperationException("Open your front desk cashier session before posting a payment.");

        if (!string.IsNullOrEmpty(idempotencyKey) && CheckFolioIdempotency(folio, idempotencyKey))
            return true;

        if (amount <= 0)
            throw new InvalidOperationException("Payment amount must be positive.");
        if (amount > folio.OutstandingBalance + 0.01m)
            throw new InvalidOperationException("Payment amount exceeds the outstanding balance.");

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
            frontdeskSessionId = frontdeskSession.Id,
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
            frontdeskSessionId = frontdeskSession.Id,
            createdAt = DateTime.UtcNow
        };

        UpdateFolioTransactionsJson(folio, "items", newItem);

        if (frontdeskSession != null && string.Equals(method, "CASH", StringComparison.OrdinalIgnoreCase))
        {
            _dbContext.PosCashMovements.Add(new LocalPosCashMovement
            {
                Id = Guid.NewGuid().ToString(), PropertyId = folio.PropertyId, DeviceId = deviceId, PosSessionId = null, FrontdeskSessionId = frontdeskSession.Id,
                UserId = userId, Amount = amount, Type = "PAYMENT", SourceAccountId = frontdeskSession.CashAccountId,
                DestinationAccountId = frontdeskSession.CashAccountId, ReasonCode = "FOLIO_PAYMENT", OperationId = $"FD-PAYMENT-{newPayment.id}",
                BusinessDate = frontdeskSession.BusinessDate, CreatedAt = DateTime.UtcNow
            });
        }

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
            PayloadJson = JsonSerializer.Serialize(new { amount, method, reservationId = folio.ReservationId, currency = folio.Currency ?? "NGN", businessDate = frontdeskSession.BusinessDate, originalBusinessDate = frontdeskSession.BusinessDate, idempotencyKey, frontdeskSessionId = frontdeskSession?.Id })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RecordAdvanceDepositAsync(string folioId, decimal amount, string method, string? reference, string? notes, string userId, string deviceId, string? idempotencyKey = null)
    {
        var folio = await _dbContext.Folios.FindAsync(folioId);
        if (folio == null) return false;
        await AssertNightAuditAllowsAsync(folio.PropertyId);
        var frontdeskSession = await GetActiveFrontdeskSessionAsync(folio.PropertyId, userId);
        if (frontdeskSession == null)
            throw new InvalidOperationException("Open your front desk cashier session before posting an advance deposit.");
        if (amount <= 0) throw new InvalidOperationException("Deposit amount must be positive.");
        if (string.IsNullOrWhiteSpace(idempotencyKey)) throw new InvalidOperationException("Deposit requires an idempotency key.");
        if (CheckFolioIdempotency(folio, idempotencyKey)) return true;

        var property = await _dbContext.Properties.FindAsync(folio.PropertyId);
        var requiresApproval = property != null && amount >= property.DepositApprovalThreshold && property.OfflineHighValueDepositPolicy == "ALLOW_WITH_APPROVAL";
        if (property != null && amount >= property.DepositApprovalThreshold && property.OfflineHighValueDepositPolicy == "BLOCK")
            throw new InvalidOperationException($"High-value deposits of {amount:N2} are blocked while offline. Connect to the server for manager approval.");

        if (!requiresApproval) folio.AvailableCredit += amount;
        folio.UpdatedAt = DateTime.UtcNow;
        folio.IsDirty = true;
        folio.LocalSequence++;
        int eventVersion = folio.Version;
        folio.Version++;

        UpdateFolioTransactionsJson(folio, "credits", new
        {
            id = Guid.NewGuid().ToString(),
            amount,
            remainingAmount = amount,
            method,
            reference,
            notes,
            type = "ADVANCE_DEPOSIT",
            status = requiresApproval ? "PENDING_APPROVAL" : "PENDING_SYNC",
            idempotencyKey,
            frontdeskSessionId = frontdeskSession.Id,
            createdAt = DateTime.UtcNow
        });

        _dbContext.OutboxEvents.Add(new LocalOutboxEvent
        {
            PropertyId = folio.PropertyId,
            DeviceId = deviceId,
            OperatorId = userId,
            AggregateType = "FOLIO",
            AggregateId = folioId,
            AggregateVersion = eventVersion,
            EventType = requiresApproval ? "ADVANCE_DEPOSIT_REQUEST" : "ADVANCE_DEPOSIT",
            Sequence = folio.LocalSequence,
            IdempotencyKey = idempotencyKey,
            PayloadJson = JsonSerializer.Serialize(new
            {
                amount,
                method,
                reference,
                notes,
                reservationId = folio.ReservationId,
                currency = folio.Currency ?? "NGN",
                businessDate = frontdeskSession.BusinessDate,
                originalBusinessDate = frontdeskSession.BusinessDate,
                idempotencyKey,
                requiresApproval,
                frontdeskSessionId = frontdeskSession.Id
            })
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
            if (doc.RootElement.TryGetProperty("credits", out var credits) && credits.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var credit in credits.EnumerateArray())
                {
                    if (credit.TryGetProperty("idempotencyKey", out var keyProp) && keyProp.ValueKind == System.Text.Json.JsonValueKind.String && keyProp.GetString() == idempotencyKey)
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

    private void ApplyCreditToTransactionsJson(LocalFolio folio, decimal amount)
    {
        if (amount <= 0 || string.IsNullOrWhiteSpace(folio.TransactionsJson)) return;

        try
        {
            var root = System.Text.Json.Nodes.JsonNode.Parse(folio.TransactionsJson) as System.Text.Json.Nodes.JsonObject;
            if (root == null || root["credits"] is not System.Text.Json.Nodes.JsonArray credits) return;

            var remainingToApply = amount;
            foreach (var creditNode in credits)
            {
                if (remainingToApply <= 0 || creditNode is not System.Text.Json.Nodes.JsonObject credit) break;
                var remaining = credit["remainingAmount"]?.GetValue<decimal>() ?? 0m;
                if (remaining <= 0) continue;

                var applied = Math.Min(remainingToApply, remaining);
                var newRemaining = remaining - applied;
                credit["remainingAmount"] = newRemaining;
                credit["status"] = newRemaining <= 0 ? "EXHAUSTED" : "PARTIALLY_APPLIED";
                remainingToApply -= applied;
            }

            folio.TransactionsJson = root.ToJsonString();
        }
        catch
        {
        }
    }

    public async Task<bool> ProcessCheckInAsync(string reservationId, string userId, string deviceId, string? encodeData = null)
    {
        var res = await _dbContext.Reservations
            .Include(r => r.Folio)
            .Include(r => r.Rooms)
            .FirstOrDefaultAsync(r => r.Id == reservationId);
        if (res == null || (res.Status != "PENDING" && res.Status != "CONFIRMED")) return false;
        await AssertNightAuditAllowsAsync(res.PropertyId);
        if (res.Folio != null && res.Folio.NetBalance > 0.01m)
            throw new InvalidOperationException("Cannot check in with an outstanding balance. Settle the folio first.");

        res.Status = "CHECKED_IN";
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
            EventType = "CHECK_IN",
            Sequence = res.LocalSequence,
            PayloadJson = JsonSerializer.Serialize(new 
            { 
                roomId = res.RoomId
            })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ProcessCheckOutAsync(string reservationId, string userId, string deviceId)
    {
        var res = await _dbContext.Reservations
            .Include(r => r.Folio)
            .Include(r => r.Rooms)
                .ThenInclude(rr => rr.Room)
            .FirstOrDefaultAsync(r => r.Id == reservationId);
        if (res == null || res.Status != "CHECKED_IN") return false;
        await AssertNightAuditAllowsAsync(res.PropertyId);

        if (res.Folio != null && res.Folio.NetBalance > 0.01m)
        {
            throw new InvalidOperationException($"Cannot check out with an outstanding balance of {res.Folio.NetBalance:N2}. Settle the folio first.");
        }

        if (res.Folio != null && res.Folio.NetBalance < -0.01m)
        {
            throw new InvalidOperationException($"Cannot check out with a guest credit of {Math.Abs(res.Folio.NetBalance):N2}. Process a refund first.");
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
        var checkoutRoom = res.Rooms.FirstOrDefault(rr => !string.IsNullOrWhiteSpace(rr.RoomId));
        var checkoutRoomId = checkoutRoom?.RoomId ?? res.RoomId;
        if (!string.IsNullOrWhiteSpace(checkoutRoomId))
        {
            var room = checkoutRoom?.Room
                ?? await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == checkoutRoomId);
            if (room != null)
            {
                room.Status = "CLEANING";
                room.HousekeepingStatus = "CLEANING";
                room.IsOccupied = false;
                room.UpdatedAt = DateTime.UtcNow;
            }

            var cleaningTask = new LocalHousekeepingTask
            {
                PropertyId = res.PropertyId,
                RoomId = checkoutRoomId,
                RoomNumber = room?.Number ?? res.RoomNumber ?? "",
                TaskType = "CLEANING",
                Status = "CLEANING"
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
        }

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UpdateHousekeepingTaskStatusAsync(string taskId, string status, string userId, string deviceId)
    {
        var task = await _dbContext.HousekeepingTasks.FindAsync(taskId);
        if (task == null) return false;
        await AssertNightAuditAllowsAsync(task.PropertyId);

        var allowedTransitions = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["CLEANING"] = ["INSPECTED", "MAINTENANCE_REQUIRED"],
            ["INSPECTED"] = [],
            ["CANCELLED"] = [],
            ["MAINTENANCE_REQUIRED"] = ["CLEANING"]
        };
        var currentStatus = task.Status is "PENDING" or "ASSIGNED" or "CLEAN" ? "CLEANING" : task.Status;
        if (!allowedTransitions.TryGetValue(currentStatus, out var allowed) || !allowed.Contains(status, StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Cannot transition housekeeping task from {currentStatus} to {status}.");

        task.Status = status.ToUpperInvariant();
        task.UpdatedAt = DateTime.UtcNow;
        task.IsDirty = true;
        var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == task.RoomId);
        if (room != null)
        {
            room.HousekeepingStatus = task.Status;
            room.Status = task.Status switch
            {
                "CLEANING" => "CLEANING",
                "INSPECTED" => "AVAILABLE",
                "MAINTENANCE_REQUIRED" => "MAINTENANCE",
                _ => room.Status
            };
            room.UpdatedAt = DateTime.UtcNow;
        }
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
            PayloadJson = JsonSerializer.Serialize(new { status = task.Status })
        });

        await _dbContext.SaveChangesAsync();
        return true;
    }

    public async Task<LocalMaintenanceTicket> CreateMaintenanceTicketAsync(LocalMaintenanceTicket ticket, string userId, string deviceId)
    {
        ticket.IsDirty = true;
        ticket.UpdatedAt = DateTime.UtcNow;
        if (ticket.RequiresRoomRestriction && !string.IsNullOrWhiteSpace(ticket.RoomId))
        {
            var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == ticket.RoomId);
            if (room != null)
            {
                room.Status = "MAINTENANCE";
                room.MaintenanceStatus = "OPEN";
                room.UpdatedAt = DateTime.UtcNow;
            }
        }
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

        if (!string.IsNullOrWhiteSpace(ticket.RoomId))
        {
            var room = await _dbContext.Rooms.FirstOrDefaultAsync(r => r.Id == ticket.RoomId);
            if (room != null && room.Status == "MAINTENANCE")
            {
                room.Status = "DIRTY";
                room.MaintenanceStatus = "RESOLVED";
                room.HousekeepingStatus = "PENDING";
                room.UpdatedAt = DateTime.UtcNow;

                var housekeepingTask = new LocalHousekeepingTask
                {
                    PropertyId = ticket.PropertyId,
                    RoomId = room.Id,
                    RoomNumber = room.Number,
                    TaskType = "INSPECTION",
                    Status = "PENDING",
                    Notes = "Maintenance resolved; housekeeping must clean and inspect the room before release."
                };
                _dbContext.HousekeepingTasks.Add(housekeepingTask);
                _dbContext.OutboxEvents.Add(new LocalOutboxEvent
                {
                    Id = Guid.NewGuid().ToString(),
                    PropertyId = ticket.PropertyId,
                    DeviceId = deviceId,
                    OperatorId = userId,
                    AggregateType = "HOUSEKEEPING_TASK",
                    AggregateId = housekeepingTask.Id,
                    AggregateVersion = 1,
                    EventType = "CREATE",
                    Sequence = 1,
                    PayloadJson = JsonSerializer.Serialize(housekeepingTask),
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

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
        await _dbContext.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS RefundRequests (
            Id TEXT NOT NULL PRIMARY KEY, PropertyId TEXT NOT NULL, ReservationId TEXT NOT NULL,
            FolioId TEXT NOT NULL, PaymentId TEXT NOT NULL, IdempotencyKey TEXT NOT NULL, RequestedAmount TEXT NOT NULL,
            ApprovedAmount TEXT NULL, Currency TEXT NOT NULL, RequestedMethod TEXT NOT NULL,
            ApprovedMethod TEXT NULL, Category TEXT NOT NULL, Reason TEXT NOT NULL,
            Status TEXT NOT NULL, CurrentApprovalStep INTEGER NOT NULL DEFAULT 1,
            CreatedAt TEXT NOT NULL, UpdatedAt TEXT NOT NULL, IsDirty INTEGER NOT NULL DEFAULT 0
        );");
        await _dbContext.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS FrontdeskSessions (
            Id TEXT NOT NULL PRIMARY KEY, PropertyId TEXT NOT NULL, StaffId TEXT NOT NULL,
            CashAccountId TEXT NOT NULL, ShiftReference TEXT NOT NULL UNIQUE, BusinessDate TEXT NOT NULL,
            Status TEXT NOT NULL, OpeningFloat TEXT NOT NULL DEFAULT '0', SystemExpectedCash TEXT NOT NULL DEFAULT '0',
            DeclaredCash TEXT NULL, Variance TEXT NULL, OpenedAt TEXT NOT NULL, ClosingAt TEXT NULL,
            ClosedAt TEXT NULL, ReconciledAt TEXT NULL, ReconciledBy TEXT NULL, ReconciliationDecision TEXT NULL,
            ReconciliationNotes TEXT NULL, CreatedAt TEXT NOT NULL, UpdatedAt TEXT NOT NULL
        );");
        try
        {
            await _dbContext.Database.ExecuteSqlRawAsync("ALTER TABLE PosCashMovements ADD COLUMN FrontdeskSessionId TEXT NULL");
        }
        catch (Microsoft.Data.Sqlite.SqliteException ex) when (ex.SqliteErrorCode == 1 && ex.Message.Contains("duplicate column", StringComparison.OrdinalIgnoreCase)) { }
        await _dbContext.ApplyPosRoutingSchemaAsync();
        
        // Seed Stanzel Grand Resort for the pilot if it doesn't exist
        if (!await _dbContext.Properties.AnyAsync())
        {
            _dbContext.Properties.Add(new LocalProperty
            {
                Id = "prop_stanzel_001",
                Name = "Stanzel Grand Resort",
                Code = "SGR",
                City = "Los Angeles",
                Currency = "NGN",
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

    public async Task<List<LocalRefundRequest>> GetRefundRequestsAsync(string propertyId)
    {
        return await _dbContext.RefundRequests.Where(request => request.PropertyId == propertyId).OrderByDescending(request => request.CreatedAt).Take(100).ToListAsync();
    }

    public async Task<LocalRefundRequest> QueueRefundRequestAsync(string paymentId, string propertyId, string reservationId, string folioId, decimal amount, string currency, string category, int reducedStayNights, string reason, string requestedMethod, string? bankAccountName, string? bankAccountNumber, string? bankName, string? bankCode, string userId, string deviceId)
    {
        var refundSession = string.Equals(requestedMethod, "CASH", StringComparison.OrdinalIgnoreCase)
            ? await GetActiveFrontdeskSessionAsync(propertyId, userId)
            : null;
        if (string.Equals(requestedMethod, "CASH", StringComparison.OrdinalIgnoreCase) && refundSession == null)
            throw new InvalidOperationException("Open your front desk cashier session before requesting a cash refund.");

        var idempotencyKey = Guid.NewGuid().ToString();
        var request = new LocalRefundRequest { Id = Guid.NewGuid().ToString(), IdempotencyKey = idempotencyKey, PropertyId = propertyId, ReservationId = reservationId, FolioId = folioId, PaymentId = paymentId, RequestedAmount = amount, Currency = currency, RequestedMethod = requestedMethod, Category = category, Reason = reason, IsDirty = true };
        _dbContext.RefundRequests.Add(request);
        _dbContext.OutboxEvents.Add(new LocalOutboxEvent { IdempotencyKey = idempotencyKey, PropertyId = propertyId, DeviceId = deviceId, OperatorId = userId, AggregateType = "PAYMENT", AggregateId = paymentId, EventType = "REFUND_REQUESTED", PayloadJson = JsonSerializer.Serialize(new { PaymentId = paymentId, PropertyId = propertyId, ReservationId = reservationId, FolioId = folioId, Amount = amount, Currency = currency, Category = category, ReducedStayNights = reducedStayNights, Reason = reason, RequestedMethod = requestedMethod, BankAccountName = bankAccountName, BankAccountNumber = bankAccountNumber, BankName = bankName, BankCode = bankCode, IdempotencyKey = idempotencyKey, frontdeskSessionId = refundSession?.Id }) });
        await _dbContext.SaveChangesAsync();
        return request;
    }

    public async Task UpsertRefundRequestsAsync(IEnumerable<LocalRefundRequest> requests, string propertyId)
    {
        foreach (var incoming in requests.Where(request => request.PropertyId == propertyId))
        {
            var existing = await _dbContext.RefundRequests.FirstOrDefaultAsync(request => request.Id == incoming.Id || request.IdempotencyKey == incoming.IdempotencyKey);
            if (existing == null)
            {
                _dbContext.RefundRequests.Add(incoming);
                continue;
            }
            if (existing.IsDirty) continue;
            existing.RequestedAmount = incoming.RequestedAmount;
            existing.IdempotencyKey = incoming.IdempotencyKey;
            existing.ApprovedAmount = incoming.ApprovedAmount;
            existing.Currency = incoming.Currency;
            existing.RequestedMethod = incoming.RequestedMethod;
            existing.ApprovedMethod = incoming.ApprovedMethod;
            existing.Category = incoming.Category;
            existing.Reason = incoming.Reason;
            existing.Status = incoming.Status;
            existing.CurrentApprovalStep = incoming.CurrentApprovalStep;
            existing.UpdatedAt = incoming.UpdatedAt;
        }
        await _dbContext.SaveChangesAsync();
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
        return await _dbContext.RoomTypes
            .Where(rt => string.IsNullOrEmpty(propertyId) || rt.PropertyId == propertyId)
            .ToListAsync();
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
            .Where(r => r.Rooms.Any(reservationRoom => reservationRoom.RoomId == room.Id) && r.Status == "CHECKED_IN")
            .FirstOrDefaultAsync();

        if (reservation == null) return null;

        return new
        {
            reservationId = reservation.Id,
            checkIn = reservation.CheckInDate,
            checkOut = reservation.CheckOutDate,
            folioBalance = reservation.Folio?.NetBalance ?? 0,
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
        await AssertNightAuditAllowsAsync(room.PropertyId);

        newStatus = newStatus.ToUpperInvariant();
        if (newStatus == "AVAILABLE" && new[] { "DIRTY", "MAINTENANCE", "OUT_OF_ORDER" }.Contains(room.Status.ToUpperInvariant()))
            throw new InvalidOperationException("This room must be cleared by maintenance and/or housekeeping before it becomes Available.");

        room.Status = newStatus;
        // If it's CLEAN or DIRTY, also update HousekeepingStatus to match cloud behavior if necessary.
        if (newStatus == "CLEAN" || newStatus == "DIRTY") {
            room.HousekeepingStatus = newStatus == "DIRTY" ? "PENDING" : newStatus;
        }

        if (newStatus == "DIRTY")
        {
            var cleaningTask = new LocalHousekeepingTask
            {
                PropertyId = room.PropertyId,
                RoomId = room.Id,
                RoomNumber = room.Number,
                TaskType = "INSPECTION",
                Status = "PENDING",
                Notes = "Room marked Dirty and requires housekeeping attention."
            };
            _dbContext.HousekeepingTasks.Add(cleaningTask);
            _dbContext.OutboxEvents.Add(new LocalOutboxEvent
            {
                Id = Guid.NewGuid().ToString(),
                PropertyId = room.PropertyId,
                DeviceId = "System",
                OperatorId = "System",
                AggregateType = "HOUSEKEEPING_TASK",
                AggregateId = cleaningTask.Id,
                AggregateVersion = 1,
                EventType = "CREATE",
                Sequence = 1,
                PayloadJson = JsonSerializer.Serialize(cleaningTask),
                CreatedAt = DateTime.UtcNow
            });
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
        var property = await _dbContext.Properties.FirstOrDefaultAsync(p => p.Id == propertyId);
        var today = property?.BusinessDate.Date ?? DateTime.UtcNow.Date;

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

        var arrivalsRaw = reservations
            .Where(r => r.CheckInDate.Date == today && r.Status != "CHECKED_OUT")
            .ToList();
        var departuresRaw = reservations
            .Where(r => r.CheckOutDate.Date == today && r.Status == "CHECKED_IN")
            .ToList();
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
                guestPhone = r.Guest?.Phone ?? "",
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
                guestPhone = r.Guest?.Phone ?? "",
                confirmationNumber = r.ConfirmationNumber,
                roomName = room?.Number ?? "Unassigned",
                roomTypeName = roomType?.Name ?? "",
                checkOutDate = r.CheckOutDate,
                checkOutTime = "12:00",
                stayEndsToday = true,
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
            .Where(r => r.PropertyId == propertyId && r.Status == "AVAILABLE");

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
        var property = await _dbContext.Properties.FindAsync(order.PropertyId);
        if (property == null) throw new InvalidOperationException("Property is not available offline.");
        if (order.BusinessDate == default) order.BusinessDate = property.BusinessDate.Date;
        await AssertNightAuditAllowsAsync(order.PropertyId, order.BusinessDate);
        
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

        if (order.Items.Any())
        {
            var productIds = order.Items
                .Where(item => !string.IsNullOrWhiteSpace(item.ProductId))
                .Select(item => item.ProductId!)
                .Distinct()
                .ToList();
            var products = await _dbContext.PosProducts
                .Where(product => productIds.Contains(product.Id))
                .ToListAsync();
            var categoryIds = products.Select(product => product.CategoryId).Distinct().ToList();
            var categories = await _dbContext.ProductCategories
                .Where(category => categoryIds.Contains(category.Id))
                .ToDictionaryAsync(category => category.Id);
            var productMap = products.ToDictionary(product => product.Id);

            string ResolveStation(LocalPosOrderItem item)
            {
                if (item.ProductId != null && productMap.TryGetValue(item.ProductId, out var product))
                {
                    var station = product.ProductionStation;
                    if (string.IsNullOrWhiteSpace(station) && categories.TryGetValue(product.CategoryId, out var category))
                        station = category.ProductionStation;
                    if (!string.IsNullOrWhiteSpace(station)) return station.Trim().ToUpperInvariant();
                }
                return "KITCHEN";
            }

            var stationGroups = order.Items
                .GroupBy(ResolveStation)
                .ToList();

            foreach (var stationGroup in stationGroups)
            {
                var station = stationGroup.Key;
                var requiresProductionTicket = station is "KITCHEN" or "BAR";
                var firedAt = DateTime.UtcNow;

                if (!requiresProductionTicket)
                {
                    foreach (var item in stationGroup)
                    {
                        item.KitchenStatus = "DIRECT";
                        item.SentToKitchenAt = firedAt;
                    }
                    continue;
                }

                var kot = new LocalPosKot
                {
                    Id = Guid.NewGuid().ToString(),
                    OrderId = order.Id,
                    OutletId = order.OutletId,
                    DeviceId = deviceId,
                    CreatedBy = userId,
                    OrderNumber = order.OrderNumber,
                    KotNumber = $"{order.OrderNumber}-{station}-{Guid.NewGuid().ToString("N").Substring(0, 4)}",
                    Status = "PENDING",
                    ProductionStation = station,
                    PrintStatus = "QUEUED",
                    OperationId = operationId,
                    BusinessDate = order.BusinessDate,
                    TableNumber = order.TableNumber,
                    ServerName = userId,
                    FiredAt = firedAt,
                    CreatedAt = firedAt,
                    ItemIdsJson = JsonSerializer.Serialize(stationGroup.Select(item => item.Id))
                };

                foreach (var item in stationGroup)
                {
                    item.KotId = kot.Id;
                    item.KitchenStatus = "PENDING";
                    item.SentToKitchenAt = firedAt;
                }

                order.Kots.Add(kot);
            }
        }

        foreach (var kot in order.Kots)
        {
            if (string.IsNullOrWhiteSpace(kot.Id)) kot.Id = Guid.NewGuid().ToString();
            kot.OrderId = order.Id;
            kot.OperationId = operationId;
            kot.BusinessDate = order.BusinessDate;
            if (string.IsNullOrWhiteSpace(kot.ProductionStation)) kot.ProductionStation = "KITCHEN";
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
            await RecordChargeAsync(
                order.FolioId,
                order.Total,
                $"POS Order #{order.OrderNumber}",
                userId,
                deviceId,
                $"POS_ORDER:{order.Id}:FOLIO_CHARGE",
                requireFrontdeskSession: false);
        }
        
        await _dbContext.SaveChangesAsync();
        return order;
    }

    public async Task<object> RequestItemModificationAsync(string payloadJson, string userId, string deviceId, string sessionId)
    {
        using var document = System.Text.Json.JsonDocument.Parse(payloadJson);
        var root = document.RootElement;

        var action = root.GetProperty("action").GetString(); // "VOID" or "REPLACE"
        var orderId = root.GetProperty("orderId").GetString();
        var originalOrderItemId = root.GetProperty("originalOrderItemId").GetString();
        var reason = root.TryGetProperty("reason", out var rsn) ? rsn.GetString() : "Customer changed mind";
        var inventoryAction = root.TryGetProperty("inventoryAction", out var inv) ? inv.GetString() : "RESTOCK";
        var managerPin = root.TryGetProperty("managerPin", out var pin) ? pin.GetString() : "";

        var order = await _dbContext.PosOrders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == orderId);
        if (order == null) throw new Exception("Order not found");

        var originalItem = order.Items.FirstOrDefault(i => i.Id == originalOrderItemId);
        if (originalItem == null) throw new Exception("Original item not found");

        var propertyId = order.PropertyId;
        var property = await _dbContext.Properties.FirstOrDefaultAsync(p => p.Id == propertyId);
        double autoApproveLimit = 1000;

        bool requiresApproval = action == "VOID"; // VOID defaults to true

        // For Voids, bypass approval if it's a BAR item
        if (action == "VOID")
        {
            var voidProduct = await _dbContext.PosProducts.FirstOrDefaultAsync(p => p.Id == originalItem.ProductId);
            if (voidProduct != null)
            {
                var voidCategory = await _dbContext.ProductCategories.FirstOrDefaultAsync(c => c.Id == voidProduct.CategoryId);
                var resolvedStation = voidProduct.ProductionStation ?? voidCategory?.ProductionStation ?? "KITCHEN";
                if (resolvedStation == "BAR")
                {
                    requiresApproval = false;
                }
            }
        }

        System.Text.Json.JsonElement replacementItemEl = default;
        decimal originalPrice = originalItem.UnitPrice * originalItem.Quantity;
        decimal replacementPrice = 0;

        if (action == "REPLACE")
        {
            replacementItemEl = root.GetProperty("replacementItem");
            replacementPrice = replacementItemEl.GetProperty("unitPrice").GetDecimal() * replacementItemEl.GetProperty("quantity").GetDecimal();
            var priceReduction = originalPrice - replacementPrice;

            if (replacementPrice == 0) requiresApproval = true; // Free replacement
            else if (priceReduction > (decimal)autoApproveLimit) requiresApproval = true;
        }

        string? approverId = null;
        if (requiresApproval)
        {
            if (string.IsNullOrEmpty(managerPin)) return new { requiresApproval = true };
            
            var allStaff = await _dbContext.Staff.Where(s => s.PropertyId == propertyId && s.PosPinHash != null).ToListAsync();
            var approver = allStaff.FirstOrDefault(s => BCrypt.Net.BCrypt.Verify(managerPin, s.PosPinHash));
            if (approver == null || (approver.Role != "MANAGER" && approver.Role != "ADMIN"))
                throw new Exception("Invalid manager PIN or insufficient permissions");
            approverId = approver.Id;
        }

        using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            var voidId = Guid.NewGuid().ToString();
            var operationId = Guid.NewGuid().ToString();

            // Process Inventory for the original item if it was RESTOCKED
            if (inventoryAction == "RESTOCK")
            {
                var product = await _dbContext.PosProducts.FirstOrDefaultAsync(p => p.Id == originalItem.ProductId);
                if (product != null && product.InventoryMode == "STOCK")
                {
                    var stockTx = new LocalStockTransaction
                    {
                        Id = Guid.NewGuid().ToString(),
                        PropertyId = propertyId,
                        StockItemId = originalItem.ProductId ?? "",
                        TransactionType = "ADJUSTMENT_ADD",
                        Quantity = originalItem.Quantity,
                        UnitCost = 0,
                        TotalValue = 0,
                        Source = "POS_VOID_RESTOCK",
                        ReferenceId = orderId,
                        OperationId = operationId,
                        UserId = userId,
                        Notes = "Restocked from Void",
                        BusinessDate = order.BusinessDate
                    };
                    _dbContext.StockTransactions.Add(stockTx);
                }
            }

            string? newOrderItemId = null;
            if (action == "REPLACE")
            {
                newOrderItemId = replacementItemEl.GetProperty("id").GetString();
                var newItem = new LocalPosOrderItem
                {
                    Id = newOrderItemId ?? Guid.NewGuid().ToString(),
                    OrderId = order.Id,
                    ProductId = replacementItemEl.GetProperty("productId").GetString(),
                    ProductName = replacementItemEl.GetProperty("productName").GetString() ?? "Unknown",
                    Quantity = replacementItemEl.GetProperty("quantity").GetDecimal(),
                    UnitPrice = replacementItemEl.GetProperty("unitPrice").GetDecimal(),
                    TaxRate = replacementItemEl.TryGetProperty("taxRate", out var taxEl) ? taxEl.GetDecimal() : 0,
                    TaxAmount = replacementItemEl.TryGetProperty("taxAmount", out var taxAmtEl) ? taxAmtEl.GetDecimal() : 0,
                    Total = replacementItemEl.GetProperty("unitPrice").GetDecimal() * replacementItemEl.GetProperty("quantity").GetDecimal(),
                    CreatedAt = DateTime.UtcNow,
                    Subtotal = replacementItemEl.GetProperty("unitPrice").GetDecimal() * replacementItemEl.GetProperty("quantity").GetDecimal(),
                    Discount = 0
                };
                _dbContext.PosOrderItems.Add(newItem);
            }

            var posVoid = new LocalPosVoid
            {
                Id = voidId,
                OrderId = order.Id,
                OrderItemId = originalItem.Id,
                ReplacedByItemId = newOrderItemId,
                Reason = reason,
                AuthorizerId = approverId,
                OperationId = operationId,
                BusinessDate = order.BusinessDate,
                DeviceId = deviceId,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.PosVoids.Add(posVoid);

            originalItem.VoidReason = reason;
            originalItem.Total = 0;
            originalItem.Subtotal = 0;
            originalItem.TaxAmount = 0;
            originalItem.UnitPrice = 0;
            
            // Recalculate Order Totals
            order.Subtotal = order.Items.Sum(i => i.Subtotal);
            order.TaxAmount = order.Items.Sum(i => i.TaxAmount);
            order.Total = order.Items.Sum(i => i.Total);
            order.UpdatedAt = DateTime.UtcNow;

            var evt = new LocalOutboxEvent
            {
                Id = operationId,
                PropertyId = propertyId,
                DeviceId = deviceId,
                OperatorId = userId,
                AggregateType = "POS_ORDER",
                AggregateId = order.Id,
                AggregateVersion = order.Version + 1,
                EventType = action == "REPLACE" ? "ITEM_REPLACED" : "ITEM_VOIDED",
                Sequence = 1,
                PayloadJson = System.Text.Json.JsonSerializer.Serialize(new {
                    action,
                    originalOrderItemId = originalItem.Id,
                    replacedByItemId = newOrderItemId,
                    reason,
                    inventoryAction,
                    approverId
                })
            };
            _dbContext.OutboxEvents.Add(evt);

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();
            return new { success = true, requiresApproval = false, order };
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            throw new Exception($"Failed to modify item: {ex.Message}", ex);
        }
    }

    public async Task<object> RequestDiscountAsync(string payloadJson, string userId, string deviceId, string sessionId)
    {
        using var document = JsonDocument.Parse(payloadJson);
        var root = document.RootElement;
        
        var targetType = root.TryGetProperty("targetType", out var tt) ? tt.GetString() : "POS_ORDER";
        var discountType = root.TryGetProperty("discountType", out var dt) ? dt.GetString() : "PERCENTAGE";
        var amount = root.TryGetProperty("discountAmount", out var amt) ? amt.GetDouble() : 0.0;
        var percentage = root.TryGetProperty("discountPercent", out var pct) ? pct.GetDouble() : (root.TryGetProperty("percentage", out var oldPct) ? oldPct.GetDouble() : 0.0);
        var reason = root.TryGetProperty("reason", out var rsn) ? rsn.GetString() : "";
        var managerPin = root.TryGetProperty("managerPin", out var pin) ? pin.GetString() : "";

        // Determine Property ID to fetch settings and staff
        string propertyId = "";
        if (targetType == "POS_ORDER" && root.TryGetProperty("orderId", out var orderIdProp)) {
            var order = await _dbContext.PosOrders.FirstOrDefaultAsync(o => o.Id == orderIdProp.GetString());
            if (order == null) throw new Exception("Order not found");
            propertyId = order.PropertyId;
        } else {
            var props = await _dbContext.Properties.ToListAsync();
            propertyId = props.FirstOrDefault()?.Id ?? "";
        }

        if (string.IsNullOrEmpty(propertyId)) throw new Exception("Property context not found");

        var property = await _dbContext.Properties.FirstOrDefaultAsync(p => p.Id == propertyId);
        double autoAmount = 0;
        double autoPercent = 0;
        bool requiresApproval = false;
        if (amount > autoAmount && autoAmount > 0) requiresApproval = true;
        if (percentage > autoPercent && autoPercent > 0) requiresApproval = true;

        string? approverId = null;
        if (requiresApproval)
        {
            if (string.IsNullOrEmpty(managerPin))
                return new { requiresApproval = true };

            var allStaff = await _dbContext.Staff.Where(s => s.PropertyId == propertyId && s.PosPinHash != null).ToListAsync();
            var approver = allStaff.FirstOrDefault(s => BCrypt.Net.BCrypt.Verify(managerPin, s.PosPinHash));
            if (approver == null || (approver.Role != "MANAGER" && approver.Role != "ADMIN"))
                throw new Exception("Invalid manager PIN or insufficient permissions");
            approverId = approver.Id;
        }

        using var transaction = await _dbContext.Database.BeginTransactionAsync();
        try
        {
            var approvalId = Guid.NewGuid().ToString();
            LocalOutboxEvent? evt = null;

            if (targetType == "RESERVATION_ROOM")
            {
                var resRoomId = root.GetProperty("reservationRoomId").GetString();
                var resRoom = await _dbContext.ReservationRooms.FirstOrDefaultAsync(r => r.Id == resRoomId);
                if (resRoom == null) throw new Exception("Reservation Room not found");

                resRoom.DiscountType = discountType;
                resRoom.DiscountAmount = (decimal)amount;
                resRoom.DiscountPercent = (decimal)percentage;
                resRoom.DiscountReason = reason;
                resRoom.DiscountApprovalId = approvalId;

                evt = new LocalOutboxEvent
                {
                    Id = approvalId,
                    PropertyId = propertyId,
                    DeviceId = deviceId,
                    OperatorId = userId,
                    AggregateType = "RESERVATION_ROOM",
                    AggregateId = resRoomId,
                    AggregateVersion = 1,
                    EventType = "DISCOUNT_APPLIED",
                    Sequence = 1,
                    PayloadJson = JsonSerializer.Serialize(new {
                        discountType, discountAmount = amount, discountPercent = percentage, reason, approverId
                    })
                };
            }
            else if (targetType == "FOLIO_ITEM")
            {
                var folioId = root.GetProperty("folioId").GetString();
                var targetFolioItemId = root.GetProperty("targetFolioItemId").GetString();
                var folio = await _dbContext.Folios.FirstOrDefaultAsync(f => f.Id == folioId);
                if (folio == null) throw new Exception("Folio not found");

                // Inject discount transaction directly into TransactionsJson
                var transactions = string.IsNullOrEmpty(folio.TransactionsJson) ? new List<JsonElement>() : JsonSerializer.Deserialize<List<JsonElement>>(folio.TransactionsJson) ?? new List<JsonElement>();
                
                var discountItem = new Dictionary<string, object>
                {
                    { "id", Guid.NewGuid().ToString() },
                    { "folioId", folio.Id },
                    { "businessDate", DateTime.UtcNow.ToString("yyyy-MM-dd") },
                    { "type", "DISCOUNT" },
                    { "source", "MANUAL" },
                    { "description", reason ?? "Discount Approved (Offline)" },
                    { "quantity", 1 },
                    { "unitAmount", -amount },
                    { "amount", -amount },
                    { "baseAmount", -amount },
                    { "postedBy", userId },
                    { "discountApprovalId", approvalId },
                    { "targetFolioItemId", targetFolioItemId }
                };

                transactions.Add(JsonSerializer.SerializeToElement(discountItem));
                folio.TransactionsJson = JsonSerializer.Serialize(transactions);
                
                folio.TotalCharges -= (decimal)amount;
                folio.IsDirty = true;
                folio.UpdatedAt = DateTime.UtcNow;

                evt = new LocalOutboxEvent
                {
                    Id = approvalId,
                    PropertyId = propertyId,
                    DeviceId = deviceId,
                    OperatorId = userId,
                    AggregateType = "FOLIO",
                    AggregateId = folio.Id,
                    AggregateVersion = folio.Version,
                    EventType = "FOLIO_DISCOUNT_APPLIED",
                    Sequence = folio.LocalSequence++,
                    PayloadJson = JsonSerializer.Serialize(discountItem)
                };
            }
            else // POS_ORDER
            {
                var orderId = root.GetProperty("orderId").GetString();
                var order = await _dbContext.PosOrders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == orderId);
                if (order == null) throw new Exception("Order not found");
                await AssertNightAuditAllowsAsync(order.PropertyId, order.BusinessDate);

                double subtotal = (double)order.Items.Sum(i => i.Quantity * i.UnitPrice);
                double effectiveDiscount = amount > 0 ? amount : subtotal * (percentage / 100);

                order.Discount = (decimal)effectiveDiscount;
                order.Total = (decimal)subtotal + order.TaxAmount + order.ServiceCharge - order.Discount;
                order.UpdatedAt = DateTime.UtcNow;

                evt = new LocalOutboxEvent
                {
                    Id = approvalId,
                    PropertyId = propertyId,
                    DeviceId = deviceId,
                    OperatorId = userId,
                    AggregateType = "POS_ORDER",
                    AggregateId = order.Id,
                    AggregateVersion = 1,
                    EventType = "DISCOUNT_APPLIED",
                    Sequence = 1,
                    PayloadJson = JsonSerializer.Serialize(new {
                        amount = effectiveDiscount, percentage, reason, approverId
                    })
                };
            }

            if (evt != null) _dbContext.OutboxEvents.Add(evt);
            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();

            return new { success = true, approvalId };
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            throw new Exception($"Failed to apply discount: {ex.Message}");
        }
    }

    public async Task<LocalPosOrder> UpdateOrderStatusAsync(string orderId, string status, string reason, string userId, string deviceId)
    {
        var order = await _dbContext.PosOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId);
        if (order == null) throw new Exception("Order not found");
        await AssertNightAuditAllowsAsync(order.PropertyId, order.BusinessDate);

        if ((status == "CANCELLED" || status == "VOIDED") && order.Status != "CANCELLED" && order.Status != "VOIDED")
        {
            await RestoreLocalSaleAsync(order, userId, deviceId, $"op_restore_{status.ToLowerInvariant()}_{order.Id}");
        }
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
            .Include(o => o.Checks)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) throw new Exception("Order not found");

        await AssertNightAuditAllowsAsync(order.PropertyId, order.BusinessDate);

        var itemsToFire = order.Items.Where(i => itemIds.Contains(i.Id)).ToList();
        if (!itemsToFire.Any()) throw new Exception("No valid items selected for KOT");

        var productIds = itemsToFire.Where(i => !string.IsNullOrWhiteSpace(i.ProductId)).Select(i => i.ProductId!).Distinct().ToList();
        var products = await _dbContext.PosProducts.Where(p => productIds.Contains(p.Id)).ToListAsync();
        var categoryIds = products.Select(p => p.CategoryId).Distinct().ToList();
        var categories = await _dbContext.ProductCategories.Where(c => categoryIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id);
        var productMap = products.ToDictionary(p => p.Id);
        string ResolveStation(LocalPosOrderItem item)
        {
            if (item.ProductId != null && productMap.TryGetValue(item.ProductId, out var product))
            {
                var station = product.ProductionStation;
                if (string.IsNullOrWhiteSpace(station) && categories.TryGetValue(product.CategoryId, out var category))
                    station = category.ProductionStation;
                if (!string.IsNullOrWhiteSpace(station)) return station.Trim().ToUpperInvariant();
            }
            return "KITCHEN";
        }
        var stations = itemsToFire.Select(ResolveStation).Distinct().ToList();
        if (stations.Count > 1)
            throw new InvalidOperationException("Select Kitchen or Bar items separately when firing a manual KOT.");
        var station = stations[0];
        if (station is not ("KITCHEN" or "BAR"))
            throw new InvalidOperationException("The selected items do not require a production ticket.");

        string operationId = $"op_kot_{deviceId}_{DateTime.UtcNow.Ticks}_{Guid.NewGuid().ToString("N").Substring(0, 8)}";
        
        var kot = new LocalPosKot
        {
            Id = Guid.NewGuid().ToString(),
            OrderId = orderId,
            OutletId = order.OutletId,
            DeviceId = deviceId,
            CreatedBy = userId,
            KotNumber = $"{order.OrderNumber}-{station}-{Guid.NewGuid().ToString("N").Substring(0, 4)}",
            Status = "PENDING",
            ProductionStation = station,
            PrintStatus = "QUEUED",
            OperationId = operationId,
            BusinessDate = order.BusinessDate,
            CreatedAt = DateTime.UtcNow,
            ItemIdsJson = JsonSerializer.Serialize(itemsToFire.Select(i => i.Id))
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
        
        if (order != null) await AssertNightAuditAllowsAsync(order.PropertyId);

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
        var products = await _dbContext.PosProducts
            .Where(p => p.PropertyId == propertyId && p.IsActive)
            .ToListAsync();
        var categoryIds = products.Select(p => p.CategoryId).Where(id => !string.IsNullOrWhiteSpace(id)).Distinct().ToList();
        var categories = await _dbContext.ProductCategories
            .Where(c => categoryIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id);

        foreach (var product in products)
        {
            product.ResolvedStation = (string.IsNullOrWhiteSpace(product.ProductionStation)
                    ? (categories.TryGetValue(product.CategoryId, out var category) ? category.ProductionStation : null)
                    : product.ProductionStation)
                ?.Trim().ToUpperInvariant() ?? "KITCHEN";

            if (!string.Equals(product.InventoryMode, "STOCK", StringComparison.OrdinalIgnoreCase))
            {
                product.StockStatus = "NON_STOCK";
                continue;
            }

            var ingredients = await _dbContext.RecipeIngredients
                .Where(i => i.ProductId == product.Id)
                .ToListAsync();
            product.HasInventoryMapping = ingredients.Count > 0;
            if (!product.HasInventoryMapping)
            {
                var directStock = await _dbContext.StockItems
                    .Where(s => s.PosProductId == product.Id && s.IsActive)
                    .OrderBy(s => s.Id)
                    .FirstOrDefaultAsync();
                product.HasInventoryMapping = directStock != null;
                if (directStock == null)
                {
                    product.StockStatus = "UNMAPPED";
                    product.AvailableStock = 0;
                    continue;
                }
                product.AvailableStock = Math.Max(0m, directStock.QuantityOnHand);
                product.StockStatus = directStock.QuantityOnHand <= 0m ? "OUT_OF_STOCK" : directStock.QuantityOnHand <= 5m ? "LOW_STOCK" : "IN_STOCK";
                continue;
            }

            var stockIds = ingredients.Select(i => i.StockItemId).Distinct().ToList();
            var stock = await _dbContext.StockItems
                .Where(s => stockIds.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id);
            var available = ingredients
                .GroupBy(i => i.StockItemId)
                .Select(group => stock.TryGetValue(group.Key, out var item)
                    ? item.QuantityOnHand / group.Sum(i => i.Quantity)
                    : 0m)
                .DefaultIfEmpty(0m)
                .Min();
            product.AvailableStock = Math.Max(0m, available);
            product.StockStatus = available <= 0m ? "OUT_OF_STOCK" :
                available <= 5m ? "LOW_STOCK" : "IN_STOCK";
        }

        return products;
    }

    public async Task<LocalPosSession> OpenPosSessionAsync(string propertyId, string outletId, string bankType, string bankingModel, decimal openingBalance, string userId, string deviceId)
    {
        await AssertNightAuditAllowsAsync(propertyId);
        // 1. Idempotency check: if there is already an active session for this specific context, return it.
        if (bankType == "SERVER")
        {
            var existingServerBank = await GetActiveServerBankAsync(userId, propertyId, outletId);
            if (existingServerBank != null) return existingServerBank;
        }
        else
        {
            var existingCentralBank = await GetActiveCentralBankAsync(propertyId, outletId);
            if (existingCentralBank != null) return existingCentralBank;
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
            .Where(o => o.SessionId == sessionId
                && o.Status != "CLOSED"
                && o.Status != "COMPLETED"
                && o.Status != "PAID"
                && o.Status != "VOIDED"
                && o.Status != "CANCELLED"
                && o.PaymentStatus != "PAID");

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
            var itemCount = o.Items?.Sum(i => i.Quantity) ?? 0m;
            var calculatedTotal = o.Items?.Sum(i => i.Total != 0m ? i.Total : i.UnitPrice * i.Quantity) ?? 0m;
            result.Add(new {
                id = o.Id,
                orderNumber = o.OrderNumber,
                orderType = o.OrderType,
                tableName = o.TableNumber,
                displayName = o.DisplayName,
                status = o.Status,
                paymentStatus = o.PaymentStatus,
                itemCount,
                total = o.Total != 0m ? o.Total : calculatedTotal,
                waiterName = !string.IsNullOrEmpty(o.ServerStaffId) && staffDict.ContainsKey(o.ServerStaffId) ? staffDict[o.ServerStaffId] : "Unknown",
                createdAt = o.CreatedAt == default ? o.UpdatedAt : o.CreatedAt
            });
        }
        
        return result;
    }

    public async Task<List<object>> GetWaiterTicketsAsync(string outletId, string staffId, string sessionId)
    {
        var query = _dbContext.PosKots
            .Where(k => k.OutletId == outletId
                && k.CreatedBy == staffId
                && k.ProductionStation == "KITCHEN");

        // Session ownership is authoritative. Date-only matching is unreliable
        // around timezone boundaries and when local/cloud records are merged.
        if (!string.IsNullOrWhiteSpace(sessionId))
        {
            query = query.Where(k => _dbContext.PosOrders.Any(o => o.Id == k.OrderId && o.SessionId == sessionId));
        }

        var kots = await query
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
                station = kot.ProductionStation,
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

    public async Task<(LocalPosOrder Order, List<LocalPosKot> Kots)> FireItemsAsync(string orderId, List<LocalPosOrderItem> itemsToFire, string userId, string deviceId)
    {
        var order = await _dbContext.PosOrders
            .Include(o => o.Items)
            .Include(o => o.Checks)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order == null) throw new Exception("Order not found");
        await AssertNightAuditAllowsAsync(order.PropertyId, order.BusinessDate);

        var newItems = new List<LocalPosOrderItem>();

        foreach (var item in itemsToFire)
        {
            item.Id = Guid.NewGuid().ToString();
            item.OrderId = order.Id;
            item.CheckId = order.Checks?.FirstOrDefault(c => c.Status == "OPEN")?.Id;
            item.KitchenStatus = "DIRECT";
            item.CreatedAt = DateTime.UtcNow;
            
            _dbContext.PosOrderItems.Add(item);
            newItems.Add(item);
            order.Items.Add(item);

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

        var productIds = newItems.Where(i => !string.IsNullOrWhiteSpace(i.ProductId)).Select(i => i.ProductId!).Distinct().ToList();
        var products = await _dbContext.PosProducts.Where(p => productIds.Contains(p.Id)).ToListAsync();
        var categoryIds = products.Select(p => p.CategoryId).Distinct().ToList();
        var categories = await _dbContext.ProductCategories.Where(c => categoryIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id);
        var productMap = products.ToDictionary(p => p.Id);

        string ResolveStation(LocalPosOrderItem item)
        {
            if (item.ProductId != null && productMap.TryGetValue(item.ProductId, out var product))
            {
                var station = product.ProductionStation;
                if (string.IsNullOrWhiteSpace(station) && categories.TryGetValue(product.CategoryId, out var category))
                    station = category.ProductionStation;
                if (!string.IsNullOrWhiteSpace(station)) return station.Trim().ToUpperInvariant();
            }
            return "KITCHEN";
        }

        var kots = new List<LocalPosKot>();
        foreach (var stationGroup in newItems.GroupBy(ResolveStation))
        {
            var station = stationGroup.Key;
            var firedAt = DateTime.UtcNow;
            if (station is not ("KITCHEN" or "BAR"))
            {
                foreach (var item in stationGroup)
                {
                    item.KitchenStatus = "DIRECT";
                    item.SentToKitchenAt = firedAt;
                }
                continue;
            }

            var kot = new LocalPosKot
            {
                Id = Guid.NewGuid().ToString(), OrderId = order.Id, OutletId = order.OutletId,
                DeviceId = deviceId, CreatedBy = userId, OrderNumber = order.OrderNumber,
                KotNumber = $"{order.OrderNumber}-{station}-{Guid.NewGuid().ToString("N").Substring(0, 4)}",
                TableNumber = order.TableNumber, ServerName = "Server", Status = "PENDING",
                ProductionStation = station, PrintStatus = "QUEUED",
                OperationId = $"op_fire_{deviceId}_{DateTime.UtcNow.Ticks}",
                BusinessDate = order.BusinessDate == default ? DateTime.UtcNow.Date : order.BusinessDate,
                FiredAt = firedAt, CreatedAt = firedAt,
                ItemIdsJson = JsonSerializer.Serialize(stationGroup.Select(i => i.Id))
            };
            foreach (var item in stationGroup)
            {
                item.KotId = kot.Id;
                item.KitchenStatus = "PENDING";
                item.SentToKitchenAt = firedAt;
            }
            _dbContext.PosKots.Add(kot);
            kots.Add(kot);
        }

        AppendSyncEvent("POS_ORDER", order.Id, "ORDER_ITEMS_ADDED", new { order, kots }, deviceId, order.OutletId, order.SessionId, userId);

        await _dbContext.SaveChangesAsync();
        return (order, kots);
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

    public async Task<LocalPosPayment> PayOrderAsync(string orderId, string method, decimal amount, string currency, string checkId, string userId, string deviceId, string? authorizerId = null)
    {
        var order = await _dbContext.PosOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId);

        if (order != null) await AssertNightAuditAllowsAsync(order.PropertyId);
        
        // Restore context state for the query so it matches the original shape
        order = await _dbContext.PosOrders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId);
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
                var checkPaymentAmounts = await _dbContext.PosPayments
                    .Where(p => p.CheckId == checkId)
                    .Select(p => p.Amount)
                    .ToListAsync();
                var checkPayments = checkPaymentAmounts.Sum();
                if (checkPayments + amount >= check.Total)
                {
                    check.Status = "PAID";
                    AppendSyncEvent("POS_CHECK", check.Id, "CHECK_PAID", new { status = "PAID" }, deviceId, order.OutletId, order.SessionId, userId);
                }
            }
        }

        var orderPaymentAmounts = await _dbContext.PosPayments
            .Where(p => p.OrderId == orderId)
            .Select(p => p.Amount)
            .ToListAsync();
        var orderPayments = orderPaymentAmounts.Sum();
        if (orderPayments + amount >= order.Total)
        {
            await CommitLocalSaleAsync(order, userId, deviceId, authorizerId);
            order.Status = "COMPLETED";
            order.PaymentStatus = "PAID";
            order.UpdatedAt = DateTime.UtcNow;
            AppendSyncEvent("POS_ORDER", order.Id, "ORDER_COMPLETED", new { status = "COMPLETED" }, deviceId, order.OutletId, order.SessionId, userId);
        }

        await _dbContext.SaveChangesAsync();
        return payment;
    }

    private async Task CommitLocalSaleAsync(LocalPosOrder order, string userId, string deviceId, string? authorizerId)
    {
        if (await _dbContext.StockTransactions.AnyAsync(t => t.ReferenceId == order.Id && t.Source == "SALE")) return;
        var productIds = order.Items.Where(i => !string.IsNullOrWhiteSpace(i.ProductId)).Select(i => i.ProductId!).Distinct().ToList();
        var stockProducts = await _dbContext.PosProducts.Where(p => productIds.Contains(p.Id) && p.InventoryMode == "STOCK").ToListAsync();
        var requirements = new Dictionary<string, decimal>();
        foreach (var product in stockProducts)
        {
            var quantity = order.Items.Where(i => i.ProductId == product.Id).Sum(i => i.Quantity);
            var ingredients = await _dbContext.RecipeIngredients.Where(i => i.ProductId == product.Id).ToListAsync();
            if (ingredients.Count == 0) throw new Exception($"Inventory mapping is missing for {product.Name}");
            foreach (var ingredient in ingredients)
                requirements[ingredient.StockItemId] = requirements.GetValueOrDefault(ingredient.StockItemId) + ingredient.Quantity * quantity;
        }
        foreach (var entry in requirements)
        {
            var stock = await _dbContext.StockItems.FindAsync(entry.Key);
            if (stock == null || !stock.IsActive) throw new Exception("Inventory item is unavailable");
            if (stock.QuantityOnHand < entry.Value && string.IsNullOrWhiteSpace(authorizerId))
                throw new Exception($"Insufficient stock for {stock.Name}. Manager approval is required to continue.");
            var before = stock.QuantityOnHand;
            stock.QuantityOnHand -= entry.Value;
            _dbContext.StockTransactions.Add(new LocalStockTransaction
            {
                Id = Guid.NewGuid().ToString(), PropertyId = order.PropertyId, StockItemId = stock.Id,
                TransactionType = "SALE", Source = "SALE", Quantity = -entry.Value, UnitCost = stock.CostPrice,
                TotalValue = -entry.Value * stock.CostPrice, ReferenceId = order.Id,
                OperationId = $"op_sale_{deviceId}_{order.Id}_{stock.Id}", UserId = userId,
                Notes = before < entry.Value ? $"NEGATIVE STOCK AUTHORIZED BY {authorizerId}" : null,
                BusinessDate = order.BusinessDate
            });
        }
    }

    private async Task RestoreLocalSaleAsync(LocalPosOrder order, string userId, string deviceId, string operationId)
    {
        var sales = await _dbContext.StockTransactions.Where(t => t.ReferenceId == order.Id && t.Source == "SALE").ToListAsync();
        foreach (var sale in sales)
        {
            var reversalId = $"{operationId}_{sale.StockItemId}";
            if (await _dbContext.StockTransactions.AnyAsync(t => t.OperationId == reversalId)) continue;
            var stock = await _dbContext.StockItems.FindAsync(sale.StockItemId);
            if (stock == null) continue;
            var quantity = Math.Abs(sale.Quantity);
            var before = stock.QuantityOnHand;
            stock.QuantityOnHand += quantity;
            _dbContext.StockTransactions.Add(new LocalStockTransaction
            {
                Id = Guid.NewGuid().ToString(), PropertyId = order.PropertyId, StockItemId = stock.Id,
                TransactionType = "RESTORE", Source = "POS_VOID", Quantity = quantity, UnitCost = stock.CostPrice,
                TotalValue = quantity * stock.CostPrice, ReferenceId = order.Id, OperationId = reversalId,
                UserId = userId, Notes = "Stock restored for cancelled or voided order", BusinessDate = order.BusinessDate
            });
        }
    }

    public async Task<LocalPosSettlement> SettleSessionAsync(string sessionId, decimal actualCash, string operatorId, string? authorizerId, string deviceId)
    {
        var session = await _dbContext.PosSessions.FindAsync(sessionId);
        if (session == null) throw new Exception("Session not found");
        await AssertNightAuditAllowsAsync(session.PropertyId, session.BusinessDate);
        if (session.Status == "CLOSED" || session.Status == "SETTLED") throw new Exception("Session is already closed or settled");

        var operatorStaff = await _dbContext.Staff.FirstOrDefaultAsync(staff => staff.Id == operatorId);
        var operatorRole = operatorStaff?.Role ?? string.Empty;
        var privileged = operatorRole.Contains("MANAGER", StringComparison.OrdinalIgnoreCase)
            || operatorRole.Contains("FINANCE", StringComparison.OrdinalIgnoreCase)
            || operatorRole.Contains("ADMIN", StringComparison.OrdinalIgnoreCase);
        if (!privileged && !string.Equals(session.UserId, operatorId, StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException("Only the POS cashier who opened this shift can close and submit it.");
        }

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
            OperationType = "POS_CASH_MOVEMENT",
            PayloadJson = JsonSerializer.Serialize(movement),
            UserId = operatorId,
            DeviceId = deviceId,
            SessionId = sessionId,
            OperatorId = operatorId,
            OutletId = session.OutletId,
            TerminalId = deviceId
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
                OperationType = "POS_CASH_MOVEMENT",
                PayloadJson = JsonSerializer.Serialize(varMovement),
                UserId = operatorId,
                DeviceId = deviceId,
                SessionId = sessionId,
                OperatorId = operatorId,
                OutletId = session.OutletId,
                TerminalId = deviceId
            });
        }

        session.Status = session.BankType == "SERVER" ? "RECONCILIATION_REQUIRED" : "CLOSED";
        session.ControlStatus = "SUBMITTED";
        session.VarianceStatus = settlement.Variance != 0 ? "OPEN" : null;
        session.SubmittedAt = session.ClosedAt;
        session.SubmittedBy = operatorId;
        session.ClosedAt = DateTime.UtcNow;
        session.UpdatedAt = session.ClosedAt.Value;
        session.Version++;

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_SETTLEMENT",
            EntityId = settlement.Id,
            OperationType = "POS_SETTLEMENT",
            PayloadJson = JsonSerializer.Serialize(settlement),
            UserId = operatorId,
            DeviceId = deviceId,
            SessionId = sessionId,
            OperatorId = operatorId,
            OutletId = session.OutletId,
            TerminalId = deviceId
        });

        // Also sync the session close
        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = $"op_session_close_{sessionId}_{DateTime.UtcNow.Ticks}",
            EntityType = "POS_SESSION",
            EntityId = session.Id,
            OperationType = "POS_SESSION_UPDATED",
            PayloadJson = JsonSerializer.Serialize(new { Status = session.Status, ControlStatus = session.ControlStatus, VarianceStatus = session.VarianceStatus, SubmittedAt = session.SubmittedAt, SubmittedBy = session.SubmittedBy, ClosedAt = session.ClosedAt }),
            UserId = operatorId,
            DeviceId = deviceId,
            SessionId = sessionId,
            OperatorId = operatorId,
            OutletId = session.OutletId,
            TerminalId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        SyncEngine.Instance?.TriggerManualSync();
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
            await AssertNightAuditAllowsAsync(session.PropertyId, session.BusinessDate);
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

            _dbContext.SyncEvents.Add(new LocalSyncEvent
            {
                OperationId = handoverMovement.OperationId,
                EntityType = "POS_CASH_MOVEMENT",
                EntityId = handoverMovement.Id,
                OperationType = "POS_CASH_MOVEMENT",
                PayloadJson = JsonSerializer.Serialize(handoverMovement),
                UserId = authorizer.Id,
                DeviceId = deviceId,
                SessionId = sessionId,
                OperatorId = authorizer.Id,
                OutletId = session.OutletId,
                TerminalId = deviceId
            });

            settlement.Status = "CLOSED";
            settlement.AuthorizerId = authorizer.Id;

            session.Status = "CLOSED";
            session.ControlStatus = "HANDED_OVER";
            session.HandoverAt = DateTime.UtcNow;
            
            _dbContext.SyncEvents.Add(new LocalSyncEvent
            {
                OperationId = $"op_handover_conf_{deviceId}_{DateTime.UtcNow.Ticks}",
                EntityType = "POS_SESSION",
                EntityId = session.Id,
                OperationType = "POS_SESSION_UPDATED",
                PayloadJson = JsonSerializer.Serialize(new { Status = "CLOSED", ControlStatus = session.ControlStatus, HandoverAt = session.HandoverAt }),
                UserId = authorizer.Id,
                DeviceId = deviceId,
                SessionId = sessionId,
                OperatorId = authorizer.Id,
                OutletId = session.OutletId,
                TerminalId = deviceId
            });

            _dbContext.SyncEvents.Add(new LocalSyncEvent
            {
                OperationId = $"op_settlement_conf_{deviceId}_{DateTime.UtcNow.Ticks}",
                EntityType = "POS_SETTLEMENT",
                EntityId = settlement.Id,
                OperationType = "POS_SETTLEMENT",
                PayloadJson = JsonSerializer.Serialize(new { Status = "CLOSED", AuthorizerId = authorizer.Id }),
                UserId = authorizer.Id,
                DeviceId = deviceId,
                SessionId = sessionId,
                OperatorId = authorizer.Id,
                OutletId = session.OutletId,
                TerminalId = deviceId
            });

            await _dbContext.SaveChangesAsync();
            await transaction.CommitAsync();
            SyncEngine.Instance?.TriggerManualSync();
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
            .Where(p => (p.Status == "COMPLETED" || p.Status == "CONFIRMED") && _dbContext.PosOrders.Any(o => o.Id == p.OrderId && o.SessionId == sessionId))
            .ToListAsync();

        decimal openingFloat = movements.Where(m => m.Type == "OPENING_FLOAT").Sum(m => m.Amount);
        
        // Sales breakdown
        decimal cashSales = payments.Where(p => p.Method == PosConstants.PaymentMethods.Cash).Sum(p => p.Amount);
        decimal cardSales = payments.Where(p => p.Method == PosConstants.PaymentMethods.Card || p.Method == "CARD_OFFLINE").Sum(p => p.Amount);
        decimal bankTransferSales = payments.Where(p => p.Method == PosConstants.PaymentMethods.BankTransfer).Sum(p => p.Amount);
        decimal roomChargeSales = payments.Where(p => p.Method == PosConstants.PaymentMethods.RoomCharge).Sum(p => p.Amount);
        decimal otherSales = payments.Where(p => p.Method != PosConstants.PaymentMethods.Cash && p.Method != PosConstants.PaymentMethods.Card && p.Method != "CARD_OFFLINE" && p.Method != PosConstants.PaymentMethods.BankTransfer && p.Method != PosConstants.PaymentMethods.RoomCharge).Sum(p => p.Amount);
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
        var order = await _dbContext.PosOrders.FindAsync(orderId);
        if (order != null) await AssertNightAuditAllowsAsync(order.PropertyId);

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
        SyncEngine.Instance?.TriggerManualSync();
        return posVoid;
    }

    public async Task<LocalPosPayment> RecordRefundAsync(string orderId, decimal amount, string method, string authorizerId, string userId, string deviceId)
    {
        var order = await _dbContext.PosOrders.FindAsync(orderId);
        if (order == null) throw new Exception("Order not found");
        await AssertNightAuditAllowsAsync(order.PropertyId, order.BusinessDate);
        string operationId = $"op_refund_{deviceId}_{DateTime.UtcNow.Ticks}";
        
        var payment = new LocalPosPayment
        {
            Id = Guid.NewGuid().ToString(),
            OrderId = orderId,
            Method = method,
            Status = "PENDING_APPROVAL",
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
            OperationType = "REFUND_REQUESTED",
            PayloadJson = JsonSerializer.Serialize(payment),
            UserId = userId,
            DeviceId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        SyncEngine.Instance?.TriggerManualSync();
        return payment;
    }

    public async Task<LocalPosCashMovement> RecordCashMovementAsync(string propertyId, string sessionId, decimal amount, string type, string reasonCode, string? notes, string? receiptReference, string? authorizedBy, string userId, string deviceId, string sourceAccountId = "", string destinationAccountId = "")
    {
        string operationId = $"op_cashmvt_{deviceId}_{DateTime.UtcNow.Ticks}";
        
        var prop = await _dbContext.Properties.FindAsync(propertyId);
        await AssertNightAuditAllowsAsync(propertyId);
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
            BusinessDate = prop?.BusinessDate.Date ?? DateTime.UtcNow.Date,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.PosCashMovements.Add(movement);

        _dbContext.SyncEvents.Add(new LocalSyncEvent
        {
            OperationId = operationId,
            EntityType = "POS_CASH_MOVEMENT",
            EntityId = movement.Id,
            OperationType = "POS_CASH_MOVEMENT",
            PayloadJson = JsonSerializer.Serialize(movement),
            UserId = userId,
            DeviceId = deviceId,
            SessionId = sessionId,
            OperatorId = userId,
            TerminalId = deviceId
        });

        await _dbContext.SaveChangesAsync();
        SyncEngine.Instance?.TriggerManualSync();
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
            
        var pendingCashAmount = (await _dbContext.PosSettlements
            .Where(s => pendingSessions.Contains(s.SessionId))
            .Select(s => s.ActualCash)
            .ToListAsync()).Sum();

        var today = DateTime.UtcNow.Date;
        
        var safeMovements = await _dbContext.PosCashMovements
            .Where(m => m.PropertyId == propertyId && (m.SourceAccountId == safeAccount.Id || m.DestinationAccountId == safeAccount.Id))
            .ToListAsync();
            
        decimal safeBalance = safeMovements.Where(m => m.DestinationAccountId == safeAccount.Id).Sum(m => m.Amount)
                            - safeMovements.Where(m => m.SourceAccountId == safeAccount.Id).Sum(m => m.Amount);

        decimal todayDeposits = safeMovements
            .Where(m => m.SourceAccountId == safeAccount.Id && m.Type == PosConstants.CashMovementTypes.BankDeposit && m.CreatedAt >= today)
            .Sum(m => m.Amount);

        decimal todayVariances = (await _dbContext.PosSettlements
            .Where(s => s.PropertyId == propertyId && s.SettledAt >= today)
            .Select(s => s.Variance)
            .ToListAsync()).Sum();

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
        await AssertNightAuditAllowsAsync(propertyId);
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
            BusinessDate = prop?.BusinessDate.Date ?? DateTime.UtcNow.Date,
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
        await AssertNightAuditAllowsAsync(propertyId);
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
            BusinessDate = prop?.BusinessDate.Date ?? DateTime.UtcNow.Date,
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
        SyncEngine.Instance?.TriggerManualSync();
        return audit;
    }

    public async Task<List<LocalStaff>> GetActiveStaffAsync(string propertyId, string? roleScope = null)
    {
        var staff = await _dbContext.Staff
            .Where(s => s.PropertyId == propertyId && s.IsActive && s.HasPosAccess)
            .ToListAsync();
        if (string.IsNullOrWhiteSpace(roleScope)) return staff;
        var roles = roleScope.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        return staff.Where(s => roles.Contains(s.Role)).ToList();
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
        SyncEngine.Instance?.TriggerManualSync();
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
        SyncEngine.Instance?.TriggerManualSync();
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
            .Where(k => k.OutletId == outletId
                && k.ProductionStation == station
                && (k.Status == "PENDING" || k.Status == "ACKNOWLEDGED"))
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
                station = k.ProductionStation,
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
            .Include(o => o.Payments)
            .Where(o => o.PropertyId == propertyId && o.ServerStaffId == staffId);

        if (!string.IsNullOrEmpty(sessionId))
        {
            query = query.Where(o => o.SessionId == sessionId);
        }

        if (statusFilter != "all" && !string.IsNullOrEmpty(statusFilter))
        {
            var statuses = statusFilter.ToLowerInvariant() switch
            {
                "open" => new[] { "SUBMITTED", "IN_SERVICE" },
                "paid" => new[] { "PAID", "COMPLETED", "CLOSED" },
                "voided" => new[] { "VOIDED", "CANCELLED" },
                _ => new[] { statusFilter.ToUpperInvariant() }
            };
            query = query.Where(o => statuses.Contains(o.Status));
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
            var itemCount = o.Items?.Sum(i => i.Quantity) ?? 0m;
            var calculatedTotal = o.Items?.Sum(i => i.Total != 0m ? i.Total : i.UnitPrice * i.Quantity) ?? 0m;

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
                payments = o.Payments.Select(p => new {
                    id = p.Id,
                    method = p.Method,
                    status = p.Status,
                    amount = p.Amount,
                    currency = p.Currency,
                    paidAt = p.PaidAt,
                    reference = p.Reference
                }).ToList(),
                displayName = o.DisplayName,
                total = o.Total != 0m ? o.Total : calculatedTotal,
                itemCount,
                createdAt = o.CreatedAt == default ? o.UpdatedAt : o.CreatedAt,
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
        
        var orders = await query.ToListAsync();
        var now = DateTime.UtcNow;
        var today = now.Date;
        orders = range switch
        {
            "today" => orders.Where(o => (o.BusinessDate != default ? o.BusinessDate : o.CreatedAt).Date == today).ToList(),
            "yesterday" => orders.Where(o => (o.BusinessDate != default ? o.BusinessDate : o.CreatedAt).Date == today.AddDays(-1)).ToList(),
            "this_week" => orders.Where(o => (o.BusinessDate != default ? o.BusinessDate : o.CreatedAt).Date >= today.AddDays(-(int)((7 + (now.DayOfWeek - DayOfWeek.Monday)) % 7))).ToList(),
            _ => orders
        };

        var payments = await _dbContext.PosPayments
            .Where(p => orders.Select(o => o.Id).Contains(p.OrderId) && p.Status == "CONFIRMED")
            .ToListAsync();

        var paidOrderIds = payments.Select(p => p.OrderId).Distinct().ToHashSet();
        var grossSales = payments
            .Where(p => orders.Any(o => o.Id == p.OrderId && o.Status != "VOIDED"))
            .Sum(p => p.Amount);
        
        return new
        {
            grossSales = grossSales,
            netSales = grossSales,
            ordersCount = paidOrderIds.Count,
            cashSales = payments.Where(p => string.Equals(p.Method, "CASH", StringComparison.OrdinalIgnoreCase)).Sum(p => p.Amount),
            cardSales = payments.Where(p => string.Equals(p.Method, "CARD", StringComparison.OrdinalIgnoreCase) || string.Equals(p.Method, "CARD_OFFLINE", StringComparison.OrdinalIgnoreCase)).Sum(p => p.Amount),
            roomChargeSales = payments.Where(p => string.Equals(p.Method, "ROOM_CHARGE", StringComparison.OrdinalIgnoreCase)).Sum(p => p.Amount),
            cityLedger = payments.Where(p => string.Equals(p.Method, "CITY_LEDGER", StringComparison.OrdinalIgnoreCase)).Sum(p => p.Amount)
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
            .Where(e => e.Status == "DEAD_LETTER" || e.Status == "RETRY_EXHAUSTED")
            .ToListAsync();
        var deadSyncEvents = await _dbContext.SyncEvents
            .Where(e => e.Status == "DEAD_LETTER")
            .ToListAsync();
            
        foreach (var evt in deadLetters)
        {
            evt.Status = "PENDING";
            evt.AttemptCount = 0;
            evt.NextAttemptAt = null;
            evt.LastError = null;
        }

        foreach (var evt in deadSyncEvents)
        {
            evt.Status = "PENDING";
            evt.AttemptCount = 0;
            evt.LastAttemptAt = null;
            evt.ErrorCode = null;
            evt.ErrorMessage = null;
        }
        
        await _dbContext.SaveChangesAsync();
        return deadLetters.Count + deadSyncEvents.Count;
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

        // Wake the background worker as soon as a POS event is queued. The
        // event is still persisted by the caller's SaveChangesAsync; if the
        // worker races that write, the retained semaphore signal causes an
        // immediate second queue check.
        SyncEngine.Instance?.TriggerManualSync();
    }

    public async Task<LodgeCore.Desktop.Data.Entities.LocalPosSession?> GetActiveServerBankAsync(string staffId, string propertyId, string outletId)
    {
        return await _dbContext.PosSessions
            .FirstOrDefaultAsync(s => s.PrimaryOperatorId == staffId && s.OutletId == outletId && s.Status == "OPEN" && s.BankType == "SERVER");
    }

    /// <summary>
    /// Returns the single shared central POS bank for a property/outlet.
    /// Central banking is not terminal-scoped; roaming servers must attach to
    /// this session while retaining their own operator identity on orders.
    /// </summary>
    public async Task<LodgeCore.Desktop.Data.Entities.LocalPosSession?> GetActiveCentralBankAsync(string propertyId, string outletId)
    {
        return await _dbContext.PosSessions
            .Where(s => s.PropertyId == propertyId
                && s.OutletId == outletId
                && s.Status == "OPEN"
                && s.BankType == "CENTRAL"
                && s.BankingModel == "CENTRAL_CASHIER")
            .OrderByDescending(s => s.OpenedAt)
            .FirstOrDefaultAsync();
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

    public async Task<object> GetLaundryOrdersAsync(string propertyId, string? status = null)
    {
        var query = _dbContext.LaundryOrders
            .Include(o => o.Items)
            .Where(o => o.PropertyId == propertyId);

        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(o => o.Status == status);
        }

        var orders = await query.OrderByDescending(o => o.CreatedAt).ToListAsync();

        var reservationIds = orders.Where(o => !string.IsNullOrEmpty(o.ReservationId)).Select(o => o.ReservationId!).Distinct().ToList();
        var guestIds = orders.Where(o => !string.IsNullOrEmpty(o.GuestId)).Select(o => o.GuestId).Distinct().ToList();
        var roomIds = orders.Where(o => !string.IsNullOrEmpty(o.RoomId)).Select(o => o.RoomId!).Distinct().ToList();
        var laundryItemIds = orders.SelectMany(o => o.Items).Select(item => item.ItemId).Where(id => !string.IsNullOrEmpty(id)).Distinct().ToList();

        var reservations = await _dbContext.Reservations.Where(r => reservationIds.Contains(r.Id)).ToListAsync();
        var resGuestIds = reservations.Select(r => r.GuestId).Where(id => !string.IsNullOrEmpty(id)).Select(id => id!).ToList();
        var allGuestIds = guestIds.Concat(resGuestIds).Distinct().ToList();
        var guests = await _dbContext.Guests.Where(g => allGuestIds.Contains(g.Id)).ToListAsync();
        var rooms = await _dbContext.Rooms.Where(r => roomIds.Contains(r.Id)).ToListAsync();
        var laundryItems = await _dbContext.LaundryItems.Where(item => laundryItemIds.Contains(item.Id)).ToListAsync();

        var result = orders.Select(o => {
            var res = reservations.FirstOrDefault(r => r.Id == o.ReservationId);
            var resGuest = res != null ? guests.FirstOrDefault(g => g.Id == res.GuestId) : null;
            var guest = guests.FirstOrDefault(g => g.Id == o.GuestId);
            var room = rooms.FirstOrDefault(r => r.Id == o.RoomId);

            return new {
                id = o.Id,
                propertyId = o.PropertyId,
                customerType = o.CustomerType,
                reservationId = o.ReservationId,
                roomId = o.RoomId,
                guestId = o.GuestId,
                folioItemId = o.FolioItemId,
                status = o.Status,
                serviceType = o.ServiceType,
                totalAmount = o.TotalAmount,
                currency = o.Currency,
                specialNotes = o.SpecialNotes,
                requestedAt = o.RequestedAt,
                expectedReadyAt = o.ExpectedReadyAt,
                collectedAt = o.CollectedAt,
                collectedBy = o.CollectedBy,
                readyAt = o.ReadyAt,
                deliveredAt = o.DeliveredAt,
                deliveredBy = o.DeliveredBy,
                version = o.Version,
                createdAt = o.CreatedAt,
                updatedAt = o.UpdatedAt,
                items = o.Items.Select(orderItem => {
                    var laundryItem = laundryItems.FirstOrDefault(item => item.Id == orderItem.ItemId);
                    return new {
                        id = orderItem.Id,
                        itemId = orderItem.ItemId,
                        quantity = orderItem.Quantity,
                        unitPrice = orderItem.UnitPrice,
                        totalPrice = orderItem.TotalPrice,
                        item = laundryItem != null ? new {
                            id = laundryItem.Id,
                            name = laundryItem.Name,
                            category = laundryItem.Category
                        } : null
                    };
                }).ToList(),
                reservation = res != null ? new {
                    id = res.Id,
                    primaryGuest = resGuest != null ? new {
                        firstName = resGuest.FirstName,
                        lastName = resGuest.LastName
                    } : null
                } : null,
                guest = guest != null ? new {
                    firstName = guest.FirstName,
                    lastName = guest.LastName
                } : null,
                room = room != null ? new {
                    id = room.Id,
                    number = room.Number
                } : null
            };
        }).ToList();

        return result;
    }

    public async Task<string> CreateLaundryOrderAsync(string dataJson, string userId, string deviceId)
    {
        using var json = JsonDocument.Parse(dataJson);
        var root = json.RootElement;
        
        var orderId = Guid.NewGuid().ToString();
        var propertyId = root.GetProperty("propertyId").GetString() ?? "";
        await AssertNightAuditAllowsAsync(propertyId);
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
        var requestedQuantities = new Dictionary<string, int>(StringComparer.Ordinal);
        
        if (root.TryGetProperty("items", out var itemsElem) && itemsElem.ValueKind == JsonValueKind.Array)
        {
            var itemsList = await _dbContext.LaundryItems.Where(i => i.PropertyId == propertyId).ToListAsync();
            foreach (var item in itemsElem.EnumerateArray())
            {
                var itemId = item.GetProperty("itemId").GetString() ?? "";
                var qty = item.GetProperty("quantity").GetInt32();
                if (!string.IsNullOrWhiteSpace(itemId) && qty > 0)
                {
                    requestedQuantities[itemId] = requestedQuantities.TryGetValue(itemId, out var existingQuantity)
                        ? existingQuantity + qty
                        : qty;
                }
            }

            foreach (var entry in requestedQuantities)
            {
                var catalogItem = itemsList.FirstOrDefault(i => i.Id == entry.Key);
                if (catalogItem == null) continue;

                var price = catalogItem.BasePrice;
                if (serviceType == "EXPRESS") price *= 1.5m;
                else if (serviceType == "DRY_CLEAN") price *= 2.0m;

                var lineTotal = price * entry.Value;
                total += lineTotal;

                orderItems.Add(new LocalLaundryOrderItem
                {
                    Id = Guid.NewGuid().ToString(),
                    LaundryOrderId = orderId,
                    ItemId = entry.Key,
                    Quantity = entry.Value,
                    UnitPrice = price,
                    TotalPrice = lineTotal
                });
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
        await AssertNightAuditAllowsAsync(order.PropertyId);
        
        var previousStatus = order.Status;
        if (previousStatus == status) return;

        var allowedTransitions = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["PENDING"] = ["COLLECTED", "CANCELLED"],
            ["COLLECTED"] = ["WASHING", "CANCELLED"],
            ["WASHING"] = ["READY", "CANCELLED"],
            ["READY"] = ["DELIVERED", "CANCELLED"],
            ["DELIVERED"] = [],
            ["CANCELLED"] = []
        };
        if (!allowedTransitions.TryGetValue(previousStatus, out var allowed) || !allowed.Contains(status, StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Cannot transition laundry order from {previousStatus} to {status}.");
        
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
        await AssertNightAuditAllowsAsync(order.PropertyId);
        
        if (order.Status == "DELIVERED") return;
        if (order.Status != "READY")
            throw new InvalidOperationException($"Cannot deliver laundry order while it is {order.Status}. Mark it READY first.");
        var frontdeskSession = await GetActiveFrontdeskSessionAsync(order.PropertyId, userId);
        if (frontdeskSession == null)
            throw new InvalidOperationException("Open your front desk cashier session before delivering laundry.");
        
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
                var creditApplicationAmount = Math.Min(folio.AvailableCredit, order.TotalAmount);
                folio.AvailableCredit -= creditApplicationAmount;
                ApplyCreditToTransactionsJson(folio, creditApplicationAmount);
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
                if (creditApplicationAmount > 0)
                {
                    UpdateFolioTransactionsJson(folio, "creditApplications", new
                    {
                        id = Guid.NewGuid().ToString(),
                        amount = creditApplicationAmount,
                        source = "LAUNDRY",
                        description = $"Applied guest credit to Laundry Service - {order.ServiceType}",
                        status = "PENDING_SYNC",
                        idempotencyKey = $"CREDIT_APPLICATION:{idempotencyKey}",
                        createdAt = DateTime.UtcNow
                    });
                }

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
                        businessDate = frontdeskSession.BusinessDate,
                        originalBusinessDate = frontdeskSession.BusinessDate,
                        idempotencyKey = idempotencyKey,
                        creditApplicationAmount,
                        creditApplicationKey = creditApplicationAmount > 0 ? $"CREDIT_APPLICATION:{idempotencyKey}" : null,
                        frontdeskSessionId = frontdeskSession.Id
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

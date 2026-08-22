with open('apps/desktop/LodgeCore.Desktop/OfflinePMSInterop.cs', 'r') as f:
    content = f.read()

# Add the catch block back
content = content.replace('''            var success = await _repo.ResolveMaintenanceTicketAsync(ticketId, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
        }

    public async Task<string> GetDashboardAsync(string propertyId)''', '''            var success = await _repo.ResolveMaintenanceTicketAsync(ticketId, ctx.UserId, ctx.DeviceId);
            return JsonSerializer.Serialize(new { success }, _jsonOptions);
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

            var mapped = new
            {
                id = r.Id,
                confirmationNumber = r.Id.Substring(0, 8).ToUpper(),
                status = r.Status,
                checkIn = r.CheckInDate,
                checkOut = r.CheckOutDate,
                primaryGuest = r.Guest != null ? new {
                    id = r.Guest.Id,
                    firstName = r.Guest.FirstName,
                    lastName = r.Guest.LastName,
                    email = r.Guest.Email,
                    phone = r.Guest.Phone
                } : null,
                reservationRooms = new[] {
                    new {
                        roomId = r.RoomId,
                        room = new {
                            number = r.RoomNumber ?? "Unassigned"
                        }
                    }
                },
                folios = new[] {
                    new {
                        id = r.Folio?.Id,
                        balance = r.Folio != null ? r.Folio.TotalCharges - r.Folio.TotalPayments : 0
                    }
                }
            };
            return JsonSerializer.Serialize(new { success = true, data = mapped }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }

    public async Task<string> GetDashboardAsync(string propertyId)''')

with open('apps/desktop/LodgeCore.Desktop/OfflinePMSInterop.cs', 'w') as f:
    f.write(content)

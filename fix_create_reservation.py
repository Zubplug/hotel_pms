with open('apps/desktop/LodgeCore.Desktop/OfflinePMSInterop.cs', 'r') as f:
    content = f.read()

old_create = """    public async Task<string> CreateReservationAsync(string dataJson)
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
    }"""

new_create = """    public async Task<string> CreateReservationAsync(string dataJson)
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
                    PropertyId = res.PropertyId,
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
            
            res.CheckInDate = DateTime.Parse(root.GetProperty("checkIn").GetString());
            res.CheckOutDate = DateTime.Parse(root.GetProperty("checkOut").GetString());
            res.Status = "PENDING";
            
            var created = await _repo.CreateReservationAsync(res, "System", "Device1");
            return JsonSerializer.Serialize(new { success = true, data = new { id = created.Id } }, _jsonOptions);
        }
        catch (Exception ex)
        {
            return JsonSerializer.Serialize(new { success = false, error = ex.Message }, _jsonOptions);
        }
    }"""

content = content.replace(old_create, new_create)

with open('apps/desktop/LodgeCore.Desktop/OfflinePMSInterop.cs', 'w') as f:
    f.write(content)

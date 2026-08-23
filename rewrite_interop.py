import re

with open('apps/desktop/LodgeCore.Desktop/OfflinePMSInterop.cs', 'r') as f:
    content = f.read()

# Replace PrintRegistrationCardAsync, PrintGuestFolioAsync, PrintPaymentReceiptAsync

new_methods = """    public async Task<string> PrintRegistrationCardAsync(string dataJson)
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
    }"""

# Use regex to find and replace the three methods
pattern = r"    public async Task<string> PrintRegistrationCardAsync\(string dataJson\).*?    public async Task<string> PrintKitchenTicketAsync"

replaced = re.sub(pattern, new_methods + "\n\n    public async Task<string> PrintKitchenTicketAsync", content, flags=re.DOTALL)

with open('apps/desktop/LodgeCore.Desktop/OfflinePMSInterop.cs', 'w') as f:
    f.write(replaced)

print("Rewrote Interop methods successfully.")

const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'apps/desktop/LodgeCore.Desktop/Services/LocalRepository.cs');
let content = fs.readFileSync(file, 'utf8');

const targetStr = `
                using var document = JsonDocument.Parse(folio.TransactionsJson);
                if (!document.RootElement.TryGetProperty("items", out var items) || items.ValueKind != JsonValueKind.Array) continue;
`;

const replaceStr = `
                using var document = JsonDocument.Parse(folio.TransactionsJson);
                
                var reservation = folio.Reservation;
                var guestName = reservation?.Guest == null ? null : $"{reservation.Guest.FirstName} {reservation.Guest.LastName}".Trim();
                var rooms = reservation?.Rooms.Select(room => room.Room?.DisplayName ?? room.Room?.Number).Where(number => !string.IsNullOrWhiteSpace(number)).ToArray() ?? Array.Empty<string>();

                Action<JsonElement, string, string> processArray = (arrayElement, defaultType, defaultKind) =>
                {
                    foreach (var item in arrayElement.EnumerateArray())
                    {
                        var createdAt = item.TryGetProperty("createdAt", out var createdAtElement) && DateTime.TryParse(createdAtElement.GetString(), out var parsedCreatedAt) ? parsedCreatedAt : folio.UpdatedAt;
                        if (createdAt < startDate || createdAt > endDate) continue;
                        var amount = ReadDecimal(item, "amount");
                        if (amount == 0) continue;
                        
                        var type = item.TryGetProperty("type", out var itemType) ? itemType.GetString() : defaultType;
                        // Skip items that are payments, since we process the actual "payments" and "credits" arrays separately.
                        if (defaultKind == "FOLIO_ITEM" && type == "PAYMENT") continue;

                        rows.Add(new Dictionary<string, object?>
                        {
                            ["id"] = item.TryGetProperty("id", out var itemId) ? itemId.GetString() : Guid.NewGuid().ToString(),
                            ["kind"] = defaultKind,
                            ["date"] = createdAt,
                            ["direction"] = (defaultKind == "PAYMENT" || defaultKind == "CREDIT") ? "INFLOW" : (amount >= 0 ? "INFLOW" : "OUTFLOW"),
                            ["amount"] = Math.Abs(amount),
                            ["currency"] = folio.Currency ?? "NGN",
                            ["method"] = item.TryGetProperty("method", out var methodVal) ? methodVal.GetString() ?? "FOLIO" : "FOLIO",
                            ["type"] = type,
                            ["description"] = item.TryGetProperty("description", out var description) ? description.GetString() : (item.TryGetProperty("notes", out var notes) ? notes.GetString() : "Folio transaction"),
                            ["reference"] = item.TryGetProperty("idempotencyKey", out var key) ? key.GetString() : null,
                            ["shiftReference"] = "",
                            ["folioNumber"] = folio.Id,
                            ["confirmationNumber"] = reservation?.ConfirmationNumber,
                            ["guest"] = guestName,
                            ["rooms"] = rooms,
                        });
                    }
                };

                if (document.RootElement.TryGetProperty("items", out var itemsArray) && itemsArray.ValueKind == JsonValueKind.Array)
                {
                    processArray(itemsArray, "CHARGE", "FOLIO_ITEM");
                }
                if (document.RootElement.TryGetProperty("payments", out var paymentsArray) && paymentsArray.ValueKind == JsonValueKind.Array)
                {
                    processArray(paymentsArray, "PAYMENT", "PAYMENT");
                }
                if (document.RootElement.TryGetProperty("credits", out var creditsArray) && creditsArray.ValueKind == JsonValueKind.Array)
                {
                    processArray(creditsArray, "CREDIT_ADJUSTMENT", "CREDIT");
                }
`;

// Replace from 'using var document' to the end of the try block.
const startIndex = content.indexOf('using var document = JsonDocument.Parse(folio.TransactionsJson);');
const catchIndex = content.indexOf('catch (JsonException)', startIndex);

const before = content.substring(0, startIndex);
const after = content.substring(catchIndex);

fs.writeFileSync(file, before + replaceStr.trim() + '\n            }\n            ' + after);
console.log('Patched');

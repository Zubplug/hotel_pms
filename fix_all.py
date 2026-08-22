import re

# 1. Update DesktopDataProvider.ts
with open('apps/web/src/lib/desktop/DesktopDataProvider.ts', 'r') as f:
    content = f.read()

content = content.replace(
    'return OnlineDataProvider.rooms.getAvailable(propertyId, roomTypeId, checkIn, checkOut);',
    'return invokeDesktop("rooms.getAvailable", { propertyId, roomTypeId, checkIn, checkOut });'
)

content = content.replace(
    'return OnlineDataProvider.reservations.create(data);',
    'return invokeDesktop("reservations.create", { data: JSON.stringify(data) });'
)

with open('apps/web/src/lib/desktop/DesktopDataProvider.ts', 'w') as f:
    f.write(content)


# 2. Update OfflinePMSInterop.cs
with open('apps/desktop/LodgeCore.Desktop/OfflinePMSInterop.cs', 'r') as f:
    content = f.read()

content = content.replace(
    'status = r.Status,',
    'status = r.Status,\n                propertyId = r.PropertyId,'
)

content = content.replace(
    'var data = await _repo.GetRoomTypesAsync(propertyId);',
    'var data = (await _repo.GetRoomTypesAsync(propertyId)).Select(rt => new { id = rt.Id, name = rt.Name, description = rt.Description, baseRate = rt.BasePrice, maxOccupancy = rt.MaxOccupancy, totalRooms = rt.TotalRooms });'
)

with open('apps/desktop/LodgeCore.Desktop/OfflinePMSInterop.cs', 'w') as f:
    f.write(content)

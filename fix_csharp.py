import re
import glob
import os

files = [
    "apps/desktop/LodgeCore.Desktop/HardwareInterop.cs",
    "apps/desktop/LodgeCore.Desktop/OfflinePMSInterop.cs",
    "apps/desktop/LodgeCore.Desktop/Services/LocalRepository.cs"
]

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to replace properties accessed on reservation variables (e.g., reservation, res, localReservation, r, etc.)
    # Instead of blindly replacing .RoomId, we'll replace specifically for LocalReservation usages in these files.
    # Looking at typical code: reservation.RoomId -> reservation.Rooms.FirstOrDefault()?.RoomId
    # Or in LINQ: r.RoomId -> r.Rooms.FirstOrDefault()?.RoomId
    
    content = re.sub(r'(\b\w+)\.RoomId\b', r'\1.Rooms.FirstOrDefault()?.RoomId', content)
    content = re.sub(r'(\b\w+)\.RoomNumber\b', r'\1.Rooms.FirstOrDefault()?.RoomNumber', content)
    content = re.sub(r'(\b\w+)\.RoomTypeId\b', r'\1.Rooms.FirstOrDefault()?.RoomTypeId', content)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

print("C# files patched.")

import re

# Fix MainPage.xaml.cs
with open('apps/desktop/LodgeCore.Desktop/MainPage.xaml.cs', 'r') as f:
    content = f.read()

content = content.replace('string id = request["id"]?.ToString();', 'string? id = request["id"]?.ToString();')
content = content.replace('string method = request["method"]?.ToString();', 'string? method = request["method"]?.ToString();')
content = content.replace('string responseData = null;', 'string? responseData = null;')

# Replace parameters?["xxx"]?.ToString() with parameters?["xxx"]?.ToString() ?? ""
content = re.sub(r'(parameters\?\["[^"]+"\]\?\.ToString\(\))(?!\s*\?\?)', r'\1 ?? ""', content)

with open('apps/desktop/LodgeCore.Desktop/MainPage.xaml.cs', 'w') as f:
    f.write(content)

# Fix OfflinePMSInterop.cs
with open('apps/desktop/LodgeCore.Desktop/OfflinePMSInterop.cs', 'r') as f:
    content = f.read()

content = content.replace('var email = staff?.Email;', 'var email = string.Empty;')
content = content.replace('data = (object)null', 'data = (object?)null')
content = content.replace('var safeStaff = staff.Select', 'var safeStaff = (staff ?? new List<LodgeCore.Desktop.Data.Entities.LocalStaff>()).Select')

with open('apps/desktop/LodgeCore.Desktop/OfflinePMSInterop.cs', 'w') as f:
    f.write(content)

print("Done")

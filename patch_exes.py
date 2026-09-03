import sys, glob

def patch_file(filepath):
    target = 'C:\\Lock_Rec_'.encode('utf-16le')
    replacement = '.\\Lock_Rec_\0'.encode('utf-16le')
    
    assert len(target) == len(replacement), f"Lengths do not match: {len(target)} vs {len(replacement)}"
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    if target in data:
        print(f"Patching {filepath}")
        new_data = data.replace(target, replacement)
        with open(filepath, 'wb') as f:
            f.write(new_data)
    else:
        print(f"Target string not found in {filepath}")

for file in glob.glob("hardware-agent/src/LodgeCore.HardwareAgent/Locks/Rfv2016SdkFiles/W-R-Card/*.exe"):
    patch_file(file)

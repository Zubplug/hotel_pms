import sys, glob

def patch_file(filepath):
    # We are replacing the previous patch ".\Lck_Record" with a completely safe relative path "Lock_Record_"
    target = '.\\Lck_Record'.encode('utf-16le')
    replacement = 'Lock_Record_'.encode('utf-16le')
    
    assert len(target) == len(replacement), f"Lengths do not match: {len(target)} vs {len(replacement)}"
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    if target in data:
        print(f"Applying NO-DOT patch in {filepath}")
        new_data = data.replace(target, replacement)
        with open(filepath, 'wb') as f:
            f.write(new_data)
    else:
        print(f"Target string not found in {filepath} (maybe it already has Lock_Record_?)")

for file in glob.glob("hardware-agent/src/LodgeCore.HardwareAgent/Locks/Rfv2016SdkFiles/W-R-Card/*.exe"):
    patch_file(file)

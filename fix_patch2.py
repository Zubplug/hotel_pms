import sys, glob

def patch_file(filepath):
    # We are replacing the previous patch ".\Lock_Rec_\" with a completely clean 12-char name ".\Lck_Record"
    target = '.\\Lock_Rec_\\'.encode('utf-16le')
    replacement = '.\\Lck_Record'.encode('utf-16le')
    
    assert len(target) == len(replacement), f"Lengths do not match: {len(target)} vs {len(replacement)}"
    
    with open(filepath, 'rb') as f:
        data = f.read()
    
    if target in data:
        print(f"Applying final clean patch in {filepath}")
        new_data = data.replace(target, replacement)
        with open(filepath, 'wb') as f:
            f.write(new_data)
    else:
        print(f"Target string not found in {filepath} (maybe it already has Lck_Record?)")

for file in glob.glob("hardware-agent/src/LodgeCore.HardwareAgent/Locks/Rfv2016SdkFiles/W-R-Card/*.exe"):
    patch_file(file)

import sys, re, glob
for file in glob.glob("hardware-agent/src/LodgeCore.HardwareAgent/Locks/Rfv2016SdkFiles/W-R-Card/*.exe"):
    with open(file, 'rb') as f:
        data = f.read()
    if b'.\x00\\\x00L\x00o\x00c\x00k\x00_\x00R\x00e\x00c\x00_\x00\x00\x00' in data:
        print(f"Found null-padded string in {file}")

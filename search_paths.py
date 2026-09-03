import sys, re, glob
for file in glob.glob("hardware-agent/src/LodgeCore.HardwareAgent/Locks/Rfv2016SdkFiles/W-R-Card/*.exe"):
    print("=== " + file + " ===")
    with open(file, 'rb') as f: data = f.read()
    for match in re.finditer(b'([ -~]{4,})', data):
        s = match.group(1).decode('ascii', 'ignore')
        if 'C:\\' in s.upper() or 'D:\\' in s.upper(): print("ASCII:", s)
    for match in re.finditer(b'(([ -~]\x00){4,})', data):
        s = match.group(1).decode('utf-16le', 'ignore')
        if 'C:\\' in s.upper() or 'D:\\' in s.upper(): print("UTF-16:", s)

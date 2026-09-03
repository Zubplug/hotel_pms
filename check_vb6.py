import sys
with open("/tmp/rfv2016_sdk/SDK Interface demo for rfv2016 En usb/Interface files/W-R-Card/ReadCardID.exe", "rb") as f:
    data = f.read()

if b"VB5!" in data:
    print("It is a VB5/6 executable.")
    # In VB6, the signature for P-Code vs Native can be tricky, but we can look for specific Native Code compiler strings
    if b"C2.EXE" in data or b"VBA6.DLL" in data:
        print("Likely Native Code.")
    else:
        print("Might be P-Code.")

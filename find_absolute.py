import re
with open("/tmp/rfv2016_sdk/SDK Interface demo for rfv2016 En usb/Interface files/W-R-Card/ReadCardID.exe", "rb") as f:
    data = f.read()

ascii_strings = re.findall(b'[ -~]{4,}', data)
utf16_strings = re.findall(b'(?:[\x20-\x7E]\x00){4,}', data)

for s in ascii_strings:
    try:
        res = s.decode('ascii')
        if ':\\' in res: print("ASCII:", res)
    except: pass

for s in utf16_strings:
    try:
        res = s.decode('utf-16le')
        if ':\\' in res: print("UTF-16:", res)
    except: pass

import os, glob, re

def extract_strings(filepath):
    with open(filepath, 'rb') as f:
        data = f.read()
    
    ascii_strings = re.findall(b'[ -~]{4,}', data)
    utf16_strings = re.findall(b'(?:[\x20-\x7E]\x00){4,}', data)
    
    results = []
    for s in ascii_strings:
        try:
            res = s.decode('ascii')
            if '\\' in res or '/' in res or '.txt' in res or '.ini' in res:
                results.append(res)
        except: pass
        
    for s in utf16_strings:
        try:
            res = s.decode('utf-16le')
            if '\\' in res or '/' in res or '.txt' in res or '.ini' in res:
                results.append(res)
        except: pass
        
    return list(set(results))

with open('all_strings.txt', 'w') as out:
    for exe in glob.glob('hardware-agent/src/LodgeCore.HardwareAgent/Locks/Rfv2016SdkFiles/W-R-Card/*.exe'):
        out.write(f"\n=== {os.path.basename(exe)} ===\n")
        for s in extract_strings(exe):
            out.write(s + "\n")

import sys, re, glob, os

def find_hardcoded_paths(directory):
    files = []
    for ext in ["*.exe", "*.dll", "*.ini", "*.ocx"]:
        files.extend(glob.glob(os.path.join(directory, "**", ext), recursive=True))
    
    for file in files:
        with open(file, 'rb') as f:
            data = f.read()
        
        found = set()
        
        # ASCII
        for match in re.finditer(b'([ -~]{4,})', data):
            s = match.group(1).decode('ascii', 'ignore')
            # Look for C:\ paths, or things containing Lock_Rec_ / Netdata
            if re.search(r'[A-Za-z]:\\[^ ]+', s):
                found.add("ASCII: " + s)
                
        # UTF-16
        for match in re.finditer(b'(([ -~]\x00){4,})', data):
            s = match.group(1).decode('utf-16le', 'ignore')
            if re.search(r'[A-Za-z]:\\[^ ]+', s):
                found.add("UTF-16: " + s)
                
        if found:
            print(f"=== {file} ===")
            for item in sorted(found):
                print(item)

find_hardcoded_paths("hardware-agent/src/LodgeCore.HardwareAgent/Locks/Rfv2016SdkFiles")

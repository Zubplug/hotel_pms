import os
import re

directory = 'apps/web/src'
for root, dirs, files in os.walk(directory):
    for filename in files:
        if filename.endswith(('.ts', '.tsx')):
            filepath = os.path.join(root, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Find any un-parenthesized arrow function parameters with : any
            # e.g. `ur: any =>` or ` rp: any =>`
            # Note: it might not just be `=>`, it could be ` ur: any =>`
            new_content = re.sub(r'(?<!\()(\b\w+):\s*any\s*=>', r'(\1: any) =>', content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Fixed {filepath}")

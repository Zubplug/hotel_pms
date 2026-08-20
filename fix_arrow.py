import os
import re

directory = 'apps/web/src'
for root, dirs, files in os.walk(directory):
    for filename in files:
        if filename.endswith(('.ts', '.tsx')):
            filepath = os.path.join(root, filename)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # The issue is we have something like `flatMap(ur: any =>`
            # or `filter(i: any =>`
            # So there IS an open parenthesis before the word!
            # It looks like: `(ur: any =>`
            # And it needs to become `((ur: any) =>`
            
            # Let's match `(\w+):\s*any\s*=>` without matching `\((\w+):\s*any\)\s*=>`
            # Basically, if there's no closing parenthesis `)` before `=>`
            
            new_content = re.sub(r'(\b\w+):\s*any\s*=>', r'(\1: any) =>', content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Fixed {filepath}")

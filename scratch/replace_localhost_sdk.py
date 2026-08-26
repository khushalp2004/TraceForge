import os
import re

packages_dir = '/Users/khushalpatil/Desktop/usetraceforge.com/packages'

for root, dirs, files in os.walk(packages_dir):
    # skip node_modules, dist, etc
    if 'node_modules' in dirs:
        dirs.remove('node_modules')
    if 'dist' in dirs:
        dirs.remove('dist')
    if '.git' in dirs:
        dirs.remove('.git')
        
    for file in files:
        if file.endswith(('.ts', '.tsx', '.php', '.java', '.rb', '.py', '.md', '.go', '.rs')):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                
            # Replace localhost URLs
            # http://localhost:3001/ingest -> https://usetraceforge.com/ingest
            # http://localhost:80/ingest -> https://usetraceforge.com/ingest
            new_content = re.sub(r'http://localhost:3001/ingest', 'https://usetraceforge.com/ingest', content)
            new_content = re.sub(r'http://localhost:80/ingest', 'https://usetraceforge.com/ingest', new_content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Updated {filepath}")


import re
import glob

files = [
    "apps/frontend/app/dashboard/issues/page.tsx",
    "apps/frontend/app/dashboard/alerts/page.tsx",
    "apps/frontend/app/dashboard/releases/page.tsx"
]

for file in files:
    try:
        with open(file, 'r') as f:
            content = f.read()
            
        content = re.sub(r'rounded-(xl|lg|md|2xl|3xl)', 'rounded-sm', content)
        
        with open(file, 'w') as f:
            f.write(content)
            
        print(f"Replaced radii in {file}")
    except Exception as e:
        print(f"Error processing {file}: {e}")


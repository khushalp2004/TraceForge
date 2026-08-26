import os
import re

packages_dir = '/Users/khushalpatil/Desktop/usetraceforge.com/packages'

# Helper to bump patch version in string like "1.0.2" -> "1.0.3"
def bump_version_string(match):
    prefix = match.group(1)
    major = match.group(2)
    minor = match.group(3)
    patch = int(match.group(4))
    suffix = match.group(5)
    return f'{prefix}{major}.{minor}.{patch + 1}{suffix}'

files_to_bump = [
    ('sdk/package.json', r'("version":\s*")(\d+)\.(\d+)\.(\d+)(")'),
    ('cli/package.json', r'("version":\s*")(\d+)\.(\d+)\.(\d+)(")'),
    ('sdk-python/setup.py', r'(version=\s*[\'"])(\d+)\.(\d+)\.(\d+)([\'"])'),
    ('sdk-rust/Cargo.toml', r'(version\s*=\s*")(\d+)\.(\d+)\.(\d+)(")'),
    ('sdk-ruby/traceforge.gemspec', r'(spec\.version\s*=\s*[\'"])(\d+)\.(\d+)\.(\d+)([\'"])'),
    ('sdk-php/composer.json', r'("version":\s*")(\d+)\.(\d+)\.(\d+)(")'),
    ('sdk-java/pom.xml', r'(<version>)(\d+)\.(\d+)\.(\d+)(</version>)'),
]

for rel_path, pattern in files_to_bump:
    filepath = os.path.join(packages_dir, rel_path)
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            content = f.read()
            
        new_content, num_subs = re.subn(pattern, bump_version_string, content, count=1)
        
        if num_subs > 0:
            with open(filepath, 'w') as f:
                f.write(new_content)
            print(f"Bumped version in {rel_path}")
        else:
            print(f"Could not find version pattern in {rel_path}")
    else:
        print(f"File not found: {rel_path}")


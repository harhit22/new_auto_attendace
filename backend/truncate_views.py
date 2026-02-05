
import os

path = os.path.join('apps', 'attendance', 'views.py')

try:
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    print(f"Original line count: {len(lines)}")
    
    # Keep lines up to 1666
    clean_lines = lines[:1666]
    
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(clean_lines)
        
    print(f"Truncated to {len(clean_lines)} lines.")
        
except Exception as e:
    print(f"Error truncating file: {e}")

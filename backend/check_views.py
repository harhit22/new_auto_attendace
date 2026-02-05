
import os

path = os.path.join('apps', 'attendance', 'views.py')

try:
    with open(path, 'rb') as f:
        data = f.read()
        if b'\x00' in data:
            print(f"[CORRUPTED] {path} contains null bytes!")
            print(f"Total bytes: {len(data)}")
            print(f"First null byte at index: {data.find(b'\x00')}")
            
            # Try to read meaningful content
            try:
                good_data = data.replace(b'\x00', b'').decode('utf-8')
                print("Content preview after cleaning:")
                print(good_data[:500])
            except:
                print("Could not decode content even after removing nulls")
        else:
            print(f"[OK] {path} is clean.")
except Exception as e:
    print(f"Error reading {path}: {e}")

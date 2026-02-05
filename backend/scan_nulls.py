import os

def check_null_bytes(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(".py"):
                path = os.path.join(root, file)
                try:
                    with open(path, 'rb') as f:
                        data = f.read()
                        if b'\x00' in data:
                            print(f"[CORRUPTED] {path} contains null bytes!")
                        else:
                            # print(f"[OK] {path}")
                            pass
                except Exception as e:
                    print(f"Could not read {path}: {e}")

print("Scanning for null bytes...")
check_null_bytes("apps/attendance")
print("Scan complete.")

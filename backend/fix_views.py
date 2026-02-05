
import os

path = os.path.join('apps', 'attendance', 'views.py')
backup_path = path + '.bak'

try:
    with open(path, 'rb') as f:
        data = f.read()
    
    if b'\x00' in data:
        print(f"Found null bytes! Total size: {len(data)}")
        
        # Create backup
        with open(backup_path, 'wb') as f:
            f.write(data)
        print(f"Backup created at {backup_path}")
        
        # Clean data
        clean_data = data.replace(b'\x00', b'')
        
        # Write back
        with open(path, 'wb') as f:
            f.write(clean_data)
            
        print(f"File cleaned. New size: {len(clean_data)}")
        print(f"Removed {len(data) - len(clean_data)} null bytes.")
        
    else:
        print("File was already clean.")
        
except Exception as e:
    print(f"Error fixing file: {e}")

filename = 'backend/apps/users/models.py'
with open(filename, 'r') as f:
    for i, line in enumerate(f):
        print(f"{i+1}: {line.rstrip()}")
        if i > 25: break

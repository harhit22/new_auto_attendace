"""Script to create the database."""
import pymysql

# Create the database
connection = pymysql.connect(
    host='localhost',
    user='root',
    password='mansi@123',
    charset='utf8mb4'
)

try:
    with connection.cursor() as cursor:
        cursor.execute("CREATE DATABASE IF NOT EXISTS attendance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        print("Database 'attendance_db' created successfully!")
except Exception as e:
    print(f"Error: {e}")
finally:
    connection.close()

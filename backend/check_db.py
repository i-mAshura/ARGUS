import sqlite3
conn = sqlite3.connect(r'c:\Users\Vishaal\Desktop\SpyderXDR-updated\backend\data\spyderxdr.db')
cursor = conn.cursor()

# Count events by type
cursor.execute("SELECT event_type, COUNT(*) FROM events GROUP BY event_type ORDER BY COUNT(*) DESC")
print("Events by type:")
for row in cursor.fetchall():
    print(f"  {row[0]}: {row[1]}")

# Get latest performance metrics
print("\nLatest Performance Metrics:")
cursor.execute("SELECT timestamp, event_data FROM events WHERE event_type='performance_metric' ORDER BY timestamp DESC LIMIT 3")
for row in cursor.fetchall():
    print(f"  {row[0]}: {row[1]}")

conn.close()

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load environment variables from backend/.env
load_dotenv()

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("Error: DATABASE_URL not found in environment!")
    exit(1)

# Ensure SSL mode is enabled for RDS connections
if "sslmode" not in db_url:
    db_url += "?sslmode=require"

print(f"Connecting to database: {db_url.split('@')[-1]}")

try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT id, filename, status, thumb_key, created_at FROM assets ORDER BY created_at DESC"))
        rows = result.fetchall()
        
        print("\n--- Assets in DB ---")
        if not rows:
            print("No assets found in the database.")
        for row in rows:
            print(f"ID: {row[0]} | Name: {row[1]} | Status: {row[2]} | Thumb Key: {row[3]} | Created: {row[4]}")
        print("---------------------\n")
except Exception as e:
    print(f"Error querying database: {e}")

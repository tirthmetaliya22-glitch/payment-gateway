import sys
sys.path.append('c:\\Users\\admin\\OneDrive\\Desktop\\next gateway\\backend')
import asyncio
from database import get_database

async def main():
    db = get_database()
    cursor = db.payments.find().sort('creation_timestamp', -1).limit(5)
    payments = await cursor.to_list(length=5)
    for p in payments:
        print("---------------------------------")
        print(f"ID: {p.get('id')}")
        print(f"Status: {p.get('status')}")
        print(f"Session ID: {p.get('payment_session_id')}")
        print(f"Environment: {p.get('cf_environment')}")
        print(f"UPI Link: {p.get('cf_upi_link')}")

if __name__ == "__main__":
    asyncio.run(main())

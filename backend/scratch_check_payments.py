import asyncio
from database import get_database

async def main():
    db = get_database()
    cursor = db.payments.find().sort("creation_timestamp", -1).limit(5)
    async for p in cursor:
        print("--- PAYMENT ---")
        for k, v in p.items():
            if k != "_id":
                val_str = str(v).replace('\u20b9', 'Rs.')
                print(f"{k}: {val_str}")

if __name__ == "__main__":
    asyncio.run(main())

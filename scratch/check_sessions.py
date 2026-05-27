import asyncio
from database import get_database

async def check():
    db = get_database()
    count = await db.sessions.count_documents({})
    print(f'Total Sessions: {count}')
    async for s in db.sessions.find():
        print(f"Token: {s.get('token')[:8]}... Email: {s.get('email')} Role: {s.get('role')}")

if __name__ == "__main__":
    asyncio.run(check())

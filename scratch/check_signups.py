import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def run():
    client = AsyncIOMotorClient(os.getenv("DATABASE_URL"))
    db = client[os.getenv("db_name", "next_g")]
    async for s in db.sign_ups.find():
        print(s)
    await client.close()

if __name__ == "__main__":
    asyncio.run(run())

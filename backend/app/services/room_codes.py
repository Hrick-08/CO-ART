import random
import string
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import Room


# Alphabet without confusing chars: no 0, O, 1, I
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6
MAX_RETRIES = 10


async def generate_room_code(db: AsyncSession) -> str:
    """Generate a unique 6-character room code."""
    for _ in range(MAX_RETRIES):
        code = "".join(random.choices(CODE_ALPHABET, k=CODE_LENGTH))
        result = await db.execute(select(Room).where(Room.code == code))
        if not result.scalar_one_or_none():
            return code
    # If we exhausted retries, try a larger alphabet as fallback
    for _ in range(MAX_RETRIES):
        code = "".join(random.choices(string.ascii_uppercase + string.digits, k=CODE_LENGTH))
        result = await db.execute(select(Room).where(Room.code == code))
        if not result.scalar_one_or_none():
            return code
    raise Exception("Failed to generate unique room code after max retries")


def normalize_code(code: str) -> str:
    """Normalize room code: strip whitespace and uppercase."""
    return code.strip().upper()
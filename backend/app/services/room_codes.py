import random
import string
from app.database import SessionLocal
from app.models import Room

# Alphabet without confusing chars: no 0, O, 1, I
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 6
MAX_RETRIES = 10


def generate_room_code() -> str:
    """Generate a unique 6-character room code."""
    db = SessionLocal()
    try:
        for _ in range(MAX_RETRIES):
            code = "".join(random.choices(CODE_ALPHABET, k=CODE_LENGTH))
            existing = db.query(Room).filter(Room.code == code).first()
            if not existing:
                return code
        # If we exhausted retries, try a larger alphabet as fallback
        for _ in range(MAX_RETRIES):
            code = "".join(random.choices(string.ascii_uppercase + string.digits, k=CODE_LENGTH))
            existing = db.query(Room).filter(Room.code == code).first()
            if not existing:
                return code
        raise Exception("Failed to generate unique room code after max retries")
    finally:
        db.close()


def normalize_code(code: str) -> str:
    """Normalize room code: strip whitespace and uppercase."""
    return code.strip().upper()
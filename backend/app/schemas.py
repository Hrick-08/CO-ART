from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


# Auth schemas
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=20, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(..., min_length=1)


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


# Room schemas
class RoomCreate(BaseModel):
    pass


class RoomOut(BaseModel):
    id: int
    code: str
    creator_id: int
    guest_id: Optional[int] = None
    status: str
    created_at: datetime
    creator_username: str
    guest_username: Optional[str] = None

    class Config:
        from_attributes = True


class RoomJoin(BaseModel):
    pass
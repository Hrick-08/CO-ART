from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Room, User
from app.schemas import RoomCreate, RoomOut, RoomJoin
from app.security import get_current_user
from app.services.room_codes import generate_room_code, normalize_code


router = APIRouter(prefix="/rooms", tags=["rooms"])


@router.post("", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
def create_room(room_data: RoomCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    code = generate_room_code()
    room = Room(code=code, creator_id=current_user.id, status="open")
    db.add(room)
    db.commit()
    db.refresh(room)
    
    return RoomOut(
        id=room.id,
        code=room.code,
        creator_id=room.creator_id,
        guest_id=room.guest_id,
        status=room.status,
        created_at=room.created_at,
        creator_username=current_user.username,
        guest_username=None
    )


@router.get("/{code}", response_model=RoomOut)
def get_room(code: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    code = normalize_code(code)
    room = db.query(Room).filter(Room.code == code).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    creator = db.query(User).filter(User.id == room.creator_id).first()
    guest = db.query(User).filter(User.id == room.guest_id).first() if room.guest_id else None
    
    return RoomOut(
        id=room.id,
        code=room.code,
        creator_id=room.creator_id,
        guest_id=room.guest_id,
        status=room.status,
        created_at=room.created_at,
        creator_username=creator.username if creator else "Unknown",
        guest_username=guest.username if guest else None
    )


@router.post("/{code}/join", response_model=RoomOut)
def join_room(code: str, join_data: RoomJoin, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    code = normalize_code(code)
    room = db.query(Room).filter(Room.code == code).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Room not found"
        )
    
    # Check if user is already creator or guest
    if room.creator_id == current_user.id or room.guest_id == current_user.id:
        # Idempotent - already in room
        creator = db.query(User).filter(User.id == room.creator_id).first()
        guest = db.query(User).filter(User.id == room.guest_id).first() if room.guest_id else None
        return RoomOut(
            id=room.id,
            code=room.code,
            creator_id=room.creator_id,
            guest_id=room.guest_id,
            status=room.status,
            created_at=room.created_at,
            creator_username=creator.username if creator else "Unknown",
            guest_username=guest.username if guest else None
        )
    
    # Check if room has space
    if room.guest_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Room is full"
        )
    
    # Join as guest
    room.guest_id = current_user.id
    db.commit()
    db.refresh(room)
    
    creator = db.query(User).filter(User.id == room.creator_id).first()
    guest = db.query(User).filter(User.id == room.guest_id).first()
    
    return RoomOut(
        id=room.id,
        code=room.code,
        creator_id=room.creator_id,
        guest_id=room.guest_id,
        status=room.status,
        created_at=room.created_at,
        creator_username=creator.username if creator else "Unknown",
        guest_username=guest.username if guest else None
    )
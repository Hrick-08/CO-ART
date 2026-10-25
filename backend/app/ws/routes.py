import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.ws.manager import manager, RoomState
from app.security import decode_token
from app.database import AsyncSessionLocal
from app.models import Room, User


router = APIRouter()


async def get_user_from_token(db: AsyncSession, token: str) -> User | None:
    """Decode token and get user from database."""
    payload = decode_token(token)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    result = await db.execute(select(User).where(User.id == int(user_id)))
    return result.scalar_one_or_none()


async def get_room_and_validate(db: AsyncSession, code: str, user: User) -> Room | None:
    """Get room and validate user is member."""
    code = code.strip().upper()
    result = await db.execute(select(Room).where(Room.code == code))
    room = result.scalar_one_or_none()
    if not room:
        return None
    if room.creator_id != user.id and room.guest_id != user.id:
        return None
    return room


async def get_players(db: AsyncSession, room: Room) -> list[dict]:
    """Get player list for room."""
    players = []
    creator_result = await db.execute(select(User).where(User.id == room.creator_id))
    creator = creator_result.scalar_one_or_none()
    if creator:
        players.append({"id": creator.id, "username": creator.username})
    if room.guest_id:
        guest_result = await db.execute(select(User).where(User.id == room.guest_id))
        guest = guest_result.scalar_one_or_none()
        if guest:
            players.append({"id": guest.id, "username": guest.username})
    return players


@router.websocket("/ws/{code}")
async def websocket_endpoint(
    websocket: WebSocket,
    code: str,
    token: str = Query(...)
):
    code = code.strip().upper()
    
    # Create async database session for this connection
    async with AsyncSessionLocal() as db:
        # 1. Decode/verify token and get user
        user = await get_user_from_token(db, token)
        if not user:
            await websocket.close(code=4401)  # auth failed
            return
        
        # 2. Room exists and user is member
        room = await get_room_and_validate(db, code, user)
        if not room:
            # Distinguish between room not found and user not member
            room_check = await db.execute(select(Room).where(Room.code == code))
            if not room_check.scalar_one_or_none():
                await websocket.close(code=4404)  # room not found
            else:
                await websocket.close(code=4403)  # forbidden
            return
        
        # Get player list
        players = await get_players(db, room)
    
    # Accept connection (after DB session is closed)
    await websocket.accept()
    
    # Get or create room state (in-memory)
    room_state = manager.create_room(code)
    
    # 4. Replace existing connection for this user (handles refresh/reconnect)
    old_ws = room_state.get_connection(user.id)
    if old_ws:
        try:
            await old_ws.close(code=4000)  # normal closure for replaced connection
        except Exception:
            pass
    
    room_state.add_connection(user.id, websocket)
    
    # 5. Check room capacity (max 2)
    if len(room_state.connections) > 2:
        room_state.remove_connection(user.id)
        await websocket.close(code=4409)  # room full
        return
    
    # Send welcome to new client
    await manager.send_personal(websocket, {
        "type": "welcome",
        "you": {"id": user.id, "username": user.username},
        "players": players
    })
    
    # Send sync_response with current shapes
    await manager.send_personal(websocket, {
        "type": "sync_response",
        "shapes": room_state.get_shapes()
    })
    
    # Broadcast player_joined to others
    await manager.broadcast(code, {
        "type": "player_joined",
        "player": {"id": user.id, "username": user.username},
        "players": players
    }, exclude_user_id=user.id)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await manager.send_personal(websocket, {
                    "type": "error",
                    "message": "Invalid JSON"
                })
                continue
            
            # Validate message size (256 KB cap)
            if len(data) > 256 * 1024:
                await manager.send_personal(websocket, {
                    "type": "error",
                    "message": "Message too large"
                })
                continue
            
            msg_type = message.get("type")
            
            if msg_type == "shape_add":
                await handle_shape_add(code, room_state, user.id, message, websocket)
            elif msg_type == "undo":
                await handle_undo(code, room_state, user.id)
            elif msg_type == "clear_canvas":
                await handle_clear_canvas(code, room_state, user.id)
            elif msg_type == "sync_request":
                await handle_sync_request(websocket, room_state)
            else:
                await manager.send_personal(websocket, {
                    "type": "error",
                    "message": f"Unknown message type: {msg_type}"
                })
    
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        # Clean up on disconnect
        room_state.remove_connection(user.id)
        
        # Broadcast player_left (need fresh DB session)
        async with AsyncSessionLocal() as db:
            room = await db.execute(select(Room).where(Room.code == code))
            room = room.scalar_one_or_none()
            players = await get_players(db, room) if room else []
        
        await manager.broadcast_to_all(code, {
            "type": "player_left",
            "player": {"id": user.id, "username": user.username},
            "players": players
        })
        
        # Schedule cleanup if room is empty
        if len(room_state.connections) == 0:
            await manager.schedule_room_cleanup(code)


async def handle_shape_add(code: str, room_state: RoomState, user_id: int, message: dict, sender_ws: WebSocket):
    shape_data = message.get("shape")
    if not shape_data or "id" not in shape_data or "data" not in shape_data:
        await manager.send_personal(sender_ws, {
            "type": "error",
            "message": "Invalid shape_add format"
        })
        return
    
    shape_id = shape_data["id"]
    data = shape_data["data"]
    
    # Check for duplicate ID
    for shape in room_state.shapes:
        if shape["id"] == shape_id:
            await manager.send_personal(sender_ws, {
                "type": "error",
                "message": "Duplicate shape ID"
            })
            return
    
    # Add shape (server assigns owner_id)
    room_state.add_shape(shape_id, user_id, data)
    
    # Relay to OTHER client only
    await manager.broadcast(code, {
        "type": "shape_add",
        "shape": {"id": shape_id, "data": data},
        "by": user_id
    }, exclude_user_id=user_id)


async def handle_undo(code: str, room_state: RoomState, user_id: int):
    # Find last shape by this user
    for i in range(len(room_state.shapes) - 1, -1, -1):
        if room_state.shapes[i]["owner_id"] == user_id:
            shape_id = room_state.shapes[i]["id"]
            room_state.shapes.pop(i)
            
            # Broadcast shape_remove to EVERYONE including sender
            await manager.broadcast_to_all(code, {
                "type": "shape_remove",
                "id": shape_id,
                "by": user_id
            })
            return
    
    # No shape found - no-op


async def handle_clear_canvas(code: str, room_state: RoomState, user_id: int):
    room_state.clear_shapes()
    await manager.broadcast_to_all(code, {
        "type": "clear_canvas",
        "by": user_id
    })


async def handle_sync_request(websocket: WebSocket, room_state: RoomState):
    await manager.send_personal(websocket, {
        "type": "sync_response",
        "shapes": room_state.get_shapes()
    })
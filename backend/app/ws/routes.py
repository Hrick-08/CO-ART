import json
import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from app.ws.manager import manager, RoomState
from app.security import decode_token
from app.database import SessionLocal
from app.models import Room, User


router = APIRouter()


@router.websocket("/ws/{code}")
async def websocket_endpoint(
    websocket: WebSocket,
    code: str,
    token: str = Query(...)
):
    code = code.strip().upper()
    
    # 1. Decode/verify token
    payload = decode_token(token)
    if not payload:
        await websocket.close(code=4401)  # auth failed
        return
    
    user_id = payload.get("sub")
    if not user_id:
        await websocket.close(code=4401)
        return
    
    # Get user from DB
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await websocket.close(code=4401)
            return
    finally:
        db.close()
    
    # 2. Room exists
    db = SessionLocal()
    try:
        room = db.query(Room).filter(Room.code == code).first()
        if not room:
            await websocket.close(code=4404)  # room not found
            return
        
        # 3. User is creator or guest
        if room.creator_id != user.id and room.guest_id != user.id:
            await websocket.close(code=4403)  # forbidden
            return
    finally:
        db.close()
    
    # Accept connection
    await websocket.accept()
    
    # Get or create room state
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
    
    # Get other player info
    db = SessionLocal()
    try:
        creator = db.query(User).filter(User.id == room.creator_id).first()
        guest = db.query(User).filter(User.id == room.guest_id).first() if room.guest_id else None
    finally:
        db.close()
    
    # Build player list
    players = []
    if creator:
        players.append({"id": creator.id, "username": creator.username})
    if guest:
        players.append({"id": guest.id, "username": guest.username})
    
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
        
        # Broadcast player_left
        db = SessionLocal()
        try:
            room = db.query(Room).filter(Room.code == code).first()
            creator = db.query(User).filter(User.id == room.creator_id).first() if room else None
            guest = db.query(User).filter(User.id == room.guest_id).first() if room and room.guest_id else None
        finally:
            db.close()
        
        players = []
        if creator:
            players.append({"id": creator.id, "username": creator.username})
        if guest:
            players.append({"id": guest.id, "username": guest.username})
        
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
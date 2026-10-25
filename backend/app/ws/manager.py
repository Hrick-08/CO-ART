import json
import asyncio
from typing import Dict, List, Optional
from fastapi import WebSocket
from app.models import User


class RoomState:
    def __init__(self):
        self.shapes: List[dict] = []  # [{id, owner_id, data}]
        self.connections: Dict[int, WebSocket] = {}  # user_id -> websocket
        self._lock = asyncio.Lock()

    def add_shape(self, shape_id: str, owner_id: int, data: dict) -> dict:
        shape = {"id": shape_id, "owner_id": owner_id, "data": data}
        self.shapes.append(shape)
        return shape

    def remove_shape(self, shape_id: str, owner_id: int) -> bool:
        for i, shape in enumerate(self.shapes):
            if shape["id"] == shape_id and shape["owner_id"] == owner_id:
                self.shapes.pop(i)
                return True
        return False

    def clear_shapes(self) -> None:
        self.shapes.clear()

    def get_shapes(self) -> List[dict]:
        return self.shapes.copy()

    def add_connection(self, user_id: int, ws: WebSocket) -> None:
        self.connections[user_id] = ws

    def remove_connection(self, user_id: int) -> None:
        self.connections.pop(user_id, None)

    def get_connection(self, user_id: int) -> Optional[WebSocket]:
        return self.connections.get(user_id)

    def get_other_connections(self, user_id: int) -> List[WebSocket]:
        return [ws for uid, ws in self.connections.items() if uid != user_id]

    def get_all_connections(self) -> List[WebSocket]:
        return list(self.connections.values())

    def get_player_ids(self) -> List[int]:
        return list(self.connections.keys())


class ConnectionManager:
    def __init__(self):
        self.rooms: Dict[str, RoomState] = {}
        self._cleanup_tasks: Dict[str, asyncio.Task] = {}

    def get_room(self, code: str) -> Optional[RoomState]:
        return self.rooms.get(code.upper())

    def create_room(self, code: str) -> RoomState:
        code = code.upper()
        if code not in self.rooms:
            self.rooms[code] = RoomState()
        return self.rooms[code]

    def remove_room(self, code: str) -> None:
        code = code.upper()
        self.rooms.pop(code, None)
        task = self._cleanup_tasks.pop(code, None)
        if task:
            task.cancel()

    async def broadcast(self, code: str, message: dict, exclude_user_id: Optional[int] = None) -> None:
        room = self.get_room(code)
        if not room:
            return
        
        message_json = json.dumps(message)
        for user_id, ws in room.connections.items():
            if user_id != exclude_user_id:
                try:
                    await ws.send_text(message_json)
                except Exception:
                    pass  # Connection might be closed

    async def broadcast_to_all(self, code: str, message: dict) -> None:
        await self.broadcast(code, message, exclude_user_id=None)

    async def send_personal(self, ws: WebSocket, message: dict) -> None:
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            pass

    async def schedule_room_cleanup(self, code: str, delay_seconds: int = 600) -> None:
        """Schedule room cleanup after both players leave."""
        code = code.upper()
        # Cancel any existing cleanup task
        if code in self._cleanup_tasks:
            self._cleanup_tasks[code].cancel()
        
        async def cleanup():
            await asyncio.sleep(delay_seconds)
            room = self.rooms.get(code)
            if room and len(room.connections) == 0:
                self.remove_room(code)
        
        self._cleanup_tasks[code] = asyncio.create_task(cleanup())


manager = ConnectionManager()
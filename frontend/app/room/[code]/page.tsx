"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthGuard } from "@/app/components/AuthGuard";
import { CanvasBoard, CanvasBoardRef } from "@/app/components/CanvasBoard";
import { Toolbar } from "@/app/components/Toolbar";
import { PlayerList } from "@/app/components/PlayerList";
import { ConnectionBadge } from "@/app/components/ConnectionBadge";
import { RegisterSW } from "@/app/components/RegisterSW";
import { RoomSocket, WSMessage } from "@/lib/ws";
import { useAuthStore } from "@/store/auth";
import { useRoomStore } from "@/store/room";
import { useUIStore } from "@/store/ui";
import api from "@/lib/api";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const { token, user } = useAuthStore();
  const { setCode, setPlayers, setConnectionStatus, addPlayer, removePlayer, reset: resetRoom } = useRoomStore();
  const { setError, clearError } = useUIStore();
  const canvasRef = useRef<CanvasBoardRef>(null);
  const socketRef = useRef<RoomSocket | null>(null);
  const [roomLoaded, setRoomLoaded] = useState(false);
  const [localUserId, setLocalUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!code) return;

    const initRoom = async () => {
      clearError();
      
      try {
        // 1. Get room info
        const roomResponse = await api.get(`/rooms/${code}`);
        const room = roomResponse.data;
        
        // 2. Join room
        await api.post(`/rooms/${code}/join`);
        
        // 3. Set up room state
        setCode(code);
        setPlayers(room.creator_username && room.guest_username 
          ? [
              { id: room.creator_id, username: room.creator_username },
              { id: room.guest_id!, username: room.guest_username },
            ]
          : [{ id: room.creator_id, username: room.creator_username }]
        );
        setLocalUserId(user?.id || null);
        
        // 4. Connect WebSocket
        const socket = new RoomSocket(code, token!);
        socketRef.current = socket;
        
        setConnectionStatus("connecting");
        
        const unsubscribe = socket.onMessage(handleMessage);
        
        await socket.connect();
        
        setRoomLoaded(true);
        
        return () => {
          unsubscribe();
        };
      } catch (err: any) {
        setError(err.response?.data?.detail || "Failed to load room");
        setConnectionStatus("not_found");
      }
    };

    initRoom();

    return () => {
      socketRef.current?.close();
      resetRoom();
    };
  }, [code, token, user?.id, setCode, setPlayers, setConnectionStatus, addPlayer, removePlayer, resetRoom, clearError, setError]);

  const handleMessage = (message: WSMessage) => {
    switch (message.type) {
      case "welcome":
        setLocalUserId(message.you.id);
        setPlayers(message.players);
        break;
        
      case "sync_response":
        canvasRef.current?.syncShapes(message.shapes);
        break;
        
      case "shape_add":
        canvasRef.current?.addRemoteShape(message.shape.id, message.shape.data);
        break;
        
      case "shape_remove":
        canvasRef.current?.removeRemoteShape(message.id);
        break;
        
      case "clear_canvas":
        canvasRef.current?.clearRemoteCanvas();
        break;
        
      case "player_joined":
        addPlayer(message.player);
        setPlayers(message.players);
        break;
        
      case "player_left":
        removePlayer(message.player.id);
        setPlayers(message.players);
        break;
        
      case "error":
        setError(message.message);
        break;
    }
  };

  const handleShapeAdd = (shape: { id: string; data: any }) => {
    socketRef.current?.send({ type: "shape_add", shape });
  };

  const handleUndo = () => {
    socketRef.current?.send({ type: "undo" });
  };

  const handleClear = () => {
    if (confirm("Clear the entire canvas for everyone?")) {
      socketRef.current?.send({ type: "clear_canvas" });
    }
  };

  const handleExportPNG = async () => {
    try {
      const dataUrl = await canvasRef.current?.exportPNG();
      if (dataUrl) {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `coart-${code}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      setError("Failed to export PNG");
    }
  };

  if (!roomLoaded) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading room...</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <RegisterSW />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">CO-ART</h1>
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-900 dark:text-white">
                Room: {code}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">{user?.username}</span>
              <button
                onClick={() => {
                  socketRef.current?.close();
                  router.push("/home");
                }}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Leave
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col p-4 max-w-7xl mx-auto w-full">
            <CanvasBoard
              ref={canvasRef}
              onShapeAdd={handleShapeAdd}
              connectionStatus={useRoomStore.getState().connectionStatus}
            />
          </div>
          
          <Toolbar
            onUndo={handleUndo}
            onClear={handleClear}
            onExportPNG={handleExportPNG}
          />
          
          <div className="flex justify-between px-4 py-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <PlayerList />
            <ConnectionBadge />
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
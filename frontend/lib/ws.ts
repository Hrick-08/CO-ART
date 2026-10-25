import { useRoomStore } from "@/store/room";
import { useAuthStore } from "@/store/auth";
import { useUIStore } from "@/store/ui";

export type WSMessage = 
  | { type: "welcome"; you: { id: number; username: string }; players: { id: number; username: string }[] }
  | { type: "sync_response"; shapes: { id: string; owner_id: number; data: any }[] }
  | { type: "shape_add"; shape: { id: string; data: any }; by: number }
  | { type: "shape_remove"; id: string; by: number }
  | { type: "clear_canvas"; by: number }
  | { type: "player_joined"; player: { id: number; username: string }; players: { id: number; username: string }[] }
  | { type: "player_left"; player: { id: number; username: string }; players: { id: number; username: string }[] }
  | { type: "error"; message: string };

type MessageHandler = (message: WSMessage) => void;

export class RoomSocket {
  private ws: WebSocket | null = null;
  private code: string;
  private token: string;
  private handlers: MessageHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private shouldReconnect = true;
  private closedByError = false;

  constructor(code: string, token: string) {
    this.code = code;
    this.token = token;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"}/ws/${this.code}?token=${this.token}`;
      
      try {
        this.ws = new WebSocket(wsUrl);
      } catch (e) {
        reject(e);
        return;
      }

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        useRoomStore.getState().setConnectionStatus("connected");
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          this.handlers.forEach((handler) => handler(message));
        } catch (e) {
          console.error("Failed to parse WS message:", e);
        }
      };

      this.ws.onclose = (event) => {
        const wasConnected = useRoomStore.getState().connectionStatus === "connected";
        
        // Check close codes that should NOT trigger reconnect
        const noReconnectCodes = [4401, 4403, 4404, 4409];
        if (noReconnectCodes.includes(event.code)) {
          this.shouldReconnect = false;
          this.closedByError = true;
          
          switch (event.code) {
            case 4401:
              useRoomStore.getState().setConnectionStatus("auth_failed");
              useUIStore.getState().setError("Authentication failed");
              break;
            case 4403:
              useRoomStore.getState().setConnectionStatus("auth_failed");
              useUIStore.getState().setError("Not authorized for this room");
              break;
            case 4404:
              useRoomStore.getState().setConnectionStatus("not_found");
              useUIStore.getState().setError("Room not found");
              break;
            case 4409:
              useRoomStore.getState().setConnectionStatus("full");
              useUIStore.getState().setError("Room is full");
              break;
          }
        } else if (this.shouldReconnect) {
          useRoomStore.getState().setConnectionStatus("reconnecting");
          this.scheduleReconnect();
        } else {
          useRoomStore.getState().setConnectionStatus("disconnected");
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        if (useRoomStore.getState().connectionStatus === "connecting") {
          reject(new Error("Connection failed"));
        }
      };
    });
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      useRoomStore.getState().setConnectionStatus("disconnected");
      useUIStore.getState().setError("Failed to reconnect. Please refresh the page.");
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 10000);
    
    setTimeout(() => {
      if (this.shouldReconnect) {
        this.connect().catch(() => {
          // Retry will be handled by onclose
        });
      }
    }, delay);
  }

  send(message: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn("WebSocket not open, message not sent:", message);
    }
  }

  onMessage(handler: MessageHandler) {
    this.handlers.push(handler);
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index !== -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  close() {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close(1000, "Client closed");
      this.ws = null;
    }
  }

  get readyState() {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}
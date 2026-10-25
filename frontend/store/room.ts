import { create } from "zustand";

export type ConnectionStatus = 
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "full"
  | "auth_failed"
  | "not_found";

interface Player {
  id: number;
  username: string;
}

interface RoomState {
  code: string | null;
  players: Player[];
  connectionStatus: ConnectionStatus;
  setCode: (code: string) => void;
  setPlayers: (players: Player[]) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: number) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  code: null,
  players: [],
  connectionStatus: "disconnected",
  
  setCode: (code: string) => set({ code }),
  setPlayers: (players: Player[]) => set({ players }),
  setConnectionStatus: (status: ConnectionStatus) => set({ connectionStatus: status }),
  addPlayer: (player: Player) => set((state) => ({ 
    players: [...state.players.filter(p => p.id !== player.id), player] 
  })),
  removePlayer: (playerId: number) => set((state) => ({ 
    players: state.players.filter(p => p.id !== playerId) 
  })),
  reset: () => set({ code: null, players: [], connectionStatus: "disconnected" }),
}));
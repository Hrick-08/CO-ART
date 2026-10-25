import { create } from "zustand";

interface UIState {
  error: string | null;
  loading: boolean;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  clearError: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  error: null,
  loading: false,
  
  setError: (error: string | null) => set({ error }),
  setLoading: (loading: boolean) => set({ loading }),
  clearError: () => set({ error: null }),
}));
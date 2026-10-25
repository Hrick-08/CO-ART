import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface User {
  id: number;
  username: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  hydrated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      hydrated: false,
      
      login: (token: string, user: User) => {
        set({ token, user });
        if (typeof window !== "undefined") {
          localStorage.setItem("coart_token", token);
        }
      },
      
      logout: () => {
        set({ user: null, token: null });
        if (typeof window !== "undefined") {
          localStorage.removeItem("coart_token");
        }
      },
      
      hydrate: () => {
        if (typeof window !== "undefined") {
          const token = localStorage.getItem("coart_token");
          if (token) {
            set({ token, hydrated: true });
          } else {
            set({ hydrated: true });
          }
        } else {
          set({ hydrated: true });
        }
      },
    }),
    {
      name: "coart-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hydrated = true;
        }
      },
    }
  )
);
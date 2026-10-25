"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/app/components/AuthGuard";
import { useAuthStore } from "@/store/auth";
import { useUIStore } from "@/store/ui";
import api from "@/lib/api";

export default function HomePage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { error, setError, clearError, loading, setLoading } = useUIStore();
  const [joinCode, setJoinCode] = useState("");

  const handleCreateRoom = async () => {
    clearError();
    setLoading(true);
    try {
      const response = await api.post("/rooms");
      const room = response.data;
      router.push(`/room/${room.code}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    clearError();
    const code = joinCode.trim().toUpperCase();
    if (!code || code.length !== 6) {
      setError("Please enter a valid 6-character room code");
      return;
    }
    setLoading(true);
    try {
      await api.post(`/rooms/${code}/join`);
      router.push(`/room/${code}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to join room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">CO-ART</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">{user?.username}</span>
              <button
                onClick={logout}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Welcome to CO-ART</h2>
              <p className="text-gray-600 dark:text-gray-400">Create or join a collaborative drawing room</p>
            </div>

            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded text-sm text-center">
                {error}
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create Room</h3>
                <button
                  onClick={handleCreateRoom}
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg font-medium"
                >
                  {loading ? "Creating..." : "Create Room"}
                </button>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Join Room</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    placeholder="A7K29P"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg font-mono"
                    disabled={loading}
                  />
                  <button
                    onClick={handleJoinRoom}
                    disabled={loading}
                    className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? "Joining..." : "Join"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
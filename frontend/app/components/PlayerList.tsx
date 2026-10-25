"use client";

import { useRoomStore } from "@/store/room";

export function PlayerList() {
  const { players } = useRoomStore();

  return (
    <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Players:</span>
      <div className="flex items-center gap-2">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full"
          >
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm text-gray-900 dark:text-white">{player.username}</span>
          </div>
        ))}
        {players.length === 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">Waiting for players...</span>
        )}
      </div>
    </div>
  );
}
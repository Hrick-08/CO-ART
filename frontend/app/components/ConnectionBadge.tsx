"use client";

import { useRoomStore } from "@/store/room";

export function ConnectionBadge() {
  const { connectionStatus } = useRoomStore();

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case "connected":
        return { color: "bg-green-500", text: "Connected", labelColor: "text-green-700 dark:text-green-300" };
      case "connecting":
        return { color: "bg-yellow-500 animate-pulse", text: "Connecting...", labelColor: "text-yellow-700 dark:text-yellow-300" };
      case "reconnecting":
        return { color: "bg-orange-500 animate-pulse", text: "Reconnecting...", labelColor: "text-orange-700 dark:text-orange-300" };
      case "disconnected":
        return { color: "bg-gray-500", text: "Disconnected", labelColor: "text-gray-700 dark:text-gray-300" };
      case "full":
        return { color: "bg-red-500", text: "Room full", labelColor: "text-red-700 dark:text-red-300" };
      case "auth_failed":
        return { color: "bg-red-500", text: "Auth failed", labelColor: "text-red-700 dark:text-red-300" };
      case "not_found":
        return { color: "bg-red-500", text: "Room not found", labelColor: "text-red-700 dark:text-red-300" };
      default:
        return { color: "bg-gray-500", text: "Unknown", labelColor: "text-gray-700 dark:text-gray-300" };
    }
  };

  const { color, text, labelColor } = getStatusConfig();

  return (
    <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      <span className={`text-sm font-medium ${labelColor}`}>{text}</span>
    </div>
  );
}
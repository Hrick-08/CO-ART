"use client";

import { useAuthStore } from "@/store/auth";
import { useRoomStore } from "@/store/room";
import { useUIStore } from "@/store/ui";

interface ToolbarProps {
  onUndo: () => void;
  onClear: () => void;
  onExportPNG: () => void;
  disabled?: boolean;
}

export function Toolbar({ onUndo, onClear, onExportPNG, disabled = false }: ToolbarProps) {
  const { connectionStatus } = useRoomStore();
  const isDisconnected = connectionStatus !== "connected";

  return (
    <div className="flex flex-wrap gap-2 p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <button
        onClick={onUndo}
        disabled={disabled || isDisconnected}
        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        title={isDisconnected ? "Connect to use undo" : "Undo your last stroke"}
      >
        Undo
      </button>
      
      <button
        onClick={onClear}
        disabled={disabled || isDisconnected}
        className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        title={isDisconnected ? "Connect to use clear" : "Clear the entire canvas"}
      >
        Clear
      </button>
      
      <button
        onClick={onExportPNG}
        disabled={disabled || isDisconnected}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        title={isDisconnected ? "Connect to export" : "Export as PNG"}
      >
        Export PNG
      </button>
      
      {isDisconnected && (
        <span className="flex items-center px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-md">
          {connectionStatus === "connecting" && "Connecting..."}
          {connectionStatus === "reconnecting" && "Reconnecting..."}
          {connectionStatus === "disconnected" && "Disconnected"}
          {connectionStatus === "full" && "Room full"}
          {connectionStatus === "auth_failed" && "Auth failed"}
          {connectionStatus === "not_found" && "Room not found"}
        </span>
      )}
    </div>
  );
}
import axios from "axios";
import { useAuthStore } from "@/store/auth";
import { useUIStore } from "@/store/ui";

type ValidationError = {
  loc?: Array<string | number>;
  msg?: string;
};

function formatErrorDetail(detail: unknown): string | null {
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return null;

        const validationError = item as ValidationError;
        if (!validationError.msg) return null;

        const location = validationError.loc?.filter((part) => part !== "body").join(".");
        return location ? `${location}: ${validationError.msg}` : validationError.msg;
      })
      .filter((message): message is string => Boolean(message));

    return messages.length > 0 ? messages.join("; ") : null;
  }

  if (detail && typeof detail === "object" && "message" in detail) {
    const message = (detail as { message?: unknown }).message;
    return typeof message === "string" && message.trim() ? message : null;
  }

  return null;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return formatErrorDetail(error.response?.data?.detail) ?? fallback;
  }

  return fallback;
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor: add auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      useUIStore.getState().setError("Session expired. Please log in again.");
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
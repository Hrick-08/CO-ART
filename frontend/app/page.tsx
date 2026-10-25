"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export default function RootPage() {
  const router = useRouter();
  const { token, hydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated) {
      if (token) {
        router.push("/home");
      } else {
        router.push("/login");
      }
    }
  }, [hydrated, token, router]);

  return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
}
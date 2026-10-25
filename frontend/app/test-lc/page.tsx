"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    LC: {
      init: (el: HTMLElement, opts: any) => any;
    };
  }
}

export default function TestLC() {
  const containerRef = useRef<HTMLDivElement>(null);
  const lcRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Load the core script
    const script = document.createElement("script");
    script.src = "/literallycanvas/literallycanvas-core.js";
    script.onload = () => {
      setLoaded(true);
      initLC();
    };
    script.onerror = () => {
      setError("Failed to load literallycanvas-core.js");
    };
    document.head.appendChild(script);

    return () => {
      if (lcRef.current?.teardown) {
        lcRef.current.teardown();
      }
    };
  }, []);

  const initLC = () => {
    if (!containerRef.current || !window.LC) {
      setError("LC not available");
      return;
    }

    try {
      const lc = window.LC.init(containerRef.current, {
        imageURLPrefix: "/literallycanvas/img/",
        backgroundColor: "#fff",
        primaryColor: "#000",
        tools: [
          "pencil",
          "eraser",
          "line",
          "rectangle",
          "ellipse",
          "text",
          "polygon",
          "pan",
          "eyedropper",
        ],
        defaultTool: "pencil",
        snapshot: [],
      });
      lcRef.current = lc;
    } catch (e) {
      console.error("Failed to init LC:", e);
      setError(String(e));
    }
  };

  return (
    <div className="p-4">
      <h2 className="mb-4 text-xl font-bold">LiterallyCanvas Test</h2>
      <div className="mb-4 text-sm text-gray-500">
        Script loaded: {loaded ? "Yes" : "No"}
      </div>
      {error && <div className="mb-4 text-red-500">Error: {error}</div>}
      <div className="h-[600px] w-full border border-gray-300 dark:border-gray-600">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
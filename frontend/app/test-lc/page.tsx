"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";

// Dynamically import LiterallyCanvas only on client side
const LiterallyCanvas = dynamic(
  () => import("literallycanvas").then((mod) => mod.default),
  { ssr: false }
);

export default function TestLC() {
  const containerRef = useRef<HTMLDivElement>(null);
  const lcRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize LiterallyCanvas using vanilla API
    // We need to get the LC class from the module
    import("literallycanvas").then((LC) => {
      const lc = LC.init(containerRef.current!, {
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
    });

    return () => {
      if (lcRef.current?.teardown) {
        lcRef.current.teardown();
      }
    };
  }, []);

  return (
    <div className="h-[600px] w-full border border-gray-300 dark:border-gray-600">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
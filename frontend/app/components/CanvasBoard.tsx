"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";

declare global {
  interface Window {
    LC: {
      init: (el: HTMLElement, opts: any) => any;
      shapeToJSON: (shape: any) => any;
      JSONToShape: (data: any) => any;
    };
  }
}

export interface CanvasBoardRef {
  addRemoteShape: (shapeId: string, data: any) => void;
  removeRemoteShape: (shapeId: string) => void;
  clearRemoteCanvas: () => void;
  syncShapes: (shapes: Array<{ id: string; owner_id: number; data: any }>) => void;
  exportPNG: () => Promise<string | null>;
}

interface CanvasBoardProps {
  onShapeAdd: (shape: { id: string; data: any }) => void;
  connectionStatus: string;
  onReady?: () => void;
}

export const CanvasBoard = forwardRef<CanvasBoardRef, CanvasBoardProps>(
  ({ onShapeAdd, connectionStatus, onReady }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const lcRef = useRef<any>(null);
    const shapeIdMapRef = useRef<Map<string, any>>(new Map());
    const shapesRef = useRef<Array<{ id: string; data: any }>>([]);
    const applyingRemoteRef = useRef(false);
    const [error, setError] = useState<string | null>(null);
    const [scriptLoaded, setScriptLoaded] = useState(false);

    useEffect(() => {
      if (typeof window === "undefined") return;

      if (window.LC) {
        setScriptLoaded(true);
        initLC();
        return;
      }

      const script = document.createElement("script");
      script.src = "/literallycanvas/literallycanvas-core.js";
      script.onload = () => {
        setScriptLoaded(true);
        initLC();
      };
      script.onerror = () => {
        setError("Failed to load drawing canvas");
      };
      document.head.appendChild(script);

      return () => {
        if (lcRef.current?.teardown) {
          lcRef.current.teardown();
        }
      };
    }, []);

    const initLC = () => {
      if (!containerRef.current || !window.LC) return;

      try {
        const lc = window.LC.init(containerRef.current, {
          imageURLPrefix: "/literallycanvas/img/",
          backgroundColor: "#fff",
          primaryColor: "#000",
          snapshot: [],
        });

        lcRef.current = lc;
        onReady?.();

        // Listen for shape save events (local drawing)
        lc.on("shapeSave", (event: { shape: any }) => {
          if (applyingRemoteRef.current) return;
          
          const shapeId = crypto.randomUUID();
          const shapeData = window.LC.shapeToJSON(event.shape);
          
          // Store mapping
          shapeIdMapRef.current.set(shapeId, event.shape);
          shapesRef.current.push({ id: shapeId, data: shapeData });
          
          // Send to server
          onShapeAdd({ id: shapeId, data: shapeData });
        });

        // Handle window resize
        const handleResize = () => {
          if (lcRef.current) {
            lcRef.current.repaintAllLayers();
          }
        };
        window.addEventListener("resize", handleResize);
        
        return () => {
          window.removeEventListener("resize", handleResize);
          if (lcRef.current?.teardown) {
            lcRef.current.teardown();
          }
        };
      } catch (e) {
        console.error("Failed to init LC:", e);
        setError("Failed to initialize canvas");
      }
    };

    // Methods exposed to parent via ref
    const addRemoteShape = (shapeId: string, data: any) => {
      if (!lcRef.current) return;
      
      applyingRemoteRef.current = true;
      try {
        const shape = window.LC.JSONToShape(data);
        lcRef.current.saveShape(shape, false);
        shapeIdMapRef.current.set(shapeId, shape);
        shapesRef.current.push({ id: shapeId, data });
      } finally {
        applyingRemoteRef.current = false;
      }
    };

    const removeRemoteShape = (shapeId: string) => {
      if (!lcRef.current) return;
      
      applyingRemoteRef.current = true;
      try {
        const shape = shapeIdMapRef.current.get(shapeId);
        if (shape) {
          const shapes = lcRef.current.shapes;
          const index = shapes.indexOf(shape);
          if (index !== -1) {
            shapes.splice(index, 1);
            lcRef.current.repaintLayer("main");
          }
          shapeIdMapRef.current.delete(shapeId);
          shapesRef.current = shapesRef.current.filter(s => s.id !== shapeId);
        }
      } finally {
        applyingRemoteRef.current = false;
      }
    };

    const clearRemoteCanvas = () => {
      if (!lcRef.current) return;
      
      applyingRemoteRef.current = true;
      try {
        lcRef.current.clear(false);
        shapeIdMapRef.current.clear();
        shapesRef.current = [];
      } finally {
        applyingRemoteRef.current = false;
      }
    };

    const syncShapes = (shapes: Array<{ id: string; owner_id: number; data: any }>) => {
      if (!lcRef.current) return;
      
      applyingRemoteRef.current = true;
      try {
        lcRef.current.clear(false);
        
        shapeIdMapRef.current.clear();
        shapesRef.current = [];
        
        shapes.forEach(({ id, data }) => {
          const shape = window.LC.JSONToShape(data);
          lcRef.current.saveShape(shape, false);
          shapeIdMapRef.current.set(id, shape);
          shapesRef.current.push({ id, data });
        });
        
        lcRef.current.repaintLayer("main");
      } finally {
        applyingRemoteRef.current = false;
      }
    };

    const exportPNG = async (): Promise<string | null> => {
      if (!lcRef.current) return null;
      
      try {
        const image = lcRef.current.getImage({
          rect: {
            x: 0,
            y: 0,
            width: lcRef.current.canvas.width / lcRef.current.scale,
            height: lcRef.current.canvas.height / lcRef.current.scale,
          },
          scale: 2,
          includeWatermark: false,
        });
        
        // Create a canvas with white background
        const canvas = document.createElement("canvas");
        canvas.width = 2400;
        canvas.height = 1600;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0);
          return canvas.toDataURL("image/png");
        }
        return image.toDataURL("image/png");
      } catch (e) {
        console.error("Export failed:", e);
        setError("Failed to export PNG");
        return null;
      }
    };

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      addRemoteShape,
      removeRemoteShape,
      clearRemoteCanvas,
      syncShapes,
      exportPNG,
    }));

    return (
      <div className="relative flex-1 min-h-0">
        {error && (
          <div className="absolute top-2 left-2 right-2 z-10 p-2 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded text-sm text-center">
            {error}
          </div>
        )}
        {!scriptLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
            <div className="text-gray-600 dark:text-gray-400">Loading canvas...</div>
          </div>
        )}
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ 
            width: "100%", 
            height: "100%",
            margin: "0 auto",
          }}
        />
      </div>
    );
  }
);

CanvasBoard.displayName = "CanvasBoard";
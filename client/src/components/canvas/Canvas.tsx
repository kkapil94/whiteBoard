import React, { useRef, useEffect, useState } from "react";

interface CanvasProps {
  width?: number;
  height?: number;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

const Canvas: React.FC<CanvasProps> = ({ width = 800, height = 600 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [transform, setTransform] = useState<Transform>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [startPanPosition, setStartPanPosition] = useState({ x: 0, y: 0 });

  // Prevent default browser zooming
  useEffect(() => {
    const preventZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    // Add this at the document level to ensure it catches all zoom events
    document.addEventListener("wheel", preventZoom, { passive: false });

    return () => {
      document.removeEventListener("wheel", preventZoom);
    };
  }, []);

  // Initialize and maintain the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    drawGrid(ctx);
  }, [width, height, transform]); // Redraw when transform changes

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    const gridSize = 20;

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 0.5;

    // Draw vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }

    // Draw horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }

    ctx.stroke();
    ctx.restore();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle button or left button with spacebar
    if (e.button === 1 || e.button === 0) {
      setIsPanning(true);
      setStartPanPosition({
        x: e.clientX - transform.x,
        y: e.clientY - transform.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;

    setTransform({
      ...transform,
      x: e.clientX - startPanPosition.x,
      y: e.clientY - startPanPosition.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault(); // Prevent default scrolling

    if (!containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    // Get mouse position relative to container
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate the point on the canvas before zooming
    const pointX = (mouseX - transform.x) / transform.scale;
    const pointY = (mouseY - transform.y) / transform.scale;

    // Determine zoom direction and calculate new scale
    const delta = -Math.sign(e.deltaY) * 0.1;
    const newScale = Math.max(0.1, Math.min(5, transform.scale + delta));

    // Calculate new transform to keep mouse position fixed
    const newX = mouseX - pointX * newScale;
    const newY = mouseY - pointY * newScale;

    setTransform({
      x: newX,
      y: newY,
      scale: newScale,
    });
  };

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden border border-gray-300 shadow-md bg-gray-100"
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: "0 0",
          willChange: "transform", // Optimize for animations
        }}
      >
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="touch-none cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
        />
      </div>
    </div>
  );
};

export default Canvas;

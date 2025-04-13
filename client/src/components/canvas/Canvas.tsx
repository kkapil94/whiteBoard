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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [transform, setTransform] = useState<Transform>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [startPanPoint, setStartPanPoint] = useState({ x: 0, y: 0 });

  // Initialize canvas
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      // Set up high DPI canvas
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      if (ctx) {
        ctx.scale(dpr, dpr);
        setContext(ctx);
        drawCanvas(ctx, transform);
      }
    }
  }, [width, height]);

  // Redraw canvas when transform changes
  useEffect(() => {
    if (context) {
      drawCanvas(context, transform);
    }
  }, [transform]);

  // Draw the canvas with the current transform
  const drawCanvas = (ctx: CanvasRenderingContext2D, tf: Transform) => {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Apply the transform
    ctx.translate(tf.x, tf.y);
    ctx.scale(tf.scale, tf.scale);

    // Draw a white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(
      -tf.x / tf.scale,
      -tf.y / tf.scale,
      width / tf.scale,
      height / tf.scale
    );

    // Draw grid (optional)
    drawGrid(ctx, tf);

    // Draw objects will go here in the future

    ctx.restore();
  };

  // Draw grid pattern
  const drawGrid = (ctx: CanvasRenderingContext2D, tf: Transform) => {
    const gridSize = 20;
    const offsetX = tf.x % (gridSize * tf.scale);
    const offsetY = tf.y % (gridSize * tf.scale);

    ctx.beginPath();
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 0.5;

    // Draw vertical lines
    for (let x = offsetX; x < width; x += gridSize * tf.scale) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }

    // Draw horizontal lines
    for (let y = offsetY; y < height; y += gridSize * tf.scale) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }

    ctx.stroke();
  };

  // Mouse event handlers for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.button === 0) {
      // Middle button or left button with space key
      setIsPanning(true);
      setStartPanPoint({
        x: e.clientX - transform.x,
        y: e.clientY - transform.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setTransform({
        ...transform,
        x: e.clientX - startPanPoint.x,
        y: e.clientY - startPanPoint.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleMouseLeave = () => {
    setIsPanning(false);
  };

  // Wheel event handler for zooming
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    // Get mouse position relative to canvas
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom
    const zoom = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = transform.scale * zoom;

    // Limit zoom level
    if (newScale < 0.5 || newScale > 5) return;

    // Calculate new transform to zoom toward mouse position
    const newX = mouseX - (mouseX - transform.x) * zoom;
    const newY = mouseY - (mouseY - transform.y) * zoom;

    setTransform({
      x: newX,
      y: newY,
      scale: newScale,
    });
  };

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = (
    screenX: number,
    screenY: number
  ): { x: number; y: number } => {
    return {
      x: (screenX - transform.x) / transform.scale,
      y: (screenY - transform.y) / transform.scale,
    };
  };

  return (
    <div className="relative overflow-hidden border border-gray-300 shadow-md bg-gray-100">
      <canvas
        className="touch-none cursor-crosshair bg-white"
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      ></canvas>
    </div>
  );
};

export default Canvas;

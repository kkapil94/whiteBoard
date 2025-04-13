import React, { useRef, useEffect, useState, useCallback } from "react";
import ObjectManager, { Shape, Point, LineShape } from "@/lib/objectManager";
import {
  FaCircle,
  FaEraser,
  FaFont,
  FaLevelDownAlt,
  FaLevelUpAlt,
  FaMinus,
  FaMousePointer,
  FaPencilAlt,
  FaSquare,
  FaTrash,
} from "react-icons/fa";
// import {
//   faSquare,
//   faCircle,
//   faWindowMinimize,
//   faMinusSquare,
//   faFileLines,
// } from "@fortawesome/free-regular-svg-icons";
import "./Whiteboard.css";

interface WhiteboardProps {
  width: number;
  height: number;
}

interface Transform {
  x: number;
  y: number;
  scale: number;
}

type Tool =
  | "select"
  | "rectangle"
  | "circle"
  | "line"
  | "freeDraw"
  | "text"
  | "eraser";

const Whiteboard: React.FC<WhiteboardProps> = ({ width, height }) => {
  // Canvas and rendering refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);

  // Object management
  const objectManagerRef = useRef<ObjectManager>(new ObjectManager());
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapes, setSelectedShapes] = useState<Shape[]>([]);

  // Tool and style states
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [fillColor, setFillColor] = useState("transparent");
  const [strokeWidth, setStrokeWidth] = useState(2);

  // Canvas transform state
  const [transform, setTransform] = useState<Transform>({
    x: 0,
    y: 0,
    scale: 1,
  });

  // Drawing and interaction states
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [lastPoint, setLastPoint] = useState<Point | null>(null);
  const [startPanPoint, setStartPanPoint] = useState<Point>({ x: 0, y: 0 });
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);

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
      }
    }

    // Cleanup function
    return () => {
      // Cancel any pending animations
    };
  }, [width, height]);

  // Draw the canvas
  const drawCanvas = useCallback(() => {
    if (!context) return;

    context.save();
    context.clearRect(0, 0, width, height);

    // Apply the transform
    context.translate(transform.x, transform.y);
    context.scale(transform.scale, transform.scale);

    // Draw a white background
    context.fillStyle = "#ffffff";
    context.fillRect(
      -transform.x / transform.scale,
      -transform.y / transform.scale,
      width / transform.scale,
      height / transform.scale
    );

    // Draw grid
    drawGrid();

    // Draw all shapes
    const sortedShapes = [...shapes].sort((a, b) => a.zIndex - b.zIndex);
    sortedShapes.forEach((shape) => {
      drawShape(shape);
    });

    // Draw current shape being created
    if (currentShape) {
      drawShape(currentShape);
    }

    // Draw selection outlines
    selectedShapes.forEach((shape) => {
      drawSelectionOutline(shape);
    });

    context.restore();
  }, [context, width, height, transform, shapes, currentShape, selectedShapes]);

  // For initial setup of ObjectManager
  useEffect(() => {
    const objectManager = objectManagerRef.current;
    // Initialize shapes only once
    if (shapes.length === 0) {
      setShapes(objectManager.getShapes());
      setSelectedShapes(objectManager.getSelectedShapes());
    }
  }, []);

  // For rendering
  useEffect(() => {
    if (context) {
      drawCanvas();
    }
  }, [drawCanvas, context]);

  // Draw grid pattern
  const drawGrid = useCallback(() => {
    if (!context) return;

    const gridSize = 20;
    const offsetX = transform.x % (gridSize * transform.scale);
    const offsetY = transform.y % (gridSize * transform.scale);

    context.beginPath();
    context.setLineDash([]);
    context.strokeStyle = "#e0e0e0";
    context.lineWidth = 0.5;

    // Draw vertical lines
    for (let x = offsetX; x < width; x += gridSize * transform.scale) {
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }

    // Draw horizontal lines
    for (let y = offsetY; y < height; y += gridSize * transform.scale) {
      context.moveTo(0, y);
      context.lineTo(width, y);
    }

    context.stroke();
  }, [context, transform, width, height]);

  // Draw a shape
  const drawShape = (shape: Shape) => {
    if (!context) return;

    context.save();

    // Set up styles
    context.fillStyle = shape.style.fillColor;
    context.strokeStyle = shape.style.strokeColor;
    context.lineWidth = shape.style.strokeWidth;
    context.setLineDash([]);

    // Apply shape-specific rotation
    context.translate(shape.x, shape.y);
    context.rotate((shape.rotation * Math.PI) / 180);
    context.translate(-shape.x, -shape.y);

    switch (shape.type) {
      case "rectangle":
        context.beginPath();
        context.rect(
          shape.x - shape.width / 2,
          shape.y - shape.height / 2,
          shape.width,
          shape.height
        );
        if (shape.style.fillColor !== "transparent") {
          context.fill();
        }
        context.stroke();
        break;

      case "circle":
        context.beginPath();
        context.arc(shape.x, shape.y, shape.radius, 0, Math.PI * 2);
        if (shape.style.fillColor !== "transparent") {
          context.fill();
        }
        context.stroke();
        break;

      case "line":
        context.beginPath();
        context.moveTo(
          shape.x + shape.points[0].x,
          shape.y + shape.points[0].y
        );
        for (let i = 1; i < shape.points.length; i++) {
          context.lineTo(
            shape.x + shape.points[i].x,
            shape.y + shape.points[i].y
          );
        }
        context.stroke();
        break;

      case "freeDraw":
        if (shape.points.length > 0) {
          context.beginPath();
          context.moveTo(
            shape.x + shape.points[0].x,
            shape.y + shape.points[0].y
          );
          for (let i = 1; i < shape.points.length; i++) {
            context.lineTo(
              shape.x + shape.points[i].x,
              shape.y + shape.points[i].y
            );
          }
          context.stroke();
        }
        break;

      case "text":
        context.font = `${shape.fontSize}px ${shape.fontFamily}`;
        context.fillStyle = shape.style.strokeColor;
        context.fillText(shape.text, shape.x, shape.y);
        break;
    }

    context.restore();
  };

  // Draw selection outline and handles around a shape
  const drawSelectionOutline = (shape: Shape) => {
    if (!context) return;

    context.save();

    // Apply shape rotation
    context.translate(shape.x, shape.y);
    context.rotate((shape.rotation * Math.PI) / 180);
    context.translate(-shape.x, -shape.y);

    context.strokeStyle = "#1890ff";
    context.lineWidth = 1;
    context.setLineDash([5, 3]);

    let bounds = { x: 0, y: 0, width: 0, height: 0 };

    switch (shape.type) {
      case "rectangle":
        bounds = {
          x: shape.x - shape.width / 2,
          y: shape.y - shape.height / 2,
          width: shape.width,
          height: shape.height,
        };
        break;

      case "circle":
        bounds = {
          x: shape.x - shape.radius,
          y: shape.y - shape.radius,
          width: shape.radius * 2,
          height: shape.radius * 2,
        };
        break;

      case "line":
      case "freeDraw":
        if (shape.points && shape.points.length > 0) {
          // Find bounding box of all points
          let minX = shape.points[0].x;
          let minY = shape.points[0].y;
          let maxX = shape.points[0].x;
          let maxY = shape.points[0].y;

          for (const point of shape.points) {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
          }

          bounds = {
            x: shape.x + minX,
            y: shape.y + minY,
            width: maxX - minX,
            height: maxY - minY,
          };
        }
        break;

      case "text":
        context.font = `${shape.fontSize}px ${shape.fontFamily}`;
        const metrics = context.measureText(shape.text);
        bounds = {
          x: shape.x,
          y: shape.y - shape.fontSize,
          width: metrics.width,
          height: shape.fontSize,
        };
        break;
    }

    // Draw dashed selection rectangle
    context.beginPath();
    context.rect(bounds.x, bounds.y, bounds.width, bounds.height);
    context.stroke();

    // Draw resizing handles (with solid lines)
    context.setLineDash([]);
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#1890ff";
    context.lineWidth = 1;

    const handleSize = 6;
    const halfHandle = handleSize / 2;

    // Draw the 8 handles
    const handles = [
      { x: bounds.x, y: bounds.y }, // Top-left
      { x: bounds.x + bounds.width / 2, y: bounds.y }, // Top-center
      { x: bounds.x + bounds.width, y: bounds.y }, // Top-right
      { x: bounds.x, y: bounds.y + bounds.height / 2 }, // Middle-left
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 }, // Middle-right
      { x: bounds.x, y: bounds.y + bounds.height }, // Bottom-left
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height }, // Bottom-center
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, // Bottom-right
    ];

    handles.forEach((handle) => {
      context.beginPath();
      context.rect(
        handle.x - halfHandle,
        handle.y - halfHandle,
        handleSize,
        handleSize
      );
      context.fill();
      context.stroke();
    });

    // Draw rotation handle
    context.beginPath();
    context.moveTo(bounds.x + bounds.width / 2, bounds.y);
    context.lineTo(bounds.x + bounds.width / 2, bounds.y - 20);
    context.stroke();

    context.beginPath();
    context.arc(
      bounds.x + bounds.width / 2,
      bounds.y - 20,
      halfHandle,
      0,
      Math.PI * 2
    );
    context.fill();
    context.stroke();

    context.restore();
  };

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = (x: number, y: number): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    return {
      x: ((x - rect.left) * scaleX - transform.x) / transform.scale,
      y: ((y - rect.top) * scaleY - transform.y) / transform.scale,
    };
  };

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();

    const canvasPoint = screenToCanvas(e.clientX, e.clientY);
    setLastPoint(canvasPoint);

    // Right-click for panning
    if (e.button === 2 || (e.button === 0 && e.altKey)) {
      setIsPanning(true);
      setStartPanPoint({
        x: e.clientX - transform.x,
        y: e.clientY - transform.y,
      });
      return;
    }

    if (e.button === 0) {
      // Left click
      if (activeTool === "select") {
        const objectManager = objectManagerRef.current;
        const hitShape = objectManager.findShapeAtPoint(canvasPoint, context!);

        if (hitShape) {
          // If the clicked shape is already selected, don't deselect others
          const addToSelection = e.shiftKey || hitShape.isSelected;
          objectManager.selectShapes([hitShape.id], addToSelection);

          setIsDrawing(true);
          setStartPoint(canvasPoint);
        } else {
          objectManager.deselectAll();
        }

        // Update states
        setShapes(objectManager.getShapes());
        setSelectedShapes(objectManager.getSelectedShapes());
      } else {
        // Start drawing a new shape
        setIsDrawing(true);
        setStartPoint(canvasPoint);

        // Create a new shape based on the active tool
        const objectManager = objectManagerRef.current;
        let newShape: Shape | null = null;

        const shapeStyle = {
          strokeColor,
          fillColor,
          strokeWidth,
        };

        switch (activeTool) {
          case "rectangle":
            newShape = objectManager.addShape(
              {
                x: canvasPoint.x,
                y: canvasPoint.y,
                width: 0,
                height: 0,
                style: shapeStyle,
              },
              "rectangle"
            );
            break;

          case "circle":
            newShape = objectManager.addShape(
              {
                x: canvasPoint.x,
                y: canvasPoint.y,
                radius: 0,
                style: shapeStyle,
              },
              "circle"
            );
            break;

          case "line":
            newShape = objectManager.addShape(
              {
                x: 0,
                y: 0,
                points: [
                  { x: canvasPoint.x, y: canvasPoint.y },
                  { x: canvasPoint.x, y: canvasPoint.y },
                ],
                style: shapeStyle,
              },
              "line"
            );
            break;

          case "freeDraw":
            newShape = objectManager.addShape(
              {
                x: 0,
                y: 0,
                points: [{ x: canvasPoint.x, y: canvasPoint.y }],
                style: shapeStyle,
              },
              "freeDraw"
            );
            break;

          case "text":
            newShape = objectManager.addShape(
              {
                x: canvasPoint.x,
                y: canvasPoint.y,
                text: "Double-click to edit",
                fontSize: 16,
                fontFamily: "Arial",
                style: shapeStyle,
              },
              "text"
            );
            break;

          case "eraser":
            const hitShape = objectManager.findShapeAtPoint(
              canvasPoint,
              context!
            );
            if (hitShape) {
              objectManager.deleteShapes([hitShape.id]);
              setShapes(objectManager.getShapes());
            }
            break;
        }

        setCurrentShape(newShape);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    e.preventDefault();

    const canvasPoint = screenToCanvas(e.clientX, e.clientY);

    // Handle panning
    if (isPanning) {
      setTransform({
        ...transform,
        x: e.clientX - startPanPoint.x,
        y: e.clientY - startPanPoint.y,
      });
      return;
    }

    // Handle drawing or manipulating shapes
    if (isDrawing && startPoint && lastPoint) {
      const objectManager = objectManagerRef.current;

      if (activeTool === "select" && selectedShapes.length > 0) {
        // Move selected shapes
        const dx = canvasPoint.x - lastPoint.x;
        const dy = canvasPoint.y - lastPoint.y;

        const selectedIds = selectedShapes.map((shape) => shape.id);
        objectManager.moveShapes(selectedIds, dx, dy);

        setShapes(objectManager.getShapes());
        setSelectedShapes(objectManager.getSelectedShapes());
      } else if (activeTool !== "select" && currentShape) {
        // Update the current shape being drawn
        switch (activeTool) {
          case "rectangle":
            objectManager.updateShape(currentShape.id, {
              width: canvasPoint.x - startPoint.x,
              height: canvasPoint.y - startPoint.y,
            });
            break;

          case "circle":
            const dx = canvasPoint.x - startPoint.x;
            const dy = canvasPoint.y - startPoint.y;
            const radius = Math.sqrt(dx * dx + dy * dy);
            objectManager.updateShape(currentShape.id, { radius });
            break;

          case "line":
            objectManager.updateShape(currentShape.id, {
              points: [
                { x: startPoint.x, y: startPoint.y },
                { x: canvasPoint.x, y: canvasPoint.y },
              ],
            });
            break;

          case "freeDraw":
            // Add the new point to the existing points
            objectManager.updateShape(currentShape.id, {
              points: [
                ...((currentShape as LineShape).points || []),
                { x: canvasPoint.x, y: canvasPoint.y },
              ],
            });
            break;

          case "eraser":
            const hitShape = objectManager.findShapeAtPoint(
              canvasPoint,
              context!
            );
            if (hitShape) {
              objectManager.deleteShapes([hitShape.id]);
            }
            break;
        }

        setShapes(objectManager.getShapes());
        setCurrentShape(shapes.find((s) => s.id === currentShape.id) || null);
      }
    }

    setLastPoint(canvasPoint);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.preventDefault();

    // End current drawing/interaction
    if (isDrawing && currentShape && activeTool !== "select") {
      // Finalize shape if it's valid
      const objectManager = objectManagerRef.current;

      // For some shapes, check if they have valid dimensions
      let isValid = true;

      switch (currentShape.type) {
        case "rectangle":
          isValid =
            Math.abs(currentShape.width) > 2 &&
            Math.abs(currentShape.height) > 2;
          break;

        case "circle":
          isValid = currentShape.radius > 2;
          break;

        case "line":
          const p1 = currentShape.points[0];
          const p2 = currentShape.points[1];
          isValid = Math.abs(p1.x - p2.x) > 2 || Math.abs(p1.y - p2.y) > 2;
          break;

        case "freeDraw":
          isValid = currentShape.points.length > 1;
          break;
      }

      if (!isValid) {
        objectManager.deleteShapes([currentShape.id]);
      }

      setShapes(objectManager.getShapes());
      setSelectedShapes(objectManager.getSelectedShapes());
    }

    setIsDrawing(false);
    setIsPanning(false);
    setStartPoint(null);
    setCurrentShape(null);
  };

  const handleMouseLeave = () => {
    handleMouseUp({ preventDefault: () => {} } as React.MouseEvent);
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
    if (newScale < 0.1 || newScale > 10) return;

    // Calculate new transform to zoom toward mouse position
    const newX = mouseX - (mouseX - transform.x) * zoom;
    const newY = mouseY - (mouseY - transform.y) * zoom;

    setTransform({
      x: newX,
      y: newY,
      scale: newScale,
    });
  };

  // Add these functions near your mouse event handlers (around line 541)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
        preventDefault: () => {},
      } as React.MouseEvent;
      handleMouseDown(mouseEvent);
    } else if (e.touches.length === 2) {
      // Two-finger touch starts panning
      e.preventDefault();
      setIsPanning(true);
      setStartPanPoint({
        x: e.touches[0].clientX - transform.x,
        y: e.touches[0].clientY - transform.y,
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      const mouseEvent = {
        clientX: touch.clientX,
        clientY: touch.clientY,
        preventDefault: () => {},
      } as React.MouseEvent;
      handleMouseMove(mouseEvent);
    } else if (e.touches.length === 2 && isPanning) {
      e.preventDefault();
      // Handle two-finger pan
      setTransform({
        ...transform,
        x: e.touches[0].clientX - startPanPoint.x,
        y: e.touches[0].clientY - startPanPoint.y,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    const mouseEvent = {
      preventDefault: () => {},
    } as React.MouseEvent;
    handleMouseUp(mouseEvent);
  };

  // Double click for text editing
  // Replace handleDoubleClick (around line 531)
  const handleDoubleClick = (e: React.MouseEvent) => {
    const canvasPoint = screenToCanvas(e.clientX, e.clientY);
    const objectManager = objectManagerRef.current;
    const hitShape = objectManager.findShapeAtPoint(canvasPoint, context!);

    if (hitShape && hitShape.type === "text") {
      // Create a temporary input element for better text editing
      const input = document.createElement("input");
      input.type = "text";
      input.value = hitShape.text || "";
      input.style.position = "absolute";

      // Position the input at the text position
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const screenX = hitShape.x * transform.scale + transform.x + rect.left;
        const screenY = hitShape.y * transform.scale + transform.y + rect.top;
        input.style.left = `${screenX}px`;
        input.style.top = `${screenY - 20}px`; // Position slightly above text
      }

      input.style.zIndex = "1000";
      document.body.appendChild(input);
      input.focus();

      // Handle saving text on blur or Enter key
      const saveText = () => {
        if (input.value) {
          objectManager.updateShape(hitShape.id, { text: input.value });
          setShapes(objectManager.getShapes());
        }
        document.body.removeChild(input);
      };

      input.onblur = saveText;
      input.onkeydown = (evt) => {
        if (evt.key === "Enter") {
          saveText();
        } else if (evt.key === "Escape") {
          document.body.removeChild(input);
        }
      };
    }
  };

  // Delete selected shapes
  // Improve handleKeyDown (around line 538)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent handling if input or text area is focused
    if (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLTextAreaElement
    ) {
      return;
    }

    // Delete key for removing selected shapes
    if (
      (e.key === "Delete" || e.key === "Backspace") &&
      selectedShapes.length > 0
    ) {
      e.preventDefault();
      const objectManager = objectManagerRef.current;
      const selectedIds = selectedShapes.map((shape) => shape.id);
      objectManager.deleteShapes(selectedIds);
      setShapes(objectManager.getShapes());
      setSelectedShapes([]);
    }

    // Ctrl+A to select all
    // if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
    //   e.preventDefault();
    //   const objectManager = objectManagerRef.current;
    //   objectManager.selectAll();
    //   setShapes(objectManager.getShapes());
    //   setSelectedShapes(objectManager.getSelectedShapes());
    // }

    // Escape key to deselect
    if (e.key === "Escape") {
      e.preventDefault();
      const objectManager = objectManagerRef.current;
      objectManager.deselectAll();
      setShapes(objectManager.getShapes());
      setSelectedShapes([]);
      setActiveTool("select");
    }
  };

  // Context menu handler (prevent default)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  // Toolbar handlers
  const handleToolChange = (tool: Tool) => {
    setActiveTool(tool);

    // Deselect all when changing tools
    if (tool !== "select") {
      const objectManager = objectManagerRef.current;
      objectManager.deselectAll();
      setShapes(objectManager.getShapes());
      setSelectedShapes([]);
    }
  };

  const handleStrokeColorChange = (color: string) => {
    setStrokeColor(color);
  };

  const handleFillColorChange = (color: string) => {
    setFillColor(color);
  };

  const handleStrokeWidthChange = (width: number) => {
    setStrokeWidth(width);
  };

  const handleClearCanvas = () => {
    const objectManager = objectManagerRef.current;
    objectManager.clearAll();
    setShapes([]);
    setSelectedShapes([]);
  };

  const handleBringToFront = () => {
    if (selectedShapes.length === 0) return;

    const objectManager = objectManagerRef.current;
    const selectedIds = selectedShapes.map((shape) => shape.id);
    objectManager.bringToFront(selectedIds);
    setShapes(objectManager.getShapes());
  };

  const handleSendToBack = () => {
    if (selectedShapes.length === 0) return;

    const objectManager = objectManagerRef.current;
    const selectedIds = selectedShapes.map((shape) => shape.id);
    objectManager.sendToBack(selectedIds);
    setShapes(objectManager.getShapes());
  };

  return (
    <div className="whiteboard-container">
      <div className="toolbar">
        <div className="tool-group">
          <button
            className={`tool-button ${activeTool === "select" ? "active" : ""}`}
            onClick={() => handleToolChange("select")}
            title="Select"
          >
            <FaMousePointer />
          </button>
          <button
            className={`tool-button ${
              activeTool === "rectangle" ? "active" : ""
            }`}
            onClick={() => handleToolChange("rectangle")}
            title="Rectangle"
          >
            <FaSquare />
          </button>
          <button
            className={`tool-button ${activeTool === "circle" ? "active" : ""}`}
            onClick={() => handleToolChange("circle")}
            title="Circle"
          >
            <FaCircle />
          </button>
          <button
            className={`tool-button ${activeTool === "line" ? "active" : ""}`}
            onClick={() => handleToolChange("line")}
            title="Line"
          >
            <FaMinus />
          </button>
          <button
            className={`tool-button ${
              activeTool === "freeDraw" ? "active" : ""
            }`}
            onClick={() => handleToolChange("freeDraw")}
            title="Free Draw"
          >
            <FaPencilAlt />
          </button>
          <button
            className={`tool-button ${activeTool === "text" ? "active" : ""}`}
            onClick={() => handleToolChange("text")}
            title="Text"
          >
            <FaFont />
          </button>
          <button
            className={`tool-button ${activeTool === "eraser" ? "active" : ""}`}
            onClick={() => handleToolChange("eraser")}
            title="Eraser"
          >
            <FaEraser />
          </button>
        </div>

        <div className="style-group">
          <div className="color-picker">
            <label htmlFor="stroke-color">Stroke:</label>
            <input
              type="color"
              id="stroke-color"
              value={strokeColor}
              onChange={(e) => handleStrokeColorChange(e.target.value)}
            />
          </div>

          <div className="color-picker">
            <label htmlFor="fill-color">Fill:</label>
            <input
              type="color"
              id="fill-color"
              value={fillColor === "transparent" ? "#ffffff" : fillColor}
              onChange={(e) => handleFillColorChange(e.target.value)}
            />
            <label>
              <input
                type="checkbox"
                checked={fillColor !== "transparent"}
                onChange={(e) =>
                  handleFillColorChange(
                    e.target.checked ? "#ffffff" : "transparent"
                  )
                }
              />
              Use Fill
            </label>
          </div>

          <div className="stroke-width">
            <label htmlFor="stroke-width">Width:</label>
            <input
              type="range"
              id="stroke-width"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={(e) =>
                handleStrokeWidthChange(parseInt(e.target.value))
              }
            />
            <span>{strokeWidth}px</span>
          </div>
        </div>

        <div className="action-group">
          <button onClick={handleBringToFront} title="Bring to Front">
            <FaLevelUpAlt />
          </button>
          <button onClick={handleSendToBack} title="Send to Back">
            <FaLevelDownAlt />
          </button>
          <button onClick={handleClearCanvas} title="Clear Canvas">
            <FaTrash />
          </button>
        </div>
      </div>

      <div className="canvas-wrapper" tabIndex={0} onKeyDown={handleKeyDown}>
        <canvas
          ref={canvasRef}
          className="drawing-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>
    </div>
  );
};

export default Whiteboard;

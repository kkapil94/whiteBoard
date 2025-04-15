import React, { useRef, useEffect, useState, useCallback } from "react";
import * as fabric from "fabric";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { v4 as uuidv4 } from "uuid";
import {
  FaMousePointer,
  FaSquare,
  FaCircle,
  FaMinus,
  FaPencilAlt,
  FaFont,
  FaEraser,
  FaTrash,
  FaLevelUpAlt,
  FaLevelDownAlt,
  FaDownload,
  FaUpload,
  FaUndo,
  FaRedo,
  FaClone,
} from "react-icons/fa";
import "./Whiteboard.css";

interface WhiteboardProps {
  width: number;
  height: number;
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
  // Canvas and fabric references
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);

  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(
    import.meta.env.VITE_WS_URL,
    "whiteboard-room",
    ydoc
  );
  const yArray = ydoc.getArray("fabric-objects");

  provider.on(
    "status",
    (event: { status: "connected" | "disconnected" | "connecting" }) => {
      console.log(`WebSocket is ${event.status}`);
    }
  );

  useEffect(() => {
    const updateCanvasFromYjs = () => {
      if (yArray.length === 0 || !fabricCanvasRef.current) return;

      const data = yArray.get(0);
      if (data && fabricCanvasRef.current) {
        // Temporarily disable sync to avoid loops
        let tempDisableSync = true;

        fabricCanvasRef.current.loadFromJSON(data, () => {
          fabricCanvasRef.current?.requestRenderAll();
          tempDisableSync = false;
        });
      }
    };

    // Observe changes to the Yjs array
    yArray.observe(updateCanvasFromYjs);

    // Initial sync
    updateCanvasFromYjs();

    return () => yArray.unobserve(updateCanvasFromYjs);
  }, []);

  // State for toolbar controls
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [fillColor, setFillColor] = useState("transparent");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [fontSize, setFontSize] = useState(20);
  const [fontFamily, setFontFamily] = useState("Arial");
  const [useFill, setUseFill] = useState(false);

  // History management state
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Use refs to capture current state for event handlers
  const activeToolRef = useRef<Tool>(activeTool);
  const strokeColorRef = useRef(strokeColor);
  const fillColorRef = useRef(fillColor);
  const strokeWidthRef = useRef(strokeWidth);
  const fontSizeRef = useRef(fontSize);
  const fontFamilyRef = useRef(fontFamily);
  const useFillRef = useRef(useFill);

  // Update refs when state changes
  useEffect(() => {
    activeToolRef.current = activeTool;
    strokeColorRef.current = strokeColor;
    fillColorRef.current = fillColor;
    strokeWidthRef.current = strokeWidth;
    fontSizeRef.current = fontSize;
    fontFamilyRef.current = fontFamily;
    useFillRef.current = useFill;
  }, [
    activeTool,
    strokeColor,
    fillColor,
    strokeWidth,
    fontSize,
    fontFamily,
    useFill,
  ]);

  const syncCanvasToYjs = () => {
    if (!fabricCanvasRef.current) return;
    const canvasJson = fabricCanvasRef.current.toJSON();

    // Replace the entire array content with the new canvas state
    yArray.delete(0, yArray.length);
    yArray.push([canvasJson]);
  };
  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return;

    // Create new Fabric canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
      selection: true,
    });

    fabricCanvasRef.current = canvas;

    // Set default selection style
    canvas.selectionColor = "rgba(100, 100, 255, 0.3)";
    canvas.selectionBorderColor = "#1890ff";
    canvas.selectionLineWidth = 1;

    // Add grid background
    // drawGrid(canvas);

    // Setup event listeners for history management
    const historyCleanup = setupHistoryManagement(canvas);

    // Setup tool event listeners
    const toolEventCleanup = setupToolEventListeners(canvas);

    canvas.on("path:created", (e) => {
      const path = e.path.toObject([
        "path",
        "left",
        "top",
        "stroke",
        "strokeWidth",
        "fill",
      ]);
      yArray.push([path]); // Add path to Yjs
    });

    yArray.observe((event) => {
      event.changes.added.forEach((item) => {
        item.content.getContent().forEach((obj: any) => {
          const path = new fabric.Path(obj.path, obj);
          canvas.add(path);
          canvas.requestRenderAll();
        });
      });
    });

    // On component unmount, dispose canvas
    return () => {
      historyCleanup();
      toolEventCleanup();
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [width, height]);

  // Handle active tool changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Reset canvas mode
    canvas.isDrawingMode = false;
    canvas.selection = true;

    // Deselect objects when changing tools (except when selecting)
    if (activeTool !== "select") {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }

    // Configure canvas based on active tool
    switch (activeTool) {
      case "select":
        canvas.selection = true;
        break;

      case "freeDraw":
        canvas.isDrawingMode = true;

        if (!canvas.freeDrawingBrush) {
          canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        }

        const brush = canvas.freeDrawingBrush;
        brush.color = strokeColor;
        brush.width = strokeWidth;
        break;

      case "eraser":
        canvas.selection = false;
        break;

      default:
        canvas.selection = false;
        break;
    }
  }, [activeTool, strokeColor, strokeWidth]);

  // Handle color and style changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Update free drawing brush
    if (canvas.isDrawingMode) {
      const brush = canvas.freeDrawingBrush;
      if (brush) {
        brush.color = strokeColor;
        brush.width = strokeWidth;
      }
    }

    // Update active object if any
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      if (
        activeObject.type !== "textbox" &&
        activeObject.stroke !== undefined
      ) {
        activeObject.set("stroke", strokeColor);
      }

      if (activeObject.type !== "textbox" && activeObject.fill !== undefined) {
        activeObject.set("fill", useFill ? fillColor : "transparent");
      }

      if (activeObject.type === "textbox") {
        activeObject.set("fill", strokeColor);
        activeObject.set("fontSize", fontSize);
        activeObject.set("fontFamily", fontFamily);
      }

      if (activeObject.strokeWidth !== undefined) {
        activeObject.set("strokeWidth", strokeWidth);
      }

      canvas.requestRenderAll();
    }
  }, [strokeColor, fillColor, strokeWidth, useFill, fontSize, fontFamily]);

  // Draw grid pattern on canvas
  // const drawGrid = (canvas: fabric.Canvas) => {
  //   const gridSize = 20;
  //   const gridLines: fabric.Line[] = [];

  //   // Create vertical lines
  //   for (let i = gridSize; i < width; i += gridSize) {
  //     gridLines.push(
  //       new fabric.Line([i, 0, i, height], {
  //         stroke: "#e0e0e0",
  //         selectable: false,
  //         evented: false,
  //         strokeWidth: 0.5,
  //       })
  //     );
  //   }

  //   // Create horizontal lines
  //   for (let i = gridSize; i < height; i += gridSize) {
  //     gridLines.push(
  //       new fabric.Line([0, i, width, i], {
  //         stroke: "#e0e0e0",
  //         selectable: false,
  //         evented: false,
  //         strokeWidth: 0.5,
  //       })
  //     );
  //   }

  //   // Add all grid lines to canvas
  //   const gridGroup = new fabric.Group(gridLines, {
  //     selectable: false,
  //     evented: false,
  //     lockMovementX: true,
  //     lockMovementY: true,
  //     lockScalingX: true,
  //     lockScalingY: true,
  //     lockRotation: true,
  //   });

  //   canvas.add(gridGroup);
  //   canvas.sendObjectToBack(gridGroup);
  // };

  // Setup history management (undo/redo)
  const setupHistoryManagement = (canvas: fabric.Canvas) => {
    let history: string[] = [];
    let currentStateIndex = -1;
    let isRedoing = false;
    let isSaving = false;

    const saveHistory = () => {
      if (isRedoing || isSaving) return;

      isSaving = true;

      // If we're not at the end of the history array, remove everything after current state
      if (currentStateIndex < history.length - 1) {
        history = history.slice(0, currentStateIndex + 1);
      }

      // Save current state
      const json = JSON.stringify(canvas);
      history.push(json);
      currentStateIndex = history.length - 1;

      // Update buttons state
      setCanUndo(currentStateIndex > 0);
      setCanRedo(currentStateIndex < history.length - 1);

      isSaving = false;
    };

    // Save state on object modifications
    canvas.on("object:modified", saveHistory);
    canvas.on("object:added", saveHistory);
    canvas.on("object:removed", saveHistory);

    syncCanvasToYjs();

    // Initial state
    saveHistory();

    // Expose undo/redo methods
    const canvasUndo = () => {
      if (currentStateIndex <= 0) return;

      isRedoing = true;
      currentStateIndex--;

      const json = history[currentStateIndex];
      canvas.loadFromJSON(json, () => {
        canvas.requestRenderAll();
        isRedoing = false;
        setCanUndo(currentStateIndex > 0);
        setCanRedo(currentStateIndex < history.length - 1);
      });
    };

    const canvasRedo = () => {
      if (currentStateIndex >= history.length - 1) return;

      isRedoing = true;
      currentStateIndex++;

      const json = history[currentStateIndex];
      canvas.loadFromJSON(json, () => {
        canvas.requestRenderAll();
        isRedoing = false;
        setCanUndo(currentStateIndex > 0);
        setCanRedo(currentStateIndex < history.length - 1);
      });
    };

    // Assign to window for external access
    (window as any).canvasUndo = canvasUndo;
    (window as any).canvasRedo = canvasRedo;

    // Return cleanup function
    return () => {
      canvas.off("object:modified", saveHistory);
      canvas.off("object:added", saveHistory);
      canvas.off("object:removed", saveHistory);
      delete (window as any).canvasUndo;
      delete (window as any).canvasRedo;
    };
  };

  // Setup event listeners for tools
  const setupToolEventListeners = (canvas: fabric.Canvas) => {
    let isDrawing = false;
    let startPoint: { x: number; y: number } | null = null;
    let currentObject: fabric.Object | null = null;

    const handleMouseDown = (options: any) => {
      if (!options.pointer) return;

      // Skip if not left mouse button
      // @ts-ignore - e exists on options.e
      if (options.e?.button !== undefined && options.e?.button !== 0) return;

      const pointer = options.pointer;
      startPoint = { x: pointer.x, y: pointer.y };
      isDrawing = true;

      if (activeToolRef.current === "select") return;

      // Create new objects based on tool
      switch (activeToolRef.current) {
        case "rectangle":
          currentObject = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: useFillRef.current ? fillColorRef.current : "transparent",
            stroke: strokeColorRef.current,
            strokeWidth: strokeWidthRef.current,
            selectable: false,
          });
          canvas.add(currentObject);
          break;

        case "circle":
          currentObject = new fabric.Circle({
            left: pointer.x,
            top: pointer.y,
            radius: 0,
            fill: useFillRef.current ? fillColorRef.current : "transparent",
            stroke: strokeColorRef.current,
            strokeWidth: strokeWidthRef.current,
            selectable: false,
          });
          canvas.add(currentObject);
          break;

        case "line":
          currentObject = new fabric.Line(
            [pointer.x, pointer.y, pointer.x, pointer.y],
            {
              stroke: strokeColorRef.current,
              strokeWidth: strokeWidthRef.current,
              selectable: false,
            }
          );
          canvas.add(currentObject);
          break;

        case "text":
          currentObject = new fabric.Textbox("Text", {
            left: pointer.x,
            top: pointer.y,
            fill: strokeColorRef.current,
            fontSize: fontSizeRef.current,
            fontFamily: fontFamilyRef.current,
            width: 150,
          });
          canvas.add(currentObject);
          canvas.setActiveObject(currentObject);
          isDrawing = false;
          break;

        case "eraser":
          const activeObj = canvas.findTarget(options.e as PointerEvent);
          if (activeObj && !activeObj.evented) return;
          if (activeObj) {
            canvas.remove(activeObj);
          }
          break;
      }
    };

    const handleMouseMove = (options: any) => {
      if (!isDrawing || !startPoint || !options.pointer) return;

      const pointer = options.pointer;

      if (activeToolRef.current === "eraser") {
        const activeObj = canvas.findTarget(options.e as PointerEvent);
        if (activeObj && !activeObj.evented) return;
        if (activeObj) {
          canvas.remove(activeObj);
        }
        return;
      }

      if (!currentObject) return;

      // Update object dimensions based on mouse movement and type
      if (currentObject instanceof fabric.Rect) {
        const rectWidth = pointer.x - startPoint.x;
        const rectHeight = pointer.y - startPoint.y;

        currentObject.set({
          width: Math.abs(rectWidth),
          height: Math.abs(rectHeight),
          left: rectWidth > 0 ? startPoint.x : pointer.x,
          top: rectHeight > 0 ? startPoint.y : pointer.y,
        });
      } else if (currentObject instanceof fabric.Circle) {
        const dx = pointer.x - startPoint.x;
        const dy = pointer.y - startPoint.y;
        const radius = Math.sqrt(dx * dx + dy * dy);

        currentObject.set({
          radius: radius / 2,
          left: startPoint.x - radius / 2,
          top: startPoint.y - radius / 2,
        });
      } else if (currentObject instanceof fabric.Line) {
        currentObject.set({
          x2: pointer.x,
          y2: pointer.y,
        });
      }

      canvas.renderAll();
    };

    const handleMouseUp = () => {
      isDrawing = false;

      if (currentObject) {
        currentObject.set({ selectable: true });

        // Check if the shape is too small, remove it if it is
        const isValidObject = isValidShape(currentObject);
        if (!isValidObject) {
          canvas.remove(currentObject);
        }

        currentObject = null;
      }

      startPoint = null;
      canvas.renderAll();

      // If not erasing, switch back to select tool
      if (
        activeToolRef.current !== "select" &&
        activeToolRef.current !== "eraser" &&
        activeToolRef.current !== "freeDraw"
      ) {
        setActiveTool("select");
      }
      syncCanvasToYjs();
    };

    // Add event listeners
    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);

    // Return cleanup function
    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
    };
  };

  // Check if a shape is valid (not too small)
  const isValidShape = (obj: fabric.Object): boolean => {
    if (obj instanceof fabric.Rect) {
      return obj.width! > 5 && obj.height! > 5;
    } else if (obj instanceof fabric.Circle) {
      return obj.radius! > 5;
    } else if (obj instanceof fabric.Line) {
      const dx = obj.x2! - obj.x1!;
      const dy = obj.y2! - obj.y1!;
      return Math.sqrt(dx * dx + dy * dy) > 5;
    }
    return true;
  };

  // Tool handlers
  const handleToolChange = useCallback((tool: Tool) => {
    setActiveTool(tool);
  }, []);

  const handleClearCanvas = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Clear all objects except grid
    const objects = canvas.getObjects();
    objects.forEach((obj) => {
      // Avoid removing grid lines
      if (obj.evented !== false) {
        canvas.remove(obj);
      }
    });

    canvas.requestRenderAll();
    syncCanvasToYjs();
  }, []);

  const handleBringToFront = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.bringObjectToFront(activeObject);
    }
    syncCanvasToYjs();
  }, []);

  const handleSendToBack = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.sendObjectToBack(activeObject);

      // Keep grid at the very back
      const objects = canvas.getObjects();
      const gridLines = objects.filter((obj) => !obj.evented);
      gridLines.forEach((grid) => canvas.sendObjectToBack(grid));
    }
    syncCanvasToYjs();
  }, []);

  const handleDuplicate = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    try {
      // Use cloneAsImage for bitmap objects
      if (activeObject.type === "image") {
        (activeObject as any).cloneAsImage((img: fabric.Image) => {
          img.set({
            left: (activeObject.left || 0) + 10,
            top: (activeObject.top || 0) + 10,
          });
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.requestRenderAll();
        });
        return;
      }

      // Use async/await for other object types
      (async () => {
        try {
          // @ts-ignore - clone() returns a Promise in newer Fabric versions
          const cloned = await (activeObject as any).clone();
          canvas.discardActiveObject();

          cloned.set({
            left: (cloned.left || 0) + 10,
            top: (cloned.top || 0) + 10,
            evented: true,
          });

          canvas.add(cloned);
          canvas.setActiveObject(cloned);
          canvas.requestRenderAll();
        } catch (error) {
          console.error("Error cloning object:", error);
        }
      })();
      syncCanvasToYjs();
    } catch (error) {
      console.error("Error in duplicate handler:", error);
    }
  }, []);

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    (window as any).canvasUndo();
    syncCanvasToYjs();
  }, [canUndo]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    (window as any).canvasRedo();
    syncCanvasToYjs();
  }, [canRedo]);

  const handleSaveCanvas = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    try {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width!;
      tempCanvas.height = canvas.height!;
      const tempCtx = tempCanvas.getContext("2d");
      if (!tempCtx) return;

      tempCtx.fillStyle = "#FFFFFF";
      tempCtx.fillRect(0, 0, canvas.width!, canvas.height!);

      const objects = canvas.getObjects();
      const visibleObjects = objects.filter((obj) => obj.evented !== false);

      const exportCanvas = new fabric.StaticCanvas(undefined, {
        width: canvas.width,
        height: canvas.height,
      });

      const cloneAndExport = async () => {
        const clones = await Promise.all(
          visibleObjects.map((obj) => obj.clone?.())
        );

        clones.forEach((cloned) => {
          if (cloned) exportCanvas.add(cloned);
        });

        const dataURL = exportCanvas.toDataURL({
          multiplier: 1,
          format: "png",
          quality: 1,
        });

        const link = document.createElement("a");
        link.download =
          "whiteboard-" + new Date().toISOString().slice(0, 10) + ".png";
        link.href = dataURL;
        link.click();

        exportCanvas.dispose();
      };

      cloneAndExport();
    } catch (error) {
      console.error("Error saving canvas:", error);
    }
  }, []);

  const handleLoadCanvas = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";

    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (!target.files?.length) return;

      const file = target.files[0];
      const reader = new FileReader();

      reader.onload = (event) => {
        if (!event.target?.result) return;

        const canvas = fabricCanvasRef.current;
        if (!canvas) return;

        try {
          // Clear current canvas
          handleClearCanvas();

          // Load from JSON
          canvas.loadFromJSON(event.target.result.toString(), () => {
            canvas.requestRenderAll();
          });
        } catch (err) {
          console.error("Error loading canvas:", err);
          alert(
            "Could not load the file. It may be corrupted or in the wrong format."
          );
        }
      };

      reader.readAsText(file);
    };

    input.click();
  }, [handleClearCanvas]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      // Delete key
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !e.metaKey &&
        !e.ctrlKey
      ) {
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
          canvas.remove(activeObject);
        }
      }

      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }

      // Ctrl+Shift+Z or Cmd+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      }

      // Ctrl+D or Cmd+D for duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        handleDuplicate();
      }
    },
    [handleUndo, handleRedo, handleDuplicate]
  );

  return (
    <div
      className="whiteboard-container"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div className="toolbar">
        <div className="toolbar-section">
          <div className="tool-group">
            <button
              className={`tool-button ${
                activeTool === "select" ? "active" : ""
              }`}
              onClick={() => handleToolChange("select")}
              title="Select (V)"
            >
              <FaMousePointer />
            </button>
            <button
              className={`tool-button ${
                activeTool === "rectangle" ? "active" : ""
              }`}
              onClick={() => handleToolChange("rectangle")}
              title="Rectangle (R)"
            >
              <FaSquare />
            </button>
            <button
              className={`tool-button ${
                activeTool === "circle" ? "active" : ""
              }`}
              onClick={() => handleToolChange("circle")}
              title="Circle (C)"
            >
              <FaCircle />
            </button>
            <button
              className={`tool-button ${activeTool === "line" ? "active" : ""}`}
              onClick={() => handleToolChange("line")}
              title="Line (L)"
            >
              <FaMinus />
            </button>
            <button
              className={`tool-button ${
                activeTool === "freeDraw" ? "active" : ""
              }`}
              onClick={() => handleToolChange("freeDraw")}
              title="Free Draw (P)"
            >
              <FaPencilAlt />
            </button>
            <button
              className={`tool-button ${activeTool === "text" ? "active" : ""}`}
              onClick={() => handleToolChange("text")}
              title="Text (T)"
            >
              <FaFont />
            </button>
            <button
              className={`tool-button ${
                activeTool === "eraser" ? "active" : ""
              }`}
              onClick={() => handleToolChange("eraser")}
              title="Eraser (E)"
            >
              <FaEraser />
            </button>
          </div>

          <div className="separator"></div>

          <div className="style-group">
            <div className="color-picker">
              <label htmlFor="stroke-color">Stroke:</label>
              <input
                type="color"
                id="stroke-color"
                value={strokeColor}
                onChange={(e) => setStrokeColor(e.target.value)}
              />
            </div>

            <div className="color-picker">
              <label htmlFor="fill-color">Fill:</label>
              <input
                type="color"
                id="fill-color"
                value={fillColor === "transparent" ? "#ffffff" : fillColor}
                onChange={(e) => setFillColor(e.target.value)}
                disabled={!useFill}
              />
              <div className="checkbox-container">
                <input
                  type="checkbox"
                  id="use-fill"
                  checked={useFill}
                  onChange={(e) => setUseFill(e.target.checked)}
                />
                <label htmlFor="use-fill">Use Fill</label>
              </div>
            </div>

            <div className="stroke-width">
              <label htmlFor="stroke-width">Width:</label>
              <input
                type="range"
                id="stroke-width"
                min="1"
                max="20"
                value={strokeWidth}
                onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
              />
              <span>{strokeWidth}px</span>
            </div>

            {(activeTool === "text" ||
              fabricCanvasRef.current?.getActiveObject()?.type ===
                "textbox") && (
              <div className="text-controls">
                <div className="font-size">
                  <label htmlFor="font-size">Size:</label>
                  <input
                    type="number"
                    id="font-size"
                    min="8"
                    max="72"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                  />
                </div>

                <div className="font-family">
                  <label htmlFor="font-family">Font:</label>
                  <select
                    id="font-family"
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                  >
                    <option value="Arial">Arial</option>
                    <option value="Helvetica">Helvetica</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Verdana">Verdana</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="toolbar-section">
          <div className="action-group">
            <button
              className={`tool-button ${!canUndo ? "disabled" : ""}`}
              onClick={handleUndo}
              title="Undo (Ctrl+Z)"
              disabled={!canUndo}
            >
              <FaUndo />
            </button>
            <button
              className={`tool-button ${!canRedo ? "disabled" : ""}`}
              onClick={handleRedo}
              title="Redo (Ctrl+Shift+Z)"
              disabled={!canRedo}
            >
              <FaRedo />
            </button>

            <div className="separator"></div>

            <button
              onClick={handleBringToFront}
              title="Bring to Front"
              className="tool-button"
            >
              <FaLevelUpAlt />
            </button>
            <button
              onClick={handleSendToBack}
              title="Send to Back"
              className="tool-button"
            >
              <FaLevelDownAlt />
            </button>
            <button
              onClick={handleDuplicate}
              title="Duplicate (Ctrl+D)"
              className="tool-button"
            >
              <FaClone />
            </button>

            <div className="separator"></div>

            <button
              onClick={handleSaveCanvas}
              title="Export as PNG"
              className="tool-button"
            >
              <FaDownload />
            </button>
            <button
              onClick={handleLoadCanvas}
              title="Import from JSON"
              className="tool-button"
            >
              <FaUpload />
            </button>
            <button
              onClick={handleClearCanvas}
              title="Clear Canvas"
              className="tool-button danger"
            >
              <FaTrash />
            </button>
          </div>
        </div>
      </div>

      <div className="canvas-wrapper">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

export default Whiteboard;

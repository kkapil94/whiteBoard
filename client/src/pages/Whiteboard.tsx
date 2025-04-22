import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import * as fabric from "fabric";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { debounce } from "lodash";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  useGetBoardByIdQuery,
  useUpdateBoardContentMutation,
} from "@/store/api/boardApi";

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
  FaExclamationTriangle,
  FaSignOutAlt,
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
  const navigate = useNavigate();
  const { boardId } = useParams<{ boardId: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const lastCanvasStateRef = useRef<string | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Initialize Y.js and WebSocket connection
  const ydoc = useMemo(() => new Y.Doc(), []);
  const [isConnected, setIsConnected] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);

  // Connection status management
  const provider = useMemo(() => {
    if (authFailed || !boardId) {
      return null;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        console.error("No auth token found");
        toast.error("Authentication required. Please log in again.");
        navigate("/login");
        throw new Error("Authentication required");
      }

      const wsUrl = new URL(
        import.meta.env.VITE_WS_URL || "ws://localhost:4000"
      );
      wsUrl.pathname = `/yjs-ws/board:${boardId}`;
      wsUrl.searchParams.append("token", token);

      console.log("Connecting to WebSocket URL:", wsUrl.toString());

      const wsProvider = new WebsocketProvider(
        wsUrl.toString(),
        boardId,
        ydoc,
        {
          connect: true,
          WebSocketPolyfill: WebSocket,
          resyncInterval: 5000,
          maxBackoffTime: 10000,
          disableBc: true,
        }
      );

      // Set up listeners
      wsProvider.on("connection-close", (event: any) => {
        console.log("WebSocket connection closed:", event);

        // Permanently disable reconnection on auth failure
        if (event?.code === 1008) {
          console.log("Authentication failed (connection-close)");
          setAuthFailed(true);
          wsProvider.disconnect();
          // Force cleanup any internal provider reconnection attempts
          wsProvider.shouldConnect = false;
          toast.error("Authentication failed. Please log in again.");
        }
      });

      wsProvider.on("connection-error", (error: any) => {
        console.error("WebSocket Connection Error:", error);

        // Permanently disable reconnection on auth failure
        if (error?.code === 1008) {
          console.log("Authentication failed (connection-error)");
          setAuthFailed(true);
          wsProvider.disconnect();
          // Force cleanup any internal provider reconnection attempts
          wsProvider.shouldConnect = false;
          toast.error("Authentication failed. Please log in again.");
        }
      });

      wsProvider.on("status", ({ status }: { status: string }) => {
        console.log("WebSocket Connection Status:", status);
        if (!authFailed) {
          const isConnectedNow = status === "connected";
          setIsConnected(isConnectedNow);

          if (isConnectedNow) {
            toast.success("Connected to collaboration server");
          } else if (status === "disconnected") {
            toast.error(
              "Disconnected from collaboration server. Changes will not be synced."
            );
          }
        }
      });

      wsProvider.on("sync", (isSynced: boolean) => {
        console.log("Sync status:", isSynced);
      });

      return wsProvider;
    } catch (error) {
      console.error("Failed to create WebSocket provider:", error);
      return null;
    }
  }, [ydoc, authFailed, boardId, navigate]);

  // Replace retry logic with a simplified version that respects auth failure
  useEffect(() => {
    if (!provider || authFailed) return; // Skip if provider is null or auth failed

    let reconnectTimeout: NodeJS.Timeout;

    const handleConnectionError = (error: any) => {
      console.error("WebSocket connection error in effect:", error);

      if (error?.code === 1008) {
        // Auth failed, permanently disable reconnection
        console.log("Authentication failure detected, disabling reconnection");
        setAuthFailed(true);
        clearTimeout(reconnectTimeout);
        return;
      }

      // Only set up reconnection for non-auth errors and if auth hasn't failed
      if (!authFailed && error?.code !== 1008) {
        reconnectTimeout = setTimeout(() => {
          console.log("Attempting to reconnect...");
          if (provider && !provider.wsconnected && !authFailed) {
            provider.connect();
          }
        }, 5000);
      }
    };

    provider.on("connection-error", handleConnectionError);

    return () => {
      provider.off("connection-error", handleConnectionError);
      clearTimeout(reconnectTimeout);
    };
  }, [provider, authFailed]);

  // Add a UI warning when authentication fails
  useEffect(() => {
    if (authFailed) {
      console.error(
        "Authentication failed for whiteboard. Please log in again."
      );
      toast.error("Authentication failed. Please log in again.", {
        duration: 5000,
        action: {
          label: "Log in",
          onClick: () => navigate("/login"),
        },
      });
    }
  }, [authFailed, navigate]);

  // Set up Y.js shared data
  const yArray = useMemo(() => ydoc.getArray("fabric-objects"), [ydoc]);

  // Fetch board data using Redux hook
  const { data: boardData, isLoading } = useGetBoardByIdQuery(boardId || "", {
    skip: !boardId,
  });

  // Hook for updating board content
  const [updateBoardContent] = useUpdateBoardContentMutation();

  // Update board content in database when canvas changes
  const saveCanvasToDatabase = useCallback(
    debounce((content: string) => {
      if (!boardId) return;

      try {
        console.log("Saving canvas to database");
        updateBoardContent({
          boardId,
          content,
        })
          .unwrap()
          .then(() => console.log("Canvas saved to database"))
          .catch((error) => {
            console.error("Error saving canvas:", error);
            toast.error("Failed to save your changes");
          });
      } catch (error) {
        console.error("Error saving canvas to database:", error);
      }
    }, 2000),
    [boardId, updateBoardContent]
  );

  // Modified sync function to also save to database
  const syncCanvasToYjs = useCallback(() => {
    if (!fabricCanvasRef.current || !isConnected || authFailed) return;

    try {
      const canvasJson = fabricCanvasRef.current.toJSON();
      const canvasJsonString = JSON.stringify(canvasJson);

      // Save current state to the ref for potential resize recovery
      lastCanvasStateRef.current = canvasJsonString;

      // Update Yjs document
      yArray.delete(0, yArray.length);
      yArray.push([canvasJson]);

      // Save to database
      saveCanvasToDatabase(canvasJsonString);
    } catch (error) {
      console.error("Error syncing canvas:", error);
    }
  }, [yArray, isConnected, authFailed, saveCanvasToDatabase]);

  // Update canvas when receiving changes
  useEffect(() => {
    const updateCanvasFromYjs = () => {
      if (!fabricCanvasRef.current) return;

      try {
        const data = yArray.get(0);
        if (!data) return;

        // Store own state before loading from YJS to prevent content loss
        if (!lastCanvasStateRef.current) {
          lastCanvasStateRef.current = JSON.stringify(
            fabricCanvasRef.current.toJSON()
          );
        }

        fabricCanvasRef.current.loadFromJSON(data, () => {
          fabricCanvasRef.current?.requestRenderAll();
          // Make sure objects are selectable after loading
          if (fabricCanvasRef.current) {
            fabricCanvasRef.current.getObjects().forEach((obj) => {
              obj.selectable = activeToolRef.current === "select";
              obj.evented = true;
              obj.hasControls = activeToolRef.current === "select";
              obj.hasBorders = activeToolRef.current === "select";
            });
          }
        });
      } catch (error) {
        console.error("Error updating canvas from Yjs:", error);
      }
    };

    yArray.observe(updateCanvasFromYjs);
    return () => yArray.unobserve(updateCanvasFromYjs);
  }, [yArray]);

  // Fetch board content when component mounts
  useEffect(() => {
    if (!boardId || !boardData || isLoading) return;

    console.log("Board data received:", boardData);

    // If board has saved content and canvas is initialized, load it
    if (boardData.content && fabricCanvasRef.current) {
      console.log("Loading content into canvas");
      try {
        fabricCanvasRef.current.loadFromJSON(boardData.content, () => {
          fabricCanvasRef.current?.requestRenderAll();

          // Make objects selectable after loading
          if (fabricCanvasRef.current) {
            fabricCanvasRef.current.getObjects().forEach((obj) => {
              obj.selectable = activeToolRef.current === "select";
              obj.evented = true;
              obj.hasControls = activeToolRef.current === "select";
              obj.hasBorders = activeToolRef.current === "select";
            });
          }

          // Store initial state for resize operations
          lastCanvasStateRef.current = boardData.content!;

          console.log("Board content loaded successfully");
        });
      } catch (error) {
        console.error("Error loading board content:", error);
        toast.error("Failed to load board content");
      }
    }
  }, [boardId, boardData, isLoading]);

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

  // Function to resize canvas without losing content
  const resizeCanvas = useCallback((newWidth: number, newHeight: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    try {
      console.log("Resizing canvas:", newWidth, newHeight);

      // Store the current state before resizing if not already stored
      if (!lastCanvasStateRef.current) {
        const canvasJson = canvas.toJSON();
        lastCanvasStateRef.current = JSON.stringify(canvasJson);
      }

      // Set new canvas dimensions
      canvas.setDimensions({
        width: newWidth,
        height: newHeight,
      });

      // Restore the content from the stored state
      if (lastCanvasStateRef.current) {
        canvas.loadFromJSON(lastCanvasStateRef.current, () => {
          canvas.requestRenderAll();

          // Make sure all objects remain selectable and interactive
          canvas.getObjects().forEach((obj) => {
            obj.selectable = activeToolRef.current === "select";
            obj.evented = true;
            obj.hasControls = activeToolRef.current === "select";
            obj.hasBorders = activeToolRef.current === "select";
          });
        });
      }
    } catch (error) {
      console.error("Error resizing canvas:", error);
    }
  }, []);

  // Handle window resize events
  useEffect(() => {
    const handleResize = debounce(() => {
      if (width && height && fabricCanvasRef.current) {
        resizeCanvas(width, height);
      }
    }, 250); // Debounce to avoid too many resize operations

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [width, height, resizeCanvas]);

  // Update canvas dimensions when props change
  useEffect(() => {
    if (
      fabricCanvasRef.current &&
      (fabricCanvasRef.current.width !== width ||
        fabricCanvasRef.current.height !== height)
    ) {
      resizeCanvas(width, height);
    }
  }, [width, height, resizeCanvas]);

  // Optimize canvas initialization
  const initializeCanvas = useCallback(() => {
    if (!canvasRef.current || fabricCanvasRef.current) return;

    try {
      const canvas = new fabric.Canvas(canvasRef.current, {
        width,
        height,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
        selection: true,
        selectionBorderColor: "#1890ff",
        selectionColor: "rgba(100, 100, 255, 0.3)",
        selectionLineWidth: 1,
        targetFindTolerance: 5,
        perPixelTargetFind: false,
        interactive: true,
      });

      fabricCanvasRef.current = canvas;

      // Make all objects selectable by default
      canvas.on("object:added", (e) => {
        if (e.target) {
          e.target.set({
            selectable: activeToolRef.current === "select",
            evented: true,
            hasControls: activeToolRef.current === "select",
            hasBorders: activeToolRef.current === "select",
          });
        }
        // Save latest state for resize recovery
        lastCanvasStateRef.current = JSON.stringify(canvas.toJSON());
        canvas.requestRenderAll();
      });

      // Add event listener for path creation (free drawing)
      canvas.on("path:created", () => {
        // Save latest state for resize recovery
        lastCanvasStateRef.current = JSON.stringify(canvas.toJSON());
        console.log("Path created - syncing canvas");
        syncCanvasToYjs();
      });

      // Add event listener for object modification
      canvas.on("object:modified", () => {
        // Save latest state for resize recovery
        lastCanvasStateRef.current = JSON.stringify(canvas.toJSON());
        console.log("Object modified - syncing canvas");
        syncCanvasToYjs();
      });

      // Add event listener for object removal
      canvas.on("object:removed", () => {
        // Save latest state for resize recovery
        lastCanvasStateRef.current = JSON.stringify(canvas.toJSON());
      });

      // Setup other event listeners
      const historyCleanup = setupHistoryManagement(canvas);
      const toolEventCleanup = setupToolEventListeners(canvas);

      return () => {
        historyCleanup();
        toolEventCleanup();
        canvas.dispose();
        fabricCanvasRef.current = null;
      };
    } catch (error) {
      console.error("Error initializing canvas:", error);
      toast.error("Failed to initialize the whiteboard");
      return undefined;
    }
  }, [width, height, syncCanvasToYjs]);

  useEffect(() => {
    const cleanup = initializeCanvas();
    return () => cleanup?.();
  }, [initializeCanvas]);

  // Optimize active tool changes
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    try {
      // Configure canvas based on active tool
      canvas.isDrawingMode = activeTool === "freeDraw";
      canvas.selection = activeTool === "select";
      canvas.defaultCursor = activeTool === "select" ? "default" : "crosshair";
      canvas.hoverCursor = activeTool === "select" ? "move" : "crosshair";

      // Always set up the free drawing brush when in freeDraw mode
      if (activeTool === "freeDraw") {
        if (!canvas.freeDrawingBrush) {
          // @ts-ignore: fabric.PencilBrush may not be in types, but is in runtime
          canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        }
        canvas.freeDrawingBrush.color = strokeColor;
        canvas.freeDrawingBrush.width = strokeWidth;
      }

      // Update the selectability of all objects based on the tool
      canvas.getObjects().forEach((obj) => {
        obj.selectable = activeTool === "select";
        obj.hasControls = activeTool === "select";
        obj.hasBorders = activeTool === "select";
        obj.lockMovementX = activeTool !== "select";
        obj.lockMovementY = activeTool !== "select";
      });

      canvas.requestRenderAll();
    } catch (error) {
      console.error("Error updating tool configuration:", error);
    }
  }, [activeTool, strokeColor, strokeWidth]);

  // Setup history management for undo/redo
  const setupHistoryManagement = useCallback(
    (canvas: fabric.Canvas) => {
      let history: string[] = [];
      let currentStateIndex = -1;
      let isRedoing = false;
      let isSaving = false;

      const saveState = () => {
        if (isRedoing || isSaving) return;
        isSaving = true;

        try {
          // Remove any states after current index
          if (currentStateIndex < history.length - 1) {
            history = history.slice(0, currentStateIndex + 1);
          }

          const canvasState = JSON.stringify(canvas.toJSON());
          history.push(canvasState);
          currentStateIndex++;

          setCanUndo(currentStateIndex > 0);
          setCanRedo(currentStateIndex < history.length - 1);
        } catch (error) {
          console.error("Error saving state:", error);
        } finally {
          isSaving = false;
        }
      };

      const canvasUndo = () => {
        if (currentStateIndex <= 0) return;

        isRedoing = true;
        try {
          currentStateIndex--;
          const state = JSON.parse(history[currentStateIndex]);

          canvas.loadFromJSON(state, () => {
            canvas.renderAll();
            setCanUndo(currentStateIndex > 0);
            setCanRedo(true);
            syncCanvasToYjs();
          });
        } catch (error) {
          console.error("Error during undo:", error);
        } finally {
          isRedoing = false;
        }
      };

      const canvasRedo = () => {
        if (currentStateIndex >= history.length - 1) return;

        isRedoing = true;
        try {
          currentStateIndex++;
          const state = JSON.parse(history[currentStateIndex]);

          canvas.loadFromJSON(state, () => {
            canvas.renderAll();
            setCanUndo(true);
            setCanRedo(currentStateIndex < history.length - 1);
            syncCanvasToYjs();
          });
        } catch (error) {
          console.error("Error during redo:", error);
        } finally {
          isRedoing = false;
        }
      };

      // Save initial state
      saveState();

      // Setup event listeners for state changes
      const events = ["object:added", "object:modified", "object:removed"];
      events.forEach((event) => {
        canvas.on(event as any, () => {
          if (!isRedoing) {
            saveState();
          }
        });
      });

      // Expose undo/redo methods globally
      (window as any).canvasUndo = canvasUndo;
      (window as any).canvasRedo = canvasRedo;

      // Return cleanup function
      return () => {
        events.forEach((event) => canvas.off(event as any));
        delete (window as any).canvasUndo;
        delete (window as any).canvasRedo;
      };
    },
    [syncCanvasToYjs]
  );

  // Setup tool event listeners (drawing, selection, etc.)
  const setupToolEventListeners = useCallback(
    (canvas: fabric.Canvas) => {
      let isDrawing = false;
      let startPoint: { x: number; y: number } | null = null;
      let currentObject: fabric.Object | null = null;

      const handleMouseDown = (options: fabric.TEvent<MouseEvent>) => {
        if (!fabricCanvasRef.current) return;
        const pointer = fabricCanvasRef.current.getPointer(options.e);
        // Skip if not left mouse button
        if (
          (options.e as MouseEvent)?.button !== undefined &&
          (options.e as MouseEvent)?.button !== 0
        )
          return;

        if (activeToolRef.current === "select") {
          canvas.forEachObject((obj) => {
            obj.selectable = true;
            obj.evented = true;
            obj.hasControls = true;
            obj.hasBorders = true;
          });
          return; // Let fabric.js handle selection
        }

        startPoint = { x: pointer.x, y: pointer.y };
        isDrawing = true;

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
              selectable: true,
              editable: true,
            });
            canvas.add(currentObject);
            canvas.setActiveObject(currentObject);
            isDrawing = false;
            syncCanvasToYjs();
            break;

          case "eraser":
            const activeObj = canvas.findTarget(options.e as MouseEvent);
            if (activeObj && !activeObj.evented) return;
            if (activeObj) {
              canvas.remove(activeObj);
            }
            break;
        }
      };

      // Setup event handlers for the canvas
      const handleMouseMove = (options: fabric.TEvent<MouseEvent>) => {
        if (!fabricCanvasRef.current || !isDrawing || !startPoint) return;
        const pointer = fabricCanvasRef.current.getPointer(options.e);

        if (activeToolRef.current === "select") return;

        if (activeToolRef.current === "eraser") {
          const activeObj = fabricCanvasRef.current.findTarget(options.e);
          if (activeObj && !activeObj.evented) return;
          if (activeObj) {
            fabricCanvasRef.current.remove(activeObj);
          }
          return;
        }

        if (!currentObject) return;

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
        fabricCanvasRef.current.renderAll();
      };

      const handleMouseUp = () => {
        isDrawing = false;

        if (currentObject) {
          if (!isValidShape(currentObject)) {
            canvas.remove(currentObject);
          } else {
            currentObject.set({
              selectable: activeToolRef.current === "select",
              evented: true,
              hasControls: activeToolRef.current === "select",
              hasBorders: activeToolRef.current === "select",
            });

            // Sync to Yjs and database
            syncCanvasToYjs();
          }

          currentObject = null;
        }

        startPoint = null;
        canvas.requestRenderAll();

        // If not erasing or free drawing, switch back to select tool
        if (
          activeToolRef.current !== "select" &&
          activeToolRef.current !== "eraser" &&
          activeToolRef.current !== "freeDraw"
        ) {
          setActiveTool("select");
        }
      };

      // Handle selection events
      canvas.on("selection:created", () => {
        if (activeToolRef.current === "select") {
          const selected = canvas.getActiveObjects();
          selected.forEach((obj) => {
            obj.selectable = true;
            obj.evented = true;
            obj.hasControls = true;
            obj.hasBorders = true;
          });
        }
      });

      canvas.on("selection:cleared", () => {
        if (activeToolRef.current === "select") {
          canvas.forEachObject((obj) => {
            obj.selectable = true;
            obj.evented = true;
            obj.hasControls = true;
            obj.hasBorders = true;
          });
        }
      });

      // Add event listeners
      canvas.on("mouse:down", handleMouseDown as any);
      canvas.on("mouse:move", handleMouseMove as any);
      canvas.on("mouse:up", handleMouseUp);
      canvas.on("mouse:out", handleMouseUp);

      // Return cleanup function
      return () => {
        canvas.off("mouse:down", handleMouseDown);
        canvas.off("mouse:move", handleMouseMove);
        canvas.off("mouse:up", handleMouseUp);
        canvas.off("mouse:out", handleMouseUp);
        canvas.off("selection:created");
        canvas.off("selection:cleared");
      };
    },
    [syncCanvasToYjs]
  );

  // Check if a shape is valid (not too small)
  const isValidShape = (obj: fabric.Object): boolean => {
    if (obj instanceof fabric.Rect) {
      return (obj.width || 0) > 5 && (obj.height || 0) > 5;
    } else if (obj instanceof fabric.Circle) {
      return (obj.radius || 0) > 5;
    } else if (obj instanceof fabric.Line) {
      const dx = (obj.x2 || 0) - (obj.x1 || 0);
      const dy = (obj.y2 || 0) - (obj.y1 || 0);
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

    // Ask for confirmation
    if (
      window.confirm(
        "Are you sure you want to clear the canvas? This cannot be undone."
      )
    ) {
      // Clear all objects
      const objects = canvas.getObjects();
      objects.forEach((obj) => canvas.remove(obj));

      canvas.requestRenderAll();
      syncCanvasToYjs();
      toast.success("Canvas cleared");
    }
  }, [syncCanvasToYjs]);

  const handleBringToFront = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.bringObjectToFront(activeObject);
      canvas.requestRenderAll();
      syncCanvasToYjs();
    }
  }, [syncCanvasToYjs]);

  const handleSendToBack = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.sendObjectToBack(activeObject);
      canvas.requestRenderAll();
      syncCanvasToYjs();
    }
  }, [syncCanvasToYjs]);

  const handleDuplicate = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const activeObject = canvas.getActiveObject();
    if (!activeObject) return;

    try {
      (activeObject.clone as any)(function (cloned: fabric.Object) {
        canvas.discardActiveObject();
        cloned.set({
          left: (activeObject.left || 0) + 10,
          top: (activeObject.top || 0) + 10,
          evented: true,
          hasControls: true,
        });

        canvas.add(cloned);
        canvas.setActiveObject(cloned);
        canvas.requestRenderAll();
        syncCanvasToYjs();
      });
    } catch (error) {
      console.error("Error duplicating object:", error);
    }
  }, [syncCanvasToYjs]);

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    try {
      (window as any).canvasUndo?.();
    } catch (error) {
      console.error("Error in handleUndo:", error);
    }
  }, [canUndo]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    try {
      (window as any).canvasRedo?.();
    } catch (error) {
      console.error("Error in handleRedo:", error);
    }
  }, [canRedo]);

  const handleSaveCanvas = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    try {
      // Create a temporary canvas for exporting
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = canvas.width || 800;
      tempCanvas.height = canvas.height || 600;

      const exportCanvas = new fabric.StaticCanvas(tempCanvas, {
        width: canvas.width,
        height: canvas.height,
      });

      // Fill with white background
      exportCanvas.backgroundColor = "#ffffff";
      exportCanvas.renderAll();

      // Clone and add all objects
      const objects = canvas.getObjects();

      if (objects.length === 0) {
        toast.error("Canvas is empty");
        return;
      }

      // Clone all objects and add them to export canvas
      Promise.all(
        objects.map(
          (obj) =>
            new Promise<fabric.Object>((resolve) => {
              (obj.clone as any)(function (clonedObj: fabric.Object) {
                resolve(clonedObj);
              });
            })
        )
      ).then((clonedObjects) => {
        // Add all cloned objects to the export canvas
        clonedObjects.forEach((cloned) => {
          exportCanvas.add(cloned);
        });

        exportCanvas.renderAll();

        // Generate and download PNG
        try {
          const dataURL = exportCanvas.toDataURL({
            format: "png",
            quality: 1.0,
            multiplier: 1,
          });

          const link = document.createElement("a");
          const timestamp = new Date()
            .toISOString()
            .replace(/[-:.]/g, "_")
            .substring(0, 19);
          link.download = `whiteboard_${timestamp}.png`;
          link.href = dataURL;
          link.click();

          toast.success("Canvas exported as PNG");
        } catch (error) {
          console.error("Error exporting as PNG:", error);
          toast.error("Failed to export canvas");
        }

        // Clean up
        exportCanvas.dispose();
      });
    } catch (error) {
      console.error("Error saving canvas:", error);
      toast.error("Failed to export canvas");
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
          // Clear canvas first
          canvas.clear();

          // Load from JSON
          canvas.loadFromJSON(event.target.result.toString(), () => {
            canvas.requestRenderAll();

            // Update object properties
            canvas.getObjects().forEach((obj) => {
              obj.selectable = activeToolRef.current === "select";
              obj.evented = true;
              obj.hasControls = activeToolRef.current === "select";
              obj.hasBorders = activeToolRef.current === "select";
            });

            // Save changes
            syncCanvasToYjs();

            toast.success("Canvas imported successfully");
          });
        } catch (err) {
          console.error("Error loading canvas:", err);
          toast.error(
            "Could not load the file. It may be corrupted or in the wrong format."
          );
        }
      };

      reader.readAsText(file);
    };

    input.click();
  }, [syncCanvasToYjs]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      // Delete key
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        const activeObject = canvas.getActiveObject();
        if (activeObject) {
          canvas.remove(activeObject);
          canvas.requestRenderAll();
          syncCanvasToYjs();
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

      // Keyboard shortcuts for tools
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case "v":
            setActiveTool("select");
            break;
          case "r":
            setActiveTool("rectangle");
            break;
          case "c":
            setActiveTool("circle");
            break;
          case "l":
            setActiveTool("line");
            break;
          case "p":
            setActiveTool("freeDraw");
            break;
          case "t":
            setActiveTool("text");
            break;
          case "e":
            setActiveTool("eraser");
            break;
        }
      }
    },
    [handleUndo, handleRedo, handleDuplicate, syncCanvasToYjs]
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logged out successfully");
    navigate("/login");
  }, [navigate]);

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

            <div className="separator"></div>

            {authFailed && (
              <div
                className="connection-status connection-error"
                title="Authentication failed. Please log in again."
              >
                <FaExclamationTriangle />
              </div>
            )}

            <button
              onClick={handleLogout}
              title="Log out"
              className="tool-button"
            >
              <FaSignOutAlt />
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

      <div className="canvas-wrapper" ref={canvasContainerRef}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
};

export default React.memo(Whiteboard);

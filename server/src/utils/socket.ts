import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-streams-adapter";
import Redis from "ioredis";
import http, { IncomingMessage } from "http";
import { boardService } from "../services/board.service";
import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";

interface DecodedUser {
  id: string;
  username?: string;
}

interface RoomClient {
  ws: WebSocket;
  userId: string;
  lastPing: number;
}

// Redis setup with error handling
const setupRedis = () => {
  const pubClient = new Redis(
    process.env.REDIS_URL || "redis://localhost:6379"
  );
  const subClient = pubClient.duplicate() as any;

  [pubClient, subClient].forEach((client) => {
    client.on("error", (err: any) => {
      console.error("Redis error:", err);
    });
  });

  return { pubClient, subClient };
};

const verifyToken = (token: string): DecodedUser | null => {
  try {
    // Clean up token if needed
    const newToken = token.split("/")[0];
    console.log("Verifying token:", {
      newToken: newToken.substring(0, 20) + "...",
    });

    const data = jwt.verify(newToken, process.env.JWT_SECRET!) as DecodedUser;
    console.log("Token verified successfully for user:", data.id);
    return data;
  } catch (err) {
    console.error("Token verification failed:", err);
    return null;
  }
};

export function setupSocketServer(server: http.Server) {
  console.log("Setting up WebSocket server...");
  const { pubClient, subClient } = setupRedis();
  const rooms = new Map<string, Set<RoomClient>>();

  // Setup Socket.io
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.adapter(createAdapter(pubClient, subClient));

  // Setup Y-websocket server - MODIFIED CONFIG
  const wsServer = new WebSocketServer({
    noServer: true, // Change to noServer
    perMessageDeflate: false,
  });

  // Handle upgrade requests
  server.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url!, `http://${request.headers.host}`)
      .pathname;

    if (pathname.startsWith("/yjs-ws/")) {
      wsServer.handleUpgrade(request, socket, head, (ws) => {
        console.log("Upgrade successful, emitting connection event");
        wsServer.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  // Log total connections
  setInterval(() => {
    const totalClients = Array.from(rooms.values()).reduce(
      (acc, room) => acc + room.size,
      0
    );
    console.log(`Active WebSocket connections: ${totalClients}`);
  }, 30000);

  // Cleanup inactive connections
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    rooms.forEach((clients, roomId) => {
      clients.forEach((client) => {
        if (now - client.lastPing > 30000) {
          // 30 seconds timeout
          client.ws.close();
          clients.delete(client);
        }
      });
      if (clients.size === 0) {
        rooms.delete(roomId);
      }
    });
  }, 10000);

  // Handle WebSocket connections - MODIFIED CONNECTION HANDLER
  wsServer.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    console.log("New WebSocket connection received:", req.url);

    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const pathSegments = url.pathname.split("/").filter(Boolean);
      const roomInfo = pathSegments[pathSegments.length - 1];
      const token = url.searchParams.get("token");

      console.log("Connection details:", {
        url: url.toString(),
        pathSegments,
        roomInfo,
        hasToken: !!token,
      });

      if (!roomInfo?.startsWith("board:") || !token) {
        console.log("Invalid connection parameters - Missing room or token");
        ws.close(1008, "Invalid connection parameters");
        return;
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        console.log("Authentication failed - Invalid token");
        ws.close(1008, "Authentication failed");
        return;
      }

      const boardId = roomInfo.replace("board:", "");
      const isMember = await boardService.isUserBoardMember(
        boardId,
        decoded.id
      );

      if (!isMember) {
        console.log("Not authorized");
        ws.close(1008, "Not authorized");
        return;
      }

      // Add successful connection logging
      console.log(`Client connected successfully to room ${roomInfo}`);

      // Initialize room if doesn't exist
      if (!rooms.has(roomInfo)) {
        rooms.set(roomInfo, new Set());
      }

      const roomClient: RoomClient = {
        ws,
        userId: decoded.id,
        lastPing: Date.now(),
      };

      rooms.get(roomInfo)!.add(roomClient);

      // Setup ping/pong
      ws.on("pong", () => {
        roomClient.lastPing = Date.now();
      });

      // Handle messages
      ws.on("message", (message: Buffer) => {
        try {
          const roomClients = rooms.get(roomInfo);
          if (!roomClients) return;

          roomClients.forEach((client) => {
            if (client.ws !== ws && client.ws.readyState === WebSocket.OPEN) {
              client.ws.send(message);
            }
          });
        } catch (error) {
          console.error("Broadcasting error:", error);
        }
      });

      // Cleanup on close
      ws.on("close", () => {
        const roomClients = rooms.get(roomInfo);
        if (roomClients) {
          roomClients.delete(roomClient);
          if (roomClients.size === 0) {
            rooms.delete(roomInfo);
          }
        }
      });

      // Start ping interval
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 15000);

      // Add connected client logging
      console.log(
        `Total clients in room ${roomInfo}: ${rooms.get(roomInfo)!.size}`
      );

      ws.send(JSON.stringify({ type: "connection-ack", userId: decoded.id }));
    } catch (error) {
      console.error("Connection error:", error);
      ws.close(1011, "Internal server error");
    }
  });

  // Cleanup on server shutdown
  server.on("close", () => {
    clearInterval(cleanupInterval);
    rooms.forEach((clients) => {
      clients.forEach((client) => client.ws.close());
    });
    rooms.clear();
  });

  return io;
}

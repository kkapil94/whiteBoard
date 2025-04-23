import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-streams-adapter";
import Redis from "ioredis";
import http, { IncomingMessage } from "http";
import { boardService } from "../services/board.service";
import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";
import prisma from "../db";

interface DecodedUser {
  id: string;
  username?: string;
}

interface CursorPosition {
  x: number;
  y: number;
  boardX: number;
  boardY: number;
  transform?: {
    x: number;
    y: number;
    scale: number;
  };
}

interface RoomClient {
  ws: WebSocket;
  userId: string;
  lastPing: number;
  username?: string;
  cursor?: CursorPosition;
  color?: string;
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

// Random color generator for user cursors
const generateRandomColor = () => {
  const colors = [
    "#2563eb", // blue
    "#059669", // emerald
    "#d97706", // amber
    "#dc2626", // red
    "#7c3aed", // violet
    "#db2777", // pink
    "#0891b2", // cyan
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

// Send all active users in a room to a specific client
const sendActiveUsers = (
  roomInfo: string,
  rooms: Map<string, Set<RoomClient>>,
  targetClient: RoomClient
) => {
  const roomClients = rooms.get(roomInfo);
  if (!roomClients) return;

  const users = Array.from(roomClients).map((client) => ({
    userId: client.userId,
    username: client.username,
    cursor: client.cursor || null,
    color: client.color,
  }));

  if (targetClient.ws.readyState === WebSocket.OPEN) {
    targetClient.ws.send(
      JSON.stringify({
        type: "active-users",
        users,
      })
    );
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
    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const pathSegments = url.pathname.split("/").filter(Boolean);
      const roomInfo = pathSegments[pathSegments.length - 1];
      const token = url.searchParams.get("token");

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
        ws.close(1008, "Not authorized");
        return;
      }

      // Get user details for collaboration
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, username: true, name: true },
      });

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
        username: user?.name || user?.username || "Anonymous",
        color: generateRandomColor(),
      };

      rooms.get(roomInfo)!.add(roomClient);

      // Broadcast new user joined to existing users in the room
      const roomClients = rooms.get(roomInfo)!;
      roomClients.forEach((client) => {
        if (
          client.userId !== decoded.id &&
          client.ws.readyState === WebSocket.OPEN
        ) {
          client.ws.send(
            JSON.stringify({
              type: "user-joined",
              userId: decoded.id,
              username: roomClient.username,
              color: roomClient.color,
            })
          );
        }
      });

      // Send current users to the new connection
      sendActiveUsers(roomInfo, rooms, roomClient);

      // Setup ping/pong
      ws.on("pong", () => {
        roomClient.lastPing = Date.now();
      });

      // Handle messages
      ws.on("message", (message: Buffer) => {
        try {
          const roomClients = rooms.get(roomInfo);
          if (!roomClients) return;

          // First byte is message type in Y.js protocol
          const firstByte = message[0];
          // Y.js sync message types are numbers, JSON messages are strings starting with { or [
          const isJson = message
            .toString()
            .trim()
            .match(/^[\{\[]/);

          if (isJson) {
            // Handle JSON messages (cursor updates, etc)
            const msgData = JSON.parse(message.toString());
            roomClient.lastPing = Date.now();

            if (msgData.type === "cursor-position") {
              roomClient.cursor = msgData.cursor;
              // Broadcast cursor position to other clients
              roomClients.forEach((client) => {
                if (
                  client.userId !== decoded.id &&
                  client.ws.readyState === WebSocket.OPEN
                ) {
                  client.ws.send(
                    JSON.stringify({
                      type: "cursor-update",
                      userId: decoded.id,
                      cursor: msgData.cursor,
                      username: roomClient.username,
                      color: roomClient.color,
                    })
                  );
                }
              });
            } else if (msgData.type === "board-update") {
              // Broadcast board updates to other clients
              roomClients.forEach((client) => {
                if (
                  client.userId !== decoded.id &&
                  client.ws.readyState === WebSocket.OPEN
                ) {
                  client.ws.send(message);
                }
              });
            } else if (msgData.type === "invitation-response") {
              // Handle invitation responses
              roomClients.forEach((client) => {
                if (
                  client.userId === msgData.inviterId &&
                  client.ws.readyState === WebSocket.OPEN
                ) {
                  client.ws.send(message);
                }
              });
            }
          } else {
            // Handle binary Y.js protocol messages
            roomClient.lastPing = Date.now();

            // Forward Y.js messages to all other clients
            roomClients.forEach((client) => {
              if (
                client.userId !== decoded.id &&
                client.ws.readyState === WebSocket.OPEN
              ) {
                client.ws.send(message);
              }
            });
          }
        } catch (error) {
          // Log error but don't throw - we want to keep the connection alive
          console.error("Broadcasting error:", error);
        }
      });

      // Cleanup on close
      ws.on("close", () => {
        const roomClients = rooms.get(roomInfo);
        if (roomClients) {
          // Broadcast user left message
          roomClients.forEach((client) => {
            if (
              client.userId !== decoded.id &&
              client.ws.readyState === WebSocket.OPEN
            ) {
              client.ws.send(
                JSON.stringify({
                  type: "user-left",
                  userId: decoded.id,
                })
              );
            }
          });

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

      ws.send(
        JSON.stringify({
          type: "connection-ack",
          userId: decoded.id,
          color: roomClient.color,
          username: roomClient.username,
        })
      );
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

// @ts-ignore
import { WebsocketProvider } from "y-websocket/bin/utils";
import { Server } from "socket.io";
import {
  createAdapter,
  RedisStreamsAdapterOptions,
} from "@socket.io/redis-streams-adapter";
import Redis from "ioredis";
import http from "http";
import { boardService } from "../services/board.service";
import jwt from "jsonwebtoken";
import { WebSocketServer } from "ws";

// Create Redis clients
const pubClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
const subClient = pubClient.duplicate() as RedisStreamsAdapterOptions;

interface DecodedUser {
  id: string;
}

const verifyToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY!) as DecodedUser;
    return decoded;
  } catch (err) {
    console.log(err);
  }
};

export function setupSocketServer(server: http.Server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Apply Redis adapter
  io.adapter(createAdapter(pubClient, subClient));

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error"));
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error("Invalid token"));
      }

      // Store user data in socket
      socket.data.user = decoded;
      next();
    } catch (error) {
      next(new Error("Authentication error"));
    }
  });

  // Handle connections
  io.on("connection", (socket) => {
    console.log("User connected:", socket.data.user.id);

    // Handle joining a board room
    socket.on("join-board", async (boardId) => {
      try {
        const userId = socket.data.user.id;

        // Check if user is a member of this board
        const isMember = await boardService.isUserBoardMember(boardId, userId);
        if (!isMember) {
          socket.emit("error", "Not authorized to access this board");
          return;
        }

        // Join the room
        socket.join(`board:${boardId}`);
        socket.emit("board-joined", boardId);

        // Notify other members about the new user
        socket.to(`board:${boardId}`).emit("user-joined", {
          userId: socket.data.user.id,
          username: socket.data.user.username,
        });

        // Track user's cursor position
        socket.on("cursor-move", (data) => {
          socket.to(`board:${boardId}`).emit("cursor-update", {
            userId: socket.data.user.id,
            username: socket.data.user.username,
            x: data.x,
            y: data.y,
          });
        });
      } catch (error) {
        console.error("Error joining board:", error);
        socket.emit("error", "Failed to join board");
      }
    });

    // Handle leaving a board
    socket.on("leave-board", (boardId) => {
      socket.leave(`board:${boardId}`);
      socket.to(`board:${boardId}`).emit("user-left", {
        userId: socket.data.user.id,
        username: socket.data.user.username,
      });
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.data.user.id);
    });
  });

  // Setup Y-websocket integration
  const wsServer = new WebSocketServer({
    server,
    path: "/yjs-ws/",
  });

  // Authenticate WebSocket connections for Yjs
  wsServer.on("connection", async (conn: WebSocket, req: Request) => {
    try {
      // Extract room ID from URL (e.g., /yjs-ws/board:123)
      const url = new URL(req.url || "", "http://localhost");
      const roomId = url.pathname.split("/").pop();

      if (!roomId || !roomId.startsWith("board:")) {
        conn.close();
        return;
      }

      const boardId = roomId.replace("board:", "");

      // Extract token from query params
      const token = url.searchParams.get("token");
      if (!token) {
        conn.close();
        return;
      }

      const decoded = verifyToken(token);
      if (!decoded) {
        conn.close();
        return;
      }

      // Check if user is a member of this board
      const isMember = await boardService.isUserBoardMember(
        boardId,
        decoded.id
      );
      if (!isMember) {
        conn.close();
        return;
      }

      // Allow connection
      conn.addEventListener("message", (message) => {
        // Handle Yjs messages
        console.log(message);
      });
    } catch (error) {
      console.error("WebSocket error:", error);
      conn.close();
    }
  });

  return io;
}

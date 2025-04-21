// src/routes/board.routes.ts
import express from "express";
import {
  addMemberToBoard,
  createBoard,
  deleteBoard,
  getBoardById,
  getUserBoards,
  removeMemberFromBoard,
  updateBoardName,
  updateBoardContent,
} from "../controllers/board.controller";
import { verifyToken } from "../middlewares/verifyToken";

const router = express.Router();

// Apply verifyToken middleware to all routes
router.use(verifyToken);

// Board CRUD routes
router.post("/", createBoard);
router.get("/", getUserBoards);
router.get("/:boardId", getBoardById);
router.put("/:boardId", updateBoardName);
router.patch("/:boardId", updateBoardContent);
router.delete("/:boardId", deleteBoard);

// Board member management routes
router.post("/:boardId/members", addMemberToBoard);
router.delete("/:boardId/members/:memberId", removeMemberFromBoard);

export default router;

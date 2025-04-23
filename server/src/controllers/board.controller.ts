// src/controllers/board.controller.ts
import { Request, Response } from "express";
import { boardService } from "../services/board.service";
import { asyncHandler } from "../utils/asyncHandler";
import ErrorHandler from "../utils/errorHandler";
import prisma from "../db";
import { sendMail } from "../services/email.service";

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export const createBoard = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { name } = req.body;
    const userId = req.user.id; // Assuming auth middleware sets req.user

    if (!name) {
      return res.status(400).json({ message: "Board name is required" });
    }

    const board = await boardService.createBoard(userId, name);
    return res.status(201).json(board);
  }
);

// Get all boards for the current user
export const getUserBoards = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    console.log(req.user);
    const userId = req.user?.id;
    const boards = await boardService.getUserBoards(userId);
    return res.json(boards);
  }
);

// Get a specific board by ID
export const getBoardById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { boardId } = req.params;
    const userId = req.user.id;

    // Check if user is a member of this board
    const isMember = await boardService.isUserBoardMember(boardId, userId);
    if (!isMember) {
      return res
        .status(403)
        .json({ message: "Not authorized to access this board" });
    }

    const board = await boardService.getBoardById(boardId);
    if (!board) {
      return res.status(404).json({ message: "Board not found" });
    }

    return res.json(board);
  }
);

export const addMemberToBoard = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { boardId } = req.params;
    const { memberIdentifier } = req.body; // Email, username or ID
    const userId = req.user.id;

    if (!memberIdentifier) {
      return res
        .status(400)
        .json({ message: "Member email, username or ID is required" });
    }

    const updatedBoard = await boardService.addMemberToBoard(
      boardId,
      userId,
      memberIdentifier
    );
    return res.json(updatedBoard);
  }
);

export const removeMemberFromBoard = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { boardId } = req.params;
    const { memberId } = req.body;
    const userId = req.user.id;

    if (!memberId) {
      return res.status(400).json({ message: "Member ID is required" });
    }

    const updatedBoard = await boardService.removeMemberFromBoard(
      boardId,
      userId,
      memberId
    );
    return res.json(updatedBoard);
  }
);

// Update board name
export const updateBoardName = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { boardId } = req.params;
    const { name } = req.body;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ message: "Board name is required" });
    }

    try {
      const updatedBoard = await boardService.updateBoardName(
        boardId,
        userId,
        name
      );
      return res.json(updatedBoard);
    } catch (error: any) {
      console.error("Update board error:", error);
      if (error.message === "Not authorized to update this board") {
        return res.status(403).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

// Delete a board
export const deleteBoard = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { boardId } = req.params;
    const userId = req.user.id;

    await boardService.deleteBoard(boardId, userId);
    return res.json({ message: "Board deleted successfully" });
  }
);

// Update board content
export const updateBoardContent = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { boardId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content) {
      return res.status(400).json({ message: "Board content is required" });
    }

    try {
      const updatedBoard = await boardService.updateBoardContent(
        boardId,
        userId,
        content
      );
      return res.json(updatedBoard);
    } catch (error: any) {
      console.error("Update board content error:", error);
      if (error.message === "Not authorized to update this board") {
        return res.status(403).json({ message: error.message });
      }
      return res.status(500).json({ message: "Internal server error" });
    }
  }
);

export const inviteUser = asyncHandler(async (req: Request, res: Response) => {
  const { boardId } = req.params;
  const { email } = req.body;
  const userId = req.user?.id;

  if (!email) {
    throw new ErrorHandler(400, "Email is required");
  }

  // Check if user has permission to invite
  const board = await boardService.getBoardById(boardId);
  if (!board) {
    throw new ErrorHandler(404, "Board not found");
  }

  if (board.ownerId !== userId) {
    throw new ErrorHandler(403, "Only board owner can send invitations");
  }

  // Check if user exists
  const invitedUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!invitedUser) {
    throw new ErrorHandler(404, "User not found");
  }

  // Check if user is already a member
  const isMember = await boardService.isUserBoardMember(
    boardId,
    invitedUser.id
  );
  if (isMember) {
    throw new ErrorHandler(400, "User is already a member of this board");
  }

  // Add user to board
  await prisma.board.update({
    where: { id: boardId },
    data: {
      members: {
        connect: { id: invitedUser.id },
      },
    },
  });

  // Send invitation email
  const inviter = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  await sendMail({
    to: email,
    subject: `Invitation to collaborate on ${board.name}`,
    html: `
      <h2>You've been invited to collaborate!</h2>
      <p>${inviter?.name} has invited you to collaborate on the whiteboard "${board.name}".</p>
      <p>Click the link below to access the board:</p>
      <a href="${process.env.FRONTEND_URL}/board/${boardId}">Open Whiteboard</a>
    `,
  });

  res.status(200).json({
    success: true,
    message: "Invitation sent successfully",
  });
});

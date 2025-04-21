// src/services/board.service.ts
import prisma from "../db";

export const boardService = {
  // Create a new board
  async createBoard(userId: string, name: string) {
    return prisma.board.create({
      data: {
        name,
        owner: { connect: { id: userId } },
        members: { connect: { id: userId } }, // Owner is also a member
      },
      include: {
        owner: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        members: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });
  },

  // Get boards owned by a user
  async getUserBoards(userId: string) {
    return prisma.board.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { id: userId } } }],
      },
      include: {
        owner: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        members: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        _count: { select: { members: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  },

  // Get board by ID with members
  async getBoardById(boardId: string) {
    return prisma.board.findUnique({
      where: { id: boardId },
      include: {
        owner: {
          select: { id: true, username: true, name: true, avatar: true },
        },
        members: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });
  },

  // Add member to a board
  async addMemberToBoard(
    boardId: string,
    userId: string,
    memberIdOrEmail: string
  ) {
    // Find the user by email or username
    const memberToAdd = await prisma.user.findFirst({
      where: {
        OR: [
          { email: memberIdOrEmail },
          { username: memberIdOrEmail },
          { id: memberIdOrEmail },
        ],
      },
    });

    if (!memberToAdd) {
      throw new Error("User not found");
    }

    // Check if user is board owner
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { ownerId: true },
    });

    if (!board || board.ownerId !== userId) {
      throw new Error("Not authorized to add members to this board");
    }

    // Add member to board
    return prisma.board.update({
      where: { id: boardId },
      data: {
        members: {
          connect: { id: memberToAdd.id },
        },
      },
      include: {
        members: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });
  },

  // Remove member from a board
  async removeMemberFromBoard(
    boardId: string,
    userId: string,
    memberIdToRemove: string
  ) {
    // Check if user is board owner
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { ownerId: true },
    });

    if (!board || board.ownerId !== userId) {
      throw new Error("Not authorized to remove members from this board");
    }

    // Cannot remove the owner
    if (board.ownerId === memberIdToRemove) {
      throw new Error("Cannot remove the board owner");
    }

    // Remove member from board
    return prisma.board.update({
      where: { id: boardId },
      data: {
        members: {
          disconnect: { id: memberIdToRemove },
        },
      },
      include: {
        members: {
          select: { id: true, username: true, name: true, avatar: true },
        },
      },
    });
  },

  // Update board name
  async updateBoardName(boardId: string, userId: string, name: string) {
    // Check if user is board owner
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { ownerId: true },
    });

    if (!board || board.ownerId !== userId) {
      throw new Error("Not authorized to update this board");
    }

    return prisma.board.update({
      where: { id: boardId },
      data: { name },
    });
  },

  // Update board content
  async updateBoardContent(boardId: string, userId: string, content: string) {
    // Check if user is a member of the board
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [{ ownerId: userId }, { members: { some: { id: userId } } }],
      },
    });

    if (!board) {
      throw new Error("Not authorized to update this board");
    }

    return prisma.board.update({
      where: { id: boardId },
      data: { content },
    });
  },

  // Delete a board
  async deleteBoard(boardId: string, userId: string) {
    // Check if user is board owner
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { ownerId: true },
    });

    if (!board || board.ownerId !== userId) {
      throw new Error("Not authorized to delete this board");
    }

    return prisma.board.delete({
      where: { id: boardId },
    });
  },

  // Check if a user is a member of a board
  async isUserBoardMember(boardId: string, userId: string) {
    const board = await prisma.board.findFirst({
      where: {
        id: boardId,
        OR: [{ ownerId: userId }, { members: { some: { id: userId } } }],
      },
    });

    return !!board;
  },
};

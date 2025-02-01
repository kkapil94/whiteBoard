import { CookieOptions, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import ErrorHandler from "../utils/errorHandler";
import bcrypt from "bcrypt";
import prisma from "../db";
import jwt from "jsonwebtoken";

export const register = asyncHandler(
  async (req: Request, res: Response, next: any) => {
    const { name, email, password, username } = req.body;
    if (!name || !email || !password || !username) {
      return next(new ErrorHandler(400, "All fields are required"));
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          {
            email,
          },
          { username },
        ],
      },
    });

    if (user) {
      return next(
        new ErrorHandler(400, "User already exists with email or username")
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        username,
      },
    });

    const { password: _, ...rest } = newUser;
    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: rest,
    });
  }
);

export const login = asyncHandler(
  async (req: Request, res: Response, next: any) => {
    const { email, password } = req.body;
    if (!email || !password)
      return next(new ErrorHandler(400, "All fields are required"));

    const user = await prisma.user.findFirst({
      where: {
        email,
      },
    });

    if (!user) {
      return next(new ErrorHandler(400, "Invalid credentials"));
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return next(new ErrorHandler(400, "Invalid credentials"));
    }

    const options: CookieOptions = {
      httpOnly: true,
      secure: true,
      maxAge: 24 * 60 * 60 * 1000,
    };

    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" }
    );

    return res.status(200).cookie("accessToken", accessToken, options).json({
      success: true,
      message: "User logged in successfully",
      user,
      accessToken,
    });
  }
);

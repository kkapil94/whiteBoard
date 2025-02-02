import { CookieOptions, Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import ErrorHandler from "../utils/errorHandler";
import bcrypt from "bcrypt";
import prisma from "../db";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { sendMail } from "../services/email.service";

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

export const forgotPassword = asyncHandler(
  async (req: Request, res: Response, next: any) => {
    const { email } = req.body;
    if (!email) return next(new ErrorHandler(400, "All fields are required"));

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) return next(new ErrorHandler(400, "User not found"));

    const token = crypto.randomBytes(20).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
    const expiresIn = Date.now() / 1000 + 600;
    const tokenBody = {
      token: hashedToken,
      userId: user.id,
      expiresIn,
    };

    const newToken = await prisma.token.upsert({
      where: { userId: user.id },
      update: { token: hashedToken, expiresIn },
      create: tokenBody,
    });

    if (!newToken) return next(new ErrorHandler(500, "Internal server error"));

    const mailPayload = {
      to: email,
      subject: "Reset Password",
      text: `Reset password link: ${process.env.CLIENT_URL}/reset-password?token=${hashedToken}`,
    };

    sendMail(mailPayload);

    return res.status(200).json({
      success: true,
      message: "Reset password link sent to your registered email.",
    });
  }
);

export const resetPassword = asyncHandler(
  async (req: Request, res: Response, next: any) => {
    const { token, password } = req.body;
    if (!token || !password)
      return next(new ErrorHandler(400, "All fields are required"));

    // const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const userToken = await prisma.token.findFirst({
      // @ts-ignore
      where: { token, expiresIn: { gt: Date.now() / 1000 } }, // @ts-ignore
    }); // @ts-ignore

    if (!userToken)
      return next(new ErrorHandler(400, "Invalid or expired token"));

    const hashedPassword = await bcrypt.hash(password, 10);

    const updatedUser = await prisma.user.update({
      where: { id: userToken.userId },
      data: { password: hashedPassword },
    });

    if (!updatedUser)
      return next(new ErrorHandler(500, "Internal server error"));

    const { password: _, ...rest } = updatedUser;

    return res.status(200).json({
      success: true,
      message: "Password reset successfully", // @ts-ignore
      user: rest,
    });
  }
);

import { Request, Response } from "express";
import ErrorHandler from "./errorHandler";

export const asyncHandler =
  (fun: any) => (req: Request, res: Response, next: any) => {
    try {
      fun(req, res, next);
    } catch (error) {
      next(new ErrorHandler(500, "Internal server error"));
    }
  };

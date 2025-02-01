import { Request, Response } from "express";
import ErrorHandler from "../utils/errorHandler";

function errorMiddleware(
  err: ErrorHandler,
  req: Request,
  res: Response,
  next: any
) {
  const status = err.statusCode;

  res.status(status).json({
    success: false,
    message: err.message || "Internal server error.",
  });
}

export default errorMiddleware;

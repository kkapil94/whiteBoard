import jwt from "jsonwebtoken";
import { Request, Response } from "express";

interface RequestWithUser extends Request {
  user: any;
}

export const verifyToken = async (
  req: RequestWithUser,
  res: Response,
  next: any
) => {
  // Get the authorization header
  const authHeader = req.header("Authorization");

  // Check if the header is present and has a valid format
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ error: "Unauthorized" });
  }

  // Extract the token from the header
  const token = authHeader.substring(7);

  // Verify the token using a secret key
  try {
    const decoded = jwt.verify(token, process.env.SECRET_KEY!);
    req.user = decoded;
  } catch (err) {
    return res.status(401).send({ error: "Invalid token" });
  }

  // Decode the request body
  const decodedBody = JSON.parse(req.body);

  // Return the decoded data
  res.locals.decodedData = decodedBody;

  // Call the next middleware or route handler
  next();
};

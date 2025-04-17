import express, { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import logger from "./utils/logger";
import { createServer } from "http";

import errorMiddleware from "./middlewares/ApiHandler";
import userRoutes from "./routes/user.route";
import { setupSocketServer } from "./utils/socket";

const app: Application = express();
const server = createServer(app);

setupSocketServer(server);

const morganFormat = ":method :url :status :response-time ms";

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ limit: "50kb", extended: true }));
app.use(cors({ credentials: true, origin: "*" }));
app.use(cookieParser());
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => {
        const logObject = {
          method: message.split(" ")[0],
          url: message.split(" ")[1],
          status: message.split(" ")[2],
          responseTime: message.split(" ")[3],
        };
        logger.info(JSON.stringify(logObject));
      },
    },
  })
);

app.get("/api/v1", (req: Request, res: Response, next: NextFunction) => {
  res.status(200).json({
    message: "Server is running",
  });
});
app.use("/api/v1/user", userRoutes);

app.all("*", (req: Request, res: Response) => {
  res.status(404).json({
    message: "Route not found",
  });
});

app.use(errorMiddleware);

export default server;
